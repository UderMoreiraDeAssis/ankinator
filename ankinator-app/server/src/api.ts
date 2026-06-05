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
import { generateAll } from './core/generation.js';
import { enrichAll, deveRodarEnrich } from './core/specialists/enrich.js';
import { createProvider } from './core/providers/index.js';
import { toAnkiCsv } from './core/exporters/csv.js';
import { pushToAnki, ankiConnectStatus, listDecks } from './core/exporters/ankiconnect.js';
import { resolveExistingDeck, previewExistingDeck, partitionNovas, type DeckSource } from './core/existing-deck.js';
import { previewOrganize, applyOrganize } from './core/deck-organizer.js';
import { documentStore, jobStore, deckFileStore } from './store.js';
import type { IncrementalInfo } from './store.js';
import { log, timer } from './logger.js';
import { snapshotUsage, usageSince, formatCost } from './core/usage.js';
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
  res.json({
    ok: true,
    provider: config.provider,
    canGenerate: config.canGenerate(),
    hasApiKey: config.hasApiKey(),
    model: config.provider === 'api' ? config.model : config.cliModel,
  });
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
    const erro = err instanceof Error ? err.message : String(err);
    log.error('anki', 'falha ao listar decks', { erro });
    res.status(502).json({ error: erro });
  }
});

/** Upload de PDF. */
api.post('/upload', upload.single('pdf'), (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({ error: 'Envie um arquivo PDF no campo "pdf".' });
    return;
  }
  const entry = documentStore.create(req.file.originalname, req.file.path);
  log.info('upload', `PDF recebido: ${entry.fileName}`, {
    docId: entry.id,
    bytes: req.file.size,
    path: req.file.path,
  });
  res.json({ docId: entry.id, fileName: entry.fileName });
});

// ── Deck base (opcional) — geração incremental ────────────────────────────────

/** Extensões aceitas para o deck base enviado como arquivo. */
const DECK_EXTS = ['.txt', '.csv', '.tsv', '.apkg', '.colpkg'];

const uploadDeck = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      fs.mkdir(UPLOAD_DIR, { recursive: true })
        .then(() => cb(null, UPLOAD_DIR))
        .catch((e) => cb(e, UPLOAD_DIR));
    },
    filename: (_req, file, cb) => {
      const safe = file.originalname.replace(/[^\w.\-]+/g, '_');
      cb(null, `deck-${Date.now()}-${safe}`);
    },
  }),
  limits: { fileSize: 200 * 1024 * 1024 }, // .apkg pode ser grande
  fileFilter: (_req, file, cb) =>
    cb(null, DECK_EXTS.some((ext) => file.originalname.toLowerCase().endsWith(ext))),
});

/** Upload de um deck base (.txt/.csv/.apkg) para incrementar. */
api.post('/deck/upload', uploadDeck.single('deck'), (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({ error: `Envie um deck (${DECK_EXTS.join(', ')}) no campo "deck".` });
    return;
  }
  const entry = deckFileStore.create(req.file.originalname, req.file.path);
  log.info('deck', `deck base recebido: ${entry.fileName}`, { deckFileId: entry.id, bytes: req.file.size });
  res.json({ deckFileId: entry.id, fileName: entry.fileName });
});

/**
 * Resolve a descrição vinda do cliente em um DeckSource concreto.
 * Aceita `{ ankiDeck: "Nome" }` (ao vivo) ou `{ deckFileId: "..." }` (arquivo enviado).
 * Retorna null quando nenhum deck foi pedido (geração normal).
 */
function resolveDeckSource(body: { ankiDeck?: unknown; deckFileId?: unknown }): DeckSource | null {
  if (typeof body?.ankiDeck === 'string' && body.ankiDeck.trim()) {
    return { type: 'ankiconnect', deck: body.ankiDeck.trim() };
  }
  if (typeof body?.deckFileId === 'string' && body.deckFileId.trim()) {
    const entry = deckFileStore.get(body.deckFileId.trim());
    if (!entry) throw new Error('Arquivo de deck não encontrado. Faça o upload novamente.');
    return { type: 'file', filePath: entry.filePath, fileName: entry.fileName };
  }
  return null;
}

/** Prévia do deck base: quantas questões já existem (e uma amostra). */
api.post('/deck/preview', async (req: Request, res: Response) => {
  let source: DeckSource | null;
  try {
    source = resolveDeckSource(req.body ?? {});
  } catch (err) {
    res.status(404).json({ error: err instanceof Error ? err.message : String(err) });
    return;
  }
  if (!source) {
    res.status(400).json({ error: 'Informe um deck do Anki (ankiDeck) ou um arquivo enviado (deckFileId).' });
    return;
  }
  try {
    res.json(await previewExistingDeck(source));
  } catch (err) {
    const erro = err instanceof Error ? err.message : String(err);
    log.error('deck', 'falha ao ler deck base', { erro });
    res.status(502).json({ error: `Falha ao ler o deck base: ${erro}` });
  }
});

/**
 * Reorganizador de decks — FASE 1 (prévia, SÓ LEITURA). Monta o plano (merge + repetidos)
 * sem tocar a coleção. Body: { decks: string[], merge?: {target}, dedup?: boolean, dedupThreshold? }.
 */
api.post('/deck/organize/preview', async (req: Request, res: Response) => {
  const { decks, merge, dedup, dedupThreshold } = (req.body ?? {}) as {
    decks?: unknown;
    merge?: { target?: unknown };
    dedup?: unknown;
    dedupThreshold?: unknown;
  };
  if (!Array.isArray(decks) || decks.length === 0 || !decks.every((d) => typeof d === 'string')) {
    res.status(400).json({ error: 'Informe ao menos um deck (decks: string[]).' });
    return;
  }
  if (!merge && !dedup) {
    res.status(400).json({ error: 'Selecione ao menos uma operação (merge e/ou dedup).' });
    return;
  }
  if (merge && (typeof merge.target !== 'string' || !merge.target.trim())) {
    res.status(400).json({ error: 'merge.target (deck-alvo) é obrigatório quando merge está ativo.' });
    return;
  }
  if (dedupThreshold !== undefined && (typeof dedupThreshold !== 'number' || dedupThreshold <= 0 || dedupThreshold > 1)) {
    res.status(400).json({ error: 'dedupThreshold deve ser um número em (0, 1].' });
    return;
  }
  try {
    const plan = await previewOrganize(
      {
        decks: decks as string[],
        merge: merge ? { target: (merge.target as string).trim() } : undefined,
        dedup: !!dedup,
        dedupThreshold: typeof dedupThreshold === 'number' ? dedupThreshold : undefined,
      },
      config.ankiconnectUrl
    );
    res.json(plan);
  } catch (err) {
    const erro = err instanceof Error ? err.message : String(err);
    log.error('organize', 'falha na prévia de reorganização', { erro });
    res.status(502).json({ error: `Falha ao montar a prévia: ${erro}` });
  }
});

/**
 * Reorganizador de decks — FASE 2 (aplicar). Executa SÓ o aprovado. DESTRUTIVO (merge move
 * cards e apaga decks vazios); dedup é não-destrutivo (marca tag). Body: { plan, applyMerge?, applyDedup? }.
 */
api.post('/deck/organize/apply', async (req: Request, res: Response) => {
  const { plan, applyMerge, applyDedup } = (req.body ?? {}) as {
    plan?: unknown;
    applyMerge?: unknown;
    applyDedup?: unknown;
  };
  if (!plan || typeof plan !== 'object') {
    res.status(400).json({ error: 'plan (objeto vindo da prévia) é obrigatório.' });
    return;
  }
  if (!applyMerge && !applyDedup) {
    res.status(400).json({ error: 'Nada a aplicar (applyMerge e applyDedup ambos falsos).' });
    return;
  }
  // Valida o shape do plan por flag → 400 (erro do cliente) em vez de deixar um for-of
  // estourar lá dentro e virar 502 opaco (achado da revisão de segurança).
  const p = plan as Partial<import('./core/deck-organizer.js').OrganizePlan>;
  if (applyMerge) {
    const m = p.merge;
    if (!m || typeof m !== 'object' || typeof m.target !== 'string' || !m.target.trim() || !Array.isArray(m.moves)) {
      res.status(400).json({ error: 'applyMerge pedido, mas plan.merge é inválido (exige target string + moves array). Rode a prévia novamente.' });
      return;
    }
  }
  if (applyDedup) {
    const d = p.dedup;
    if (!d || typeof d !== 'object' || !Array.isArray(d.groups)) {
      res.status(400).json({ error: 'applyDedup pedido, mas plan.dedup é inválido (exige groups array). Rode a prévia novamente.' });
      return;
    }
  }
  try {
    const result = await applyOrganize(
      plan as import('./core/deck-organizer.js').OrganizePlan,
      { applyMerge: !!applyMerge, applyDedup: !!applyDedup },
      config.ankiconnectUrl
    );
    res.json(result);
  } catch (err) {
    const erro = err instanceof Error ? err.message : String(err);
    log.error('organize', 'falha ao aplicar reorganização', { erro });
    res.status(502).json({ error: `Falha ao aplicar: ${erro}` });
  }
});

/** Extrai a estrutura do PDF (OpenDataLoader). */
api.post('/extract', async (req: Request, res: Response) => {
  const { docId, ocr, pages, password } = req.body ?? {};
  const entry = documentStore.get(docId);
  if (!entry) {
    res.status(404).json({ error: 'Documento não encontrado. Faça o upload novamente.' });
    return;
  }
  log.info('extract', `início da extração: ${entry.fileName}`, {
    docId,
    ocr: !!ocr,
    pages: pages ?? '(todas)',
    comSenha: !!password,
  });
  const fimExtract = timer('extract', 'extração total');
  const doc = await loadDocument(entry.pdfPath, { ocr: !!ocr, pages, password });
  documentStore.update(docId, { loaded: doc });

  // Resumo da extração: loader (via usedOcr/env), volume e qualidade das seções.
  const comAviso = doc.sections.filter((s) => s.aviso).length;
  log.info('extract', `extração concluída: ${entry.fileName}`, {
    loader: doc.usedOcr ? 'ocr' : (process.env.ANKINATOR_PDF_LOADER?.trim().toLowerCase() || 'auto'),
    numPages: doc.numPages,
    totalChars: doc.markdown.length,
    usedOcr: doc.usedOcr,
    secoes: doc.sections.length,
    secoesComAviso: comAviso,
  });
  // Em debug, liste cada seção (title, level, charCount, aviso?) para inspeção fina.
  for (const s of doc.sections) {
    log.debug('extract', `seção "${s.title}"`, {
      level: s.level,
      paginas: s.pageStart === s.pageEnd ? s.pageStart : `${s.pageStart}-${s.pageEnd}`,
      charCount: s.charCount,
      ...(s.aviso ? { aviso: s.aviso } : {}),
    });
  }
  fimExtract({ secoes: doc.sections.length, totalChars: doc.markdown.length });

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
      // Markdown completo da seção, para a prévia por-bloco na UI (o doc já está em
      // cache em memória; permite inspecionar a extração de QUALQUER bloco, não só o 1º).
      markdown: s.markdown,
      // Aviso do revisor determinístico (bloco suspeito), quando houver.
      aviso: s.aviso,
    })),
    markdownPreview: doc.markdown.slice(0, 4000),
  });
});

/** Inicia a geração de questões (job assíncrono). */
api.post('/generate', async (req: Request, res: Response) => {
  if (!config.canGenerate()) {
    res.status(400).json({ error: 'Geração indisponível: provedor "api" selecionado sem ANTHROPIC_API_KEY (ver .env).' });
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
    overlapChars: config.chunkOverlap, // sobreposição entre blocos (ANKINATOR_CHUNK_OVERLAP)
  });
  if (!chunks.length) {
    res.status(400).json({ error: 'Nenhum conteúdo selecionado para gerar questões.' });
    return;
  }

  // Geração INCREMENTAL (opcional): resolve o deck base ANTES de responder, para que
  // erros (Anki offline, arquivo inválido) sejam imediatos e claros — nunca silenciosos.
  let deckSource: DeckSource | null;
  try {
    deckSource = resolveDeckSource(req.body ?? {});
  } catch (err) {
    res.status(404).json({ error: err instanceof Error ? err.message : String(err) });
    return;
  }
  let existingFronts: string[] = [];
  if (deckSource) {
    try {
      existingFronts = await resolveExistingDeck(deckSource);
      log.info('generate', `deck base: ${existingFronts.length} questão(ões) existente(s) (incremental)`, {
        fonte: deckSource.type === 'ankiconnect' ? `anki:${deckSource.deck}` : deckSource.fileName,
        existentes: existingFronts.length,
      });
    } catch (err) {
      const erro = err instanceof Error ? err.message : String(err);
      log.error('generate', 'falha ao ler deck base', { erro });
      res.status(502).json({ error: `Falha ao ler o deck base: ${erro}` });
      return;
    }
  }

  // Opções de enriquecimento efetivamente ligadas (resolvidas com os defaults documentados).
  const enrichLigados = {
    classificar: options?.classificar ?? true,
    cardBuilder: options?.cardBuilder ?? false,
    mnemonico: options?.mnemonico ?? true,
    imagem: options?.imagem ?? false,
  };
  log.info('generate', `início da geração: ${chunks.length} bloco(s)`, {
    docId,
    chunks: chunks.length,
    secoesSelecionadas: Array.isArray(selectedSectionIds) ? selectedSectionIds.length : '(todas)',
    overlapChars: config.chunkOverlap,
    enrich: enrichLigados,
    // Confirma se o knob de fidelidade [CRIADA] engatou neste run (ANKINATOR_CRIADA_FIDELITY).
    // 'livre' = variante que afrouxa só a [CRIADA]; 'estrita' = SYSTEM_FIDELITY padrão.
    // Sem este campo, um env mal-digitado produziria cards colados sem aviso (medir-c).
    criadaFidelidade: config.criadaFidelityLivre ? 'livre' : 'estrita',
    model: options?.model ?? (config.provider === 'api' ? config.model : config.cliModel),
  });
  // Em debug: o "plano de chunks" (por bloco: index, títulos, chars, tem contexto?).
  for (const c of chunks) {
    log.debug('generate', `plano chunk #${c.index}`, {
      sectionTitles: c.sectionTitles,
      charCount: c.charCount,
      estimatedTokens: c.estimatedTokens,
      temContextoAnterior: !!c.contextoAnterior,
    });
  }

  const genOptions: GenerateOptions = {
    maxPerChunk: options?.maxPerChunk,
    incluirExtraidas: options?.incluirExtraidas,
    incluirCriadas: options?.incluirCriadas,
    tags: options?.tags,
    model: options?.model, // undefined → modelo padrão do provedor
    classificar: options?.classificar,
    cardBuilder: options?.cardBuilder,
    mnemonico: options?.mnemonico,   // D-12: propagado ao enrichOpts
    imagem: options?.imagem,         // D-12: propagado ao enrichOpts
    // Incremental: fronts existentes como contexto anti-duplicata no prompt (cap em prompts.ts).
    existingQuestions: existingFronts.length ? existingFronts : undefined,
  };

  const provider = createProvider({
    kind: config.provider,
    apiKey: config.anthropicKey,
    apiModel: config.model,
    cliModel: config.cliModel,
    cliDisableThinking: config.generationDisableThinking,
    criadaFidelityLivre: config.criadaFidelityLivre,
  });

  const job = jobStore.create(docId, chunks.length);
  res.json({ jobId: job.id, totalChunks: chunks.length });
  const fimGeracao = timer('generate', `job ${job.id} (geração + enrich)`);
  // Baseline de custo/tokens: o diff snapshot→fim isola o consumo DESTE job (usage.ts).
  const usoAntes = snapshotUsage();

  // executa em background
  generateAll(provider, chunks, genOptions, (p) => {
    jobStore.emit(job, { type: 'progress', data: p });
  })
    .then(async (result) => {
      let questoes = result.questoes;

      // Incremental: anti-duplicata MECÂNICA contra o deck base, ANTES do enrich (assim o
      // enriquecimento — caro — roda só nas questões novas). Rede de segurança sobre a
      // camada semântica do prompt; junto, detectam "deck já completo" (0 novas).
      let incremental: IncrementalInfo | undefined;
      if (deckSource) {
        const { novas, duplicadas } = partitionNovas(questoes, existingFronts, (q) => q.pergunta);
        incremental = {
          deckCompleto: novas.length === 0,
          novas: novas.length,
          duplicadasRemovidas: duplicadas.length,
          existentes: existingFronts.length,
        };
        log.info('generate', `incremental: ${novas.length} nova(s), ${duplicadas.length} duplicada(s) removida(s) de ${questoes.length} gerada(s)`, incremental);
        questoes = novas;
      }

      const enrichOpts = {
        classificar: options?.classificar ?? true,   // documented default (WR-01)
        cardBuilder: options?.cardBuilder ?? false,  // documented default
        mnemonico: options?.mnemonico ?? true,        // D-12: default ON (mnemônico ativo por padrão)
        imagem: options?.imagem ?? false,             // D-12: default OFF (imagem requer quota extra)
        imageConcurrency: config.imageConcurrency,    // pool do estágio imagem (ANKINATOR_IMAGE_CONCURRENCY)
        cardBuilderConcurrency: config.cardBuilderConcurrency, // pool do card-builder (ANKINATOR_CARDBUILDER_CONCURRENCY)
        imageQuality: config.imageQuality,            // gestor de qualidade do SVG (ANKINATOR_IMAGE_QUALITY)
        imageMaxRetry: config.imageMaxRetry,          // retries guiados no estágio imagem (ANKINATOR_IMAGE_MAX_RETRY)
        imageSelective: config.imageSelective,        // imagem seletiva por técnica (ANKINATOR_IMAGE_SELECTIVE)
        // env vazia → undefined p/ o enrich usar o default (história,rima); senão a lista da env
        imageSkipTecnicas: config.imageSkipTecnicas.length ? config.imageSkipTecnicas : undefined,
        cardBuilderMaxSplit: config.cardBuilderMaxSplit, // teto do split do card-builder (ANKINATOR_CARDBUILDER_MAX_SPLIT)
      };
      // Só enriquece se há questões (incremental pode zerar → "deck completo", pula o enrich caro).
      if (questoes.length && deveRodarEnrich(enrichOpts)) {
        questoes = await enrichAll(questoes, enrichOpts, (e) => {
          jobStore.emit(job, { type: 'enrich-progress', data: e });
        });
      }
      job.result = result;
      job.questoes = questoes;
      job.incremental = incremental;
      job.status = 'done';
      log.info('generate', `job ${job.id} concluído`, {
        questoes: questoes.length,
        erros: result.erros.length,
        ...(incremental?.deckCompleto ? { deckCompleto: true } : {}),
      });
      fimGeracao({ questoes: questoes.length, erros: result.erros.length });
      logResumoCusto(job.id, usoAntes, questoes.length);
      jobStore.emit(job, { type: 'done', data: { total: questoes.length, erros: result.erros, incremental } });
    })
    .catch((err) => {
      job.status = 'error';
      job.error = err instanceof Error ? err.message : String(err);
      log.error('generate', `job ${job.id} falhou`, { erro: job.error });
      fimGeracao({ status: 'error' });
      logResumoCusto(job.id, usoAntes, 0); // custo do que rodou até falhar
      jobStore.emit(job, { type: 'error', data: { message: job.error } });
    });
});

/**
 * Loga o resumo de custo/tokens do job: total + quebra POR ESTÁGIO (geração,
 * classificar, cardBuilder, mnemônico, imagem). Lado a lado com o perfil de TEMPO
 * (logger.timer), dá a base para equilibrar custo × tempo × qualidade. Custo por card
 * ajuda a decidir, p.ex., se o estágio imagem (gargalo de tempo) vale o gasto.
 */
function logResumoCusto(jobId: string, antes: ReturnType<typeof snapshotUsage>, totalQuestoes: number): void {
  const { porEstagio, total } = usageSince(antes);
  if (!total.calls) {
    log.info('usage', `job ${jobId}: sem dados de tokens (CLI não retornou usage no envelope)`);
    return;
  }
  log.info('usage', `job ${jobId}: resumo de custo/tokens`, {
    chamadas: total.calls,
    inTok: total.inputTokens,
    outTok: total.outputTokens,
    cacheReadTok: total.cacheReadTokens,
    custo: formatCost(total.costUsd),
    custoPorCard: totalQuestoes ? formatCost(total.costUsd / totalQuestoes) : undefined,
  });
  for (const e of porEstagio) {
    log.info('usage', `  · ${e.stage}`, {
      chamadas: e.calls,
      inTok: e.inputTokens,
      outTok: e.outputTokens,
      cacheReadTok: e.cacheReadTokens || undefined,
      custo: formatCost(e.costUsd),
      pctCusto: total.costUsd ? `${Math.round((e.costUsd / total.costUsd) * 100)}%` : undefined,
    });
  }
}

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
    incremental: job.incremental,
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
  if (job.status === 'done') send({ type: 'done', data: { total: job.questoes.length, erros: job.result?.erros ?? [], incremental: job.incremental } });
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
  log.info('export', 'CSV gerado', { questoes: (questoes as Questao[]).length, fonte: fonte ?? '(sem fonte)' });
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
  log.info('export', `enviando ao Anki: deck "${deck}"`, {
    questoes: (questoes as Questao[]).length,
    allowDuplicate: !!allowDuplicate,
  });
  const fimPush = timer('export', `push AnkiConnect (deck "${deck}")`);
  try {
    const result = await pushToAnki(questoes as Questao[], {
      deck,
      fonte,
      tagsPadrao: tags,
      allowDuplicate: !!allowDuplicate,
      url: config.ankiconnectUrl,
    });
    fimPush({ enviadas: (questoes as Questao[]).length });
    log.info('export', `envio ao Anki concluído: deck "${deck}"`, result);
    res.json(result);
  } catch (err) {
    const erro = err instanceof Error ? err.message : String(err);
    log.error('export', `falha ao enviar ao Anki: deck "${deck}"`, { erro });
    res.status(502).json({ error: erro });
  }
});
