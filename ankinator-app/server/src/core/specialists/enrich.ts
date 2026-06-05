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
import { avaliarQualidadeSvg } from './svg-quality.js';
import { log, timer } from '../../logger.js';

// ── Tipos exportados ──────────────────────────────────────────────────────────

export interface EnrichOpts {
  classificar?: boolean;
  cardBuilder?: boolean;
  mnemonico?: boolean;  // Phase 4: estágio 3 — batch único de mnemônicos (D-01)
  imagem?: boolean;     // Phase 4: estágio 4 — imagem SVG por-card, gated por q.mnemonico (D-04)
  /**
   * Concorrência do estágio de imagem (pool). O estágio 4 é o gargalo do pipeline
   * (~25s/card via CLI); rodar em sequência tornava-o ~80% do tempo total. Default
   * DEFAULT_IMAGE_CONCURRENCY; ajustável via ANKINATOR_IMAGE_CONCURRENCY (config → api).
   */
  imageConcurrency?: number;
  /**
   * Concorrência do estágio card-builder (pool). 1 chamada `claude`/card → era
   * sequencial e lento. Default DEFAULT_CARDBUILDER_CONCURRENCY; ajustável via
   * ANKINATOR_CARDBUILDER_CONCURRENCY (config → api).
   */
  cardBuilderConcurrency?: number;
  /**
   * Gestor de qualidade do SVG (estágio 4): avalia cada SVG (render-free) e barra lixo
   * visual (texto sobreposto, fonte estourando, nuvem de palavras). Default true (LIGADO).
   * false → comportamento legado (só sanitização de segurança). Via ANKINATOR_IMAGE_QUALITY.
   */
  imageQuality?: boolean;
  /**
   * Máx. de re-tentativas guiadas quando o SVG reprova no controle de qualidade.
   * Default DEFAULT_IMAGE_MAX_RETRY; 0 = sem retry (reprova → descarta). Via ANKINATOR_IMAGE_MAX_RETRY.
   */
  imageMaxRetry?: number;
  /**
   * Imagem SELETIVA (custo): quando true, o estágio 4 NÃO gera SVG para cards cujo
   * mnemônico usa uma técnica puramente VERBAL (ver `imageSkipTecnicas`) — a imagem
   * só reforça mnemônicos visuais (loci/acrônimo) ou de técnica desconhecida (lado
   * seguro: na dúvida, mantém). Default false = comportamento legado (SVG para TODO card
   * com mnemônico, gate D-04). Via ANKINATOR_IMAGE_SELECTIVE. A imagem é 42% do custo
   * do job (validação ao vivo 2026-06-05) e o mnemônico foi liberalizado p/ a maioria.
   */
  imageSelective?: boolean;
  /**
   * Técnicas de mnemônico VERBAIS que, sob `imageSelective`, NÃO recebem SVG.
   * Comparação acento-insensível e em minúsculas. Default DEFAULT_IMAGE_SKIP_TECNICAS
   * (história, rima). Via ANKINATOR_IMAGE_SKIP_TECNICAS (csv).
   */
  imageSkipTecnicas?: string[];
  /**
   * Teto de cards derivados no split 1→N do card-builder ('criada'). Quando > 0, um card
   * 'criada' nunca vira mais que N cards (o excedente é descartado). Default 0 = ilimitado
   * (byte-idêntico ao legado). Via ANKINATOR_CARDBUILDER_MAX_SPLIT. A explosão do split
   * (run ao vivo: 41→58 cards) cascateia custo nos estágios seguintes (mnemônico/imagem).
   */
  cardBuilderMaxSplit?: number;
}

/**
 * Concorrência padrão do pool do estágio de imagem (estágio 4).
 * Mantida baixa (3) para não saturar a quota da assinatura com chamadas `claude`
 * simultâneas; ajustável por env via ANKINATOR_IMAGE_CONCURRENCY (ver config.ts).
 */
const DEFAULT_IMAGE_CONCURRENCY = 3;

/**
 * Concorrência padrão do pool do estágio card-builder (estágio 2). Mesma cautela de
 * quota do estágio imagem; ajustável por env via ANKINATOR_CARDBUILDER_CONCURRENCY.
 */
const DEFAULT_CARDBUILDER_CONCURRENCY = 3;

/**
 * Re-tentativas guiadas padrão do estágio imagem quando o SVG reprova no controle de
 * qualidade. 1 = uma segunda chamada (com feedback) antes de descartar. Ajustável via
 * ANKINATOR_IMAGE_MAX_RETRY (config → api).
 */
const DEFAULT_IMAGE_MAX_RETRY = 1;

/**
 * Técnicas de mnemônico puramente VERBAIS — sob `imageSelective`, não recebem SVG
 * (uma figura geométrica reforça pouco uma rima/história). Loci e acrônimo NÃO entram
 * aqui (têm estrutura visual/espacial). Configurável via ANKINATOR_IMAGE_SKIP_TECNICAS.
 */
const DEFAULT_IMAGE_SKIP_TECNICAS = ['história', 'rima'];

/**
 * Normaliza um rótulo de técnica para comparação robusta: minúsculas + sem acentos.
 * 'História' / 'historia' / 'HISTÓRIA' → 'historia'. Puro.
 */
function normalizarTecnica(t: string): string {
  return t
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();
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
      log.error(logLabel, 'parse: nenhum bloco JSON encontrado', { trecho: text.slice(0, 200) });
    }
    return [];
  }
  try {
    const obj = JSON.parse(unfenced.slice(start, end + 1)) as Record<string, unknown>;
    return Array.isArray(obj[key]) ? (obj[key] as T[]) : [];
  } catch (err) {
    if (logLabel) {
      log.error(logLabel, `parse: JSON inválido — ${err instanceof Error ? err.message : String(err)}`, {
        trecho: text.slice(0, 200),
      });
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
    'Gere um mnemônico para a MAIORIA dos cards (siglas, listas, classificações, distinções, termos-chave, exceções). Só omita os raros cards sem nada concreto a fixar — na dúvida, gere.',
    '',
    'Cards:',
    JSON.stringify(cards, null, 2),
  ].join('\n');
}

// ── Pool de concorrência limitada ─────────────────────────────────────────────

/**
 * Executa `task` sobre `items` com no máximo `concurrency` execuções simultâneas.
 * Workers puxam o próximo índice livre até esgotar a lista. A `task` é responsável
 * por tratar seu próprio erro (D-13) — um erro propagado abortaria o pool, então o
 * chamador deve envolver o corpo em try/catch quando quiser isolamento por-item.
 */
async function runPool<T>(
  items: readonly T[],
  concurrency: number,
  task: (item: T, index: number) => Promise<void>
): Promise<void> {
  let next = 0;
  const workers = Math.min(Math.max(1, concurrency), items.length);
  const worker = async (): Promise<void> => {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      await task(items[i], i);
    }
  };
  await Promise.all(Array.from({ length: workers }, worker));
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
    log.info('enrich', `estágio classificar START (${resultado.length} cards)`, { cards: resultado.length });
    const fimClass = timer('enrich', 'estágio classificar');
    onProgress?.({ estagio: 'classificando', index: 0, total: 1 });
    try {
      const userMessage = buildClassificadorMessage(resultado);
      const text = await runClaudeCli({
        systemPrompt: loadPrompt('deck-classifier'),
        userMessage,
        // model omitido → default 'sonnet' (D-04)
        disableThinking: true, // saída estruturada (JSON) — sem thinking (evita latência/timeout, bug RT)
        stage: 'classificar', // atribuição de custo de tokens (usage.ts)
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
      const classificados = resultado.filter((q) => q.deck).length;
      log.info('enrich', `estágio classificar END: classificados ${classificados}/${resultado.length} cards`, {
        classificados,
        total: resultado.length,
      });
      fimClass({ classificados, total: resultado.length });
    } catch (err) {
      const erro = err instanceof Error ? err.message : String(err);
      log.error('enrich', `estágio classificar FALHOU: ${erro}`, { erro });
      fimClass({ erro: true });
      onProgress?.({ estagio: 'classificando', index: 0, total: 1, erro });
      // Segue com resultado sem classificação — nunca derruba o job
    }
  }

  // ── ESTÁGIO 2: Card-builder EM PARALELO (D-09/D-10/D-12/D-13) ───────────
  // 1 chamada `claude`/card → era sequencial e lento. Pool de concorrência limitada
  // (igual ao estágio imagem), preservando a ORDEM via saída indexada — o split 1→N
  // de 'criada' mantém a posição do card original. Cada worker escreve num índice
  // exclusivo (sem corrida). O systemPrompt FUNDE o card-builder com o cientista da
  // aprendizagem (princípios baseados em evidência) — SEM chamada LLM extra.
  if (opts.cardBuilder) {
    const snapshot = [...resultado];
    const total = snapshot.length;
    const saidaPorIndice: Questao[][] = new Array(total);
    const concurrency = Math.max(1, opts.cardBuilderConcurrency ?? DEFAULT_CARDBUILDER_CONCURRENCY);
    // Teto do split 1→N (custo): 0 = ilimitado (legado byte-idêntico). > 0 trava a explosão.
    const maxSplit = Math.max(0, opts.cardBuilderMaxSplit ?? 0);
    let truncados = 0; // nº de cards 'criada' cujo split foi cortado pelo teto
    const systemPrompt = `${loadPrompt('card-builder')}\n\n${loadPrompt('learning-scientist')}`;
    log.info('enrich', `estágio cardBuilder START (${total} cards, pool=${concurrency}, +cientista-aprendizagem${maxSplit > 0 ? `, teto split=${maxSplit}` : ''})`, {
      cards: total,
      concorrencia: concurrency,
      maxSplit,
    });
    const fimCard = timer('enrich', 'estágio cardBuilder');
    let cardErros = 0;
    let concluidos = 0;

    await runPool(
      snapshot.map((q, i) => ({ q, i })),
      concurrency,
      async ({ q, i }) => {
        try {
          const userMessage = buildCardBuilderMessage(q);
          const text = await runClaudeCli({
            systemPrompt,
            userMessage,
            // model omitido → default 'sonnet' (D-04)
            disableThinking: true, // saída estruturada (JSON) — sem thinking (evita latência/timeout, bug RT)
            stage: 'cardBuilder', // atribuição de custo de tokens (usage.ts)
          });
          const parsed = parseSingleCard(text);

          if (q.tipo === 'extraida') {
            // D-10: extraida — só ajusta o verso; pergunta/gabarito intactos; nunca divide
            saidaPorIndice[i] = [{ ...q, resposta: parsed[0]?.resposta ?? q.resposta }];
          } else if (parsed.length > 0) {
            // D-09: criada — pode dividir 1→N; cada derivado herda pageStart/pageEnd/tipo/deck/tags
            // Teto opt-in (custo): corta o excedente do split p/ não cascatear nos estágios seguintes.
            const derivados = maxSplit > 0 ? parsed.slice(0, maxSplit) : parsed;
            if (maxSplit > 0 && parsed.length > maxSplit) truncados++;
            saidaPorIndice[i] = derivados.map((d) => ({
              ...q,
              id: crypto.randomUUID(),
              pergunta: d.pergunta ?? q.pergunta,
              resposta: d.resposta ?? q.resposta,
            }));
          } else {
            // sem cards retornados: mantém original
            saidaPorIndice[i] = [q];
          }
          onProgress?.({ estagio: 'reescrevendo', index: concluidos++, total });
        } catch (err) {
          const erro = err instanceof Error ? err.message : String(err);
          cardErros++;
          log.error('enrich', `cardBuilder card ${q.id} FALHOU: ${erro}`, { erro });
          // D-13: mantém o card original em falha — nunca perde um card
          saidaPorIndice[i] = [q];
          onProgress?.({ estagio: 'reescrevendo', index: concluidos++, total, erro });
        }
      }
    );

    // Reconstrói na ORDEM original (cada índice produziu 1..N cards via split)
    resultado = saidaPorIndice.flat();
    log.info('enrich', `estágio cardBuilder END: ${total} entrada(s) → ${resultado.length} card(s), ${cardErros} falha(s)${truncados > 0 ? `, ${truncados} split(s) truncado(s) pelo teto ${maxSplit}` : ''}`, {
      entradas: total,
      saida: resultado.length,
      falhas: cardErros,
      truncados,
      concorrencia: concurrency,
    });
    fimCard({ entradas: total, saida: resultado.length, falhas: cardErros });
  }

  // ── ESTÁGIO 3: Mnemônico batch (D-01/D-02/D-03/T-04-09) ─────────────────
  // Uma única chamada LLM para todos os cards; merge por id com fallback posicional (RT-01).
  if (opts.mnemonico) {
    log.info('enrich', `estágio mnemônico START (batch único, ${resultado.length} cards)`, { cards: resultado.length });
    const fimMnem = timer('enrich', 'estágio mnemônico');
    onProgress?.({ estagio: 'gerando-mnemonico', index: 0, total: 1 });
    try {
      const userMessage = buildMnemonicoMessage(resultado);
      const text = await runClaudeCli({
        systemPrompt: loadPrompt('mnemonic'),
        userMessage,
        // model omitido → default 'sonnet' (D-04)
        disableThinking: true, // saída estruturada (JSON) — sem thinking (evita latência/timeout, bug RT)
        stage: 'mnemonico', // atribuição de custo de tokens (usage.ts)
      });
      const parsed = parseMnemonicosJson(text);

      // Merge por id via Map (D-02/D-03 / anti-Pitfall 3 — primário)
      // Filtrar entradas sem id ou sem mnemonico antes de montar o Map (D-03)
      const comId = parsed.filter((m) => m.id && m.mnemonico);
      const byId = new Map(comId.map((m) => [m.id!, m]));
      const mergedPorId = resultado.map((q) => {
        const m = byId.get(q.id);
        return m
          ? { ...q, mnemonico: m.mnemonico, ...(m.tecnica ? { mnemonicoTecnica: m.tecnica } : {}) }
          : q;
      });

      // RT-01: fallback posicional — quando nenhum id casou mas a contagem bate.
      // O LLM pode retornar mnemônicos sem o campo `id` (ou com ids diferentes).
      // Se ZERO cards receberam mnemônico via id mas há entradas válidas por mnemonico,
      // e a quantidade de entradas com mnemonico == número de cards no lote,
      // aplicamos positional matching e logamos o aviso.
      const mergedCount = mergedPorId.filter((q) => q.mnemonico).length;
      const entradas = parsed.filter((m) => m.mnemonico);
      if (mergedCount === 0 && entradas.length > 0 && entradas.length === resultado.length) {
        log.warn('enrich',
          `mnemônico: nenhum id casou — usando fallback posicional ` +
          `(${entradas.length} entradas para ${resultado.length} cards). ` +
          `Verifique se o modelo está retornando o campo 'id' corretamente.`,
          { entradas: entradas.length, cards: resultado.length }
        );
        resultado = resultado.map((q, i) => {
          const m = entradas[i];
          return m?.mnemonico
            ? { ...q, mnemonico: m.mnemonico, ...(m.tecnica ? { mnemonicoTecnica: m.tecnica } : {}) }
            : q;
        });
      } else {
        if (mergedCount === 0 && entradas.length > 0) {
          // IDs não casaram e contagem diverge — loga quantos foram descartados
          log.warn('enrich',
            `mnemônico: ${entradas.length} mnemônico(s) descartado(s) — ` +
            `nenhum id casou e contagem diverge (${entradas.length} retornados vs ${resultado.length} cards). ` +
            `Verifique se o modelo está retornando ids corretos.`,
            { descartados: entradas.length, cards: resultado.length }
          );
        }
        resultado = mergedPorId;
      }
      const comMnem = resultado.filter((q) => q.mnemonico).length;
      log.info('enrich', `estágio mnemônico END: mnemônicos ${comMnem}/${resultado.length} cards`, {
        mnemonicos: comMnem,
        total: resultado.length,
      });
      fimMnem({ mnemonicos: comMnem, total: resultado.length });
    } catch (err) {
      const erro = err instanceof Error ? err.message : String(err);
      log.error('enrich', `estágio mnemônico FALHOU: ${erro}`, { erro });
      fimMnem({ erro: true });
      onProgress?.({ estagio: 'gerando-mnemonico', index: 0, total: 1, erro: `Estágio mnemônico falhou: ${erro}` });
      // Segue sem mnemônicos — nunca derruba o job (D-08)
    }
  }

  // ── ESTÁGIO 4: Imagem SVG por-card, EM PARALELO (D-04/D-05/D-08/T-04-06) ──
  // A geração de SVG domina o tempo do pipeline (~25s/card via CLI): em sequência,
  // 17 cards ≈ 7 min — o gargalo (~80% do tempo total). Aqui um pool de concorrência
  // limitada processa vários cards ao mesmo tempo, mantendo: gate q.mnemonico (D-04),
  // isolamento de erro por-card (D-13) e fail-closed na sanitização (D-08/T-04-06).
  // Concorrência limitada (DEFAULT_IMAGE_CONCURRENCY) para não saturar a quota da
  // assinatura com chamadas `claude` simultâneas — ajustável via ANKINATOR_IMAGE_CONCURRENCY.
  if (opts.imagem) {
    // Pré-filtra os alvos (D-04) preservando o índice original em `resultado`, para
    // que cada worker escreva num índice exclusivo (sem corrida na escrita do array).
    const comMnemonico = resultado
      .map((q, index) => ({ q, index }))
      .filter(({ q }) => !!q.mnemonico);

    // Imagem SELETIVA (custo, opt-in): pula cards cujo mnemônico é puramente VERBAL.
    // Default OFF → alvos = todos com mnemônico (byte-idêntico ao legado). Técnica
    // ausente/desconhecida → MANTÉM imagem (lado seguro).
    const skipTecnicas = new Set(
      (opts.imageSkipTecnicas ?? DEFAULT_IMAGE_SKIP_TECNICAS).map(normalizarTecnica)
    );
    const alvos = opts.imageSelective
      ? comMnemonico.filter(({ q }) => {
          const tec = q.mnemonicoTecnica ? normalizarTecnica(q.mnemonicoTecnica) : '';
          return !skipTecnicas.has(tec); // técnica vazia/desconhecida não está no set → mantém
        })
      : comMnemonico;
    const puladosSeletividade = comMnemonico.length - alvos.length;
    const total = alvos.length;
    const imageProvider = createImageProvider();
    const concurrency = Math.max(1, opts.imageConcurrency ?? DEFAULT_IMAGE_CONCURRENCY);
    // Gestor de qualidade (default LIGADO): barra lixo visual após a sanitização.
    const qualityOn = opts.imageQuality !== false;
    const maxRetry = Math.max(0, opts.imageMaxRetry ?? DEFAULT_IMAGE_MAX_RETRY);
    // Contador de concluídas: com execução paralela, o índice posicional do card não
    // serve de progresso. Conta quantas imagens já terminaram → 1..total monotônico.
    let concluidas = 0;
    let falhas = 0;
    let reprovadas = 0; // descartadas pelo controle de qualidade após esgotar as tentativas

    // Estágio mais lento do pipeline (~25s/card via CLI). Logamos a concorrência usada
    // para que o usuário avalie subir/baixar ANKINATOR_IMAGE_CONCURRENCY.
    log.info(
      'enrich',
      `estágio imagem START: ${total} card(s)${opts.imageSelective ? ` (seletivo: ${puladosSeletividade} pulado(s) por técnica verbal de ${comMnemonico.length} com mnemônico)` : ' com mnemônico'}, concorrência ${concurrency}, ` +
        `qualidade ${qualityOn ? `ON (retry ${maxRetry})` : 'OFF'}`,
      { alvos: total, comMnemonico: comMnemonico.length, puladosSeletividade, seletivo: !!opts.imageSelective, concorrencia: concurrency, qualidade: qualityOn, maxRetry }
    );
    const fimImg = timer('enrich', 'estágio imagem');

    await runPool(alvos, concurrency, async ({ q, index }) => {
      try {
        // Loop de tentativas: gerar → sanitizar (segurança) → avaliar qualidade (visual).
        // Reprovou → re-gera UMA vez (até maxRetry) com os motivos no prompt. fail-closed:
        // esgotou sem SVG válido → descarta a imagem (card mantém o mnemônico em texto).
        let svgFinal: string | null = null;
        let feedback: string[] | undefined;
        let ultimoMotivo = 'SVG inválido após sanitização';

        for (let tentativa = 0; tentativa <= maxRetry; tentativa++) {
          const { svg } = await imageProvider.generate(q.mnemonico!, q.resposta, feedback);
          const limpo = sanitizarSvg(svg);
          if (!limpo) {
            // Segurança (D-08): SVG inválido/perigoso. Re-tenta (se restar) instruindo validade.
            ultimoMotivo = 'SVG inválido após sanitização';
            feedback = [
              'O SVG anterior era inválido (vazio ou com markup proibido). Devolva APENAS ' +
                '<svg>...</svg> com formas geométricas seguras, começando em <svg e terminando em </svg>.',
            ];
            continue;
          }
          if (!qualityOn) {
            // Legado: só sanitização de segurança (ANKINATOR_IMAGE_QUALITY=off).
            svgFinal = limpo;
            break;
          }
          const verdict = avaliarQualidadeSvg(limpo);
          if (verdict.ok) {
            svgFinal = limpo;
            break;
          }
          // Reprovou no controle de qualidade — guarda os motivos como feedback do retry.
          ultimoMotivo = verdict.motivos.join(' | ');
          feedback = verdict.motivos;
          log.warn(
            'enrich',
            `imagem card ${q.id}: reprovada no controle de qualidade (tentativa ${tentativa + 1}/${maxRetry + 1})`,
            { card: q.id, motivos: verdict.motivos, metrics: verdict.metrics }
          );
        }

        if (svgFinal) {
          // D-05/T-04-06: grava mnemonicoSvg SOMENTE quando há SVG válido E aprovado.
          // Índice exclusivo por alvo → escrita no array é livre de corrida.
          resultado[index] = { ...q, mnemonicoSvg: svgFinal };
          onProgress?.({ estagio: 'gerando-imagem', index: concluidas++, total });
        } else {
          // Fail-closed (D-08): descarta a imagem após esgotar as tentativas. O card mantém
          // q.mnemonico (texto) mas sem q.mnemonicoSvg — melhor SEM imagem que com lixo ilegível.
          reprovadas++;
          falhas++;
          log.error('enrich', `imagem card ${q.id}: descartada — ${ultimoMotivo}`, { card: q.id, motivo: ultimoMotivo });
          onProgress?.({ estagio: 'gerando-imagem', index: concluidas++, total, erro: `Imagem descartada: ${ultimoMotivo}` });
        }
      } catch (err) {
        // D-13: isolamento por-card — erro na geração não aborta o pool
        const erro = err instanceof Error ? err.message : String(err);
        falhas++;
        log.error('enrich', `imagem card ${q.id}: estágio imagem falhou: ${erro}`, { card: q.id, erro });
        onProgress?.({ estagio: 'gerando-imagem', index: concluidas++, total, erro: `Estágio imagem falhou: ${erro}` });
        // card mantém q.mnemonico mas sem q.mnemonicoSvg — nunca perde o card
      }
    });

    const ok = total - falhas;
    log.info(
      'enrich',
      `estágio imagem END: imagens ${ok}/${total}, ${falhas} falha(s) (${reprovadas} reprovada(s) na qualidade)`,
      { geradas: ok, total, falhas, reprovadas, concorrencia: concurrency }
    );
    fimImg({ geradas: ok, total, falhas, reprovadas });
  }

  return resultado;
}
