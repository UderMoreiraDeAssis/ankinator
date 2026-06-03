# Phase 02: Loader PDF LangChain - Pattern Map

**Mapped:** 2026-06-03
**Files analyzed:** 8 (5 new, 2 modified, 1 reuse-source touched via export)
**Analogs found:** 8 / 8 (every new/modified file has a proven in-repo analog)

> All source paths below are relative to repo root `/home/t316360/plottwist/ankinator/`.
> New sidecar artifacts live under `tools/` (outside `src` — not compiled by `tsc`, read by path at runtime).
> All other new/modified files live under `ankinator-app/server/src/`.
> Comments PT-BR (CLAUDE.md). ESM `NodeNext`: imports carry `.js` extension.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `tools/odl_langchain_loader.py` (NEW) | sidecar / CLI script | transform (PDF→JSON stdout) | `ankinator-app/server/src/core/ocr-loader.ts` (`runOcrLoader` CLI contract) + RESEARCH §Code Examples | role-match (Python; no `.py` exists yet — CLI contract from ocr path) |
| `tools/requirements.txt` (NEW) | config (dep pin) | — | RESEARCH §Standard Stack "Installation" block (D-13) | research-only (no existing requirements.txt) |
| `ankinator-app/server/src/core/langchain-loader.ts` (NEW) | service / loader | request-response (spawn→parse) | `ankinator-app/server/src/core/ocr-loader.ts` | exact (spawn + `run()` + `isOcrAvailable()` clone) |
| `ankinator-app/server/src/core/langchain-normalize.ts` (NEW, name at discretion) | utility (pure transform) | transform (`Document[]`→`LoadedDocument`) | `ankinator-app/server/src/core/odl-parse.ts` (`buildSections`, `cleanMarkdown`, `elementToMarkdown`) | role-match (adapt: input is raw markdown, not `DocElement[]`) |
| `ankinator-app/server/src/core/document-loader.ts` (MODIFY) | service / loader | request-response | `loadDocument()` + existing OCR branch (same file) | exact (extend existing branch structure) |
| `ankinator-app/server/src/config.ts` (MODIFY) | config | — | `ANKINATOR_PROVIDER` env read (same file) | exact |
| `ankinator-app/server/src/scripts/smoke-langchain-loader.ts` (NEW) | test (smoke, gated) | request-response | `ankinator-app/server/src/scripts/smoke-loader.ts` | exact (clone harness) |
| `ankinator-app/server/src/scripts/<assert-normalize>.ts` + `<guard-default>.ts` (NEW, names at discretion) | test (CLI-free unit + guard) | transform / assertion | `ankinator-app/server/src/scripts/smoke-runner.ts` (`--assert-args` PASSO 2 + `fail()`/`process.exit(1)`) | exact (assertion discipline) |

---

## Pattern Assignments

### `ankinator-app/server/src/core/langchain-loader.ts` (service/loader, request-response)

**Analog:** `ankinator-app/server/src/core/ocr-loader.ts` (read in full — 77 lines)

**Imports pattern** (ocr-loader.ts lines 12–17) — copy structure; this loader does NOT need `fs`/`os` temp-dir (D-01 = stdout, no temp dir):
```typescript
import { spawn } from 'node:child_process';
import type { LoadedDocument } from './types.js';
import type { LoadOptions } from './document-loader.js';
```

**`pythonBin()` — adapt for D-02** (ocr-loader.ts lines 19–21 read `ODL_PYTHON` only). New loader uses the dedicated var with `ODL_PYTHON` fallback:
```typescript
function pythonBin(): string | null {
  // D-02: var dedicada com fallback p/ ODL_PYTHON (venv langchain isolado).
  return process.env.ANKINATOR_LANGCHAIN_PYTHON?.trim()
      || process.env.ODL_PYTHON?.trim()
      || null;
}
```

**`run()` — copy byte-identical** (ocr-loader.ts lines 23–33). Already resolves `{code, stdout, stderr}` and handles `child.on('error')`. Do NOT hand-roll exec/promisify (RESEARCH §Don't Hand-Roll):
```typescript
function run(cmd: string, args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += d.toString()));
    child.stderr.on('data', (d) => (stderr += d.toString()));
    child.on('error', () => resolve({ code: -1, stdout, stderr }));
    child.on('close', (code) => resolve({ code: code ?? -1, stdout, stderr }));
  });
}
```

**Availability-check — adapt `isOcrAvailable()`** (ocr-loader.ts lines 35–41). Same `py -c 'import …'` pattern, new module name (D-04; module choice is at discretion):
```typescript
/** D-04: pacote do wrapper importável? (Java NÃO é checado aqui — vira erro de runtime.) */
export async function isLangchainAvailable(): Promise<boolean> {
  const py = pythonBin();
  if (!py) return false;
  const { code } = await run(py, ['-c', 'import langchain_opendataloader_pdf']);
  return code === 0;
}
```

**Core spawn pattern — adapt `runOcrLoader()`** (ocr-loader.ts lines 47–76). KEY DIFFERENCES vs the OCR analog:
- NO `fs.mkdtemp`/`fs.rm` temp dir (D-01 — sidecar prints to stdout).
- Args target the `.py` by path (resolved via `import.meta.url` / repo-root path; Runtime Inventory caveat A1 — `.py` not copied by tsc).
- On `code !== 0` THROW (D-04: runtime error PROPAGATES, no silent fallback).
- `JSON.parse(stdout)` → hand to `normalize()`.
```typescript
export async function runLangchainLoader(pdfPath: string, opts: LoadOptions): Promise<LoadedDocument> {
  const py = pythonBin();
  if (!py) throw new Error('ANKINATOR_LANGCHAIN_PYTHON / ODL_PYTHON não definido.');
  const script = /* path do tools/odl_langchain_loader.py via import.meta.url (cross-mode) */;
  const args = [script, pdfPath];
  if (opts.pages) args.push('--pages', opts.pages);       // D-11: espelha LoadOptions
  if (opts.password) args.push('--password', opts.password);
  const { code, stdout, stderr } = await run(py, args);
  if (code !== 0) throw new Error(`Falha no loader langchain: ${stderr.slice(-400)}`); // D-04 PROPAGA
  const docs = JSON.parse(stdout);                         // D-01: [{page_content, metadata}]
  return normalize(docs, pdfPath);                         // núcleo PDF-03
}
```

**Error/arg-passing reference** — `runOcrLoader` lines 62–63 show the exact `--pages`/`--password` push idiom to mirror (D-11):
```typescript
if (opts.pages) args.push('--pages', opts.pages);
if (opts.password) args.push('--password', opts.password);
```

---

### `ankinator-app/server/src/core/langchain-normalize.ts` (utility, pure transform — NÚCLEO PDF-03)

**Analog:** `ankinator-app/server/src/core/odl-parse.ts` (read in full — 175 lines)

**Imports pattern** (odl-parse.ts lines 5–8) — adapt (no `fs`; this module is PURE / no I/O for D-14):
```typescript
import crypto from 'node:crypto';
import path from 'node:path';
import type { DocElement, LoadedDocument, Section } from './types.js';
```

**Reuse `cleanMarkdown` — D-09** (odl-parse.ts lines 76–86). Currently NOT exported; recommended action = **export it** (idempotent, stateless) and import here. Handles this exact engine's artifacts (`/^\|[\s|:-]*\|$/` empty table rows + 3+ blank-line collapse). Do NOT re-implement (RESEARCH §Don't Hand-Roll):
```typescript
function cleanMarkdown(md: string): string {
  const lines = md.split('\n');
  const kept: string[] = [];
  for (const line of lines) {
    const t = line.trim();
    if (/^\|[\s|:-]*\|$/.test(t) && !/[A-Za-z0-9À-ÿ]/.test(t)) continue;
    kept.push(line);
  }
  return kept.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
```

**Section-build skeleton — adapt `buildSections` + `flush`** (odl-parse.ts lines 96–139). The flush/`pageStart`/`pageEnd`/`crypto.randomUUID()` id / empty-section filter logic is reused VERBATIM in spirit; the ADAPTATION is the input: current code consumes `DocElement[]` with a `headingLevel` field — the new loader gets raw markdown, so a new `buildSectionsFromMarkdown(docs, fallbackTitle)` must detect ATX `#` in text (`/^(#{1,6})\s+(.+?)\s*#*$/`) per-`Document` (so it knows the page), emitting the same `Section` shape. KEY excerpt to mirror — the `flush` closure and the empty-section filter:
```typescript
const flush = () => {
  if (!current) return;
  const markdown = current.parts.join('\n\n').trim();
  sections.push({
    id: crypto.randomUUID(),
    title: current.title,
    level: current.level,
    pageStart: current.pageStart,
    pageEnd: current.pageEnd,
    markdown,
    charCount: markdown.length,
  });
};
// … per-heading flush + fallback section when no heading yet …
return sections.filter(
  (s) => s.markdown.replace(/^#+\s.*$/m, '').trim().length > 0 || sections.length === 1
);
```

**Heading→markdown level clamp — reuse `elementToMarkdown` idiom** (odl-parse.ts lines 88–94). When re-emitting a detected ATX heading, clamp level 1–6 the same way:
```typescript
const level = Math.min(Math.max(headingLevel, 1), 6);
return `${'#'.repeat(level)} ${content}`;
```

**Top-level derivation — D-10 (CRITICAL Pitfall 1)** vs analog `parseOdlOutput` lines 162–173 (which reads top-level JSON fields `'number of pages'`/`'file name'`/`title`). The new loader has NO top-level fields — derive from per-page `metadata`. **`page` is 1-indexed → `numPages = max(page)` WITHOUT `+1`** (RESEARCH Pitfall 1 / Research Flag 2):
```typescript
const pages = docs.map((d) => d.metadata.page ?? 1);
const numPages = pages.length ? Math.max(...pages) : 1;   // 1-indexed → SEM +1
const fileName = path.basename(pdfPath);                   // D-10
const firstHeading = rawMarkdown.split('\n')
  .map((l) => l.match(/^(#{1,6})\s+(.+?)\s*#*$/)?.[2]).find(Boolean) ?? null; // title=1º heading|null (Pitfall 4)
```

**Elements — D-08** (1 `'text block'` per page; `'text block'` already in `ElementType`, types.ts line 18; chunker ignores `elements`):
```typescript
const elements: DocElement[] = docs.map((d) => ({
  type: 'text block',
  page: d.metadata.page ?? 1,   // 1-indexed
  content: d.page_content,
}));
```

**Return shape — must match `LoadedDocument`** (types.ts lines 48–60). `usedOcr: false` (langchain path is not OCR). Identical field set to `parseOdlOutput` return (odl-parse.ts lines 165–173).

---

### `ankinator-app/server/src/core/document-loader.ts` (service/loader, request-response — MODIFY)

**Analog:** the same file's existing `loadDocument()` (lines 33–64) + OCR branch (lines 34–42).

**Existing OCR branch to preserve untouched — D-06** (lines 34–42). OCR (most specific) wins; this branch is NOT moved or altered:
```typescript
if (opts.ocr) {
  if (!(await isOcrAvailable())) {
    throw new Error('OCR solicitado, mas o backend híbrido Python … não está disponível. …');
  }
  return runOcrLoader(pdfPath, opts);
}
```

**New langchain branch — D-03 (PURELY ADDITIVE, placed AFTER the OCR branch, BEFORE the default).** Mirror env-read convention from config.ts. Early-return ONLY when `=== 'langchain'`; fallback when unavailable falls through to the default below:
```typescript
// D-03: branch aditivo. Default (env unset) NÃO entra aqui (D-15).
if ((process.env.ANKINATOR_PDF_LOADER?.trim().toLowerCase()) === 'langchain') {
  if (await isLangchainAvailable()) {
    console.error('[ankinator] loader: langchain');                       // D-05 (stderr = log do projeto)
    return runLangchainLoader(pdfPath, opts);
  }
  console.error('[ankinator] loader: langchain indisponível (fallback→node)'); // D-04/D-05
  // cai para o default abaixo
}
```

**Default path — D-15 GUARD TARGET (must stay byte-identical)** (lines 44–63). The `ConvertOptions` block + `convert([pdfPath], options)` + `parseOdlOutput` is the production path that runs WITHOUT Python. The new branch must NOT alter it (RESEARCH Pitfall 3). This is exactly what `<guard-default>.ts` asserts CLI-free:
```typescript
const options: ConvertOptions = {
  outputDir: outDir,
  format: ['json', 'markdown'],
  tableMethod: 'cluster',
  readingOrder: 'xycut',
  imageOutput: 'off',
  quiet: true,
  ...(opts.pages ? { pages: opts.pages } : {}),
  ...(opts.password ? { password: opts.password } : {}),
};
await convert([pdfPath], options);
return await parseOdlOutput(outDir, pdfPath);
```

**New import to add:** `import { runLangchainLoader, isLangchainAvailable } from './langchain-loader.js';` (mirrors line 18 `import { runOcrLoader, isOcrAvailable } from './ocr-loader.js';`).

---

### `ankinator-app/server/src/config.ts` (config — MODIFY)

**Analog:** the same file's `ANKINATOR_PROVIDER` read (lines 21–29).

**Env-read convention to mirror — D-03/D-02** (lines 21–33). Trim + lowercase + safe default, exposed as a typed field on `config`:
```typescript
const providerEnv = (process.env.ANKINATOR_PROVIDER?.trim().toLowerCase() as ProviderKind) || 'cli';
// … config = { provider: providerEnv === 'api' ? 'api' : ('cli' as ProviderKind), … }
```

**New fields to add (same idiom):**
```typescript
type PdfLoaderKind = 'node' | 'langchain';
const pdfLoaderEnv = (process.env.ANKINATOR_PDF_LOADER?.trim().toLowerCase() as PdfLoaderKind) || 'node';
// dentro de config:
//   pdfLoader: pdfLoaderEnv === 'langchain' ? 'langchain' : ('node' as PdfLoaderKind),   // D-03 default 'node'
//   langchainPython: process.env.ANKINATOR_LANGCHAIN_PYTHON?.trim() || process.env.ODL_PYTHON?.trim() || '', // D-02
```
> NOTE (discretion): the branch in `document-loader.ts` may read `process.env.ANKINATOR_PDF_LOADER` directly (as RESEARCH Pattern 2 shows) OR via `config.pdfLoader`. Either is consistent; `config.ts` should at minimum DOCUMENT both vars (D-13 / Runtime Inventory). Keep the default `'node'` so D-15 holds.

---

### `ankinator-app/server/src/scripts/smoke-langchain-loader.ts` (test, gated smoke — NEW)

**Analog:** `ankinator-app/server/src/scripts/smoke-loader.ts` (read in full — 30 lines)

**Harness pattern — clone** (smoke-loader.ts lines 5–29). argv-PDF check + `loadDocument` + timing + section preview. ADD a gate at the top: skip (exit 0) when `isLangchainAvailable()` is false (D-14 — gated), and force the langchain path (set `ANKINATOR_PDF_LOADER=langchain` or call `runLangchainLoader` directly). This smoke is what reveals missing Java at runtime (RESEARCH Pitfall 2):
```typescript
import { loadDocument } from '../core/document-loader.js';
const pdf = process.argv[2];
if (!pdf) { console.error('Uso: smoke-langchain-loader <caminho.pdf>'); process.exit(1); }
// D-14 gate: pula se indisponível (não falha o CI)
// if (!(await isLangchainAvailable())) { console.log('langchain indisponível — smoke pulado.'); process.exit(0); }
const t0 = Date.now();
const doc = await loadDocument(pdf);   // com ANKINATOR_PDF_LOADER=langchain
const ms = Date.now() - t0;
console.log('arquivo:', doc.fileName, '| páginas:', doc.numPages, '| seções:', doc.sections.length);
```

---

### `ankinator-app/server/src/scripts/<assert-normalize>.ts` + `<guard-default>.ts` (test, CLI-free — NEW)

**Analog:** `ankinator-app/server/src/scripts/smoke-runner.ts` (read in full — 85 lines), specifically the CLI-FREE PASSO 2 (lines 34–72) and the `fail()`/`--assert-args` discipline.

**`fail()` + `process.exit(1)` assertion idiom — copy** (smoke-runner.ts lines 51–67):
```typescript
function fail(msg: string): never {
  console.error(`   ✗ FALHA: ${msg}`);
  process.exit(1);
}
// … compare actual vs expected, length first, then element-by-element …
if (plan.args.length !== ESPERADO.length) fail(`tamanho ${plan.args.length}, esperado ${ESPERADO.length}`);
for (let i = 0; i < ESPERADO.length; i++) if (a[i] !== ESPERADO[i]) fail(`[${i}] divergente`);
```

**`<assert-normalize>.ts` (D-14 unit puro, PDF-03):** import `normalize` from `langchain-normalize.js`, feed an INLINE fixture `Document[]` (≥2 pages, ≥1 ATX heading, ≥1 page without heading — RESEARCH Wave 0 Gaps), assert against expected `LoadedDocument`. Concrete assertions (RESEARCH Test Map): `numPages === max(page)` (Pitfall 1 — 3 pages w/ page 1,2,3 → `numPages=3`), `title === null` when no leading heading (Pitfall 4), `elements.length === pages`, `sections` split at each ATX `#`. CLI-free, no Python, `< 1s`, runs always.

**`<guard-default>.ts` (D-15 non-regression, SPEC-01 mirror):** the EXACT discipline of smoke-runner PASSO 2 + `--assert-args` (lines 34–78). With `ANKINATOR_PDF_LOADER` UNSET, assert the `ConvertOptions` object + `convert` call plan built by `loadDocument` is byte-identical to today's (lines 49–59) WITHOUT spawning Java/Python and WITHOUT calling `isLangchainAvailable()`. The `--assert-args` early-exit pattern (lines 75–78) is the template for a CLI-free guard:
```typescript
if (process.argv.includes('--assert-args')) {
  console.log('--assert-args: guard CLI-free OK; default intocado.');
  process.exit(0);
}
```
> DISCRETION: this may be a standalone `<guard-default>.ts` OR a `--assert` flag added to a smoke script (RESEARCH Wave 0 Gaps). To assert the default plan byte-identical, the planner may need to factor the `ConvertOptions` build into a tiny exported pure helper in `document-loader.ts` (so the guard can call it without `convert`) — analogous to how `buildSpawnArgs` was extracted from `runner.ts` to make PASSO 2 CLI-free.

---

### `tools/odl_langchain_loader.py` (sidecar/CLI script — NEW)

**Analog:** the CLI/spawn CONTRACT of `runOcrLoader` (ocr-loader.ts lines 47–76) + the verified API in RESEARCH §Code Examples (lines 295–333).

**Contract this script must satisfy (consumed by `langchain-loader.ts`):**
- argv: `<pdf> [--pages] [--password]` — mirrors `LoadOptions` (D-11; mirrors `runOcrLoader` arg-push at ocr-loader.ts lines 62–63).
- Instantiate `OpenDataLoaderPDFLoader(file_path=pdf, format="markdown", split_pages=True, quiet=True, image_output="off", table_method="cluster", reading_order="xycut", pages=…, password=…)` — markdown-per-page (D-12), mirrors the Node `ConvertOptions` at document-loader.ts lines 49–58.
- Print `json.dumps([{ "page_content": d.page_content, "metadata": d.metadata } for d in loader.load()])` to **stdout** (D-01) — Node does `JSON.parse`. NO temp dir.
- Comments PT-BR; NO API key (local processing only).
> Full reference implementation in RESEARCH lines 296–332. A1 caveat: confirm `table_method`/`reading_order`/`image_output` param names in the smoke before pinning all (defaults already produce usable markdown).

### `tools/requirements.txt` (config / dep pin — NEW)

**Analog:** RESEARCH §Standard Stack "Installation" block (lines 105–111). No existing `requirements.txt` in repo — this is the canonical content (D-13):
```
# Sidecar opcional do loader LangChain (Phase 2). NÃO é dependência do Node.
# Requer Python >=3.10,<4.0 E Java 11+ no PATH (motor OpenDataLoader).
# Instale num venv dedicado e aponte ANKINATOR_LANGCHAIN_PYTHON para o interpretador.
langchain-opendataloader-pdf==2.0.0
```
> Pin `==2.0.0` (D-13). Transitive deps (`langchain-core>=1.0,<2.0`, `opendataloader-pdf>=2.0.0`) come automatically — do NOT declare. Document Java 11+ here AND in INTEGRATIONS (RESEARCH Pitfall 2 / Runtime Inventory). Planner: insert a `checkpoint:human-verify` before any `pip install` (RESEARCH §Package Legitimacy Audit).

---

## Shared Patterns

### Sidecar spawn + availability gate
**Source:** `ankinator-app/server/src/core/ocr-loader.ts` lines 19–41 (`pythonBin`, `run`, `isOcrAvailable`)
**Apply to:** `langchain-loader.ts` (spawn `run()` copied verbatim; `pythonBin` adapted for D-02; `isOcrAvailable`→`isLangchainAvailable` import-check)
```typescript
function run(cmd: string, args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = ''; let stderr = '';
    child.stdout.on('data', (d) => (stdout += d.toString()));
    child.stderr.on('data', (d) => (stderr += d.toString()));
    child.on('error', () => resolve({ code: -1, stdout, stderr }));
    child.on('close', (code) => resolve({ code: code ?? -1, stdout, stderr }));
  });
}
```

### Env-selected behavior with safe default
**Source:** `ankinator-app/server/src/config.ts` lines 21–29 (`ANKINATOR_PROVIDER`)
**Apply to:** `config.ts` (`ANKINATOR_PDF_LOADER` default `'node'`, `ANKINATOR_LANGCHAIN_PYTHON` w/ `ODL_PYTHON` fallback) + the branch in `document-loader.ts`
```typescript
const providerEnv = (process.env.ANKINATOR_PROVIDER?.trim().toLowerCase() as ProviderKind) || 'cli';
```

### Markdown cleanup + section building (reuse, do not re-implement)
**Source:** `ankinator-app/server/src/core/odl-parse.ts` — `cleanMarkdown` lines 76–86, `buildSections`/`flush` lines 96–139, `elementToMarkdown` level-clamp lines 88–94
**Apply to:** `langchain-normalize.ts`. Recommended: EXPORT `cleanMarkdown` (idempotent) and reuse; write a NEW `buildSectionsFromMarkdown` that mirrors the flush/filter logic but parses ATX `#` from raw markdown (input differs: markdown text vs `DocElement[]`).

### CLI-free deterministic assertion (`process.exit(1)` on mismatch)
**Source:** `ankinator-app/server/src/scripts/smoke-runner.ts` — `fail()` lines 51–54, byte-by-byte compare lines 56–67, `--assert-args` early-exit lines 75–78
**Apply to:** `<assert-normalize>.ts` (fixture→LoadedDocument) and `<guard-default>.ts` (default `ConvertOptions` byte-identical). No external process spawned; runs in CI always.

### Loader visibility = server log only (NOT a type field)
**Source:** project log convention `console.error('[ankinator] …')`; constraint = `LoadedDocument` is DUPLICATED server (`core/types.ts`) + web (`web/src/types.ts`)
**Apply to:** `document-loader.ts` branch (D-05). Do NOT add a `loader` field to `LoadedDocument` (types.ts lines 48–60 — INTOCADO). Same for `chunker.ts` (consumes only `sections[]`) and `ElementType` (`'text block'` already present, line 18).

---

## No Analog Found

| File | Role | Data Flow | Reason / Mitigation |
|------|------|-----------|---------------------|
| `tools/odl_langchain_loader.py` | sidecar (Python) | transform | No `.py` exists in repo. Pattern source = the spawn/CLI **contract** of `runOcrLoader` (ocr-loader.ts) + verified API in RESEARCH §Code Examples lines 296–332. Treat RESEARCH as the analog. |
| `tools/requirements.txt` | config | — | No existing `requirements.txt`. OCR path uses prose-pip in docs (D-13 intentionally deviates with a version pin). Content = RESEARCH §Standard Stack lines 105–111. |

> Both "no-analog" files are low-risk: the Python sidecar is a thin, fully-specified CLI contract (D-01/D-11/D-12) and the requirements file is a single pinned line. Everything Node-side has an exact or strong in-repo analog.

## Metadata

**Analog search scope:** `ankinator-app/server/src/core/`, `ankinator-app/server/src/scripts/`, `ankinator-app/server/src/config.ts`, `ankinator-app/server/src/api.ts`, repo-root `tools/`
**Files scanned (read in full):** `ocr-loader.ts`, `document-loader.ts`, `odl-parse.ts`, `config.ts`, `types.ts`, `chunker.ts`, `smoke-loader.ts`, `smoke-runner.ts`; `api.ts` (call-site lines 76–89)
**Key cross-file facts confirmed:** `loadDocument` call-site = `api.ts:85` `{ ocr, pages, password }`; `'text block'` ∈ `ElementType` (types.ts:18); `chunkDocument` consumes only `doc.sections[]` (chunker.ts:54–56); `tools/` does not yet exist.
**Pattern extraction date:** 2026-06-03
