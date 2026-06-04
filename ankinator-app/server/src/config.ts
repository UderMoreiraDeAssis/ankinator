/**
 * Configuração do servidor, carregada de variáveis de ambiente.
 * Tenta carregar .env do diretório do app e do servidor (best-effort).
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
for (const envPath of [
  path.resolve(here, '../../.env'), // ankinator-app/.env
  path.resolve(here, '../.env'), // server/.env
]) {
  try {
    // Node 22+/24: carrega variáveis sem sobrescrever as já definidas
    process.loadEnvFile(envPath);
  } catch {
    /* arquivo ausente: ignora */
  }
}

type ProviderKind = 'cli' | 'api';

const providerEnv = (process.env.ANKINATOR_PROVIDER?.trim().toLowerCase() as ProviderKind) || 'cli';

/**
 * Loader de PDF: 'node' (padrão — @opendataloader/pdf via Java) ou 'langchain'
 * (opt-in — sidecar Python via langchain-opendataloader-pdf).
 * ANKINATOR_PDF_LOADER=node|langchain (default: 'node' — D-03, D-15)
 */
type PdfLoaderKind = 'node' | 'langchain';

const pdfLoaderEnv = (process.env.ANKINATOR_PDF_LOADER?.trim().toLowerCase() as PdfLoaderKind) || 'node';

export const config = {
  port: Number(process.env.PORT) || 8787,
  anthropicKey: process.env.ANTHROPIC_API_KEY?.trim() || '',
  /** Provedor de geração: 'cli' (assinatura, padrão) ou 'api' (key, por token). */
  provider: providerEnv === 'api' ? 'api' : ('cli' as ProviderKind),
  /** Modelo para a API (id completo). */
  model: process.env.ANKINATOR_MODEL?.trim() || 'claude-sonnet-4-6',
  /** Modelo para o CLI (alias 'sonnet'/'opus' ou id completo). */
  cliModel: process.env.ANKINATOR_CLI_MODEL?.trim() || 'sonnet',
  ankiconnectUrl: process.env.ANKICONNECT_URL?.trim() || 'http://127.0.0.1:8765',
  /**
   * Loader de PDF selecionado: 'node' (padrão, D-03) ou 'langchain' (opt-in).
   * Controlado por ANKINATOR_PDF_LOADER=node|langchain.
   * Default 'node' é CRÍTICO para D-15: env unset → modo Node, sem Python/Java LangChain.
   */
  pdfLoader: pdfLoaderEnv === 'langchain' ? 'langchain' : ('node' as PdfLoaderKind),
  /**
   * Interpretador Python para o sidecar LangChain (D-02).
   * ANKINATOR_LANGCHAIN_PYTHON — interpretador do venv langchain dedicado (requer Java 11+ no PATH).
   * Fallback: ODL_PYTHON (compatibilidade com sidecar OCR da Phase 1).
   * Vazio ('') quando nenhuma var está definida — isLangchainAvailable() retornará false.
   *
   * Setup do sidecar LangChain (RT-05):
   *   1. Criar venv: python3 -m venv ~/.venvs/odl
   *   2. Instalar:   ~/.venvs/odl/bin/pip install langchain-opendataloader-pdf
   *   3. Definir:    ODL_PYTHON=~/.venvs/odl/bin/python3  (no .env ou shell)
   *   Requer também Java 11+ no PATH.
   */
  langchainPython: process.env.ANKINATOR_LANGCHAIN_PYTHON?.trim() || process.env.ODL_PYTHON?.trim() || '',
  hasApiKey(): boolean {
    return this.anthropicKey.length > 0;
  },
  /** A geração está disponível? (cli sempre; api só com key) */
  canGenerate(): boolean {
    return this.provider === 'cli' || this.hasApiKey();
  },
};
