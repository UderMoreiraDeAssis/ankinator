# Phase 3: Classificador de Deck + Card Educativo - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-03
**Phase:** 3-classificador-de-deck-card-educativo
**Mode:** `--power` (18 perguntas geradas offline; 18 respondidas, 100%)
**Areas discussed:** Pipeline & enrichAll(), Classificador de Deck+Tags, Construtor de Card Educativo, UI/Toggles/Progresso, Não-regressão & Verificação

---

## Q-01 — Gatilho do enrich

| Opção | Descrição | Selecionada |
|--------|-----------|----------|
| a | Encadeado no mesmo job de /generate | ✓ |
| b | Endpoint /enrich separado + novo job/SSE | |
| c | /generate estendido, job único, enrich inline | |

**Notas:** Leitura literal de PIPE-01 ("reusando o job/SSE"); menor superfície; endpoint/job novo é território de Phase 5. Toggles off → byte-idêntico ao atual.

---

## Q-02 — Tipo de progresso do enrich

| Opção | Descrição | Selecionada |
|--------|-----------|----------|
| a | Novo evento 'enrich-progress' no JobEvent | ✓ |
| b | Reusar ChunkProgress genérico | |
| c | Job separado com EnrichProgress próprio | |

**Notas:** Mantém `ChunkProgress` de generate intacto (verificado em store.ts); semântica clara.

---

## Q-03 — Onde vive enrichAll()

| Opção | Descrição | Selecionada |
|--------|-----------|----------|
| a | Novo módulo core/specialists/enrich.ts | ✓ |
| b | Adicionar em generation.ts | |

**Notas:** Separa generation de enrich; alinhado ao diretório specialists/ e ao orquestrador da Phase 5. Single Responsibility.

---

## Q-04 — Modelo do CLI nos especialistas

| Opção | Descrição | Selecionada |
|--------|-----------|----------|
| a | sonnet (default do runner) | ✓ |
| b | Configurável por env | |
| c | opus p/ card-builder, sonnet p/ classificador | |

**Notas:** Equilíbrio custo×qualidade; env-config é flexibilidade especulativa; opus multiplica quota. Reversível.

---

## Q-05 — Granularidade da chamada do classificador

| Opção | Descrição | Selecionada |
|--------|-----------|----------|
| a | UMA chamada com todos os cards | ✓ |
| b | Por-chunk/seção | |
| c | Por-card (1 spawn/card) | |

**Notas:** Coerência (DECK-01 "para o conjunto") + poupa quota (antecipa ORCH-02). Mapeia por id (Q-06a).

---

## Q-06 — Saída estruturada do classificador

| Opção | Descrição | Selecionada |
|--------|-----------|----------|
| a | JSON {classificacoes:[{id, deck, tags}]} por id | ✓ |
| b | Array posicional alinhado à entrada | |

**Notas:** Robusto a reordenação/omissão; reusa padrão de parseQuestoesJson. Posicional seria frágil em 1 chamada com muitos cards.

---

## Q-07 — Merge das tags do classificador

| Opção | Descrição | Selecionada |
|--------|-----------|----------|
| a | Exporters UNEM q.tags ao set existente | ✓ |
| b | q.tags substitui a lógica do exporter | |
| c | q.tags só informativo (UI) | |

**Notas:** Verificado que tagsDaQuestao() não inclui q.tags hoje. União → dedup + preserva export atual + DECK-02 chega ao Anki. Aditivo.

---

## Q-08 — Deck por-card no export

| Opção | Descrição | Selecionada |
|--------|-----------|----------|
| a | Export roteia por-card via q.deck | ✓ |
| b | Deck único; q.deck vira tag/prefixo | |
| c | Adiar wiring de export p/ Phase 5 | |

**Notas:** Único caminho que torna DECK-01 (critério de sucesso 1) verificável agora. Fallback ao deck único quando q.deck ausente → não-regressão PIPE-03.

---

## Q-09 — Card-builder pode dividir 1→N?

| Opção | Descrição | Selecionada |
|--------|-----------|----------|
| a | Permite split 1→N (irrestrito) | |
| b | Sem split nesta fase (1→1) | |
| c | Split só p/ 'criada' | ✓ |

**Notas:** 'extraida' nunca divide (fidelidade da prova). Id-churn mitigado por enrich ANTES da review (Q-01a). Split confirmado no escopo por Q-18.

---

## Q-10 — Card-builder aplica-se a 'extraida'?

| Opção | Descrição | Selecionada |
|--------|-----------|----------|
| a | Só reescreve 'criada' | |
| b | Ambas, mas 'extraida' só ajusta o verso | ✓ |
| c | Reescreve ambas livremente | |

**Notas:** CARD-02 exige verso educativo em TODOS; 'extraida' nunca muda pergunta/gabarito, só acrescenta explicação+fonte no verso.

---

## Q-11 — Onde guardar explicação + fonte

| Opção | Descrição | Selecionada |
|--------|-----------|----------|
| a | Embutir explicação na própria q.resposta | ✓ |
| b | Adicionar campo explicacao? ao Questao | |
| c | Explicação inline + fonte explícita do card | |

**Notas:** ZERO mudança no tipo Questao (evita pitfall do tipo duplicado server+web). Fonte segue derivada de pageStart pelo versoHtml().

---

## Q-12 — Granularidade do card-builder

| Opção | Descrição | Selecionada |
|--------|-----------|----------|
| a | Por-card (1 spawn/card) | ✓ |
| b | Batch de N cards por chamada | |
| c | Por-chunk | |

**Notas:** Isolamento natural (Q-13a), parsing simples, split direto. Batching é ORCH-02/Phase 5. Custo contido por card-builder default-OFF (Q-15b).

---

## Q-13 — Isolamento de erro no enrich

| Opção | Descrição | Selecionada |
|--------|-----------|----------|
| a | Isola por-card/estágio; mantém original | ✓ |
| b | Falha aborta o job de enrich | |

**Notas:** Espelha generateAll(); nunca perde card; erro vai no enrich-progress.

---

## Q-14 — Onde ficam os toggles

| Opção | Descrição | Selecionada |
|--------|-----------|----------|
| a | Bloco 'Modo educativo' no StructurePanel | ✓ |
| b | Novo painel de enrich pós-geração | |
| c | Toggles na tela de revisão (sob demanda) | |

**Notas:** Coerente com os controles de geração existentes; casa com job único encadeado (toggles decididos antes de gerar).

---

## Q-15 — Defaults dos toggles educativos

| Opção | Descrição | Selecionada |
|--------|-----------|----------|
| a | Ambos LIGADOS por default | |
| b | Classificar ligado, card educativo desligado | ✓ |
| c | Ambos desligados | |

**Notas:** Defaults inteligentes sob quota: classificar é 1 chamada barata de alto valor; card educativo multiplica chamadas → opt-in consciente.

---

## Q-16 — Progresso do enrich no Stepper

| Opção | Descrição | Selecionada |
|--------|-----------|----------|
| a | Novo step 'Enriquecer' entre gerar e revisar | |
| b | Dentro de 'generating' (continua o painel) | ✓ |
| c | Sob demanda na 'review' (inline) | |

**Notas:** Não toca o Stepper; reflete o fluxo único encadeado; usa enrich-progress p/ rotular o estágio.

---

## Q-17 — Exibir deck/tags na revisão

| Opção | Descrição | Selecionada |
|--------|-----------|----------|
| a | Mostrar deck+tags (read-only) na CardTable | ✓ |
| b | Mostrar e permitir editar | |
| c | Não exibir nesta fase | |

**Notas:** Conferência antes de exportar com menor superfície. Editável é incremento reversível se necessário.

---

## Q-18 — Não-regressão + verificação

| Opção | Descrição | Selecionada |
|--------|-----------|----------|
| a | Guard determinístico + unit puro + smoke gated | ✓ |
| b | Só unit puro dos parsers | |
| c | Verificação manual com PDF real | |

**Notas:** Replica Phases 1/2. Guard CLI-free (toggles off → byte-idêntico, PIPE-03) + unit de parsers/merge/split/roteamento + smoke opt-in sem queimar quota.

---

## Claude's Discretion

- Nomes de funções/arquivos em `enrich.ts` e parsers dos especialistas.
- Compartilhar padrão de parsing tolerante (helper vs adaptar) entre `parseQuestoesJson` e o parser de classificações.
- Formato exato do progresso `enrich-progress` e layout dos badges deck/tags na CardTable.
- Montagem do userMessage do classificador/card-builder (respeitando os `.md` canônicos).
- Convenção de herança de campos nos cards derivados do split.

## Deferred Ideas

- Batching / decisão por-card inteligente → Phase 5 (ORCH-01/02).
- Mnemônico + imagem SVG → Phase 4 (MNEM-*, IMG-*); bloco "Modo educativo" deve ser extensível.
- Editar deck/tags na revisão (reversível, Q-17).
- Campo `explicacao?` estruturado (alternativa a Q-11 se o verso embutido ficar ruim).
- Endpoint `/enrich` separado + re-rodar enrich sob demanda (rejeitado em Q-01).
- Modelo configurável / opus no card-builder (rejeitado em Q-04).
