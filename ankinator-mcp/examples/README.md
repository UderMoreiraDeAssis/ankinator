# Fixtures de Teste - Ankinator MCP

Este diretório contém fixtures (dados de teste) para validar as **9 ferramentas MCP** do ankinator-mcp.

## 📋 Estrutura

```
examples/
├── csv/                        # Arquivos CSV para teste
│   ├── valido_minimo.csv        (3 questões básicas)
│   ├── valido_completo.csv      (10 questões, todos os campos)
│   ├── invalido_campos.csv      (erro: resposta vazia)
│   └── invalido_dificuldade.csv (erro: enum inválido)
│
├── pdf/                        # Arquivos PDF para teste
│   ├── sample_simples.pdf       (Python, 2 páginas, ~8 Q/A)
│   └── sample_matematica.pdf    (Matemática, 3 páginas, ~12 Q/A)
│
└── README.md                   # Este arquivo
```

---

## 📄 CSVs de Teste (`csv/`)

### Schema CSV do Anki

```csv
pergunta,resposta,opcoes,dificuldade,categoria
```

**Campos:**
- `pergunta` (obrigatório): Pergunta do flashcard
- `resposta` (obrigatório): Resposta do flashcard
- `opcoes` (opcional): Alternativas no formato "A) X|B) Y|C) Z|D) W"
- `dificuldade` (opcional): facil | medio | dificil | muito_dificil
- `categoria` (opcional): Categoria livre (ex: Programação, Matemática)

### 1. `valido_minimo.csv` ✅

**Propósito:** Testar validação com campos mínimos (apenas pergunta,resposta)

**Conteúdo:** 3 questões básicas sobre Python

**Uso:** Validar que o schema aceita CSV sem campos opcionais

```bash
# Testar com validar_csv
ferramenta: validar_csv
params: { path: "examples/csv/valido_minimo.csv" }
```

### 2. `valido_completo.csv` ✅

**Propósito:** Testar validação com todos os campos preenchidos

**Conteúdo:** 10 questões variadas
- Categorias: Programação, Matemática, Geografia
- Dificuldades: todas as 4 opções (facil → muito_dificil)
- Algumas com opções, outras sem

**Uso:** Testar `sample_rows` e `contar_campos`

```bash
# Ver preview das questões
ferramenta: sample_rows
params: { path: "examples/csv/valido_completo.csv", n: 5 }

# Análise estatística
ferramenta: contar_campos
params: { path: "examples/csv/valido_completo.csv" }
```

### 3. `invalido_campos.csv` ❌

**Propósito:** Testar validação de campos obrigatórios

**Erro esperado:** Primeira questão tem `resposta` vazia

**Uso:** Verificar se `validar_csv` detecta erro corretamente

```bash
ferramenta: validar_csv
params: { path: "examples/csv/invalido_campos.csv" }
# Deve retornar erro: "Linha 2: resposta: Resposta não pode ser vazia"
```

### 4. `invalido_dificuldade.csv` ❌

**Propósito:** Testar validação de enum de dificuldade

**Erro esperado:** Questões com dificuldade inválida ("super_dificil", "extremamente_dificil")

**Uso:** Verificar se `validar_csv` detecta enum inválido

```bash
ferramenta: validar_csv
params: { path: "examples/csv/invalido_dificuldade.csv" }
# Deve retornar erro de enum inválido
```

---

## 📚 PDFs de Teste (`pdf/`)

### 1. `sample_simples.pdf` 📘

**Tópico:** Introdução à Programação Python

**Conteúdo:**
- Página 1: O que é Python? | Variáveis
- Página 2: Tipos de dados | Operadores

**Características:**
- 2 páginas, ~3.4KB
- Texto limpo, sem fórmulas complexas
- Estruturado em seções com definições claras
- Gera naturalmente ~6-8 pares Q:/A:

**Uso:** Testar extração de PDF simples

```bash
# Preview rápido
ferramenta: preview_questoes
params: { path: "examples/pdf/sample_simples.pdf", n: 5 }

# Extração completa
ferramenta: extrair_questoes
params: {
  path: "examples/pdf/sample_simples.pdf",
  maxQuestions: 10
}
```

### 2. `sample_matematica.pdf` 📐

**Tópico:** Equações do Segundo Grau

**Conteúdo:**
- Página 1: Definição | Coeficientes
- Página 2: Fórmula de Bhaskara | Discriminante Δ
- Página 3: Interpretação do Δ | Exemplos resolvidos

**Características:**
- 3 páginas, ~3.8KB
- Inclui fórmulas matemáticas: ax² + bx + c = 0, Δ = b² - 4ac
- Símbolos especiais: ±, √, ≠, ²
- Gera naturalmente ~10-12 pares Q:/A:

**Uso:** Testar extração de PDF com conteúdo matemático

```bash
# Preview
ferramenta: preview_questoes
params: { path: "examples/pdf/sample_matematica.pdf", n: 8 }

# Extração completa e conversão para CSV
# 1. Extrair
ferramenta: extrair_questoes
params: { path: "examples/pdf/sample_matematica.pdf" }

# 2. Converter output para CSV
ferramenta: converter_para_csv
params: {
  questoes: "[output da ferramenta anterior]",
  categoria: "Matemática"
}
```

---

## 🔄 Como Regenerar os Fixtures

Os fixtures são gerados automaticamente por um script Node.js.

### Comandos

```bash
# Na raiz do ankinator-mcp:
npm run generate-fixtures

# Ou diretamente:
node scripts/generate-fixtures.js
```

### O que o script faz

1. **Gera 4 CSVs** em `examples/csv/`
   - Cria conteúdo inline (não lê arquivos externos)
   - Usa schema correto: `pergunta,resposta,opcoes,dificuldade,categoria`

2. **Gera 2 PDFs** em `examples/pdf/`
   - Usa biblioteca `pdfkit` para criar PDFs programaticamente
   - Conteúdo educacional estruturado
   - PDFs pequenos (< 5KB cada)

### Por que fixtures gerados automaticamente?

✅ **Reproduzível** - Qualquer desenvolvedor pode regenerar
✅ **Versionável** - Código do script está no git
✅ **Modificável** - Fácil ajustar conteúdo editando o script
✅ **Consistente** - Sempre gera os mesmos fixtures

---

## 🧪 Workflows de Teste

### Workflow 1: Validar CSV antes de importar

```bash
1. validar_csv → examples/csv/valido_completo.csv
2. sample_rows → ver preview das questões
3. contar_campos → verificar distribuição
4. [Se OK] → Importar no Ankimon
```

### Workflow 2: PDF → CSV validado

```bash
1. preview_questoes → examples/pdf/sample_simples.pdf (n=3)
2. [Se qualidade boa] extrair_questoes → path=sample_simples.pdf
3. converter_para_csv → questoes=[output], categoria="Python"
4. validar_csv → path=[CSV gerado]
5. [Se OK] → Importar no Ankimon
```

### Workflow 3: Testar detecção de erros

```bash
1. validar_csv → examples/csv/invalido_campos.csv
   Resultado esperado: ❌ Erro na linha 2

2. validar_csv → examples/csv/invalido_dificuldade.csv
   Resultado esperado: ❌ Erro de enum inválido
```

---

## 📊 Métricas dos Fixtures

| Arquivo | Tamanho | Linhas | Questões | Erros? |
|---------|---------|--------|----------|--------|
| valido_minimo.csv | ~400B | 4 | 3 | Não |
| valido_completo.csv | ~1.6KB | 11 | 10 | Não |
| invalido_campos.csv | ~185B | 3 | 2 | Sim (resposta vazia) |
| invalido_dificuldade.csv | ~296B | 3 | 2 | Sim (enum inválido) |
| sample_simples.pdf | 3.4KB | 2 pág | ~8 Q/A | Não |
| sample_matematica.pdf | 3.8KB | 3 pág | ~12 Q/A | Não |

**Total:** 6 arquivos, ~9.7KB, cobre todos os casos de uso das 9 ferramentas MCP

---

## 🔧 Troubleshooting

### PDFs não são extraídos corretamente

- ✅ Verificar se `ANTHROPIC_API_KEY` está configurada
- ✅ Testar com `preview_questoes` primeiro (usa menos tokens)
- ✅ PDFs de teste são texto extraível (não imagens escaneadas)

### CSV não valida

- ✅ Verificar encoding do arquivo (deve ser UTF-8)
- ✅ Verificar delimitador (deve ser vírgula)
- ✅ Verificar se campos obrigatórios estão preenchidos

### Regenerar não funciona

```bash
# Verificar se pdfkit está instalado
npm list pdfkit

# Reinstalar se necessário
npm install --save-dev pdfkit @types/pdfkit

# Executar com path absoluto
node /caminho/completo/para/scripts/generate-fixtures.js
```

---

**Última atualização:** 2025-11-22
**Versão:** 1.0
**Compatível com:** ankinator-mcp v0.1.0
