---
phase: 01-andaime-dos-especialistas
plan: 02
subsystem: api
tags: [specialists, runner, claude-cli, spawn, prompt-loader, esm-nodenext, smoke-test, non-regression]

# Dependency graph
requires:
  - phase: 01-01
    provides: "Baseline simbólico do CliProvider + deps alinhadas ao lockfile (tsc 5.9.3) + src/ build-safe (sem import pendente)"
provides:
  - "runClaudeCli({systemPrompt,userMessage,model?}) — runner reutilizável do claude -p (assinatura) extraído do CliProvider, base das fases 3-5"
  - "buildSpawnArgs(...) — helper PURO (não spawna) que devolve {bin,args,cwd,env}; fonte única do plano de spawn e introspecção CLI-free para a assertion de não-regressão SPEC-01"
  - "CliProvider.invoke() delega para runClaudeCli passando SYSTEM_FIDELITY (comportamento idêntico ao pré-refator)"
  - "loadPrompt(nome) — lê os 5 .md canônicos resolvendo SEMPRE de src/ (allowlist + cache); validado cross-mode (tsx-src E node-dist)"
  - "5 .md canônicos (fonte única, PT, foco concurso): anki-orchestrator, deck-classifier, card-builder, mnemonic, mnemonic-image"
  - "smoke-runner.ts com a assertion determinística CLI-free de args/cwd/env (guard SPEC-01) — executado no Plano 04"
affects: [01-03, 01-04, deck-classifier, card-builder, mnemonic, mnemonic-image, anki-orchestrator, image-provider, fase-3, fase-4, fase-5]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Extract Function (Strangler interno): invoke() do CliProvider → função livre runClaudeCli, parametrizando só systemPrompt"
    - "Helper PURO de plano de spawn (buildSpawnArgs) como fonte única introspectável → não-regressão verificável SEM spawnar o CLI (CLI-free guard)"
    - "Resolução de asset .md em ESM NodeNext via heurística dist→src (troca de segmento) sobre fileURLToPath(import.meta.url) — nunca __dirname, nunca dist/"
    - "Allowlist de nomes canônicos antes do readFileSync (anti path-traversal) + cache em Map"

key-files:
  created:
    - ankinator-app/server/src/core/specialists/runner.ts
    - ankinator-app/server/src/core/specialists/prompt-loader.ts
    - ankinator-app/server/src/core/specialists/prompts/anki-orchestrator.md
    - ankinator-app/server/src/core/specialists/prompts/deck-classifier.md
    - ankinator-app/server/src/core/specialists/prompts/card-builder.md
    - ankinator-app/server/src/core/specialists/prompts/mnemonic.md
    - ankinator-app/server/src/core/specialists/prompts/mnemonic-image.md
    - ankinator-app/server/src/scripts/smoke-runner.ts
  modified:
    - ankinator-app/server/src/core/providers/cli-provider.ts

key-decisions:
  - "Técnica de resolução do .md: heurística dist→src (técnica (a) do plano) — mínima, sem I/O de busca ascendente; dist/ espelha src/ 1:1 (mesma profundidade core/specialists/), então a troca de segmento é exata. Validada cross-mode rodando o dist .js compilado."
  - "Caveat A1: loadPrompt pressupõe a árvore src/ presente no deploy (app local single-user roda do checkout). Deploy 'dist-only' exigiria o Plano B (copiar prompts/*.md p/ dist/ pós-tsc)."
  - "buildSpawnArgs recebe userMessage só para a assertion validar que ele NÃO vaza para args (continua via stdin); runClaudeCli consome o helper como fonte única do plano (1 único spawn, nunca em buildSpawnArgs)."

patterns-established:
  - "CLI-free non-regression guard: assertion determinística sobre buildSpawnArgs (args na ordem canônica exata, cwd=os.tmpdir(), env⊃process.env, userMessage não vaza p/ args) prova transparência comportamental do refator sem exercitar o CLI."
  - "Ordem de tasks que mantém src/ sempre compilável: produtor (runner+loader) antes do consumidor (smoke-runner) — evita import dangling TS2307 dado include src/**/*.ts sem exclude."

requirements-completed: [SPEC-01, SPEC-02]

# Metrics
duration: 6min
completed: 2026-06-03
---

# Phase 1 Plan 02: Coração do Andaime (runner + prompt-loader + 5 prompts) Summary

**runClaudeCli + helper puro buildSpawnArgs extraídos do CliProvider (delegação sem regressão, guard determinístico CLI-free de SPEC-01), loadPrompt resolvendo 5 .md canônicos sempre de src/ (allowlist+cache, validado cross-mode), e smoke-runner.ts criado após os contratos — build verde em todo limite de tarefa.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-06-03T03:53:32Z
- **Completed:** 2026-06-03
- **Tasks:** 3
- **Files modified:** 9 (8 criados, 1 modificado)

## Accomplishments
- **SPEC-01:** `runClaudeCli` extraído byte-a-byte de `CliProvider.invoke()` (args/cwd/env/timeout/parse/fallback idênticos); `CliProvider` delega passando `SYSTEM_FIDELITY` — sem mudança de comportamento observável. Helper PURO `buildSpawnArgs` introspectável torna a não-regressão **verificável sem spawnar o CLI**.
- **SPEC-02:** `loadPrompt(nome)` lê os 5 `.md` canônicos resolvendo SEMPRE de `src/` (Pitfall 1: `tsc` não copia `.md` p/ `dist/`), com allowlist (anti path-traversal) e cache. Os 5 `.md` canônicos criados como fonte única (PT, tom `SYSTEM_FIDELITY`, foco concurso — aproveitar questões prontas E criar novas).
- **Blocker fechado:** `smoke-runner.ts` criado APÓS `runner.ts`/`prompt-loader.ts` (mesmo plano) — `src/` nunca teve import pendente; `npm run build` saiu 0 em **todos** os 3 limites de tarefa.
- **Guard SPEC-01 já comprovado (CLI-free):** verifiquei independentemente, rodando o `dist` compilado, que `buildSpawnArgs({systemPrompt: SYSTEM_FIDELITY, ...})` produz args na ordem canônica exata, `cwd === os.tmpdir()`, `env` derivado de `process.env`, `bin` correto e `userMessage` NÃO em `args` (vai por stdin) → **PASS**. (A execução do passo 3 / CLI fica para o Plano 04.)

## Task Commits

Cada tarefa foi committada atomicamente:

1. **Task 1: Extrair runClaudeCli + buildSpawnArgs; CliProvider delega** — `cb7c383` (refactor)
2. **Task 2: prompt-loader.ts (allowlist+cache, src/) + 5 .md canônicos** — `7a58f4f` (feat)
3. **Task 3: smoke-runner.ts (após contratos — blocker fechado)** — `0b10243` (test)

**Plan metadata:** commit de docs final (STATE.md / ROADMAP.md / REQUIREMENTS.md / SUMMARY.md).

## Files Created/Modified
- `ankinator-app/server/src/core/specialists/runner.ts` — `runClaudeCli` (Promise<string>, retorna `env.result`) + `buildSpawnArgs` puro (`SpawnPlan {bin,args,cwd,env}`); consts `CLI_BIN`/`CALL_TIMEOUT_MS` e `interface CliEnvelope` movidos para cá. Único `spawn(` do módulo, dentro de `runClaudeCli`.
- `ankinator-app/server/src/core/specialists/prompt-loader.ts` — `loadPrompt(nome)`: allowlist dos 5 nomes (throw antes do `readFileSync`), cache em `Map`, resolução `src/` via heurística dist→src sobre `fileURLToPath(import.meta.url)`. Comentário documenta técnica + caveat A1.
- `ankinator-app/server/src/core/specialists/prompts/{anki-orchestrator,deck-classifier,card-builder,mnemonic,mnemonic-image}.md` — fonte única do conhecimento de cada especialista (PT, fidelidade ao material, foco concurso). NÃO plugados no pipeline nesta fase.
- `ankinator-app/server/src/scripts/smoke-runner.ts` — passo 1 (loadPrompt ×5), passo 2 (assertion CLI-free de args/cwd/env/bin + não-vaza — guard SPEC-01), passo 3 (runClaudeCli — só no Plano 04). Imports `.js` (NodeNext) de `runner.js`, `prompt-loader.js`, `core/prompts.js`, `node:os`.
- `ankinator-app/server/src/core/providers/cli-provider.ts` — `invoke()` reduzido a 1 linha de delegação para `runClaudeCli({ systemPrompt: SYSTEM_FIDELITY, userMessage, model })`; removidos `spawn`/`os`, consts e `CliEnvelope` (0 `spawn(`, 0 `interface CliEnvelope`).

## Decisions Made
- **Técnica de `loadPrompt` = heurística dist→src (técnica (a)).** A partir de `path.dirname(fileURLToPath(import.meta.url))`, se houver segmento `dist` (modo `node dist/...`), troca-o por `src`; em modo `tsx` o caminho já é `src/` e fica intacto. Escolhida sobre (b) "subir até o `package.json`" por ser mínima (sem I/O de busca ascendente) e exata (o layout `dist/` espelha `src/` 1:1, mesma profundidade `core/specialists/`). **Validada cross-mode**: rodei o `dist/core/specialists/prompt-loader.js` compilado e ele resolveu os 5 `.md` de `src/` corretamente.
- **Caveat A1 (deploy):** `loadPrompt` pressupõe que a árvore `src/` acompanha o ambiente (app local single-user roda do checkout — `tsc` NÃO copia `.md` para `dist/`). Se algum dia houver deploy **dist-only** sem `src/`, trocar para o **Plano B**: passo pós-`tsc` que copia `prompts/*.md` para `dist/core/specialists/prompts/` e resolver relativo ao módulo. Para o uso atual é seguro.
- **`buildSpawnArgs` recebe `userMessage`** apenas para a assertion ter o input completo e poder provar que ele NÃO entra em `args` (continua via stdin — mitigação de command injection T-01-02a). `runClaudeCli` é o único ponto com `spawn(` e consome o helper como fonte única do plano.

## Deviations from Plan

None - plan executed exactly as written.

A ordem obrigatória de tasks (runner → prompt-loader+.md → smoke-runner) foi seguida estritamente; `npm run build` saiu 0 em cada limite. Não houve auth gates, nem mudanças arquiteturais, nem bugs/funcionalidade crítica faltante a auto-corrigir. (Extra além do exigido pela Task 2: rodei uma validação cross-mode do `loadPrompt` via `dist` compilado — não é desvio, é verificação a mais que adianta evidência do Pitfall 1 cujo gate formal é o Plano 04.)

## Issues Encountered
- **Ruído de shell do ambiente** (`setValueForKeyFakeAssocArray ... _encode/_decode` e o proxy `rtk`) poluiu stdout de vários comandos (mesmo fenômeno registrado no `01-01-SUMMARY.md`). Contornado capturando exit codes em arquivos `/tmp/*-build.log` e filtrando o ruído com `grep -v`. Os três `npm run build` saíram 0; o smoke CLI-free do `loadPrompt` e da assertion de args rodaram limpos após o filtro. Nenhum impacto no resultado.

## Threat Surface
Nenhuma superfície de segurança nova além da já mapeada no `<threat_model>` do plano:
- **T-01-02a (Tampering/spawn):** mantido `spawn` com array de args + prompt por stdin; a assertion CLI-free prova que `userMessage` não vaza para `args`.
- **T-01-02b (Tampering/loadPrompt):** allowlist dos 5 nomes validada ANTES do `readFileSync` (traversal bloqueado — confirmado: `loadPrompt('../../etc/passwd')` lança).
- **T-01-02c (Info disclosure/.md):** os 5 `.md` são instruções de especialista, sem segredos/credenciais (sem `ANTHROPIC_API_KEY` — path de assinatura não usa chave).

## Known Stubs
Nenhum stub que impeça o objetivo do plano. Por design desta fase de andaime:
- Os 5 `.md` canônicos e o `runClaudeCli`/`loadPrompt` existem mas **não são chamados pelo pipeline** (`generation.ts`/exporters intactos). A lógica que os invoca é das fases 3-5 (deferred travado por CONTEXT — não é stub a resolver, é escopo futuro).
- `smoke-runner.ts` passo 3 (CLI) não é executado neste plano — execução fica para o Plano 04 (cross-mode `tsx` E `node dist`).

## Next Phase Readiness
- **Pronto para o Plano 03/04:** os contratos `runClaudeCli`/`buildSpawnArgs`/`loadPrompt` existem, exportados e compiláveis; build verde nos limites. O Plano 04 roda o `smoke-runner.ts` em `tsx` (src) E `node dist` (prod) — fecha formalmente o Pitfall 1 — e compara a assertion de args com o `baseline-cli.txt` (guard SPEC-01) + checkpoint hard-block.
- **Pendências futuras (não bloqueiam):** `image-provider.ts` (SPEC-04) e extensão do tipo `Questao` (SPEC-05) ainda não estão neste plano — ver o plano correspondente da fase. As Skills (`.claude/skills/anki-*/SKILL.md`, SPEC-03) também ficam para o plano que as cobre.
- **Lembrete (caveat A1):** se a estratégia de deploy mudar para dist-only, ativar o Plano B do `loadPrompt`.

## Self-Check: PASSED

---
*Phase: 01-andaime-dos-especialistas*
*Completed: 2026-06-03*
