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
 * Seleção de loader (RT-05):
 *   - ANKINATOR_PDF_LOADER=langchain → força LangChain; erro se indisponível.
 *   - ANKINATOR_PDF_LOADER=node     → força Node (@opendataloader/pdf via Java).
 *   - ANKINATOR_PDF_LOADER unset    → auto: usa LangChain se disponível, senão Node.
 *
 * Pré-requisitos para LangChain: Python com `langchain_opendataloader_pdf` instalado
 * e variável ODL_PYTHON (ou ANKINATOR_LANGCHAIN_PYTHON) apontando para o interpretador.
 * Exemplo: ODL_PYTHON=/home/user/.venv/bin/python3
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

/** Resultado de `chooseLoader()` — loader escolhido e motivo (para testes e logging). */
export interface LoaderChoice {
  loader: 'langchain' | 'node';
  reason: string;
}

/**
 * Determina qual loader de PDF usar, de forma testável (RT-05).
 *
 * Lógica de seleção:
 *   - ANKINATOR_PDF_LOADER=langchain → força LangChain; se indisponível lança erro.
 *   - ANKINATOR_PDF_LOADER=node     → força Node; sempre disponível.
 *   - ANKINATOR_PDF_LOADER unset    → auto: usa LangChain se disponível, senão Node.
 *
 * @param langchainAvailable  resultado de `isLangchainAvailable()` (injetado para testabilidade).
 */
export function chooseLoader(
  envValue: string | undefined,
  langchainAvailable: boolean
): LoaderChoice {
  const env = envValue?.trim().toLowerCase();

  if (env === 'langchain') {
    if (langchainAvailable) {
      return { loader: 'langchain', reason: 'ANKINATOR_PDF_LOADER=langchain (explícito)' };
    }
    throw new Error(
      'ANKINATOR_PDF_LOADER=langchain definido mas o sidecar Python não está disponível. ' +
      'Defina ODL_PYTHON (ou ANKINATOR_LANGCHAIN_PYTHON) apontando para um interpretador com ' +
      'langchain_opendataloader_pdf instalado. Exemplo: ODL_PYTHON=/home/user/.venv/bin/python3'
    );
  }

  if (env === 'node') {
    return { loader: 'node', reason: 'ANKINATOR_PDF_LOADER=node (explícito)' };
  }

  // unset / qualquer outro valor → auto
  if (langchainAvailable) {
    return { loader: 'langchain', reason: 'auto (ANKINATOR_PDF_LOADER unset, langchain disponível)' };
  }
  const noPython = !process.env.ANKINATOR_LANGCHAIN_PYTHON?.trim() && !process.env.ODL_PYTHON?.trim();
  return {
    loader: 'node',
    reason: noPython
      ? 'auto (ANKINATOR_PDF_LOADER unset, ODL_PYTHON/ANKINATOR_LANGCHAIN_PYTHON não definidos)'
      : 'auto (ANKINATOR_PDF_LOADER unset, langchain indisponível — pacote não importável)',
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

  // RT-05: seleção de loader com logging e auto-prefer langchain.
  const langchainAvail = await isLangchainAvailable();
  const { loader, reason } = chooseLoader(process.env.ANKINATOR_PDF_LOADER, langchainAvail);
  // chooseLoader lança se =langchain e indisponível (nenhum fallback silencioso neste caso).

  if (loader === 'langchain') {
    console.info(`[ankinator] PDF loader: langchain (${reason})`);
    return runLangchainLoader(pdfPath, opts);
  }

  // loader === 'node'
  console.info(`[ankinator] PDF loader: node (${reason})`);
  const outDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ankinator-odl-'));
  try {
    const options = buildConvertOptions(outDir, opts);
    await convert([pdfPath], options);
    return await parseOdlOutput(outDir, pdfPath);
  } finally {
    fs.rm(outDir, { recursive: true, force: true }).catch(() => {});
  }
}
