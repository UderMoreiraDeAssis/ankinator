#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Script para extrair TODAS as questões usando as novas ferramentas session-based
async function extrairTodasQuestoes() {
  const serverPath = path.join(__dirname, 'ankinator-mcp', 'dist', 'index.js');
  const pdfPath = '/home/t316360/plottwist/ankinator/curso-230987-aula-01-grifado-a09d.pdf';

  console.log('🚀 Extração de Questões com Ferramentas Token-Safe\n');
  console.log('='.repeat(80));

  // Passo 1: Iniciar sessão
  console.log('\n📋 Passo 1: Iniciando sessão de extração...');
  console.log('-'.repeat(80));

  const initRequest = {
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: {
      name: 'iniciar_extracao_pdf',
      arguments: {
        path: pdfPath,
        chunk_size: 5,
        overlap: 2,
      }
    }
  };

  const initResult = await callMCP(serverPath, initRequest);

  if (!initResult || !initResult.structuredContent) {
    console.error('❌ Erro ao iniciar sessão');
    process.exit(1);
  }

  const sessionId = initResult.structuredContent.session_id;
  const totalChunks = initResult.structuredContent.total_chunks;
  const promptTemplate = initResult.structuredContent.prompt_template;

  console.log(`✅ Sessão criada: ${sessionId}`);
  console.log(`   Total de chunks: ${totalChunks}`);
  console.log(`   Total de páginas: ${initResult.structuredContent.total_pages}`);

  // Identificar seções baseado nos chunks
  const questoesComentadasStart = 61;
  const listaQuestoesStart = 82;

  console.log(`\n📚 Estrutura do PDF:`);
  console.log(`   - Teoria: chunks 0-60 (páginas 1-186)`);
  console.log(`   - Questões Comentadas: chunks 61-81 (páginas 186-247)`);
  console.log(`   - Lista de Questões: chunks 82-89 (páginas 247-270)`);

  // Passo 2: Extrair chunks das seções de questões
  console.log('\n📦 Passo 2: Extraindo chunks das seções de questões...');
  console.log('-'.repeat(80));

  const allQuestionsChunks = [];

  // Extrair questões comentadas (chunks 61-81)
  console.log('\n🔍 Extraindo Questões Comentadas (chunks 61-81)...');
  for (let start = questoesComentadasStart; start < listaQuestoesStart; start += 5) {
    const chunksRequest = {
      jsonrpc: '2.0',
      id: start + 100,
      method: 'tools/call',
      params: {
        name: 'obter_chunks_pdf',
        arguments: {
          session_id: sessionId,
          start_index: start,
          auto_batch: true,
        }
      }
    };

    const chunksResult = await callMCP(serverPath, chunksRequest);

    if (chunksResult && chunksResult.structuredContent) {
      const chunks = chunksResult.structuredContent.chunks;
      allQuestionsChunks.push(...chunks);
      console.log(`   ✓ Chunks ${start}-${start + chunks.length - 1}: ${chunks.length} chunks (${chunksResult.structuredContent.batch_info.estimated_tokens_used.toLocaleString()} tokens)`);

      if (!chunksResult.structuredContent.batch_info.has_more) {
        break;
      }
    }
  }

  // Extrair lista de questões (chunks 82-89)
  console.log('\n🔍 Extraindo Lista de Questões (chunks 82-89)...');
  const listaRequest = {
    jsonrpc: '2.0',
    id: 200,
    method: 'tools/call',
    params: {
      name: 'obter_chunks_pdf',
      arguments: {
        session_id: sessionId,
        start_index: listaQuestoesStart,
        auto_batch: true,
      }
    }
  };

  const listaResult = await callMCP(serverPath, listaRequest);
  if (listaResult && listaResult.structuredContent) {
    const chunks = listaResult.structuredContent.chunks;
    allQuestionsChunks.push(...chunks);
    console.log(`   ✓ Chunks ${listaQuestoesStart}-${listaQuestoesStart + chunks.length - 1}: ${chunks.length} chunks`);
  }

  console.log(`\n✅ Total de chunks de questões coletados: ${allQuestionsChunks.length}`);

  // Passo 3: Salvar chunks para processamento
  console.log('\n💾 Passo 3: Salvando chunks para processamento...');
  console.log('-'.repeat(80));

  const outputData = {
    metadata: {
      session_id: sessionId,
      pdf_path: pdfPath,
      total_chunks: allQuestionsChunks.length,
      data_extracao: new Date().toISOString(),
      prompt_template: promptTemplate,
    },
    chunks: allQuestionsChunks,
  };

  const outputPath = path.join(__dirname, 'questoes-chunks-para-processar.json');
  fs.writeFileSync(outputPath, JSON.stringify(outputData, null, 2));

  console.log(`✅ Chunks salvos em: ${outputPath}`);
  console.log(`   Total de chunks: ${allQuestionsChunks.length}`);
  console.log(`   Tamanho do arquivo: ${(fs.statSync(outputPath).size / 1024).toFixed(1)} KB`);

  // Passo 4: Processar chunks para extrair questões
  console.log('\n🤖 Passo 4: Processando chunks para extrair questões...');
  console.log('-'.repeat(80));
  console.log(`\n📋 Prompt Template:\n${promptTemplate}\n`);
  console.log('-'.repeat(80));

  const todasQuestoes = [];

  for (let i = 0; i < allQuestionsChunks.length; i++) {
    const chunk = allQuestionsChunks[i];
    console.log(`\n🔄 Processando chunk ${i + 1}/${allQuestionsChunks.length} (Chunk ${chunk.chunk_index}, Págs ${chunk.page_start}-${chunk.page_end})...`);

    // Simular processamento do chunk
    // Em produção, aqui você chamaria Claude via API para processar o chunk
    const questoesDoChunk = extrairQuestoesDoTexto(chunk.texto);

    if (questoesDoChunk.length > 0) {
      console.log(`   ✓ Encontradas ${questoesDoChunk.length} questões`);
      todasQuestoes.push({
        chunk_index: chunk.chunk_index,
        page_range: `${chunk.page_start}-${chunk.page_end}`,
        questoes: questoesDoChunk,
      });
    } else {
      console.log(`   - Nenhuma questão encontrada neste chunk`);
    }
  }

  // Passo 5: Salvar questões extraídas
  console.log('\n💾 Passo 5: Salvando questões extraídas...');
  console.log('-'.repeat(80));

  const questoesOutput = {
    metadata: {
      pdf_path: pdfPath,
      total_chunks_processados: allQuestionsChunks.length,
      total_questoes_encontradas: todasQuestoes.reduce((sum, c) => sum + c.questoes.length, 0),
      data_processamento: new Date().toISOString(),
    },
    chunks_com_questoes: todasQuestoes,
  };

  const questoesPath = path.join(__dirname, 'questoes-extraidas-session.json');
  fs.writeFileSync(questoesPath, JSON.stringify(questoesOutput, null, 2));

  console.log(`✅ Questões salvas em: ${questoesPath}`);
  console.log(`   Total de questões: ${questoesOutput.metadata.total_questoes_encontradas}`);

  // Resumo final
  console.log('\n' + '='.repeat(80));
  console.log('✅ EXTRAÇÃO COMPLETA!');
  console.log('='.repeat(80));
  console.log(`\n📊 Resumo:`);
  console.log(`   - Chunks processados: ${allQuestionsChunks.length}`);
  console.log(`   - Chunks com questões: ${todasQuestoes.length}`);
  console.log(`   - Total de questões: ${questoesOutput.metadata.total_questoes_encontradas}`);
  console.log(`\n📁 Arquivos gerados:`);
  console.log(`   1. ${outputPath}`);
  console.log(`   2. ${questoesPath}`);
  console.log(`\n💡 Próximo passo:`);
  console.log(`   Use Claude para processar cada chunk em questoes-chunks-para-processar.json`);
  console.log(`   seguindo o prompt_template fornecido.`);
  console.log('');
}

// Função simples para identificar questões no texto
function extrairQuestoesDoTexto(texto) {
  const questoes = [];

  // Padrões comuns de questões
  const padroes = [
    /\d+\.\s*\([A-Z]+\s*-\s*\d{4}\)/g,  // Ex: 1. (FCC - 2020)
    /Questão\s+\d+/gi,
    /\d+\)\s*[A-E]\)/g,  // Ex: 1) A)
  ];

  for (const padrao of padroes) {
    const matches = texto.match(padrao);
    if (matches) {
      matches.forEach(match => {
        if (!questoes.some(q => q.texto.includes(match))) {
          questoes.push({
            tipo: '[EXTRAÍDA]',
            texto: match,
            preview: texto.substring(texto.indexOf(match), texto.indexOf(match) + 200),
          });
        }
      });
    }
  }

  return questoes;
}

function callMCP(serverPath, request) {
  return new Promise((resolve, reject) => {
    const mcpProcess = spawn('node', [serverPath], {
      stdio: ['pipe', 'pipe', 'inherit'],
      env: { ...process.env }
    });

    let stdout = '';

    mcpProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    mcpProcess.on('close', (code) => {
      try {
        const lines = stdout.split('\n').filter(line => line.trim());
        const response = JSON.parse(lines[lines.length - 1]);

        if (response.result) {
          resolve(response.result);
        } else if (response.error) {
          console.error('MCP Error:', response.error);
          resolve(null);
        }
      } catch (e) {
        console.error('Parse error:', e.message);
        console.error('Output:', stdout);
        resolve(null);
      }
    });

    mcpProcess.stdin.write(JSON.stringify(request) + '\n');
    mcpProcess.stdin.end();
  });
}

// Executar extração
extrairTodasQuestoes()
  .then(() => {
    console.log('🎉 Script concluído com sucesso!');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Erro fatal:', error);
    process.exit(1);
  });
