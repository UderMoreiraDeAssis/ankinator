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
import { parseClassificacoesJson, parseMnemonicosJson, enrichAll } from '../core/specialists/enrich.js';
import { sanitizarSvg } from '../core/specialists/sanitize-svg.js';
import type { Questao } from '../core/types.js';

// ── PASSO 1: loadPrompt dos especialistas de enrich (valida Pitfall 1 cross-mode) ──
// D-14: inclui especialistas Phase 4 (mnemonic + mnemonic-image) além dos originais
console.log('1) loadPrompt dos especialistas de enrich:');
const promptClassificador = loadPrompt('deck-classifier');
console.log(`   ✓ deck-classifier.md (${promptClassificador.length}c)`);
const promptCardBuilder = loadPrompt('card-builder');
console.log(`   ✓ card-builder.md (${promptCardBuilder.length}c)`);
const promptMnemonic = loadPrompt('mnemonic');
console.log(`   ✓ mnemonic.md (${promptMnemonic.length}c)`);
const promptMnemonicImage = loadPrompt('mnemonic-image');
console.log(`   ✓ mnemonic-image.md (${promptMnemonicImage.length}c)`);

// ── PASSO 2: parsers com fixtures CLI-free ────────────────────────────────────
// D-14: valida parseClassificacoesJson E parseMnemonicosJson (cross-mode)
console.log('\n2) parsers com fixtures (CLI-free):');

const FIXTURE_CLASSIFICACOES_LIMPO = '{"classificacoes":[{"id":"test-01","deck":"Matéria::Assunto","tags":["tag1","tag2"]}]}';
const resultClassif = parseClassificacoesJson(FIXTURE_CLASSIFICACOES_LIMPO);
if (!Array.isArray(resultClassif) || resultClassif.length !== 1) {
  console.error('   ✗ FALHA: parseClassificacoesJson não retornou 1 elemento para fixture limpo');
  process.exit(1);
}
if (resultClassif[0].id !== 'test-01' || resultClassif[0].deck !== 'Matéria::Assunto') {
  console.error(`   ✗ FALHA: parseClassificacoesJson retornou estrutura incorreta: ${JSON.stringify(resultClassif[0])}`);
  process.exit(1);
}
console.log(`   ✓ parseClassificacoesJson JSON limpo: id="${resultClassif[0].id}", deck="${resultClassif[0].deck}"`);

const FIXTURE_CLASSIFICACOES_FENCED = '```json\n{"classificacoes":[]}\n```';
const resultFenced = parseClassificacoesJson(FIXTURE_CLASSIFICACOES_FENCED);
if (!Array.isArray(resultFenced) || resultFenced.length !== 0) {
  console.error(`   ✗ FALHA: parseClassificacoesJson não retornou [] para fixture cercado vazio`);
  process.exit(1);
}
console.log('   ✓ parseClassificacoesJson JSON com cercas: [] retornado corretamente para lista vazia.');

// parseMnemonicosJson — valida formato batch da Phase 4 (D-14)
const FIXTURE_MNEMONICOS_LIMPO = '{"mnemonicos":[{"id":"test-01","mnemonico":"LAMP = Lei, Art, Multa, Prazo","tecnica":"acrônimo"}]}';
const resultMnem = parseMnemonicosJson(FIXTURE_MNEMONICOS_LIMPO);
if (!Array.isArray(resultMnem) || resultMnem.length !== 1) {
  console.error(`   ✗ FALHA: parseMnemonicosJson não retornou 1 elemento para fixture limpo`);
  process.exit(1);
}
if (resultMnem[0].id !== 'test-01' || !resultMnem[0].mnemonico) {
  console.error(`   ✗ FALHA: parseMnemonicosJson retornou estrutura incorreta: ${JSON.stringify(resultMnem[0])}`);
  process.exit(1);
}
console.log(`   ✓ parseMnemonicosJson JSON limpo: id="${resultMnem[0].id}", mnemonico="${resultMnem[0].mnemonico?.slice(0, 20)}..."`);

const FIXTURE_MNEMONICOS_FENCED = '```json\n{"mnemonicos":[{"id":"test-02","mnemonico":"RGA = Retém, Guarda, Aplica","tecnica":"acrônimo"}]}\n```';
const resultMnemFenced = parseMnemonicosJson(FIXTURE_MNEMONICOS_FENCED);
if (!Array.isArray(resultMnemFenced) || resultMnemFenced.length !== 1) {
  console.error(`   ✗ FALHA: parseMnemonicosJson não retornou 1 elemento para fixture com cercas`);
  process.exit(1);
}
console.log(`   ✓ parseMnemonicosJson JSON com cercas: id="${resultMnemFenced[0].id}" OK.`);

// ── PASSO 3: sanitizarSvg com fixtures CLI-free (D-14) ───────────────────────
// Valida o filtro fail-closed sem spawnar o claude
console.log('\n3) sanitizarSvg com fixtures (CLI-free):');

const SVG_VALIDO = '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><circle cx="50" cy="50" r="40" fill="blue"/></svg>';
const svgLimpo = sanitizarSvg(SVG_VALIDO);
if (!svgLimpo || !svgLimpo.startsWith('<svg')) {
  console.error(`   ✗ FALHA: sanitizarSvg retornou null para SVG geométrico válido`);
  process.exit(1);
}
console.log(`   ✓ sanitizarSvg SVG válido → não-null (${svgLimpo.length}c), começa com <svg.`);

// DOMPurify sanitiza removendo <script> da allowlist — o resultado inicia com <svg mas sem script
// D-08/D-07: <script> não está em SVG_TAGS → removido pelo allowlist estrito
const SVG_COM_SCRIPT = '<svg xmlns="http://www.w3.org/2000/svg"><script>alert("xss")</script><rect width="50" height="50"/></svg>';
const svgSanitizado = sanitizarSvg(SVG_COM_SCRIPT);
// Resultado: DOMPurify remove <script> via allowlist; pode retornar null se nada restar,
// ou SVG limpo sem o <script>. Em ambos os casos, o <script> NÃO deve aparecer no output.
if (svgSanitizado !== null && svgSanitizado.includes('<script>')) {
  console.error(`   ✗ FALHA: sanitizarSvg deixou <script> no SVG sanitizado (violação D-07/D-08)`);
  process.exit(1);
}
// Entrada não-SVG pura deve retornar null (fail-closed para não-SVG)
const entradaNaoSvg = '<div>não é SVG</div>';
const resultNaoSvg = sanitizarSvg(entradaNaoSvg);
if (resultNaoSvg !== null) {
  console.error(`   ✗ FALHA: sanitizarSvg deveria retornar null para entrada não-SVG (fail-closed D-08)`);
  process.exit(1);
}
console.log(`   ✓ sanitizarSvg SVG com <script> → <script> removido (allowlist D-07).`);
console.log(`   ✓ sanitizarSvg entrada não-SVG → null (fail-closed D-08).`);

// ── Modo CLI-free '--assert-args': sai 0 antes do passo 4 ────────────────────
if (process.argv.includes('--assert-args')) {
  console.log('\n--assert-args: passos 1+2+3 OK (CLI-free); passo 4 (CLI) pulado por design. Smoke PIPE-03 verde.');
  process.exit(0);
}

// ── PASSO 4: enrichAll real com cards de fixture (EXERCITA o CLI) ─────────────
// D-14: inclui mnemonico=true + imagem=true para exercitar estágios 3+4 (Phase 4)
console.log('\n4) enrichAll real com cards de fixture (exercita o claude CLI — mnemonico+imagem):');

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
const enriched = await enrichAll(CARDS_FIXTURE, { classificar: true, cardBuilder: false, mnemonico: true, imagem: true }, (e) => {
  console.log(`   → ${e.estagio} card ${e.index + 1}/${e.total}${e.erro ? ` (erro: ${e.erro})` : ''}`);
});
console.log(`   ✓ enrichAll retornou ${enriched.length} card(s) em ${((Date.now() - t0) / 1000).toFixed(1)}s`);
if (enriched[0]?.deck) {
  console.log(`   ✓ deck classificado: "${enriched[0].deck}"`);
}
if (enriched[0]?.mnemonico) {
  console.log(`   ✓ mnemônico gerado: "${enriched[0].mnemonico.slice(0, 60)}..."`);
}
if (enriched[0]?.mnemonicoSvg) {
  console.log(`   ✓ SVG gerado e sanitizado: ${enriched[0].mnemonicoSvg.length}c`);
  console.log('\n─── PASSO 5 HUMANO (IMG-03) ─────────────────────────────────────────────');
  console.log('Para confirmar o render no Anki desktop (IMG-03):');
  console.log('  1. Com Anki desktop aberto + add-on AnkiConnect instalado,');
  console.log('     importe o card acima via AnkiConnect ou CSV.');
  console.log('  2. Abra o card e confirme que o SVG renderiza como imagem');
  console.log('     (não como texto <svg...> nem em branco).');
  console.log('  3. Se falhar: reportar como gatilho de revisão D-09 (fallback data-URI).');
  console.log('─────────────────────────────────────────────────────────────────────────');
} else {
  console.log('   ℹ mnemonicoSvg ausente (imagem=true requer q.mnemonico primeiro — pode ser fail-soft)');
}
