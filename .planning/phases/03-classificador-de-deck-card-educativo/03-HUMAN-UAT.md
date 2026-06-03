---
status: partial
phase: 03-classificador-de-deck-card-educativo
source: [03-VERIFICATION.md]
started: 2026-06-03T13:30:00Z
updated: 2026-06-03T13:30:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. "Modo educativo" block renders with correct defaults
expected: On the structure screen, a "Modo educativo" block appears below the slider with "Classificar deck + tags" checked (default ON) and "Card educativo" unchecked (default OFF). (D-14/D-15)
result: [pending]

### 2. Enrich progress appears inside the "Gerar" step (no 5th stepper step)
expected: During generation, after chunk items, "Classificando deck + tags…" (and "Reescrevendo card N/M…" when Card educativo is on) appears inside the generating step. The Stepper still shows exactly 4 steps. (D-16)
result: [pending]

### 3. Deck/tags badges appear read-only in CardTable
expected: On the review screen, cards enriched with deck/tags show a violet deck badge and a slate tags badge, both read-only (no editable field). (D-17)
result: [pending]

### 4. PIPE-03 sanity — toggles OFF produces no enrich phase
expected: With both toggles disabled, generation runs without an enrich phase and produces the baseline CSV (byte-identical to pre-enrich output). (PIPE-03)
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
