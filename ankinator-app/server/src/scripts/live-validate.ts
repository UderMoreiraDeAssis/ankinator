/**
 * Driver de VALIDAÇÃO AO VIVO (Destino #4 — orquestrador por-card).
 *
 * Roda o pipeline REAL end-to-end contra um PDF, com o modo ORQUESTRADO ligado
 * (`ANKINATOR_ORCHESTRATED=1`), e exporta ao Anki com subdeck aninhado — espelhando
 * o /generate + /export/ankiconnect do `api.ts` (mesmos defaults/knobs via `config`).
 *
 * NÃO é um teste mockado: exercita `claude -p --agent` + Task (subagents) na assinatura.
 *
 * Uso:
 *   ANKINATOR_ORCHESTRATED=1 ANKINATOR_PDF_LOADER=node \
 *     tsx src/scripts/live-validate.ts <pdf> [deck=AnkinatorTeste] [maxSecoes=2] [maxPerChunk=6]
 */
import { config } from '../config.js';
import { loadDocument } from '../core/document-loader.js';
import { chunkDocument } from '../core/chunker.js';
import { generateAll } from '../core/generation.js';
import { deveRodarEnrich } from '../core/specialists/enrich.js';
import { runEnrich } from '../core/specialists/orchestrator.js';
import { createProvider } from '../core/providers/index.js';
import { pushToAnki } from '../core/exporters/ankiconnect.js';
import type { GenerateOptions } from '../core/types.js';

const pdf = process.argv[2];
const deck = process.argv[3] || 'AnkinatorTeste';
const secArg = process.argv[4] || '4,5'; // índices de seção (csv), p.ex. "4,5"
const maxPerChunk = Number(process.argv[5] || 6);
if (!pdf) {
  console.error('Uso: live-validate <pdf> [deck] [secoesCsv="4,5"] [maxPerChunk]');
  process.exit(1);
}
const secIdxs = secArg.split(',').map((n) => parseInt(n.trim(), 10)).filter((n) => !isNaN(n));

const t0 = Date.now();
console.log(`[live] PDF=${pdf}`);
console.log(`[live] deck=${deck} secoes=${secArg} maxPerChunk=${maxPerChunk} ORQUESTRADO=${config.orchestrated} loader=${config.pdfLoader}`);

const doc = await loadDocument(pdf);
console.log(`[live] doc: ${doc.fileName} · ${doc.numPages}p · ${doc.sections.length} seções · ${doc.markdown.length} chars`);
const chosen = secIdxs.map((i) => doc.sections[i]).filter((s): s is (typeof doc.sections)[number] => !!s);
const sectionIds = chosen.map((s) => s.id);
console.log(`[live] seções escolhidas (idx ${secIdxs.join(',')}): ${chosen.map((s) => `"${s.title}"(${s.charCount}c)`).join(', ')}`);
const chunks = chunkDocument(doc, { selectedSectionIds: sectionIds, overlapChars: config.chunkOverlap });
console.log(`[live] ${chunks.length} bloco(s)`);

const provider = createProvider({
  kind: config.provider,
  apiKey: config.anthropicKey,
  apiModel: config.model,
  cliModel: config.cliModel,
  cliDisableThinking: config.generationDisableThinking,
  criadaFidelityLivre: config.criadaFidelityLivre,
});

const genOptions: GenerateOptions = {
  maxPerChunk,
  incluirExtraidas: true,
  incluirCriadas: true,
  classificar: true,
  cardBuilder: true,
  mnemonico: true,
  imagem: true,
};

console.log('[live] === GERAÇÃO ===');
const result = await generateAll(provider, chunks, genOptions, (p) =>
  console.log(`[gen] bloco ${p.index + 1}/${p.total}: ${p.questoesNoBloco} questões`),
);
let questoes = result.questoes;
console.log(`[live] geração: ${questoes.length} questões, ${result.erros.length} erro(s)`);
for (const e of result.erros) console.log(`[gen][ERRO] bloco ${e.chunkIndex}: ${e.mensagem}`);

const enrichOpts = {
  classificar: true,
  cardBuilder: true,
  mnemonico: true,
  imagem: true,
  imageConcurrency: config.imageConcurrency,
  cardBuilderConcurrency: config.cardBuilderConcurrency,
  imageQuality: config.imageQuality,
  imageMaxRetry: config.imageMaxRetry,
  imageSelective: config.imageSelective,
  imageSkipTecnicas: config.imageSkipTecnicas.length ? config.imageSkipTecnicas : undefined,
  cardBuilderMaxSplit: config.cardBuilderMaxSplit,
  orchestrated: config.orchestrated,
};

console.log('[live] === ENRIQUECIMENTO (runEnrich) ===');
if (questoes.length && deveRodarEnrich(enrichOpts)) {
  questoes = await runEnrich(questoes, enrichOpts, (ev) =>
    console.log(`[enrich] ${ev.estagio} ${ev.index}/${ev.total}`),
  );
}

const comDeck = questoes.filter((q) => q.deck).length;
const comTags = questoes.filter((q) => q.tags && q.tags.length).length;
const comMnem = questoes.filter((q) => q.mnemonico).length;
const comSvg = questoes.filter((q) => q.mnemonicoSvg).length;
console.log(`[live] ENRIQUECIDO: deck=${comDeck} tags=${comTags} mnem=${comMnem} svg=${comSvg} de ${questoes.length} cards`);

console.log('[live] === AMOSTRA (3 cards) ===');
for (const q of questoes.slice(0, 3)) {
  console.log(`\n--- [${q.tipo}] id=${q.id} ---`);
  console.log(`P: ${q.pergunta}`);
  console.log(`R: ${String(q.resposta).replace(/<[^>]+>/g, ' ').slice(0, 220)}`);
  console.log(`deck: ${q.deck ?? '(sem)'}`);
  console.log(`tags: ${(q.tags || []).join(' | ') || '(sem)'}`);
  console.log(`mnem: ${q.mnemonico ?? '(sem)'}`);
  console.log(`svg : ${q.mnemonicoSvg ? `${q.mnemonicoSvg.length}c` : '(sem)'}`);
}

console.log('\n[live] === EXPORT AO ANKI (nestUnderDeck) ===');
const push = await pushToAnki(questoes, {
  deck,
  fonte: doc.fileName,
  nestUnderDeck: true,
  url: config.ankiconnectUrl,
});
console.log(`[live] PUSH: ${JSON.stringify(push)}`);

console.log(`\n[live] FIM · ${((Date.now() - t0) / 1000).toFixed(1)}s`);
