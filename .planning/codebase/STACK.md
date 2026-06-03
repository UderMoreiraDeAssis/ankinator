# Technology Stack

**Analysis Date:** 2026-06-03

## Languages

**Primary:**
- TypeScript 5.9.x — all production source (`ankinator-app/server/src/`, `ankinator-app/web/src/`, `ankinator-mcp/src/`)

**Secondary:**
- JavaScript (ES modules) — legacy scripts only (`legacy/*.js`)
- CSS — Tailwind utility classes via Vite plugin (`ankinator-app/web/src/index.css`)

## Runtime

**Environment:**
- Node.js 24 (active LTS as of analysis; `@types/node ^24.10.1` pins minor)
- Confirmed runtime: v24.15.0

**Package Manager:**
- npm (root `package-lock.json` present; each sub-package has its own `package.json`)
- Lockfile: present at repo root (`package-lock.json`) and in each workspace

## Monorepo Layout

Three independent npm packages (no workspace hoisting):

| Package | Path | Module System |
|---------|------|---------------|
| `@ankinator/server` | `ankinator-app/server/` | ESM (`"type": "module"`) |
| `@ankinator/web` | `ankinator-app/web/` | ESM (`"type": "module"`) |
| `ankinator-mcp` | `ankinator-mcp/` | CommonJS (`"type": "commonjs"`) |

## Frameworks

**Backend API:**
- Express 5.1.x — HTTP API server; `ankinator-app/server/src/index.ts`

**Frontend:**
- React 19.1.x — SPA UI; `ankinator-app/web/src/main.tsx`
- Vite 7.x — dev server + production bundler; `ankinator-app/web/vite.config.ts`
- Tailwind CSS 4.1.x — utility-first styling via `@tailwindcss/vite` plugin

**MCP:**
- `@modelcontextprotocol/sdk` 1.22.x — MCP server framework; `ankinator-mcp/src/index.ts`

## Key Dependencies

**LLM / Generation:**
- `@anthropic-ai/sdk` ^0.70.1 — used in both `@ankinator/server` (API provider) and `ankinator-mcp`
- Claude Code CLI (`claude` binary) — used by `CliProvider` via `spawn()`; no extra npm dep

**PDF Extraction:**
- `@opendataloader/pdf` ^2.4.7 — primary PDF extraction in `ankinator-app/server/`; wraps a Java CLI; requires Java 11+ in PATH
- `pdf-parse` ^2.4.5 — PDF extraction in `ankinator-mcp/` (legacy path)
- Optional Python backend: `pip install "opendataloader-pdf[hybrid]"` for OCR (env var `ODL_PYTHON`); not listed in npm deps

**File Upload:**
- `multer` ^2.0.0 — multipart file handling; `ankinator-app/server/src/api.ts`

**Validation:**
- `zod` ^4.1.12 — runtime schema validation; used in both server and MCP

**CSV:**
- `csv-stringify` ^6.5.x — CSV generation in exporters
- `csv-parse` ^6.1.0 — CSV parsing in MCP

**Build/Dev:**
- `tsx` ^4.20.6 — TypeScript execution for development (`tsx watch src/index.ts`)
- TypeScript compiler (`tsc`) — production builds to `dist/`

**Type Definitions:**
- `@types/express` ^5.0.0, `@types/multer` ^2.0.0, `@types/node` ^24.10.1, `@types/pdfkit` ^0.17.3

## TypeScript Configuration

**Server (`ankinator-app/server/tsconfig.json`):**
- `target: ES2022`, `module: NodeNext`, `moduleResolution: NodeNext`
- `strict: true`, `sourceMap: true`

**MCP (`ankinator-mcp/tsconfig.json`):**
- `target: ES2020`, `module: CommonJS`, `moduleResolution: Node`
- `strict: true`

**Web (`ankinator-app/web`):**
- `tsc -b && vite build` — TypeScript checked then bundled by Vite

## Configuration

**Environment:**
- `.env` files loaded best-effort via `process.loadEnvFile()` (Node 22+) from `ankinator-app/.env` and `ankinator-app/server/.env`; see `ankinator-app/server/src/config.ts`
- Key env vars: `ANKINATOR_PROVIDER` (`cli`|`api`, default `cli`), `ANTHROPIC_API_KEY`, `ANKINATOR_MODEL`, `ANKINATOR_CLI_MODEL`, `ANKICONNECT_URL`, `PORT`, `ANKINATOR_CLAUDE_BIN`, `ANKINATOR_CLI_TIMEOUT_MS`, `ODL_PYTHON`
- `.env` is gitignored; `.env.example` committed

**Build output:**
- Server: `ankinator-app/server/dist/` (gitignored)
- Web: `ankinator-app/web/dist/` (gitignored, served as static by server in production)
- MCP: `ankinator-mcp/dist/` (gitignored)

## Platform Requirements

**Development:**
- Node.js 24+
- Java 11+ in PATH (required by `@opendataloader/pdf` for PDF extraction)
- `claude` CLI installed and authenticated (for `CliProvider` — default generation path)
- Python + `opendataloader-pdf[hybrid]` (optional, for OCR of scanned PDFs)

**Production:**
- Local single-user app (no external hosting documented)
- Anki desktop + AnkiConnect add-on (code 2055492159) required for direct push export
- Server runs on `localhost:8787` (configurable via `PORT`)

---

*Stack analysis: 2026-06-03*
