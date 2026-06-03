#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

// MCP request para extrair texto do PDF (não requer API key)
const mcpRequest = {
  jsonrpc: '2.0',
  id: 1,
  method: 'tools/call',
  params: {
    name: 'extrair_texto_pdf',
    arguments: {
      path: '/home/t316360/plottwist/ankinator/curso-230987-aula-01-grifado-a09d.pdf',
      maxChars: 100000,
      incluir_prompt: false
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
      console.log('Páginas:', data.num_pages);
      console.log('Caracteres:', data.num_chars);
      console.log('Truncado:', data.truncado);
      console.log('\n--- TEXTO DO PDF ---\n');
      console.log(data.texto);
    } else if (response.error) {
      console.error('Error:', response.error);
    }
  } catch (e) {
    console.error('Failed to parse response:', e.message);
    console.error('Raw output:', stdout);
  }
});

// Send request
mcpProcess.stdin.write(JSON.stringify(mcpRequest) + '\n');
mcpProcess.stdin.end();
