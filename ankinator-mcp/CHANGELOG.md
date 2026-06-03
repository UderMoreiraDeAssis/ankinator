# Changelog

Todas as mudanças notáveis neste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto adere ao [Semantic Versioning](https://semver.org/lang/pt-BR/).

## [0.1.0-alpha] - 2025-11-22

### Added - Ferramentas MCP (14 total)

**Fase 1 - Documentação do Repositório (repo-briefing):**
- `listar_docs`: Lista documentos principais do projeto
- `resumir_arvore`: Explora estrutura de diretórios com limites configuráveis
- `extrair_secao`: Extrai seções específicas de arquivos Markdown

**Fase 2 - Validação de CSV (import-validator):**
- `validar_csv`: Valida formato de questões usando schema Zod com mensagens em português
- `sample_rows`: Preview de linhas do CSV com limite configurável
- `contar_campos`: Análise de campos e estatísticas (distribuição de valores)

**Fase 3 - Referências do Anki (anki-refs):**
- `versoes_suportadas`: Lista versões do Anki compatíveis com add-ons
- `instalacao_addon`: Guias de instalação (geral, manual, Ankimon)
- `anki_hooks`: Documentação de 11 hooks do Anki com exemplos

**Fase 4 - Release Notes e Roadmap (release-notes):**
- `ultimas_mudancas`: Changelog formatado (MCP, Ankimon ou ambos)
- `roadmap`: Status do projeto, próximas ações e riscos

**Fase 6 - Extração de PDF (pdf-to-questions):**
- `extrair_questoes`: Extrai questões Q:/A: fidedignas de PDFs usando Claude API
- `preview_questoes`: Preview rápido de n questões antes de processamento completo
- `converter_para_csv`: Converte questões Q:/A: para formato CSV compatível com Anki

### Added - Documentação (~2900 linhas total)

**Raiz do projeto:**
- `ankinator-mcp/README.md`: Setup completo, instalação, quick start, troubleshooting (350+ linhas)
- `README.md` principal: Adicionada seção completa sobre MCP Server com diagrama de arquitetura

**Diretório docs/:**
- `docs/MCP_CLIENT_CONFIG.md`: Configuração detalhada para Claude Desktop e Claude Code em macOS, Windows e Linux (500+ linhas)
- `docs/PDF_EXTRACTION_PROMPT.md`: Regras rigorosas de extração fidedigna ao conteúdo original (450+ linhas)
- `docs/USAGE.md`: Guia completo de uso de todas as 9 ferramentas com exemplos práticos (650+ linhas)

**Diretório examples/:**
- `examples/README.md`: Documentação completa dos fixtures de teste com workflows e troubleshooting (285 linhas)

### Added - Fixtures de Teste (6 arquivos, ~9.7KB)

**CSVs (4 arquivos):**
- `examples/csv/valido_minimo.csv`: 3 questões básicas (apenas campos obrigatórios)
- `examples/csv/valido_completo.csv`: 10 questões com todos os campos preenchidos
- `examples/csv/invalido_campos.csv`: Testa detecção de campo obrigatório vazio
- `examples/csv/invalido_dificuldade.csv`: Testa validação de enum de dificuldade

**PDFs (2 arquivos):**
- `examples/pdf/sample_simples.pdf`: Introdução à Programação Python (2 páginas, ~8 pares Q/A esperados)
- `examples/pdf/sample_matematica.pdf`: Equações do Segundo Grau (3 páginas, ~12 pares Q/A esperados)

### Added - Infraestrutura

**Scripts de Automação:**
- `scripts/generate-fixtures.js`: Script Node.js que gera automaticamente todos os fixtures (329 linhas)
  - Gera 4 CSVs com diferentes cenários de validação
  - Gera 2 PDFs educacionais usando pdfkit
  - Conteúdo estruturado para facilitar extração de questões
- npm script `generate-fixtures`: Comando para regenerar fixtures facilmente

**Build e Desenvolvimento:**
- npm script `build`: Compila TypeScript para JavaScript
- npm script `dev`: Executa em modo desenvolvimento com tsx
- npm script `start`: Executa código compilado

### Added - Dependências

**Produção:**
- `@anthropic-ai/sdk` (^0.70.1): Integração com Claude API para extração inteligente de PDF
- `@modelcontextprotocol/sdk` (^1.22.0): Protocolo MCP para comunicação com clientes
- `pdf-parse` (^2.4.5): Extração de texto de arquivos PDF
- `csv-parse` (^6.1.0): Parse de arquivos CSV
- `zod` (^4.1.12): Validação de schemas com type safety

**Desenvolvimento:**
- `pdfkit` (^0.17.2): Geração de PDFs para fixtures de teste
- `@types/pdfkit` (^0.17.3): Tipos TypeScript para pdfkit
- `tsx` (^4.20.6): Executor TypeScript para desenvolvimento
- `typescript` (^5.9.3): Compilador TypeScript

### Technical

**Schema de Validação (Zod):**
- Schema CSV: `pergunta` (obrigatório), `resposta` (obrigatório), `opcoes` (opcional), `dificuldade` (enum opcional), `categoria` (opcional)
- Enum de dificuldade: `facil`, `medio`, `dificil`, `muito_dificil`
- Validação de campos obrigatórios com mensagens de erro em português
- Limite padrão: 200 linhas (configurável até 1000)

**Segurança:**
- Validação rigorosa de paths usando `resolveWithinAllowed()` (previne directory traversal)
- Paths permitidos: raiz do projeto, `ankimon/`, `ankinator-mcp/`
- Truncamento automático de outputs longos (limite padrão: 2000 caracteres)
- API keys nunca são logadas
- Apenas operações de leitura em arquivos locais

**Extração de PDF:**
- Prompt rigoroso embedado para garantir fidelidade ao conteúdo original
- Formato Q:/A: estruturado e parseável
- Integração com Claude API (requer ANTHROPIC_API_KEY)
- Limite padrão: 20 questões (configurável até 100)
- Suporte a símbolos matemáticos e formatação especial

### Documentation

**Estrutura do Projeto:**
- Dois componentes principais documentados:
  1. Ankimon (Add-on Python/PyQt6 para Anki)
  2. Ankinator-MCP (Servidor Node.js/TypeScript)
- Diagrama de arquitetura mostrando complementaridade entre componentes
- Fluxo completo: PDF → MCP Server → CSV → Ankimon → Anki

**Guias de Configuração:**
- Instruções detalhadas para Claude Desktop em macOS, Windows e Linux
- Instruções para Claude Code (workspace .claude/mcp_settings.json)
- Exemplos de configuração com paths absolutos e relativos
- Troubleshooting comum (servidor não aparece, API key não configurada, etc.)

**Workflows Documentados:**
- PDF → Questões → CSV → Anki (pipeline completo)
- Validação de CSV antes de importação
- Preview de PDF antes de extração completa
- Teste de detecção de erros

### Security

- **npm audit**: 0 vulnerabilities encontradas
- Validação de inputs em todas as ferramentas
- Proteção contra directory traversal
- Apenas leitura de arquivos (nenhuma operação de escrita via ferramentas MCP)
- Documentação sobre proteção de API keys (não versionar, usar variáveis de ambiente)

### Testing

**Integration Tests (Fase 5):**
- Script de testes automatizados: `tests/integration-test.js` (500+ linhas)
- 22 casos de teste cobrindo todas as 14 ferramentas MCP
- Taxa de sucesso: 100% (20/20 testes executados, 2 pulados sem API key)
- Documentação completa: `INTEGRATION_RESULTS.md` (300+ linhas)

**Bugs encontrados e corrigidos durante testes:**
- MCP response format handling (implementado `extractStructuredContent()`)
- Path resolution para fixtures (corrigido paths relativos)
- Schema field names (português/camelCase corrigidos)
- Section title localization (corrigido "Installation" → "Instalação")
- Roadmap parser: detecção de fases completas baseado em checkboxes

**Cobertura:**
- Fase 1: 3/3 ferramentas testadas e aprovadas
- Fase 2: 4/4 ferramentas testadas e aprovadas (válido + inválido)
- Fase 3: 6/6 ferramentas testadas e aprovadas
- Fase 4: 6/6 ferramentas testadas e aprovadas
- Fase 6: 3/3 ferramentas testadas (1 aprovado, 2 pulados sem API key)

### Known Limitations

- Extração de PDF requer ANTHROPIC_API_KEY (consome tokens da API)
- PDFs muito grandes podem exceder limites de tokens (recomendação: processar por seções)
- PDF escaneados (apenas imagens) não são suportados, requer texto extraível
- CSVs muito grandes limitados a 200 linhas por padrão (configurável)

---

## [Unreleased]

### Planned

**Melhorias:**
- Code review de error handling
- Otimização de performance para PDFs grandes
- Suporte a mais formatos de PDF (OCR futuro)
- Expansão de features (novas fases ou ferramentas)

---

**Legend:**
- **Added**: Novas funcionalidades
- **Changed**: Mudanças em funcionalidades existentes
- **Deprecated**: Funcionalidades obsoletas (serão removidas)
- **Removed**: Funcionalidades removidas
- **Fixed**: Correções de bugs
- **Security**: Correções de segurança

