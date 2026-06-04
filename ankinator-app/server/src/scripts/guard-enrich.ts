/**
 * Guard CLI-free de não-regressão PIPE-03 (Wave 0 / Phase 3).
 *
 * Prova que, com toggles desligados, `deveRodarEnrich()` retorna false e
 * portanto `enrichAll` NÃO é chamado — o fluxo `/generate` permanece
 * byte-idêntico ao comportamento pré-especialistas (PIPE-03).
 *
 * Espelha o padrão de guard-default-loader.ts (Phase 2) e smoke-runner.ts
 * --assert-args (Phase 1): CLI-free, sem spawnar o claude, sem quota, sem rede.
 *
 * CRÍTICO (PIPE-03): A cadeia de especialistas SÓ roda quando algum toggle está
 * ligado (classificar || cardBuilder). Qualquer regressão que faça enrichAll
 * rodar com toggles off quebra o fluxo padrão para todos os usuários.
 * Este guard é o gate per-wave que fecha o PIPE-03.
 *
 * Uso:
 *   tsx src/scripts/guard-enrich.ts          (roda asserções e sai 0 se OK)
 *   tsx src/scripts/guard-enrich.ts --assert  (alias explícito — mesma saída)
 *
 * Estado Wave 0: VERMELHO até que enrich.ts seja implementado no Plano 01.
 */
import { deveRodarEnrich } from '../core/specialists/enrich.js';

function fail(msg: string): never {
  console.error(`   ✗ FALHA: ${msg}`);
  process.exit(1);
}

// ── CENÁRIO 1: toggles off → enrichAll NÃO deve ser chamado ──────────────────
const optsOff = { classificar: false, cardBuilder: false };
if (deveRodarEnrich(optsOff) !== false) {
  fail('enrichAll seria chamado com toggles off — violação de PIPE-03');
}
console.log('   ✓ Cenário 1: toggles off → deveRodarEnrich=false OK (enrichAll não chamado).');

// ── CENÁRIO 2: toggle classificar on → enrichAll DEVE ser chamado ─────────────
const optsClassificar = { classificar: true, cardBuilder: false };
if (!deveRodarEnrich(optsClassificar)) {
  fail('enrichAll NÃO seria chamado com classificar=true — violação de PIPE-03');
}
console.log('   ✓ Cenário 2: classificar=true → deveRodarEnrich=true OK (enrichAll será chamado).');

// ── CENÁRIO 3: mnemonico=true → enrichAll DEVE ser chamado (Phase 4 — D-12) ──
// Garante que mnemonico sozinho aciona o pipeline de enriquecimento
const optsMnemonico = { classificar: false, cardBuilder: false, mnemonico: true, imagem: false };
if (!deveRodarEnrich(optsMnemonico)) {
  fail('enrichAll NÃO seria chamado com mnemonico=true — violação de PIPE-03');
}
console.log('   ✓ Cenário 3: mnemonico=true → deveRodarEnrich=true OK (enrichAll será chamado).');

// ── CENÁRIO 4: imagem=true → enrichAll DEVE ser chamado (Phase 4 — D-12) ─────
// Garante que imagem sozinha aciona o pipeline de enriquecimento
const optsImagem = { classificar: false, cardBuilder: false, mnemonico: false, imagem: true };
if (!deveRodarEnrich(optsImagem)) {
  fail('enrichAll NÃO seria chamado com imagem=true — violação de PIPE-03');
}
console.log('   ✓ Cenário 4: imagem=true → deveRodarEnrich=true OK (enrichAll será chamado).');

// ── CENÁRIO 5: 4 toggles off → enrichAll NÃO deve ser chamado (PIPE-03) ──────
// Prova byte-identidade: com todos os 4 toggles desligados, o pipeline NÃO roda
const optsAllOff = { classificar: false, cardBuilder: false, mnemonico: false, imagem: false };
if (deveRodarEnrich(optsAllOff) !== false) {
  fail('enrichAll seria chamado com todos os 4 toggles off — violação de PIPE-03 (byte-identidade)');
}
console.log('   ✓ Cenário 5: 4 toggles off → deveRodarEnrich=false OK (byte-identidade PIPE-03).');

// ── Modo explícito --assert (espelha smoke-runner --assert-args) ──────────────
if (process.argv.includes('--assert')) {
  console.log('\n--assert: guard PIPE-03 CLI-free OK; 4 toggles (classificar/cardBuilder/mnemonico/imagem) controlam enrichAll corretamente.');
  process.exit(0);
}

// Sem flag, ainda sai 0 (asserções já rodaram acima)
console.log('\nGuard PIPE-03 OK — enrichAll não chamado com toggles off; chamado com qualquer toggle on.');
process.exit(0);
