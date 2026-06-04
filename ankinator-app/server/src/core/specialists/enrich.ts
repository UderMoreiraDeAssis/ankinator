/**
 * Módulo de enriquecimento de flashcards via especialistas LLM.
 *
 * Expõe `enrichAll()` (PIPE-01), os parsers tolerantes `parseClassificacoesJson`,
 * `parseSingleCard` e `parseMnemonicosJson`, o gate `deveRodarEnrich` (PIPE-03) e
 * os tipos `EnrichOpts` / `EnrichProgress`.
 *
 * Decisões de design:
 * - D-01: mnemônico usa 1 chamada batch para todos os cards.
 * - D-02/D-03: merge por id via Map — nunca posicional (anti-Pitfall 3).
 * - D-04: estágio imagem só processa cards com q.mnemonico (gate).
 * - D-05: classificador usa 1 chamada global para todos os cards.
 * - D-06: merge por id via Map — nunca posicional (anti-Pitfall 3).
 * - D-08: fail-closed na sanitização SVG — grava mnemonicoSvg apenas quando não-null.
 * - D-09: split 1→N apenas para tipo 'criada'; 'extraida' nunca divide.
 * - D-10: card-builder em 'extraida' só ajusta q.resposta.
 * - D-12: card-builder com granularidade por-card (1 spawn/card).
 * - D-13: isolamento de erro por-card/estágio; falha mantém card original.
 * - T-03-02: payload do classificador serializado via JSON.stringify (sem interpolação cru).
 * - T-04-09: payload do mnemônico serializado via JSON.stringify (anti-injection).
 */
import crypto from 'node:crypto';
import type { Questao } from '../types.js';
import { runClaudeCli } from './runner.js';
import { loadPrompt } from './prompt-loader.js';
import { createImageProvider } from './image-provider.js';
import { sanitizarSvg } from './sanitize-svg.js';

// ── Tipos exportados ──────────────────────────────────────────────────────────

export interface EnrichOpts {
  classificar?: boolean;
  cardBuilder?: boolean;
  mnemonico?: boolean;  // Phase 4: estágio 3 — batch único de mnemônicos (D-01)
  imagem?: boolean;     // Phase 4: estágio 4 — imagem SVG por-card, gated por q.mnemonico (D-04)
}

export interface EnrichProgress {
  estagio: 'classificando' | 'reescrevendo' | 'gerando-mnemonico' | 'gerando-imagem';
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

/** Estrutura de cada item retornado pelo especialista de mnemônicos (D-01). */
interface RawMnemonico {
  id?: string;
  mnemonico?: string;
  tecnica?: string;
}

// ── Helper de parse tolerante ─────────────────────────────────────────────────

/**
 * Extrai um array de uma chave específica de um texto JSON livre.
 * Tolera cercas ```json, recorta do primeiro { ao último }, retorna [] em falha.
 * Padrão idêntico a parseQuestoesJson (generation.ts).
 *
 * @param logLabel  Quando definido, loga um trecho do texto original em caso de falha de parse.
 */
function parseJsonBlock<T>(text: string, key: string, logLabel?: string): T[] {
  if (!text) return [];
  // remove cercas ```json ... ```
  const unfenced = text.replace(/```(?:json)?/gi, '').trim();
  // recorta do primeiro { ao último }
  const start = unfenced.indexOf('{');
  const end = unfenced.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    if (logLabel) {
      console.error(`[ankinator/${logLabel}] parse: nenhum bloco JSON encontrado. Trecho: ${text.slice(0, 200)}`);
    }
    return [];
  }
  try {
    const obj = JSON.parse(unfenced.slice(start, end + 1)) as Record<string, unknown>;
    return Array.isArray(obj[key]) ? (obj[key] as T[]) : [];
  } catch (err) {
    if (logLabel) {
      console.error(
        `[ankinator/${logLabel}] parse: JSON inválido — ${err instanceof Error ? err.message : String(err)}. ` +
        `Trecho: ${text.slice(0, 200)}`
      );
    }
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

/**
 * Extrai mnemônicos do JSON batch do especialista de mnemônicos (D-01).
 * Formato esperado: {"mnemonicos":[{"id":"...","mnemonico":"...","tecnica":"..."}]}
 * Tolera cercas ```json e retorna [] para JSON inválido ou sem chave `mnemonicos`.
 * Em falha de parse, loga um trecho do output cru para diagnóstico (RT-01).
 */
export function parseMnemonicosJson(text: string): RawMnemonico[] {
  return parseJsonBlock<RawMnemonico>(text, 'mnemonicos', 'parseMnemonicosJson');
}

// ── Gate PIPE-03 ──────────────────────────────────────────────────────────────

/**
 * Gate puro: retorna true somente se algum toggle de enriquecimento está ligado.
 * Se false, `enrichAll` NÃO deve ser chamado (PIPE-03 — não-regressão do fluxo padrão).
 * Phase 4: ampliado para incluir mnemonico/imagem (Pitfall 6 — sem estes, o gate ficaria
 * false quando só mnemônico/imagem fossem selecionados).
 */
export function deveRodarEnrich(opts: EnrichOpts): boolean {
  return !!(opts.classificar || opts.cardBuilder || opts.mnemonico || opts.imagem);
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

/**
 * Monta o payload batch para o especialista de mnemônicos (D-01/T-04-09).
 * Serializa via JSON.stringify — nunca interpolar q.pergunta/q.resposta cru (T-03-02).
 */
function buildMnemonicoMessage(questoes: Questao[]): string {
  // Envia os campos necessários para o LLM decidir qual técnica usar por card (D-01)
  const cards = questoes.map((q) => ({
    id: q.id,
    pergunta: q.pergunta,
    resposta: q.resposta,
    tipo: q.tipo,
  }));
  return [
    'Gere mnemônicos para os cards a seguir. Retorne APENAS JSON no formato:',
    '{"mnemonicos":[{"id":"<id-do-card>","mnemonico":"<texto>","tecnica":"<acrônimo|história|loci|rima>"}]}',
    '',
    'Para cards conceituais/de raciocínio, NÃO inclua o card na lista (omissão = sem mnemônico).',
    '',
    'Cards:',
    JSON.stringify(cards, null, 2),
  ].join('\n');
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

  // ── ESTÁGIO 3: Mnemônico batch (D-01/D-02/D-03/T-04-09) ─────────────────
  // Uma única chamada LLM para todos os cards; merge por id com fallback posicional (RT-01).
  if (opts.mnemonico) {
    onProgress?.({ estagio: 'gerando-mnemonico', index: 0, total: 1 });
    try {
      const userMessage = buildMnemonicoMessage(resultado);
      const text = await runClaudeCli({
        systemPrompt: loadPrompt('mnemonic'),
        userMessage,
        // model omitido → default 'sonnet' (D-04)
      });
      const parsed = parseMnemonicosJson(text);

      // Merge por id via Map (D-02/D-03 / anti-Pitfall 3 — primário)
      // Filtrar entradas sem id ou sem mnemonico antes de montar o Map (D-03)
      const comId = parsed.filter((m) => m.id && m.mnemonico);
      const byId = new Map(comId.map((m) => [m.id!, m]));
      const mergedPorId = resultado.map((q) => {
        const m = byId.get(q.id);
        return m ? { ...q, mnemonico: m.mnemonico } : q;
      });

      // RT-01: fallback posicional — quando nenhum id casou mas a contagem bate.
      // O LLM pode retornar mnemônicos sem o campo `id` (ou com ids diferentes).
      // Se ZERO cards receberam mnemônico via id mas há entradas válidas por mnemonico,
      // e a quantidade de entradas com mnemonico == número de cards no lote,
      // aplicamos positional matching e logamos o aviso.
      const mergedCount = mergedPorId.filter((q) => q.mnemonico).length;
      const entradas = parsed.filter((m) => m.mnemonico);
      if (mergedCount === 0 && entradas.length > 0 && entradas.length === resultado.length) {
        console.error(
          `[ankinator/mnemônico] aviso: nenhum id casou — usando fallback posicional ` +
          `(${entradas.length} entradas para ${resultado.length} cards). ` +
          `Verifique se o modelo está retornando o campo 'id' corretamente.`
        );
        resultado = resultado.map((q, i) => {
          const m = entradas[i];
          return m?.mnemonico ? { ...q, mnemonico: m.mnemonico } : q;
        });
      } else {
        if (mergedCount === 0 && entradas.length > 0) {
          // IDs não casaram e contagem diverge — loga quantos foram descartados
          console.error(
            `[ankinator/mnemônico] aviso: ${entradas.length} mnemônico(s) descartado(s) — ` +
            `nenhum id casou e contagem diverge (${entradas.length} retornados vs ${resultado.length} cards). ` +
            `Verifique se o modelo está retornando ids corretos.`
          );
        }
        resultado = mergedPorId;
      }
    } catch (err) {
      const erro = err instanceof Error ? err.message : String(err);
      console.error(`[ankinator/mnemônico] Estágio mnemônico falhou: ${erro}`);
      onProgress?.({ estagio: 'gerando-mnemonico', index: 0, total: 1, erro: `Estágio mnemônico falhou: ${erro}` });
      // Segue sem mnemônicos — nunca derruba o job (D-08)
    }
  }

  // ── ESTÁGIO 4: Imagem SVG por-card (D-04/D-05/D-08/T-04-06) ────────────
  // Por-card, gated por q.mnemonico (D-04). Fail-closed na sanitização (D-08/T-04-06).
  if (opts.imagem) {
    const total = resultado.filter((q) => q.mnemonico).length;
    const imageProvider = createImageProvider();

    for (let i = 0; i < resultado.length; i++) {
      const q = resultado[i];
      if (!q.mnemonico) continue; // D-04: só cards com mnemônico recebem imagem

      onProgress?.({ estagio: 'gerando-imagem', index: i, total });
      try {
        const { svg } = await imageProvider.generate(q.mnemonico, q.resposta);
        const limpo = sanitizarSvg(svg);

        if (limpo) {
          // D-05/T-04-06: grava mnemonicoSvg SOMENTE quando sanitização retorna não-null
          resultado[i] = { ...q, mnemonicoSvg: limpo };
        } else {
          // Fail-closed: SVG inválido/malicioso → não grava, reporta erro (D-08/T-04-06)
          const erroSvg = 'SVG inválido após sanitização';
          console.error(`[ankinator/imagem] card ${q.id}: ${erroSvg}`);
          onProgress?.({ estagio: 'gerando-imagem', index: i, total, erro: erroSvg });
        }
      } catch (err) {
        // D-13: isolamento por-card — erro na geração não aborta o lote
        const erro = err instanceof Error ? err.message : String(err);
        console.error(`[ankinator/imagem] card ${q.id}: Estágio imagem falhou: ${erro}`);
        onProgress?.({ estagio: 'gerando-imagem', index: i, total, erro: `Estágio imagem falhou: ${erro}` });
        // card mantém q.mnemonico mas sem q.mnemonicoSvg — nunca perde o card
      }
    }
  }

  return resultado;
}
