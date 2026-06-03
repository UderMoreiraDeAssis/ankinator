# Phase 1: Andaime dos Especialistas - Context

**Gathered:** 2026-06-03
**Status:** Ready for planning
**Source:** Decisões travadas pelo usuário (delegou: "decida o melhor por mim") + análise tomada-de-decisão/sequential-thinking

<domain>
## Phase Boundary

Criar a **fundação reutilizável** dos especialistas Anki, SEM ainda ativar qualquer estágio no fluxo de geração e SEM regressão do fluxo atual (upload→extract→gerar→exportar). Entrega: (a) módulo `specialists/` com runner que reusa o spawn do `CliProvider` (assinatura), (b) padrão de "fonte única `.md`" espelhado como Skill, (c) interface `ImageProvider` com impl `svg-claude` (stub que ainda não gera nada em produção), (d) extensão consistente do tipo `Questao` com campos opcionais. A LÓGICA de cada especialista (classificar deck, montar card, mnemônico, imagem, orquestrar) é das fases 3–5 — aqui só o andaime + os arquivos `.md` canônicos (que podem já conter o conhecimento, mas não são chamados pelo pipeline ainda).

</domain>

<decisions>
## Implementation Decisions

### Runner de especialista (SPEC-01)
- **D-01:** O runner NÃO reinventa spawn. Refatorar o mecanismo de `cli-provider.ts` (spawn `claude -p --output-format json --model <model> ...` via `node:child_process.spawn`, prompt por stdin, parse do envelope JSON) para uma função reutilizável, e fazer o `CliProvider` atual passar a usá-la (sem mudar comportamento). O runner de especialista usa essa mesma função.
- **D-02:** Assinatura do runner: recebe `{ systemPrompt, userMessage, model? }` e retorna texto/JSON parseado. Mantém os flags de assinatura (`--exclude-dynamic-system-prompt-sections`, `--strict-mcp-config`) idênticos ao provider atual.
- **D-03:** Timeout e binário configuráveis pelos MESMOS env vars já existentes (`ANKINATOR_CLAUDE_BIN`, `ANKINATOR_CLI_TIMEOUT_MS`, `ANKINATOR_CLI_MODEL`). Não criar env vars novos nesta fase.

### Fonte única `.md` + Skill espelho (SPEC-02, SPEC-03)
- **D-04:** Texto canônico de cada especialista vive em `server/src/core/specialists/prompts/<nome>.md` (um arquivo por especialista). É a ÚNICA fonte.
- **D-05:** O carregamento do `.md` no app é feito por leitura de arquivo em runtime (path relativo ao módulo) OU import de string no build — escolher o que funciona com ESM/`NodeNext` sem quebrar o build do server (Claude's discretion na técnica, decisão travada é "sem duplicar o texto").
- **D-06:** Para cada especialista, criar `.claude/skills/anki-<nome>/SKILL.md` que referencia o `.md` canônico. Evitar copiar o corpo: a SKILL.md descreve quando usar + aponta/embute via referência ao arquivo canônico (ex.: instrução "leia server/src/core/specialists/prompts/<nome>.md"). O objetivo é não ter duas cópias divergentes (mesmo anti-pattern do tipo `Questao` duplicado).
- **D-07:** Os 5 nomes canônicos: `anki-orchestrator`, `deck-classifier`, `card-builder`, `mnemonic`, `mnemonic-image`.

### Interface ImageProvider (SPEC-04)
- **D-08:** Definir `ImageProvider` em `server/src/core/specialists/` (ex.: `image-provider.ts`) com método tipo `generate(mnemonic, context) => Promise<{ svg: string }>`.
- **D-09:** Implementar SOMENTE `SvgClaudeImageProvider` (usa o runner + o prompt canônico `mnemonic-image.md`). NÃO implementar providers raster (API/SD) — apenas deixar a interface pronta. Nesta fase a impl pode existir mas não é plugada no pipeline.
- **D-10:** Factory `createImageProvider()` retorna `svg-claude` por default; seleção futura por env fica como TODO documentado (não implementar agora).

### Extensão do tipo `Questao` (SPEC-05)
- **D-11:** Adicionar campos OPCIONAIS a `Questao` (todos `?:`): `deck?: string` (hierarquia `A::B::C`), `tags?: string[]`, `mnemonico?: string`, `mnemonicoSvg?: string`. Opcionais para não quebrar geração/exportação atuais.
- **D-12:** Espelhar a MESMA mudança em `ankinator-app/server/src/core/types.ts` e `ankinator-app/web/src/types.ts` (tipo duplicado hoje — manter sincronizado manualmente nesta fase; unificação em workspace compartilhado é fora de escopo).
- **D-13:** Exporters (csv/ankiconnect) NÃO mudam de comportamento nesta fase — campos novos são ignorados quando ausentes. Embed real do SVG/deck/tags é das fases 3–4.

### Claude's Discretion
- Técnica de carregar o `.md` (fs.readFile vs import) desde que cumpra "fonte única" e build verde.
- Nomes exatos de arquivos/funções dentro de `specialists/`.
- Formato exato do envelope de retorno do runner (string vs objeto), desde que o `CliProvider` atual continue funcionando idêntico.
- Estrutura interna das SKILL.md (frontmatter, seções), desde que não duplique o corpo canônico.

</decisions>

<specifics>
## Specific Ideas

- "agentes (ou outros recursos avançados como skills, e outros pertencentes o mundo do claude)" — por isso o híbrido: Skill (mundo do Claude, autoria manual) + estágio no app (runtime determinístico via assinatura).
- Preferência forte e durável: gerar via **assinatura Claude** (CLI), nunca API por token. Ver memória `prefere-assinatura-sobre-api`.
- Esta fase é puro andaime: critério de "pronto" é build verde + fluxo atual intacto + estruturas no lugar, NÃO cards enriquecidos (isso vem depois).

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Mapa do codebase (estado atual)
- `.planning/codebase/ARCHITECTURE.md` — pipeline, camadas, `QuestionProvider`, tipos `Questao`/`LoadedDocument`/`SemanticChunk`, anti-patterns (tipo duplicado).
- `.planning/codebase/INTEGRATIONS.md` — providers (CLI assinatura vs API), flags do `claude -p`, exporters Anki.
- `.planning/codebase/STACK.md` — Node 24, ESM `NodeNext`, TS 5.9 strict (importante p/ decisão de carregar `.md`).
- `.planning/codebase/CONVENTIONS.md` — estilo, naming, idioma PT em comentários/commits.

### Decisões e escopo da milestone
- `.planning/PROJECT.md` — Key Decisions (os 4 forks), constraints (assinatura, não regredir).
- `.planning/REQUIREMENTS.md` — SPEC-01..SPEC-05 (escopo desta fase).
- `.planning/ROADMAP.md` §"Phase 1" — goal + success criteria.

### Código fonte a respeitar/estender
- `ankinator-app/server/src/core/providers/cli-provider.ts` — mecanismo de spawn a refatorar/reutilizar (D-01/D-02).
- `ankinator-app/server/src/core/providers/index.ts` — factory `createProvider()` (padrão de factory a espelhar em `createImageProvider`).
- `ankinator-app/server/src/core/generation.ts` — `QuestionProvider` interface + `generateAll()` (NÃO alterar nesta fase além do necessário p/ runner compartilhado).
- `ankinator-app/server/src/core/types.ts` — tipo `Questao` (server) a estender (SPEC-05).
- `ankinator-app/web/src/types.ts` — tipo `Questao` (web) a espelhar (SPEC-05).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `cli-provider.ts`: já encapsula spawn + parse JSON do `claude -p`; é a base do runner de especialista (extrair função compartilhada).
- `providers/index.ts` `createProvider()`: padrão de factory por `kind` — replicar em `createImageProvider()`.
- Padrão sidecar Python `ocr-loader.ts` (não usado nesta fase, mas é o molde da Phase 2).

### Established Patterns
- ESM `"type": "module"` + `moduleResolution: NodeNext` no server → imports precisam de extensão `.js`; carregar `.md` exige `fs`/`import.meta.url` ou plugin — decidir sem quebrar build.
- Tipos duplicados server/web são sincronizados manualmente (anti-pattern conhecido) → ao estender `Questao`, alterar OS DOIS arquivos.

### Integration Points
- Runner compartilhado conecta `cli-provider.ts` (existente) e o novo `specialists/runner`.
- `ImageProvider` é isolada — ainda não plugada em `generation.ts`/exporters nesta fase.

</code_context>

<deferred>
## Deferred Ideas

- Lógica real de cada especialista chamando o runner no pipeline — Phases 3 (deck-classifier, card-builder), 4 (mnemonic, mnemonic-image), 5 (anki-orchestrator).
- Fase `enrichAll()` + toggles na UI — Phase 3.
- Embed real de SVG/deck/tags nos exporters — Phases 3–4.
- Provider de imagem raster atrás de `ImageProvider` — v2 (out of scope).
- Unificar tipo `Questao` em workspace compartilhado — backlog (anti-pattern conhecido, não nesta milestone).

</deferred>

---

*Phase: 01-andaime-dos-especialistas*
*Context gathered: 2026-06-03*
