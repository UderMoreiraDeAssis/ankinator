# Configuração do Servidor MCP Ankinator

## ✅ Status da Instalação

O servidor MCP **ankinator** está configurado e pronto para uso!

## 🔧 Configuração Atual

**Arquivo:** `.claude/mcp_settings.json`

```json
{
  "mcpServers": {
    "ankinator": {
      "command": "node",
      "args": ["ankinator-mcp/dist/index.js"],
      "env": {
        "ANTHROPIC_API_KEY": "SUA-API-KEY-AQUI"
      }
    }
  }
}
```

## 🔑 AÇÃO NECESSÁRIA: Configure sua API Key

**IMPORTANTE:** Você precisa substituir `"SUA-API-KEY-AQUI"` pela sua chave de API real da Anthropic.

### Como obter a API Key:

1. Acesse: https://console.anthropic.com/settings/keys
2. Crie uma nova API key (se ainda não tiver)
3. Copie a chave (começa com `sk-ant-...`)

### Como configurar:

**Opção A - Editar o arquivo diretamente:**

```bash
# Edite o arquivo mcp_settings.json
nano .claude/mcp_settings.json

# Substitua "SUA-API-KEY-AQUI" pela sua chave real
```

**Opção B - Usar variável de ambiente do sistema:**

Altere a configuração para:

```json
{
  "mcpServers": {
    "ankinator": {
      "command": "node",
      "args": ["ankinator-mcp/dist/index.js"],
      "env": {
        "ANTHROPIC_API_KEY": "${ANTHROPIC_API_KEY}"
      }
    }
  }
}
```

E configure no seu shell:

```bash
# Adicione ao ~/.bashrc ou ~/.zshrc
export ANTHROPIC_API_KEY="sk-ant-sua-chave-aqui"

# Recarregue
source ~/.bashrc
```

## 🔄 Ativar o Servidor MCP

Após configurar a API key:

1. **Recarregue o Claude Code:**
   - Pressione `Ctrl+Shift+P` (ou `Cmd+Shift+P` no Mac)
   - Digite: "Developer: Reload Window"
   - Ou simplesmente reinicie o VS Code

2. **Verifique se está funcionando:**
   - Em uma nova conversa com Claude, pergunte: "Quais ferramentas MCP estão disponíveis?"
   - Você deverá ver 14 ferramentas do ankinator listadas

## 🛠️ Ferramentas Disponíveis (14 total)

### Fase 1 - Documentação do Repositório
- `listar_docs` - Lista documentos principais do projeto
- `resumir_arvore` - Explora estrutura de diretórios
- `extrair_secao` - Extrai seções específicas de Markdown

### Fase 2 - Validação de CSV
- `validar_csv` - Valida formato de questões com schema Zod
- `sample_rows` - Preview de linhas do CSV
- `contar_campos` - Análise de campos e estatísticas

### Fase 3 - Referências do Anki
- `versoes_suportadas` - Lista versões compatíveis do Anki
- `instalacao_addon` - Guias de instalação de add-ons
- `anki_hooks` - Documentação de hooks do Anki

### Fase 4 - Release Notes e Roadmap
- `ultimas_mudancas` - Changelog formatado (MCP, Ankimon ou ambos)
- `roadmap` - Status e próximas ações do projeto

### Fase 6 - Extração de PDF (🌟 Core Feature)
- `extrair_questoes` - Extrai questões Q:/A: fidedignas de PDFs
- `preview_questoes` - Preview rápido antes de processamento completo
- `converter_para_csv` - Converte Q:/A: para CSV validável

## 💡 Exemplos de Uso

### Exemplo 1: Extrair questões de um PDF

```
Você: Use a ferramenta extrair_questoes para processar o PDF
curso-230987-aula-01-grifado-a09d.pdf e gere até 30 questões.

Claude: [Chama a ferramenta MCP extrair_questoes automaticamente]
```

### Exemplo 2: Validar um CSV antes de importar

```
Você: Valide o arquivo questoes.csv usando a ferramenta validar_csv

Claude: [Chama validar_csv e mostra resultados]
```

### Exemplo 3: Ver roadmap do projeto

```
Você: Mostre o roadmap completo do projeto

Claude: [Chama roadmap com incluir_completas: true]
```

## 🐛 Troubleshooting

### Servidor não aparece após reload

1. Verifique se a API key foi configurada corretamente
2. Verifique se o caminho está correto: `ankinator-mcp/dist/index.js`
3. Verifique se o arquivo foi compilado: `ls ankinator-mcp/dist/index.js`
4. Veja os logs do Claude Code: `Help > Toggle Developer Tools > Console`

### Erro "ANTHROPIC_API_KEY não configurada"

- Certifique-se de substituir `"SUA-API-KEY-AQUI"` pela chave real
- Se usar variável de ambiente, verifique: `echo $ANTHROPIC_API_KEY`

### Ferramentas não funcionam

1. Recompile o servidor: `cd ankinator-mcp && npm run build`
2. Reinicie o Claude Code completamente
3. Verifique a console de desenvolvedor para erros

## 📊 Custos da API

Cada chamada a `extrair_questoes` ou `preview_questoes` consome tokens:

- PDF pequeno (10-20 páginas): ~$0.05-0.10
- PDF médio (50 páginas): ~$0.20-0.30
- PDF grande (100+ páginas): ~$0.50-1.00

**Dicas:**
- Use `preview_questoes` para testar antes (mais barato)
- Limite `maxQuestions` ao necessário
- Processe PDFs por seções

## 📚 Documentação Completa

- [README.md](../ankinator-mcp/README.md) - Visão geral do projeto
- [USAGE.md](../ankinator-mcp/docs/USAGE.md) - Guia completo de todas as ferramentas
- [MCP_CLIENT_CONFIG.md](../ankinator-mcp/docs/MCP_CLIENT_CONFIG.md) - Configurações detalhadas

## 🎯 Próximos Passos

1. ✅ Configurar API key no mcp_settings.json
2. ✅ Recarregar Claude Code
3. ✅ Testar extraindo questões de um PDF
4. ✅ Validar o CSV gerado
5. ✅ Importar no Anki usando o add-on Ankimon

---

**Status:** Configurado e pronto para uso (após adicionar API key)
**Versão:** 0.1.0-alpha
**Última atualização:** 2025-11-22
