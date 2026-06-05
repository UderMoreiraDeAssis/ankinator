/**
 * Provedor de geração via Claude Code CLI (`claude -p`).
 *
 * Usa a ASSINATURA Pro/Max já autenticada no `claude` — NÃO consome API key,
 * sem custo por token. Cada bloco vira uma chamada headless que devolve JSON.
 *
 * Trade-offs: consome a cota do plano, é mais lento (spawn por bloco) e a saída
 * é JSON parseado de texto (sem tool-use forçado). Roda num cwd temporário e com
 * system prompt próprio para evitar carregar contexto de projeto/CLAUDE.md.
 */
import type { GenerateOptions, Questao, SemanticChunk } from '../types.js';
import { selectSystemFidelity, JSON_OUTPUT_INSTRUCTION, buildUserMessage } from '../prompts.js';
import { mapRawQuestoes, parseQuestoesJson, type QuestionProvider } from '../generation.js';
import { runClaudeCli } from '../specialists/runner.js';

export class CliProvider implements QuestionProvider {
  readonly nome = 'cli';
  private model: string;
  private disableThinking: boolean;
  private criadaFidelityLivre: boolean;

  constructor(model: string, disableThinking = false, criadaFidelityLivre = false) {
    // aliases aceitos pelo CLI: 'sonnet', 'opus', 'haiku' ou id completo
    this.model = model;
    // opt-in (default false → spawn byte-idêntico ao pré-knob, guard SPEC-01 intacto):
    // injeta MAX_THINKING_TOKENS=0 no env quando true, igual aos especialistas de enrich.
    this.disableThinking = disableThinking;
    // opt-in (default false → systemPrompt = SYSTEM_FIDELITY byte-idêntico): afrouxa só a [CRIADA].
    this.criadaFidelityLivre = criadaFidelityLivre;
  }

  async generateForChunk(chunk: SemanticChunk, opts: GenerateOptions): Promise<Questao[]> {
    const userMessage = `${buildUserMessage(chunk.markdown, chunk.sectionTitles, opts, chunk.contextoAnterior)}\n\n${JSON_OUTPUT_INSTRUCTION}`;
    const out = await this.invoke(userMessage, opts.model || this.model);
    return mapRawQuestoes(parseQuestoesJson(out), chunk);
  }

  private invoke(userMessage: string, model: string): Promise<string> {
    // Delega ao runner compartilhado (mesmo spawn/flags/parse de antes).
    // systemPrompt: SYSTEM_FIDELITY por default (idêntico ao pré-refator) ou a variante que
    // afrouxa só a [CRIADA] quando o knob está ligado (config.criadaFidelityLivre).
    // stage: 'geracao' → atribuição de custo de tokens (usage.ts; só logging/contabilidade).
    return runClaudeCli({
      systemPrompt: selectSystemFidelity(this.criadaFidelityLivre),
      userMessage,
      model,
      stage: 'geracao',
      disableThinking: this.disableThinking,
    });
  }
}
