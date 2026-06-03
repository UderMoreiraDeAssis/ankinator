/**
 * Rotas da API do Ankinator.
 *
 * Fluxo: upload → extract (estrutura) → generate (job assíncrono c/ progresso SSE)
 *        → revisão no cliente → export (CSV) ou push (AnkiConnect).
 */
import { Router, type Request, type Response } from 'express';
import multer from 'multer';
import path from 'node:path';
import os from 'node:os';
import { promises as fs } from 'node:fs';
import { config } from './config.js';
import { loadDocument } from './core/document-loader.js';
import { chunkDocument } from './core/chunker.js';
import { QuestionGenerator } from './core/question-generator.js';
import { toAnkiCsv } from './core/exporters/csv.js';
import { pushToAnki, ankiConnectStatus, listDecks } from './core/exporters/ankiconnect.js';
import { documentStore, jobStore } from './store.js';
import type { GenerateOptions, Questao } from './core/types.js';

const UPLOAD_DIR = path.join(os.tmpdir(), 'ankinator-uploads');

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      fs.mkdir(UPLOAD_DIR, { recursive: true })
        .then(() => cb(null, UPLOAD_DIR))
        .catch((e) => cb(e, UPLOAD_DIR));
    },
    filename: (_req, file, cb) => {
      const safe = file.originalname.replace(/[^\w.\-]+/g, '_');
      cb(null, `${Date.now()}-${safe}`);
    },
  }),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB
  fileFilter: (_req, file, cb) => cb(null, file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf')),
});

export const api = Router();

/** Saúde do servidor + capacidades. */
api.get('/health', (_req: Request, res: Response) => {
  res.json({ ok: true, hasApiKey: config.hasApiKey(), model: config.model });
});

/** Status do AnkiConnect. */
api.get('/anki/status', async (_req, res) => {
  res.json(await ankiConnectStatus(config.ankiconnectUrl));
});

/** Lista decks do Anki. */
api.get('/anki/decks', async (_req, res) => {
  try {
    res.json({ decks: await listDecks(config.ankiconnectUrl) });
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

/** Upload de PDF. */
api.post('/upload', upload.single('pdf'), (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({ error: 'Envie um arquivo PDF no campo "pdf".' });
    return;
  }
  const entry = documentStore.create(req.file.originalname, req.file.path);
  res.json({ docId: entry.id, fileName: entry.fileName });
});

/** Extrai a estrutura do PDF (OpenDataLoader). */
api.post('/extract', async (req: Request, res: Response) => {
  const { docId, ocr, pages, password } = req.body ?? {};
  const entry = documentStore.get(docId);
  if (!entry) {
    res.status(404).json({ error: 'Documento não encontrado. Faça o upload novamente.' });
    return;
  }
  const doc = await loadDocument(entry.pdfPath, { ocr: !!ocr, pages, password });
  documentStore.update(docId, { loaded: doc });

  res.json({
    docId,
    fileName: doc.fileName,
    numPages: doc.numPages,
    title: doc.title,
    usedOcr: doc.usedOcr,
    totalChars: doc.markdown.length,
    sections: doc.sections.map((s) => ({
      id: s.id,
      title: s.title,
      level: s.level,
      pageStart: s.pageStart,
      pageEnd: s.pageEnd,
      charCount: s.charCount,
    })),
    markdownPreview: doc.markdown.slice(0, 4000),
  });
});

/** Inicia a geração de questões (job assíncrono). */
api.post('/generate', async (req: Request, res: Response) => {
  if (!config.hasApiKey()) {
    res.status(400).json({ error: 'ANTHROPIC_API_KEY não configurada no servidor (ver .env).' });
    return;
  }
  const { docId, selectedSectionIds, maxCharsPerChunk, options } = req.body ?? {};
  const entry = documentStore.get(docId);
  if (!entry?.loaded) {
    res.status(404).json({ error: 'Estrutura não carregada. Rode /extract antes de gerar.' });
    return;
  }

  const chunks = chunkDocument(entry.loaded, {
    selectedSectionIds: Array.isArray(selectedSectionIds) && selectedSectionIds.length ? selectedSectionIds : undefined,
    maxCharsPerChunk,
  });
  if (!chunks.length) {
    res.status(400).json({ error: 'Nenhum conteúdo selecionado para gerar questões.' });
    return;
  }

  const genOptions: GenerateOptions = {
    maxPerChunk: options?.maxPerChunk,
    incluirExtraidas: options?.incluirExtraidas,
    incluirCriadas: options?.incluirCriadas,
    tags: options?.tags,
    model: options?.model || config.model,
  };

  const job = jobStore.create(docId, chunks.length);
  res.json({ jobId: job.id, totalChunks: chunks.length });

  // executa em background
  const generator = new QuestionGenerator(config.anthropicKey, genOptions.model);
  generator
    .generate(chunks, genOptions, (p) => {
      jobStore.emit(job, { type: 'progress', data: p });
    })
    .then((result) => {
      job.result = result;
      job.questoes = result.questoes;
      job.status = 'done';
      jobStore.emit(job, { type: 'done', data: { total: result.questoes.length, erros: result.erros } });
    })
    .catch((err) => {
      job.status = 'error';
      job.error = err instanceof Error ? err.message : String(err);
      jobStore.emit(job, { type: 'error', data: { message: job.error } });
    });
});

/** Estado atual de um job (inclui as questões quando concluído). */
api.get('/jobs/:id', (req: Request, res: Response) => {
  const job = jobStore.get(String(req.params.id));
  if (!job) {
    res.status(404).json({ error: 'Job não encontrado.' });
    return;
  }
  res.json({
    id: job.id,
    status: job.status,
    totalChunks: job.totalChunks,
    progress: job.progress,
    questoes: job.status === 'done' ? job.questoes : [],
    erros: job.result?.erros ?? [],
    error: job.error,
  });
});

/** Stream SSE de progresso do job. */
api.get('/jobs/:id/events', (req: Request, res: Response) => {
  const job = jobStore.get(String(req.params.id));
  if (!job) {
    res.status(404).end();
    return;
  }
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  res.write(`event: hello\ndata: ${JSON.stringify({ totalChunks: job.totalChunks, progress: job.progress })}\n\n`);

  const send = (event: { type: string; data: unknown }) => {
    res.write(`event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`);
    if (event.type === 'done' || event.type === 'error') res.end();
  };
  job.subscribers.add(send);

  // se o job já terminou, fecha logo após o estado inicial
  if (job.status === 'done') send({ type: 'done', data: { total: job.questoes.length, erros: job.result?.erros ?? [] } });
  else if (job.status === 'error') send({ type: 'error', data: { message: job.error } });

  req.on('close', () => job.subscribers.delete(send));
});

/** Exporta questões como CSV do Anki (download). */
api.post('/export/csv', (req: Request, res: Response) => {
  const { questoes, fonte, tags } = req.body ?? {};
  if (!Array.isArray(questoes) || !questoes.length) {
    res.status(400).json({ error: 'Forneça as questões a exportar.' });
    return;
  }
  const csv = toAnkiCsv(questoes as Questao[], { fonte, tagsPadrao: tags });
  const baseName = (fonte ? path.basename(String(fonte), path.extname(String(fonte))) : 'ankinator') + '-questoes.csv';
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${baseName}"`);
  res.send(csv);
});

/** Envia questões para o Anki via AnkiConnect. */
api.post('/export/ankiconnect', async (req: Request, res: Response) => {
  const { questoes, deck, fonte, tags, allowDuplicate } = req.body ?? {};
  if (!Array.isArray(questoes) || !questoes.length) {
    res.status(400).json({ error: 'Forneça as questões a enviar.' });
    return;
  }
  if (!deck || typeof deck !== 'string') {
    res.status(400).json({ error: 'Informe o nome do deck.' });
    return;
  }
  try {
    const result = await pushToAnki(questoes as Questao[], {
      deck,
      fonte,
      tagsPadrao: tags,
      allowDuplicate: !!allowDuplicate,
      url: config.ankiconnectUrl,
    });
    res.json(result);
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : String(err) });
  }
});
