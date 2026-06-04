---
status: failed
phase: 04-mnem-nicos-imagem-svg
source: [04-VERIFICATION.md]
started: 2026-06-04T03:32:03Z
updated: 2026-06-04T03:32:03Z
---

## Current Test

[human testing complete — issues found]

## Tests

### 1. UI visual — toggles, badges e progresso (04-04 / D-13)
expected: Toggles (Mnemônico ON / Imagem OFF), badges read-only 📝/🖼️, rótulos de progresso dos novos estágios.
result: issues — nenhum mnemônico nem imagem chegou aos cards no runtime, então badges não apareceram; aparência geral dos cards é crua (sem HTML/CSS rico).

### 2. Render do SVG no Anki (IMG-03 runtime / 04-03)
expected: `<svg>` renderiza no verso no Anki 25.02.x; cards sem SVG byte-idênticos.
result: failed — **zero imagens foram geradas** no runtime; impossível confirmar render (não há SVG nos cards).

### 3. Qualidade da geração ao vivo (MNEM-01 / IMG-01)
expected: Mnemônico com técnica apropriada + SVG autocontido ilustrando-o.
result: failed — **zero mnemônicos** e **zero imagens**. Além disso, as questões saíram "inúteis" (texto colado cru, sem transformação) e **sem aparência elegante** (HTML/CSS pobre). Print: card é a questão FGV/TCE-SP literal, fonte gigante, sem estilo.

## Summary

total: 3
passed: 0
issues: 1
pending: 0
skipped: 0
blocked: 2

## Gaps

- **GAP-RT-01 (mnemônicos não geram):** Mnemônico default ON, mas nenhum mnemônico apareceu no runtime. Investigar gating do estágio 3 (seleção de cards), falha silenciosa do Claude CLI (fail-soft engolindo erro), e se o /generate real invoca enrichAll com os toggles certos.
- **GAP-RT-02 (imagens não geram):** Imagem default OFF; usuário quer que funcione. Precisa default/UX e validar o estágio 4 ao vivo.
- **GAP-RT-03 (card sem aparência educativa):** Cards saem crus (questão colada), sem HTML/CSS rico. Responsabilidade da Phase 3 (card educativo) — não está entregando no runtime.
- **GAP-RT-04 (questões inúteis):** Geração não transforma o texto em boas questões — apenas reproduz o enunciado. Revisar o especialista de geração/classificação.
- **GAP-RT-05 (loader não usado):** `langchain-opendataloader-pdf` (Phase 2) não está sendo usado de fato. Usuário quer o uso ativo.
- **DIR-01 (nova direção):** Usuário quer agentes/skills especialistas (Claude sub-agents / skills): orquestrador Anki, classificador de deck, montador de card educativo, mnemônicos, imagens de mnemônico. Escopo de novo milestone, não gap-closure de Phase 4.
