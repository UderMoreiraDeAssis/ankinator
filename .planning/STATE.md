---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
last_updated: "2026-06-03T04:21:06.000Z"
last_activity: 2026-06-03
progress:
  total_phases: 5
  completed_phases: 0
  total_plans: 4
  completed_plans: 3
  percent: 0
plan_04_status: checkpoint-pending
last_gate_trip: 01-04/task-4-human-verify-pdf
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-03)

**Core value:** Flashcards que maximizam retenção a partir de qualquer texto de concurso, via assinatura Claude (sem custo por token).
**Current focus:** Phase 01 — andaime-dos-especialistas

## Current Position

Phase: 01 (andaime-dos-especialistas) — EXECUTING (Plano 04 em CHECKPOINT-PENDING)
Plan: 4 of 4
Status: Plano 04 tasks a/b/c DONE e committadas (ImageProvider/svg-claude SPEC-04 + guard CLI-free SPEC-01 + loadPrompt cross-mode Pitfall 1). Task 4 (sign-off de regressão com PDF real — SPEC-01 geração + PIPE-03) BLOQUEADA: HARD-BLOCK humano, baseline foi simbólico (sem fixture PDF). Plano NÃO está completo.
Last activity: 2026-06-03 -- 01-04 a/b/c executados (image-provider.ts; smoke-runner --assert-args CLI-free verde; dist+tsx loadPrompt verdes). Aguardando PDF do usuário p/ liberar o checkpoint.

Progress: [████████░░] 75% (Plano 04 não conta como completo até o checkpoint humano liberar)

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

Last session: 2026-06-03T04:21:06.000Z
Stopped at: 01-04 tasks a/b/c DONE; Task 4 (HARD-BLOCK humano) CHECKPOINT-PENDING aguardando PDF real do usuário (SPEC-01 geração + PIPE-03)
Resume file: .planning/phases/01-andaime-dos-especialistas/01-04-SUMMARY.md (seção "Checkpoint Pendente (Task 4)")
