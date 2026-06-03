---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
last_updated: "2026-06-03T04:08:00.000Z"
last_activity: 2026-06-03
progress:
  total_phases: 5
  completed_phases: 0
  total_plans: 4
  completed_plans: 3
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-03)

**Core value:** Flashcards que maximizam retenção a partir de qualquer texto de concurso, via assinatura Claude (sem custo por token).
**Current focus:** Phase 01 — andaime-dos-especialistas

## Current Position

Phase: 01 (andaime-dos-especialistas) — EXECUTING
Plan: 4 of 4
Status: Plano 01-03 completo (Wave 1: Questao +4 campos opcionais server+web + 5 SKILL.md espelho); pronto para o Plano 04 (Wave 2)
Last activity: 2026-06-03 -- Completed 01-03-PLAN.md (SPEC-05 tipo estendido idêntico server/web, builds verdes; SPEC-03 5 SKILL.md referenciando .md canônicos sem cópia)

Progress: [████████░░] 75%

## Performance Metrics

**Velocity:**

- Total plans completed: 1
- Average duration: ~8 min
- Total execution time: ~8 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 1/4 | ~8 min | ~8 min |

**Recent Trend:**

- Last 5 plans: 01-01 (~8 min)
- Trend: -

**Detail:**

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 01 P01 | 8 min | 1 | 1 |
| Phase 01 P02 | 6 | 3 tasks | 9 files |
| Phase 01 P03 | 5 min | 2 tasks | 7 files |

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

Last session: 2026-06-03T04:08:00.000Z
Stopped at: Completed 01-03-PLAN.md (Wave 1 trilho paralelo: Questao +4 campos server+web + 5 SKILL.md espelho)
Resume file: None
