#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Script para extrair questões do curso-8.pdf usando ankinator-mcp
async function extrairCurso8() {
  const serverPath = path.join(__dirname, 'ankinator-mcp', 'dist', 'index.js');
  const pdfPath = '/home/t316360/plottwist/ankinator/curso-8.pdf';

  console.log('🚀 Extração de Questões do curso-8.pdf\n');
  console.log('='.repeat(80));

  // Passo 1: Iniciar sessão
  console.log('\n📋 Passo 1: Iniciando sessão...');
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

  console.log(`✅ Sessão: ${sessionId}`);
  console.log(`   Total de chunks: ${totalChunks}`);
  console.log(`   Total de páginas: ${initResult.structuredContent.total_pages}\n`);

  // Passo 2: Obter todos os chunks
  console.log('📦 Passo 2: Obtendo chunks...\n');

  const allChunks = [];
  let startIndex = 0;

  while (true) {
    const chunksRequest = {
      jsonrpc: '2.0',
      id: startIndex + 100,
      method: 'tools/call',
      params: {
        name: 'obter_chunks_pdf',
        arguments: {
          session_id: sessionId,
          start_index: startIndex,
          auto_batch: true,
        }
      }
    };

    const chunksResult = await callMCP(serverPath, chunksRequest);

    if (!chunksResult || !chunksResult.structuredContent) {
      console.error('❌ Erro ao obter chunks');
      break;
    }

    const chunks = chunksResult.structuredContent.chunks;
    allChunks.push(...chunks);

    console.log(`   ✓ Chunks ${startIndex}-${startIndex + chunks.length - 1}: ${chunks.length} chunks`);

    if (!chunksResult.structuredContent.batch_info.has_more) {
      break;
    }

    startIndex = chunksResult.structuredContent.batch_info.next_index;
  }

  console.log(`\n✅ Total de chunks coletados: ${allChunks.length}\n`);

  // Passo 3: Salvar chunks
  const outputData = {
    metadata: {
      session_id: sessionId,
      pdf_path: pdfPath,
      total_chunks: allChunks.length,
      data_extracao: new Date().toISOString(),
      prompt_template: promptTemplate,
    },
    chunks: allChunks,
  };

  const outputPath = path.join(__dirname, 'curso-8-chunks.json');
  fs.writeFileSync(outputPath, JSON.stringify(outputData, null, 2));

  console.log('='.repeat(80));
  console.log('✅ CHUNKS EXTRAÍDOS!\n');
  console.log(`📁 Arquivo salvo: ${outputPath}`);
  console.log(`📊 Total de chunks: ${allChunks.length}`);
  console.log(`💾 Tamanho: ${(fs.statSync(outputPath).size / 1024).toFixed(1)} KB\n`);
  console.log(`💡 Próximo passo: Claude processará cada chunk para extrair questões`);
  console.log('');
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
        resolve(null);
      }
    });

    mcpProcess.stdin.write(JSON.stringify(request) + '\n');
    mcpProcess.stdin.end();
  });
}

// Executar
extrairCurso8()
  .then(() => {
    console.log('🎉 Extração concluída!');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Erro:', error);
    process.exit(1);
  });
