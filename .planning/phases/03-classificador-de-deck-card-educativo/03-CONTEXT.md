# Phase 3: Classificador de Deck + Card Educativo - Context

**Gathered:** 2026-06-03
**Status:** Ready for planning
**Source:** `/gsd:discuss-phase 3 --power` — 18 perguntas geradas; 18 respondidas (100%), cada uma com justificativa ancorada no código e cruzando questões entre si (ver `03-QUESTIONS.json` / `03-QUESTIONS.html`).

<domain>
## Phase Boundary

Entregar os **dois primeiros especialistas de conteúdo** — **classificador de deck/tags** (DECK-01/02) e **construtor de card educativo** (CARD-01/02) — ligados a uma nova fase **`enrichAll()`** pós-geração e a **toggles do modo "educativo"** na UI, **sem regredir** o fluxo padrão. Entrega DECK-01, DECK-02, CARD-01, CARD-02, PIPE-01, PIPE-02, PIPE-03.

**Dentro do escopo:**
- Especialista classificador: 1 chamada CLI com todos os cards → deck hierárquico (`Matéria::Assunto::Subtópico`) + tags por id.
- Especialista card-builder: reescrita por-card; atomicidade (split 1→N só p/ `criada`); explicação curta + fonte no verso.
- Novo módulo `core/specialists/enrich.ts` com `enrichAll(questoes, opts, onProgress)`, encadeado após `generateAll()` no **mesmo job/SSE**.
- Wiring de export: deck por-card (AnkiConnect cria subdecks; coluna `Deck` no CSV) + merge de `q.tags` no Set existente.
- UI: bloco "Modo educativo" no `StructurePanel` (2 toggles), progresso de enrich dentro do passo `generating`, deck/tags read-only na `CardTable`.
- Verificação: guard determinístico CLI-free de não-regressão + unit puro dos parsers/merge/split/roteamento + smoke opt-in.

**Fora do escopo (FIXO):**
- Orquestração "inteligente" por-card e **batching** p/ poupar quota → **Phase 5** (ORCH-01/02/03). Aqui `enrichAll()` roda os estágios ligados em ordem, sem decisão por-card sofisticada.
- Especialistas de **mnemônico** e **imagem SVG** → **Phase 4** (MNEM-*, IMG-*).
- Endpoint `/enrich` separado, novo job, edição de deck/tags na UI, configuração de modelo por env, mudança no tipo `Questao` — todos rejeitados nas decisões abaixo.

</domain>

<decisions>
## Implementation Decisions

Cada decisão D-NN corresponde à pergunta Q-NN do `03-QUESTIONS.json` (justificativa completa em `chat_more`).

### Pipeline & enrichAll() (PIPE-01)
- **D-01 (Q-01) — Gatilho do enrich = ENCADEADO no mesmo job de `/generate`.** Quando há toggles ligados, o job roda `generateAll()` → `enrichAll()` em sequência e só emite `done` no fim. Leitura literal de PIPE-01 ("reusando o job/SSE") e menor superfície (sem endpoint/job novo — território de Phase 5). Com toggles off, `enrichAll()` não roda e `/generate` fica byte-idêntico (PIPE-03). Risco "review demora" mitigado por SSE (D-02/D-16).
- **D-02 (Q-02) — Progresso = NOVO evento `enrich-progress` na union `JobEvent`.** `{type:'enrich-progress', data:{estagio, index, total}}`. Mantém `ChunkProgress` de `generate` intacto (verificado em `store.ts`: `progress|done|error`) → zero risco no progresso da geração; semântica clara (estágio/index/total).
- **D-03 (Q-03) — `enrichAll()` vive em NOVO módulo `core/specialists/enrich.ts`.** Separa generation (chunk→questão) de enrich (questão→questão enriquecida); alinhado ao diretório `specialists/` (SPEC-01) e ao ponto onde o orquestrador da Phase 5 evolui. Não diluir no `generation.ts` (módulo crítico do fluxo legado) — Single Responsibility.
- **D-04 (Q-04) — Modelo dos especialistas = `sonnet` (default do runner).** Mesma cota/velocidade da geração atual; equilíbrio custo×qualidade. Sem env-config (flexibilidade especulativa) nem `opus` (multiplica quota — o gargalo). **Reversível:** subir modelo pontualmente se o smoke real mostrar card-builder fraco.

### Classificador de Deck + Tags (DECK-01, DECK-02)
- **D-05 (Q-05) — Granularidade = UMA chamada com TODOS os cards.** Envia `[{id, pergunta, resposta}]` numa só chamada; retorna taxonomia coerente + deck/tags por id. Atende a coerência de DECK-01 ("para o conjunto de cards") e poupa quota (antecipa ORCH-02 barato). Por-card estoura quota e diverge; por-chunk perde coerência global.
- **D-06 (Q-06) — Saída estruturada = JSON `{classificacoes:[{id, deck, tags}]}` casado por id.** Parser dedicado estilo `parseQuestoesJson` (tolera cercas ```json, recorta o objeto). Robusto a reordenação/omissão do LLM — crítico porque é 1 chamada com muitos cards. Não confiar em ordem posicional.
- **D-07 (Q-07) — Tags = exporters UNEM `q.tags` ao Set existente.** Verificado: hoje `tagsDaQuestao()` (csv.ts + ankiconnect.ts) monta o Set de `q.tipo` + `tagsPadrao` (+ banca/ano no ankiconnect) e NÃO inclui `q.tags`. Adicionar `...(q.tags ?? [])` ao Set → dedup automático, preserva lógica de export atual (não-regressão), faz DECK-02 chegar ao Anki. Mudança aditiva e cirúrgica.
- **D-08 (Q-08) — Deck no export = ROTEAR por-card via `q.deck`.** AnkiConnect cria cada subdeck e usa `q.deck` quando presente, com **fallback ao `opts.deck` único** quando ausente; CSV ganha coluna `Deck` aditiva com o mesmo fallback (preserva import default). Único caminho que torna o critério de sucesso 1 ("cards recebem deck hierárquico") **verificável agora**. Não-regressão PIPE-03: com toggles off, `q.deck` é `undefined` → comportamento equivalente ao deck único atual.

### Construtor de Card Educativo (CARD-01, CARD-02)
- **D-09 (Q-09) — Split 1→N = SÓ para `criada`; `extraida` NUNCA divide.** Preserva o item de prova (fidelidade dura). card-builder retorna 1..N cards p/ `criada`; o enrich substitui o original pelos derivados (novos ids; herdam `pageStart/pageEnd/tipo/deck/tags`). Id-churn mitigado pela ordem (enrich ANTES da review, D-01 → ids derivados já existem quando a `CardTable` renderiza). Split irrestrito violaria fidelidade de `extraida`; sem split contraria card-builder.md e o core value de cards atômicos.
- **D-10 (Q-10) — card-builder em `extraida` = SÓ ajusta o verso.** Em `extraida` nunca muda pergunta/gabarito; só acrescenta explicação curta + fonte no verso (CARD-02 exige verso educativo em TODOS os cards). Em `criada`, reescrita livre (+ split, D-09). Resolve a tensão "verso educativo universal × fidelidade da prova".
- **D-11 (Q-11) — Explicação + fonte = EMBUTIR na própria `q.resposta`.** card-builder devolve `resposta` já com "fato + explicação curta"; fonte continua derivada de `pageStart` pelo `versoHtml()`/csv existente. **ZERO mudança no tipo `Questao`** — evita o pitfall conhecido do tipo duplicado server+web. Não adicionar campo `explicacao?` (toca o tipo duplicado sem necessidade).
- **D-12 (Q-12) — Granularidade card-builder = POR-CARD (1 spawn/card).** Isolamento de erro natural (casa com D-13), parsing simples, split 1→N direto. Batching p/ poupar quota é explicitamente ORCH-02/Phase 5 — antecipar aqui traria complexidade e faria 1 erro derrubar o lote. Custo de quota contido porque card-builder é **default-OFF** (D-15).
- **D-13 (Q-13) — Isolamento de erro = POR-CARD/ESTÁGIO; mantém original.** Espelha `generateAll()` (captura erro, registra, segue, nunca derruba o job). Falha num estágio → card mantém conteúdo cru, erro vai no progresso (`enrich-progress`, D-02). Nunca perde card.

### UI, Toggles & Progresso (PIPE-02)
- **D-14 (Q-14) — Toggles = bloco "Modo educativo" no `StructurePanel`.** Junto dos controles de geração (`incluirExtraidas/incluirCriadas` + slider `maxPerChunk`), antes do botão Gerar: ☑ Classificar deck+tags, ☑ Card educativo. Casa com o job único encadeado (D-01), onde os toggles são decididos ANTES de gerar. Tudo numa tela.
- **D-15 (Q-15) — Defaults = Classificar LIGADO, Card educativo DESLIGADO.** "Defaults inteligentes" sob restrição de quota: classificar é 1 chamada barata de alto valor (deck+tags prontos, D-05); card educativo multiplica chamadas por-card (D-12) — o multiplicador de quota → opt-in consciente. Entrega valor "de fábrica" sem arriscar a quota.
- **D-16 (Q-16) — Progresso = DENTRO do passo `generating` (continua o `ProgressPanel`).** Fases de enrich (classificando.../reescrevendo...) seguem o mesmo painel, sem tocar o `Stepper` (menos superfície); reflete o fluxo único encadeado (D-01). Usa `enrich-progress` (D-02) p/ rotular o estágio.
- **D-17 (Q-17) — Revisão = mostrar deck+tags READ-ONLY na `CardTable`.** Colunas/badges de deck e tags p/ conferência antes de exportar (valor central da fase), com menor superfície (sem estado de edição). **Reversível:** promover p/ editável é incremento barato se a classificação se mostrar imprecisa.

### Não-regressão & Verificação (PIPE-03)
- **D-18 (Q-18) — Verificação = guard determinístico CLI-free + unit puro + smoke gated.** Replica Phases 1/2: (1) guard CLI-free provando que, com toggles off, `enrichAll` NÃO é chamado e `/generate` fica byte-idêntico (PIPE-03); (2) unit puro com fixtures p/ parsers/merge de tags/split/roteamento de deck — confirma que **split (D-09) está no escopo**; (3) smoke opt-in que chama o CLI real sem queimar quota no CI.

### Claude's Discretion
- Nomes exatos de funções/arquivos dentro de `enrich.ts` e dos parsers dos especialistas.
- Como compartilhar o padrão de parsing tolerante entre `parseQuestoesJson` e o novo parser de classificações (extrair helper vs adaptar) — desde que ambos fiquem consistentes e o build verde.
- Formato exato da linha de progresso `enrich-progress` (rótulos dos estágios) e o layout dos badges de deck/tags na `CardTable`.
- Forma exata do prompt/userMessage que monta a entrada do classificador (lista de cards) e do card-builder, desde que respeite os `.md` canônicos (fonte única — não duplicar conteúdo).
- Convenção de herança de `pageStart/pageEnd/tipo/deck/tags` nos cards derivados do split (D-09).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.** Todo path é relativo à raiz do repo (`/home/t316360/plottwist/ankinator`).

### Decisões & escopo da milestone
- `.planning/PROJECT.md` — Key Decisions (especialistas = fonte única `.md` → Skill + estágio; cadeia = modo "educativo" opcional + fase `enrichAll()`) + Constraints (não regredir o fluxo atual; usar assinatura CLI, não API; quota é gargalo).
- `.planning/REQUIREMENTS.md` — **DECK-01, DECK-02, CARD-01, CARD-02, PIPE-01, PIPE-02, PIPE-03** (escopo desta fase) + "Out of Scope".
- `.planning/ROADMAP.md` §"Phase 3: Classificador de Deck + Card Educativo" — goal + 3 success criteria. §"Phase 4/5" — fronteira do que NÃO entra (mnemônico/imagem, orquestrador/batching).

### Mapas do codebase (estado atual)
- `.planning/codebase/ARCHITECTURE.md` — pipeline `PDF→LoadedDocument→SemanticChunk→Questao→Exporters`; camadas; tipos centrais.
- `.planning/codebase/CONVENTIONS.md` — estilo, naming, idioma PT em comentários/commits.
- `.planning/codebase/TESTING.md` — baseline "sem testes automatizados" + disciplina de guard CLI-free / unit puro / smoke gated (informa D-18).
- `.planning/codebase/CONCERNS.md` — tipo `Questao` duplicado server/web (motiva D-11).
- `.planning/phases/01-andaime-dos-especialistas/01-CONTEXT.md` — decisões do andaime (runner, prompt-loader, fonte única, SPEC-05).

### Código fonte a respeitar/estender
- `ankinator-app/server/src/core/specialists/runner.ts` — `runClaudeCli()` / `buildSpawnArgs()` (assinatura, default `sonnet`). Base para as chamadas dos especialistas (D-04/D-05/D-12).
- `ankinator-app/server/src/core/specialists/prompt-loader.ts` — `loadPrompt(nome)` (lê `.md` canônico de `src/`, allowlist dos 5 nomes). Usar p/ `deck-classifier` e `card-builder`.
- `ankinator-app/server/src/core/specialists/prompts/deck-classifier.md` — fonte única do classificador (NÃO duplicar; pode ser refinado se a discussão exigir).
- `ankinator-app/server/src/core/specialists/prompts/card-builder.md` — fonte única do card-builder (atomicidade, preservar `[EXTRAÍDA]`, explicação+fonte no verso).
- `ankinator-app/server/src/core/generation.ts` — `generateAll()` (padrão de loop + isolamento de erro a espelhar, D-13), `parseQuestoesJson()` (padrão do parser a clonar, D-06), `mapRawQuestoes()`, tipos `Questao`/`RawQuestao`.
- `ankinator-app/server/src/core/types.ts` — `Questao` (já tem `deck?/tags?/mnemonico?/mnemonicoSvg?` por SPEC-05). **NÃO adicionar campos** (D-11).
- `ankinator-app/server/src/store.ts` — `JobEvent` union + `jobStore.emit()`. Estender com `enrich-progress` (D-02).
- `ankinator-app/server/src/api.ts` (linhas ~107-207) — `/generate` (cria job, roda `generateAll`, emite SSE) + `/jobs/:id/events`. Ponto onde `enrichAll()` é encadeado (D-01) e onde toggles chegam em `req.body.options`.
- `ankinator-app/server/src/core/exporters/csv.ts` — `toAnkiCsv()`, `tagsDaQuestao()` (merge D-07), colunas (adicionar `Deck`, D-08), `versoHtml`/montagem do verso (fonte derivada de `pageStart`, D-11).
- `ankinator-app/server/src/core/exporters/ankiconnect.ts` — `pushToAnki()` (`deckName: opts.deck` → rotear por `q.deck` + `createDeck` por subdeck, D-08), `tagsDaQuestao()` (merge D-07).
- `ankinator-app/web/src/App.tsx` — estado `options`, fluxo `handleGenerate` + SSE (`es.addEventListener`), `cards`/`dropped`/`onEdit` por id (relevante a D-09 id-churn). Listener `enrich-progress` (D-02/D-16).
- `ankinator-app/web/src/components/StructurePanel.tsx` — checkboxes/slider existentes; adicionar bloco "Modo educativo" (D-14/D-15).
- `ankinator-app/web/src/components/ProgressPanel.tsx` — painel de progresso por-chunk; estender p/ fases de enrich (D-16).
- `ankinator-app/web/src/components/CardTable.tsx` — exibe tipo/pergunta/resposta; adicionar deck+tags read-only (D-17).
- `ankinator-app/web/src/components/Stepper.tsx` — 4 passos fixos; **NÃO** adicionar 5º step (D-16).
- `ankinator-app/web/src/types.ts` — `Questao` espelhado + `GenerateOptions`. Espelhar quaisquer novas options dos toggles (mas SEM tocar campos de `Questao`, D-11).
- `ankinator-app/web/src/api.ts` — `generate()` (payload de options) + `jobEvents()` (EventSource).
- `ankinator-app/server/src/scripts/` — `smoke-runner.ts` / `guard-default-loader.ts` / `assert-*.ts`: moldes p/ guard CLI-free + smoke gated de D-18.

### Externo
- Nenhum pacote/serviço externo novo nesta fase (tudo via assinatura CLI já integrada). "No external specs além dos acima."

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `runner.runClaudeCli()` / `loadPrompt()` — infra pronta dos especialistas (Phase 1); o classificador e o card-builder são novas chamadas que reusam esse runner + os `.md` canônicos.
- `generation.parseQuestoesJson()` — parser tolerante (remove cercas ```json, recorta `{...}`): molde direto p/ o parser de `{classificacoes:[...]}` (D-06).
- `generation.generateAll()` — loop sequencial com isolamento de erro por unidade + `onProgress`: molde direto p/ `enrichAll()` (D-03/D-13).
- `exporters/*.tagsDaQuestao()` — ponto único de montagem de tags nos dois exporters: estende p/ unir `q.tags` (D-07).
- `scripts/guard-default-loader.ts` + `smoke-langchain-loader.ts` — padrão guard CLI-free + smoke gated (Phase 2): molde p/ D-18.

### Established Patterns
- **Job assíncrono + SSE** (`store.ts` + `api.ts`): `jobStore.create/emit`, union `JobEvent`, stream `text/event-stream`. Enrich reusa o MESMO job (D-01) e estende a union (D-02).
- **Tipo `Questao` duplicado** (server `core/types.ts` + web `src/types.ts`): qualquer campo novo exige espelho no mesmo commit → motivo de evitar campo `explicacao` (D-11).
- **Isolamento de erro por-unidade** (`generateAll` por-chunk): replicado por-card no enrich (D-13).
- **Verificação CLI-free + smoke gated** (Phases 1/2): base de D-18.
- **Fonte única `.md` espelhada em Skill** (SPEC-02/03): o conteúdo do especialista vive no `.md` canônico, nunca duplicado no código.

### Integration Points
- `enrichAll()` (novo, `core/specialists/enrich.ts`) é chamado dentro do `.then()` do job em `api.ts` `/generate`, após `generateAll()`, quando algum toggle educativo está ligado (D-01).
- Saída do classificador (D-05/D-06) mapeada de volta por id sobre o array `questoes`; saída do card-builder (D-09/D-12) substitui cards `criada` (split) e ajusta verso de `extraida` (D-10).
- Exporters consomem `q.deck` (roteamento, D-08) e `q.tags` (merge, D-07) — ponto onde DECK-01/02 ficam verificáveis ponta-a-ponta.
- UI: `StructurePanel` adiciona toggles → `options` (D-14/D-15); SSE `enrich-progress` → `ProgressPanel` (D-16); `CardTable` lê `q.deck`/`q.tags` (D-17).

</code_context>

<specifics>
## Specific Ideas

- O usuário respondeu as 18 perguntas aplicando rigorosamente os princípios Karpathy e cruzando decisões: **simplicidade/superfície mínima** (D-01 encadeia em vez de novo endpoint; D-11 zero mudança de tipo; D-16 não toca o Stepper), **mudança cirúrgica/aditiva** (D-07/D-08 com fallback preservam o fluxo atual), **correção sobre conveniência** (D-06 casa por id em vez de ordem; D-09/D-10 preservam fidelidade de `extraida`), **critério verificável** (D-08 torna DECK-01 verificável agora; D-18 guard determinístico), **decisões reversíveis sinalizadas** (D-04 modelo, D-17 edição de deck/tags).
- **Tensão central resolvida — quota vs. valor:** classificar é barato (1 chamada, D-05) → default ON; card educativo multiplica chamadas (D-12) → default OFF (D-15). Batching real fica para o orquestrador da Phase 5 (ORCH-02), conscientemente adiado.
- **Coerência de cadeia entre respostas:** D-01 (job único) → D-02 (`enrich-progress`) → D-16 (progresso em `generating`) → D-14 (toggles antes de gerar); D-09 (split) → D-12 (por-card) → D-13 (isolamento) → D-18 (unit de split). Não há decisão órfã.

### Research flags (o `gsd-phase-researcher` deve confirmar/aprofundar)
1. **Formato do verso no Anki:** confirmar como `versoHtml()` (ankiconnect) e a coluna Verso (csv) renderizam "fato + explicação + fonte" embutidos em `q.resposta` (D-11) — garantir que quebras de linha/markdown apareçam bem no card. Se o verso ficar ilegível, reconsiderar D-11(b) (campo `explicacao`).
2. **AnkiConnect multi-deck:** confirmar que `createDeck` + `deckName` por-nota permite criar/rotear N subdecks numa única `pushToAnki` (D-08) e o comportamento de `::` na criação de hierarquia.
3. **Import CSV com coluna Deck:** confirmar o formato de coluna Deck que o Anki reconhece no import (header/ordem) p/ a coluna aditiva de D-08 não quebrar o import default (PIPE-03).
4. **id-churn no split (D-09):** validar que rodar enrich ANTES da review (D-01) elimina qualquer corrida com `dropped`/`onEdit` por id em `App.tsx`; mapear se algum estado da UI assume contagem estável de cards.

</specifics>

<deferred>
## Deferred Ideas

- **Batching / decisão por-card inteligente** (poupar quota) — Phase 5 (ORCH-01/02). Card-builder por-card (D-12) é deliberadamente não-batched aqui.
- **Especialistas de mnemônico e imagem SVG** — Phase 4 (MNEM-*, IMG-*). Toggles do modo educativo cobrirão esses estágios depois; o bloco "Modo educativo" (D-14) deve ser extensível.
- **Editar deck/tags na revisão** — sinalizado reversível em D-17; promover se a classificação se mostrar imprecisa.
- **Campo `explicacao?` estruturado no tipo `Questao`** — alternativa a D-11 caso o verso embutido fique ruim (ver Research flag 1).
- **Endpoint `/enrich` separado + re-rodar enrich sob demanda** — rejeitado agora (D-01); reabrir se o usuário quiser enriquecer cards já gerados sem re-gerar.
- **Modelo configurável por env / `opus` no card-builder** — rejeitado agora (D-04); reabrir se o smoke real mostrar qualidade fraca.

</deferred>

---

*Phase: 3-classificador-de-deck-card-educativo*
*Context gathered: 2026-06-03*
