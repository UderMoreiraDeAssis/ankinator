/**
 * Smoke-test do DocumentLoader.
 * Uso: tsx src/scripts/smoke-loader.ts <caminho.pdf>
 */
import { loadDocument } from '../core/document-loader.js';

const pdf = process.argv[2];
if (!pdf) {
  console.error('Uso: smoke-loader <caminho.pdf>');
  process.exit(1);
}

const t0 = Date.now();
const doc = await loadDocument(pdf);
const ms = Date.now() - t0;

console.log('=== DocumentLoader smoke ===');
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
