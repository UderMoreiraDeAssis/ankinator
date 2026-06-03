---
phase: 03-classificador-de-deck-card-educativo
plan: "00"
subsystem: testing
tags: [vitest, typescript, tdd, unit-test, guard, smoke]

# Dependency graph
requires:
  - phase: 01-especialistas-e-tipos
    provides: runner.ts, prompt-loader.ts, image-provider.ts, types.ts (SPEC-05 com deck/tags)
provides:
  - vitest 4.1.8 instalado como devDependency no workspace server
  - enrich.test.ts — scaffolding RED cobrindo 7 contratos de cobertura (DECK-01/02, CARD-01/02, PIPE-01)
  - guard-enrich.ts — gate CLI-free PIPE-03 (deveRodarEnrich toggles off/on)
  - smoke-enrich.ts — smoke gated com --assert-args (loadPrompt + parseClassificacoesJson + enrichAll)
affects:
  - 03-01-enrich-implementation
  - 03-02-exporters-deck-tags
  - 03-03-ui-modo-educativo

# Tech tracking
tech-stack:
  added:
    - vitest@4.1.8 (devDependency, workspace server, zero-config ESM Node 24)
  patterns:
    - RED scaffold: testes que referenciam funções não existentes (falham por import)
    - Guard CLI-free: asserções síncronas puras sem CLI/rede (clone de guard-default-loader.ts)
    - Smoke gated: --assert-args para CI offline; passo 3 opcional exercita CLI

key-files:
  created:
    - ankinator-app/server/src/core/specialists/enrich.test.ts
    - ankinator-app/server/src/scripts/guard-enrich.ts
    - ankinator-app/server/src/scripts/smoke-enrich.ts
  modified:
    - ankinator-app/server/package.json (vitest devDep + scripts test/test:guard)
    - ankinator-app/package-lock.json (25 pacotes adicionados)

key-decisions:
  - "vitest 4.1.8 instalado; legitimidade verificada via checkpoint humano (maintainer vitest-dev, 64M+ downloads/semana, github.com/vitest-dev/vitest)"
  - "Zero-config vitest — Assumption A3 do research confirmada: Node 24 ESM roda sem vitest.config.ts"
  - "Testes exporter (tagsDaQuestao/csv/ankiconnect) marcados como it.todo até Plano 02 exportar as funções privadas"
  - "Wave 0 RED é estado correto e esperado — enrich.ts implementado no Plano 01"

patterns-established:
  - "RED scaffold: importar de './enrich.js' antes de existir; falha com 'Cannot find module' = estado Wave 0 correto"
  - "Guard CLI-free clona guard-default-loader.ts: function fail() + cenários numerados + flag --assert + process.exit(0)"
  - "Smoke gated clona smoke-runner.ts: PASSO 1 loadPrompt + PASSO 2 CLI-free + PASSO 3 exercita CLI; --assert-args pula passo 3"

requirements-completed: [PIPE-03]

# Metrics
duration: 8min
completed: 2026-06-03
---

# Phase 3 Plan 00: Wave 0 Test Infrastructure Summary

**vitest 4.1.8 instalado como devDependency no workspace server; scaffolding RED (enrich.test.ts + guard-enrich.ts + smoke-enrich.ts) criado com 7 contratos de cobertura e gate PIPE-03 CLI-free**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-06-03T15:41:54Z
- **Completed:** 2026-06-03T15:49:00Z
- **Tasks:** 3 (2 auto + 1 checkpoint:human-verify resolvido pelo orquestrador)
- **Files modified:** 5 (2 modificados + 3 criados)

## Accomplishments

- vitest 4.1.8 instalado no workspace server (npm workspaces, lockfile hoisted); zero-config ESM confirmado
- Checkpoint de legitimidade de pacote APROVADO pelo orquestrador (maintainer vitest-dev, 64M+ downloads/semana)
- enrich.test.ts com 7 strings obrigatórias da VALIDATION.md + describe/it.todo para exporters futuros
- guard-enrich.ts: gate CLI-free PIPE-03 (deveRodarEnrich), 2 cenários, clonado de guard-default-loader.ts
- smoke-enrich.ts: smoke 3-passos com --assert-args, clonado de smoke-runner.ts

## Task Commits

1. **Task 1: Instalar vitest como devDependency** - `1c44b02` (chore)
2. **Task 2: Scaffold RED** - `d316d3f` (test)
3. **Task 3: Checkpoint human-verify** - Resolvido pelo orquestrador (sem commit separado — evidência na mensagem do commit 1c44b02)

## Files Created/Modified

- `ankinator-app/server/package.json` — vitest em devDependencies; scripts test e test:guard adicionados
- `ankinator-app/package-lock.json` — 25 pacotes adicionados (vitest + deps)
- `ankinator-app/server/src/core/specialists/enrich.test.ts` — scaffolding RED, 7 blocos de teste
- `ankinator-app/server/src/scripts/guard-enrich.ts` — gate CLI-free PIPE-03
- `ankinator-app/server/src/scripts/smoke-enrich.ts` — smoke gated --assert-args

## Decisions Made

- vitest 4.1.8 aprovado via checkpoint humano (legitimidade npm confirmada)
- Zero-config ESM Node 24 funciona sem vitest.config.ts (Assumption A3 do research validada)
- Testes de exporters marcados como it.todo — Plano 02 decide o que expor (csv.ts/ankiconnect.ts têm funções privadas hoje)
- Estado RED é o estado correto do Wave 0 — enrich.ts não existe até Plano 01

## Deviations from Plan

None - plan executed exactly as written.

The checkpoint:human-verify (Task 3) was pre-approved by the orchestrator in the continuation prompt with full evidence (maintainer vitest-dev, 64M+ weekly downloads, official repo). The plan's gate was satisfied before execution began.

## Issues Encountered

None. vitest installed cleanly; zero-config confirmed; scaffold files match all acceptance criteria.

## Known Stubs

- `enrich.test.ts`: testes RED que importam `./enrich.js` — este módulo não existe (Wave 0 por design).
  - `parseClassificacoesJson`, `parseSingleCard`, `enrichAll`, `deveRodarEnrich` todos resolvem como "Cannot find module"
  - Estado esperado: será fechado no Plano 01 (implementação de enrich.ts)
- `guard-enrich.ts`: importa `deveRodarEnrich` de `'../core/specialists/enrich.js'` — RED até Plano 01
- `smoke-enrich.ts`: importa `parseClassificacoesJson` e `enrichAll` de `'../core/specialists/enrich.js'` — RED até Plano 01

Estes stubs são intencionais (Wave 0 RED scaffold). O Plano 01 fecha todos.

## Threat Flags

None - apenas devDependency de test runner e arquivos de scaffold. Nenhuma superfície de produção nova.

Checkpoint de legitimidade T-03-SC (npm supply chain) resolvido: vitest aprovado pelo humano antes de qualquer instalação.

## Next Phase Readiness

- vitest pronto: `npm test` no workspace server invoca o runner
- Contratos de cobertura estabelecidos: os 7 testes da VALIDATION.md têm describe/it nomeados
- Gate PIPE-03: guard-enrich.ts está pronto para ser invocado após Plano 01
- Plano 01 fecha o RED: implementar `enrich.ts` com `parseClassificacoesJson`, `parseSingleCard`, `enrichAll`, `deveRodarEnrich`

---
*Phase: 03-classificador-de-deck-card-educativo*
*Completed: 2026-06-03*

## Self-Check: PASSED

- `ankinator-app/server/src/core/specialists/enrich.test.ts` - FOUND
- `ankinator-app/server/src/scripts/guard-enrich.ts` - FOUND
- `ankinator-app/server/src/scripts/smoke-enrich.ts` - FOUND
- Commit `1c44b02` - FOUND (chore: install vitest)
- Commit `d316d3f` - FOUND (test: RED scaffold)
