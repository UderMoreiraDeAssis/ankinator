---
name: deck-classifier
description: "Classificador de deck e tags para flashcards de concurso público: organiza cada card numa hierarquia de deck do Anki (Matéria::Assunto::Subtópico) e gera tags consistentes (banca, ano, nível, tema) a partir do conteúdo do card e do material de origem."
---

# Deck Classifier

O conteúdo canônico (system prompt + conhecimento) deste especialista vive em
`ankinator-app/server/src/core/specialists/prompts/deck-classifier.md` — esta é a ÚNICA fonte.
Leia esse arquivo e siga-o como sua especificação. NÃO duplique o texto aqui.

> Padrão de fonte única (progressive disclosure): a Skill descreve QUANDO usar e aponta para o
> `.md` canônico; o corpo da especificação não é copiado para evitar duas fontes divergentes.

## Quando usar

- Quando um card de concurso precisa de um **deck hierárquico** consistente
  (`Matéria::Assunto::Subtópico`) em vez de ficar solto na raiz.
- Quando se quer **tags** padronizadas (banca, ano, nível, tema) para filtrar e estudar por recorte.
- Antes de exportar para o Anki, para que decks e tags reflitam a estrutura do material.
