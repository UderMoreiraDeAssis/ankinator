# Codebase Concerns

**Analysis Date:** 2026-06-03

---

## Tech Debt

**MCP index.ts — Monolithic God File:**
- Issue: All 22 MCP tool handlers, all Zod schemas, all helper functions, and all manager initialization live in a single 2,484-line file.
- Files: `ankinator-mcp/src/index.ts`
- Impact: Hard to navigate, test, or refactor. Any change risks breaking unrelated tools. The file took ~60–80s to load fully in exploration.
- Fix approach: Extract each tool group (CSV, PDF extraction, session, changelog, Anki references) into separate `tools/*.ts` modules and import them in `index.ts`.

**MCP — 25 `as any` Type Assertions Remain:**
- Issue: Every `server.registerTool()` call uses `} as any,` workaround. `REVISAO_MCP.md` documents this as a known incompatibility with the current MCP SDK typing.
- Files: `ankinator-mcp/src/index.ts` (lines 815, 845, 875, 910, 967, 1012, 1071, 1131, 1188, 1239, 1328, 1500, 1609, 1713, 1783, 1911, 1968, 1976, 2100, 2142, 2188, 2253 and more)
- Impact: Bypasses TypeScript type-checking on tool registration; schema mismatches go undetected at compile time.
- Fix approach: Upgrade `@modelcontextprotocol/sdk` to a version that supports inline schema objects without the `as any` cast (SDK v1.22+ should allow it); convert schemas to inline objects as shown in `REVISAO_MCP.md`.

**MCP — `throw new Error` Instead of `isError: true` in 8 Places:**
- Issue: Eight handlers still use `throw new Error(...)` rather than the MCP-correct `return { content:[...], isError: true }` pattern. This breaks the MCP protocol flow; exceptions propagate up and may crash the server or return unexpected transport errors to the client.
- Files: `ankinator-mcp/src/index.ts` lines 105, 802, 878, 886, 1025, 1074, 1134, 1194
- Impact: Clients see an unstructured crash rather than a structured error response. Fragile for callers doing `.result` checks.
- Fix approach: Replace each `throw new Error(...)` with `return { content:[{ type:'text', text: msg }], isError: true, structuredContent: { error: 'CODE', message: msg } }`.

**MCP — `extrair_pdf_chunks` DEPRECATED Tool Still Registered:**
- Issue: `extrair_pdf_chunks` is explicitly marked `[DEPRECATED]` in its title and description but is still registered as an active tool. It can still be called and will return potentially oversized responses for large PDFs.
- Files: `ankinator-mcp/src/index.ts` lines 1968–2065
- Impact: Confuses callers; token-limit hazard persists as a live code path.
- Fix approach: Remove the registration entirely or guard it behind an env flag `ANKINATOR_ENABLE_DEPRECATED=true`.

**MCP — ChunkSessionManager Uses In-Memory Map (No Persistence Across Restarts):**
- Issue: `ChunkSessionManager.sessions` is a `Map<string, ChunkSession>` in process memory. JSONL files are written to disk, but the in-memory map is lost on server restart. A client holding a `session_id` from a previous run will get `Session X not found` errors even though the `.jsonl` file exists on disk.
- Files: `ankinator-mcp/src/chunk-session-manager.ts` lines 43, 97
- Impact: Sessions are effectively non-resumable across server restarts; any crash loses all active session handles.
- Fix approach: On `initialize()`, scan `chunk-sessions/` for existing `.jsonl` files and reconstruct the `Map` from their filenames and metadata (first/last line parse).

**MCP — session_id Not Validated Against Path Traversal:**
- Issue: `getChunks`, `getChunkBatch`, and `getChunkMetadata` construct file paths as `path.join(this.chunksDir, \`${sessionId}.jsonl\`)`. There is no validation that `sessionId` is a safe hex string, only that the session exists in the in-memory Map. If a session is somehow injected, `../../etc/passwd.jsonl` becomes possible.
- Files: `ankinator-mcp/src/chunk-session-manager.ts` lines 115, 143, 172; `ankinator-mcp/src/managers/question-session-manager.ts` line 35
- Impact: Path traversal risk on session file reads/writes (low likelihood due to Map guard, but the Map can be bypassed after a restart).
- Fix approach: Validate `sessionId` with `/^[a-f0-9]{32}$/` before any file operation.

**App Server — No Input Validation on API Request Bodies:**
- Issue: `api.ts` destructures `req.body` without any schema validation. Fields like `docId`, `selectedSectionIds`, `maxCharsPerChunk`, `options.*`, `deck`, `fonte`, `tags`, and `allowDuplicate` are used directly after a `?? {}` fallback.
- Files: `ankinator-app/server/src/api.ts` lines 79, 113–114, 213, 225
- Impact: Malformed inputs (wrong types, missing fields) produce confusing runtime errors deep in the generation pipeline rather than clear 400 responses. The `deck` path passed to AnkiConnect is not sanitized.
- Fix approach: Add Zod schema parsing on each route's `req.body` before use; return 400 with validation errors.

**App Server — State Is Ephemeral In-Memory Only:**
- Issue: `documentStore` and `jobStore` are plain `Map`s with no persistence, eviction, or size limits. In long-running use (or if multiple large PDFs are uploaded), RAM grows unboundedly. There is no TTL or max-entry cap.
- Files: `ankinator-app/server/src/store.ts` lines 40–41
- Impact: Memory leak on sustained use. A server restart loses all documents and jobs — users must re-upload.
- Fix approach: Add an LRU cap (e.g., 50 documents, 100 jobs) or a TTL sweep; alternatively, persist to SQLite for single-user durability.

---

## Security Considerations

**No CORS, No Rate Limiting, No Authentication on the HTTP API:**
- Risk: Any process on the same machine (or on the network if the port is exposed) can call `/api/generate`, triggering arbitrary Claude CLI spawns or API calls. No auth layer exists.
- Files: `ankinator-app/server/src/index.ts`, `ankinator-app/server/src/api.ts`
- Current mitigation: Designed as a local single-user tool; port 8787 is not exposed by default.
- Recommendations: Add `cors` middleware configured to `localhost` origin only; add basic rate-limiting per IP for `/api/generate` to prevent accidental or malicious abuse; document that the server must not be exposed to untrusted networks.

**`resolveWithinAllowed` Uses `throw new Error` (Not `isError`):**
- Risk: Path traversal attempts cause an unhandled exception to bubble up to the MCP framework rather than returning a structured error. If the MCP transport catches this differently across SDK versions, it may expose stack traces.
- Files: `ankinator-mcp/src/index.ts` line 105
- Current mitigation: Exception is caught by the outer MCP framework.
- Recommendations: Convert to `isError: true` response with no stack trace in the message.

**Uploaded PDFs Stored in System `/tmp` Without Cleanup:**
- Risk: PDFs uploaded via `/api/upload` are written to `os.tmpdir()/ankinator-uploads/` and never explicitly deleted after processing.
- Files: `ankinator-app/server/src/api.ts` lines 22–37
- Current mitigation: OS temp dir is periodically cleaned on most systems.
- Recommendations: Delete the temp file after `/api/extract` completes, or add a cleanup pass on server startup.

---

## Performance Bottlenecks

**CliProvider — Sequential PDF Processing (One Chunk Per `claude -p` Spawn):**
- Problem: Each semantic chunk triggers a new `spawn('claude', [...])` call. For a 90-chunk PDF this means 90 sequential process launches, each with its own cold-start overhead. The default timeout is 3 minutes per chunk.
- Files: `ankinator-app/server/src/core/providers/cli-provider.ts` lines 43–98
- Cause: The `claude` CLI does not support batch input; parallelism would require managing concurrent child processes and quota pressure.
- Improvement path: Add configurable concurrency (`ANKINATOR_CLI_CONCURRENCY=2`) with a semaphore, or allow the user to tune `maxCharsPerChunk` to reduce total chunk count.

**ChunkSessionManager — Full JSONL File Read on Every Request:**
- Problem: `getChunks`, `getChunkBatch`, and `getChunkMetadata` all read the entire `.jsonl` file into memory on each call. For a 270-page PDF the file is ~594KB of JSONL.
- Files: `ankinator-mcp/src/chunk-session-manager.ts` lines 116, 144, 173
- Cause: JSONL does not support random access without an index.
- Improvement path: Build an in-memory byte-offset index on session creation; use `fs.createReadStream` with a byte range for random access.

**`ankinator-mcp/src/index.ts` — Startup Parse of All Zod Schemas:**
- Problem: The 2,484-line file defines all schemas at module load time. Each startup (MCP spawns once per Claude Code session, but re-spawns if crashed) parses every schema.
- Files: `ankinator-mcp/src/index.ts`
- Cause: No lazy loading.
- Improvement path: Addressed as part of the god-file decomposition.

---

## Fragile Areas

**CliProvider — JSON Envelope Parsing Is Best-Effort:**
- Files: `ankinator-app/server/src/core/providers/cli-provider.ts` lines 83–91
- Why fragile: The provider tries `JSON.parse(stdout)` and falls back to raw stdout if parsing fails. If the CLI changes its output format (envelope shape, new fields, streaming), the fallback silently swallows the change and returns whatever text the CLI printed, leading to 0 questions extracted without any error surfaced.
- Safe modification: Add a `console.warn` on the catch path and validate that the parsed envelope has a `result` field; treat missing `result` as an error.
- Test coverage: No unit tests for CliProvider envelope parsing.

**`parseQuestoesJson` — Fragile Heuristic JSON Extraction:**
- Files: `ankinator-app/server/src/core/generation.ts` lines 58–72
- Why fragile: Extracts JSON by finding the first `{` and last `}` in the response text. If the LLM includes any JSON-like text before or after the actual payload (commentary, code fences not fully stripped), extraction silently returns `[]`.
- Safe modification: Log a warning when extraction returns empty for non-empty input; the `ApiProvider` already uses tool-use forcing which avoids this, but `CliProvider` does not.
- Test coverage: No tests for malformed LLM output.

**ODL Parse — Silently Falls Back to Empty Markdown:**
- Files: `ankinator-app/server/src/core/odl-parse.ts` line 151
- Why fragile: `fs.readFile(mdPath).catch(() => '')` silently swallows missing markdown files. If OpenDataLoader produces only JSON (no `.md` output), the document's `markdown` field falls back to a reconstruction from `elements`, which may not match OpenDataLoader's reading-order intent.
- Safe modification: Log a warning when the markdown file is absent; consider it a soft error worth surfacing in the `/extract` response.
- Test coverage: No tests for missing `.md` output from ODL.

**`resolveWithinAllowed` — Relative Path Resolution Uses `PROJECT_ROOT` Fallback for Non-Absolute Paths:**
- Files: `ankinator-mcp/src/index.ts` lines 98–108
- Why fragile: When `userPath` is relative, `base = PROJECT_ROOT` is assumed. `PROJECT_ROOT` is computed as `path.resolve(__dirname, '..', '..')`, which means it depends on where `dist/index.js` lives. If the `dist/` directory is moved or renamed (e.g., during a build refactor), all path resolution breaks silently.
- Safe modification: Document the expected directory structure and add a startup assertion that `PROJECT_ROOT` points to a valid directory containing `package.json`.

---

## Scaling Limits

**In-Memory Job Store (ankinator-app):**
- Current capacity: Unbounded in-memory Map; memory grows with each upload/generate cycle.
- Limit: JVM/Node heap (default ~1.5GB); a few hundred large PDFs with many questoes arrays would approach this.
- Scaling path: Add an LRU with max 50 entries in `jobStore`; evict completed jobs after 1 hour.

**MCP Chunk Sessions — Disk Storage:**
- Current capacity: Each 270-page PDF session = ~594KB JSONL on disk. Sessions live for 24h before cleanup.
- Limit: Constrained by available disk space; no cap on concurrent sessions per user.
- Scaling path: Add a `MAX_SESSIONS` constant and refuse new session creation when exceeded.

---

## Dependencies at Risk

**`pdf-parse` (MCP) — Uses Deprecated Extraction API:**
- Risk: `ankinator-mcp` uses `pdf-parse` v2.4.5 with the `PDFParse` class API. The `ankinator-app` server has already migrated to `@opendataloader/pdf` (Java-backed) for better text fidelity. The MCP still uses the older extraction approach, producing character-count-based page simulation instead of real page boundaries.
- Impact: MCP-generated question sets may have incorrect page references; extraction quality inferior to the app's pipeline.
- Migration plan: Replace MCP's `PdfManager` with a call to the same `@opendataloader/pdf` library, or expose an `/extract` API endpoint from the app server for the MCP to call.

**`@opendataloader/pdf` — Requires Java 11+ on PATH:**
- Risk: The `document-loader.ts` explicitly requires Java 11+ at runtime. There is no startup check; the failure only surfaces when the first PDF is processed, producing a confusing error. No `.nvmrc`-equivalent for Java version.
- Impact: Silent first-run failure; users with Java absent or Java 8 get a cryptic error from the ODL CLI.
- Migration plan: Add a startup health check that runs `java -version` and logs a clear warning if missing or too old; surface this in `/api/health`.

**Anki Version Data — Static JSON Frozen at 24.04.1 (2024-04):**
- Risk: `anki-versions.json` sets `versao_maxima_testada: "24.04.1"` (April 2024). Current date is June 2026; Anki has released many versions since then. The MCP tool `consultar_versoes_anki` returns stale data.
- Impact: Users relying on version compatibility data get outdated information; breaking changes in newer Anki versions (e.g., 24.06, 25.x, 26.x) are not documented.
- Migration plan: Replace static JSON with a live fetch from the Anki GitHub releases API, or at minimum add a `data_atualizacao` field to the JSON and implement a scheduled update script.

**`process.loadEnvFile` — Node 22+ Only API:**
- Risk: `ankinator-app/server/src/config.ts` line 15 calls `process.loadEnvFile()`, which was introduced in Node.js v22.0.0. No `.nvmrc` or `engines` field in `package.json` documents this requirement.
- Impact: Silently fails (caught by `try/catch`) on Node < 22, meaning `.env` files are never loaded. Dev and CI environments on Node 20 LTS will see the env vars as undefined.
- Migration plan: Add `"engines": { "node": ">=22" }` to `ankinator-app/package.json` and `ankinator-app/server/package.json`; add `.nvmrc` with `22`.

---

## Missing Critical Features

**No Authentication or Multi-User Isolation (ankinator-app):**
- Problem: The app is designed as a single-user local tool. If port 8787 is accidentally exposed, any caller can trigger Claude CLI invocations or push cards to the local Anki instance.
- Blocks: Deployment in any shared or remote environment.

**No Persistent Question Storage (ankinator-app):**
- Problem: Generated questoes live only in memory (`jobStore.questoes`). A page refresh or server restart loses all generated cards that have not been exported.
- Blocks: Resumable workflows; multi-session editing of generated cards.

**OCR Path Not Fully Integrated in UI:**
- Problem: `ocr-loader.ts` provides OCR via Python backend (`ODL_PYTHON` env var), and the `/extract` endpoint accepts `{ ocr: true }`, but the web UI (`App.tsx`) calls `api.extract(docId)` without any OCR toggle option.
- Files: `ankinator-app/web/src/App.tsx` line 48; `ankinator-app/server/src/api.ts` line 79
- Blocks: Users with scanned PDFs have no way to enable OCR from the UI.

---

## Test Coverage Gaps

**No Unit Tests in `ankinator-app`:**
- What's not tested: All of `generation.ts` (including `parseQuestoesJson`, `mapRawQuestoes`), `chunker.ts`, `odl-parse.ts`, `CliProvider` envelope parsing, `ApiProvider` tool-use response parsing.
- Files: `ankinator-app/server/src/core/generation.ts`, `ankinator-app/server/src/core/chunker.ts`, `ankinator-app/server/src/core/odl-parse.ts`, `ankinator-app/server/src/core/providers/cli-provider.ts`
- Risk: Regressions in JSON extraction or chunking logic go undetected.
- Priority: High

**MCP Integration Test Only (No Unit Tests):**
- What's not tested: Individual tool handlers, `PdfManager` methods, `ChunkSessionManager` edge cases (session not found, corrupted JSONL, mid-read restart), `TokenEstimator` boundary conditions.
- Files: `ankinator-mcp/tests/integration-test.js` (only file); no `*.test.*` files anywhere.
- Risk: Token limit regressions; path resolution edge cases; session corruption go undetected.
- Priority: High

**No Tests for Error Paths:**
- What's not tested: `isError: true` responses, what happens when `anthropicClient` is null when `extrair_questoes` is called, what happens when a session JSONL file is corrupted, what happens when the ODL Java binary is absent.
- Files: `ankinator-mcp/src/index.ts`, `ankinator-app/server/src/core/document-loader.ts`
- Risk: Error handling bugs ship silently.
- Priority: Medium

---

## Upgrade-2026 Worktree — Items Needing Update

**`@modelcontextprotocol/sdk` Version Compatibility:**
- The `as any` workarounds in `ankinator-mcp/src/index.ts` exist because the SDK's `registerTool` typing did not support inline schema objects at the time of writing. SDK is now at v1.22.0; verify if inline schemas now work to eliminate the 25 `as any` casts.

**Zod v4 Available but Mixed Usage:**
- Both packages use `zod: "^4.1.12"` but the MCP code pre-dates Zod v4's `.strict()` improvements and the new `.meta()` / `.describe()` API. Review if any schemas can be simplified with v4 idioms.

**`@anthropic-ai/sdk` v0.70.1 — Latest Model IDs:**
- `config.ts` defaults to `claude-sonnet-4-6` as the model ID. Verify this is the correct current identifier for the Sonnet 4.6 model in SDK 0.70.1; model IDs change across SDK minor versions and hardcoded strings break silently when a model is deprecated.
- Files: `ankinator-app/server/src/config.ts` line 32

**React 19 / Vite 7 — Cutting-Edge Versions:**
- `ankinator-app/web` uses `react: "^19.1.0"` and `vite: "^7.0.0"`. Both were very recent at the time of writing. Verify there are no breaking changes in React 19 concurrent features or Vite 7 build output that affect the SSE `EventSource` flow in `App.tsx`.
- Files: `ankinator-app/web/package.json`

---

*Concerns audit: 2026-06-03*
