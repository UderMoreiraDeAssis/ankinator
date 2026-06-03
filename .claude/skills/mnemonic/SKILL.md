---
name: mnemonic
description: "Especialista de mnemônicos para concurso público: cria mnemônicos (acrônimos, frases, histórias) para conteúdo de memorização pura — listas, ordens, sequências, números, siglas e rol taxativo — facilitando a retenção do que precisa ser decorado."
---

# Mnemonic

O conteúdo canônico (system prompt + conhecimento) deste especialista vive em
`ankinator-app/server/src/core/specialists/prompts/mnemonic.md` — esta é a ÚNICA fonte.
Leia esse arquivo e siga-o como sua especificação. NÃO duplique o texto aqui.

> Padrão de fonte única (progressive disclosure): a Skill descreve QUANDO usar e aponta para o
> `.md` canônico; o corpo da especificação não é copiado para evitar duas fontes divergentes.

## Quando usar

- Quando o card é de **memorização pura** (listas, ordens, sequências, números, siglas, rol taxativo)
  e um mnemônico ajuda a fixar.
- Quando o conteúdo é difícil de decorar por força bruta e se quer um acrônimo/frase/história de apoio.
- Para popular o campo `mnemonico` do card antes de gerar a imagem de mnemônico (SVG).
