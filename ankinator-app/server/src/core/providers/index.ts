/**
 * Seleção do provedor de geração de questões.
 *  - 'cli' (padrão): usa o `claude` CLI / assinatura Pro-Max, sem custo de API.
 *  - 'api': usa a API Anthropic com ANTHROPIC_API_KEY, cobrança por token.
 */
import type { QuestionProvider } from '../generation.js';
import { ApiProvider } from './api-provider.js';
import { CliProvider } from './cli-provider.js';

export type ProviderKind = 'cli' | 'api';

export interface ProviderConfig {
  kind: ProviderKind;
  apiKey: string;
  /** Modelo para a API (id completo, ex.: claude-sonnet-4-6). */
  apiModel: string;
  /** Modelo para o CLI (alias 'sonnet'/'opus' ou id completo). */
  cliModel: string;
}

export function createProvider(cfg: ProviderConfig): QuestionProvider {
  if (cfg.kind === 'api') {
    if (!cfg.apiKey) throw new Error('Provedor "api" selecionado, mas ANTHROPIC_API_KEY não está configurada.');
    return new ApiProvider(cfg.apiKey, cfg.apiModel);
  }
  return new CliProvider(cfg.cliModel);
}
