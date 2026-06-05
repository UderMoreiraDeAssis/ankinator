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
  /** Desliga extended thinking na geração via CLI (opt-in; default false). Só afeta 'cli'. */
  cliDisableThinking?: boolean;
  /**
   * Afrouxa a fidelidade SÓ das questões [CRIADA] na geração (opt-in; default false → system prompt
   * byte-idêntico). Vale para AMBOS os provedores (o system prompt é o mesmo em CLI e API).
   */
  criadaFidelityLivre?: boolean;
}

export function createProvider(cfg: ProviderConfig): QuestionProvider {
  if (cfg.kind === 'api') {
    if (!cfg.apiKey) throw new Error('Provedor "api" selecionado, mas ANTHROPIC_API_KEY não está configurada.');
    return new ApiProvider(cfg.apiKey, cfg.apiModel, cfg.criadaFidelityLivre);
  }
  return new CliProvider(cfg.cliModel, cfg.cliDisableThinking, cfg.criadaFidelityLivre);
}
