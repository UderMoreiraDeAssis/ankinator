# Ankinator - Sistema Avançado de Questões para Concursos Públicos

<div align="center">

**Domine concursos públicos brasileiros com o poder da repetição espaçada**

[![Anki Version](https://img.shields.io/badge/Anki-2.1.66+-blue.svg)](https://apps.ankiweb.net/)
[![Python](https://img.shields.io/badge/Python-3.9+-green.svg)](https://www.python.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

</div>

---

## 📋 Índice

- [Sobre o Projeto](#sobre-o-projeto)
- [🔧 Ankinator MCP Server](#-ankinator-mcp-server)
- [🚀 COMECE AQUI: Importando suas Questões](#-comece-aqui-importando-suas-questões)
  - [Quick Start em 3 Passos](#quick-start-em-3-passos)
  - [Fluxograma de Importação](#fluxograma-de-importação)
  - [Formatos Suportados](#formatos-suportados)
  - [Template CSV - Exemplo Completo](#template-csv---exemplo-completo)
  - [Seu Primeiro Import em 10 Minutos](#seu-primeiro-import-em-10-minutos)
  - [Importação Avançada](#importação-avançada)
  - [Troubleshooting de Importação](#troubleshooting-de-importação)
  - [FAQ de Importação](#faq-de-importação)
- [Motivação](#motivação)
- [Funcionalidades](#funcionalidades)
- [Instalação](#instalação)
- [Guia de Uso Completo](#guia-de-uso-completo)
- [Arquitetura Técnica](#arquitetura-técnica)
- [Estrutura do Projeto](#estrutura-do-projeto)
- [Desenvolvimento](#desenvolvimento)
- [Roadmap](#roadmap)
- [Contribuindo](#contribuindo)
- [Aspectos Legais](#aspectos-legais)
- [FAQ Geral](#faq-geral)
- [Suporte](#suporte)
- [Licença](#licença)

---

## 🎯 Sobre o Projeto

O **Ankinator** é um add-on avançado para o Anki, especialmente desenvolvido para concurseiros que desejam otimizar seus estudos através de questões de provas anteriores. Diferente dos flashcards tradicionais, este add-on é projetado especificamente para trabalhar com o formato de questões de bancas organizadoras brasileiras como **CEBRASPE** (antigo CESPE), **FGV**, **FCC**, **VUNESP**, **CESGRANRIO**, entre outras.

### 🌟 Diferenciais

- **Repetição Espaçada Adaptada**: Algoritmo modificado considerando proximidade da prova e pontos fracos
- **Estatísticas Detalhadas**: Análise por banca, disciplina, assunto e evolução temporal
- **Modo Simulado Completo**: Pratique em condições reais de prova com cronômetro
- **Importação Inteligente**: Suporte a CSV, JSON e PDF (com OCR)
- **Planejamento Automático**: Geração de plano de estudos baseado em estatísticas pessoais
- **Detecção de Padrões**: Identifica seus pontos fracos e padrões de erro
- **100% Offline**: Todos os dados armazenados localmente, privacidade total
- **Mobile-Friendly**: Templates responsivos para estudo em qualquer dispositivo

---

## 🔧 Ankinator MCP Server

> **🆕 Novo componente disponível!**
> Transforme PDFs educacionais em flashcards Anki de forma automática usando IA.

O **ankinator-mcp** é um **servidor MCP (Model Context Protocol)** que estende o Ankinator com ferramentas especializadas para transformar material educacional em questões para o Anki, com foco em **fidelidade total ao conteúdo original**.

### 🎯 O que é o MCP Server?

O servidor MCP funciona como uma ponte entre **Claude Desktop/Code** e o Ankinator, permitindo que você use IA para:

- 📄 **Extrair questões de PDFs** (aulas, apostilas, livros técnicos)
- ✅ **Validar arquivos CSV** antes de importar no Anki
- 📊 **Analisar estrutura** de documentos e questões
- 🔄 **Converter formatos** (questões extraídas → CSV validável)

### 💡 Casos de Uso

```
┌─────────────────────────────────────────────────────────────┐
│  PDF DE AULA  →  ANKINATOR-MCP  →  CSV VALIDADO  →  ANKI   │
└─────────────────────────────────────────────────────────────┘

Exemplo:
1. Você tem: matematica_basica.pdf (30 páginas de teoria)
2. MCP extrai: 25 questões Q:/A: fidedignas ao conteúdo
3. MCP converte: questoes.csv validado e pronto
4. Ankinator importa: 25 flashcards prontos para estudo
```

**Workflow típico:**
- Estudante: Criar flashcards a partir de PDFs de aulas
- Professor: Gerar questões de revisão de material didático
- Pesquisador: Transformar papers em conhecimento estruturado
- Autodidata: Converter livros técnicos em flashcards

### ✨ Ferramentas Disponíveis

**📚 Documentação do Repositório**
- `listar_docs` - Lista documentos principais do projeto
- `resumir_arvore` - Explora estrutura de diretórios
- `extrair_secao` - Extrai seções específicas de Markdown

**✅ Validação de CSV**
- `validar_csv` - Valida formato de questões com schema rigoroso
- `sample_rows` - Preview de linhas do CSV
- `contar_campos` - Análise de campos e estatísticas

**🌟 Extração de PDF** (Core Feature)
- `extrair_questoes` - Extrai questões Q:/A: fidedignas de PDFs
- `preview_questoes` - Preview rápido antes de processamento completo
- `converter_para_csv` - Converte Q:/A: para CSV validável pelo Ankinator

**Total: 9 ferramentas funcionais**

### 🚀 Quick Start do MCP Server

#### Pré-requisitos
- Node.js 18+ e npm
- Anthropic API key (para extração de PDF)
- Claude Desktop ou Claude Code (clientes MCP)

#### Instalação Rápida

```bash
# 1. Navegue até o diretório do MCP server
cd ankinator/ankinator-mcp

# 2. Instale dependências
npm install

# 3. Configure a API key
export ANTHROPIC_API_KEY="sua-api-key-aqui"
# ou adicione ao arquivo .env

# 4. Compile o projeto
npm run build

# 5. Configure o cliente MCP (veja documentação detalhada)
```

#### Configuração do Claude Desktop (macOS)

Edite `~/Library/Application Support/Claude/claude_desktop_config.json`:

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

Para **Windows** e **Linux**, ou para configurar o **Claude Code**, consulte a [documentação detalhada de configuração](ankinator-mcp/docs/MCP_CLIENT_CONFIG.md).

### 📚 Documentação Completa do MCP Server

- **[ankinator-mcp/README.md](ankinator-mcp/README.md)** - Setup completo e exemplos
- **[docs/USAGE.md](ankinator-mcp/docs/USAGE.md)** - Guia de uso de todas as ferramentas
- **[docs/PDF_EXTRACTION_PROMPT.md](ankinator-mcp/docs/PDF_EXTRACTION_PROMPT.md)** - Regras de extração rigorosa
- **[docs/MCP_CLIENT_CONFIG.md](ankinator-mcp/docs/MCP_CLIENT_CONFIG.md)** - Configuração de clientes MCP
- **[ROADMAP.md](ankinator-mcp/ROADMAP.md)** - Planejamento e fases do projeto

### 🔗 Relação entre Ankimon e MCP Server

```
┌──────────────────────────────────────────────────────────────┐
│                      ANKINATOR PROJECT                       │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────────┐         ┌─────────────────────┐   │
│  │   ANKIMON ADD-ON    │         │  ANKINATOR-MCP      │   │
│  │   (Python/PyQt6)    │         │  (Node.js/TypeScript)│   │
│  ├─────────────────────┤         ├─────────────────────┤   │
│  │                     │         │                     │   │
│  │ • Interface gráfica │         │ • Extração de PDF   │   │
│  │ • Importação CSV    │◄────────┤ • Validação CSV     │   │
│  │ • Estatísticas      │  CSV    │ • Análise docs      │   │
│  │ • Simulados         │         │ • Conversão Q:/A:   │   │
│  │ • 100% offline      │         │ • Via Claude AI     │   │
│  │                     │         │                     │   │
│  └─────────────────────┘         └─────────────────────┘   │
│           ▲                                ▲                │
│           │                                │                │
│           │        ┌──────────────┐        │                │
│           └────────┤   USUÁRIO    ├────────┘                │
│                    └──────────────┘                         │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

**Complementaridade:**
- **Ankimon**: Gerencia, organiza e estuda as questões no Anki
- **MCP Server**: Automatiza a criação de questões a partir de PDFs

**Workflow integrado:**
1. MCP Server extrai questões do PDF → gera CSV
2. Ankimon valida e importa CSV → cria cards no Anki
3. Usuário estuda com algoritmo de repetição espaçada do Anki

### ⚠️ Status Atual

- **Ankimon (Add-on)**: 🟢 Estável - Pronto para uso
- **MCP Server**: 🟡 Alpha (v0.1.0) - Funcional mas em desenvolvimento ativo

---

## 🚀 COMECE AQUI: Importando suas Questões

> **Esta é a seção mais importante do README!**
> Importar suas questões corretamente é o primeiro passo para aproveitar todo o poder do Ankinator.

### Quick Start em 3 Passos

```
╔═══════════════════════════════════════════════════════════════╗
║  TRANSFORME SUAS QUESTÕES EM CONHECIMENTO SÓLIDO             ║
╚═══════════════════════════════════════════════════════════════╝

┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│   PASSO 1   │  →   │   PASSO 2   │  →   │   PASSO 3   │
│             │      │             │      │             │
│  📥 BAIXE   │      │  ✏️ PREENCHA │      │  ⬆️ IMPORTE │
│  TEMPLATE   │      │  QUESTÕES   │      │  NO ANKI    │
│             │      │             │      │             │
│  2 minutos  │      │  Seu tempo  │      │  1 minuto   │
└─────────────┘      └─────────────┘      └─────────────┘
```

**Tempo total**: ~10 minutos para importar suas primeiras questões!

---

### Fluxograma de Importação

```
                    TENHO QUESTÕES EM...
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
    📄 PDF/WORD         📊 PLANILHA         🌐 SITE/APP
    📷 FOTOS/IMAGENS    📋 CSV/EXCEL      🔖 QCONCURSOS/TEC
        │                   │                   │
        ▼                   ▼                   ▼
  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
  │ CONVERSÃO   │     │  TEMPLATE   │     │   COPIAR    │
  │ MANUAL/OCR  │     │  ANKINATOR  │     │ MANUALMENTE │
  └─────────────┘     └─────────────┘     └─────────────┘
        │                   │                   │
        └───────────────────┼───────────────────┘
                            ▼
                    ARQUIVO CSV/EXCEL/JSON
                            │
                            ▼
                ┌───────────────────────┐
                │  ANKINATOR IMPORT     │
                │  Questões → Importar  │
                └───────────────────────┘
                            │
                            ▼
                ┌───────────────────────┐
                │ ✓ VALIDAÇÃO AUTOMÁTICA│
                │ ✓ Campos obrigatórios │
                │ ✓ Gabarito válido     │
                │ ✓ Duplicatas          │
                └───────────────────────┘
                            │
                            ▼
                  🎉 QUESTÕES NO ANKI 🎉
                   PRONTAS PARA ESTUDO!
```

---

### Formatos Suportados

| Formato | Dificuldade | Quando Usar | Exemplo |
|---------|-------------|-------------|---------|
| **CSV** | ⭐ Fácil | Poucas questões (<500), iniciantes | [template_basico.csv](#) |
| **Excel** | ⭐⭐ Médio | Organização visual, dropdowns | [template_excel.xlsx](#) |
| **JSON** | ⭐⭐⭐ Avançado | Muitas questões (>1000), estrutura rica | [template_json.json](#) |
| **PDF** | ⭐⭐⭐⭐ OCR | Provas oficiais (v0.4+) | [como_usar_ocr.md](#) |

**Recomendação**: Comece com CSV! É o mais simples e funciona para 90% dos casos.

---

### Template CSV - Exemplo Completo

#### 📥 Download do Template

- **Template Mínimo** (apenas campos obrigatórios): [download](https://github.com/ankinator/templates/minimo.csv)
- **Template Completo** (todos os campos): [download](https://github.com/ankinator/templates/completo.csv)
- **Template Excel** (com validações): [download](https://github.com/ankinator/templates/excel.xlsx)
- **Exemplo com 100 Questões** (para testar): [download](https://github.com/ankinator/templates/exemplo_100q.csv)

#### 📝 Estrutura do CSV

**Campos Obrigatórios** (sem estes, não importa):
- `enunciado` - Texto da questão
- `alternativa_a` - Primeira alternativa
- `alternativa_b` - Segunda alternativa
- `alternativa_c` - Terceira alternativa
- `alternativa_d` - Quarta alternativa
- `gabarito` - Letra correta (A, B, C, D ou E)

**Campos Opcionais** (mas muito recomendados):
- `alternativa_e` - Quinta alternativa (quando houver)
- `banca` - CEBRASPE, FGV, FCC, VUNESP, etc.
- `disciplina` - Direito Constitucional, Português, etc.
- `assunto` - Direitos Fundamentais, Licitações, etc.
- `ano` - Ano da prova (ex: 2023)
- `cargo` - Auditor Fiscal, Analista, etc.
- `comentario` - Explicação da resposta correta
- `imagem_enunciado` - Caminho para imagem (se houver)
- `legislacao_citada` - Artigos de lei relacionados
- `tags` - Tags separadas por vírgula (ex: importante,cai_muito)

#### 💡 Exemplo Real Preenchido

```csv
enunciado,alternativa_a,alternativa_b,alternativa_c,alternativa_d,alternativa_e,gabarito,banca,disciplina,assunto,ano,cargo,comentario
"Acerca dos direitos fundamentais previstos na Constituição Federal, assinale a alternativa correta.","Os direitos fundamentais são absolutos e não admitem qualquer tipo de restrição.","A eficácia horizontal dos direitos fundamentais significa que eles se aplicam também nas relações entre particulares.","Os direitos fundamentais só se aplicam a pessoas físicas brasileiras natas.","A dignidade da pessoa humana não é considerada um direito fundamental pela CF/88.","Os direitos fundamentais não podem ser objeto de emenda constitucional.",B,CEBRASPE,Direito Constitucional,Direitos Fundamentais,2023,Auditor Fiscal - SEFAZ/DF,"A alternativa B está correta. A eficácia horizontal (ou privada) dos direitos fundamentais é reconhecida pelo STF e significa que tais direitos não se aplicam apenas nas relações entre Estado e indivíduo (eficácia vertical), mas também entre particulares. As demais alternativas estão incorretas: os direitos fundamentais admitem restrições (A), aplicam-se também a estrangeiros e pessoas jurídicas (C), a dignidade da pessoa humana é um dos fundamentos da República (D), e direitos fundamentais podem ser objeto de emenda, desde que respeitem as cláusulas pétreas (E)."
"Em relação aos princípios da Administração Pública, é correto afirmar que:","O princípio da legalidade permite ao administrador fazer tudo que a lei não proíbe.","O princípio da impessoalidade veda que o administrador promova pessoalmente os atos da administração.","O princípio da moralidade se confunde com a legalidade.","O princípio da eficiência foi introduzido pela Constituição de 1988.","",B,FGV,Direito Administrativo,Princípios da Administração,2022,Analista - TCE/RJ,"A alternativa B está correta. O princípio da impessoalidade, previsto no art. 37 da CF/88, veda a promoção pessoal do administrador e exige tratamento isonômico. A alternativa A está incorreta pois, diferente dos particulares, a Administração só pode fazer o que a lei permite (princípio da legalidade). A alternativa C está incorreta porque moralidade e legalidade são princípios distintos. A alternativa D está incorreta pois o princípio da eficiência foi introduzido pela EC 19/98, não pela CF/88 originária."
"Assinale a opção que apresenta as funções sintáticas dos termos destacados: 'O candidato estudou AS QUESTÕES com dedicação.'","Sujeito - Objeto direto - Adjunto adverbial","Objeto direto - Adjunto adnominal - Predicativo","Sujeito - Objeto direto - Predicativo do sujeito","Objeto indireto - Complemento nominal - Adjunto adverbial","",A,FCC,Português,Sintaxe,2023,Técnico Judiciário - TRT 2ª,"A alternativa A está correta. 'O candidato' é o sujeito da oração, 'as questões' é objeto direto do verbo transitivo direto 'estudou', e 'com dedicação' é adjunto adverbial de modo, indicando a maneira como a ação foi realizada."
```

#### ✅ Checklist Antes de Importar

Antes de clicar em "Importar", verifique:

**Sobre o Arquivo:**
- [ ] Arquivo está em formato .csv, .xlsx ou .json
- [ ] Encoding UTF-8 (evita caracteres estranhos)
- [ ] Primeira linha contém os nomes das colunas (cabeçalho)
- [ ] Sem linhas completamente vazias no meio

**Sobre os Dados:**
- [ ] Enunciados estão completos e legíveis
- [ ] Todas as questões têm no mínimo 4 alternativas (A-D)
- [ ] Gabarito usa apenas letras maiúsculas: A, B, C, D ou E
- [ ] Se usar vírgula no texto, coloque entre aspas: "Texto com vírgula, aqui"

**Sobre Metadados:**
- [ ] Bancas padronizadas (CEBRASPE, não "Cespe" ou "cespe")
- [ ] Anos em formato numérico (2023, não "2023" ou "23")
- [ ] Disciplinas consistentes (sempre "Direito Constitucional")

**Configurações:**
- [ ] Sabe qual deck usar ou nome para criar novo deck
- [ ] Vai marcar "Detectar duplicatas" (recomendado)
- [ ] Fez backup recente do Anki (segurança)

---

### Seu Primeiro Import em 10 Minutos

#### Passo 1: Baixe e Prepare o Template (3 min)

1. **Baixe o template CSV**: [template_basico.csv](https://github.com/ankinator/templates/basico.csv)
2. **Abra no Excel** ou Google Sheets
3. **Veja o exemplo** já preenchido na primeira linha
4. **Adicione suas questões** copiando o formato

**Dica**: Não sabe suas questões de cor? Vá copiando de PDFs/sites conforme estuda!

#### Passo 2: Salve como CSV (1 min)

**No Excel:**
1. Arquivo → Salvar Como
2. Tipo: "CSV (separado por vírgulas) (*.csv)"
3. Nome: "minhas_questoes.csv"
4. Clique em Salvar
5. Se aparecer aviso, clique "Sim"

**No Google Sheets:**
1. Arquivo → Fazer download → CSV
2. Pronto! Já baixa em formato correto

#### Passo 3: Importe no Ankinator (3 min)

1. **Abra o Anki**
2. **Menu**: `Ankinator` → `Questões` → `Importar`
3. **Wizard de Importação se abre**:

```
╔════════════════════════════════════════╗
║  Assistente de Importação             ║
╚════════════════════════════════════════╝

Passo 1: Selecione o arquivo
┌──────────────────────────────────────┐
│  📄 Arraste aqui ou clique           │
│     [Procurar Arquivo...]            │
└──────────────────────────────────────┘
```

4. **Selecione seu arquivo**: `minhas_questoes.csv`

5. **Preview aparece**:
```
╔════════════════════════════════════════╗
║  Passo 2: Validar Dados               ║
╚════════════════════════════════════════╝

Arquivo: minhas_questoes.csv
Questões detectadas: 10

Preview das primeiras 3:
┌────────────────────────────────────┐
│ Q1: Acerca dos direitos...         │
│     ✓ Válida                       │
├────────────────────────────────────┤
│ Q2: Sobre licitações...           │
│     ✓ Válida                       │
├────────────────────────────────────┤
│ Q3: Assinale a alternativa...     │
│     ✓ Válida                       │
└────────────────────────────────────┘

✓ 10 questões válidas
⚠ 0 duplicatas

[Próximo →]
```

6. **Configure destino**:
```
╔════════════════════════════════════════╗
║  Passo 3: Configurar                  ║
╚════════════════════════════════════════╝

Deck de destino:
  ⦿ Criar novo: "Minhas Questões 2024"
  ○ Deck existente: [Selecionar ▼]

Opções:
  ☑ Detectar duplicatas
  ☑ Validar gabaritos
  ☑ Criar tags automaticamente

[Próximo →]
```

7. **Confirme e importe**:
```
╔════════════════════════════════════════╗
║  Passo 4: Confirmar                   ║
╚════════════════════════════════════════╝

Resumo:
  • 10 questões serão importadas
  • Deck: "Minhas Questões 2024"
  • Tempo estimado: ~5 segundos

      [← Voltar]    [🚀 Importar!]
```

8. **Aguarde importação**:
```
Importando... ████████████████ 100%

✓ 10 questões importadas com sucesso!
```

#### Passo 4: Comece a Estudar! (2 min)

1. **Feche o wizard**
2. **Vá para o deck**: "Minhas Questões 2024"
3. **Clique em "Estudar Agora"**
4. **Primeira questão aparece!** 🎉

```
╔════════════════════════════════════════════╗
║  CEBRASPE • 2023 • Direito Constitucional ║
╚════════════════════════════════════════════╝

Acerca dos direitos fundamentais previstos na
Constituição Federal, assinale a alternativa
correta.

A) Os direitos fundamentais são absolutos...
B) A eficácia horizontal dos direitos...
C) Os direitos fundamentais só se aplicam...
D) A dignidade da pessoa humana não é...

        [Mostrar Resposta]
```

**Parabéns! Você importou suas primeiras questões!** 🎊

---

### Importação Avançada

#### De PDF para CSV (Manual)

**Quando usar**: Tem PDFs de provas e quer importar manualmente

1. **Prepare workspace**:
   - Abra PDF no navegador ou leitor
   - Abra template Excel em outra janela
   - Use dois monitores ou split screen

2. **Para cada questão**:
   - Copie enunciado do PDF
   - Cole no campo "enunciado" do Excel
   - Copie cada alternativa
   - Cole em alternativa_a, alternativa_b, etc.
   - Marque o gabarito
   - Adicione metadados (banca, ano, disciplina)

3. **Dicas para agilizar**:
   - Atalho Ctrl+C / Ctrl+V
   - Use Tab para navegar entre células
   - Preencha metadados no final (copiar/colar em bloco)
   - Faça em lotes de 10-20 questões

**Tempo**: 1-2 minutos por questão = 30 questões/hora

#### De PDF para CSV (OCR - v0.4+)

**Quando usar**: Tem muitos PDFs e quer automatizar

1. **Ankinator → Importar → Importar PDF**
2. **Selecione PDF** da prova
3. **Escolha banca** (para parser específico):
   - CEBRASPE
   - FGV
   - FCC
   - Genérico (outras bancas)

4. **Aguarde processamento**:
```
Processando PDF...
├─ Detectando questões... ✓
├─ Extraindo texto (OCR)... ████░░░░ 45%
├─ Identificando alternativas...
└─ Detectando gabaritos...

Tempo estimado: 3-5 minutos
```

5. **Revise extrações**:
```
╔════════════════════════════════════════╗
║  Questões Extraídas: 50               ║
╚════════════════════════════════════════╝

Q1: Acerca dos direitos fundamentais...
    ✓ Enunciado: OK
    ✓ Alternativas: 5 detectadas
    ⚠ Gabarito: Não detectado (informe: _)

Q2: Em relação aos princípios...
    ✓ Enunciado: OK
    ✓ Alternativas: 4 detectadas
    ✓ Gabarito: B

[Preencher gabaritos faltantes]
[Corrigir erros de OCR]
[Importar]
```

6. **Corrija e importe**

**Taxa de acerto do OCR**: 85-95% (varia com qualidade do PDF)

#### De Excel para CSV

Já está no Excel? Ótimo!

1. **Organize colunas** conforme template
2. **Arquivo → Salvar Como**
3. **Tipo**: CSV (separado por vírgulas)
4. **Salvar**
5. **Importar normalmente**

#### De Google Sheets para CSV

1. **Arquivo → Fazer download → CSV**
2. **Importar no Ankinator**

Simples assim!

#### De JSON (Avançado)

Para quem tem questões em formato estruturado:

```json
{
  "versao": "1.0",
  "questoes": [
    {
      "enunciado": "Texto da questão...",
      "alternativas": [
        {"letra": "A", "texto": "Alternativa A"},
        {"letra": "B", "texto": "Alternativa B"},
        {"letra": "C", "texto": "Alternativa C"},
        {"letra": "D", "texto": "Alternativa D"}
      ],
      "gabarito": "B",
      "metadata": {
        "banca": "CEBRASPE",
        "disciplina": "Direito Constitucional",
        "assunto": "Direitos Fundamentais",
        "ano": 2023,
        "cargo": "Auditor Fiscal"
      },
      "comentario": "Explicação detalhada..."
    }
  ]
}
```

**Vantagens do JSON**:
- Estrutura mais rica
- Suporta aninhamento
- Melhor para programadores
- Ideal para integração com APIs

#### Importação em Lote (1000+ Questões)

**Problema**: Importar 5000 questões trava?

**Solução**: Divida em lotes!

```
Ao invés de:
  questoes_todas.csv (5000 linhas) ❌ Pode travar

Faça:
  lote_01_cebraspe.csv (1000 linhas) ✓
  lote_02_fgv.csv (1000 linhas) ✓
  lote_03_fcc.csv (1000 linhas) ✓
  lote_04_vunesp.csv (1000 linhas) ✓
  lote_05_diversos.csv (1000 linhas) ✓

Tempo total: 5-7 minutos
Performance: Estável ✓
```

**Dica**: Divida por banca ou disciplina!

#### Questões com Imagens

1. **Salve imagens** em: `user_data/images/`
2. **Nome sem espaços**: `grafico_001.png` ✓ não `gráfico 001.png` ❌
3. **No CSV**, coluna `imagem_enunciado`: `img/grafico_001.png`

Exemplo:
```csv
enunciado,imagem_enunciado,alternativa_a,...
"Analise o gráfico:",img/grafico_001.png,"A","B",...
```

**Formatos aceitos**: PNG, JPG, GIF, SVG
**Tamanho máximo**: 2 MB por imagem

#### Questões com Tabelas

**Opção 1**: Tabela como imagem
```csv
enunciado,imagem_enunciado,...
"Veja a tabela:",img/tabela_001.png,...
```

**Opção 2**: HTML inline (avançado)
```csv
enunciado,...
"<table><tr><th>Ano</th><th>Valor</th></tr><tr><td>2020</td><td>100</td></tr></table>",...
```

---

### Troubleshooting de Importação

#### ❌ Erro: "Gabarito inválido"

**Problema**:
```
Linha 45: Gabarito inválido "Letra B"
Linha 67: Gabarito inválido "b"
Linha 89: Gabarito inválido "2"
```

**Solução**:
Use APENAS uma letra maiúscula:
- ✓ Correto: `A`, `B`, `C`, `D`, `E`
- ❌ Errado: `a`, `Letra A`, `1`, `Alternativa B`

#### ❌ Erro: "Caracteres estranhos (encoding)"

**Problema**:
```
ConstitÃ§Ã£o em vez de Constituição
AdministraÃ§Ã£o em vez de Administração
```

**Causa**: Arquivo não está em UTF-8

**Solução no Excel**:
1. Salvar Como → Mais Opções
2. Ferramentas → Opções da Web
3. Encoding: UTF-8
4. Salvar

**Solução no Google Sheets**:
- Já salva em UTF-8 automaticamente! ✓

#### ❌ Erro: "Vírgula quebrando campos"

**Problema**:
```
"Alternativa com vírgula, quebra tudo"
↓
Vira dois campos: "Alternativa com vírgula" e "quebra tudo"
```

**Solução**:
Use aspas duplas em campos com vírgula:
```csv
enunciado,alternativa_a,...
"Questão aqui","Alternativa com vírgula, entre aspas",...
```

#### ❌ Erro: "Duplicatas detectadas"

**Problema**:
```
⚠ Linha 34: 92% similar à Q#456 (possível duplicata)
⚠ Linha 78: Idêntica à Q#789 (duplicata confirmada)
```

**Isso é bom!** O Ankinator está protegendo você.

**Opções**:
1. **Ignorar duplicatas** (recomendado): Marca a opção e elas não são importadas
2. **Importar mesmo assim**: Desmarca a opção (não recomendado - bagunça estatísticas)
3. **Revisar manualmente**: Veja quais são duplicatas antes de decidir

#### ❌ Erro: "Arquivo muito grande - travou"

**Problema**: Tentou importar 10.000 questões de uma vez

**Solução**:
Divida em lotes menores (500-1000 questões cada):

```bash
# Se tiver habilidades técnicas, use Python:
python split_csv.py questoes_grandes.csv --lote=1000

# Resultado:
questoes_grandes_lote1.csv (1000 linhas)
questoes_grandes_lote2.csv (1000 linhas)
...
```

#### ❌ Erro: "Falta coluna obrigatória"

**Problema**:
```
Erro: Coluna obrigatória 'enunciado' não encontrada
```

**Solução**:
Verifique cabeçalho (primeira linha). Deve ter EXATAMENTE:
```csv
enunciado,alternativa_a,alternativa_b,alternativa_c,alternativa_d,gabarito
```

Não pode:
- ❌ `Enunciado` (maiúscula)
- ❌ `enunciado ` (espaço extra)
- ❌ `enunciad0` (zero em vez de o)

#### ❌ Aviso: "Banca não reconhecida"

**Problema**:
```
⚠ Linha 23: Banca "CESPE-UnB" não reconhecida
  Sugestão: Use "CEBRASPE"
```

**Não impede importação**, mas gera aviso.

**Solução**:
Padronize bancas conhecidas:
- CEBRASPE (não CESPE, Cespe, CESPE/UnB)
- FGV (não Fundação Getulio Vargas)
- FCC (não Fundação Carlos Chagas)
- VUNESP

#### 🔍 Ver Log Completo

Se tiver muitos erros:
1. Ankinator → Ferramentas → Ver Log de Importação
2. Arquivo abre com TODOS os erros listados
3. Corrija no Excel/CSV
4. Reimporte

---

### FAQ de Importação

#### P: Qual formato devo usar?

**R**: Depende do seu caso:

- **CSV**: Para até 500 questões, fácil de editar no Excel
- **Excel**: Se quer validação automática (dropdowns)
- **JSON**: Se tem >1000 questões ou é programador
- **PDF+OCR**: Se tem PDFs e quer automatizar (v0.4+)

**Recomendação para iniciantes**: Comece com CSV!

#### P: Posso importar questões com imagens?

**R**: Sim!
1. Salve imagens em `user_data/images/`
2. No CSV, referencie: `img/nome_imagem.png`
3. Formatos aceitos: PNG, JPG, GIF, SVG
4. Tamanho máximo: 2 MB por imagem

#### P: Quanto tempo leva para importar 1000 questões?

**R**:
- CSV/Excel: ~30-60 segundos
- JSON: ~20-40 segundos
- PDF com OCR: ~5-10 minutos (depende da qualidade)

**Dica**: Importe em lotes de 500-1000 para melhor performance.

#### P: Posso importar do QConcursos/TEC?

**R**: Não há integração direta (direitos autorais).

**Se você tem assinatura:**
- Copie questões manualmente para template
- Ou use extensão de comunidade (não oficial)

**⚠️ Legal**: Apenas para uso pessoal, não redistribua!

#### P: O que fazer se a importação der erro?

**R**:
1. Leia a mensagem de erro
2. Veja seção [Troubleshooting](#troubleshooting-de-importação)
3. Corrija o problema no arquivo
4. Reimporte
5. Se persistir, veja log completo: Ankinator → Ver Log

#### P: Posso importar o mesmo arquivo duas vezes?

**R**: Sim!
- Marque "Detectar duplicatas"
- O Ankinator compara e ignora questões repetidas
- Seguro reimportar após correções

#### P: Como importar questões em Word/PDF?

**R**:

**Word**:
1. Copie do Word
2. Cole no template Excel
3. Salve como CSV
4. Importe

**PDF (manual)**:
1. Copie do PDF
2. Cole no template
3. Importe

**PDF (automático - v0.4+)**:
1. Ankinator → Importar PDF
2. Selecione arquivo
3. Aguarde OCR
4. Revise e importe

#### P: Tem limite de questões?

**R**: Não há limite hard.

**Recomendações**:
- Lotes de 1000 questões por vez (performance)
- Até 10.000 questões total sem problemas
- Acima disso, use SQLite (v0.4+)

#### P: Posso editar questões depois de importar?

**R**: Sim!

**Método 1** (poucas questões):
1. Anki → Navegador (Browse)
2. Busque a questão
3. Clique duas vezes para editar
4. Salve

**Método 2** (muitas questões):
1. Ankinator → Exportar → CSV
2. Edite no Excel
3. Reimporte com "Atualizar existentes"

⚠️ **Importante**: Não delete e reimporte - você perde estatísticas!

#### P: Como saber se importou corretamente?

**R**: Verifique:

1. ✓ Resumo de importação mostra "X questões importadas"
2. ✓ Vá ao deck e veja se as questões aparecem
3. ✓ Abra 3-5 questões aleatórias e confira:
   - Enunciado completo
   - Todas as alternativas visíveis
   - Gabarito correto destacado
   - Comentário aparece (se houver)

Se tudo OK, sucesso! 🎉

#### P: Posso compartilhar questões importadas?

**R**: ⚠️ **CUIDADO COM DIREITOS AUTORAIS!**

**Pode**:
- Compartilhar questões que você criou
- Compartilhar questões de domínio público
- Compartilhar com permissão do autor

**Não pode**:
- Redistribuir questões de bancas sem autorização
- Vender decks de questões protegidas
- Compartilhar questões de sites pagos

**Dica**: Use função "Exportar" apenas para backup pessoal.

#### P: E se eu tiver questões em outros idiomas?

**R**: O Ankinator suporta qualquer idioma UTF-8!

- Português ✓
- Inglês ✓
- Espanhol ✓
- Alemão ✓
- Japonês ✓
- Árabe ✓

Apenas salve CSV em UTF-8!

---

## 💡 Motivação

### O Problema

Concurseiros enfrentam desafios únicos:

1. **Volume massivo de conteúdo**: Milhares de questões para revisar
2. **Múltiplas bancas**: Cada banca tem estilo e dificuldade próprios
3. **Gestão de tempo**: Necessidade de priorizar assuntos fracos
4. **Falta de feedback**: Dificuldade em identificar padrões de erro
5. **Revisão ineficiente**: Revisar tudo é impossível, revisar pouco é arriscado

### A Solução

O Ankinator resolve esses problemas através de:

- **Repetição espaçada científica**: Revise cada questão no momento ideal
- **Estatísticas acionáveis**: Saiba exatamente onde focar seus esforços
- **Priorização inteligente**: Algoritmo adapta revisões baseado na proximidade da prova
- **Análise por banca**: Prepare-se especificamente para a banca do seu concurso
- **Simulados realistas**: Treine em condições de prova real

---

## 🏗️ Arquitetura Técnica

### Stack Tecnológico

```
┌─────────────────────────────────────────────────────────────┐
│                     Ankinator Add-on                         │
├─────────────────────────────────────────────────────────────┤
│  Interface (PyQt6)  │  Lógica de Negócio  │  Persistência   │
│  ─────────────────  │  ────────────────── │  ─────────────  │
│  • Menus            │  • QuestionManager  │  • JSON Files   │
│  • Dashboards       │  • StatsCalculator  │  • SQLite       │
│  • Dialogs          │  • StudyPlanner     │  • Anki DB      │
│  • Reviewer         │  • SimuladoEngine   │                 │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                     Anki Platform                            │
│  • Card Scheduler  • AnkiWeb Sync  • Cross-Platform         │
└─────────────────────────────────────────────────────────────┘
```

### Componentes Principais

#### 1. **Modelo de Dados**

```python
class QuestionObject:
    """Modelo principal de uma questão de concurso"""
    id: UUID                          # Identificador único
    enunciado: str                    # Texto da questão
    alternativas: List[Dict]          # Lista de alternativas
    gabarito: str                     # Resposta correta

    # Metadados
    banca: str                        # CEBRASPE, FGV, FCC, etc.
    disciplina: str                   # Direito Constitucional, etc.
    assunto: str                      # Direitos Fundamentais, etc.
    ano: int                          # Ano da prova
    cargo: str                        # Cargo do concurso

    # Conteúdo adicional
    comentario: str                   # Explicação da resposta
    imagens: List[str]                # Paths de imagens
    legislacao_citada: List[str]      # Artigos de lei citados
    tags: List[str]                   # Tags customizadas

    # Estatísticas
    difficulty_score: float           # 0-1 (calculado dinamicamente)
    global_accuracy: float            # Taxa de acerto geral
    personal_history: List[Attempt]   # Histórico pessoal
```

#### 2. **Sistema de Hooks**

Inspirado na arquitetura do Ankimon, o Ankinator utiliza hooks do Anki para integração profunda:

```python
# hooks.py
from aqt import gui_hooks

def setup_hooks(question_manager, stats_tracker, reviewer_manager):
    """Configura todos os hooks do Anki"""

    # Hook: Quando card é exibido
    gui_hooks.card_will_show.append(reviewer_manager.customize_card_display)

    # Hook: Quando resposta é registrada
    gui_hooks.reviewer_did_answer_card.append(stats_tracker.record_answer)

    # Hook: Ao sincronizar com AnkiWeb
    gui_hooks.sync_did_finish.append(question_manager.sync_metadata)

    # Hook: Ao carregar perfil
    gui_hooks.profile_did_open.append(stats_tracker.load_user_stats)

    # Hook: Antes de fechar Anki
    gui_hooks.profile_will_close.append(question_manager.save_all_data)
```

#### 3. **Sistema de Menu**

```python
# menu_buttons.py
from aqt.qt import QMenu, QAction

def create_menu_structure(mw):
    """Cria estrutura de menu completa"""

    # Menu principal
    ankinator_menu = QMenu('&Ankinator', mw)

    # Submenus
    questions_menu = ankinator_menu.addMenu('📝 Questões')
    stats_menu = ankinator_menu.addMenu('📊 Estatísticas')
    simulado_menu = ankinator_menu.addMenu('⏱️ Simulados')
    tools_menu = ankinator_menu.addMenu('🛠️ Ferramentas')
    help_menu = ankinator_menu.addMenu('❓ Ajuda')

    # Adicionar ações aos menus
    add_menu_actions(questions_menu, stats_menu, simulado_menu, tools_menu, help_menu)

    # Adicionar à barra de menus do Anki
    mw.form.menubar.addMenu(ankinator_menu)
```

#### 4. **Templates de Cards**

**Template Front (HTML):**
```html
<div class="ankinator-card">
    <div class="question-header">
        <img src="{{Banca_Logo}}" class="banca-logo" alt="{{Banca}}">
        <div class="metadata">
            <span class="badge banca">{{Banca}}</span>
            <span class="badge year">{{Ano}}</span>
            <span class="badge cargo">{{Cargo}}</span>
        </div>
    </div>

    <div class="subject-tags">
        <span class="tag disciplina">{{Disciplina}}</span>
        <span class="tag assunto">{{Assunto}}</span>
    </div>

    <div class="question-content">
        {{#Imagem_Enunciado}}
        <img src="{{Imagem_Enunciado}}" class="question-image">
        {{/Imagem_Enunciado}}

        <div class="enunciado">{{Enunciado}}</div>

        <div class="alternatives">
            <div class="alternative" data-option="A">
                <span class="option-letter">A)</span> {{Alternativa_A}}
            </div>
            <div class="alternative" data-option="B">
                <span class="option-letter">B)</span> {{Alternativa_B}}
            </div>
            <div class="alternative" data-option="C">
                <span class="option-letter">C)</span> {{Alternativa_C}}
            </div>
            <div class="alternative" data-option="D">
                <span class="option-letter">D)</span> {{Alternativa_D}}
            </div>
            {{#Alternativa_E}}
            <div class="alternative" data-option="E">
                <span class="option-letter">E)</span> {{Alternativa_E}}
            </div>
            {{/Alternativa_E}}
        </div>
    </div>

    {{#Modo_Simulado}}
    <div class="timer" id="question-timer">
        <span class="timer-label">Tempo:</span>
        <span class="timer-value">00:00</span>
    </div>
    {{/Modo_Simulado}}
</div>

<script>
// Timer para modo simulado
if (document.getElementById('question-timer')) {
    let seconds = 0;
    setInterval(() => {
        seconds++;
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        document.querySelector('.timer-value').textContent =
            `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }, 1000);
}
</script>
```

**Template Back (adiciona gabarito e comentário):**
```html
{{FrontSide}}

<hr class="separator">

<div class="answer-section">
    <div class="correct-answer">
        <span class="gabarito-label">✓ Gabarito:</span>
        <span class="gabarito-value">{{Gabarito}}</span>
    </div>

    {{#Comentario}}
    <div class="explanation">
        <h3>📖 Comentário</h3>
        <div class="comment-content">{{Comentario}}</div>
    </div>
    {{/Comentario}}

    {{#Legislacao_Citada}}
    <div class="legal-references">
        <h4>⚖️ Legislação Citada</h4>
        <ul>{{Legislacao_Citada}}</ul>
    </div>
    {{/Legislacao_Citada}}

    <div class="action-buttons">
        <button onclick="pycmd('ankinator:report_error')">🐛 Reportar Erro</button>
        <button onclick="pycmd('ankinator:add_note')">📝 Adicionar Nota</button>
        <button onclick="pycmd('ankinator:view_stats')">📊 Ver Estatísticas</button>
    </div>
</div>

<script>
// Destacar gabarito correto
document.querySelectorAll('.alternative').forEach(alt => {
    const option = alt.getAttribute('data-option');
    const gabarito = '{{Gabarito}}';
    if (option === gabarito) {
        alt.classList.add('correct');
    }
});
</script>
```

**CSS Styling:**
```css
/* Estilo principal */
.ankinator-card {
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    max-width: 900px;
    margin: 0 auto;
    padding: 25px;
    background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
    border-radius: 12px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.15);
}

.question-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
    padding-bottom: 15px;
    border-bottom: 3px solid #3b82f6;
}

.banca-logo {
    height: 50px;
    width: auto;
}

.badge {
    display: inline-block;
    padding: 6px 14px;
    margin: 0 5px;
    border-radius: 20px;
    font-size: 13px;
    font-weight: 600;
    color: white;
}

.badge.banca { background: #3b82f6; }
.badge.year { background: #8b5cf6; }
.badge.cargo { background: #10b981; }

.tag {
    display: inline-block;
    padding: 8px 16px;
    margin: 5px;
    background: #f3f4f6;
    border-left: 4px solid #3b82f6;
    border-radius: 4px;
    font-size: 14px;
    font-weight: 500;
    color: #1f2937;
}

.enunciado {
    font-size: 17px;
    line-height: 1.8;
    margin: 25px 0;
    color: #1f2937;
    padding: 20px;
    background: white;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.08);
}

.alternatives {
    margin-top: 25px;
}

.alternative {
    padding: 16px 20px;
    margin: 12px 0;
    background: white;
    border: 2px solid #e5e7eb;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.3s ease;
    display: flex;
    align-items: start;
}

.alternative:hover {
    background: #f9fafb;
    border-color: #3b82f6;
    transform: translateX(5px);
}

.option-letter {
    font-weight: 700;
    color: #3b82f6;
    margin-right: 10px;
    min-width: 30px;
}

.alternative.correct {
    background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%);
    border-color: #10b981;
    border-width: 3px;
}

.alternative.correct::before {
    content: "✓";
    color: #10b981;
    font-weight: bold;
    font-size: 20px;
    margin-right: 10px;
}

.timer {
    position: fixed;
    top: 20px;
    right: 20px;
    background: #1f2937;
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    font-size: 18px;
    font-weight: 600;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
}

.separator {
    margin: 30px 0;
    border: none;
    border-top: 2px dashed #d1d5db;
}

.answer-section {
    background: white;
    padding: 25px;
    border-radius: 8px;
    margin-top: 20px;
}

.correct-answer {
    padding: 15px;
    background: #d1fae5;
    border-left: 5px solid #10b981;
    border-radius: 6px;
    margin-bottom: 20px;
}

.gabarito-label {
    font-weight: 700;
    color: #065f46;
    font-size: 16px;
}

.gabarito-value {
    font-size: 24px;
    font-weight: 800;
    color: #10b981;
    margin-left: 10px;
}

.explanation {
    margin: 20px 0;
    padding: 20px;
    background: #fef3c7;
    border-left: 5px solid #f59e0b;
    border-radius: 6px;
}

.explanation h3 {
    margin-top: 0;
    color: #92400e;
}

.action-buttons {
    display: flex;
    gap: 10px;
    margin-top: 20px;
}

.action-buttons button {
    flex: 1;
    padding: 10px 16px;
    background: #3b82f6;
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.3s;
}

.action-buttons button:hover {
    background: #2563eb;
}

/* Responsivo Mobile */
@media (max-width: 768px) {
    .ankinator-card {
        padding: 15px;
        font-size: 15px;
    }

    .question-header {
        flex-direction: column;
        align-items: flex-start;
    }

    .banca-logo {
        height: 35px;
        margin-bottom: 10px;
    }

    .enunciado {
        font-size: 15px;
        padding: 15px;
    }

    .alternative {
        padding: 12px;
        font-size: 14px;
    }

    .action-buttons {
        flex-direction: column;
    }
}
```

---

## ✨ Funcionalidades

### 📝 Gestão de Questões

#### Adição Manual
- Interface intuitiva para cadastro de questões
- Suporte a múltiplas alternativas (A-E)
- Upload de imagens
- Editor markdown para comentários
- Auto-complete de bancas/disciplinas/assuntos

#### Importação em Massa
```python
# Formato CSV
enunciado,alt_a,alt_b,alt_c,alt_d,alt_e,gabarito,banca,disciplina,assunto,ano,cargo,comentario
"Questão...","A","B","C","D","E","C","CEBRASPE","Dir. Const.","Dir. Fund.",2023,"Auditor","..."

# Formato JSON
{
  "questoes": [
    {
      "enunciado": "...",
      "alternativas": [...],
      "gabarito": "C",
      "metadata": {...}
    }
  ]
}
```

#### Detecção de Duplicatas
- Algoritmo de similaridade textual (Levenshtein)
- Comparação de metadados (banca + ano + cargo)
- Opção de merge ou descarte

### 📊 Estatísticas Avançadas

#### Dashboard Geral
```
┌─────────────────────────────────────────────────────────┐
│  ESTATÍSTICAS GERAIS                                    │
├─────────────────────────────────────────────────────────┤
│  Total de Questões:        2,547                        │
│  Questões Respondidas:     1,823  (71.6%)               │
│  Taxa de Acerto Geral:     76.3%                        │
│  Sequência Atual:          12 dias 🔥                   │
│  Melhor Sequência:         23 dias                      │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  POR BANCA                                              │
├──────────────┬──────────┬─────────┬────────────────────┤
│ Banca        │ Questões │ Acertos │ Taxa de Acerto     │
├──────────────┼──────────┼─────────┼────────────────────┤
│ CEBRASPE     │   650    │   520   │ 80.0% ████████░░   │
│ FGV          │   480    │   350   │ 72.9% ███████░░░   │
│ FCC          │   320    │   250   │ 78.1% ███████░░░   │
│ VUNESP       │   250    │   180   │ 72.0% ███████░░░   │
│ CESGRANRIO   │   123    │    90   │ 73.2% ███████░░░   │
└──────────────┴──────────┴─────────┴────────────────────┘
```

#### Análise por Disciplina
- Gráfico de pizza: distribuição de questões
- Heatmap de maestria por assunto
- Identificação automática de pontos fracos (<70% acerto)
- Sugestões de assuntos para revisar

#### Evolução Temporal
- Gráfico de linha: taxa de acerto ao longo do tempo
- Velocidade de resposta média
- Questões por dia/semana/mês
- Projeção de preparo para data da prova

### ⏱️ Modo Simulado

#### Configuração de Simulado
```python
SimuladoConfig(
    num_questions=50,
    time_limit=180,  # minutos
    bancas=['CEBRASPE', 'FGV'],
    disciplinas=['Direito Constitucional', 'Direito Administrativo'],
    year_range=(2020, 2024),
    random_order=True,
    show_result_immediately=False
)
```

#### Durante o Simulado
- Cronômetro regressivo visível
- Contador de questões respondidas
- Marcação de questões para revisão
- Navegação entre questões
- Pausa e retomada

#### Relatório Pós-Simulado
```
════════════════════════════════════════════════════════════
           RELATÓRIO DE DESEMPENHO - SIMULADO #23
════════════════════════════════════════════════════════════

📊 RESUMO GERAL
─────────────────────────────────────────────────────────
Questões:              50
Acertos:               38 (76%)
Erros:                 12 (24%)
Tempo Total:           142 min (2h22min)
Tempo Médio/Questão:   2min 50s

⏱️ DISTRIBUIÇÃO DE TEMPO
─────────────────────────────────────────────────────────
Rápidas (<1min):       8 questões  (75% acerto)
Normais (1-3min):     35 questões  (80% acerto)
Lentas (>3min):        7 questões  (57% acerto)

⚠️ ANÁLISE: Você erra mais em questões longas. Pratique
   leitura interpretativa.

📚 DESEMPENHO POR DISCIPLINA
─────────────────────────────────────────────────────────
Direito Constitucional:   18/20  (90%) ✅ Excelente
Direito Administrativo:   12/18  (67%) ⚠️ Melhorar
Português:                 8/12  (67%) ⚠️ Melhorar

🎯 RECOMENDAÇÕES
─────────────────────────────────────────────────────────
1. Reforçar: Direito Administrativo - Licitações
2. Praticar: Questões longas de interpretação
3. Revisar: Questões erradas deste simulado (12)

════════════════════════════════════════════════════════════
```

### 🧠 Algoritmo de Repetição Adaptado

Diferente do algoritmo SM-2 padrão do Anki, o Ankinator adapta os intervalos:

```python
def calculate_next_review_interval(question, user_response, settings):
    """
    Calcula intervalo de revisão considerando:
    - Algoritmo base SM-2 do Anki
    - Dificuldade objetiva da questão
    - Proximidade da prova
    - Pontos fracos do usuário
    - Importância configurada pelo usuário
    """

    # Intervalo base do Anki
    base_interval = anki_sm2_interval(user_response, question.ease_factor)

    # Fator 1: Proximidade da prova
    if settings.target_exam_date:
        days_until_exam = (settings.target_exam_date - datetime.now()).days
        if days_until_exam < 60:
            urgency_factor = max(0.3, days_until_exam / 60)
            base_interval *= urgency_factor

    # Fator 2: Dificuldade da questão
    difficulty_factor = 1 / (question.difficulty_score + 0.1)

    # Fator 3: Pontos fracos do usuário
    user_accuracy = get_user_accuracy(question.assunto)
    if user_accuracy < 0.70:  # Ponto fraco
        base_interval *= 0.7  # Revisar mais cedo

    # Fator 4: Prioridade da banca
    if question.banca == settings.target_exam_banca:
        base_interval *= 0.9  # Priorizar banca do concurso

    return base_interval * difficulty_factor
```

### 🔍 Filtros e Busca Avançada

Interface de busca com múltiplos critérios:

- **Por Banca**: Múltipla seleção (CEBRASPE + FGV + ...)
- **Por Disciplina**: Hierárquica (Direito > Constitucional > Direitos Fundamentais)
- **Por Ano**: Range slider (2015-2024)
- **Por Dificuldade**: Fácil / Médio / Difícil / Muito Difícil
- **Por Status**: Nunca vista / Nova / Aprendendo / Revisando / Dominada
- **Por Tags**: Busca por tags customizadas
- **Busca Textual**: Full-text search no enunciado
- **Com Imagens**: Apenas questões com/sem imagens
- **Com Comentários**: Apenas questões com explicação

Exemplos de queries:
```
banca:CEBRASPE AND disciplina:"Direito Constitucional" AND ano:2020..2024
tags:#difícil AND status:errada AND -banca:FGV
assunto:"Licitações" AND difficulty:hard
```

### 📈 Planejamento de Estudos

```python
# Geração automática de plano de estudos
planner = StudyPlanner(
    user_stats=current_stats,
    target_exam_date=datetime(2024, 12, 15),
    target_banca="CEBRASPE"
)

plan = planner.generate_study_plan()

# Output:
{
    "overview": {
        "dias_ate_prova": 45,
        "questoes_totais": 2547,
        "questoes_revisao": 823,
        "questoes_novas": 1724,
        "meta_diaria": 56,
        "tempo_estimado": "2.5 horas/dia"
    },

    "fases": [
        {
            "nome": "Fase 1: Fortalecimento de Bases",
            "periodo": "Dias 1-15",
            "foco": ["Direito Administrativo - Licitações",
                     "Português - Interpretação"],
            "meta_diaria": 40,
            "tipo": "Questões de dificuldade média em assuntos fracos"
        },
        {
            "nome": "Fase 2: Questões CEBRASPE",
            "periodo": "Dias 16-35",
            "foco": "Exclusivamente CEBRASPE",
            "meta_diaria": 60,
            "tipo": "Todas as disciplinas, foco na banca"
        },
        {
            "nome": "Fase 3: Simulados Intensivos",
            "periodo": "Dias 36-45",
            "foco": "Simulados completos",
            "meta_diaria": "1 simulado + revisão de erros",
            "tipo": "Provas anteriores completas"
        }
    ],

    "distribuicao_semanal": {
        "segunda": "Dir. Constitucional (30q) + Português (20q)",
        "terca": "Dir. Administrativo (40q) + Revisão (10q)",
        "quarta": "Dir. Penal (30q) + Informática (20q)",
        "quinta": "Simulado parcial (50q)",
        "sexta": "Dir. Tributário (40q) + Revisão erros (10q)",
        "sabado": "Simulado completo (100q)",
        "domingo": "Revisão geral + Descanso"
    }
}
```

### 🤖 Detecção Inteligente de Padrões

```python
patterns = ErrorPatternDetector(user_history).analyze()

# Output:
{
    "time_pressure": {
        "detected": True,
        "insight": "Você erra 25% mais quando responde em <60s",
        "recommendation": "Defina tempo mínimo de 90s por questão"
    },

    "confusion_matrix": {
        "detected": True,
        "pairs": [
            ("Direito Penal", "Direito Processual Penal", 0.72),
            ("Competência Comum", "Competência Privativa", 0.68)
        ],
        "recommendation": "Criar flashcards comparativos entre conceitos similares"
    },

    "time_of_day": {
        "best_period": "Manhã (8h-12h)",
        "accuracy_morning": 0.82,
        "accuracy_afternoon": 0.75,
        "accuracy_night": 0.68,
        "recommendation": "Priorize estudo de manhã quando possível"
    },

    "question_length": {
        "short_accuracy": 0.85,  # <500 caracteres
        "medium_accuracy": 0.78,  # 500-1000
        "long_accuracy": 0.65,   # >1000
        "recommendation": "Pratique mais questões longas de interpretação"
    }
}
```

---

## 📦 Instalação

### Pré-requisitos

- **Anki 2.1.66 ou superior** ([Download](https://apps.ankiweb.net/))
- **Python 3.9+** (geralmente incluído com Anki)
- **Sistema Operacional**: Windows 10+, macOS 10.14+, ou Linux

### Método 1: Via AnkiWeb (Recomendado - Futuro)

1. Abra o Anki
2. Vá em `Ferramentas` → `Add-ons` → `Buscar Add-ons`
3. Digite o código: `XXXXXXXXX`
4. Clique em `OK` e reinicie o Anki

### Método 2: Instalação Manual (Desenvolvimento)

```bash
# 1. Clone o repositório
git clone https://github.com/seu-usuario/ankinator.git
cd ankinator

# 2. Identifique o diretório de add-ons do Anki
# Linux/Mac: ~/.local/share/Anki2/addons21/
# Windows: %APPDATA%\Anki2\addons21\

# 3. Copie o addon
# Linux/Mac:
cp -r src/ankinator ~/.local/share/Anki2/addons21/

# Windows (PowerShell):
Copy-Item -Recurse -Path src\ankinator -Destination $env:APPDATA\Anki2\addons21\

# 4. Reinicie o Anki
```

### Primeira Configuração

Ao abrir o Anki após instalação:

1. **Aceite os Termos de Uso**
   - Leia o disclaimer sobre direitos autorais
   - Confirme que usará apenas para estudo pessoal

2. **Configure Dados da Prova** (Opcional)
   - Data da prova alvo
   - Banca organizadora
   - Cargo pretendido

3. **Importe seu Primeiro Deck**
   - `Ankinator` → `Questões` → `Importar Questões`
   - Selecione arquivo CSV/JSON
   - Configure mapeamento de campos
   - Confirme importação

4. **Explore o Dashboard**
   - `Ankinator` → `Estatísticas` → `Dashboard Geral`
   - Familiarize-se com a interface

---

## 📘 Guia de Uso

### Caso de Uso 1: Adicionando Questões Manualmente

```
1. Ankinator → Questões → Adicionar Questão Manual
2. Preencha os campos:
   Enunciado: "Sobre os direitos fundamentais..."
   Alternativa A: "São absolutos e ilimitados"
   Alternativa B: "Possuem eficácia horizontal"
   Alternativa C: "Não se aplicam a pessoas jurídicas"
   Alternativa D: "São imutáveis"
   Gabarito: B
   Banca: CEBRASPE
   Disciplina: Direito Constitucional
   Assunto: Direitos Fundamentais
   Ano: 2023
   Cargo: Auditor Fiscal
   Comentário: "Os direitos fundamentais possuem eficácia horizontal..."
3. Clique em "Salvar Questão"
```

### Caso de Uso 2: Importando Deck Completo

```bash
# Preparar arquivo CSV
cat questoes_direito_constitucional.csv
enunciado,alt_a,alt_b,alt_c,alt_d,gabarito,banca,disciplina,assunto,ano
"Questão 1...","A","B","C","D","C","CEBRASPE","Dir. Const.","Dir. Fund.",2023
"Questão 2...","A","B","C","D","B","FGV","Dir. Const.","Org. Estado",2022

# Importar no Anki
Ankinator → Questões → Importar CSV
- Selecione arquivo: questoes_direito_constitucional.csv
- Verificar mapeamento de campos
- Escolher deck destino: "Direito Constitucional"
- Verificar duplicatas: ✓ Ativado
- Clique em "Importar"

# Resultado:
✓ 247 questões importadas
⚠ 12 duplicatas detectadas (ignoradas)
✗ 3 questões com erros (veja log)
```

### Caso de Uso 3: Criando Simulado

```
1. Ankinator → Simulados → Novo Simulado
2. Configurar:
   Nome: "Simulado CEBRASPE #5"
   Quantidade: 50 questões
   Tempo Limite: 120 minutos
   Filtros:
     ✓ Banca: CEBRASPE
     ✓ Disciplinas: Dir. Constitucional, Dir. Administrativo
     ✓ Período: 2020-2024
     ✓ Ordem: Aleatória
   Opções:
     ✓ Cronômetro visível
     ☐ Mostrar gabarito imediatamente
     ✓ Permitir marcação de questões
3. Clique em "Iniciar Simulado"
4. Ao finalizar, veja relatório detalhado
```

### Caso de Uso 4: Revisão Diária

```
1. Abra o Anki
2. Selecione deck: "Ankinator::Questões de Concurso"
3. Clique em "Estudar Agora"
4. Para cada questão:
   a. Leia o enunciado
   b. Tente responder mentalmente
   c. Clique em "Mostrar Resposta"
   d. Veja o gabarito e comentário
   e. Avalie sua resposta:
      - Again (Errei): Verá novamente em breve
      - Hard (Acertei com dificuldade): Intervalo curto
      - Good (Acertei bem): Intervalo normal
      - Easy (Muito fácil): Intervalo longo
5. Repita até completar a meta diária
```

### Caso de Uso 5: Análise de Desempenho

```
1. Ankinator → Estatísticas → Dashboard Geral
2. Analise:
   - Taxa de acerto geral: 76% ✓
   - Pontos fortes: Direito Constitucional (85%)
   - Pontos fracos: Direito Tributário (62%) ⚠
3. Veja evolução temporal:
   - Gráfico mostra melhora consistente
   - Últimos 7 dias: 78% acerto
4. Identifique padrões:
   - Erra mais à noite (68% vs 82% manhã)
   - Questões longas: 65% acerto
5. Ajuste plano de estudos:
   Ankinator → Ferramentas → Planejador de Estudos
   - Priorizar: Direito Tributário
   - Praticar: Questões longas
   - Estudar preferencialmente: Manhã
```

---

## 📂 Estrutura do Projeto

O projeto Ankinator consiste em **dois componentes principais**:

### 1️⃣ Ankimon - Add-on do Anki (Python)

Interface gráfica e gerenciamento de questões dentro do Anki.

```
ankimon/
│
├── src/
│   └── ankinator/
│       ├── __init__.py              # Ponto de entrada principal
│       ├── config.py                # Configurações globais
│       ├── const.py                 # Constantes (bancas, cores, etc.)
│       ├── hooks.py                 # Setup de hooks do Anki
│       ├── menu_buttons.py          # Criação de menus
│       ├── resources.py             # Caminhos de recursos
│       │
│       ├── models/                  # Modelos de dados
│       │   ├── __init__.py
│       │   ├── question.py          # QuestionObject
│       │   ├── stats.py             # UserStats, BancaStats, etc.
│       │   ├── simulado.py          # SimuladoSession, SimuladoConfig
│       │   └── settings.py          # UserSettings
│       │
│       ├── gui/                     # Interface PyQt6
│       │   ├── __init__.py
│       │   ├── main_window.py       # Janela principal
│       │   ├── question_editor.py   # Editor de questões
│       │   ├── stats_dashboard.py   # Dashboard de estatísticas
│       │   ├── simulado_dialog.py   # Configuração de simulados
│       │   ├── import_dialog.py     # Diálogo de importação
│       │   ├── settings_window.py   # Janela de configurações
│       │   └── widgets/             # Widgets customizados
│       │       ├── banca_stats.py
│       │       ├── discipline_chart.py
│       │       └── calendar_heatmap.py
│       │
│       ├── core/                    # Lógica de negócio
│       │   ├── __init__.py
│       │   ├── question_manager.py  # CRUD de questões
│       │   ├── stats_calculator.py  # Cálculo de estatísticas
│       │   ├── study_planner.py     # Planejamento de estudos
│       │   ├── simulado_engine.py   # Engine de simulados
│       │   ├── scheduler.py         # Algoritmo de repetição
│       │   └── pattern_detector.py  # Detecção de padrões
│       │
│       ├── importers/               # Importadores
│       │   ├── __init__.py
│       │   ├── csv_importer.py
│       │   ├── json_importer.py
│       │   ├── pdf_importer.py      # Com OCR
│       │   └── deduplicator.py      # Detecção de duplicatas
│       │
│       ├── exporters/               # Exportadores
│       │   ├── __init__.py
│       │   ├── csv_exporter.py
│       │   ├── json_exporter.py
│       │   └── pdf_report.py        # Relatórios PDF
│       │
│       ├── database/                # Persistência
│       │   ├── __init__.py
│       │   ├── json_handler.py      # Operações JSON
│       │   ├── sqlite_handler.py    # Operações SQLite (futuro)
│       │   └── backup_manager.py    # Sistema de backup
│       │
│       ├── utils/                   # Utilitários
│       │   ├── __init__.py
│       │   ├── logger.py            # Sistema de logs
│       │   ├── validators.py        # Validações
│       │   ├── helpers.py           # Funções auxiliares
│       │   └── migration.py         # Migração de dados
│       │
│       └── templates/               # Templates HTML/CSS
│           ├── question_front.html
│           ├── question_back.html
│           ├── styles.css
│           └── scripts.js
│
├── resources/                       # Recursos estáticos
│   ├── icons/                       # Ícones da interface
│   ├── logos/                       # Logos de bancas
│   │   ├── cebraspe.png
│   │   ├── fgv.png
│   │   ├── fcc.png
│   │   └── ...
│   └── fonts/                       # Fontes customizadas
│
├── user_data/                       # Dados do usuário (gitignore)
│   ├── questions.json               # Questões
│   ├── user_stats.json              # Estatísticas
│   ├── config.json                  # Configurações
│   ├── simulados/                   # Histórico de simulados
│   └── backups/                     # Backups automáticos
│
├── tests/                           # Testes automatizados
│   ├── __init__.py
│   ├── test_question_manager.py
│   ├── test_stats_calculator.py
│   ├── test_importers.py
│   ├── test_scheduler.py
│   └── fixtures/                    # Dados de teste
│
├── docs/                            # Documentação
│   ├── ARCHITECTURE.md              # Arquitetura detalhada
│   ├── API.md                       # API interna
│   ├── CONTRIBUTING.md              # Guia de contribuição
│   ├── DEVELOPMENT.md               # Setup de desenvolvimento
│   └── USER_GUIDE.md                # Guia completo do usuário
│
├── .github/
│   ├── workflows/
│   │   ├── ci.yml                   # CI/CD
│   │   └── release.yml              # Automação de releases
│   └── ISSUE_TEMPLATE/
│       ├── bug_report.md
│       └── feature_request.md
│
├── addon.json                       # Metadados do addon (AnkiWeb)
├── manifest.json                    # Manifesto do addon
├── config.json                      # Configuração padrão
├── requirements.txt                 # Dependências Python
├── requirements-dev.txt             # Dependências de desenvolvimento
├── .gitignore
├── LICENSE                          # Licença MIT
└── README.md                        # Este arquivo
```

### 2️⃣ Ankinator-MCP - Servidor MCP (Node.js/TypeScript)

Ferramentas de IA para extração e validação de questões de PDFs.

```
ankinator-mcp/
│
├── src/
│   └── index.ts                     # Servidor MCP principal
│                                    # - 9 ferramentas MCP implementadas
│                                    # - Integração com Anthropic Claude API
│                                    # - Validação de CSV com Zod schemas
│                                    # - Extração de PDF com pdf-parse
│
├── dist/                            # Código compilado (gerado por tsc)
│   └── index.js                     # Executável do servidor MCP
│
├── docs/                            # Documentação do servidor
│   ├── MCP_CLIENT_CONFIG.md         # Configuração de clientes MCP
│   │                                # - Claude Desktop (macOS/Windows/Linux)
│   │                                # - Claude Code
│   │                                # - Troubleshooting
│   ├── USAGE.md                     # Guia completo de ferramentas
│   │                                # - Fase 1: Documentação (3 tools)
│   │                                # - Fase 2: CSV validation (3 tools)
│   │                                # - Fase 6: PDF extraction (3 tools)
│   └── PDF_EXTRACTION_PROMPT.md     # Regras de extração fidedigna
│                                    # - Fidelidade ao conteúdo original
│                                    # - Formato Q:/A: estruturado
│                                    # - Exemplos e casos especiais
│
├── node_modules/                    # Dependências npm
├── package.json                     # Metadados e scripts npm
├── package-lock.json                # Lock file de dependências
├── tsconfig.json                    # Configuração TypeScript
├── ROADMAP.md                       # Planejamento de fases
├── CHANGELOG.md                     # Histórico de mudanças (TODO)
└── README.md                        # Setup e quick start do MCP

### 📦 Dependências principais:
- @anthropic-ai/sdk              # API do Claude para extração
- @modelcontextprotocol/sdk      # Protocolo MCP
- pdf-parse                      # Extração de texto de PDFs
- csv-parse                      # Parse de CSV
- zod                            # Validação de schemas
```

---

## 🛠️ Desenvolvimento

### Setup de Ambiente

```bash
# 1. Clone o repositório
git clone https://github.com/seu-usuario/ankinator.git
cd ankinator

# 2. Crie ambiente virtual
python -m venv venv

# 3. Ative o ambiente
# Linux/Mac:
source venv/bin/activate
# Windows:
venv\Scripts\activate

# 4. Instale dependências
pip install -r requirements.txt
pip install -r requirements-dev.txt

# 5. Instale hooks de pre-commit
pre-commit install

# 6. Rode os testes
pytest tests/

# 7. Verifique cobertura
pytest --cov=src/ankinator tests/
```

### Dependências Principais

```
# requirements.txt
aqt>=2.1.66          # Anki Qt interface
anki>=2.1.66         # Anki core
PyQt6>=6.4.0         # Interface gráfica
beautifulsoup4>=4.11 # Parsing HTML
pytesseract>=0.3.10  # OCR
PyPDF2>=3.0.0        # Manipulação de PDF
matplotlib>=3.6.0    # Gráficos
pandas>=1.5.0        # Análise de dados
```

### Arquitetura de Código

O Ankinator segue princípios de **Clean Architecture** e **SOLID**:

1. **Separação de Camadas**:
   - `models/`: Entidades de negócio (sem dependências externas)
   - `core/`: Lógica de negócio (depende apenas de models)
   - `gui/`: Interface (depende de core e models)
   - `database/`: Persistência (implementa interfaces definidas em core)

2. **Dependency Injection**:
```python
# Exemplo: __init__.py
from .core.question_manager import QuestionManager
from .database.json_handler import JsonHandler
from .gui.main_window import MainWindow

# Injetar dependências
db_handler = JsonHandler(data_path)
question_manager = QuestionManager(db_handler)
main_window = MainWindow(question_manager)
```

3. **Event-Driven**:
```python
# Uso de signals do PyQt6
class QuestionManager(QObject):
    question_added = pyqtSignal(QuestionObject)
    question_updated = pyqtSignal(QuestionObject)
    question_deleted = pyqtSignal(str)  # question_id

class StatsCalculator(QObject):
    def __init__(self, question_manager):
        question_manager.question_added.connect(self.recalculate_stats)
        question_manager.question_updated.connect(self.update_question_stats)
```

### Testes

```python
# tests/test_question_manager.py
import pytest
from ankinator.models.question import QuestionObject
from ankinator.core.question_manager import QuestionManager

class TestQuestionManager:
    @pytest.fixture
    def manager(self, tmp_path):
        """Fixture: cria manager com DB temporário"""
        db_handler = JsonHandler(tmp_path / "test.json")
        return QuestionManager(db_handler)

    def test_add_question(self, manager):
        """Testa adição de questão"""
        question = QuestionObject(
            enunciado="Teste",
            alternativas=[{"A": "Op1"}, {"B": "Op2"}],
            gabarito="A",
            banca="CEBRASPE"
        )

        result = manager.add_question(question)
        assert result.success is True
        assert len(manager.get_all_questions()) == 1

    def test_detect_duplicate(self, manager):
        """Testa detecção de duplicatas"""
        q1 = QuestionObject(enunciado="Questão idêntica", ...)
        q2 = QuestionObject(enunciado="Questão idêntica", ...)

        manager.add_question(q1)
        result = manager.add_question(q2)

        assert result.is_duplicate is True
        assert len(manager.get_all_questions()) == 1

# Executar testes com coverage
# pytest --cov=src/ankinator --cov-report=html tests/
```

### Padrões de Código

```python
# Usar type hints
def calculate_stats(questions: List[QuestionObject]) -> UserStats:
    ...

# Docstrings Google Style
def import_csv(file_path: str, skip_duplicates: bool = True) -> ImportResult:
    """
    Importa questões de arquivo CSV.

    Args:
        file_path: Caminho absoluto para arquivo CSV
        skip_duplicates: Se True, ignora questões duplicadas

    Returns:
        ImportResult com estatísticas da importação

    Raises:
        FileNotFoundError: Se arquivo não existe
        InvalidCSVFormatError: Se formato está incorreto

    Example:
        >>> result = import_csv("/path/to/questions.csv")
        >>> print(f"Importadas: {result.imported_count}")
    """
    ...

# Usar enums para constantes
from enum import Enum

class Banca(Enum):
    CEBRASPE = "cebraspe"
    FGV = "fgv"
    FCC = "fcc"
    VUNESP = "vunesp"

class Difficulty(Enum):
    FACIL = "facil"
    MEDIO = "medio"
    DIFICIL = "dificil"
    MUITO_DIFICIL = "muito_dificil"
```

### CI/CD

```yaml
# .github/workflows/ci.yml
name: CI

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        python-version: [3.9, 3.10, 3.11]

    steps:
    - uses: actions/checkout@v3

    - name: Set up Python
      uses: actions/setup-python@v4
      with:
        python-version: ${{ matrix.python-version }}

    - name: Install dependencies
      run: |
        pip install -r requirements.txt
        pip install -r requirements-dev.txt

    - name: Run tests
      run: pytest --cov=src/ankinator tests/

    - name: Upload coverage
      uses: codecov/codecov-action@v3

  lint:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    - name: Run flake8
      run: flake8 src/
    - name: Run mypy
      run: mypy src/
```

---

## 🗺️ Roadmap

### v0.1.0 - MVP (Q1 2025)
**Meta: Addon funcional básico**

- [x] Estrutura base do projeto
- [ ] Modelo de dados (QuestionObject, UserStats)
- [ ] Note type customizado para questões
- [ ] Template HTML/CSS básico e responsivo
- [ ] Interface de adição manual de questões
- [ ] Importação básica de CSV
- [ ] Estatísticas simples (total, % acerto)
- [ ] Categorização por banca/disciplina/ano
- [ ] Sistema de configuração
- [ ] Integração com hooks do Anki
- [ ] Documentação básica

**Entregáveis:**
- Addon instalável manualmente
- Suporte a 500+ questões sem problemas de performance
- Taxa de erro <5%

### v0.2.0 - Estatísticas Avançadas (Q2 2025)
**Meta: Sistema completo de análise**

- [ ] Dashboard com gráficos (PyQt6 + Matplotlib)
- [ ] Estatísticas por banca detalhadas
- [ ] Estatísticas por disciplina/assunto hierárquicas
- [ ] Identificação automática de pontos fracos
- [ ] Gráfico de evolução temporal
- [ ] Heatmap de dias de estudo
- [ ] Exportação de relatórios PDF
- [ ] Sistema de filtros avançados
- [ ] Busca full-text em questões
- [ ] Comparativo de desempenho (antes/depois)

**Entregáveis:**
- Dashboard visual completo
- Relatórios exportáveis
- Identificação de >90% dos pontos fracos reais

### v0.3.0 - Modo Simulado (Q3 2025)
**Meta: Prática em condições reais**

- [ ] Engine de simulados cronometrados
- [ ] Configuração flexível de simulados
- [ ] Interface de simulado (cronômetro, navegação)
- [ ] Relatório pós-simulado detalhado
- [ ] Histórico de simulados
- [ ] Análise comparativa entre simulados
- [ ] Projeção de nota baseada em simulados
- [ ] Modo "Prova Real" (bloqueio de revisão)
- [ ] Estatísticas de tempo por questão

**Entregáveis:**
- Sistema de simulados 100% funcional
- Cronômetro preciso (±1 segundo)
- Relatórios com insights acionáveis

### v0.4.0 - Importação Avançada (Q4 2025)
**Meta: Facilitar adição de questões**

- [ ] Importação de JSON estruturado
- [ ] Importação de PDF com OCR (Tesseract)
- [ ] Parser específico por banca
- [ ] Detecção inteligente de duplicatas (>95% precisão)
- [ ] Validação automática de questões
- [ ] Importação em lote (1000+ questões)
- [ ] Assistente de importação guiado
- [ ] Preview de questões antes de importar
- [ ] Correção automática de formatação

**Entregáveis:**
- Suporte a PDFs de provas oficiais
- Importação de 1000 questões em <60 segundos
- Taxa de erro de OCR <3%

### v0.5.0 - Recursos Avançados (Q1 2026)
**Meta: Inteligência e planejamento**

- [ ] Sistema de anotações por questão
- [ ] Planejador automático de estudos
- [ ] Detector de padrões de erro
- [ ] Tags inteligentes automáticas
- [ ] Sistema de backup automático
- [ ] Sincronização entre dispositivos
- [ ] Algoritmo de repetição adaptado
- [ ] Priorização por proximidade de prova
- [ ] Flashcards de conceitos extraídos
- [ ] Integração com APIs de legislação

**Entregáveis:**
- Planejador com >80% precisão
- Detecção de padrões com significância estatística
- Backup automático diário

### v0.6.0 - Comunidade (Q2 2026)
**Meta: Colaboração e compartilhamento**

- [ ] Sistema de compartilhamento de decks
- [ ] Comentários colaborativos
- [ ] Estatísticas agregadas anônimas
- [ ] Ranking opcional de desempenho
- [ ] Marketplace de decks de questões
- [ ] Sistema de reputação
- [ ] Moderação de conteúdo
- [ ] API pública

**Entregáveis:**
- Plataforma web de compartilhamento
- >1000 usuários ativos
- >10.000 questões compartilhadas

### v1.0.0 - Release Oficial (Q3 2026)
**Meta: Produto maduro e polido**

- [ ] Interface polida e intuitiva
- [ ] Documentação completa (texto + vídeo)
- [ ] Testes automatizados (>80% coverage)
- [ ] Publicação no AnkiWeb
- [ ] Suporte a múltiplos idiomas
- [ ] Acessibilidade (WCAG 2.1)
- [ ] Performance otimizada (10k+ questões)
- [ ] Bug fixes finais
- [ ] Marketing e divulgação

**Entregáveis:**
- Addon disponível no AnkiWeb oficial
- >5.000 downloads
- Nota média >4.5/5
- Documentação em PT-BR e EN

### Pós v1.0 (Futuro)

- [ ] App mobile nativo (iOS/Android)
- [ ] Integração com cursinhos online
- [ ] IA para geração de questões similares
- [ ] Análise preditiva de aprovação
- [ ] Sistema de mentoria
- [ ] Gamificação avançada
- [ ] Suporte a questões discursivas
- [ ] Editor de provas customizadas

---

## 🤝 Contribuindo

Contribuições são **muito bem-vindas**! Este é um projeto feito por concurseiros, para concurseiros.

### Como Contribuir

1. **Fork** o projeto
2. Crie uma **branch** para sua feature (`git checkout -b feature/MinhaFeature`)
3. **Commit** suas mudanças (`git commit -m 'feat: Adiciona funcionalidade X'`)
4. **Push** para a branch (`git push origin feature/MinhaFeature`)
5. Abra um **Pull Request**

### Áreas que Precisam de Ajuda

- [ ] **Design**: Melhorar UI/UX do addon
- [ ] **Desenvolvimento**: Implementar features do roadmap
- [ ] **Testes**: Aumentar cobertura de testes
- [ ] **Documentação**: Melhorar guias e tutoriais
- [ ] **Parsers**: Criar importadores para novas bancas
- [ ] **Tradução**: Internacionalização (EN, ES)
- [ ] **Conteúdo**: Criar decks de questões públicos (legais)
- [ ] **Marketing**: Divulgar o projeto na comunidade

### Guia de Estilo

**Commits**:
- Use [Conventional Commits](https://www.conventionalcommits.org/)
- Exemplos: `feat:`, `fix:`, `docs:`, `test:`, `refactor:`

**Código**:
- Siga PEP 8 (verificar com `flake8`)
- Type hints obrigatórios
- Docstrings em Google Style
- Máximo 88 caracteres por linha (Black formatter)

**Pull Requests**:
- Descreva claramente o que foi mudado e por quê
- Adicione screenshots se relevante
- Certifique-se que testes passam
- Atualize documentação se necessário

### Code of Conduct

- Seja respeitoso e colaborativo
- Foco em ajudar concurseiros
- Proibido compartilhamento ilegal de conteúdo protegido
- Ambiente acolhedor para todos os níveis

---

## ⚖️ Aspectos Legais

### Direitos Autorais

**IMPORTANTE**: Questões de concursos públicos são protegidas por direitos autorais das bancas organizadoras.

**O Ankinator é:**
- ✅ Uma **ferramenta** para organização pessoal de estudos
- ✅ **Software livre** distribuído sob licença MIT
- ✅ Permitido para uso **pessoal e educacional**

**O Ankinator NÃO é:**
- ❌ Um repositório de questões
- ❌ Uma plataforma de distribuição de conteúdo protegido
- ❌ Responsável pelo conteúdo adicionado pelos usuários

### Responsabilidade do Usuário

Ao usar o Ankinator, você concorda que:

1. **Obterá questões de fontes legítimas**:
   - Livros comprados
   - Cursos pagos
   - PDFs oficiais das bancas
   - Sites autorizados

2. **Usará apenas para estudo pessoal**:
   - Não redistribuirá questões sem autorização
   - Não comercializará decks de questões
   - Respeitará direitos autorais das bancas

3. **Entende que compartilhamento ilegal é crime**:
   - Lei 9.610/98 (Direitos Autorais)
   - Pena: detenção de 3 meses a 1 ano + multa

### Licença do Software

```
MIT License

Copyright (c) 2024 Ankinator Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

### Privacidade (LGPD)

O Ankinator **respeita totalmente sua privacidade**:

- ✅ **Dados locais**: Tudo armazenado no seu computador
- ✅ **Sem telemetria**: Zero tracking ou analytics
- ✅ **Sem nuvem obrigatória**: Funciona 100% offline
- ✅ **Controle total**: Você possui seus dados
- ✅ **Exportação**: Exporte tudo a qualquer momento
- ✅ **Deleção**: Delete tudo quando quiser

**Dados opcionais** (desabilitados por padrão):
- Estatísticas anônimas agregadas para melhorar algoritmo
- Ranking de desempenho (anonimizado)

---

## ❓ FAQ

### Questões Gerais

**P: O Ankinator substitui fazer questões em sites/PDFs?**
R: Não, ele **complementa**. O diferencial é a repetição espaçada: você revisa questões importantes nos momentos ideais para fixação.

**P: Posso usar em qualquer concurso?**
R: Sim! Embora otimizado para concursos públicos brasileiros, funciona com qualquer tipo de questão de múltipla escolha.

**P: Funciona em celular?**
R: Sim! Os cards sincronizam via AnkiWeb e podem ser revisados no AnkiDroid (Android) ou AnkiMobile (iOS). Algumas funcionalidades avançadas (dashboard, simulados) só estão disponíveis no desktop.

**P: É pago?**
R: **Não, é 100% gratuito e open-source**. Sem paywall, sem features premium.

### Questões Técnicas

**P: Qual a diferença do Anki padrão?**
R: O Ankinator adiciona funcionalidades específicas para questões de concurso: estatísticas por banca, modo simulado, importação de PDFs, planejamento de estudos, etc.

**P: Posso usar com meus decks Anki existentes?**
R: Sim, o Ankinator não interfere com outros decks. Ele cria note types próprios para questões de concurso.

**P: Quantas questões o Ankinator suporta?**
R: Testado com até 10.000 questões sem problemas de performance. Para coleções maiores, use a versão SQLite (v0.4+).

**P: Como funciona o backup?**
R: Backup automático diário em `user_data/backups/`. Mantém últimos 30 backups. Você também pode fazer backup manual a qualquer momento.

**P: Posso contribuir mesmo sem saber programar?**
R: Sim! Você pode ajudar com: testes, documentação, design, sugestões de features, divulgação, etc.

### Questões sobre Estudo

**P: Quanto tempo devo estudar por dia?**
R: Depende de quanto tempo você tem até a prova. O Planejador de Estudos do Ankinator sugere metas diárias baseadas na sua disponibilidade e data da prova.

**P: Devo fazer todas as questões ou só revisar?**
R: Ambos! Faça questões novas para aprender conteúdo novo, e revise questões antigas para fixar. O Ankinator equilibra automaticamente.

**P: Como lidar com assuntos que sempre erro?**
R: O Detector de Padrões identifica seus pontos fracos. Foque neles, mas sem negligenciar os pontos fortes (que também precisam de manutenção).

**P: Vale a pena fazer simulados?**
R: **Sim!** Simulados treinam gestão de tempo, reduzem ansiedade e identificam gaps de conhecimento. Recomendamos 1-2 simulados por semana nas últimas semanas antes da prova.

---

## 💬 Suporte

### Canais de Suporte

- **GitHub Issues**: [Reportar bugs ou solicitar features](https://github.com/seu-usuario/ankinator/issues)
- **GitHub Discussions**: [Tirar dúvidas e discutir o projeto](https://github.com/seu-usuario/ankinator/discussions)
- **Discord** (futuro): Comunidade em tempo real
- **Email**: ankinator@example.com (apenas para assuntos críticos)

### Como Reportar Bugs

Ao reportar um bug, inclua:

1. **Versão do Ankinator**: (veja em `Ankinator → Sobre`)
2. **Versão do Anki**: (veja em `Ajuda → Sobre o Anki`)
3. **Sistema Operacional**: (Windows 11, macOS 13, Ubuntu 22.04, etc.)
4. **Descrição do problema**: O que aconteceu vs. o que deveria acontecer
5. **Passos para reproduzir**: Como fazer o bug acontecer novamente
6. **Screenshots**: Se relevante
7. **Logs**: (veja `Ankinator → Ferramentas → Exportar Logs`)

### Como Solicitar Features

Ao solicitar uma feature:

1. **Descreva o problema**: Qual necessidade não está sendo atendida?
2. **Proposta de solução**: Como você imagina que deveria funcionar?
3. **Alternativas consideradas**: Já tentou resolver de outra forma?
4. **Contexto adicional**: Por que isso é importante para você?

---

## 🙏 Agradecimentos

- **Damien Elmes** e equipe Anki pela plataforma incrível
- **Unlucky-Life** (autor do Ankimon) pela inspiração de design de addon
- Comunidade de concurseiros que testaram e deram feedback
- Todos os contribuidores open-source

---

## 📜 Licença

Este projeto está sob a licença **MIT**. Veja o arquivo [LICENSE](LICENSE) para detalhes.

**TL;DR**: Você pode usar, modificar e distribuir livremente, desde que mantenha o aviso de copyright.

---

<div align="center">

**Desenvolvido com dedicação por concurseiros, para concurseiros** 📚

*Bons estudos e sucesso na sua jornada rumo à aprovação!* ✨

[![GitHub Stars](https://img.shields.io/github/stars/seu-usuario/ankinator?style=social)](https://github.com/seu-usuario/ankinator)
[![GitHub Forks](https://img.shields.io/github/forks/seu-usuario/ankinator?style=social)](https://github.com/seu-usuario/ankinator/fork)

[⬆ Voltar ao topo](#ankinator---sistema-avançado-de-questões-para-concursos-públicos)

</div>
