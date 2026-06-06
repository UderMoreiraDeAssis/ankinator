# Coding Conventions

**Analysis Date:** 2026-06-03

> ⚠️ **Snapshot de 2026-06-03** (mapeamento `gsd-map-codebase`, pré-Phase 3). O estado corrente vive em `.planning/STATE.md` + `.planning/ROADMAP.md`. Afirmações aqui podem estar **vencidas** — ex.: convenções de teste (vitest), env-knobs (~20 `ANKINATOR_*`) e o padrão de sidecar Python foram adicionados/expandidos depois. Ver `.planning/FRAMING-REVIEW.md` §8 (C6).

## Language Notes

All inline comments, JSDoc descriptions, and user-facing strings are written in **Portuguese (Brazilian)**. Interface/API field names use Portuguese nouns (`pergunta`, `resposta`, `questoes`, `banca`, `gabarito`, `tipo`). English is used only in configuration, library-facing identifiers, and some class method names in `ankinator-mcp/`.

The two packages diverge slightly:
- `ankinator-app/server/` — Portuguese-dominant throughout (field names, comments, error messages)
- `ankinator-mcp/` — mixed: Portuguese field names in types but English JSDoc in `PdfManager`, `TokenEstimator`, `QuestionSessionManager`

## Naming Patterns

**Files:**
- `kebab-case` throughout: `document-loader.ts`, `cli-provider.ts`, `anki-csv-formatter.ts`, `chunk-session-manager.ts`
- Exception: `App.tsx`, `CardTable.tsx` (React components use PascalCase)

**Functions:**
- `camelCase` for exported functions: `chunkDocument`, `generateAll`, `toAnkiCsv`, `mapRawQuestoes`, `parseQuestoesJson`, `buildUserMessage`
- Private helpers also `camelCase`: `splitLargeSection`, `flush`, `estTokens`, `fonteDaQuestao`, `tagsDaQuestao`, `versoDaQuestao`
- Portuguese verbs preferred: `extrair`, `processar`, `validar`, `resumir`, `converter`

**Variables and properties:**
- `camelCase` for all local variables and object properties
- Exception: `ankinator-mcp/src/types/questao-types.ts` uses `snake_case` for `QuestaoChunk` fields (`chunk_index`, `page_start`, `page_end`) — this is an inconsistency vs the `ankinator-app` types where equivalent fields use camelCase (`chunkIndex`, `pageStart`, `pageEnd`)
- Constants exported as `SCREAMING_SNAKE_CASE`: `SYSTEM_FIDELITY`, `JSON_OUTPUT_INSTRUCTION`, `REGISTRAR_QUESTOES_TOOL`, `CHARS_PER_TOKEN`, `MAX_RESPONSE_TOKENS`

**Types and Interfaces:**
- `PascalCase` for all: `Questao`, `LoadedDocument`, `SemanticChunk`, `ChunkProgress`, `JobStatus`, `QuestionProvider`
- Type unions use string literals: `'extraida' | 'criada'`, `'running' | 'done' | 'error'`, `'cli' | 'api'`

**React Components:**
- `PascalCase` for component function names matching filename: `FileDrop`, `CardTable`, `ExportBar`, `ProgressPanel`, `Stepper`, `StructurePanel`

## Code Style

**Formatting:**
- No Prettier or ESLint config files detected anywhere in the repo
- Consistent 2-space indentation throughout all `.ts` and `.tsx` files
- Single quotes for string literals in TypeScript source
- Trailing commas present in multi-line arrays and objects

**TypeScript:**
- `strict: true` in both `ankinator-app/server/tsconfig.json` and `ankinator-mcp/tsconfig.json`
- `type` keyword preferred for complex union/intersection types, `interface` for object shapes
- `import type` used for type-only imports: `import type { GenerateOptions, Questao, SemanticChunk } from '../types.js'`
- `.js` extension required on all relative imports in the ESM server: `import { api } from './api.js'`
- `ankinator-mcp/` uses CommonJS (`"type": "commonjs"`), so imports use `.js` extension too but resolved as CJS

**Module system:**
- `ankinator-app/server/` — ESM (`"type": "module"`, `NodeNext` resolution)
- `ankinator-mcp/` — CJS (`"type": "commonjs"`, `CommonJS` module)
- `ankinator-app/web/` — Vite/ESM (no explicit extension required in imports)
- `legacy/` — CJS scripts with `require()`

## Import Organization

**Order observed in server files:**
1. Node built-ins with `node:` prefix: `import crypto from 'node:crypto'`, `import path from 'node:path'`
2. Third-party packages: `import express from 'express'`, `import { z } from 'zod'`
3. Local imports with relative path and `.js` extension: `import { config } from './config.js'`
4. Type-only imports last or co-located with value imports using `import type`

**Path Aliases:** None — all local imports use relative paths.

## JSDoc / Comments

**File-level JSDoc block used on every module:**
```typescript
/**
 * Descrição em português do que o módulo faz.
 *
 * Detalhes adicionais, fluxo de dados, trade-offs.
 */
```
Examples: `ankinator-app/server/src/core/generation.ts`, `ankinator-app/server/src/core/chunker.ts`, `ankinator-app/server/src/core/cli-provider.ts`

**Inline comments** used liberally in Portuguese to explain non-obvious logic:
- `// remove cercas \`\`\`json ... \`\`\``
- `// reindexa para garantir índices contíguos`
- `/* assinante desconectado */`

**English JSDoc** used in `ankinator-mcp/` manager classes (`PdfManager`, `TokenEstimator`) with `@param` / `@returns` tags.

## Error Handling

**Pattern — always check `instanceof Error`:**
```typescript
const mensagem = err instanceof Error ? err.message : String(err);
```
Used in: `ankinator-app/server/src/core/generation.ts:90`, `ankinator-app/server/src/index.ts:32`, `ankinator-app/server/src/api.ts`

**HTTP error responses use JSON with `error` key:**
```typescript
res.status(400).json({ error: 'Envie um arquivo PDF no campo "pdf".' });
res.status(502).json({ error: err instanceof Error ? err.message : String(err) });
```

**Per-chunk error isolation:** `generateAll()` catches errors per chunk and records them in `erros[]` rather than aborting the whole pipeline (`ankinator-app/server/src/core/generation.ts:84-93`).

**Silent cleanup:** filesystem cleanup failures are swallowed with `.catch(() => {})` to avoid masking the original error (`ankinator-app/server/src/core/document-loader.ts:62`).

**Express 5 global error handler** in `ankinator-app/server/src/index.ts:31-35` catches unhandled async rejections from route handlers.

## Logging

**No structured logging library** — `console.log` / `console.error` used directly.

**Patterns:**
- Startup info: `console.log(...)` in `ankinator-app/server/src/index.ts`
- Error prefix: `console.error('[ankinator] erro:', message)`
- Scripts/smoke tests: plain `console.log` for human-readable output
- Production route handlers: no `console.log` calls — errors propagate to the global handler

## Function Design

**Size:** Small, single-responsibility functions preferred. Most pure functions are under 30 lines (`mapRawQuestoes`, `parseQuestoesJson`, `chunkDocument` helpers).

**Parameters:** Options objects (`opts: ChunkOptions = {}`, `opts: GenerateOptions`) used instead of positional params when there are more than 2 optional settings.

**Return Values:** Functions that can fail cleanly return empty arrays or `undefined` rather than throwing (e.g., `parseQuestoesJson` returns `[]` on parse error).

## Module Design

**Exports:** Named exports only — no default exports in server/mcp TypeScript source.

**Barrel Files:** None — each file exports directly. No `index.ts` re-export barrel in the core layer.

**Class vs. function modules:**
- `ankinator-app/server/` — prefers free functions and plain objects (`documentStore`, `jobStore`)
- `ankinator-mcp/` — prefers classes: `PdfManager`, `ChunkSessionManager`, `QuestionSessionManager`, `TokenEstimator`, `AnkiCsvFormatter`, `CliProvider`, `ApiProvider`

## Zod Schema Pattern

Both packages use `zod` for runtime validation of MCP tool inputs/outputs. Schemas defined close to the handler as `const xInput = z.object({...}).strict()` then inferred: `type XArgs = z.infer<typeof xInput>`.

---

*Convention analysis: 2026-06-03*
