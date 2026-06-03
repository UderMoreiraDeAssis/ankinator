/**
 * Unit puro CLI-free do módulo langchain-loader.ts.
 * D-14 — Wave 2, TDD RED/GREEN. Determinístico: sem Python real, sem Java, sem rede.
 *
 * Cobre:
 *  - D-02: isLangchainAvailable() retorna false quando ANKINATOR_LANGCHAIN_PYTHON / ODL_PYTHON não definido
 *  - D-04: runLangchainLoader() propaga throw quando pythonBin() é null
 *  - D-01/D-11: interface da função (exports existem, assinatura compatível)
 *  - cross-mode: módulo importável sem erros de tipo em runtime
 *
 * Uso: tsx src/scripts/assert-langchain-loader.ts
 * Sai 0 (sucesso) ou 1 (falha via fail()).
 *
 * NOTA: testes de spawn real (isLangchainAvailable/runLangchainLoader com Python real)
 * ficam no smoke-langchain-loader.ts (Plano 04 — requer venv + Java 11+).
 */

/** Encerra com código 1 e imprime a mensagem de falha (idioma de smoke-runner.ts). */
function fail(msg: string): never {
  console.error(`   FALHA: ${msg}`);
  process.exit(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// CENÁRIO 1: Verificar exports e assinaturas do módulo
// ─────────────────────────────────────────────────────────────────────────────
console.log('Cenário 1: verificando exports do módulo langchain-loader.ts...');

// RED GATE: importar o módulo — falha se o arquivo não existir ou tiver erros de sintaxe
// Quando este teste rodar pela 1ª vez (RED), o import DEVE falhar com MODULE_NOT_FOUND
let loaderModule: { isLangchainAvailable: unknown; runLangchainLoader: unknown } | undefined;

try {
  // Importação dinâmica — RED: falha se langchain-loader.ts não existe ainda
  loaderModule = await import('../core/langchain-loader.js');
} catch (err: unknown) {
  const error = err as NodeJS.ErrnoException;
  // RED esperado: arquivo não existe ainda → registrar como falha esperada no RED
  if (error.code === 'MODULE_NOT_FOUND' || (error as Error).message?.includes('Cannot find')) {
    console.error(`   RED gate: langchain-loader.ts não existe ainda — ${(error as Error).message}`);
    process.exit(1);
  }
  // Erros inesperados (sintaxe, tipo) também são falha
  throw err;
}

// GREEN+: módulo importado com sucesso — verificar exports
if (typeof loaderModule.isLangchainAvailable !== 'function') {
  fail(
    `isLangchainAvailable não é função: ${typeof loaderModule.isLangchainAvailable} — D-04/D-02`
  );
}
console.log(`   isLangchainAvailable existe como função — export OK`);

if (typeof loaderModule.runLangchainLoader !== 'function') {
  fail(`runLangchainLoader não é função: ${typeof loaderModule.runLangchainLoader} — D-01/D-11`);
}
console.log(`   runLangchainLoader existe como função — export OK`);

// ─────────────────────────────────────────────────────────────────────────────
// CENÁRIO 2: isLangchainAvailable() → false quando env não definido (D-02)
// ─────────────────────────────────────────────────────────────────────────────
console.log('\nCenário 2: isLangchainAvailable() → false sem vars (D-02)...');

// Salvar env vars originais
const origLangchainPython = process.env.ANKINATOR_LANGCHAIN_PYTHON;
const origOdlPython = process.env.ODL_PYTHON;

// Limpar as vars para testar o path "pythonBin() == null"
delete process.env.ANKINATOR_LANGCHAIN_PYTHON;
delete process.env.ODL_PYTHON;

const isAvailable = await (loaderModule.isLangchainAvailable as () => Promise<boolean>)();

// D-02: sem env vars → deve retornar false SEM spawnar nada
if (isAvailable !== false) {
  // Restaurar antes de sair
  if (origLangchainPython !== undefined) process.env.ANKINATOR_LANGCHAIN_PYTHON = origLangchainPython;
  if (origOdlPython !== undefined) process.env.ODL_PYTHON = origOdlPython;
  fail(`isLangchainAvailable() retornou ${isAvailable}, esperado false quando env não definido (D-02)`);
}
console.log(`   isLangchainAvailable() === false (sem ANKINATOR_LANGCHAIN_PYTHON/ODL_PYTHON) — D-02 OK`);

// ─────────────────────────────────────────────────────────────────────────────
// CENÁRIO 3: runLangchainLoader() → throw quando env não definido (D-04)
// ─────────────────────────────────────────────────────────────────────────────
console.log('\nCenário 3: runLangchainLoader() lança erro quando env não definido (D-04)...');

// As vars já estão limpas do Cenário 2
let threw = false;
try {
  await (loaderModule.runLangchainLoader as (pdf: string, opts: object) => Promise<unknown>)(
    '/tmp/fake.pdf',
    {}
  );
} catch (err: unknown) {
  threw = true;
  const msg = (err as Error).message || '';
  // D-04: erro deve mencionar ANKINATOR_LANGCHAIN_PYTHON ou ODL_PYTHON
  if (!msg.includes('ANKINATOR_LANGCHAIN_PYTHON') && !msg.includes('ODL_PYTHON')) {
    // Restaurar antes de sair
    if (origLangchainPython !== undefined) process.env.ANKINATOR_LANGCHAIN_PYTHON = origLangchainPython;
    if (origOdlPython !== undefined) process.env.ODL_PYTHON = origOdlPython;
    fail(
      `runLangchainLoader() lançou erro mas mensagem não menciona as vars: "${msg}" — D-04`
    );
  }
  console.log(`   runLangchainLoader() threw: "${msg.substring(0, 80)}" — D-04 OK`);
}

if (!threw) {
  // Restaurar antes de sair
  if (origLangchainPython !== undefined) process.env.ANKINATOR_LANGCHAIN_PYTHON = origLangchainPython;
  if (origOdlPython !== undefined) process.env.ODL_PYTHON = origOdlPython;
  fail(`runLangchainLoader() NÃO lançou erro quando sem env — D-04 exige throw (não fallback)`);
}

// Restaurar env vars originais
if (origLangchainPython !== undefined) process.env.ANKINATOR_LANGCHAIN_PYTHON = origLangchainPython;
if (origOdlPython !== undefined) process.env.ODL_PYTHON = origOdlPython;

// ─────────────────────────────────────────────────────────────────────────────
// SUCESSO
// ─────────────────────────────────────────────────────────────────────────────
console.log('\nassert-langchain-loader: todos os cenários OK (D-01/D-02/D-04/D-11)');
process.exit(0);
