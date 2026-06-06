# Quick Task 260606-k3b: adicionar markitdown e turbovec a esse projeto - Context

**Gathered:** 2026-06-06
**Status:** Ready for planning

<domain>
## Task Boundary

Adicionar dois repositórios ao Ankinator:
- **microsoft/markitdown** — utilitário Python (PyPI `markitdown[all]`, Python 3.10+, CLI+lib) que converte PDF/Office/imagem/áudio/HTML/CSV → Markdown para LLMs. **Sem dependência de Java** (ao contrário do `langchain-opendataloader-pdf` atual, que exige Java 25).
- **RyanCodrai/turbovec** — engine de busca vetorial (Rust + Python bindings, PyPI `turbovec`, algoritmo TurboQuant). **CONSOME** vetores/embeddings e os comprime/busca; **NÃO gera embeddings**.

Restrição de forma: o server é Node/TS; ambos são Python → integrar pelo **mesmo padrão sidecar Python + venv + env var** já validado na Phase 2 (`langchain-loader.ts` + `ANKINATOR_LANGCHAIN_PYTHON` + `tools/odl_langchain_loader.py`). Não reescrever em Node, não usar API paga.

Tarefa via `/gsd-quick --discuss --research`. O usuário **delegou a decisão** ("decida o melhor por mim"); decidido via skill `tomada-de-decisao` (modo Estruturado) + sequential-thinking.
</domain>

<decisions>
## Implementation Decisions

### Eixo 1 — Papel do markitdown: LOADER OPT-IN ADICIONAL (decisão A1)
- markitdown entra como uma **3ª opção de loader de PDF**, selecionável por `ANKINATOR_PDF_LOADER=markitdown`, espelhando exatamente o loader langchain (sidecar + normalize → `LoadedDocument`).
- **O default permanece byte-idêntico** (loader atual intocado — restrição dura R1, guard de default-loader verde). markitdown só roda sob env explícito.
- **Server-only** nesta fatia: NÃO mexer em upload/multer/UI (entrada segue só PDF, como hoje). Suportar formatos novos (Office/imagem/áudio) é follow-up FUTURO sobre esta base, fora de escopo agora.
- Vencedor por Matriz de Decisão Ponderada (4.45 vs substituir-langchain 2.95 / só-formatos-novos 3.20 / só-dependência 3.50); robusto sob análise de sensibilidade.

### Eixo 2 — Escopo do turbovec: SCAFFOLD MÍNIMO PROVADO, DEDUP DEFERIDO (decisão B1)
- turbovec entra como **fundação exercitada**, NÃO como dedup ligado: a) `requirements` com pin de versão; b) sidecar Python fino (`tools/turbovec_index.py`) com um subcomando **smoke** que cria o índice, indexa vetores fake determinísticos e busca (prova-de-vida real, no nível do componente — como a Phase 2 provou o sidecar langchain antes de plugar) + interface mínima `add`/`search` JSON stdin/stdout para uso futuro; c) wrapper `server/src/core/turbovec.ts` com `isTurbovecAvailable()` **fail-closed** e marcação `TODO(dedup-semântico: fase futura)`; d) 1 teste CLI-free do parse do JSON de saída; e) doc curta de setup/ativação.
- **NÃO plugar no pipeline.** O dedup atual (Jaccard em `deck-organizer.ts`/`existing-deck.ts`) permanece **INTOCADO** (R1/R3). Integrar dedup-por-embedding já = exige fonte de embeddings + wiring + (potencialmente) operação destrutiva no Anki do usuário (TIPO 1, irreversível) → vira **FASE do ROADMAP**, fora da delegação de uma quick task.
- **Anti-andaime-morto:** o scaffold só é aceitável porque é PROVADO pelo smoke rodável + teste (não um arquivo que nada chama, anti-padrão que o projeto já criticou no `anki-orchestrator`).

### Eixo 3 — Fonte de embeddings: DEFERIR (decisão C2; local grátis = futuro recomendado)
- Como o dedup está deferido (Eixo 2), **não gerar embeddings agora** e **não instalar `torch`/`sentence-transformers`** (dependência pesada especulativa — Karpathy #2). O scaffold do turbovec fica **agnóstico à fonte** (recebe vetores de fora).
- Quando a fase futura de dedup semântico for construída, a fonte recomendada é **modelo LOCAL gratuito** (ex.: `sentence-transformers` multilíngue para PT, via sidecar Python) — honra "assinatura, sem custo por token" (R2). **API de embeddings (Voyage/OpenAI) está REJEITADA** salvo decisão futura explícita do usuário (viola R2).

### Restrições duras (não-negociáveis, válidas para todas as tarefas)
- R1: default byte-idêntico / zero regressão (guards verdes; default loader e dedup atuais intocados).
- R2: sem custo por token / assinatura-only.
- R3: NÃO tocar destrutivamente a coleção Anki do usuário sem consentimento explícito.
- R4: é quick task → 1-3 tarefas atômicas, autocontido.
- R5: Python = sidecar + venv + env var (padrão Phase 2); não reescrever em Node.

### Contingência (informação parcial sobre o turbovec)
- Se o research/instalação revelar que `turbovec` é **imaturo no PyPI** (ausente para a plataforma, API instável), **degradar honestamente** a entrega do Eixo 2 para `requirements pin + doc + isTurbovecAvailable()=false`, **sem fabricar wrapper sobre API inexistente**. A entrega permanece verdadeira sob incerteza.

### Claude's Discretion
Decisão tri-eixo inteira foi delegada pelo usuário e tomada por mim (autoridade delegada cobre decisões TIPO 2 reversíveis). A única operação fora da delegação — dedup destrutivo no Anki — foi deliberadamente deixada para fase futura com consentimento.
</decisions>

<specifics>
## Specific Ideas

- Espelhar o trio da Phase 2: `tools/odl_langchain_loader.py` → `tools/markitdown_loader.py`; `langchain-loader.ts` → `markitdown-loader.ts`; `ANKINATOR_LANGCHAIN_PYTHON` → `ANKINATOR_MARKITDOWN_PYTHON`; reusar `langchain-normalize.ts` se a normalização for compatível.
- Seleção via `chooseLoader`/`loadDocument` em `server/src/core/document-loader.ts` + `config.ts` (`ANKINATOR_PDF_LOADER=markitdown`).
- Pins de versão no estilo do projeto (a Phase 2 fixou `langchain-opendataloader-pdf==2.0.0`).
- turbovec API (a confirmar no research): `from turbovec import TurboQuantIndex; index = TurboQuantIndex(dim=1536, bit_width=4); index.add(vectors); scores, indices = index.search(query, k=10)`.
</specifics>

<canonical_refs>
## Canonical References

- https://github.com/microsoft/markitdown (Python, PyPI `markitdown[all]`, multi-formato → Markdown, sem Java).
- https://github.com/RyanCodrai/turbovec (Rust+Python bindings, PyPI `turbovec`, TurboQuant vector search; consome vetores, não gera).
- Padrão interno Phase 2: `server/src/core/langchain-loader.ts`, `langchain-normalize.ts`, `tools/odl_langchain_loader.py`, `config.ts` (envs `ANKINATOR_LANGCHAIN_PYTHON`/`ANKINATOR_PDF_LOADER`).
- `.planning/ROADMAP.md` (Phase 2 = loader sidecar; Destino do projeto).

## Validação de "pronto"
Testes mockados NÃO contam como pronto (lição do UAT das Phases 4). O critério real é rodar os sidecars **AO VIVO** com venv real. Esta entrega declara explicitamente **validação ao vivo PENDENTE** e cria a base para ela (smoke scripts rodáveis + doc de setup).
</canonical_refs>
