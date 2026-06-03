#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

// MCP request para extrair questões com chunking
const mcpRequest = {
  jsonrpc: '2.0',
  id: 1,
  method: 'tools/call',
  params: {
    name: 'extrair_questoes_chunked',
    arguments: {
      path: '/home/t316360/plottwist/ankinator/curso-230987-aula-01-grifado-a09d.pdf',
      chunk_size: 5,
      overlap: 2,
      max_total_questions: 100,
      parallel_chunks: 3
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
    const response = JSON.parse(stdout);
    if (response.result) {
      console.log(JSON.stringify(response.result, null, 2));
    } else if (response.error) {
      console.error('Error:', response.error);
    }
  } catch (e) {
    console.error('Failed to parse response:', stdout);
  }
});

// Send request
mcpProcess.stdin.write(JSON.stringify(mcpRequest) + '\n');
mcpProcess.stdin.end();
