/**
 * Guard CLI-free de não-regressão do caminho default (D-15 / Pitfall 3).
 *
 * Prova que, com ANKINATOR_PDF_LOADER unset, o ConvertOptions produzido por
 * buildConvertOptions() é byte-idêntico ao inline original de document-loader.ts,
 * SEM spawnar Java/Python e SEM chamar isLangchainAvailable().
 *
 * Espelha o guard SPEC-01-equivalente da Phase 1 (smoke-runner.ts --assert-args),
 * que prova CLI-free que o plano de spawn do CliProvider é byte-idêntico pós-refator.
 *
 * CRÍTICO (Pitfall 3): O caminho de produção RODA SEM Python. Qualquer regressão
 * no ConvertOptions default interrompe a extração de PDF para todos os usuários.
 * Este guard é o gate per-wave que fecha o Pitfall 3.
 *
 * Uso:
 *   tsx src/scripts/guard-default-loader.ts          (roda asserções e sai 0 se OK)
 *   tsx src/scripts/guard-default-loader.ts --assert  (alias explícito — mesma saída)
 */
import { buildConvertOptions } from '../core/document-loader.js';

// Nunca importamos langchain-loader, nunca chamamos isLangchainAvailable(), convert() ou spawn.
// Este script é o guard de que o default roda SEM Python/Java (D-15).

function fail(msg: string): never {
  console.error(`   ✗ FALHA: ${msg}`);
  process.exit(1);
}

// ── CENÁRIO 1: opts vazio (caminho default sem pages/password) ─────────────────
// outDir fixo de teste — valor não importa; importa a estrutura do objeto resultante.
const TEST_OUT_DIR = '/tmp/guard';

const actual = buildConvertOptions(TEST_OUT_DIR, {});

// Asserções individuais — cada chave comparada à spec original (document-loader.ts:49-58)
if (actual.outputDir !== TEST_OUT_DIR) {
  fail(`outputDir = ${JSON.stringify(actual.outputDir)}, esperado ${JSON.stringify(TEST_OUT_DIR)}`);
}

// format: array de strings — comparado element-by-element
const EXPECTED_FORMAT = ['json', 'markdown'];
if (!Array.isArray(actual.format)) {
  fail(`format não é array: ${JSON.stringify(actual.format)}`);
}
if (actual.format.length !== EXPECTED_FORMAT.length) {
  fail(`format.length = ${actual.format.length}, esperado ${EXPECTED_FORMAT.length}`);
}
for (let i = 0; i < EXPECTED_FORMAT.length; i++) {
  if (actual.format[i] !== EXPECTED_FORMAT[i]) {
    fail(`format[${i}] = ${JSON.stringify(actual.format[i])}, esperado ${JSON.stringify(EXPECTED_FORMAT[i])}`);
  }
}

if (actual.tableMethod !== 'cluster') {
  fail(`tableMethod = ${JSON.stringify(actual.tableMethod)}, esperado "cluster"`);
}
if (actual.readingOrder !== 'xycut') {
  fail(`readingOrder = ${JSON.stringify(actual.readingOrder)}, esperado "xycut"`);
}
if (actual.imageOutput !== 'off') {
  fail(`imageOutput = ${JSON.stringify(actual.imageOutput)}, esperado "off"`);
}
if (actual.quiet !== true) {
  fail(`quiet = ${JSON.stringify(actual.quiet)}, esperado true`);
}

// Com opts vazio, pages e password NÃO devem existir no objeto
if ('pages' in actual) {
  fail(`pages presente no resultado com opts={} (deve estar ausente)`);
}
if ('password' in actual) {
  fail(`password presente no resultado com opts={} (deve estar ausente)`);
}

console.log('   ✓ Cenário 1 (opts vazio): ConvertOptions byte-idêntico — outputDir, format, tableMethod, readingOrder, imageOutput, quiet OK; pages/password ausentes.');

// ── CENÁRIO 2: opts com pages e password ──────────────────────────────────────
const actualWithOpts = buildConvertOptions(TEST_OUT_DIR, { pages: '1,3', password: 'x' });

if (!('pages' in actualWithOpts)) {
  fail(`pages ausente quando opts.pages='1,3'`);
}
if ((actualWithOpts as Record<string, unknown>).pages !== '1,3') {
  fail(`pages = ${JSON.stringify((actualWithOpts as Record<string, unknown>).pages)}, esperado "1,3"`);
}
if (!('password' in actualWithOpts)) {
  fail(`password ausente quando opts.password='x'`);
}
if ((actualWithOpts as Record<string, unknown>).password !== 'x') {
  fail(`password = ${JSON.stringify((actualWithOpts as Record<string, unknown>).password)}, esperado "x"`);
}

// As chaves base devem continuar idênticas mesmo com opts extras
if (actualWithOpts.tableMethod !== 'cluster') {
  fail(`tableMethod com opts = ${JSON.stringify(actualWithOpts.tableMethod)}, esperado "cluster"`);
}
if (actualWithOpts.readingOrder !== 'xycut') {
  fail(`readingOrder com opts = ${JSON.stringify(actualWithOpts.readingOrder)}, esperado "xycut"`);
}
if (actualWithOpts.imageOutput !== 'off') {
  fail(`imageOutput com opts = ${JSON.stringify(actualWithOpts.imageOutput)}, esperado "off"`);
}

console.log('   ✓ Cenário 2 (pages + password): pages="1,3", password="x" adicionados corretamente; chaves base intactas.');

// ── Modo explícito --assert (espelha smoke-runner --assert-args) ──────────────
if (process.argv.includes('--assert')) {
  console.log('\n--assert: guard default CLI-free OK; ConvertOptions byte-idêntico.');
  process.exit(0);
}

// Sem flag, ainda sai 0 (asserções já rodaram acima)
console.log('\nGuard D-15 OK — ConvertOptions default byte-idêntico, SEM Java/Python/langchain.');
process.exit(0);
