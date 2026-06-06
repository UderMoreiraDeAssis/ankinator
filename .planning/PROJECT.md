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
- ✓ Classificador de deck (deck::subdeck + tags) + construtor de card educativo + modo "educativo" na UI via `enrichAll()` gated por `deveRodarEnrich` — validado na Phase 03 (PIPE-01/02/03, DECK-01/02, CARD-01/02; 7/7 must-haves, 18 testes + guards, UI runtime pendente em 03-HUMAN-UAT)

### Active

<!-- Current scope. Building toward these (upgrade-2026 milestone). -->
- [ ] Andaime de especialistas: fonte única `.md` → Skill (`.claude/skills/`) + estágio no app (`server/src/core/specialists/`)
- [ ] Especialista de mnemônicos
- [ ] Especialista de imagem de mnemônico (SVG gerado pelo Claude, sem API key)
- [ ] Orquestrador Anki (decide por-card quais estágios rodar; batching p/ poupar quota)

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
- Testes automatizados: a suíte **vitest** foi instalada na Phase 3 e cresceu para **~250 testes** (server) + guards (SPEC-01 / enrich / default-loader), com `tsc --noEmit` e build web verdes. *(O bootstrap dizia "sem testes"; `.planning/codebase/TESTING.md` é snapshot de 2026-06-03 — ver `.planning/FRAMING-REVIEW.md` §8 C6.)*

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
| Loader LangChain como **sidecar Python opt-in** (reusa padrão `ODL_PYTHON`); Node segue default | Pacote é Python-only (Java 11+); substituir/forçar Python regrediria setup | ✓ Entregue (Phase 02; loader ativável, fallback Node default; ativação ao vivo = RT-05, opcional) |
| Especialistas em **fonte única `.md`** → Skill + estágio no app (híbrido) | `claude -p` headless (`--strict-mcp-config`, system-prompt podado) não garante auto-discovery de subagent; evita duplicação tipo-`Questao` | ✓ Entregue (Phase 01; 5 `.md` canônicos + Skills espelho) |
| Imagem de mnemônico = **SVG gerado pelo Claude** + interface `ImageProvider` | Claude não gera raster; SVG é a única saída visual nativa sem API/billing | ✓ Validado AO VIVO (Phase 04; SVGs no Anki + gate de qualidade barra lixo) |
| Cadeia de especialistas = **modo "educativo" opcional** (toggles + defaults), fase `enrichAll()` pós-`generateAll()` | Rodar tudo sempre estoura quota/lentidão; orquestrador escolhe por-card | ✓ Validado AO VIVO (Phase 03/04; pipeline 58 cards no Anki, 0 erros) |
| **5 especialistas**: anki-orchestrator, deck-classifier, card-builder, mnemonic, mnemonic-image | Cobre o pedido do usuário com separação de responsabilidades | ✓ Entregue como `.claude/agents/` (wire do orquestrador em runtime = Phase 5, pendente/opcional) |
| **[DEC-m 2026-06-05] Manter o env knob `ANKINATOR_IMAGE_SKIP_TECNICAS`** (não enxugar) | Consistência com ~10 env-knobs de custo (Karpathy #3 "match existing style" > #2, pois remover criaria assimetria) + reversibilidade assimétrica (manter-e-errar é invisível: env vazio = idêntico; remover-e-errar gera re-trabalho) + o usuário tuna knobs após medir | ✓ Concluída (sessão m; nenhuma mudança de código — a impl. já é a recomendada) |
| **[DEC-n 2026-06-05] Qualidade `[CRIADA]`: nível Moderado + rollout knob opt-in** | (1) Nível **Moderado** (afrouxa `[CRIADA]` p/ reformular/atomizar/discriminar/aplicar por inferência DIRETA; `[EXTRAÍDA]` estrita; âncora dura p/ ambas: zero conhecimento externo) sobre Conservador — alinhado ao Destino #1. (2) Rollout **knob opt-in `ANKINATOR_CRIADA_FIDELITY` default-OFF** (byte-idêntico, reversível p/ o risco crítico) sobre novo-default-direto. Rejeitada "2 chamadas separadas" (dobraria custo). Desenho exposto antes de codar (lição DEC-m) | ⏳ Entregue em código (sessão n; 220 testes + guards verdes); pendente medir AO VIVO (melhora sem alucinar) antes de virar default |
| **[DEC-o 2026-06-05] `[CRIADA]` afrouxada → DEFAULT ON** (após medir-c PASS ao vivo) + reforço anti-leak | 47 `[CRIADA]` lidas do Anki: atomicidade forte + âncora 46–47/47, zero alucinação perigosa (único leak *mild* não-perigoso #45 "write-ahead log"). Escape `ANKINATOR_CRIADA_FIDELITY=estrita` → `SYSTEM_FIDELITY` byte-idêntico (guard SPEC-01 intacto) | ✓ Adotado default ON (sessão o); ⏳ A/B `=estrita` opcional p/ isolar do cardBuilder |
| **[DEC-p 2026-06-05] Orquestrador (#4) wired como caminho OPT-IN safe-by-construction; loader LangChain (#5) ativado** | Wiring SEPARADO (não toca o generation spawn / guard SPEC-01), gated `ANKINATOR_ORCHESTRATED` default-OFF (byte-equivalente), fallback determinístico p/ `enrichAll`; precondição `workersToolRestricted` + `tools:[]` nos 4 workers; flags verificados em `claude --help` | ✓ #5 ativo (auto-prefere langchain); ✓ #4 VALIDADO AO VIVO (q-live2/q-live3, opt-in) — recomendação: manter opt-in |

## Evolution

**After each phase transition:** atualizar Validated/Active/Out of Scope e a tabela de decisões (✓ Good / ⚠️ Revisit).

---
*Last updated: 2026-06-06 — **Key Decisions** formalizadas até DEC-p (esta tabela é o lar canônico das decisões; DEC-o/DEC-p adicionadas na reconciliação de consistência — ver `.planning/FRAMING-REVIEW.md` §8 C3). As seções **Validated/Active/Out of Scope** acima refletem o BOOTSTRAP da milestone (2026-06-03); o status corrente das fases vive em `.planning/ROADMAP.md` + `.planning/STATE.md`, e o diário de bordo por-sessão em `.planning/TAREFAS.md` (topo) + `.planning/STATE.md` (Accumulated Context → Decisions, espelha esta tabela).*
