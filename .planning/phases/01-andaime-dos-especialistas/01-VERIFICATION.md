---
phase: 01-andaime-dos-especialistas
verified: 2026-06-03T00:00:00Z
status: passed
score: 4/4 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: none
  note: "Initial verification — no previous VERIFICATION.md existed."
---

# Phase 1: Andaime dos Especialistas — Verification Report

**Phase Goal:** Criar a fundação reutilizável dos especialistas — runner que reusa o spawn do `CliProvider` (assinatura), padrão de fonte única `.md` espelhado em Skills, interface `ImageProvider` (impl `svg-claude`), e extensão consistente do tipo `Questao` — sem ativar nenhum estágio no fluxo ainda e sem regressão.
**Verified:** 2026-06-03
**Status:** PHASE COMPLETE (passed)
**Re-verification:** No — initial verification

## Overall Verdict

**PHASE COMPLETE.** All 4 ROADMAP success criteria are observably true in the codebase, the full app build (server + web) compiles with EXIT 0, and the automated CLI-free non-regression guard (SPEC-01) passes independently in BOTH `tsx` (src) and `node dist` (prod) modes. The andaime is correctly inert: no specialist stage is wired into the pipeline, and the image provider has zero call sites outside its own module — exactly the intended "scaffold without activation" state. No blockers, no divergent SKILL copies, no raster provider, no improper pipeline wiring, no unreferenced debt markers.

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| C1 | Existe `server/src/core/specialists/` com runner que envia prompt de especialista ao `claude` CLI e retorna saída estruturada, reusando o mecanismo do `CliProvider`. | ✓ VERIFIED | `runner.ts:54,77` exporta `buildSpawnArgs` + `runClaudeCli`; `cli-provider.ts:14` importa e `:34` delega com `systemPrompt: SYSTEM_FIDELITY`. `grep -c 'spawn(' cli-provider.ts` = 0; em `runner.ts` = 1. `CliEnvelope` movido para o runner (0 em cli-provider). |
| C2 | Cada especialista tem um `.md` canônico único; a Skill correspondente referencia o mesmo conteúdo (sem cópia divergente). | ✓ VERIFIED | 5 prompts canônicos em `prompts/*.md` (35-48 linhas cada). Cada `.claude/skills/<nome>/SKILL.md` referencia `specialists/prompts/<nome>.md` (path ref = 1) e carrega o disclaimer "ÚNICA fonte / NÃO duplique" (count 2). Divergence probe: corpo canônico ("Regras invioláveis") presente nos 5 SKILL = 0 — nenhuma cópia inline. |
| C3 | A interface `ImageProvider` existe com `svg-claude` registrada; nenhum provider raster é implementado. | ✓ VERIFIED | `image-provider.ts:19` `ImageProvider`, `:33` `SvgClaudeImageProvider` (`nome='svg-claude'`), `:51` `createImageProvider()` retorna a impl default. Usa `runClaudeCli` (`:41`) + `loadPrompt('mnemonic-image')` (`:37`). Nenhuma classe raster — únicas ocorrências de "raster" são comentários de deferimento (v2/IMGR-01). NÃO importado em `generation.ts`/exporters; 0 call sites de `createImageProvider`/`SvgClaudeImageProvider` fora do módulo. |
| C4 | O tipo `Questao` ganha campos opcionais (deck, tags, mnemônico, svg) espelhados em server e web; build passa e o fluxo atual continua intacto. | ✓ VERIFIED | server `types.ts:97-100` e web `types.ts:37-40` têm `deck?: string`, `tags?: string[]`, `mnemonico?: string`, `mnemonicoSvg?: string` — assinatura IDÊNTICA, mesma ordem, mesmos comentários. Build `npm run build` (server tsc + web tsc+vite) = **EXIT 0**, 36 módulos transformados, dist emitido. |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `ankinator-app/server/src/core/specialists/runner.ts` | runClaudeCli + buildSpawnArgs (+ tipos) | ✓ VERIFIED | Exporta `runClaudeCli`, `RunClaudeCliInput`, `buildSpawnArgs`, `SpawnPlan`. Invariantes byte-a-byte (args order, `os.tmpdir()`, `{...process.env}`, SIGKILL timeout, parse de envelope, fallback `catch { resolve(stdout) }`, stdin write). `spawn(` = 1 (só em runClaudeCli). WIRED: importado por cli-provider, image-provider, smoke-runner. |
| `ankinator-app/server/src/core/specialists/prompt-loader.ts` | loadPrompt com allowlist + cache + resolve em src/ | ✓ VERIFIED | `NOMES` allowlist (5), `Map` cache, `fileURLToPath(import.meta.url)`, troca dist→src (Pitfall 1), validação anti path-traversal antes do `readFileSync`. WIRED: importado por image-provider e smoke-runner. |
| `ankinator-app/server/src/core/specialists/prompts/*.md` (×5) | fonte única por especialista | ✓ VERIFIED | anki-orchestrator(48), deck-classifier(45), card-builder(46), mnemonic(38), mnemonic-image(35) linhas — substantivos, PT, foco concurso. Carregados em runtime em ambos os modos (probe). |
| `ankinator-app/server/src/core/providers/cli-provider.ts` | delega ao runner, sem spawn próprio | ✓ VERIFIED | invoke() = delegação de 1 linha; sem `spawn(`/`CliEnvelope`; `generateForChunk` intacto. |
| `ankinator-app/server/src/scripts/smoke-runner.ts` | guard CLI-free de args + cross-mode loadPrompt | ✓ VERIFIED | Passo 1 (loadPrompt ×5), Passo 2 (assertion determinística args/cwd/env), flag `--assert-args` (CLI-free, sai antes do passo 3). |
| `ankinator-app/server/src/core/specialists/image-provider.ts` | ImageProvider + SvgClaudeImageProvider + factory | ✓ VERIFIED (intencionalmente ORPHANED) | Existe e é funcional; NÃO plugado no pipeline por design (andaime) — 0 call sites externos. Correto para esta fase. |
| `ankinator-app/server/src/core/types.ts` | Questao +4 campos | ✓ VERIFIED | linhas 97-100. |
| `ankinator-app/web/src/types.ts` | Questao +4 campos (espelho) | ✓ VERIFIED | linhas 37-40, assinatura idêntica. |
| `.claude/skills/<nome>/SKILL.md` (×5) | espelho referenciando o .md canônico | ✓ VERIFIED | Referência por path + disclaimer; sem cópia divergente. |

### Key Link Verification

| From | To | Via | Status |
|------|----|----|--------|
| `cli-provider.ts` | `runner.ts` | `import runClaudeCli` + `runClaudeCli({ systemPrompt: SYSTEM_FIDELITY, ... })` | ✓ WIRED (`:14`, `:34`) |
| `runner.ts:runClaudeCli` | `runner.ts:buildSpawnArgs` | `const plan = buildSpawnArgs(...)` fonte única do spawn | ✓ WIRED (`:79`) |
| `prompt-loader.ts` | `prompts/*.md` | `readFileSync` resolvido em src/ (dist→src) | ✓ WIRED (probe: 5 .md lidos em tsx E node dist) |
| `smoke-runner.ts` | `runner.ts` | import `.js` (NodeNext) + assertion args | ✓ WIRED |
| `image-provider.ts` | `runner.ts` + `prompt-loader.ts` | `runClaudeCli` + `loadPrompt('mnemonic-image')` | ✓ WIRED (`:15-16`, `:37`, `:41`) |
| `SKILL.md` ×5 | `prompts/*.md` ×5 | referência textual por path (progressive disclosure) | ✓ WIRED (path ref = 1 cada; corpo não copiado) |
| web `types.ts` | server `types.ts` | mesma assinatura de campos (espelho manual) | ✓ WIRED (4 campos idênticos) |
| `image-provider` / `createImageProvider` | pipeline (`generation.ts`/exporters) | (deve NÃO existir nesta fase) | ✓ CORRECTLY ABSENT (0 call sites externos) |

### Behavioral Spot-Checks (CLI-free)

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Build completo (server + web) | `npm run build` | EXIT 0; tsc verde; vite 36 módulos; dist emitido | ✓ PASS |
| Guard SPEC-01 + cross-mode loadPrompt (src) | `npx tsx src/scripts/smoke-runner.ts --assert-args` | EXIT 0; 5 .md carregados; args ordem canônica; cwd=tmpdir; env de process.env; userMessage não vaza | ✓ PASS |
| Guard SPEC-01 + cross-mode loadPrompt (prod) | `node dist/scripts/smoke-runner.js --assert-args` | EXIT 0; mesmos 5 .md (mesmos char counts) — prova resolução src/ em modo dist (Pitfall 1 fechado) | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| SPEC-01 | 01-02, 01-04 | runner reusa spawn do CliProvider, saída estruturada | ✓ SATISFIED | C1 + guard CLI-free + checkpoint 2 PDFs reais |
| SPEC-02 | 01-02 | UM .md canônico por especialista (fonte única) | ✓ SATISFIED | 5 prompts canônicos substantivos |
| SPEC-03 | 01-03 | Skill espelho referencia o .md canônico | ✓ SATISFIED | C2 — referência por path, sem cópia |
| SPEC-04 | 01-04 | interface ImageProvider + svg-claude, sem raster | ✓ SATISFIED | C3 |
| SPEC-05 | 01-03 | Questao estendido consistente server+web | ✓ SATISFIED | C4 — 4 campos idênticos, build verde |

Nenhum requisito órfão para a Fase 1 (REQUIREMENTS.md mapeia SPEC-01..05 → Phase 1, todos cobertos por plano).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `image-provider.ts` | 42 | `TODO(IMG-02 fase 4)` (sanitizar SVG) | ℹ️ Info | Referencia trabalho formal agendado (Fase 4). Não bloqueia o goal do andaime. |
| `image-provider.ts` | 52 | `TODO(v2)` (provider raster por env) | ℹ️ Info | Referencia IMGR-01 (v2, fora do roadmap). Não bloqueia. |

Debt-marker gate (TBD/FIXME/XXX) nos arquivos da fase: **NENHUM**. Os 2 TODO acima referenciam follow-up formal (IMG-02/Fase 4, IMGR-01/v2) → Info, não Blocker. Nenhum stub que alimente saída visível; `createImageProvider`/`SvgClaudeImageProvider` sem call site é o estado INTENCIONAL do andaime (não-ativação no pipeline).

### Human Verification Required

Nenhum item aberto. O único checkpoint humano (SPEC-01 real-generation + PIPE-03) era HARD-BLOCK e foi **LIBERADO** pelo usuário com 2 PDFs reais, documentado em `checkpoint-04-regression-signoff.txt`:
- `curso-8.pdf` (108 KB) → EXIT 0, 5 questões em 27.8s (1 extraída c/ banca + 4 criadas; forma `[tipo] Q:/A:` correta).
- `curso-230990-...-completo.pdf` (6.3 MB) → EXIT 0, 6 questões em 26.2s (2 extraídas c/ banca + 4 criadas).
Veredito do checkpoint: SPEC-01 PASS (geração equivalente ao baseline) e PIPE-03 PASS (fluxo load→chunk→generate sem regressão). Sign-off do usuário registrado.

### Gaps Summary

Nenhum gap. Todos os 4 critérios de sucesso do ROADMAP são verificáveis no código com evidência file:line; o build completo (server+web) sai EXIT 0; o guard determinístico CLI-free de não-regressão SPEC-01 passa em modo tsx E node dist; e o checkpoint humano de regressão real foi liberado com 2 PDFs. O andaime está corretamente inerte (image-provider não plugado, nenhum estágio ativado no pipeline), exatamente como a fase exige. Nenhuma cópia divergente de SKILL, nenhum provider raster, nenhuma fiação indevida no pipeline.

---

_Verified: 2026-06-03_
_Verifier: Claude (gsd-verifier)_
