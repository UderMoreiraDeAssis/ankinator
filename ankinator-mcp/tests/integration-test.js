#!/usr/bin/env node

/**
 * Script de Testes de Integração - Fase 5
 *
 * Testa todas as 14 ferramentas MCP do ankinator-mcp
 * usando os fixtures criados.
 *
 * Fases: 1 (3 tools), 2 (3 tools), 3 (3 tools), 4 (2 tools), 6 (3 tools)
 *
 * Uso: node tests/integration-test.js
 */

const { spawn } = require('child_process');
const path = require('path');

// Configuração
const SERVER_PATH = path.join(__dirname, '..', 'dist', 'index.js');
const TIMEOUT = 30000; // 30 segundos por teste

// Cores para output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

// Resultados dos testes
const results = {
  passed: [],
  failed: [],
  skipped: [],
};

// ============================================================================
// UTILITÁRIOS
// ============================================================================

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logTest(name, status, details = '') {
  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⏭️';
  const color = status === 'PASS' ? 'green' : status === 'FAIL' ? 'red' : 'yellow';
  log(`${icon} ${name}`, color);
  if (details) {
    console.log(`   ${details}`);
  }
}

// ============================================================================
// CLIENTE MCP SIMPLES
// ============================================================================

class MCPClient {
  constructor() {
    this.server = null;
    this.requestId = 0;
    this.pendingRequests = new Map();
  }

  async start() {
    return new Promise((resolve, reject) => {
      this.server = spawn('node', [SERVER_PATH], {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      this.server.stdout.on('data', (data) => {
        const lines = data.toString().split('\n').filter(l => l.trim());
        for (const line of lines) {
          try {
            const message = JSON.parse(line);
            if (message.id && this.pendingRequests.has(message.id)) {
              const { resolve, reject } = this.pendingRequests.get(message.id);
              this.pendingRequests.delete(message.id);

              if (message.error) {
                reject(new Error(message.error.message || JSON.stringify(message.error)));
              } else {
                resolve(message.result);
              }
            }
          } catch (e) {
            // Ignorar linhas que não são JSON (logs do servidor)
          }
        }
      });

      this.server.stderr.on('data', (data) => {
        // Ignorar stderr (logs do servidor)
      });

      this.server.on('error', reject);

      // Aguardar inicialização
      setTimeout(resolve, 1000);
    });
  }

  async callTool(name, params) {
    return new Promise((resolve, reject) => {
      const id = ++this.requestId;
      const request = {
        jsonrpc: '2.0',
        id,
        method: 'tools/call',
        params: {
          name,
          arguments: params,
        },
      };

      this.pendingRequests.set(id, { resolve, reject });

      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error('Timeout'));
        }
      }, TIMEOUT);

      this.server.stdin.write(JSON.stringify(request) + '\n');
    });
  }

  // Helper to extract structured content from MCP response
  extractStructuredContent(result) {
    if (result && result.structuredContent) {
      return result.structuredContent;
    }
    return result;
  }

  async stop() {
    if (this.server) {
      this.server.kill();
      this.server = null;
    }
  }
}

// ============================================================================
// TESTES
// ============================================================================

const tests = [
  // FASE 1 - Documentação
  {
    phase: 1,
    name: 'listar_docs',
    description: 'Lista documentos do projeto',
    params: {},
    validate: (result) => {
      return result && result.docs && Array.isArray(result.docs) && result.docs.length > 0;
    },
  },
  {
    phase: 1,
    name: 'resumir_arvore',
    description: 'Explora estrutura de diretórios',
    params: { base: 'server' },
    validate: (result) => {
      return result && result.entries && Array.isArray(result.entries) && result.entries.length > 0;
    },
  },
  {
    phase: 1,
    name: 'extrair_secao',
    description: 'Extrai seção de README.md',
    params: { path: 'ankinator-mcp/README.md', titulo: 'Instalação' },
    validate: (result) => {
      return result && typeof result.conteudo === 'string' && result.conteudo.length > 0;
    },
  },

  // FASE 2 - Validação CSV
  {
    phase: 2,
    name: 'validar_csv (válido)',
    tool: 'validar_csv',
    description: 'Valida CSV correto',
    params: { path: 'ankinator-mcp/examples/csv/valido_minimo.csv' },
    validate: (result) => {
      return result && result.invalidas === 0 && result.validas > 0;
    },
  },
  {
    phase: 2,
    name: 'validar_csv (inválido)',
    tool: 'validar_csv',
    description: 'Detecta erros em CSV inválido',
    params: { path: 'ankinator-mcp/examples/csv/invalido_campos.csv' },
    validate: (result) => {
      return result && result.invalidas > 0 && result.erros && result.erros.length > 0;
    },
  },
  {
    phase: 2,
    name: 'sample_rows',
    description: 'Preview de linhas do CSV',
    params: { path: 'ankinator-mcp/examples/csv/valido_completo.csv', n: 5 },
    validate: (result) => {
      return result && result.linhas && Array.isArray(result.linhas) && result.linhas.length > 0;
    },
  },
  {
    phase: 2,
    name: 'contar_campos',
    description: 'Análise de campos do CSV',
    params: { path: 'ankinator-mcp/examples/csv/valido_completo.csv' },
    validate: (result) => {
      return result && result.totalLinhas && result.totalColunas && result.colunas;
    },
  },

  // FASE 6 - Extração PDF (requer API key)
  {
    phase: 6,
    name: 'preview_questoes',
    description: 'Preview de questões do PDF',
    params: { path: 'ankinator-mcp/examples/pdf/sample_simples.pdf', n: 3 },
    requiresApiKey: true,
    validate: (result) => {
      return result && result.preview && typeof result.preview === 'string';
    },
  },
  {
    phase: 6,
    name: 'extrair_questoes',
    description: 'Extrai questões completas do PDF',
    params: { path: 'ankinator-mcp/examples/pdf/sample_simples.pdf', maxQuestions: 5 },
    requiresApiKey: true,
    validate: (result) => {
      return result && result.questoes && typeof result.questoes === 'string';
    },
  },
  {
    phase: 6,
    name: 'converter_para_csv',
    description: 'Converte questões para CSV',
    params: {
      questoes: 'Q: O que é Python?\nA: Uma linguagem de programação\n\nQ: O que é uma variável?\nA: Um espaço na memória',
      categoria: 'Programação',
    },
    validate: (result) => {
      return result && typeof result.csv === 'string' && result.csv.includes('pergunta,resposta');
    },
  },

  // FASE 3 - Anki References
  {
    phase: 3,
    name: 'versoes_suportadas',
    description: 'Lista versões suportadas do Anki',
    params: { incluir_breaking_changes: true },
    validate: (result) => {
      if (!result || !result.versao_minima || !result.versao_maxima_testada) return false;
      if (!Array.isArray(result.versoes_detalhadas)) return false;
      if (result.versoes_detalhadas.length < 3) return false;

      const firstVersion = result.versoes_detalhadas[0];
      if (!firstVersion.versao || !firstVersion.compatibilidade) return false;
      if (!firstVersion.compatibilidade.python || !firstVersion.compatibilidade.qt) return false;

      return true;
    },
  },
  {
    phase: 3,
    name: 'instalacao_addon (geral)',
    tool: 'instalacao_addon',
    description: 'Guia de instalação geral',
    params: { tipo: 'geral', incluir_troubleshooting: true },
    validate: (result) => {
      if (!result || !result.titulo) return false;
      if (!Array.isArray(result.passos) || result.passos.length < 4) return false;
      if (!result.troubleshooting) return false;

      const firstStep = result.passos[0];
      if (firstStep.numero !== 1 || !firstStep.acao || !firstStep.detalhes) return false;

      return true;
    },
  },
  {
    phase: 3,
    name: 'instalacao_addon (ankimon)',
    tool: 'instalacao_addon',
    description: 'Guia de instalação Ankimon',
    params: { tipo: 'ankimon', incluir_troubleshooting: false },
    validate: (result) => {
      if (!result || !result.titulo.includes('Ankimon')) return false;
      if (!Array.isArray(result.requisitos)) return false;
      if (result.passos.length < 6) return false;

      const hasExtraFilesStep = result.passos.some(p =>
        p.detalhes && p.detalhes.includes('Download extra Resource Files')
      );
      if (!hasExtraFilesStep) return false;

      return true;
    },
  },
  {
    phase: 3,
    name: 'anki_hooks (todos)',
    tool: 'anki_hooks',
    description: 'Lista todos os hooks',
    params: { categoria: 'todos', incluir_exemplos: true },
    validate: (result) => {
      if (!result || result.total_hooks === 0) return false;
      if (!Array.isArray(result.hooks)) return false;
      if (!result.categorias) return false;
      if (result.total_hooks !== result.hooks.length) return false;

      const firstHook = result.hooks[0];
      if (!firstHook.nome || !firstHook.categoria || !firstHook.descricao) return false;
      if (!Array.isArray(firstHook.parametros) || !Array.isArray(firstHook.uso_comum)) return false;
      if (!firstHook.exemplo) return false; // incluir_exemplos=true

      return true;
    },
  },
  {
    phase: 3,
    name: 'anki_hooks (filtro reviewer)',
    tool: 'anki_hooks',
    description: 'Filtra hooks de reviewer',
    params: {
      categoria: 'reviewer',
      apenas_usados_ankimon: true,
      incluir_exemplos: false
    },
    validate: (result) => {
      if (!result || result.total_hooks === 0) return false;

      // Todos devem ser categoria reviewer
      const allReviewer = result.hooks.every(h => h.categoria === 'reviewer');
      if (!allReviewer) return false;

      // Todos devem ser usados no Ankimon
      const allUsedInAnkimon = result.hooks.every(h => h.usado_em_ankimon);
      if (!allUsedInAnkimon) return false;

      // Não deve ter exemplos
      const noExamples = result.hooks.every(h => !h.exemplo);
      if (!noExamples) return false;

      return true;
    },
  },
  {
    phase: 3,
    name: 'anki_hooks (filtro webview)',
    tool: 'anki_hooks',
    description: 'Filtra hooks de webview',
    params: { categoria: 'webview', incluir_exemplos: true },
    validate: (result) => {
      if (!result || result.total_hooks < 1) return false;

      const webviewHook = result.hooks.find(h => h.nome === 'gui_hooks.webview_will_set_content');
      if (!webviewHook) return false;
      if (webviewHook.parametros.length < 2) return false;

      return true;
    },
  },

  // FASE 4 - Release Notes
  {
    phase: 4,
    name: 'ultimas_mudancas (ankinator-mcp)',
    tool: 'ultimas_mudancas',
    description: 'Ler changelog do servidor MCP',
    params: { fonte: 'ankinator-mcp', limite_versoes: 2 },
    validate: (result) => {
      if (!result || !result.fonte) return false;
      if (result.fonte !== 'ankinator-mcp') return false;
      if (!Array.isArray(result.versoes)) return false;
      if (result.versoes.length === 0) return false;
      if (result.versoes.length > 2) return false;

      const firstVersion = result.versoes[0];
      if (!firstVersion.versao || !firstVersion.data) return false;
      if (!firstVersion.categorias || typeof firstVersion.categorias !== 'object') return false;

      if (!result.sugestao_readme || typeof result.sugestao_readme !== 'string') return false;
      if (!result.sugestao_readme.includes('README')) return false;

      return true;
    },
  },
  {
    phase: 4,
    name: 'ultimas_mudancas (ankimon)',
    tool: 'ultimas_mudancas',
    description: 'Ler changelog do add-on Ankimon',
    params: { fonte: 'ankimon', limite_versoes: 1 },
    validate: (result) => {
      if (!result || !result.fonte) return false;
      if (result.fonte !== 'ankimon') return false;
      if (!Array.isArray(result.versoes)) return false;
      // Pode ter 0 ou 1 versão (dependendo se update_txt.md existe/foi parseado)
      if (result.versoes.length > 1) return false;

      if (result.versoes.length > 0) {
        const firstVersion = result.versoes[0];
        if (!firstVersion.versao) return false;
        if (!firstVersion.categorias || typeof firstVersion.categorias !== 'object') return false;
        if (Object.keys(firstVersion.categorias).length === 0) return false;
      }

      return true;
    },
  },
  {
    phase: 4,
    name: 'ultimas_mudancas (ambos)',
    tool: 'ultimas_mudancas',
    description: 'Merge de changelogs MCP + Ankimon',
    params: { fonte: 'ambos', limite_versoes: 5, formato: 'bullets' },
    validate: (result) => {
      if (!result || !result.fonte) return false;
      if (result.fonte !== 'ambos') return false;
      if (!Array.isArray(result.versoes)) return false;
      if (result.versoes.length === 0) return false;
      if (typeof result.total_versoes !== 'number') return false;
      if (result.total_versoes !== result.versoes.length) return false;

      return true;
    },
  },
  {
    phase: 4,
    name: 'ultimas_mudancas (unreleased)',
    tool: 'ultimas_mudancas',
    description: 'Incluir mudanças não lançadas',
    params: { fonte: 'ankinator-mcp', incluir_unreleased: true, limite_versoes: 5 },
    validate: (result) => {
      if (!result || !Array.isArray(result.versoes)) return false;
      if (result.versoes.length === 0) return false;

      // Pode ter versão 'unreleased' ou não
      // Validar que estrutura está correta
      const allVersionsValid = result.versoes.every(v => {
        return v.versao && v.data && v.categorias;
      });

      return allVersionsValid;
    },
  },
  {
    phase: 4,
    name: 'roadmap (próximas)',
    tool: 'roadmap',
    description: 'Próximas ações do roadmap',
    params: { apenas_proximas: true, incluir_completas: false },
    validate: (result) => {
      if (!result || !result.status_geral) return false;
      if (typeof result.status_geral.fases_completas !== 'number') return false;
      if (typeof result.status_geral.fases_totais !== 'number') return false;
      if (result.status_geral.fases_totais === 0) return false;
      if (typeof result.status_geral.progresso_percentual !== 'number') return false;
      if (result.status_geral.progresso_percentual < 0 || result.status_geral.progresso_percentual > 100) return false;

      if (!Array.isArray(result.proximas_acoes)) return false;
      if (!Array.isArray(result.fases_pendentes)) return false;
      if (!result.sugestao_readme || typeof result.sugestao_readme !== 'string') return false;

      return true;
    },
  },
  {
    phase: 4,
    name: 'roadmap (completo)',
    tool: 'roadmap',
    description: 'Roadmap completo incluindo fases finalizadas',
    params: { apenas_proximas: false, incluir_completas: true, formato: 'markdown' },
    validate: (result) => {
      if (!result || !result.status_geral) return false;

      // Deve ter várias fases completas (pelo menos 5: Fase 0, 1, 2, 3, 5, 6)
      if (result.status_geral.fases_completas < 5) return false;

      // Progresso deve ser > 50% (várias fases completas)
      if (result.status_geral.progresso_percentual <= 50) return false;

      if (!Array.isArray(result.riscos_conhecidos)) return false;
      if (!Array.isArray(result.fases_pendentes)) return false;

      return true;
    },
  },
];

// ============================================================================
// EXECUÇÃO DOS TESTES
// ============================================================================

async function runTests() {
  log('\n╔═══════════════════════════════════════════════════════════╗', 'cyan');
  log('║  TESTES DE INTEGRAÇÃO - ANKINATOR MCP v0.1.0-alpha      ║', 'cyan');
  log('╚═══════════════════════════════════════════════════════════╝\n', 'cyan');

  const hasApiKey = !!process.env.ANTHROPIC_API_KEY;

  if (!hasApiKey) {
    log('⚠️  ANTHROPIC_API_KEY não configurada - testes de PDF serão pulados\n', 'yellow');
  }

  const client = new MCPClient();

  try {
    log('🚀 Iniciando servidor MCP...', 'blue');
    await client.start();
    log('✅ Servidor iniciado\n', 'green');

    for (const test of tests) {
      const testName = `[Fase ${test.phase}] ${test.tool || test.name}`;

      // Pular testes que requerem API key se não estiver configurada
      if (test.requiresApiKey && !hasApiKey) {
        logTest(testName, 'SKIP', test.description + ' (API key não configurada)');
        results.skipped.push(test.name);
        continue;
      }

      try {
        log(`\n🧪 Testando: ${test.description}...`, 'blue');

        const rawResult = await client.callTool(test.tool || test.name, test.params);
        const result = client.extractStructuredContent(rawResult);

        const isValid = test.validate(result);

        if (isValid) {
          logTest(testName, 'PASS', test.description);
          results.passed.push(test.name);
        } else {
          logTest(testName, 'FAIL', `Validação falhou: ${JSON.stringify(result).substring(0, 100)}...`);
          results.failed.push({ name: test.name, reason: 'Validação falhou', result });
        }
      } catch (error) {
        logTest(testName, 'FAIL', `Erro: ${error.message}`);
        results.failed.push({ name: test.name, reason: error.message });
      }
    }

  } finally {
    log('\n🛑 Encerrando servidor MCP...', 'blue');
    await client.stop();
  }

  // Relatório final
  log('\n\n╔═══════════════════════════════════════════════════════════╗', 'cyan');
  log('║  RELATÓRIO FINAL                                         ║', 'cyan');
  log('╚═══════════════════════════════════════════════════════════╝\n', 'cyan');

  log(`✅ Testes aprovados: ${results.passed.length}`, 'green');
  log(`❌ Testes falhados: ${results.failed.length}`, 'red');
  log(`⏭️  Testes pulados: ${results.skipped.length}`, 'yellow');
  log(`📊 Total: ${tests.length}\n`);

  if (results.failed.length > 0) {
    log('Detalhes das falhas:', 'red');
    results.failed.forEach(({ name, reason }) => {
      log(`  • ${name}: ${reason}`, 'red');
    });
    log('');
  }

  const successRate = (results.passed.length / (tests.length - results.skipped.length)) * 100;
  log(`Taxa de sucesso: ${successRate.toFixed(1)}%\n`, successRate === 100 ? 'green' : 'yellow');

  // Exit code
  process.exit(results.failed.length === 0 ? 0 : 1);
}

// Executar
runTests().catch((error) => {
  log(`\n❌ Erro fatal: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});
