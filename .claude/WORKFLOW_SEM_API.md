# 🎉 Workflow NOVO: Extração de PDF SEM API Key!

## ✅ Problema Resolvido

**Antes:** Precisava configurar ANTHROPIC_API_KEY e pagar por chamadas externas à API
**Agora:** Use o **Claude da própria conversa** para processar PDFs - **GRÁTIS e SEM API key!**

---

## 🚀 Como Funciona

### Ferramenta Nova: `extrair_texto_pdf`

**O que faz:**
1. ✅ Lê o PDF e extrai o texto
2. ✅ Retorna o texto + prompt rigoroso para Claude
3. ✅ **Claude (na conversa) processa e gera as questões**
4. ✅ **SEM custo adicional de API**
5. ✅ **SEM necessidade de API key**

---

## 📝 Workflow Completo: PDF → CSV para Anki

### Passo 1: Configure o MCP (só precisa fazer uma vez)

O arquivo `.claude/mcp_settings.json` já está configurado:

```json
{
  "mcpServers": {
    "ankinator": {
      "command": "node",
      "args": ["ankinator-mcp/dist/index.js"]
    }
  }
}
```

**Ative o MCP:**
1. Recarregue o Claude Code: `Ctrl+Shift+P` → "Developer: Reload Window"
2. Verifique se funcionou: Em nova conversa, pergunte "Quais ferramentas MCP você tem?"

---

### Passo 2: Extrair Questões do PDF (nova forma!)

**Em uma conversa com Claude, simplesmente diga:**

```
Extraia questões do PDF curso-230987-aula-01-grifado-a09d.pdf
e gere até 30 pares de pergunta/resposta no formato Q:/A:
```

**O que acontece nos bastidores:**

1. Claude chama a ferramenta MCP `extrair_texto_pdf`
2. A ferramenta retorna:
   - Texto completo do PDF
   - Prompt rigoroso de extração
3. Claude processa o texto seguindo o prompt
4. Claude gera questões Q:/A: fidedignas

**Exemplo de output esperado:**

```
Q: O que é Git?
A: Um sistema de controle de versão distribuído

Q: Quem criou o Git?
A: Linus Torvalds

Q: Quando foi criado o Git?
A: Em 2005
```

---

### Passo 3: Converter para CSV

**Após Claude gerar as questões, diga:**

```
Converta essas questões para CSV usando a ferramenta converter_para_csv
```

Claude vai chamar a ferramenta MCP e retornar:

```csv
pergunta,resposta,categoria
"O que é Git?","Um sistema de controle de versão distribuído",""
"Quem criou o Git?","Linus Torvalds",""
"Quando foi criado o Git?","Em 2005",""
```

---

### Passo 4: Salvar o CSV

```
Salve esse CSV no arquivo curso-230987-aula-01-questoes.csv
```

---

### Passo 5: Validar (opcional mas recomendado)

```
Valide o CSV curso-230987-aula-01-questoes.csv
```

Claude vai chamar `validar_csv` e confirmar que está tudo OK para importar no Anki.

---

## 🆚 Comparação: Antes vs. Depois

| Aspecto | ❌ Antes (extrair_questoes) | ✅ Agora (extrair_texto_pdf) |
|---------|------------------------------|-------------------------------|
| **API Key** | Obrigatória | Não necessária |
| **Custo** | ~$0.05-1.00 por PDF | Grátis |
| **Configuração** | ANTHROPIC_API_KEY no .env | Nenhuma |
| **Transparência** | Chamada externa (caixa preta) | Processamento visível na conversa |
| **Flexibilidade** | Fixo (20-100 questões) | Ajustável em tempo real |
| **Revisão** | Após geração completa | Durante geração (pode pedir ajustes) |

---

## 💡 Exemplos de Uso

### Exemplo 1: Extração Básica

```
Você: Extraia questões do PDF aula-python.pdf

Claude: [Chama extrair_texto_pdf]
Claude: Vou processar o PDF e gerar questões...

[Claude gera questões Q:/A:]

Q: O que é uma lista em Python?
A: Uma estrutura de dados mutável que armazena uma coleção ordenada de itens
...
```

### Exemplo 2: Extração + Conversão + Salvamento

```
Você: Processe o PDF matematica.pdf, gere 20 questões e salve em matematica-questoes.csv

Claude: [Chama extrair_texto_pdf]
Claude: [Gera 20 questões Q:/A:]
Claude: [Chama converter_para_csv]
Claude: [Salva o arquivo]

Pronto! Arquivo matematica-questoes.csv criado com 20 questões.
```

### Exemplo 3: Com Categoria

```
Você: Extraia questões do PDF historia-brasil.pdf e categorize como "História do Brasil"

Claude: [Processa e gera questões]
Claude: [Chama converter_para_csv com categoria="História do Brasil"]
```

---

## 🛠️ Ferramentas MCP Disponíveis

### Agora são 15 ferramentas (adicionamos 1 nova!)

**Fase 6 - Extração de PDF:**
- 🆕 `extrair_texto_pdf` - **Extrai texto para processamento por Claude (SEM API key)**
- `extrair_questoes` - Extração com API externa (requer ANTHROPIC_API_KEY)
- `preview_questoes` - Preview com API externa (requer ANTHROPIC_API_KEY)
- `converter_para_csv` - Converte Q:/A: para CSV

**Recomendação:**
👉 Use `extrair_texto_pdf` para evitar custos e aproveitar o Claude da conversa!
👉 Use `extrair_questoes` apenas se precisar de processamento batch sem interação.

---

## ⚙️ Parâmetros da Nova Ferramenta

### `extrair_texto_pdf`

```typescript
{
  path: string,              // Caminho do PDF
  maxChars?: number,         // Limite de caracteres (default: 50000)
  incluir_prompt?: boolean   // Incluir prompt de extração (default: true)
}
```

**Exemplo com parâmetros customizados:**

```
Extraia texto de curso.pdf limitando a 30000 caracteres
```

---

## 🎯 Workflow Recomendado

1. ✅ **Configurar MCP** (uma vez só)
2. ✅ **Recarregar Claude Code** (após configuração)
3. ✅ **Conversar com Claude:** "Extraia questões do PDF X"
4. ✅ **Claude processa automaticamente** usando extrair_texto_pdf
5. ✅ **Revisar questões geradas** (em tempo real)
6. ✅ **Pedir ajustes** se necessário
7. ✅ **Converter para CSV**
8. ✅ **Validar CSV**
9. ✅ **Importar no Anki**

---

## 🐛 Troubleshooting

### "Ferramenta extrair_texto_pdf não encontrada"

- Certifique-se de recarregar o Claude Code após configuração
- Verifique: `ls ankinator-mcp/dist/index.js` (deve existir)
- Veja console de desenvolvedor: `Help > Toggle Developer Tools`

### "PDF não contém texto extraível"

- PDF é escaneado (apenas imagens)
- Solução: Use PDF com texto selecionável ou aplique OCR primeiro

### "Texto truncado"

- PDFs grandes são limitados a 50000 chars por padrão
- Aumente: "Extraia texto de X.pdf com limite de 80000 caracteres"
- Ou processe por seções

---

## 📊 Estimativa de Economia

Com um PDF de 50 páginas:

- **Antes (extrair_questoes):** ~$0.20-0.30 por processamento
- **Agora (extrair_texto_pdf):** $0.00 (usa Claude da conversa)

**Processando 100 PDFs:**
- Economia: ~$20-30 USD 💰

---

## 🎉 Vantagens Adicionais

✅ **Transparência:** Vê o que Claude está fazendo
✅ **Iteração:** Pode pedir ajustes durante geração
✅ **Controle:** Decide quantas questões em tempo real
✅ **Sem limites:** Não há limite de questões fixo
✅ **Gratuito:** Sem custos adicionais de API

---

**Status:** ✅ Implementado e funcional!
**Versão:** 0.1.0-alpha
**Data:** 2025-11-22
