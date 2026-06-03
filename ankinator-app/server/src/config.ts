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
  hasApiKey(): boolean {
    return this.anthropicKey.length > 0;
  },
  /** A geração está disponível? (cli sempre; api só com key) */
  canGenerate(): boolean {
    return this.provider === 'cli' || this.hasApiKey();
  },
};
