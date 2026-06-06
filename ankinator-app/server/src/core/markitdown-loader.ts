/**
 * Loader de PDF via sidecar Python markitdown (microsoft/markitdown).
 *
 * Caminho opt-in: ativo apenas quando ANKINATOR_PDF_LOADER=markitdown.
 * O wiring em document-loader.ts adiciona o branch markitdown em chooseLoader/loadDocument.
 *
 * Sem Java: este loader NÃO exige Java (ao contrário do loader langchain que usa
 * langchain-opendataloader-pdf / OpenDataLoader Java). Venv dedicado separado.
 *
 * Limitação documentada: markitdown produz um ÚNICO blob Markdown (sem split por página).
 * normalize() é reusada com 1 Document (page=1); numPages=1 é o comportamento esperado.
 *
 * CAVEAT cross-mode (espelha Phase 1 A1): o sidecar `.py` NÃO é copiado pelo tsc.
 * O path é resolvido via `import.meta.url` (ESM NodeNext) para funcionar
 * tanto em `tsx src/` (dev) quanto em `node dist/` (prod):
 *   - dev:  src/core/markitdown-loader.ts → ../../../../tools/markitdown_loader.py
 *   - dist: dist/core/markitdown-loader.js → ../../../../tools/markitdown_loader.py
 * Ambos sobem 4 níveis a partir do arquivo até a raiz do repo.
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { LoadedDocument } from './types.js';
import type { LoadOptions } from './document-loader.js';
import { normalize, type RawDoc } from './langchain-normalize.js';

/**
 * Interpretador Python para o sidecar markitdown.
 * Venv DEDICADO: ANKINATOR_MARKITDOWN_PYTHON (SEM fallback p/ ODL_PYTHON — o venv
 * do markitdown não exige Java e é separado do venv langchain/OCR).
 * Retorna null quando a var não está definida → isMarkitdownAvailable() false.
 */
function pythonBin(): string | null {
  return process.env.ANKINATOR_MARKITDOWN_PYTHON?.trim() || null;
}

/**
 * Roda um subprocesso e captura stdout/stderr integralmente.
 *
 * CR-01 (Phase 02): NÃO concatena `d.toString()` por chunk. O stdout É o payload
 * do documento. Streams Node fatiam em fronteiras de BYTE; caracteres UTF-8
 * multi-byte (á, ã, ç, é — PT-BR) partidos entre chunks viram mojibake.
 * Bufferizamos em Buffer[] e decodificamos UMA vez com Buffer.concat().toString('utf8').
 *
 * WR-05 (Phase 02): o evento 'error' (falha de SPAWN — ENOENT quando o path do
 * Python está errado) carrega `spawnError`. Distingue "interpretador não encontrado"
 * de "sidecar rodou e falhou".
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
 * Verifica se o pacote Python markitdown está importável.
 *
 * Sem checar Java — markitdown não usa Java.
 * Retorna false APENAS quando:
 *   1. pythonBin() é null (ANKINATOR_MARKITDOWN_PYTHON não definido), ou
 *   2. o import do pacote falha (código de saída != 0).
 */
export async function isMarkitdownAvailable(): Promise<boolean> {
  const py = pythonBin();
  if (!py) return false;
  const { code } = await run(py, ['-c', 'import markitdown']);
  return code === 0;
}

/**
 * Path absoluto para o sidecar Python, resolvido cross-mode via import.meta.url.
 *
 * A árvore de diretórios (raiz do repo):
 *   tools/markitdown_loader.py               ← sidecar
 *   ankinator-app/server/src/core/            ← este arquivo em dev (tsx)
 *   ankinator-app/server/dist/core/           ← este arquivo em prod (node dist)
 *
 * Em ambos os modos, `here` aponta para a pasta do arquivo .js/.ts compilado.
 * Subindo 4 níveis chegamos à raiz do repo onde fica `tools/`.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const SIDECAR_SCRIPT = path.resolve(here, '../../../../tools/markitdown_loader.py');

/**
 * Parseia e valida o stdout JSON do sidecar markitdown.
 *
 * Helper puro extraído para testabilidade CLI-free (sem spawn Python).
 * Espelha as guardas CR-02 de langchain-loader.ts.
 *
 * @param stdout  String stdout do sidecar
 * @param stderr  String stderr (para mensagens de erro contextuais)
 * @param opts    LoadOptions (para redação de senha em erros — WR-04)
 * @returns Array de RawDoc validado
 * @throws Error com mensagem contextual em caso de stdout inválido
 */
export function parseSidecarOutput(stdout: string, stderr: string, opts: LoadOptions): RawDoc[] {
  const redact = (s: string): string =>
    opts.password ? s.split(opts.password).join('***') : s;

  // D-01: stdout = JSON [{page_content, metadata}] impresso pelo sidecar.
  // T-k3b-03: JSON.parse em try/catch com mensagem contextual.
  let parsed: unknown;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    throw new Error(
      `Loader markitdown: stdout não é JSON válido (len=${stdout.length}). ` +
        `stderr: ${redact(stderr.slice(-400))}`
    );
  }

  // CR-02: valida antes de entregar a normalize().
  // T-k3b-03: guardas explícitas (é array? cada item tem page_content: string?).
  if (!Array.isArray(parsed)) {
    throw new Error(
      `Loader markitdown: esperado array de Documents, recebido ${parsed === null ? 'null' : typeof parsed}.`
    );
  }
  for (let i = 0; i < parsed.length; i++) {
    const item = parsed[i] as Record<string, unknown> | null;
    if (typeof item !== 'object' || item === null || typeof item.page_content !== 'string') {
      throw new Error(
        `Loader markitdown: Document[${i}] inválido — esperado { page_content: string, metadata }.`
      );
    }
  }
  return parsed as RawDoc[];
}

/**
 * Executa o sidecar Python markitdown para carregar o PDF e retorna um LoadedDocument.
 *
 * Sem temp dir (D-01): o sidecar imprime JSON no stdout; Node faz JSON.parse.
 * Erro de runtime (code != 0) PROPAGA via throw (D-04) — sem fallback silencioso.
 *
 * Limitação documentada: markitdown produz blob único → 1 Document, numPages=1.
 * normalize() é compatível para 1 doc: buildSectionsFromMarkdown reparseia headings ATX;
 * pageStart/pageEnd=1 em todas as seções.
 *
 * @param pdfPath  Caminho absoluto do PDF a processar.
 * @param opts     Opções: pages/password aceitos mas são no-op neste loader (paridade D-11).
 */
export async function runMarkitdownLoader(pdfPath: string, opts: LoadOptions): Promise<LoadedDocument> {
  const py = pythonBin();
  if (!py) throw new Error('ANKINATOR_MARKITDOWN_PYTHON não definido.');

  // D-11: espelha LoadOptions em argv do sidecar (pages/password aceitos mas no-op)
  // T-k3b-01: argv-array (sem shell) — sem injeção de comando.
  const args = [SIDECAR_SCRIPT, pdfPath];
  if (opts.pages) args.push('--pages', opts.pages);
  if (opts.password) args.push('--password', opts.password);

  const { code, stdout, stderr, spawnError } = await run(py, args);

  // WR-05: distingue "não foi possível spawnar o Python" (ENOENT) de "sidecar rodou e falhou".
  if (spawnError) {
    throw new Error(`Loader markitdown: não foi possível spawnar Python (${py}): ${spawnError}`);
  }

  // WR-04: scrub da senha ANTES de interpolar em Error.
  // T-k3b-02: redação da senha antes de logar (paridade com WR-04 do langchain-loader).
  const redact = (s: string): string =>
    opts.password ? s.split(opts.password).join('***') : s;

  // D-04: runtime error PROPAGA — sem fallback silencioso.
  // WR-03: preferir as PRIMEIRAS linhas do stderr (causa real fica no TOPO).
  if (code !== 0) {
    const head = stderr
      .split('\n')
      .filter((l) => l.trim().length > 0)
      .slice(0, 5)
      .map((l) => l.slice(0, 400))
      .join(' | ');
    throw new Error(`Falha no loader markitdown: ${redact(head) || `(stderr vazio, code=${code})`}`);
  }

  const parsed = parseSidecarOutput(stdout, stderr, opts);
  // Reusar normalize() de langchain-normalize.ts SEM alterá-la.
  // 1 doc (page=1): numPages=1, pageStart/pageEnd=1 em todas as seções (limitação documentada).
  return normalize(parsed, pdfPath);
}
