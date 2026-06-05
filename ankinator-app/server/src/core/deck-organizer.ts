/**
 * Reorganizador de decks do Anki — Parte B, Fatia 1 (merge + repetidos).
 *
 * Pedido do usuário: selecionar um deck (ou vários) do Anki e REORGANIZÁ-LO direto
 * pelo app/server — unir decks (merge) e achar/marcar repetidos. Esta fatia é
 * 100% DETERMINÍSTICA (sem LLM): a re-hierarquização e a padronização de tags
 * (que usam o classificador) ficam para a Fatia 2.
 *
 * SEGURANÇA (mexe na coleção REAL do usuário) — fluxo de DUAS FASES:
 *   1. `previewOrganize` — SÓ LÊ. Monta o PLANO (o que seria movido/mesclado/marcado).
 *      Nenhuma escrita no Anki.
 *   2. `applyOrganize`   — executa SOMENTE as operações aprovadas, com isolamento de
 *      erro por-operação (uma falha não aborta o resto) e resumo. Dedup é NÃO-destrutivo
 *      por padrão (marca a cópia extra com a tag `duplicata`; nunca apaga).
 *
 * Reuso: a deduplicação (normalização + Jaccard) vem de `existing-deck.ts` (mesma
 * lógica do INCR-1), e as operações de Anki vêm de `exporters/ankiconnect.ts`.
 */
import { DUP_THRESHOLD, normalizeForDedup, jaccard, stripHtml } from './existing-deck.js';
import {
  notesDoDeck,
  cardIdsDoDeck,
  cardIdsDiretosDoDeck,
  moverCards,
  apagarDecks,
  adicionarTags,
  type DeckNote,
} from './exporters/ankiconnect.js';
import { log } from '../logger.js';

// ── Tipos do plano (prévia) e do resultado (aplicar) ───────────────────────────

/** Pedido de prévia: decks selecionados + quais operações considerar. */
export interface OrganizePreviewRequest {
  decks: string[];
  /** Unir os decks selecionados em `target` (move cards + apaga os vazios). */
  merge?: { target: string };
  /** Achar repetidos nas notas dos decks selecionados (inclusive entre decks). */
  dedup?: boolean;
  /** Limiar de Jaccard p/ repetidos (default DUP_THRESHOLD). */
  dedupThreshold?: number;
}

export interface MergePlan {
  target: string;
  /** Decks de origem (≠ target) e quantos cards DIRETOS seriam movidos de cada um. */
  moves: { deck: string; cardCount: number }[];
  /** Origens (≠ target) que ficariam VAZIAS após mover os cards diretos → serão apagadas. */
  decksToDelete: string[];
  /** Origens (≠ target) PRESERVADAS por terem subdecks com cards (não são apagadas). */
  preservedWithSubdecks: string[];
  totalMoved: number;
}

/** Um grupo de notas consideradas a mesma questão. Mantém uma, marca as demais. */
export interface DupGroup {
  keepNoteId: number;
  dupNoteIds: number[];
  /** Amostra do front (texto limpo, truncado) para exibir na prévia. */
  sampleFront: string;
  size: number;
}

export interface DedupPlan {
  groups: DupGroup[];
  totalDuplicates: number;
  /** Tag aplicada às cópias extras (não-destrutivo). */
  tag: string;
}

export interface OrganizePlan {
  decks: string[];
  merge?: MergePlan;
  dedup?: DedupPlan;
}

export interface ApplyResult {
  merge?: { movedCards: number; deletedDecks: string[]; erros: string[] };
  dedup?: { taggedNotes: number; tag: string; erros: string[] };
}

/** Tag default das cópias extras (decisão do usuário: marcar, não apagar). */
export const DUP_TAG = 'duplicata';

// ── Lógica PURA (testável CLI-free) ────────────────────────────────────────────

/**
 * Agrupa notas que são a mesma questão (igualdade normalizada OU Jaccard ≥ limiar).
 * Greedy O(n²): para cada nota ainda não agrupada, varre as seguintes e captura as
 * similares. A PRIMEIRA do grupo é a mantida (`keepNoteId`); as demais são `dupNoteIds`.
 * Notas sem texto comparável (front vazio após normalizar) NÃO entram em grupo algum.
 * Só retorna grupos com ≥ 1 duplicata.
 */
export function groupDuplicates(
  notes: readonly { noteId: number; front: string }[],
  threshold = DUP_THRESHOLD
): DupGroup[] {
  const items = notes.map((n) => {
    const norm = normalizeForDedup(n.front);
    return { noteId: n.noteId, front: n.front, norm, tokens: new Set(norm.split(' ').filter(Boolean)) };
  });
  const usados = new Set<number>(); // índices já agrupados
  const groups: DupGroup[] = [];

  for (let i = 0; i < items.length; i++) {
    if (usados.has(i) || !items[i].norm) continue;
    const dupIdx: number[] = [];
    for (let j = i + 1; j < items.length; j++) {
      if (usados.has(j) || !items[j].norm) continue;
      // Defesa em profundidade: a MESMA nota pode aparecer 2× na lista (decks sobrepostos
      // pai+subdeck, deck repetido, ou nota com cards em decks distintos). Nunca tratar
      // uma nota como duplicata de si mesma (senão marcaríamos uma nota ÚNICA).
      if (items[j].noteId === items[i].noteId) continue;
      const igual =
        items[i].norm === items[j].norm || jaccard(items[i].tokens, items[j].tokens) >= threshold;
      if (igual) {
        dupIdx.push(j);
        usados.add(j);
      }
    }
    if (dupIdx.length > 0) {
      usados.add(i);
      groups.push({
        keepNoteId: items[i].noteId,
        dupNoteIds: dupIdx.map((j) => items[j].noteId),
        sampleFront: stripHtml(items[i].front).slice(0, 120),
        size: dupIdx.length + 1,
      });
    }
  }
  return groups;
}

/**
 * Monta o plano de merge a partir das contagens por deck e do alvo. O `target` (mesmo
 * que esteja entre os selecionados) NUNCA é movido nem apagado.
 *
 * Política de subdeck (option-a — não achatar a hierarquia silenciosamente): move só os
 * cards DIRETOS de cada origem (`directCount`); uma origem só é apagada se ficar VAZIA,
 * isto é, se NÃO tiver cards em subdecks (`hasSubdeckCards === false`). Origens com
 * subdecks são PRESERVADAS (`preservedWithSubdecks`) — a prévia revela isso, em vez de
 * apagar a subárvore por baixo dos panos.
 */
export function planMerge(
  decks: readonly { deck: string; directCount: number; hasSubdeckCards: boolean }[],
  target: string
): MergePlan {
  const moves = decks
    .filter((d) => d.deck !== target && d.directCount > 0)
    .map((d) => ({ deck: d.deck, cardCount: d.directCount }));
  const decksToDelete = decks
    .filter((d) => d.deck !== target && !d.hasSubdeckCards)
    .map((d) => d.deck);
  const preservedWithSubdecks = decks
    .filter((d) => d.deck !== target && d.hasSubdeckCards)
    .map((d) => d.deck);
  const totalMoved = moves.reduce((s, m) => s + m.cardCount, 0);
  return { target, moves, decksToDelete, preservedWithSubdecks, totalMoved };
}

// ── Orquestração (lê/escreve no Anki via AnkiConnect) ──────────────────────────

/**
 * FASE 1 — só leitura. Monta o plano de reorganização sem tocar a coleção.
 */
export async function previewOrganize(
  reqp: OrganizePreviewRequest,
  url?: string
): Promise<OrganizePlan> {
  const plan: OrganizePlan = { decks: reqp.decks };

  if (reqp.merge) {
    const counts: { deck: string; directCount: number; hasSubdeckCards: boolean }[] = [];
    for (const deck of reqp.decks) {
      const direto = (await cardIdsDiretosDoDeck(deck, url)).length;
      const total = (await cardIdsDoDeck(deck, url)).length; // inclui subdecks
      counts.push({ deck, directCount: direto, hasSubdeckCards: total > direto });
    }
    plan.merge = planMerge(counts, reqp.merge.target);
  }

  if (reqp.dedup) {
    const todas: DeckNote[] = [];
    for (const deck of reqp.decks) todas.push(...(await notesDoDeck(deck, url)));
    // Decks selecionados podem se sobrepor (pai+subdeck, deck repetido, ou nota com cards
    // em decks distintos) → a MESMA nota aparece N vezes. Colapsa por noteId ANTES de
    // agrupar, senão a nota seria marcada como duplicata de si mesma (achado da revisão).
    const vistos = new Set<number>();
    const unicas = todas.filter((n) => (vistos.has(n.noteId) ? false : (vistos.add(n.noteId), true)));
    const groups = groupDuplicates(
      unicas.map((n) => ({ noteId: n.noteId, front: n.front })),
      reqp.dedupThreshold ?? DUP_THRESHOLD
    );
    plan.dedup = {
      groups,
      totalDuplicates: groups.reduce((s, g) => s + g.dupNoteIds.length, 0),
      tag: DUP_TAG,
    };
  }

  log.info('organize', 'prévia montada', {
    decks: reqp.decks.length,
    merge: plan.merge ? plan.merge.totalMoved : undefined,
    repetidos: plan.dedup ? plan.dedup.totalDuplicates : undefined,
  });
  return plan;
}

/**
 * FASE 2 — aplica SOMENTE as operações aprovadas (`applyMerge`/`applyDedup`).
 * Isolamento de erro por-operação: uma falha vira item em `erros` e o resto segue.
 * Merge re-lê os card ids no momento de aplicar (evita ids obsoletos da prévia) e só
 * apaga um deck de origem após CONFIRMAR que ficou vazio (rede de segurança).
 */
export async function applyOrganize(
  plan: OrganizePlan,
  opts: { applyMerge?: boolean; applyDedup?: boolean },
  url?: string
): Promise<ApplyResult> {
  const result: ApplyResult = {};
  const msg = (e: unknown): string => (e instanceof Error ? e.message : String(e));

  // Coerência intenção × plano (achado da revisão): pedir para aplicar uma operação cuja
  // seção não existe no plano seria um no-op SILENCIOSO — falha explícita em vez disso.
  if (opts.applyMerge && !plan.merge) {
    throw new Error('applyMerge solicitado, mas o plano não contém a seção "merge". Re-gere a prévia com merge ativo.');
  }
  if (opts.applyDedup && !plan.dedup) {
    throw new Error('applyDedup solicitado, mas o plano não contém a seção "dedup". Re-gere a prévia com dedup ativo.');
  }

  if (opts.applyMerge && plan.merge) {
    const m = plan.merge;
    // Normaliza para nunca passar não-array ao for-of (preserva o isolamento por-operação
    // mesmo com plano malformado de chamador direto — a rota também valida → 400).
    const moves = Array.isArray(m.moves) ? m.moves : [];
    let movedCards = 0;
    const deletedDecks: string[] = [];
    const erros: string[] = [];

    for (const mv of moves) {
      try {
        const cards = await cardIdsDiretosDoDeck(mv.deck, url); // só cards DIRETOS (preserva subdecks)
        if (cards.length) {
          await moverCards(cards, m.target, url);
          movedCards += cards.length;
        }
      } catch (e) {
        erros.push(`mover "${mv.deck}" → "${m.target}": ${msg(e)}`);
      }
    }

    // Re-deriva os decks a apagar das ORIGENS SELECIONADAS (plan.decks), NUNCA do
    // `m.decksToDelete` cru do cliente, e SEMPRE excluindo o target — reaplica no apply o
    // invariante de planMerge (achado: plano adulterado poderia apagar o próprio alvo).
    // Só apaga se o deck ficou de fato vazio (cardIdsDoDeck inclui subdecks → subdeck
    // cheio = não-vazio = preservado).
    const candidatos = (Array.isArray(plan.decks) ? plan.decks : []).filter(
      (d) => typeof d === 'string' && d.trim() && d !== m.target
    );
    for (const d of candidatos) {
      try {
        const restantes = await cardIdsDoDeck(d, url);
        if (restantes.length === 0) {
          await apagarDecks([d], url, true);
          deletedDecks.push(d);
        }
        // deck não-vazio (cards próprios ou em subdecks) → preservado em silêncio (não é erro)
      } catch (e) {
        erros.push(`apagar "${d}": ${msg(e)}`);
      }
    }

    result.merge = { movedCards, deletedDecks, erros };
    log.info('organize', `merge aplicado: ${movedCards} card(s) → "${m.target}", ${deletedDecks.length} deck(s) apagado(s)`, {
      movedCards,
      deleted: deletedDecks.length,
      erros: erros.length,
    });
  }

  if (opts.applyDedup && plan.dedup) {
    const tag = plan.dedup.tag || DUP_TAG;
    const groups = Array.isArray(plan.dedup.groups) ? plan.dedup.groups : [];
    let taggedNotes = 0;
    const erros: string[] = [];
    for (const g of groups) {
      try {
        await adicionarTags(g.dupNoteIds, [tag], url);
        taggedNotes += g.dupNoteIds.length;
      } catch (e) {
        erros.push(`marcar grupo (manter ${g.keepNoteId}): ${msg(e)}`);
      }
    }
    result.dedup = { taggedNotes, tag, erros };
    log.info('organize', `repetidos: ${taggedNotes} nota(s) marcada(s) com "${tag}"`, {
      taggedNotes,
      grupos: groups.length,
      erros: erros.length,
    });
  }

  return result;
}
