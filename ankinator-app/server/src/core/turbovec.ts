// TODO(dedup-semântico: fase futura) — scaffold provado por smoke; NÃO plugado no pipeline
// (dedup Jaccard atual permanece intocado). Integrar dedup-por-embedding exige fonte de
// embeddings + wiring + consentimento para operação destrutiva no Anki → fase futura no ROADMAP.

/**
 * Wrapper TypeScript para o sidecar turbovec (RyanCodrai/turbovec).
 *
 * Scaffold MÍNIMO PROVADO — não é um andaime morto porque é exercitado pelo smoke.
 * NÃO importa nem referencia os módulos de dedup Jaccard (deck organizer / existing deck) — dedup INTOCADO (R1/R3).
 *
 * CAVEAT cross-mode: o sidecar `.py` NÃO é copiado pelo tsc.
 * Path resolvido via `import.meta.url` (ESM NodeNext):
 *   - dev:  src/core/turbovec.ts  → ../../../../tools/turbovec_index.py
 *   - dist: dist/core/turbovec.js → ../../../../tools/turbovec_index.py
 * Ambos sobem 4 níveis até a raiz do repo onde fica `tools/`.
 *
 * isTurbovecAvailable() é FAIL-CLOSED:
 *   - false se ANKINATOR_TURBOVEC_PYTHON não definido
 *   - false se `import turbovec` falha (wheel ausente / plataforma sem suporte)
 *   - nunca lança, nunca derruba o app
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Interpretador Python para o sidecar turbovec.
 * Venv DEDICADO: ANKINATOR_TURBOVEC_PYTHON (separado do venv markitdown/langchain/OCR).
 * Retorna null quando não definido → isTurbovecAvailable() false.
 */
function pythonBin(): string | null {
  return process.env.ANKINATOR_TURBOVEC_PYTHON?.trim() || null;
}

/**
 * Roda um subprocesso e captura stdout/stderr integralmente.
 *
 * CR-01 (Phase 02): Buffer[] + Buffer.concat().toString('utf8') UMA vez.
 * WR-05: spawnError distingue ENOENT de "sidecar rodou e falhou".
 */
function run(
  cmd: string,
  args: string[]
): Promise<{ code: number; stdout: string; stderr: string; spawnError?: string }> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    const out: Buffer[] = [];
    const err: Buffer[] = [];
    child.stdout.on('data', (d: Buffer) => out.push(d));
    child.stderr.on('data', (d: Buffer) => err.push(d));
    child.on('error', (e: Error) =>
      resolve({
        code: -1,
        stdout: Buffer.concat(out).toString('utf8'),
        stderr: Buffer.concat(err).toString('utf8'),
        spawnError: e.message,
      })
    );
    child.on('close', (code) =>
      resolve({
        code: code ?? -1,
        stdout: Buffer.concat(out).toString('utf8'),
        stderr: Buffer.concat(err).toString('utf8'),
      })
    );
  });
}

/**
 * Path absoluto para o sidecar Python turbovec.
 * Resolvido cross-mode via import.meta.url (4 níveis → raiz do repo).
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const SIDECAR_SCRIPT = path.resolve(here, '../../../../tools/turbovec_index.py');

/**
 * Verifica se o pacote Python turbovec está importável (fail-closed).
 *
 * Retorna false em QUALQUER caso de ausência:
 *   1. ANKINATOR_TURBOVEC_PYTHON não definido
 *   2. `import turbovec` falha (wheel ausente, plataforma sem suporte, etc.)
 * NUNCA lança — não derruba o app.
 */
export async function isTurbovecAvailable(): Promise<boolean> {
  const py = pythonBin();
  if (!py) return false;
  try {
    const { code } = await run(py, ['-c', 'import turbovec']);
    return code === 0;
  } catch {
    return false;
  }
}

/**
 * Resultado tipado do subcomando smoke do sidecar turbovec.
 * Contrato: {"ok": true, "k": number, "top_indices": number[]}
 */
export interface TurbovecSmokeResult {
  ok: true;
  k: number;
  top_indices: number[];
}

/**
 * Parseia e valida o JSON de saída do subcomando smoke.
 *
 * Helper puro extraído para testabilidade CLI-free (sem spawn Python).
 * Detecta drift de API turbovec (projeto v0.x — RESEARCH E2).
 *
 * @param stdout  String stdout do sidecar smoke
 * @param stderr  String stderr (para mensagens de erro contextuais)
 * @returns TurbovecSmokeResult validado
 * @throws Error com mensagem contextual se stdout inválido ou contrato violado
 */
export function parseSmokeOutput(stdout: string, stderr: string): TurbovecSmokeResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    throw new Error(
      `turbovec smoke: stdout não é JSON válido (len=${stdout.length}). stderr: ${stderr.slice(-400)}`
    );
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error(
      `turbovec smoke: esperado objeto JSON, recebido ${parsed === null ? 'null' : Array.isArray(parsed) ? 'array' : typeof parsed}.`
    );
  }

  const obj = parsed as Record<string, unknown>;
  if (obj.ok !== true) {
    throw new Error(
      `turbovec smoke: esperado {ok: true}, recebido ok=${JSON.stringify(obj.ok)}. ` +
        `stderr: ${stderr.slice(-400)}`
    );
  }

  return parsed as TurbovecSmokeResult;
}

/**
 * Executa o subcomando smoke do sidecar turbovec.
 *
 * Prova-de-vida do índice + vetores fake determinísticos + busca.
 * Retorna TurbovecSmokeResult se ok; lança Error em caso de falha.
 *
 * @throws Error se ANKINATOR_TURBOVEC_PYTHON não definido, spawn falha, code != 0,
 *         ou stdout não corresponde ao contrato {ok:true, k, top_indices}.
 */
export async function runTurbovecSmoke(): Promise<TurbovecSmokeResult> {
  const py = pythonBin();
  if (!py) throw new Error('ANKINATOR_TURBOVEC_PYTHON não definido.');

  const { code, stdout, stderr, spawnError } = await run(py, [SIDECAR_SCRIPT, 'smoke']);

  if (spawnError) {
    throw new Error(`turbovec smoke: não foi possível spawnar Python (${py}): ${spawnError}`);
  }

  if (code !== 0) {
    const head = stderr
      .split('\n')
      .filter((l) => l.trim().length > 0)
      .slice(0, 5)
      .map((l) => l.slice(0, 400))
      .join(' | ');
    throw new Error(`Falha no turbovec smoke: ${head || `(stderr vazio, code=${code})`}`);
  }

  return parseSmokeOutput(stdout, stderr);
}
