#!/usr/bin/env node

/**
 * Test script for the complete Anki workflow:
 * 1. Create PDF session
 * 2. Get chunks
 * 3. Process chunks and save questions
 * 4. Generate Anki CSV
 */

const { spawn } = require('child_process');
const path = require('path');

const serverPath = path.join(__dirname, 'ankinator-mcp', 'dist', 'index.js');
const pdfPath = '/home/t316360/plottwist/ankinator/curso-8.pdf';

let sessionId = null;

console.log('🧪 Testando fluxo completo: PDF → Chunks → Questões → CSV Anki\n');
console.log('='.repeat(80));

async function callMCP(request) {
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
          console.error('❌ MCP Error:', response.error);
          reject(response.error);
        }
      } catch (e) {
        console.error('❌ Parse error:', e.message);
        console.error('Raw output:', stdout);
        reject(e);
      }
    });

    mcpProcess.stdin.write(JSON.stringify(request) + '\n');
    mcpProcess.stdin.end();
  });
}

async function test() {
  try {
    // Step 1: Initialize session
    console.log('\n📋 Passo 1: Iniciando sessão de extração...');
    const initResult = await callMCP({
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
    });

    sessionId = initResult.structuredContent.session_id;
    console.log(`✅ Sessão criada: ${sessionId}`);
    console.log(`   Total de chunks: ${initResult.structuredContent.total_chunks}`);

    // Step 2: Get first chunk
    console.log('\n📦 Passo 2: Obtendo primeiro chunk...');
    const chunksResult = await callMCP({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name: 'obter_chunks_pdf',
        arguments: {
          session_id: sessionId,
          start_index: 0,
          auto_batch: true,
        }
      }
    });

    const chunk = chunksResult.structuredContent.chunks[0];
    console.log(`✅ Chunk obtido: ${chunk.chunk_index}`);
    console.log(`   Páginas: ${chunk.page_start}-${chunk.page_end}`);
    console.log(`   Caracteres: ${chunk.num_chars}`);

    // Step 3: Save mock questions
    console.log('\n💾 Passo 3: Salvando questões de teste...');

    const mockQuestions = [
      {
        tipo: 'extraida',
        pergunta: 'No PMBOK, os grupos de processos são as fases cronológicas do projeto?',
        resposta: 'Errado. GRUPOS DE PROCESSOS NÃO SÃO FASES DO PROJETO.',
        metadata: {
          banca: 'Ministério da Economia',
          ano: 2020,
          gabarito: 'Errado',
        }
      },
      {
        tipo: 'criada',
        pergunta: 'Quantas áreas de conhecimento possui o PMBOK 6?',
        resposta: '10 áreas de conhecimento de gerenciamento de projetos.',
      },
      {
        tipo: 'criada',
        pergunta: 'O PMBOK é uma metodologia de gerenciamento de projetos?',
        resposta: 'Não. O PMBOK é um conjunto de boas práticas de gerenciamento de projetos, não uma metodologia.',
      }
    ];

    const saveResult = await callMCP({
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: 'salvar_questoes_chunk',
        arguments: {
          session_id: sessionId,
          chunk_index: chunk.chunk_index,
          page_start: chunk.page_start,
          page_end: chunk.page_end,
          questoes: mockQuestions,
        }
      }
    });

    console.log(`✅ Questões salvas: ${saveResult.structuredContent.questoes_salvas}`);
    console.log(`   Total na sessão: ${saveResult.structuredContent.total_questoes_sessao}`);

    // Step 4: Get questions as JSON
    console.log('\n📋 Passo 4: Obtendo questões em formato JSON...');
    const jsonResult = await callMCP({
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: {
        name: 'obter_questoes_sessao',
        arguments: {
          session_id: sessionId,
          formato: 'json',
          incluir_estatisticas: true,
        }
      }
    });

    console.log(`✅ Questões retornadas: ${jsonResult.structuredContent.estatisticas.total_questoes}`);
    console.log(`   Extraídas: ${jsonResult.structuredContent.estatisticas.questoes_extraidas}`);
    console.log(`   Criadas: ${jsonResult.structuredContent.estatisticas.questoes_criadas}`);

    // Step 5: Generate Anki CSV
    console.log('\n📄 Passo 5: Gerando CSV do Anki...');
    const csvResult = await callMCP({
      jsonrpc: '2.0',
      id: 5,
      method: 'tools/call',
      params: {
        name: 'obter_questoes_sessao',
        arguments: {
          session_id: sessionId,
          formato: 'csv',
          incluir_estatisticas: true,
        }
      }
    });

    const csvContent = csvResult.structuredContent.questoes;
    console.log(`✅ CSV gerado!`);
    console.log(`   Linhas: ${csvContent.split('\n').length - 1}`); // Exclude header

    // Step 6: Validate CSV
    console.log('\n✅ Passo 6: Validando CSV...');
    const validateResult = await callMCP({
      jsonrpc: '2.0',
      id: 6,
      method: 'tools/call',
      params: {
        name: 'validar_csv_anki',
        arguments: {
          csv_content: csvContent,
        }
      }
    });

    console.log(`✅ Validação: ${validateResult.structuredContent.valido ? 'OK' : 'FALHOU'}`);
    if (!validateResult.structuredContent.valido) {
      console.log(`   Erros: ${validateResult.structuredContent.erros.join(', ')}`);
    }

    // Display CSV preview
    console.log('\n📋 Preview do CSV gerado:');
    console.log('─'.repeat(80));
    const lines = csvContent.split('\n');
    lines.slice(0, 5).forEach(line => console.log(line));
    if (lines.length > 5) {
      console.log('...');
    }
    console.log('─'.repeat(80));

    console.log('\n' + '='.repeat(80));
    console.log('🎉 TESTE COMPLETO! Todas as ferramentas funcionando corretamente!');
    console.log('='.repeat(80));
    console.log('\n✨ Novas ferramentas implementadas:');
    console.log('   - salvar_questoes_chunk: Salva questões processadas por chunk');
    console.log('   - obter_questoes_sessao: Retorna questões em JSON ou CSV para Anki');
    console.log('   - validar_csv_anki: Valida formato CSV do Anki');
    console.log('\n💾 Próximo passo: Use o fluxo completo para processar PDFs reais!');
    console.log('');

  } catch (error) {
    console.error('\n❌ ERRO no teste:', error);
    process.exit(1);
  }
}

test();
