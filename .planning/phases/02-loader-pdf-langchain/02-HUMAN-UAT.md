---
status: partial
phase: 02-loader-pdf-langchain
source: [02-VERIFICATION.md]
started: 2026-06-03T12:34:03Z
updated: 2026-06-03T12:34:03Z
---

## Current Test

[awaiting human testing — requires optional runtime: `langchain-opendataloader-pdf==2.0.0` + Java 11+]

## Tests

### 1. End-to-end smoke com PDF real
expected: Com `langchain-opendataloader-pdf==2.0.0` instalado (em `ANKINATOR_LANGCHAIN_PYTHON` ou `ODL_PYTHON`) + Java 11+, rodar `npx tsx ankinator-app/server/src/scripts/smoke-langchain-loader.ts <pdf>` produz um `LoadedDocument` populado, texto UTF-8 correto (acentos PT-BR íntegros), shape JSON válido, e log `[ankinator] loader: langchain`.
result: [pending]

### 2. Confirmação dos nomes de kwargs do sidecar (IN-03 / A1)
expected: Os parâmetros `table_method`, `reading_order`, `image_output` passados em `tools/odl_langchain_loader.py` são aceitos pela versão instalada do pacote sem `TypeError`.
result: [pending]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps
