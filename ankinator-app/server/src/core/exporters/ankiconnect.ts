/**
 * Exportador via AnkiConnect.
 *
 * Envia os cards diretamente para o Anki aberto, usando o add-on AnkiConnect
 * (HTTP em http://127.0.0.1:8765 por padrão). Cria o deck se não existir e
 * adiciona notas do tipo "Basic" (Front/Back), com tags.
 *
 * Requer: Anki aberto + add-on AnkiConnect (código 2055492159) instalado.
 *
 * Phase 6: Front/Back agora usam buildFrontHtml/buildBackHtml (card-html.ts)
 * para gerar HTML educacional rico autocontido com inline CSS.
 */
import type { Questao } from '../types.js';
import { buildFrontHtml, buildBackHtml, escapeHtml } from './card-html.js';

const ANKICONNECT_URL = process.env.ANKICONNECT_URL?.trim() || 'http://127.0.0.1:8765';

interface AnkiConnectResponse<T> {
  result: T;
  error: string | null;
}

async function invoke<T>(action: string, params: Record<string, unknown> = {}, url = ANKICONNECT_URL): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, version: 6, params }),
    });
  } catch {
    throw new Error(
      `Não foi possível conectar ao AnkiConnect em ${url}. ` +
        'Verifique se o Anki está aberto e o add-on AnkiConnect (2055492159) está instalado.'
    );
  }
  const data = (await res.json()) as AnkiConnectResponse<T>;
  if (data.error) throw new Error(`AnkiConnect: ${data.error}`);
  return data.result;
}

/** Verifica se o AnkiConnect está acessível e retorna a versão. */
export async function ankiConnectStatus(url = ANKICONNECT_URL): Promise<{ online: boolean; version?: number; error?: string }> {
  try {
    const version = await invoke<number>('version', {}, url);
    return { online: true, version };
  } catch (err) {
    return { online: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Lista os decks existentes. */
export async function listDecks(url = ANKICONNECT_URL): Promise<string[]> {
  return invoke<string[]>('deckNames', {}, url);
}

export interface PushOptions {
  deck: string;
  fonte?: string;
  tagsPadrao?: string[];
  /** Evita duplicatas (AnkiConnect ignora notas duplicadas na mesma deck). */
  allowDuplicate?: boolean;
  url?: string;
}

export interface PushResult {
  deck: string;
  enviadas: number;
  ignoradas: number;
  total: number;
  ids: (number | null)[];
}

export function tagsDaQuestao(q: Questao, padrao: string[]): string[] {
  const tags = new Set<string>([`ankinator`, q.tipo, ...padrao, ...(q.tags ?? [])]);
  if (q.metadata?.banca) tags.add(q.metadata.banca.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, ''));
  if (q.metadata?.ano) tags.add(String(q.metadata.ano));
  return [...tags].filter(Boolean);
}

/**
 * Monta o HTML do verso (Back) de um card para AnkiConnect.
 * Delega para buildBackHtml (card-html.ts) — mantida por compatibilidade de interface.
 */
export function versoHtml(q: Questao, fonte?: string): string {
  return buildBackHtml(q, fonte);
}

/** Envia as questões para o Anki, criando o deck se necessário. */
export async function pushToAnki(questoes: Questao[], opts: PushOptions): Promise<PushResult> {
  const url = opts.url || ANKICONNECT_URL;
  const padrao = opts.tagsPadrao ?? [];
  const fonteBase = opts.fonte ? opts.fonte.replace(/\.[^./]+$/, '') : undefined;

  // criar um deck para cada q.deck distinto (fallback a opts.deck) — Assumption A1
  // WR-03: per-deck error isolation — one bad name must not abort the whole push.
  const subDecks = new Set(questoes.map((q) => q.deck ?? opts.deck));
  const failedDecks = new Set<string>();
  for (const d of subDecks) {
    try {
      await invoke('createDeck', { deck: d }, url);
    } catch (err) {
      console.warn(`[ankiconnect] createDeck "${d}" falhou — notas usarão "${opts.deck}":`, err instanceof Error ? err.message : String(err));
      failedDecks.add(d);
    }
  }

  const notes = questoes.map((q) => ({
    deckName: (!failedDecks.has(q.deck ?? '') ? q.deck : undefined) ?? opts.deck,
    modelName: 'Basic',
    fields: {
      Front: buildFrontHtml(q),
      Back: buildBackHtml(q, fonteBase),
    },
    tags: tagsDaQuestao(q, padrao),
    options: { allowDuplicate: opts.allowDuplicate ?? false },
  }));

  // addNotes retorna [id | null]; null = nota não adicionada (duplicata/erro)
  const ids = await invoke<(number | null)[]>('addNotes', { notes }, url);
  const enviadas = ids.filter((id) => id !== null).length;

  return {
    deck: opts.deck,
    enviadas,
    ignoradas: ids.length - enviadas,
    total: ids.length,
    ids,
  };
}

// Re-export for backward compat with any consumers that imported escapeHtml from ankiconnect
export { escapeHtml };
