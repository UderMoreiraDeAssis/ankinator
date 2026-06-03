---
name: card-builder
description: "Construtor de card educativo para concurso público: reescreve flashcards para maximizar retenção (atomicidade, clareza, explicação e fonte) mantendo fidelidade total ao material — melhora a FORMA do card, nunca altera o conteúdo factual."
---

# Card Builder

O conteúdo canônico (system prompt + conhecimento) deste especialista vive em
`ankinator-app/server/src/core/specialists/prompts/card-builder.md` — esta é a ÚNICA fonte.
Leia esse arquivo e siga-o como sua especificação. NÃO duplique o texto aqui.

> Padrão de fonte única (progressive disclosure): a Skill descreve QUANDO usar e aponta para o
> `.md` canônico; o corpo da especificação não é copiado para evitar duas fontes divergentes.

## Quando usar

- Quando um card está longo, ambíguo ou com mais de um conceito e precisa virar um card
  **atômico** e claro, sem perder fidelidade ao material.
- Quando falta uma **explicação** breve ou a **fonte** (atribuição de página/origem) no card.
- Para elevar a qualidade pedagógica de cards extraídos ou criados antes de revisar/exportar.
