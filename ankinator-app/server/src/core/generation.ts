/**
 * Orquestração de geração, independente do provedor de LLM.
 *
 * Um QuestionProvider sabe gerar questões para UM bloco. Aqui rodamos todos os
 * blocos sequencialmente (respeita rate limits e mantém cache/contexto quente),
 * reportando progresso e isolando erros por bloco.
 *
 * Provedores disponíveis:
 *  - ApiProvider  → API Anthropic (ANTHROPIC_API_KEY), cobrança por token.
 *  - CliProvider  → `claude` CLI (assinatura Pro/Max), sem custo de API.
 */
import crypto from 'node:crypto';
import type { GenerateOptions, Questao, SemanticChunk } from './types.js';
import { log, timer } from '../logger.js';

export interface ChunkProgress {
  index: number;
  total: number;
  sectionTitles: string[];
  questoesNoBloco: number;
  erro?: string;
}

export interface GenerateResult {
  questoes: Questao[];
  erros: { chunkIndex: number; mensagem: string }[];
}

export interface RawQuestao {
  tipo?: 'extraida' | 'criada' | string;
  pergunta?: string;
  resposta?: string;
  metadata?: Questao['metadata'];
}

/** Provedor que gera questões para um bloco semântico. */
export interface QuestionProvider {
  /** Identificador legível (api | cli). */
  readonly nome: string;
  generateForChunk(chunk: SemanticChunk, opts: GenerateOptions): Promise<Questao[]>;
}

/** Normaliza questões cruas em Questao[], atribuindo ids e a fonte (páginas). */
export function mapRawQuestoes(raw: RawQuestao[], chunk: SemanticChunk): Questao[] {
  return raw
    .filter((q) => q && q.pergunta && q.resposta)
    .map((q) => ({
      id: crypto.randomUUID(),
      tipo: q.tipo === 'extraida' ? 'extraida' : 'criada',
      pergunta: String(q.pergunta).trim(),
      resposta: String(q.resposta).trim(),
      pageStart: chunk.pageStart,
      pageEnd: chunk.pageEnd,
      metadata: q.metadata && Object.keys(q.metadata).length ? q.metadata : undefined,
    }));
}

/** Extrai o objeto {questoes:[...]} de um texto livre (tolera cercas de código). */
export function parseQuestoesJson(text: string): RawQuestao[] {
  if (!text) return [];
  // remove cercas ```json ... ```
  const unfenced = text.replace(/```(?:json)?/gi, '').trim();
  // recorta do primeiro { ao último }
  const start = unfenced.indexOf('{');
  const end = unfenced.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return [];
  try {
    const obj = JSON.parse(unfenced.slice(start, end + 1)) as { questoes?: RawQuestao[] };
    return Array.isArray(obj.questoes) ? obj.questoes : [];
  } catch {
    return [];
  }
}

/** Roda a geração em todos os blocos, com progresso e isolamento de erros. */
export async function generateAll(
  provider: QuestionProvider,
  chunks: SemanticChunk[],
  opts: GenerateOptions,
  onProgress?: (p: ChunkProgress) => void
): Promise<GenerateResult> {
  const questoes: Questao[] = [];
  const erros: GenerateResult['erros'] = [];

  log.info('generateAll', `gerando questões em ${chunks.length} bloco(s) via provedor "${provider.nome}"`, {
    blocos: chunks.length,
    model: opts.model ?? '(default do provedor)',
  });
  const fimTotal = timer('generateAll', 'geração de todos os blocos');

  for (const chunk of chunks) {
    log.debug('generateAll', `bloco ${chunk.index + 1}/${chunks.length} START`, {
      index: chunk.index,
      sectionTitles: chunk.sectionTitles,
      charCount: chunk.charCount,
      temOverlap: !!chunk.contextoAnterior,
      model: opts.model ?? '(default)',
    });
    const fimBloco = timer('generateAll', `bloco ${chunk.index + 1}/${chunks.length}`);
    try {
      const qs = await provider.generateForChunk(chunk, opts);
      questoes.push(...qs);
      log.info('generateAll', `bloco ${chunk.index + 1}/${chunks.length} END`, { questoes: qs.length });
      fimBloco({ questoes: qs.length });
      onProgress?.({ index: chunk.index, total: chunks.length, sectionTitles: chunk.sectionTitles, questoesNoBloco: qs.length });
    } catch (err) {
      const mensagem = err instanceof Error ? err.message : String(err);
      erros.push({ chunkIndex: chunk.index, mensagem });
      log.error('generateAll', `bloco ${chunk.index + 1}/${chunks.length} FALHOU`, { erro: mensagem });
      fimBloco({ erro: true });
      onProgress?.({ index: chunk.index, total: chunks.length, sectionTitles: chunk.sectionTitles, questoesNoBloco: 0, erro: mensagem });
    }
  }

  log.info('generateAll', 'geração concluída', { questoes: questoes.length, blocos: chunks.length, erros: erros.length });
  fimTotal({ questoes: questoes.length, erros: erros.length });

  return { questoes, erros };
}
