# Requirements: Ankinator — Upgrade 2026

**Defined:** 2026-06-03
**Core Value:** Gerar flashcards que maximizam retenção a partir de qualquer texto de concurso, usando a assinatura Claude (sem custo por token).

## v1 Requirements

Escopo da milestone upgrade-2026. Cada requisito mapeia para uma fase do roadmap.

### Especialistas (Andaime)

- [x] **SPEC-01**: Existe um módulo `server/src/core/specialists/` com um runner que reusa o mecanismo de spawn do `CliProvider` (assinatura), aceitando um prompt de especialista e retornando saída estruturada.
- [x] **SPEC-02**: Cada especialista tem UM arquivo `.md` canônico (fonte única) com seu system prompt/conhecimento — sem duplicar texto entre app e Skill.
- [x] **SPEC-03**: Cada especialista tem uma Skill espelho em `.claude/skills/<nome>/SKILL.md` que referencia/embute o mesmo `.md` canônico, utilizável manualmente no Claude Code.
- [x] **SPEC-04**: Existe a interface `ImageProvider` com a implementação `svg-claude` (sem implementar providers de raster).
- [x] **SPEC-05**: O tipo `Questao` é estendido (deck, tags, mnemônico, svg) de forma consistente entre server e web, sem quebrar o fluxo atual.

### Loader PDF (LangChain)

- [x] **PDF-01**: Existe um script Python `tools/odl_langchain_loader.py` que usa `langchain-opendataloader-pdf` para extrair PDF em Documents por página (texto/markdown + metadata).
- [x] **PDF-02**: Existe `langchain-loader.ts` que invoca o sidecar via spawn, ativado por env/flag (opt-in), com fallback automático para o loader Node atual quando indisponível.
- [x] **PDF-03**: A saída do loader LangChain é normalizada para o tipo `LoadedDocument` existente (sections/elements/markdown), reaproveitando o chunker.

### Classificação de Deck

- [ ] **DECK-01**: O especialista classificador gera uma hierarquia de deck Anki (`Matéria::Assunto::Subtópico`) para o conjunto de cards.
- [ ] **DECK-02**: O classificador atribui tags relevantes (banca, ano, nível, tema) por card.

### Card Educativo

- [ ] **CARD-01**: O construtor de card reescreve pergunta/resposta para atomicidade (minimum information principle), evitando cards enciclopédicos.
- [ ] **CARD-02**: O verso inclui explicação curta e atribuição de fonte (página/origem).

### Mnemônicos

- [ ] **MNEM-01**: O especialista de mnemônicos gera mnemônicos para cards marcados como difíceis/memorização (listas, datas, classificações).
- [ ] **MNEM-02**: Suporta técnicas variadas (acrônimo, história/associação absurda, palácio da memória) escolhidas conforme o conteúdo.

### Imagem de Mnemônico

- [ ] **IMG-01**: O especialista de imagem gera um SVG autocontido (sem refs externas) que ilustra o mnemônico, via assinatura Claude.
- [ ] **IMG-02**: O SVG é sanitizado (sem `<script>`, sem URLs externas) antes de ser embutido.
- [ ] **IMG-03**: O SVG é embutido nos cards exportados (CSV e AnkiConnect) de forma que o Anki renderize.

### Orquestração & Pipeline

- [ ] **ORCH-01**: O orquestrador Anki decide por-card quais estágios rodar (ex.: mnemônico/imagem só p/ cards de memorização).
- [ ] **ORCH-02**: Estágios caros são batched/seletivos para poupar quota da assinatura (ex.: classificar o deck inteiro numa chamada).
- [ ] **ORCH-03**: O orquestrador aplica princípios Anki (atomicidade, evitar redundância) ao agregar o resultado.
- [ ] **PIPE-01**: Existe a fase `enrichAll()` que roda após `generateAll()`, reusando o job/SSE para progresso.
- [ ] **PIPE-02**: A UI expõe toggles do modo "educativo" (classificar, card educativo, mnemônico, imagem) com defaults inteligentes.
- [ ] **PIPE-03**: O fluxo atual (sem modo educativo, sem Python) continua funcionando sem regressão.

## v2 Requirements

Reconhecidos, fora do roadmap atual.

### Geração de Imagem Raster

- **IMGR-01**: Provider de imagem raster (API ou Stable Diffusion local) atrás da interface `ImageProvider`, caso o usuário queira fotorrealismo.

### Persistência

- **PERS-01**: Persistir documentos/jobs em disco/DB (hoje é in-memory single-user).

## Out of Scope

| Feature | Reason |
|---------|--------|
| Imagem raster paga (DALL·E/Gemini) | Fere preferência por assinatura; SVG via Claude cobre o caso |
| Migrar geração para LangChain/Python | App ficaria bilíngue e puxaria API key |
| Substituir loader Node por LangChain | LangChain é opt-in; Node `@opendataloader/pdf` segue default |
| Auth/multiusuário/DB | App é local single-user por design |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| SPEC-01 | Phase 1 | Complete |
| SPEC-02 | Phase 1 | Complete |
| SPEC-03 | Phase 1 | Complete |
| SPEC-04 | Phase 1 | Complete |
| SPEC-05 | Phase 1 | Complete |
| PDF-01 | Phase 2 | Complete |
| PDF-02 | Phase 2 | Complete |
| PDF-03 | Phase 2 | Complete |
| DECK-01 | Phase 3 | Pending |
| DECK-02 | Phase 3 | Pending |
| CARD-01 | Phase 3 | Pending |
| CARD-02 | Phase 3 | Pending |
| PIPE-01 | Phase 3 | Pending |
| PIPE-02 | Phase 3 | Pending |
| PIPE-03 | Phase 3 | Pending |
| MNEM-01 | Phase 4 | Pending |
| MNEM-02 | Phase 4 | Pending |
| IMG-01 | Phase 4 | Pending |
| IMG-02 | Phase 4 | Pending |
| IMG-03 | Phase 4 | Pending |
| ORCH-01 | Phase 5 | Pending |
| ORCH-02 | Phase 5 | Pending |
| ORCH-03 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 23 total
- Mapped to phases: 23
- Unmapped: 0 ✓

---
*Requirements defined: 2026-06-03*
*Last updated: 2026-06-03 after milestone bootstrap*
