/**
 * Smoke-test gated do loader LangChain (D-14).
 *
 * Gated: se isLangchainAvailable() retornar false, o smoke é pulado graciosamente
 * (exit 0) — CI-safe, sem falha em ambientes sem Python/langchain instalado.
 *
 * Quando o ambiente está pronto (Python + langchain_opendataloader_pdf + Java 11+),
 * este smoke exercita o caminho LangChain real. Pitfall 2: ausência de Java 11+ no
 * PATH causa code != 0 no sidecar → o erro PROPAGA (D-04). O smoke REVELA isso em
 * runtime (stderr com `java`/`ClassNotFound`) — não mascara.
 *
 * Confirma as Open Questions A1/A2/A3 quando rodado com PDF real + venv + Java:
 *   A1: SIDECAR_SCRIPT resolvido cross-mode (tsx src/ e node dist/)
 *   A2: JSON output do sidecar parsável (normalize produz LoadedDocument correto)
 *   A3: numPages, seções, elementos e markdown não-vazios
 *
 * Uso:
 *   tsx src/scripts/smoke-langchain-loader.ts <caminho.pdf>
 */
import { isLangchainAvailable } from '../core/langchain-loader.js';
import { loadDocument } from '../core/document-loader.js';

const pdf = process.argv[2];
if (!pdf) {
  console.error('Uso: smoke-langchain-loader <caminho.pdf>');
  process.exit(1);
}

// D-14: gate de disponibilidade — smoke opt-in, não falha o CI
if (!(await isLangchainAvailable())) {
  console.log('langchain indisponível — smoke pulado.');
  process.exit(0);
}

// Forçar o caminho LangChain: definir ANKINATOR_PDF_LOADER antes de loadDocument.
// loadDocument verifica process.env.ANKINATOR_PDF_LOADER === 'langchain' (D-03).
process.env.ANKINATOR_PDF_LOADER = 'langchain';

console.log('=== Smoke LangChain Loader ===');
console.log('PDF:', pdf);

const t0 = Date.now();
// D-04: qualquer erro (Java ausente, JSON malformado, etc.) PROPAGA via throw.
// O smoke não captura — o erro aparece em stderr como stack trace, revelando a causa.
const doc = await loadDocument(pdf);
const ms = Date.now() - t0;

console.log('arquivo:', doc.fileName);
console.log('páginas:', doc.numPages);
console.log('seções:', doc.sections.length);
console.log('elementos:', doc.elements.length);
console.log('markdown (chars):', doc.markdown.length);
console.log('tempo (ms):', ms);
console.log('\n--- seções ---');
for (const s of doc.sections.slice(0, 10)) {
  console.log(`• [p.${s.pageStart}-${s.pageEnd}] (${s.charCount}c) ${s.title.slice(0, 60)}`);
}
console.log('\n--- preview markdown (600c) ---');
console.log(doc.markdown.slice(0, 600));
