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
import { SYSTEM_FIDELITY, JSON_OUTPUT_INSTRUCTION, buildUserMessage } from '../prompts.js';
import { mapRawQuestoes, parseQuestoesJson, type QuestionProvider } from '../generation.js';
import { runClaudeCli } from '../specialists/runner.js';

export class CliProvider implements QuestionProvider {
  readonly nome = 'cli';
  private model: string;

  constructor(model: string) {
    // aliases aceitos pelo CLI: 'sonnet', 'opus', 'haiku' ou id completo
    this.model = model;
  }

  async generateForChunk(chunk: SemanticChunk, opts: GenerateOptions): Promise<Questao[]> {
    const userMessage = `${buildUserMessage(chunk.markdown, chunk.sectionTitles, opts)}\n\n${JSON_OUTPUT_INSTRUCTION}`;
    const out = await this.invoke(userMessage, opts.model || this.model);
    return mapRawQuestoes(parseQuestoesJson(out), chunk);
  }

  private invoke(userMessage: string, model: string): Promise<string> {
    // Delega ao runner compartilhado (mesmo spawn/flags/parse de antes).
    // systemPrompt = SYSTEM_FIDELITY → comportamento idêntico ao pré-refator.
    return runClaudeCli({ systemPrompt: SYSTEM_FIDELITY, userMessage, model });
  }
}
