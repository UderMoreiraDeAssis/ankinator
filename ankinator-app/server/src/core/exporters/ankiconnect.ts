/**
 * Exportador via AnkiConnect.
 *
 * Envia os cards diretamente para o Anki aberto, usando o add-on AnkiConnect
 * (HTTP em http://127.0.0.1:8765 por padrão). Cria o deck se não existir e
 * adiciona notas do tipo "Basic" (Front/Back), com tags.
 *
 * Requer: Anki aberto + add-on AnkiConnect (código 2055492159) instalado.
 */
import type { Questao } from '../types.js';

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

function tagsDaQuestao(q: Questao, padrao: string[]): string[] {
  const tags = new Set<string>([`ankinator`, q.tipo, ...padrao]);
  if (q.metadata?.banca) tags.add(q.metadata.banca.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, ''));
  if (q.metadata?.ano) tags.add(String(q.metadata.ano));
  return [...tags].filter(Boolean);
}

function versoHtml(q: Questao, fonte?: string): string {
  let back = escapeHtml(q.resposta).replace(/\n/g, '<br>');
  const m = q.metadata;
  if (m?.alternativas?.length) {
    back += `<br><br><i>Alternativas:</i><br>${m.alternativas.map(escapeHtml).join('<br>')}`;
  }
  if (m?.gabarito) back += `<br><b>Gabarito:</b> ${escapeHtml(m.gabarito)}`;
  const src = fonte ? `${fonte}` : '';
  const pg = q.pageStart ? (q.pageStart === q.pageEnd ? ` (p.${q.pageStart})` : ` (p.${q.pageStart}-${q.pageEnd})`) : '';
  if (src || pg) back += `<br><br><span style="color:#888;font-size:0.8em">Fonte: ${escapeHtml(src)}${pg}</span>`;
  return back;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Envia as questões para o Anki, criando o deck se necessário. */
export async function pushToAnki(questoes: Questao[], opts: PushOptions): Promise<PushResult> {
  const url = opts.url || ANKICONNECT_URL;
  const padrao = opts.tagsPadrao ?? [];
  const fonteBase = opts.fonte ? opts.fonte.replace(/\.[^./]+$/, '') : undefined;

  await invoke('createDeck', { deck: opts.deck }, url);

  const notes = questoes.map((q) => ({
    deckName: opts.deck,
    modelName: 'Basic',
    fields: {
      Front: escapeHtml(q.pergunta).replace(/\n/g, '<br>'),
      Back: versoHtml(q, fonteBase),
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
