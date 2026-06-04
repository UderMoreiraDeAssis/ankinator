---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: completed
last_updated: "2026-06-04T00:25:50.752Z"
last_activity: 2026-06-03
progress:
  total_phases: 5
  completed_phases: 3
  total_plans: 12
  completed_plans: 12
  percent: 60
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-03)

**Core value:** Flashcards que maximizam retenção a partir de qualquer texto de concurso, via assinatura Claude (sem custo por token).
**Current focus:** Phase 04 — Mnemônicos + Imagem SVG

## Current Position

Phase: 04
Plan: Not started
Status: Phase 04 context gathered — ready to plan
Next: Phase 04 (Mnemônicos + Imagem SVG) — `/clear` then `/gsd:plan-phase 4`.
Last activity: 2026-06-03

Progress: [██████░░░░] 60%

## Performance Metrics

**Velocity:**

- Total plans completed: 12
- Average duration: ~6 min
- Total execution time: ~25 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 4/4 | ~25 min | ~6 min |
| 02 | 4 | - | - |
| 03 | 4 | - | - |

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
| Phase 03 P01 | 10min | 3 tasks | 6 files |
| Phase 03 P02 | 8min | 3 tasks | 4 files |
| Phase 03 P03 | 5min | 4 tasks | 4 files |

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
- [Phase ?]: Phase 03 P02: enrichAll wired behind deveRodarEnrich gate in /generate .then() — await before done (PIPE-01/PIPE-03 closed)
- [Phase ?]: Phase 03 P02: CSV temDeck gate — byte-identity when no q.deck; #deck column:5 only when some card has q.deck (DECK-01)
- [Phase ?]: Phase 03 P02: ankiconnect subdeck routing — createDeck per distinct q.deck; deckName q.deck ?? opts.deck per-nota (DECK-01/DECK-02)
- [Phase ?]: Phase 03 P03: Enrich progress renderizado DENTRO do passo generating sem 5o step (D-16); defaults via !== false / === true para toggles ON/OFF

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

Last session: 2026-06-04T00:25:50.740Z
Stopped at: Phase 04 context gathered (power finalize — 14/14)
Resume file: .planning/phases/04-mnem-nicos-imagem-svg/04-CONTEXT.md
