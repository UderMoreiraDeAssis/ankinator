#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Script para extrair TODAS as questões do PDF usando a ferramenta iterativa
async function extrairQuestoesCompleto() {
  const serverPath = path.join(__dirname, 'ankinator-mcp', 'dist', 'index.js');
  const pdfPath = '/home/t316360/plottwist/ankinator/curso-230987-aula-01-grifado-a09d.pdf';

  let currentChunk = 0;
  let iteration = 1;
  const allChunks = [];
  const allQuestions = [];

  console.log('🚀 Iniciando extração COMPLETA de questões do PDF...\n');
  console.log(`📄 PDF: ${pdfPath}\n`);

  while (true) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`🔄 ITERAÇÃO ${iteration}`);
    console.log('='.repeat(80));

    const mcpRequest = {
      jsonrpc: '2.0',
      id: iteration,
      method: 'tools/call',
      params: {
        name: 'extrair_questoes_iterativo',
        arguments: {
          path: pdfPath,
          chunk_size: 5,
          overlap: 2,
          start_chunk: currentChunk,
          max_chunks: 90,
          chunk_batch_size: 3  // Processa 3 chunks por iteração
        }
      }
    };

    const result = await callMCP(serverPath, mcpRequest);

    if (!result || !result.structuredContent) {
      console.error('❌ Erro na iteração', iteration);
      if (result && result.content && result.content[0]) {
        console.error('Mensagem:', result.content[0].text);
      }
      break;
    }

    const data = result.structuredContent;

    // Mostra progresso
    console.log(`\n📊 Progresso: ${data.progress.chunk_atual}/${data.progress.total_chunks} chunks (${data.progress.percentual}%)`);
    console.log(`📦 Chunks processados nesta iteração: ${data.chunks_batch.length}`);
    console.log(`⏭️  Chunks restantes: ${data.progress.chunks_restantes}`);

    // Armazena chunks para processamento
    data.chunks_batch.forEach((chunk, idx) => {
      console.log(`   ${idx + 1}. Chunk ${chunk.chunk_index} (págs ${chunk.page_start}-${chunk.page_end}): ${chunk.num_chars.toLocaleString()} chars`);
      allChunks.push({
        chunk_index: chunk.chunk_index,
        page_start: chunk.page_start,
        page_end: chunk.page_end,
        texto: chunk.texto,
        prompt_contexto: chunk.prompt_contexto,
      });
    });

    console.log(`\n📈 Total de chunks coletados: ${allChunks.length}`);

    // Verifica se tem mais
    if (!data.has_more) {
      console.log(`\n✅ TODOS OS CHUNKS COLETADOS!`);
      break;
    }

    // Atualiza para próxima iteração
    currentChunk = data.next_start_chunk;
    iteration++;

    // Limite de segurança
    if (iteration > 35) {
      console.log(`\n⚠️  Limite de iterações atingido (segurança)`);
      break;
    }
  }

  console.log(`\n${'='.repeat(80)}`);
  console.log(`✅ COLETA DE CHUNKS COMPLETA`);
  console.log('='.repeat(80));
  console.log(`Total de iterações: ${iteration}`);
  console.log(`Total de chunks: ${allChunks.length}`);

  // Salva todos os chunks em arquivo para processamento posterior
  const chunksOutputPath = path.join(__dirname, 'chunks-completos.json');
  fs.writeFileSync(chunksOutputPath, JSON.stringify({
    metadata: {
      pdf_path: pdfPath,
      total_chunks: allChunks.length,
      data_extracao: new Date().toISOString(),
    },
    chunks: allChunks,
  }, null, 2));

  console.log(`\n💾 Chunks salvos em: ${chunksOutputPath}`);
  console.log(`\n📝 Próximo passo: Processar cada chunk para extrair questões`);
  console.log(`   Claude processará cada chunk seguindo o prompt_contexto incluído.`);

  return allChunks;
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

// Executa extração
extrairQuestoesCompleto()
  .then(chunks => {
    console.log(`\n🎉 Extração completa! ${chunks.length} chunks prontos para processamento.`);
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Erro fatal:', error);
    process.exit(1);
  });
