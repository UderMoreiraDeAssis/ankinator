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

interface NoteInfo {
  noteId: number;
  fields: Record<string, { value: string; order: number }>;
  tags?: string[];
}

/**
 * Lê as PERGUNTAS (primeiro campo de cada nota, normalmente "Front") de um deck
 * aberto no Anki — base da geração incremental (deck existente). Inclui subdecks
 * (`deck:"X"` casa X e filhos). Retorna o HTML cru do 1º campo; a limpeza/normalização
 * fica a cargo do chamador (existing-deck.ts) para não acoplar dedup ao exportador.
 */
export async function notesInfoDoDeck(deck: string, url = ANKICONNECT_URL): Promise<string[]> {
  const query = `deck:"${deck.replace(/"/g, '\\"')}"`;
  const ids = await invoke<number[]>('findNotes', { query }, url);
  if (!ids.length) return [];
  const notas = await invoke<NoteInfo[]>('notesInfo', { notes: ids }, url);
  return notas
    .map((n) => {
      const campos = Object.values(n.fields ?? {});
      if (!campos.length) return '';
      // 1º campo = ordem 0 (a "frente"); fallback ao primeiro disponível.
      const front = campos.find((f) => f.order === 0) ?? campos[0];
      return front?.value ?? '';
    })
    .filter(Boolean);
}

// ── Reorganizador de decks (Parte B) — leitura rica + escrita ──────────────────
// Operações usadas pelo deck-organizer.ts. Todas via o `invoke` compartilhado.

/** Nota lida de um deck para reorganização: id + front (1º campo, HTML cru) + tags. */
export interface DeckNote {
  noteId: number;
  front: string;
  tags: string[];
}

const deckQuery = (deck: string): string => `deck:"${deck.replace(/"/g, '\\"')}"`;

/**
 * Lê as notas (id + front + tags) de um deck (inclui subdecks via `deck:"X"`).
 * Base do reorganizador (dedup + tags). A limpeza do HTML do front fica com o
 * chamador (deck-organizer) — não acopla normalização ao exportador.
 */
export async function notesDoDeck(deck: string, url = ANKICONNECT_URL): Promise<DeckNote[]> {
  const ids = await invoke<number[]>('findNotes', { query: deckQuery(deck) }, url);
  if (!ids.length) return [];
  const notas = await invoke<NoteInfo[]>('notesInfo', { notes: ids }, url);
  return notas.map((n) => {
    const campos = Object.values(n.fields ?? {});
    const front = (campos.find((f) => f.order === 0) ?? campos[0])?.value ?? '';
    return { noteId: n.noteId, front, tags: n.tags ?? [] };
  });
}

/** Ids dos CARDS de um deck (INCLUI subdecks) — usado no check de "deck vazio". */
export async function cardIdsDoDeck(deck: string, url = ANKICONNECT_URL): Promise<number[]> {
  return invoke<number[]>('findCards', { query: deckQuery(deck) }, url);
}

/**
 * Ids dos cards DIRETOS de um deck (EXCLUI subdecks) — query `deck:"X" -deck:"X::*"`.
 * Usado no MERGE para mover SÓ os cards do próprio deck, preservando a sub-hierarquia
 * (evita achatar/apagar subdecks silenciosamente — achado da revisão de segurança).
 */
export async function cardIdsDiretosDoDeck(deck: string, url = ANKICONNECT_URL): Promise<number[]> {
  const esc = deck.replace(/"/g, '\\"');
  return invoke<number[]>('findCards', { query: `deck:"${esc}" -deck:"${esc}::*"` }, url);
}

/** Move cards para um deck-alvo. Cria o alvo antes (changeDeck exige deck existente). */
export async function moverCards(cards: number[], deck: string, url = ANKICONNECT_URL): Promise<void> {
  if (!cards.length) return;
  await invoke('createDeck', { deck }, url);
  await invoke('changeDeck', { cards, deck }, url);
}

/**
 * Apaga decks. SEGURANÇA: o chamador só deve passar decks JÁ VAZIOS (cards movidos).
 * `cardsToo=true` é exigido pelo AnkiConnect ≥ moderno; como os decks estão vazios,
 * nada é perdido. NUNCA chame com um deck que ainda tem cards a preservar.
 */
export async function apagarDecks(decks: string[], url = ANKICONNECT_URL, cardsToo = true): Promise<void> {
  if (!decks.length) return;
  await invoke('deleteDecks', { decks, cardsToo }, url);
}

/** Adiciona tags a um conjunto de notas (a API espera as tags separadas por espaço). */
export async function adicionarTags(notes: number[], tags: string[], url = ANKICONNECT_URL): Promise<void> {
  if (!notes.length || !tags.length) return;
  await invoke('addTags', { notes, tags: tags.join(' ') }, url);
}

export interface PushOptions {
  deck: string;
  fonte?: string;
  tagsPadrao?: string[];
  /** Evita duplicatas (AnkiConnect ignora notas duplicadas na mesma deck). */
  allowDuplicate?: boolean;
  /**
   * Aninhar os subdecks sob o deck escolhido: o 1º nível (Matéria) de `q.deck` é trocado
   * pelo `deck` do envio → `Banco de Dados::Assunto::Subtópico`. Integra os cards novos sob
   * o seu deck de assunto PRESERVANDO os subníveis (escolha do usuário). Sem isso, usa `q.deck`
   * como está (raiz = Matéria do classificador).
   */
  nestUnderDeck?: boolean;
  url?: string;
}

/**
 * Re-enraíza um deck hierárquico sob `base`, trocando o 1º nível (Matéria) pelo base:
 * `Tecnologia da Informação::Infraestrutura::Balanceamento` + base `Banco de Dados`
 * → `Banco de Dados::Infraestrutura::Balanceamento`. Deck de 1 nível (só Matéria) → `base`. Puro.
 */
export function reRootDeck(deck: string, base: string): string {
  const partes = deck.split('::').map((s) => s.trim()).filter(Boolean);
  const semMateria = partes.slice(1);
  return semMateria.length ? `${base}::${semMateria.join('::')}` : base;
}

export interface PushResult {
  deck: string;
  enviadas: number;
  ignoradas: number;
  total: number;
  ids: (number | null)[];
}

/**
 * Achata um rótulo de tag namespaceada para o último segmento (escolha do usuário: tags PLANAS,
 * sem `::`). `banca::fgv`→`fgv`, `ano::2023`→`2023`, `tema::dados-abertos`→`dados-abertos`,
 * `origem::criada`→`criada`. Lowercase + sem espaços para dedup robusto no Set.
 */
function achatarTag(t: string): string {
  const ultimo = t.includes('::') ? t.slice(t.lastIndexOf('::') + 2) : t;
  return ultimo.trim().toLowerCase().replace(/\s+/g, '-');
}

export function tagsDaQuestao(q: Questao, padrao: string[]): string[] {
  // Tags PLANAS: achata os namespaces do classificador e deduplica com as planas derivadas de
  // metadata — elimina o lixo `fgv`+`banca::fgv` / `2023`+`ano::2023` / `extraida`+`origem::extraida`.
  // `origem` é um fato do PIPELINE (q.tipo), não classificação: descarta `origem::*` (achatado a
  // `criada`/`extraida`) vindo do classificador — o orquestrado às vezes emite `origem::criada` num card
  // `extraida`, gerando tag de origem DUPLA e contraditória (validação ao vivo q-live2). Só q.tipo manda.
  const ORIGEM = new Set(['criada', 'extraida']);
  const doClassificador = (q.tags ?? []).map(achatarTag).filter((t) => !ORIGEM.has(t));
  const tags = new Set<string>([`ankinator`, q.tipo, ...padrao.map(achatarTag), ...doClassificador]);
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

  // Aninhar sob o deck do envio (escolha do usuário): re-enraíza q.deck → deck::Assunto::Subtópico
  // ANTES de montar as notas, p/ que o cabeçalho do card (card-html usa q.deck) e o deckName do Anki
  // fiquem CONSISTENTES. Sem nestUnderDeck, usa q.deck como está (raiz = Matéria do classificador).
  const qs = opts.nestUnderDeck
    ? questoes.map((q) => (q.deck ? { ...q, deck: reRootDeck(q.deck, opts.deck) } : q))
    : questoes;

  // criar um deck para cada q.deck distinto (fallback a opts.deck) — Assumption A1
  // WR-03: per-deck error isolation — one bad name must not abort the whole push.
  const subDecks = new Set(qs.map((q) => q.deck ?? opts.deck));
  const failedDecks = new Set<string>();
  for (const d of subDecks) {
    try {
      await invoke('createDeck', { deck: d }, url);
    } catch (err) {
      console.warn(`[ankiconnect] createDeck "${d}" falhou — notas usarão "${opts.deck}":`, err instanceof Error ? err.message : String(err));
      failedDecks.add(d);
    }
  }

  const notes = qs.map((q) => ({
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
