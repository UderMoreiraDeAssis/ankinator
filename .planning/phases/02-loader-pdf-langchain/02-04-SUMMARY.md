---
phase: 02-loader-pdf-langchain
plan: "04"
subsystem: pdf-processing
tags: [langchain, document-loader, branch, guard, smoke, wiring, non-regression]

# Dependency graph
requires:
  - phase: 02-loader-pdf-langchain
    plan: "03"
    provides: "isLangchainAvailable(): Promise<boolean>, runLangchainLoader(pdf, opts): Promise<LoadedDocument>"
provides:
  - "loadDocument() com branch D-03 aditivo (ANKINATOR_PDF_LOADER=langchain) + fallback silencioso D-04 + log D-05 + OCR vence D-06"
  - "buildConvertOptions(outDir, opts): ConvertOptions — helper puro exportado (guard D-15 CLI-free)"
  - "guard-default-loader.ts --assert — prova CLI-free ConvertOptions byte-idêntico SEM Java/Python"
  - "smoke-langchain-loader.ts gated — CI-safe, exercita caminho langchain real quando disponível"
affects: [pdf-02-complete, pdf-03-non-regression, wave-3-final]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "branch PURAMENTE ADITIVO em loadDocument: env==='langchain' gated por isLangchainAvailable() (D-03/D-04/D-05)"
    - "buildConvertOptions(outDir, opts): helper puro exportado — assertável CLI-free (D-15)"
    - "guard D-15 CLI-free: compara objeto com expected literal element-by-element; sem Java/Python/langchain"
    - "smoke gated D-14: isLangchainAvailable() gate → skip gracioso (exit 0) quando indisponível"

key-files:
  created:
    - ankinator-app/server/src/scripts/guard-default-loader.ts
    - ankinator-app/server/src/scripts/smoke-langchain-loader.ts
  modified:
    - ankinator-app/server/src/core/document-loader.ts

key-decisions:
  - "branch langchain PURAMENTE ADITIVO: a condição === 'langchain' é false com env unset → nada do langchain roda (Pitfall 3 / D-15)"
  - "buildConvertOptions extraído antes do branch: o guard pode chamar buildConvertOptions sem criar temp dir nem importar langchain"
  - "smoke-langchain-loader força ANKINATOR_PDF_LOADER='langchain' via process.env antes de loadDocument (não chama runLangchainLoader direto)"
  - "node_modules symlink do worktree → main repo resolveu resolução de pacotes ESM durante verificação"

requirements-completed: [PDF-02, PDF-03]

# Metrics
duration: 5min
completed: 2026-06-03
---

# Phase 02 Plan 04: Wiring Final PDF-02 + Guard PDF-03 (D-15) Summary

**Branch aditivo langchain em `loadDocument` (D-03/D-04/D-05/D-06), helper puro `buildConvertOptions` para guard CLI-free (D-15), guard de não-regressão do default (guard-default-loader.ts), e smoke gated (smoke-langchain-loader.ts — D-14)**

## Performance

- **Duration:** 5 min
- **Started:** 2026-06-03T12:08:46Z
- **Completed:** 2026-06-03T12:13:55Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- Task 1: `document-loader.ts` — `buildConvertOptions` extraído puro + branch langchain aditivo (D-03/D-04/D-05/D-06); OCR branch intocado; caminho default byte-idêntico (D-15)
- Task 2: `guard-default-loader.ts` — guard CLI-free D-15; 2 cenários (opts vazio + pages/password); sem langchain/Java/Python; exit 0 em < 2s
- Task 3: `smoke-langchain-loader.ts` — smoke gated D-14; skip gracioso se Python indisponível; clona harness smoke-loader.ts

## Task Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | buildConvertOptions + branch langchain (D-03/D-04/D-05/D-06/D-15) | b9ec5b6 | ankinator-app/server/src/core/document-loader.ts |
| 2 | guard-default-loader.ts (guard CLI-free D-15) | 9f55fe9 | ankinator-app/server/src/scripts/guard-default-loader.ts |
| 3 | smoke-langchain-loader.ts (smoke gated D-14) | edc9bbf | ankinator-app/server/src/scripts/smoke-langchain-loader.ts |

## Files Created/Modified

- `ankinator-app/server/src/core/document-loader.ts` — branch aditivo D-03 (após OCR D-06); `buildConvertOptions` exportado puro; import de `runLangchainLoader`/`isLangchainAvailable`; fallback silencioso D-04; log D-05; caminho default byte-idêntico D-15
- `ankinator-app/server/src/scripts/guard-default-loader.ts` — 114 linhas; 2 cenários CLI-free; prova `ConvertOptions` byte-idêntico sem Java/Python/langchain; --assert flag espelha smoke-runner --assert-args
- `ankinator-app/server/src/scripts/smoke-langchain-loader.ts` — 59 linhas; gated D-14; clona harness smoke-loader.ts; força `ANKINATOR_PDF_LOADER='langchain'`; propaga erros D-04

## Decisions Made

- `buildConvertOptions` extraído ANTES do branch langchain: o guard CLI-free pode importar `buildConvertOptions` sem puxar a cadeia de imports que inclui `langchain-loader`. Espelha como `buildSpawnArgs` foi extraído na Phase 1 para o guard SPEC-01 (smoke-runner --assert-args).
- `smoke-langchain-loader` força `ANKINATOR_PDF_LOADER='langchain'` via `process.env` antes de chamar `loadDocument`, em vez de chamar `runLangchainLoader` diretamente. Escolha: exercita o branch completo de `loadDocument` (D-03), não só o loader isolado — mais fiel ao fluxo de produção.
- Verificação via node_modules symlink: worktree não tem `node_modules`; criar symlink `worktree/ankinator-app/node_modules → main_repo/ankinator-app/node_modules` resolve resolução de pacotes ESM sem copiar arquivos. Solução consistente com como as waves anteriores resolveram o mesmo problema com `tsc`.

## Deviations from Plan

None — plano executado exatamente como escrito. Os 3 artifacts obrigatórios foram entregues com os contratos exatos.

## Known Stubs

None — todos os caminhos de código estão completos. O smoke manual (com PDF real + venv + Java) é responsabilidade do usuário; o smoke pula graciosamente em CI (D-14).

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| T-02-08 mitigated | ankinator-app/server/src/core/document-loader.ts | branch PURAMENTE ADITIVO — condição === 'langchain' é false com env unset; guard D-15 prova CLI-free; Pitfall 3 fechado |

## Self-Check: PASSED

- `ankinator-app/server/src/core/document-loader.ts` — modificado e commitado em b9ec5b6
- `ankinator-app/server/src/scripts/guard-default-loader.ts` — criado e commitado em 9f55fe9
- `ankinator-app/server/src/scripts/smoke-langchain-loader.ts` — criado e commitado em edc9bbf
- `npx tsc --noEmit` — sem erros
- `guard-default-loader.ts --assert` — exit 0, ambos cenários OK
- `assert-langchain-normalize.ts` — exit 0 (regressão Plano 01 confirmada)
- `smoke-langchain-loader.ts` (sem PDF) — exit 1 com mensagem de uso
- `smoke-langchain-loader.ts` (sem Python) — exit 0 "langchain indisponível — smoke pulado"

---
*Phase: 02-loader-pdf-langchain*
*Completed: 2026-06-03*
