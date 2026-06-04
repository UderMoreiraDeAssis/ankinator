---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
last_updated: "2026-06-04T03:32:03Z"
last_activity: 2026-06-04 -- Phase 4 UAT FALHOU; rota corrigida; Phase 4.1 (unblock runtime) aplicada
progress:
  total_phases: 8
  completed_phases: 3
  total_plans: 16
  completed_plans: 16
  percent: 45
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-03)

**Core value:** Flashcards que maximizam retenção a partir de qualquer texto de concurso, via assinatura Claude (sem custo por token).
**Current focus:** Phase 4.1 — Estabilização de Runtime (rumo ao Destino: cards ricos + mnemônicos/imagens reais via agentes especialistas — ver ROADMAP "🎯 Destino")

## Current Position

Phase 04 (Mnemônicos + Imagem SVG): código OK + segurança (CR-01/WR-01 corrigidos), mas **UAT runtime FALHOU** — zero mnemônicos/imagens ao vivo, cards crus (ver 04-HUMAN-UAT.md).
Phase 04.1 (Estabilização de Runtime): fixes RT-01/02/05 aplicados — erro do CLI agora VISÍVEL (log + SSE), parse tolerante a cercas ```json/id, loader langchain auto-ativado + logado. 176 testes verdes, build limpo.
Phase 06 (Cards Educativos Ricos): ENTREGUE — `card-html.ts` (layout seccionado índigo/verde/âmbar, escape + SVG inline sanitizado) wired em CSV + AnkiConnect; 216 testes; preview ✅ em /tmp/ankinator-card-preview.html.
Status: Aguardando 1 teste de runtime humano (rodar PDF real → confirmar que mnemônicos/imagens voltam OU ver o erro agora visível; e ver os cards ricos no Anki). Restam: Phase 5 (wire o anki-orchestrator morto) + Phase 7 (qualidade das questões + decidir arquitetura de agentes/skills).
Next: você roda 1 geração real (valida 4.1 + Phase 6). Depois eu sigo com Phase 5 e 7.
Last activity: 2026-06-04

Progress (rumo ao Destino): [██████░░░░] ~60%

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
| Phase 04 P01 | 5 min | 2 tasks | 6 files |
| Phase 04 P04-03 | 8 min | 3 tasks | 6 files |

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
- [Phase 04 P01]: sanitizarSvg fail-closed returns null if output not starting with <svg — D-08/Pitfall 4; isomorphic-dompurify@3.15.0 installed
- [Phase 04 P01]: ALLOWED_TAGS geometric-only allowlist (15 tags); style absent from ALLOWED_ATTR (F-09 depends on this) — D-06/D-07; 13 adversarial fixtures pass
- [Phase 04 P01]: mnemonic.md ## Saída rewritten to JSON batch format — prerequisite for Plan 02 parser — Pitfall 5 closed
- [Phase 04 P01]: mnemonic-image.md: no id/version on <svg> root (Anki 25.02.x strips them — A1); SVG must start with <svg and end with </svg>
- [Phase ?]: versoHtml tornada export de forma aditiva para teste positivo IMG-03
- [Phase ?]: Phase 04 P03: D-12 defaults mnemonico=true imagem=false em enrichOpts do /generate
- [Phase ?]: Phase 04 P03: SVG embed cru em csv.ts e ankiconnect.ts — NUNCA escapeHtml no mnemonicoSvg (T-04-11)

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

Last session: 2026-06-04T02:32:17.104Z
Stopped at: Completed 04-03-PLAN.md
Resume file: None
