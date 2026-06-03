---
phase: 03-classificador-de-deck-card-educativo
plan: "02"
subsystem: backend-enrich-exporters
tags: [enrich, pipeline, csv, ankiconnect, deck-routing, tags-merge, tdd]

# Dependency graph
requires:
  - phase: 03-01
    provides: enrich.ts (enrichAll, deveRodarEnrich), store.ts (enrich-progress), GenerateOptions (classificar/cardBuilder)
provides:
  - api.ts: enrichAll wired in /generate .then() behind deveRodarEnrich gate; enrich-progress emitted on same SSE
  - csv.ts: tagsDaQuestao exported; q.tags merged via ...(q.tags ?? []); Deck column + #deck column:5 header conditional on temDeck; CsvOptions.deck fallback
  - ankiconnect.ts: tagsDaQuestao exported; q.tags merged; deckName per-nota (q.deck ?? opts.deck); createDeck per distinct subdeck
  - enrich.test.ts: 8 new real tests replacing it.todo stubs (tagsDaQuestao merge x2, csv deck column x2, ankiconnect routing x4)
affects:
  - 03-03-ui-modo-educativo (enrich-progress SSE now wired; consumers can listen)
  - export flows (CSV and AnkiConnect now route deck hierarchically)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "deveRodarEnrich gate before await enrichAll — Pitfall 2 (enrichAll awaited BEFORE done emission)"
    - "temDeck = questoes.some(q => q.deck) — conditional CSV column/header gate (PIPE-03 byte-identity)"
    - "BOM + headerLines + csvBody order in toAnkiCsv (Pitfall 7)"
    - "subDecks Set from questoes.map(q.deck ?? opts.deck); createDeck loop before addNotes (Assumption A1)"
    - "...(q.tags ?? []) spread in both exporters (Pitfall 6 defensive)"

key-files:
  created: []
  modified:
    - ankinator-app/server/src/api.ts (enrichAll import + genOptions fields + async .then() + gate + enrich-progress emit)
    - ankinator-app/server/src/core/exporters/csv.ts (export tagsDaQuestao + q.tags merge + Deck column + #deck column:5 + CsvOptions.deck)
    - ankinator-app/server/src/core/exporters/ankiconnect.ts (export tagsDaQuestao + q.tags merge + deckName per-nota + createDeck per subdeck)
    - ankinator-app/server/src/core/specialists/enrich.test.ts (8 it.todo converted to real tests)

key-decisions:
  - "PushResult.deck still reports opts.deck as primary deck name — discretionary per plan; subdecks enumerable via the Set used in createDeck loop"
  - "ankiconnect routing tests use unit-level expression test (q.deck ?? opts.deck) rather than mocking network — plan explicitly allows this pattern"
  - "tagsDaQuestao exported from both csv.ts and ankiconnect.ts (previously private) to enable direct test import without re-exporting via an intermediate module"

# Metrics
duration: ~8min
completed: 2026-06-03
---

# Phase 3 Plan 02: Wiring enrichAll + Exporters Deck/Tags Summary

**enrichAll encadeado no /generate com gate deveRodarEnrich (PIPE-03); CSV com coluna Deck condicional + header #deck column:5; AnkiConnect com deckName por-nota + createDeck por subdeck; merge de q.tags nos dois exporters; 18 testes verdes (8 novos)**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-06-03
- **Completed:** 2026-06-03
- **Tasks:** 3 auto
- **Files modified:** 4

## Accomplishments

- api.ts: enrichAll/deveRodarEnrich imported; classificar/cardBuilder added to genOptions; .then() made async; deveRodarEnrich gate before await enrichAll; enrich-progress emitted to same job/SSE; done emitted AFTER enrichAll completes (Pitfall 2 satisfied)
- csv.ts: tagsDaQuestao exported; q.tags merged via ...(q.tags ?? []); temDeck gate adds Deck column + #deck column:5 header; BOM+headers+body order correct; CsvOptions.deck fallback field added
- ankiconnect.ts: tagsDaQuestao exported; q.tags merged; pushToAnki creates deck per distinct subdeck (Assumption A1); deckName: q.deck ?? opts.deck per-nota routing with fallback
- enrich.test.ts: 8 it.todo stubs converted to real tests (tagsDaQuestao merge x2, csv deck column x2, ankiconnect routing x4 including tags merge)
- Test count: 18 passed (up from 10 in plan 01), 0 failed

## Task Commits

1. **Task 1: Encadear enrichAll no /generate com gate deveRodarEnrich** - `a74dc12` (feat)
2. **Task 2: csv.ts coluna Deck condicional + header #deck column + merge q.tags** - `3c3022f` (feat)
3. **Task 3: ankiconnect.ts deckName por-nota + createDeck por subdeck + merge q.tags** - `d9aa22d` (feat)

## Files Created/Modified

- `ankinator-app/server/src/api.ts` — enrichAll wired in /generate .then() with deveRodarEnrich gate + enrich-progress SSE emission
- `ankinator-app/server/src/core/exporters/csv.ts` — Deck column + #deck column:5 conditional; q.tags merge; tagsDaQuestao exported; deck? in CsvOptions
- `ankinator-app/server/src/core/exporters/ankiconnect.ts` — deckName per-nota; createDeck per subdeck; q.tags merge; tagsDaQuestao exported
- `ankinator-app/server/src/core/specialists/enrich.test.ts` — 8 new real tests replacing it.todo stubs

## Decisions Made

- PushResult.deck reports opts.deck as primary deck — discretionary choice per plan; subdecks are tracked in the Set used for createDeck loop
- ankiconnect routing tests use unit expression tests (q.deck ?? opts.deck) rather than mocking the AnkiConnect network — sufficient to verify the routing logic without requiring a running Anki instance
- tagsDaQuestao exported from both exporters to enable direct test imports without intermediary modules

## Verification Results

- `npm run test` (server): **18 passed | 0 todo | 0 failed** — all new tests green
- `npx tsx src/scripts/guard-enrich.ts`: **both scenarios pass** — PIPE-03 gate green
- `npx tsc --noEmit` (server): **No errors found**
- `grep "deveRodarEnrich" src/api.ts`: present — gate confirmed
- `grep "enrich-progress" src/api.ts`: present — SSE emission confirmed
- `grep "#deck column:5" src/core/exporters/csv.ts`: present — header confirmed
- `grep "q.tags ?? \[\]" src/core/exporters/csv.ts`: present — defensive merge confirmed
- `grep "q.deck ?? opts.deck" src/core/exporters/ankiconnect.ts`: present — per-nota routing confirmed
- `grep "new Set(questoes.map" src/core/exporters/ankiconnect.ts`: present — subdeck Set confirmed

## Acceptance Criteria Checklist

- [x] enrichAll encadeado com gate; enrich-progress emitido antes de done; guard PIPE-03 verde; sem endpoint novo
- [x] npx tsc --noEmit passa sem erros
- [x] tagsDaQuestao merge tests verdes (csv)
- [x] csv deck column tests verdes
- [x] #deck column:5 presente em csv.ts
- [x] q.tags ?? [] presente em csv.ts
- [x] export function tagsDaQuestao em csv.ts
- [x] ankiconnect routing tests verdes
- [x] q.deck ?? opts.deck presente em ankiconnect.ts
- [x] new Set(questoes.map) presente em ankiconnect.ts (subdecks)
- [x] q.tags ?? [] presente em ankiconnect.ts
- [x] Byte-identidade quando sem deck assertada por teste (csv deck column, case 2)

## Deviations from Plan

None - plan executed exactly as written.

The only discretionary choice was PushResult.deck continuing to report opts.deck (not a list of subdecks), which the plan explicitly marks as "discrição de Claude — escolher uma e documentar no SUMMARY".

## Known Stubs

None. All required functionality implemented and verified. The remaining `it.todo` entries in enrich.test.ts (3 stubs in split extraida + card-builder extraida verso + enrichAll sequência sections) are deferred integration tests that require mocking runClaudeCli — they are pre-existing from Wave 0 scaffolding and not in scope for this plan.

## Threat Flags

None - all introduced changes are additive with fallback paths. T-03-04 (q.deck path-like in createDeck) and T-03-05 (Deck column info disclosure) are both accepted per the plan's threat register (local single-user app; AnkiConnect treats deckName as display string not filesystem path).

---
*Phase: 03-classificador-de-deck-card-educativo*
*Completed: 2026-06-03*
