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
 *
 * Branch LangChain (D-03): ativo APENAS quando ANKINATOR_PDF_LOADER=langchain.
 * O default (env unset) NÃO entra no branch — Pitfall 3 / D-15.
 */
import { convert, type ConvertOptions } from '@opendataloader/pdf';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { LoadedDocument } from './types.js';
import { parseOdlOutput } from './odl-parse.js';
import { runOcrLoader, isOcrAvailable } from './ocr-loader.js';
import { runLangchainLoader, isLangchainAvailable } from './langchain-loader.js';

export interface LoadOptions {
  /** Tentar OCR (backend Python híbrido) — para PDFs escaneados/imagem. */
  ocr?: boolean;
  /** Subconjunto de páginas, ex.: "1,3,5-7". */
  pages?: string;
  /** Senha de PDFs protegidos. */
  password?: string;
}

/**
 * Constrói o ConvertOptions PURO para o caminho default (@opendataloader/pdf).
 *
 * Helper extraído para ser assertável CLI-free pelo guard D-15 (guard-default-loader.ts),
 * espelhando como `buildSpawnArgs` foi extraído na Phase 1.
 * Os valores e a ORDEM das chaves são byte-idênticos ao inline original (D-15).
 *
 * @param outDir diretório de saída temporário
 * @param opts   opções do loader (apenas pages/password afetam o resultado)
 */
export function buildConvertOptions(outDir: string, opts: LoadOptions): ConvertOptions {
  // Config recomendada para apostilas de concurso (text-heavy + tabelas/provas).
  // Cabeçalho/rodapé e marca-d'água já são filtrados por padrão (includeHeaderFooter=false,
  // contentSafetyOff não setado). Não re-introduzimos esse ruído.
  return {
    outputDir: outDir,
    format: ['json', 'markdown'],
    tableMethod: 'cluster', // melhor extração de tabelas com bordas parciais/ausentes
    readingOrder: 'xycut', // reconstrução de ordem de leitura (layouts multi-coluna)
    imageOutput: 'off', // cards de texto; não extrai imagens
    quiet: true,
    ...(opts.pages ? { pages: opts.pages } : {}),
    ...(opts.password ? { password: opts.password } : {}),
  };
}

/**
 * Carrega e estrutura um PDF.
 * @param pdfPath caminho absoluto do PDF
 */
export async function loadDocument(pdfPath: string, opts: LoadOptions = {}): Promise<LoadedDocument> {
  // D-06: branch OCR (mais específico) vence — INTOCADO.
  // OCR é sempre tratado primeiro, independente de ANKINATOR_PDF_LOADER.
  if (opts.ocr) {
    if (!(await isOcrAvailable())) {
      throw new Error(
        'OCR solicitado, mas o backend híbrido Python do OpenDataLoader não está disponível. ' +
          'Instale-o (pip install "opendataloader-pdf[hybrid]") e defina ODL_PYTHON, ou desative o OCR.'
      );
    }
    return runOcrLoader(pdfPath, opts);
  }

  // D-03: branch LangChain — PURAMENTE ADITIVO (Pitfall 3 / D-15).
  // Quando ANKINATOR_PDF_LOADER está unset, a condição é false e NADA do langchain roda
  // (nem isLangchainAvailable()). O fluxo default abaixo permanece byte-idêntico.
  if ((process.env.ANKINATOR_PDF_LOADER?.trim().toLowerCase()) === 'langchain') {
    if (await isLangchainAvailable()) {
      // D-05: loga o loader selecionado em stderr (não polui stdout com o conteúdo do PDF)
      console.error('[ankinator] loader: langchain');
      return runLangchainLoader(pdfPath, opts);
    }
    // D-04: fallback silencioso — langchain selecionado mas indisponível; cai no default Node.
    console.error('[ankinator] loader: langchain indisponível (fallback→node)');
  }

  // Caminho default (@opendataloader/pdf / Node / Java) — byte-idêntico ao original (D-15).
  const outDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ankinator-odl-'));
  try {
    const options = buildConvertOptions(outDir, opts);
    await convert([pdfPath], options);
    return await parseOdlOutput(outDir, pdfPath);
  } finally {
    fs.rm(outDir, { recursive: true, force: true }).catch(() => {});
  }
}
