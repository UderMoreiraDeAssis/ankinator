# Ankinator — Upgrade 2026

## What This Is

Ankinator transforma textos de estudo (PDFs de concurso público) em flashcards Anki. Hoje: app web (React+Vite+Tailwind + servidor Express) que faz upload → extrai/estrutura o PDF → gera questões via Claude → revisa → exporta para o Anki (CSV ou AnkiConnect). Esta milestone (upgrade-2026) eleva a qualidade pedagógica dos cards com uma cadeia de especialistas ("mundo do Claude") e melhora a extração de PDF.

## Core Value

Gerar flashcards que **maximizam a retenção** a partir de um texto qualquer de concurso — não só extrair questões prontas, mas **criar** cards atômicos, bem classificados, com mnemônicos e auxílio visual — tudo usando a **assinatura Claude** (sem custo por token).

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

- ✓ Upload PDF → extração estruturada via `@opendataloader/pdf` (Node/Java) — v1
- ✓ Chunking semântico + geração de questões via Claude (provider CLI assinatura / API) — v1
- ✓ Revisão de cards na UI + exportação Anki (CSV e AnkiConnect) — v1
- ✓ Loader PDF via `langchain-opendataloader-pdf` (sidecar Python opt-in, normalizado p/ `LoadedDocument`, fallback Node default) — validado na Phase 02 (PDF-01/02/03; 11/11 automated, smoke real pendente em 02-HUMAN-UAT)

### Active

<!-- Current scope. Building toward these (upgrade-2026 milestone). -->
- [ ] Andaime de especialistas: fonte única `.md` → Skill (`.claude/skills/`) + estágio no app (`server/src/core/specialists/`)
- [ ] Especialista classificador de deck (deck::subdeck + tags)
- [ ] Especialista construtor de card educativo (atomicidade, explicação, fonte)
- [ ] Especialista de mnemônicos
- [ ] Especialista de imagem de mnemônico (SVG gerado pelo Claude, sem API key)
- [ ] Orquestrador Anki (decide por-card quais estágios rodar; batching p/ poupar quota)
- [ ] Modo "educativo" opcional na UI (toggles + defaults inteligentes; nova fase `enrichAll()`)

### Out of Scope

<!-- Explicit boundaries. -->

- Geração de imagem raster (DALL·E/Gemini/Stable Diffusion) — fere a preferência por assinatura; SVG via Claude é o caminho. Reabrir só se o usuário pedir fotorrealismo.
- Migrar toda a geração para LangChain/Python — manteria o app bilíngue e puxaria API key; LangChain entra só como loader opcional de PDF.
- Banco de dados / multiusuário / auth — segue app local single-user.
- Substituir o loader Node atual — LangChain é opt-in, Node `@opendataloader/pdf` continua default.

## Context

- Stack: monorepo npm — `@ankinator/server` (Express 5, ESM, Node 24), `@ankinator/web` (React 19 + Vite 7 + Tailwind 4), `ankinator-mcp` (CommonJS, MCP SDK). TypeScript 5.9, strict.
- Geração já é dual-provider: `CliProvider` (default, assinatura via `claude -p`) e `ApiProvider` (opt-in, `ANTHROPIC_API_KEY`). Mapa em `.planning/codebase/`.
- Já existe padrão de sidecar Python (OCR via `ODL_PYTHON`, `ocr-loader.ts`) — molde para o loader LangChain.
- Tipo central `Questao` está duplicado (server + web) — risco de divergência a respeitar ao adicionar campos (deck, tags, mnemônico, svg).
- Sem testes automatizados hoje (ver `.planning/codebase/TESTING.md`).

## Constraints

- **Geração**: usar assinatura Claude (CLI), NÃO API por token — preferência forte e durável do usuário.
- **Tech stack**: app é Node/TS; integrações Python entram só como sidecar opcional (spawn), nunca dependência obrigatória.
- **Não regredir**: o fluxo atual upload→extract→gerar→exportar deve continuar funcionando sem Python e sem o modo educativo.
- **Imagem**: sem serviço externo pago; Claude só produz vetor (SVG), que deve ser sanitizado antes de embutir no card.
- **Quota**: a cadeia por-card multiplica chamadas ao CLI — exige batching e estágios seletivos.

## Key Decisions

<!-- Decisões que restringem trabalho futuro. -->

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Loader LangChain como **sidecar Python opt-in** (reusa padrão `ODL_PYTHON`); Node segue default | Pacote é Python-only (Java 11+); substituir/forçar Python regrediria setup | — Pending |
| Especialistas em **fonte única `.md`** → Skill + estágio no app (híbrido) | `claude -p` headless (`--strict-mcp-config`, system-prompt podado) não garante auto-discovery de subagent; evita duplicação tipo-`Questao` | — Pending |
| Imagem de mnemônico = **SVG gerado pelo Claude** + interface `ImageProvider` | Claude não gera raster; SVG é a única saída visual nativa sem API/billing | — Pending |
| Cadeia de especialistas = **modo "educativo" opcional** (toggles + defaults), fase `enrichAll()` pós-`generateAll()` | Rodar tudo sempre estoura quota/lentidão; orquestrador escolhe por-card | — Pending |
| **5 especialistas**: anki-orchestrator, deck-classifier, card-builder, mnemonic, mnemonic-image | Cobre o pedido do usuário com separação de responsabilidades | — Pending |

## Evolution

**After each phase transition:** atualizar Validated/Active/Out of Scope e a tabela de decisões (✓ Good / ⚠️ Revisit).

---
*Last updated: 2026-06-03 after Phase 02 complete (loader PDF LangChain — opt-in sidecar)*
