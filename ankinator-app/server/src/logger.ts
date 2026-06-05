/**
 * Logger estruturado, zero dependências, para abrir a "caixa-preta" do servidor.
 *
 * Objetivo: tornar o pipeline (extract → chunk → generate → enrich → export)
 * observável, permitindo ao usuário identificar gargalos (especialmente o tempo
 * gasto em cada chamada ao `claude` CLI) e oportunidades de melhoria.
 *
 * Características:
 *  - Níveis 'debug' | 'info' | 'warn' | 'error' (lê ANKINATOR_LOG_LEVEL; default 'debug').
 *  - Formato: "HH:MM:SS.mmm NIVEL [scope] msg  {json compacto de data}".
 *    O timestamp do prefixo vem do RELÓGIO LOCAL (apenas para leitura humana).
 *  - timer(scope,label): mede DURAÇÃO com process.hrtime.bigint() (relógio monotônico,
 *    nunca o relógio de parede) e loga os ms decorridos ao chamar o end() retornado.
 *  - Cores ANSI opcionais, com degrade gracioso quando não há TTY (ou NO_COLOR setado).
 *
 * Este módulo NÃO altera lógica de negócio: é puramente observabilidade aditiva.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

/** Nível mínimo ativo, derivado de ANKINATOR_LOG_LEVEL (default 'debug' p/ dev verboso). */
function resolveLevel(): LogLevel {
  const raw = process.env.ANKINATOR_LOG_LEVEL?.trim().toLowerCase();
  if (raw === 'debug' || raw === 'info' || raw === 'warn' || raw === 'error') return raw;
  return 'debug';
}

const activeLevel = resolveLevel();

/** Cores habilitadas só quando há TTY e NO_COLOR não está definido (degrade gracioso). */
const colorEnabled = !!process.stdout.isTTY && !process.env.NO_COLOR;

const ANSI = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  gray: '\x1b[90m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
} as const;

const LEVEL_COLOR: Record<LogLevel, string> = {
  debug: ANSI.gray,
  info: ANSI.cyan,
  warn: ANSI.yellow,
  error: ANSI.red,
};

function paint(text: string, color: string): string {
  return colorEnabled ? `${color}${text}${ANSI.reset}` : text;
}

/** Timestamp local "HH:MM:SS.mmm" (somente leitura humana; não usado para medir durações). */
function nowPrefix(): string {
  const d = new Date();
  const pad = (n: number, w = 2) => String(n).padStart(w, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;
}

/** Serializa `data` em JSON compacto, tolerando ciclos/erros sem nunca lançar. */
function compactJson(data: unknown): string {
  if (data === undefined) return '';
  try {
    const seen = new WeakSet();
    const json = JSON.stringify(data, (_k, v) => {
      if (v instanceof Error) return { name: v.name, message: v.message };
      if (typeof v === 'bigint') return v.toString();
      if (typeof v === 'object' && v !== null) {
        if (seen.has(v as object)) return '[Circular]';
        seen.add(v as object);
      }
      return v;
    });
    return json ?? '';
  } catch {
    return String(data);
  }
}

function emit(level: LogLevel, scope: string, msg: string, data?: unknown): void {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[activeLevel]) return;

  const ts = paint(nowPrefix(), ANSI.dim);
  const lvl = paint(level.toUpperCase().padEnd(5), LEVEL_COLOR[level]);
  const sc = paint(`[${scope}]`, ANSI.green);
  const json = compactJson(data);
  const tail = json ? `  ${paint(json, ANSI.dim)}` : '';

  const line = `${ts} ${lvl} ${sc} ${msg}${tail}`;

  // warn/error → stderr; demais → stdout (mantém separação útil em pipes).
  if (level === 'warn' || level === 'error') process.stderr.write(line + '\n');
  else process.stdout.write(line + '\n');
}

/** Logger nível-filtrado. `data` é opcional e sai como JSON compacto no fim da linha. */
export const log = {
  debug(scope: string, msg: string, data?: unknown): void {
    emit('debug', scope, msg, data);
  },
  info(scope: string, msg: string, data?: unknown): void {
    emit('info', scope, msg, data);
  },
  warn(scope: string, msg: string, data?: unknown): void {
    emit('warn', scope, msg, data);
  },
  error(scope: string, msg: string, data?: unknown): void {
    emit('error', scope, msg, data);
  },
};

/**
 * Cria um cronômetro. Retorna `end()` que, ao ser chamado, loga (nível debug) o tempo
 * decorrido em ms desde a criação. A duração é medida com process.hrtime.bigint()
 * (relógio monotônico), imune a ajustes do relógio de parede / NTP.
 *
 * `end(extra?)` aceita um objeto opcional, mesclado ao `data` logado (ex.: contagens),
 * e RETORNA os ms decorridos (number) caso o chamador queira usá-los em outra mensagem.
 *
 * @example
 *   const fim = timer('extract', 'extração total');
 *   ...trabalho...
 *   fim({ secoes: 12 });  // → "... DEBUG [extract] extração total +842ms  {"secoes":12}"
 */
export function timer(scope: string, label: string): (extra?: Record<string, unknown>) => number {
  const start = process.hrtime.bigint();
  return (extra?: Record<string, unknown>): number => {
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    const rounded = Math.round(ms);
    emit('debug', scope, `${label} +${rounded}ms`, extra && Object.keys(extra).length ? extra : undefined);
    return rounded;
  };
}
