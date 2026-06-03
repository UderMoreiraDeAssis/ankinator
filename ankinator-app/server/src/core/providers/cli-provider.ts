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
import { spawn } from 'node:child_process';
import os from 'node:os';
import type { GenerateOptions, Questao, SemanticChunk } from '../types.js';
import { SYSTEM_FIDELITY, JSON_OUTPUT_INSTRUCTION, buildUserMessage } from '../prompts.js';
import { mapRawQuestoes, parseQuestoesJson, type QuestionProvider } from '../generation.js';

const CLI_BIN = process.env.ANKINATOR_CLAUDE_BIN?.trim() || 'claude';
const CALL_TIMEOUT_MS = Number(process.env.ANKINATOR_CLI_TIMEOUT_MS) || 180_000;

interface CliEnvelope {
  type?: string;
  subtype?: string;
  is_error?: boolean;
  result?: string;
  error?: string;
}

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
    return new Promise((resolve, reject) => {
      const args = [
        '-p',
        '--output-format',
        'json',
        '--model',
        model,
        '--system-prompt',
        SYSTEM_FIDELITY,
        '--exclude-dynamic-system-prompt-sections',
        '--strict-mcp-config',
      ];

      const child = spawn(CLI_BIN, args, {
        cwd: os.tmpdir(),
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env },
      });

      let stdout = '';
      let stderr = '';
      const timer = setTimeout(() => {
        child.kill('SIGKILL');
        reject(new Error(`Tempo esgotado (${CALL_TIMEOUT_MS}ms) ao chamar o claude CLI.`));
      }, CALL_TIMEOUT_MS);

      child.stdout.on('data', (d) => (stdout += d.toString()));
      child.stderr.on('data', (d) => (stderr += d.toString()));
      child.on('error', (err) => {
        clearTimeout(timer);
        reject(new Error(`Falha ao executar "${CLI_BIN}": ${err.message}. O Claude Code está instalado e logado?`));
      });
      child.on('close', (code) => {
        clearTimeout(timer);
        if (code !== 0) {
          reject(new Error(`claude CLI saiu com código ${code}. ${stderr.slice(-300)}`));
          return;
        }
        try {
          const env = JSON.parse(stdout) as CliEnvelope;
          if (env.is_error) {
            reject(new Error(`claude CLI: ${env.error || env.result || 'erro desconhecido'}`));
            return;
          }
          resolve(env.result ?? '');
        } catch {
          // alguns builds podem imprimir texto puro: usa o stdout cru
          resolve(stdout);
        }
      });

      child.stdin.write(userMessage);
      child.stdin.end();
    });
  }
}
