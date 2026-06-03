---
phase: 02-loader-pdf-langchain
plan: "02"
subsystem: python-sidecar
tags: [python, langchain, pdf-loader, sidecar, stdout-json]
dependency_graph:
  requires: []
  provides: [PDF-01, D-01, D-11, D-12, D-13]
  affects: [tools/odl_langchain_loader.py, tools/requirements.txt]
tech_stack:
  added:
    - langchain-opendataloader-pdf==2.0.0 (Python; via venv opcional)
  patterns:
    - argparse CLI espelhando LoadOptions do Node
    - json.dump para stdout (sem temp dir) — contrato D-01
    - sidecar Python opt-in (reusa padrão ODL_PYTHON da Phase 1)
key_files:
  created:
    - tools/odl_langchain_loader.py
    - tools/requirements.txt
  modified: []
decisions:
  - "D-01 enforced: saída JSON exclusivamente via stdout (sem temp dir); Node consome com JSON.parse"
  - "D-11 enforced: argparse com <pdf>, --pages, --password espelhando LoadOptions"
  - "D-12 enforced: format=markdown + split_pages=True — 1 Document/página"
  - "D-13 enforced: pin exato ==2.0.0 sem deps transitivas declaradas"
  - "Nota A1 registrada: confirmar nomes de parâmetro table_method/reading_order/image_output no smoke do Plano 04"
metrics:
  duration: "~2 min"
  completed: "2026-06-03"
  tasks_completed: 2
  files_created: 2
---

# Phase 02 Plan 02: Sidecar Python PDF→JSON stdout Summary

Sidecar Python `tools/odl_langchain_loader.py` criado para extrair PDF em Documents por página (markdown) via `langchain-opendataloader-pdf==2.0.0`, emitindo array JSON `[{page_content, metadata}]` no stdout sem temp dir, com CLI espelhando `LoadOptions` do Node (PDF-01).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Criar tools/requirements.txt (pin D-13) | aab3bd7 | tools/requirements.txt |
| 2 | Criar tools/odl_langchain_loader.py (sidecar PDF-01) | 82dd583 | tools/odl_langchain_loader.py |

## What Was Built

### tools/requirements.txt
Pin exato `langchain-opendataloader-pdf==2.0.0` (D-13) com comentários PT-BR documentando:
- Que é sidecar OPCIONAL (não dependência do Node)
- Python >=3.10,<4.0 obrigatório
- Java 11+ no PATH obrigatório (Pitfall 2: falha em runtime, não no import)
- Instalação via venv dedicado + variável `ANKINATOR_LANGCHAIN_PYTHON` (fallback `ODL_PYTHON`)
- Sem deps transitivas declaradas (vêm automaticamente via pip)

### tools/odl_langchain_loader.py
Sidecar Python satisfazendo PDF-01 com:
- **CLI (D-11):** `argparse` com posicional `pdf`, `--pages` e `--password` espelhando `LoadOptions` de `document-loader.ts:20-27`
- **Modo markdown por página (D-12):** `OpenDataLoaderPDFLoader(format="markdown", split_pages=True, quiet=True, image_output="off", table_method="cluster", reading_order="xycut")` — paridade com `ConvertOptions` do loader Node (`document-loader.ts:49-58`)
- **Saída stdout JSON (D-01):** `json.dump([{page_content, metadata}], sys.stdout, ensure_ascii=False)` — sem temp dir, sem arquivo; Node faz `JSON.parse`
- **Guard de exit (D-04):** `if __name__ == "__main__": sys.exit(main())` — exit code != 0 em exceção não tratada propagado pelo Node

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None — o sidecar não tem stubs. O contrato stdout está completo e pronto para consumo pelo `langchain-loader.ts` do Plano 03.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| T-02-03 mitigated | tools/odl_langchain_loader.py | argv --pages/--password repassados ao construtor: argparse valida shape; spawn argv-array (sem shell) será implementado no Plano 03 |

## Pending / Deferred

- **Nota A1 (inline no sidecar):** confirmar nomes de parâmetro `table_method`/`reading_order`/`image_output` no smoke do Plano 04 antes de considerar fixos. Os defaults do pacote já produzem markdown utilizável caso algum nome divirja.
- **Plano 04 (smoke opt-in):** exercitar o caminho real com Java 11+ e um PDF real — não executado neste plano (pacote não instalado no ambiente de execução).

## Self-Check: PASSED

- tools/requirements.txt exists and has pin `langchain-opendataloader-pdf==2.0.0`
- tools/odl_langchain_loader.py exists with valid Python syntax
- Commits aab3bd7 (requirements.txt) and 82dd583 (sidecar) verified in git log
