---
phase: 04-mnem-nicos-imagem-svg
plan: "04"
subsystem: web-ui
tags: [ui, toggles, badges, progress, types, D-12, D-13]
dependency_graph:
  requires: [04-02, 04-03]
  provides: [UI-mnemônico-toggles, UI-badges-read-only, UI-progress-labels]
  affects: [ankinator-app/web/src/types.ts, ankinator-app/web/src/App.tsx, ankinator-app/web/src/components/StructurePanel.tsx, ankinator-app/web/src/components/CardTable.tsx, ankinator-app/web/src/components/ProgressPanel.tsx]
tech_stack:
  added: []
  patterns: [conditional-badge, ternary-chain-progress, toggle-default-split]
key_files:
  created: []
  modified:
    - ankinator-app/web/src/types.ts
    - ankinator-app/web/src/App.tsx
    - ankinator-app/web/src/components/StructurePanel.tsx
    - ankinator-app/web/src/components/CardTable.tsx
    - ankinator-app/web/src/components/ProgressPanel.tsx
decisions:
  - D-12 applied: mnemonico default ON (batch barato), imagem default OFF (por-card caro — guarda de quota)
  - D-13 enforced: CardTable usa apenas badges read-only; zero dangerouslySetInnerHTML; SVG nunca renderizado no browser
  - D-11 respected: Questao inalterado (campos mnemonico/mnemonicoSvg já existiam desde Phase 01)
metrics:
  duration: ~8 min
  completed: "2026-06-04"
  tasks_completed: 2
  files_modified: 5
---

# Phase 04 Plan 04: UI Modo Educativo Mnemônico/Imagem Summary

**One-liner:** Toggles Mnemônico (ON) / Imagem (OFF) no StructurePanel, badges read-only 📝/🖼️ na CardTable sem render de SVG (D-13), rótulos `gerando-mnemonico`/`gerando-imagem` no ProgressPanel, e espelhos de tipo `GenerateOptions`/`EnrichProgress` consistentes com o server.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Espelhar tipos + defaults App.tsx | 95ad04e | types.ts, App.tsx |
| 2 | Toggles StructurePanel + badges CardTable + rótulos ProgressPanel | 6db3e35 | StructurePanel.tsx, CardTable.tsx, ProgressPanel.tsx |

## What Was Built

### Task 1 — Tipos web espelham o server; defaults D-12 no App.tsx
- `GenerateOptions` += `mnemonico?: boolean` e `imagem?: boolean` (com comentários D-12)
- `EnrichProgress.estagio` ampliado: `'classificando' | 'reescrevendo' | 'gerando-mnemonico' | 'gerando-imagem'` (espelho EXATO do server)
- `Questao` inalterado (D-11 — campos já existiam desde Phase 01 SPEC-05)
- `App.tsx` useState: `mnemonico: true` (default ON, D-12) e `imagem: false` (default OFF, D-12)
- `tsc --noEmit` sai 0

### Task 2 — UI do modo educativo
- **StructurePanel.tsx**: 2 labels adicionados ao bloco "Modo educativo" após "Card educativo":
  - "Mnemônico" com `checked={options.mnemonico !== false}` (default ON)
  - "Imagem de mnemônico" com `checked={options.imagem === true}` (default OFF)
- **CardTable.tsx**: 2 badges read-only adicionados após os badges deck/tags:
  - `{c.mnemonico && <span ... title={c.mnemonico.slice(0,60)}>📝 mnemônico</span>}`
  - `{c.mnemonicoSvg && <span ...>🖼️ SVG</span>}`
  - ZERO ocorrências de `dangerouslySetInnerHTML` (D-13 enforcement)
- **ProgressPanel.tsx**: ternário de `enrichProgress.estagio` ampliado:
  - `'gerando-mnemonico'` → 'Gerando mnemônicos…'
  - fallback (`'gerando-imagem'`) → `Gerando imagem N/total…`
- `npm run build` sai 0 (vite/tsc verde, 36 modules transformed)

## Verification Results

| Check | Result |
|-------|--------|
| `tsc --noEmit` (Task 1) | PASSED — TypeScript: No errors found |
| `npm run build` (Task 2) | PASSED — ✓ built in 1.03s |
| `grep dangerouslySetInnerHTML CardTable.tsx` | 0 matches (D-13 compliant) |
| `grep 'gerando-mnemonico' types.ts` | 1 match |
| `grep 'mnemonico: true' App.tsx` | 1 match |
| `grep 'options.mnemonico !== false' StructurePanel.tsx` | 1 match |
| `grep 'c.mnemonicoSvg &&' CardTable.tsx` | 1 match |
| `grep 'gerando-mnemonico' ProgressPanel.tsx` | 1 match |

## Deviations from Plan

None - plan executed exactly as written.

## Human Verification Needed (end-of-phase)

The final task (Task 3) was a `checkpoint:human-verify` gate, deferred to end-of-phase per GSD `human_verify_mode=end-of-phase`. Below are the exact steps a human should run to complete visual verification.

### How to Verify

1. Start the app:
   ```bash
   cd /home/t316360/plottwist/ankinator
   # Terminal 1 (server):
   cd ankinator-app && npm run dev
   # Terminal 2 (web):
   cd ankinator-app/web && npm run dev
   ```

2. Navigate to the Structure screen (upload a PDF or use any test document).

3. **Verify toggles in "Modo educativo" block:**
   - Toggle "Mnemônico" should be **LIGADO (checked)** by default
   - Toggle "Imagem de mnemônico" should be **DESLIGADO (unchecked)** by default
   - Both toggles must be visible and interactive

4. **Verify badges in CardTable (after generating cards):**
   - Cards with `mnemonico` field populated show badge `📝 mnemônico` (amber background, with tooltip showing first 60 chars)
   - Cards with `mnemonicoSvg` field populated show badge `🖼️ SVG` (sky background)
   - SVG content is **NOT rendered as an image** in the table (only the badge text is shown)

5. **Verify progress labels during generation (when mnemônico/imagem stages run):**
   - Stage `gerando-mnemonico` shows text: "Gerando mnemônicos…"
   - Stage `gerando-imagem` shows text: "Gerando imagem N/total…"

### Expected Results

| Check | Expected |
|-------|----------|
| Toggle "Mnemônico" default | LIGADO (checked = true) |
| Toggle "Imagem de mnemônico" default | DESLIGADO (checked = false) |
| Badge 📝 mnemônico | Visible on cards with mnemonico field |
| Badge 🖼️ SVG | Visible on cards with mnemonicoSvg field |
| SVG in table | NOT rendered (only badge text) |
| Progress "Gerando mnemônicos…" | Appears during gerando-mnemonico stage |
| Progress "Gerando imagem N/total…" | Appears during gerando-imagem stage |

### Signal to proceed
When all items above are confirmed: no further action needed. If any item is incorrect, open an issue referencing 04-04 and the specific failed check.

## Threat Surface Scan

| Flag | File | Description |
|------|------|-------------|
| No new threats introduced | — | All new UI is read-only badges and form checkboxes; no new network endpoints or auth paths |

## Self-Check: PASSED

- `ankinator-app/web/src/types.ts` exists and contains `gerando-mnemonico` ✓
- `ankinator-app/web/src/App.tsx` exists and contains `mnemonico: true` ✓
- `ankinator-app/web/src/components/StructurePanel.tsx` exists and contains `options.mnemonico !== false` ✓
- `ankinator-app/web/src/components/CardTable.tsx` exists and contains `c.mnemonicoSvg &&`, zero `dangerouslySetInnerHTML` ✓
- `ankinator-app/web/src/components/ProgressPanel.tsx` exists and contains `gerando-mnemonico` ✓
- Commit `95ad04e` (Task 1) exists ✓
- Commit `6db3e35` (Task 2) exists ✓
- Build green: `npm run build` exits 0 ✓
