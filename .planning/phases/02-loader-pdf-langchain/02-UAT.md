---
status: complete
phase: 02-loader-pdf-langchain
source: [02-01-SUMMARY.md, 02-02-SUMMARY.md, 02-03-SUMMARY.md, 02-04-SUMMARY.md]
started: 2026-06-03T13:12:49Z
updated: 2026-06-03T13:54:10Z
---

## Current Test

[testing complete]

## Tests

### 1. Default loader não-regressão (Node)
expected: Sem `ANKINATOR_PDF_LOADER` setado, upload de PDF extrai via Node `@opendataloader/pdf` como antes — nenhum spawn Python, nenhum erro novo, resultado idêntico ao comportamento pré-fase.
result: pass
evidence: "`smoke-loader.ts sample_simples.pdf` (env unset) → 2 páginas, 2 seções, 15 elementos, acentos PT-BR íntegros (Introdução/Variáveis/é), exit 0, zero Python. PDF-03 confirmado em runtime."

### 2. Opt-in langchain ativa (sidecar Python)
expected: Com `langchain-opendataloader-pdf==2.0.0` + Java 11+ instalados num venv, `ANKINATOR_LANGCHAIN_PYTHON` apontando p/ esse Python, e `ANKINATOR_PDF_LOADER=langchain`, rodar smoke. PDF extraído pelo sidecar, `LoadedDocument` populado, log `[ankinator] loader: langchain`, acentos PT-BR íntegros (sem mojibake).
result: pass
evidence: "Instalado pkg ==2.0.0 em venv (Java 25). `smoke-langchain-loader.ts sample_simples.pdf` → log `[ankinator] loader: langchain`, 2 páginas/2 seções, acentos íntegros, exit 0. curso-8.pdf: contagem dura no JSON do sidecar = 0 U+FFFD, 53 acentos PT-BR → prova fix CR-01 (UTF-8 chunk-decoding) com PDF real. A1/A2/A3 confirmados; kwargs (table_method/reading_order/image_output) aceitos sem TypeError."

### 3. Indisponibilidade graciosa
expected: Com `ANKINATOR_PDF_LOADER=langchain` mas SEM o pacote/Python instalado, o smoke sai 0 com mensagem "langchain indisponível — smoke pulado", e o upload não derruba o servidor silenciosamente.
result: pass
evidence: "`smoke-langchain-loader.ts` (langchain forçado, sem pkg) → 'langchain indisponível — smoke pulado', exit 0. `loadDocument` com langchain forçado-indisponível → fallback→node com log `[ankinator] loader: langchain indisponível (fallback→node)`, extrai normal, exit 0. Zero crash."

## Summary

total: 3
passed: 3
issues: 0
pending: 0
skipped: 0

## Gaps

[none — all tests passed]
