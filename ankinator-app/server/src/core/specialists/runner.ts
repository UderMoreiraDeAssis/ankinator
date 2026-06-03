/**
 * Runner reutilizável do `claude -p` (assinatura Pro/Max — NÃO consome API key).
 *
 * Fonte do mecanismo: extraído byte-a-byte de
 * `ankinator-app/server/src/core/providers/cli-provider.ts` (`invoke()`).
 * O único ponto parametrizado é o `systemPrompt` (antes fixo em SYSTEM_FIDELITY);
 * o `CliProvider` agora delega para cá passando exatamente SYSTEM_FIDELITY, sem
 * mudança de comportamento observável (mesmos args, cwd, env, timeout, parse).
 *
 * NÃO-REGRESSÃO (Pitfall 2): o plano de spawn (`{ bin, args, cwd, env }`) é montado
 * por `buildSpawnArgs`, uma função PURA que NÃO spawna nada — assim a assertion
 * determinística CLI-free do smoke-runner (Plano 04) introspeciona exatamente o que
 * `runClaudeCli` executa. `userMessage` NUNCA entra em `args` (vai por stdin) —
 * mitigação de command injection herdada do CliProvider.
 */
import { spawn } from 'node:child_process';
import os from 'node:os';

const CLI_BIN = process.env.ANKINATOR_CLAUDE_BIN?.trim() || 'claude';
const CALL_TIMEOUT_MS = Number(process.env.ANKINATOR_CLI_TIMEOUT_MS) || 180_000;

export interface RunClaudeCliInput {
  systemPrompt: string;
  userMessage: string;
  /** default 'sonnet' (alias aceito pelo CLI). */
  model?: string;
}

/** Plano de spawn introspectável (saída do helper puro `buildSpawnArgs`). */
export interface SpawnPlan {
  bin: string;
  args: string[];
  cwd: string;
  env: NodeJS.ProcessEnv;
}

interface CliEnvelope {
  type?: string;
  subtype?: string;
  is_error?: boolean;
  result?: string;
  error?: string;
}

/**
 * Helper PURO: monta o plano de spawn `{ bin, args, cwd, env }` SEM spawnar nada.
 * É a fonte única do plano que `runClaudeCli` executa — permite a assertion
 * determinística de não-regressão (args/cwd/env idênticos ao CliProvider pré-refator)
 * sem precisar exercitar o CLI.
 *
 * `userMessage` é recebido só para a assertion poder validar que ele NÃO vaza para
 * `args` (continua indo por stdin no `runClaudeCli`).
 */
export function buildSpawnArgs(
  { systemPrompt, model }: Required<Pick<RunClaudeCliInput, 'systemPrompt' | 'userMessage' | 'model'>>
): SpawnPlan {
  const args = [
    '-p',
    '--output-format',
    'json',
    '--model',
    model,
    '--system-prompt',
    systemPrompt,
    '--exclude-dynamic-system-prompt-sections',
    '--strict-mcp-config',
  ];
  return {
    bin: CLI_BIN,
    args,
    cwd: os.tmpdir(),
    env: { ...process.env },
  };
}

/** Executa `claude -p` (assinatura) e devolve o texto do envelope JSON (`env.result`). */
export function runClaudeCli({ systemPrompt, userMessage, model = 'sonnet' }: RunClaudeCliInput): Promise<string> {
  return new Promise((resolve, reject) => {
    const plan = buildSpawnArgs({ systemPrompt, userMessage, model });

    const child = spawn(plan.bin, plan.args, {
      cwd: plan.cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: plan.env,
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
