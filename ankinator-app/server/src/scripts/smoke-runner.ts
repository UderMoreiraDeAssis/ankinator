/**
 * Smoke-test do runner de especialista + prompt-loader.
 * Uso: tsx src/scripts/smoke-runner.ts   (dev)
 *      node dist/scripts/smoke-runner.js  (prod, após `npm run build`)
 *
 * NOTAS (criado APÓS runner.ts/prompt-loader.ts — blocker fechado):
 *  (a) O PASSO 2 (assertion de args/cwd/env via buildSpawnArgs) é CLI-FREE — NÃO spawna o
 *      claude. É o guard DETERMINÍSTICO de não-regressão do SPEC-01 (Pitfall 2): valida que
 *      o plano de spawn pós-refator é byte-a-byte o mesmo do CliProvider.invoke() pré-refator
 *      (mesmos flags na mesma ordem, cwd = os.tmpdir(), env derivado de process.env, e que o
 *      userMessage NÃO vaza para args — vai por stdin).
 *  (b) O PASSO 3 (runClaudeCli) EXERCITA o CLI e só é rodado no Plano 04, em modo `tsx` (src)
 *      E `node dist` (prod), para fechar o Pitfall 1 (resolução do .md cross-mode).
 */
import os from 'node:os';
import { runClaudeCli, buildSpawnArgs } from '../core/specialists/runner.js';
import { loadPrompt } from '../core/specialists/prompt-loader.js';
import { SYSTEM_FIDELITY } from '../core/prompts.js';

const NOMES = ['anki-orchestrator', 'deck-classifier', 'card-builder', 'mnemonic', 'mnemonic-image'];

// ── PASSO 1: loadPrompt dos 5 nomes canônicos (valida Pitfall 1 cross-mode) ──
console.log('1) loadPrompt dos 5 especialistas:');
for (const nome of NOMES) {
  const p = loadPrompt(nome);
  console.log(`   ✓ ${nome}.md (${p.length}c)`);
}

// ── PASSO 2: assertion DETERMINÍSTICA CLI-FREE de args/cwd/env (guard SPEC-01) ──
console.log('\n2) assertion determinística de buildSpawnArgs (CLI-free, guard SPEC-01):');
const USER_MESSAGE_FIXO = 'ping-fixo-para-assertion';
const plan = buildSpawnArgs({ systemPrompt: SYSTEM_FIDELITY, userMessage: USER_MESSAGE_FIXO, model: 'sonnet' });

const ARGS_ESPERADOS = [
  '-p',
  '--output-format',
  'json',
  '--model',
  'sonnet',
  '--system-prompt',
  SYSTEM_FIDELITY,
  '--exclude-dynamic-system-prompt-sections',
  '--strict-mcp-config',
];

function fail(msg: string): never {
  console.error(`   ✗ FALHA: ${msg}`);
  process.exit(1);
}

if (plan.args.length !== ARGS_ESPERADOS.length) {
  fail(`args com tamanho ${plan.args.length}, esperado ${ARGS_ESPERADOS.length}`);
}
for (let i = 0; i < ARGS_ESPERADOS.length; i++) {
  if (plan.args[i] !== ARGS_ESPERADOS[i]) {
    fail(`args[${i}] = ${JSON.stringify(plan.args[i])}, esperado ${JSON.stringify(ARGS_ESPERADOS[i])}`);
  }
}
if (plan.cwd !== os.tmpdir()) fail(`cwd = ${plan.cwd}, esperado ${os.tmpdir()}`);
if (plan.bin !== (process.env.ANKINATOR_CLAUDE_BIN?.trim() || 'claude')) {
  fail(`bin = ${plan.bin}, esperado o binário de ANKINATOR_CLAUDE_BIN || 'claude'`);
}
// env deriva de process.env (amostra uma chave conhecida; não compara o objeto inteiro)
if (plan.env.PATH !== process.env.PATH) fail('env não deriva de process.env (PATH divergente)');
// userMessage NÃO pode aparecer em args (vai por stdin — mitigação de injection)
if (plan.args.includes(USER_MESSAGE_FIXO)) fail('userMessage VAZOU para args (deveria ir por stdin)');
console.log('   ✓ args na ordem canônica exata; cwd = os.tmpdir(); env deriva de process.env; userMessage NÃO vaza para args (vai por stdin).');

// ── PASSO 3: runClaudeCli (EXERCITA o CLI — rodado só no Plano 04) ──
console.log('\n3) runClaudeCli (exercita o claude CLI — rodado no Plano 04):');
const t0 = Date.now();
const out = await runClaudeCli({ systemPrompt: 'Responda apenas "ok".', userMessage: 'ping' });
console.log(`   runner: "${out.trim().slice(0, 40)}" em ${((Date.now() - t0) / 1000).toFixed(1)}s`);
