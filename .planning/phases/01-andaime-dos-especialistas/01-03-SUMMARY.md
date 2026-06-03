---
phase: 01-andaime-dos-especialistas
plan: 03
subsystem: types + claude-tooling
tags: [questao, type-extension, server-web-mirror, skills, progressive-disclosure, single-source, spec-03, spec-05]

# Dependency graph
requires:
  - phase: 01-01
    provides: "deps alinhadas ao lockfile (tsc 5.9.3) + src/ build-safe — builds verdes server/web"
  - phase: 01-02
    provides: "5 .md canônicos em server/src/core/specialists/prompts/ (fonte única que as SKILL.md referenciam por path)"
provides:
  - "Questao (server core/types.ts) estendido com deck?/tags?/mnemonico?/mnemonicoSvg? (opcionais) — campos que cruzam a fronteira HTTP p/ as fases 3-4 popularem"
  - "Questao (web src/types.ts) espelhado com assinatura IDÊNTICA (tipo duplicado sincronizado no mesmo commit)"
  - "5 SKILL.md espelho em .claude/skills/<nome>/ que REFERENCIAM por path os .md canônicos — especialistas usáveis manualmente no Claude Code, sem cópia divergente"
affects: [01-04, deck-classifier, card-builder, mnemonic, mnemonic-image, anki-orchestrator, fase-3, fase-4]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Extensão aditiva de interface duplicada: os MESMOS 4 campos opcionais inseridos em server E web no MESMO commit (Pitfall 4 — tipo Questao duplicado sincronizado manualmente)"
    - "Single-source via progressive disclosure: SKILL.md descreve QUANDO usar + aponta por path para o .md canônico; NÃO copia o corpo (evita duas fontes divergentes — mesmo anti-pattern do tipo duplicado)"

key-files:
  created:
    - .claude/skills/anki-orchestrator/SKILL.md
    - .claude/skills/deck-classifier/SKILL.md
    - .claude/skills/card-builder/SKILL.md
    - .claude/skills/mnemonic/SKILL.md
    - .claude/skills/mnemonic-image/SKILL.md
  modified:
    - ankinator-app/server/src/core/types.ts
    - ankinator-app/web/src/types.ts

key-decisions:
  - "Nomes de pasta das Skills = os 5 nomes canônicos (D-07) exatamente como no script de verificação do PLAN: anki-orchestrator, deck-classifier, card-builder, mnemonic, mnemonic-image (só o orquestrador carrega prefixo anki-). Folder-name == prompt-name nos 5 → a referência por path specialists/prompts/<nome>.md fecha 1:1."
  - "Reconciliação CONTEXT D-06 (que ilustrava .claude/skills/anki-<nome>/) vs PLAN: a fonte autoritativa é o <verify> automatizado do PLAN (checa .claude/skills/$n/SKILL.md p/ os 5 nomes bare) + files_modified — seguidos à risca."
  - "Os 4 campos são todos opcionais (?:) — D-11/D-13: fluxo atual upload→extract→gerar→exportar continua intacto; mapRawQuestoes e exporters NÃO foram tocados (campos ignorados quando ausentes)."

patterns-established:
  - "SKILL.md como ponteiro (progressive disclosure): frontmatter (name<=64 [a-z0-9-] sem claude/anthropic + description PT) + corpo que referencia o .md canônico por path + seção '## Quando usar' — zero duplicação do system prompt."

requirements-completed: [SPEC-03, SPEC-05]

# Metrics
duration: 5min
completed: 2026-06-03
---

# Phase 1 Plan 03: Questao estendido (server+web) + 5 SKILL.md espelho Summary

**Tipo `Questao` ganha deck?/tags?/mnemonico?/mnemonicoSvg? (opcionais) com assinatura IDÊNTICA em server e web no mesmo commit (fluxo atual intacto, ambos os builds verdes), e 5 SKILL.md em `.claude/skills/<nome>/` que REFERENCIAM por path os `.md` canônicos do Plano 02 — fonte única preservada via progressive disclosure, sem cópia divergente.**

## Performance

- **Duration:** ~5 min
- **Completed:** 2026-06-03
- **Tasks:** 2
- **Files modified:** 7 (5 criados, 2 modificados)

## Accomplishments

- **SPEC-05:** `interface Questao` estendida com 4 campos opcionais (`deck?: string`, `tags?: string[]`, `mnemonico?: string`, `mnemonicoSvg?: string`) inseridos após `metadata?` em **ambos** os arquivos duplicados — `ankinator-app/server/src/core/types.ts` e `ankinator-app/web/src/types.ts` — com assinatura idêntica (camelCase `mnemonicoSvg`), no MESMO commit (Pitfall 4). `grep 'mnemonicoSvg?: string'` casa 1× em cada arquivo.
- **Não-regressão (D-11/D-13):** todos os campos são opcionais; `mapRawQuestoes()` (generation.ts) e os exporters (csv/ankiconnect) NÃO foram modificados. `cd ankinator-app/server && npm run build` saiu **0** e `cd ankinator-app/web && npm run build` saiu **0** — fluxo atual intacto.
- **SPEC-03:** criadas 5 `SKILL.md` em `.claude/skills/{anki-orchestrator,deck-classifier,card-builder,mnemonic,mnemonic-image}/` (diretório `.claude/skills/` era inexistente — criado). Cada uma: frontmatter `name: <nome>` (≤64 chars, só `[a-z0-9-]`, sem "claude"/"anthropic" no `name:`) + `description` curta em PT focada no caso de uso; corpo que REFERENCIA por path `specialists/prompts/<nome>.md` (a única fonte) + seção `## Quando usar` com 2-3 bullets do papel do especialista.
- **Fonte única preservada (D-06):** nenhuma SKILL.md copia o corpo do `.md` canônico — referência textual por path (progressive disclosure), evitando duas fontes divergentes (mesmo anti-pattern do tipo `Questao` duplicado). O `<verify>` automatizado do PLAN passou (`skills ok=1`).

## Task Commits

Cada tarefa committada atomicamente (executor sequencial no `main`, hooks ativos):

1. **Task 1: Estender Questao +4 campos opcionais (server+web, mesmo commit)** — `95bb4aa` (feat)
2. **Task 2: 5 SKILL.md espelho referenciando os .md canônicos** — `d54c8fd` (feat)

**Plan metadata:** commit de docs final (SUMMARY.md / STATE.md / ROADMAP.md / REQUIREMENTS.md).

## Files Created/Modified

- `ankinator-app/server/src/core/types.ts` — `interface Questao` + bloco SPEC-05 (4 campos opcionais após `metadata?`, com comentário "ignorados quando ausentes; embed real nas fases 3-4").
- `ankinator-app/web/src/types.ts` — espelho EXATO da mudança do server (mesmos 4 campos, mesma assinatura).
- `.claude/skills/anki-orchestrator/SKILL.md` — referencia `specialists/prompts/anki-orchestrator.md`.
- `.claude/skills/deck-classifier/SKILL.md` — referencia `specialists/prompts/deck-classifier.md`.
- `.claude/skills/card-builder/SKILL.md` — referencia `specialists/prompts/card-builder.md`.
- `.claude/skills/mnemonic/SKILL.md` — referencia `specialists/prompts/mnemonic.md`.
- `.claude/skills/mnemonic-image/SKILL.md` — referencia `specialists/prompts/mnemonic-image.md`.

## Decisions Made

- **Nomes das pastas de Skill = os 5 canônicos do PLAN (D-07), tal como no `<verify>`:** `anki-orchestrator`, `deck-classifier`, `card-builder`, `mnemonic`, `mnemonic-image`. A CONTEXT (D-06) ilustrava `.claude/skills/anki-<nome>/`, mas a fonte autoritativa é o script de verificação automatizado do PLAN + `files_modified` (que usam os nomes bare, com prefixo `anki-` só no orquestrador). Como folder-name == prompt-name nos 5, a referência por path `specialists/prompts/<nome>.md` fecha 1:1.
- **Reservado-word check só no `name:`:** as palavras "Claude"/"assinatura Claude" aparecem legitimamente em algumas `description` (ex.: "SVG sem API/billing, via assinatura Claude") — o constraint da spec proíbe "claude"/"anthropic" apenas no campo `name`, e o `<verify>` confirma isso inspecionando só a linha `^name:`.
- **Sem alterar consumidores (D-13):** campos opcionais não exigem mudança em `mapRawQuestoes()` nem nos exporters; o tipo não foi unificado em workspace compartilhado (fora de escopo — backlog do anti-pattern).

## Deviations from Plan

None - plan executed exactly as written.

Sem auth gates, sem mudanças arquiteturais (Rule 4), sem bugs/funcionalidade crítica faltante a auto-corrigir (Rules 1-3). A única reconciliação foi documental (nomes de pasta das Skills: PLAN > CONTEXT), resolvida a favor do `<verify>` autoritativo do próprio PLAN — não constitui desvio de implementação.

## Issues Encountered

- **Ruído de shell do ambiente** (`setValueForKeyFakeAssocArray ... _encode/_decode` + proxy `rtk`) poluiu stdout de vários comandos — mesmo fenômeno dos `01-01`/`01-02-SUMMARY.md`. Contornado capturando exit codes em `/tmp/*-build.log` e filtrando o ruído. Ambos os `npm run build` saíram 0; o `<verify>` das Skills imprimiu `skills ok=1` / `VERIFY PASS`. Nenhum impacto no resultado.

## Threat Surface

Nenhuma superfície de segurança nova além da mapeada no `<threat_model>` do plano:
- **T-01-03a (Tampering/SKILL.md):** as 5 SKILL.md referenciam APENAS `server/src/core/specialists/prompts/*.md` do próprio repo (fonte confiável) — sem URL externa, sem `@import` de fonte não confiável.
- **T-01-03b (Info disclosure/SKILL.md):** o conteúdo descreve o papel do especialista; sem segredos/credenciais. App local single-user.
- **Campos novos de `Questao`** são opcionais e não introduzem novo input externo nesta fase (sem nova superfície). Embed real de SVG/deck/tags é das fases 3-4.

## Known Stubs

Nenhum stub que impeça o objetivo do plano. Por design desta fase de andaime:
- Os 4 campos novos de `Questao` existem mas ainda **não são populados** por nenhum estágio (deck/tags/mnemônico/SVG entram nas fases 3-4 — escopo futuro travado por CONTEXT, não stub a resolver).
- As 5 SKILL.md são ponteiros para o conhecimento canônico; a lógica que invoca cada especialista no pipeline é das fases 3-5.

## Next Phase Readiness

- **Pronto para o Plano 04:** o tipo estendido e as Skills não bloqueiam o Plano 04 (ImageProvider/svg-claude + assertion CLI-free + cross-mode loadPrompt + checkpoint hard-block). `mnemonicoSvg` já existe no tipo para o `SvgClaudeImageProvider` (fase 4) popular depois.
- **Live change detection:** o usuário pode precisar **reiniciar a sessão do Claude Code** para as 5 novas Skills aparecerem no menu `/` (live detection de diretório top-level — RESEARCH Open Question 3). As pastas e os `SKILL.md` já estão no lugar e committados.

## Self-Check: PASSED

- Commits existem: `95bb4aa` (FOUND), `d54c8fd` (FOUND).
- 5 `.claude/skills/<nome>/SKILL.md` (FOUND ×5).
- Ambos os `types.ts` contêm `mnemonicoSvg?: string` (FOUND ×2).

---
*Phase: 01-andaime-dos-especialistas*
*Completed: 2026-06-03*
