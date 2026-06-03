---
phase: 03-classificador-de-deck-card-educativo
plan: "01"
subsystem: backend-enrich
tags: [enrich, classifier, card-builder, tdd, typescript, types-mirror]

# Dependency graph
requires:
  - phase: 01-especialistas-e-tipos
    provides: runner.ts, prompt-loader.ts, types.ts (SPEC-05 deck/tags)
  - phase: 03-00
    provides: vitest installed, RED test scaffolding (enrich.test.ts, guard-enrich.ts)
provides:
  - enrich.ts: enrichAll, parseClassificacoesJson, parseSingleCard, deveRodarEnrich, EnrichOpts, EnrichProgress
  - store.ts: JobEvent extended with enrich-progress variant
  - server/core/types.ts: GenerateOptions + classificar?/cardBuilder?
  - web/src/types.ts: GenerateOptions mirrored + EnrichProgress interface
  - deck-classifier.md: Saída section specifies JSON with id field
  - card-builder.md: Saída section specifies JSON cards array + EXTRAIDA no-split rule
affects:
  - 03-02-exporters-deck-tags (consumes deck/tags from enrichAll output)
  - 03-03-ui-modo-educativo (consumes EnrichProgress from web/src/types.ts)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "parseJsonBlock<T>(text, key): shared tolerant JSON parser helper (clone of parseQuestoesJson)"
    - "Map merge by id: const byId = new Map(...); byId.get(q.id) — anti-Pitfall 3 (never positional)"
    - "JSON.stringify payload for classifier — no raw q.resposta interpolation (T-03-02)"
    - "Split only for criada; extraida only replaces resposta (D-09/D-10)"
    - "Per-card/stage error isolation: failure keeps original card (D-13)"

key-files:
  created:
    - ankinator-app/server/src/core/specialists/enrich.ts
  modified:
    - ankinator-app/server/src/store.ts (enrich-progress in JobEvent union)
    - ankinator-app/server/src/core/types.ts (GenerateOptions + classificar/cardBuilder)
    - ankinator-app/web/src/types.ts (GenerateOptions mirror + EnrichProgress interface)
    - ankinator-app/server/src/core/specialists/prompts/deck-classifier.md (Saida section)
    - ankinator-app/server/src/core/specialists/prompts/card-builder.md (Saida section)

key-decisions:
  - "parseJsonBlock<T> shared helper chosen over two separate clones — same tolerant pattern, less duplication, build green"
  - "Merge by Map(id) in enrichAll Stage 1 — classificacoes with non-existent id are silently ignored (T-03-01 defensively handled)"
  - "GenerateOptions mirrored server+web in SAME commit (Task 2) — Pitfall 1 satisfied; Questao not touched"
  - "EnrichProgress added to web/src/types.ts as separate interface mirror (not re-exported from server) — no cross-package import needed"

# Metrics
duration: ~10min
completed: 2026-06-03
---

# Phase 3 Plan 01: Implementar enrich.ts — contratos GREEN Summary

**enrich.ts implementado com enrichAll (stage 1 classificador + stage 2 card-builder), parsers tolerantes, gate deveRodarEnrich; RED tests turned GREEN; GenerateOptions mirrored server+web; prompts refinados com formato JSON explícito**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-06-03T15:41:54Z (approximate)
- **Completed:** 2026-06-03T15:51:24Z
- **Tasks:** 3 auto (TDD: GREEN phase for Task 1)
- **Files modified:** 6 (1 created + 5 modified)

## Accomplishments

- enrich.ts created (>80 lines, all 6 required exports present)
- parseJsonBlock<T> shared helper: tolerant JSON extraction (removes fences, trims, handles errors)
- parseClassificacoesJson: reads `obj.classificacoes`, returns RawClassificacao[]
- parseSingleCard: reads `obj.cards`, returns RawCard[]
- deveRodarEnrich: pure gate — !!(opts.classificar || opts.cardBuilder)
- enrichAll Stage 1: 1 global call to deck-classifier; merge by Map(id) (D-06); JSON.stringify payload (T-03-02)
- enrichAll Stage 2: per-card card-builder; extraida→replace resposta only; criada→split 1→N; error isolation (D-13)
- store.ts: enrich-progress added to JobEvent union between progress and done
- server/core/types.ts + web/src/types.ts: classificar?/cardBuilder? added to GenerateOptions in SAME commit (Pitfall 1)
- web/src/types.ts: EnrichProgress interface exported for UI plans
- deck-classifier.md: Saida section now requires JSON with id field (resolves Open Question 1)
- card-builder.md: Saida section now requires JSON cards array + EXTRAIDA no-split rule (resolves Open Question 2)

## Task Commits

1. **Task 1: Criar enrich.ts** - `b4d8c23` (feat)
2. **Task 2: Estender store.ts + espelhar GenerateOptions** - `0ef05a7` (feat)
3. **Task 3: Refinar deck-classifier.md e card-builder.md** - `dcc8247` (feat)

## Files Created/Modified

- `ankinator-app/server/src/core/specialists/enrich.ts` — CREATED: enrichAll, parseClassificacoesJson, parseSingleCard, deveRodarEnrich, EnrichOpts, EnrichProgress (241 lines)
- `ankinator-app/server/src/store.ts` — enrich-progress variant added to JobEvent union; EnrichProgress imported
- `ankinator-app/server/src/core/types.ts` — classificar? and cardBuilder? added to GenerateOptions
- `ankinator-app/web/src/types.ts` — same two fields mirrored; EnrichProgress interface added
- `ankinator-app/server/src/core/specialists/prompts/deck-classifier.md` — Saida section replaced with JSON format requiring id field
- `ankinator-app/server/src/core/specialists/prompts/card-builder.md` — Saida section replaced with cards JSON format + EXTRAIDA rules

## Decisions Made

- parseJsonBlock<T> shared helper (not two separate parser clones) — keeps DRY while maintaining same tolerant pattern
- GenerateOptions mirrored in the SAME Task 2 commit (server + web) to satisfy Pitfall 1 constraint
- EnrichProgress added as interface mirror directly in web/src/types.ts (no cross-package import)

## Verification Results

- `npm run test` (server): **10 passed | 8 todo** — all RED contract tests now GREEN
- `npx tsx src/scripts/guard-enrich.ts`: **both scenarios pass** (PIPE-03 gate working)
- `npx tsc --noEmit` (server): **No errors found**
- `npx tsc --noEmit` (web): **No errors found**
- `loadPrompt('deck-classifier')` and `loadPrompt('card-builder')`: both resolve with correct content (lengths 2267/2487)

## Acceptance Criteria Checklist

- [x] enrich.ts exports: enrichAll, parseClassificacoesJson, parseSingleCard, deveRodarEnrich, EnrichOpts, EnrichProgress
- [x] Merge by Map (grep: `new Map` + `byId.get(q.id)` present) — never positional
- [x] JSON.stringify in classifier userMessage (grep: `JSON.stringify(cards`) — no raw interpolation
- [x] tipo === 'extraida' produces exactly 1 card without altering pergunta
- [x] loadPrompt('deck-classifier') and loadPrompt('card-builder') in enrich.ts — no inline prompts
- [x] store.ts contains `| { type: 'enrich-progress'; data: EnrichProgress }` and imports EnrichProgress
- [x] server/core/types.ts and web/src/types.ts both contain classificar? and cardBuilder? (same commit)
- [x] web/src/types.ts exports EnrichProgress
- [x] Questao not modified in either file
- [x] deck-classifier.md contains 'classificacoes' and id instruction
- [x] card-builder.md contains 'cards' format and EXTRAIDA no-split rule

## Deviations from Plan

None - plan executed exactly as written.

The only discretionary choice was using a shared `parseJsonBlock<T>(text, key)` helper instead of two separate parser clones. The plan explicitly permits this: "Discrição: extrair helper `parseJsonBlock<T>(text, key)` compartilhado é permitido desde que o build fique verde." Build is green.

## Known Stubs

None. All required functionality implemented and verified. The 8 `it.todo` entries in enrich.test.ts are intentional deferred tests for Plan 02 (exporters) and were already present from Wave 0 by design.

## Threat Flags

None - no new network endpoints, auth paths, or file access patterns introduced beyond what the threat model already documents (T-03-01, T-03-02, T-03-03 all mitigated as designed).

---
*Phase: 03-classificador-de-deck-card-educativo*
*Completed: 2026-06-03*
