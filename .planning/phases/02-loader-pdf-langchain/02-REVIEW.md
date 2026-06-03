---
phase: 02-loader-pdf-langchain
reviewed: 2026-06-03T00:00:00Z
depth: standard
files_reviewed: 11
files_reviewed_list:
  - ankinator-app/server/src/config.ts
  - ankinator-app/server/src/core/document-loader.ts
  - ankinator-app/server/src/core/langchain-loader.ts
  - ankinator-app/server/src/core/langchain-normalize.ts
  - ankinator-app/server/src/core/odl-parse.ts
  - ankinator-app/server/src/scripts/assert-langchain-loader.ts
  - ankinator-app/server/src/scripts/assert-langchain-normalize.ts
  - ankinator-app/server/src/scripts/guard-default-loader.ts
  - ankinator-app/server/src/scripts/smoke-langchain-loader.ts
  - tools/odl_langchain_loader.py
  - tools/requirements.txt
findings:
  critical: 2
  warning: 6
  info: 4
  total: 12
status: issues_found
---

# Phase 02: Code Review Report

**Reviewed:** 2026-06-03
**Depth:** standard
**Files Reviewed:** 11
**Status:** issues_found

## Summary

Reviewed the LangChain PDF-loader sidecar wiring: TS core (`langchain-loader.ts`,
`langchain-normalize.ts`), the spawn plumbing reused from `ocr-loader.ts`, the Python
sidecar (`odl_langchain_loader.py`), and the CLI-free guard/assert scripts.

Spawn safety is sound — `spawn` with an argv array (no shell) means there is no command
injection surface (T-02-05 holds), and `JSON.parse` (not `eval`) is used on subprocess
stdout (T-02-06 holds). The D-15 default-path guard is genuinely CLI-free and the
opt-in branch is purely additive as designed.

However, two correctness defects affect the actual data channel: (1) the `run()` helper
concatenates stdout chunks via per-chunk `Buffer.toString()` with **no `setEncoding`**,
which corrupts multi-byte UTF-8 split across chunk boundaries — and unlike `ocr-loader.ts`
(which reads files on disk), here **stdout IS the document payload**, so corrupted
accented Portuguese text reaches the LLM; (2) `JSON.parse(stdout)` has no shape/empty
guard, so a sidecar that exits 0 but prints nothing (or prints diagnostics) throws an
opaque `SyntaxError`. Several robustness gaps around untrusted `metadata` shape round
out the warnings.

## Critical Issues

### CR-01: stdout decoded per-chunk without `setEncoding` — corrupts multi-byte UTF-8

**File:** `ankinator-app/server/src/core/langchain-loader.ts:34-44` (the `run()` helper; consumed at `:96`)
**Issue:**
`child.stdout.on('data', (d) => (stdout += d.toString()))` converts each raw `Buffer`
chunk to a string independently. Node streams split on byte boundaries, not character
boundaries, so any multi-byte UTF-8 sequence (e.g. `á`, `ã`, `ç`, `é` — pervasive in
Portuguese concurso material) that straddles two `data` chunks is decoded as two
mojibake replacement characters. The Python sidecar deliberately emits raw UTF-8
(`ensure_ascii=False`, `odl_langchain_loader.py:89`), so the payload is full of
multi-byte chars. For large PDFs (many chunks), corruption is effectively guaranteed.

This is `Critical` here (not in `ocr-loader.ts`, where the same pattern only carries a
process exit code — the actual document is read from disk via `fs.readFile(..., 'utf8')`).
In this loader **stdout is the document**, so the defect silently degrades every
generated flashcard. It can also break `JSON.parse` if a corrupted byte lands inside a
JSON string escape.

**Fix:**
```ts
function run(cmd: string, args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    const out: Buffer[] = [];
    const err: Buffer[] = [];
    child.stdout.on('data', (d: Buffer) => out.push(d));
    child.stderr.on('data', (d: Buffer) => err.push(d));
    child.on('error', () =>
      resolve({ code: -1, stdout: Buffer.concat(out).toString('utf8'), stderr: Buffer.concat(err).toString('utf8') })
    );
    child.on('close', (code) =>
      resolve({ code: code ?? -1, stdout: Buffer.concat(out).toString('utf8'), stderr: Buffer.concat(err).toString('utf8') })
    );
  });
}
```
Buffer the chunks and decode once at the end (or call `child.stdout.setEncoding('utf8')`,
which makes the stream emit boundary-safe strings).

### CR-02: `JSON.parse(stdout)` with no empty/shape guard — opaque crash + unvalidated input to `normalize`

**File:** `ankinator-app/server/src/core/langchain-loader.ts:106-107`
**Issue:**
When the sidecar exits `0` but stdout is empty or non-JSON (e.g. a library that prints a
deprecation/progress line to stdout instead of stderr, an empty document, or a buffering
quirk), `JSON.parse(stdout)` throws a bare `SyntaxError: Unexpected end of JSON input`
with no PDF/loader context — the operator cannot tell the failure came from the langchain
sidecar. Worse, `normalize(docs, pdfPath)` is then called with whatever was parsed: if
the sidecar emits a JSON object (not an array), `docs.map(...)` in
`langchain-normalize.ts:136` throws `docs.map is not a function`; if it emits an array of
items missing `metadata`, `doc.metadata.page` (`langchain-normalize.ts:69`) throws
`Cannot read properties of undefined`. The "JSON.parse not eval" safety claim is true, but
the parsed value is fed downstream completely unvalidated.

**Fix:**
```ts
let docs: unknown;
try {
  docs = JSON.parse(stdout);
} catch (e) {
  throw new Error(
    `Loader langchain: stdout não é JSON válido (len=${stdout.length}). ` +
      `stderr: ${stderr.slice(-400)}`
  );
}
if (!Array.isArray(docs)) {
  throw new Error(`Loader langchain: esperado array de Documents, recebido ${typeof docs}.`);
}
return normalize(docs as RawDoc[], pdfPath);
```
And in `normalize`, defensively coalesce a missing `metadata`: `const page = doc.metadata?.page ?? 1;`.

## Warnings

### WR-01: `metadata.page` trusted as a number — `numPages` can become `NaN`

**File:** `ankinator-app/server/src/core/langchain-normalize.ts:69,103,109,153-154`
**Issue:**
`metadata.page` is typed `page?: number` (`RawDoc`, line 23) but it originates from the
sidecar passing `d.metadata` verbatim (`odl_langchain_loader.py:86`) — i.e. whatever the
langchain library puts there. The `?? 1` guards only `undefined`/`null`. If `page` is a
string (`"1"`) or missing-but-present-as-`0`, then `Math.max(...pages)` returns `NaN`
(strings) or `0`, producing an invalid `numPages` that propagates into every `Section`
and into source attribution on cards. There is no runtime coercion or validation.
**Fix:** Coerce and validate at the boundary:
```ts
const rawPage = doc.metadata?.page;
const page = Number.isInteger(rawPage) && (rawPage as number) >= 1 ? (rawPage as number) : 1;
```
Apply the same coercion in `normalize`'s `pages` map (line 153).

### WR-02: Sidecar emits the entire `metadata` dict — contradicts the documented 3-field contract (Pitfall 5)

**File:** `tools/odl_langchain_loader.py:82-88`
**Issue:**
The module docstring (lines 7-9) and `RawDoc` (`langchain-normalize.ts:17-25`) declare the
contract as `{source, format, page}`. But the code emits `"metadata": d.metadata` — the
whole dict. If the langchain loader populates `metadata` with bounding boxes, coordinates,
per-page image refs, or base64 blobs, all of it is serialized to stdout. This inflates the
payload Node must buffer and `JSON.parse`, and re-opens the Pitfall-5 concern
("sem refs binárias no stdout") that `image_output="off"` was supposed to close — that
flag stops image *content*, not arbitrary metadata keys. The TS side ignores the extra
keys, so they are pure waste/risk.
**Fix:** Project metadata to the declared contract explicitly:
```python
"metadata": {
    "source": d.metadata.get("source"),
    "format": d.metadata.get("format"),
    "page": d.metadata.get("page"),
},
```

### WR-03: Unguarded sidecar exceptions print a full Python traceback to stderr, surfaced verbatim to users

**File:** `tools/odl_langchain_loader.py:77` and `:94-95`; surfaced at `langchain-loader.ts:101`
**Issue:**
`loader.load()` runs with no `try/except`. On the documented runtime failure (Java 11+
absent — Pitfall 2/R2) or a corrupt/locked PDF, Python prints a multi-line traceback to
stderr and exits non-zero. Node then throws `Falha no loader langchain: ${stderr.slice(-400)}`
— the *last* 400 chars of a traceback, which is the least informative tail (often just the
final frame), while the actual cause (e.g. `FileNotFoundError: java`) is at the top and
truncated away. Diagnosis is materially harder than it should be.
**Fix:** Catch in the sidecar and emit a single structured diagnostic line:
```python
try:
    docs = loader.load()
except Exception as e:  # noqa: BLE001 — boundary: convert to clean stderr line
    print(f"odl_langchain_loader: {type(e).__name__}: {e}", file=sys.stderr)
    return 1
```
Then on the Node side prefer the *first* lines of stderr (`stderr.split('\n').slice(0,5)`) over the tail.

### WR-04: No `password` redaction — secret can reach logs via stderr passthrough

**File:** `ankinator-app/server/src/core/langchain-loader.ts:94,101`
**Issue:**
`opts.password` is appended to argv (line 94) and, on failure, `stderr` is interpolated
into the thrown error (line 101). On a Unix host any local user can see the password in
`ps`/`/proc/<pid>/cmdline` while the sidecar runs (argv is world-readable). Additionally,
if the langchain library or Java echoes the argument on error, the password lands in the
thrown `Error.message` and thus in any log sink. The `--pages`/`--password` are also
unvalidated, so a `pages` value like `--password` could be misparsed by argparse (low risk
since they are separate flags, but the values are passed through untyped).
**Fix:** Document the `ps`-visibility caveat, or pass the password via an env var / stdin
to the sidecar instead of argv; and scrub `password` out of any `stderr` before including
it in a thrown error.

### WR-05: `child.on('error')` resolves `code: -1`, colliding with a real exit code of -1 / 255

**File:** `ankinator-app/server/src/core/langchain-loader.ts:41-42`
**Issue:**
Both the spawn-failure path (`'error'`, e.g. ENOENT when the Python binary path is wrong)
and a process that exits with a null/`-1` code resolve to `{ code: -1 }`. Callers
(`isLangchainAvailable` line 58, `runLangchainLoader` line 100) cannot distinguish "Python
interpreter not found / not executable" from "sidecar ran and failed." For
`isLangchainAvailable`, an ENOENT on a mistyped `ANKINATOR_LANGCHAIN_PYTHON` is silently
reported as "unavailable" and the system falls back to the Node loader (D-04) — masking a
config error the operator would want surfaced.
**Fix:** Carry the spawn error: resolve `{ code: -1, signal: 'spawn-error', errorMessage: err.message, ... }`
and have `runLangchainLoader` include it: `throw new Error('Loader langchain: não foi possível spawnar Python (' + ... + ')')`.

### WR-06: `title` regex strips intended trailing `#` and ignores fenced code

**File:** `ankinator-app/server/src/core/langchain-normalize.ts:28,158-164`
**Issue:**
`ATX = /^(#{1,6})\s+(.+?)\s*#*$/` is reused for both section-splitting and title
extraction. The trailing `\s*#*$` consumes any closing hashes, so a heading whose literal
text ends in `#` (e.g. `# C#`) yields `title = "C"`. More importantly, the title loop
(lines 158-164) scans `rawMarkdown` line-by-line with no fenced-code awareness: a `#`
comment inside a fenced code block (```` ```python\n# not a heading ````) is matched as an
ATX heading and becomes the document title and a spurious section. PDFs of programming/IT
concurso material routinely contain such snippets.
**Fix:** Anchor title extraction to the same already-built `sections` (use
`sections[0]?.level === 1 ? sections[0].title : null` consistent with Pitfall-4 intent), or
track fenced-code state while scanning; and tighten the heading text capture so a deliberate
trailing `#` in title text is not silently stripped.

## Info

### IN-01: `run()` duplicated byte-for-byte across `langchain-loader.ts` and `ocr-loader.ts`

**File:** `ankinator-app/server/src/core/langchain-loader.ts:34-44` vs `ocr-loader.ts:23-33`
**Issue:** The comment at line 32 explicitly states "Cópia byte-idêntica de ocr-loader.ts".
The CR-01 encoding fix must now be applied in two places or they will drift. The same
duplication exists for `pythonBin()`.
**Fix:** Extract a shared `runSubprocess(cmd, args)` (and the env-var resolution) into a small
`subprocess.ts` helper imported by both loaders. Fixing CR-01 once then covers both.

### IN-02: `numPages` semantics differ silently between the two loaders

**File:** `langchain-normalize.ts:153-154` vs `odl-parse.ts:168`
**Issue:** The langchain path derives `numPages = max(metadata.page)` while the Node path
trusts the loader's `'number of pages'` field. For a PDF whose trailing pages are blank
(no Document emitted), the langchain `numPages` undercounts relative to the Node loader for
the same file. The normalize asserts treat this as intended (R1), but the two loaders are
documented as interchangeable — downstream consumers may not expect the discrepancy.
**Fix:** Document the divergence in `langchain-normalize.ts`, or have the sidecar emit the
true page count in metadata and use it.

### IN-03: `image_output`/`table_method`/`reading_order` param names unverified (self-flagged A1)

**File:** `tools/odl_langchain_loader.py:62-75`
**Issue:** The inline NOTE (lines 62-64) admits the keyword-argument names are unconfirmed and
that the smoke test (gated, only runs with a real venv+Java) is the only thing that would
catch a name mismatch. If `OpenDataLoaderPDFLoader` rejects an unknown kwarg, the sidecar
fails at construction; if it silently ignores it, the Node/langchain parity (D-12) is broken
without any error. No CLI-free test covers this.
**Fix:** Pin `langchain-opendataloader-pdf==2.0.0` is already done; add a tiny offline assert
that constructs the loader with these kwargs against a stub, or run the gated smoke in CI with
a fixture PDF + Java before relying on parity.

### IN-04: `process.exit(0)` immediately after async logging in smoke script

**File:** `ankinator-app/server/src/scripts/smoke-langchain-loader.ts:45-59`
**Issue:** The script `await`s `loadDocument` then logs and lets the event loop drain — fine.
But it relies on top-level `await` and never wraps `loadDocument` in try/catch, so on the
documented Java-missing failure (Pitfall 2) the smoke aborts with an unhandled-rejection stack
rather than a labeled "smoke FAILED" line. This is intentional per the header comment ("o erro
aparece em stderr como stack trace"), so it is informational, but a one-line `catch` that prints
`SMOKE FAILED: <msg>` before exiting non-zero would read better in CI logs.
**Fix:** Wrap in `try { ... } catch (e) { console.error('SMOKE FAILED:', e); process.exit(1); }`.

---

_Reviewed: 2026-06-03_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
