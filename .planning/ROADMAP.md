# Roadmap: Ankinator — Upgrade 2026

## Overview

A milestone upgrade-2026 eleva a qualidade pedagógica dos flashcards e melhora a extração de PDF. A jornada vai do **andaime** dos especialistas (estrutura + fonte única + interface de imagem), passa pelo **loader LangChain** opcional, entrega os especialistas de **classificação e card educativo** ligados a um modo "educativo" opcional na UI, adiciona **mnemônicos e imagens SVG**, e fecha com o **orquestrador** que decide por-card o que rodar — tudo via assinatura Claude, sem custo por token.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

- [x] **Phase 1: Andaime dos Especialistas** - Estrutura `specialists/` + fonte única `.md` + Skills espelho + interface `ImageProvider` + extensão do tipo `Questao`
- [x] **Phase 2: Loader PDF LangChain** - Sidecar Python opt-in com `langchain-opendataloader-pdf`, normalizado para `LoadedDocument`, fallback Node (completed 2026-06-03)
- [x] **Phase 3: Classificador de Deck + Card Educativo** - Especialistas de deck/tags e card atômico; fase `enrichAll()` + toggles na UI (completed 2026-06-03)
- [ ] **Phase 4: Mnemônicos + Imagem SVG** - Especialistas de mnemônico e imagem (SVG via Claude), sanitização e embed no export Anki
- [ ] **Phase 5: Orquestrador Anki** - Decisão por-card, batching p/ poupar quota, princípios Anki, integração ponta-a-ponta

## Phase Details

### Phase 1: Andaime dos Especialistas

**Goal**: Criar a fundação reutilizável dos especialistas — um runner que reusa o spawn do `CliProvider` (assinatura), o padrão de fonte única `.md` espelhado em Skills, a interface `ImageProvider` (impl `svg-claude`), e a extensão consistente do tipo `Questao` — sem ativar nenhum estágio no fluxo ainda e sem regressão.
**Depends on**: Nothing (first phase)
**Requirements**: SPEC-01, SPEC-02, SPEC-03, SPEC-04, SPEC-05
**Success Criteria** (what must be TRUE):

  1. Existe `server/src/core/specialists/` com um runner que envia um prompt de especialista ao `claude` CLI e retorna saída estruturada, reusando o mecanismo do `CliProvider`.
  2. Cada especialista tem um `.md` canônico único; a Skill correspondente em `.claude/skills/` referencia o mesmo conteúdo (sem cópia divergente).
  3. A interface `ImageProvider` existe com `svg-claude` registrada; nenhum provider raster é implementado.
  4. O tipo `Questao` ganha campos opcionais (deck, tags, mnemônico, svg) espelhados em server e web; build passa e o fluxo atual continua intacto.

**Plans**: 4 plans (3 waves)

Plans:

- [x] 01-01-PLAN.md — Wave 0 (build-safe): npm ci + baseline do CliProvider (sem smoke-runner — movido p/ Plano 02)
- [x] 01-02-PLAN.md — Wave 1: runClaudeCli + buildSpawnArgs (extração) + CliProvider delega + prompt-loader + 5 .md canônicos + smoke-runner.ts (após runner/loader) (SPEC-01/02)
- [x] 01-03-PLAN.md — Wave 1: Questao +4 campos opcionais (server+web) + 5 SKILL.md espelho (SPEC-05/03)
- [x] 01-04-PLAN.md — Wave 2: ImageProvider/svg-claude + assertion CLI-free de args + cross-mode loadPrompt + checkpoint hard-block de regressão LIBERADO (2 PDFs reais: curso-8 → 5q, curso-230990 → 6q; zero regressão SPEC-01 geração + PIPE-03) (SPEC-04/01)

### Phase 2: Loader PDF LangChain

**Goal**: Adicionar `langchain-opendataloader-pdf` como loader de PDF opcional via sidecar Python (reusando o padrão `ODL_PYTHON`), com saída normalizada para `LoadedDocument` e fallback automático para o loader Node atual.
**Depends on**: Phase 1
**Requirements**: PDF-01, PDF-02, PDF-03
**Success Criteria** (what must be TRUE):

  1. Um script Python extrai um PDF em Documents por página usando `langchain-opendataloader-pdf`.
  2. O app aciona o loader LangChain por env/flag (opt-in) e cai para o loader Node quando Python/pacote estiver ausente.
  3. A saída é normalizada para `LoadedDocument` e o chunker existente processa sem mudanças.

**Plans**: 4 plans (3 waves)
Plans:
**Wave 1**

- [x] 02-01-PLAN.md — Wave 1: normalize() puro Document[]→LoadedDocument (D-07..D-10) + export cleanMarkdown + unit CLI-free (D-14) (PDF-03 núcleo)
- [x] 02-02-PLAN.md — Wave 1: sidecar Python odl_langchain_loader.py (markdown-por-página, JSON stdout) + requirements.txt pin 2.0.0 + checkpoint legitimidade (PDF-01; D-11/D-12/D-13)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 02-03-PLAN.md — Wave 2: langchain-loader.ts (spawn sem temp-dir + isLangchainAvailable + runLangchainLoader→normalize) + config.ts env vars (PDF-02; D-01/D-02/D-04)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 02-04-PLAN.md — Wave 3: branch em loadDocument (D-03/D-06) + buildConvertOptions extraído + guard CLI-free D-15 + smoke gated D-14 (PDF-02/PDF-03 não-regressão)

### Phase 3: Classificador de Deck + Card Educativo

**Goal**: Entregar os dois primeiros especialistas de conteúdo (classificador de deck/tags e construtor de card educativo), conectados a uma nova fase `enrichAll()` pós-geração e a toggles do modo "educativo" na UI, sem regredir o fluxo padrão.
**Depends on**: Phase 1
**Requirements**: DECK-01, DECK-02, CARD-01, CARD-02, PIPE-01, PIPE-02, PIPE-03
**Success Criteria** (what must be TRUE):

  1. Com o modo educativo ligado, os cards recebem deck hierárquico (`Matéria::Assunto::Subtópico`) e tags.
  2. Os cards são reescritos para atomicidade, com explicação curta e fonte no verso.
  3. A UI permite ligar/desligar os estágios; progresso aparece via SSE; com tudo desligado o fluxo atual roda igual.

**Plans**: 4 plans (3 waves)

Plans:

- [x] 03-00-PLAN.md — Wave 0: instalar vitest + scaffold RED (enrich.test.ts, guard-enrich.ts, smoke-enrich.ts) + checkpoint legitimidade (D-18 / PIPE-03 infra)
- [x] 03-01-PLAN.md — Wave 1: enrich.ts (enrichAll + parsers + deveRodarEnrich) + JobEvent enrich-progress + GenerateOptions espelhado + refino dos .md (PIPE-01, DECK-01/02, CARD-01/02)
- [x] 03-02-PLAN.md — Wave 2: wiring enrichAll no /generate + coluna Deck/header CSV + deckName por-nota AnkiConnect + merge q.tags (PIPE-01, PIPE-03, DECK-01/02)
- [x] 03-03-PLAN.md — Wave 2: UI modo educativo (StructurePanel toggles + ProgressPanel enrich + CardTable badges + App.tsx listener) + checkpoint humano (PIPE-02)

### Phase 4: Mnemônicos + Imagem SVG

**Goal**: Adicionar os especialistas de mnemônico e de imagem de mnemônico (SVG gerado pelo Claude), com sanitização do SVG e embed nos cards exportados (CSV e AnkiConnect).
**Depends on**: Phase 3
**Requirements**: MNEM-01, MNEM-02, IMG-01, IMG-02, IMG-03
**Success Criteria** (what must be TRUE):

  1. Cards de memorização recebem um mnemônico apropriado (técnica escolhida pelo conteúdo).
  2. É gerado um SVG autocontido ilustrando o mnemônico, sanitizado (sem script/URLs externas).
  3. O SVG aparece corretamente nos cards exportados via CSV e AnkiConnect.

**Plans**: 4 plans (3 waves)
Plans:
**Wave 1**

- [x] 04-01-PLAN.md — Wave 1: isomorphic-dompurify + sanitize-svg.ts (allowlist geométrica D-06/D-07) + fixtures adversariais F-01..F-12 + refino mnemonic.md (JSON batch) / mnemonic-image.md (MNEM-02, IMG-02)
- [x] 04-04-PLAN.md — Wave 1: UI modo educativo (toggles mnemônico ON / imagem OFF, badges 📝/🖼️ read-only, progresso) + tipos web espelhados (MNEM-01, IMG-01)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 04-02-PLAN.md — Wave 2: enrichAll estágio mnemônico (batch por id) + estágio imagem (por-card, fail-closed) + parseMnemonicosJson + deveRodarEnrich + image-provider conectado (MNEM-01/02, IMG-01/02)

**Wave 3** *(blocked on Wave 2 completion)*

- [ ] 04-03-PLAN.md — Wave 3: embed <svg> inline no verso (csv + ankiconnect, mesmo mecanismo, sem escapeHtml) + wiring /generate defaults D-12 + guard/smoke estendidos + checkpoint render Anki (IMG-03)

### Phase 5: Orquestrador Anki

**Goal**: Amarrar tudo com o orquestrador que decide por-card quais estágios rodar, aplica batching para poupar quota da assinatura e princípios Anki na agregação, entregando o modo educativo ponta-a-ponta.
**Depends on**: Phase 4
**Requirements**: ORCH-01, ORCH-02, ORCH-03
**Success Criteria** (what must be TRUE):

  1. O orquestrador decide por-card quais estágios aplicar (ex.: mnemônico/imagem só em cards de memorização).
  2. Estágios caros são batched/seletivos, evitando explosão de chamadas ao CLI.
  3. O fluxo educativo roda de ponta a ponta a partir da UI e produz cards enriquecidos exportáveis.

**Plans**: TBD

Plans:

- [ ] 05-01: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Andaime dos Especialistas | 4/4 | Complete | 2026-06-03 |
| 2. Loader PDF LangChain | 4/4 | Complete    | 2026-06-03 |
| 3. Classificador de Deck + Card Educativo | 4/4 | Complete | 2026-06-03 |
| 4. Mnemônicos + Imagem SVG | 3/4 | In Progress|  |
| 5. Orquestrador Anki | 0/TBD | Not started | - |
