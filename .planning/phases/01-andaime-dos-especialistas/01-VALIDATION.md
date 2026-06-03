---
phase: 1
slug: andaime-dos-especialistas
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-06-03
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `01-RESEARCH.md` §Validation Architecture. Projeto NÃO tem framework de teste — convenção = smoke scripts `.ts` via `tsx`; gate principal = `npm run build` verde.
>
> **Revisão (plan-checker):** Wave 0 (Plano 01) ficou build-safe (só `npm ci` + baseline). O `smoke-runner.ts` foi MOVIDO para o Plano 02 (Wave 1), criado APÓS `runner.ts`/`prompt-loader.ts` para que `src/` nunca tenha import pendente (o `tsconfig.json` inclui `src/**/*.ts` sem `exclude`). Adicionada a assertion determinística CLI-free de args (guard SPEC-01 / Pitfall 2). Checkpoint do Plano 04 virou HARD-BLOCK por PDF.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Nenhum framework de teste automatizado. Convenção: smoke scripts `.ts` rodados via `tsx` (molde: `ankinator-app/server/src/scripts/smoke-cli.ts`). |
| **Config file** | none |
| **Quick run command** | `cd ankinator-app/server && npm run build` (gate de compilação) |
| **Full suite command** | `cd ankinator-app/server && npx tsx src/scripts/smoke-runner.ts` (loadPrompt 5 nomes + assertion de args + ping ao CLI) + `npx tsx src/scripts/smoke-cli.ts <pdf>` (regressão CLI E2E) |
| **Estimated runtime** | ~30s build; assertion de args <2s (CLI-free); ~30–60s smoke com CLI (depende do CLI/PDF) |

---

## Sampling Rate

- **After every task commit:** Run `npm run build` no(s) workspace(s) tocado(s) (server e/ou web). Wave 0 e build-safe — build sai 0 em todo limite de tarefa.
- **After every plan wave:** Run a assertion CLI-free de args (`npx tsx src/scripts/smoke-runner.ts --assert-args`) e, no fechamento (Plano 04), o smoke-runner completo (cross-mode) e `smoke-cli.ts <pdf>` se o `CliProvider` foi tocado.
- **Before `/gsd:verify-work`:** build verde nos DOIS workspaces + `node dist/index.js` sobe + `loadPrompt` resolve em modo dist + assertion de args verde.
- **Max feedback latency:** ~30 segundos (build); assertion de args <2s.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-W0 | 01 | 0 | infra | T-01-SC | N/A | npm ci + baseline (build-safe) | `npm ci` (server+web); capturar baseline `smoke-cli.ts`; `npm run build` sai 0; `smoke-runner.ts` NÃO criado aqui | baseline ✅ | ⬜ pending |
| 01-SPEC-01a | 02 | 1 | SPEC-01 | T-01-02a | array de args + stdin | build (delegação) | `grep 'runClaudeCli({ systemPrompt: SYSTEM_FIDELITY' cli-provider.ts` + `grep -c 'spawn(' cli-provider.ts`==0 + build 0 | ✅ existe | ⬜ pending |
| 01-SPEC-01b | 02 | 1 | SPEC-01 | T-01-02a | — | smoke (runner isolado) | `npx tsx src/scripts/smoke-runner.ts` (passo 3: runClaudeCli retorna texto do CLI) — executado no Plano 04 | criado P02 | ⬜ pending |
| 01-SPEC-01c | 02→04 | 1→2 | SPEC-01 | T-01-02a | userMessage por stdin (não em args) | smoke determinístico CLI-free | `npx tsx src/scripts/smoke-runner.ts --assert-args` (args/cwd/env de `buildSpawnArgs` == conjunto pré-refator, SEM spawnar CLI) | criado P02 | ⬜ pending |
| 01-SPEC-02 | 02 | 1 | SPEC-02 | T-01-02b | allowlist antes do readFileSync | smoke+build (cross-mode) | `loadPrompt(nome)` resolve em tsx (src) E `node dist` (prod) p/ os 5 nomes — executado no Plano 04 | criado P02 | ⬜ pending |
| 01-SPEC-03 | 03 | 1 | SPEC-03 | T-01-03a | só refs do próprio repo | manual/lint | 5 `.claude/skills/<nome>/SKILL.md` existem + grep aponta `specialists/prompts/<nome>.md` (sem corpo duplicado) | criado P03 | ⬜ pending |
| 01-SPEC-04 | 04 | 2 | SPEC-04 | T-01-04b | — | build (tipo) | `cd ankinator-app/server && npm run build` (`createImageProvider()` tipa) | criado P04 | ⬜ pending |
| 01-SPEC-05 | 03 | 1 | SPEC-05 | — | N/A | build (tipo) | build server E web verdes com 4 campos novos em `Questao` | ✅ build | ⬜ pending |
| 01-GUARD | 04 | 2 | PIPE-03 | — | sem regressão | smoke E2E manual HARD-BLOCK | upload→generate→export CSV no app funciona igual (PDF obrigatório; checkpoint não libera sem PDF) | ✅ existente | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements (build-safe)

- [ ] `npm ci` nos workspaces (tsc instalado 6.0.3 vs `^5.9.3` declarado — alinhar antes de medir build).
- [ ] Capturar baseline do `smoke-cli.ts` ANTES da refatoração do `CliProvider` (comparação pós-refatoração — garante SPEC-01 sem regressão). Real se houver fixture PDF; simbólico caso contrário (coberto pela assertion de args + checkpoint hard-block).
- [ ] `npm run build` sai 0 ao fim da Wave 0 (nenhum import pendente em `src/`). **NÃO** criar `smoke-runner.ts` na Wave 0 — movido para o Plano 02.

## Wave 1 Requirements (sob Plano 02, após runner/prompt-loader)

- [ ] `ankinator-app/server/src/scripts/smoke-runner.ts` — criado APÓS `runner.ts`/`prompt-loader.ts` (mesmo plano), exercita `loadPrompt` dos 5 nomes + assertion CLI-free de args + ping ao `runClaudeCli` (molde: `smoke-cli.ts`).
- [ ] Helper puro `buildSpawnArgs` em `runner.ts` torna args/cwd/env introspectáveis para a assertion determinística (Pitfall 2).

## Wave 2 Requirements (sob Plano 04)

- [ ] Assertion determinística CLI-free de args (`--assert-args`) sai 0 — guard de SPEC-01 sem spawnar o CLI nem depender de PDF.
- [ ] Verificação cross-mode de `loadPrompt`: rodar via `tsx` (src) e via `node dist/...` (prod) para fechar o Pitfall 1 (`.md` não vai pro `dist/`).
- [ ] Checkpoint HARD-BLOCK de regressão E2E com PDF real.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Fluxo E2E sem regressão | PIPE-03 | Não há harness E2E; depende de Anki/CLI logados | Subir server+web, upload de um PDF curto, gerar, exportar CSV; confirmar cards iguais ao comportamento atual. HARD-BLOCK: sem PDF, não libera. |
| Geração equivalente ao baseline | SPEC-01 (E2E) | Geração do LLM não é determinística; equivalência (não igualdade) é julgamento humano | Rodar `smoke-cli.ts <pdf>` pós-refator e comparar forma/contagem com `baseline-cli.txt`. (A prova byte-idêntica de args/cwd/env é automatizada pela assertion CLI-free — 01-SPEC-01c.) |
| SKILL.md sem corpo duplicado | SPEC-03 | Julgamento de "não duplicar" não é totalmente automatizável | Inspecionar cada SKILL.md: deve referenciar o `.md` canônico, não copiar o prompt |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0/checkpoint dependencies (a regressão SPEC-01 ganhou cobertura automatizada CLI-free via 01-SPEC-01c)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 é build-safe (sem import pendente; smoke-runner movido p/ Plano 02)
- [x] No watch-mode flags
- [x] Feedback latency < 30s (assertion de args <2s)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending (re-check após revisão do plano-checker)
</content>
