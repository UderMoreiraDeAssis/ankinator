<!-- refreshed: 2026-06-03 -->
# Architecture

**Analysis Date:** 2026-06-03

> ⚠️ **Snapshot de 2026-06-03** (mapeamento `gsd-map-codebase`, pré-Phase 3). O estado corrente vive em `.planning/STATE.md` + `.planning/ROADMAP.md`. Afirmações aqui podem estar **vencidas** — ex.: a suíte **vitest (~250 testes)** foi instalada na Phase 3 e `server/src/core/specialists/` já existe; o tipo `Questao` ganhou campos novos (deck/tags/mnemônico/svg). Ver `.planning/FRAMING-REVIEW.md` §8 (C6).

## System Overview

```text
┌──────────────────────────────────────────────────────────────────┐
│                    Browser (React + Vite + Tailwind)             │
│  FileDrop → StructurePanel → ProgressPanel → CardTable → Export  │
│  `ankinator-app/web/src/App.tsx`                                  │
└──────────────────────────┬───────────────────────────────────────┘
                           │ HTTP / SSE  (/api/*)
                           ▼
┌──────────────────────────────────────────────────────────────────┐
│              Express API Server (Node 22+, ESM)                   │
│  `ankinator-app/server/src/index.ts`                              │
│  `ankinator-app/server/src/api.ts`   (all routes)                 │
│  `ankinator-app/server/src/store.ts` (in-memory doc+job state)    │
└──────────────┬──────────────────────────────┬────────────────────┘
               │                              │
               ▼                              ▼
┌──────────────────────────┐   ┌──────────────────────────────────┐
│  Core Pipeline           │   │  Exporters                       │
│  `server/src/core/`      │   │  `server/src/core/exporters/`    │
│                          │   │  csv.ts   → Anki CSV download    │
│  document-loader.ts      │   │  ankiconnect.ts → Anki live push │
│  odl-parse.ts            │   └──────────────────────────────────┘
│  ocr-loader.ts           │
│  chunker.ts              │   ┌──────────────────────────────────┐
│  prompts.ts              │   │  LLM Providers                   │
│  generation.ts           │   │  `server/src/core/providers/`    │
│  types.ts                │   │  cli-provider.ts  (claude CLI)   │
└──────────────┬───────────┘   │  api-provider.ts  (Anthropic SDK)│
               │               └──────────────┬───────────────────┘
               ▼                              │
┌──────────────────────────────────────────── ▼ ─────────────────┐
│  External Systems                                                │
│  @opendataloader/pdf (Java 11+)   — PDF → structured JSON/MD    │
│  opendataloader_pdf (Python, opt) — OCR path (scanned PDFs)     │
│  claude CLI / Anthropic API       — question generation (LLM)   │
│  AnkiConnect :8765                — push cards to Anki          │
└────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│  MCP Server (separate process, stdio transport)                  │
│  `ankinator-mcp/src/index.ts`                                    │
│  Legacy Claude-Code integration; exposes PDF tools, CSV tools,   │
│  changelog/roadmap helpers via MCP protocol.                     │
└──────────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| `index.ts` (server) | Bootstrap Express, serve static SPA in prod | `ankinator-app/server/src/index.ts` |
| `api.ts` | All HTTP route handlers; orchestrates pipeline | `ankinator-app/server/src/api.ts` |
| `config.ts` | Env-var config (port, provider, model, AnkiConnect URL) | `ankinator-app/server/src/config.ts` |
| `store.ts` | In-memory `documentStore` and `jobStore` (single-user) | `ankinator-app/server/src/store.ts` |
| `document-loader.ts` | Calls `@opendataloader/pdf` (Java), delegates OCR path | `ankinator-app/server/src/core/document-loader.ts` |
| `odl-parse.ts` | Parses OpenDataLoader JSON/MD output → `LoadedDocument` | `ankinator-app/server/src/core/odl-parse.ts` |
| `ocr-loader.ts` | Optional OCR path via Python `opendataloader_pdf` | `ankinator-app/server/src/core/ocr-loader.ts` |
| `chunker.ts` | Semantic chunking: sections → `SemanticChunk[]` | `ankinator-app/server/src/core/chunker.ts` |
| `prompts.ts` | System prompt, JSON output instruction, tool schema, `buildUserMessage()` | `ankinator-app/server/src/core/prompts.ts` |
| `generation.ts` | `generateAll()` orchestrator + `QuestionProvider` interface | `ankinator-app/server/src/core/generation.ts` |
| `api-provider.ts` | Anthropic SDK provider (tool-use forced output + prompt caching) | `ankinator-app/server/src/core/providers/api-provider.ts` |
| `cli-provider.ts` | Claude CLI provider (spawns `claude -p`, parses JSON envelope) | `ankinator-app/server/src/core/providers/cli-provider.ts` |
| `csv.ts` | Produces Anki-compatible CSV (UTF-8 BOM, `;` delimiter) | `ankinator-app/server/src/core/exporters/csv.ts` |
| `ankiconnect.ts` | HTTP calls to AnkiConnect add-on (port 8765) | `ankinator-app/server/src/core/exporters/ankiconnect.ts` |
| `App.tsx` | Single React root — step machine (upload→structure→generating→review) | `ankinator-app/web/src/App.tsx` |
| `api.ts` (web) | Typed fetch wrappers + `EventSource` factory for SSE | `ankinator-app/web/src/api.ts` |
| `index.ts` (MCP) | MCP server bootstrap + all tool registrations (79KB monolith) | `ankinator-mcp/src/index.ts` |

## Pattern Overview

**Overall:** Layered pipeline — upload → extract → chunk → generate → review → export.

**Key Characteristics:**
- Server is single-user (in-memory `Map`-based store; no database).
- Generation runs as a background async job; progress is streamed to the browser via Server-Sent Events (SSE).
- LLM provider is swappable at runtime via `ANKINATOR_PROVIDER` env var (`cli` | `api`).
- The CLI provider spawns the `claude` CLI as a subprocess per chunk; the API provider uses the Anthropic SDK with tool-use and prompt caching.
- Frontend is a pure SPA (React + Vite); in production the Express server serves `web/dist` and handles SPA fallback.

## Layers

**Transport / HTTP Layer:**
- Purpose: Parse HTTP requests, validate inputs, return JSON or stream SSE.
- Location: `ankinator-app/server/src/api.ts`
- Contains: Express Router, multer upload, all route handlers.
- Depends on: Core Pipeline, Store.
- Used by: Browser (web), curl/scripts.

**Store Layer:**
- Purpose: In-memory state for uploaded documents and running/completed jobs.
- Location: `ankinator-app/server/src/store.ts`
- Contains: `documentStore` (DocEntry map), `jobStore` (Job map + SSE subscriber sets).
- Depends on: Core types.
- Used by: API routes.

**Core Pipeline Layer:**
- Purpose: All business logic: PDF loading, chunking, prompt building, question generation, output parsing.
- Location: `ankinator-app/server/src/core/`
- Contains: `document-loader.ts`, `odl-parse.ts`, `ocr-loader.ts`, `chunker.ts`, `prompts.ts`, `generation.ts`, `types.ts`, plus `providers/` and `exporters/` subdirectories.
- Depends on: External tools (`@opendataloader/pdf`, `claude` CLI or Anthropic SDK, AnkiConnect).
- Used by: API transport layer.

**Provider Abstraction:**
- Purpose: Decouple question generation from the LLM backend.
- Location: `ankinator-app/server/src/core/providers/`
- Contains: `QuestionProvider` interface (in `generation.ts`), `ApiProvider`, `CliProvider`, `createProvider()` factory.
- Depends on: `prompts.ts`, `generation.ts` utilities.
- Used by: `generation.ts` `generateAll()`.

**Exporter Layer:**
- Purpose: Transform `Questao[]` into Anki-compatible formats.
- Location: `ankinator-app/server/src/core/exporters/`
- Contains: `csv.ts` (download), `ankiconnect.ts` (live push).
- Depends on: `types.ts`.
- Used by: API export routes.

**Frontend Layer:**
- Purpose: Step-based UI for upload, section selection, progress monitoring, review and export.
- Location: `ankinator-app/web/src/`
- Contains: `App.tsx` (state machine), `api.ts` (fetch wrappers), `types.ts` (mirrored types), `components/`.
- Depends on: Server API (`/api/*`).
- Used by: End user.

**MCP Server (separate):**
- Purpose: Legacy Claude Code integration — exposes PDF tools, CSV validation, Anki data, changelog helpers via MCP stdio transport.
- Location: `ankinator-mcp/src/`
- Contains: `index.ts` (79KB monolith with all tool registrations), `pdf-manager.ts`, `chunk-session-manager.ts`, `token-utils.ts`, `managers/question-session-manager.ts`, `utils/anki-csv-formatter.ts`, `helpers/changelog-parser.ts`.
- Depends on: `pdf-parse`, `@anthropic-ai/sdk`, `@modelcontextprotocol/sdk`.
- Used by: Claude Code via MCP protocol (stdio).

## Data Flow

### Primary Request Path — Upload PDF → Export Cards

1. User drops PDF → `POST /api/upload` (multer disk storage to `os.tmpdir()/ankinator-uploads/`) → returns `docId` (`ankinator-app/server/src/api.ts:68`)
2. Auto-extract: `POST /api/extract` → `loadDocument()` → invokes `@opendataloader/pdf` Java CLI → `parseOdlOutput()` → `LoadedDocument` stored in `documentStore` (`ankinator-app/server/src/core/document-loader.ts:33`, `odl-parse.ts`)
3. UI shows sections; user selects and clicks generate.
4. `POST /api/generate` → `chunkDocument()` → `SemanticChunk[]`; job created in `jobStore`; `generateAll()` starts in background (`ankinator-app/server/src/api.ts:108`)
5. `GET /api/jobs/:id/events` (SSE) → client subscribes; `jobStore.emit()` pushes `progress`/`done`/`error` events (`ankinator-app/server/src/api.ts:183`, `store.ts:78`)
6. For each chunk: `provider.generateForChunk(chunk, opts)` (`generation.ts:86`) — either:
   - `CliProvider`: spawns `claude -p --output-format json --model sonnet ...`, sends prompt via stdin, parses JSON envelope (`providers/cli-provider.ts:43`)
   - `ApiProvider`: calls `client.messages.create()` with forced tool-use `registrar_questoes`, parses `ToolUseBlock.input` (`providers/api-provider.ts:22`)
7. `parseQuestoesJson()` / `mapRawQuestoes()` normalise raw output → `Questao[]` with UUIDs and page attribution (`generation.ts:43-55`)
8. On SSE `done`, client fetches `GET /api/jobs/:id` to get `questoes[]`.
9. User reviews/edits cards in `CardTable.tsx`.
10. Export: `POST /api/export/csv` → `toAnkiCsv()` → CSV download, **or** `POST /api/export/ankiconnect` → `pushToAnki()` → HTTP to AnkiConnect `:8765`.

### OCR Path (optional)

1. User selects OCR option in UI.
2. `POST /api/extract` with `{ ocr: true }`.
3. `loadDocument()` checks `isOcrAvailable()` (requires `ODL_PYTHON` env + `opendataloader_pdf` Python package).
4. `runOcrLoader()` spawns Python CLI with `--force-ocr`; reuses `parseOdlOutput()` on output. (`ankinator-app/server/src/core/ocr-loader.ts`)

**State Management:**
- Server: plain `Map`s in `store.ts` (process-scoped, reset on restart). No persistence.
- Frontend: React `useState` in `App.tsx`. Steps: `'upload' | 'structure' | 'generating' | 'review'`. Cards held in `cards: Questao[]`, dropped IDs in `dropped: Set<string>`.

## Key Abstractions

**`QuestionProvider` interface:**
- Purpose: Decouple generation orchestration from LLM backend.
- Defined in: `ankinator-app/server/src/core/generation.ts:36`
- Implementations: `ApiProvider` (`providers/api-provider.ts`), `CliProvider` (`providers/cli-provider.ts`)
- Pattern: Strategy pattern — `createProvider(cfg)` factory selects at startup.

**`Questao` type:**
- Purpose: Universal flashcard type flowing through the whole pipeline.
- Defined in: `ankinator-app/server/src/core/types.ts:87` (server), mirrored in `ankinator-app/web/src/types.ts:28` (web)
- Fields: `id` (UUID), `tipo` (`'extraida' | 'criada'`), `pergunta`, `resposta`, `pageStart`, `pageEnd`, optional `metadata` (banca/ano/alternativas/gabarito).

**`LoadedDocument` type:**
- Purpose: Structured PDF output used by chunker and returned by `/extract`.
- Defined in: `ankinator-app/server/src/core/types.ts:48`
- Fields: `markdown` (full reading-order markdown), `sections: Section[]`, `elements: DocElement[]`, `usedOcr`.

**`SemanticChunk` type:**
- Purpose: Unit of work sent to the LLM.
- Defined in: `ankinator-app/server/src/core/types.ts:63`
- Built by: `chunker.ts:chunkDocument()`; default budget is 12,000 chars per chunk.

**`Job` type:**
- Purpose: Tracks async generation state and SSE subscribers.
- Defined in: `ankinator-app/server/src/store.ts:21`
- Fields: `status`, `progress[]`, `questoes[]`, `subscribers: Set<fn>`.

## Entry Points

**Express Server:**
- Location: `ankinator-app/server/src/index.ts`
- Triggers: `node dist/index.js` (or `npm start --workspace server`)
- Responsibilities: Mount `/api` router, serve `web/dist` SPA in production, central error handler.

**Vite Dev Server (web):**
- Location: `ankinator-app/web/src/main.tsx`
- Triggers: `npm run dev --workspace web`
- Responsibilities: React root mount, proxy `/api` to Express (via `vite.config.ts`).

**MCP Server:**
- Location: `ankinator-mcp/src/index.ts`
- Triggers: `node dist/index.js` over stdio (configured in Claude Code MCP settings)
- Responsibilities: Register all MCP tools; expose PDF extraction, CSV validation, Anki data, changelog helpers.

## Architectural Constraints

- **Threading:** Node.js single-threaded event loop. `generateAll()` runs in the same event loop — each chunk awaits the CLI subprocess or API call sequentially to respect rate limits.
- **Global state:** Two module-level `Map`s in `ankinator-app/server/src/store.ts` (`docs`, `jobs`). State is lost on server restart.
- **Circular imports:** None detected.
- **Java dependency:** `@opendataloader/pdf` requires Java 11+ in `PATH` at runtime. Missing Java causes `POST /api/extract` to fail.
- **CLI provider dependency:** `CliProvider` requires the `claude` CLI binary logged-in and in `PATH` (or `ANKINATOR_CLAUDE_BIN` env var).
- **File upload temp dir:** Uploaded PDFs land in `os.tmpdir()/ankinator-uploads/` and are never cleaned up automatically.
- **MCP monolith:** `ankinator-mcp/src/index.ts` is 79KB with all tool registrations inline — no modular splitting.

## Anti-Patterns

### MCP index.ts Monolith

**What happens:** All MCP tools are defined inline in `ankinator-mcp/src/index.ts` (79KB), including schemas, handlers, helpers and business logic.
**Why it's wrong:** The file is impossible to navigate, test, or extend without merge conflicts. Helper functions like `extractSection()`, `resolveWithinAllowed()`, and CSV validation are buried inline.
**Do this instead:** Extract each tool into a separate file under `ankinator-mcp/src/tools/`, following the same pattern as `managers/question-session-manager.ts` and `helpers/changelog-parser.ts`.

### No Upload Cleanup

**What happens:** PDFs uploaded to `os.tmpdir()/ankinator-uploads/` are never deleted. Each upload via `POST /api/upload` persists until the OS cleans the temp directory.
**Why it's wrong:** Repeated use accumulates large PDF files in temp storage.
**Do this instead:** Delete the file after generation completes (or fails) in `api.ts`, or add a TTL cleanup on server start.

### Duplicated `Questao` Type

**What happens:** `Questao` and related types are defined in both `ankinator-app/server/src/core/types.ts` and `ankinator-app/web/src/types.ts`.
**Why it's wrong:** Divergence risk — changes to one must be manually mirrored to the other.
**Do this instead:** Publish a shared `types` workspace package, or generate web types from the server source.

## Error Handling

**Strategy:** Async errors in route handlers bubble up to Express 5's central error handler (`ankinator-app/server/src/index.ts:31`). Generation errors per chunk are isolated in `generateAll()` — a failing chunk is logged in `erros[]` and processing continues.

**Patterns:**
- API routes: `try/catch` with `res.status(4xx/502).json({ error: message })`.
- Generation orchestration: per-chunk `try/catch` in `generateAll()` — errors accumulate in `erros[]` array, not thrown.
- MCP server: throws `Error` objects; MCP SDK converts to JSON-RPC error responses.
- Frontend: `try/catch` in `handleFile()` and `handleGenerate()` → sets `error` state string displayed inline.

## Cross-Cutting Concerns

**Logging:** `console.log` / `console.error` with `[ankinator]` prefix. No structured logging framework.
**Validation:** Zod schemas in `ankinator-mcp/src/index.ts` for MCP tool inputs. Express routes rely on runtime checks and early `return res.status(400)` guards.
**Authentication:** None — single-user local app, no auth on any route.

---

*Architecture analysis: 2026-06-03*
