# Fase 1: Andaime dos Especialistas - Pesquisa

**Pesquisado:** 2026-06-02
**Domínio:** Refatoração de provider CLI (assinatura Claude), padrão "fonte única `.md` ↔ Skill", interface `ImageProvider`, extensão de tipo TypeScript em monorepo ESM `NodeNext`
**Confiança:** ALTA (codebase lido diretamente; spec de Skill confirmado em docs oficiais)

## Summary

Esta é uma fase de **puro andaime** sobre um codebase já bem estruturado. Não há pacotes novos a instalar — tudo é refatoração interna + arquivos novos + extensão de dois tipos `Questao` duplicados. O mecanismo de spawn do `claude -p` já existe e está correto em `cli-provider.ts` (flags de assinatura conferidas linha a linha); a tarefa do runner (SPEC-01) é **extrair** o método `invoke()` para uma função reutilizável e fazer o `CliProvider` atual passar a chamá-la, sem mudar comportamento observável.

A única questão de pesquisa real é o **carregamento dos `.md` canônicos em runtime sob ESM `NodeNext`** (D-05). Verifiquei empiricamente que o build do server é `tsc -p tsconfig.json` puro — ele **NÃO copia `.md` para `dist/`** (confirmado: `find dist -name '*.md'` retorna vazio; `dist/core/` só tem `.js`/`.map`). Isso elimina a abordagem ingênua de `fs.readFile` com path relativo a `import.meta.url` apontando para `dist/`, porque o arquivo `.md` não estará lá em produção. A recomendação primária resolve isso lendo o `.md` a partir da **árvore `src/` resolvida em runtime** (não do `dist/`), com fallback robusto.

Para "fonte única" Skill ↔ app (SPEC-02/03), as docs oficiais do Claude Code confirmam o mecanismo de **progressive disclosure**: uma `SKILL.md` referencia outro arquivo por path e o Claude lê sob demanda via bash. Logo a `SKILL.md` não copia o corpo — ela aponta para o `.md` canônico. Isso é exatamente o anti-duplicação pedido.

**Primary recommendation:** Extrair `runClaudeCli({ systemPrompt, userMessage, model? })` de `cli-provider.ts`; colocar o texto canônico em `server/src/core/specialists/prompts/<nome>.md`; carregá-lo em runtime via `loadPrompt(nome)` que resolve o path a partir da árvore `src/` (não `dist/`) usando `import.meta.url` + busca ascendente por `src/core/specialists/prompts/`; cada `.claude/skills/anki-<nome>/SKILL.md` referencia (não copia) o `.md` canônico via instrução de path repo-relativo; estender `Questao` com 4 campos opcionais nos DOIS arquivos de tipo.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Runner de especialista (SPEC-01)**
- **D-01:** O runner NÃO reinventa spawn. Refatorar o mecanismo de `cli-provider.ts` (spawn `claude -p --output-format json --model <model> ...` via `node:child_process.spawn`, prompt por stdin, parse do envelope JSON) para uma função reutilizável, e fazer o `CliProvider` atual passar a usá-la (sem mudar comportamento). O runner de especialista usa essa mesma função.
- **D-02:** Assinatura do runner: recebe `{ systemPrompt, userMessage, model? }` e retorna texto/JSON parseado. Mantém os flags de assinatura (`--exclude-dynamic-system-prompt-sections`, `--strict-mcp-config`) idênticos ao provider atual.
- **D-03:** Timeout e binário configuráveis pelos MESMOS env vars já existentes (`ANKINATOR_CLAUDE_BIN`, `ANKINATOR_CLI_TIMEOUT_MS`, `ANKINATOR_CLI_MODEL`). Não criar env vars novos nesta fase.

**Fonte única `.md` + Skill espelho (SPEC-02, SPEC-03)**
- **D-04:** Texto canônico de cada especialista vive em `server/src/core/specialists/prompts/<nome>.md` (um arquivo por especialista). É a ÚNICA fonte.
- **D-05:** O carregamento do `.md` no app é feito por leitura de arquivo em runtime (path relativo ao módulo) OU import de string no build — escolher o que funciona com ESM/`NodeNext` sem quebrar o build do server (Claude's discretion na técnica, decisão travada é "sem duplicar o texto").
- **D-06:** Para cada especialista, criar `.claude/skills/anki-<nome>/SKILL.md` que referencia o `.md` canônico. Evitar copiar o corpo: a SKILL.md descreve quando usar + aponta/embute via referência ao arquivo canônico (ex.: instrução "leia server/src/core/specialists/prompts/<nome>.md"). O objetivo é não ter duas cópias divergentes (mesmo anti-pattern do tipo `Questao` duplicado).
- **D-07:** Os 5 nomes canônicos: `anki-orchestrator`, `deck-classifier`, `card-builder`, `mnemonic`, `mnemonic-image`.

**Interface ImageProvider (SPEC-04)**
- **D-08:** Definir `ImageProvider` em `server/src/core/specialists/` (ex.: `image-provider.ts`) com método tipo `generate(mnemonic, context) => Promise<{ svg: string }>`.
- **D-09:** Implementar SOMENTE `SvgClaudeImageProvider` (usa o runner + o prompt canônico `mnemonic-image.md`). NÃO implementar providers raster (API/SD) — apenas deixar a interface pronta. Nesta fase a impl pode existir mas não é plugada no pipeline.
- **D-10:** Factory `createImageProvider()` retorna `svg-claude` por default; seleção futura por env fica como TODO documentado (não implementar agora).

**Extensão do tipo `Questao` (SPEC-05)**
- **D-11:** Adicionar campos OPCIONAIS a `Questao` (todos `?:`): `deck?: string` (hierarquia `A::B::C`), `tags?: string[]`, `mnemonico?: string`, `mnemonicoSvg?: string`. Opcionais para não quebrar geração/exportação atuais.
- **D-12:** Espelhar a MESMA mudança em `ankinator-app/server/src/core/types.ts` e `ankinator-app/web/src/types.ts` (tipo duplicado hoje — manter sincronizado manualmente nesta fase; unificação em workspace compartilhado é fora de escopo).
- **D-13:** Exporters (csv/ankiconnect) NÃO mudam de comportamento nesta fase — campos novos são ignorados quando ausentes. Embed real do SVG/deck/tags é das fases 3–4.

### Claude's Discretion
- Técnica de carregar o `.md` (fs.readFile vs import) desde que cumpra "fonte única" e build verde.
- Nomes exatos de arquivos/funções dentro de `specialists/`.
- Formato exato do envelope de retorno do runner (string vs objeto), desde que o `CliProvider` atual continue funcionando idêntico.
- Estrutura interna das SKILL.md (frontmatter, seções), desde que não duplique o corpo canônico.

### Deferred Ideas (OUT OF SCOPE)
- Lógica real de cada especialista chamando o runner no pipeline — Phases 3 (deck-classifier, card-builder), 4 (mnemonic, mnemonic-image), 5 (anki-orchestrator).
- Fase `enrichAll()` + toggles na UI — Phase 3.
- Embed real de SVG/deck/tags nos exporters — Phases 3–4.
- Provider de imagem raster atrás de `ImageProvider` — v2 (out of scope).
- Unificar tipo `Questao` em workspace compartilhado — backlog (anti-pattern conhecido, não nesta milestone).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Descrição | Suporte da Pesquisa |
|----|-----------|---------------------|
| SPEC-01 | Módulo `server/src/core/specialists/` com runner que reusa o spawn do `CliProvider`, aceitando prompt de especialista e retornando saída estruturada | `cli-provider.ts:43-98` (`invoke()`) é o código exato a extrair → `runClaudeCli()`. Ver "Pattern 1" e "Code Examples". Flags de assinatura conferidos linha a linha. |
| SPEC-02 | Cada especialista tem UM `.md` canônico (fonte única), sem duplicar texto entre app e Skill | `.md` em `server/src/core/specialists/prompts/<nome>.md`; carregado por `loadPrompt()` (ver "Pitfall 1" — build não copia `.md`). |
| SPEC-03 | Skill espelho em `.claude/skills/<nome>/SKILL.md` que referencia/embute o mesmo `.md` canônico | Confirmado em docs oficiais: progressive disclosure permite SKILL.md apontar para arquivo por path; Claude lê sob demanda. Ver "Pattern 2" + "Code Examples". `.claude/skills/` ainda não existe (criar). |
| SPEC-04 | Interface `ImageProvider` com impl `svg-claude` (sem raster) | `createProvider()` em `providers/index.ts:21` é o molde da factory. Ver "Pattern 3". Atenção `noUnusedParameters` no web (não afeta server). |
| SPEC-05 | Tipo `Questao` estendido (deck, tags, mnemônico, svg) consistente server↔web, sem quebrar fluxo atual | `server/src/core/types.ts:87-96` e `web/src/types.ts:28-36`. Campos `?:`. `mapRawQuestoes()` não precisa mudar (campos opcionais). Ver "Pattern 4". |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Runner compartilhado do `claude -p` (spawn assinatura) | API / Backend (`server/src/core`) | — | Toda chamada de LLM via assinatura roda no processo Node do server; nunca no browser (sem credenciais no cliente). |
| Carregar `.md` canônico em runtime | API / Backend (`server/src/core/specialists`) | Filesystem | Leitura de arquivo do projeto — exclusivamente backend (browser não tem FS). |
| Interface `ImageProvider` + `SvgClaudeImageProvider` | API / Backend (`server/src/core/specialists`) | — | Geração de SVG via runner = chamada de LLM no backend. Isolada nesta fase (não plugada). |
| Factory `createImageProvider()` | API / Backend | — | Seleção de implementação no startup do server (espelha `createProvider()`). |
| `.claude/skills/anki-*/SKILL.md` (autoria manual) | Ferramental Claude (fora do runtime do app) | — | Skills são consumidas pelo Claude Code interativo, NÃO pelo pipeline em runtime. Vivem na raiz do repo, não em `server/`. |
| Tipo `Questao` (campos novos) | Backend + Frontend (duplicado) | — | Tipo cruza a fronteira HTTP; precisa existir nos dois lados (anti-pattern conhecido, mantido nesta fase). |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `node:child_process` (`spawn`) | nativo (Node 24.15.0) | Spawn do `claude -p` | Já em uso em `cli-provider.ts:11`; runner reusa o mesmo mecanismo. |
| `node:fs` / `node:fs/promises` | nativo | Ler `.md` canônico em runtime | Padrão ESM; `index.ts:6` e `config.ts` já usam `node:fs` + `fileURLToPath`. |
| `node:url` (`fileURLToPath`, `import.meta.url`) | nativo | Resolver path do módulo em ESM `NodeNext` | Já usado em `config.ts:6-8` e `index.ts:7-10` — padrão estabelecido do projeto. |
| `node:path` | nativo | Compor/normalizar paths | Já em uso amplo. |
| `claude` CLI | 2.1.161 (verificado no PATH) | Geração via assinatura Pro/Max | Decisão durável do usuário: assinatura, nunca API por token. |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `tsx` | ^4.20.6 (já dev dep) | Rodar smoke scripts (`.ts`) sem build | Modelo de validação do projeto (`smoke-cli.ts`, `smoke-loader.ts`). |
| `typescript` | declarado ^5.9.3; **instalado 6.0.3** | Compilar server | Ver "Open Questions" — divergência de versão. Build atual passa com 6.0.3. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `fs.readFile` resolvido em `src/` | `import` de string via plugin/loader (`--loader`, ou `with { type: 'text' }`) | Import de `.md` como string ainda é experimental/instável em Node 24 sob `NodeNext`; exigiria flag de runtime e quebraria `tsc` (sem typing). Rejeitado por D-05 "build verde". |
| `fs.readFile` resolvido em `src/` | Copiar `.md` para `dist/` num passo de build (`cp` pós-`tsc`) | Funciona, mas adiciona passo de build customizado e duplica o arquivo fisicamente em `dist/` (não é duplicação de fonte, mas é fragilidade). Aceitável como Plano B — ver "Pitfall 1". |
| `fs.readFile` resolvido em `src/` | Embed do texto via `const X = \`...\`` em `.ts` (gerado) | Reintroduz cópia do texto em `.ts` — fere "fonte única". Rejeitado. |
| `loadPrompt` síncrono (`readFileSync`) | `loadPrompt` assíncrono (`readFile`) + cache | Síncrono é mais simples e os `.md` são pequenos/lidos no boot/uso pontual; o runner já é async. Discrição do Claude — recomendo `readFileSync` com cache em Map (carrega 1x). |

**Installation:**
```bash
# Nenhum pacote novo. Fase de andaime usa apenas APIs nativas do Node + libs já instaladas.
```

**Version verification (executado nesta sessão):**
- `node --version` → `v24.15.0` [VERIFIED: shell]
- `claude --version` → `2.1.161 (Claude Code)` [VERIFIED: shell]
- `tsc --version` (resolvido localmente) → `6.0.3` [VERIFIED: shell] — diverge do `^5.9.3` em `package.json` (ver Open Questions)

## Package Legitimacy Audit

**N/A — esta fase não instala nenhum pacote externo.** É refatoração + arquivos novos + extensão de tipos, usando apenas módulos nativos do Node (`child_process`, `fs`, `path`, `url`) e dependências já presentes (`tsx`, `typescript`). Nenhum `npm install` necessário. Não há vetor de slopsquatting/hallucination nesta fase.

## Architecture Patterns

### System Architecture Diagram

```text
                    ┌──────────────────────────────────────────────┐
  ENTRADA (fase 1   │  .claude/skills/anki-<nome>/SKILL.md          │
  só cria; não      │  (autoria manual; consumida pelo Claude Code  │
  pluga no runtime) │   INTERATIVO, fora do pipeline do app)        │
                    │                                               │
                    │   frontmatter: name + description             │
                    │   corpo: "quando usar" + REFERÊNCIA por path  │
                    └───────────────────────┬───────────────────────┘
                                            │ aponta (não copia) para
                                            ▼
                    ┌──────────────────────────────────────────────┐
   FONTE ÚNICA  ◄───┤  server/src/core/specialists/prompts/         │
   (1 arquivo por   │    <nome>.md   ← ÚNICA cópia do texto          │
    especialista)   └───────────────────────┬───────────────────────┘
                                            │ lido em runtime por
                                            ▼
   ┌─────────────────────────────────────────────────────────────────────┐
   │  server/src/core/specialists/   (NOVO módulo)                        │
   │                                                                       │
   │   prompt-loader.ts ──► loadPrompt(nome): string  (resolve em src/)   │
   │                                                                       │
   │   runner.ts ──► runClaudeCli({systemPrompt,userMessage,model?})      │
   │        │            └── reusa spawn `claude -p` (flags assinatura)   │
   │        │                                                             │
   │   image-provider.ts ──► interface ImageProvider                      │
   │        │                 SvgClaudeImageProvider.generate(...)        │
   │        │                   └── usa runner + loadPrompt('mnemonic-    │
   │        │                        image')  [stub: não plugado]         │
   │        └── createImageProvider() → svg-claude (default)              │
   └───────────────────────────────┬───────────────────────────────────┘
                                   │ runClaudeCli() também usado por
                                   ▼
   ┌─────────────────────────────────────────────────────────────────────┐
   │  server/src/core/providers/cli-provider.ts  (REFATORADO)            │
   │    CliProvider.invoke()  agora delega para runClaudeCli()           │
   │    → MESMO comportamento observável (sem regressão)                  │
   └─────────────────────────────────────────────────────────────────────┘

   ── SEM ALTERAÇÃO DE COMPORTAMENTO nesta fase ──
   generation.ts (generateAll) · exporters (csv/ankiconnect) · pipeline HTTP
   Tipo Questao: +4 campos opcionais (server + web) — ignorados quando ausentes
```

### Recommended Project Structure
```text
ankinator-app/server/src/core/specialists/   # NOVO
├── runner.ts              # runClaudeCli({systemPrompt,userMessage,model?})
├── prompt-loader.ts       # loadPrompt(nome) → lê .md canônico (cache em Map)
├── image-provider.ts      # interface ImageProvider + SvgClaudeImageProvider + createImageProvider()
└── prompts/               # FONTE ÚNICA do texto dos especialistas
    ├── anki-orchestrator.md
    ├── deck-classifier.md
    ├── card-builder.md
    ├── mnemonic.md
    └── mnemonic-image.md

.claude/skills/            # NOVO (não existe ainda na raiz do worktree)
├── anki-orchestrator/SKILL.md
├── deck-classifier/SKILL.md
├── card-builder/SKILL.md
├── mnemonic/SKILL.md
└── mnemonic-image/SKILL.md

# REFATORADOS (mesmo comportamento):
ankinator-app/server/src/core/providers/cli-provider.ts   # invoke() → delega runClaudeCli()

# ESTENDIDOS (campos opcionais):
ankinator-app/server/src/core/types.ts     # Questao + deck?/tags?/mnemonico?/mnemonicoSvg?
ankinator-app/web/src/types.ts             # mesma mudança (espelho manual)

# OPCIONAL (recomendado): smoke scripts
ankinator-app/server/src/scripts/smoke-runner.ts   # molde: smoke-cli.ts
```

### Pattern 1: Extrair função reutilizável de spawn (Extract Function / Strangler interno)
**What:** Mover o corpo de `CliProvider.invoke()` (`cli-provider.ts:43-98`) para uma função livre `runClaudeCli()` em `specialists/runner.ts`, parametrizando `systemPrompt` (hoje fixo em `SYSTEM_FIDELITY`). O `CliProvider` passa a chamar `runClaudeCli({ systemPrompt: SYSTEM_FIDELITY, userMessage, model })`.
**When to use:** Sempre que precisar reuso sem mudar comportamento observável (D-01). Critério de "sem regressão": os flags, o `cwd: os.tmpdir()`, o `env`, o timeout e o parse do envelope `CliEnvelope` devem ficar idênticos.
**Example:** ver "Code Examples → runner.ts".

### Pattern 2: Fonte única via progressive disclosure (Skill aponta, não copia)
**What:** A `SKILL.md` contém só frontmatter (`name`/`description`) + um corpo curto "quando usar" + uma instrução de **referência por path** ao `.md` canônico. O Claude Code lê o arquivo referenciado sob demanda (via bash) — confirmado em docs oficiais [CITED: code.claude.com/docs/en/skills "Add supporting files" / platform.claude.com Level 3].
**When to use:** Para todos os 5 especialistas (D-06). Evita o anti-pattern de cópia divergente.
**Duas técnicas válidas** (escolha do Claude no plano):
1. **Referência textual repo-relativa (recomendada):** corpo da SKILL.md diz: *"O conteúdo canônico vive em `ankinator-app/server/src/core/specialists/prompts/<nome>.md`. Leia esse arquivo e siga-o como sua especificação."* Funciona porque o Claude Code resolve paths repo-relativos via bash/Read. Zero duplicação, zero dialog de aprovação extra.
2. **`@import` repo-relativo:** `@ankinator-app/server/src/core/specialists/prompts/<nome>.md` — o Claude Code expande imports `@path` (até 5 hops). Para arquivos FORA do diretório da skill, dispara um **dialog de aprovação** na primeira vez [CITED: WebSearch verificado]. Mais "automático" mas com fricção de aprovação.
> Recomendação: técnica (1) — instrução textual de path. É a mais robusta e sem fricção; o `.md` permanece a única fonte do texto.

### Pattern 3: Factory de provider espelhando `createProvider()`
**What:** `createImageProvider()` segue o shape de `providers/index.ts:21-27` — função pura que retorna a interface, com `svg-claude` como default e um TODO documentado para seleção futura por env (D-10).
**When to use:** SPEC-04. A interface `ImageProvider` fica desacoplada do runner (recebe-o por parâmetro ou importa `runClaudeCli`).

### Pattern 4: Extensão aditiva de tipo (campos opcionais)
**What:** Adicionar `deck?`, `tags?`, `mnemonico?`, `mnemonicoSvg?` como opcionais em ambos os `Questao`. Por serem `?:`, `mapRawQuestoes()` (`generation.ts:43-55`) e os exporters continuam compilando e funcionando sem tocá-los (D-13).
**When to use:** SPEC-05. Regra de ouro: a MESMA assinatura nos dois arquivos (server camelCase `mnemonicoSvg`, idêntico no web).

### Anti-Patterns to Avoid
- **Copiar o corpo do `.md` para dentro da `SKILL.md`:** cria duas fontes divergentes (mesmo erro do `Questao` duplicado). Use referência por path.
- **Resolver o `.md` via `import.meta.url` apontando para `dist/`:** o `.md` NÃO existe em `dist/` (build não copia). Quebra em produção (`node dist/index.js`). Ver "Pitfall 1".
- **Mudar comportamento do `CliProvider` ao refatorar:** qualquer alteração de flag, cwd, env ou parse é regressão. A refatoração deve ser comportamentalmente transparente.
- **Plugar `ImageProvider`/`enrichAll` no pipeline agora:** fora de escopo (fases 3–5). Nesta fase a impl existe mas não é chamada.
- **Tornar os campos novos de `Questao` obrigatórios:** quebraria geração/exportação atuais.
- **Usar "claude"/"anthropic" no `name` do frontmatter da Skill:** proibido pela spec (reserved words). Os 5 nomes (`anki-orchestrator`, `deck-classifier`, `card-builder`, `mnemonic`, `mnemonic-image`) estão OK.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Spawn + parse do `claude -p` | Novo wrapper de subprocess | Extrair de `cli-provider.ts:43-98` | O parse do envelope `CliEnvelope`, o tratamento de timeout/SIGKILL, o fallback de "texto puro" e a mensagem de erro "está instalado e logado?" já estão maduros. Reescrever = regressão. |
| Resolver path de módulo em ESM | `__dirname` manual / hacks de cwd | `fileURLToPath(import.meta.url)` | Padrão já estabelecido em `config.ts:6-8` e `index.ts:7-10`. `__dirname` não existe em ESM. |
| Carregar `.env` | dotenv | `process.loadEnvFile()` (Node 22+) | Já em uso em `config.ts:15`. (Não é tarefa desta fase, mas vale o registro.) |
| Parse de JSON de saída livre do LLM | Novo parser | `parseQuestoesJson()` (`generation.ts:58`) | Já tolera cercas ```` ```json ````. Reusar quando o runner devolver JSON de questões. |
| Validação de input de runtime | Checks ad-hoc | `zod` ^4.1.12 (já instalado) | Convenção do projeto para schemas (se o runner precisar validar saída estruturada nas fases futuras). Nesta fase, opcional. |

**Key insight:** O codebase já resolveu spawn, parse e resolução de path ESM. A fase é 90% movimentação/reuso de código existente e 10% arquivos novos. O risco está em **introduzir regressão durante o reuso**, não em construir algo novo.

## Runtime State Inventory

> Fase de refatoração/criação. Inventário de estado fora dos arquivos do repo:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | **Nenhum** — verificado: store é in-memory (`store.ts`, Maps `docs`/`jobs`), sem DB, sem chaves persistidas. Os 5 nomes de especialista são novos (não há dado legado com esses nomes). | Nenhuma migração de dados. |
| Live service config | **Nenhum** relevante a esta fase — os env vars existentes (`ANKINATOR_CLAUDE_BIN`, `ANKINATOR_CLI_TIMEOUT_MS`, `ANKINATOR_CLI_MODEL`) são REUSADOS sem renomear (D-03). MCP server (`ankinator-mcp`) é path legado, não tocado aqui. | Nenhuma. |
| OS-registered state | **Nenhum** — sem Task Scheduler/launchd/systemd/pm2. App roda via `npm start`/`tsx`. | Nenhuma. |
| Secrets/env vars | Nenhum segredo novo. `ANTHROPIC_API_KEY` NÃO é usado pelo path de assinatura (CLI). Nenhuma chave renomeada. | Nenhuma. |
| Build artifacts | `ankinator-app/server/dist/` está **stale**: contém `dist/core/question-generator.js` que não existe mais em `src/` (resíduo). Após esta fase, um `npm run build` limpo é recomendado. **Crítico:** `dist/` NÃO conterá os `.md` novos (build `tsc` puro não copia `.md`) — isso É a base do Pitfall 1. | Recomendar `rm -rf dist && npm run build` na validação; garantir que `loadPrompt` resolva em `src/`, não `dist/`. |

## Common Pitfalls

### Pitfall 1: `.md` canônico ausente em produção (`dist/`)
**What goes wrong:** `loadPrompt()` lê o `.md` com path relativo a `import.meta.url`. Em dev (`tsx`) o módulo roda de `src/` e o `.md` está lá → funciona. Em produção (`node dist/index.js`) o módulo roda de `dist/core/specialists/` e o `.md` **não existe ali** → `ENOENT` em runtime.
**Why it happens:** O build do server é `tsc -p tsconfig.json` puro. Verificado empiricamente: `find ankinator-app/server/dist -name '*.md'` retorna VAZIO; `tsc` só emite `.js`/`.map`/`.d.ts`. Não há passo de cópia de assets. [VERIFIED: shell]
**How to avoid (recomendado):** `loadPrompt()` resolve o `.md` a partir da árvore **`src/`** independentemente de onde o `.js` roda. Estratégia: a partir de `fileURLToPath(import.meta.url)`, subir diretórios até encontrar um pai chamado `src` (ou que contenha `src/core/specialists/prompts/`), e ler `src/core/specialists/prompts/<nome>.md`. Como `src/` é versionado e acompanha o deploy (este é um app local single-user; `src/` está sempre presente), isso funciona em dev e em prod.
**How to avoid (Plano B):** adicionar passo pós-build que copia `prompts/*.md` para `dist/core/specialists/prompts/` (ex.: `"build": "tsc -p tsconfig.json && node -e \"...copy...\""` ou `cpy`/`shx`). Aí `loadPrompt` resolve relativo a `import.meta.url` normalmente. Custo: passo de build extra + arquivo fisicamente em 2 lugares (não é duplicação de FONTE, mas é manutenção).
**Warning signs:** build verde mas `npm start` (prod) quebra ao carregar especialista; `ENOENT ... prompts/<nome>.md`. Sempre testar AMBOS os modos (`tsx` e `node dist`).
**Confiança:** ALTA — verificado diretamente no `dist/` existente.

### Pitfall 2: Regressão silenciosa no `CliProvider` ao extrair o runner
**What goes wrong:** Ao mover `invoke()`, um flag, o `cwd: os.tmpdir()`, o `env: {...process.env}`, o `timeout` ou o fallback de "texto puro" muda sutilmente → geração atual degrada (ex.: o CLI carrega `CLAUDE.md` do projeto porque `cwd` mudou; ou perde `--exclude-dynamic-system-prompt-sections`).
**Why it happens:** Refatoração "Extract Function" é mecânica mas fácil de errar nos detalhes que não têm teste automatizado (não há suite hoje).
**How to avoid:** Diff comportamental: o array `args` final, `cwd`, `env`, `CALL_TIMEOUT_MS` e o parse de `CliEnvelope` devem ser byte-a-byte equivalentes. Rodar `smoke-cli.ts` ANTES e DEPOIS com o mesmo PDF e comparar contagem/forma das questões. O `systemPrompt` antes era hardcoded `SYSTEM_FIDELITY`; agora vira parâmetro — o `CliProvider` deve passar exatamente `SYSTEM_FIDELITY`.
**Warning signs:** questões somem, vêm com formato diferente, ou erro novo do CLI.
**Confiança:** ALTA.

### Pitfall 3: `name` de Skill com palavra reservada / formato inválido
**What goes wrong:** Frontmatter `name` contendo "claude"/"anthropic", maiúsculas, ou >64 chars → Skill inválida.
**Why it happens:** Spec restritiva [CITED: platform.claude.com agent-skills/overview]: `name` ≤64 chars, só `[a-z0-9-]`, sem "anthropic"/"claude"; `description` ≤1024 chars (e a soma `description`+`when_to_use` é truncada em ~1.536 chars no listing).
**How to avoid:** Os 5 nomes (`anki-orchestrator`, etc.) já passam. Manter `description` curta e focada no caso de uso. O **nome da pasta** vira o comando `/anki-orchestrator` (frontmatter `name` é só display em `.claude/skills/`).
**Warning signs:** Skill não aparece no `/` menu ou erro de validação.
**Confiança:** ALTA.

### Pitfall 4: `Questao` divergente entre server e web
**What goes wrong:** Adicionar os 4 campos só no server (ou com nome/typo diferente no web) → erro de tipo no fetch/render ou drift silencioso.
**Why it happens:** Tipo duplicado manualmente (anti-pattern conhecido, `ARCHITECTURE.md`).
**How to avoid:** Aplicar exatamente a mesma assinatura nos dois arquivos na MESMA tarefa/commit. Web tem `noUnusedLocals`/`noUnusedParameters: true` no tsconfig — não afeta campos de interface, mas afeta qualquer stub de função (ver Pitfall 5).
**Warning signs:** `tsc -b` do web falha, ou campo presente no server e ausente no web.
**Confiança:** ALTA.

### Pitfall 5: Stub do `ImageProvider` quebrando `noUnusedParameters` no build
**What goes wrong:** Se a impl `SvgClaudeImageProvider.generate(mnemonic, context)` for um stub que ignora parâmetros, o **web** tsconfig (`noUnusedParameters: true`) reclamaria — MAS o `ImageProvider` vive no **server**, cujo tsconfig NÃO tem `noUnusedParameters`. Risco baixo, mas se algum stub for colocado no web por engano, falha.
**Why it happens:** Configs de strictness divergem (server: `strict`; web: `strict` + `noUnused*`).
**How to avoid:** Manter `ImageProvider` 100% no server (D-08 já manda isso). Se a impl for stub mas usar o runner+prompt de fato (D-09 diz "pode existir"), use os parâmetros — sem stub vazio.
**Warning signs:** `tsc` falha por parâmetro/local não usado.
**Confiança:** MÉDIA (depende de onde o stub é colocado).

## Code Examples

### `specialists/runner.ts` — função extraída de `cli-provider.ts`
```typescript
// Fonte do mecanismo: ankinator-app/server/src/core/providers/cli-provider.ts:43-98 (verificado)
// Mantém flags de assinatura idênticos (D-02): --exclude-dynamic-system-prompt-sections, --strict-mcp-config
import { spawn } from 'node:child_process';
import os from 'node:os';

const CLI_BIN = process.env.ANKINATOR_CLAUDE_BIN?.trim() || 'claude';
const CALL_TIMEOUT_MS = Number(process.env.ANKINATOR_CLI_TIMEOUT_MS) || 180_000;

export interface RunClaudeCliInput {
  systemPrompt: string;
  userMessage: string;
  model?: string; // default vem de ANKINATOR_CLI_MODEL via chamador
}

interface CliEnvelope { is_error?: boolean; result?: string; error?: string }

/** Executa `claude -p` (assinatura) e devolve o texto do envelope JSON. */
export function runClaudeCli({ systemPrompt, userMessage, model = 'sonnet' }: RunClaudeCliInput): Promise<string> {
  return new Promise((resolve, reject) => {
    const args = [
      '-p', '--output-format', 'json', '--model', model,
      '--system-prompt', systemPrompt,
      '--exclude-dynamic-system-prompt-sections',
      '--strict-mcp-config',
    ];
    const child = spawn(CLI_BIN, args, { cwd: os.tmpdir(), stdio: ['pipe', 'pipe', 'pipe'], env: { ...process.env } });
    let stdout = ''; let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`Tempo esgotado (${CALL_TIMEOUT_MS}ms) ao chamar o claude CLI.`));
    }, CALL_TIMEOUT_MS);
    child.stdout.on('data', (d) => (stdout += d.toString()));
    child.stderr.on('data', (d) => (stderr += d.toString()));
    child.on('error', (err) => { clearTimeout(timer); reject(new Error(`Falha ao executar "${CLI_BIN}": ${err.message}. O Claude Code está instalado e logado?`)); });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) return reject(new Error(`claude CLI saiu com código ${code}. ${stderr.slice(-300)}`));
      try {
        const env = JSON.parse(stdout) as CliEnvelope;
        if (env.is_error) return reject(new Error(`claude CLI: ${env.error || env.result || 'erro desconhecido'}`));
        resolve(env.result ?? '');
      } catch { resolve(stdout); } // fallback: alguns builds imprimem texto puro
    });
    child.stdin.write(userMessage);
    child.stdin.end();
  });
}
```

### `cli-provider.ts` refatorado — delega ao runner (sem mudar comportamento)
```typescript
// invoke() agora chama runClaudeCli com systemPrompt = SYSTEM_FIDELITY (idêntico ao antes)
import { runClaudeCli } from '../specialists/runner.js'; // .js obrigatório (NodeNext)
// ...
private invoke(userMessage: string, model: string): Promise<string> {
  return runClaudeCli({ systemPrompt: SYSTEM_FIDELITY, userMessage, model });
}
```

### `specialists/prompt-loader.ts` — carregar `.md` resolvendo em `src/` (robusto p/ dev e prod)
```typescript
// Resolve a árvore src/ subindo de import.meta.url; evita o ENOENT do dist (Pitfall 1).
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const cache = new Map<string, string>();

/** Encontra o diretório .../src subindo a partir do módulo atual. */
function findSrcRoot(): string {
  let dir = path.dirname(fileURLToPath(import.meta.url)); // dev: .../src/core/specialists ; prod: .../dist/core/specialists
  // Em prod (dist), troca o último segmento 'dist' por 'src'.
  const parts = dir.split(path.sep);
  const idx = parts.lastIndexOf('dist');
  if (idx !== -1) { parts[idx] = 'src'; return parts.slice(0, idx + 1).join(path.sep) + path.sep + 'core' + path.sep + 'specialists'; }
  return dir; // já está em src/
}

export function loadPrompt(nome: string): string {
  if (cache.has(nome)) return cache.get(nome)!;
  const base = findSrcRoot();
  const file = path.join(base, 'prompts', `${nome}.md`);
  const text = readFileSync(file, 'utf8');
  cache.set(nome, text);
  return text;
}
```
> Nota p/ o planner: a heurística `dist→src` acima é uma das opções. Alternativa mais explícita: subir até achar `package.json` do server e compor `src/core/specialists/prompts`. Decidir no plano; o invariante é "ler de `src/`, nunca de `dist/`".

### `specialists/image-provider.ts` — interface + impl svg-claude + factory
```typescript
import { runClaudeCli } from './runner.js';
import { loadPrompt } from './prompt-loader.js';

export interface ImageProvider {
  readonly nome: string;
  generate(mnemonic: string, context: string): Promise<{ svg: string }>;
}

export class SvgClaudeImageProvider implements ImageProvider {
  readonly nome = 'svg-claude';
  async generate(mnemonic: string, context: string): Promise<{ svg: string }> {
    const systemPrompt = loadPrompt('mnemonic-image');
    const userMessage = `Mnemônico: ${mnemonic}\n\nContexto: ${context}`;
    const svg = await runClaudeCli({ systemPrompt, userMessage });
    return { svg }; // sanitização real (sem <script>/URLs externas) é da fase 4 (IMG-02)
  }
}

// TODO(v2): selecionar provider raster por env quando IMGR-01 existir.
export function createImageProvider(): ImageProvider {
  return new SvgClaudeImageProvider();
}
```

### `.claude/skills/anki-orchestrator/SKILL.md` — referência (não cópia) ao canônico
```markdown
---
name: anki-orchestrator
description: Orquestra os especialistas Anki por-card (classificar deck, montar card, mnemônico, imagem). Use ao planejar/executar o enriquecimento educativo de flashcards do Ankinator.
---

# Anki Orchestrator

O conteúdo canônico (system prompt + conhecimento) deste especialista vive em
`ankinator-app/server/src/core/specialists/prompts/anki-orchestrator.md` — esta é a ÚNICA fonte.

Leia esse arquivo e siga-o como sua especificação. NÃO duplique o texto aqui.

## Quando usar
- Decidir, por card, quais estágios rodar (mnemônico/imagem só p/ memorização).
- Agregar resultados aplicando princípios Anki (atomicidade, evitar redundância).
```

### `Questao` estendido (server `types.ts` e web `types.ts` — idêntico)
```typescript
export interface Questao {
  id: string;
  tipo: 'extraida' | 'criada';
  pergunta: string;
  resposta: string;
  pageStart?: number;
  pageEnd?: number;
  metadata?: QuestaoMetadata;
  // ── SPEC-05 (opcionais; ignorados quando ausentes; embed real nas fases 3–4) ──
  deck?: string;          // hierarquia Anki "Matéria::Assunto::Subtópico"
  tags?: string[];        // banca, ano, nível, tema
  mnemonico?: string;     // texto do mnemônico
  mnemonicoSvg?: string;  // SVG autocontido do mnemônico
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Custom commands em `.claude/commands/*.md` | Skills em `.claude/skills/<nome>/SKILL.md` (commands merged into skills) | Claude Code recente | Use Skills (dir + frontmatter + arquivos de apoio); commands antigos ainda funcionam. |
| Embed de todo conhecimento na Skill | Progressive disclosure (SKILL.md referencia arquivos lidos sob demanda) | Agent Skills standard | Permite "fonte única": SKILL.md aponta para o `.md` canônico. |
| `__dirname`/CJS | `fileURLToPath(import.meta.url)` (ESM) | ESM `NodeNext` | Já é o padrão do projeto; manter. |

**Deprecated/outdated:**
- Import de `.md` como string via loader experimental: instável sob Node 24 + `tsc`; evitar nesta fase.
- `dist/core/question-generator.js`: artefato stale (arquivo-fonte não existe mais). Limpar com rebuild.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | A árvore `src/` está presente no ambiente de produção (app local single-user roda do checkout), permitindo `loadPrompt` resolver em `src/`. | Pitfall 1 / Code Examples | Se algum dia houver deploy "dist-only" sem `src/`, `loadPrompt` quebra → aí usar Plano B (copiar `.md` p/ `dist/` no build). Para o uso atual (local) é seguro. |
| A2 | A técnica de referência textual por path na SKILL.md (vs `@import`) é suficiente para "fonte única" sem fricção. | Pattern 2 | Baixo: se o usuário preferir auto-injeção, trocar para `@import` (com dialog de aprovação). Ambas atendem D-06. |
| A3 | O parse `JSON.parse(stdout)` do envelope `claude -p --output-format json` continua válido na v2.1.161. | runner.ts | Baixo: o código atual já depende disso e tem fallback de texto puro; o smoke valida. |
| A4 | Nenhum estágio é plugado no pipeline nesta fase (impl `ImageProvider` existe mas não é chamada). | Boundary | Travado por CONTEXT; risco nulo se respeitado. |

## Open Questions

1. **Divergência de versão do TypeScript (declarado ^5.9.3, instalado 6.0.3).**
   - What we know: `tsc --version` local = 6.0.3; `package.json` pede `^5.9.3`. Build atual aparentemente passa.
   - What's unclear: se o ambiente do executor terá 5.9.x ou 6.x; TS 6 tem mudanças de default.
   - Recommendation: rodar `npm ci` para travar na versão do lockfile antes de validar; não é bloqueante para esta fase, mas o plano deve checar `tsc` verde no ambiente real.

2. **Técnica final de `loadPrompt` (heurística `dist→src` vs busca por `package.json`).**
   - What we know: ambas resolvem em `src/`; é Claude's discretion (D-05).
   - What's unclear: qual é mais robusta no ambiente do usuário.
   - Recommendation: planner escolhe uma e o smoke-runner valida em modo `node dist` E `tsx`.

3. **`.claude/skills/` ainda não existe na raiz do worktree.**
   - What we know: `ls .claude/skills/` → não existe; criar 5 pastas.
   - What's unclear: nada — só criar. (Live change detection: criar o diretório top-level pode exigir restart do Claude Code para watch.)
   - Recommendation: criar as 5 pastas + SKILL.md numa tarefa; documentar que o usuário pode precisar reiniciar a sessão do Claude Code para a Skill aparecer.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Tudo | ✓ | v24.15.0 | — |
| `claude` CLI (assinatura) | Runner / SvgClaudeImageProvider (quando exercitado em smoke) | ✓ | 2.1.161 | — (sem fallback; é o requisito central) |
| `tsx` | Smoke scripts | ✓ | ^4.20.6 (dev dep) | rodar via `node` após build |
| `tsc` | Build do server | ✓ | 6.0.3 (instalado) / ^5.9.3 (declarado) | `npm ci` p/ alinhar ao lockfile |

**Missing dependencies with no fallback:** Nenhuma para a *implementação* (andaime é só código). O `claude` CLI só é exercitado se rodar o smoke do runner — e está presente.
**Missing dependencies with fallback:** divergência `tsc` 6.0.3 vs ^5.9.3 → `npm ci`.

## Validation Architecture

> Não há `.planning/config.json`; trato `nyquist_validation` como habilitado.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | **Nenhum framework de teste automatizado no projeto** (só testes vendados do `zod` em node_modules). Convenção atual = **smoke scripts** `.ts` rodados via `tsx`. |
| Config file | none — ver Wave 0 |
| Quick run command | `cd ankinator-app/server && npm run build` (gate de compilação) |
| Full suite command | `cd ankinator-app/server && tsx src/scripts/smoke-cli.ts <pdf>` (regressão do CLI) + smoke-runner novo |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SPEC-01 | `runClaudeCli` extraído gera questões idênticas ao `CliProvider` antigo | smoke (regressão) | `tsx ankinator-app/server/src/scripts/smoke-cli.ts <pdf>` (compara antes/depois) | ✅ existe (`smoke-cli.ts`) |
| SPEC-01 | runner invocável isoladamente devolve texto do CLI | smoke | `tsx ankinator-app/server/src/scripts/smoke-runner.ts` | ❌ Wave 0 (criar; molde = `smoke-cli.ts`) |
| SPEC-02 | `loadPrompt(nome)` lê os 5 `.md` em dev E prod | smoke + build | `tsx -e "import('...prompt-loader.js').then(m=>m.loadPrompt('mnemonic'))"` e idem após `npm run build` rodando de `dist` | ❌ Wave 0 |
| SPEC-03 | 5 `SKILL.md` existem, frontmatter válido, sem corpo duplicado | manual/lint | inspeção + grep "specialists/prompts/<nome>.md" em cada SKILL.md | ❌ Wave 0 (check de presença) |
| SPEC-04 | `createImageProvider()` retorna `SvgClaudeImageProvider`; tipa corretamente | build (tipo) | `cd ankinator-app/server && npm run build` | ✅ (build é o gate) |
| SPEC-05 | `Questao` compila com 4 campos novos em server E web; fluxo atual intacto | build (tipo) | `cd ankinator-app/server && npm run build` && `cd ankinator-app/web && npm run build` | ✅ (build é o gate) |
| PIPE-03 (guard) | Sem regressão: gerar+exportar continua funcionando | smoke E2E manual | upload→generate→export CSV no app | ✅ fluxo existente |

### Sampling Rate
- **Per task commit:** `npm run build` no workspace tocado (server e/ou web) — gate de compilação rápido (<30s).
- **Per wave merge:** `smoke-cli.ts <pdf>` (regressão do CLI) + `smoke-runner.ts`.
- **Phase gate:** `npm run build` verde nos DOIS workspaces + `node dist/index.js` sobe + `loadPrompt` resolve de `dist`-mode + smoke do CLI com mesmo PDF dá resultado equivalente ao baseline antes da refatoração.

### Wave 0 Gaps
- [ ] `ankinator-app/server/src/scripts/smoke-runner.ts` — exercita `runClaudeCli` isolado e `loadPrompt` dos 5 nomes (molde: `smoke-cli.ts`).
- [ ] Verificação cross-mode de `loadPrompt`: rodar uma vez via `tsx` (src) e uma vez via `node dist/...` (prod) para fechar o Pitfall 1.
- [ ] (Opcional, recomendado) Capturar baseline do `smoke-cli.ts` ANTES da refatoração do `CliProvider` para comparação pós-refatoração.
- Decisão sobre adotar framework (ex.: `node:test` nativo, zero-install) fica como sugestão fora de escopo — a convenção atual é smoke script e é suficiente para esta fase de andaime.

## Security Domain

> `security_enforcement` não configurado (sem `config.json`); trato como habilitado. App é local single-user, sem auth, sem rede pública.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | não | App local single-user; sem auth (por design). |
| V3 Session Management | não | Sem sessões. |
| V4 Access Control | não | Sem multiusuário. |
| V5 Input Validation | parcial | Nesta fase não há input externo novo no runtime (andaime). Fase 4 (IMG-02) fará sanitização de SVG. `zod` disponível se necessário. |
| V6 Cryptography | não | Sem cripto nesta fase. |

### Known Threat Patterns for este stack (relevantes ao andaime)

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Command/argument injection via `spawn` do `claude` | Tampering | Já mitigado: `spawn` com array de args (NÃO shell string) + prompt por **stdin** (não em arg). Manter ao extrair o runner — não montar comando como string. |
| SVG malicioso (`<script>`, URLs externas) embutido no card | Tampering / data exfiltration | **Fora de escopo nesta fase** (impl não plugada). Sanitização real é IMG-02 (fase 4). Documentar como TODO no `SvgClaudeImageProvider` para não esquecer. |
| Skill referenciando arquivo externo não confiável | Tampering | `SKILL.md` referencia apenas arquivos DO próprio repo (`server/src/core/specialists/prompts/`), fonte confiável. Sem fetch de URL externa. |
| Carregamento de path arbitrário em `loadPrompt` | Tampering | `loadPrompt(nome)` deve aceitar apenas nomes da allowlist dos 5 especialistas (não path do usuário). Validar `nome` contra a lista canônica antes do `readFileSync`. |

## Sources

### Primary (HIGH confidence)
- Codebase lido diretamente: `cli-provider.ts`, `providers/index.ts`, `generation.ts`, `types.ts` (server), `web/src/types.ts`, `config.ts`, `prompts.ts`, `api-provider.ts`, `index.ts` (server), `smoke-cli.ts`, `smoke-loader.ts`, `tsconfig.json` (server+web), `package.json` (server+app).
- Shell (verificado nesta sessão): `node v24.15.0`, `claude 2.1.161`, `tsc 6.0.3`, `find dist -name '*.md'` → vazio (build não copia `.md`), `.claude/skills/` inexistente, `dist/` stale (`question-generator.js`).
- `platform.claude.com/docs/en/agents-and-tools/agent-skills/overview` — frontmatter (`name`/`description`), constraints (name ≤64, sem "claude"/"anthropic"; description ≤1024), progressive disclosure (Levels 1–3).
- `code.claude.com/docs/en/skills` — `.claude/skills/<nome>/SKILL.md`, "Add supporting files", referência de arquivos por path, frontmatter reference (truncado em 1.536 chars no listing), live change detection.

### Secondary (MEDIUM confidence)
- WebSearch verificado: `@import` em SKILL.md suporta paths repo-relativos (até 5 hops) com dialog de aprovação p/ arquivos externos ao dir da skill (cruzado com docs oficiais de progressive disclosure).

### Tertiary (LOW confidence)
- Nenhuma afirmação crítica depende exclusivamente de fonte única não verificada.

## Metadata

**Confidence breakdown:**
- Standard stack: ALTA — sem pacotes novos; tudo nativo/já instalado, verificado no shell.
- Architecture: ALTA — código de origem lido linha a linha; padrões (factory, extract-function) já existem no repo.
- Pitfalls: ALTA — Pitfall 1 (dist sem `.md`) verificado empiricamente; demais decorrem de configs lidas.
- Skills spec (SPEC-03): ALTA — docs oficiais Anthropic/Claude Code.
- Validation: MÉDIA — não há framework de teste; recomendação baseada na convenção de smoke scripts do próprio projeto.

**Research date:** 2026-06-02
**Valid until:** ~2026-07-02 (estável; a única peça de movimento rápido é a spec de Skills do Claude Code — reconferir se a fase atrasar >30 dias).
