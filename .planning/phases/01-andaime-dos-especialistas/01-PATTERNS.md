# Fase 1: Andaime dos Especialistas - Mapa de Padrões

**Mapeado:** 2026-06-03
**Arquivos analisados:** 13 (8 novos, 3 modificados, 5 SKILL.md novos contam como 1 grupo)
**Analogs encontrados:** 11 / 11 (todos os arquivos de código têm analog no codebase; SKILL.md usa analog externo `~/.claude/skills`)

> Linguagem: pt-BR. Esta fase é PURO ANDAIME — sem ativar especialistas no pipeline, sem regressão do fluxo atual (upload→extract→gerar→exportar). Critério de pronto = build verde nos dois workspaces + fluxo intacto + estruturas no lugar.

## File Classification

| Arquivo novo/modificado | Role | Data Flow | Analog mais próximo | Qualidade do match |
|-------------------------|------|-----------|---------------------|--------------------|
| `ankinator-app/server/src/core/specialists/runner.ts` (NEW) | service (provider helper) | request-response (spawn + parse) | `ankinator-app/server/src/core/providers/cli-provider.ts` (`invoke()` linhas 43-98) | exato — código a EXTRAIR |
| `ankinator-app/server/src/core/providers/cli-provider.ts` (MODIFY) | provider | request-response | si mesmo (refator interno) | exato — delegar sem mudar comportamento |
| `ankinator-app/server/src/core/specialists/prompt-loader.ts` (NEW) | utility | file-I/O (readFileSync + cache) | `ankinator-app/server/src/config.ts` linhas 5-8 (`fileURLToPath`/`import.meta.url`) | role-match (resolução de path ESM) |
| `ankinator-app/server/src/core/specialists/prompts/{anki-orchestrator,deck-classifier,card-builder,mnemonic,mnemonic-image}.md` (NEW ×5) | config (asset de prompt) | data (texto canônico) | `ankinator-app/server/src/core/prompts.ts` (`SYSTEM_FIDELITY`, conteúdo de instrução) | partial — fonte do tom/idioma do prompt |
| `ankinator-app/server/src/core/specialists/image-provider.ts` (NEW) | service + factory | request-response | `ankinator-app/server/src/core/providers/index.ts` (`createProvider()` linhas 21-27) + `cli-provider.ts` (class impl) | exato (factory) + role-match (interface) |
| `.claude/skills/anki-{orchestrator,deck-classifier,card-builder,mnemonic,mnemonic-image}/SKILL.md` (NEW ×5) | config (ferramental Claude) | data (referência por path) | `~/.claude/skills/gsd-complete-milestone/SKILL.md` (formato frontmatter) | role-match (formato externo; ainda não há SKILL.md no repo) |
| `ankinator-app/server/src/core/types.ts` (MODIFY) | model | transform | si mesmo (`Questao` linhas 87-96) | exato — extensão aditiva |
| `ankinator-app/web/src/types.ts` (MODIFY) | model | transform | si mesmo (`Questao` linhas 28-36) | exato — espelho idêntico |
| `ankinator-app/server/src/scripts/smoke-runner.ts` (NEW) | test (smoke) | request-response | `ankinator-app/server/src/scripts/smoke-cli.ts` | exato — molde de smoke |

## Pattern Assignments

### `ankinator-app/server/src/core/specialists/runner.ts` (service, request-response)

**Analog:** `ankinator-app/server/src/core/providers/cli-provider.ts` — extrair o corpo de `invoke()` (linhas 43-98) para função livre `runClaudeCli()`, parametrizando o `systemPrompt` (hoje fixo em `SYSTEM_FIDELITY`).

**Imports pattern** (cli-provider.ts linhas 11-12):
```typescript
import { spawn } from 'node:child_process';
import os from 'node:os';
```

**Constantes de config — REUSAR os mesmos env vars (cli-provider.ts linhas 17-18; D-03):**
```typescript
const CLI_BIN = process.env.ANKINATOR_CLAUDE_BIN?.trim() || 'claude';
const CALL_TIMEOUT_MS = Number(process.env.ANKINATOR_CLI_TIMEOUT_MS) || 180_000;
```

**Envelope type a mover (cli-provider.ts linhas 20-26):**
```typescript
interface CliEnvelope {
  type?: string;
  subtype?: string;
  is_error?: boolean;
  result?: string;
  error?: string;
}
```

**Core pattern — spawn + parse a EXTRAIR byte-a-byte (cli-provider.ts linhas 44-97).** Invariantes de NÃO-regressão (Pitfall 2): manter idênticos o array `args` (`-p`, `--output-format json`, `--model`, `--system-prompt`, `--exclude-dynamic-system-prompt-sections`, `--strict-mcp-config`), o `cwd: os.tmpdir()`, `env: { ...process.env }`, o `timeout`/`SIGKILL`, e o fallback `catch { resolve(stdout); }`:
```typescript
const args = [
  '-p', '--output-format', 'json', '--model', model,
  '--system-prompt', systemPrompt,            // <- ERA SYSTEM_FIDELITY fixo; agora parâmetro
  '--exclude-dynamic-system-prompt-sections',
  '--strict-mcp-config',
];
const child = spawn(CLI_BIN, args, {
  cwd: os.tmpdir(),
  stdio: ['pipe', 'pipe', 'pipe'],
  env: { ...process.env },
});
// ... setTimeout(SIGKILL) / stdout / stderr / 'error' / 'close' idênticos ...
child.on('close', (code) => {
  clearTimeout(timer);
  if (code !== 0) { reject(new Error(`claude CLI saiu com código ${code}. ${stderr.slice(-300)}`)); return; }
  try {
    const env = JSON.parse(stdout) as CliEnvelope;
    if (env.is_error) { reject(new Error(`claude CLI: ${env.error || env.result || 'erro desconhecido'}`)); return; }
    resolve(env.result ?? '');
  } catch { resolve(stdout); }
});
child.stdin.write(userMessage);
child.stdin.end();
```

**Assinatura nova (D-02):** `runClaudeCli({ systemPrompt, userMessage, model? }): Promise<string>`. Retorna o `env.result` (texto). O parse de questões NÃO é responsabilidade do runner (fica em `parseQuestoesJson`).

**Segurança (manter):** spawn com array de args + prompt por STDIN (nunca em arg/shell string) — já mitiga command injection.

---

### `ankinator-app/server/src/core/providers/cli-provider.ts` (MODIFY — provider, request-response)

**Analog:** si mesmo. `invoke()` (linhas 43-98) some; o corpo vai para o runner. O método passa a delegar SEM mudar comportamento.

**Import novo (NodeNext exige extensão `.js`):**
```typescript
import { runClaudeCli } from '../specialists/runner.js';
```

**invoke() refatorado — passar exatamente `SYSTEM_FIDELITY` (linhas 43-98 → 1 linha):**
```typescript
private invoke(userMessage: string, model: string): Promise<string> {
  return runClaudeCli({ systemPrompt: SYSTEM_FIDELITY, userMessage, model });
}
```

**Não tocar:** `generateForChunk()` (linhas 37-41) continua chamando `this.invoke(...)` + `mapRawQuestoes(parseQuestoesJson(out), chunk)`. `SYSTEM_FIDELITY` segue importado de `../prompts.js`. `CliEnvelope` e `CLI_BIN`/`CALL_TIMEOUT_MS` saem deste arquivo (movidos para o runner).

---

### `ankinator-app/server/src/core/specialists/prompt-loader.ts` (utility, file-I/O)

**Analog:** `ankinator-app/server/src/config.ts` linhas 5-8 — padrão estabelecido de resolução de path em ESM `NodeNext`.

**Imports pattern (config.ts linhas 5-6 + fs):**
```typescript
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
```

**Resolução de path estabelecida (config.ts linha 8 — COPIAR esta forma; NUNCA `__dirname`):**
```typescript
const here = path.dirname(fileURLToPath(import.meta.url));
```

**Core pattern — `loadPrompt(nome)` com cache em Map, resolvendo em `src/` (Pitfall 1: build `tsc` NÃO copia `.md` para `dist/`):**
```typescript
const cache = new Map<string, string>();
// allowlist de segurança: só os 5 nomes canônicos (não path do usuário)
const NOMES = ['anki-orchestrator','deck-classifier','card-builder','mnemonic','mnemonic-image'] as const;

export function loadPrompt(nome: string): string {
  if (cache.has(nome)) return cache.get(nome)!;
  // ... resolve base em src/core/specialists (trocar 'dist' por 'src' quando em prod) ...
  const file = path.join(base, 'prompts', `${nome}.md`);
  const text = readFileSync(file, 'utf8');
  cache.set(nome, text);
  return text;
}
```

**Invariante crítico (Pitfall 1):** ler de `src/`, NUNCA de `dist/`. Heurística `dist→src` OU subir até `package.json` do server — Claude's discretion (D-05). Validar AMBOS os modos (`tsx` e `node dist`) no smoke.

**Segurança (Security Domain):** validar `nome` contra allowlist antes do `readFileSync` (evita path traversal).

---

### `ankinator-app/server/src/core/specialists/prompts/*.md` (config/asset ×5)

**Analog de tom/idioma:** `ankinator-app/server/src/core/prompts.ts` (`SYSTEM_FIDELITY` linha 14+) — system prompts em PT, foco em concurso público, instrução de fidelidade. Os 5 `.md` são a FONTE ÚNICA do texto de cada especialista; podem já conter o conhecimento, mas NÃO são chamados pelo pipeline nesta fase. Nomes canônicos travados (D-07): `anki-orchestrator`, `deck-classifier`, `card-builder`, `mnemonic`, `mnemonic-image`.

**Sem analog de conteúdo no repo** (são novos por natureza) — usar o domínio das instruções do projeto (CLAUDE.md: "texto normal → questões para estudo por questões; criar questões novas além de aproveitar prontas").

---

### `ankinator-app/server/src/core/specialists/image-provider.ts` (service + factory, request-response)

**Analog (factory):** `ankinator-app/server/src/core/providers/index.ts` (`createProvider()` linhas 21-27) — função pura que retorna a interface, default fixo, sem efeitos colaterais.
**Analog (class impl):** `ankinator-app/server/src/core/providers/cli-provider.ts` (`class CliProvider implements QuestionProvider` com `readonly nome`).

**Factory pattern a espelhar (index.ts linhas 21-27):**
```typescript
export function createProvider(cfg: ProviderConfig): QuestionProvider {
  if (cfg.kind === 'api') { /* ... */ }
  return new CliProvider(cfg.cliModel);   // <- default no fim
}
```
→ `createImageProvider()` retorna `new SvgClaudeImageProvider()` por default; seleção por env = TODO documentado (D-10), NÃO implementar raster (D-09).

**Imports (NodeNext `.js`):**
```typescript
import { runClaudeCli } from './runner.js';
import { loadPrompt } from './prompt-loader.js';
```

**Interface + impl (D-08/D-09):**
```typescript
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
    return { svg }; // TODO(IMG-02 fase 4): sanitizar SVG (remover <script>/URLs externas)
  }
}
```

**Cuidado (Pitfall 5):** usar `mnemonic`/`context` de fato (sem stub vazio). A interface fica 100% no server (server tsconfig NÃO tem `noUnusedParameters`; o web tem). NÃO plugar no pipeline (`generation.ts`/exporters) nesta fase.

---

### `.claude/skills/anki-*/SKILL.md` (config / ferramental Claude ×5)

**Analog de formato:** `~/.claude/skills/gsd-complete-milestone/SKILL.md` linhas 1-9 — frontmatter YAML.
> `.claude/skills/` ainda NÃO existe no worktree (criar 5 pastas). Vivem na RAIZ do repo, não em `server/`.

**Frontmatter pattern (do analog externo):**
```yaml
---
name: anki-orchestrator        # ≤64 chars, só [a-z0-9-], SEM "claude"/"anthropic"
description: "..."             # ≤1024 chars, curta e focada no caso de uso
---
```

**Corpo — REFERÊNCIA por path, NÃO cópia (Pattern 2, técnica recomendada; D-06):**
```markdown
# Anki Orchestrator

O conteúdo canônico (system prompt + conhecimento) deste especialista vive em
`ankinator-app/server/src/core/specialists/prompts/anki-orchestrator.md` — esta é a ÚNICA fonte.
Leia esse arquivo e siga-o como sua especificação. NÃO duplique o texto aqui.

## Quando usar
- ...
```

**Anti-pattern proibido:** copiar o corpo do `.md` para dentro da SKILL.md (cria duas fontes divergentes — mesmo erro do `Questao` duplicado). Usar referência textual por path (progressive disclosure).

---

### `ankinator-app/server/src/core/types.ts` (MODIFY — model, transform)

**Analog:** si mesmo, `interface Questao` linhas 87-96. Extensão ADITIVA (4 campos opcionais — D-11), inserir após `metadata?` (linha 95):
```typescript
export interface Questao {
  id: string;
  tipo: 'extraida' | 'criada';
  pergunta: string;
  resposta: string;
  pageStart?: number;
  pageEnd?: number;
  metadata?: QuestaoMetadata;
  // ── SPEC-05 (opcionais; ignorados quando ausentes; embed real nas fases 3-4) ──
  deck?: string;          // hierarquia Anki "Matéria::Assunto::Subtópico"
  tags?: string[];        // banca, ano, nível, tema
  mnemonico?: string;     // texto do mnemônico
  mnemonicoSvg?: string;  // SVG autocontido do mnemônico
}
```
**Não tocar:** `mapRawQuestoes()` (generation.ts linhas 43-55) — campos opcionais não exigem mudança; compila intacto (D-13).

---

### `ankinator-app/web/src/types.ts` (MODIFY — model, transform)

**Analog:** si mesmo, `interface Questao` linhas 28-36. ESPELHO EXATO da mudança do server, MESMA tarefa/commit (Pitfall 4 — tipo duplicado manual). Inserir os MESMOS 4 campos após `metadata?` (linha 35) com assinatura idêntica (camelCase `mnemonicoSvg`):
```typescript
export interface Questao {
  id: string;
  tipo: 'extraida' | 'criada';
  pergunta: string;
  resposta: string;
  pageStart?: number;
  pageEnd?: number;
  metadata?: QuestaoMetadata;
  deck?: string;
  tags?: string[];
  mnemonico?: string;
  mnemonicoSvg?: string;
}
```
**Cuidado (web tsconfig):** `noUnusedLocals`/`noUnusedParameters: true` — não afeta campos de interface, mas afeta qualquer stub de função (não há stub aqui).

---

### `ankinator-app/server/src/scripts/smoke-runner.ts` (test/smoke, request-response)

**Analog:** `ankinator-app/server/src/scripts/smoke-cli.ts` — molde de smoke (argv guard, timing, log PT, top-level await).

**Estrutura a copiar (smoke-cli.ts linhas 1-23):**
```typescript
/**
 * Smoke-test do runner de especialista + prompt-loader.
 * Uso: tsx src/scripts/smoke-runner.ts
 */
import { runClaudeCli } from '../core/specialists/runner.js';
import { loadPrompt } from '../core/specialists/prompt-loader.js';

// 1) loadPrompt dos 5 nomes (valida Pitfall 1 — rodar via tsx E node dist)
for (const nome of ['anki-orchestrator','deck-classifier','card-builder','mnemonic','mnemonic-image']) {
  const p = loadPrompt(nome);
  console.log(`✓ ${nome}.md (${p.length}c)`);
}
// 2) runner isolado devolve texto do CLI
const t0 = Date.now();
const out = await runClaudeCli({ systemPrompt: 'Responda apenas "ok".', userMessage: 'ping' });
console.log(`runner: "${out.trim().slice(0,40)}" em ${((Date.now()-t0)/1000).toFixed(1)}s`);
```
**Convenções do molde:** import com extensão `.js`, `process.argv`/`process.exit(1)` para guards, logs em PT com `console.log`, top-level `await` (ESM).

## Shared Patterns

### Resolução de path em ESM `NodeNext`
**Source:** `ankinator-app/server/src/config.ts` linha 8 (também `index.ts` linha 12)
**Apply to:** `prompt-loader.ts` (e qualquer leitura de asset do server)
```typescript
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
```
> `__dirname` NÃO existe em ESM — sempre `fileURLToPath(import.meta.url)`.

### Imports relativos exigem extensão `.js`
**Source:** convenção em todo `server/src` (ex.: `cli-provider.ts` linhas 13-15: `'../types.js'`, `'../prompts.js'`, `'../generation.js'`)
**Apply to:** TODOS os novos arquivos do server (`runner.ts`, `prompt-loader.ts`, `image-provider.ts`, `smoke-runner.ts`, e o import novo no `cli-provider.ts`)
```typescript
import { runClaudeCli } from '../specialists/runner.js'; // .js mesmo importando .ts (NodeNext)
```

### Factory por seleção, default no fim
**Source:** `ankinator-app/server/src/core/providers/index.ts` linhas 21-27 (`createProvider`)
**Apply to:** `createImageProvider()` em `image-provider.ts`
> Função pura, sem efeitos; ramo especial primeiro, default `new SvgClaudeImageProvider()` no fim; seleção por env = TODO documentado.

### Spawn seguro do `claude` (assinatura, não API key)
**Source:** `ankinator-app/server/src/core/providers/cli-provider.ts` linhas 44-97
**Apply to:** `runner.ts` (e por transitividade `cli-provider.ts` refatorado, `image-provider.ts`)
> `spawn(CLI_BIN, args[], {cwd: os.tmpdir(), env: {...process.env}})` + prompt por STDIN + parse de `CliEnvelope` com fallback de texto puro + timeout/SIGKILL. Mantém os flags de assinatura (`--exclude-dynamic-system-prompt-sections`, `--strict-mcp-config`). NUNCA montar comando como shell string. Reusa env vars existentes (`ANKINATOR_CLAUDE_BIN`, `ANKINATOR_CLI_TIMEOUT_MS`, `ANKINATOR_CLI_MODEL`).

### Smoke script como teste (sem framework)
**Source:** `ankinator-app/server/src/scripts/smoke-cli.ts` + `smoke-loader.ts`
**Apply to:** `smoke-runner.ts`
> Não há framework de teste no projeto; smoke `.ts` via `tsx` é a convenção. Gate de compilação por commit = `npm run build` (server: `tsc -p tsconfig.json`; start: `node dist/index.js`).

## No Analog Found

Nenhum arquivo de código sem analog. Observações:

| Arquivo | Role | Motivo |
|---------|------|--------|
| `.claude/skills/anki-*/SKILL.md` (×5) | config (ferramental Claude) | Não há SKILL.md DENTRO do repo; analog vem de `~/.claude/skills/*/SKILL.md` (formato externo) + docs oficiais. Diretório `.claude/skills/` é novo — criar 5 pastas. |
| `specialists/prompts/*.md` (×5) | asset | Conteúdo é novo por natureza; tom/idioma herdado de `prompts.ts` (`SYSTEM_FIDELITY`) e das instruções do projeto (CLAUDE.md). |

## Metadata

**Escopo de busca de analogs:** `ankinator-app/server/src/core/`, `ankinator-app/server/src/core/providers/`, `ankinator-app/server/src/`, `ankinator-app/server/src/scripts/`, `ankinator-app/web/src/`, `~/.claude/skills/`
**Arquivos lidos:** `cli-provider.ts`, `providers/index.ts`, `types.ts` (server+web), `smoke-cli.ts`, `smoke-loader.ts`, `generation.ts`, `config.ts`, `index.ts`, `gsd-complete-milestone/SKILL.md`; greps em `prompts.ts`, `ocr-loader.ts`, `tsconfig.json` (server+web), `package.json`
**Estado verificado:** `.claude/skills/` inexistente; `ankinator-app/server/src/core/specialists/` inexistente; server `module/moduleResolution: NodeNext`, `strict: true`, SEM `noUnused*`; web `moduleResolution: Bundler`, `strict + noUnusedLocals + noUnusedParameters`
**Data de extração:** 2026-06-03
