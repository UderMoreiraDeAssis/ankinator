---
phase: 04-mnem-nicos-imagem-svg
plan: "03"
subsystem: server/exporters+api+scripts
tags: [export, csv, ankiconnect, mnemonic, svg, embed, api, pipe-03, tdd, img-03]
dependency_graph:
  requires:
    - 04-02 (q.mnemonico / q.mnemonicoSvg fields written by enrichAll)
  provides:
    - csv.ts versoDaQuestao: mnemônico-texto + SVG inline (gate byte-identity PIPE-03)
    - ankiconnect.ts versoHtml: exported + mnemônico-texto (escapado) + SVG inline (não-escapado)
    - api.ts /generate: D-12 defaults (mnemonico=true, imagem=false) in enrichOpts
    - guard-enrich.ts: 5 scenarios covering all 4 toggles + PIPE-03 byte-identity
    - smoke-enrich.ts: CLI-free steps 1-3 (prompts + parsers + sanitizarSvg) + gated step 4
    - GenerateOptions.mnemonico/imagem added to types.ts
  affects:
    - Phase 04 Plan 04 (UI already done in parallel wave)
tech_stack:
  added: []
  patterns:
    - gate-by-optional-field (D-09/D-10): if (q.mnemonico) / if (q.mnemonicoSvg) → byte-identity
    - SVG embed cru (Pitfall 2): mnemonicoSvg concatenado sem escapeHtml em ambos exporters
    - text escape (D-11): escapeHtml() aplicado ao mnemônico-texto mas NUNCA ao SVG
    - TDD RED→GREEN cycle (2 commits: test RED + feat GREEN)
    - additive export: versoHtml prefixada com export sem alterar assinatura/corpo
key_files:
  created:
    - ankinator-app/server/src/core/exporters/exporters-embed.test.ts
  modified:
    - ankinator-app/server/src/core/exporters/csv.ts
    - ankinator-app/server/src/core/exporters/ankiconnect.ts
    - ankinator-app/server/src/api.ts
    - ankinator-app/server/src/scripts/guard-enrich.ts
    - ankinator-app/server/src/scripts/smoke-enrich.ts
    - ankinator-app/server/src/core/types.ts
decisions:
  - "versoHtml tornada export de forma aditiva (prefixar 'export' sem mudar assinatura)"
  - "SVG concatenado sem escapeHtml em CSV e AnkiConnect — já sanitizado no Plan 02 (D-08/Pitfall 2)"
  - "mnemônico-texto escapado via escapeHtml em versoHtml — < e & perigosos em HTML"
  - "D-12 defaults: mnemonico=true (ON), imagem=false (OFF) em enrichOpts do /generate"
  - "sanitizarSvg não retorna null para SVG com <script>: DOMPurify remove o script via allowlist e retorna SVG limpo — test fixture ajustado para verificar ausência do <script> no output"
metrics:
  duration: "~8 min"
  completed: "2026-06-04"
  tasks_completed: 3
  tasks_total: 3
  files_changed: 6
---

# Phase 04 Plan 03: Export wiring (CSV + AnkiConnect embed mnemônico+SVG) — Summary

**One-liner:** CSV e AnkiConnect exporters embutem mnemônico-texto + SVG inline com gate byte-identity (PIPE-03); versoHtml exportada e coberta por teste positivo IMG-03 (SVG cru, texto escapado); defaults D-12 propagados em /generate; guard/smoke estendidos para 4 toggles.

## What Was Built

### Task 1 RED: Testes de embed (commit a6d8288)

`exporters-embed.test.ts` criado com 9 testes cobrindo:

- **CSV (versoDaQuestao):** byte-identity quando mnemonico/mnemonicoSvg ausentes (D-10/PIPE-03); texto mnemônico presente quando existe; `<svg` literal (não escapado) quando mnemonicoSvg presente (Pitfall 2)
- **versoHtml (IMG-03 positivo):** byte-identity quando sem campos; texto mnemônico presente; `<svg` literal NÃO `&lt;svg` quando mnemonicoSvg presente; texto com `<` → `a &lt; b` (escapeHtml aplicado)

Estado RED: 8/9 falhas (versoHtml não exportada + embed não implementado).

### Task 1 GREEN: Implementação dos exporters (commit 9a10aff)

**csv.ts** — extensão aditiva de `versoDaQuestao` (antes do `return verso`):
```typescript
if (q.mnemonico) {
  verso += `\n\n💡 Mnemônico: ${q.mnemonico}`;
}
if (q.mnemonicoSvg) {
  verso += `\n\n${q.mnemonicoSvg}`;  // SVG cru — NUNCA escapeHtml (D-08/Pitfall 2)
}
```

**ankiconnect.ts** — mudanças aditivas em `versoHtml`:
1. Prefixo `export` adicionado à função (sem alterar assinatura/corpo)
2. Embed ao fim (antes do `return back`):
```typescript
if (q.mnemonico) {
  back += `<br><br><b>💡 Mnemônico:</b> ${escapeHtml(q.mnemonico)}`;  // texto escapado
}
if (q.mnemonicoSvg) {
  back += `<br><br>${q.mnemonicoSvg}`;  // SVG inline NÃO escapado (D-08/Pitfall 2/T-04-11)
}
```

`grep -c "escapeHtml(q.mnemonicoSvg"` retorna **0** (T-04-11 satisfeito).

9/9 testes verdes.

### Task 3: GenerateOptions ampliada (commit 75b97e7)

`types.ts GenerateOptions` + 2 campos:
- `mnemonico?: boolean` — "Rodar especialista de mnemônico (batch). Default: true."
- `imagem?: boolean` — "Rodar especialista de imagem SVG (por-card). Default: false."

`Questao` intacta (D-11). Build tsc verde.

### Task 2: Wiring api.ts + guard/smoke estendidos (commit 86e34d1)

**api.ts** — genOptions + enrichOpts com D-12 defaults:
```typescript
const genOptions: GenerateOptions = {
  ...
  mnemonico: options?.mnemonico,
  imagem: options?.imagem,
};
const enrichOpts = {
  classificar: options?.classificar ?? true,
  cardBuilder: options?.cardBuilder ?? false,
  mnemonico: options?.mnemonico ?? true,   // D-12: default ON
  imagem: options?.imagem ?? false,        // D-12: default OFF
};
```

**guard-enrich.ts** — +3 cenários:
- Cenário 3: `{mnemonico:true, imagem:false}` → deveRodarEnrich=true
- Cenário 4: `{mnemonico:false, imagem:true}` → deveRodarEnrich=true
- Cenário 5: 4 toggles off → deveRodarEnrich=false (byte-identity PIPE-03)

**smoke-enrich.ts** — CLI-free steps estendidos:
- Passo 1: + `loadPrompt('mnemonic')` + `loadPrompt('mnemonic-image')`
- Passo 2: + `parseMnemonicosJson` com fixture limpo + fenced
- Passo 3 (novo): `sanitizarSvg` com SVG geométrico válido (→ não-null) + entrada não-SVG (→ null)
- Passo 4 (gated): `enrichAll` com `mnemonico:true, imagem:true`

## Verification Results

```
npm test -- exporters-embed
→ 9 passed (1 test file)

npm test (full suite)
→ 126 passed (6 test files)

npx tsx src/scripts/guard-enrich.ts --assert
→ exit 0 (5 cenários: toggles-off, classificar-on, mnemonico-on, imagem-on, all-off)

npx tsx src/scripts/smoke-enrich.ts --assert-args
→ exit 0 (passos 1-3 CLI-free: prompts, parsers, sanitizarSvg)

npm run build
→ tsc verde (sem erros)

grep -c "escapeHtml(q.mnemonicoSvg" ankiconnect.ts
→ 0 (T-04-11 satisfeito)

grep -c "export function versoHtml" ankiconnect.ts
→ 1 (função exportada)

grep -c "mnemonico: options?.mnemonico ?? true" api.ts
→ 1 (D-12 default ON)

grep -c "imagem: options?.imagem ?? false" api.ts
→ 1 (D-12 default OFF)
```

## Human Verification Needed (end-of-phase)

**IMG-03 — Render do SVG inline no Anki desktop**

Este checkpoint foi DEFERIDO ao fim da fase (GSD #3309 / human_verify_mode=end-of-phase). Não é um bloqueador técnico — o pipeline está implementado e testado. A verificação confirma o comportamento no runtime do Anki.

**Passos para verificar:**

1. Com Anki desktop aberto (25.02.x ou superior) e o add-on AnkiConnect instalado (código 2055492159), rodar o smoke gated completo:
   ```
   cd ankinator-app/server && npx tsx src/scripts/smoke-enrich.ts
   ```
   (Requer `claude` instalado com assinatura ativa. Sem a flag `--assert-args`, o Passo 4 gated roda `enrichAll` com `mnemonico:true, imagem:true` para 1 card de fixture.)

2. Exportar o card gerado para o Anki via uma das opções:
   - **AnkiConnect:** usar a rota `POST /export/ankiconnect` da API com o card gerado
   - **CSV:** exportar via `POST /export/csv` e importar o .csv no Anki desktop

3. Abrir o card no Anki desktop e confirmar no lado verso:
   - O texto do mnemônico aparece (ex.: "💡 Mnemônico: LAMP = Lei, Art, Multa, Prazo")
   - A imagem SVG **renderiza como gráfico** (não como texto `<svg ...>` nem em branco)

4. Opcional: testar também no AnkiDroid/AnkiMobile para confirmar cross-platform.

**Se o SVG não renderizar (texto cru ou branco):**
- Reportar como gatilho de revisão da decisão D-09 (fallback data-URI ou media file)
- NÃO implementar fallback nesta fase — abrir item de replanejamento para a Phase 5
- Research flag 2: Anki 25.02.x introduziu DOMPurify interno que pode remover atributos SVG

**Cards sem SVG (campo `mnemonicoSvg` ausente) devem ser byte-idênticos ao comportamento pré-Phase-04** — provado pelos testes de byte-identity em `exporters-embed.test.ts`.

## Deviations from Plan

### Auto-resolved: smoke-enrich fixture para sanitizarSvg ajustada (Rule 1)

O plano especificava testar `sanitizarSvg` com `<svg><script>` esperando retorno `null`. Na prática, `isomorphic-dompurify` (allowlist estrita) remove o `<script>` via SVG_TAGS allowlist e retorna o SVG restante (não null). Comportamento correto e esperado — o plano havia assumido fail-closed total para qualquer SVG contendo script. A fixture foi ajustada para verificar a ausência do `<script>` no output (comportamento real) em vez de null. Adicionada fixture separada com entrada não-SVG pura (`<div>`) que retorna null corretamente.

### None — plan executed as designed

Task 3 (types.ts) foi executada antes de Task 2 (api.ts) para garantir type-safety. Ordem diferente da numeração mas sem impacto funcional — Tasks 2+3 são interdependentes; types.ts precisa existir antes do api.ts compilar.

## Security Notes

Todos os threats do STRIDE register deste plano mitigados:

| Threat | Mitigação | Status |
|--------|-----------|--------|
| T-04-10: embed SVG não-sanitizado | SVG vem de q.mnemonicoSvg escrito apenas por sanitizarSvg (fail-closed, Plan 02); confiança na sanitização upstream | Mitigado |
| T-04-11: escapeHtml acidental no SVG | Teste positivo afirma `<svg` literal; grep retorna 0 ocorrências de `escapeHtml(q.mnemonicoSvg` | Mitigado |
| T-04-12: byte-identity PIPE-03 | Gates `if (q.mnemonicoSvg)` / `if (q.mnemonico)` garantem output idêntico quando ausentes; teste de byte-identity no suite | Mitigado |

## Commits

| Hash | Task | Description |
|------|------|-------------|
| a6d8288 | Task 1 RED | test(04-03): add failing tests for exporters embed (RED) |
| 9a10aff | Task 1 GREEN | feat(04-03): embed mnemônico+SVG nos exporters CSV e AnkiConnect (GREEN) |
| 75b97e7 | Task 3 | feat(04-03): add mnemonico/imagem fields to GenerateOptions (D-12) |
| 86e34d1 | Task 2 | feat(04-03): wire D-12 defaults in /generate + extend guard/smoke for Phase 4 |

## Known Stubs

None — todos os campos são lidos diretamente de `q.mnemonico` e `q.mnemonicoSvg` escritos pelo enrichAll real. Não há dados mock ou placeholder nas saídas de export.

## Threat Flags

None — nenhuma nova superfície de segurança além da prevista no `<threat_model>` do plano. O embed SVG inline é o vetor esperado; T-04-10/T-04-11 cobrem os riscos relevantes.

## Self-Check: PASSED

- FOUND: ankinator-app/server/src/core/exporters/csv.ts (contains q.mnemonicoSvg)
- FOUND: ankinator-app/server/src/core/exporters/ankiconnect.ts (export function versoHtml)
- FOUND: ankinator-app/server/src/core/exporters/exporters-embed.test.ts (9 tests)
- FOUND: ankinator-app/server/src/api.ts (mnemonico ?? true, imagem ?? false)
- FOUND: ankinator-app/server/src/scripts/guard-enrich.ts (5 cenários)
- FOUND: ankinator-app/server/src/scripts/smoke-enrich.ts (passos 1-3 CLI-free)
- FOUND: ankinator-app/server/src/core/types.ts (GenerateOptions.mnemonico/imagem)
- FOUND commit: a6d8288 (test RED)
- FOUND commit: 9a10aff (feat GREEN exporters)
- FOUND commit: 75b97e7 (feat types)
- FOUND commit: 86e34d1 (feat api+guard+smoke)
