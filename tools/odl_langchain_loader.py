#!/usr/bin/env python3
"""
Sidecar Python para extração de PDF em Documents por página (markdown).

Uso: python odl_langchain_loader.py <pdf> [--pages STR] [--password STR]

Saída (stdout): JSON [{"page_content": str, "metadata": {"source": str, "format": str, "page": int}}]
  - D-01: array JSON diretamente no stdout; sem temp dir; Node faz JSON.parse.
  - Uma entrada por página (split_pages=True).
  - Páginas numeradas 1-indexed (comportamento do pacote — não 0-indexed).

Pré-requisitos:
  - langchain-opendataloader-pdf==2.0.0 instalado no venv apontado por ANKINATOR_LANGCHAIN_PYTHON
  - Java 11+ no PATH (motor OpenDataLoader — falha em RUNTIME se ausente, não no import)

NÃO usa API key — apenas processamento local via motor Java.
"""

import argparse
import json
import sys

from langchain_opendataloader_pdf import OpenDataLoaderPDFLoader


def main() -> int:
    """
    Ponto de entrada principal.

    Parseia argumentos CLI (espelhando LoadOptions de document-loader.ts — D-11),
    instancia o loader com configuração de paridade com o loader Node (D-12),
    e imprime o array JSON de Documents no stdout (D-01).

    Retorna 0 em sucesso; o processo sai com código != 0 em caso de exceção
    não tratada (o Node propaga o erro — D-04).
    """
    ap = argparse.ArgumentParser(
        description="Extrai PDF em Documents/página (markdown) e imprime JSON no stdout."
    )
    # D-11: espelha os campos de LoadOptions (document-loader.ts:20-27)
    ap.add_argument("pdf", help="Caminho para o arquivo PDF a ser processado.")
    ap.add_argument(
        "--pages",
        default=None,
        help='Subconjunto de páginas, ex.: "1,3,5-7". Padrão: todas.',
    )
    ap.add_argument(
        "--password",
        default=None,
        help="Senha para PDFs protegidos.",
    )
    args = ap.parse_args()

    # D-12: modo markdown por página — preserva headings/tabelas → essencial para D-07.
    # Paridade com ConvertOptions do loader Node (document-loader.ts:49-58):
    #   format="markdown"     ← format: ['json', 'markdown']
    #   table_method="cluster" ← tableMethod: 'cluster'
    #   reading_order="xycut"  ← readingOrder: 'xycut'
    #   image_output="off"     ← imageOutput: 'off'  (Pitfall 5: sem refs binárias no stdout)
    #   quiet=True             ← quiet: true
    #
    # NOTA (A1): os nomes de parâmetro table_method/reading_order/image_output devem ser
    # confirmados no smoke do Plano 04 antes de considerar fixos; os defaults do pacote já
    # produzem markdown utilizável caso algum nome divirja.
    loader = OpenDataLoaderPDFLoader(
        file_path=args.pdf,
        format="markdown",
        split_pages=True,       # 1 Document por página (padrão, explicitado)
        quiet=True,
        image_output="off",     # cards de texto; evita refs binárias/base64 no stdout
        table_method="cluster", # melhor extração de tabelas com bordas parciais/ausentes
        reading_order="xycut",  # reconstrução de ordem de leitura (layouts multi-coluna)
        pages=args.pages,       # None → todas as páginas
        password=args.password,
    )

    # WR-03 (Phase 02): a falha de runtime documentada (Java 11+ ausente — Pitfall 2)
    # ou um PDF corrompido/locked faria loader.load() despejar um traceback multi-linha
    # no stderr. O Node então pegava só os ÚLTIMOS 400 chars (a parte menos informativa),
    # truncando a causa real (ex.: FileNotFoundError: java) que fica no TOPO. Capturamos
    # aqui e emitimos UMA linha de diagnóstico limpa, retornando 1 (Node propaga — D-04).
    try:
        docs = loader.load()
    except Exception as e:  # noqa: BLE001 — boundary: converte para linha de stderr limpa
        print(f"odl_langchain_loader: {type(e).__name__}: {e}", file=sys.stderr)
        return 1

    # D-01: montar array JSON e emitir no stdout (sem arquivo, sem temp dir).
    # O Node consome via JSON.parse(stdout) em langchain-loader.ts (Plano 03).
    # ensure_ascii=False mantém UTF-8 legível e reduz tamanho do output.
    #
    # WR-02 (Phase 02): projetar metadata para o contrato declarado de 3 campos
    # {source, format, page} em vez de emitir d.metadata inteiro. A biblioteca pode
    # popular metadata com bounding boxes / refs de imagem / blobs base64 — tudo isso
    # iria para o stdout (inflando o payload que o Node bufferiza e faz JSON.parse) e
    # reabriria o Pitfall 5. O lado TS ignora chaves extras → puro desperdício/risco.
    out = [
        {
            "page_content": d.page_content,
            "metadata": {
                "source": d.metadata.get("source"),
                "format": d.metadata.get("format"),
                "page": d.metadata.get("page"),
            },
        }
        for d in docs
    ]
    json.dump(out, sys.stdout, ensure_ascii=False)

    return 0


if __name__ == "__main__":
    sys.exit(main())
