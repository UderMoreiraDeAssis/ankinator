/**
 * Loader de PDF via sidecar Python langchain-opendataloader-pdf.
 *
 * Caminho opt-in (D-03): ativo apenas quando ANKINATOR_PDF_LOADER=langchain.
 * O wiring no document-loader.ts é feito no Plano 04 (Wave 3).
 *
 * CAVEAT cross-mode (Phase 1 A1): o sidecar `.py` NÃO é copiado pelo tsc.
 * O path é resolvido via `import.meta.url` (ESM NodeNext) para funcionar
 * tanto em `tsx src/` (dev) quanto em `node dist/` (prod):
 *   - dev:  src/core/langchain-loader.ts → ../../../../tools/odl_langchain_loader.py
 *   - dist: dist/core/langchain-loader.js → ../../../../tools/odl_langchain_loader.py
 * Ambos sobem 4 níveis a partir do arquivo até a raiz do repo.
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { LoadedDocument } from './types.js';
import type { LoadOptions } from './document-loader.js';
import { normalize, type RawDoc } from './langchain-normalize.js';

/**
 * Interpretador Python para o sidecar LangChain.
 * D-02: var dedicada ANKINATOR_LANGCHAIN_PYTHON com fallback ODL_PYTHON.
 * Retorna null quando nenhuma var está definida → isLangchainAvailable() false.
 */
function pythonBin(): string | null {
  return process.env.ANKINATOR_LANGCHAIN_PYTHON?.trim() || process.env.ODL_PYTHON?.trim() || null;
}

/**
 * Roda um subprocesso e captura stdout/stderr integralmente.
 *
 * CR-01 (Phase 02): NÃO concatena `d.toString()` por chunk. Aqui o stdout É o
 * payload do documento (não apenas um exit code, como em ocr-loader.ts, que lê o
 * conteúdo do disco). Streams Node fatiam em fronteiras de BYTE, não de caractere;
 * um caractere UTF-8 multi-byte (á, ã, ç, é — onipresentes em material de concurso
 * PT-BR) partido entre dois chunks vira mojibake e corrompe todo flashcard gerado.
 * Bufferizamos os chunks em Buffer[] e decodificamos UMA vez com
 * Buffer.concat(...).toString('utf8'), que respeita as fronteiras de caractere.
 */
function run(cmd: string, args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    const out: Buffer[] = [];
    const err: Buffer[] = [];
    child.stdout.on('data', (d: Buffer) => out.push(d));
    child.stderr.on('data', (d: Buffer) => err.push(d));
    child.on('error', () =>
      resolve({
        code: -1,
        stdout: Buffer.concat(out).toString('utf8'),
        stderr: Buffer.concat(err).toString('utf8'),
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
 * Verifica se o pacote Python do sidecar LangChain está importável.
 *
 * D-04: realiza import-check (`python -c 'import langchain_opendataloader_pdf'`).
 * Java NÃO é checado aqui — a ausência de Java 11+ no PATH só vira erro em runtime
 * (Pitfall 2 da Phase 1 / R2). isLangchainAvailable() retorna false APENAS quando:
 *   1. pythonBin() é null (nenhuma env var definida), ou
 *   2. o import do pacote falha (código de saída != 0).
 */
export async function isLangchainAvailable(): Promise<boolean> {
  const py = pythonBin();
  if (!py) return false;
  const { code } = await run(py, ['-c', 'import langchain_opendataloader_pdf']);
  return code === 0;
}

/**
 * Path absoluto para o sidecar Python, resolvido cross-mode via import.meta.url.
 *
 * A árvore de diretórios (raiz do repo):
 *   tools/odl_langchain_loader.py          ← sidecar
 *   ankinator-app/server/src/core/         ← este arquivo em dev (tsx)
 *   ankinator-app/server/dist/core/        ← este arquivo em prod (node dist)
 *
 * Em ambos os modos, `here` aponta para a pasta do arquivo .js/.ts compilado.
 * Subindo 4 níveis chegamos sempre à raiz do repo onde fica `tools/`.
 * Não há cópia do .py pelo tsc; o path DEVE ser resolvido assim.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const SIDECAR_SCRIPT = path.resolve(here, '../../../../tools/odl_langchain_loader.py');

/**
 * Executa o sidecar Python para carregar o PDF e retorna um LoadedDocument.
 *
 * Sem temp dir (D-01): o sidecar imprime JSON no stdout; Node faz JSON.parse.
 * Erro de runtime (code != 0) PROPAGA via throw (D-04) — sem fallback silencioso.
 * Pitfall 2 (R2): ausência de Java 11+ no PATH causa code != 0 em runtime.
 *
 * @param pdfPath  Caminho absoluto do PDF a processar.
 * @param opts     Opções: pages, password (D-11 — espelha LoadOptions).
 */
export async function runLangchainLoader(pdfPath: string, opts: LoadOptions): Promise<LoadedDocument> {
  const py = pythonBin();
  if (!py) throw new Error('ANKINATOR_LANGCHAIN_PYTHON / ODL_PYTHON não definido.');

  // D-11: espelha LoadOptions (pages, password) em argv do sidecar
  const args = [SIDECAR_SCRIPT, pdfPath];
  if (opts.pages) args.push('--pages', opts.pages);
  if (opts.password) args.push('--password', opts.password);

  const { code, stdout, stderr } = await run(py, args);

  // WR-04 (Phase 02): scrub o valor de `password` de QUALQUER texto antes de
  // interpolá-lo num Error que vai para logs. Se a biblioteca/Java ecoar o argumento
  // num erro, o segredo cairia em Error.message e em qualquer sink de log.
  // CAVEAT (WR-04): a senha ainda é visível em `ps` / /proc/<pid>/cmdline enquanto o
  // sidecar roda, pois é passada via argv. Eliminar isso exigiria passar por env/stdin
  // (mudança de contrato D-11 do sidecar) — fora do escopo desta correção pontual.
  const redact = (s: string): string =>
    opts.password ? s.split(opts.password).join('***') : s;

  // D-04: runtime error PROPAGA — sem fallback para o loader Node.
  // T-02-05: spawn usa argv-array (sem shell) → sem injeção de comando.
  //
  // WR-03 (Phase 02): preferir as PRIMEIRAS linhas do stderr sobre o tail. O sidecar
  // agora emite uma linha de diagnóstico estruturada ("odl_langchain_loader: <Tipo>: <msg>"),
  // e mesmo num traceback Python cru a causa real fica no TOPO. `.slice(-400)` cortava
  // justamente essa parte. Mantemos um teto de tamanho via slice(0, 400) por linha.
  if (code !== 0) {
    const head = stderr
      .split('\n')
      .filter((l) => l.trim().length > 0)
      .slice(0, 5)
      .map((l) => l.slice(0, 400))
      .join(' | ');
    throw new Error(`Falha no loader langchain: ${redact(head) || `(stderr vazio, code=${code})`}`);
  }

  // D-01: stdout = JSON [{page_content, metadata}] impresso pelo sidecar.
  // T-02-06: JSON.parse (não eval).
  //
  // CR-02 (Phase 02): valida antes de entregar a normalize(). Sem estas guardas,
  // um sidecar que sai 0 mas imprime nada/linha não-JSON lançaria um SyntaxError
  // opaco ("Unexpected end of JSON input") sem contexto de loader/PDF; e um JSON
  // que não seja array (ou itens sem `page_content`) explodiria lá dentro com
  // `docs.map is not a function` / `Cannot read properties of undefined`.
  let parsed: unknown;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    throw new Error(
      `Loader langchain: stdout não é JSON válido (len=${stdout.length}). ` +
        // WR-04 (Phase 02): redige a senha do stderr antes de logar.
        `stderr: ${redact(stderr.slice(-400))}`
    );
  }
  if (!Array.isArray(parsed)) {
    throw new Error(
      `Loader langchain: esperado array de Documents, recebido ${parsed === null ? 'null' : typeof parsed}.`
    );
  }
  for (let i = 0; i < parsed.length; i++) {
    const item = parsed[i] as Record<string, unknown> | null;
    if (typeof item !== 'object' || item === null || typeof item.page_content !== 'string') {
      throw new Error(
        `Loader langchain: Document[${i}] inválido — esperado { page_content: string, metadata }.`
      );
    }
  }
  return normalize(parsed as RawDoc[], pdfPath);
}
