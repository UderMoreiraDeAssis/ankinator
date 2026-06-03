# External Integrations

**Analysis Date:** 2026-06-03

## LLM / AI Generation

**Claude (Anthropic) — dual-provider architecture:**

The project implements a `QuestionProvider` interface with two concrete providers, selected by `ANKINATOR_PROVIDER` env var (default: `cli`).

### Provider 1: CliProvider (DEFAULT — subscription-based)

- **File:** `ankinator-app/server/src/core/providers/cli-provider.ts`
- **Mechanism:** Spawns `claude -p --output-format json --model <model> --system-prompt <...> --exclude-dynamic-system-prompt-sections --strict-mcp-config` as a child process via `node:child_process.spawn()`
- **Auth:** Uses the Claude Code CLI's existing login session (Pro/Max subscription). No API key needed. No per-token billing.
- **Config env vars:**
  - `ANKINATOR_CLAUDE_BIN` — path to the `claude` binary (default: `claude`)
  - `ANKINATOR_CLI_MODEL` — model alias/id passed to `--model` (default: `sonnet`)
  - `ANKINATOR_CLI_TIMEOUT_MS` — per-call timeout in ms (default: 180000)
- **Trade-offs:** Slower (one process spawn per chunk), output is plain text JSON (not structured tool-use), consumes plan quota
- **Provider selector:** `ankinator-app/server/src/core/providers/index.ts`, `createProvider()` returns `CliProvider` when `kind === 'cli'`

### Provider 2: ApiProvider (opt-in — token-billed)

- **File:** `ankinator-app/server/src/core/providers/api-provider.ts`
- **Mechanism:** Uses `@anthropic-ai/sdk` `client.messages.create()` with forced tool-use (`tool_choice: { type: 'tool', name: REGISTRAR_QUESTOES_TOOL.name }`) and prompt caching (`cache_control: ephemeral`) on both system prompt and tool definition
- **Auth:** `ANTHROPIC_API_KEY` environment variable
- **Config env vars:**
  - `ANTHROPIC_API_KEY` — required; server refuses to generate if absent when `ANKINATOR_PROVIDER=api`
  - `ANKINATOR_MODEL` — full model ID (default: `claude-sonnet-4-6`)
- **Advantages:** Structured output via tool-use (more reliable JSON), prompt cache reduces cost on long PDFs

### Server config source of truth

`ankinator-app/server/src/config.ts` reads all env vars and exports `config` object. The `canGenerate()` method returns `true` for `cli` always, and for `api` only when `hasApiKey()` is true.

---

### MCP server (ankinator-mcp) — API-only, older path

- **File:** `ankinator-mcp/src/index.ts`
- **Mechanism:** Initializes `new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })` at startup. Tools that call Claude (`gerarQuestoes`, `gerarQuestoesBatch`) require `ANTHROPIC_API_KEY` set and return an error message if absent.
- **Note:** The MCP server predates the CLI provider and has not been updated to support the subscription path. PDF extraction tools in the MCP do NOT require an API key.

---

## PDF Extraction

### OpenDataLoader (primary — `ankinator-app`)

- **Package:** `@opendataloader/pdf` ^2.4.7
- **File:** `ankinator-app/server/src/core/document-loader.ts`
- **Mechanism:** Calls `convert([pdfPath], options)` from the npm wrapper; the package internally invokes a Java CLI. Produces Markdown + JSON output in a temp directory, then parsed by `ankinator-app/server/src/core/odl-parse.ts`.
- **External requirement:** Java 11+ must be in PATH
- **Config:** `tableMethod: cluster`, `readingOrder: xycut`, `imageOutput: off` (hardcoded optimal settings for Brazilian exam PDFs)

### OpenDataLoader OCR backend (optional — Python)

- **File:** `ankinator-app/server/src/core/ocr-loader.ts`
- **Mechanism:** Spawns `python -m opendataloader_pdf <pdf> --force-ocr` when `ODL_PYTHON` is set and `isOcrAvailable()` returns true
- **Auth:** None (local process)
- **Config env var:** `ODL_PYTHON` — path to Python interpreter (e.g., `/usr/bin/python3`)
- **Install:** `pip install "opendataloader-pdf[hybrid]"` (not an npm dependency)
- **Fallback:** If unavailable, the server returns an error message to the client; OCR is strictly opt-in

### pdf-parse (legacy — `ankinator-mcp`)

- **Package:** `pdf-parse` ^2.4.5
- **File:** `ankinator-mcp/src/pdf-manager.ts`
- **Mechanism:** `new PDFParse({ data: buffer })` — plain text extraction, no layout analysis
- **Note:** Used only in the MCP server, which predates the OpenDataLoader integration

---

## Anki Integration

### AnkiConnect (direct push export)

- **File:** `ankinator-app/server/src/core/exporters/ankiconnect.ts`
- **Mechanism:** HTTP POST to AnkiConnect's JSON-RPC API (`action`, `version: 6`, `params`) using the native `fetch()` API
- **Endpoint:** `http://127.0.0.1:8765` (configurable via `ANKICONNECT_URL`)
- **Auth:** None (local HTTP; AnkiConnect add-on must be installed in Anki desktop, code 2055492159)
- **Operations used:** `version` (health check), `deckNames` (list decks), `createDeck`, `addNotes`
- **Card format:** Note type `Basic` with `Front`/`Back` fields; HTML-encoded content with page source attribution

### CSV Export (file-based Anki import)

- **File:** `ankinator-app/server/src/core/exporters/csv.ts`
- **Mechanism:** Generates UTF-8 BOM CSV (`﻿` prefix) with `;` delimiter using `csv-stringify`
- **Format:** Columns: `Frente;Verso;Tags;Fonte` — compatible with Anki's CSV importer
- **Auth:** None (no external service)

---

## MCP Protocol

**MCP server transport:**
- **File:** `ankinator-mcp/src/index.ts`
- **Transport:** `StdioServerTransport` — communicates over stdin/stdout when launched as an MCP server by a client (e.g., Claude Code via `.claude/settings.json`)
- **SDK:** `@modelcontextprotocol/sdk` ^1.22.0

---

## Data Storage

**Databases:** None — no database used anywhere in the stack

**In-memory state (server):**
- `ankinator-app/server/src/store.ts` — two in-memory Maps (`docs`, `jobs`) storing document entries and generation jobs; state resets on server restart

**File storage:**
- Uploaded PDFs: written to `os.tmpdir()/ankinator-uploads/` by multer; cleaned up when the server restarts
- OpenDataLoader temp outputs: `os.tmpdir()/ankinator-odl-*` temp dirs; cleaned up after parsing
- MCP chunk sessions: `ankinator-mcp/chunk-sessions/` (gitignored, persisted to disk between MCP calls)

**Caching:** None (beyond Node.js module cache)

---

## Authentication & Identity

**Auth Provider:** None — local single-user application, no user authentication

---

## Monitoring & Observability

**Error Tracking:** None

**Logs:** `console.error('[ankinator] erro:', message)` in Express error handler (`ankinator-app/server/src/index.ts`); no structured logging framework

**Progress streaming:** Server-Sent Events (SSE) at `GET /api/jobs/:jobId/events` — streams `ChunkProgress` events during generation; consumed by `new EventSource(...)` in the web UI (`ankinator-app/web/src/api.ts`)

---

## CI/CD & Deployment

**Hosting:** Local only — no cloud deployment documented

**CI Pipeline:** None detected

---

## Environment Configuration Summary

| Env Var | Used By | Purpose | Default |
|---------|---------|---------|---------|
| `ANKINATOR_PROVIDER` | server `config.ts` | `cli` or `api` generation path | `cli` |
| `ANTHROPIC_API_KEY` | server `api-provider.ts`, MCP `index.ts` | Anthropic API auth (opt-in for server, required for MCP gen tools) | — |
| `ANKINATOR_MODEL` | server `config.ts` | Full model ID for API provider | `claude-sonnet-4-6` |
| `ANKINATOR_CLI_MODEL` | server `config.ts` | Model alias for CLI provider | `sonnet` |
| `ANKINATOR_CLAUDE_BIN` | `cli-provider.ts` | Path to `claude` binary | `claude` |
| `ANKINATOR_CLI_TIMEOUT_MS` | `cli-provider.ts` | Per-chunk CLI timeout (ms) | `180000` |
| `ANKICONNECT_URL` | `ankiconnect.ts`, `config.ts` | AnkiConnect HTTP endpoint | `http://127.0.0.1:8765` |
| `PORT` | `config.ts` | Server listen port | `8787` |
| `ODL_PYTHON` | `ocr-loader.ts` | Python interpreter for OCR | — |

**Secrets location:** `.env` file(s) in `ankinator-app/` or `ankinator-app/server/` — gitignored

---

## Webhooks & Callbacks

**Incoming:** None

**Outgoing:** None (AnkiConnect is a local HTTP call, not a webhook)

---

*Integration audit: 2026-06-03*
