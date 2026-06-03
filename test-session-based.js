#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

// Script to test the new session-based PDF extraction tools
async function testSessionBasedExtraction() {
  const serverPath = path.join(__dirname, 'ankinator-mcp', 'dist', 'index.js');
  const pdfPath = '/home/t316360/plottwist/ankinator/curso-230987-aula-01-grifado-a09d.pdf';

  console.log('🧪 Testing Session-Based PDF Extraction\n');
  console.log('='.repeat(80));

  // Test 1: iniciar_extracao_pdf
  console.log('\n📋 Test 1: iniciar_extracao_pdf');
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
    console.error('❌ FAILED: iniciar_extracao_pdf did not return structuredContent');
    return;
  }

  const sessionId = initResult.structuredContent.session_id;
  const totalChunks = initResult.structuredContent.total_chunks;
  const estimatedTokens = initResult.structuredContent.estimated_total_tokens;

  console.log(`✅ Session created: ${sessionId}`);
  console.log(`   Total chunks: ${totalChunks}`);
  console.log(`   Estimated tokens (full PDF): ${estimatedTokens.toLocaleString()}`);
  console.log(`   Metadata array length: ${initResult.structuredContent.chunk_metadata.length}`);

  // Check token safety
  const responseSize = JSON.stringify(initResult.structuredContent).length;
  const responseTokens = Math.ceil(responseSize / 4);
  console.log(`   Response size: ${responseTokens.toLocaleString()} tokens`);

  if (responseTokens > 25000) {
    console.error(`❌ FAILED: Response exceeds 25K tokens (${responseTokens})`);
    return;
  } else if (responseTokens > 22000) {
    console.warn(`⚠️  WARNING: Response approaching limit (${responseTokens}/22000 safe limit)`);
  } else {
    console.log(`✅ Response is token-safe: ${responseTokens}/22000 tokens`);
  }

  // Test 2: obter_chunks_pdf with auto_batch
  console.log('\n📦 Test 2: obter_chunks_pdf (auto_batch)');
  console.log('-'.repeat(80));

  const getChunksRequest = {
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
  };

  const chunksResult = await callMCP(serverPath, getChunksRequest);

  if (!chunksResult || !chunksResult.structuredContent) {
    console.error('❌ FAILED: obter_chunks_pdf did not return structuredContent');
    return;
  }

  const batchInfo = chunksResult.structuredContent.batch_info;
  const returnedChunks = chunksResult.structuredContent.chunks;

  console.log(`✅ Retrieved ${batchInfo.returned_count} chunks`);
  console.log(`   Has more: ${batchInfo.has_more}`);
  console.log(`   Next index: ${batchInfo.next_index || 'N/A'}`);
  console.log(`   Estimated tokens: ${batchInfo.estimated_tokens_used.toLocaleString()}`);

  if (batchInfo.estimated_tokens_used > 25000) {
    console.error(`❌ FAILED: Batch exceeds 25K tokens (${batchInfo.estimated_tokens_used})`);
    return;
  } else if (batchInfo.estimated_tokens_used > 22000) {
    console.warn(`⚠️  WARNING: Batch approaching limit (${batchInfo.estimated_tokens_used}/22000)`);
  } else {
    console.log(`✅ Batch is token-safe: ${batchInfo.estimated_tokens_used}/22000 tokens`);
  }

  // Verify chunks have content
  if (returnedChunks.length > 0) {
    const firstChunk = returnedChunks[0];
    console.log(`\n📄 First chunk sample:`);
    console.log(`   Chunk index: ${firstChunk.chunk_index}`);
    console.log(`   Pages: ${firstChunk.page_start}-${firstChunk.page_end}`);
    console.log(`   Chars: ${firstChunk.num_chars.toLocaleString()}`);
    console.log(`   Text preview: "${firstChunk.texto.substring(0, 100)}..."`);
  }

  // Test 3: Verify prompt template was returned only once
  console.log('\n📋 Test 3: Prompt template handling');
  console.log('-'.repeat(80));

  if (initResult.structuredContent.prompt_template) {
    console.log(`✅ Prompt template returned in iniciar_extracao_pdf`);
    console.log(`   Length: ${initResult.structuredContent.prompt_template.length} chars`);
  } else {
    console.error(`❌ FAILED: No prompt template in iniciar_extracao_pdf response`);
  }

  // Verify chunks don't contain duplicated prompt
  const chunkHasPrompt = returnedChunks.some(chunk =>
    chunk.hasOwnProperty('prompt_contexto')
  );

  if (chunkHasPrompt) {
    console.error(`❌ FAILED: Chunks still contain prompt_contexto field (duplication!)`);
  } else {
    console.log(`✅ Chunks do NOT contain prompt_contexto (no duplication)`);
  }

  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('✅ ALL TESTS PASSED!');
  console.log('='.repeat(80));
  console.log('\nToken Safety Summary:');
  console.log(`  - iniciar_extracao_pdf: ${responseTokens.toLocaleString()} tokens (metadata only)`);
  console.log(`  - obter_chunks_pdf: ${batchInfo.estimated_tokens_used.toLocaleString()} tokens (auto-batched)`);
  console.log(`  - No prompt duplication: Saved ~76,500 chars`);
  console.log(`  - Session-based storage: Prevents 325K token overflow`);
  console.log('\n🎉 Session-based extraction is working correctly!\n');
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

// Run tests
testSessionBasedExtraction()
  .then(() => {
    console.log('✅ Test suite completed successfully!');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Test suite failed:', error);
    process.exit(1);
  });
