# Phase 4: Mnemônicos + Imagem SVG — Mapa de Padrões

**Mapeado:** 2026-06-03
**Arquivos analisados:** 17 (novos/modificados)
**Análogos encontrados:** 15 / 17

---

## Classificação de Arquivos

| Arquivo Novo/Modificado | Papel | Fluxo de Dados | Análogo Mais Próximo | Qualidade |
|-------------------------|-------|----------------|----------------------|-----------|
| `server/src/core/specialists/enrich.ts` | serviço | batch + por-card (CRUD) | ele mesmo (estender) | exato |
| `server/src/core/specialists/sanitize-svg.ts` | utilitário | transform | `enrich.ts` (padrão fail-closed) | papel-diferente/fluxo-similar |
| `server/src/core/specialists/image-provider.ts` | serviço | request-response | ele mesmo (conectar) | exato |
| `server/src/core/specialists/prompts/mnemonic.md` | config | — | ele mesmo (refinar) | exato |
| `server/src/core/specialists/prompts/mnemonic-image.md` | config | — | ele mesmo (refinar) | exato |
| `server/src/core/specialists/enrich.test.ts` | teste | — | ele mesmo (estender) | exato |
| `server/src/core/exporters/csv.ts` | serviço | transform | ele mesmo (estender) | exato |
| `server/src/core/exporters/ankiconnect.ts` | serviço | request-response | ele mesmo (estender) | exato |
| `server/src/store.ts` | config/estado | event-driven | ele mesmo (estender) | exato |
| `server/src/scripts/guard-enrich.ts` | utilitário | — | ele mesmo (estender) | exato |
| `server/src/scripts/smoke-enrich.ts` | utilitário | — | ele mesmo (estender) | exato |
| `web/src/types.ts` | modelo | — | ele mesmo (estender) | exato |
| `web/src/components/StructurePanel.tsx` | componente | request-response | ele mesmo (estender) | exato |
| `web/src/components/CardTable.tsx` | componente | — | ele mesmo (estender) | exato |
| `web/src/components/ProgressPanel.tsx` | componente | event-driven | ele mesmo (verificar) | exato |
| `web/src/App.tsx` | componente | event-driven | ele mesmo (verificar) | exato |
| `web/src/components/Stepper.tsx` | componente | — | ele mesmo (NÃO tocar) | — |

---

## Atribuições de Padrão

### `server/src/core/specialists/enrich.ts` — ESTENDER: +2 estágios

**Análogo:** ele mesmo (Phase 3, já implementado)

**Padrão de importações** (`enrich.ts` linhas 17–20):
```typescript
import crypto from 'node:crypto';
import type { Questao } from '../types.js';
import { runClaudeCli } from './runner.js';
import { loadPrompt } from './prompt-loader.js';
```
Phase 4 adiciona:
```typescript
import { createImageProvider } from './image-provider.js';
import { sanitizarSvg } from './sanitize-svg.js';
```

**Padrão de tipos exportados** (`enrich.ts` linhas 24–34) — AMPLIAR:
```typescript
export interface EnrichOpts {
  classificar?: boolean;
  cardBuilder?: boolean;
  // Phase 4 adiciona:
  mnemonico?: boolean;
  imagem?: boolean;
}

export interface EnrichProgress {
  estagio: 'classificando' | 'reescrevendo';
  // Phase 4 adiciona:
  // | 'gerando-mnemonico' | 'gerando-imagem'
  index: number;
  total: number;
  erro?: string;
}
```

**Padrão do helper `parseJsonBlock<T>`** (`enrich.ts` linhas 56–70) — REUSAR SEM MODIFICAR:
```typescript
function parseJsonBlock<T>(text: string, key: string): T[] {
  if (!text) return [];
  const unfenced = text.replace(/```(?:json)?/gi, '').trim();
  const start = unfenced.indexOf('{');
  const end = unfenced.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return [];
  try {
    const obj = JSON.parse(unfenced.slice(start, end + 1)) as Record<string, unknown>;
    return Array.isArray(obj[key]) ? (obj[key] as T[]) : [];
  } catch {
    return [];
  }
}
```
O parser do mnemônico (`parseMnemonicosJson`) é clone direto usando esta função:
```typescript
// Formato: {"mnemonicos":[{"id":"...","mnemonico":"...","tecnica":"..."}]}
interface RawMnemonico {
  id?: string;
  mnemonico?: string;
  tecnica?: string;
}
export function parseMnemonicosJson(text: string): RawMnemonico[] {
  return parseJsonBlock<RawMnemonico>(text, 'mnemonicos');
}
```

**Padrão do gate PIPE-03** (`enrich.ts` linhas 98–100) — AMPLIAR:
```typescript
// ANTES (Phase 3):
export function deveRodarEnrich(opts: EnrichOpts): boolean {
  return !!(opts.classificar || opts.cardBuilder);
}
// DEPOIS (Phase 4 — incluir novos toggles):
export function deveRodarEnrich(opts: EnrichOpts): boolean {
  return !!(opts.classificar || opts.cardBuilder || opts.mnemonico || opts.imagem);
}
```

**Padrão do helper `buildClassificadorMessage`** (`enrich.ts` linhas 105–120) — ESPELHAR para mnemônico:
```typescript
// O helper do classificador usa JSON.stringify (T-03-02 — nunca interpolar cru)
function buildClassificadorMessage(questoes: Questao[]): string {
  const cards = questoes.map((q) => ({
    id: q.id,
    pergunta: q.pergunta,
    resposta: q.resposta,
    tipo: q.tipo,
  }));
  return [
    'Classifique os cards a seguir. Retorne APENAS JSON no formato:',
    '{"classificacoes":[{"id":"<id>","deck":"<Matéria::Assunto::Subtópico>","tags":["tag1","tag2"]}]}',
    '',
    'Cards:',
    JSON.stringify(cards, null, 2),
  ].join('\n');
}
```
O helper equivalente para mnemônicos segue exatamente a mesma estrutura: `JSON.stringify` dos cards + instrução do formato de saída JSON.

**Padrão do Estágio 1 — classificador (batch, D-05/D-06)** (`enrich.ts` linhas 163–192) — ESPELHAR para Estágio 3 (mnemônico):
```typescript
// ── ESTÁGIO 1: Classificador (D-05/D-06) ──────────────────────────────────
if (opts.classificar) {
  onProgress?.({ estagio: 'classificando', index: 0, total: 1 });
  try {
    const userMessage = buildClassificadorMessage(resultado);
    const text = await runClaudeCli({
      systemPrompt: loadPrompt('deck-classifier'),
      userMessage,
      // model omitido → default 'sonnet' (D-04)
    });
    const classificacoes = parseClassificacoesJson(text);

    // Merge por id (D-06 / anti-Pitfall 3 — NUNCA posicional)
    const byId = new Map(classificacoes.map((c) => [c.id, c]));
    resultado = resultado.map((q) => {
      const c = byId.get(q.id);
      if (c) {
        return {
          ...q,
          ...(c.deck !== undefined ? { deck: c.deck } : {}),
          ...(c.tags !== undefined ? { tags: c.tags } : {}),
        };
      }
      return q;
    });
  } catch (err) {
    const erro = err instanceof Error ? err.message : String(err);
    onProgress?.({ estagio: 'classificando', index: 0, total: 1, erro });
    // Segue sem classificação — nunca derruba o job
  }
}
```

**Padrão do Estágio 2 — card-builder (por-card, D-12/D-13)** (`enrich.ts` linhas 194–243) — ESPELHAR para Estágio 4 (imagem):
```typescript
// ── ESTÁGIO 2: Card-builder (D-09/D-10/D-12/D-13) ────────────────────────
if (opts.cardBuilder) {
  const snapshot = [...resultado];
  const total = snapshot.length;
  const novoResultado: Questao[] = [];

  for (let i = 0; i < snapshot.length; i++) {
    const q = snapshot[i];
    onProgress?.({ estagio: 'reescrevendo', index: i, total });
    try {
      // ... chamada ao runner ...
    } catch (err) {
      const erro = err instanceof Error ? err.message : String(err);
      onProgress?.({ estagio: 'reescrevendo', index: i, total, erro });
      // D-13: mantém o card original em falha — nunca perde um card
      novoResultado.push(q);
    }
  }
  resultado = novoResultado;
}
```
O Estágio 4 (imagem) usa `resultado[i] = { ...q, mnemonicoSvg: svgSanitizado }` no lugar de `novoResultado.push(...)`, e filtra por `q.mnemonico` antes de processar.

---

### `server/src/core/specialists/sanitize-svg.ts` — NOVO

**Análogo para o padrão fail-closed:** `enrich.ts` (catch → `return null`) e `generation.ts` linhas 88–96 (catch → isolamento).

**Padrão de fail-closed** (`generation.ts` linhas 84–96):
```typescript
// generateAll: isolamento por bloco
try {
  const qs = await provider.generateForChunk(chunk, opts);
  questoes.push(...qs);
  onProgress?.({ ... });
} catch (err) {
  const mensagem = err instanceof Error ? err.message : String(err);
  erros.push({ chunkIndex: chunk.index, mensagem });
  onProgress?.({ ..., erro: mensagem });
}
```
O `sanitizarSvg()` replica o padrão: `try { ... } catch { return null; }`.

**Padrão de importação ESM correto** (`prompt-loader.ts` linhas 30–32) — para evitar Pitfall 7:
```typescript
// Módulo npm: sem extensão (exports map resolve)
import DOMPurify from 'isomorphic-dompurify';
// Módulo local: COM extensão .js (NodeNext obriga)
import { sanitizarSvg } from './sanitize-svg.js';
```

**Configuração DOMPurify obrigatória** (do RESEARCH.md — NOT `USE_PROFILES`):
```typescript
// NUNCA: { USE_PROFILES: { svg: true }, ALLOWED_TAGS: [...] }
// USE_PROFILES sobrescreve ALLOWED_TAGS silenciosamente.
// CORRETO: APENAS ALLOWED_TAGS + ALLOWED_ATTR explícitos
const limpo = DOMPurify.sanitize(svgRaw, {
  ALLOWED_TAGS: SVG_TAGS,   // lista geométrica estrita
  ALLOWED_ATTR: SVG_ATTRS,  // lista de atributos segura
});
```

---

### `server/src/core/specialists/image-provider.ts` — CONECTAR (remover TODO)

**Análogo:** ele mesmo — `SvgClaudeImageProvider.generate()` já implementado.

**Ponto de intervenção** (`image-provider.ts` linhas 36–44):
```typescript
// ANTES (Phase 1 — andaime com TODO):
async generate(mnemonic: string, context: string): Promise<{ svg: string }> {
  const systemPrompt = loadPrompt('mnemonic-image');
  const userMessage = `Mnemônico:\n${mnemonic}\n\nContexto do card:\n${context}`;
  const svg = await runClaudeCli({ systemPrompt, userMessage });
  // TODO(IMG-02 fase 4): sanitizar SVG (remover <script>/URLs externas) antes de embutir no card.
  return { svg };
}

// DEPOIS (Phase 4 — remover TODO; sanitização fica no estágio do enrichAll):
// O generate() CONTINUA retornando o SVG cru.
// A sanitização acontece no estágio imagem do enrichAll, não aqui.
// Motivo: separação de responsabilidades — o provider só gera; o estágio decide o que fazer.
```

**Factory** (`image-provider.ts` linhas 51–54) — REUSAR SEM MODIFICAR:
```typescript
export function createImageProvider(): ImageProvider {
  return new SvgClaudeImageProvider();
}
```

---

### `server/src/core/specialists/prompts/mnemonic.md` — REFINAR

**Análogo:** ele mesmo — já existe com "Quando NÃO gerar" e "## Técnicas".

**Ponto de intervenção crítico** (`mnemonic.md` linhas 36–38 — seção `## Saída`):
```markdown
## Saída

Devolva o texto do mnemônico (`mnemonico`) e, em uma linha, o mapeamento item→gatilho. Não
altere a pergunta nem a resposta do card.
```
Esta seção NÃO instrui formato JSON batch. O planner DEVE adicionar instrução de formato JSON:
```markdown
## Saída

Devolva APENAS JSON no formato abaixo, sem texto antes ou depois, sem cercas de código:
{"mnemonicos":[{"id":"<id-do-card>","mnemonico":"<texto>","tecnica":"<acrônimo|história|loci|rima>"}]}

Para cards conceituais/de raciocínio, NÃO inclua o card na lista (omissão = sem mnemônico).
Para cards de memorização, inclua o mapeamento item→gatilho dentro do campo "mnemonico".
```

---

### `server/src/core/specialists/prompts/mnemonic-image.md` — REFINAR (pontual)

**Análogo:** ele mesmo — já tem restrições de segurança na seção `## Restrições de segurança`.

**Ponto de melhoria** (`mnemonic-image.md` linhas 26–35 — `## Saída`):
```markdown
## Saída

Devolva APENAS o markup `<svg>...</svg>` autocontido, sem texto antes ou depois e sem cercas
de código. Este SVG vai para o campo `mnemonicoSvg` do card.
```
Refinamento recomendado: adicionar instrução para evitar `id` e `version` no `<svg>` raiz (Anki 25.02.x os remove — A1 da pesquisa):
```markdown
## Saída

Devolva APENAS o markup `<svg>...</svg>` autocontido. Regras de saída:
- Sem texto antes ou depois, sem cercas de código.
- Sem atributo `id` ou `version` no elemento `<svg>` raiz.
- Confirme que o SVG começa exatamente com `<svg` e termina com `</svg>`.
```

---

### `server/src/core/specialists/enrich.test.ts` — ESTENDER

**Análogo:** ele mesmo — já tem `vi.mock('./runner.js')` e estrutura de describes.

**Padrão de mock** (`enrich.test.ts` linhas 15–23) — REUSAR PARA NOVOS TESTES:
```typescript
vi.mock('./runner.js', () => ({
  runClaudeCli: vi.fn(),
}));

vi.mock('./prompt-loader.js', () => ({
  loadPrompt: vi.fn((nome: string) => nome),
}));

import { runClaudeCli } from './runner.js';
```

**Padrão de isolamento de erro por-card** (`enrich.test.ts` linhas 167–205) — ESPELHAR para testes do estágio imagem:
```typescript
it('isolamento de erro por-unidade: erro em um card não aborta o lote', async () => {
  let callCount = 0;
  vi.mocked(runClaudeCli).mockImplementation(async () => {
    callCount++;
    if (callCount === 2) throw new Error('Falha simulada no card 2');
    return '{"cards":[{"pergunta":"PX","resposta":"RX"}]}';
  });

  const progressos: import('./enrich.js').EnrichProgress[] = [];
  const result = await enrichAll([...3 cards...], { cardBuilder: true }, (e) => progressos.push(e));

  expect(result.length).toBe(3);
  const progressoComErro = progressos.find((p) => p.erro !== undefined);
  expect(progressoComErro).toBeDefined();
});
```

**Padrão dos testes `deveRodarEnrich`** (`enrich.test.ts` linhas 270–284) — AMPLIAR com novos toggles:
```typescript
describe('deveRodarEnrich', () => {
  it('retorna false quando ambos toggles são false', () => {
    expect(deveRodarEnrich({ classificar: false, cardBuilder: false })).toBe(false);
  });
  it('retorna true quando classificar=true', () => {
    expect(deveRodarEnrich({ classificar: true, cardBuilder: false })).toBe(true);
  });
  // Phase 4 adiciona:
  // it('retorna true quando mnemonico=true', ...)
  // it('retorna true quando imagem=true, mnemonico=false', ...)
  // it('retorna false quando todos off incluindo mnemonico/imagem', ...)
});
```

**Para os fixtures F-01..F-12** (testes de sanitização — D-14, sem mock do runner):
```typescript
// sanitizarSvg roda em Node puro — NÃO precisa de vi.mock('./runner.js')
import { sanitizarSvg } from '../specialists/sanitize-svg.js';

describe('sanitizarSvg — cobertura adversarial (D-07/D-14)', () => {
  it('F-01: remove <script>', () => {
    const out = sanitizarSvg('<svg><script>alert(1)</script></svg>');
    expect(out).not.toContain('<script>');
  });
  // ... F-02 a F-12 ...
  it('F-10: SVG geométrico limpo passa intacto', () => {
    const svg = '<svg viewBox="0 0 100 100"><rect x="10" y="10" width="80" height="80" fill="blue"/></svg>';
    expect(sanitizarSvg(svg)).not.toBeNull();
    expect(sanitizarSvg(svg)).toContain('<rect');
  });
  it('F-11: retorna null para entrada não-SVG', () => {
    expect(sanitizarSvg('')).toBeNull();
    expect(sanitizarSvg('<div>hello</div>')).toBeNull();
  });
});
```

---

### `server/src/core/exporters/csv.ts` — ESTENDER: `versoDaQuestao`

**Análogo:** ele mesmo — função `versoDaQuestao` nas linhas 37–49.

**Função original** (`csv.ts` linhas 37–49):
```typescript
function versoDaQuestao(q: Questao): string {
  let verso = q.resposta;
  const m = q.metadata;
  if (m && Object.keys(m).length) {
    const linhas: string[] = [];
    if (m.gabarito) linhas.push(`Gabarito: ${m.gabarito}`);
    if (m.alternativas?.length) linhas.push(`Alternativas:\n${m.alternativas.join('\n')}`);
    if (m.banca) linhas.push(`Banca: ${m.banca}`);
    if (m.ano) linhas.push(`Ano: ${m.ano}`);
    if (linhas.length) verso += `\n\n${linhas.join('\n')}`;
  }
  return verso;
}
```

**Extensão Phase 4** (adicionar ao fim, antes do `return verso`):
```typescript
  // Phase 4: mnemônico-texto (gate: byte-idêntico quando ausente — PIPE-03)
  if (q.mnemonico) {
    verso += `\n\n💡 Mnemônico: ${q.mnemonico}`;
  }
  // SVG inline (gate: byte-idêntico quando ausente — PIPE-03)
  // NUNCA chamar escapeHtml() no SVG — já sanitizado; escaping quebraria a marcação
  if (q.mnemonicoSvg) {
    verso += `\n\n${q.mnemonicoSvg}`;
  }
  return verso;
```

**Padrão do gate byte-identidade** (`csv.ts` linhas 57–66) — referência para PIPE-03:
```typescript
// gate: coluna Deck só quando algum card tem q.deck preenchido (D-08 / PIPE-03)
const temDeck = questoes.some((q) => q.deck);
const rows = questoes.map((q) => ({
  frente: q.pergunta,
  verso: versoDaQuestao(q),
  ...
  ...(temDeck ? { deck: q.deck ?? deckFallback } : {}),
}));
```
O mesmo padrão `if (q.mnemonico)` garante byte-identidade: se ausente, a saída é idêntica à Phase 3.

---

### `server/src/core/exporters/ankiconnect.ts` — ESTENDER: `versoHtml`

**Análogo:** ele mesmo — função `versoHtml` nas linhas 77–88.

**Função original** (`ankiconnect.ts` linhas 77–88):
```typescript
function versoHtml(q: Questao, fonte?: string): string {
  let back = escapeHtml(q.resposta).replace(/\n/g, '<br>');
  const m = q.metadata;
  if (m?.alternativas?.length) {
    back += `<br><br><i>Alternativas:</i><br>${m.alternativas.map(escapeHtml).join('<br>')}`;
  }
  if (m?.gabarito) back += `<br><b>Gabarito:</b> ${escapeHtml(m.gabarito)}`;
  const src = fonte ? `${fonte}` : '';
  const pg = q.pageStart ? (...) : '';
  if (src || pg) back += `<br><br><span style="color:#888;font-size:0.8em">Fonte: ${escapeHtml(src)}${pg}</span>`;
  return back;
}
```

**Extensão Phase 4** (adicionar após o bloco de Fonte, antes do `return back`):
```typescript
  // Phase 4: mnemônico-texto (gate: byte-idêntico quando ausente — PIPE-03)
  if (q.mnemonico) {
    back += `<br><br><b>💡 Mnemônico:</b> ${escapeHtml(q.mnemonico)}`;
  }
  // SVG inline — NÃO usar escapeHtml(); SVG já sanitizado (D-08)
  // escapeHtml converteria <svg> em &lt;svg&gt; e quebraria o render no Anki
  if (q.mnemonicoSvg) {
    back += `<br><br>${q.mnemonicoSvg}`;
  }
  return back;
```

**Note type 'Basic'** (`ankiconnect.ts` linha 115) — VERIFICAR QUE PERMANECE INTACTO:
```typescript
const notes = questoes.map((q) => ({
  deckName: (!failedDecks.has(q.deck ?? '') ? q.deck : undefined) ?? opts.deck,
  modelName: 'Basic',   // D-11: não mudar — embed inline no verso, sem note type novo
  fields: {
    Front: escapeHtml(q.pergunta).replace(/\n/g, '<br>'),
    Back: versoHtml(q, fonteBase),  // aqui entra o mnemônico + SVG
  },
  tags: tagsDaQuestao(q, padrao),
  ...
}));
```

---

### `server/src/store.ts` — ESTENDER: `JobEvent` union + `EnrichProgress`

**Análogo:** ele mesmo.

**Union atual** (`store.ts` linhas 36–40):
```typescript
export type JobEvent =
  | { type: 'progress'; data: ChunkProgress }
  | { type: 'enrich-progress'; data: EnrichProgress }
  | { type: 'done'; data: { total: number; erros: GenerateResult['erros'] } }
  | { type: 'error'; data: { message: string } };
```
A union `JobEvent` NÃO precisa mudar — o tipo `EnrichProgress` é importado de `enrich.ts`.

**Ponto de mudança real:** `EnrichProgress.estagio` em `enrich.ts` — a union de literais de string vai receber 2 novos valores. O `store.ts` importa o tipo; os novos valores propagam automaticamente.

---

### `server/src/scripts/guard-enrich.ts` — ESTENDER

**Análogo:** ele mesmo — padrão de cenário + `fail()` nas linhas 29–51.

**Estrutura de cenário** (`guard-enrich.ts` linhas 29–47):
```typescript
// CENÁRIO 1: toggles off → enrichAll NÃO deve ser chamado
const optsOff = { classificar: false, cardBuilder: false };
if (deveRodarEnrich(optsOff) !== false) {
  fail('enrichAll seria chamado com toggles off — violação de PIPE-03');
}
console.log('   ✓ Cenário 1: toggles off → deveRodarEnrich=false OK');

// CENÁRIO 2: toggle classificar on → enrichAll DEVE ser chamado
const optsClassificar = { classificar: true, cardBuilder: false };
if (!deveRodarEnrich(optsClassificar)) {
  fail('enrichAll NÃO seria chamado com classificar=true — violação de PIPE-03');
}
console.log('   ✓ Cenário 2: classificar=true → deveRodarEnrich=true OK');
```

**Phase 4 adiciona 3 cenários** com o mesmo padrão:
```typescript
// Cenário 3: mnemonico=true → deve rodar
// Cenário 4: imagem=true, mnemonico=false → deve rodar (imagem sem mnemônico: estágio vai rodar,
//            mas internamente não processará nenhum card — é correto)
// Cenário 5: todos os 4 toggles false → NÃO deve rodar (mantém byte-identidade Phase 3)
const optsAllOff = { classificar: false, cardBuilder: false, mnemonico: false, imagem: false };
if (deveRodarEnrich(optsAllOff) !== false) {
  fail('enrichAll seria chamado com todos toggles off (incluindo Phase 4) — violação de PIPE-03');
}
```

---

### `server/src/scripts/smoke-enrich.ts` — ESTENDER

**Análogo:** ele mesmo — estrutura de 3 passos (CLI-free / CLI-free / gated).

**Estrutura atual** (`smoke-enrich.ts` linhas 24–82):
```
Passo 1: loadPrompt('deck-classifier') + loadPrompt('card-builder')  ← CLI-free
Passo 2: parseClassificacoesJson com fixture                          ← CLI-free
Passo 3: enrichAll real com 1 card + classificar=true                 ← GATED (claude CLI)
```

**Phase 4 adiciona**:
```
Passo 1': loadPrompt('mnemonic') + loadPrompt('mnemonic-image')      ← CLI-free
Passo 2': parseMnemonicosJson com fixture (JSON válido + cercas)      ← CLI-free
Passo 2'': sanitizarSvg com SVG geométrico limpo → não-null          ← CLI-free (DOMPurify puro)
Passo 2''': sanitizarSvg com <script> → null                         ← CLI-free
Passo 4: enrichAll com mnemonico=true + imagem=true (1 card)          ← GATED
Passo 5: verificar render SVG no Anki desktop                         ← MANUAL/HUMANO
```

**Flag de gate** (`smoke-enrich.ts` linha 55) — PADRÃO REUSAR:
```typescript
if (process.argv.includes('--assert-args')) {
  console.log('\n--assert-args: passos 1+2 OK (CLI-free); passo 3 (CLI) pulado por design.');
  process.exit(0);
}
```

---

### `web/src/types.ts` — ESTENDER

**Análogo:** ele mesmo.

**`GenerateOptions` atual** (`web/src/types.ts` linhas 51–60):
```typescript
export interface GenerateOptions {
  maxPerChunk?: number;
  incluirExtraidas?: boolean;
  incluirCriadas?: boolean;
  tags?: string[];
  classificar?: boolean;
  cardBuilder?: boolean;
}
```
**Phase 4 adiciona** (sem tocar `Questao` — D-11):
```typescript
  mnemonico?: boolean;  // Phase 4: default true no App.tsx
  imagem?: boolean;     // Phase 4: default false no App.tsx
```

**`EnrichProgress.estagio` atual** (`web/src/types.ts` linhas 63–68):
```typescript
export interface EnrichProgress {
  estagio: 'classificando' | 'reescrevendo';
  index: number;
  total: number;
  erro?: string;
}
```
**Phase 4 amplia a union de literais** (espelhar exatamente o server):
```typescript
  estagio: 'classificando' | 'reescrevendo' | 'gerando-mnemonico' | 'gerando-imagem';
```

**`Questao` NÃO muda** (`web/src/types.ts` linhas 28–41) — já tem `mnemonico?`/`mnemonicoSvg?`:
```typescript
export interface Questao {
  ...
  mnemonico?: string;     // já existe — NÃO adicionar
  mnemonicoSvg?: string;  // já existe — NÃO adicionar
}
```

---

### `web/src/components/StructurePanel.tsx` — ESTENDER: bloco "Modo educativo"

**Análogo:** ele mesmo — bloco "Modo educativo" nas linhas 130–154.

**Bloco atual** (`StructurePanel.tsx` linhas 130–154):
```tsx
{/* Bloco "Modo educativo" (D-14) — mesma estrutura dos checkboxes acima.
    Phase 4 adiciona aqui: mnemônico e imagem. */}
<div className="border-t border-slate-100 pt-3">
  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
    Modo educativo
  </h3>
  <label className="flex items-center justify-between text-sm text-slate-700">
    <span>Classificar deck + tags</span>
    <input
      type="checkbox"
      checked={options.classificar !== false}
      onChange={(e) => setOptions({ ...options, classificar: e.target.checked })}
      className="h-4 w-4 rounded border-slate-300 text-brand-600"
    />
  </label>
  <label className="mt-2 flex items-center justify-between text-sm text-slate-700">
    <span>Card educativo</span>
    <input
      type="checkbox"
      checked={options.cardBuilder === true}
      onChange={(e) => setOptions({ ...options, cardBuilder: e.target.checked })}
      className="h-4 w-4 rounded border-slate-300 text-brand-600"
    />
  </label>
</div>
```

**Phase 4 adiciona 2 labels** com o MESMO padrão (após "Card educativo"):
```tsx
<label className="mt-2 flex items-center justify-between text-sm text-slate-700">
  <span>Mnemônico</span>
  <input
    type="checkbox"
    checked={options.mnemonico !== false}  // default ON (D-12)
    onChange={(e) => setOptions({ ...options, mnemonico: e.target.checked })}
    className="h-4 w-4 rounded border-slate-300 text-brand-600"
  />
</label>
<label className="mt-2 flex items-center justify-between text-sm text-slate-700">
  <span>Imagem de mnemônico</span>
  <input
    type="checkbox"
    checked={options.imagem === true}  // default OFF (D-12)
    onChange={(e) => setOptions({ ...options, imagem: e.target.checked })}
    className="h-4 w-4 rounded border-slate-300 text-brand-600"
  />
</label>
```

**Padrão de default split** (`App.tsx` linhas 20–26):
```tsx
const [options, setOptions] = useState<GenerateOptions>({
  maxPerChunk: 15,
  incluirExtraidas: true,
  incluirCriadas: true,
  classificar: true,   // default ON (D-15)
  cardBuilder: false,  // default OFF (D-15)
  // Phase 4 adiciona:
  // mnemonico: true,   // default ON (D-12): batch barato
  // imagem: false,     // default OFF (D-12): por-card caro
});
```

---

### `web/src/components/CardTable.tsx` — ESTENDER: badges 📝/🖼️

**Análogo:** ele mesmo — bloco de badges leitura-somente nas linhas 70–80.

**Padrão atual de badge** (`CardTable.tsx` linhas 71–80):
```tsx
{/* badges deck/tags read-only — só quando preenchidos (SPEC-05 campos opcionais — D-17) */}
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

**Phase 4 adiciona 2 badges** com o mesmo padrão (após os badges de deck/tags):
```tsx
{c.mnemonico && (
  <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700"
    title={c.mnemonico.slice(0, 60)}>
    📝 mnemônico
  </span>
)}
{c.mnemonicoSvg && (
  <span className="rounded bg-sky-100 px-1.5 py-0.5 text-xs font-medium text-sky-700">
    🖼️ SVG
  </span>
)}
```
**NUNCA** usar `dangerouslySetInnerHTML` ou renderizar o SVG no app web (D-13).

---

### `web/src/components/ProgressPanel.tsx` — VERIFICAR (provavelmente extensão mínima)

**Análogo:** ele mesmo.

**Bloco `enrichProgress` atual** (`ProgressPanel.tsx` linhas 51–59):
```tsx
{enrichProgress && (
  <div className="mt-3 flex items-center justify-between rounded bg-slate-50 px-2 py-1.5 text-xs text-slate-600">
    <span>
      {enrichProgress.estagio === 'classificando'
        ? 'Classificando deck + tags…'
        : `Reescrevendo card ${enrichProgress.index + 1}/${enrichProgress.total}…`}
    </span>
    {enrichProgress.erro && <span className="text-amber-600">erro</span>}
  </div>
)}
```

**Phase 4 amplia o switch de `estagio`** com 2 novos casos (mesma estrutura):
```tsx
{enrichProgress.estagio === 'classificando'
  ? 'Classificando deck + tags…'
  : enrichProgress.estagio === 'reescrevendo'
  ? `Reescrevendo card ${enrichProgress.index + 1}/${enrichProgress.total}…`
  : enrichProgress.estagio === 'gerando-mnemonico'
  ? 'Gerando mnemônicos…'
  : `Gerando imagem ${enrichProgress.index + 1}/${enrichProgress.total}…`}
```

---

### `web/src/App.tsx` — VERIFICAR (listener já genérico)

**Análogo:** ele mesmo.

**Listener `enrich-progress`** (`App.tsx` linhas 86–89) — já genérico, NENHUMA mudança necessária:
```tsx
es.addEventListener('enrich-progress', (ev) => {
  const data = JSON.parse((ev as MessageEvent).data) as EnrichProgress;
  setEnrichProgress(data);
});
```
O listener recebe qualquer valor de `estagio` e atualiza o estado. O `ProgressPanel` é quem interpreta o valor. Nenhuma mudança aqui.

**Defaults** (`App.tsx` linhas 20–26) — ESTENDER `useState`:
```tsx
const [options, setOptions] = useState<GenerateOptions>({
  ...
  mnemonico: true,   // Phase 4: default ON (D-12)
  imagem: false,     // Phase 4: default OFF (D-12)
});
```

---

## Padrões Compartilhados

### Isolamento de Erro por-Card (D-08/D-13)
**Fonte:** `enrich.ts` linhas 234–239 (catch do card-builder)
**Aplicar em:** Estágio 4 (imagem por-card), `sanitizarSvg()` (retorna `null`)
```typescript
} catch (err) {
  const erro = err instanceof Error ? err.message : String(err);
  onProgress?.({ estagio: 'reescrevendo', index: i, total, erro });
  // D-13: mantém o card original em falha — nunca perde um card
  novoResultado.push(q);
}
```

### Merge por Id via Map (anti-posicional, D-02/D-06)
**Fonte:** `enrich.ts` linhas 175–186
**Aplicar em:** Parser do mnemônico batch
```typescript
const byId = new Map(classificacoes.map((c) => [c.id, c]));
resultado = resultado.map((q) => {
  const c = byId.get(q.id);
  if (c) return { ...q, ...(c.deck !== undefined ? { deck: c.deck } : {}) };
  return q;
});
```

### Serialização segura do payload (T-03-02)
**Fonte:** `enrich.ts` linhas 107–119 (`buildClassificadorMessage`)
**Aplicar em:** `buildMnemonicoMessage` (novo helper)
```typescript
// NUNCA interpolar q.pergunta/q.resposta cru em template string
const cards = questoes.map((q) => ({ id: q.id, pergunta: q.pergunta, resposta: q.resposta, tipo: q.tipo }));
return [...instrucoes, JSON.stringify(cards, null, 2)].join('\n');
```

### Gate byte-identidade PIPE-03 (campos opcionais)
**Fonte:** `csv.ts` linhas 57–66 (gate `temDeck`)
**Aplicar em:** `versoDaQuestao` (csv) e `versoHtml` (ankiconnect) — extensão com `if (q.mnemonico)` e `if (q.mnemonicoSvg)`
```typescript
// Padrão: gate simples por campo opcional — ausente = saída byte-idêntica à Phase 3
if (q.mnemonico) { verso += ...; }
if (q.mnemonicoSvg) { verso += ...; }
```

### Padrão `loadPrompt` + cache
**Fonte:** `prompt-loader.ts` linhas 56–68
**Aplicar em:** `mnemonic` e `mnemonic-image` — já na allowlist `NOMES` (linha 35); sem mudança no loader.

### Padrão de badge read-only
**Fonte:** `CardTable.tsx` linhas 70–80
**Aplicar em:** badges `📝`/`🖼️` — mesmo padrão de `{c.campo && <span>...</span>}`, sem interação.

### Padrão de toggle no bloco "Modo educativo"
**Fonte:** `StructurePanel.tsx` linhas 130–154
**Aplicar em:** toggles mnemônico (default ON) / imagem (default OFF) — mesmo JSX de label+checkbox.

---

## Sem Análogo no Codebase

| Arquivo | Papel | Fluxo de Dados | Motivo |
|---------|-------|----------------|--------|
| `server/src/core/specialists/sanitize-svg.ts` | utilitário | transform | Primeira lib de sanitização externa do projeto; nenhum padrão de DOMPurify/jsdom existente. Usar configuração concreta do RESEARCH.md (Padrão 2, linhas 260–310). |

---

## Notas de Anti-padrão (para o planner incluir como restrições)

1. **`USE_PROFILES` + `ALLOWED_TAGS` juntos** → silenciosamente ignora o `ALLOWED_TAGS`. Usar APENAS `ALLOWED_TAGS` + `ALLOWED_ATTR`.
2. **`escapeHtml(q.mnemonicoSvg)`** → converte `<svg>` em texto literal no Anki. NUNCA escapar o SVG sanitizado.
3. **Merge posicional no batch mnemônico** → índice desalinha com conceituais omitidos. SEMPRE casar por `id` via `Map`.
4. **`sanitizarSvg()` retornando `""` vs `null`** → verificar `startsWith('<svg')`, não `if (svg)`.
5. **`deveRodarEnrich` sem os novos toggles** → com `mnemonico=true`, enrich não rodaria.
6. **Import local sem `.js`** → `ERR_MODULE_NOT_FOUND` em NodeNext ESM. `import { sanitizarSvg } from './sanitize-svg.js'` (com `.js`).
7. **Renderizar SVG no browser via `dangerouslySetInnerHTML`** → abre superfície de XSS diferente do Anki. D-13: apenas badges.

---

## Metadados

**Escopo de busca de análogos:** `ankinator-app/server/src/` + `ankinator-app/web/src/`
**Arquivos lidos:** 22
**Data do mapeamento:** 2026-06-03
**Confirmado no código real:** todos os análogos listados em `<canonical_refs>` foram lidos e os excerpts extraídos das linhas indicadas
