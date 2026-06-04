---
phase: 04-mnem-nicos-imagem-svg
plan: "01"
subsystem: server/specialists
tags: [svg, security, sanitization, dompurify, prompts, tdd]
dependency_graph:
  requires: []
  provides:
    - sanitize-svg.ts (sanitizarSvg function — allowlist geométrica estrita via ALLOWED_TAGS/ALLOWED_ATTR)
    - mnemonic.md (JSON batch output format for parser in Plan 02)
    - mnemonic-image.md (Anki 25.02.x safe SVG rules)
  affects:
    - ankinator-app/server (nova dependência isomorphic-dompurify)
    - Phase 04 Plan 02 (parser de mnemônicos requer mnemonic.md com JSON batch)
tech_stack:
  added:
    - isomorphic-dompurify@3.15.0 (ESM-native DOMPurify wrapper for Node, encapsulates jsdom 29)
  patterns:
    - DOMPurify strict geometric allowlist (ALLOWED_TAGS + ALLOWED_ATTR only, no USE_PROFILES)
    - fail-closed pattern (return null if result does not start with <svg)
    - TDD RED→GREEN→REFACTOR cycle
key_files:
  created:
    - ankinator-app/server/src/core/specialists/sanitize-svg.ts
    - ankinator-app/server/src/core/specialists/sanitize-svg.test.ts
  modified:
    - ankinator-app/server/package.json (added isomorphic-dompurify dependency)
    - ankinator-app/package-lock.json
    - ankinator-app/server/src/core/specialists/prompts/mnemonic.md
    - ankinator-app/server/src/core/specialists/prompts/mnemonic-image.md
decisions:
  - "sanitizarSvg returns null (fail-closed) for any output not starting with <svg — D-08"
  - "ALLOWED_TAGS geometric-only: svg/g/defs/path/rect/circle/ellipse/line/polyline/polygon/text/tspan/linearGradient/radialGradient/stop — D-07"
  - "style attribute intentionally excluded from ALLOWED_ATTR — F-09 depends on this"
  - "mnemonic.md ## Saída rewritten to JSON batch format as prerequisite for Plan 02 parser"
  - "mnemonic-image.md no id/version on <svg> root — Anki 25.02.x strips those (A1)"
metrics:
  duration: "~8 min"
  completed: "2026-06-04"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 6
---

# Phase 04 Plan 01: Sanitização SVG + Refinamento de Prompts — Summary

**One-liner:** Sanitização SVG server-side com allowlist geométrica DOMPurify (F-01..F-12 determinísticos), + prompts mnemonic.md (JSON batch) e mnemonic-image.md (regras Anki 25.02.x).

## What Was Built

### Task 1: Package gate (pre-approved)

`isomorphic-dompurify@3.15.0` verificado e aprovado pelo usuário antes da instalação:
- mantenedor kkomelin, repo github.com/kkomelin/isomorphic-dompurify
- sem script postinstall
- deps transitivas dompurify (cure53) e jsdom (jsdom/jsdom) legitimadas

### Task 2: sanitize-svg.ts + 13 testes adversariais (TDD)

**RED phase:** `sanitize-svg.test.ts` criado com 13 fixtures F-01..F-12 (F-11 tem 2 sub-testes). Confirma falha por `Cannot find module './sanitize-svg.js'`.

**GREEN phase:** `sanitize-svg.ts` implementado com:
- `SVG_TAGS` allowlist geométrica estrita (D-07): svg, g, defs, path, rect, circle, ellipse, line, polyline, polygon, text, tspan, linearGradient, radialGradient, stop
- `SVG_ATTRS` subset seguro: 'style' ausente (F-09), 'id' permitido para referência interna de gradiente
- `sanitizarSvg(svgRaw): string | null` com fail-closed D-08: `if (!trimmed.startsWith('<svg')) return null`
- `try { ... } catch { return null; }` cobrindo exceções internas do DOMPurify
- Import: `import DOMPurify from 'isomorphic-dompurify'` (sem extensão — exports map; Pitfall 7)
- 13/13 testes passando; build TypeScript limpo

### Task 3: Refinamento dos prompts

**mnemonic.md:** Seção `## Saída` substituída por instrução JSON batch:
```
{"mnemonicos":[{"id":"<id-do-card>","mnemonico":"<texto>","tecnica":"<acrônimo|história|loci|rima>"}]}
```
Cards conceituais omitidos da lista (D-01). Seções `## Quando NÃO gerar` e `## Técnicas` preservadas.

**mnemonic-image.md:** Seção `## Saída` ampliada com 3 regras:
1. Sem texto/cercas antes/depois do SVG
2. Sem atributos `id` ou `version` no `<svg>` raiz (Anki 25.02.x — A1)
3. O SVG deve começar com `<svg` e terminar com `</svg>`
Seção `## Restrições de segurança` preservada.

## Verification Results

```
cd ankinator-app/server && npm test -- sanitize-svg
→ 13 passed (F-01..F-12)

npm test (full suite)
→ 70 passed (4 test files)

npm run build
→ tsc verde (sem erros)

grep -L USE_PROFILES sanitize-svg.ts
→ retorna o arquivo (USE_PROFILES ausente do código)

grep -c 'mnemonicos' mnemonic.md
→ 1 (critério satisfeito)

pattern (sem|não)[^.]*\b(id|version)\b em mnemonic-image.md
→ 2 matches ("Não use os atributos id ou version", "sem id e sem version")
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] npm workspace flag falhou no root sem workspaces config**

- **Found during:** Task 2 (npm install)
- **Issue:** `npm install isomorphic-dompurify --workspace @ankinator/server` retornou `No workspaces found` — o root `package.json` não tem campo `workspaces`.
- **Fix:** Instalou diretamente com `cd ankinator-app/server && npm install isomorphic-dompurify`. Lock file em `ankinator-app/package-lock.json` (hoisted).
- **Files modified:** `ankinator-app/server/package.json`, `ankinator-app/package-lock.json`
- **Commit:** 1014b86

**2. [Rule 1 - Bug] Comentários em sanitize-svg.ts continham "USE_PROFILES"**

- **Found during:** Task 2 acceptance criteria check
- **Issue:** Documentação anti-padrão nos comentários incluía a string "USE_PROFILES" — `grep -L USE_PROFILES` não retornava o arquivo (critério de aceitação).
- **Fix:** Substituiu referências aos comentários de anti-padrão por descrições equivalentes sem a string exata.
- **Files modified:** `sanitize-svg.ts`
- **Commit:** parte do 1014b86

## Security Notes

Todos os 6 threats do STRIDE register mitigados neste plano:

| Threat | Status |
|--------|--------|
| T-04-01: XSS via script/on*/javascript: | Mitigado — F-01/F-02/F-03/F-04 |
| T-04-02: use xlink:href / foreignObject / animate | Mitigado — F-05/F-06/F-08 |
| T-04-03: image href externo / CSS url() | Mitigado — F-07/F-09 |
| T-04-04: gate fail-closed | Mitigado — F-11 |
| T-04-05: prompt injection SVG | Mitigado (profundidade — sanitização remove markup perigoso) |
| T-04-SC: supply-chain npm | Mitigado — aprovação humana explícita (pre_resolved_checkpoint) |

## Commits

| Hash | Task | Description |
|------|------|-------------|
| 967fc2b | Task 2 RED | test(04-01): add failing tests for sanitizarSvg F-01..F-12 adversarial fixtures |
| 1014b86 | Task 2 GREEN | feat(04-01): install isomorphic-dompurify + sanitize-svg.ts with strict geometric allowlist |
| a5c2ed0 | Task 3 | feat(04-01): refine mnemonic.md (JSON batch output) and mnemonic-image.md (Anki 25.02.x rules) |

## Known Stubs

None — all functionality is complete and wired. sanitizarSvg is ready to be called from enrichAll (Plan 02). mnemonic.md and mnemonic-image.md are production-ready prompts.

## Self-Check: PASSED

All files verified:
- FOUND: sanitize-svg.ts
- FOUND: sanitize-svg.test.ts
- FOUND: mnemonic.md (updated)
- FOUND: mnemonic-image.md (updated)
- FOUND: 04-01-SUMMARY.md
- FOUND commit: 967fc2b (test RED)
- FOUND commit: 1014b86 (feat GREEN)
- FOUND commit: a5c2ed0 (feat prompts)
