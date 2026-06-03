---
phase: 1
slug: andaime-dos-especialistas
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-03
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `01-RESEARCH.md` §Validation Architecture. Projeto NÃO tem framework de teste — convenção = smoke scripts `.ts` via `tsx`; gate principal = `npm run build` verde.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Nenhum framework de teste automatizado. Convenção: smoke scripts `.ts` rodados via `tsx` (molde: `ankinator-app/server/src/scripts/smoke-cli.ts`). |
| **Config file** | none |
| **Quick run command** | `cd ankinator-app/server && npm run build` (gate de compilação) |
| **Full suite command** | `cd ankinator-app/server && npx tsx src/scripts/smoke-runner.ts` + `npx tsx src/scripts/smoke-cli.ts <pdf>` (regressão CLI) |
| **Estimated runtime** | ~30s build; ~30–60s smoke (depende do CLI/PDF) |

---

## Sampling Rate

- **After every task commit:** Run `npm run build` no(s) workspace(s) tocado(s) (server e/ou web).
- **After every plan wave:** Run `npx tsx src/scripts/smoke-runner.ts` (runner + loadPrompt dos 5 nomes) e, se o `CliProvider` foi tocado, `smoke-cli.ts <pdf>`.
- **Before `/gsd:verify-work`:** build verde nos DOIS workspaces + `node dist/index.js` sobe + `loadPrompt` resolve em modo dist.
- **Max feedback latency:** ~30 segundos (build).

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-W0 | 01 | 0 | infra | — | N/A | smoke setup | criar `smoke-runner.ts`; capturar baseline `smoke-cli.ts` | ❌ W0 | ⬜ pending |
| 01-SPEC-01a | 01 | 1 | SPEC-01 | — | N/A | smoke (regressão) | `npx tsx src/scripts/smoke-cli.ts <pdf>` == baseline | ✅ existe | ⬜ pending |
| 01-SPEC-01b | 01 | 1 | SPEC-01 | — | N/A | smoke | `npx tsx src/scripts/smoke-runner.ts` (runner isolado retorna texto do CLI) | ❌ W0 | ⬜ pending |
| 01-SPEC-02 | 01 | 1 | SPEC-02 | — | N/A | smoke+build | `loadPrompt('mnemonic')` resolve em tsx (src) E em `node dist` (prod) | ❌ W0 | ⬜ pending |
| 01-SPEC-03 | 01 | 1 | SPEC-03 | — | N/A | manual/lint | 5 `.claude/skills/anki-*/SKILL.md` existem + grep aponta `specialists/prompts/<nome>.md` (sem corpo duplicado) | ❌ W0 | ⬜ pending |
| 01-SPEC-04 | 01 | 1 | SPEC-04 | — | N/A | build (tipo) | `cd ankinator-app/server && npm run build` (`createImageProvider()` tipa) | ✅ build | ⬜ pending |
| 01-SPEC-05 | 01 | 1 | SPEC-05 | — | N/A | build (tipo) | build server E web verdes com 4 campos novos em `Questao` | ✅ build | ⬜ pending |
| 01-GUARD | 01 | 2 | PIPE-03 | — | sem regressão | smoke E2E manual | upload→generate→export CSV no app funciona igual | ✅ existente | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `ankinator-app/server/src/scripts/smoke-runner.ts` — exercita `runClaudeCli` isolado e `loadPrompt` dos 5 nomes (molde: `smoke-cli.ts`).
- [ ] Verificação cross-mode de `loadPrompt`: rodar via `tsx` (src) e via `node dist/...` (prod) para fechar o pitfall "`.md` não vai pro `dist/`".
- [ ] Capturar baseline do `smoke-cli.ts` ANTES da refatoração do `CliProvider` (comparação pós-refatoração — garante SPEC-01 sem regressão).
- [ ] `npm ci` nos workspaces (tsc instalado 6.0.3 vs `^5.9.3` declarado — alinhar antes de medir build).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Fluxo E2E sem regressão | PIPE-03 | Não há harness E2E; depende de Anki/CLI logados | Subir server+web, upload de um PDF curto, gerar, exportar CSV; confirmar cards iguais ao comportamento atual |
| SKILL.md sem corpo duplicado | SPEC-03 | Julgamento de "não duplicar" não é totalmente automatizável | Inspecionar cada SKILL.md: deve referenciar o `.md` canônico, não copiar o prompt |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
