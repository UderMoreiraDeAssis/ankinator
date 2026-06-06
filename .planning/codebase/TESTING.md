# Testing Patterns

**Analysis Date:** 2026-06-03

> ⚠️ **Snapshot de 2026-06-03 — VENCIDO neste tópico.** Este doc foi mapeado ANTES da Phase 3. A afirmação "There is no automated test suite" abaixo **não vale mais**: a suíte **vitest** foi instalada na Phase 3 e cresceu para **~250 testes** (server) + guards (SPEC-01 / enrich / default-loader). O estado corrente vive em `.planning/STATE.md`. Ver `.planning/FRAMING-REVIEW.md` §8 (C6).

## Summary

**There is no automated test suite in this codebase.** No jest, vitest, mocha, or any test runner is installed in any `package.json`. No `.test.ts`, `.spec.ts`, `.test.tsx`, or `.spec.tsx` files exist anywhere in the repo.

What exists instead:
1. A single integration test script in `ankinator-mcp/` that drives the MCP server directly via stdio (not a test framework)
2. A handful of smoke-test scripts in `ankinator-app/server/src/scripts/` for manual verification
3. Legacy exploratory scripts in `legacy/` (scripts prefixed `test-` that were used during development, now considered deprecated)

---

## Test Framework

**Runner:** None — no test framework installed or configured.

**Assertion Library:** None.

**Run Commands:**
```bash
# ankinator-mcp only — builds then runs integration script
cd ankinator-mcp && npm test
# equivalent to:
npm run build && node tests/integration-test.js

# ankinator-app/server smoke test (manual, requires a real PDF)
cd ankinator-app/server && npm run smoke -- path/to/file.pdf
```

---

## The Integration Test (`ankinator-mcp`)

**Location:** `ankinator-mcp/tests/integration-test.js`

**What it does:** Spawns the compiled MCP server (`dist/index.js`) as a child process, sends JSON-RPC 2.0 messages over stdio, and validates structured responses against hand-written `validate()` functions.

**Test structure (not a framework):**
```javascript
const tests = [
  {
    phase: 1,
    name: 'listar_docs',
    description: 'Lista documentos do projeto',
    params: {},
    validate: (result) => {
      return result && result.docs && Array.isArray(result.docs) && result.docs.length > 0;
    },
  },
  // ... 23 more test objects
];
```

**Phases covered:**
- Phase 1 — Documentation tools: `listar_docs`, `resumir_arvore`, `extrair_secao`
- Phase 2 — CSV validation: `validar_csv`, `sample_rows`, `contar_campos`
- Phase 3 — Anki references: `versoes_suportadas`, `instalacao_addon`, `anki_hooks`
- Phase 4 — Release notes: `ultimas_mudancas`, `roadmap`
- Phase 6 — PDF extraction (requires `ANTHROPIC_API_KEY`, skipped when absent): `preview_questoes`, `extrair_questoes`, `converter_para_csv`

**Total test cases:** 24 (approximately 3 are skipped without an API key)

**MCPClient helper class** (inline in the test file):
```javascript
class MCPClient {
  async start()          // spawns server, waits 1s for init
  async callTool(name, params)  // sends JSON-RPC request, awaits response
  extractStructuredContent(result)  // unwraps MCP structuredContent
  async stop()           // kills server process
}
```

**Output:** Colored terminal output with PASS/FAIL/SKIP indicators and a summary report. Exits with code 0 on all pass, 1 on any failure.

**Notable gaps:**
- No assertions on HTTP status codes — validation is only on response shape
- Timeout per test is 30 seconds (`TIMEOUT = 30000`), no way to configure per-test
- No before/after hooks — server starts once, all tests run sequentially
- Server init uses a fixed `setTimeout(resolve, 1000)` rather than waiting for a ready signal

---

## Smoke Scripts (`ankinator-app/server`)

**Location:** `ankinator-app/server/src/scripts/`

**`smoke-loader.ts`** — Loads a PDF through the full `DocumentLoader` pipeline and prints stats to stdout. Run with:
```bash
tsx src/scripts/smoke-loader.ts path/to/file.pdf
```

**`smoke-cli.ts`** — Runs a full generation pass (one chunk) via the CLI provider and prints extracted questions. Run with:
```bash
tsx src/scripts/smoke-cli.ts path/to/file.pdf
```

These are manual verification tools, not automated tests. They require a real PDF file and (for `smoke-cli`) an active `claude` CLI session.

---

## Legacy Test Scripts

**Location:** `legacy/`

These JavaScript files (`test-anki-workflow.js`, `test-chunked-extraction.js`, `test-extract-chunks.js`, `test-iterativo.js`, `test-session-based.js`) were used during early development. They are not wired to any test command and are considered superseded by the current architecture. They should not be used as reference for new tests.

---

## Fixture Files

**Location:** `ankinator-mcp/examples/csv/`

CSV fixture files used by the integration test's Phase 2 validation tools:
- `valido_minimo.csv` — minimal valid Anki CSV
- `valido_completo.csv` — complete valid Anki CSV with all fields
- `invalido_campos.csv` — CSV with field errors (for negative testing)
- `invalido_dificuldade.csv` — CSV with difficulty field errors

A `pdf/` directory is referenced in the integration test but does not exist on disk — Phase 6 PDF tests skip gracefully when fixtures are absent and the API key is not set.

**Generation:** `ankinator-mcp/scripts/generate-fixtures.js` can recreate fixtures. Run with `npm run generate-fixtures`.

---

## Coverage

**Requirements:** None enforced — no coverage tool configured.

**Coverage command:** Does not exist.

---

## What Is Not Tested

The following are completely untested by any automated mechanism:

- `ankinator-app/server/` — all Express routes in `ankinator-app/server/src/api.ts`
- `ankinator-app/server/` — core pipeline: `DocumentLoader`, `Chunker`, `QuestionGenerator`
- `ankinator-app/server/` — providers: `CliProvider`, `ApiProvider`
- `ankinator-app/server/` — exporters: CSV generation (`ankinator-app/server/src/core/exporters/csv.ts`), AnkiConnect push (`ankinator-app/server/src/core/exporters/ankiconnect.ts`)
- `ankinator-app/web/` — all React components — no component tests exist
- Pure utility functions that are trivially unit-testable: `parseQuestoesJson`, `mapRawQuestoes`, `chunkDocument`, `splitLargeSection`, `estTokens`
- `ankinator-mcp/src/helpers/changelog-parser.ts` — parsing logic for Keep a Changelog format

---

## Recommended Test Setup (if adding tests)

Given the existing stack (TypeScript, Node 22+, ESM in server / CJS in mcp), the recommended additions would be:

**For `ankinator-app/server/`:**
- Add `vitest` as devDependency (native ESM support, no transform config needed)
- Place unit tests co-located: `src/core/generation.test.ts`, `src/core/chunker.test.ts`
- Test `parseQuestoesJson`, `mapRawQuestoes`, `chunkDocument` as pure functions first

**For `ankinator-mcp/`:**
- The existing `tests/integration-test.js` pattern is workable but fragile (fixed 1s startup delay)
- Consider replacing with `jest` (CJS compatible) and a proper `beforeAll`/`afterAll` server lifecycle
- Unit test `ankinator-mcp/src/helpers/changelog-parser.ts` independently of the MCP server

---

*Testing analysis: 2026-06-03*
