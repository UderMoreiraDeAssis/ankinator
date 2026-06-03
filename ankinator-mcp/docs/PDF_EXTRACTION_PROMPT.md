# Prompt de Extração de Questões de PDF

## Objetivo

Este documento detalha o prompt rigoroso utilizado pela ferramenta `extrair_questoes` para garantir **fidelidade 100%** ao conteúdo original dos PDFs de aula, evitando memorização incorreta em flashcards do Anki.

## Prompt de Sistema

```
Quando receber um PDF de aula, sua única tarefa é extrair questões e respostas fidedignas para uso no Anki.

Regras estritas:

1. Não interprete, não expanda, não exemplifique além do texto.
2. Não gere conteúdo baseado em conhecimento externo.
3. Se o trecho for vago ou incompleto, não complete — sinalize a lacuna.
4. Toda informação nas respostas deve ser diretamente verificável no PDF.
5. Formato de saída: lista com Q: e A:, uma por linha.

Risco crítico: Qualquer distorção levará o usuário a memorizar conteúdo incorreto.

Identidade do usuário: default_user
Objetivo declarado: Estudar com flashcards 100% alinhados ao material original.
```

## Justificativa das Regras

### 1. Não interpretar, não expandir, não exemplificar

**Por quê?** Interpretações adicionam viés pessoal e podem alterar o significado original do material. Em contextos acadêmicos e técnicos, cada palavra conta.

**Exemplo ruim:**
- **PDF:** "A mitocôndria é a organela responsável pela respiração celular"
- **Questão incorreta:** "Q: Qual é a 'usina de energia' da célula? A: A mitocôndria"
  - ❌ Adicionou metáfora que não está no material original

**Exemplo correto:**
- **Questão correta:** "Q: Qual organela é responsável pela respiração celular? A: A mitocôndria"
  - ✅ Fiel ao texto original

### 2. Não gerar conteúdo baseado em conhecimento externo

**Por quê?** O usuário está estudando especificamente aquele material. Adicionar informações externas pode:
- Confundir o escopo do estudo
- Incluir informações desatualizadas ou conflitantes
- Misturar fontes sem rastreabilidade

**Exemplo ruim:**
- **PDF:** "Python 3.6 introduziu f-strings"
- **Questão incorreta:** "Q: Quando foram introduzidas f-strings no Python? A: No Python 3.6, lançado em dezembro de 2016"
  - ❌ A data de lançamento não está no PDF

**Exemplo correto:**
- **Questão correta:** "Q: Qual versão do Python introduziu f-strings? A: Python 3.6"
  - ✅ Apenas o que está explícito no material

### 3. Sinalizar lacunas ao invés de completar

**Por quê?** Lacunas indicam que o material original está incompleto ou ambíguo. É melhor alertar o usuário para buscar esclarecimento do que gerar conteúdo potencialmente errado.

**Exemplo de lacuna:**
- **PDF:** "O processo envolve três etapas principais..."
- **Output:** `[LACUNA: PDF menciona "três etapas" mas não as lista. Impossível criar questão completa.]`

### 4. Verificabilidade direta

**Por quê?** Toda informação deve poder ser rastreada de volta ao PDF original. Isso permite:
- Verificação da correção da extração
- Revisão manual quando necessário
- Confiança total no conteúdo

### 5. Formato Q:/A: padronizado

**Por quê?**
- Compatível com conversão automática para CSV
- Fácil revisão manual antes da importação
- Estrutura clara que separa pergunta de resposta

## Formato de Saída

### Estrutura Básica

```
Q: [Pergunta extraída diretamente do conteúdo]
A: [Resposta extraída diretamente do conteúdo]

Q: [Próxima pergunta]
A: [Próxima resposta]
```

### Exemplos de Extração Correta

**PDF original:**
> "A Primeira Lei de Newton, também conhecida como Lei da Inércia, afirma que um corpo permanece em repouso ou em movimento retilíneo uniforme a menos que uma força externa atue sobre ele."

**Questões extraídas:**
```
Q: O que afirma a Primeira Lei de Newton?
A: Um corpo permanece em repouso ou em movimento retilíneo uniforme a menos que uma força externa atue sobre ele.

Q: Por qual outro nome é conhecida a Primeira Lei de Newton?
A: Lei da Inércia
```

### Casos Especiais

#### Definições

```
Q: O que é [termo]?
A: [Definição exata do PDF]
```

#### Listas/Enumerações

```
Q: Quais são os [elementos] mencionados?
A: 1) [item 1], 2) [item 2], 3) [item 3]
```

#### Fórmulas/Equações

```
Q: Qual é a fórmula de [conceito]?
A: [fórmula exatamente como aparece]
```

## Sinalizações de Problema

Quando encontrar problemas, use estas marcações:

- `[LACUNA: descrição do problema]` - Informação incompleta
- `[AMBÍGUO: descrição]` - Múltiplas interpretações possíveis
- `[ILEGÍVEL: descrição]` - Texto não extraível do PDF
- `[CONTEXTO INSUFICIENTE: descrição]` - Trecho isolado sem sentido

**Exemplo:**
```
Q: Quais são as três etapas do processo?
A: [LACUNA: PDF menciona "três etapas" na página 5 mas não as descreve. Revisar material original.]
```

## Checklist de Qualidade

Antes de finalizar a extração, verificar:

- [ ] Cada questão pode ser respondida APENAS com informações do PDF?
- [ ] Nenhuma interpretação pessoal foi adicionada?
- [ ] Nenhum conhecimento externo foi incluído?
- [ ] Lacunas foram sinalizadas ao invés de preenchidas?
- [ ] O formato Q:/A: está correto?
- [ ] As respostas são fidedignas palavra por palavra?

## Integração com o Workflow

Este prompt é utilizado internamente pela ferramenta `extrair_questoes`:

1. **Input:** Caminho do PDF
2. **Processamento:** Extração de texto + aplicação deste prompt via Claude API
3. **Output:** Questões Q:/A: fidedignas
4. **Validação:** Conversão para CSV + validação com `validar_csv`
5. **Import:** Importação no Anki

## Responsabilidade do Usuário

Mesmo com extração rigorosa, o usuário deve:

1. **Revisar** as questões geradas antes da importação final
2. **Verificar** contra o PDF original em caso de dúvida
3. **Complementar** questões sinalizadas com lacunas consultando fonte original
4. **Reportar** problemas de extração para melhoria contínua

## Limitações Conhecidas

- **PDFs escaneados:** Requerem OCR prévio (não incluído)
- **Diagramas/imagens:** Não são processados (apenas texto)
- **Tabelas complexas:** Podem perder formatação
- **Fórmulas matemáticas:** Dependem da extração correta de símbolos

## Exemplo Completo

**PDF de entrada (trecho):**
> "Git é um sistema de controle de versão distribuído. Foi criado por Linus Torvalds em 2005. Os principais comandos são: git init, git add, git commit e git push."

**Questões extraídas:**
```
Q: O que é Git?
A: Um sistema de controle de versão distribuído

Q: Quem criou o Git?
A: Linus Torvalds

Q: Quando foi criado o Git?
A: Em 2005

Q: Quais são os principais comandos do Git mencionados?
A: git init, git add, git commit e git push
```

**Conversão para CSV:**
```csv
pergunta,resposta,categoria
"O que é Git?","Um sistema de controle de versão distribuído","Git"
"Quem criou o Git?","Linus Torvalds","Git"
"Quando foi criado o Git?","Em 2005","Git"
"Quais são os principais comandos do Git mencionados?","git init, git add, git commit e git push","Git"
```

---

**Última atualização:** 2025-11-22
**Versão:** 1.0
**Maintainer:** ankinator-mcp project
