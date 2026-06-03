/**
 * DocumentLoader — integração com o OpenDataLoader (@opendataloader/pdf).
 *
 * Substitui a antiga extração via pdf-parse (texto plano) + simulatePages
 * (divisão por média de caracteres). Produz:
 *   - markdown em ordem de leitura correta (XY-Cut++), pronto para o LLM;
 *   - árvore de seções (títulos + faixa de páginas) para navegação e chunking.
 *
 * Requer Java 11+ no PATH (o pacote npm é um wrapper sobre um CLI Java).
 * OCR de PDFs escaneados é opcional, via backend híbrido Python (ver ocr-loader).
 */
import { convert, type ConvertOptions } from '@opendataloader/pdf';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { LoadedDocument } from './types.js';
import { parseOdlOutput } from './odl-parse.js';
import { runOcrLoader, isOcrAvailable } from './ocr-loader.js';

export interface LoadOptions {
  /** Tentar OCR (backend Python híbrido) — para PDFs escaneados/imagem. */
  ocr?: boolean;
  /** Subconjunto de páginas, ex.: "1,3,5-7". */
  pages?: string;
  /** Senha de PDFs protegidos. */
  password?: string;
}

/**
 * Carrega e estrutura um PDF.
 * @param pdfPath caminho absoluto do PDF
 */
export async function loadDocument(pdfPath: string, opts: LoadOptions = {}): Promise<LoadedDocument> {
  if (opts.ocr) {
    if (!(await isOcrAvailable())) {
      throw new Error(
        'OCR solicitado, mas o backend híbrido Python do OpenDataLoader não está disponível. ' +
          'Instale-o (pip install "opendataloader-pdf[hybrid]") e defina ODL_PYTHON, ou desative o OCR.'
      );
    }
    return runOcrLoader(pdfPath, opts);
  }

  const outDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ankinator-odl-'));
  try {
    // Config recomendada para apostilas de concurso (text-heavy + tabelas/provas).
    // Cabeçalho/rodapé e marca-d'água já são filtrados por padrão (includeHeaderFooter=false,
    // contentSafetyOff não setado). Não re-introduzimos esse ruído.
    const options: ConvertOptions = {
      outputDir: outDir,
      format: ['json', 'markdown'],
      tableMethod: 'cluster', // melhor extração de tabelas com bordas parciais/ausentes
      readingOrder: 'xycut', // reconstrução de ordem de leitura (layouts multi-coluna)
      imageOutput: 'off', // cards de texto; não extrai imagens
      quiet: true,
      ...(opts.pages ? { pages: opts.pages } : {}),
      ...(opts.password ? { password: opts.password } : {}),
    };
    await convert([pdfPath], options);
    return await parseOdlOutput(outDir, pdfPath);
  } finally {
    fs.rm(outDir, { recursive: true, force: true }).catch(() => {});
  }
}
