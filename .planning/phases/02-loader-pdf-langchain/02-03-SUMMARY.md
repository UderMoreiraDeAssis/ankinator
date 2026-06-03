---
phase: 02-loader-pdf-langchain
plan: "03"
subsystem: pdf-processing
tags: [langchain, loader, spawn, typescript, config, tdd, cross-mode]

# Dependency graph
requires:
  - phase: 02-loader-pdf-langchain
    plan: "01"
    provides: "normalize(RawDoc[], pdfPath): LoadedDocument"
  - phase: 02-loader-pdf-langchain
    plan: "02"
    provides: "tools/odl_langchain_loader.py — sidecar Python PDF→JSON stdout"
provides:
  - "isLangchainAvailable(): Promise<boolean> — import-check D-04"
  - "runLangchainLoader(pdf, opts): Promise<LoadedDocument> — spawn sem temp dir, JSON.parse→normalize (D-01)"
  - "config.pdfLoader (default 'node', D-03) + config.langchainPython (fallback ODL_PYTHON, D-02)"
affects: [02-04-wiring, wave-3, document-loader.ts]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "pythonBin(): ANKINATOR_LANGCHAIN_PYTHON || ODL_PYTHON || null — var dedicada D-02"
    - "run(): cópia byte-idêntica de ocr-loader.ts (spawn argv-array, stdio pipe) — sem exec/promisify"
    - "isLangchainAvailable(): import-check sem Java (Java → erro de runtime, D-04/Pitfall2)"
    - "SIDECAR_SCRIPT via import.meta.url cross-mode (src/ e dist/core/ → ../../../../tools/; A1)"
    - "runLangchainLoader(): throw em code!=0 (D-04 propaga), JSON.parse stdout (D-01), --pages/--password (D-11)"
    - "TDD D-14: RED (MODULE_NOT_FOUND) → GREEN (todos cenários OK) em assert-langchain-loader.ts"

key-files:
  created:
    - ankinator-app/server/src/core/langchain-loader.ts
    - ankinator-app/server/src/scripts/assert-langchain-loader.ts
  modified:
    - ankinator-app/server/src/config.ts

key-decisions:
  - "SIDECAR_SCRIPT resolvido via import.meta.url (4 níveis acima) — funciona em tsx src/ e node dist/"
  - "isLangchainAvailable() NÃO checa Java — Java ausente vira erro de runtime (D-04/Pitfall 2)"
  - "runLangchainLoader() lança throw em code!=0 (D-04) — sem fallback silencioso para o loader Node"
  - "config.ts: PdfLoaderKind type, pdfLoaderEnv const, pdfLoader/langchainPython aditivos"
  - "TDD assert-langchain-loader.ts: unit puro D-14 CLI-free (3 cenários: import, D-02, D-04)"

requirements-completed: [PDF-02]

# Metrics
duration: 5min
completed: 2026-06-03
---

# Phase 02 Plan 03: LangChain Loader (spawn + config) Summary

**`langchain-loader.ts` com `isLangchainAvailable()` (import-check D-04), `runLangchainLoader()` (spawn sem temp dir → JSON.parse → normalize, D-01), e `config.ts` expandido com `pdfLoader`/`langchainPython` (D-02/D-03)**

## Performance

- **Duration:** 5 min
- **Started:** 2026-06-03T12:01:11Z
- **Completed:** 2026-06-03T12:06:40Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Task 1: `config.ts` expandido aditivamente com `PdfLoaderKind`, `pdfLoader` (default 'node', D-03) e `langchainPython` (fallback ODL_PYTHON, D-02)
- Task 2 (TDD): `langchain-loader.ts` 108 linhas — pythonBin D-02, run byte-idêntico, isLangchainAvailable D-04, runLangchainLoader D-01/D-11 com throw D-04
- TDD RED (`assert-langchain-loader.ts` falha por MODULE_NOT_FOUND) → GREEN (3 cenários OK) executado corretamente
- Path cross-mode via `import.meta.url` (4 níveis até raiz) — funciona em `tsx src/` e `node dist/core/`

## Task Commits

Cada task foi commitada atomicamente:

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | config.ts: ANKINATOR_PDF_LOADER + ANKINATOR_LANGCHAIN_PYTHON (D-02/D-03) | e0884c1 | ankinator-app/server/src/config.ts |
| 2 RED | assert-langchain-loader.ts (RED gate D-02/D-04) | 94afff2 | ankinator-app/server/src/scripts/assert-langchain-loader.ts |
| 2 GREEN | langchain-loader.ts (spawn + isLangchainAvailable + runLangchainLoader) | 648188e | ankinator-app/server/src/core/langchain-loader.ts |

## Files Created/Modified

- `ankinator-app/server/src/core/langchain-loader.ts` — 108 linhas; exports `isLangchainAvailable` e `runLangchainLoader`; sem `node:fs`/`node:os` (D-01); `import.meta.url` cross-mode (A1)
- `ankinator-app/server/src/config.ts` — adicionados `PdfLoaderKind`, `pdfLoaderEnv`, `config.pdfLoader` (default 'node', D-03), `config.langchainPython` (D-02); campos existentes intocados
- `ankinator-app/server/src/scripts/assert-langchain-loader.ts` — unit puro D-14 CLI-free; cobre D-02 (false sem env), D-04 (throw sem env), exports (import dinâmico)

## Decisions Made

- `SIDECAR_SCRIPT = path.resolve(here, '../../../../tools/odl_langchain_loader.py')`: o arquivo `.py` está na raiz do repo em `tools/`; de `ankinator-app/server/src/core/` (dev) e de `ankinator-app/server/dist/core/` (prod), subir 4 níveis leva sempre à raiz. Documentado em comentário PT-BR no arquivo.
- `isLangchainAvailable()` só checa importabilidade do pacote Python, NÃO Java: Java ausente é Pitfall 2 da Phase 1 — vira `code != 0` em runtime quando `runLangchainLoader` chama o sidecar (D-04/R2).
- `run()` copiada byte-idêntica de `ocr-loader.ts`: evita re-implementação de `exec`/`promisify` (RESEARCH §Don't Hand-Roll); já trata `child.on('error')`.
- TDD assert-langchain-loader.ts usa importação dinâmica no Cenário 1 para que o RED gate seja MODULE_NOT_FOUND (falha determinística antes da implementação).

## Deviations from Plan

None — plano executado exatamente como especificado. Os 3 artifacts obrigatórios foram entregues com os contratos exatos.

## TDD Gate Compliance

- RED commit: `94afff2` — `test(02-03): add failing test for langchain-loader (RED gate D-02/D-04)` — exit 1 confirmado antes da implementação
- GREEN commit: `648188e` — `feat(02-03): criar langchain-loader.ts ...` — exit 0 confirmado
- REFACTOR: não necessário (código já limpo na implementação inicial)

## Known Stubs

None — todos os caminhos de código estão completos. O wiring em `document-loader.ts` é responsabilidade do Plano 04 (Wave 3), não deste plano.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| T-02-05 mitigated | ankinator-app/server/src/core/langchain-loader.ts | spawn usa argv-array `{ stdio:['ignore','pipe','pipe'] }` — sem shell, sem injeção de comando |
| T-02-06 mitigated | ankinator-app/server/src/core/langchain-loader.ts | `JSON.parse(stdout)` (não eval); stdout malformado → SyntaxError propaga (D-04) |

## Self-Check: PASSED

- `ankinator-app/server/src/core/langchain-loader.ts` — criado e commitado em 648188e
- `ankinator-app/server/src/config.ts` — modificado e commitado em e0884c1
- `ankinator-app/server/src/scripts/assert-langchain-loader.ts` — criado e commitado em 94afff2
- assert-langchain-loader.ts sai 0 (verificado)
- assert-langchain-normalize.ts sai 0 (regressão — verificado)
- nenhum novo erro de tipo em nossos módulos (verificado)

---
*Phase: 02-loader-pdf-langchain*
*Completed: 2026-06-03*
