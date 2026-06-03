#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Script simples para processar chunks diretamente do arquivo JSONL
async function processarChunksQuestoes() {
  console.log('🚀 Processamento de Chunks de Questões\n');
  console.log('='.repeat(80));

  // Encontrar o arquivo de sessão mais recente
  const chunksDir = path.join(__dirname, 'ankinator-mcp', 'chunk-sessions');
  const files = fs.readdirSync(chunksDir).filter(f => f.endsWith('.jsonl'));

  if (files.length === 0) {
    console.error('❌ Nenhum arquivo de sessão encontrado!');
    process.exit(1);
  }

  // Pegar o arquivo mais recente
  const latestFile = files.sort((a, b) => {
    const statA = fs.statSync(path.join(chunksDir, a));
    const statB = fs.statSync(path.join(chunksDir, b));
    return statB.mtimeMs - statA.mtimeMs;
  })[0];

  const sessionFile = path.join(chunksDir, latestFile);
  console.log(`📁 Usando arquivo de sessão: ${latestFile}`);
  console.log(`   Tamanho: ${(fs.statSync(sessionFile).size / 1024).toFixed(1)} KB\n`);

  // Ler todos os chunks
  const content = fs.readFileSync(sessionFile, 'utf-8');
  const lines = content.split('\n').filter(l => l.trim());
  const allChunks = lines.map(line => JSON.parse(line));

  console.log(`✅ Total de chunks carregados: ${allChunks.length}\n`);

  // Identificar seções de questões
  const questoesComentadasStart = 61;
  const listaQuestoesStart = 82;

  console.log(`📚 Seções do PDF:`);
  console.log(`   - Questões Comentadas: chunks ${questoesComentadasStart}-${listaQuestoesStart - 1}`);
  console.log(`   - Lista de Questões: chunks ${listaQuestoesStart}-${allChunks.length - 1}\n`);

  // Filtrar apenas chunks de questões
  const questoesChunks = allChunks.filter(chunk =>
    chunk.chunk_index >= questoesComentadasStart
  );

  console.log(`📦 Chunks de questões: ${questoesChunks.length}\n`);
  console.log('-'.repeat(80));

  // Processar cada chunk
  const todasQuestoes = [];

  for (let i = 0; i < questoesChunks.length; i++) {
    const chunk = questoesChunks[i];
    console.log(`\n🔄 Processando chunk ${i + 1}/${questoesChunks.length}`);
    console.log(`   Chunk ${chunk.chunk_index}: Págs ${chunk.page_start}-${chunk.page_end}, ${chunk.num_chars.toLocaleString()} chars`);

    // Extrair questões do texto
    const questoesEncontradas = extrairQuestoesDoTexto(chunk.texto);

    if (questoesEncontradas.length > 0) {
      console.log(`   ✓ ${questoesEncontradas.length} questões encontradas`);
      todasQuestoes.push({
        chunk_index: chunk.chunk_index,
        page_range: `${chunk.page_start}-${chunk.page_end}`,
        questoes: questoesEncontradas,
      });
    } else {
      console.log(`   - Nenhuma questão detectada`);
    }
  }

  // Salvar resultado
  console.log('\n' + '='.repeat(80));
  console.log('💾 Salvando resultados...\n');

  const totalQuestoes = todasQuestoes.reduce((sum, c) => sum + c.questoes.length, 0);

  const output = {
    metadata: {
      session_file: latestFile,
      pdf_path: '/home/t316360/plottwist/ankinator/curso-230987-aula-01-grifado-a09d.pdf',
      total_chunks_processados: questoesChunks.length,
      total_chunks_com_questoes: todasQuestoes.length,
      total_questoes_encontradas: totalQuestoes,
      data_processamento: new Date().toISOString(),
    },
    prompt_template: `Analise o seguinte trecho do PDF de estudo para concursos (PMBOK 6):

INSTRUÇÕES:
1. EXTRAIA questões de concurso que já existem no texto (mantenha fielmente enunciado e gabarito)
   - Prefixe com [EXTRAÍDA]
   - Mantenha banca, ano e instituição se houver

2. CRIE novas questões de estudo baseadas nos conceitos apresentados
   - Prefixe com [CRIADA]
   - Foque em conceitos-chave que cairiam em concursos públicos
   - Varie níveis de dificuldade (básico, intermediário, avançado)

FORMATO de saída:
Q: [texto da questão]
A: [resposta/gabarito]`,
    chunks_com_questoes: todasQuestoes,
  };

  const outputPath = path.join(__dirname, 'questoes-identificadas.json');
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));

  console.log(`✅ Resultados salvos em: ${outputPath}`);
  console.log(`   Tamanho do arquivo: ${(fs.statSync(outputPath).size / 1024).toFixed(1)} KB\n`);

  // Resumo
  console.log('='.repeat(80));
  console.log('✅ PROCESSAMENTO COMPLETO!\n');
  console.log(`📊 Resumo:`);
  console.log(`   - Chunks processados: ${questoesChunks.length}`);
  console.log(`   - Chunks com questões detectadas: ${todasQuestoes.length}`);
  console.log(`   - Total de questões identificadas: ${totalQuestoes}\n`);

  console.log(`💡 Próximos passos:`);
  console.log(`   1. Revisar as questões identificadas em ${outputPath}`);
  console.log(`   2. Usar Claude para processar cada chunk seguindo o prompt_template`);
  console.log(`   3. Gerar questões adicionais baseadas nos conceitos`);
  console.log(`   4. Converter para CSV e importar no Anki\n`);

  // Mostrar amostra
  if (todasQuestoes.length > 0) {
    console.log('📋 Amostra das primeiras questões encontradas:\n');
    const primeiroChunk = todasQuestoes[0];
    console.log(`Chunk ${primeiroChunk.chunk_index} (páginas ${primeiroChunk.page_range}):`);
    primeiroChunk.questoes.slice(0, 3).forEach((q, idx) => {
      console.log(`   ${idx + 1}. ${q.tipo} ${q.texto.substring(0, 60)}...`);
    });
    console.log('');
  }
}

// Função para identificar questões no texto
function extrairQuestoesDoTexto(texto) {
  const questoes = [];

  // Padrões para identificar questões
  const padroes = [
    {
      regex: /\d+\.\s*\([A-Z]+\s*[-–]\s*\d{4}\)/g,
      tipo: '[EXTRAÍDA]',
      nome: 'Banca+Ano'
    },
    {
      regex: /Questão\s+\d+/gi,
      tipo: '[EXTRAÍDA]',
      nome: 'Questão numerada'
    },
    {
      regex: /\d+\)\s*[A-E]\)/g,
      tipo: '[EXTRAÍDA]',
      nome: 'Múltipla escolha'
    },
    {
      regex: /QUESTÃO\s+\d+/g,
      tipo: '[EXTRAÍDA]',
      nome: 'Questão maiúscula'
    },
  ];

  for (const padrao of padroes) {
    const matches = Array.from(texto.matchAll(padrao.regex));
    matches.forEach(match => {
      const textoMatch = match[0];
      const posicao = match.index;

      // Extrair contexto (200 chars antes e depois)
      const inicio = Math.max(0, posicao - 50);
      const fim = Math.min(texto.length, posicao + 250);
      const contexto = texto.substring(inicio, fim);

      // Verificar se já não temos essa questão
      if (!questoes.some(q => q.texto === textoMatch)) {
        questoes.push({
          tipo: padrao.tipo,
          texto: textoMatch,
          pattern: padrao.nome,
          contexto: contexto,
          posicao: posicao,
        });
      }
    });
  }

  // Ordenar por posição no texto
  questoes.sort((a, b) => a.posicao - b.posicao);

  return questoes;
}

// Executar
processarChunksQuestoes()
  .catch(error => {
    console.error('❌ Erro:', error);
    process.exit(1);
  });
