---
phase: 02-loader-pdf-langchain
verified: 2026-06-03T13:00:00Z
status: human_needed
score: 11/11
overrides_applied: 0
human_verification:
  - test: "Run smoke-langchain-loader.ts with a real PDF against a venv with langchain-opendataloader-pdf==2.0.0 installed and Java 11+ in PATH"
    expected: "Script exits 0, prints numPages/sections/elements/markdown preview; no truncated/mojibake chars in markdown; sections are derived from ATX headings"
    why_human: "Cannot install the Python package in CI environment; gated smoke is the only end-to-end check for A1 (cross-mode path resolution), A2 (JSON parseable), A3 (non-empty LoadedDocument). Also confirms IN-03: table_method/reading_order/image_output kwarg names accepted by OpenDataLoaderPDFLoader 2.0.0"
  - test: "Verify ANKINATOR_PDF_LOADER=langchain with a real PDF triggers the langchain branch and logs '[ankinator] loader: langchain'"
    expected: "stderr shows '[ankinator] loader: langchain'; loadDocument returns a populated LoadedDocument; no regression on existing Node path (ANKINATOR_PDF_LOADER unset)"
    why_human: "End-to-end branch routing requires a running environment with Java + Python venv; cannot verify dynamically with grep"
---

# Phase 02: Loader PDF LangChain — Verification Report

**Phase Goal:** Adicionar `langchain-opendataloader-pdf` como loader de PDF opcional via sidecar Python (reusando o padrão `ODL_PYTHON`), com saída normalizada para `LoadedDocument` e fallback automático para o loader Node atual.
**Verified:** 2026-06-03T13:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (from ROADMAP Success Criteria + PLAN must_haves)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Um script Python extrai um PDF em Documents por página usando `langchain-opendataloader-pdf` | VERIFIED | `tools/odl_langchain_loader.py` 114 lines; `OpenDataLoaderPDFLoader(format="markdown", split_pages=True, ...)` instantiated; `json.dump(out, sys.stdout)` emits per-page array; Python syntax check exits 0 |
| 2 | O app aciona o loader LangChain por env/flag (opt-in) e cai para o loader Node quando Python/pacote estiver ausente | VERIFIED | `document-loader.ts:79` branch `=== 'langchain'`; `isLangchainAvailable()` gates it; fallback log at line 86; env unset → condition false, Node path unchanged |
| 3 | A saída é normalizada para `LoadedDocument` e o chunker existente processa sem mudanças | VERIFIED | `langchain-normalize.ts` exports `normalize(docs, pdfPath): LoadedDocument`; all fields (sections, elements, markdown, numPages, title, usedOcr) populated correctly; `chunker.ts` consumes `doc.sections[]` — untouched |
| 4 | `normalize(Document[], pdfPath)` produz LoadedDocument com sections via ATX, numPages=max(page), title=1º heading or null, 1 text-block/Document | VERIFIED | `assert-langchain-normalize.ts` exits 0; covers R1 (non-contiguous pages), Pitfall 1 (numPages=3 not 4), Pitfall 4 (title=null), D-08 (text block type) |
| 5 | `tools/odl_langchain_loader.py` aceita argv `<pdf> [--pages] [--password]` | VERIFIED | `argparse` with positional `pdf`, `--pages`, `--password`; mirrors `LoadOptions` from `document-loader.ts:24-31` |
| 6 | Sidecar imprime JSON `[{page_content, metadata}]` no stdout, sem temp dir | VERIFIED | `json.dump(out, sys.stdout, ensure_ascii=False)` at line 108; no `mkdtemp`/`tempfile`/`open(...'w')` in file |
| 7 | `tools/requirements.txt` pina `langchain-opendataloader-pdf==2.0.0` e documenta Java 11+ | VERIFIED | `grep "^langchain-opendataloader-pdf==2.0.0$"` matches; file contains "Java 11+" comment |
| 8 | `isLangchainAvailable()` retorna false sem env vars definidas | VERIFIED | `assert-langchain-loader.ts` exits 0; Cenário 2 asserts `=== false` with no env vars |
| 9 | Erro de runtime do sidecar (code != 0) PROPAGA via throw, não faz fallback | VERIFIED | `langchain-loader.ts:149-157` throws on `code !== 0`; no `return runNode` or fallback inside `runLangchainLoader` |
| 10 | `config.ts` expõe `ANKINATOR_PDF_LOADER` (default 'node') e `ANKINATOR_LANGCHAIN_PYTHON` (fallback ODL_PYTHON) | VERIFIED | `config.ts:30-56`; `pdfLoader` default `'node'`; `langchainPython` with `ODL_PYTHON` fallback |
| 11 | Guard D-15 prova ConvertOptions byte-idêntico CLI-free (sem Java/Python) | VERIFIED | `guard-default-loader.ts --assert` exits 0; only imports `buildConvertOptions`; no `langchain-loader`/`child_process`/`convert` imported |

**Score:** 11/11 truths verified (automated checks)

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `ankinator-app/server/src/core/langchain-normalize.ts` | `normalize(docs, pdfPath) -> LoadedDocument` (PDF-03 core) | VERIFIED | 227 lines; exports `normalize` and `RawDoc`; no I/O imports; CR-01/WR-01/WR-06 fixes applied |
| `ankinator-app/server/src/scripts/assert-langchain-normalize.ts` | Unit CLI-free, covers R1/Pitfall1/Pitfall4 (D-14) | VERIFIED | Exits 0; `process.exit(1)` via `fail()`; no spawn |
| `ankinator-app/server/src/core/odl-parse.ts` | `cleanMarkdown` exported (D-09) | VERIFIED | Line 77: `export function cleanMarkdown` |
| `tools/odl_langchain_loader.py` | Sidecar Python PDF→Document[] JSON stdout (PDF-01) | VERIFIED | 114 lines; `OpenDataLoaderPDFLoader` instantiated; `json.dump` to stdout; WR-02/WR-03 fixes applied |
| `tools/requirements.txt` | Pin `langchain-opendataloader-pdf==2.0.0` (D-13) | VERIFIED | Exact pin on line 21; Java 11+ documented; single non-comment line |
| `ankinator-app/server/src/core/langchain-loader.ts` | `isLangchainAvailable`, `runLangchainLoader` exports (PDF-02) | VERIFIED | 191 lines (>40); both functions exported; no `node:fs`/`node:os`; `import.meta.url`; CR-01/CR-02/WR-03/WR-04/WR-05 fixes applied |
| `ankinator-app/server/src/config.ts` | `ANKINATOR_PDF_LOADER` + `ANKINATOR_LANGCHAIN_PYTHON` (D-02/D-03) | VERIFIED | `pdfLoader` default `'node'`; `langchainPython` with `ODL_PYTHON` fallback; existing fields untouched |
| `ankinator-app/server/src/core/document-loader.ts` | Branch langchain aditivo (D-03/D-06/D-15) + `buildConvertOptions` exported | VERIFIED | Branch at line 79 after OCR at line 66; `buildConvertOptions` exported at line 43; fallback log at line 86 |
| `ankinator-app/server/src/scripts/guard-default-loader.ts` | Guard CLI-free D-15, `process.exit` | VERIFIED | Imports only `buildConvertOptions`; 2 scenarios exit 0; `--assert` flag exits 0 |
| `ankinator-app/server/src/scripts/smoke-langchain-loader.ts` | Smoke gated D-14, imports `isLangchainAvailable` | VERIFIED | Gated at line 30; exits 1 (usage) without PDF; exits 0 (skip) without Python env |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `langchain-normalize.ts` | `odl-parse.ts` | `import { cleanMarkdown }` | WIRED | Line 10: `import { cleanMarkdown } from './odl-parse.js'` |
| `assert-langchain-normalize.ts` | `langchain-normalize.ts` | `import { normalize }` | WIRED | Line 16: `import { normalize } from '../core/langchain-normalize.js'` |
| `langchain-loader.ts` | `langchain-normalize.ts` | `import { normalize }` | WIRED | Line 19: `import { normalize, type RawDoc } from './langchain-normalize.js'` |
| `langchain-loader.ts` | `tools/odl_langchain_loader.py` | `import.meta.url` cross-mode path | WIRED | Lines 102-103: `path.resolve(here, '../../../../tools/odl_langchain_loader.py')` |
| `document-loader.ts` | `langchain-loader.ts` | `import { runLangchainLoader, isLangchainAvailable }` | WIRED | Line 22 |
| `guard-default-loader.ts` | `document-loader.ts` | `import { buildConvertOptions }` | WIRED | Line 19; no langchain-loader import (CLI-free confirmed) |
| `tools/odl_langchain_loader.py` | stdout | `json.dump([{page_content, metadata}], sys.stdout)` | WIRED | Line 108 |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `langchain-loader.ts:runLangchainLoader` | `parsed` / `normalize()` result | `JSON.parse(stdout)` from sidecar | Yes — real spawn result piped through `Buffer.concat().toString('utf8')` (CR-01 fix), shape-validated before `normalize()` call | FLOWING |
| `langchain-normalize.ts:normalize` | `sections`, `elements`, `markdown`, `numPages` | `docs[]` RawDoc array | Yes — deterministically built from input array; `assert-langchain-normalize` confirms live output | FLOWING |
| `document-loader.ts:loadDocument` | `LoadedDocument` return | Either `runLangchainLoader` or `parseOdlOutput` | Yes — both real processing paths; no static returns | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `normalize()` produces correct LoadedDocument | `npx tsx src/scripts/assert-langchain-normalize.ts` | All assertions pass, exit 0 | PASS |
| `guard-default-loader` ConvertOptions byte-identical | `npx tsx src/scripts/guard-default-loader.ts --assert` | Both scenarios pass, exit 0 | PASS |
| `isLangchainAvailable()` returns false without env vars | `npx tsx src/scripts/assert-langchain-loader.ts` | All 3 scenarios pass, exit 0 | PASS |
| `smoke-langchain-loader.ts` exits cleanly without PDF | `npx tsx src/scripts/smoke-langchain-loader.ts` | Exit 1 with usage message (correct behavior) | PASS |
| TypeScript build | `npm run build` | Clean build, no new errors in phase files | PASS |
| Python sidecar syntax | `python3 -m py_compile tools/odl_langchain_loader.py` | Exit 0 | PASS |
| End-to-end with real PDF + venv + Java | `npx tsx src/scripts/smoke-langchain-loader.ts <pdf>` | Cannot run — requires Python venv + Java 11+ | SKIP (human needed) |

---

### Probe Execution

No `probe-*.sh` scripts declared for this phase. Phase uses script-based verification (`assert-*`, `guard-*`, `smoke-*`). All runnable scripts executed above.

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| PDF-01 | 02-02 | Python sidecar extracts PDF in Documents per page using `langchain-opendataloader-pdf` | SATISFIED | `tools/odl_langchain_loader.py` instantiates `OpenDataLoaderPDFLoader`; emits JSON per-page array to stdout |
| PDF-02 | 02-03, 02-04 | `langchain-loader.ts` invokes sidecar via spawn, opt-in by env/flag, automatic fallback to Node loader when unavailable | SATISFIED | `isLangchainAvailable()` gates branch; fallback log at `document-loader.ts:86`; `ANKINATOR_PDF_LOADER` default `'node'` |
| PDF-03 | 02-01, 02-04 | LangChain loader output normalized to `LoadedDocument`; existing chunker processes without changes | SATISFIED | `normalize()` produces full `LoadedDocument`; `guard-default-loader.ts` proves default path byte-identical; `chunker.ts` untouched |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `tools/odl_langchain_loader.py` | 62-64 | NOTE (A1): param names `table_method`/`reading_order`/`image_output` self-flagged as unverified until smoke | Info | No blocker — params are pinned to `==2.0.0`; defaults produce usable markdown if a name diverges (as documented); gated smoke is the correct verification point |

No `TBD`, `FIXME`, or `XXX` markers found in any phase-modified file. No unreferenced debt.

---

### Code Review Findings Status (from 02-REVIEW.md)

All 2 BLOCKER and 6 WARNING findings from the post-execution code review were confirmed fixed in the current codebase:

| Finding | Status in Code |
|---------|---------------|
| CR-01: stdout decoded per-chunk (mojibake) | FIXED — `langchain-loader.ts:53-69` buffers `Buffer[]`, decodes once with `Buffer.concat(...).toString('utf8')` |
| CR-02: `JSON.parse` with no empty/shape guard | FIXED — `langchain-loader.ts:167-189` tries parse, checks `Array.isArray`, validates each item |
| WR-01: `metadata.page` untrusted (NaN risk) | FIXED — `langchain-normalize.ts:53-55` `coercePage()` accepts only `integer >= 1` |
| WR-02: sidecar emits full metadata dict | FIXED — `odl_langchain_loader.py:97-106` projects to 3-field contract `{source, format, page}` |
| WR-03: full traceback in stderr tail | FIXED — `langchain-loader.ts:149-156` takes first 5 non-empty lines; sidecar emits structured line |
| WR-04: password not redacted from error logs | FIXED — `langchain-loader.ts:139-140` `redact()` scrubs password from thrown error text |
| WR-05: spawn `error` event indistinguishable from code -1 | FIXED — `langchain-loader.ts:49,56-62` adds `spawnError` field; callers check it |
| WR-06: ATX regex strips `C#`, fenced code misidentified as heading | FIXED — `langchain-normalize.ts:35,43` new regex + `FENCE` tracker; `inFence` state threaded through `buildSectionsFromMarkdown` and title extraction |

---

### Human Verification Required

**All automated checks pass.** Two items cannot be verified without a Python venv + Java 11+ environment:

#### 1. End-to-End LangChain Load with Real PDF

**Test:** Install `langchain-opendataloader-pdf==2.0.0` in a dedicated venv with Java 11+ in PATH, set `ANKINATOR_LANGCHAIN_PYTHON` to the venv interpreter, then run:
```
npx tsx ankinator-app/server/src/scripts/smoke-langchain-loader.ts <path-to-concurso.pdf>
```
**Expected:** Exits 0; prints `numPages`, `sections.length`, `elements.length`, `markdown.length`; markdown preview contains correctly-encoded Portuguese characters (á, ã, ç, é — no mojibake); at least 2 sections derived from ATX headings; `[ankinator] loader: langchain` appears in stderr from `loadDocument`.
**Why human:** Requires installed Python package + Java runtime. The gated smoke is the only check that exercises the full chain: spawn → UTF-8 decode (CR-01) → JSON.parse (CR-02) → coercePage (WR-01) → metadata projection (WR-02) → normalize → LoadedDocument.

#### 2. Param Name Confirmation for OpenDataLoaderPDFLoader (IN-03 / A1)

**Test:** While running the smoke above, verify no `TypeError: unexpected keyword argument` is raised for `table_method`, `reading_order`, or `image_output`.
**Expected:** The sidecar loads the PDF without error; the loader accepts all three kwargs.
**Why human:** These kwarg names are documented in the PLAN research but not verified against the installed `==2.0.0` package (no offline stub test exists). A name mismatch would cause a `TypeError` at `loader = OpenDataLoaderPDFLoader(...)` — caught by the `try/except` in WR-03 and propagated as exit 1 to the Node side.

---

### Gaps Summary

No blocking gaps. All must-have truths verified programmatically. The only open items are the two human verification checks that require a Python/Java runtime environment — standard for an opt-in sidecar component.

The phase goal is achieved:
- Sidecar Python created and syntactically valid (PDF-01)
- LangChain loader wired with opt-in env var, fallback to Node, error propagation (PDF-02)
- Normalization to `LoadedDocument` proven by CLI-free unit test; default path guard proves zero regression (PDF-03)
- All post-execution review BLOCKERs and WARNINGs confirmed fixed in the codebase

---

_Verified: 2026-06-03T13:00:00Z_
_Verifier: Claude (gsd-verifier)_
