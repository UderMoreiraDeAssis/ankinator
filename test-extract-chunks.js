#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// MCP request para extrair chunks do PDF (SEM API KEY!)
const mcpRequest = {
  jsonrpc: '2.0',
  id: 1,
  method: 'tools/call',
  params: {
    name: 'extrair_pdf_chunks',
    arguments: {
      path: '/home/t316360/plottwist/ankinator/curso-230987-aula-01-grifado-a09d.pdf',
      chunk_size: 10,
      overlap: 2,
      incluir_prompt: true
    }
  }
};

// Spawn MCP server
const serverPath = path.join(__dirname, 'ankinator-mcp', 'dist', 'index.js');
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

    if (response.result && response.result.structuredContent) {
      const data = response.result.structuredContent;

      console.log('✅ Chunks extraídos com sucesso!\n');
      console.log(`📊 Estatísticas:`);
      console.log(`   - Total de páginas: ${data.total_pages}`);
      console.log(`   - Total de chunks: ${data.total_chunks}`);
      console.log(`   - Chunk size usado: ${data.chunk_size_usado}`);
      console.log(`   - Overlap usado: ${data.overlap_usado}`);
      console.log(`   - Total de caracteres: ${data.total_chars.toLocaleString()}\n`);

      // Salva chunks em arquivo JSON para processamento posterior
      const outputPath = path.join(__dirname, 'pdf-chunks-output.json');
      fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
      console.log(`💾 Chunks salvos em: ${outputPath}\n`);

      console.log(`📦 Chunks disponíveis:`);
      data.chunks.forEach((chunk, idx) => {
        console.log(`   ${idx + 1}. Chunk ${chunk.chunk_index} (págs ${chunk.page_start}-${chunk.page_end}): ${chunk.num_chars.toLocaleString()} chars`);
      });

      if (data.prompt_sugerido) {
        console.log(`\n🤖 Prompt sugerido:\n${data.prompt_sugerido}\n`);
      }
    } else if (response.error) {
      console.error('❌ Error:', response.error);
    }
  } catch (e) {
    console.error('Failed to parse response:', e.message);
    console.error('Raw output:', stdout);
  }
});

// Send request
mcpProcess.stdin.write(JSON.stringify(mcpRequest) + '\n');
mcpProcess.stdin.end();
