/**
 * Smoke-test do provedor CLI (geração via assinatura, sem API key).
 * Uso: tsx src/scripts/smoke-cli.ts <caminho.pdf>
 */
import { loadDocument } from '../core/document-loader.js';
import { chunkDocument } from '../core/chunker.js';
import { CliProvider } from '../core/providers/cli-provider.js';

const pdf = process.argv[2];
if (!pdf) {
  console.error('Uso: smoke-cli <caminho.pdf>');
  process.exit(1);
}

const doc = await loadDocument(pdf);
const chunks = chunkDocument(doc);
console.log(`Documento: ${doc.fileName} · ${chunks.length} bloco(s)`);

const provider = new CliProvider('sonnet');
console.log('Chamando o claude CLI (assinatura)…');
const t0 = Date.now();
const questoes = await provider.generateForChunk(chunks[0], { maxPerChunk: 6, incluirExtraidas: true, incluirCriadas: true });
console.log(`\n✅ ${questoes.length} questões em ${((Date.now() - t0) / 1000).toFixed(1)}s\n`);
for (const q of questoes) {
  console.log(`[${q.tipo}] Q: ${q.pergunta}`);
  console.log(`         A: ${q.resposta}`);
  if (q.metadata?.banca) console.log(`         (${q.metadata.banca}${q.metadata.ano ? ' ' + q.metadata.ano : ''})`);
  console.log();
}
