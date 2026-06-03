---
phase: 01-andaime-dos-especialistas
plan: 01
subsystem: infra
tags: [npm-workspaces, lockfile, npm-ci, tsc, smoke-script, baseline, regression]

# Dependency graph
requires: []
provides:
  - "Baseline simbólico do CliProvider (pré-refatoração) para a guarda de regressão SPEC-01"
  - "Dependências dos dois workspaces alinhadas ao lockfile (tsc 5.9.3) — base determinística para o gate de build das próximas waves"
  - "Confirmação de que src/ compila verde sem import pendente (Wave 0 100% build-safe)"
affects: [01-02, 01-04, andaime-runner, cli-provider-refactor]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "npm ci no ROOT do workspace (ankinator-app/), não per-workspace — layout npm-workspaces tem lockfile único hoisted"
    - "Baseline pré-refatoração como artefato de dados (.txt) sob .planning/, não código em src/ (mantém Wave 0 build-safe)"

key-files:
  created:
    - .planning/phases/01-andaime-dos-especialistas/baseline-cli.txt
  modified: []

key-decisions:
  - "npm ci rodado no root ankinator-app/ (workspace único) em vez de per-workspace server/web — único mecanismo correto para o lockfile hoisted desta repo"
  - "Baseline gravado de forma SIMBÓLICA (sem fixture PDF); regressão SPEC-01 será coberta no Plano 04 por (1) assertion determinística CLI-free de args/cwd/env/timeout/parse e (2) checkpoint humano hard-block"
  - "smoke-runner.ts NÃO criado nesta wave (movido para o Plano 02, após runner.ts/prompt-loader.ts existirem) — evita import pendente TS2307 dado include src/**/*.ts sem exclude"

patterns-established:
  - "Wave 0 build-safe: nenhum .ts novo em src/; npm run build sai 0 em todo limite de tarefa (server e web)"
  - "tsc do lockfile = 5.9.3: a divergência 6.0.3 documentada no RESEARCH era específica do ambiente da pesquisa; npm ci hoista a versão travada"

requirements-completed: [SPEC-01]

# Metrics
duration: ~8min
completed: 2026-06-03
---

# Phase 1 Plan 01: Wave 0 — Lockfile + Baseline Summary

**Dependências alinhadas ao lockfile via `npm ci` no root do workspace (tsc 5.9.3) e baseline simbólico do CliProvider gravado, com server e web compilando verde — Wave 0 100% build-safe, sem import pendente em src/.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-06-03 (Wave 0)
- **Completed:** 2026-06-03
- **Tasks:** 1
- **Files modified:** 1 (criado)

## Accomplishments
- `npm ci` no root `ankinator-app/` alinhou os dois workspaces (server + web) ao lockfile único; `tsc` resolvido = **5.9.3** (igual ao `^5.9.3` declarado) — fecha a Open Question 1 do RESEARCH (a divergência 6.0.3 era do ambiente da pesquisa, não desta repo).
- **Server build verde** (`tsc -p tsconfig.json`, exit 0, `dist/index.js` emitido, nenhum `.md` copiado para `dist/` — confirma a base do Pitfall 1 para o Plano 02).
- **Web build verde** (`tsc -b && vite build`, exit 0, 36 módulos, ~1s).
- Baseline do CliProvider **pré-refatoração** gravado em `baseline-cli.txt` (simbólico — sem fixture PDF), documentando o plano de comparação de regressão SPEC-01.
- Confirmado: `cli-provider.ts` intacto (diff vazio), `smoke-runner.ts` ausente (correto — movido ao Plano 02).

## Task Commits

Cada tarefa committada atomicamente:

1. **Task 1: Alinhar dependências ao lockfile (npm ci) e capturar baseline do CliProvider** — `d9be465` (chore)

**Plan metadata:** (commit de docs final — STATE.md / ROADMAP.md / SUMMARY.md)

## Files Created/Modified
- `.planning/phases/01-andaime-dos-especialistas/baseline-cli.txt` — Baseline simbólico do comportamento atual do CliProvider (contagem + forma `[tipo] Q:/A:`); registra que a saída do LLM é não-determinística e que a regressão SPEC-01 será provada por assertion determinística + checkpoint hard-block no Plano 04.

## Decisions Made
- **npm ci no root, não per-workspace:** a repo é um monorepo npm-workspaces (`ankinator-app/package.json` declara `workspaces: [server, web]`, lockfile único hoisted, sem lockfiles per-workspace). Rodar `npm ci` dentro de `server/` ou `web/` separadamente não é o mecanismo correto. Um único `npm ci` no root instala/linka ambos os workspaces de forma determinística — satisfaz a intenção do plano (alinhar os dois ao lockfile) pelo caminho certo para este layout.
- **Baseline simbólico:** não há PDF versionado (`find . -name '*.pdf' -not -path '*/node_modules/*'` → vazio). A saída do smoke-cli seria não-determinística de qualquer forma; o baseline documenta a FORMA esperada e delega a prova de regressão aos dois mecanismos do Plano 04.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `npm ci` no root do workspace em vez de per-workspace (server + web)**
- **Found during:** Task 1 (alinhar dependências ao lockfile)
- **Issue:** O texto literal do plano pede `npm ci` em `ankinator-app/server` e `ankinator-app/web` separadamente. Esta repo é um monorepo **npm-workspaces** com lockfile único hoisted no root (`ankinator-app/package-lock.json`) e SEM lockfiles per-workspace — `npm ci` dentro de um sub-workspace não é o mecanismo correto e não alinharia deterministicamente as deps hoisted.
- **Fix:** Rodado um único `npm ci` no root `ankinator-app/` (instala/linka ambos os workspaces a partir do lockfile único). Resultado: "added 185 packages, audited 188, 0 vulnerabilities".
- **Files modified:** Nenhum versionado — `node_modules/` é gitignored; o lockfile NÃO mudou (npm ci casou byte-a-byte, sem drift: `git diff --stat package-lock.json` vazio).
- **Verification:** `tsc --version` = 5.9.3 (lockfile); `npm run build` server exit 0; `npm run build` web exit 0.
- **Committed in:** `d9be465` (commit da Task 1; sem mudança de arquivo versionado por este passo — só o baseline foi versionado).

---

**Total deviations:** 1 auto-fixed (1 blocking — mecanismo correto de install para o layout real da repo)
**Impact on plan:** A intenção do plano (deps determinísticas alinhadas ao lockfile nos dois workspaces, antes de medir build) foi 100% atingida. Apenas o COMANDO foi ajustado ao layout npm-workspaces. Zero scope creep.

## Issues Encountered
- Ruído de shell no ambiente (`setValueForKeyFakeAssocArray ... _encode/_decode` e um proxy `rtk` que envolve comandos) poluiu/transformou alguns stdout/exit codes. Contornado capturando exit codes e logs em arquivos `/tmp/*.log` e validando diretamente (ex.: `dist/index.js` presente, "built in 997ms", "0 vulnerabilities"). Nenhum impacto no resultado.
- `npm ci` emitiu warnings de `allow-scripts` para os postinstall do esbuild (política de scripts não cobertos). São WARNINGS, não falhas; o web build (que depende do binário esbuild via Vite) rodou verde, confirmando que o esbuild está utilizável.

## User Setup Required
None - nenhum serviço externo configurado nesta wave.

## Next Phase Readiness
- **Pronto para o Plano 02 (Wave 1):** deps travadas, build verde nos dois workspaces, baseline pré-refatoração no lugar. O Plano 02 pode extrair `runClaudeCli`/`loadPrompt` e só então criar `smoke-runner.ts` (cujos imports passarão a existir).
- **Lembrete para o Plano 02 (Pitfall 1):** confirmado que `tsc` NÃO copia `.md` para `dist/` — `loadPrompt` deve resolver em `src/`, nunca `dist/`.
- **Lembrete para o Plano 04 (SPEC-01):** a guarda de regressão depende da assertion determinística (helper do Plano 02) + checkpoint hard-block; ver `baseline-cli.txt` para os flags de assinatura travados.

## Self-Check: PASSED

- FOUND: `.planning/phases/01-andaime-dos-especialistas/baseline-cli.txt`
- FOUND: `.planning/phases/01-andaime-dos-especialistas/01-01-SUMMARY.md`
- FOUND commit: `d9be465` (Task 1)

---
*Phase: 01-andaime-dos-especialistas*
*Completed: 2026-06-03*
