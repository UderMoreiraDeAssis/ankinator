# Ankinator MCP Server

> **Servidor MCP (Model Context Protocol) para criar e validar flashcards do Anki a partir de PDFs educacionais**

[![Version](https://img.shields.io/badge/version-0.1.0--alpha-orange)](./CHANGELOG.md)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](../LICENSE)

## 📖 Visão Geral

O **ankinator-mcp** é um servidor MCP que fornece ferramentas especializadas para transformar material educacional em flashcards do Anki, com foco em **fidelidade total** ao conteúdo original.

### 🎯 Casos de Uso

- Estudantes: Criar flashcards a partir de PDFs de aulas
- Professores: Gerar questões de revisão de material didático
- Pesquisadores: Transformar papers em questões para memorização
- Autodidatas: Converter livros técnicos em conhecimento estruturado

### ✨ Features Principais

**Fase 1 - Documentação do Repositório**
- `listar_docs` - Lista documentos principais do projeto
- `resumir_arvore` - Explora estrutura de diretórios
- `extrair_secao` - Extrai seções específicas de Markdown

**Fase 2 - Validação de CSV**
- `validar_csv` - Valida formato de questões com schema Zod
- `sample_rows` - Preview de linhas do CSV
- `contar_campos` - Análise de campos e estatísticas

**Fase 3 - Referências do Anki**
- `versoes_suportadas` - Lista versões compatíveis do Anki
- `instalacao_addon` - Guias de instalação de add-ons
- `anki_hooks` - Documentação de hooks do Anki

**Fase 4 - Release Notes e Roadmap**
- `ultimas_mudancas` - Changelog formatado (MCP, Ankimon ou ambos)
- `roadmap` - Status e próximas ações do projeto

**Fase 6 - Extração de PDF** (🌟 **Core Feature**)
- `extrair_questoes` - Extrai questões Q:/A: fidedignas de PDFs
- `preview_questoes` - Preview rápido antes de processamento completo
- `converter_para_csv` - Converte Q:/A: para CSV validável

**Total: 14 ferramentas funcionais**

## 🚀 Quick Start

### Pré-requisitos

- Node.js 18+ e npm
- Anthropic API key (para extração de PDF)
- Claude Desktop ou Claude Code (ou outro cliente MCP)

### Instalação

```bash
# 1. Clone o repositório (se ainda não tiver)
git clone https://github.com/your-username/ankinator.git
cd ankinator/ankinator-mcp

# 2. Instale dependências
npm install

# 3. Configure a API key
export ANTHROPIC_API_KEY="sua-api-key-aqui"
# ou crie um arquivo .env:
echo "ANTHROPIC_API_KEY=sua-api-key-aqui" > .env

# 4. Compile o projeto
npm run build

# 5. Teste a execução
npm run dev
```

### Configuração do Cliente MCP

Adicione ao seu arquivo de configuração MCP:

**Claude Desktop** (`~/Library/Application Support/Claude/claude_desktop_config.json` no macOS):
```json
{
  "mcpServers": {
    "ankinator": {
      "command": "node",
      "args": ["/caminho/absoluto/para/ankinator/ankinator-mcp/dist/index.js"],
      "env": {
        "ANTHROPIC_API_KEY": "sua-api-key-aqui"
      }
    }
  }
}
```

**Claude Code** (`.claude/mcp_settings.json` no workspace):
```json
{
  "mcpServers": {
    "ankinator": {
      "command": "node",
      "args": ["./ankinator-mcp/dist/index.js"],
      "env": {
        "ANTHROPIC_API_KEY": "sua-api-key-aqui"
      }
    }
  }
}
```

📚 **Mais detalhes:** Ver [docs/MCP_CLIENT_CONFIG.md](./docs/MCP_CLIENT_CONFIG.md)

## 💡 Exemplo de Uso

### Workflow Completo: PDF → Anki

```bash
# 1. Preview do PDF (testar qualidade)
# Via cliente MCP: chamar ferramenta preview_questoes
# Parâmetros: { path: "aulas/matematica.pdf", n: 5 }

# 2. Extrair questões completas
# Ferramenta: extrair_questoes
# Parâmetros: { path: "aulas/matematica.pdf", maxQuestions: 30 }

# 3. Converter para CSV
# Ferramenta: converter_para_csv
# Parâmetros: { questoes: "[output anterior]", categoria: "Matemática" }
# Salvar output em arquivo: questoes.csv

# 4. Validar CSV
# Ferramenta: validar_csv
# Parâmetros: { path: "questoes.csv" }

# 5. Preview do CSV
# Ferramenta: sample_rows
# Parâmetros: { path: "questoes.csv", n: 10 }

# 6. Importar no Anki usando o Ankimon add-on
```

## 📂 Estrutura do Projeto

```
ankinator-mcp/
├── src/
│   └── index.ts           # Código-fonte principal
├── dist/                  # Código compilado (gerado)
├── docs/                  # Documentação detalhada
│   ├── PDF_EXTRACTION_PROMPT.md  # Regras de extração
│   ├── USAGE.md                  # Guia de uso completo
│   └── MCP_CLIENT_CONFIG.md      # Configuração de clientes
├── examples/              # Fixtures de teste (TODO)
├── package.json
├── tsconfig.json
├── ROADMAP.md            # Planejamento de fases
├── CHANGELOG.md          # Histórico de mudanças
└── README.md             # Este arquivo
```

## 🔧 Scripts Disponíveis

```bash
npm run build    # Compila TypeScript para JavaScript
npm run dev      # Executa em modo desenvolvimento (tsx)
npm run start    # Executa código compilado
```

## 📖 Documentação Completa

- **[USAGE.md](./docs/USAGE.md)** - Guia completo de uso de todas as ferramentas
- **[PDF_EXTRACTION_PROMPT.md](./docs/PDF_EXTRACTION_PROMPT.md)** - Regras de extração rigorosa
- **[MCP_CLIENT_CONFIG.md](./docs/MCP_CLIENT_CONFIG.md)** - Configuração de clientes MCP
- **[ROADMAP.md](./ROADMAP.md)** - Planejamento e fases do projeto

## ⚙️ Configuração Avançada

### Variáveis de Ambiente

```bash
ANTHROPIC_API_KEY=sk-ant-...  # Obrigatório para extração de PDF
```

### Limites Padrão

| Parâmetro | Padrão | Máximo | Ferramenta |
|-----------|--------|--------|------------|
| maxQuestions | 20 | 100 | extrair_questoes |
| maxRows | 200 | 1000 | validar_csv |
| maxChars | 2000 | 8000 | extrair_secao |
| n (preview) | 5 | 10 | preview_questoes |

Estes limites podem ser ajustados nos parâmetros das ferramentas.

## 🐛 Troubleshooting

### Servidor não inicia

```bash
# Verificar compilação
npm run build

# Ver erros detalhados
npm run dev
```

### API key não funciona

```bash
# Verificar se está configurada
echo $ANTHROPIC_API_KEY

# Testar com key explícita
ANTHROPIC_API_KEY="sua-key" npm run dev
```

### Ferramentas não aparecem no cliente

1. Verificar path absoluto no config
2. Reiniciar o cliente MCP
3. Ver logs do cliente para erros de conexão

### PDF não processa

- ✅ Verificar se o PDF tem texto extraível (não é imagem escaneada)
- ✅ Testar com `preview_questoes` primeiro (menor uso de tokens)
- ✅ Limitar `maxQuestions` para PDFs grandes

📚 **Mais soluções:** Ver [docs/USAGE.md#troubleshooting](./docs/USAGE.md#troubleshooting)

## 🔒 Segurança

- ✅ Validação de paths (previne directory traversal)
- ✅ Truncamento automático de outputs
- ✅ API keys nunca são logadas
- ✅ Apenas leitura de arquivos locais

**Paths permitidos:**
- Raiz do projeto: `/home/t316360/plottwist/ankinator/`
- Ankimon add-on: `/home/t316360/plottwist/ankinator/ankimon/`
- Servidor MCP: `/home/t316360/plottwist/ankinator/ankinator-mcp/`

## 💰 Custos de API

Cada chamada a `extrair_questoes` consome tokens do Anthropic:

- PDF pequeno (10-20 páginas): ~$0.05-0.10
- PDF médio (50 páginas): ~$0.20-0.30
- PDF grande (100+ páginas): ~$0.50-1.00

**Dicas para economizar:**
- Use `preview_questoes` para testar antes
- Limite `maxQuestions` ao necessário
- Processe PDFs por capítulos/seções

## 🤝 Contribuindo

Este é um projeto em fase alpha. Contribuições são bem-vindas!

1. Fork o repositório
2. Crie uma branch: `git checkout -b feature/nova-funcionalidade`
3. Faça commit: `git commit -m 'Adiciona nova funcionalidade'`
4. Push: `git push origin feature/nova-funcionalidade`
5. Abra um Pull Request

### Desenvolvimento

```bash
# Instalar dependências de desenvolvimento
npm install

# Rodar em modo watch
npm run dev

# Testar mudanças
npm run build && npm run start
```

## 📋 Roadmap

- [x] Fase 0: Preparação
- [x] Fase 1: repo-briefing (documentação)
- [x] Fase 2: import-validator (CSV)
- [x] Fase 3: anki-refs (docs do Anki)
- [ ] Fase 4: release-notes
- [x] Fase 5: Integração e testes
- [x] Fase 6: pdf-to-questions (✅ **Implementado!**)

Ver [ROADMAP.md](./ROADMAP.md) para detalhes.

## 📄 Licença

Este projeto está sob a licença MIT. Ver arquivo [LICENSE](../LICENSE) para detalhes.

## 🙏 Agradecimentos

- Projeto [Ankimon](../ankimon/) - Add-on do Anki que inspirou este MCP
- [pdf-parse](https://github.com/mehmet-kozan/pdf-parse) - Extração de texto de PDFs
- [Anthropic Claude](https://www.anthropic.com/) - Geração de questões fidedignas
- Comunidade MCP - Protocol aberto para ferramentas de IA

## 📞 Suporte

- **Issues:** [GitHub Issues](https://github.com/your-username/ankinator/issues)
- **Documentação:** [docs/USAGE.md](./docs/USAGE.md)
- **Roadmap:** [ROADMAP.md](./ROADMAP.md)

---

**Status:** 🟡 Alpha (v0.1.0) - Funcional mas em desenvolvimento ativo

**Última atualização:** 2025-11-22
