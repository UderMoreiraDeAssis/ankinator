/**
 * Unit puro CLI-free da função normalize() de langchain-normalize.ts.
 * D-14 — Wave 0. Determinístico: sem Python, sem Java, sem rede.
 *
 * Cobre:
 *  - R1 : páginas não-contíguas (page 1 + page 3, sem Document para page 2)
 *  - Pitfall 1 : numPages = max(page) SEM +1 (page é 1-indexed)
 *  - Pitfall 4 : title === null quando não há heading ATX inicial
 *  - D-08 : 1 'text block' por Document emitido (não por página física)
 *  - D-07 : sections derivadas de headings ATX
 *  - D-09 : markdown sem marcadores de página
 *
 * Uso: tsx src/scripts/assert-langchain-normalize.ts
 * Sai 0 (sucesso) ou 1 (falha via fail()).
 */
import { normalize } from '../core/langchain-normalize.js';

/** Encerra com código 1 e imprime a mensagem de falha (idioma de smoke-runner.ts). */
function fail(msg: string): never {
  console.error(`   ✗ FALHA: ${msg}`);
  process.exit(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// CENÁRIO A: páginas NÃO-contíguas (R1) + heading ATX inicial (Pitfall 1/D-07)
// ─────────────────────────────────────────────────────────────────────────────
// Fixture: page 1 e page 3, SEM Document para page 2.
// O PDF tem 3 páginas no total; a página 2 está vazia → motor não emite Document.
const fixtureA = [
  {
    page_content: '# Cap 1\n\nTexto introdutório do capítulo um.',
    metadata: { source: 'concurso.pdf', format: 'markdown', page: 1 },
  },
  {
    page_content: '## Seção B\n\nTexto da seção B na página três.',
    metadata: { source: 'concurso.pdf', format: 'markdown', page: 3 },
  },
];

console.log('Cenário A: páginas não-contíguas (R1) + heading ATX:');
const docA = normalize(fixtureA, '/home/usuario/concurso.pdf');

// Pitfall 1: numPages = max(page) com pages [1,3] → deve ser 3 (não 4, não 2)
if (docA.numPages !== 3)
  fail(`numPages = ${docA.numPages}, esperado 3 (max([1,3]), SEM +1 — Pitfall 1/R1)`);
console.log(`   ✓ numPages === 3 (max([1,3]), SEM +1 — Pitfall 1 fechado)`);

// R1: 1 element por Document EMITIDO (não por página física)
// Fixture tem 2 Documents → elements.length deve ser 2 (não 3 = número de páginas físicas)
if (docA.elements.length !== fixtureA.length)
  fail(`elements.length = ${docA.elements.length}, esperado ${fixtureA.length} (1 por Document emitido — R1)`);
console.log(`   ✓ elements.length === ${fixtureA.length} (1 por Document emitido — R1 fechado)`);

// D-08: todo element deve ser 'text block'
if (!docA.elements.every((e) => e.type === 'text block'))
  fail(`nem todos elements são 'text block': ${docA.elements.map((e) => e.type).join(', ')}`);
console.log(`   ✓ elements.every(e => e.type === 'text block') — D-08 OK`);

// D-07: sections derivadas de headings ATX (≥2: uma para "Cap 1" e uma para "Seção B")
if (docA.sections.length < 2)
  fail(`sections.length = ${docA.sections.length}, esperado >= 2 (1 por heading ATX — D-07)`);
console.log(`   ✓ sections.length >= 2 (${docA.sections.length}) — D-07 OK`);

// D-07: cada section.id é string não-vazia (UUID)
for (let i = 0; i < docA.sections.length; i++) {
  if (!docA.sections[i].id || typeof docA.sections[i].id !== 'string')
    fail(`sections[${i}].id inválido: ${JSON.stringify(docA.sections[i].id)}`);
}
console.log(`   ✓ todas as sections têm id string não-vazia — D-07 OK`);

// title = primeiro heading ATX ("Cap 1") — não null
if (docA.title !== 'Cap 1')
  fail(`title = ${JSON.stringify(docA.title)}, esperado 'Cap 1'`);
console.log(`   ✓ title === 'Cap 1' — D-10 OK`);

// usedOcr deve ser false
if (docA.usedOcr !== false)
  fail(`usedOcr = ${docA.usedOcr}, esperado false`);
console.log(`   ✓ usedOcr === false`);

// D-09: markdown não contém marcador de página (ex.: "page 1 of", "Page 1", "--- página 2 ---")
if (/page \d+ of/i.test(docA.markdown))
  fail(`markdown contém marcador de página (D-09): ${docA.markdown.substring(0, 80)}`);
console.log(`   ✓ markdown sem marcador de página — D-09 OK`);

// ─────────────────────────────────────────────────────────────────────────────
// CENÁRIO C: SEM heading ATX inicial (texto puro) → title === null (Pitfall 4)
// ─────────────────────────────────────────────────────────────────────────────
const fixtureC = [
  {
    page_content: 'Capa do documento de concurso público.\n\nSem heading nesta página.',
    metadata: { source: 'prova.pdf', format: 'markdown', page: 1 },
  },
  {
    page_content: 'Mais texto sem heading na segunda página.',
    metadata: { source: 'prova.pdf', format: 'markdown', page: 2 },
  },
];

console.log('\nCenário C: sem heading ATX inicial → title === null (Pitfall 4):');
const docC = normalize(fixtureC, '/home/usuario/prova.pdf');

// Pitfall 4: quando não há heading ATX, title deve ser null (não a primeira linha de texto)
if (docC.title !== null)
  fail(`title = ${JSON.stringify(docC.title)}, esperado null (sem heading ATX — Pitfall 4)`);
console.log(`   ✓ title === null (sem heading ATX — Pitfall 4 fechado)`);

// Deve ter ao menos 1 seção (a seção fallback com o basename do pdf)
if (docC.sections.length < 1)
  fail(`sections.length = ${docC.sections.length}, esperado >= 1 (seção fallback)`);
console.log(`   ✓ sections.length >= 1 (seção fallback com basename do pdf)`);

// numPages correto (max([1,2]) = 2)
if (docC.numPages !== 2)
  fail(`numPages = ${docC.numPages}, esperado 2 (max([1,2]))`);
console.log(`   ✓ numPages === 2`);

// ─────────────────────────────────────────────────────────────────────────────
// SUCESSO
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n✓ assert-langchain-normalize: todos os cenários OK (R1/Pitfall1/Pitfall4/D-07..D-10)');
process.exit(0);
