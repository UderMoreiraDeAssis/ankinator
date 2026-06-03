---
phase: 01-andaime-dos-especialistas
plan: 04
subsystem: api
tags: [specialists, image-provider, svg-claude, claude-cli, spawn-args, non-regression, prompt-loader, esm-nodenext, cross-mode, checkpoint-pending]

# Dependency graph
requires:
  - phase: 01-02
    provides: "runClaudeCli + buildSpawnArgs (helper puro) + loadPrompt (5 .md, src/) + smoke-runner.ts (assertion CLI-free)"
  - phase: 01-03
    provides: "Questao +4 campos opcionais (server+web) + 5 SKILL.md espelho"
provides:
  - "ImageProvider (interface) + SvgClaudeImageProvider (svg-claude) + createImageProvider() — fundação de imagem (SPEC-04); sem raster; NÃO plugada no pipeline"
  - "Guard AUTOMATIZADO e CLI-free de não-regressão SPEC-01: smoke-runner --assert-args prova args/cwd/env byte-idênticos ao CliProvider.invoke() pré-refator, sem spawnar o claude (Pitfall 2)"
  - "Validação cross-mode de loadPrompt: 5 .md resolvem de src/ em tsx (src) E node dist (prod) — Pitfall 1 fechado"
affects: [fase-4, image-provider, mnemonic-image, IMG-01, IMG-02, IMG-03, IMGR-01]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Factory de provider espelhando createProvider() (default no fim): createImageProvider() → svg-claude"
    - "Flag de harness CLI-free (--assert-args) que encerra o smoke-runner após os passos offline (loadPrompt + assertion de args), preservando o passo CLI para o checkpoint humano"
    - "Prova cross-mode do invariante .md-em-src/: executar o módulo COMPILADO de dist/ e confirmar resolução do .md de src/ (heurística dist→src do Plano 02)"

key-files:
  created:
    - ankinator-app/server/src/core/specialists/image-provider.ts
  modified:
    - ankinator-app/server/src/scripts/smoke-runner.ts

key-decisions:
  - "ImageProvider vive 100% no server (D-08); SvgClaudeImageProvider usa loadPrompt('mnemonic-image') + runClaudeCli e consome AMBOS os parâmetros (mnemonic E context) — sem parâmetro não usado (Pitfall 5)."
  - "createImageProvider() retorna svg-claude por default (D-10); TODO(v2) marca a seleção raster por env (IMGR-01) e TODO(IMG-02) marca a sanitização de SVG como diferida p/ a Fase 4 (D-09). Nenhum provider raster implementado; nada plugado em generation.ts/exporters."
  - "Task 2 (Rule 3): adicionado guard --assert-args ao smoke-runner.ts para rodar o guard SPEC-01 OFFLINE (passos 1+2), sem spawnar o claude — necessário porque o smoke-runner do Plano 02 sempre roda o passo 3 (CLI) por top-level await. O plano de spawn (buildSpawnArgs) NÃO foi tocado; é mudança só de harness."
  - "Task 4 é HARD-BLOCK humano e este executor é não-interativo: NÃO auto-aprovado, NÃO fabricado. O baseline foi SIMBÓLICO (sem fixture PDF) — a verificação E2E de regressão (SPEC-01 geração real + PIPE-03) exige um PDF fornecido pelo usuário. Plano fica CHECKPOINT-PENDING."

patterns-established:
  - "Guard de não-regressão totalmente automatizado e offline: a equivalência byte-a-byte do plano de spawn é prova suficiente de SPEC-01 sem exercitar o CLI nem depender de PDF."
  - "Pitfall 1 fechado cross-mode com lengths idênticos src↔dist (2360/1955/2036/1653/1727) para os 5 nomes."

requirements-completed: [SPEC-04]

# Metrics
duration: 6min
completed: 2026-06-03
---

# Phase 1 Plan 04: Fechamento do Andaime (ImageProvider + guard CLI-free + cross-mode) Summary

**Interface `ImageProvider` + `SvgClaudeImageProvider`/`createImageProvider()` (svg-claude default, sem raster, não plugado) entregues; não-regressão SPEC-01 provada AUTOMATICAMENTE e offline via `smoke-runner --assert-args` (args/cwd/env byte-idênticos ao pré-refator); `loadPrompt` validado cross-mode tsx+dist (Pitfall 1 fechado). Task 4 (sign-off de regressão com PDF real) permanece CHECKPOINT-PENDING — HARD-BLOCK humano.**

> **STATUS: CHECKPOINT-PENDING (HARD-BLOCK).** Tasks 1–3 (a/b/c) DONE e committadas com evidência. Task 4 (d) BLOQUEADA aguardando verificação humana com um **PDF real fornecido** — o baseline do Plano 01 foi simbólico (sem fixture PDF). O plano **NÃO** está completo; nenhuma regressão E2E foi verificada ainda. Ver "Checkpoint Pendente (Task 4)" abaixo.

## Performance

- **Duration:** ~6 min (tasks a/b/c)
- **Started:** 2026-06-03T04:14:56Z
- **Completed (a/b/c):** 2026-06-03T04:21:06Z
- **Tasks:** 3 de 4 automatizadas concluídas; 1 checkpoint humano pendente
- **Files modified:** 2 (1 criado, 1 modificado)

## Accomplishments
- **SPEC-04 (Task 1):** `image-provider.ts` criado — `interface ImageProvider`, `class SvgClaudeImageProvider` (nome `svg-claude`, usa `loadPrompt('mnemonic-image')` + `runClaudeCli`, consome `mnemonic` E `context`), e factory `createImageProvider()` (default svg-claude). Sem provider raster; TODO(v2) p/ seleção por env (IMGR-01); TODO(IMG-02) p/ sanitização de SVG (Fase 4). NÃO importa/pluga `generation.ts` nem exporters. `npm run build` (server) exit 0; `dist/core/specialists/image-provider.js` emitido.
- **SPEC-01 guard automatizado e CLI-free (Task 2):** `smoke-runner --assert-args` sai **0 sem spawnar o `claude`** (sem quota/rede). A assertion confirma `args` na ordem canônica exata, `cwd === os.tmpdir()`, `env` derivado de `process.env`, e `userMessage` NÃO em `args` (vai por stdin). Conjunto byte-idêntico ao `CliProvider.invoke()` pré-refator ⇒ **não-regressão SPEC-01 provada offline** (Pitfall 2).
- **Pitfall 1 fechado cross-mode (Task 3):** build limpo (`rm -rf dist && npm run build`, exit 0, sem `dist/core/question-generator.js` stale, **0** `.md` em `dist/`). Modo DIST (`node` no módulo COMPILADO `dist/core/specialists/prompt-loader.js`) resolve os 5 `.md` de `src/` (lengths 2360/1955/2036/1653/1727). Modo SRC (`tsx`, CLI-free) resolve os mesmos 5 com lengths idênticos.

## Args verificados (guard SPEC-01 — registro)

A assertion CLI-free do passo 2 confirmou o plano de spawn de `buildSpawnArgs({ systemPrompt: SYSTEM_FIDELITY, userMessage: '<fixo>', model: 'sonnet' })`:

```
['-p', '--output-format', 'json', '--model', 'sonnet',
 '--system-prompt', <SYSTEM_FIDELITY>,
 '--exclude-dynamic-system-prompt-sections', '--strict-mcp-config']
cwd  === os.tmpdir()
env  ⊃ process.env (PATH idêntico)
bin  === (ANKINATOR_CLAUDE_BIN || 'claude')
userMessage NÃO ∈ args  (vai por stdin)
```

Este é o conjunto byte-idêntico ao que o `CliProvider.invoke()` pré-refator montava — a ausência de divergência É a prova automatizada de SPEC-01 (Pitfall 2), independente do CLI e de qualquer PDF.

## Task Commits

Cada tarefa automatizada foi committada atomicamente:

1. **Task 1: ImageProvider + SvgClaudeImageProvider + createImageProvider (SPEC-04)** — `3ebf8f6` (feat)
2. **Task 2: guard CLI-free de SPEC-01 via smoke-runner --assert-args (Pitfall 2)** — `2664ba6` (test)
3. **Task 3: validação cross-mode de loadPrompt (tsx src + node dist)** — sem commit de código (rodou scripts existentes; build limpo é gitignored). Evidência registrada aqui.

**Plan metadata (checkpoint-pending):** commit de docs deste SUMMARY + STATE.md / ROADMAP.md / REQUIREMENTS.md (marcando SPEC-04; plano em estado checkpoint-pending).

## Files Created/Modified
- `ankinator-app/server/src/core/specialists/image-provider.ts` — `ImageProvider`/`SvgClaudeImageProvider`/`createImageProvider()`. 100% no server; usa runner + prompt canônico `mnemonic-image`; sem raster; TODO(IMG-02) sanitização e TODO(v2) raster por env; não plugado no pipeline.
- `ankinator-app/server/src/scripts/smoke-runner.ts` — guard `--assert-args` adicionado: roda passos 1+2 (loadPrompt ×5 + assertion de args, CLI-free) e encerra com `process.exit(0)` ANTES do passo 3 (CLI). Sem a flag, o passo 3 ainda spawna o `claude` (preservado p/ o checkpoint humano). `buildSpawnArgs` NÃO foi tocado.

## Decisions Made
- **ImageProvider mínimo e fiel ao D-08/D-09/D-10:** só a fundação. A impl é funcional (usa runner+prompt de fato, sem stub vazio — Pitfall 5) mas NÃO é chamada pelo runtime. Sanitização e seleção por env explicitamente diferidas via TODO no código.
- **Guard SPEC-01 deve ser offline:** a flag `--assert-args` torna o passo 2 executável sem CLI/quota/PDF; é o único mecanismo automatizado de não-regressão e roda em qualquer ambiente.
- **Checkpoint não fabricado:** sem PDF não há prova de regressão E2E; o executor pausa em vez de inventar um sign-off.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Adicionado guard `--assert-args` ao smoke-runner.ts para o guard SPEC-01 rodar CLI-free**
- **Found during:** Task 2 (guard determinístico CLI-free de SPEC-01)
- **Issue:** O `smoke-runner.ts` do Plano 02 roda o passo 3 (`runClaudeCli`, que SPAWNA o `claude`) por top-level await incondicional. O `<verify>` da Task 2 usa `--assert-args`, mas essa flag ainda não existia. Sem ela, não havia como rodar SÓ os passos offline (1+2) — qualquer execução spawnaria o CLI (consumindo quota da assinatura), violando o requisito "CLI-free / sem rede" do guard.
- **Fix:** Envolvido o passo 3 num guard `if (process.argv.includes('--assert-args')) { ...; process.exit(0); }` logo após o passo 2. O plano de spawn (`buildSpawnArgs`) ficou intacto — é mudança puramente de harness de teste. O plano explicitamente antecipa isto ("a flag/segmento que o smoke-runner do Plano 02 expoe para rodar SO o passo 2 sem spawnar o CLI").
- **Files modified:** `ankinator-app/server/src/scripts/smoke-runner.ts`
- **Verification:** `npx tsx src/scripts/smoke-runner.ts --assert-args` sai 0; grep confirma que a linha "exercita o claude CLI" NÃO é impressa (CLI não spawnado); `npm run build` exit 0.
- **Committed in:** `2664ba6` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking — harness CLI-free)
**Impact on plan:** O guard SPEC-01 ficou executável offline sem alterar o plano de spawn. Zero scope creep; comportamento de produção inalterado.

## Issues Encountered
- **Ruído de shell do ambiente** (`setValueForKeyFakeAssocArray ... _encode/_decode` e o proxy `rtk`), o mesmo dos planos 01/02. Contornado capturando exit codes e logs em `/tmp/*.log` e filtrando com `grep -v`. Nenhum impacto no resultado: os builds saíram 0, a assertion CLI-free saiu 0 e a resolução cross-mode saiu 0.
- **Caminho do `.planning/`:** o repo real tem o `.planning/` em `/home/t316360/plottwist/ankinator/` (root do monorepo), não em `ankinator-app/`. Lido o estado correto antes de qualquer escrita; nenhuma sobrescrita.

## Threat Surface
Nenhuma superfície de ataque ativa nova (alinhado ao `<threat_model>` do plano):
- **T-01-04a (Tampering/SVG):** `accept (defer)` — `SvgClaudeImageProvider` existe mas NÃO é plugado; sanitização é IMG-02 (Fase 4), marcada com TODO no código. Sem superfície ativa.
- **T-01-04b (Tampering/runClaudeCli via image-provider):** `mitigate` — reusa o spawn herdado (array de args + stdin); a assertion da Task 2 prova deterministicamente que `userMessage` não vaza para `args` (sem shell string).
- **T-01-SC:** `accept` — nenhum `npm install` nesta fase.

## Known Stubs
Nenhum stub que impeça o objetivo do plano. Por design do andaime:
- `SvgClaudeImageProvider` é funcional (usa runner+prompt reais) mas **não é chamado pelo pipeline** — a invocação é da Fase 4 (deferred travado por CONTEXT). Não é stub a resolver, é escopo futuro marcado com TODO(IMG-02).

## Checkpoint Pendente (Task 4) — HARD-BLOCK, ação humana necessária

**Tipo:** checkpoint:human-verify (HARD-BLOCK; ignora auto_advance).
**Status:** BLOQUEADO — requer um **PDF real fornecido pelo usuário**.

O que JÁ está provado automaticamente (não precisa de humano):
- Não-regressão SPEC-01 a nível de plano de spawn (args/cwd/env byte-idênticos) — Task 2, CLI-free.
- `loadPrompt` cross-mode (Pitfall 1) — Task 3.
- Build verde + `image-provider.ts` (SPEC-04) — Task 1.

O que o checkpoint AINDA exige (comportamento de geração real ponta-a-ponta):
1. **Regressão SPEC-01 (geração real):** com um PDF curto FORNECIDO, rodar `cd ankinator-app/server && npx tsx src/scripts/smoke-cli.ts <caminho.pdf>` e confirmar EQUIVALÊNCIA de comportamento com `.planning/phases/01-andaime-dos-especialistas/baseline-cli.txt` (a saída do LLM não é determinística — confirmar forma `[tipo] Q:/A:` e quantidade plausível, não igualdade textual).
2. **Fluxo E2E (PIPE-03):** subir server + web, fazer upload do PDF, gerar questões e exportar CSV; confirmar que o resultado é equivalente ao comportamento atual (campos novos de `Questao` ausentes/ignorados).
3. **(Opcional) Skills (SPEC-03):** reiniciar a sessão do Claude Code e confirmar que `/anki-orchestrator` (e os outros 4) aparecem e apontam para o `.md` canônico.

**Por que está bloqueado:** o baseline do Plano 01 foi SIMBÓLICO — não há PDF versionado no repo. Sem um PDF, a verificação E2E de regressão não roda e o checkpoint **não avança** (HARD-BLOCK por design). Este executor é não-interativo e **não** pode fabricar o sign-off.

**Ação humana para liberar:** forneça o caminho de um PDF curto e, após confirmar zero regressão (SPEC-01 geração + PIPE-03), digite "approved" — ou descreva as diferenças observadas.

## Next Phase Readiness
- **SPEC-04 entregue:** a interface `ImageProvider` e a impl `svg-claude` estão prontas para a Fase 4 (mnemônico+imagem) plugar no pipeline e adicionar sanitização (IMG-02).
- **Fase 1 NÃO está fechada:** o sign-off de regressão (Task 4) está pendente de PDF. ROADMAP/STATE refletem 01-04 como checkpoint-pending (não complete).
- **Lembrete (caveat A1):** `loadPrompt` resolve de `src/`; se o deploy mudar para dist-only, ativar o Plano B (copiar `.md` p/ `dist/` pós-tsc).

## Self-Check: PASSED

---
*Phase: 01-andaime-dos-especialistas*
*Status: CHECKPOINT-PENDING (Task 4 hard-block — PDF real necessário)*
*Updated: 2026-06-03*
