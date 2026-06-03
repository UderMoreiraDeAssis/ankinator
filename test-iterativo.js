#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Testa a nova ferramenta iterativa
async function testIterative() {
  const serverPath = path.join(__dirname, 'ankinator-mcp', 'dist', 'index.js');

  let currentChunk = 0;
  let iteration = 1;
  const allQuestions = [];

  console.log('🚀 Iniciando extração iterativa de questões...\n');

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
          path: '/home/t316360/plottwist/ankinator/curso-230987-aula-01-grifado-a09d.pdf',
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
      break;
    }

    const data = result.structuredContent;

    // Mostra progresso
    console.log(`\n📊 Progresso: ${data.progress.chunk_atual}/${data.progress.total_chunks} chunks (${data.progress.percentual}%)`);
    console.log(`📦 Chunks processados nesta iteração: ${data.chunks_batch.length}`);
    console.log(`⏭️  Chunks restantes: ${data.progress.chunks_restantes}`);

    // Mostra chunks
    console.log(`\n📝 Chunks nesta iteração:`);
    data.chunks_batch.forEach((chunk, idx) => {
      console.log(`   ${idx + 1}. Chunk ${chunk.chunk_index} (págs ${chunk.page_start}-${chunk.page_end}): ${chunk.num_chars.toLocaleString()} chars`);

      // Simula processamento - em produção, Claude processaria cada chunk
      const questionsInChunk = extractQuestionsFromChunk(chunk.texto);
      allQuestions.push(...questionsInChunk.map(q => ({
        ...q,
        chunk_index: chunk.chunk_index,
        pages: `${chunk.page_start}-${chunk.page_end}`
      })));

      console.log(`      → ${questionsInChunk.length} questões encontradas`);
    });

    console.log(`\n📈 Total acumulado: ${allQuestions.length} questões`);

    // Verifica se tem mais
    if (!data.has_more) {
      console.log(`\n✅ EXTRAÇÃO COMPLETA!`);
      break;
    }

    // Atualiza para próxima iteração
    currentChunk = data.next_start_chunk;
    iteration++;

    // Limite de segurança para testes
    if (iteration > 30) {
      console.log(`\n⚠️  Limite de iterações atingido (segurança)`);
      break;
    }
  }

  console.log(`\n${'='.repeat(80)}`);
  console.log(`✅ RESUMO FINAL`);
  console.log('='.repeat(80));
  console.log(`Total de iterações: ${iteration}`);
  console.log(`Total de questões: ${allQuestions.length}`);

  // Salva questões em arquivo
  const outputPath = path.join(__dirname, 'questoes-extraidas.json');
  fs.writeFileSync(outputPath, JSON.stringify(allQuestions, null, 2));
  console.log(`\n💾 Questões salvas em: ${outputPath}`);

  // Mostra primeiras 3 questões
  console.log(`\n📝 Primeiras 3 questões:`);
  allQuestions.slice(0, 3).forEach((q, idx) => {
    console.log(`\n${idx + 1}. [Chunk ${q.chunk_index}, Págs ${q.pages}]`);
    console.log(`   Q: ${q.question.substring(0, 100)}...`);
    console.log(`   A: ${q.answer.substring(0, 100)}...`);
  });
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

// Simula extração de questões do chunk (regex simples)
function extractQuestionsFromChunk(text) {
  const questions = [];

  // Regex para encontrar padrões de questões
  const questionPattern = /\d+\.\s*\([^)]+\)\s*([^\n]+(?:\n(?!\d+\.)[^\n]+)*)/g;
  const gabaritoPattern = /Gabarito:\s*([^\n]+)/gi;

  const matches = text.matchAll(questionPattern);
  const gabaritos = text.matchAll(gabaritoPattern);

  const questionsList = Array.from(matches);
  const gabaritosList = Array.from(gabaritos);

  for (let i = 0; i < Math.min(questionsList.length, gabaritosList.length); i++) {
    questions.push({
      question: questionsList[i][0].trim(),
      answer: gabaritosList[i][1].trim(),
      type: 'EXTRAÍDA'
    });
  }

  return questions;
}

// Executa teste
testIterative().catch(console.error);
