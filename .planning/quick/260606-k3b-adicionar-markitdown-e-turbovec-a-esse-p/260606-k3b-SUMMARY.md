---
phase: quick-260606-k3b
plan: 01
subsystem: server/pdf-loaders
tags: [markitdown, turbovec, sidecar-python, loader-opt-in, scaffold, vector-search]
dependency_graph:
  requires: []
  provides:
    - markitdown loader opt-in (ANKINATOR_PDF_LOADER=markitdown)
    - turbovec scaffold fail-closed (isTurbovecAvailable / runTurbovecSmoke)
  affects:
    - document-loader.ts (chooseLoader extended)
    - config.ts (PdfLoaderKind extended)
tech_stack:
  added:
    - "markitdown[pdf]==0.1.6 (Python, pure-python, sem Java) — sidecar PDF loader"
    - "turbovec==0.7.0 (Python, Rust wheel manylinux, sem cargo) — sidecar vector search"
  patterns:
    - "Sidecar Python + venv dedicado + env var (padrão Phase 2, espelhado exatamente)"
    - "parseSidecarOutput() extraído como helper puro para testabilidade CLI-free"
    - "chooseLoader() com 3o parâmetro injetável (markitdownAvailable)"
key_files:
  created:
    - tools/markitdown_loader.py
    - tools/requirements-markitdown.txt
    - tools/turbovec_index.py
    - tools/requirements-turbovec.txt
    - ankinator-app/server/src/core/markitdown-loader.ts
    - ankinator-app/server/src/core/markitdown-loader.test.ts
    - ankinator-app/server/src/core/turbovec.ts
    - ankinator-app/server/src/core/turbovec.test.ts
  modified:
    - ankinator-app/server/src/core/document-loader.ts
    - ankinator-app/server/src/core/document-loader.test.ts
    - ankinator-app/server/src/config.ts
    - ankinator-app/.env.example
decisions:
  - "A1: markitdown é loader opt-in EXCLUSIVO (ANKINATOR_PDF_LOADER=markitdown); NUNCA auto-selecionado; default node/langchain intocado"
  - "B1: turbovec entra como scaffold provado por smoke (sidecar rodável + teste), NÃO plugado no pipeline; dedup Jaccard intocado"
  - "parseSidecarOutput() extraído como helper puro em markitdown-loader.ts e turbovec.ts para testabilidade sem spawn"
  - "Array check em parseSmokeOutput usa typeof+Array.isArray (arrays são typeof 'object' em JS — bug detectado e corrigido no ciclo de testes)"
metrics:
  duration: "~35 min"
  completed: "2026-06-06"
  tasks_completed: 3
  files_created: 8
  files_modified: 4
---

# Quick Task 260606-k3b Plan 01: markitdown + turbovec scaffold Summary

Adicionou markitdown como 3a opção de loader PDF opt-in (sem Java, sidecar Python, reusa `normalize()` com 1 doc) e turbovec como scaffold vetorial fail-closed provado por smoke — espelhando exatamente o padrão sidecar Phase 2.

## Tasks

| Task | Nome | Commit | Arquivos-chave |
|------|------|--------|----------------|
| 1 | markitdown loader opt-in | `c3526d9` | markitdown_loader.py, markitdown-loader.ts, document-loader.ts, config.ts |
| 2 | turbovec scaffold smoke | `f05ec1e` | turbovec_index.py, turbovec.ts, turbovec.test.ts |
| 3 | docs + env | `7469be3` | .env.example |

## Completed Tasks Summary

### Task 1: markitdown loader opt-in

- `tools/markitdown_loader.py`: sidecar espelhando `odl_langchain_loader.py`; API canônica `MarkItDown().convert(path).markdown`; emite 1 entrada JSON (blob único, page=1); `--pages`/`--password` aceitos como no-op (paridade de assinatura); try/except boundary stderr limpo (WR-03).
- `tools/requirements-markitdown.txt`: pin `markitdown[pdf]==0.1.6`; header com instrução de setup, venv dedicado (sem Java), nota de validação pendente.
- `ankinator-app/server/src/core/markitdown-loader.ts`: espelha `langchain-loader.ts` — `pythonBin()` (sem fallback ODL_PYTHON, venv dedicado), `run()` CR-01, `SIDECAR_SCRIPT` via `import.meta.url` (+4 níveis), `isMarkitdownAvailable()` (sem checar Java), `parseSidecarOutput()` extraído como helper puro, `runMarkitdownLoader()` com WR-04/WR-05/WR-03; reusa `normalize()` SEM alterá-la (numPages=1 — limitação documentada).
- `ankinator-app/server/src/core/markitdown-loader.test.ts`: 13 testes CLI-free — guardas CR-02 (6) + contrato `normalize(1 doc)` (7); sem spawn Python.
- `ankinator-app/server/src/config.ts`: `PdfLoaderKind = 'node' | 'langchain' | 'markitdown'`; `pdfLoader` com ternário triplo; `markitdownPython` com docstring de setup.
- `ankinator-app/server/src/core/document-loader.ts`: `LoaderChoice.loader` estendido; `chooseLoader(env, langchainAvail, markitdownAvail=false)` — 3o parâmetro com default false; branch `markitdown` opt-in exclusivo (NUNCA auto-selecionado — A1); `loadDocument` calcula `markitdownAvail` e adiciona branch antes do langchain.
- `ankinator-app/server/src/core/document-loader.test.ts`: 16 testes (11 existentes + 5 novos markitdown); 3o parâmetro injetado nos existentes.

### Task 2: turbovec scaffold PROVADO

- `tools/turbovec_index.py`: sidecar com subcomandos `smoke` (prova-de-vida: vetores fake determinísticos float32 via `rng(42)`, `TurboQuantIndex`, `add`, `search`) + `add`/`search` (interface futura JSON stdin/stdout); sem normalização manual (turbovec normaliza internamente).
- `tools/requirements-turbovec.txt`: pin `turbovec==0.7.0`; header com instrução de setup, venv dedicado, nota de pin estrito (v0.x) e validação pendente.
- `ankinator-app/server/src/core/turbovec.ts`: comentário `TODO(dedup-semântico: fase futura)` no topo; `pythonBin()` (ANKINATOR_TURBOVEC_PYTHON), `run()` CR-01, `SIDECAR_SCRIPT` +4 níveis; `isTurbovecAvailable()` fail-closed (try/catch, nunca lança); `parseSmokeOutput()` helper puro com guarda `Array.isArray`; `runTurbovecSmoke()`; NÃO referencia deck-organizer/existing-deck.
- `ankinator-app/server/src/core/turbovec.test.ts`: 10 testes CLI-free — happy path (2) + erros de contrato (7) + contexto de stderr (1); detecta drift de API turbovec v0.x.

### Task 3: docs + env (apenas arquivos de projeto)

- `ankinator-app/.env.example`: 2 novos blocos — markitdown (ANKINATOR_MARKITDOWN_PYTHON + linha comentada ANKINATOR_PDF_LOADER=markitdown + nota de validação pendente + PyPI link) e turbovec (ANKINATOR_TURBOVEC_PYTHON + nota de validação pendente + PyPI link + dedup futuro).
- ROADMAP.md e STATE.md: NÃO modificados (desvio deliberado per constraints — o orquestrador cuida desses no passo final).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Array check em parseSmokeOutput incorreta no teste**
- **Found during:** Task 2 — 1 teste falhou: `stdout é array → lança erro`
- **Issue:** Arrays em JavaScript são `typeof 'object'`, então o check `typeof parsed !== 'object' || parsed === null` não rejeitava arrays. O erro jogado era `{ok: true}` check, não o "esperado objeto JSON".
- **Fix:** Adicionou `|| Array.isArray(parsed)` no guard em `turbovec.ts`; mensagem agora diz 'array' explicitamente.
- **Files modified:** `ankinator-app/server/src/core/turbovec.ts`
- **Commit:** incluído em `f05ec1e`

### Deliberate Scope Deviations (per constraints)

**1. Task 3: ROADMAP.md e STATE.md NÃO modificados**
- **Reason:** Constraints explícitas: "NÃO edite .planning/ROADMAP.md nem .planning/STATE.md — o orquestrador cuida desses (item de fase futura + STATE) no passo final."
- **Scope:** Apenas `.env.example` foi modificado; os requirements já incluem headers completos de setup/validação criados nas Tasks 1/2.

## Verify Results

### Task 1
```
tsc: TypeScript: No errors found
vitest markitdown+document-loader: PASS (29) FAIL (0)
guard-default-loader --assert: --assert: guard default CLI-free OK; ConvertOptions byte-idêntico.
grep markitdown[pdf]==0.1.6: FOUND
grep from markitdown import MarkItDown: FOUND
python3 -m py_compile markitdown_loader.py: OK
```

### Task 2
```
vitest turbovec: PASS (10) FAIL (0)
grep turbovec==0.7.0: FOUND
grep TODO(dedup-semântico: FOUND
grep from turbovec import TurboQuantIndex: FOUND
python3 -m py_compile turbovec_index.py: OK
! grep deck-organizer|existing-deck turbovec.ts: DEDUP INTOCADO OK
```

### Task 3
```
grep ANKINATOR_MARKITDOWN_PYTHON .env.example: FOUND
grep ANKINATOR_TURBOVEC_PYTHON .env.example: FOUND
grep ANKINATOR_PDF_LOADER=markitdown .env.example: FOUND
```

### Regressao zero (suites pre-existentes)
```
deck-organizer.test.ts: PASS (12) FAIL (0)
existing-deck.test.ts: PASS (14) FAIL (0)
exporters-embed.test.ts: PASS (55) FAIL (0)
document-loader.test.ts: PASS (16) FAIL (0)  ← inclui 5 casos markitdown novos
```

## Known Stubs

Nenhum. markitdown e turbovec são scaffolds INTENCIONAIS e explicitamente declarados como "validação ao vivo PENDENTE" — não são stubs que impedem o objetivo do plano.

## Threat Flags

Nenhum novo. As superfícies markitdown e turbovec estão cobertas pelo threat model T-k3b-01..T-k3b-SC do PLAN.

## Self-Check: PASSED

Arquivos criados verificados:
- `tools/markitdown_loader.py` — existe
- `tools/turbovec_index.py` — existe
- `tools/requirements-markitdown.txt` — existe (contém `markitdown[pdf]==0.1.6`)
- `tools/requirements-turbovec.txt` — existe (contém `turbovec==0.7.0`)
- `ankinator-app/server/src/core/markitdown-loader.ts` — existe
- `ankinator-app/server/src/core/markitdown-loader.test.ts` — existe
- `ankinator-app/server/src/core/turbovec.ts` — existe
- `ankinator-app/server/src/core/turbovec.test.ts` — existe

Commits verificados:
- `c3526d9` — Task 1 (markitdown loader opt-in)
- `f05ec1e` — Task 2 (turbovec scaffold)
- `7469be3` — Task 3 (docs + env)
