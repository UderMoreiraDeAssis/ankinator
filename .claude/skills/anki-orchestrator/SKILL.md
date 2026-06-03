---
name: anki-orchestrator
description: "Orquestrador da cadeia de especialistas Anki: decide, por card, quais estágios de enriquecimento rodar (classificar deck/tags, reescrever card, criar mnemônico, gerar SVG) para flashcards de concurso público, economizando quota da assinatura Claude."
---

# Anki Orchestrator

O conteúdo canônico (system prompt + conhecimento) deste especialista vive em
`ankinator-app/server/src/core/specialists/prompts/anki-orchestrator.md` — esta é a ÚNICA fonte.
Leia esse arquivo e siga-o como sua especificação. NÃO duplique o texto aqui.

> Padrão de fonte única (progressive disclosure): a Skill descreve QUANDO usar e aponta para o
> `.md` canônico; o corpo da especificação não é copiado para evitar duas fontes divergentes.

## Quando usar

- Quando há um lote de flashcards e é preciso decidir, **por card**, quais estágios de
  enriquecimento valem a pena (evitar rodar tudo sempre e estourar a quota da assinatura).
- Quando se quer orquestrar a cadeia deck-classifier → card-builder → mnemonic → mnemonic-image
  de forma seletiva e em batch.
- Para coordenar o modo "educativo" (toggles + defaults inteligentes) sobre os cards já gerados.
