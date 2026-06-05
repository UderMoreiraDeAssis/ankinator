/**
 * Contabilidade de uso de tokens / custo das chamadas ao `claude` CLI.
 *
 * Motivação: o `claude -p --output-format json` JÁ devolve, no MESMO envelope de
 * onde extraímos `result`, os campos `usage` (input/output/cache tokens) e
 * `total_cost_usd` (custo equivalente-API, reportado mesmo na assinatura Pro/Max).
 * Capturá-los é de graça — nenhuma chamada extra — e abre a terceira dimensão que
 * faltava ao perfil do pipeline: além de TEMPO (logger.timer) agora temos CUSTO,
 * atribuído POR ESTÁGIO. Isso permite ao usuário equilibrar custo × tempo × qualidade
 * (ex.: "imagem é 57% do tempo — é também 57% do custo?").
 *
 * Este módulo é puramente aditivo (observabilidade): um acumulador em memória,
 * bucketizado por estágio, alimentado pelo `runner`. O `runClaudeCli` é o ponto
 * único por onde TODA chamada ao CLI passa, então a cobertura é total.
 *
 * Concorrência: Node é single-threaded; cada `recordUsage` é síncrono → sem corrida.
 * O padrão snapshot→diff (snapshotUsage/usageSince) isola o consumo de UM job.
 */

/** Estágio do pipeline que originou a chamada ao CLI (para atribuição de custo). */
export type Stage = 'geracao' | 'classificar' | 'cardBuilder' | 'mnemonico' | 'imagem' | 'outro';

/** Ordem canônica de exibição dos estágios no resumo. */
export const STAGE_ORDER: Stage[] = ['geracao', 'classificar', 'cardBuilder', 'mnemonico', 'imagem', 'outro'];

/** Tokens + custo acumulados (de uma chamada, um estágio, ou o total). */
export interface TokenUsage {
  /** Nº de chamadas ao CLI contabilizadas. */
  calls: number;
  inputTokens: number;
  outputTokens: number;
  /** Tokens gravados em cache (prompt caching) — escrita. */
  cacheCreationTokens: number;
  /** Tokens lidos do cache — leitura (mais baratos). */
  cacheReadTokens: number;
  /** Custo equivalente-API em USD (soma de total_cost_usd). */
  costUsd: number;
  /** Tempo de API reportado pelo CLI (duration_api_ms), somado. */
  apiMs: number;
}

/** Uso de um estágio nomeado. */
export interface StageUsage extends TokenUsage {
  stage: Stage;
}

/** Forma crua do `usage` no envelope do `claude -p --output-format json`. */
export interface RawCliUsage {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

function zero(): TokenUsage {
  return { calls: 0, inputTokens: 0, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0, costUsd: 0, apiMs: 0 };
}

/** Acumulador global, por estágio. */
const totals = new Map<Stage, TokenUsage>();

/** Soma `delta` no bucket do estágio (cria o bucket na primeira vez). */
function addInto(map: Map<Stage, TokenUsage>, stage: Stage, delta: TokenUsage): void {
  const cur = map.get(stage) ?? zero();
  cur.calls += delta.calls;
  cur.inputTokens += delta.inputTokens;
  cur.outputTokens += delta.outputTokens;
  cur.cacheCreationTokens += delta.cacheCreationTokens;
  cur.cacheReadTokens += delta.cacheReadTokens;
  cur.costUsd += delta.costUsd;
  cur.apiMs += delta.apiMs;
  map.set(stage, cur);
}

/**
 * Normaliza o `usage`/custo crus do envelope em um `TokenUsage` de UMA chamada.
 * Tolera campos ausentes (degrada para 0). `calls` é sempre 1 aqui.
 */
export function usageFromEnvelope(raw: RawCliUsage | undefined, costUsd: number | undefined, apiMs: number | undefined): TokenUsage {
  return {
    calls: 1,
    inputTokens: raw?.input_tokens ?? 0,
    outputTokens: raw?.output_tokens ?? 0,
    cacheCreationTokens: raw?.cache_creation_input_tokens ?? 0,
    cacheReadTokens: raw?.cache_read_input_tokens ?? 0,
    costUsd: typeof costUsd === 'number' && Number.isFinite(costUsd) ? costUsd : 0,
    apiMs: typeof apiMs === 'number' && Number.isFinite(apiMs) ? apiMs : 0,
  };
}

/** Registra o uso de uma chamada ao CLI no acumulador global, sob `stage`. */
export function recordUsage(stage: Stage, delta: TokenUsage): void {
  addInto(totals, stage, delta);
}

/** Snapshot opaco do estado atual (cópia profunda) — base para `usageSince`. */
export type UsageSnapshot = Map<Stage, TokenUsage>;

export function snapshotUsage(): UsageSnapshot {
  const copy = new Map<Stage, TokenUsage>();
  for (const [stage, u] of totals) copy.set(stage, { ...u });
  return copy;
}

/** Soma de uma coleção de buckets em um único `TokenUsage`. */
export function sumUsage(usos: Iterable<TokenUsage>): TokenUsage {
  const acc = zero();
  for (const u of usos) {
    acc.calls += u.calls;
    acc.inputTokens += u.inputTokens;
    acc.outputTokens += u.outputTokens;
    acc.cacheCreationTokens += u.cacheCreationTokens;
    acc.cacheReadTokens += u.cacheReadTokens;
    acc.costUsd += u.costUsd;
    acc.apiMs += u.apiMs;
  }
  return acc;
}

/**
 * Consumo ocorrido DESDE `before` (snapshot), por estágio + total.
 * Subtrai o snapshot do estado atual; só inclui estágios com alguma chamada nova.
 */
export function usageSince(before: UsageSnapshot): { porEstagio: StageUsage[]; total: TokenUsage } {
  const porEstagio: StageUsage[] = [];
  for (const stage of STAGE_ORDER) {
    const now = totals.get(stage);
    if (!now) continue;
    const prev = before.get(stage) ?? zero();
    const delta: TokenUsage = {
      calls: now.calls - prev.calls,
      inputTokens: now.inputTokens - prev.inputTokens,
      outputTokens: now.outputTokens - prev.outputTokens,
      cacheCreationTokens: now.cacheCreationTokens - prev.cacheCreationTokens,
      cacheReadTokens: now.cacheReadTokens - prev.cacheReadTokens,
      costUsd: now.costUsd - prev.costUsd,
      apiMs: now.apiMs - prev.apiMs,
    };
    if (delta.calls > 0) porEstagio.push({ stage, ...delta });
  }
  return { porEstagio, total: sumUsage(porEstagio) };
}

/** Formata um custo USD com 4 casas (cobre chamadas baratas), ou '0' exato. */
export function formatCost(usd: number): string {
  if (!usd) return '$0';
  return `$${usd.toFixed(4)}`;
}
