#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Carrega os chunks
const chunksFile = path.join(__dirname, 'chunks-completos.json');
const chunksData = JSON.parse(fs.readFileSync(chunksFile, 'utf8'));

console.log(`📚 Total de chunks: ${chunksData.chunks.length}\n`);

// Divide em seções baseado no índice do PDF
const sections = {
  'questoes_comentadas': {
    start: 61,  // Página 186 ≈ chunk 61
    end: 82,    // Até página ~247
    description: 'Questões Comentadas (págs 186-247)'
  },
  'lista_questoes': {
    start: 82,  // Página 247
    end: 90,    // Fim do PDF
    description: 'Lista de Questões (págs 247-270)'
  },
  'teoria': {
    start: 0,
    end: 61,
    description: 'Conteúdo Teórico (págs 1-186)'
  }
};

// Salva chunks por seção para facilitar processamento
for (const [sectionName, config] of Object.entries(sections)) {
  const sectionChunks = chunksData.chunks.slice(config.start, config.end);

  const outputFile = path.join(__dirname, `chunks-${sectionName}.json`);
  fs.writeFileSync(outputFile, JSON.stringify({
    section: sectionName,
    description: config.description,
    total_chunks: sectionChunks.length,
    chunks: sectionChunks
  }, null, 2));

  console.log(`✅ ${config.description}`);
  console.log(`   Chunks ${config.start}-${config.end - 1}: ${sectionChunks.length} chunks`);
  console.log(`   Salvo em: ${outputFile}\n`);
}

console.log('📊 Estatísticas:');
console.log(`   - Questões Comentadas: ${sections.questoes_comentadas.end - sections.questoes_comentadas.start} chunks`);
console.log(`   - Lista de Questões: ${sections.lista_questoes.end - sections.lista_questoes.start} chunks`);
console.log(`   - Teoria: ${sections.teoria.end - sections.teoria.start} chunks`);
console.log('\n✅ Chunks organizados por seção!');
