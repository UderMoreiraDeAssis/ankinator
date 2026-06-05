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
import { log, timer } from '../../logger.js';
import { recordUsage, usageFromEnvelope, formatCost, type RawCliUsage, type Stage } from '../usage.js';

const CLI_BIN = process.env.ANKINATOR_CLAUDE_BIN?.trim() || 'claude';
const CALL_TIMEOUT_MS = Number(process.env.ANKINATOR_CLI_TIMEOUT_MS) || 180_000;

export interface RunClaudeCliInput {
  systemPrompt: string;
  userMessage: string;
  /** default 'sonnet' (alias aceito pelo CLI). */
  model?: string;
  /**
   * Desativa o extended thinking NESTA chamada (injeta `MAX_THINKING_TOKENS=0` no env do spawn).
   * Os especialistas de enriquecimento (mnemônico/imagem/classificador/card-builder) produzem
   * saída ESTRUTURADA (JSON/SVG) e não se beneficiam de thinking — que aqui só adiciona latência
   * e estoura o timeout: gerar um SVG fazia o modelo ruminar >180s sem emitir markup (bug RT,
   * 2026-06-04; cura medida: 27s com thinking off). Controlado por env, NÃO por arg CLI → os
   * `args` canônicos permanecem byte-idênticos (guard SPEC-01 intacto).
   * Default (undefined/false): thinking preservado — o `CliProvider` de geração de questões
   * continua inalterado.
   */
  disableThinking?: boolean;
  /**
   * Estágio do pipeline que originou a chamada — usado APENAS para contabilizar
   * tokens/custo por estágio (usage.ts) e enriquecer o log. NUNCA entra em
   * `buildSpawnArgs`/args (logo, não afeta o guard SPEC-01). Default: 'outro'.
   */
  stage?: Stage;
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
  /** Uso de tokens da chamada (presente em --output-format json). */
  usage?: RawCliUsage;
  /** Custo equivalente-API em USD (reportado mesmo na assinatura Pro/Max). */
  total_cost_usd?: number;
  /** Tempo gasto na API (ms) reportado pelo CLI. */
  duration_api_ms?: number;
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
  { systemPrompt, model, disableThinking }: Required<Pick<RunClaudeCliInput, 'systemPrompt' | 'userMessage' | 'model'>> &
    Pick<RunClaudeCliInput, 'disableThinking'>
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
  // O corte de thinking vai pelo ENV (não pelos args) → os args canônicos seguem
  // byte-idênticos ao CliProvider pré-flag (Pitfall 2 / guard SPEC-01). Só é injetado
  // quando `disableThinking` é true; sem a flag, env = process.env (geração inalterada).
  const env: NodeJS.ProcessEnv = { ...process.env };
  if (disableThinking) env.MAX_THINKING_TOKENS = '0';
  return {
    bin: CLI_BIN,
    args,
    cwd: os.tmpdir(),
    env,
  };
}

/** Executa `claude -p` (assinatura) e devolve o texto do envelope JSON (`env.result`). */
export function runClaudeCli({ systemPrompt, userMessage, model = 'sonnet', disableThinking, stage = 'outro' }: RunClaudeCliInput): Promise<string> {
  return new Promise((resolve, reject) => {
    const plan = buildSpawnArgs({ systemPrompt, userMessage, model, disableThinking });

    // É AQUI que o tempo do pipeline é gasto. Logamos cada chamada ao CLI com os
    // tamanhos de entrada (system/user em chars) para abrir a caixa-preta de custo.
    log.info('claudeCli', 'chamada START', {
      stage,
      model,
      disableThinking: !!disableThinking,
      systemChars: systemPrompt.length,
      userChars: userMessage.length,
    });
    const fimCli = timer('claudeCli', `chamada (model=${model})`);

    const child = spawn(plan.bin, plan.args, {
      cwd: plan.cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: plan.env,
    });

    let stdout = '';
    let stderr = '';
    const tmout = setTimeout(() => {
      child.kill('SIGKILL');
      log.error('claudeCli', `chamada TIMEOUT (${CALL_TIMEOUT_MS}ms)`, { model });
      fimCli({ timeout: true });
      reject(new Error(`Tempo esgotado (${CALL_TIMEOUT_MS}ms) ao chamar o claude CLI.`));
    }, CALL_TIMEOUT_MS);

    child.stdout.on('data', (d) => (stdout += d.toString()));
    child.stderr.on('data', (d) => (stderr += d.toString()));
    child.on('error', (err) => {
      clearTimeout(tmout);
      log.error('claudeCli', `chamada ERRO de spawn: ${err.message}`, { bin: CLI_BIN });
      fimCli({ erro: 'spawn' });
      reject(new Error(`Falha ao executar "${CLI_BIN}": ${err.message}. O Claude Code está instalado e logado?`));
    });
    child.on('close', (code) => {
      clearTimeout(tmout);
      if (code !== 0) {
        log.error('claudeCli', `chamada saiu com código ${code}`, { model, stderr: stderr.slice(-300) });
        fimCli({ code });
        reject(new Error(`claude CLI saiu com código ${code}. ${stderr.slice(-300)}`));
        return;
      }
      try {
        const env = JSON.parse(stdout) as CliEnvelope;
        if (env.is_error) {
          log.error('claudeCli', 'chamada retornou is_error', { model, erro: env.error || env.result });
          fimCli({ isError: true });
          reject(new Error(`claude CLI: ${env.error || env.result || 'erro desconhecido'}`));
          return;
        }
        const out = env.result ?? '';
        // Token/custo vêm do MESMO envelope (de graça). Contabiliza por estágio (usage.ts)
        // e loga a chamada — abre a dimensão CUSTO ao lado da de TEMPO (timer).
        const uso = usageFromEnvelope(env.usage, env.total_cost_usd, env.duration_api_ms);
        recordUsage(stage, uso);
        log.info('claudeCli', 'chamada END', {
          stage,
          model,
          outChars: out.length,
          inTok: uso.inputTokens || undefined,
          outTok: uso.outputTokens || undefined,
          cacheR: uso.cacheReadTokens || undefined,
          custo: env.total_cost_usd !== undefined ? formatCost(uso.costUsd) : undefined,
          apiMs: uso.apiMs || undefined,
        });
        fimCli({ outChars: out.length });
        resolve(out);
      } catch {
        // alguns builds podem imprimir texto puro: usa o stdout cru
        log.info('claudeCli', 'chamada END (stdout cru, sem envelope JSON)', { model, outChars: stdout.length });
        fimCli({ outChars: stdout.length, raw: true });
        resolve(stdout);
      }
    });

    child.stdin.write(userMessage);
    child.stdin.end();
  });
}
