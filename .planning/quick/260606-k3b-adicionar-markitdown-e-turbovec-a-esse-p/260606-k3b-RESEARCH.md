# Quick Task 260606-k3b: adicionar markitdown e turbovec — Research

**Researched:** 2026-06-06
**Domain:** Sidecars Python (PDF→Markdown + busca vetorial quantizada) integrados ao server Node/TS via padrão spawn+venv+env (Phase 2)
**Confidence:** HIGH (ambos pacotes verificados na fonte oficial: PyPI JSON + READMEs dos repos canônicos)

## Summary

Os dois pacotes **existem, são reais e instaláveis em Linux x86_64** sem toolchain extra:

- **markitdown 0.1.6** — wheel **pure-Python** (`py3-none-any`), mantido pela Microsoft, Python ≥3.10. **Sem Java** (cumpre a motivação do CONTEXT). API e CLI confirmados. **Ponto crítico:** produz **um ÚNICO blob Markdown do documento inteiro** — NÃO por página, NÃO insere marcadores/números de página. Isto diverge do loader langchain (que é por-página). A normalização precisa de um caminho de **Document único** (1 entrada `page=1`), não reaproveitar a expectativa por-página.
- **turbovec 0.7.0** — **wheel pré-compilada manylinux_2_28 x86_64 disponível** (`turbovec-0.7.0-cp39-abi3-manylinux_2_28_x86_64.whl`) → `pip install turbovec` instala binário Rust pronto, **sem cargo/rustc**. API `TurboQuantIndex` confirmada. CONFIRMA a premissa do projeto: **só consome vetores, não gera embeddings**. **Ressalva de maturidade:** projeto MUITO novo (1º release 2026-04-13, ~7 semanas, v0.x). Não é bloqueante para o scaffold provado-por-smoke do Eixo 2, mas reforça o pin estrito e o `isTurbovecAvailable()` fail-closed.

**Primary recommendation:** markitdown entra como 3º loader (`ANKINATOR_PDF_LOADER=markitdown`) com sidecar próprio + **normalização de Document único** (não reaproveitar a por-página direto). turbovec entra como scaffold provado por smoke, com pin `turbovec==0.7.0`, sem fabricar nada além da API confirmada abaixo.

---

## A) markitdown (microsoft/markitdown)

### A.1 — Invocação (CONFIRMADO)

**API Python** — atributo exato verificado no fonte `_base_converter.py`:
```python
from markitdown import MarkItDown
md = MarkItDown()
result = md.convert("/abs/caminho/arquivo.pdf")
texto = result.markdown          # atributo CANÔNICO atual
# result.text_content  → alias SOFT-DEPRECATED de .markdown (ainda funciona; usar .markdown em código novo)
# str(result)          → também retorna o markdown
```
- `convert(path)` aceita **caminho de arquivo** (também há `convert_stream()` / `convert_local()` — modos mais estreitos recomendados p/ entrada não-confiável; não necessários aqui).
- **CONFIRMADO** [CITED: github.com/microsoft/markitdown `_base_converter.py`]: `self.markdown = markdown`; `text_content` é `@property` que retorna `self.markdown` com nota de depreciação.

**CLI** (CONFIRMADO [CITED: README microsoft/markitdown]):
```bash
markitdown arquivo.pdf -o saida.md      # -o suportado
markitdown arquivo.pdf > saida.md        # redirect também
cat arquivo.pdf | markitdown             # stdin também
```
> Para o sidecar, **use a API Python** (não a CLI) — espelha o contrato JSON-stdout do `odl_langchain_loader.py` sem depender do binário de console no PATH do venv.

### A.2 — Formato de SAÍDA: BLOB ÚNICO (CONFIRMADO — DECISÃO ARQUITETURAL CRÍTICA)

**markitdown produz UM único blob Markdown do documento inteiro.** NÃO há split por página, NÃO há marcadores de página, NÃO há `metadata.page`.
- Backend PDF: **abordagem híbrida `pdfplumber` (estrutura) + `pdfminer.six` (texto puro)**, selecionando por página internamente, mas **concatenando tudo num único `result.markdown`** [CITED: mintlify.wiki/microsoft/markitdown/formats/pdf]. A documentação oficial **não documenta nenhum marcador de página** na saída (verificado explicitamente).
- Contraste com o loader langchain atual: `OpenDataLoaderPDFLoader(split_pages=True)` emite **1 Document por página** com `metadata.page` 1-indexed → `langchain-normalize.ts` deriva `numPages`, `pageStart/pageEnd` das seções e atribuição de fonte nos cards a partir disso.

**Como mapear para `LoadedDocument` (recomendação — normalização mínima correta):**

> **NÃO reaproveite `normalize()` de `langchain-normalize.ts` como está** — ela espera `RawDoc[]` por-página e deriva `numPages = max(metadata.page)`. Com markitdown isso colapsaria para `numPages=1` silenciosamente e quebraria a atribuição de página dos cards.

Caminho recomendado, **espelhando o contrato JSON do sidecar** mas com 1 entrada:
1. Sidecar `markitdown_loader.py` imprime no stdout o **mesmo shape** `[{page_content, metadata}]` que o sidecar langchain, porém com **uma única entrada**:
   ```json
   [{"page_content": "<markdown inteiro>", "metadata": {"source": "<path>", "format": "markdown", "page": 1}}]
   ```
2. No TS, **reusar `normalize(parsed, pdfPath)`** (langchain-normalize.ts) **funciona out-of-the-box** para o caso de 1 documento:
   - `buildSectionsFromMarkdown` reparseia os headings ATX do markdown e cria seções por heading (`pageStart=pageEnd=1` em todas). As seções saem corretas; só perdem granularidade de página real (esperado — markitdown não tem essa info).
   - `numPages` vira `1` (max das páginas emitidas). **Limitação aceitável e honesta:** a atribuição "página X" nos cards fica como página 1 nesse loader. Documentar isso.
   - `title` = 1º heading ATX (já tratado).
3. **Alternativa (mais fiel a numPages), se desejado depois:** o sidecar pode descobrir o nº real de páginas via `pdfminer`/`pdfplumber` (já vêm com `markitdown[all]`) e setar `metadata.page` aproximado — **mas isso é over-engineering p/ esta fatia** (Karpathy #2). Recomendo o caminho 1+2 (blob único, `page=1`).

**Recomendação final A.2:** sidecar emite **1 entrada** no shape contratual; **reusar `normalize()` sem modificá-la**; aceitar `numPages=1` como limitação documentada deste loader. Zero código de normalização novo. (Honra "reusar `langchain-normalize.ts` se compatível" do CONTEXT — é compatível para 1 doc.)

### A.3 — Instalação (CONFIRMADO)

- **Wheel:** `markitdown-0.1.6-py3-none-any.whl` → **pure Python, sem extensão nativa, sem Java** [VERIFIED: PyPI JSON].
- `pip install 'markitdown[all]'` puxa (extras `all`, do `requires_dist` real [VERIFIED: PyPI JSON]):
  - Base sempre: `beautifulsoup4`, `charset-normalizer`, `defusedxml`, **`magika~=0.6.1`** (modelo ONNX de detecção de tipo de arquivo — baixa um pequeno modelo, **sem GPU/torch**), `markdownify`, `requests`.
  - PDF: `pdfminer-six>=20251230`, `pdfplumber>=0.11.9`.
  - `all` também adiciona: `mammoth` (docx), `python-pptx`, `openpyxl`/`pandas`/`xlrd` (xls/xlsx), `lxml`, `olefile`, **`pydub`+`speechrecognition`** (áudio), `youtube-transcript-api`, e SDKs Azure (`azure-ai-documentintelligence`, `azure-identity`, etc.).
- **Dependências de SISTEMA pesadas:** o extra de **áudio (`pydub`)** requer **ffmpeg** no SO para transcrição de áudio — **mas o Ankinator só processa PDF**. **Recomendação:** instalar o extra **`pdf`**, NÃO `all`, para evitar arrastar áudio/Azure/ffmpeg desnecessários:
  ```bash
  pip install 'markitdown[pdf]==0.1.6'    # só PDF: + pdfminer-six + pdfplumber
  ```
  Isto cumpre o escopo "server-only, entrada só PDF" do CONTEXT (Eixo 1) e Karpathy #2 (sem dependência especulativa). `[all]` fica como follow-up futuro quando suportar Office/imagem.
- **Versão estável atual:** **0.1.6** (release 2026-05-26) [VERIFIED: PyPI JSON]. Python `>=3.10`.

### A.4 — Pitfalls conhecidos (markitdown PDF)

| Pitfall | Detalhe | Mitigação |
|---|---|---|
| **PDF escaneado / sem camada de texto** | O conversor PDF **NÃO faz OCR** nativamente — retorna markdown vazio/lixo p/ PDF imagem-only [CITED: README microsoft/markitdown; OCR só via plugin `markitdown-ocr` que exige LLM Vision/OpenAI = viola R2]. | Para escaneados, **manter o caminho OCR existente** (`runOcrLoader`/`isOcrAvailable`, intocado). markitdown é p/ PDFs com texto. |
| **Perda de estrutura** | pdfminer.six "frequentemente perde headings/parágrafos/tabelas" → markdown pouco estruturado [CITED: mintlify docs]. pdfplumber melhora tabelas mas não é perfeito. | Aceitável para material de concurso text-heavy. O reparse de headings ATX em `buildSectionsFromMarkdown` ainda agrupa o que houver; se não houver `#`, vira 1 seção fallback (já tratado). |
| **Encoding** | Há issue aberto de encoding (#1290) [CITED: github issue]. | O sidecar já decodifica stdout uma vez como UTF-8 no lado Node (run() bufferiza Buffer[]). Garantir `ensure_ascii=False` no `json.dump` (igual ao langchain sidecar) e `print(..., file=sys.stderr)` p/ diagnósticos. |
| **`magika` baixa modelo** | Primeira execução pode baixar/cachear o modelo magika de detecção de tipo. | Roda offline após cache; não é bloqueante. Documentar no setup. |

---

## B) turbovec (RyanCodrai/turbovec)

### B.1 — Existe e instala em Linux? SIM, COM WHEEL PRÉ-COMPILADA (CONFIRMADO)

- **`pip install turbovec` instala wheel binária pronta para linux x86_64** — **NÃO exige Rust/cargo** [VERIFIED: PyPI JSON, lista de `urls`]:
  - `turbovec-0.7.0-cp39-abi3-manylinux_2_28_x86_64.whl`  ← **alvo do projeto** (este host: x86_64, glibc 2.39 ≥ 2.28 ✓, Python 3.13 — `abi3` é forward-compatible com ≥3.9 ✓)
  - `turbovec-0.7.0-cp39-abi3-manylinux_2_28_aarch64.whl` (ARM linux)
  - `turbovec-0.7.0-cp39-abi3-macosx_11_0_arm64.whl` (mac ARM)
  - `turbovec-0.7.0-cp39-abi3-win_amd64.whl` (Windows)
  - `turbovec-0.7.0.tar.gz` (sdist — fallback que SIM exigiria toolchain Rust; mas com wheel disponível o pip pega a wheel).
- **Ambiente local verificado:** x86_64, glibc 2.39, Python 3.13.0, pip 26.1.2 → wheel `manylinux_2_28_x86_64` é **diretamente instalável** [VERIFIED: comandos locais].
- **Maturidade (RESSALVA — INCERTO sobre estabilidade de API):** projeto **muito jovem**. 1º release `0.1.0` em **2026-04-13**; **16 releases em ~7 semanas**; última `0.7.0` em **2026-05-30** [VERIFIED: PyPI release history]. Ainda **v0.x** → API pode mudar entre minors. Estrelas/adoção não confirmadas. **Isto NÃO bloqueia o Eixo 2** (scaffold provado por smoke, dedup deferido), mas justifica pin EXATO e fail-closed.
- `requires_python: >=3.9`. Dependência: **`numpy>=1.20`** (única dep core) [VERIFIED: PyPI JSON]. Extras opcionais p/ integração: `agno`, `haystack`, `langchain`, `llama-index` — **não usar** (Karpathy #2).

### B.2 — API Python (CONFIRMADO via README do repo)

```python
import numpy as np
from turbovec import TurboQuantIndex

index = TurboQuantIndex(dim=1536, bit_width=4)   # bit_width ∈ {2, 4}
index.add(vectors)                                # vectors: np.ndarray float32, shape (N, dim)
index.add(more_vectors)                           # add incremental suportado
scores, indices = index.search(query, k=10)       # query: np.ndarray; retorna TUPLA (scores, indices)
# search(query, k=10, allowlist=None) — allowlist: np.ndarray uint64 de ids permitidos (filtro opcional)
```
- **Variante com IDs estáveis** (sobrevive a deleções) — útil para dedup futuro:
  ```python
  from turbovec import IdMapIndex
  idx = IdMapIndex(dim=1536, bit_width=4)
  idx.add_with_ids(vectors, np.array([...], dtype=np.uint64))
  scores, ids = idx.search(query, k=10)
  ```
- **CONFIRMADO** [CITED: README RyanCodrai/turbovec]: construtor `TurboQuantIndex(dim, bit_width)`, `add(vectors)`, `search(query, k=, allowlist=) -> (scores, indices)`.

### B.3 — Só consome vetores, NÃO gera embeddings (CONFIRMADO)

**CONFIRMADO** [CITED: README]: "Embedding generation: Not included — accepts only pre-computed vectors". A premissa do projeto está correta. O scaffold permanece **agnóstico à fonte de embeddings** (Eixo 3 / C2). Para o smoke, gerar **vetores fake determinísticos** (ex.: `np.random.default_rng(SEED).standard_normal((N, dim)).astype('float32')`) — prova-de-vida sem instalar nenhum modelo.

### B.4 — Pitfalls (turbovec)

| Pitfall | Detalhe | Mitigação |
|---|---|---|
| **numpy obrigatório + dtype** | Exige `numpy>=1.20`; exemplos usam **float32**. | Sidecar deve `astype(np.float32)` antes de `add`/`search`. Pin numpy implícito via dep do pacote. |
| **Normalização** | README diz que a **normalização é feita internamente** durante o encoding [CITED: README]. | NÃO normalizar manualmente no smoke; passar vetores crus float32. |
| **Plataforma** | Wheel cobre linux x86_64/aarch64, mac arm64, win amd64. **Sem wheel mac x86_64 (Intel)** nem musllinux (Alpine).| `isTurbovecAvailable()` fail-closed cobre ambientes sem wheel (sdist falharia sem Rust → import falha → false). |
| **API v0.x instável** | minors podem quebrar assinatura. | Pin EXATO `turbovec==0.7.0`; teste de parse do JSON de saída detecta drift. |

---

## C) Encaixe no projeto — contrato do sidecar (CONFIRMADO no código local)

### C.1 — Como o `.ts` spawna o sidecar `.py` (padrão a espelhar EXATAMENTE)

De `langchain-loader.ts` (lido):
- **Interpretador:** lido de env (`pythonBin()`); para markitdown → `process.env.ANKINATOR_MARKITDOWN_PYTHON?.trim() || null`. (NÃO fazer fallback p/ ODL_PYTHON: o venv do markitdown é dedicado e NÃO precisa de Java — separar evita confusão.)
- **Path do sidecar:** resolvido cross-mode via `import.meta.url`, subindo **4 níveis** até a raiz do repo + `tools/<script>.py`:
  ```ts
  const here = path.dirname(fileURLToPath(import.meta.url));
  const SIDECAR_SCRIPT = path.resolve(here, '../../../../tools/markitdown_loader.py');
  ```
- **Spawn:** `spawn(py, [SIDECAR_SCRIPT, pdfPath, ...args], { stdio:['ignore','pipe','pipe'] })`. Argv-array (sem shell → sem injeção).
- **Captura stdout/stderr** em `Buffer[]` e decodifica UMA vez com `Buffer.concat(...).toString('utf8')` (CR-01: nunca `d.toString()` por chunk — protege UTF-8 PT-BR). **Reusar a função `run()`** — extraí-la p/ um util compartilhado OU duplicar idêntica.
- **Contrato stdout:** sidecar imprime **JSON `[{page_content, metadata}]`** com `json.dump(out, sys.stdout, ensure_ascii=False)`; Node faz `JSON.parse` com as **guardas CR-02** (é array? cada item tem `page_content: string`?) antes de chamar `normalize()`.
- **Erros:** distinguir `spawnError` (ENOENT/python errado) de `code != 0` (sidecar rodou e falhou); no sidecar, capturar exceção e emitir 1 linha limpa no stderr (`print(f"markitdown_loader: {type(e).__name__}: {e}", file=sys.stderr)`) + `return 1` — espelha WR-03.
- **Disponibilidade:** `isMarkitdownAvailable()` = `pythonBin() != null && run(py, ['-c','import markitdown']).code === 0`. **Sem checar Java** (markitdown não usa Java).

### C.2 — Seleção do loader

- `config.ts`: estender `PdfLoaderKind = 'node' | 'langchain' | 'markitdown'`; novo env `ANKINATOR_MARKITDOWN_PYTHON`.
- `document-loader.ts`: estender `LoaderChoice.loader` e `chooseLoader(env, langchainAvail, markitdownAvail)`:
  - `env === 'markitdown'` → força markitdown; erro claro se indisponível (espelha o branch langchain).
  - **Default INTOCADO:** unset → auto langchain/node como hoje. markitdown **só** sob env explícito `=markitdown` (Eixo 1: default byte-idêntico, guard de default-loader verde).
- `loadDocument`: novo branch `if (loader === 'markitdown') return runMarkitdownLoader(pdfPath, opts)`.

### C.3 — Sidecar markitdown (`tools/markitdown_loader.py`) — esboço de contrato

```python
from markitdown import MarkItDown
# argparse: pdf [--pages] [--password]   (espelha LoadOptions/D-11; markitdown ignora pages/password no PDF básico — documentar que são no-op aqui)
result = MarkItDown().convert(args.pdf)
out = [{"page_content": result.markdown, "metadata": {"source": args.pdf, "format": "markdown", "page": 1}}]
json.dump(out, sys.stdout, ensure_ascii=False)
```
> **`--pages`/`--password` são no-op** no markitdown PDF básico (a API `convert(path)` não os expõe) — aceitar os args p/ paridade de assinatura mas documentar que não têm efeito neste loader. (Honesto > fabricar suporte.)

### C.4 — Sidecar turbovec (`tools/turbovec_index.py`) — subcomando smoke + interface add/search

```python
# subcomando "smoke": cria índice, indexa vetores fake determinísticos, busca, imprime JSON {ok, k, top_indices}
# subcomandos "add"/"search": leem vetores via JSON stdin, retornam JSON stdout (interface mínima futura)
import numpy as np
from turbovec import TurboQuantIndex
def smoke(dim=64, n=128, bit_width=4, k=5):
    rng = np.random.default_rng(42)
    vecs = rng.standard_normal((n, dim)).astype(np.float32)
    idx = TurboQuantIndex(dim=dim, bit_width=bit_width)
    idx.add(vecs)
    scores, indices = idx.search(vecs[0], k=k)
    print(json.dumps({"ok": True, "k": k, "top_indices": indices.tolist()[:k]}))
```
- Wrapper `server/src/core/turbovec.ts`: `isTurbovecAvailable()` **fail-closed** (`ANKINATOR_TURBOVEC_PYTHON` definido E `import turbovec` ok) + `runTurbovecSmoke()` que spawna e parseia o JSON. Marcar `// TODO(dedup-semântico: fase futura)`. **NÃO plugar no pipeline** (Eixo 2 / R1/R3).
- 1 teste CLI-free: parse determinístico do JSON `{ok:true,...}` (mock do stdout) — prova o contrato sem rodar Python.

---

## D) Pins de versão recomendados (estilo do projeto)

A Phase 2 fixou `langchain-opendataloader-pdf==2.0.0` em `tools/requirements.txt`. Espelhar com **requirements separados por sidecar** (venvs dedicados — markitdown sem Java, turbovec sem nada extra):

```
# tools/requirements-markitdown.txt   (venv dedicado markitdown — Python >=3.10, SEM Java)
markitdown[pdf]==0.1.6      # pure-python; só extra PDF (pdfminer-six + pdfplumber). [all] = follow-up futuro

# tools/requirements-turbovec.txt     (venv dedicado turbovec — Python >=3.9, wheel binária linux x86_64)
turbovec==0.7.0            # wheel manylinux_2_28_x86_64 (sem Rust). numpy>=1.20 vem como dep.
```
> Manter o `tools/requirements.txt` langchain INTOCADO. Venvs separados evitam conflito de deps e mantêm o default langchain/node imexível.

| Pacote | Pin | Provenance | Notas |
|---|---|---|---|
| `markitdown[pdf]` | `==0.1.6` | [VERIFIED: PyPI JSON, 2026-05-26] | pure-python; Microsoft; sem Java |
| `turbovec` | `==0.7.0` | [VERIFIED: PyPI JSON, 2026-05-30] | wheel linux x86_64; v0.x novo → pin estrito |

---

## E) Riscos / Contingência

| # | Risco | Sev | Mitigação |
|---|---|---|---|
| E1 | **markitdown = blob único, não por-página** → reaproveitar normalize por-página colapsa `numPages` silenciosamente | ALTA | Sidecar emite **1 entrada `page=1`**; reusar `normalize()` (compatível p/ 1 doc); documentar `numPages=1` como limitação honesta deste loader. (Detalhe em A.2.) |
| E2 | **turbovec é v0.x muito novo** (7 semanas, 16 releases) — API pode quebrar; adoção/estrelas não confirmadas | MÉDIA | Pin EXATO `==0.7.0`; `isTurbovecAvailable()` fail-closed; teste de parse detecta drift. **NÃO é gatilho de degradação** — a wheel linux x86_64 instala e a API está confirmada na fonte. |
| E3 | PDF escaneado no loader markitdown → markdown vazio (sem OCR nativo) | MÉDIA | Caminho OCR existente intocado; markitdown é p/ PDFs com texto. Documentar. |
| E4 | `markitdown[all]` arrasta ffmpeg/áudio/Azure desnecessários | BAIXA | Usar `[pdf]` só (D). |
| E5 | slopcheck bloqueado pelo classificador auto-mode (self-mod gate) → não rodou | BAIXA | **Mitigado por verificação na fonte oficial:** ambos confirmados via PyPI JSON (HTTP 200, wheels reais, histórico de releases real) + READMEs dos repos canônicos citados no CONTEXT (microsoft/markitdown, RyanCodrai/turbovec). Não há sinal de slopsquat. Ver "Package Legitimacy" abaixo. |

### Contingência do CONTEXT (turbovec imaturo): NÃO ACIONADA
A degradação prevista (`requirements pin + doc + isTurbovecAvailable()=false`, sem wrapper) **NÃO precisa ser acionada**: turbovec **é instalável** (wheel linux x86_64 pré-compilada, sem Rust) e **a API está confirmada na fonte** (B.2). O scaffold provado-por-smoke do Eixo 2 é viável como planejado. A única ressalva é a juventude do projeto (E2) → pin estrito + fail-closed, exatamente como o CONTEXT já prevê para o wrapper.

### Package Legitimacy (slopcheck indisponível → verificação na fonte)
slopcheck foi **bloqueado pelo classificador auto-mode** (instala pacote externo — mesmo gate self-mod já documentado na memória do projeto). Degradação aplicada: ambos os pacotes verificados por **fonte autoritativa** em vez de slopcheck:

| Pacote | Registry | Idade | Wheel | Repo fonte | Verdito |
|---|---|---|---|---|---|
| markitdown | PyPI (HTTP 200) | est. 2024+ (v0.1.6 2026-05) | py3-none-any (pure) | github.com/microsoft/markitdown (canônico no CONTEXT) | Aprovado — org Microsoft, sem sinal de slop |
| turbovec | PyPI (HTTP 200) | jovem (1º release 2026-04-13) | manylinux_2_28_x86_64 (Rust pré-compilado) | github.com/RyanCodrai/turbovec (canônico no CONTEXT) | Aprovado com ressalva de maturidade (E2) |

Como slopcheck não rodou, o planner **deveria** manter um `checkpoint:human-verify` antes do `pip install` na validação ao vivo — coerente com "validação ao vivo PENDENTE" do CONTEXT.

---

## Fatos: CONFIRMADO vs INCERTO (resumo)

**CONFIRMADO (fonte):**
- markitdown 0.1.6 pure-python, Python ≥3.10, sem Java [PyPI JSON]
- API `MarkItDown().convert(path).markdown` (`.text_content` = alias deprecated) [github `_base_converter.py`]
- CLI `markitdown file.pdf -o out.md` [README]
- markitdown PDF = **blob único, sem marcadores de página**, backend pdfminer.six+pdfplumber [mintlify docs + README]
- markitdown sem OCR nativo (PDF escaneado falha) [README]
- `[pdf]` extra = pdfminer-six+pdfplumber; `[all]` arrasta áudio/Azure [PyPI requires_dist]
- turbovec 0.7.0 com **wheel manylinux_2_28_x86_64** (sem Rust), dep numpy>=1.20 [PyPI JSON]
- turbovec API `TurboQuantIndex(dim,bit_width)`/`add`/`search→(scores,indices)`, só consome vetores [README]
- Ambiente local: x86_64, glibc 2.39, Python 3.13 → wheels instaláveis [comandos locais]
- Contrato do sidecar Phase 2 (spawn/import.meta.url/Buffer/JSON/guardas) [código lido]

**INCERTO:**
- Estabilidade futura da API turbovec (v0.x, 7 semanas) — INCERTO, mitigado por pin
- Estrelas/adoção do turbovec — não confirmado (irrelevante p/ a decisão)
- Comportamento exato do markitdown em tabelas complexas PT-BR — depende do PDF (validação ao vivo PENDENTE, como o CONTEXT já declara)

---

## RESEARCH COMPLETE

**Arquivo:** `/home/t316360/plottwist/ankinator/.planning/quick/260606-k3b-adicionar-markitdown-e-turbovec-a-esse-p/260606-k3b-RESEARCH.md`

Achados decisivos para o planner:

- **markitdown produz BLOB ÚNICO**, não por-página, sem marcadores/números de página (CONFIRMADO: pdfminer.six+pdfplumber concatenados em `result.markdown`). O sidecar deve emitir **1 entrada `{page_content: markdown, metadata:{page:1}}`** e **reusar `normalize()` sem alterá-la** (compatível p/ 1 doc); aceitar `numPages=1` como limitação documentada. **NÃO** tentar split por-página.
- **API markitdown CONFIRMADA na fonte:** `from markitdown import MarkItDown; MarkItDown().convert(path).markdown` (`.text_content` é alias soft-deprecated). CLI `markitdown f.pdf -o out.md`. Usar a **API** no sidecar (não a CLI).
- **Instalar `markitdown[pdf]==0.1.6`** (NÃO `[all]`): pure-python, sem Java, sem ffmpeg/áudio/Azure. Sem OCR nativo → manter caminho OCR existente p/ escaneados.
- **turbovec É INSTALÁVEL — contingência NÃO acionada:** wheel `manylinux_2_28_x86_64` pré-compilada (`turbovec==0.7.0`, sem Rust/cargo), dep só numpy>=1.20. API `TurboQuantIndex(dim,bit_width)/add(np.float32)/search(query,k)->(scores,indices)` CONFIRMADA; **só consome vetores, não gera embeddings** (premissa do projeto confirmada).
- **Ressalva turbovec:** projeto MUITO novo (1º release 2026-04-13, v0.x, 16 releases/7 semanas) → pin EXATO `==0.7.0` + `isTurbovecAvailable()` fail-closed + teste de parse. Não bloqueia o scaffold provado-por-smoke (Eixo 2); smoke usa vetores fake determinísticos float32.
- **Contrato sidecar (espelhar Phase 2):** novos envs `ANKINATOR_MARKITDOWN_PYTHON` e `ANKINATOR_TURBOVEC_PYTHON` (venvs dedicados; markitdown SEM Java); path via `import.meta.url` +4 níveis → `tools/markitdown_loader.py` / `tools/turbovec_index.py`; stdout JSON; reusar `run()`+guardas CR-02; `isMarkitdownAvailable()` checa `import markitdown` (sem Java). Default `ANKINATOR_PDF_LOADER` INTOCADO; markitdown só sob `=markitdown` explícito.
- **Pins separados:** `tools/requirements-markitdown.txt` (`markitdown[pdf]==0.1.6`) e `tools/requirements-turbovec.txt` (`turbovec==0.7.0`); `tools/requirements.txt` langchain INTOCADO.
- **slopcheck bloqueado** pelo gate auto-mode; degradado p/ verificação na fonte (PyPI JSON 200 + READMEs canônicos microsoft/RyanCodrai) — sem sinal de slop. Planner deve manter checkpoint humano antes do `pip install` na validação ao vivo (coerente com "validação ao vivo PENDENTE").
