/**
 * QuestionGenerator — gera questões com o Claude a partir de blocos semânticos.
 *
 * - Saída estruturada via tool-use forçado (parsing confiável).
 * - Prompt caching no system prompt e na definição da ferramenta (estáticos entre
 *   blocos) para reduzir custo/latência em PDFs longos.
 * - Falha por bloco não derruba o lote: erros são coletados e reportados.
 */
import Anthropic from '@anthropic-ai/sdk';
import crypto from 'node:crypto';
import type { GenerateOptions, Questao, SemanticChunk } from './types.js';
import {
  SYSTEM_FIDELITY,
  REGISTRAR_QUESTOES_TOOL,
  buildUserMessage,
} from './prompts.js';

const DEFAULT_MODEL = process.env.ANKINATOR_MODEL?.trim() || 'claude-sonnet-4-6';

export interface ChunkProgress {
  index: number;
  total: number;
  sectionTitles: string[];
  questoesNoBloco: number;
  erro?: string;
}

export interface GenerateResult {
  questoes: Questao[];
  erros: { chunkIndex: number; mensagem: string }[];
}

interface RawQuestao {
  tipo: 'extraida' | 'criada';
  pergunta: string;
  resposta: string;
  metadata?: Questao['metadata'];
}

export class QuestionGenerator {
  private client: Anthropic;
  private model: string;

  constructor(apiKey: string, model: string = DEFAULT_MODEL) {
    this.client = new Anthropic({ apiKey });
    this.model = model;
  }

  /** Gera questões para um único bloco. */
  async generateForChunk(chunk: SemanticChunk, opts: GenerateOptions): Promise<Questao[]> {
    const response = await this.client.messages.create({
      model: opts.model || this.model,
      max_tokens: 4096,
      system: [
        { type: 'text', text: SYSTEM_FIDELITY, cache_control: { type: 'ephemeral' } },
      ],
      tools: [
        { ...REGISTRAR_QUESTOES_TOOL, cache_control: { type: 'ephemeral' } },
      ],
      tool_choice: { type: 'tool', name: REGISTRAR_QUESTOES_TOOL.name },
      messages: [
        { role: 'user', content: buildUserMessage(chunk.markdown, chunk.sectionTitles, opts) },
      ],
    });

    const toolUse = response.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use' && b.name === REGISTRAR_QUESTOES_TOOL.name
    );
    if (!toolUse) return [];

    const raw = (toolUse.input as { questoes?: RawQuestao[] }).questoes ?? [];
    return raw
      .filter((q) => q && q.pergunta && q.resposta)
      .map((q) => ({
        id: crypto.randomUUID(),
        tipo: q.tipo === 'extraida' ? 'extraida' : 'criada',
        pergunta: q.pergunta.trim(),
        resposta: q.resposta.trim(),
        pageStart: chunk.pageStart,
        pageEnd: chunk.pageEnd,
        metadata: q.metadata && Object.keys(q.metadata).length ? q.metadata : undefined,
      }));
  }

  /**
   * Gera questões para todos os blocos, sequencialmente (respeita rate limits e
   * mantém o prompt cache quente). Reporta progresso por bloco.
   */
  async generate(
    chunks: SemanticChunk[],
    opts: GenerateOptions,
    onProgress?: (p: ChunkProgress) => void
  ): Promise<GenerateResult> {
    const questoes: Questao[] = [];
    const erros: GenerateResult['erros'] = [];

    for (const chunk of chunks) {
      try {
        const qs = await this.generateForChunk(chunk, opts);
        questoes.push(...qs);
        onProgress?.({
          index: chunk.index,
          total: chunks.length,
          sectionTitles: chunk.sectionTitles,
          questoesNoBloco: qs.length,
        });
      } catch (err) {
        const mensagem = err instanceof Error ? err.message : String(err);
        erros.push({ chunkIndex: chunk.index, mensagem });
        onProgress?.({
          index: chunk.index,
          total: chunks.length,
          sectionTitles: chunk.sectionTitles,
          questoesNoBloco: 0,
          erro: mensagem,
        });
      }
    }

    return { questoes, erros };
  }
}
