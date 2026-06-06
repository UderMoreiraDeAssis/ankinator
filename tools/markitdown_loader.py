#!/usr/bin/env python3
"""
Sidecar Python para extração de PDF em Markdown via markitdown (microsoft/markitdown).

Uso: python markitdown_loader.py <pdf> [--pages STR] [--password STR]

Saída (stdout): JSON [{"page_content": str, "metadata": {"source": str, "format": str, "page": int}}]
  - Uma ÚNICA entrada (markitdown produz blob único — sem split por página).
  - page=1 (limitação documentada: markitdown não expõe numPages nem marcadores de página).
  - Node faz JSON.parse; shape compatível com normalize() de langchain-normalize.ts.

Limitações documentadas:
  - BLOB ÚNICO: o backend pdfminer.six+pdfplumber do markitdown concatena tudo em
    result.markdown sem marcadores de página. numPages vira 1 em LoadedDocument.
    Granularidade real de página NÃO está disponível neste loader.
  - SEM OCR NATIVO: PDFs escaneados / sem camada de texto retornam markdown vazio.
    Para escaneados, use o caminho OCR existente (runOcrLoader/isOcrAvailable).
  - SEM JAVA: ao contrário do langchain-opendataloader-pdf, markitdown não exige Java.
  - --pages e --password: aceitos para paridade de assinatura com LoadOptions (D-11),
    mas são no-op neste loader (a API convert(path) não os expõe).

Pré-requisitos:
  - markitdown[pdf]==0.1.6 instalado no venv apontado por ANKINATOR_MARKITDOWN_PYTHON
    (Python >=3.10; SEM Java)
  - Setup: python3 -m venv ~/.venvs/markitdown &&
           ~/.venvs/markitdown/bin/pip install -r tools/requirements-markitdown.txt

NÃO usa API key — processamento local, sem Java.
"""

import argparse
import json
import sys

from markitdown import MarkItDown


def main() -> int:
    """
    Ponto de entrada principal.

    Parseia argumentos CLI (espelhando LoadOptions de document-loader.ts — D-11),
    converte o PDF via markitdown e imprime o array JSON de 1 Document no stdout.

    --pages e --password são aceitos para paridade de assinatura mas são no-op
    neste loader (markitdown.convert(path) não os expõe — limitação documentada).

    Retorna 0 em sucesso; o processo sai com código != 0 em caso de exceção
    não tratada (o Node propaga o erro — D-04).
    """
    ap = argparse.ArgumentParser(
        description="Extrai PDF em Markdown (blob único) via markitdown e imprime JSON no stdout."
    )
    # D-11: espelha os campos de LoadOptions (document-loader.ts) — paridade de assinatura
    ap.add_argument("pdf", help="Caminho para o arquivo PDF a ser processado.")
    ap.add_argument(
        "--pages",
        default=None,
        help="(no-op neste loader) Subconjunto de páginas. Aceito por paridade com LoadOptions.",
    )
    ap.add_argument(
        "--password",
        default=None,
        help="(no-op neste loader) Senha para PDFs protegidos. Aceito por paridade com LoadOptions.",
    )
    args = ap.parse_args()

    # WR-03 (espelhado): captura exceção e emite UMA linha de diagnóstico limpa no stderr,
    # retornando 1 (Node propaga — D-04). Sem traceback multi-linha: a causa real fica no TOPO.
    try:
        result = MarkItDown().convert(args.pdf)
        # Usar o atributo canônico .markdown (.text_content é alias soft-deprecated)
        markdown_text = result.markdown
    except Exception as e:  # noqa: BLE001 — boundary: converte para linha de stderr limpa
        print(f"markitdown_loader: {type(e).__name__}: {e}", file=sys.stderr)
        return 1

    # D-01: emitir array JSON com 1 entrada no stdout (blob único, page=1).
    # Projeção mínima dos metadados (shape compatível com normalize() de langchain-normalize.ts).
    # ensure_ascii=False mantém UTF-8 legível (PT-BR) e reduz tamanho do output.
    # WR-02 (espelhado): apenas os 3 campos do contrato {source, format, page} — sem extras.
    out = [
        {
            "page_content": markdown_text,
            "metadata": {
                "source": args.pdf,
                "format": "markdown",
                "page": 1,  # blob único — limitação documentada
            },
        }
    ]
    json.dump(out, sys.stdout, ensure_ascii=False)

    return 0


if __name__ == "__main__":
    sys.exit(main())
