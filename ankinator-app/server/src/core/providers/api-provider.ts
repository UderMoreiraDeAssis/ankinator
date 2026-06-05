/**
 * Provedor de geração via API Anthropic (ANTHROPIC_API_KEY).
 * Cobrança por token. Usa tool-use forçado (saída estruturada confiável) e
 * prompt caching no system/tool para reduzir custo em PDFs longos.
 */
import Anthropic from '@anthropic-ai/sdk';
import type { GenerateOptions, Questao, SemanticChunk } from '../types.js';
import { selectSystemFidelity, REGISTRAR_QUESTOES_TOOL, buildUserMessage } from '../prompts.js';
import { mapRawQuestoes, type QuestionProvider, type RawQuestao } from '../generation.js';

export class ApiProvider implements QuestionProvider {
  readonly nome = 'api';
  private client: Anthropic;
  private model: string;
  private criadaFidelityLivre: boolean;

  constructor(apiKey: string, model: string, criadaFidelityLivre = false) {
    this.client = new Anthropic({ apiKey });
    this.model = model;
    // opt-in (default false → system = SYSTEM_FIDELITY byte-idêntico): afrouxa só a [CRIADA].
    this.criadaFidelityLivre = criadaFidelityLivre;
  }

  async generateForChunk(chunk: SemanticChunk, opts: GenerateOptions): Promise<Questao[]> {
    const response = await this.client.messages.create({
      model: opts.model || this.model,
      max_tokens: 4096,
      system: [{ type: 'text', text: selectSystemFidelity(this.criadaFidelityLivre), cache_control: { type: 'ephemeral' } }],
      tools: [{ ...REGISTRAR_QUESTOES_TOOL, cache_control: { type: 'ephemeral' } }],
      tool_choice: { type: 'tool', name: REGISTRAR_QUESTOES_TOOL.name },
      messages: [{ role: 'user', content: buildUserMessage(chunk.markdown, chunk.sectionTitles, opts, chunk.contextoAnterior) }],
    });

    const toolUse = response.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use' && b.name === REGISTRAR_QUESTOES_TOOL.name
    );
    if (!toolUse) return [];
    const raw = (toolUse.input as { questoes?: RawQuestao[] }).questoes ?? [];
    return mapRawQuestoes(raw, chunk);
  }
}
