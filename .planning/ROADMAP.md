# Roadmap: Ankinator — Upgrade 2026

## Overview

A milestone upgrade-2026 eleva a qualidade pedagógica dos flashcards e melhora a extração de PDF. A jornada vai do **andaime** dos especialistas (estrutura + fonte única + interface de imagem), passa pelo **loader LangChain** opcional, entrega os especialistas de **classificação e card educativo** ligados a um modo "educativo" opcional na UI, adiciona **mnemônicos e imagens SVG**, e fecha com o **orquestrador** que decide por-card o que rodar — tudo via assinatura Claude, sem custo por token.

## 🎯 Destino (onde queremos chegar)

> **O Ankinator transforma qualquer texto/PDF de concurso em flashcards Anki que de fato valem a pena estudar.** No estado final, o usuário aponta um PDF e recebe cards que:
>
> 1. **São boas questões de estudo** — criadas/atomizadas a partir do conteúdo (não apenas o enunciado original colado).
> 2. **Têm aparência rica e educativa** — HTML/CSS no nível de polimento visual do addon **Ankimon** (layout seccionado, cores, tipografia, blocos para enunciado/resposta/mnemônico/imagem) — não o texto cru no estilo "Basic" default do Anki.
> 3. **Trazem mnemônicos e imagens SVG que REALMENTE aparecem** nos cards exportados (CSV e AnkiConnect), com erros visíveis quando o CLI falha (nunca falha-suave silenciosa).
> 4. **São montados por agentes/skills especialistas** (recursos do mundo Claude — subagents/skills, não só arquivos de prompt): um **orquestrador Anki** que decide por-card o que rodar, um **classificador de deck**, um **montador de card educativo**, um especialista de **mnemônicos** e um de **imagens de mnemônico**.
> 5. **Usam o loader `langchain-opendataloader-pdf`** de fato (não apenas opt-in nunca ativado).
>
> **Validação de "pronto" = teste humano real:** rodar contra um PDF de concurso real, abrir no Anki 25.02.x, e ver cards bonitos, com questões boas, mnemônicos e imagens. Testes determinísticos com runner mockado NÃO contam como pronto.

### ⚠️ Realidade atual (UAT 2026-06-04)

Phases 1–4 entregaram **código que passa em 144 testes determinísticos**, mas o **UAT de runtime FALHOU**: zero mnemônicos, zero imagens, questões "inúteis" (coladas cruas), cards sem HTML/CSS rico. Os testes mockam o runner do Claude, então o caminho real do CLI nunca foi exercitado. As Phases 4.1–7 abaixo corrigem a rota até o Destino.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (4.1): Urgent insertions (marked with INSERTED)

- [x] **Phase 1: Andaime dos Especialistas** - Estrutura `specialists/` + fonte única `.md` + Skills espelho + interface `ImageProvider` + extensão do tipo `Questao`
- [x] **Phase 2: Loader PDF LangChain** - Sidecar Python opt-in com `langchain-opendataloader-pdf` (⚠ entregue mas NUNCA ativado por default — corrigido na Phase 4.1)
- [x] **Phase 3: Classificador de Deck + Card Educativo** - Especialistas de deck/tags e card atômico (⚠ card-builder só reescreve TEXTO e vem OFF; aparência rica fica na Phase 6)
- [~] **Phase 4: Mnemônicos + Imagem SVG** - Código entregue + segurança (CR-01/WR-01 corrigidos), mas **UAT runtime FALHOU** (zero mnemônicos/imagens ao vivo) → estabilização na Phase 4.1
- [~] **Phase 4.1: Estabilização de Runtime (INSERTED)** - Código entregue (RT-01 erro visível + parse tolerante/fallback, RT-02 imagem, RT-05 loader langchain auto). ⏳ Falta validação de runtime humano (rodar PDF real)
- [ ] **Phase 5: Orquestrador Anki por-card** - Conectar o `anki-orchestrator` (hoje andaime morto, nunca carregado), decisão por-card, batching p/ poupar quota
- [~] **Phase 6: Cards Educativos Ricos (estilo Ankimon)** - Código entregue: `card-html.ts` (layout seccionado índigo/verde/âmbar, escape + SVG inline sanitizado), wired em CSV + AnkiConnect. Preview ✅ (`/tmp/ankinator-card-preview.html`). ⏳ Falta validação visual no Anki real
- [ ] **Phase 7: Qualidade das Questões + Agentes Especialistas** - Questões boas (criadas/atomizadas, não coladas) + formalizar os especialistas como agentes/skills Claude

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
**Status note**: Código entregue, mas o loader é opt-in atrás de `ANKINATOR_PDF_LOADER=langchain` + `ODL_PYTHON` e nunca é ativado → o usuário quer uso ativo (tratado na Phase 4.1).
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
**Status note**: O card-builder só reescreve o TEXTO de `q.resposta` (strings simples) e vem OFF por default; nenhuma aparência rica é produzida. A riqueza visual (HTML/CSS) é a Phase 6.
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
**Status**: Código entregue + segurança auditada (code review CR-01/WR-01 corrigidos: re-sanitização no boundary de export + rejeição de `url()` externo). **UAT runtime FALHOU 2026-06-04** — ver `04-HUMAN-UAT.md` (GAPs RT-01..05). Estágios funcionam nos testes (runner mockado) mas ao vivo produzem zero mnemônicos/imagens por falha-suave silenciosa do CLI + estágios OFF por default. Reaberta via Phase 4.1.
**Success Criteria** (what must be TRUE):

  1. Cards de memorização recebem um mnemônico apropriado (técnica escolhida pelo conteúdo).
  2. É gerado um SVG autocontido ilustrando o mnemônico, sanitizado (sem script/URLs externas). ✅ código + segurança
  3. O SVG aparece corretamente nos cards exportados via CSV e AnkiConnect. ⚠ não verificado ao vivo (Phase 4.1)

**Plans**: 4 plans (3 waves)
Plans:
**Wave 1**

- [x] 04-01-PLAN.md — Wave 1: isomorphic-dompurify + sanitize-svg.ts (allowlist geométrica D-06/D-07) + fixtures adversariais F-01..F-12 + refino mnemonic.md (JSON batch) / mnemonic-image.md (MNEM-02, IMG-02)
- [x] 04-04-PLAN.md — Wave 1: UI modo educativo (toggles mnemônico ON / imagem OFF, badges 📝/🖼️ read-only, progresso) + tipos web espelhados (MNEM-01, IMG-01)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 04-02-PLAN.md — Wave 2: enrichAll estágio mnemônico (batch por id) + estágio imagem (por-card, fail-closed) + parseMnemonicosJson + deveRodarEnrich + image-provider conectado (MNEM-01/02, IMG-01/02)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 04-03-PLAN.md — Wave 3: embed <svg> inline no verso (csv + ankiconnect, mesmo mecanismo, sem escapeHtml) + wiring /generate defaults D-12 + guard/smoke estendidos + checkpoint render Anki (IMG-03)
- [x] 04-FIX — fix(04): re-sanitização SVG no boundary de export (CR-01) + rejeição de url() externo (WR-01) + 9 testes de regressão

### Phase 4.1: Estabilização de Runtime (INSERTED)

**Goal**: Fazer o pipeline EXISTENTE realmente produzir saída visível no caminho real do Claude CLI — sem rearquitetar nada ainda. Quando esta fase termina, o usuário roda um PDF real e VÊ mnemônicos e (opcionalmente) imagens nos cards, e os erros do CLI aparecem em vez de sumirem.
**Depends on**: Phase 4
**Requirements**: RT-01, RT-02, RT-05 (ver `04-HUMAN-UAT.md`)
**Success Criteria** (what must be TRUE):

  1. **RT-01:** Falhas do Claude CLI no estágio mnemônico (não-logado, timeout, JSON cercado, ids não-ecoados) ficam VISÍVEIS (log + evento SSE `erro` com causa) em vez de falha-suave silenciosa; o parse tolera JSON em cercas ```` ```json ```` e mnemônicos sem id exato (fallback por ordem/pergunta). Em um PDF real com mnemônico ON, mnemônicos aparecem (ou o motivo da ausência é explícito).
  2. **RT-02:** Imagem de mnemônico é habilitável e funcional ponta-a-ponta; quando ligada e há mnemônicos, SVGs são gerados, sanitizados e embutidos.
  3. **RT-05:** O loader `langchain-opendataloader-pdf` é efetivamente usado (ativável sem fricção; documentado o env/setup; se indisponível, o fallback é registrado em vez de silencioso).

**Plans**: TBD (a planejar)

### Phase 5: Orquestrador Anki por-card

**Goal**: Conectar o `anki-orchestrator` (hoje um prompt `.md` que existe mas NUNCA é carregado por código — andaime morto) como o cérebro que decide por-card quais estágios rodar, aplica batching para poupar quota da assinatura e princípios Anki na agregação, entregando o modo educativo ponta-a-ponta.
**Depends on**: Phase 4.1
**Requirements**: ORCH-01, ORCH-02, ORCH-03, ORCH-04 (wire-the-orchestrator)
**Success Criteria** (what must be TRUE):

  1. O `anki-orchestrator` é carregado e invocado em runtime e decide por-card quais estágios aplicar (ex.: mnemônico/imagem só em cards de memorização).
  2. Estágios caros são batched/seletivos, evitando explosão de chamadas ao CLI.
  3. O fluxo educativo roda de ponta a ponta a partir da UI e produz cards enriquecidos exportáveis.

**Plans**: TBD

### Phase 6: Cards Educativos Ricos (estilo Ankimon)

**Goal**: Elevar a aparência dos cards do "Basic cru" para HTML/CSS rico e educativo, no nível de polimento visual do addon Ankimon (referência). O card-builder passa a emitir HTML estruturado/estilizado; o `Questao` ganha um campo de HTML renderizado; os exporters embutem esse HTML.
**Depends on**: Phase 5
**Requirements**: RICH-01 (campo HTML no Questao), RICH-02 (template/CSS de card educativo seccionado), RICH-03 (exporters CSV/AnkiConnect emitem o HTML rico)
**Success Criteria** (what must be TRUE):

  1. Cards exportados têm layout seccionado e estilizado (enunciado, resposta, mnemônico, imagem) com CSS inline/template — não texto cru com `<br>`.
  2. A imagem SVG do mnemônico é exibida no card (não só um badge), de forma consistente em CSV e AnkiConnect.
  3. O visual é coerente e legível no Anki 25.02.x (referência de riqueza: addon Ankimon).

**Plans**: TBD

### Phase 7: Qualidade das Questões + Agentes Especialistas

**Goal**: (a) Garantir que as questões CRIADAS sejam boas questões de estudo (atomizadas/reformuladas a partir do conteúdo, não o enunciado colado), afrouxando a fidelidade só para `[CRIADA]`; (b) formalizar os especialistas como agentes/skills do mundo Claude (subagents/skills) com um orquestrador que os coordena.
**Depends on**: Phase 6
**Requirements**: QUAL-01 (questões criadas de qualidade), AGENT-01 (especialistas como agentes/skills Claude)
**Success Criteria** (what must be TRUE):

  1. Para um PDF que já é lista de questões, o app gera também questões NOVAS e atomizadas a partir dos conceitos — não só ecoa os enunciados.
  2. Os especialistas (orquestrador Anki, classificador de deck, card educativo, mnemônicos, imagens) existem como recursos Claude de primeira classe e são coordenados por um orquestrador.
  3. UAT humano real: cards bons, ricos, com mnemônicos e imagens, a partir de um PDF de concurso real.

**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 4.1 → 5 → 6 → 7

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Andaime dos Especialistas | 4/4 | Complete | 2026-06-03 |
| 2. Loader PDF LangChain | 4/4 | Complete (loader inativo) | 2026-06-03 |
| 3. Classificador de Deck + Card Educativo | 4/4 | Complete (sem aparência rica) | 2026-06-03 |
| 4. Mnemônicos + Imagem SVG | 4/4 | Código OK, **UAT runtime FALHOU** | 2026-06-04 |
| 4.1 Estabilização de Runtime | — | Código OK (⏳ validar runtime) | 2026-06-04 |
| 5. Orquestrador Anki por-card | 0/TBD | Not started | - |
| 6. Cards Educativos Ricos | — | Código OK + preview ✅ (⏳ validar Anki) | 2026-06-04 |
| 7. Qualidade das Questões + Agentes | 0/TBD | Not started | - |
