/**
 * Módulo de enriquecimento de flashcards via especialistas LLM.
 *
 * Expõe `enrichAll()` (PIPE-01), os parsers tolerantes `parseClassificacoesJson` e
 * `parseSingleCard`, o gate `deveRodarEnrich` (PIPE-03) e os tipos `EnrichOpts` /
 * `EnrichProgress`.
 *
 * Decisões de design:
 * - D-05: classificador usa 1 chamada global para todos os cards.
 * - D-06: merge por id via Map — nunca posicional (anti-Pitfall 3).
 * - D-09: split 1→N apenas para tipo 'criada'; 'extraida' nunca divide.
 * - D-10: card-builder em 'extraida' só ajusta q.resposta.
 * - D-12: card-builder com granularidade por-card (1 spawn/card).
 * - D-13: isolamento de erro por-card/estágio; falha mantém card original.
 * - T-03-02: payload do classificador serializado via JSON.stringify (sem interpolação cru).
 */
import crypto from 'node:crypto';
import type { Questao } from '../types.js';
import { runClaudeCli } from './runner.js';
import { loadPrompt } from './prompt-loader.js';

// ── Tipos exportados ──────────────────────────────────────────────────────────

export interface EnrichOpts {
  classificar?: boolean;
  cardBuilder?: boolean;
}

export interface EnrichProgress {
  estagio: 'classificando' | 'reescrevendo';
  index: number;
  total: number;
  erro?: string;
}

// ── Tipos internos ────────────────────────────────────────────────────────────

interface RawClassificacao {
  id?: string;
  deck?: string;
  tags?: string[];
}

interface RawCard {
  pergunta?: string;
  resposta?: string;
}

// ── Helper de parse tolerante ─────────────────────────────────────────────────

/**
 * Extrai um array de uma chave específica de um texto JSON livre.
 * Tolera cercas ```json, recorta do primeiro { ao último }, retorna [] em falha.
 * Padrão idêntico a parseQuestoesJson (generation.ts).
 */
function parseJsonBlock<T>(text: string, key: string): T[] {
  if (!text) return [];
  // remove cercas ```json ... ```
  const unfenced = text.replace(/```(?:json)?/gi, '').trim();
  // recorta do primeiro { ao último }
  const start = unfenced.indexOf('{');
  const end = unfenced.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return [];
  try {
    const obj = JSON.parse(unfenced.slice(start, end + 1)) as Record<string, unknown>;
    return Array.isArray(obj[key]) ? (obj[key] as T[]) : [];
  } catch {
    return [];
  }
}

// ── Parsers exportados ────────────────────────────────────────────────────────

/**
 * Extrai classificações do JSON do classificador de deck.
 * Formato esperado: {"classificacoes":[{"id":"...","deck":"...","tags":["..."]}]}
 * Retorna [] para qualquer falha (tolerante a cercas json e JSON inválido).
 */
export function parseClassificacoesJson(text: string): RawClassificacao[] {
  return parseJsonBlock<RawClassificacao>(text, 'classificacoes');
}

/**
 * Extrai cards do JSON do card-builder.
 * Formato esperado: {"cards":[{"pergunta":"...","resposta":"..."}]}
 * Retorna [] para qualquer falha.
 */
export function parseSingleCard(text: string): RawCard[] {
  return parseJsonBlock<RawCard>(text, 'cards');
}

// ── Gate PIPE-03 ──────────────────────────────────────────────────────────────

/**
 * Gate puro: retorna true somente se algum toggle de enriquecimento está ligado.
 * Se false, `enrichAll` NÃO deve ser chamado (PIPE-03 — não-regressão do fluxo padrão).
 */
export function deveRodarEnrich(opts: EnrichOpts): boolean {
  return !!(opts.classificar || opts.cardBuilder);
}

// ── Helpers internos de userMessage ──────────────────────────────────────────

/** Monta o payload serializado (D-05/T-03-02) para o classificador. */
function buildClassificadorMessage(questoes: Questao[]): string {
  // Serializar via JSON.stringify — nunca interpolar q.resposta/q.pergunta cru (T-03-02)
  const cards = questoes.map((q) => ({
    id: q.id,
    pergunta: q.pergunta,
    resposta: q.resposta,
    tipo: q.tipo,
  }));
  return [
    'Classifique os cards a seguir. Retorne APENAS JSON no formato:',
    '{"classificacoes":[{"id":"<id>","deck":"<Matéria::Assunto::Subtópico>","tags":["tag1","tag2"]}]}',
    '',
    'Cards:',
    JSON.stringify(cards, null, 2),
  ].join('\n');
}

/** Monta o payload por-card para o card-builder (D-12).
 * Serializa via JSON.stringify — nunca interpolar q.pergunta/q.resposta cru (T-03-02). */
function buildCardBuilderMessage(q: Questao): string {
  const payload = JSON.stringify(
    {
      tipo: q.tipo === 'extraida' ? '[EXTRAÍDA]' : '[CRIADA]',
      pergunta: q.pergunta,
      resposta: q.resposta,
      ...(q.pageStart
        ? {
            fonte:
              q.pageEnd !== undefined && q.pageEnd !== q.pageStart
                ? `p.${q.pageStart}-${q.pageEnd}`
                : `p.${q.pageStart}`,
          }
        : {}),
    },
    null,
    2
  );
  return `Reescreva o card a seguir.\nCard:\n${payload}`;
}

// ── enrichAll ─────────────────────────────────────────────────────────────────

/**
 * Roda os estágios de enriquecimento nos cards, em sequência:
 * 1. Classificador (se opts.classificar): 1 chamada global → preenche deck/tags por id.
 * 2. Card-builder (se opts.cardBuilder): 1 chamada por-card → ajusta verso ou divide.
 *
 * Isolamento de erro por-estágio/card (D-13): falha mantém o card original e registra
 * o erro no progresso. Nunca re-throw; nunca perde um card.
 */
export async function enrichAll(
  questoes: Questao[],
  opts: EnrichOpts,
  onProgress?: (e: EnrichProgress) => void
): Promise<Questao[]> {
  let resultado = [...questoes];

  // ── ESTÁGIO 1: Classificador (D-05/D-06) ─────────────────────────────────
  if (opts.classificar) {
    onProgress?.({ estagio: 'classificando', index: 0, total: 1 });
    try {
      const userMessage = buildClassificadorMessage(resultado);
      const text = await runClaudeCli({
        systemPrompt: loadPrompt('deck-classifier'),
        userMessage,
        // model omitido → default 'sonnet' (D-04)
      });
      const classificacoes = parseClassificacoesJson(text);

      // Merge por id (D-06 / anti-Pitfall 3 — NUNCA posicional)
      const byId = new Map(classificacoes.map((c) => [c.id, c]));
      resultado = resultado.map((q) => {
        const c = byId.get(q.id);
        if (c) {
          return {
            ...q,
            ...(c.deck !== undefined ? { deck: c.deck } : {}),
            ...(c.tags !== undefined ? { tags: c.tags } : {}),
          };
        }
        return q;
      });
    } catch (err) {
      const erro = err instanceof Error ? err.message : String(err);
      onProgress?.({ estagio: 'classificando', index: 0, total: 1, erro });
      // Segue com resultado sem classificação — nunca derruba o job
    }
  }

  // ── ESTÁGIO 2: Card-builder (D-09/D-10/D-12/D-13) ───────────────────────
  if (opts.cardBuilder) {
    const snapshot = [...resultado];
    const total = snapshot.length;
    const novoResultado: Questao[] = [];

    for (let i = 0; i < snapshot.length; i++) {
      const q = snapshot[i];
      onProgress?.({ estagio: 'reescrevendo', index: i, total });
      try {
        const userMessage = buildCardBuilderMessage(q);
        const text = await runClaudeCli({
          systemPrompt: loadPrompt('card-builder'),
          userMessage,
          // model omitido → default 'sonnet' (D-04)
        });
        const parsed = parseSingleCard(text);

        if (q.tipo === 'extraida') {
          // D-10: extraida — só ajusta o verso; pergunta/gabarito intactos; nunca divide
          novoResultado.push({
            ...q,
            resposta: parsed[0]?.resposta ?? q.resposta,
          });
        } else {
          // D-09: criada — pode dividir 1→N; cada derivado herda pageStart/pageEnd/tipo/deck/tags
          if (parsed.length > 0) {
            for (const d of parsed) {
              novoResultado.push({
                ...q,
                id: crypto.randomUUID(),
                pergunta: d.pergunta ?? q.pergunta,
                resposta: d.resposta ?? q.resposta,
              });
            }
          } else {
            // sem cards retornados: mantém original
            novoResultado.push(q);
          }
        }
      } catch (err) {
        const erro = err instanceof Error ? err.message : String(err);
        onProgress?.({ estagio: 'reescrevendo', index: i, total, erro });
        // D-13: mantém o card original em falha — nunca perde um card
        novoResultado.push(q);
      }
    }

    resultado = novoResultado;
  }

  return resultado;
}
