import type {
  AnkiStatus,
  DeckPreview,
  ExtractResult,
  GenerateOptions,
  JobState,
  OrganizeApplyResult,
  OrganizePlan,
  PushResult,
  Questao,
} from './types';

/** Descrição do deck base enviada ao servidor (geração incremental). */
export type DeckRef = { ankiDeck?: string; deckFileId?: string };

async function jsonOrThrow<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || `Erro ${res.status}`);
  return data as T;
}

export const api = {
  async health(): Promise<{ ok: boolean; provider: 'cli' | 'api'; canGenerate: boolean; hasApiKey: boolean; model: string }> {
    return jsonOrThrow(await fetch('/api/health'));
  },

  async upload(file: File): Promise<{ docId: string; fileName: string }> {
    const form = new FormData();
    form.append('pdf', file);
    return jsonOrThrow(await fetch('/api/upload', { method: 'POST', body: form }));
  },

  async extract(docId: string, opts: { ocr?: boolean; pages?: string; password?: string } = {}): Promise<ExtractResult> {
    return jsonOrThrow(
      await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ docId, ...opts }),
      })
    );
  },

  async generate(
    docId: string,
    selectedSectionIds: string[],
    options: GenerateOptions,
    deck?: DeckRef
  ): Promise<{ jobId: string; totalChunks: number }> {
    return jsonOrThrow(
      await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ docId, selectedSectionIds, options, ...deck }),
      })
    );
  },

  /** Upload de um deck base (.txt/.csv/.apkg) para incrementar. */
  async uploadDeck(file: File): Promise<{ deckFileId: string; fileName: string }> {
    const form = new FormData();
    form.append('deck', file);
    return jsonOrThrow(await fetch('/api/deck/upload', { method: 'POST', body: form }));
  },

  /** Prévia do deck base: quantas questões já existem (+ amostra). */
  async deckPreview(deck: DeckRef): Promise<DeckPreview> {
    return jsonOrThrow(
      await fetch('/api/deck/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(deck),
      })
    );
  },

  async job(jobId: string): Promise<JobState> {
    return jsonOrThrow(await fetch(`/api/jobs/${jobId}`));
  },

  /** Abre um EventSource SSE para acompanhar o progresso do job. */
  jobEvents(jobId: string): EventSource {
    return new EventSource(`/api/jobs/${jobId}/events`);
  },

  async exportCsv(questoes: Questao[], fonte: string, tags: string[]): Promise<Blob> {
    const res = await fetch('/api/export/csv', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questoes, fonte, tags }),
    });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `Erro ${res.status}`);
    return res.blob();
  },

  async ankiStatus(): Promise<AnkiStatus> {
    return jsonOrThrow(await fetch('/api/anki/status'));
  },

  async ankiDecks(): Promise<string[]> {
    const data = await jsonOrThrow<{ decks: string[] }>(await fetch('/api/anki/decks'));
    return data.decks;
  },

  /** Reorganizador — FASE 1 (prévia, só leitura): monta o plano (merge + repetidos). */
  async organizePreview(body: {
    decks: string[];
    merge?: { target: string };
    dedup?: boolean;
    dedupThreshold?: number;
  }): Promise<OrganizePlan> {
    return jsonOrThrow(
      await fetch('/api/deck/organize/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    );
  },

  /** Reorganizador — FASE 2 (aplicar): executa só o aprovado. Merge é destrutivo. */
  async organizeApply(body: {
    plan: OrganizePlan;
    applyMerge?: boolean;
    applyDedup?: boolean;
  }): Promise<OrganizeApplyResult> {
    return jsonOrThrow(
      await fetch('/api/deck/organize/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    );
  },

  async pushToAnki(
    questoes: Questao[],
    deck: string,
    fonte: string,
    tags: string[],
    allowDuplicate: boolean
  ): Promise<PushResult> {
    return jsonOrThrow(
      await fetch('/api/export/ankiconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questoes, deck, fonte, tags, allowDuplicate }),
      })
    );
  },
};
