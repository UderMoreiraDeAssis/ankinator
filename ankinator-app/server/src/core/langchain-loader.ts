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
import { normalize } from './langchain-normalize.js';

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

  // D-04: runtime error PROPAGA — sem fallback para o loader Node.
  // T-02-05: spawn usa argv-array (sem shell) → sem injeção de comando.
  if (code !== 0) {
    throw new Error(`Falha no loader langchain: ${stderr.slice(-400)}`);
  }

  // D-01: stdout = JSON [{page_content, metadata}] impresso pelo sidecar.
  // T-02-06: JSON.parse (não eval) — stdout malformado → lança SyntaxError (propaga D-04).
  const docs = JSON.parse(stdout);
  return normalize(docs, pdfPath);
}
