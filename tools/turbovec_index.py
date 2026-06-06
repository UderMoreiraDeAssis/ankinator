#!/usr/bin/env python3
"""
Sidecar Python para busca vetorial quantizada via turbovec (RyanCodrai/turbovec).

Scaffold provado por smoke — NÃO plugado no pipeline.
O dedup Jaccard atual (deck-organizer.ts/existing-deck.ts) permanece INTOCADO.

Uso:
  python turbovec_index.py smoke [--dim D] [--n N] [--bit-width B] [--k K]
  python turbovec_index.py add    (JSON stdin: {"vectors": [[...]]})
  python turbovec_index.py search (JSON stdin: {"vectors": [[...]], "query": [...], "k": K})

Saída (stdout): JSON {"ok": true, ...} em sucesso; processo sai com código != 0 em erro.

Subcomandos:
  smoke  — prova-de-vida do índice + vetores fake determinísticos + busca.
           Prova que TurboQuantIndex existe, aceita float32 e retorna resultados.
           Imprime {"ok": True, "k": k, "top_indices": [...]}.

  add    — lê {"vectors": [[...]]} do stdin, constrói índice em memória,
           retorna {"ok": true, "count": N}. Interface para uso FUTURO.

  search — lê {"vectors": [[...]], "query": [...], "k": K} do stdin,
           retorna {"ok": true, "scores": [...], "indices": [...]}.
           Interface para uso FUTURO.

Limitações documentadas:
  - Este sidecar SÓ CONSOME vetores (não gera embeddings).
    A fonte de embeddings (ex.: sentence-transformers local para PT-BR) é DEFERIDA
    para a fase futura "dedup semântico" no ROADMAP (Eixo 3 / C2).
  - Pin estrito turbovec==0.7.0: projeto v0.x (~7 semanas, 16 releases) — API pode
    mudar entre minors. O teste CLI-free (turbovec.test.ts) detecta drift de API.
  - O índice add/search é em memória (sem persistência) — interface futura mínima.

Pré-requisitos:
  - turbovec==0.7.0 instalado no venv apontado por ANKINATOR_TURBOVEC_PYTHON
    (Python >=3.9; wheel pré-compilada manylinux_2_28_x86_64, sem Rust/cargo)
  - numpy>=1.20 vem como dep transitiva do turbovec
  - Setup: python3 -m venv ~/.venvs/turbovec &&
           ~/.venvs/turbovec/bin/pip install -r tools/requirements-turbovec.txt
"""

import argparse
import json
import sys

import numpy as np
from turbovec import TurboQuantIndex


def cmd_smoke(args: argparse.Namespace) -> int:
    """
    Prova-de-vida do TurboQuantIndex com vetores fake determinísticos float32.

    Cria índice, indexa `n` vetores fake, busca os `k` mais próximos do 1º vetor
    e imprime JSON {"ok": True, "k": k, "top_indices": [...]}.

    NÃO normaliza manualmente — turbovec normaliza internamente (RESEARCH B.4).
    Usa rng determinístico (seed=42) para reproducibilidade.
    """
    dim = args.dim
    n = args.n
    bit_width = args.bit_width
    k = args.k

    try:
        # Vetores fake determinísticos float32 (sem normalizar — turbovec normaliza internamente)
        rng = np.random.default_rng(42)
        vecs = rng.standard_normal((n, dim)).astype(np.float32)

        idx = TurboQuantIndex(dim=dim, bit_width=bit_width)
        idx.add(vecs)
        scores, indices = idx.search(vecs[0], k=k)

        result = {
            "ok": True,
            "k": k,
            "top_indices": indices.tolist()[:k],
        }
        print(json.dumps(result))
    except Exception as e:  # noqa: BLE001 — boundary: stderr limpo
        print(f"turbovec_index smoke: {type(e).__name__}: {e}", file=sys.stderr)
        return 1

    return 0


def cmd_add(args: argparse.Namespace) -> int:  # noqa: ARG001
    """
    Interface mínima add (JSON stdin → índice em memória → JSON stdout).
    Interface para uso FUTURO — não chamada por nada no pipeline atual.
    """
    try:
        payload = json.load(sys.stdin)
        vectors = np.asarray(payload["vectors"], dtype=np.float32)
        n, dim = vectors.shape

        idx = TurboQuantIndex(dim=dim, bit_width=4)
        idx.add(vectors)

        print(json.dumps({"ok": True, "count": n}))
    except Exception as e:  # noqa: BLE001 — boundary: stderr limpo
        print(f"turbovec_index add: {type(e).__name__}: {e}", file=sys.stderr)
        return 1

    return 0


def cmd_search(args: argparse.Namespace) -> int:  # noqa: ARG001
    """
    Interface mínima search (JSON stdin → resultados → JSON stdout).
    Interface para uso FUTURO — não chamada por nada no pipeline atual.
    """
    try:
        payload = json.load(sys.stdin)
        vectors = np.asarray(payload["vectors"], dtype=np.float32)
        query = np.asarray(payload["query"], dtype=np.float32)
        k = int(payload.get("k", 5))
        _n, dim = vectors.shape

        idx = TurboQuantIndex(dim=dim, bit_width=4)
        idx.add(vectors)
        scores, indices = idx.search(query, k=k)

        print(json.dumps({
            "ok": True,
            "scores": scores.tolist(),
            "indices": indices.tolist(),
        }))
    except Exception as e:  # noqa: BLE001 — boundary: stderr limpo
        print(f"turbovec_index search: {type(e).__name__}: {e}", file=sys.stderr)
        return 1

    return 0


def main() -> int:
    ap = argparse.ArgumentParser(
        description="Sidecar turbovec: smoke + add/search (interface futura de busca vetorial)."
    )
    sub = ap.add_subparsers(dest="command", required=True)

    # smoke — prova-de-vida
    p_smoke = sub.add_parser("smoke", help="Prova-de-vida: índice + vetores fake + busca.")
    p_smoke.add_argument("--dim", type=int, default=64, help="Dimensão dos vetores (default 64).")
    p_smoke.add_argument("--n", type=int, default=128, help="Número de vetores (default 128).")
    p_smoke.add_argument("--bit-width", type=int, default=4, dest="bit_width",
                         help="Largura de bits da quantização (2 ou 4; default 4).")
    p_smoke.add_argument("--k", type=int, default=5, help="Número de resultados (default 5).")

    # add — interface futura
    sub.add_parser("add", help="(Futura) Indexa vetores de JSON stdin.")

    # search — interface futura
    sub.add_parser("search", help="(Futura) Busca vetores de JSON stdin.")

    args = ap.parse_args()

    if args.command == "smoke":
        return cmd_smoke(args)
    elif args.command == "add":
        return cmd_add(args)
    elif args.command == "search":
        return cmd_search(args)
    else:
        ap.print_help(sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
