---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
last_updated: "2026-06-03T15:45:56.777Z"
last_activity: 2026-06-03
progress:
  total_phases: 3
  completed_phases: 2
  total_plans: 12
  completed_plans: 9
  percent: 67
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-03)

**Core value:** Flashcards que maximizam retenção a partir de qualquer texto de concurso, via assinatura Claude (sem custo por token).
**Current focus:** Phase 03 — classificador-de-deck-card-educativo

## Current Position

Phase: 03 (classificador-de-deck-card-educativo) — EXECUTING
Plan: 2 of 4
Status: Ready to execute
Next: Phase 02 (Loader PDF LangChain) — `/gsd-plan-phase 2` (sem planos ainda).
Last activity: 2026-06-03

Progress: [████████░░] 75%

## Performance Metrics

**Velocity:**

- Total plans completed: 8
- Average duration: ~6 min
- Total execution time: ~25 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 4/4 | ~25 min | ~6 min |
| 02 | 4 | - | - |

**Recent Trend:**

- Last 5 plans: 01-01 (~8 min), 01-02 (~6 min), 01-03 (~5 min), 01-04 (~6 min + checkpoint)
- Trend: estável ~6 min/plano

**Detail:**

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 01 P01 | 8 min | 1 | 1 |
| Phase 01 P02 | 6 | 3 tasks | 9 files |
| Phase 01 P03 | 5 min | 2 tasks | 7 files |
| Phase 01 P04 (a/b/c) | ~6 min | 3 auto tasks (+1 checkpoint pendente) | 2 files |

## Accumulated Context

### Decisions

Decisões completas em PROJECT.md (Key Decisions). Recentes:

- Bootstrap: Loader LangChain = sidecar Python opt-in (Node segue default).
- Bootstrap: Especialistas = fonte única `.md` → Skill + estágio no app (híbrido).
- Bootstrap: Imagem de mnemônico = SVG gerado pelo Claude + interface `ImageProvider`.
- Bootstrap: Cadeia = modo "educativo" opcional (toggles + defaults), fase `enrichAll()`.
- [Phase 01 P01]: `npm ci` no ROOT do workspace (npm-workspaces, lockfile único hoisted) alinha tsc a 5.9.3 — não per-workspace; baseline simbólico do CliProvider gravado (regressão SPEC-01 coberta por assertion determinística CLI-free + checkpoint hard-block no Plano 04).
- [Phase 01 P02]: runClaudeCli + buildSpawnArgs (helper PURO) extraídos do CliProvider; delegação com SYSTEM_FIDELITY sem regressão; não-regressão SPEC-01 provada CLI-free (args/cwd/env/sem-vazamento-de-userMessage).
- [Phase 01 P02]: loadPrompt resolve .md SEMPRE de src/ via heurística dist→src (não __dirname, não dist/) com allowlist+cache; validado cross-mode. Caveat A1: deploy precisa enviar src/ com os .md (tsc não copia); dist-only exigiria Plano B.
- [Phase 01 P03]: SPEC-05 — Questao +4 campos opcionais (deck/tags/mnemonico/mnemonicoSvg) com assinatura IDÊNTICA em server (core/types.ts) e web (src/types.ts), no mesmo commit (Pitfall 4 tipo duplicado); fluxo intacto (mapRawQuestoes/exporters não tocados), ambos os builds verdes.
- [Phase 01 P03]: SPEC-03 — 5 SKILL.md em .claude/skills/<nome>/ referenciam por path os .md canônicos (progressive disclosure, sem cópia divergente — D-06). Nomes de pasta = nomes canônicos do PLAN/<verify> (anki-orchestrator, deck-classifier, card-builder, mnemonic, mnemonic-image). Reiniciar a sessão do Claude Code p/ as Skills aparecerem no menu /.
- [Phase 01 P04]: SPEC-04 — ImageProvider (interface) + SvgClaudeImageProvider (svg-claude; loadPrompt('mnemonic-image') + runClaudeCli, usa mnemonic E context) + createImageProvider() default svg-claude (D-08/09/10). 100% no server; sem raster; TODO(IMG-02) sanitização e TODO(v2) raster por env; NÃO plugado no pipeline. Build server verde.
- [Phase 01 P04]: Guard SPEC-01 AUTOMATIZADO e CLI-free — smoke-runner --assert-args (flag adicionada, Rule 3) sai 0 sem spawnar o claude; args/cwd/env byte-idênticos ao CliProvider.invoke() pré-refator (Pitfall 2). loadPrompt validado cross-mode tsx(src)+node(dist) — Pitfall 1 fechado (lengths idênticos 2360/1955/2036/1653/1727).
- [Phase 01 P04]: Task 4 é HARD-BLOCK humano e ficou CHECKPOINT-PENDING — baseline foi simbólico (sem PDF). A regressão E2E (SPEC-01 geração real + PIPE-03) exige um PDF fornecido pelo usuário; o executor não-interativo não fabrica sign-off.

### Pending Todos

None yet.

### Blockers/Concerns

- Quota da assinatura: cadeia por-card multiplica chamadas ao CLI → exige batching/seletividade (tratado na Phase 5).
- Tipo `Questao` duplicado (server+web) → estender com cuidado (Phase 1, SPEC-05).

## Deferred Items

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| *(none)* | | | |

## Session Continuity

Last session: 2026-06-03T15:45:56.760Z
Stopped at: Phase 3 context gathered (18/18, --power)
Resume file: None
