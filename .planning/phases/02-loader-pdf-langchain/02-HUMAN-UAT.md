---
status: complete
phase: 02-loader-pdf-langchain
source: [02-VERIFICATION.md]
started: 2026-06-03T12:34:03Z
updated: 2026-06-03T13:54:10Z
---

## Current Test

[testing complete — runtime instalado e exercitado durante /gsd:verify-work 2]

## Tests

### 1. End-to-end smoke com PDF real
expected: Com `langchain-opendataloader-pdf==2.0.0` instalado + Java 11+, rodar `smoke-langchain-loader.ts <pdf>` produz um `LoadedDocument` populado, texto UTF-8 correto (acentos PT-BR íntegros), shape JSON válido, e log `[ankinator] loader: langchain`.
result: pass
evidence: "venv com pkg ==2.0.0 + Java 25. sample_simples.pdf e curso-8.pdf via sidecar: log `[ankinator] loader: langchain`, LoadedDocument populado, 0 U+FFFD / 53 acentos PT-BR em curso-8.pdf, exit 0."

### 2. Confirmação dos nomes de kwargs do sidecar (IN-03 / A1)
expected: Os parâmetros `table_method`, `reading_order`, `image_output` passados em `tools/odl_langchain_loader.py` são aceitos pela versão instalada do pacote sem `TypeError`.
result: pass
evidence: "Sidecar rodou limpo (exit 0, JSON válido) com o pkg ==2.0.0 real — kwargs aceitos, nenhum TypeError."

## Summary

total: 2
passed: 2
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps
