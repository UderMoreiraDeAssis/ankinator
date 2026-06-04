---
phase: 04-mnem-nicos-imagem-svg
plan: "02"
subsystem: server/specialists
tags: [mnemonic, svg, image-provider, enrich, tdd, batch, fail-closed, anti-posicional]
dependency_graph:
  requires:
    - 04-01 (sanitizarSvg, mnemonic.md JSON batch format)
  provides:
    - parseMnemonicosJson (parser tolerante para batch JSON do especialista mnemônico)
    - enrichAll estágio 3 — mnemônico batch, merge anti-posicional por id
    - enrichAll estágio 4 — imagem SVG por-card, gated por q.mnemonico, fail-closed
    - EnrichOpts +mnemonico/+imagem (PIPE-03 completo)
    - EnrichProgress.estagio +gerando-mnemonico/+gerando-imagem
    - deveRodarEnrich ampliado para 4 toggles
    - image-provider.ts conectado (TODO(IMG-02) removido)
  affects:
    - Phase 04 Plan 03 (exporters CSV/ankiconnect precisam exibir q.mnemonico e q.mnemonicoSvg)
    - Phase 04 Plan 04 (UI: já feita em wave paralela)
tech_stack:
  added: []
  patterns:
    - batch-por-id via Map (anti-posicional D-02/D-03)
    - fail-soft em omissão (cards conceituais omitidos pelo LLM ficam sem mnemônico)
    - fail-closed na sanitização SVG (D-08/T-04-06: grava mnemonicoSvg apenas quando não-null)
    - isolamento por-card no estágio imagem (D-13: erro não aborta o lote)
    - TDD RED→GREEN cycle (2 commits: test RED + feat GREEN)
key_files:
  created: []
  modified:
    - ankinator-app/server/src/core/specialists/enrich.ts
    - ankinator-app/server/src/core/specialists/image-provider.ts
    - ankinator-app/server/src/core/specialists/enrich.test.ts
decisions:
  - "parseMnemonicosJson usa parseJsonBlock<RawMnemonico>(text, 'mnemonicos') — clone direto de parseClassificacoesJson"
  - "Merge mnemônico anti-posicional por id via Map, filter(m => m.id && m.mnemonico) antes do Map (D-02/D-03)"
  - "Estágio 4 imagem: loop sobre resultado[], not snapshot — resultado[i] = { ...q, mnemonicoSvg: limpo } in-place"
  - "sanitizarSvg importada com extensão .js (Pitfall 7 — NodeNext ESM obriga extensão em imports locais)"
  - "TODO(IMG-02) removido de image-provider.ts; separação de responsabilidades: provider gera, enrichAll sanitiza"
  - "vi.mock('./image-provider.js') + vi.mock('./sanitize-svg.js') para testes determinísticos do estágio 4"
metrics:
  duration: "~4 min"
  completed: "2026-06-04"
  tasks_completed: 3
  tasks_total: 3
  files_changed: 3
---

# Phase 04 Plan 02: enrichAll estágios 3+4 (mnemônico batch + imagem SVG) — Summary

**One-liner:** enrichAll ampliado com estágio 3 (mnemônico batch, merge anti-posicional por id) e estágio 4 (imagem SVG por-card, gated por q.mnemonico, fail-closed via sanitizarSvg); deveRodarEnrich cobre os 4 toggles (MNEM-01/02, IMG-01/02, PIPE-03).

## What Was Built

### Task 1: TDD RED — Testes comportamentais (45abda7)

Arquivo `enrich.test.ts` estendido com 19 novos `it()` (baseline 23 → 42):

- **parseMnemonicosJson:** 6 casos — JSON limpo, cercas, vazio, sem chave, inválido, tecnica opcional
- **enrichAll mnemônico batch:** 5 casos — merge por id, fail-soft omissão, anti-posicional (ids reordenados), loadPrompt('mnemonic'), erro não derruba job
- **enrichAll estágio imagem:** 5 casos — generate só para cards com q.mnemonico, SVG válido → mnemonicoSvg gravado, fail-closed (sanitizarSvg null → sem mnemonicoSvg + erro), isolamento por-card, encadeamento (imagem após mnemônico)
- **deveRodarEnrich:** +3 casos — mnemonico=true, imagem=true/mnemonico=false, todos off

Mocks adicionados:
```typescript
vi.mock('./image-provider.js', () => ({ createImageProvider: vi.fn(() => ({ nome: 'mock', generate: vi.fn() })) }));
vi.mock('./sanitize-svg.js', () => ({ sanitizarSvg: vi.fn((svg) => svg.trim().startsWith('<svg') ? svg : null) }));
```

Estado: 18 falhas esperadas (RED confirmado).

### Task 2: TDD GREEN — Implementação (a26f1b1)

**enrich.ts** — alterações aditivas (estágios 1+2 intactos):

1. **Imports adicionados:**
   ```typescript
   import { createImageProvider } from './image-provider.js';
   import { sanitizarSvg } from './sanitize-svg.js';
   ```

2. **EnrichOpts ampliado:** `mnemonico?: boolean; imagem?: boolean;`

3. **EnrichProgress.estagio ampliado:** `| 'gerando-mnemonico' | 'gerando-imagem'`

4. **RawMnemonico interface:** `{ id?: string; mnemonico?: string; tecnica?: string; }`

5. **parseMnemonicosJson exportado:** clone de parseClassificacoesJson com chave `'mnemonicos'`

6. **deveRodarEnrich:** `return !!(opts.classificar || opts.cardBuilder || opts.mnemonico || opts.imagem);`

7. **buildMnemonicoMessage helper:** espelha buildClassificadorMessage com JSON.stringify dos cards (T-04-09/T-03-02)

8. **ESTÁGIO 3 — mnemônico batch:**
   - 1 chamada `runClaudeCli` com `loadPrompt('mnemonic')`
   - `parseMnemonicosJson` → filtro `m.id && m.mnemonico` → `new Map` anti-posicional
   - Merge: `byId.get(q.id)` → `{ ...q, mnemonico: m.mnemonico }` (fail-soft em omissão)
   - `catch` → `onProgress` com erro, nunca re-throw

9. **ESTÁGIO 4 — imagem por-card:**
   - Loop sobre `resultado[]` (in-place update)
   - Gate: `if (!q.mnemonico) continue` (D-04)
   - `imageProvider.generate(q.mnemonico, q.resposta)` → `sanitizarSvg(svg)`
   - Se `limpo`: `resultado[i] = { ...q, mnemonicoSvg: limpo }` (D-05/T-04-06)
   - Se `null`: `onProgress` com erro `'SVG inválido após sanitização'`, card intacto (D-08)
   - `catch` por-card → `onProgress` com erro, continua (D-13)

**image-provider.ts:**
- Removida linha `// TODO(IMG-02 fase 4): sanitizar SVG...`
- Substituída por comentário explicando separação de responsabilidades

### Task 3: Testes comportamentais — incluídos na Task 1 TDD RED

Os testes comportamentais foram escritos como parte do ciclo TDD (RED em Task 1, GREEN confirmado após implementação em Task 2). A Task 3 do plano era redundante — os testes já estavam completos e verdes após as Tasks 1+2.

## Verification Results

```
cd ankinator-app/server && npm test -- enrich
→ 82 passed (2 test files)

npm test (full suite)
→ 89 passed (4 test files)

npm run build
→ tsc verde (sem erros)

grep -c "TODO(IMG-02" image-provider.ts
→ 0 (critério satisfeito)

grep -c "it(" enrich.test.ts
→ 42 (baseline 23, +19 novos — ≥ 8 exigido)
```

## Deviations from Plan

### Auto-resolved: Task 3 merged into TDD cycle

Task 3 estava explicitamente descrita como "testes comportamentais do enrich" mas o plano é TDD (`tdd="true"` nas Tasks 1 e 2). Os testes foram escritos como RED na Task 1 e a implementação verde os cobriu na Task 2 — a Task 3 não teve ação adicional necessária pois todos os comportamentos exigidos já estavam cobertos. Nenhuma linha de código faltou.

### None — plan executed as designed

Tasks 1+2 aditivas e sequenciais sobre `enrich.ts` funcionaram como esperado. Nenhum conflito de paralelismo, nenhuma regressão nos estágios 1/2 existentes.

## Security Notes

Todos os threats do STRIDE register deste plano mitigados:

| Threat | Mitigação | Status |
|--------|-----------|--------|
| T-04-06: gravar SVG não-sanitizado | `sanitizarSvg(svg)` antes de gravar `mnemonicoSvg`; retorno null → não grava (fail-closed) | Mitigado |
| T-04-07: merge posicional do batch | `new Map(parsed.filter(m => m.id && m.mnemonico).map(...))` — anti-posicional por id | Mitigado |
| T-04-08: erro de um card aborta job | `try/catch` por-card no estágio 4; `catch` global no estágio 3; lote continua | Mitigado |
| T-04-09: prompt injection via q.resposta | `buildMnemonicoMessage` usa `JSON.stringify` dos cards — nunca interpola cru (T-03-02) | Mitigado |

## Commits

| Hash | Task | Description |
|------|------|-------------|
| 45abda7 | Task 1 RED | test(04-02): add failing tests for parseMnemonicosJson, estágio 3 mnemônico, estágio 4 imagem, PIPE-03 |
| a26f1b1 | Task 2 GREEN | feat(04-02): parseMnemonicosJson + estágio 3 mnemônico batch + estágio 4 imagem por-card + tipos ampliados |

## Known Stubs

None — todos os estágios estão implementados e funcionais. `enrichAll` com `opts.mnemonico=true` e/ou `opts.imagem=true` invoca os especialistas reais via `runClaudeCli`. A única dependência externa é a disponibilidade do CLI `claude` no ambiente de execução (comportamento intencional — assinatura, não API).

## Threat Flags

None — nenhuma nova superfície de segurança além da prevista no `<threat_model>` do plano. O provider `createImageProvider()` já existia (Phase 01 andaime); este plano apenas o conecta ao pipeline.

## Self-Check: PASSED

All files verified:
- FOUND: enrich.ts (with parseMnemonicosJson, estágio 3, estágio 4, types ampliados)
- FOUND: image-provider.ts (without TODO(IMG-02))
- FOUND: enrich.test.ts (42 it() calls, +19 new)
- FOUND: 04-02-SUMMARY.md
- FOUND commit: 45abda7 (test RED — failing tests)
- FOUND commit: a26f1b1 (feat GREEN — implementation)
