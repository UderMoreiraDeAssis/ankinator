/**
 * Caminho de OCR via backend híbrido Python do OpenDataLoader.
 *
 * O pacote npm (modo local/Java) NÃO faz OCR de PDFs escaneados. Para isso o
 * projeto oferece um backend Python: `pip install "opendataloader-pdf[hybrid]"`.
 * Aqui chamamos o CLI Python (`opendataloader-pdf ... --force-ocr`) quando o
 * usuário define a variável de ambiente ODL_PYTHON apontando para o interpretador.
 *
 * É um caminho opcional e degrada graciosamente: se o backend não existir,
 * isOcrAvailable() retorna false e o loader principal avisa o usuário.
 */
import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { LoadedDocument } from './types.js';
import type { LoadOptions } from './document-loader.js';

function pythonBin(): string | null {
  return process.env.ODL_PYTHON?.trim() || null;
}

function run(cmd: string, args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += d.toString()));
    child.stderr.on('data', (d) => (stderr += d.toString()));
    child.on('error', () => resolve({ code: -1, stdout, stderr }));
    child.on('close', (code) => resolve({ code: code ?? -1, stdout, stderr }));
  });
}

/** Verifica se o módulo Python opendataloader_pdf está importável. */
export async function isOcrAvailable(): Promise<boolean> {
  const py = pythonBin();
  if (!py) return false;
  const { code } = await run(py, ['-c', 'import opendataloader_pdf']);
  return code === 0;
}

/**
 * Roda o OpenDataLoader com OCR forçado e reaproveita o parser do loader principal
 * relendo o JSON/markdown gerados.
 */
export async function runOcrLoader(pdfPath: string, opts: LoadOptions): Promise<LoadedDocument> {
  const py = pythonBin();
  if (!py) throw new Error('ODL_PYTHON não definido.');

  const outDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ankinator-ocr-'));
  const args = [
    '-m',
    'opendataloader_pdf',
    pdfPath,
    '-o',
    outDir,
    '-f',
    'json,markdown',
    '--force-ocr',
  ];
  if (opts.pages) args.push('--pages', opts.pages);
  if (opts.password) args.push('--password', opts.password);

  const { code, stderr } = await run(py, args);
  if (code !== 0) {
    await fs.rm(outDir, { recursive: true, force: true }).catch(() => {});
    throw new Error(`Falha no OCR (opendataloader_pdf): ${stderr.slice(-400)}`);
  }

  // Reusa o parser do loader principal lendo os arquivos gerados.
  const { parseOdlOutput } = await import('./odl-parse.js');
  const doc = await parseOdlOutput(outDir, pdfPath);
  await fs.rm(outDir, { recursive: true, force: true }).catch(() => {});
  return { ...doc, usedOcr: true };
}
