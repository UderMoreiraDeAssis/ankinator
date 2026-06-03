---
phase: 02-loader-pdf-langchain
plan: "01"
subsystem: pdf-processing
tags: [langchain, normalize, pdf, typescript, sections, headings]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: "odl-parse.ts com cleanMarkdown, types.ts com LoadedDocument/Section/DocElement"
provides:
  - "normalize(docs, pdfPath): LoadedDocument — função pura PDF-03 (D-07..D-10)"
  - "cleanMarkdown exportada de odl-parse.ts (D-09)"
  - "assert-langchain-normalize.ts — unit puro CLI-free cobrindo R1/Pitfall1/Pitfall4 (D-14)"
affects: [02-02-loader, 02-03-branch, 02-04-guard, wave-2, wave-3]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "buildSectionsFromMarkdown: iteração sobre Documents emitidos (não range 1..N) — R1"
    - "numPages = Math.max(...pages) SEM +1 — Pitfall 1 (page é 1-indexed)"
    - "title = 1º match ATX | null — Pitfall 4 (nunca a primeira linha de texto)"
    - "unit puro CLI-free com fail()/process.exit(1) — padrão D-14 herdado de smoke-runner.ts"

key-files:
  created:
    - ankinator-app/server/src/core/langchain-normalize.ts
    - ankinator-app/server/src/scripts/assert-langchain-normalize.ts
  modified:
    - ankinator-app/server/src/core/odl-parse.ts

key-decisions:
  - "normalize() é função PURA (sem I/O): não importa fs/child_process; testável CLI-free sempre"
  - "buildSectionsFromMarkdown itera sobre Documents emitidos (não range 1..N) — R1"
  - "export cleanMarkdown adicionado cirurgicamente (D-09); corpo da função intocado"
  - "unit puro cobre 2 cenários: R1/Pitfall1 (pages não-contíguas) + Pitfall4 (title=null)"

patterns-established:
  - "D-14 unit puro: fixture inline RawDoc[], fail()/process.exit(1), CLI-free < 2s"
  - "numPages sempre via Math.max(...pages) sem +1 para pacotes com page 1-indexed"

requirements-completed: [PDF-03]

# Metrics
duration: 4min
completed: 2026-06-03
---

# Phase 02 Plan 01: Normalize LangChain Documents Summary

**Função pura `normalize(RawDoc[], pdfPath) → LoadedDocument` com seções via ATX, numPages=max(page), title=1º heading|null, mais unit puro CLI-free cobrindo R1/Pitfall1/Pitfall4**

## Performance

- **Duration:** 4 min
- **Started:** 2026-06-03T11:52:38Z
- **Completed:** 2026-06-03T11:57:37Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments
- Exportação cirúrgica de `cleanMarkdown` em `odl-parse.ts` (D-09) sem tocar nenhuma outra linha
- Criação de `langchain-normalize.ts` com `normalize()` PURO: sem I/O, sem Python/Java, tipos corretos
- Unit puro CLI-free `assert-langchain-normalize.ts` verde em < 2s, cobre R1/Pitfall 1/Pitfall 4

## Task Commits

Cada task foi commitada atomicamente:

1. **Task 1: Exportar cleanMarkdown de odl-parse.ts** - `dc073a0` (feat)
2. **Task 2: Criar langchain-normalize.ts (normalize puro, D-07..D-10)** - `ed26703` (feat)
3. **Task 3: Criar assert-langchain-normalize.ts (unit puro CLI-free, D-14)** - `e3b0710` (feat)

## Files Created/Modified
- `ankinator-app/server/src/core/langchain-normalize.ts` - função `normalize()` PURA; interface `RawDoc`; `buildSectionsFromMarkdown` com flush/pageEnd/filtro de seção vazia
- `ankinator-app/server/src/core/odl-parse.ts` - keyword `export` adicionada a `cleanMarkdown` (D-09); resto intocado
- `ankinator-app/server/src/scripts/assert-langchain-normalize.ts` - unit puro D-14: fixture 2 cenários, fail()/process.exit(1)

## Decisions Made
- `buildSectionsFromMarkdown` novo em vez de adaptar `buildSections` existente: a função atual recebe `DocElement[]` com `headingLevel` numérico explícito; a nova recebe markdown bruto por Document com page tracking — adaptar diretamente degradaria a clareza. Filtro de seção vazia idêntico ao original (linhas 136-138 de odl-parse.ts).
- `cleanMarkdown` exportada em vez de duplicada: é idempotente, sem estado, e D-09 recomenda explicitamente o reuso. Mudança cirúrgica (1 linha).

## Deviations from Plan

None — plano executado exatamente como escrito. Os 3 artifacts obrigatórios foram entregues com os contratos exatos especificados.

## Issues Encountered
- `tsc --noEmit` via `npx` no worktree falhava porque `node_modules` não está no caminho do worktree (está em `/ankinator-app/node_modules/` do repo principal). Solução: invocar `tsc` diretamente via caminho absoluto com NODE_PATH. Erros retornados foram TODOS pré-existentes nos arquivos `api.ts`/`document-loader.ts`/`prompts.ts`/`api-provider.ts`/`index.ts` (dependências externas ausentes no worktree); nenhum erro novo em `langchain-normalize.ts` ou `odl-parse.ts`.

## User Setup Required
None — nenhuma configuração externa necessária neste plano (função pura, sem Python/Java).

## Next Phase Readiness
- `normalize()` pronto para consumo pelos planos de Wave 2 (loader) e Wave 3 (branch)
- `cleanMarkdown` exportado para reuso imediato
- Unit D-14 verde e determinístico — gate per-task commit dos planos seguintes
- Wave 2 pode prosseguir: `langchain-loader.ts` (spawn + isLangchainAvailable()) consome `normalize()`

## Self-Check: PASSED
- `ankinator-app/server/src/core/langchain-normalize.ts` — criado e commitado em ed26703
- `ankinator-app/server/src/core/odl-parse.ts` — modificado e commitado em dc073a0
- `ankinator-app/server/src/scripts/assert-langchain-normalize.ts` — criado e commitado em e3b0710
- assert-langchain-normalize.ts sai 0 (verificado)
- nenhum novo erro de tipo em nossos módulos (verificado)

---
*Phase: 02-loader-pdf-langchain*
*Completed: 2026-06-03*
