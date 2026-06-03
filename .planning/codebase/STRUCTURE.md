# Codebase Structure

**Analysis Date:** 2026-06-03

## Directory Layout

```
upgrade-2026/                        # repo root (worktree)
├── ankinator-app/                   # Web app (npm workspaces monorepo)
│   ├── package.json                 # Workspace root; scripts: dev, build, start
│   ├── server/                      # Express API + core pipeline (TypeScript ESM)
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── src/
│   │   │   ├── index.ts             # Server bootstrap + SPA static serving
│   │   │   ├── api.ts               # All HTTP route handlers
│   │   │   ├── config.ts            # Env-var configuration
│   │   │   ├── store.ts             # In-memory document + job state
│   │   │   └── core/                # All business logic
│   │   │       ├── types.ts         # Canonical domain types
│   │   │       ├── document-loader.ts  # loadDocument() — OpenDataLoader (Java)
│   │   │       ├── odl-parse.ts     # parseOdlOutput() — JSON/MD → LoadedDocument
│   │   │       ├── ocr-loader.ts    # runOcrLoader() — OCR via Python (optional)
│   │   │       ├── chunker.ts       # chunkDocument() — semantic chunking
│   │   │       ├── generation.ts    # generateAll() + QuestionProvider interface
│   │   │       ├── prompts.ts       # System prompt, buildUserMessage(), tool schema
│   │   │       ├── providers/
│   │   │       │   ├── index.ts     # createProvider() factory
│   │   │       │   ├── api-provider.ts  # Anthropic SDK provider (tool-use)
│   │   │       │   └── cli-provider.ts  # claude CLI provider (subprocess)
│   │   │       └── exporters/
│   │   │           ├── csv.ts       # toAnkiCsv() — Anki CSV download
│   │   │           └── ankiconnect.ts  # pushToAnki() — AnkiConnect HTTP push
│   │   └── dist/                    # Compiled output (gitignored)
│   └── web/                         # React SPA (Vite + Tailwind)
│       ├── package.json
│       ├── vite.config.ts           # Proxy /api → :8787 in dev
│       ├── tailwind.config.js
│       ├── index.html
│       ├── src/
│       │   ├── main.tsx             # React root mount
│       │   ├── App.tsx              # Step-machine state + main layout
│       │   ├── api.ts               # Typed fetch wrappers + EventSource factory
│       │   ├── types.ts             # Mirrored domain types (Questao, etc.)
│       │   ├── index.css            # Tailwind directives
│       │   └── components/
│       │       ├── Stepper.tsx      # Step indicator (upload/structure/generating/review)
│       │       ├── FileDrop.tsx     # Drag-and-drop PDF input
│       │       ├── StructurePanel.tsx  # Section selection + generation options
│       │       ├── ProgressPanel.tsx   # SSE progress display
│       │       ├── CardTable.tsx    # Review/edit flashcard table
│       │       └── ExportBar.tsx    # CSV download + AnkiConnect push UI
│       └── dist/                    # Vite build output (served by Express in prod)
├── ankinator-mcp/                   # MCP server (separate process)
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/
│   │   ├── index.ts                 # MCP server + all tool registrations (79KB)
│   │   ├── pdf-manager.ts           # PdfManager class (pdf-parse based)
│   │   ├── chunk-session-manager.ts # JSONL-based chunk session storage
│   │   ├── token-utils.ts           # TokenEstimator class
│   │   ├── managers/
│   │   │   └── question-session-manager.ts  # JSONL-based question session storage
│   │   ├── helpers/
│   │   │   └── changelog-parser.ts  # Changelog/roadmap parsing utilities
│   │   ├── types/
│   │   │   ├── questao-types.ts     # Questao, QuestaoChunk, QuestaoSession types
│   │   │   └── release-notes.ts     # ChangelogEntry type
│   │   ├── utils/
│   │   │   └── anki-csv-formatter.ts  # AnkiCsvFormatter class (legacy)
│   │   └── data/                    # Static JSON data files
│   │       ├── anki-hooks.json
│   │       ├── anki-installation.json
│   │       └── anki-versions.json
│   ├── docs/                        # MCP usage docs (USAGE.md, ANKI_REFERENCE.md, etc.)
│   ├── examples/csv/                # Sample CSV files
│   ├── scripts/                     # Utility scripts
│   └── tests/                       # MCP tests
├── legacy/                          # Old standalone scripts (Node.js, no TypeScript)
│   ├── README.md
│   ├── extract-pdf-text.js
│   ├── extrair-questoes-completo.js
│   ├── processar-chunks-questoes.js
│   ├── test-anki-workflow.js
│   └── ... (other scripts)
├── .planning/codebase/              # GSD codebase analysis documents
├── .claude/                         # Project-level Claude config (CLAUDE.md, worktrees/)
├── .vscode/                         # VS Code settings
├── package.json                     # Root (no workspaces — only meta)
├── CLAUDE.md                        # Project instructions for Claude
└── README.md
```

## Directory Purposes

**`ankinator-app/server/src/core/`:**
- Purpose: All business logic — the pipeline from PDF bytes to `Questao[]`.
- Contains: Domain types, document loading, OCR, chunking, prompt construction, generation orchestration, LLM providers, exporters.
- Key files: `types.ts` (canonical types), `generation.ts` (`QuestionProvider` interface + `generateAll()`), `prompts.ts` (all LLM prompts).

**`ankinator-app/server/src/core/providers/`:**
- Purpose: Swappable LLM backends.
- Contains: `createProvider()` factory, `ApiProvider`, `CliProvider`.
- Key files: `index.ts` (factory), `cli-provider.ts` (subprocess approach, default), `api-provider.ts` (tool-use + prompt caching).

**`ankinator-app/server/src/core/exporters/`:**
- Purpose: Convert `Questao[]` to Anki-ready formats.
- Contains: `csv.ts` (UTF-8 BOM CSV for Anki import), `ankiconnect.ts` (live HTTP push to Anki desktop).

**`ankinator-app/web/src/components/`:**
- Purpose: UI components for each step of the wizard.
- Contains: One component per UI concern, named after their role in the step machine.

**`ankinator-mcp/src/`:**
- Purpose: MCP server exposing PDF, CSV and Anki tools for use within Claude Code sessions.
- Contains: Monolithic `index.ts` (all tools), manager classes for session state, helper parsers, static Anki data.

**`legacy/`:**
- Purpose: Archived Node.js scripts from before the web app existed. Not used by the current app.
- Contains: Old `pdf-parse`-based extraction scripts, session-based iterative workflows, Anki push tests.
- Generated: No. Committed: Yes (historical reference).

## Key File Locations

**Entry Points:**
- `ankinator-app/server/src/index.ts`: Express server start.
- `ankinator-app/web/src/main.tsx`: React SPA mount.
- `ankinator-mcp/src/index.ts`: MCP server start.

**Configuration:**
- `ankinator-app/server/src/config.ts`: All server runtime config (reads `.env`).
- `ankinator-app/web/vite.config.ts`: Vite dev proxy config.
- `ankinator-app/server/tsconfig.json`: Server TypeScript config (ESM, Node22 target).
- `ankinator-mcp/tsconfig.json`: MCP TypeScript config.

**Core Logic:**
- `ankinator-app/server/src/core/types.ts`: Single source of truth for all domain types.
- `ankinator-app/server/src/core/generation.ts`: `QuestionProvider` interface + `generateAll()`.
- `ankinator-app/server/src/core/prompts.ts`: All LLM prompts — edit here to change question generation behaviour.
- `ankinator-app/server/src/core/chunker.ts`: Semantic chunking algorithm — edit here to change chunk size strategy.
- `ankinator-app/server/src/store.ts`: In-memory state — single-user, no persistence.

**Testing:**
- `ankinator-mcp/tests/`: MCP-side tests only.
- No test files detected in `ankinator-app/`.

## Naming Conventions

**Files:**
- Server core: `kebab-case.ts` (e.g., `document-loader.ts`, `ocr-loader.ts`, `odl-parse.ts`).
- Providers/exporters: `kebab-case.ts` matching function/class name (e.g., `api-provider.ts`, `csv.ts`).
- Web components: `PascalCase.tsx` (e.g., `CardTable.tsx`, `StructurePanel.tsx`).
- Web non-component modules: `camelCase.ts` (e.g., `api.ts`, `types.ts`).
- MCP manager classes: `kebab-case.ts` (e.g., `chunk-session-manager.ts`, `pdf-manager.ts`).

**Directories:**
- Feature sub-groups use plural `kebab-case`: `providers/`, `exporters/`, `managers/`, `helpers/`, `types/`, `utils/`.
- Components folder: `components/` (singular not used here).

## Where to Add New Code

**New LLM Provider (e.g., OpenAI):**
- Implementation: `ankinator-app/server/src/core/providers/openai-provider.ts` (implement `QuestionProvider`)
- Register: add case in `ankinator-app/server/src/core/providers/index.ts`
- Config: extend `ProviderKind` in `config.ts`

**New Export Format (e.g., Markdown):**
- Implementation: `ankinator-app/server/src/core/exporters/markdown.ts`
- Route: add `POST /api/export/markdown` in `ankinator-app/server/src/api.ts`
- UI: add button in `ankinator-app/web/src/components/ExportBar.tsx`

**New UI Step:**
- Component: `ankinator-app/web/src/components/YourStep.tsx`
- Wire into: `ankinator-app/web/src/App.tsx` step state machine and `Stepper.tsx` step list

**New MCP Tool:**
- Implementation: `ankinator-mcp/src/tools/your-tool.ts` (extract from `index.ts` pattern)
- Register: call `server.tool(name, schema, handler)` in `ankinator-mcp/src/index.ts`

**New Domain Type:**
- Add to: `ankinator-app/server/src/core/types.ts` (server)
- Mirror to: `ankinator-app/web/src/types.ts` (web) if exposed to the frontend via API

**Utilities / Helpers:**
- Server-side shared helpers: `ankinator-app/server/src/core/` (no `utils/` dir yet — add one if needed)
- MCP helpers: `ankinator-mcp/src/helpers/` or `ankinator-mcp/src/utils/`

## Special Directories

**`ankinator-app/server/dist/`:**
- Purpose: TypeScript compilation output.
- Generated: Yes (`tsc`).
- Committed: No (gitignored).

**`ankinator-app/web/dist/`:**
- Purpose: Vite production build (JS bundles, assets).
- Generated: Yes (`vite build`).
- Committed: No (gitignored). Served by Express at runtime in production.

**`ankinator-mcp/chunk-sessions/` and `ankinator-mcp/question-sessions/`:**
- Purpose: JSONL files written by `ChunkSessionManager` and `QuestionSessionManager` for session persistence across MCP calls.
- Generated: Yes (at runtime).
- Committed: No.

**`legacy/`:**
- Purpose: Historical scripts kept for reference — not part of the active app.
- Generated: No.
- Committed: Yes.

---

*Structure analysis: 2026-06-03*
