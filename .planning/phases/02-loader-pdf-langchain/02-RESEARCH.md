# Phase 02: Loader PDF LangChain - Research

**Researched:** 2026-06-03
**Domain:** Python sidecar integration (spawn) — `langchain-opendataloader-pdf` PDF loader normalized to existing `LoadedDocument`
**Confidence:** HIGH (all 4 research flags resolved; 3 CONFIRMED via official sources, 1 CONFIRMED via codebase ground-truth + corroborating external evidence)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Contrato do Sidecar (Python ↔ Node)**
- **D-01:** Script Python imprime array JSON `[{page_content, metadata}]` no **stdout**; Node faz `JSON.parse`. SEM temp dir. (`parseOdlOutput` espera árvore ODL `json.kids`; saída LangChain é per-page → temp-dir não reaproveita o parser. stdout é determinístico/testável por fixture — casa com D-14.)
- **D-02:** Interpretador via nova env **`ANKINATOR_LANGCHAIN_PYTHON`, com fallback para `ODL_PYTHON`**. (Stack `langchain-*` pode conflitar com o venv enxuto do OCR; var dedicada habilita venv isolado sem penalizar quem só setou `ODL_PYTHON`.)

**Ativação opt-in & Fallback (PDF-02)**
- **D-03:** Ativação por env seletor global **`ANKINATOR_PDF_LOADER=node|langchain`, default `node`**. Espelha `ANKINATOR_PROVIDER=cli|api`. NÃO flag por-request.
- **D-04:** Fallback automático **só por indisponibilidade**: checar `import` do pacote (estilo `isOcrAvailable()`); ausente → usa Node em silêncio. Erro de **runtime** no sidecar → **propaga** (não mascara bug, não re-extrai 2×).
- **D-05:** Visibilidade do loader = **apenas log no servidor** (`[ankinator] loader: langchain` / `(fallback→node)`). NÃO estender `LoadedDocument` (tipo duplicado server/web — Pitfall 4).
- **D-06:** OCR fica **no caminho Python atual** (`runOcrLoader`/`--force-ocr`); loader LangChain **ignora `ocr` nesta fase**. Se `ocr=true` E `loader=langchain` → **OCR vence** (mais específico).

**Normalização → LoadedDocument (PDF-03, núcleo)**
- **D-07:** `sections[]` reconstruídas **reparseando os headings `#` do markdown** (concatena `page_content` + passada estilo `buildSections` adaptada para entrada markdown). `chunkDocument` consome SÓ `doc.sections[]`; page-as-section degradaria a qualidade do card. **Depende de D-12** (markdown precisa conter headings).
- **D-08:** `elements[]` = **1 `DocElement{ type:'text block', page, content }` por página** (mínimo). `'text block'` já está em `ElementType`. Chunker ignora `elements`.
- **D-09:** `markdown` completo = `pages.map(p=>p.page_content).join('\n\n')` + **reuso de `cleanMarkdown`**. SEM marcadores de página.
- **D-10:** Campos do topo **derivados**: `numPages = max(metadata.page)+1` (ver nota crítica em §Research Flags — page é **1-indexed**), `fileName = basename(pdf)`, `title = primeiro heading | null`. NÃO confiar em campos top-level.

**Script Python & opções (PDF-01)**
- **D-11:** CLI do `tools/odl_langchain_loader.py` **espelha `LoadOptions`**: `<pdf> [--pages] [--password]`. Ignorá-los seria bug silencioso.
- **D-12:** Configurar o pacote em **modo markdown por página** (preserva headings/tabelas — essencial p/ D-07). Texto plano rejeitado.
- **D-13:** Dependência em **`tools/requirements.txt` com pin de versão** + nota no README/INTEGRATIONS.

**Verificação & não-regressão**
- **D-14:** **Unit puro da normalização** (fixture `Document[]` → `LoadedDocument`, SEM Python — determinístico) + **smoke opt-in** (`smoke-langchain-loader.ts` gated em disponibilidade).
- **D-15:** **Guard determinístico**: com `ANKINATOR_PDF_LOADER` não setado, `loadDocument` usa o caminho `@opendataloader/pdf` de hoje **byte-idêntico**. Espelha o guard SPEC-01 da Phase 1. Constraint dura: o fluxo atual roda SEM Python.

### Claude's Discretion
- Nomes exatos de arquivos/funções dentro de `langchain-loader.ts` e do módulo de normalização.
- Como compartilhar `buildSections` entre os dois loaders (extrair helper reutilizável vs adaptar) — desde que ambos consistentes e build verde.
- Conteúdo exato da fixture de D-14 e formato exato da linha de log de D-05.
- Forma exata de detectar disponibilidade (qual módulo importar no teste de `import`), desde que cumpra D-04.

### Deferred Ideas (OUT OF SCOPE)
- Seleção de loader por-request (`req.body.loader`) + seletor na UI.
- Campo `loader` em `LoadedDocument` + badge na UI.
- Unificar o OCR no sidecar LangChain (aposentar `runOcrLoader`/`--force-ocr`).
- `elements[]` rico (heading/parágrafo).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PDF-01 | Script Python `tools/odl_langchain_loader.py` usa `langchain-opendataloader-pdf` p/ extrair PDF em Documents por página (texto/markdown + metadata) | API confirmada: `OpenDataLoaderPDFLoader(file_path, format="markdown", split_pages=True)` → `.load()` retorna 1 `Document`/página. CLI args `--pages`/`--password` mapeiam para `pages=`/`password=` do construtor (D-11). Serialização JSON de `[{page_content, metadata}]` via `json.dumps` (D-01). Ver §Standard Stack + §Code Examples. |
| PDF-02 | `langchain-loader.ts` invoca o sidecar via spawn, opt-in por env, com fallback automático p/ loader Node quando indisponível | Molde direto = `ocr-loader.ts` (`spawn`/`run()`/`isOcrAvailable()`). Availability-check = `import langchain_opendataloader_pdf` (D-04). Branch em `loadDocument` por `ANKINATOR_PDF_LOADER` (D-03). Ver §Architecture Patterns + §Pitfalls. |
| PDF-03 | Saída normalizada p/ `LoadedDocument` (sections/elements/markdown), reaproveitando o chunker | Núcleo puro `normalize(Document[]) → LoadedDocument` (D-07..D-10). `chunkDocument` consome só `sections[]` (verificado em `chunker.ts`). Markdown ATX `#` headings CONFIRMADO (mesmo engine 2.x do Node). Ver §Architectural Responsibility Map + §Validation Architecture. |
</phase_requirements>

## Summary

Esta fase adiciona um **segundo loader de PDF opcional** ao Ankinator, paralelo ao `@opendataloader/pdf` (Node/Java) já em produção. O novo caminho usa o pacote Python `langchain-opendataloader-pdf` (PyPI, v2.0.0, 2026-03-16) via **sidecar spawn** — exatamente o padrão já estabelecido por `ocr-loader.ts`/`ODL_PYTHON`. O ponto crítico de risco é a função **pura de normalização** `Document[] → LoadedDocument` (D-07..D-10), porque o chunker só consome `doc.sections[]`.

Todos os 4 research flags foram resolvidos. O mais load-bearing — **o markdown emitido contém headings ATX `#`?** (D-07 depende disso) — está **CONFIRMADO** por evidência interna decisiva: tanto o caminho Node (`@opendataloader/pdf` ^2.4.7) quanto o wrapper Python (`opendataloader-pdf>=2.0.0`) são o **mesmo motor 2.x**, e o código existente `odl-parse.ts::elementToMarkdown()` já renderiza headings como `'#'.repeat(level) + ' ' + content` a partir do `heading level` do JSON. O engine inclusive é benchmarkeado por uma métrica "MHS (Markdown Heading-level Similarity)", confirmando preservação de níveis de heading (que só se expressa em markdown via ATX `#`). Os outros flags: a API expõe `OpenDataLoaderPDFLoader(file_path, format="markdown", split_pages=True)` retornando 1 `Document`/página; `Document.metadata` traz `{source, format, page}` com **`page` 1-indexed** (impacto direto em D-10 — ver nota crítica); requer **Java 11+ além de Python ≥3.10** (impacto em D-04/D-13); a saída markdown é texto limpo, serializável a stdout sem binário (`image_output="off"`).

**Primary recommendation:** Clonar a estrutura de `ocr-loader.ts` para `langchain-loader.ts` (spawn + `isLangchainAvailable()` import-check). Pinar `langchain-opendataloader-pdf==2.0.0` em `tools/requirements.txt`. Escrever `tools/odl_langchain_loader.py` que instancia `OpenDataLoaderPDFLoader(file_path=pdf, format="markdown", split_pages=True, quiet=True, image_output="off", table_method="cluster", reading_order="xycut", pages=…, password=…)` e imprime `json.dumps([{"page_content": d.page_content, "metadata": d.metadata} for d in loader.load()])` no stdout. A normalização reusa `cleanMarkdown` e uma variante de `buildSections` que reparseia headings ATX de markdown bruto (a função atual opera sobre `DocElement[]`, não markdown — exige adaptação). **Atenção a D-10:** com `page` 1-indexed, `numPages` deve ser `max(metadata.page)` (NÃO `max+1`).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Extração de texto/markdown do PDF | Python sidecar (`tools/odl_langchain_loader.py`) | — | Onde o pacote `langchain-opendataloader-pdf` roda; isolado por venv (`ANKINATOR_LANGCHAIN_PYTHON`). [VERIFIED: codebase ocr-loader.ts] |
| Seleção de loader (node vs langchain) | Backend Node (`document-loader.ts`) | config.ts (env) | `loadDocument()` é o branch point (D-03); `ANKINATOR_PDF_LOADER` lido em config (D-03 espelha `ANKINATOR_PROVIDER`). |
| Spawn + parse do stdout | Backend Node (`langchain-loader.ts`) | — | Clone do `ocr-loader.ts::run()`; `JSON.parse(stdout)` (D-01). |
| Availability-check / fallback | Backend Node (`langchain-loader.ts`) | document-loader.ts | `isLangchainAvailable()` (import-check, D-04); fallback decidido em `loadDocument`. |
| Normalização `Document[] → LoadedDocument` | Backend Node (módulo puro, p.ex. `langchain-normalize.ts`) | odl-parse.ts (reuso) | Função PURA, sem I/O — testável CLI-free (D-14). Núcleo de PDF-03. |
| Chunking | Backend Node (`chunker.ts`) — **INTOCADO** | — | Consome SÓ `doc.sections[]`; critério de sucesso PDF-03 é não mexer aqui. [VERIFIED: codebase chunker.ts] |
| Tipo `LoadedDocument` | core/types.ts — **INTOCADO** | web/src/types.ts (duplicado) | D-05/D-08/D-10: não estender (Pitfall 4 tipo duplicado). |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `langchain-opendataloader-pdf` | **2.0.0** (pin) | Loader Python que extrai PDF→`Document[]` per-page em markdown | Wrapper LangChain oficial do mesmo motor OpenDataLoader já usado no Node. [VERIFIED: PyPI JSON — pypi.org/pypi/langchain-opendataloader-pdf/json, upload 2026-03-16] |

**Dependências transitivas do pin (não declarar no requirements.txt — vêm automaticamente):**
- `langchain-core>=1.0,<2.0` [VERIFIED: PyPI JSON requires_dist]
- `opendataloader-pdf>=2.0.0` [VERIFIED: PyPI JSON requires_dist] — mesmo motor 2.x do `@opendataloader/pdf` ^2.4.7 do Node.

### Supporting (Node — já no projeto, reuso)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `node:child_process.spawn` | builtin | Spawn do sidecar Python | Clone de `ocr-loader.ts::run()` |
| `node:path` | builtin | `basename(pdf)` p/ D-10 (`fileName`) | Normalização |
| `node:crypto.randomUUID` | builtin | `Section.id` em `buildSections` | Já usado em `odl-parse.ts` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| stdout JSON (D-01) | temp-dir + arquivos (estilo OCR) | LOCKED contra (D-01): `parseOdlOutput` espera árvore ODL `json.kids`, não per-page `Document[]` — temp-dir só reaproveitaria I/O, nunca o parser. stdout é determinístico/fixture-testável. |
| `format="markdown"` (D-12) | `format="json"` (element-level) | `json` daria heading-level explícito mas exigiria reescrever a normalização do zero; markdown já é o formato do pipeline e reusa `cleanMarkdown`. LOCKED D-12. |
| Página-como-seção | reparse de headings ATX (D-07) | LOCKED D-07: page-as-section deixa o chunking grosso (chunker quebra por fronteira de seção). |

**Installation (`tools/requirements.txt` — D-13):**
```
# Sidecar opcional do loader LangChain (Phase 2). NÃO é dependência do Node.
# Requer Python >=3.10,<4.0 E Java 11+ no PATH (motor OpenDataLoader).
# Instale num venv dedicado e aponte ANKINATOR_LANGCHAIN_PYTHON para o interpretador.
langchain-opendataloader-pdf==2.0.0
```

**Version verification (executado nesta sessão via fontes autoritativas — instalação bloqueada por design):**
- `langchain-opendataloader-pdf` latest = **2.0.0**, requires-python `>=3.10,<4.0`, upload 2026-03-16T09:21:18. [VERIFIED: pypi.org/pypi/langchain-opendataloader-pdf/json]
- Versões publicadas: 0.0.1, 0.0.2, 0.1.0, 1.0.0, 1.0.1, 1.1.0, 1.1.1, 1.2.0, **2.0.0**. [VERIFIED: PyPI JSON releases]

## Package Legitimacy Audit

> Instalação/execução de pacotes bloqueada por diretiva do ambiente. Verificação feita **somente** por leitura de fontes públicas autoritativas (PyPI, GitHub `opendataloader-project`). slopcheck indisponível → graceful degradation aplicado.

| Package | Registry | Age | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-------------|-----------|-------------|
| `langchain-opendataloader-pdf` | PyPI | 9 releases; latest 2026-03-16; primeira 0.0.1 anterior | github.com/opendataloader-project/langchain-opendataloader-pdf [VERIFIED: WebSearch + GitHub org match] | n/a (não rodado — bloqueado) | **Approved — gate humano antes do install** |

- **Org match confirmado:** o repo do wrapper (`opendataloader-project/langchain-opendataloader-pdf`) e o do motor (`opendataloader-project/opendataloader-pdf`) pertencem à **mesma org** que já publica o `@opendataloader/pdf` npm em uso no projeto. Não há sinal de slopsquatting.
- **Ecossistema correto:** verificado no PyPI (não npm) — o nome existe e resolve no registry Python correto. [VERIFIED: PyPI JSON]
- **Pacotes removidos [SLOP]:** nenhum.
- **Pacotes [SUS]:** nenhum.

*slopcheck não pôde rodar (instalação bloqueada). Mesmo com forte evidência de legitimidade (org oficial, mesmo motor já em produção), o planner DEVE inserir um `checkpoint:human-verify` antes do `pip install` num venv — coerente com D-13/D-04 (sidecar opcional, degradação graciosa).*

## Architecture Patterns

### System Architecture Diagram

```
                          POST /api/extract { docId, ocr?, pages?, password? }
                                            │
                                            ▼
                              loadDocument(pdfPath, opts)        ← document-loader.ts (branch point D-03)
                                            │
              ┌─────────────────────────────┼──────────────────────────────────┐
              │ opts.ocr === true            │ ANKINATOR_PDF_LOADER === 'langchain'  │ default (env unset/'node')
              ▼ (D-06: OCR vence)            ▼                                    ▼
        runOcrLoader (Python)        isLangchainAvailable()?               convert([pdf]) (@opendataloader/pdf Java)
        --force-ocr → tmpdir          │ não → log (fallback→node) ─────────────►│   (D-15: caminho BYTE-IDÊNTICO,
        parseOdlOutput               │ sim ▼                                    │    intocado, SEM Python)
              │                       spawn(ANKINATOR_LANGCHAIN_PYTHON           │
              │                         || ODL_PYTHON,                           │ parseOdlOutput(tmpdir) → LoadedDocument
              │                         odl_langchain_loader.py <pdf> …)         │
              │                       │ stdout: JSON [{page_content, metadata}]  │
              │                       │ erro runtime → PROPAGA (D-04)            │
              │                       ▼                                          │
              │                    JSON.parse(stdout)                            │
              │                       ▼                                          │
              │            normalize(Document[]) → LoadedDocument  ← módulo PURO (D-07..D-10, núcleo testável)
              │                       │  reusa cleanMarkdown + buildSections-adaptado                          │
              └───────────────────────┴──────────────────────────────────────────┘
                                            ▼
                              LoadedDocument { fileName, numPages, title, markdown, sections[], elements[], usedOcr }
                                            ▼
                              chunkDocument(doc)  ← chunker.ts INTOCADO; consome SÓ doc.sections[] (PDF-03)
                                            ▼
                              SemanticChunk[] → QuestionGenerator
```

### Recommended Project Structure
```
tools/
├── odl_langchain_loader.py   # NOVO — sidecar Python (PDF-01; D-11/D-12)
└── requirements.txt          # NOVO — pin langchain-opendataloader-pdf==2.0.0 (D-13)

ankinator-app/server/src/
├── core/
│   ├── document-loader.ts        # EDITAR — branch D-03 + guard D-15 (default intocado)
│   ├── langchain-loader.ts       # NOVO — spawn + isLangchainAvailable() (clone de ocr-loader.ts; PDF-02)
│   ├── langchain-normalize.ts    # NOVO (nome à discrição) — normalize() PURO (D-07..D-10; núcleo PDF-03)
│   ├── ocr-loader.ts             # MOLDE (não editar) — referência de spawn/run/isOcrAvailable
│   └── odl-parse.ts              # REUSO — cleanMarkdown (D-09) + buildSections adaptado (D-07)
├── config.ts                     # EDITAR — + ANKINATOR_PDF_LOADER (D-03), + ANKINATOR_LANGCHAIN_PYTHON doc (D-02)
└── scripts/
    ├── smoke-langchain-loader.ts # NOVO — smoke opt-in gated (clone de smoke-loader.ts; D-14)
    └── <fixture/assert>          # NOVO — unit puro CLI-free da normalização (D-14)
```

### Pattern 1: Sidecar spawn + availability-check (clone de `ocr-loader.ts`)
**What:** Spawn de processo Python; `import`-check para disponibilidade; degradação graciosa.
**When to use:** PDF-02 — invocar `langchain-loader.ts`.
**Example:**
```typescript
// Source: codebase ankinator-app/server/src/core/ocr-loader.ts (molde D-02/D-04)
function pythonBin(): string | null {
  // D-02: var dedicada com fallback p/ ODL_PYTHON
  return process.env.ANKINATOR_LANGCHAIN_PYTHON?.trim()
      || process.env.ODL_PYTHON?.trim()
      || null;
}

export async function isLangchainAvailable(): Promise<boolean> {
  const py = pythonBin();
  if (!py) return false;
  // D-04 (discricionário qual módulo): import do pacote do wrapper
  const { code } = await run(py, ['-c', 'import langchain_opendataloader_pdf']);
  return code === 0;
}
// run() é idêntico ao de ocr-loader.ts (spawn, captura stdout/stderr, resolve {code,stdout,stderr})
```

### Pattern 2: Branch em `loadDocument` com guard de default (D-03 + D-15)
**What:** Selecionar loader por env, com fallback silencioso e default byte-idêntico.
**When to use:** PDF-02 + não-regressão.
**Example:**
```typescript
// Source: codebase ankinator-app/server/src/core/document-loader.ts (a estender — D-03/D-06/D-15)
export async function loadDocument(pdfPath: string, opts: LoadOptions = {}): Promise<LoadedDocument> {
  // D-06: OCR (mais específico) vence — caminho atual, intocado
  if (opts.ocr) { /* …isOcrAvailable() + runOcrLoader… (intocado) */ }

  // D-03: novo branch ANTES do default. Default (env unset) NÃO entra aqui (D-15).
  if ((process.env.ANKINATOR_PDF_LOADER?.trim().toLowerCase()) === 'langchain') {
    if (await isLangchainAvailable()) {
      console.error('[ankinator] loader: langchain'); // D-05 (stderr = padrão de log do projeto)
      return runLangchainLoader(pdfPath, opts);
    }
    console.error('[ankinator] loader: langchain indisponível (fallback→node)'); // D-04/D-05
    // cai para o default abaixo
  }

  // D-15: caminho @opendataloader/pdf de HOJE, byte-idêntico (provado por guard CLI-free)
  // … convert([pdfPath], options) + parseOdlOutput … (NÃO alterar)
}
```

### Pattern 3: Normalização pura `Document[] → LoadedDocument` (núcleo PDF-03)
**What:** Função sem I/O que reconstrói `sections`/`elements`/`markdown`/campos-topo.
**When to use:** D-07..D-10. É o alvo do unit puro de D-14.
**Example:** ver §Code Examples (a função completa).

### Anti-Patterns to Avoid
- **`numPages = max(page)+1`:** ERRADO para este pacote — `page` é **1-indexed** (ver §Research Flags / §Pitfalls). Use `max(page)`. Esta é a correção mais importante a D-10.
- **Temp-dir reaproveitando `parseOdlOutput`:** `parseOdlOutput` espera a **árvore ODL** (`json.kids`), não `Document[]` per-page. Não reusar (LOCKED D-01).
- **Estender `LoadedDocument` com campo `loader`:** tipo duplicado server/web (Pitfall 4 da Phase 1) — usar só log (D-05).
- **Mascarar erro de runtime com fallback:** D-04 manda **propagar** erro de runtime (PDF corrompido/bug); fallback é SÓ por indisponibilidade de pacote.
- **Editar `chunker.ts` ou `types.ts`:** critério de sucesso PDF-03 + D-05/D-08/D-10 — ambos INTOCADOS.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Limpeza de markdown bruto (linhas de tabela vazias, 3+ blank lines) | Regex novo | `cleanMarkdown` de `odl-parse.ts` (D-09) | Já trata os artefatos exatos deste motor (`/^\|[\s|:-]*\|$/`). |
| Agrupar conteúdo em seções por heading | Parser de seção do zero | Adaptar `buildSections` de `odl-parse.ts` (D-07) | Lógica de flush/pageStart/pageEnd/filtro de seção vazia já existe e o chunker já a consome. **Caveat:** a atual opera sobre `DocElement[]` (campo `headingLevel`), não sobre markdown bruto — exige uma passada que detecte ATX `#` em texto (regex `^(#{1,6})\s+(.+)$`) e produza os mesmos `DocElement`/`Section`. |
| Spawn + captura de stdout/stderr | `exec`/promisify manual | Função `run()` de `ocr-loader.ts` | Já resolve `{code,stdout,stderr}` e trata `child.on('error')`. |
| Detecção de disponibilidade de runtime Python | Checar PATH/version na unha | `isOcrAvailable()` pattern (`py -c 'import …'`) | Precedente direto; cobre o caso de venv. |
| Extração PDF→markdown | Qualquer parser próprio | `OpenDataLoaderPDFLoader(format="markdown")` | É o ponto inteiro da fase. |

**Key insight:** Quase toda a normalização é **reuso/adaptação** de `odl-parse.ts`. O único código genuinamente novo é (a) o reparse de headings ATX a partir de markdown bruto (a `buildSections` atual parte de `DocElement[]` já com `headingLevel`, não de markdown), e (b) o sidecar Python. Manter a superfície mínima é a preferência forte do usuário (princípios Karpathy citados no CONTEXT).

## Common Pitfalls

### Pitfall 1: `page` 1-indexed quebra D-10 (`numPages`)
**What goes wrong:** D-10 diz `numPages = max(metadata.page)+1`, assumindo 0-index. O pacote emite `page` **1-indexed**.
**Why it happens:** Vários loaders LangChain (PyPDFLoader) usam 0-index; este NÃO.
**How to avoid:** Usar `numPages = max(metadata.page)` (sem `+1`). Validar na fixture de D-14 com um `Document[]` cujo último `page` seja conhecido (ex.: 3 páginas → `page` 1,2,3 → `numPages=3`).
**Warning signs:** `numPages` 1 a mais que o real; última "página fantasma" vazia.
[VERIFIED: docs.langchain.com + PyPI metadata example `{'source':…, 'format':…, 'page': 1}`]

### Pitfall 2: Java ausente faz o sidecar falhar em RUNTIME, não em availability-check
**What goes wrong:** `isLangchainAvailable()` checa só `import langchain_opendataloader_pdf` (Python). Mas o motor exige **Java 11+ no PATH**. Se Python+pacote existem mas Java não, o `import` passa e o `.load()` quebra em runtime.
**Why it happens:** O wrapper Python é uma casca sobre o CLI Java (mesma arquitetura do `@opendataloader/pdf` npm, que já documenta "Requer Java 11+").
**How to avoid:** Conforme D-04, erro de **runtime** PROPAGA (não fallback). Documentar Java 11+ no `tools/requirements.txt` (comentário) e no README/INTEGRATIONS (D-13). O smoke de D-14 (gated) exercita o caminho real e revela a ausência de Java. NÃO tentar detectar Java no availability-check (escopo mínimo; runtime error já é claro).
**Warning signs:** stderr do sidecar com `java`/`ClassNotFound`/`Exception in thread "main"`.
[VERIFIED: docs.langchain.com "Java 11+ available on system PATH" + codebase document-loader.ts "Requer Java 11+ no PATH"]

### Pitfall 3: D-15 — o branch novo desvia o default
**What goes wrong:** Inserir o branch de D-03 acima/dentro de `loadDocument` pode acidentalmente alterar o caminho default (env unset).
**Why it happens:** É a regressão mais perigosa da fase (o fluxo de produção roda SEM Python).
**How to avoid:** Guard determinístico CLI-free (D-15), espelhando o `smoke-runner --assert-args` da Phase 1: provar que com `ANKINATOR_PDF_LOADER` unset, o plano de `convert()` (`ConvertOptions` + ordem) é byte-idêntico ao de hoje, SEM spawnar Java/Python. O branch deve ser puramente aditivo (early-return só quando `=== 'langchain'`).
**Warning signs:** Guard falha; `convert` recebe options diferentes; o default tenta `isLangchainAvailable()`.
[VERIFIED: codebase smoke-runner.ts pattern + CONTEXT D-15]

### Pitfall 4: `title` derivado quando markdown não começa por heading
**What goes wrong:** D-10 `title = primeiro heading | null`. Se a primeira página não tiver `#`, `title` deve ser `null` (não a primeira linha de texto).
**Why it happens:** Apostilas às vezes abrem com capa/sumário sem heading ATX.
**How to avoid:** Extrair só de linha que casa `^#{1,6}\s+`; senão `null`. `fallbackTitle` para `buildSections` = `basename(pdf)` (como `odl-parse.ts` faz com `base`).
**Warning signs:** `title` virou um parágrafo inteiro.

### Pitfall 5: Serialização de markdown com caracteres de controle
**What goes wrong:** `json.dumps` default escapa não-ASCII como `\uXXXX`; o Node `JSON.parse` reverte — OK. Mas se `image_output != "off"`, viriam refs binárias/base64 inflando o stdout.
**Why it happens:** Apostilas têm imagens.
**How to avoid:** Fixar `image_output="off"` no sidecar (D-09 já diz "cards de texto"; espelha o default do Node loader). `json.dumps(..., ensure_ascii=False)` opcional para stdout menor, mas o default também funciona.
[VERIFIED: docs.langchain.com `image_output="off"` é default + codebase document-loader.ts `imageOutput: 'off'`]

## Code Examples

### Sidecar Python `tools/odl_langchain_loader.py` (PDF-01; D-11/D-12/D-01)
```python
# Source: API confirmada em docs.langchain.com/oss/python/integrations/document_loaders/opendataloader_pdf
#         + README github.com/opendataloader-project/langchain-opendataloader-pdf
# Sidecar: extrai PDF em Documents/página (markdown) e imprime JSON no stdout (D-01).
# Comentários em PT-BR (CLAUDE.md). NÃO usa API key — só processamento local.
import argparse, json, sys
from langchain_opendataloader_pdf import OpenDataLoaderPDFLoader

def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("pdf")                       # D-11: espelha LoadOptions
    ap.add_argument("--pages", default=None)     # ex.: "1,3,5-7"
    ap.add_argument("--password", default=None)
    args = ap.parse_args()

    # D-12: modo markdown por página (preserva headings/tabelas → essencial p/ D-07).
    # Espelha a config do loader Node: cluster/xycut/imagem off.
    loader = OpenDataLoaderPDFLoader(
        file_path=args.pdf,
        format="markdown",
        split_pages=True,         # 1 Document por página (default, explícito)
        quiet=True,
        image_output="off",       # cards de texto (D-09)
        table_method="cluster",   # tabelas de provas
        reading_order="xycut",    # layouts multi-coluna
        pages=args.pages,         # None → todas
        password=args.password,
    )
    docs = loader.load()
    # D-01: array JSON [{page_content, metadata}] no stdout; Node faz JSON.parse.
    out = [{"page_content": d.page_content, "metadata": d.metadata} for d in docs]
    json.dump(out, sys.stdout, ensure_ascii=False)
    return 0

if __name__ == "__main__":
    sys.exit(main())
```
> Nota de paridade com o motor Node: os parâmetros `table_method`/`reading_order`/`image_output`/`quiet` existem no construtor do wrapper Python (confirmados nas docs LangChain) e refletem os `ConvertOptions` já usados em `document-loader.ts`. `include_header_footer` default `False` ⇒ cabeçalho/rodapé filtrados (igual ao Node). Verificar os nomes exatos no ambiente alvo durante o smoke de D-14 antes de fixar (alguns parâmetros podem ter default suficiente). [CITED: docs.langchain.com — lista de parâmetros] [ASSUMED: que table_method aceita "cluster" idêntico ao Node — confirmar no smoke]

### Normalização pura `normalize(Document[]) → LoadedDocument` (PDF-03; D-07..D-10)
```typescript
// Source: derivado de codebase odl-parse.ts (cleanMarkdown + buildSections) + types.ts.
// PURO (sem I/O) → alvo do unit CLI-free de D-14.
import crypto from 'node:crypto';
import path from 'node:path';
import type { LoadedDocument, Section, DocElement } from './types.js';

interface RawDoc { page_content: string; metadata: { source?: string; format?: string; page?: number } }

// reparse de headings ATX a partir de markdown bruto (a buildSections atual parte de DocElement[];
// aqui derivamos os DocElement de heading/parágrafo a partir do texto markdown — adaptação de D-07).
const ATX = /^(#{1,6})\s+(.+?)\s*#*$/;

export function normalize(docs: RawDoc[], pdfPath: string): LoadedDocument {
  // D-08: 1 'text block' por página (mínimo; chunker ignora elements)
  const elements: DocElement[] = docs.map((d) => ({
    type: 'text block',
    page: d.metadata.page ?? 1,   // page é 1-indexed (ver §Research Flags)
    content: d.page_content,
  }));

  // D-09: markdown completo = join + cleanMarkdown (reuso), SEM marcadores de página
  const rawMarkdown = docs.map((d) => d.page_content).join('\n\n');
  const markdown = cleanMarkdown(rawMarkdown); // importar/reexportar de odl-parse.ts

  // D-07: sections reparseando headings ATX, com page tracking por Document
  const sections = buildSectionsFromMarkdown(docs, path.basename(pdfPath));

  // D-10: campos-topo derivados. ATENÇÃO: page 1-indexed ⇒ numPages = max(page) (SEM +1).
  const pages = docs.map((d) => d.metadata.page ?? 1);
  const numPages = pages.length ? Math.max(...pages) : 1;
  const firstHeading = rawMarkdown.split('\n').map((l) => l.match(ATX)?.[2]).find(Boolean) ?? null;

  return {
    fileName: path.basename(pdfPath),
    numPages,
    title: firstHeading,           // null se nenhum heading (Pitfall 4)
    markdown,
    sections,
    elements,
    usedOcr: false,
  };
}
// buildSectionsFromMarkdown: percorre cada Document (sabe a página), quebra por linha,
// emite Section a cada ATX match (flush/pageStart/pageEnd como buildSections), reusa o
// filtro de seção vazia. cleanMarkdown e o esqueleto de flush vêm de odl-parse.ts.
```
> `cleanMarkdown` e a lógica de `buildSections` estão hoje **não-exportadas** em `odl-parse.ts` (funções de módulo). A discrição do CONTEXT permite extrair um helper reutilizável OU adaptar — recomendo **exportar `cleanMarkdown`** (idempotente, sem estado) e escrever `buildSectionsFromMarkdown` novo (a entrada é markdown, não `DocElement[]`), mantendo o filtro de seção vazia idêntico. [VERIFIED: codebase odl-parse.ts linhas 76-139]

### Uso da API do loader (referência — confirmação da assinatura)
```python
# Source: docs.langchain.com/oss/python/integrations/document_loaders/opendataloader_pdf
from langchain_opendataloader_pdf import OpenDataLoaderPDFLoader
loader = OpenDataLoaderPDFLoader(file_path="document.pdf", format="markdown")  # split_pages=True default
documents = loader.load()   # → 1 Document por página
# documents[0].metadata == {'source': 'document.pdf', 'format': 'markdown', 'page': 1}  (page 1-indexed)
```
[VERIFIED: docs.langchain.com + PyPI README]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `pdf-parse` texto plano (MCP legacy) | OpenDataLoader markdown estruturado | já adotado no app | Esta fase só adiciona um 2º caminho do MESMO motor (Python) |
| — | `langchain-opendataloader-pdf` 1.x→2.0.0 | 2.0.0 em 2026-03-16 | Pinar 2.0.0; alinha `opendataloader-pdf>=2.0.0` com o motor 2.x do Node |

**Deprecated/outdated:** nenhum relevante à fase. Não usar `pdf-parse` (legacy MCP) como referência.

## Runtime State Inventory

> Fase mista (refactor leve em `loadDocument` + novos artefatos). Inventário focado no que pode quebrar fora do código.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Nenhum — `store.ts` é in-memory (Maps `docs`/`jobs`), reseta no restart. Sem DB. [VERIFIED: INTEGRATIONS.md §Data Storage] | nenhuma |
| Live service config | Nenhum — sem serviços externos com estado (AnkiConnect é HTTP local stateless). | nenhuma |
| OS-registered state | Nenhum — sem Task Scheduler/systemd/pm2. App roda via `npm run dev`/`start`. | nenhuma |
| Secrets/env vars | **NOVAS** env vars: `ANKINATOR_PDF_LOADER` (D-03), `ANKINATOR_LANGCHAIN_PYTHON` (D-02, fallback `ODL_PYTHON`). Lidas em `config.ts`/`langchain-loader.ts`. `.env` é gitignored. | documentar em INTEGRATIONS §Env (D-13); adicionar a `config.ts` |
| Build artifacts | `tsc` compila `src→dist`; novos arquivos `.ts` precisam estar em `src/**`. **Caveat herdado da Phase 1 (A1):** `.py`/fixtures NÃO são copiados pelo tsc — o sidecar `.py` é lido por path em runtime (não importado), então fica em `tools/` fora de `src`. Confirmar resolução de path do `.py` cross-mode (tsx src / node dist). | resolver path do `.py` via `import.meta.url` ou path absoluto do repo; cobrir no smoke |

**Nada encontrado em Stored data / Live service config / OS-registered state:** confirmado por INTEGRATIONS.md (sem DB, sem serviços com estado, sem registro de OS).

## Common Pitfalls (resumo de gating)

Os 5 pitfalls acima gatilham verificações concretas: Pitfall 1 → asserção na fixture (`numPages` exato); Pitfall 2 → smoke gated revela Java ausente; Pitfall 3 → guard CLI-free de D-15; Pitfall 4 → asserção `title=null` sem heading; Pitfall 5 → `image_output="off"` fixo no sidecar.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Os parâmetros do construtor `table_method="cluster"`, `reading_order="xycut"`, `image_output="off"` têm os mesmos nomes/valores do `ConvertOptions` Node | Code Examples (sidecar) | BAIXO — se um nome divergir, o sidecar lança no smoke de D-14; defaults do pacote já produzem markdown utilizável. Confirmar no smoke antes de fixar todos. [CITED: docs.langchain.com lista parâmetros, mas sem doc de cada valor] |
| A2 | `format="markdown"` emite headings em sintaxe ATX `#` (não setext/HTML) | D-07 dependency | MÉDIO se errado — mas FORTEMENTE mitigado: mesmo motor 2.x do Node, cujo `odl-parse.ts::elementToMarkdown` já gera `'#'.repeat(level)`; engine benchmarkeado por "MHS (Markdown Heading-level Similarity)". Se o smoke revelar não-ATX, D-07 degrada a page-as-section + heurística (plano B já previsto no CONTEXT). |
| A3 | `json.dumps` do `Document[]` markdown serializa sem binário/controle problemático | D-01 | BAIXO — `image_output="off"` garante texto; `page_content` é str. |

**Nota:** Nenhum desses assumptions bloqueia o planejamento. A1/A3 são validados pelo smoke gated (D-14). A2 é o único load-bearing e está praticamente confirmado por evidência interna — o plano B já está documentado no CONTEXT caso o smoke refute.

## Open Questions

1. **Nomes exatos dos parâmetros markdown-tuning do construtor Python**
   - What we know: `format`, `split_pages`, `quiet`, `pages`, `password`, `image_output`, `table_method`, `reading_order` aparecem nas docs LangChain.
   - What's unclear: se `table_method` aceita literalmente `"cluster"` (Node usa `'cluster'`) e se todos têm o mesmo efeito.
   - Recommendation: começar com defaults + `format="markdown"`; refinar via smoke de D-14 com PDF real. Não bloquear o plano.

2. **Sample de markdown ATX real do pacote 2.0.0**
   - What we know: engine preserva heading hierarchy (métrica MHS); `odl-parse.ts` Node já trata `#` deste motor.
   - What's unclear: confirmação byte-a-byte do output 2.0.0 (não há `.md` de exemplo público acessível).
   - Recommendation: o smoke gated de D-14 com PDF real é a confirmação definitiva; plano B (page-as-section) já previsto.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Python ≥3.10,<4.0 | sidecar `odl_langchain_loader.py` | ✗ (não verificado — instalação bloqueada nesta sessão) | — | D-04: fallback automático p/ loader Node |
| `langchain-opendataloader-pdf==2.0.0` (+ `langchain-core>=1.0`, `opendataloader-pdf>=2.0.0`) | sidecar | ✗ (a instalar em venv pelo usuário) | 2.0.0 | D-04: fallback p/ Node |
| Java 11+ no PATH | motor OpenDataLoader (sob o sidecar) | ✗ (não verificado) | — | erro de runtime PROPAGA (D-04); NÃO fallback |
| Node 24 / tsc 5.9 | branch Node + normalização | ✓ (em uso no projeto) | 24 / 5.9.3 | — |
| Java 11+ (caminho Node default) | `@opendataloader/pdf` ^2.4.7 | (assumido presente — Phase 1 rodou loader 2× com PDFs reais) | — | — |

**Missing dependencies with no fallback:** Java 11+ para o caminho LangChain — sua ausência é um erro de runtime intencionalmente propagado (D-04), não bloqueia o default Node.

**Missing dependencies with fallback:** Python/pacote ausentes → loader Node (D-04). O guard D-15 garante que o default roda SEM nenhuma dessas deps.

*Observação: a instalação/execução de pacotes está bloqueada por diretiva do ambiente desta sessão — a disponibilidade real será verificada pelo executor/usuário num venv antes do smoke de D-14 (coerente com o `checkpoint:human-verify` recomendado no §Package Legitimacy Audit).*

## Validation Architecture

> `.planning/config.json` ausente ⇒ `nyquist_validation` tratado como **habilitado**. Baseline do projeto: SEM test runner (TESTING.md) — a disciplina é "asserção determinística CLI-free" + smoke gated (Phase 1).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Nenhum runner instalado (jest/vitest ausentes — TESTING.md). Padrão do projeto: script `tsx`/`node` que faz `process.exit(1)` em falha (ver `smoke-runner.ts --assert-args`). |
| Config file | none — scripts standalone em `server/src/scripts/` |
| Quick run command | `cd ankinator-app/server && tsx src/scripts/<assert-normalize>.ts` (CLI-free, sem Python — D-14 unit puro) |
| Full suite command | quick + `tsx src/scripts/smoke-langchain-loader.ts <pdf>` (gated em disponibilidade — D-14 smoke) + guard D-15 |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PDF-03 | `normalize(fixture Document[]) → LoadedDocument` correto (sections via ATX, numPages=max(page), title=1º heading\|null, 1 'text block'/página) | unit puro (CLI-free, SEM Python) | `tsx src/scripts/<assert-normalize>.ts` (fixture inline, `process.exit(1)` em mismatch) | ❌ Wave 0 (D-14) |
| PDF-01 | Sidecar extrai PDF→`Document[]` markdown e imprime JSON parseável | smoke gated (exige Python+pacote+Java) | `tsx src/scripts/smoke-langchain-loader.ts <pdf>` (pula se `isLangchainAvailable()` false) | ❌ Wave 0 (D-14) |
| PDF-02 | Branch por env + fallback automático + log | smoke gated + asserção do branch | coberto pelo smoke (langchain set) e pela ausência (fallback→node) | ❌ Wave 0 |
| PDF-03 (não-regressão) | default (env unset) usa `@opendataloader/pdf` byte-idêntico, SEM Python | guard determinístico CLI-free (D-15) | `tsx src/scripts/<guard-default>.ts --assert` (sem spawnar Java/Python; prova ConvertOptions intocado) | ❌ Wave 0 (D-15) |

### Sampling Rate
- **Per task commit:** unit puro da normalização (`<assert-normalize>`) — CLI-free, < 1s, roda sempre.
- **Per wave merge:** unit + guard D-15 (ambos CLI-free); smoke gated quando o ambiente tiver Python/Java.
- **Phase gate:** unit + guard verdes obrigatórios (CLI-free, determinísticos); smoke gated executado com PDF real antes de `/gsd:verify-work` (confirma A1/A2/A3 e fecha as Open Questions).

### Wave 0 Gaps
- [ ] `ankinator-app/server/src/scripts/<assert-normalize>.ts` — unit puro de D-14 (fixture `Document[]` → `LoadedDocument`; cobre PDF-03 + Pitfall 1 `numPages` + Pitfall 4 `title`).
- [ ] `ankinator-app/server/src/scripts/smoke-langchain-loader.ts` — smoke gated de D-14 (clone de `smoke-loader.ts`; cobre PDF-01/PDF-02).
- [ ] `ankinator-app/server/src/scripts/<guard-default>.ts` (ou flag `--assert` num smoke existente) — guard CLI-free de D-15 (não-regressão do default; espelha `smoke-runner --assert-args`).
- [ ] Fixture `Document[]` representativa (≥2 páginas, ≥1 heading ATX, ≥1 página sem heading) embutida no unit ou em `scripts/fixtures/`.

*(Sem framework a instalar — o padrão do projeto é script `tsx` com `process.exit(1)`; coerente com TESTING.md e com a disciplina CLI-free da Phase 1.)*

## Project Constraints (from CLAUDE.md)

- **Idioma:** comentários e commits em **PT-BR** (aplicado nos exemplos acima).
- **Assinatura, não API:** preferir o plano Claude; esta fase é determinística (NÃO faz chamadas LLM) — sem risco de puxar API key.
- **sequential-thinking MCP:** usar o MCP sequential-thinking durante o trabalho.
- **MCP sem ANTHROPIC_API_KEY:** MCPs como sequential-thinking/memory rodam via `npx -y` sem key — não introduzir dependência de key.
- **Não regredir o fluxo atual (PIPE-03 + D-15):** o caminho Node/OCR roda SEM Python — constraint dura; o guard de D-15 a protege.

## Sources

### Primary (HIGH confidence)
- **Codebase (ground-truth):** `ocr-loader.ts` (molde spawn/availability), `odl-parse.ts` (`cleanMarkdown`/`buildSections`/`elementToMarkdown` — prova ATX `#`), `document-loader.ts` (branch point + Java 11+ doc), `chunker.ts` (consome só `sections[]`), `types.ts`, `config.ts`, `smoke-runner.ts` (`--assert-args` pattern), `smoke-loader.ts`, INTEGRATIONS.md, TESTING.md.
- **PyPI JSON API** — `https://pypi.org/pypi/langchain-opendataloader-pdf/json`: version 2.0.0, requires-python `>=3.10,<4.0`, requires_dist `langchain-core<2.0,>=1.0` + `opendataloader-pdf>=2.0.0`, upload 2026-03-16, 9 releases.
- **docs.langchain.com** — `/oss/python/integrations/document_loaders/opendataloader_pdf`: classe `OpenDataLoaderPDFLoader`, parâmetros (`format`, `split_pages`, `pages`, `password`, `image_output`, `table_method`, `reading_order`, `quiet`), `Document.metadata = {source, format, page}` page **1-indexed**, Java 11+ / Python ≥3.10.
- **GitHub `opendataloader-project`** — repos `langchain-opendataloader-pdf` e `opendataloader-pdf` (mesma org do `@opendataloader/pdf` npm; JSON `"type":"heading","heading level":1`).

### Secondary (MEDIUM confidence)
- WebSearch (cross-verificado com docs LangChain) — confirmação de classe/markdown/RAG-orientation; métrica "MHS (Markdown Heading-level Similarity)" do engine.
- opendataloader.org / docs — descrição "structured Markdown preserves heading hierarchy".

### Tertiary (LOW confidence)
- Sample de markdown ATX literal do 2.0.0 — não localizado em fonte pública acessível (PyPI 2.0.0 page e examples-repo .md não retornaram conteúdo). Mitigado por evidência interna do codebase + smoke gated de D-14.

## Metadata

**Confidence breakdown:**
- Standard stack: **HIGH** — version/deps/requires-python verificados na PyPI JSON API.
- API surface (classe, params, metadata, page-index): **HIGH** — docs LangChain oficiais, dois fetches concordantes.
- Markdown ATX `#` (D-07 load-bearing): **HIGH** — mesmo motor 2.x do Node; `odl-parse.ts` já prova a sintaxe; engine benchmarkeado por MHS. (Sample literal do 2.0.0 não obtido → smoke de D-14 confirma; plano B previsto.)
- Java requirement (D-04/D-13): **HIGH** — docs LangChain + paridade com o loader Node.
- Architecture/normalização: **HIGH** — derivada do codebase existente.
- Pitfalls: **HIGH** — page-index e Java vêm de fontes oficiais; guard/regressão do codebase.

**Research date:** 2026-06-03
**Valid until:** 2026-07-03 (pacote estável; revalidar pin se `opendataloader-pdf` saltar major)

---

### Research Flags — verdicts (1 linha cada)
1. **API / markdown-per-page / ATX `#` headings:** **CONFIRMED** — `OpenDataLoaderPDFLoader(file_path, format="markdown", split_pages=True)` → 1 `Document`/página; ATX `#` confirmado pelo mesmo motor 2.x (codebase `odl-parse.ts::elementToMarkdown` + métrica MHS do engine). [docs.langchain.com + codebase + PyPI]
2. **`Document.metadata` (page 0/1-index, source):** **CONFIRMED** — `{source, format, page}`, **`page` é 1-indexed** → D-10 deve usar `numPages = max(page)` (SEM `+1`). [docs.langchain.com + PyPI metadata example]
3. **Java necessário além de Python:** **CONFIRMED** — Java 11+ no PATH exigido (motor sob o wrapper); availability-check só de `import` Python ⇒ Java ausente vira erro de runtime (propaga, D-04). [docs.langchain.com + paridade Node]
4. **Serialização limpa a stdout:** **CONFIRMED** — `Document[]` markdown serializa como `[{page_content:str, metadata:{...}}]` via `json.dumps`; `image_output="off"` evita binário. [docs.langchain.com defaults + D-01]

---

## Verificação Adversarial (pós-pesquisa — 5 agentes independentes, lente "refutar")

> Cada uma das 5 afirmações load-bearing foi submetida a um verificador **adversarial** independente (tarefa: *refutar*), checando fonte-de-verdade (código Java do motor `opendataloader-pdf`, fonte do wrapper Python, snapshots de regressão, PyPI JSON). **Resultado: 5/5 CONFIRMED** — evidência direta, não-inferida. Eleva a confiança de D-07 de "HIGH (inferida pelo motor compartilhado)" para **CONFIRMED (fonte do motor + snapshot de regressão do wrapper)**.

| # | Afirmação (decisão) | Veredito | Evidência decisiva | Fonte |
|---|---------------------|----------|--------------------|-------|
| C1 | markdown emite ATX `#` headings (D-07, núcleo) | **CONFIRMED** | `MarkdownSyntax.java: HEADING_LEVEL="#"`; `MarkdownGenerator.writeHeading()` escreve `#`×level+espaço; snapshot `tests/snapshots/lorem_markdown.md` linha 1 = `# Lorem Ipsum` (vs `lorem_text.txt` = `Lorem Ipsum` sem `#`) | engine v2.0.0 source + wrapper test_regression.py |
| C2 | `metadata.page` 1-indexed → `numPages=max(page)` (D-10) | **CONFIRMED** | `page_num=int(parts[i])` do token `<<<ODL_PAGE_BREAK_%n%>>>` (sem `+1`, sem `enumerate`); testes asseram `docs[0].metadata["page"]==1` | wrapper document_loaders.py + test_document_loaders.py |
| C3 | exige Java 11+ no PATH além de Python ≥3.10 (D-04/D-13) | **CONFIRMED** | PyPI desc: "Java 11+ available on system PATH"; engine = "Python wrapper for the opendataloader-pdf **Java CLI**"; cada `convert()` spawna JVM | PyPI JSON (ambos pacotes) + docs LangChain |
| C4 | pin `==2.0.0`, deps `langchain-core<2.0,>=1.0`+`opendataloader-pdf>=2.0.0`, py `>=3.10,<4.0` (D-13) | **CONFIRMED** | PyPI JSON `info.version=2.0.0`, `requires_dist`/`requires_python` batem exatamente; 2.0.0 é o release mais alto e não-yanked | PyPI JSON API |
| C5 | `OpenDataLoaderPDFLoader(format="markdown", split_pages=True)` → 1 Document/página, `{page_content:str, metadata:dict}` (D-01/D-11/D-12) | **CONFIRMED** | README/docs: `split_pages` default True, `format` aceita "markdown"; metadata = dict plano JSON-serializável | docs LangChain + README raw |

### Refinamentos para o PLANEJAMENTO (além do corpo da pesquisa)

- **R1 — páginas não-contíguas (refina D-08/D-10):** o motor **pula páginas vazias** e os números de página são **pass-through** da fonte. Um PDF de 3 páginas com a página 2 vazia gera Documents com `page=1` e `page=3` (sem Document para a página 2). Consequências para `normalize()`:
  - NÃO assumir que existe um Document para cada página `1..N`; iterar sobre os Documents emitidos, não sobre um range.
  - `numPages = max(metadata.page)` está correto, com a ressalva documentada: **subconta** se a(s) última(s) página(s) do PDF forem vazias (raro em apostilas). Aceitável para esta fase; registrar como nota.
  - `elements[]` (D-08, 1 `'text block'`/página) = 1 por **Document emitido** (não por página física) — coerente, pois só há conteúdo onde há Document.
- **R2 — availability-check não detecta Java ausente (refina D-04):** o teste de disponibilidade por `import` do pacote Python passa mesmo **sem Java** no PATH. Java ausente vira **erro de runtime** ao chamar `convert()` → **propaga** (exatamente a postura de D-04: indisponibilidade do *pacote* → fallback silencioso; erro de *runtime* → propaga). Implicação para D-13: a doc de instalação DEVE exigir explicitamente **Java 11+ (Adoptium)** além do `pip install`, senão o opt-in falha em runtime de forma confusa.

*Verificação adversarial: 2026-06-03. Todas as fontes são públicas e citadas no relatório dos 5 agentes.*
