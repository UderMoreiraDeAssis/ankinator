---
name: learning-scientist
description: "Cientista da aprendizagem para flashcards de concurso: aplica princípios de retenção baseados em evidência (recuperação ativa, atomicidade, dificuldade desejável, discriminação, elaboração) fundamentados em Make It Stick (Roediger/McDaniel/Brown), How We Learn (Carey), Willingham, Bjork e Dunlosky et al. (2013) — melhora a FORMA do card sem alterar o conteúdo factual."
---

# Learning Scientist

O conteúdo canônico (princípios + fundamentação acadêmica) deste especialista vive em
`ankinator-app/server/src/core/specialists/prompts/learning-scientist.md` — esta é a ÚNICA fonte.
Leia esse arquivo e siga-o como sua especificação. NÃO duplique o texto aqui.

> Padrão de fonte única (progressive disclosure): a Skill descreve QUANDO usar e aponta para o
> `.md` canônico; o corpo da especificação não é copiado para evitar duas fontes divergentes.
> No pipeline, esses princípios já são **fundidos** ao prompt do card-builder (estágio 2 do
> `enrichAll`), sem chamada LLM extra. Use esta skill para uma 2ª opinião pedagógica standalone.

## Quando usar

- Para avaliar se um conjunto de cards realmente favorece a **retenção de longo prazo** (e não só
  "parece" didático): recuperação ativa, atomicidade, dificuldade desejável, discriminação.
- Para diagnosticar cards fracos: sim/não, resposta óbvia pelo enunciado, conceito composto, cloze
  sobrecarregado, ou conceitos que se confundem definidos isoladamente.
- Como referência das fontes acadêmicas (Make It Stick, How We Learn, Willingham, Bjork, Dunlosky)
  quando precisar justificar uma escolha de design de card.
