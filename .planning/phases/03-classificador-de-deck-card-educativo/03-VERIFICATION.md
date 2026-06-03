---
phase: 03-classificador-de-deck-card-educativo
verified: 2026-06-03T13:25:00Z
status: human_needed
score: 7/7
overrides_applied: 0
human_verification:
  - test: "Suba server+web, carregue PDF, confirme bloco 'Modo educativo' com Classificar ON e Card educativo OFF por default"
    expected: "Bloco aparece na tela de estrutura com defaults D-15 corretos"
    why_human: "Rendering React condicional e defaults de estado não são verificáveis por grep"
  - test: "Clique Gerar com Classificar ligado, observe passo generating — confirme que aparece 'Classificando deck + tags...' dentro do passo generating, sem 5o step no Stepper"
    expected: "Progresso de enrich visivel no ProgressPanel; Stepper permanece com 4 passos"
    why_human: "Comportamento SSE em tempo real e UI de progresso nao sao verificaveis headless"
  - test: "Na revisao (CardTable), confirme que cada card enriquecido mostra badge de deck (violeta) e badge de tags, em modo leitura sem input editavel"
    expected: "Badges deck e tags aparecem condicionalmente; nenhum campo de edicao"
    why_human: "Condicionalidade de renderizacao e ausencia de inputs requerem inspecao visual"
  - test: "Desligue ambos os toggles e gere novamente — confirme que o fluxo roda identico ao baseline sem nenhuma fase de enrich"
    expected: "Job conclui sem emitir enrich-progress; CSV gerado sem coluna Deck nem header #deck column"
    why_human: "Sanity PIPE-03 na UI e no CSV requerem execucao real com PDF"
---

# Phase 03: Classificador de Deck + Card Educativo — Verification Report

**Phase Goal:** Implementar o pipeline de enriquecimento pos-geracao (enrichAll encadeado em /generate com gate PIPE-03), a classificacao de deck hierarquico e tags por card (DECK-01/DECK-02), a reescrita educativa de cards (CARD-01/CARD-02), e a UI de modo educativo com toggles, progresso e badges read-only (PIPE-02).
**Verified:** 2026-06-03T13:25:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | enrichAll() existe e e encadeado no /generate flow (api.ts) atras do gate deveRodarEnrich | VERIFIED | `api.ts:16` importa enrichAll/deveRodarEnrich; `api.ts:160-163` gate + await enrichAll + emit enrich-progress |
| 2 | enrich e gated por deveRodarEnrich — output byte-identico quando toggles off (PIPE-03) | VERIFIED | `guard-enrich.ts` roda com exit 0; teste `csv deck column` NÃO inclui header quando sem q.deck; `api.ts:156-164` gate correto |
| 3 | UI modo educativo: StructurePanel com toggles classificar/cardBuilder, defaults ON/OFF, sem 5o step no Stepper | VERIFIED (code) / HUMAN (runtime) | `StructurePanel.tsx:132-154` contem bloco "Modo educativo" com 2 checkboxes; `App.tsx:24-25` defaults `classificar:true`/`cardBuilder:false`; `Stepper.tsx` tem exatamente 4 steps |
| 4 | ProgressPanel exibe enrich-progress (classificando.../reescrevendo...) DENTRO do passo generating | VERIFIED (code) / HUMAN (runtime) | `ProgressPanel.tsx:51-60` renderiza `enrichProgress` condicionalmente com labels corretos; `App.tsx:86-89` listener SSE; `App.tsx:174` prop enrichProgress repassada |
| 5 | CardTable mostra badges deck + tags read-only quando preenchidos | VERIFIED (code) / HUMAN (runtime) | `CardTable.tsx:71-81` badges condicionais `c.deck` (violeta) e `c.tags` (slate), sem input/onChange |
| 6 | CSV tem coluna Deck + header #deck column:5 SÓ quando algum card tem q.deck; AnkiConnect roteia deckName por-nota (DECK-01/DECK-02) | VERIFIED | `csv.ts:58-87` gate `temDeck`, header condicional, coluna condicional; `ankiconnect.ts:102-114` subDecks Set + deckName por-nota com fallback; 18/18 testes passam |
| 7 | card-builder produz cards educativos (CARD-01/CARD-02): extraida so ajusta verso; criada pode dividir; payload serializado via JSON.stringify (T-03-02) | VERIFIED | `enrich.ts:124-143` buildCardBuilderMessage usa JSON.stringify (CR-01 da review corrigido); `enrich.ts:212-233` logica extraida/criada; testes passam |

**Score:** 7/7 truths verified (4 com componente human para runtime)

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `ankinator-app/server/src/core/specialists/enrich.ts` | enrichAll, parseClassificacoesJson, parseSingleCard, deveRodarEnrich, EnrichOpts, EnrichProgress | VERIFIED | 247 linhas; todas as exportacoes presentes; JSON.stringify em ambos buildClassificadorMessage e buildCardBuilderMessage |
| `ankinator-app/server/src/scripts/guard-enrich.ts` | Guard CLI-free PIPE-03 | VERIFIED | 2 cenarios; exit 0 confirmado |
| `ankinator-app/server/src/scripts/smoke-enrich.ts` | Smoke gated opt-in | VERIFIED | flag --assert-args presente |
| `ankinator-app/server/src/core/specialists/enrich.test.ts` | Suite vitest 18 tests | VERIFIED | 18 passed, 4 todo |
| `ankinator-app/server/src/api.ts` | enrichAll encadeado com gate | VERIFIED | await enrichAll antes de emit done; gate deveRodarEnrich |
| `ankinator-app/server/src/core/exporters/csv.ts` | Coluna Deck condicional + #deck column:5 + merge q.tags | VERIFIED | temDeck gate; header condicional; `...(q.tags ?? [])` no Set |
| `ankinator-app/server/src/core/exporters/ankiconnect.ts` | deckName por-nota + createDeck por subdeck + merge q.tags | VERIFIED | subDecks Set com per-deck try/catch; deckName = q.deck ?? opts.deck; `...(q.tags ?? [])` |
| `ankinator-app/server/src/store.ts` | JobEvent com variante enrich-progress | VERIFIED | `store.ts:38` tipo `enrich-progress` na union |
| `ankinator-app/server/src/core/types.ts` | GenerateOptions com classificar/cardBuilder | VERIFIED | campos opcionais presentes com comentarios |
| `ankinator-app/web/src/types.ts` | GenerateOptions espelhado + EnrichProgress exportado | VERIFIED | ambos os campos e interface EnrichProgress presentes |
| `ankinator-app/web/src/App.tsx` | Listener SSE enrich-progress + defaults + repasse | VERIFIED | `classificar:true`/`cardBuilder:false` defaults; listener registrado; enrichProgress passado ao ProgressPanel; setEnrichProgress(null) em handleGenerate E em reset() |
| `ankinator-app/web/src/components/StructurePanel.tsx` | Bloco Modo educativo com 2 toggles | VERIFIED | bloco presente; checked com `!== false` (ON) e `=== true` (OFF) |
| `ankinator-app/web/src/components/ProgressPanel.tsx` | Render condicional de enrich-progress | VERIFIED | prop enrichProgress aceita; classificando/reescrevendo renderizados |
| `ankinator-app/web/src/components/CardTable.tsx` | Badges deck+tags read-only | VERIFIED | badges condicionais sem input/onChange |
| `ankinator-app/server/src/core/specialists/prompts/deck-classifier.md` | Contem "classificacoes" | VERIFIED | grep confirma |
| `ankinator-app/server/src/core/specialists/prompts/card-builder.md` | Contem "cards" | VERIFIED | grep confirma (4 ocorrencias) |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `api.ts` | `enrich.ts` | import enrichAll/deveRodarEnrich + await + emit enrich-progress | WIRED | `api.ts:16,160-163` |
| `api.ts` | enrichAll ANTES de emit done | await async, nao fire-and-forget | WIRED | `.then(async ...)` + `await enrichAll(...)` antes de `jobStore.emit(done)` |
| `store.ts` | `enrich.ts` | import type EnrichProgress | WIRED | `store.ts:9` |
| `csv.ts` | q.deck / q.tags | coluna Deck + tagsDaQuestao merge | WIRED | `csv.ts:29,58-87` |
| `ankiconnect.ts` | q.deck / q.tags | deckName por-nota + tagsDaQuestao merge | WIRED | `ankiconnect.ts:70-75,102-114` |
| `App.tsx` | `ProgressPanel.tsx` | prop enrichProgress | WIRED | `App.tsx:174` |
| `StructurePanel.tsx` | options.classificar / options.cardBuilder | checkbox onChange setOptions | WIRED | `StructurePanel.tsx:140-153` |
| `App.tsx` | SSE enrich-progress | es.addEventListener | WIRED | `App.tsx:86-89` |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `ProgressPanel.tsx` | enrichProgress | SSE enrich-progress → App.tsx state | Depende de LLM real (gated) | HUMAN — LLM call necessario |
| `CardTable.tsx` | c.deck, c.tags | enrichAll resultado via job.questoes | Depende de LLM real | HUMAN — LLM call necessario |
| `csv.ts toAnkiCsv` | q.deck / q.tags | questoes array do job | Testado unitariamente com fixtures | VERIFIED via testes |
| `ankiconnect.ts pushToAnki` | q.deck / deckName | questoes array do job | Testado unitariamente com fixtures | VERIFIED via testes |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| 18 testes vitest passam | `cd ankinator-app/server && npm run test` | 18 passed, 4 todo, 0 failed | PASS |
| guard-enrich.ts PIPE-03 | `npx tsx src/scripts/guard-enrich.ts` | exit 0, 2 cenarios OK | PASS |
| TypeScript server sem erros | `cd ankinator-app/server && npx tsc --noEmit` | No errors found | PASS |
| TypeScript web sem erros | `cd ankinator-app/web && npx tsc --noEmit` | No errors found | PASS |
| Web build conclui | `cd ankinator-app/web && npm run build` | dist gerado, 36 modules, vite OK | PASS |

---

### Probe Execution

Nenhuma probe convencional `scripts/*/tests/probe-*.sh` declarada ou encontrada para esta fase. Step 7c: SKIPPED (sem probes declaradas).

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| PIPE-01 | 03-01, 03-02 | enrichAll() encadeado apos generateAll(), reusando job/SSE | SATISFIED | `api.ts:154-168` enrichAll encadeado; enrich-progress emitido no mesmo job |
| PIPE-02 | 03-03 | UI expoe toggles modo educativo com defaults inteligentes | SATISFIED (code verified; runtime human) | StructurePanel.tsx toggles; App.tsx defaults; ProgressPanel.tsx progresso; CardTable.tsx badges |
| PIPE-03 | 03-00, 03-02 | Fluxo atual sem modo educativo continua funcionando sem regressao | SATISFIED | guard-enrich.ts exit 0; teste csv byte-identidade; gate `if (deveRodarEnrich(enrichOpts))` em api.ts |
| DECK-01 | 03-01, 03-02 | Classificador gera hierarquia deck Anki (Materia::Assunto::Subtopico) | SATISFIED (backend) | enrich.ts buildClassificadorMessage; csv.ts #deck column:5; ankiconnect.ts deckName por-nota |
| DECK-02 | 03-01, 03-02 | Classificador atribui tags por card (banca, ano, nivel, tema) | SATISFIED | enrich.ts merge por id; tagsDaQuestao com `...(q.tags ?? [])` em csv e ankiconnect |
| CARD-01 | 03-01 | Card-builder reescreve para atomicidade (minimum information principle) | SATISFIED (backend) | enrich.ts buildCardBuilderMessage; D-09 split criada; D-10 verso-only extraida |
| CARD-02 | 03-01 | Verso inclui explicacao curta e atribuicao de fonte | SATISFIED (backend) | card-builder.md especifica formato; buildCardBuilderMessage inclui campo `fonte` (pageStart/pageEnd) |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| Nenhum | — | Nenhum TBD/FIXME/XXX/placeholder encontrado nos arquivos modificados pela fase | — | — |

Observacao: WR-01 (comment "Default: true" vs runtime undefined) foi corrigido em `api.ts:157` com `?? true`; WR-02 (stale enrichProgress em reset()) foi corrigido em `App.tsx:119`; WR-03 (serial createDeck sem isolamento) foi corrigido em `ankiconnect.ts:103-110` com try/catch por deck. Todas as warnings do REVIEW.md foram endereçadas na implementacao final.

---

### Human Verification Required

#### 1. Modo educativo defaults e renderizacao

**Test:** Suba o server e o web (conforme scripts em `ankinator-app/`). Carregue um PDF de concurso e avance ate a tela de estrutura. Confirme que o bloco "Modo educativo" aparece com "Classificar deck + tags" MARCADO e "Card educativo" DESMARCADO por default (D-15).
**Expected:** Bloco visivel com defaults corretos; checkboxes no estado inicial correto antes de qualquer interacao.
**Why human:** Renderizacao React e estado inicial de useState nao sao verificaveis por analise estatica.

#### 2. Progresso de enrich no passo generating

**Test:** Com ambos os toggles default (Classificar ON), clique Gerar. Durante o passo "generating", observe se aparece "Classificando deck + tags..." abaixo da lista de blocos. Confirme que NAO surge um 5o passo no Stepper.
**Expected:** Progresso de enrich visivel dentro do ProgressPanel (mesmo passo "Gerar"); Stepper permanece com 4 passos.
**Why human:** Comportamento SSE em tempo real e renderizacao condicional nao sao verificaveis sem servidor rodando.

#### 3. Badges deck+tags read-only na CardTable

**Test:** Apos geracao com Classificar ON, na revisao (CardTable), confirme que cada card enriquecido mostra um badge de deck (ex.: "Materia::Assunto::Subtopico" em fundo violeta) e badges de tags. Confirme que esses badges sao somente leitura (sem campo editavel, sem input).
**Expected:** Badges aparecem condicionalmente quando q.deck/q.tags preenchidos; nenhum input de edicao.
**Why human:** Condicionalidade de renderizacao e ausencia de inputs requerem inspecao visual no browser.

#### 4. Sanidade PIPE-03 na UI

**Test:** Desligue ambos os toggles ("Classificar deck + tags" e "Card educativo") e gere novamente com o mesmo PDF. Confirme que o fluxo conclui sem exibir nenhuma mensagem de "Classificando..." no ProgressPanel, e que o CSV exportado NAO contem "#deck column" nem coluna Deck.
**Expected:** Comportamento identico ao baseline pre-fase; sem fase de enrich; CSV byte-identico ao formato original.
**Why human:** Verificacao de ausencia de eventos SSE e formato de arquivo exportado requerem execucao real.

---

### Gaps Summary

Nenhum gap de codigo identificado. Todos os requisitos PIPE-01, PIPE-02, PIPE-03, DECK-01, DECK-02, CARD-01, CARD-02 estao implementados e verificados estaticamente. A revisao de codigo (REVIEW.md) foi resolvida na implementacao final: CR-01 (JSON.stringify no buildCardBuilderMessage), WR-01 (?? true/false nos enrichOpts), WR-02 (setEnrichProgress(null) em reset()), WR-03 (try/catch por deck em createDeck) — todos corrigidos.

O status `human_needed` reflete exclusivamente que os 4 checkpoints de UI runtime (PIPE-02) nao podem ser verificados sem rodar a aplicacao com um PDF real e LLM real (assinatura Claude).

---

_Verified: 2026-06-03T13:25:00Z_
_Verifier: Claude (gsd-verifier)_
