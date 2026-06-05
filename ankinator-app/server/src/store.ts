/**
 * Estado em memória do servidor (single-user, app local).
 * - documentos enviados (PDF no disco) e sua estrutura carregada;
 * - jobs de geração de questões, com progresso ao vivo.
 */
import crypto from 'node:crypto';
import type { LoadedDocument, Questao, SemanticChunk } from './core/types.js';
import type { ChunkProgress, GenerateResult } from './core/generation.js';
import type { EnrichProgress } from './core/specialists/enrich.js';

export interface DocEntry {
  id: string;
  fileName: string;
  pdfPath: string;
  createdAt: number;
  loaded?: LoadedDocument;
  chunks?: SemanticChunk[];
}

export type JobStatus = 'running' | 'done' | 'error';

export interface Job {
  id: string;
  docId: string;
  status: JobStatus;
  createdAt: number;
  progress: ChunkProgress[];
  totalChunks: number;
  result?: GenerateResult;
  questoes: Questao[];
  error?: string;
  /** Metadados da geração incremental (deck base), quando houver deck. */
  incremental?: IncrementalInfo;
  /** Assinantes SSE. */
  subscribers: Set<(event: JobEvent) => void>;
}

/** Resultado da geração incremental contra um deck base. */
export interface IncrementalInfo {
  /** true = o PDF (seções selecionadas) já está totalmente coberto pelo deck. */
  deckCompleto: boolean;
  /** Questões NOVAS (após anti-duplicata) que entraram no resultado. */
  novas: number;
  /** Questões geradas descartadas por serem duplicatas do deck base. */
  duplicadasRemovidas: number;
  /** Total de questões já existentes lidas do deck base. */
  existentes: number;
}

export type JobEvent =
  | { type: 'progress'; data: ChunkProgress }
  | { type: 'enrich-progress'; data: EnrichProgress }
  | { type: 'done'; data: { total: number; erros: GenerateResult['erros']; incremental?: IncrementalInfo } }
  | { type: 'error'; data: { message: string } };

/** Arquivo de deck base enviado (geração incremental) — .txt/.csv/.apkg no disco. */
export interface DeckFileEntry {
  id: string;
  fileName: string;
  filePath: string;
  createdAt: number;
}

const docs = new Map<string, DocEntry>();
const jobs = new Map<string, Job>();
const deckFiles = new Map<string, DeckFileEntry>();

export const documentStore = {
  create(fileName: string, pdfPath: string): DocEntry {
    const entry: DocEntry = { id: crypto.randomUUID(), fileName, pdfPath, createdAt: Date.now() };
    docs.set(entry.id, entry);
    return entry;
  },
  get(id: string): DocEntry | undefined {
    return docs.get(id);
  },
  update(id: string, patch: Partial<DocEntry>): DocEntry | undefined {
    const entry = docs.get(id);
    if (!entry) return undefined;
    Object.assign(entry, patch);
    return entry;
  },
};

export const deckFileStore = {
  create(fileName: string, filePath: string): DeckFileEntry {
    const entry: DeckFileEntry = { id: crypto.randomUUID(), fileName, filePath, createdAt: Date.now() };
    deckFiles.set(entry.id, entry);
    return entry;
  },
  get(id: string): DeckFileEntry | undefined {
    return deckFiles.get(id);
  },
};

export const jobStore = {
  create(docId: string, totalChunks: number): Job {
    const job: Job = {
      id: crypto.randomUUID(),
      docId,
      status: 'running',
      createdAt: Date.now(),
      progress: [],
      totalChunks,
      questoes: [],
      subscribers: new Set(),
    };
    jobs.set(job.id, job);
    return job;
  },
  get(id: string): Job | undefined {
    return jobs.get(id);
  },
  emit(job: Job, event: JobEvent): void {
    if (event.type === 'progress') job.progress.push(event.data);
    for (const sub of job.subscribers) {
      try {
        sub(event);
      } catch {
        /* assinante desconectado */
      }
    }
  },
};
