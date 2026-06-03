import type {
  AnkiStatus,
  ExtractResult,
  GenerateOptions,
  JobState,
  PushResult,
  Questao,
} from './types';

async function jsonOrThrow<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || `Erro ${res.status}`);
  return data as T;
}

export const api = {
  async health(): Promise<{ ok: boolean; hasApiKey: boolean; model: string }> {
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
    options: GenerateOptions
  ): Promise<{ jobId: string; totalChunks: number }> {
    return jsonOrThrow(
      await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ docId, selectedSectionIds, options }),
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
