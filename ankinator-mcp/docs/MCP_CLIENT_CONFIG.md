# Configuração de Clientes MCP

Este guia detalha como configurar diferentes clientes MCP para usar o servidor **ankinator-mcp**.

## Índice

- [Claude Desktop](#claude-desktop)
  - [macOS](#macos)
  - [Windows](#windows)
  - [Linux](#linux)
- [Claude Code](#claude-code)
- [Outros Clientes MCP](#outros-clientes-mcp)
- [Troubleshooting](#troubleshooting)
- [Verificação](#verificação)

---

## Claude Desktop

### macOS

**Localização do arquivo de configuração:**
```
~/Library/Application Support/Claude/claude_desktop_config.json
```

**Passos:**

1. **Abrir/Criar o arquivo de configuração:**
```bash
# Criar diretório se não existir
mkdir -p ~/Library/Application\ Support/Claude/

# Editar arquivo (use seu editor preferido)
nano ~/Library/Application\ Support/Claude/claude_desktop_config.json
```

2. **Adicionar configuração do ankinator-mcp:**
```json
{
  "mcpServers": {
    "ankinator": {
      "command": "node",
      "args": ["/Users/SEU_USUARIO/caminho/para/ankinator/ankinator-mcp/dist/index.js"],
      "env": {
        "ANTHROPIC_API_KEY": "sk-ant-api03-sua-key-aqui"
      }
    }
  }
}
```

**⚠️ IMPORTANTE:**
- Substitua `/Users/SEU_USUARIO/caminho/para/ankinator` pelo **path absoluto** do projeto
- Substitua `sk-ant-api03-sua-key-aqui` pela sua **Anthropic API key real**
- O path deve apontar para `dist/index.js` (código compilado)

3. **Obter o path absoluto correto:**
```bash
cd /caminho/para/ankinator/ankinator-mcp
pwd
# Output: /Users/joao/projetos/ankinator/ankinator-mcp
# Use: /Users/joao/projetos/ankinator/ankinator-mcp/dist/index.js
```

4. **Reiniciar Claude Desktop:**
- Feche completamente o Claude Desktop (Cmd+Q)
- Abra novamente
- Verifique se o servidor aparece conectado

---

### Windows

**Localização do arquivo de configuração:**
```
%APPDATA%\Claude\claude_desktop_config.json
```

**Passos:**

1. **Abrir/Criar o arquivo de configuração:**
```powershell
# No PowerShell ou Explorador de Arquivos, navegue até:
# C:\Users\SEU_USUARIO\AppData\Roaming\Claude\

# Editar arquivo (pode usar Notepad)
notepad %APPDATA%\Claude\claude_desktop_config.json
```

2. **Adicionar configuração do ankinator-mcp:**
```json
{
  "mcpServers": {
    "ankinator": {
      "command": "node",
      "args": ["C:\\Users\\SEU_USUARIO\\projetos\\ankinator\\ankinator-mcp\\dist\\index.js"],
      "env": {
        "ANTHROPIC_API_KEY": "sk-ant-api03-sua-key-aqui"
      }
    }
  }
}
```

**⚠️ IMPORTANTE:**
- Use **barras invertidas duplas** (`\\`) no Windows
- Path deve ser absoluto (ex: `C:\\Users\\joao\\...`)
- Substitua a API key pela sua chave real

3. **Obter o path absoluto correto:**
```powershell
cd C:\Users\SEU_USUARIO\projetos\ankinator\ankinator-mcp
pwd
# Output: C:\Users\joao\projetos\ankinator\ankinator-mcp
# Use: C:\\Users\\joao\\projetos\\ankinator\\ankinator-mcp\\dist\\index.js
```

4. **Reiniciar Claude Desktop:**
- Feche o Claude Desktop completamente
- Abra novamente
- Verifique conexão

---

### Linux

**Localização do arquivo de configuração:**
```
~/.config/Claude/claude_desktop_config.json
```

**Passos:**

1. **Abrir/Criar o arquivo de configuração:**
```bash
# Criar diretório se não existir
mkdir -p ~/.config/Claude/

# Editar arquivo
nano ~/.config/Claude/claude_desktop_config.json
# ou use: vim, gedit, kate, etc.
```

2. **Adicionar configuração do ankinator-mcp:**
```json
{
  "mcpServers": {
    "ankinator": {
      "command": "node",
      "args": ["/home/SEU_USUARIO/projetos/ankinator/ankinator-mcp/dist/index.js"],
      "env": {
        "ANTHROPIC_API_KEY": "sk-ant-api03-sua-key-aqui"
      }
    }
  }
}
```

**⚠️ IMPORTANTE:**
- Use path absoluto completo
- Substitua `SEU_USUARIO` pelo seu username
- Adicione sua API key real

3. **Obter o path absoluto correto:**
```bash
cd ~/projetos/ankinator/ankinator-mcp
pwd
# Output: /home/joao/projetos/ankinator/ankinator-mcp
# Use: /home/joao/projetos/ankinator/ankinator-mcp/dist/index.js
```

4. **Reiniciar Claude Desktop:**
```bash
# Fechar Claude Desktop
pkill -f "Claude Desktop"

# Abrir novamente (método depende da sua distribuição)
claude-desktop  # ou via menu de aplicativos
```

---

## Claude Code

**Localização do arquivo de configuração:**
```
.claude/mcp_settings.json
```
(na raiz do seu workspace/projeto)

**Passos:**

1. **Criar diretório .claude no workspace:**
```bash
cd /caminho/para/seu/workspace
mkdir -p .claude
```

2. **Criar/Editar mcp_settings.json:**
```bash
nano .claude/mcp_settings.json
```

3. **Adicionar configuração:**

**Opção A: Path Relativo** (se ankinator estiver no mesmo workspace)
```json
{
  "mcpServers": {
    "ankinator": {
      "command": "node",
      "args": ["./ankinator/ankinator-mcp/dist/index.js"],
      "env": {
        "ANTHROPIC_API_KEY": "sk-ant-api03-sua-key-aqui"
      }
    }
  }
}
```

**Opção B: Path Absoluto** (mais confiável)
```json
{
  "mcpServers": {
    "ankinator": {
      "command": "node",
      "args": ["/caminho/absoluto/para/ankinator/ankinator-mcp/dist/index.js"],
      "env": {
        "ANTHROPIC_API_KEY": "sk-ant-api03-sua-key-aqui"
      }
    }
  }
}
```

4. **Reload do Claude Code:**
- Pressione `Cmd+Shift+P` (macOS) ou `Ctrl+Shift+P` (Windows/Linux)
- Digite: "Claude Code: Reload Window"
- Ou feche e reabra o VS Code

---

## Outros Clientes MCP

### Configuração Genérica

Qualquer cliente MCP compatível com o protocolo pode usar o ankinator-mcp:

```json
{
  "command": "node",
  "args": ["/path/absoluto/ankinator-mcp/dist/index.js"],
  "env": {
    "ANTHROPIC_API_KEY": "sua-api-key"
  }
}
```

**Requisitos mínimos do cliente:**
- Suporte ao MCP protocol (stdio transport)
- Capacidade de executar comandos Node.js
- Suporte a variáveis de ambiente

---

## Troubleshooting

### ❌ Servidor não aparece no cliente

**Problema:** Cliente MCP não mostra o servidor "ankinator" conectado.

**Soluções:**

1. **Verificar compilação:**
```bash
cd /caminho/para/ankinator-mcp
npm run build
# Deve criar dist/index.js sem erros
```

2. **Testar execução manual:**
```bash
node /caminho/absoluto/dist/index.js
# Não deve dar erro
```

3. **Verificar path no config:**
- Path deve ser absoluto (não relativo)
- Path deve apontar para `dist/index.js` (compilado)
- No Windows, use `\\` (barras duplas)

4. **Verificar permissões:**
```bash
ls -l /caminho/para/ankinator-mcp/dist/index.js
# Arquivo deve ter permissão de leitura
```

5. **Ver logs do cliente MCP:**
- **Claude Desktop (macOS):** `~/Library/Logs/Claude/`
- **Claude Desktop (Windows):** `%APPDATA%\Claude\Logs\`
- **Claude Desktop (Linux):** `~/.config/Claude/logs/`

---

### ❌ Erro "ANTHROPIC_API_KEY não configurada"

**Problema:** Ferramentas de PDF retornam erro sobre API key.

**Soluções:**

1. **Verificar key no config:**
```json
"env": {
  "ANTHROPIC_API_KEY": "sk-ant-api03-VERIFICAR-SE-ESTA-CERTO"
}
```

2. **Testar key manualmente:**
```bash
export ANTHROPIC_API_KEY="sua-key"
node dist/index.js
```

3. **Formato da key:**
- Deve começar com `sk-ant-api03-` ou similar
- Sem espaços extras
- Sem aspas dentro do valor JSON

4. **Obter nova key:**
- Acesse: https://console.anthropic.com/settings/keys
- Gere uma nova API key se necessário

---

### ❌ Ferramentas não executam / Timeout

**Problema:** Ferramentas demoram muito ou não respondem.

**Soluções:**

1. **PDFs grandes:**
- Use `preview_questoes` primeiro (processa menos texto)
- Limite `maxQuestions` para valores menores
- Processe PDFs por seções

2. **Verificar conexão de rede:**
```bash
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: sua-key" \
  -H "anthropic-version: 2023-06-01"
# Deve retornar erro 400 (esperado sem body), não timeout
```

3. **Logs do servidor:**
```bash
# Executar em modo dev para ver logs
cd ankinator-mcp
npm run dev
# Ver erros detalhados no console
```

---

### ❌ Path inválido / Arquivo não encontrado

**Problema:** Ferramentas retornam "Path fora da zona permitida".

**Soluções:**

1. **Usar paths relativos:**
```
# ✅ CORRETO (relativo à raiz do projeto)
"path": "aulas/matematica.pdf"

# ❌ ERRADO
"path": "/absolute/path/outside/project.pdf"
```

2. **Paths permitidos:**
- Raiz do projeto ankinator
- Subpasta ankimon
- Subpasta ankinator-mcp

3. **Verificar localização do arquivo:**
```bash
ls /home/t316360/plottwist/ankinator/aulas/matematica.pdf
# Deve existir
```

---

## Verificação

### Como saber se está funcionando?

**1. Verificar conexão do servidor:**
- No Claude Desktop: Ver lista de MCPs conectados
- No Claude Code: Ver status na barra inferior

**2. Testar uma ferramenta simples:**
```
Ferramenta: listar_docs
Parâmetros: {}
```

Deve retornar lista de documentos do projeto.

**3. Testar ferramenta de PDF (se tiver API key):**
```
Ferramenta: preview_questoes
Parâmetros: {
  "path": "examples/sample.pdf",
  "n": 3
}
```

Deve retornar preview de 3 questões.

---

## Configurações Adicionais

### Múltiplos Servidores MCP

Você pode ter vários servidores MCP configurados:

```json
{
  "mcpServers": {
    "ankinator": {
      "command": "node",
      "args": ["/path/to/ankinator-mcp/dist/index.js"],
      "env": {
        "ANTHROPIC_API_KEY": "sua-key"
      }
    },
    "outro-servidor": {
      "command": "python",
      "args": ["/path/to/outro/server.py"]
    }
  }
}
```

### Variáveis de Ambiente do Sistema

Alternativamente, configure a API key no sistema:

**macOS/Linux:**
```bash
# Adicionar ao ~/.bashrc ou ~/.zshrc
export ANTHROPIC_API_KEY="sk-ant-api03-sua-key"
```

**Windows:**
```powershell
# PowerShell (permanente)
[System.Environment]::SetEnvironmentVariable('ANTHROPIC_API_KEY', 'sk-ant-api03-sua-key', 'User')
```

Então no config MCP, omita a seção `env`.

---

## Exemplos Completos

### Exemplo 1: macOS com API key no sistema

**~/.bashrc:**
```bash
export ANTHROPIC_API_KEY="sk-ant-api03-ABC123..."
```

**~/Library/Application Support/Claude/claude_desktop_config.json:**
```json
{
  "mcpServers": {
    "ankinator": {
      "command": "node",
      "args": ["/Users/joao/projetos/ankinator/ankinator-mcp/dist/index.js"]
    }
  }
}
```

### Exemplo 2: Windows com path relativo (Claude Code)

**Estrutura:**
```
C:\workspace\
  ├── .claude\
  │   └── mcp_settings.json
  └── ankinator\
      └── ankinator-mcp\
          └── dist\
              └── index.js
```

**.claude/mcp_settings.json:**
```json
{
  "mcpServers": {
    "ankinator": {
      "command": "node",
      "args": ["..\\ankinator\\ankinator-mcp\\dist\\index.js"],
      "env": {
        "ANTHROPIC_API_KEY": "sk-ant-api03-XYZ789..."
      }
    }
  }
}
```

### Exemplo 3: Linux multi-usuário

**Sistema compartilhado onde cada usuário tem sua key:**

```json
{
  "mcpServers": {
    "ankinator": {
      "command": "node",
      "args": ["/opt/ankinator/ankinator-mcp/dist/index.js"],
      "env": {
        "ANTHROPIC_API_KEY": "${ANTHROPIC_API_KEY}"
      }
    }
  }
}
```

Cada usuário configura sua key:
```bash
echo 'export ANTHROPIC_API_KEY="sk-ant-api03-..."' >> ~/.bashrc
```

---

## Segurança

### ⚠️ Proteção da API Key

**NUNCA:**
- Commitar arquivo de config com API key para git
- Compartilhar API key publicamente
- Usar API key em ambientes não confiáveis

**SEMPRE:**
- Usar variáveis de ambiente quando possível
- Adicionar `*_config.json` ao `.gitignore`
- Rotacionar keys comprometidas imediatamente

### Exemplo de .gitignore

```gitignore
# MCP configs com secrets
**/claude_desktop_config.json
**/.claude/mcp_settings.json
.env
```

---

**Última atualização:** 2025-11-22
**Versão do guia:** 1.0
**Compatível com:** ankinator-mcp v0.1.0
