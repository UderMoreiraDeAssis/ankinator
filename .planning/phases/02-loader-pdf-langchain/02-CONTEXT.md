# Phase 2: Loader PDF LangChain - Context

**Gathered:** 2026-06-03
**Status:** Ready for planning
**Source:** `/gsd:discuss-phase 2 --power` — 15 perguntas geradas; 15 respondidas pelo usuário (100%) com justificativa code-grounded por questão (ver `02-QUESTIONS.json` / `02-QUESTIONS.html`).

<domain>
## Phase Boundary

Adicionar `langchain-opendataloader-pdf` como loader de PDF **opcional** via **sidecar Python** (reusando o padrão `ODL_PYTHON`/spawn do `ocr-loader.ts`), com saída **normalizada para `LoadedDocument`** e **fallback automático** para o loader Node atual (`@opendataloader/pdf`). Entrega os 3 requisitos PDF-01/02/03.

**Dentro do escopo:** script Python `tools/odl_langchain_loader.py`; `langchain-loader.ts` (spawn + opt-in por env + fallback); função pura de normalização `Document[] → LoadedDocument` reusando `buildSections`/`cleanMarkdown`; verificação CLI-free + guard de não-regressão do caminho Node.

**Fora do escopo (FIXO):** substituir o loader Node default (LangChain é opt-in); tornar Python obrigatório; flag por-request/UI de seleção de loader; unificar o OCR no novo sidecar; mudar o tipo `LoadedDocument` (duplicado server/web); mudar o chunker.

</domain>

<decisions>
## Implementation Decisions

### Contrato do Sidecar (Python ↔ Node)
- **D-01 (Q-01):** O script Python imprime um **array JSON `[{page_content, metadata}]` no stdout**; o Node faz `JSON.parse`. SEM temp dir. Motivo verificado no código: `parseOdlOutput` espera a **árvore ODL** (`json.kids`), e a saída LangChain é per-page — logo o temp-dir do `ocr-loader.ts` reaproveitaria só I/O, nunca o parser. stdout é determinístico e testável por fixture (casa com D-14). Apostilas de concurso não geram stdout proibitivo.
- **D-02 (Q-02):** Interpretador via **nova env `ANKINATOR_LANGCHAIN_PYTHON`, com fallback para `ODL_PYTHON`**. O wrapper LangChain arrasta o stack `langchain-*`, que pode conflitar com o venv enxuto do OCR (`opendataloader-pdf[hybrid]`); a var dedicada habilita venv isolado SEM penalizar quem só setou `ODL_PYTHON` (fallback = comportamento de interpretador único).

### Ativação opt-in & Fallback (PDF-02)
- **D-03 (Q-03):** Ativação por **env seletor global `ANKINATOR_PDF_LOADER=node|langchain`, default `node`**. Espelha a convenção já existente em `config.ts` (`ANKINATOR_PROVIDER=cli|api`). NÃO usar flag por-request (mudaria `LoadOptions` + UI + o tipo duplicado — superfície demais para um loader opt-in inicial).
- **D-04 (Q-04):** Fallback automático **só por indisponibilidade**: checar `import` do pacote (estilo `isOcrAvailable()`); ausente → usa Node em silêncio (atende "fallback automático" do PDF-02). Erro de **runtime** no sidecar (PDF corrompido/bug) → **propaga** (não mascara bug nem re-extrai 2×). Coerente com a postura "OCR estrito" já no código.
- **D-05 (Q-05):** Visibilidade do loader usado = **apenas log no servidor** (`[ankinator] loader: langchain` / `(fallback→node)`). NÃO estender `LoadedDocument` (duplicado server/web — Pitfall 4 da Phase 1). Esse log também cobre a observabilidade do fallback de D-04. Gatilho de revisão → campo + badge na UI quando o usuário final precisar ver.
- **D-06 (Q-06):** OCR fica **no caminho Python atual** (`runOcrLoader`/`--force-ocr`); o loader LangChain **ignora `ocr` nesta fase**. Se `ocr=true` E `loader=langchain`, **OCR (mais específico) vence**. Não reescreve um caminho que já funciona (mudança cirúrgica). Unificar OCR no novo sidecar fica para fase futura.

### Normalização → LoadedDocument (PDF-03, núcleo)
- **D-07 (Q-07):** `sections[]` reconstruídas **reparseando os headings `#` do markdown** (concatena os `page_content` e roda uma passada estilo `buildSections` adaptada para entrada markdown). FATO verificado: `chunkDocument` consome **SÓ** `doc.sections[]` e quebra/empacota por fronteira de seção — page-as-section deixaria o chunking grosso e degradaria a qualidade do card. **Depende de D-12** (markdown precisa conter headings).
- **D-08 (Q-08):** `elements[]` = **1 `DocElement{ type:'text block', page, content }` por página** (mínimo). `elements` existe só para inspeção/debug e o chunker o ignora. `'text block'` já está em `ElementType`.
- **D-09 (Q-09):** `markdown` completo = `pages.map(p=>p.page_content).join('\n\n')` + **reuso de `cleanMarkdown`** (de `odl-parse.ts`). SEM marcadores de página (a fonte já vem de `pageStart/pageEnd` das seções; marcador seria ruído ao LLM).
- **D-10 (Q-10):** Campos do topo **derivados**: `numPages = max(metadata.page)+1`, `fileName = basename(pdf)`, `title = primeiro heading | null`. NÃO confiar em campos top-level que o LangChain pode não expor (per-page metadata costuma trazer só `source`/`page`). Robusto a variação de versão.

### Script Python & opções (PDF-01)
- **D-11 (Q-11):** CLI do `tools/odl_langchain_loader.py` **espelha `LoadOptions`**: `<pdf> [--pages] [--password]`. `loadDocument` já repassa `pages`/`password`; ignorá-los seria um **bug silencioso** (usuário pede `pages:'1,3'` e recebe o documento inteiro). Sem TODO de paridade pendente.
- **D-12 (Q-12):** Configurar o pacote em **modo markdown por página** (preserva headings/tabelas — essencial para D-07 e para tabelas de provas). Texto plano rejeitado (degrada chunking e tabelas). Alinha com o pipeline, que já espera markdown em todo o fluxo.
- **D-13 (Q-13):** Dependência registrada em **`tools/requirements.txt` com pin de versão** (`langchain-opendataloader-pdf==<x.y>`) + nota no README/INTEGRATIONS. Leve desvio do estilo "só prosa pip" do OCR, justificado: o sidecar LangChain tem maior risco de drift de API (ver D-10/D-12); o pin estabiliza o contrato.

### Verificação & não-regressão
- **D-14 (Q-14):** **Unit puro da normalização** (fixture `Document[]` → `LoadedDocument`, SEM Python — determinístico, roda sempre no CI) + **smoke opt-in** (`smoke-langchain-loader.ts` gated em disponibilidade, como `smoke-loader.ts`). Espelha a disciplina "asserção CLI-free" da Phase 1 (`smoke-runner --assert-args`). As decisões D-07..D-10 formam uma função pura, exatamente o ponto mais sujeito a regressão.
- **D-15 (Q-15):** **Guard determinístico**: com `ANKINATOR_PDF_LOADER` não setado, `loadDocument` usa o caminho `@opendataloader/pdf` de hoje **byte-idêntico** (sem desvio). D-03 introduz um branch NOVO dentro de `loadDocument` → provar automaticamente que o default ficou intocado é o seguro contra a regressão mais perigosa da fase. Espelha o guard SPEC-01 da Phase 1. Constraint dura do projeto: o fluxo atual roda SEM Python.

### Claude's Discretion
- Nomes exatos de arquivos/funções dentro de `langchain-loader.ts` e do módulo de normalização.
- Como compartilhar `buildSections` entre os dois loaders (extrair helper reutilizável vs adaptar) — desde que ambos fiquem consistentes e o build verde.
- Conteúdo exato da fixture de D-14 e o formato exato da linha de log de D-05.
- Forma exata de detectar disponibilidade (qual módulo importar no teste de `import`), desde que cumpra D-04.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Mapas do codebase (estado atual)
- `.planning/codebase/INTEGRATIONS.md` §"PDF Extraction" — OpenDataLoader Node (`document-loader.ts`), backend OCR Python (`ocr-loader.ts`, `ODL_PYTHON`), tabela de env vars. Molde do sidecar.
- `.planning/codebase/ARCHITECTURE.md` — pipeline `PDF→LoadedDocument→SemanticChunk→Questao`, camadas, tipos centrais.
- `.planning/codebase/STACK.md` — Node 24, ESM `NodeNext`, TS 5.9 strict (spawn de sidecar, extensões `.js`, leitura de fixture/.py).
- `.planning/codebase/CONVENTIONS.md` — estilo, naming, idioma PT em comentários/commits.
- `.planning/codebase/TESTING.md` — baseline "sem testes automatizados" (informa a estratégia de D-14).

### Decisões e escopo da milestone
- `.planning/PROJECT.md` — Key Decisions (loader LangChain = sidecar Python opt-in; Node segue default) + Constraints (não regredir; integrações Python só como sidecar opcional).
- `.planning/REQUIREMENTS.md` — **PDF-01, PDF-02, PDF-03** (escopo desta fase) + "Out of Scope" (não substituir loader Node).
- `.planning/ROADMAP.md` §"Phase 2: Loader PDF LangChain" — goal + 3 success criteria.

### Código fonte a respeitar/estender
- `ankinator-app/server/src/core/document-loader.ts` — `loadDocument()` + `LoadOptions` (`ocr`/`pages`/`password`). Ponto onde entra o branch do novo loader (D-03) e alvo do guard (D-15).
- `ankinator-app/server/src/core/ocr-loader.ts` — **molde do sidecar**: `spawn`, `run()`, `isOcrAvailable()` (import-check), reuso de `parseOdlOutput`. Base de D-01/D-02/D-04.
- `ankinator-app/server/src/core/odl-parse.ts` — `parseOdlOutput`, **`buildSections()`** e **`cleanMarkdown()`** (alvos de reuso/adaptação para D-07/D-09).
- `ankinator-app/server/src/core/types.ts` — `LoadedDocument`, `Section`, `DocElement`, `ElementType` (`'text block'`). NÃO alterar (D-05/D-08/D-10).
- `ankinator-app/server/src/core/chunker.ts` — `chunkDocument()` consome **SÓ** `doc.sections[]` (a razão de D-07). Não muda (PDF-03).
- `ankinator-app/server/src/config.ts` — convenção de env vars (`ANKINATOR_PROVIDER`) a espelhar em `ANKINATOR_PDF_LOADER` (D-03) e adicionar `ANKINATOR_LANGCHAIN_PYTHON` (D-02).
- `ankinator-app/server/src/api.ts` (linhas ~79-85) — call-site de `loadDocument`, `req.body { ocr, pages, password }` (relevante a D-06/D-11).
- `ankinator-app/server/src/scripts/smoke-loader.ts` — padrão de smoke harness a clonar em `smoke-langchain-loader.ts` (D-14).

### Artefatos a criar (paths fixados)
- `tools/odl_langchain_loader.py` — script Python sidecar (PDF-01; D-11/D-12).
- `tools/requirements.txt` — pin do pacote Python (D-13).

### Externo (pacote — CONFIRMAR NA PESQUISA)
- `langchain-opendataloader-pdf` (PyPI) — confirmar classe loader, como pedir modo markdown-por-página, campos de `Document.metadata`, e se exige Java além de Python. Ver "Research flags" em `<specifics>`.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ocr-loader.ts` — `spawn`/`run()` + `isOcrAvailable()` (teste de `import`): molde direto para `langchain-loader.ts` (spawn + availability-check + fallback de D-04).
- `odl-parse.ts` — `buildSections()` (markdown de seção a partir de headings) e `cleanMarkdown()` (colapsa linhas vazias/tabelas sem texto): reusar/adaptar para a normalização markdown→sections (D-07/D-09).
- `config.ts` — padrão de leitura de env com default seguro: adicionar `ANKINATOR_PDF_LOADER` (D-03) e `ANKINATOR_LANGCHAIN_PYTHON` (D-02).
- `scripts/smoke-loader.ts` — clonar para `smoke-langchain-loader.ts` (smoke opt-in de D-14).

### Established Patterns
- **Sidecar opcional**: Python via `spawn`, gated por disponibilidade, degradação graciosa (precedente `ODL_PYTHON`/`ocr-loader.ts`).
- **ESM `NodeNext`**: imports com extensão `.js`; ler `.py`/fixtures via `path` + `import.meta.url`.
- **Tipo `LoadedDocument` duplicado** (server `core/types.ts` + web `src/types.ts`) → NÃO mexer (motiva D-05).
- **Asserção CLI-free** (Phase 1): verificação determinística sem spawnar processo externo → base de D-14/D-15.

### Integration Points
- Novo branch dentro de `loadDocument()` seleciona langchain vs node por env (D-03), com fallback (D-04) e guard de default (D-15).
- `normalize(Document[]) → LoadedDocument` é o núcleo puro e testável (D-07..D-10), validado pela fixture de D-14.
- Chunker permanece intacto — consome o `sections[]` normalizado (critério de sucesso PDF-03).

</code_context>

<specifics>
## Specific Ideas

- O usuário respondeu todas as 15 perguntas com justificativa ancorada no código e cruzando questões entre si, aplicando os princípios Karpathy: **simplicidade** (D-08/D-09 mínimos), **mudança cirúrgica** (D-05/D-06: não tocar o que funciona), **correção sobre conveniência** (D-11: evitar bug silencioso de flags), **critério verificável** (D-14/D-15). Preferência forte: superfície mínima, nada especulativo, proteger os caminhos Node/OCR já funcionais.

### Research flags (o `gsd-phase-researcher` DEVE confirmar — afetam decisões travadas)
1. **API do `langchain-opendataloader-pdf`**: classe/loader exato, como selecionar **modo markdown por página**, e **se o markdown emitido contém headings ATX `#`**. → **D-07 depende disso**; se o pacote não emitir headings, D-07 degrada para page-as-section e precisa de plano alternativo (ex.: derivar seções por página + heurística, ou reconsiderar a opção C de Q-07).
2. **Campos de `Document.metadata`** efetivamente presentes (`page` é 0- ou 1-indexed? `source`?) → confirma a derivação de D-10.
3. **Dependência de runtime**: o pacote exige **Java** (motor ODL) além de Python? → afeta o teste de disponibilidade (D-04) e a doc de instalação (D-13).
4. **Serialização**: confirmar que `Document[]` em modo markdown serializa limpo em stdout (sem binário/imagens) para o contrato de D-01.

</specifics>

<deferred>
## Deferred Ideas

- **Seleção de loader por-request** (`req.body.loader`) + seletor na UI — futuro, se o usuário precisar escolher por PDF (Q-03b).
- **Campo `loader` em `LoadedDocument` + badge na UI** — quando a UI precisar exibir qual loader rodou ao usuário final (Q-05b).
- **Unificar o OCR no sidecar LangChain** (aposentar `runOcrLoader`/`--force-ocr`) — fase futura, quando o sidecar LangChain estiver maduro (Q-06b).
- **`elements[]` rico** (heading/parágrafo) — só se a UI passar a inspecionar elements em detalhe (Q-08b).

None — discussion stayed within phase scope (os itens acima são variações conscientemente adiadas, não scope creep).

</deferred>

---

*Phase: 02-loader-pdf-langchain*
*Context gathered: 2026-06-03*
