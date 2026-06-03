# Phase 3: Classificador de Deck + Card Educativo — Pattern Map

**Mapped:** 2026-06-03
**Files analyzed:** 12 (4 novos + 8 modificados)
**Analogs found:** 12 / 12

---

## File Classification

| Arquivo Novo/Modificado | Role | Data Flow | Analog Mais Próximo | Qualidade |
|-------------------------|------|-----------|---------------------|-----------|
| `server/src/core/specialists/enrich.ts` | service | request-response (LLM) | `server/src/core/generation.ts` | exact — mesmo loop+isolamento, mesmo provider |
| `server/src/core/specialists/enrich.test.ts` | test | transform | sem analog (vitest novo) | no-analog |
| `server/src/scripts/guard-enrich.ts` | utility | request-response | `server/src/scripts/guard-default-loader.ts` | exact |
| `server/src/scripts/smoke-enrich.ts` | utility | request-response | `server/src/scripts/smoke-runner.ts` | exact |
| `server/src/store.ts` | model | event-driven | (próprio arquivo — extensão aditiva) | self |
| `server/src/api.ts` | controller | request-response | (próprio arquivo — wiring no `.then()`) | self |
| `server/src/core/exporters/csv.ts` | service | transform | (próprio arquivo — extensão aditiva) | self |
| `server/src/core/exporters/ankiconnect.ts` | service | request-response | (próprio arquivo — extensão aditiva) | self |
| `server/src/core/types.ts` | model | — | (próprio arquivo — adicionar campos em `GenerateOptions`) | self |
| `web/src/types.ts` | model | — | `server/src/core/types.ts` | exact (espelho) |
| `web/src/App.tsx` | component | event-driven | (próprio arquivo — adicionar listener SSE) | self |
| `web/src/components/StructurePanel.tsx` | component | request-response | (próprio arquivo — adicionar bloco "Modo educativo") | self |
| `web/src/components/ProgressPanel.tsx` | component | event-driven | (próprio arquivo — adicionar fase enrich) | self |
| `web/src/components/CardTable.tsx` | component | transform | (próprio arquivo — adicionar badges deck+tags) | self |

---

## Pattern Assignments

### `server/src/core/specialists/enrich.ts` (service, request-response)

**Analog:** `server/src/core/generation.ts`

**Imports pattern** (generation.ts linhas 12–13):
```typescript
import crypto from 'node:crypto';
import type { GenerateOptions, Questao, SemanticChunk } from './types.js';
```
Para `enrich.ts`, trocar `SemanticChunk/GenerateOptions` por `Questao` e o novo `EnrichOpts`:
```typescript
import type { Questao } from '../types.js';
import { runClaudeCli } from './runner.js';
import { loadPrompt } from './prompt-loader.js';
```

**Tipos de interface** (generation.ts linhas 15–26):
```typescript
export interface ChunkProgress {
  index: number;
  total: number;
  sectionTitles: string[];
  questoesNoBloco: number;
  erro?: string;
}

export interface GenerateResult {
  questoes: Questao[];
  erros: { chunkIndex: number; mensagem: string }[];
}
```
Para `enrich.ts` criar análogos:
```typescript
export interface EnrichProgress {
  estagio: 'classificando' | 'reescrevendo';
  index: number;
  total: number;
  erro?: string;
}

export interface EnrichOpts {
  classificar?: boolean;
  cardBuilder?: boolean;
}
```

**Core pattern — loop com isolamento de erro** (generation.ts linhas 74–97):
```typescript
export async function generateAll(
  provider: QuestionProvider,
  chunks: SemanticChunk[],
  opts: GenerateOptions,
  onProgress?: (p: ChunkProgress) => void
): Promise<GenerateResult> {
  const questoes: Questao[] = [];
  const erros: GenerateResult['erros'] = [];

  for (const chunk of chunks) {
    try {
      const qs = await provider.generateForChunk(chunk, opts);
      questoes.push(...qs);
      onProgress?.({ index: chunk.index, total: chunks.length, sectionTitles: chunk.sectionTitles, questoesNoBloco: qs.length });
    } catch (err) {
      const mensagem = err instanceof Error ? err.message : String(err);
      erros.push({ chunkIndex: chunk.index, mensagem });
      onProgress?.({ index: chunk.index, total: chunks.length, sectionTitles: chunk.sectionTitles, questoesNoBloco: 0, erro: mensagem });
    }
  }

  return { questoes, erros };
}
```
Para `enrichAll`, a estrutura é **idêntica** com dois estágios sequenciais:
- Estágio 1 (classificar): 1 chamada global `runClaudeCli` com todos os cards → `parseClassificacoesJson` → merge por id
- Estágio 2 (cardBuilder): loop por-card com try/catch por card → `parseSingleCard` → substituir/split

**Parser tolerante — clone de `parseQuestoesJson`** (generation.ts linhas 57–72):
```typescript
export function parseQuestoesJson(text: string): RawQuestao[] {
  if (!text) return [];
  // remove cercas ```json ... ```
  const unfenced = text.replace(/```(?:json)?/gi, '').trim();
  // recorta do primeiro { ao último }
  const start = unfenced.indexOf('{');
  const end = unfenced.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return [];
  try {
    const obj = JSON.parse(unfenced.slice(start, end + 1)) as { questoes?: RawQuestao[] };
    return Array.isArray(obj.questoes) ? obj.questoes : [];
  } catch {
    return [];
  }
}
```
Clonar para `parseClassificacoesJson` — única diferença: `obj.classificacoes` em vez de `obj.questoes`, e o tipo `RawClassificacao`:
```typescript
interface RawClassificacao { id?: string; deck?: string; tags?: string[] }

export function parseClassificacoesJson(text: string): RawClassificacao[] {
  // mesma lógica de unfenced/start/end
  // troca: (obj as { classificacoes?: RawClassificacao[] }).classificacoes
}
```
Claude tem discrição para extrair `parseJsonBlock<T>(text, key)` como helper compartilhado.

**Merge por id (D-06 — anti-pitfall 3):**
```typescript
// NUNCA usar índice posicional — sempre Map por id
const byId = new Map(classificacoes.map((c) => [c.id, c]));
for (const q of questoes) {
  const c = byId.get(q.id);
  if (c) {
    q.deck = c.deck;
    q.tags = c.tags;
  }
}
```

**Chamada ao runner** (runner.ts linhas 77–122):
```typescript
// Padrão de uso do runClaudeCli:
const text = await runClaudeCli({
  systemPrompt: loadPrompt('deck-classifier'),   // lê o .md canônico
  userMessage: buildClassificadorMessage(questoes),
  // model: omitido → default 'sonnet' (D-04)
});
```

**Split 1→N apenas para `criada` (D-09):**
```typescript
// Verificar q.tipo ANTES de fazer split
if (q.tipo === 'criada') {
  const derivados = parseSingleCard(text); // pode retornar Questao[]
  // herdar pageStart/pageEnd/tipo/deck/tags do original
  resultado.push(...derivados.map((d) => ({ ...q, id: crypto.randomUUID(), pergunta: d.pergunta, resposta: d.resposta })));
} else {
  // q.tipo === 'extraida': SÓ substituir q.resposta (D-10)
  const ajustado = parseSingleCard(text);
  resultado.push({ ...q, resposta: ajustado[0]?.resposta ?? q.resposta });
}
```

---

### `server/src/scripts/guard-enrich.ts` (utility, request-response)

**Analog:** `server/src/scripts/guard-default-loader.ts`

**Estrutura completa** (guard-default-loader.ts linhas 1–115):

**Header JSDoc** (linhas 1–18):
```typescript
/**
 * Guard CLI-free de não-regressão do caminho default (D-15 / Pitfall 3).
 *
 * Prova que, com ANKINATOR_PDF_LOADER unset, o ConvertOptions produzido por
 * buildConvertOptions() é byte-idêntico ao inline original de document-loader.ts,
 * SEM spawnar Java/Python e SEM chamar isLangchainAvailable().
 * ...
 * Uso:
 *   tsx src/scripts/guard-enrich.ts          (roda asserções e sai 0 se OK)
 *   tsx src/scripts/guard-enrich.ts --assert  (alias explícito — mesma saída)
 */
```

**Padrão de `fail` + cenários** (linhas 24–114):
```typescript
function fail(msg: string): never {
  console.error(`   ✗ FALHA: ${msg}`);
  process.exit(1);
}

// ── CENÁRIO 1: toggles off → enrichAll NÃO é chamado ─────────────────────
// importar a lógica de gate de api.ts diretamente (função pura extraída)
// ou simular: const shouldEnrich = (opts) => !!(opts.classificar || opts.cardBuilder)
const optsOff = { classificar: false, cardBuilder: false };
if (deveRodarEnrich(optsOff)) {
  fail('enrichAll seria chamado com toggles off — violação de PIPE-03');
}
console.log('   ✓ Cenário 1: toggles off → shouldEnrich=false OK.');

// ── CENÁRIO 2: toggle classificar on ──────────────────────────────────────
const optsClassificar = { classificar: true, cardBuilder: false };
if (!deveRodarEnrich(optsClassificar)) {
  fail('enrichAll NÃO seria chamado com classificar=true');
}
console.log('   ✓ Cenário 2: classificar=true → shouldEnrich=true OK.');
```

**Flag `--assert` e saída** (linhas 107–114):
```typescript
if (process.argv.includes('--assert')) {
  console.log('\n--assert: guard enrich CLI-free OK.');
  process.exit(0);
}
console.log('\nGuard PIPE-03 OK — enrichAll não chamado com toggles off.');
process.exit(0);
```

---

### `server/src/scripts/smoke-enrich.ts` (utility, request-response)

**Analog:** `server/src/scripts/smoke-runner.ts`

**Estrutura de 3 passos** (smoke-runner.ts):
```typescript
// PASSO 1: loadPrompt dos especialistas relevantes (valida Pitfall 1 cross-mode)
// PASSO 2: assertion determinística CLI-free (buildSpawnArgs)
// PASSO 3: runClaudeCli real (EXERCITA o CLI — só sem --assert-args)
```
Para `smoke-enrich.ts`:
```typescript
// PASSO 1: loadPrompt('deck-classifier') + loadPrompt('card-builder') — valida resolução .md
// PASSO 2: parseClassificacoesJson com fixture (CLI-free) — valida parser tolerante
// PASSO 3: [smoke real com PDF] usa enrichAll() com arquivo real — exercita o CLI
```

**Flag `--assert-args`** (smoke-runner.ts linhas 74–78):
```typescript
if (process.argv.includes('--assert-args')) {
  console.log('\n--assert-args: passos 1+2 OK (CLI-free); passo 3 (CLI) pulado por design. Guard SPEC-01 verde.');
  process.exit(0);
}
```

**Import e uso do runner** (smoke-runner.ts linhas 21–23):
```typescript
import { runClaudeCli, buildSpawnArgs } from '../core/specialists/runner.js';
import { loadPrompt } from '../core/specialists/prompt-loader.js';
import { SYSTEM_FIDELITY } from '../core/prompts.js';
```

---

### `server/src/store.ts` (modificação — extensão da union `JobEvent`)

**Analog:** o próprio arquivo (extensão aditiva)

**Estado atual — `JobEvent` union** (store.ts linhas 35–38):
```typescript
export type JobEvent =
  | { type: 'progress'; data: ChunkProgress }
  | { type: 'done'; data: { total: number; erros: GenerateResult['erros'] } }
  | { type: 'error'; data: { message: string } };
```

**Extensão mínima (D-02) — adicionar ANTES de `done`:**
```typescript
// importar EnrichProgress de enrich.ts
import type { EnrichProgress } from './core/specialists/enrich.js';

export type JobEvent =
  | { type: 'progress'; data: ChunkProgress }
  | { type: 'enrich-progress'; data: EnrichProgress }   // ← NOVO
  | { type: 'done'; data: { total: number; erros: GenerateResult['erros'] } }
  | { type: 'error'; data: { message: string } };
```

**`jobStore.emit` atual** (store.ts linhas 78–87) — zero mudança necessária:
```typescript
emit(job: Job, event: JobEvent): void {
  if (event.type === 'progress') job.progress.push(event.data);
  for (const sub of job.subscribers) {
    try {
      sub(event);
    } catch {
      /* assinante desconectado */
    }
  }
},
```

---

### `server/src/api.ts` (modificação — wiring `enrichAll` no `.then()`)

**Analog:** o próprio arquivo

**`.then()` atual** (api.ts linhas 151–161):
```typescript
.then((result) => {
  job.result = result;
  job.questoes = result.questoes;
  job.status = 'done';
  jobStore.emit(job, { type: 'done', data: { total: result.questoes.length, erros: result.erros } });
})
```

**Extensão encadeada (D-01) — trocar o `.then()` por `async`:**
```typescript
.then(async (result) => {
  let questoes = result.questoes;
  // gate PIPE-03: enrich SÓ quando algum toggle está ligado
  const enrichOpts = { classificar: options?.classificar, cardBuilder: options?.cardBuilder };
  if (enrichOpts.classificar || enrichOpts.cardBuilder) {
    questoes = await enrichAll(questoes, enrichOpts, (e) => {
      jobStore.emit(job, { type: 'enrich-progress', data: e });
    });
  }
  job.result = result;
  job.questoes = questoes;
  job.status = 'done';
  jobStore.emit(job, { type: 'done', data: { total: questoes.length, erros: result.erros } });
})
```

**Construção de `genOptions`** (api.ts linhas 129–135) — adicionar novas options:
```typescript
const genOptions: GenerateOptions = {
  maxPerChunk: options?.maxPerChunk,
  incluirExtraidas: options?.incluirExtraidas,
  incluirCriadas: options?.incluirCriadas,
  tags: options?.tags,
  model: options?.model,
  classificar: options?.classificar,    // ← NOVO (D-14)
  cardBuilder: options?.cardBuilder,    // ← NOVO (D-14)
};
```

**SSE `send` — fechar em `done` e `error`** (api.ts linha 198):
```typescript
// já implementado — não tocar:
if (event.type === 'done' || event.type === 'error') res.end();
// 'enrich-progress' flui normalmente antes do 'done' → sem mudança necessária
```

---

### `server/src/core/exporters/csv.ts` (modificação — tagsDaQuestao merge + coluna Deck)

**Analog:** o próprio arquivo

**`tagsDaQuestao` atual** (csv.ts linhas 26–33):
```typescript
function tagsDaQuestao(q: Questao, padrao: string[]): string {
  const tags = new Set<string>([q.tipo, ...padrao]);
  if (q.metadata?.banca) {
    tags.add(q.metadata.banca.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, ''));
  }
  if (q.metadata?.ano) tags.add(String(q.metadata.ano));
  return [...tags].filter(Boolean).join(' ');
}
```

**Extensão aditiva (D-07) — adicionar `...(q.tags ?? [])` no Set:**
```typescript
function tagsDaQuestao(q: Questao, padrao: string[]): string {
  const tags = new Set<string>([q.tipo, ...padrao, ...(q.tags ?? [])]);  // ← ...(q.tags ?? []) NOVO
  if (q.metadata?.banca) {
    tags.add(q.metadata.banca.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, ''));
  }
  if (q.metadata?.ano) tags.add(String(q.metadata.ano));
  return [...tags].filter(Boolean).join(' ');
}
```

**`toAnkiCsv` atual — rows e columns** (csv.ts linhas 50–76):
```typescript
const rows = questoes.map((q) => ({
  frente: q.pergunta,
  verso: versoDaQuestao(q),
  tags: tagsDaQuestao(q, padrao),
  fonte: fonteDaQuestao(q, baseFonte),
}));

const csv = stringify(rows, {
  header: true,
  columns: [
    { key: 'frente', header: 'Frente' },
    { key: 'verso', header: 'Verso' },
    { key: 'tags', header: 'Tags' },
    { key: 'fonte', header: 'Fonte' },
  ],
  delimiter: ';',
  quoted: true,
  quoted_string: true,
  escape: '"',
});

return '﻿' + csv;
```

**Extensão (D-08) — coluna Deck condicional + headers Anki:**

ATENÇÃO à ordem crítica de BOM + headers (Pitfall 7):
```typescript
export function toAnkiCsv(questoes: Questao[], opts: CsvOptions = {}): string {
  const baseFonte = opts.fonte ? path.basename(opts.fonte, path.extname(opts.fonte)) : 'material';
  const padrao = opts.tagsPadrao ?? [];
  const deckFallback = opts.deck ?? 'Ankinator';  // fallback de opts (D-08)

  // gate: coluna Deck só quando algum card tem q.deck preenchido
  const temDeck = questoes.some((q) => q.deck);

  const rows = questoes.map((q) => ({
    frente: q.pergunta,
    verso: versoDaQuestao(q),
    tags: tagsDaQuestao(q, padrao),
    fonte: fonteDaQuestao(q, baseFonte),
    ...(temDeck ? { deck: q.deck ?? deckFallback } : {}),  // ← NOVO
  }));

  const columns = [
    { key: 'frente', header: 'Frente' },
    { key: 'verso', header: 'Verso' },
    { key: 'tags', header: 'Tags' },
    { key: 'fonte', header: 'Fonte' },
    ...(temDeck ? [{ key: 'deck', header: 'Deck' }] : []),  // ← NOVO coluna 5
  ];

  const csvBody = stringify(rows, { header: true, columns, delimiter: ';', quoted: true, quoted_string: true, escape: '"' });

  // BOM primeiro, depois headers Anki, depois dados (Pitfall 7)
  const headerLines = temDeck ? '#separator:Semicolon\n#deck column:5\n' : '';
  return '﻿' + headerLines + csvBody;
}
```

Atualizar `CsvOptions` para incluir `deck?` também:
```typescript
export interface CsvOptions {
  fonte?: string;
  tagsPadrao?: string[];
  deck?: string;  // ← NOVO: fallback quando q.deck ausente
}
```

---

### `server/src/core/exporters/ankiconnect.ts` (modificação — tagsDaQuestao merge + deckName por-nota)

**Analog:** o próprio arquivo

**`tagsDaQuestao` atual** (ankiconnect.ts linhas 70–75):
```typescript
function tagsDaQuestao(q: Questao, padrao: string[]): string[] {
  const tags = new Set<string>([`ankinator`, q.tipo, ...padrao]);
  if (q.metadata?.banca) tags.add(q.metadata.banca.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, ''));
  if (q.metadata?.ano) tags.add(String(q.metadata.ano));
  return [...tags].filter(Boolean);
}
```

**Extensão aditiva (D-07) — mesmo padrão do csv.ts:**
```typescript
function tagsDaQuestao(q: Questao, padrao: string[]): string[] {
  const tags = new Set<string>([`ankinator`, q.tipo, ...padrao, ...(q.tags ?? [])]);  // ← ...(q.tags ?? []) NOVO
  if (q.metadata?.banca) tags.add(q.metadata.banca.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, ''));
  if (q.metadata?.ano) tags.add(String(q.metadata.ano));
  return [...tags].filter(Boolean);
}
```

**`pushToAnki` atual — createDeck + notes** (ankiconnect.ts linhas 95–124):
```typescript
await invoke('createDeck', { deck: opts.deck }, url);

const notes = questoes.map((q) => ({
  deckName: opts.deck,   // ← todos na mesma deck
  modelName: 'Basic',
  fields: {
    Front: escapeHtml(q.pergunta).replace(/\n/g, '<br>'),
    Back: versoHtml(q, fonteBase),
  },
  tags: tagsDaQuestao(q, padrao),
  options: { allowDuplicate: opts.allowDuplicate ?? false },
}));
```

**Extensão (D-08) — createDeck por subdeck + deckName por-nota:**
```typescript
// criar um deck para cada q.deck distinto (fallback a opts.deck)
const subDecks = new Set(questoes.map((q) => q.deck ?? opts.deck));
for (const d of subDecks) await invoke('createDeck', { deck: d }, url);

const notes = questoes.map((q) => ({
  deckName: q.deck ?? opts.deck,   // ← por-nota; fallback preserva fluxo atual (D-08)
  modelName: 'Basic',
  fields: {
    Front: escapeHtml(q.pergunta).replace(/\n/g, '<br>'),
    Back: versoHtml(q, fonteBase),
  },
  tags: tagsDaQuestao(q, padrao),
  options: { allowDuplicate: opts.allowDuplicate ?? false },
}));
```

Atualizar `PushResult.deck` para refletir múltiplos decks (ou manter como está e registrar o deck principal — discrição de Claude).

---

### `server/src/core/types.ts` (modificação — `GenerateOptions` + novos campos)

**Analog:** o próprio arquivo

**`GenerateOptions` atual** (types.ts linhas 104–115):
```typescript
export interface GenerateOptions {
  maxPerChunk?: number;
  incluirExtraidas?: boolean;
  incluirCriadas?: boolean;
  tags?: string[];
  model?: string;
}
```

**Extensão mínima (D-11) — adicionar APENAS os dois toggles:**
```typescript
export interface GenerateOptions {
  maxPerChunk?: number;
  incluirExtraidas?: boolean;
  incluirCriadas?: boolean;
  tags?: string[];
  model?: string;
  /** Rodar especialista classificador de deck+tags após a geração. Default: true. */
  classificar?: boolean;   // ← NOVO (D-14)
  /** Rodar especialista card-builder após a classificação. Default: false. */
  cardBuilder?: boolean;   // ← NOVO (D-14)
}
```

CRÍTICO (Pitfall 1): `Questao` NÃO é tocada — os campos `deck?/tags?` já existem desde SPEC-05 (types.ts linha 97–100). Zero mudança no tipo `Questao`.

---

### `web/src/types.ts` (modificação — espelhar `GenerateOptions`)

**Analog:** `server/src/core/types.ts` (espelho exato)

**`GenerateOptions` atual** (web/src/types.ts linhas 51–56):
```typescript
export interface GenerateOptions {
  maxPerChunk?: number;
  incluirExtraidas?: boolean;
  incluirCriadas?: boolean;
  tags?: string[];
}
```

**Extensão idêntica ao server — MESMO COMMIT (Pitfall 1):**
```typescript
export interface GenerateOptions {
  maxPerChunk?: number;
  incluirExtraidas?: boolean;
  incluirCriadas?: boolean;
  tags?: string[];
  /** Rodar especialista classificador de deck+tags após a geração. Default: true. */
  classificar?: boolean;   // ← NOVO
  /** Rodar especialista card-builder após a classificação. Default: false. */
  cardBuilder?: boolean;   // ← NOVO
}
```

`Questao` (web/src/types.ts linhas 28–41) — **NÃO tocar** (já tem `deck?/tags?/mnemonico?/mnemonicoSvg?`).

---

### `web/src/App.tsx` (modificação — listener `enrich-progress` + default options)

**Analog:** o próprio arquivo

**Estado `options` com novos defaults (D-15)** (App.tsx linha 20):
```typescript
// Atual:
const [options, setOptions] = useState<GenerateOptions>({ maxPerChunk: 15, incluirExtraidas: true, incluirCriadas: true });

// Com defaults (D-15): classificar=true, cardBuilder=false
const [options, setOptions] = useState<GenerateOptions>({
  maxPerChunk: 15,
  incluirExtraidas: true,
  incluirCriadas: true,
  classificar: true,      // ← default ON (D-15)
  cardBuilder: false,     // ← default OFF (D-15)
});
```

**Listeners SSE existentes** (App.tsx linhas 74–96):
```typescript
es.addEventListener('progress', (ev) => {
  const data = JSON.parse((ev as MessageEvent).data) as ChunkProgress;
  setProgress((prev) => [...prev, data]);
});
es.addEventListener('done', async () => {
  es.close();
  const job = await api.job(jobId);
  setCards(job.questoes);
  setStep('review');
  setBusy(false);
});
```

**Adicionar listener `enrich-progress` (D-02/D-16) — inserir ENTRE `progress` e `done`:**
```typescript
es.addEventListener('enrich-progress', (ev) => {
  const data = JSON.parse((ev as MessageEvent).data) as EnrichProgress;
  setEnrichProgress(data);  // estado novo: EnrichProgress | null
});
```
Estado adicional necessário:
```typescript
const [enrichProgress, setEnrichProgress] = useState<EnrichProgress | null>(null);
```
Limpar em `handleGenerate` junto com `setProgress([])`:
```typescript
setEnrichProgress(null);
```

**Passar `enrichProgress` para `ProgressPanel`** (App.tsx linha 161):
```typescript
{step === 'generating' && extract && (
  <ProgressPanel total={totalChunks} progress={progress} fileName={extract.fileName} enrichProgress={enrichProgress} />
)}
```

---

### `web/src/components/StructurePanel.tsx` (modificação — bloco "Modo educativo")

**Analog:** o próprio arquivo

**Props atuais** (StructurePanel.tsx linhas 4–17):
```typescript
interface Props {
  extract: ExtractResult;
  selected: Set<string>;
  onToggle: (id: string) => void;
  onSelectAll: (all: boolean) => void;
  options: GenerateOptions;
  setOptions: (o: GenerateOptions) => void;
  tagsInput: string;
  setTagsInput: (s: string) => void;
  onGenerate: () => void;
  canGenerate: boolean;
  provider: 'cli' | 'api';
  busy: boolean;
}
```
Props não mudam — `options.classificar` e `options.cardBuilder` chegam via `options` existente.

**Padrão de checkbox existente** (StructurePanel.tsx linhas 84–100):
```typescript
<label className="flex items-center justify-between text-sm text-slate-700">
  <span>Questões extraídas (provas)</span>
  <input
    type="checkbox"
    checked={options.incluirExtraidas !== false}
    onChange={(e) => setOptions({ ...options, incluirExtraidas: e.target.checked })}
    className="h-4 w-4 rounded border-slate-300 text-brand-600"
  />
</label>
```

**Bloco "Modo educativo" a adicionar (D-14) — APÓS o slider e ANTES do botão Gerar:**
```tsx
{/* Bloco "Modo educativo" (D-14) — mesma estrutura dos checkboxes acima */}
<div className="border-t border-slate-100 pt-3">
  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
    Modo educativo
  </h3>
  <label className="flex items-center justify-between text-sm text-slate-700">
    <span>Classificar deck + tags</span>
    <input
      type="checkbox"
      checked={options.classificar !== false}   {/* default true (D-15) */}
      onChange={(e) => setOptions({ ...options, classificar: e.target.checked })}
      className="h-4 w-4 rounded border-slate-300 text-brand-600"
    />
  </label>
  <label className="flex items-center justify-between text-sm text-slate-700 mt-2">
    <span>Card educativo</span>
    <input
      type="checkbox"
      checked={options.cardBuilder === true}    {/* default false (D-15) */}
      onChange={(e) => setOptions({ ...options, cardBuilder: e.target.checked })}
      className="h-4 w-4 rounded border-slate-300 text-brand-600"
    />
  </label>
</div>
```

---

### `web/src/components/ProgressPanel.tsx` (modificação — renderizar `enrich-progress`)

**Analog:** o próprio arquivo

**Props atuais** (ProgressPanel.tsx linhas 3–7):
```typescript
interface Props {
  total: number;
  progress: ChunkProgress[];
  fileName: string;
}
```

**Extensão (D-16) — adicionar `enrichProgress?`:**
```typescript
import type { ChunkProgress, EnrichProgress } from '../types';

interface Props {
  total: number;
  progress: ChunkProgress[];
  fileName: string;
  enrichProgress?: EnrichProgress | null;   // ← NOVO
}
```

**Padrão de renderização de itens de progresso** (ProgressPanel.tsx linhas 36–48):
```tsx
<ul className="mt-5 max-h-56 space-y-1 overflow-y-auto text-xs">
  {progress.map((p) => (
    <li
      key={p.index}
      className={`flex items-center justify-between rounded px-2 py-1 ${p.erro ? 'bg-amber-50 text-amber-700' : 'text-slate-500'}`}
    >
      <span className="truncate">
        Bloco {p.index + 1}: {p.sectionTitles.join(' › ') || '—'}
      </span>
      <span className="ml-2 shrink-0 font-medium">{p.erro ? 'erro' : `+${p.questoesNoBloco}`}</span>
    </li>
  ))}
</ul>
```

**Adicionar fase enrich abaixo da lista de chunks (D-16):**
```tsx
{enrichProgress && (
  <div className="mt-3 rounded px-2 py-1.5 bg-slate-50 text-xs text-slate-600 flex items-center justify-between">
    <span>
      {enrichProgress.estagio === 'classificando'
        ? 'Classificando deck + tags…'
        : `Reescrevendo card ${enrichProgress.index + 1}/${enrichProgress.total}…`}
    </span>
    {enrichProgress.erro && <span className="text-amber-600">erro</span>}
  </div>
)}
```

---

### `web/src/components/CardTable.tsx` (modificação — badges deck+tags read-only)

**Analog:** o próprio arquivo

**Badges existentes** (CardTable.tsx linhas 51–69):
```tsx
<div className="mb-2 flex items-center gap-2">
  <span className="text-xs font-semibold text-slate-400">#{i + 1}</span>
  <span
    className={[
      'rounded px-1.5 py-0.5 text-xs font-medium',
      c.tipo === 'extraida' ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-100 text-indigo-700',
    ].join(' ')}
  >
    {c.tipo === 'extraida' ? 'extraída' : 'criada'}
  </span>
  {c.pageStart && (
    <span className="text-xs text-slate-400">
      p.{c.pageStart}
      {c.pageEnd !== c.pageStart ? `–${c.pageEnd}` : ''}
    </span>
  )}
  {c.metadata?.banca && (
    <span className="text-xs text-slate-400">· {c.metadata.banca}{c.metadata.ano ? ` ${c.metadata.ano}` : ''}</span>
  )}
  {/* botão Descartar/Restaurar segue */}
```

**Adicionar badges deck+tags read-only (D-17) — padrão idêntico aos badges existentes:**
```tsx
{/* badges deck/tags — só renderizar quando preenchidos (SPEC-05 campos opcionais) */}
{c.deck && (
  <span className="rounded bg-violet-100 px-1.5 py-0.5 text-xs font-medium text-violet-700">
    {c.deck}
  </span>
)}
{c.tags?.length ? (
  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">
    {c.tags.slice(0, 3).join(' ')}
    {c.tags.length > 3 ? ` +${c.tags.length - 3}` : ''}
  </span>
) : null}
```
Layout exato é discrição de Claude — acima é sugestão que segue o padrão de badges existente.

---

### `server/src/core/specialists/prompts/deck-classifier.md` (modificação — campo `id` na saída)

**Estado atual** (deck-classifier.md linha 44–46):
```markdown
## Saída

Para cada card, devolva `deck` (string `A::B::C`) e `tags` (lista de strings). Não altere
a pergunta nem a resposta do card.
```

**Extensão necessária (Open Question 1 do RESEARCH.md) — adicionar `id` ao formato de saída:**
```markdown
## Saída

Retorne APENAS JSON no formato:
{"classificacoes":[{"id":"<id-original-do-card>","deck":"<Matéria::Assunto::Subtópico>","tags":["tag1","tag2"]}]}

Preserve o `id` exatamente como recebido. Não altere a pergunta nem a resposta do card.
```

---

### `server/src/core/specialists/prompts/card-builder.md` (modificação — formato de saída para split)

**Estado atual** (card-builder.md linhas 44–46):
```markdown
## Saída

Devolva o card reescrito (pergunta + resposta com explicação curta e fonte quando houver).
Quando dividir, devolva os múltiplos cards atômicos resultantes.
```

**Extensão necessária (Open Question 2 do RESEARCH.md) — especificar formato JSON:**
```markdown
## Saída

Retorne APENAS JSON no formato:
{"cards":[{"pergunta":"...","resposta":"..."}]}

Para um card único: array com 1 elemento. Para split: array com N elementos.
Inclua sempre a explicação curta e a fonte (quando disponível) na `resposta`.
```

---

### `server/src/core/specialists/enrich.test.ts` (test, vitest)

**Analog:** sem analog (vitest não instalado) — usar RESEARCH.md como referência

**Padrão vitest (ESM-nativo, sem config):**
```typescript
import { describe, it, expect } from 'vitest';
import { parseClassificacoesJson, parseSingleCard } from '../core/specialists/enrich.js';

describe('parseClassificacoesJson', () => {
  it('extrai classificações por id de JSON limpo', () => {
    const text = '{"classificacoes":[{"id":"abc","deck":"A::B","tags":["t1"]}]}';
    expect(parseClassificacoesJson(text)).toEqual([{ id: 'abc', deck: 'A::B', tags: ['t1'] }]);
  });

  it('tolera cercas ```json', () => {
    const text = '```json\n{"classificacoes":[]}\n```';
    expect(parseClassificacoesJson(text)).toEqual([]);
  });
});
```
Cobertura mínima exigida (D-18): `parseClassificacoesJson`, `tagsDaQuestao merge`, `split extraida`, `card-builder extraida verso`, `enrichAll sequência`, `ankiconnect routing`, `csv deck column`.

---

## Shared Patterns

### Isolamento de erro por-unidade

**Fonte:** `server/src/core/generation.ts` linhas 84–93
**Aplicar a:** `enrich.ts` estágio card-builder (loop por-card) e estágio classificador (try/catch global para a 1 chamada)
```typescript
try {
  // operação por-card ou chamada global
} catch (err) {
  const mensagem = err instanceof Error ? err.message : String(err);
  // registrar erro no progresso; manter card original; NÃO re-throw
  onProgress?.({ estagio, index, total, erro: mensagem });
  // push card original ao resultado (nunca perde o card)
}
```

### `loadPrompt` — fonte única dos `.md` canônicos

**Fonte:** `server/src/core/specialists/prompt-loader.ts` linhas 56–68
**Aplicar a:** `enrich.ts` para todos os `runClaudeCli` de especialistas
```typescript
// SEMPRE carregar via loadPrompt — nunca hardcode inline
const systemPrompt = loadPrompt('deck-classifier');  // ou 'card-builder'
// Nota: 'deck-classifier' e 'card-builder' já estão na allowlist NOMES (prompt-loader.ts linha 35)
```

### Spread defensivo de campos opcionais

**Fonte:** Pitfall 6 do RESEARCH.md
**Aplicar a:** `csv.ts` e `ankiconnect.ts` em todos os pontos de merge de `q.tags`
```typescript
// SEMPRE usar ?? [] para campos opcionais de Questao (SPEC-05)
...(q.tags ?? [])
```

### Tipo `Questao` — espelhar no mesmo commit

**Fonte:** Pitfall 1 do RESEARCH.md / `web/src/types.ts` e `server/src/core/types.ts`
**Aplicar a:** qualquer mudança em `GenerateOptions` (server) deve estar no mesmo commit que a mudança em `GenerateOptions` (web)
- `server/src/core/types.ts` → `web/src/types.ts` — mesmo commit, mesmos campos `classificar?/cardBuilder?`
- `Questao` — NÃO tocar em nenhum dos dois arquivos

### Padrão ESM — imports com `.js`

**Fonte:** `server/src/core/generation.ts` linha 13, `server/src/core/specialists/runner.ts` linhas 17–18
**Aplicar a:** todos os novos imports em `enrich.ts`
```typescript
// SEMPRE extensão .js em imports locais (projeto ESM)
import { runClaudeCli } from './runner.js';
import { loadPrompt } from './prompt-loader.js';
import type { Questao } from '../types.js';
```

---

## No Analog Found

| Arquivo | Role | Data Flow | Motivo |
|---------|------|-----------|--------|
| `server/src/core/specialists/enrich.test.ts` | test | transform | vitest não instalado — sem test runner no projeto até agora; instalar como Wave 0 devDependency |

---

## Metadata

**Analog search scope:** `ankinator-app/server/src/`, `ankinator-app/web/src/`
**Files scanned:** 16 arquivos lidos diretamente
**Pattern extraction date:** 2026-06-03
