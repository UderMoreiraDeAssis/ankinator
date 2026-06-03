---
phase: 3
slug: classificador-de-deck-card-educativo
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-06-03
validated: 2026-06-03
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.8 (devDependency no workspace `server` — instalado em Wave 0) |
| **Config file** | none — zero-config com Node 24 ESM |
| **Quick run command** | `npx tsx ankinator-app/server/src/scripts/guard-enrich.ts` |
| **Full suite command** | `cd ankinator-app/server && npx vitest run` |
| **Estimated runtime** | guard ~5s · full unit suite ~15s |

---

## Sampling Rate

- **After every task commit:** Run `npx tsx ankinator-app/server/src/scripts/guard-enrich.ts` (guard CLI-free, sem quota/rede)
- **After every plan wave:** Run `cd ankinator-app/server && npx vitest run` (full unit suite)
- **Before `/gsd:verify-work`:** Guard verde + unit suite verde
- **Max feedback latency:** 20 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| W0 | 00 | 0 | (infra) | — | N/A | install | `vitest ^4.1.8` em `server/package.json` (devDependency) | ✅ | ✅ done |
| PIPE-03-guard | 00/02 | final | PIPE-03 | — | toggles off → `enrichAll` NÃO chamado; `/generate` byte-idêntico; CSV byte-idêntico | guard CLI-free | `npx tsx src/scripts/guard-enrich.ts` | ✅ | ✅ green (exit 0) |
| DECK-01-parse | 01 | — | DECK-01 | — | `parseClassificacoesJson` casa deck por `id` (não posicional) | unit | `vitest run -t "parseClassificacoesJson"` | ✅ | ✅ green |
| DECK-02-tags | 02 | — | DECK-02 | — | `tagsDaQuestao` une `q.tags` ao Set sem duplicatas (`...(q.tags ?? [])`) | unit | `vitest run -t "tagsDaQuestao merge"` | ✅ | ✅ green |
| CARD-01-split | 01 | — | CARD-01 | T (fidelidade prova) | split 1→N só em `criada`; `extraida` NUNCA divide | unit | `vitest run -t "split extraida"` | ✅ | ✅ green |
| CARD-02-verso | 01 | — | CARD-02 | — | `extraida` só ajusta verso (explicação + fonte); pergunta/gabarito intactos | unit | `vitest run -t "card-builder extraida verso"` | ✅ | ✅ green |
| PIPE-01-seq | 01 | — | PIPE-01 | — | `enrichAll` encadeia classificar → card-builder em ordem; isolamento de erro por unidade (D-13) | unit | `vitest run -t "enrichAll sequência"` | ✅ | ✅ green |
| DECK-01-anki | 02 | — | DECK-01 | T (q.deck path-like) | deck hierárquico chega ao `deckName` por-nota; fallback a `opts.deck` | unit | `vitest run -t "ankiconnect routing"` | ✅ | ✅ green |
| DECK-01-csv | 02 | — | DECK-01 | — | coluna `Deck` + header `#deck column:5` quando `temDeck`; ausente quando não | unit | `vitest run -t "csv deck column"` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

> Plan/Wave/Task-ID columns finalized by the planner — esta tabela é o contrato de cobertura por requisito; o planner mapeia cada linha a uma task concreta.

---

## Wave 0 Requirements

- [x] `vitest ^4.1.8` instalado como devDependency em `ankinator-app/server/package.json` (script `test: vitest run`)
- [x] `ankinator-app/server/src/core/specialists/enrich.test.ts` — 22 tests green (DECK-01/02, CARD-01/02, PIPE-01, exporters, gate); 4 `it.todo` de comportamento preenchidos com tests reais (mock de `runClaudeCli`/`loadPrompt`)
- [x] `ankinator-app/server/src/scripts/guard-enrich.ts` — guard CLI-free de PIPE-03 (exit 0, 2 cenários)
- [x] `ankinator-app/server/src/scripts/smoke-enrich.ts` — smoke gated opt-in (requer claude CLI; manual-only)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| AnkiConnect cria/roteia subdecks `::` numa única `pushToAnki` (A1) | DECK-01 | Requer Anki + AnkiConnect local rodando; não há mock confiável | Subir Anki com AnkiConnect, exportar via push com cards de decks distintos, confirmar subdecks `Matéria::Assunto::Subtópico` criados |
| Import CSV com `#deck column:5` roteia por-nota (A2) | DECK-01 | Requer Anki desktop import dialog | Importar CSV gerado no Anki, confirmar cards caem nos subdecks corretos sem seleção manual |
| Verso "fato + explicação + fonte" legível no card (Flag 1) | CARD-02 | Renderização visual no Anki | Abrir card no Anki, confirmar `\n` → `<br>` legível |
| Qualidade real do classificador/card-builder | DECK-01/CARD-01 | Depende do LLM (não-determinístico) | `smoke-enrich.ts` com PDF real (gated, queima quota) |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (vitest install + enrich.test.ts + guard-enrich.ts)
- [x] No watch-mode flags (use `vitest run`, não `vitest`)
- [x] Feedback latency < 20s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** ✅ validated 2026-06-03 — todos os 7 requisitos com verificação automatizada (unit + guard).

---

## Validation Audit 2026-06-03

| Metric | Count |
|--------|-------|
| Gaps found | 4 |
| Resolved | 4 |
| Escalated | 0 |

Gaps eram 4 `it.todo` em `enrich.test.ts` (CARD-01 split, CARD-02 verso-only, PIPE-01 ordem de estágios, PIPE-01 isolamento de erro D-13) que só checavam `typeof fn === 'function'`. Preenchidos com tests reais que mockam `runClaudeCli`/`loadPrompt` — cobertura comportamental headless sem LLM/quota. Suite: 18 → 22 green, 0 todo, 0 fail. Nenhum arquivo de implementação modificado; nenhum bug de impl encontrado.
