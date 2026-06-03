# Guia de Uso - Ankinator MCP

## Visão Geral

O **ankinator-mcp** é um servidor MCP (Model Context Protocol) que fornece ferramentas especializadas para criar, validar e gerenciar conteúdo de flashcards para o Anki, com foco em fidelidade ao material original.

## Pipeline Completo

```
📚 Material PDF
    ↓ (Fase 6)
📝 Questões Q:/A:
    ↓ (Fase 6)
📊 CSV estruturado
    ↓ (Fase 2)
✅ CSV validado
    ↓
🗂️ Anki flashcards
```

## Configuração Inicial

### 1. Instalação

```bash
cd ankinator-mcp
npm install
npm run build
```

### 2. Configurar API Key (para Fase 6)

```bash
export ANTHROPIC_API_KEY="sua-api-key-aqui"
```

Ou crie um arquivo `.env`:
```
ANTHROPIC_API_KEY=sua-api-key-aqui
```

### 3. Iniciar o servidor MCP

```bash
npm run dev
```

## Ferramentas Disponíveis

### Fase 1: Documentação do Repositório (`repo-briefing`)

#### `listar_docs`
Lista todos os documentos principais do projeto.

**Uso:**
```json
{
  "tool": "listar_docs"
}
```

**Output:**
```
- README.md — Ankinator: Pokémon no Anki
- ankimon/README.md — Ankimon Add-on
- ankimon/HowToStart.md — Como Começar
- ankimon/CONFIG.md — Configuração
- ankimon/update_txt.md — Histórico de Atualizações
```

#### `resumir_arvore`
Resume a estrutura de diretórios com arquivos de documentação.

**Parâmetros:**
- `base`: `'root'` | `'ankimon'` | `'server'` (padrão: `'root'`)

**Uso:**
```json
{
  "tool": "resumir_arvore",
  "arguments": {
    "base": "ankimon"
  }
}
```

**Output:**
```
📁 src
📁 addon_files
📁 addon_sprites
📄 README.md
📄 HowToStart.md
📄 CONFIG.md
📄 update_txt.md
```

#### `extrair_secao`
Extrai uma seção específica de um arquivo Markdown.

**Parâmetros:**
- `path`: Caminho do arquivo (relativo ou absoluto)
- `titulo`: Título exato da seção (sem `#`)
- `maxChars`: Limite de caracteres (padrão: 2000, máx: 8000)

**Uso:**
```json
{
  "tool": "extrair_secao",
  "arguments": {
    "path": "ankimon/README.md",
    "titulo": "Instalação",
    "maxChars": 1000
  }
}
```

---

### Fase 2: Validação de CSV (`import-validator`)

#### `validar_csv`
Valida formato de questões em CSV usando schema Zod.

**Parâmetros:**
- `path`: Caminho do arquivo CSV
- `maxRows`: Limite de linhas a processar (padrão: 200, máx: 1000)

**Schema esperado:**
```csv
pergunta,resposta,opcoes,dificuldade,categoria
"Qual é...","A resposta...","",facil,"Matemática"
```

**Campos:**
- `pergunta` (obrigatório): Texto da pergunta
- `resposta` (obrigatório): Texto da resposta
- `opcoes` (opcional): Opções para múltipla escolha
- `dificuldade` (opcional): `facil` | `medio` | `dificil` | `muito_dificil`
- `categoria` (opcional): Categoria/tag da questão

**Uso:**
```json
{
  "tool": "validar_csv",
  "arguments": {
    "path": "questoes.csv",
    "maxRows": 100
  }
}
```

**Output:**
```
Total: 100 linhas | Válidas: 98 | Inválidas: 2

Erros encontrados:
Linha 15: pergunta: Pergunta não pode ser vazia
Linha 42: dificuldade: Invalid enum value. Expected 'facil' | 'medio' | 'dificil' | 'muito_dificil', received 'hard'
```

#### `sample_rows`
Visualiza as primeiras N linhas do CSV.

**Parâmetros:**
- `path`: Caminho do arquivo CSV
- `n`: Número de linhas a exibir (padrão: 5, máx: 50)

**Uso:**
```json
{
  "tool": "sample_rows",
  "arguments": {
    "path": "questoes.csv",
    "n": 3
  }
}
```

**Output:**
```
Mostrando 3 de 100 linhas:

Linha 1:
  pergunta: O que é Git?
  resposta: Um sistema de controle de versão distribuído
  categoria: Git

Linha 2:
  pergunta: Quem criou o Git?
  resposta: Linus Torvalds
  categoria: Git

Linha 3:
  pergunta: Quando foi criado o Git?
  resposta: Em 2005
  categoria: Git
```

#### `contar_campos`
Análise de campos e estatísticas do CSV.

**Parâmetros:**
- `path`: Caminho do arquivo CSV

**Uso:**
```json
{
  "tool": "contar_campos",
  "arguments": {
    "path": "questoes.csv"
  }
}
```

**Output:**
```
Análise do CSV:
- Total de linhas: 100
- Total de colunas: 5
- Colunas: pergunta, resposta, opcoes, dificuldade, categoria

Campos vazios por coluna:
  pergunta: 0 vazios
  resposta: 0 vazios
  opcoes: 85 vazios
  dificuldade: 25 vazios
  categoria: 10 vazios
```

---

### Fase 3: Referências do Anki (`anki-refs`)

Ferramentas que retornam documentação estática do Anki em Markdown, sem dependência de rede.

#### `versoes_suportadas`
Lista versões do Anki compatíveis com add-ons, incluindo requisitos e breaking changes.

**Parâmetros:**
- `incluir_breaking_changes`: boolean (padrão: `true`) - Incluir breaking changes nas versões

**Uso:**
```json
{
  "tool": "versoes_suportadas",
  "arguments": {
    "incluir_breaking_changes": true
  }
}
```

**Output:**
```markdown
## Versões do Anki Suportadas

**Versão mínima recomendada:** 2.1.66
**Versão máxima testada:** 24.04.1

### Versões Detalhadas

#### 2.1.66 (stable) - 2024-07-12
**Compatibilidade:**
- python: 3.9+
- qt: PyQt6
- pyqt5_descontinuado: true

**Breaking Changes:**
- PyQt5 não é mais suportado - migração obrigatória para PyQt6
- Hook reviewer_will_show_question descontinuado
- Mudanças na estrutura de templates de cards

---
```

**Caso de uso típico:**
- Escrever seção de "Requisitos" do README
- Documentar compatibilidade de add-ons
- Informar usuários sobre breaking changes entre versões

---

#### `instalacao_addon`
Retorna guia de instalação de add-ons do Anki em Markdown, pronto para README.

**Parâmetros:**
- `tipo`: 'geral' | 'manual' | 'ankimon' (padrão: `'geral'`) - Tipo de instalação
- `incluir_troubleshooting`: boolean (padrão: `true`) - Incluir seção de troubleshooting

**Uso (instalação geral):**
```json
{
  "tool": "instalacao_addon",
  "arguments": {
    "tipo": "geral",
    "incluir_troubleshooting": true
  }
}
```

**Output:**
```markdown
## Instalação de Add-ons no Anki

### Passos de Instalação

1. **Abrir o Anki Desktop**
   - Certifique-se de que o Anki está instalado e aberto

2. **Acessar menu de add-ons**
   - Menu: Tools → Add-ons (Ctrl+Shift+A no Windows/Linux, Cmd+Shift+A no macOS)

3. **Instalar add-on**
   - Clique em 'Get Add-ons...' e insira o código do AnkiWeb

4. **Reiniciar o Anki**
   - Após instalação, feche e reabra o Anki para ativar o add-on

### Troubleshooting

**erro pyqt5:**
- **Sintoma:** Add-on não carrega ou erro 'PyQt5 is not supported'
- **Solução:** Atualize para Anki 2.1.66+ com PyQt6...
```

**Uso (instalação do Ankimon):**
```json
{
  "tool": "instalacao_addon",
  "arguments": {
    "tipo": "ankimon",
    "incluir_troubleshooting": false
  }
}
```

**Output:**
```markdown
## Instalação do Ankimon

**Código AnkiWeb:** 1908235722

### Requisitos
- Anki 2.1.66+ (PyQt6 obrigatório)
- PyQt5 NÃO é suportado
- Linux: usar pacote oficial do GitHub, não flatpak ou pacotes de distro
- Conexão com internet para download de recursos extras (~50MB)

### Passos de Instalação

1. **Instalar via AnkiWeb código 1908235722**
   - Siga os passos de instalação geral (Tools → Add-ons → Get Add-ons → código 1908235722)

2. **Fechar e reabrir Anki**
   - IMPORTANTE: Primeiro restart após instalação para carregar o add-on

3. **Baixar arquivos extras**
   - Menu: Ankimon → Download extra Resource Files (Data, Sprites, Badges) - cerca de 50MB

4. **Fechar e reabrir Anki novamente**
   - Segundo restart após download dos recursos para carregar assets

5. **Escolher starter Pokémon**
   - Diálogo de seleção aparecerá automaticamente na primeira execução

6. **Reiniciar Anki pela última vez**
   - Terceiro e último restart - Ankimon estará pronto para uso
```

**Caso de uso típico:**
- Escrever seção de "Instalação" do README
- Documentar processo de setup de add-ons
- Fornecer troubleshooting para usuários

---

#### `anki_hooks`
Lista hooks disponíveis do Anki com descrições, parâmetros e exemplos.

**Parâmetros:**
- `categoria`: 'reviewer' | 'webview' | 'config' | 'sync' | 'media' | 'todos' (padrão: `'todos'`)
- `apenas_usados_ankimon`: boolean (padrão: `false`) - Filtrar apenas hooks usados no Ankimon
- `incluir_exemplos`: boolean (padrão: `true`) - Incluir exemplos de código
- `versao_anki`: string (opcional) - Filtrar por versão do Anki (ex: "2.1.66")

**Uso (todos os hooks):**
```json
{
  "tool": "anki_hooks",
  "arguments": {
    "categoria": "todos",
    "incluir_exemplos": true
  }
}
```

**Output:**
```markdown
## Hooks do Anki Disponíveis

**Total de hooks:** 11
**Categorias:**
- **reviewer:** Hooks relacionados ao revisor de cards
- **webview:** Hooks para modificar interface HTML/CSS/JS
- **config:** Hooks de configuração de add-ons
- **sync:** Hooks de sincronização
- **media:** Hooks de mídia (áudio/vídeo)

---

### gui_hooks.reviewer_did_show_question
**Categoria:** reviewer
**Usado no Ankimon:** ✅ Sim

**Descrição:**
Disparado após a pergunta ser exibida no revisor

**Parâmetros:**
- `card` (Card): Objeto do card sendo revisado

**Uso Comum:**
- Injetar HTML/CSS adicional na questão
- Modificar aparência do card
- Iniciar cronômetros ou estatísticas
- Gamificação: mostrar elementos visuais ao iniciar uma questão

**Exemplo:**
```python
gui_hooks.reviewer_did_show_question.append(on_show_question)
```

---
```

**Uso (filtrado por categoria):**
```json
{
  "tool": "anki_hooks",
  "arguments": {
    "categoria": "reviewer",
    "apenas_usados_ankimon": true,
    "incluir_exemplos": false
  }
}
```

**Output:**
Retorna apenas hooks da categoria "reviewer" que são usados no Ankimon, sem exemplos de código.

**Uso (filtrado por versão):**
```json
{
  "tool": "anki_hooks",
  "arguments": {
    "categoria": "todos",
    "versao_anki": "2.1.66"
  }
}
```

**Output:**
Retorna apenas hooks disponíveis no Anki 2.1.66 (filtra hooks descontinuados ou não disponíveis nessa versão).

**Caso de uso típico:**
- Documentar hooks usados em add-ons (seção "Arquitetura Técnica")
- Escrever guias de desenvolvimento de add-ons
- Ajudar desenvolvedores a encontrar hooks relevantes
- Referência rápida durante desenvolvimento

---

### Fase 4: Release Notes e Roadmap (`release-notes`)

Ferramentas para acessar changelog e roadmap do projeto, úteis para documentação e planejamento.

#### `ultimas_mudancas`

Lê e formata changelog do projeto (ankinator-mcp, ankimon ou ambos) em bullets cronológicos.

**Parâmetros:**
- `fonte` (string, default: 'ankinator-mcp'): Qual changelog ler
  - `'ankinator-mcp'`: Servidor MCP
  - `'ankimon'`: Add-on do Anki
  - `'ambos'`: Merge de ambos os changelogs
- `limite_versoes` (number, default: 3, máx: 10): Quantas versões mostrar
- `incluir_unreleased` (boolean, default: false): Incluir mudanças não lançadas
- `formato` (string, default: 'bullets'): 'markdown' ou 'bullets'

**Uso:**
```json
{
  "tool": "ultimas_mudancas",
  "arguments": {
    "fonte": "ankinator-mcp",
    "limite_versoes": 3
  }
}
```

**Output:**
```markdown
**[0.1.0-alpha]** - 2025-11-22
  - **Added:**
    - 14 ferramentas MCP implementadas
    - Documentação completa (~3600 linhas)
  - **Testing:**
    - 100% taxa de sucesso (20/20 testes)

📝 **Sugestão de inserção no README:**

1. **Opção A - Seção dedicada:**
   Criar seção "## 📋 Changelog" após a seção "## Instalação".
   Inserir os bullets de versões mais recentes (últimas 2-3 versões).
   Adicionar link: "Ver histórico completo em [CHANGELOG.md](./CHANGELOG.md)"

2. **Opção B - Badge/Link:**
   Adicionar badge de versão no topo do README apontando para CHANGELOG.md

3. **Opção C - Footer:**
   Adicionar link no rodapé da documentação na seção "Documentação Completa"
```

**Exemplos:**
```json
// Últimas 3 versões do MCP
{
  "tool": "ultimas_mudancas",
  "arguments": {
    "fonte": "ankinator-mcp",
    "limite_versoes": 3
  }
}

// Changelog completo do Ankimon
{
  "tool": "ultimas_mudancas",
  "arguments": {
    "fonte": "ankimon",
    "limite_versoes": 10,
    "formato": "markdown"
  }
}

// Ambos projetos, incluindo unreleased
{
  "tool": "ultimas_mudancas",
  "arguments": {
    "fonte": "ambos",
    "incluir_unreleased": true
  }
}
```

**Casos de uso:**
- Gerar release notes para README.md
- Documentar histórico de versões
- Comunicar mudanças recentes aos usuários
- Criar seção de changelog automatizada

---

#### `roadmap`

Lê e formata roadmap do projeto com status, próximas ações e riscos conhecidos.

**Parâmetros:**
- `incluir_completas` (boolean, default: false): Incluir fases completas no output
- `apenas_proximas` (boolean, default: true): Mostrar apenas próximas ações
- `formato` (string, default: 'bullets'): 'markdown' ou 'bullets'

**Uso:**
```json
{
  "tool": "roadmap",
  "arguments": {
    "apenas_proximas": true
  }
}
```

**Output:**
```markdown
## Status do Projeto

**Progresso:** 71% completo
**Fases completas:** 5/7

### Próximas Ações:

- Fase 4 - MCP release-notes (changelog automatizado)
- Code review de error handling
- Performance optimization

### Riscos Conhecidos:

- Saída longa: aplicar truncamento e avisos amigáveis
- Paths inválidos: mensagens de erro sugestivas
- CSV grande: limitar leitura prévia

📝 **Sugestão de inserção no README:**

1. **Opção A - Seção "Roadmap":**
   Criar seção "## 🗺️ Roadmap" após "## Features" ou "## Funcionalidades".
   Inserir progresso percentual e próximas ações em formato de lista.

2. **Opção B - Badge de progresso:**
   Adicionar badge visual de progresso no topo:
   ![Progresso](https://img.shields.io/badge/progresso-71%25-brightgreen)

3. **Opção C - Seção "Status do Projeto":**
   Criar seção "## 📊 Status do Projeto" mostrando:
   - Fases completas vs. totais
   - Próximas 3 ações planejadas
   - Link para ROADMAP.md completo
```

**Exemplos:**
```json
// Próximas ações apenas
{
  "tool": "roadmap",
  "arguments": {
    "apenas_proximas": true
  }
}

// Roadmap completo com todas as fases
{
  "tool": "roadmap",
  "arguments": {
    "incluir_completas": true,
    "apenas_proximas": false,
    "formato": "markdown"
  }
}
```

**Casos de uso:**
- Mostrar progresso do projeto
- Planejar próximas features
- Comunicar status atual aos stakeholders
- Gerar seção de roadmap para README.md
- Identificar riscos conhecidos antes de implementação

---

### Fase 6: Extração de Questões de PDF (`pdf-to-questions`)

#### `extrair_questoes`
Extrai questões fidedignas de um PDF usando prompt rigoroso.

**Parâmetros:**
- `path`: Caminho do arquivo PDF
- `maxQuestions`: Número máximo de questões a gerar (padrão: 20, máx: 100)

**Uso:**
```json
{
  "tool": "extrair_questoes",
  "arguments": {
    "path": "aulas/matematica-aula01.pdf",
    "maxQuestions": 30
  }
}
```

**Output:**
```
Questões extraídas (30):

Q: O que é um conjunto?
A: Uma coleção de elementos bem definidos

Q: Qual é o símbolo usado para representar pertinência?
A: ∈

Q: O que significa A ⊂ B?
A: A é subconjunto de B

[... mais questões ...]

[INFO: 30 questões geradas. Revisão manual recomendada antes da importação.]
```

**Importante:**
- ✅ Extração fiel ao PDF sem interpretações
- ✅ Lacunas sinalizadas ao invés de completadas
- ✅ Formato Q:/A: pronto para conversão
- ⚠️ Requer ANTHROPIC_API_KEY configurada

#### `preview_questoes`
Preview das primeiras questões antes de processar o PDF completo.

**Parâmetros:**
- `path`: Caminho do arquivo PDF
- `n`: Número de questões de preview (padrão: 5, máx: 10)

**Uso:**
```json
{
  "tool": "preview_questoes",
  "arguments": {
    "path": "aulas/matematica-aula01.pdf",
    "n": 3
  }
}
```

**Output:**
```
Preview (primeiras 3 questões do PDF):

Q: O que é um conjunto?
A: Uma coleção de elementos bem definidos

Q: Qual é o símbolo usado para representar pertinência?
A: ∈

Q: O que significa A ⊂ B?
A: A é subconjunto de B

[Preview OK. Use 'extrair_questoes' para processar o PDF completo.]
```

#### `converter_para_csv`
Converte questões Q:/A: para formato CSV validável.

**Parâmetros:**
- `questoes`: String com questões no formato Q:/A:
- `categoria`: Categoria/tag padrão para todas as questões (opcional)

**Uso:**
```json
{
  "tool": "converter_para_csv",
  "arguments": {
    "questoes": "Q: O que é Git?\nA: Sistema de controle de versão\n\nQ: Quem criou Git?\nA: Linus Torvalds",
    "categoria": "Git"
  }
}
```

**Output:**
```csv
pergunta,resposta,categoria
"O que é Git?","Sistema de controle de versão","Git"
"Quem criou Git?","Linus Torvalds","Git"
```

---

## Workflows Comuns

### Workflow 1: PDF → Anki (completo)

```bash
# 1. Preview do PDF
mcp call preview_questoes --path aula.pdf --n 5

# 2. Extrair todas as questões
mcp call extrair_questoes --path aula.pdf --maxQuestions 50

# 3. Converter para CSV
mcp call converter_para_csv --questoes "[output anterior]" --categoria "Física"

# 4. Salvar CSV em arquivo (questoes.csv)

# 5. Validar CSV
mcp call validar_csv --path questoes.csv

# 6. Visualizar amostra
mcp call sample_rows --path questoes.csv --n 10

# 7. Importar no Anki usando o addon Ankimon
```

### Workflow 2: Validar CSV existente

```bash
# 1. Análise geral
mcp call contar_campos --path questoes.csv

# 2. Validação completa
mcp call validar_csv --path questoes.csv --maxRows 1000

# 3. Preview das linhas
mcp call sample_rows --path questoes.csv --n 20

# 4. Corrigir erros e re-validar
```

### Workflow 3: Explorar documentação do projeto

```bash
# 1. Listar documentos disponíveis
mcp call listar_docs

# 2. Explorar estrutura
mcp call resumir_arvore --base root

# 3. Extrair seção específica
mcp call extrair_secao --path README.md --titulo "Instalação"
```

## Tratamento de Erros

### Erros Comuns e Soluções

#### `ANTHROPIC_API_KEY não configurada`
```
Erro: ANTHROPIC_API_KEY não encontrada. Configure a variável de ambiente.

Solução:
export ANTHROPIC_API_KEY="sua-key-aqui"
```

#### `Path fora da zona permitida`
```
Erro: Path fora da zona permitida. Use caminhos sob: ., ankimon, ankinator-mcp

Solução:
Use caminhos relativos dentro do projeto ou subpastas permitidas.
```

#### `CSV vazio ou sem dados válidos`
```
Erro: CSV vazio ou sem dados válidos

Solução:
Verifique se o arquivo CSV tem header e pelo menos uma linha de dados.
```

#### `Seção não encontrada`
```
Erro: Seção "Instalacão" não encontrada em README.md

Solução:
Verifique a grafia exata do título (pode ser "Instalação" com cedilha).
Use resumir_arvore ou listar_docs para encontrar arquivos disponíveis.
```

## Limites e Quotas

| Ferramenta | Parâmetro | Padrão | Máximo |
|------------|-----------|--------|--------|
| `validar_csv` | maxRows | 200 | 1000 |
| `sample_rows` | n | 5 | 50 |
| `extrair_secao` | maxChars | 2000 | 8000 |
| `extrair_questoes` | maxQuestions | 20 | 100 |
| `preview_questoes` | n | 5 | 10 |

## Boas Práticas

### 1. Sempre validar antes de importar
```bash
# ERRADO: Importar direto no Anki
❌ anki import questoes.csv

# CERTO: Validar primeiro
✅ mcp call validar_csv --path questoes.csv
✅ mcp call sample_rows --path questoes.csv
✅ anki import questoes.csv
```

### 2. Usar preview antes de processamento completo
```bash
# ERRADO: Processar PDF grande direto
❌ mcp call extrair_questoes --path livro-500pgs.pdf --maxQuestions 100

# CERTO: Preview primeiro
✅ mcp call preview_questoes --path livro-500pgs.pdf --n 5
✅ # Verificar qualidade e então processar completo
```

### 3. Revisar questões geradas
```bash
# Sempre faça revisão manual das questões extraídas
# antes da importação final no Anki
```

### 4. Organizar por categoria
```bash
# Use categorias consistentes para facilitar organização
mcp call converter_para_csv --categoria "Matemática - Cálculo I"
```

## Segurança

### Paths Permitidos

O servidor valida todos os paths para garantir segurança:

✅ **Permitidos:**
- `/home/t316360/plottwist/ankinator/` (raiz do projeto)
- `/home/t316360/plottwist/ankinator/ankimon/` (add-on)
- `/home/t316360/plottwist/ankinator/ankinator-mcp/` (servidor MCP)

❌ **Bloqueados:**
- Paths absolutos fora do projeto
- Directory traversal (`../../../etc/passwd`)
- Symlinks para fora do projeto

### Truncamento Automático

Todas as saídas são truncadas automaticamente para evitar:
- Consumo excessivo de memória
- Outputs muito longos
- Problemas de renderização

Limites padrão: 2000 caracteres (ajustável até 8000)

## Troubleshooting

### Servidor não inicia

```bash
# Verificar logs
npm run dev

# Reinstalar dependências
rm -rf node_modules package-lock.json
npm install

# Recompilar
npm run build
```

### Questões com qualidade ruim

1. Verifique se o PDF tem texto extraível (não é imagem escaneada)
2. Use `preview_questoes` para testar antes
3. Ajuste `maxQuestions` para evitar sobrecarga
4. Consulte `docs/PDF_EXTRACTION_PROMPT.md` para entender critérios

### CSV com muitos erros

1. Use `contar_campos` para analisar estrutura
2. Verifique se headers estão corretos
3. Use `sample_rows` para identificar padrões de erro
4. Consulte schema Zod na Fase 2

## Suporte e Contribuição

- **Issues:** https://github.com/your-repo/ankinator/issues
- **Documentação:** `/ankinator-mcp/docs/`
- **Roadmap:** `/ankinator-mcp/ROADMAP.md`

---

**Última atualização:** 2025-11-22
**Versão:** 1.0
**Projeto:** ankinator-mcp
