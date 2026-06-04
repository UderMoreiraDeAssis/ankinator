---
status: partial
phase: 04-mnem-nicos-imagem-svg
source: [04-VERIFICATION.md]
started: 2026-06-04T03:32:03Z
updated: 2026-06-04T03:32:03Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. UI visual — toggles, badges e progresso (04-04 / D-13)
expected: Rodar `cd ankinator-app/web && npm run dev`. No bloco "Modo educativo" do StructurePanel, os dois toggles aparecem com os defaults corretos (Mnemônico **ON**, Imagem **OFF**). Na CardTable, cards enriquecidos mostram badges read-only 📝 (mnemônico) e 🖼️ (SVG) — **sem** renderizar o SVG. O ProgressPanel mostra rótulos para os novos estágios ("Gerando mnemônicos…", "Gerando imagem N/total…").
result: [pending]

### 2. Render do SVG no Anki (IMG-03 runtime / 04-03)
expected: Gerar um deck com mnemônico+imagem ON, exportar via CSV e/ou AnkiConnect, abrir no Anki 25.02.x e confirmar que o `<svg>` renderiza como imagem no verso do card. Cards sem SVG permanecem byte-idênticos ao comportamento anterior (PIPE-03/D-10).
result: [pending]

### 3. Qualidade da geração ao vivo (MNEM-01 / IMG-01)
expected: Rodar contra um PDF real de concurso (com a assinatura Claude ativa). Confirmar que cards de memorização recebem mnemônico com técnica apropriada ao conteúdo (acrônimo / história / palácio da memória) e que o SVG ilustra o mnemônico de forma autocontida.
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
