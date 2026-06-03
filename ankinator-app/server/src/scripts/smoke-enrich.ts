/**
 * Smoke-test do enrich pipeline (especialistas deck-classifier + card-builder).
 * Uso: tsx src/scripts/smoke-enrich.ts            (dev — exercita CLI no passo 3)
 *      tsx src/scripts/smoke-enrich.ts --assert-args  (CI — CLI-free, passos 1+2)
 *
 * PASSOS:
 *  (1) loadPrompt('deck-classifier') + loadPrompt('card-builder') — valida resolução
 *      .md cross-mode (Pitfall 1). CLI-free: SEM spawnar o claude.
 *  (2) parseClassificacoesJson com fixture CLI-free — valida parser tolerante sem
 *      depender do LLM. CLI-free.
 *  (3) enrichAll real com cards de fixture + PDF real — EXERCITA o CLI. Só roda
 *      quando SEM --assert-args. Requer `claude` instalado e com assinatura ativa.
 *
 * FLAG `--assert-args`: roda SÓ passos 1+2 (CLI-free) e sai 0 — permite usar como
 *   gate offline sem quota/rede, análogo a smoke-runner.ts --assert-args.
 *
 * Estado Wave 0: VERMELHO até que enrich.ts e prompt-loader.ts conheçam
 *   'deck-classifier' e 'card-builder'. Corrido após Plano 01.
 */
import { loadPrompt } from '../core/specialists/prompt-loader.js';
import { parseClassificacoesJson, enrichAll } from '../core/specialists/enrich.js';
import type { Questao } from '../core/types.js';

// ── PASSO 1: loadPrompt dos 2 especialistas de enrich (valida Pitfall 1 cross-mode) ──
console.log('1) loadPrompt dos especialistas de enrich:');
const promptClassificador = loadPrompt('deck-classifier');
console.log(`   ✓ deck-classifier.md (${promptClassificador.length}c)`);
const promptCardBuilder = loadPrompt('card-builder');
console.log(`   ✓ card-builder.md (${promptCardBuilder.length}c)`);

// ── PASSO 2: parseClassificacoesJson com fixture CLI-free ─────────────────────
console.log('\n2) parseClassificacoesJson com fixture (CLI-free):');

const FIXTURE_LIMPO = '{"classificacoes":[{"id":"test-01","deck":"Matéria::Assunto","tags":["tag1","tag2"]}]}';
const resultLimpo = parseClassificacoesJson(FIXTURE_LIMPO);
if (!Array.isArray(resultLimpo) || resultLimpo.length !== 1) {
  console.error('   ✗ FALHA: parseClassificacoesJson não retornou 1 elemento para fixture limpo');
  process.exit(1);
}
if (resultLimpo[0].id !== 'test-01' || resultLimpo[0].deck !== 'Matéria::Assunto') {
  console.error(`   ✗ FALHA: parseClassificacoesJson retornou estrutura incorreta: ${JSON.stringify(resultLimpo[0])}`);
  process.exit(1);
}
console.log(`   ✓ JSON limpo: id="${resultLimpo[0].id}", deck="${resultLimpo[0].deck}", tags=${JSON.stringify(resultLimpo[0].tags)}`);

const FIXTURE_FENCED = '```json\n{"classificacoes":[]}\n```';
const resultFenced = parseClassificacoesJson(FIXTURE_FENCED);
if (!Array.isArray(resultFenced) || resultFenced.length !== 0) {
  console.error(`   ✗ FALHA: parseClassificacoesJson não retornou [] para fixture cercado vazio`);
  process.exit(1);
}
console.log('   ✓ JSON com cercas ```json: [] retornado corretamente para lista vazia.');

// ── Modo CLI-free `--assert-args`: sai 0 antes do passo 3 ────────────────────
if (process.argv.includes('--assert-args')) {
  console.log('\n--assert-args: passos 1+2 OK (CLI-free); passo 3 (CLI) pulado por design. Smoke PIPE-03 verde.');
  process.exit(0);
}

// ── PASSO 3: enrichAll real com cards de fixture (EXERCITA o CLI) ─────────────
console.log('\n3) enrichAll real com cards de fixture (exercita o claude CLI):');

const CARDS_FIXTURE: Questao[] = [
  {
    id: 'test-01',
    tipo: 'criada',
    pergunta: 'O que é a Lei de Licitações?',
    resposta: 'A Lei nº 14.133/2021 regula licitações e contratos administrativos no Brasil.',
    pageStart: 1,
    pageEnd: 1,
  },
];

const t0 = Date.now();
const enriched = await enrichAll(CARDS_FIXTURE, { classificar: true, cardBuilder: false }, (e) => {
  console.log(`   → ${e.estagio} card ${e.index + 1}/${e.total}${e.erro ? ` (erro: ${e.erro})` : ''}`);
});
console.log(`   ✓ enrichAll retornou ${enriched.length} card(s) em ${((Date.now() - t0) / 1000).toFixed(1)}s`);
if (enriched[0]?.deck) {
  console.log(`   ✓ deck classificado: "${enriched[0].deck}"`);
}
