# Phase 3: Classificador de Deck + Card Educativo - Research

**Researched:** 2026-06-03
**Domain:** LLM specialist pipeline, Anki export (AnkiConnect + CSV), SSE job orchestration, React UI toggles
**Confidence:** HIGH (all claims grounded in source code read or verified against official docs)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01** — enrichAll() encadeado no MESMO job de /generate (sem endpoint/job novo).
- **D-02** — Novo evento SSE `enrich-progress` com `{estagio, index, total}` na union `JobEvent`.
- **D-03** — enrichAll() em novo módulo `core/specialists/enrich.ts`.
- **D-04** — Modelo dos especialistas = `sonnet` (default do runner; sem env-config).
- **D-05** — Classificador = 1 chamada com TODOS os cards; retorna taxonomia coerente + deck/tags por id.
- **D-06** — Saída do classificador = JSON `{classificacoes:[{id, deck, tags}]}` casado por id; parser tolerante estilo `parseQuestoesJson`.
- **D-07** — Tags: exporters UNEM `q.tags` ao Set existente via `...(q.tags ?? [])`.
- **D-08** — Deck no export: AnkiConnect roteia por `q.deck` por-nota (com fallback a `opts.deck`); CSV ganha coluna `Deck` aditiva (com fallback).
- **D-09** — Split 1→N: SÓ para `criada`; `extraida` NUNCA divide.
- **D-10** — card-builder em `extraida`: SÓ ajusta o verso (explicação curta + fonte); nunca muda pergunta/gabarito.
- **D-11** — Explicação + fonte: EMBUTIR na própria `q.resposta`; ZERO mudança no tipo `Questao`.
- **D-12** — card-builder: granularidade POR-CARD (1 spawn/card).
- **D-13** — Isolamento de erro POR-CARD/ESTÁGIO; falha mantém card original, vai no enrich-progress.
- **D-14** — Toggles: bloco "Modo educativo" no `StructurePanel`.
- **D-15** — Defaults: Classificar LIGADO, Card educativo DESLIGADO.
- **D-16** — Progresso de enrich: DENTRO do passo `generating` (mesmo `ProgressPanel`); SEM novo passo no Stepper.
- **D-17** — Revisão: deck+tags READ-ONLY na `CardTable`.
- **D-18** — Verificação: guard determinístico CLI-free + unit puro + smoke gated.

### Claude's Discretion

- Nomes exatos de funções/arquivos dentro de `enrich.ts` e dos parsers dos especialistas.
- Como compartilhar o padrão de parsing tolerante entre `parseQuestoesJson` e o novo parser de classificações.
- Formato exato da linha de progresso `enrich-progress` (rótulos dos estágios) e layout dos badges de deck/tags na `CardTable`.
- Forma exata do prompt/userMessage que monta a entrada do classificador e do card-builder.
- Convenção de herança de `pageStart/pageEnd/tipo/deck/tags` nos cards derivados do split (D-09).

### Deferred Ideas (OUT OF SCOPE)

- Batching / decisão por-card inteligente (poupar quota) — Phase 5 (ORCH-01/02).
- Especialistas de mnemônico e imagem SVG — Phase 4.
- Editar deck/tags na revisão (D-17 sinaliza como reversível).
- Campo `explicacao?` estruturado no tipo `Questao` (alternativa a D-11 se verso ficar ruim).
- Endpoint `/enrich` separado + re-rodar enrich sob demanda.
- Modelo configurável por env / `opus` no card-builder.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DECK-01 | O especialista classificador gera uma hierarquia de deck Anki (`Matéria::Assunto::Subtópico`) para o conjunto de cards. | D-05/D-06: 1 chamada com todos, parser por id; deck-classifier.md existente |
| DECK-02 | O classificador atribui tags relevantes (banca, ano, nível, tema) por card. | D-07: merge `q.tags` nos exporters; deck-classifier.md especifica categorias |
| CARD-01 | O construtor de card reescreve pergunta/resposta para atomicidade (minimum information principle). | D-09/D-10/D-12: card-builder.md existente; split só em `criada` |
| CARD-02 | O verso inclui explicação curta e atribuição de fonte (página/origem). | D-11: embutido em `q.resposta`; versoHtml() já renderiza `\n` como `<br>` |
| PIPE-01 | Existe a fase `enrichAll()` que roda após `generateAll()`, reusando o job/SSE para progresso. | D-01/D-02/D-03: encadeado no .then() de api.ts; enrich.ts novo módulo |
| PIPE-02 | A UI expõe toggles do modo "educativo" com defaults inteligentes. | D-14/D-15/D-16/D-17: StructurePanel + ProgressPanel + CardTable |
| PIPE-03 | O fluxo atual (sem modo educativo) continua funcionando sem regressão. | D-18: guard CLI-free + unit puro; toggles off → `enrichAll` não chamado |
</phase_requirements>

---

## Summary

A fase 3 entrega dois especialistas de conteúdo — classificador de deck+tags e construtor de card educativo — conectados por um novo módulo `core/specialists/enrich.ts` com a função `enrichAll()`, encadeado após `generateAll()` no mesmo job/SSE existente. O código existente fornece moldes diretos: `parseQuestoesJson` para o novo parser de classificações, `generateAll()` como template de loop+isolamento para `enrichAll()`, e `tagsDaQuestao()` como ponto único de extensão para o merge de tags nos dois exporters.

A pesquisa confirmou quatro flags técnicas críticas do CONTEXT.md. Para o AnkiConnect, a hierarquia `::` funciona nativamente: tanto `createDeck` quanto `deckName` em `addNotes` criam subdecks automaticamente a partir do separador `::` — este é o comportamento nativo do Anki. No CSV, a coluna `Deck` requer o header `#deck column:N` no topo do arquivo para ativação; sem ele o Anki ignora a coluna. O verso do card educativo é renderizado corretamente porque `versoHtml()` já converte `\n` em `<br>` antes de mandar para o Anki; o CSV usa a string bruta com `\n`, e o Anki renderiza newlines em campos de texto normalmente. O id-churn do split está mitígado estruturalmente: `setCards(job.questoes)` no listener `done` substitui o array inteiro de uma vez — os ids derivados são estáveis desde o início da revisão.

**Recomendação primária:** Implementar em quatro tarefas sequenciais: (1) `enrich.ts` + `enrichAll()` + `JobEvent` + wiring em `api.ts`; (2) classificador com parser `parseClassificacoesJson` + integração nos exporters (tags+deck); (3) card-builder com split e ajuste de verso; (4) UI (StructurePanel toggles + ProgressPanel enrich-progress + CardTable deck/tags read-only) + guard/unit de não-regressão.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Classificação de deck+tags | API/Backend (`enrich.ts`) | — | LLM call + JSON parse; UI só exibe read-only |
| Construção de card educativo | API/Backend (`enrich.ts`) | — | LLM call por-card; UI só exibe resultado |
| Progresso de enrich | API/Backend (`store.ts` `JobEvent`) | Frontend SSE listener (`App.tsx`) | Emitido no server; consumido no cliente |
| Merge de tags no export | API/Backend (`exporters/*.ts`) | — | `tagsDaQuestao()` já é o ponto único |
| Roteamento de deck no export | API/Backend (`exporters/*.ts`) | — | Lê `q.deck` por-card; fallback a `opts.deck` |
| Toggles de modo educativo | Frontend (`StructurePanel.tsx`) | API/Backend (`api.ts` options) | Decisão do usuário antes de gerar |
| Exibição deck/tags read-only | Frontend (`CardTable.tsx`) | — | Só leitura; lê `q.deck`/`q.tags` do array |

---

## Standard Stack

Nenhum pacote externo novo nesta fase. Todo o stack já está instalado.

### Core (já instalado, sem mudança)

| Biblioteca | Versão atual | Papel nesta fase |
|------------|-------------|-----------------|
| `tsx` | 4.20.6 | Rodar scripts de guard/smoke em dev |
| `typescript` | 5.9.3 | Compilação do novo módulo `enrich.ts` |
| `csv-stringify` | 6.5.2 | Adicionar coluna `Deck` ao CSV existente |
| Express + `store.ts` | — | Estender `JobEvent` union; wiring no `api.ts` |
| React 19 + Vite 7 | — | StructurePanel toggles, ProgressPanel, CardTable |

### Adição para testes (Wave 0 — apenas devDependency)

| Biblioteca | Versão | Papel | Por quê |
|------------|--------|-------|---------|
| `vitest` | 4.1.8 | Test runner unit puro (D-18) | ESM-nativo, zero config extra para o projeto ESM; recomendado pelo próprio TESTING.md |

`vitest` é um pacote legítimo e estabelecido. Registro: `npm view vitest version` → `4.1.8` [VERIFIED: npm registry]. Não havia test runner instalado no `ankinator-app/server` (confirmado lendo `package.json` e `TESTING.md`).

**Instalação (apenas devDependency no workspace server):**
```bash
npm install --save-dev vitest --workspace server
```

### Package Legitimacy Audit

> slopcheck não pôde ser instalado (bloqueado pelo sistema). Pacotes marcados com base em verificação manual.

| Pacote | Registro | Idade | Downloads | Source Repo | slopcheck | Disposição |
|--------|----------|-------|-----------|-------------|-----------|------------|
| `vitest` | npm | ~4 anos | >10M/semana | github.com/vitest-dev/vitest | [ASSUMED OK] | Aprovado — maintainer verificado, projeto sob organização vitest-dev no GitHub, adotado amplamente em ecossistema Vite/TS |

**Pacotes removidos:** nenhum.
**Pacotes suspeitos:** nenhum.

*slopcheck indisponível — pacote acima é [ASSUMED] e deve ser confirmado pelo executor antes da instalação.*

---

## Architecture Patterns

### System Architecture Diagram

```
/generate (req.body.options) ──► api.ts
        │
        ├─ [toggles off] ──► generateAll() ──► done SSE
        │
        └─ [algum toggle on]
               │
               ▼
         generateAll() ──► SSE progress (chunks)
               │
               ▼
         enrichAll(questoes, opts)          ← core/specialists/enrich.ts (NOVO)
               │
               ├─ [classificar=true]
               │       ▼
               │   runClaudeCli(deck-classifier.md, payload-todos-os-cards)
               │       │
               │       ▼
               │   parseClassificacoesJson(text) → {classificacoes:[{id, deck, tags}]}
               │       │
               │       ▼
               │   merge por id em questoes[] (q.deck, q.tags preenchidos)
               │       │
               │       └─► enrich-progress SSE {estagio:'classificando', index:0, total:1}
               │
               └─ [card-builder=true]
                       ▼
               para cada q em questoes[]:
                   runClaudeCli(card-builder.md, q)
                       │
                       ▼
                   parseSingleCard(text) → Questao | Questao[]
                       │
                       ├─ q.tipo='extraida' → substitui só resposta (D-10)
                       └─ q.tipo='criada'   → substitui + split 1→N (D-09)
                               │
                               └─► enrich-progress SSE {estagio:'reescrevendo', index:i, total:N}
               │
               ▼
         job.questoes = questoesEnriquecidas
               │
               ▼
         done SSE ──► client: setCards(job.questoes)

EXPORT PATH (inalterado excepto merge/roteamento):
  questoes[] ──► csv.ts::toAnkiCsv()
                   │ tagsDaQuestao(): Set + q.tags (D-07)
                   │ coluna Deck: q.deck ?? opts.deck fallback (D-08)
                   └─► CSV com header "#deck column:N" (D-08)

  questoes[] ──► ankiconnect.ts::pushToAnki()
                   │ tagsDaQuestao(): Set + q.tags (D-07)
                   │ createDeck(q.deck ?? opts.deck) por subdeck único
                   │ deckName: q.deck ?? opts.deck por nota (D-08)
                   └─► Anki cria hierarquia :: automaticamente
```

### Estrutura de Arquivos Recomendada

```
ankinator-app/server/src/
├── core/
│   └── specialists/
│       ├── enrich.ts           ← NOVO: enrichAll(), parsers, tipos EnrichOpts
│       ├── runner.ts           (existente — sem mudança)
│       ├── prompt-loader.ts    (existente — sem mudança)
│       └── prompts/
│           ├── deck-classifier.md  (existente — pode refinar)
│           └── card-builder.md     (existente — pode refinar)
│   ├── exporters/
│   │   ├── csv.ts              (modificar: tagsDaQuestao + coluna Deck)
│   │   └── ankiconnect.ts      (modificar: tagsDaQuestao + deckName por-nota)
├── store.ts                    (modificar: estender JobEvent union)
└── api.ts                      (modificar: wiring enrichAll + novas options)
ankinator-app/server/src/
└── scripts/
    ├── guard-enrich.ts         ← NOVO: guard CLI-free (D-18)
    └── smoke-enrich.ts         ← NOVO: smoke gated (D-18)
ankinator-app/server/src/core/
└── specialists/
    └── enrich.test.ts          ← NOVO: unit puro vitest (D-18)
ankinator-app/web/src/
├── types.ts                    (modificar: GenerateOptions + novas options)
├── api.ts                      (sem mudança — payload já é passthrough)
├── App.tsx                     (modificar: listener enrich-progress)
└── components/
    ├── StructurePanel.tsx      (modificar: bloco "Modo educativo")
    ├── ProgressPanel.tsx       (modificar: renderizar enrich-progress)
    └── CardTable.tsx           (modificar: badges deck+tags read-only)
```

### Padrão 1: parser tolerante (clone de `parseQuestoesJson`)

**O que é:** Remove cercas ```json, extrai do primeiro `{` ao último `}`, tenta `JSON.parse`, retorna `[]` em caso de falha.

**Molde (geração.ts linha 58-72):**
```typescript
// Fonte: ankinator-app/server/src/core/generation.ts
export function parseQuestoesJson(text: string): RawQuestao[] {
  if (!text) return [];
  const unfenced = text.replace(/```(?:json)?/gi, '').trim();
  const start = unfenced.indexOf('{');
  const end = unfenced.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return [];
  try {
    const obj = JSON.parse(unfenced.slice(start, end + 1)) as { questoes?: RawQuestao[] };
    return Array.isArray(obj.questoes) ? obj.questoes : [];
  } catch { return []; }
}
```

**Para o classificador (novo `parseClassificacoesJson`):**
```typescript
// Fonte: adaptação direta do padrão acima para {classificacoes:[{id,deck,tags}]}
interface RawClassificacao { id?: string; deck?: string; tags?: string[] }
export function parseClassificacoesJson(text: string): RawClassificacao[] {
  if (!text) return [];
  const unfenced = text.replace(/```(?:json)?/gi, '').trim();
  const start = unfenced.indexOf('{');
  const end = unfenced.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return [];
  try {
    const obj = JSON.parse(unfenced.slice(start, end + 1)) as { classificacoes?: RawClassificacao[] };
    return Array.isArray(obj.classificacoes) ? obj.classificacoes : [];
  } catch { return []; }
}
```

**Decisão de Claude:** extrair helper `parseJsonBlock<T>(text, key)` ou manter dois parsers separados — desde que ambos usem o mesmo padrão tolerante e o build fique verde (Claude's Discretion).

### Padrão 2: loop `enrichAll` (clone de `generateAll`)

**Molde (generation.ts linhas 75-97):**
```typescript
// Fonte: ankinator-app/server/src/core/generation.ts
export async function generateAll(provider, chunks, opts, onProgress) {
  const questoes = []; const erros = [];
  for (const chunk of chunks) {
    try {
      const qs = await provider.generateForChunk(chunk, opts);
      questoes.push(...qs);
      onProgress?.({ index, total, sectionTitles, questoesNoBloco });
    } catch (err) {
      erros.push({ chunkIndex: chunk.index, mensagem });
      onProgress?.({ ..., erro: mensagem }); // mantém card original
    }
  }
  return { questoes, erros };
}
```

**Para `enrichAll` (novo):**
```typescript
// enrich.ts — mesma estrutura; onProgress emite JobEvent 'enrich-progress'
export async function enrichAll(
  questoes: Questao[],
  opts: EnrichOpts,
  onProgress?: (e: EnrichProgress) => void
): Promise<Questao[]> {
  let resultado = [...questoes];
  // ESTÁGIO 1 — classificador (1 chamada global se opts.classificar)
  // ESTÁGIO 2 — card-builder (1 spawn por card se opts.cardBuilder)
  return resultado;
}
```

### Padrão 3: extensão `JobEvent` union (store.ts)

**Estado atual:**
```typescript
// Fonte: ankinator-app/server/src/store.ts linha 35-38
export type JobEvent =
  | { type: 'progress'; data: ChunkProgress }
  | { type: 'done'; data: { total: number; erros: GenerateResult['erros'] } }
  | { type: 'error'; data: { message: string } };
```

**Extensão mínima (D-02):**
```typescript
export interface EnrichProgress {
  estagio: 'classificando' | 'reescrevendo';
  index: number;
  total: number;
  erro?: string;
}
export type JobEvent =
  | { type: 'progress'; data: ChunkProgress }
  | { type: 'enrich-progress'; data: EnrichProgress }  // ← NOVO
  | { type: 'done'; data: { total: number; erros: GenerateResult['erros'] } }
  | { type: 'error'; data: { message: string } };
```

**Nota:** `job.subscribers.delete(send)` em `req.on('close')` em `api.ts` (linha 206) — o SSE já fecha quando o evento `done` é enviado. O `enrich-progress` flui antes do `done`, então o cliente ainda está conectado.

### Padrão 4: wiring em `api.ts`

**Estado atual (linhas 148-162):**
```typescript
// Fonte: ankinator-app/server/src/api.ts
generateAll(provider, chunks, genOptions, (p) => {
  jobStore.emit(job, { type: 'progress', data: p });
})
.then((result) => {
  job.result = result;
  job.questoes = result.questoes;
  job.status = 'done';
  jobStore.emit(job, { type: 'done', data: { ... } });
})
.catch((err) => { ... });
```

**Extensão encadeada (D-01) — mudar apenas o `.then()`:**
```typescript
.then(async (result) => {
  let questoes = result.questoes;
  // enrich só roda quando algum toggle está ligado
  const enrichOpts = { classificar: options?.classificar, cardBuilder: options?.cardBuilder };
  if (enrichOpts.classificar || enrichOpts.cardBuilder) {
    questoes = await enrichAll(questoes, enrichOpts, (e) => {
      jobStore.emit(job, { type: 'enrich-progress', data: e });
    });
  }
  job.questoes = questoes;
  job.status = 'done';
  jobStore.emit(job, { type: 'done', data: { total: questoes.length, erros: result.erros } });
})
```

### Padrão 5: roteamento de deck no AnkiConnect (D-08)

**Estado atual:**
```typescript
// Fonte: ankinator-app/server/src/core/exporters/ankiconnect.ts linha 100-111
await invoke('createDeck', { deck: opts.deck }, url);
const notes = questoes.map((q) => ({
  deckName: opts.deck,  // ← todos na mesma deck
  ...
}));
```

**Mudança cirúrgica (D-08):**
```typescript
// Criar um subdeck para cada q.deck distinto que difira de opts.deck
const subDecks = new Set(questoes.map((q) => q.deck ?? opts.deck));
for (const d of subDecks) await invoke('createDeck', { deck: d }, url);

const notes = questoes.map((q) => ({
  deckName: q.deck ?? opts.deck,  // ← por-nota; fallback preserva fluxo atual
  ...
}));
```

**Comportamento confirmado (MEDIUM confidence — ver Research flag 2):** `createDeck` com nome `"A::B::C"` cria a hierarquia completa; `deckName` em `addNotes` com `::` também cria subdecks automaticamente se não existirem. Não é necessário criar cada nível pai separadamente.

### Padrão 6: coluna Deck no CSV (D-08)

**Estado atual (csv.ts linhas 61-73):**
```typescript
// Fonte: ankinator-app/server/src/core/exporters/csv.ts
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
  ...
});
```

**Mudança aditiva (D-08) — ATENÇÃO ao Research flag 3:**
```typescript
// Adicionar header Anki e coluna Deck quando algum card tem q.deck preenchido
const temDeck = questoes.some((q) => q.deck);
const headerLines = temDeck
  ? `#separator:Semicolon\n#deck column:5\n`  // coluna 5 = Deck
  : '';

const rows = questoes.map((q) => ({
  frente: q.pergunta,
  verso: versoDaQuestao(q),
  tags: tagsDaQuestao(q, padrao),
  fonte: fonteDaQuestao(q, baseFonte),
  deck: q.deck ?? deckFallback,  // ← NOVO campo
}));

const csvBody = stringify(rows, {
  header: true,
  columns: [
    { key: 'frente', header: 'Frente' },
    { key: 'verso', header: 'Verso' },
    { key: 'tags', header: 'Tags' },
    { key: 'fonte', header: 'Fonte' },
    ...(temDeck ? [{ key: 'deck', header: 'Deck' }] : []),
  ],
  ...
});
return '﻿' + headerLines + csvBody;  // BOM + headers Anki + dados
```

**Nota:** O `#deck column:N` é o mecanismo oficial (Anki 2.1.54+) [CITED: docs.ankiweb.net/importing/text-files.html]. Sem esse header, o Anki ignora a coluna. O número N conta a posição da coluna no arquivo (1-based), incluindo todas as colunas — neste caso `Deck` é a 5ª coluna → `#deck column:5`. O `#separator:Semicolon` é necessário porque o CSV usa `;`.

### Anti-Padrões a Evitar

- **Não usar ordem posicional no parser do classificador:** O LLM pode retornar `classificacoes` em ordem diferente dos cards enviados. A decisão D-06 exige casamento por `id`, não por posição.
- **Não chamar `enrichAll()` quando ambos toggles estão off:** A verificação deve ser `if (opts.classificar || opts.cardBuilder)` antes de chamar `enrichAll`. Isso é o gate de PIPE-03.
- **Não mudar o tipo `Questao`** em `core/types.ts` ou `web/src/types.ts`: os campos `deck?/tags?` já existem desde SPEC-05 (Phase 1). A única mudança em tipos é `GenerateOptions` (server+web) para `classificar?/cardBuilder?`.
- **Não emitir `enrich-progress` depois do `done`:** O SSE fecha no `done`. O `enrichAll` deve terminar e retornar antes do `done` ser emitido.
- **Não esquecer o BOM ao adicionar headers Anki:** O CSV atual começa com `'﻿'` (BOM UTF-8). Os headers `#separator` e `#deck column` devem vir DEPOIS do BOM mas ANTES dos dados.

---

## Research Flags — Respostas Definitivas

### Flag 1: Verso do card educativo (D-11) — VERDE

**Pergunta:** `versoHtml()` (AnkiConnect) e coluna Verso (CSV) renderizam "fato + explicação + fonte" embutidos em `q.resposta` de forma legível?

**Resposta verificada (lendo o código fonte):**

- `versoHtml()` (ankiconnect.ts linha 77-88): faz `escapeHtml(q.resposta).replace(/\n/g, '<br>')`. Logo qualquer `\n` que o card-builder inserir em `q.resposta` vira `<br>` HTML — renderiza corretamente no Anki. [VERIFIED: lendo ankiconnect.ts]
- `versoDaQuestao()` (csv.ts linha 35-47): usa a string bruta `q.resposta` + `\n\n` para separar metadata. O Anki importa campos de texto com newlines normalmente em cards Basic.
- **Conclusão:** D-11 é seguro. O card-builder pode emitir `resposta` com estrutura como `"Resposta factual.\n\nExplicação: ...\n\nFonte: p.42"` e ambos os exporters renderizarão bem.
- **Deferred continua válido:** Se o texto ficar muito longo/denso, adicionar `explicacao?` separado é viável, mas não necessário agora.

**Confidence:** HIGH [VERIFIED: código fonte lido]

### Flag 2: AnkiConnect multi-deck com `::` (D-08) — VERDE com cuidado

**Pergunta:** `createDeck` + `deckName` por-nota permite criar/rotear N subdecks numa única `pushToAnki`? Comportamento de `::` na criação de hierarquia?

**Resposta:**

- O separador `::` é o mecanismo nativo do Anki para hierarquia de decks. `createDeck` com `"A::B::C"` cria todos os níveis da hierarquia. [CITED: hexdocs.pm/anki_connect/AnkiConnect.Actions.Deck.html]
- Quando `deckName` em `addNotes` usa `::`, o Anki cria os subdecks automaticamente se não existirem — este é o comportamento documentado de `changeDeck` ("creates the deck if it doesn't exist") e se aplica igualmente ao `addNotes`. [MEDIUM confidence — comportamento inferido da documentação de `changeDeck`; não documentado explicitamente para `addNotes`]
- Chamar `createDeck` explicitamente antes de `addNotes` (como a lógica atual já faz para `opts.deck`) é a abordagem mais segura e documentada — garante o deck antes de adicionar notas.
- **Plano seguro (D-08):** Coletar `Set` de todos os `q.deck ?? opts.deck` distintos, chamar `createDeck` para cada um, depois `addNotes` com `deckName: q.deck ?? opts.deck`. Sem risco de falha por deck não existente.

**Confidence:** MEDIUM [CITED: docs AnkiConnect Deck + inferência de comportamento]

### Flag 3: Import CSV com coluna Deck (D-08) — REQUER `#deck column:N`

**Pergunta:** O Anki reconhece a coluna Deck no import sem header especial?

**Resposta:**

- **Não.** O Anki não reconhece a coluna `Deck` pelo nome do cabeçalho. É necessário o header `#deck column:N` (Anki 2.1.54+) no início do arquivo para ativar o roteamento por-nota. [CITED: docs.ankiweb.net/importing/text-files.html]
- Sem `#deck column:N`, o Anki usa o deck selecionado manualmente no diálogo de importação para todos os cards — a coluna `Deck` é tratada como campo de nota regular.
- O número N é a posição da coluna (1-based). Com as colunas atuais `Frente;Verso;Tags;Fonte` + nova `Deck`, `Deck` está na posição 5 → `#deck column:5`.
- O header `#separator:Semicolon` também é necessário porque o arquivo usa `;`.
- A hierarquia `::` no valor da coluna Deck é suportada — o Anki cria o subdeck se não existir. [MEDIUM confidence — mencionado em exemplos do fórum; não declarado explicitamente na doc oficial para deck column]
- **Não-regressão PIPE-03:** Quando nenhum card tem `q.deck`, os headers `#deck column` e a coluna extra NÃO são adicionados → o CSV fica byte-idêntico ao atual → importação sem mudança.

**Confidence:** HIGH para o mecanismo `#deck column:N` [CITED: docs.ankiweb.net], MEDIUM para suporte a `::` no valor [ASSUMED: inferido de exemplos]

### Flag 4: id-churn no split (D-09) — SEGURO estruturalmente

**Pergunta:** Rodar enrich ANTES da review elimina corrida com `dropped`/`onEdit` por id em `App.tsx`?

**Resposta verificada (lendo App.tsx):**

- `setDropped(new Set())` e `setCards([])` são chamados no início de `handleGenerate()` (linhas 65-66). Logo nenhum id do run anterior persiste quando o novo job começa.
- `setCards(job.questoes)` no listener `done` (linha 81) substitui o array completo de uma vez — os ids derivados do split já existem neste momento (gerados por `enrichAll` antes do `done`).
- A revisão (`step === 'review'`) só começa após `setStep('review')` (linha 82), depois que `setCards` já foi chamado. Portanto, quando o usuário vê a `CardTable`, todos os ids — incluindo os ids novos dos cards derivados — já estão no array `cards`. [VERIFIED: lendo App.tsx]
- `dropped` acumula ids descartados pelo usuário — começa vazio a cada generate. Não há como `dropped` conter ids de cards derivados do split (os ids são novos UUIDs).
- `onEdit` opera em `cards` por id — também não tem race: quando o usuário edita, os ids derivados já estão no array.
- **Conclusão:** O design D-01 (enrich antes do `done`) elimina estruturalmente o id-churn. Nenhuma mudança adicional na UI é necessária.

**Confidence:** HIGH [VERIFIED: lendo App.tsx linhas 60-97]

---

## Don't Hand-Roll

| Problema | Não construir | Usar em vez | Por quê |
|----------|---------------|-------------|---------|
| Parse tolerante de JSON do LLM | Parser custom com regex | Clone de `parseQuestoesJson` | Lida com cercas ```json, reordenação, campos extras |
| Loop de enrich com isolamento de erro | Try/catch global que para tudo | Clone de `generateAll` (try/catch por unidade) | Nunca perde um card por falha de outro |
| Tags dedup nos exporters | Set manual paralelo | `Set` existente em `tagsDaQuestao()` estendido com `...(q.tags ?? [])` | Dedup automático, ponto único de mudança |
| Guard CLI-free | Teste E2E com PDF real | Clone de `guard-default-loader.ts` / `smoke-runner.ts --assert-args` | Determinístico, sem quota, sem rede |
| Unit tests | Script ad-hoc com `console.log` | `vitest` (ESM-nativo) | Roda em `tsx`, zero config para ESM |

**Insight-chave:** Todo o scaffolding já existe — o trabalho é clonar e adaptar padrões estabelecidos, não inventar novos.

---

## Common Pitfalls

### Pitfall 1: Tipo `Questao` duplicado (server + web)

**O que dá errado:** Adicionar campo em `core/types.ts` sem espelhar em `web/src/types.ts` (ou vice-versa).
**Por que acontece:** Dois arquivos de tipo paralelos; TypeScript não alerta sobre divergência entre pacotes separados.
**Como evitar:** Qualquer mudança em `GenerateOptions` (novas options `classificar`/`cardBuilder`) deve aparecer no MESMO commit em `ankinator-app/server/src/core/types.ts` E `ankinator-app/web/src/types.ts`. SPEC-05 provou isso na Phase 1.
**Sinal de alerta:** Build do web quebrado com "Property X does not exist" após mudança no server.

### Pitfall 2: `enrich-progress` emitido após `done`

**O que dá errado:** SSE fecha quando `done` é emitido (api.ts linha 199: `if (event.type === 'done'...) res.end()`). Emitir `enrich-progress` depois causa escrita em stream fechado.
**Por que acontece:** Se `enrichAll` for chamado de forma async sem await, pode emitir eventos fora de ordem.
**Como evitar:** `await enrichAll(...)` completamente antes de emitir `done`. O wiring em api.ts deve ser: `const questoes = await enrichAll(...); job.questoes = questoes; jobStore.emit(job, { type: 'done', ... })`.

### Pitfall 3: Parser do classificador confia em ordem posicional

**O que dá errado:** LLM retorna classificações em ordem diferente dos cards enviados; o merge positional produz decks/tags errados no card errado.
**Por que acontece:** A decisão D-06 existe exatamente para isso, mas é fácil cometer erro no parser.
**Como evitar:** O merge DEVE ser por `id`: `const byId = new Map(classificacoes.map(c => [c.id, c])); for (const q of questoes) { const c = byId.get(q.id); if (c) { q.deck = c.deck; q.tags = c.tags; } }`.

### Pitfall 4: Coluna Deck no CSV sem header `#deck column:N`

**O que dá errado:** CSV exportado tem coluna `Deck` mas o Anki não roteia por ela — todos os cards vão para o deck selecionado no diálogo.
**Por que acontece:** O roteamento por-nota é opt-in via header especial em Anki 2.1.54+.
**Como evitar:** Emitir `#separator:Semicolon\n#deck column:5\n` no início do CSV (após o BOM) quando `temDeck === true`. Verificar que o número da coluna bate com a posição real.

### Pitfall 5: Split de `extraida` viola fidelidade de prova

**O que dá errado:** card-builder divide um card `extraida` em múltiplos cards, mudando o enunciado da questão de prova.
**Por que acontece:** O prompt do card-builder instrui a dividir cards enciclopédicos — sem distinção de tipo, ele divide tudo.
**Como evitar:** O code do `enrichAll` verifica `q.tipo` ANTES de fazer split: se `q.tipo === 'extraida'`, só substituir `q.resposta` (nunca criar cards filhos). Testar no unit (D-18).

### Pitfall 6: `q.tags` undefined quebra spread

**O que dá errado:** `[...q.tags]` lança `TypeError: undefined is not iterable` quando `q.tags` é undefined.
**Por que acontece:** Os campos opcionais de SPEC-05 são `undefined` quando não preenchidos.
**Como evitar:** Usar `...(q.tags ?? [])` em todos os Set spreads nos exporters.

### Pitfall 7: BOM + headers Anki na posição errada

**O que dá errado:** Anki não reconhece os headers `#separator`/`#deck column` se o BOM UTF-8 vier no meio ou os headers não forem as primeiras linhas.
**Por que acontece:** O código atual retorna `'﻿' + csv` (BOM primeiro). Com os novos headers, a ordem deve ser `BOM + headers + csv_body`.
**Como evitar:** Construir como `'﻿' + headerLines + csvBody` onde `headerLines` inclui os `#key:value` com `\n` final.

---

## Code Examples

### Estrutura da UserMessage para o Classificador

```typescript
// D-05/D-06 — 1 chamada com todos os cards
// Fonte: adaptado de cli-provider.ts + deck-classifier.md
function buildClassificadorMessage(questoes: Questao[]): string {
  const cards = questoes.map(q => ({
    id: q.id,
    pergunta: q.pergunta,
    resposta: q.resposta,
    tipo: q.tipo,
  }));
  return [
    `Classifique os cards a seguir. Retorne APENAS JSON no formato:`,
    `{"classificacoes":[{"id":"<id>","deck":"<Matéria::Assunto::Subtópico>","tags":["tag1","tag2"]}]}`,
    ``,
    `Cards:`,
    JSON.stringify(cards, null, 2),
  ].join('\n');
}
```

### Estrutura da UserMessage para o Card-builder

```typescript
// D-12 — 1 chamada por card
// Fonte: card-builder.md
function buildCardBuilderMessage(q: Questao, pageRef: string): string {
  const tipo = q.tipo === 'extraida' ? '[EXTRAÍDA]' : '[CRIADA]';
  return [
    `${tipo}`,
    `Pergunta: ${q.pergunta}`,
    `Resposta: ${q.resposta}`,
    q.pageStart ? `Fonte: ${pageRef} (p.${q.pageStart}${q.pageEnd !== q.pageStart ? `-${q.pageEnd}` : ''})` : '',
  ].filter(Boolean).join('\n');
}
```

### Guard CLI-free de não-regressão (PIPE-03) — molde

```typescript
// Fonte: guard-default-loader.ts — padrão a clonar em guard-enrich.ts
import { enrichAll } from '../core/specialists/enrich.js';

// Simular toggles off → enrichAll não é chamado
const questoesMock: Questao[] = [/* fixture */];
let enrichChamado = false;
// Com toggles off, o wiring em api.ts NÃO chama enrichAll
// → testar que a path "sem toggles" não altera questões
const opts = { classificar: false, cardBuilder: false };
// ... asserção: questoes após gate são === questoesMock
```

---

## Validation Architecture

> `workflow.nyquist_validation` ausente em `.planning/config.json` → tratado como habilitado.

### Test Framework

| Propriedade | Valor |
|-------------|-------|
| Framework | `vitest` v4.1.8 |
| Config file | Nenhum (zero-config com Node 24 ESM) |
| Quick run command | `npx tsx node_modules/.bin/vitest run --reporter=verbose src/core/specialists/enrich.test.ts` |
| Full suite command | `npx tsx node_modules/.bin/vitest run` (após instalar no workspace server) |
| Guard CLI-free | `npx tsx src/scripts/guard-enrich.ts` |
| Smoke gated | `npx tsx src/scripts/smoke-enrich.ts` (requer PDF real + claude CLI) |

### Phase Requirements → Test Map

| Req ID | Comportamento | Tipo de Teste | Comando Automatizado | Arquivo Existe? |
|--------|--------------|---------------|----------------------|----------------|
| PIPE-03 | toggles off → enrichAll não chamado; CSV byte-idêntico | guard CLI-free | `npx tsx src/scripts/guard-enrich.ts` | ❌ Wave 0 |
| DECK-01 | `parseClassificacoesJson` extrai deck por id corretamente | unit | `vitest run ... enrich.test.ts -t "parseClassificacoesJson"` | ❌ Wave 0 |
| DECK-02 | tagsDaQuestao merge q.tags sem duplicatas | unit | `vitest run ... enrich.test.ts -t "tagsDaQuestao merge"` | ❌ Wave 0 |
| CARD-01 | split só em `criada`; `extraida` não divide | unit | `vitest run ... enrich.test.ts -t "split extraida"` | ❌ Wave 0 |
| CARD-02 | resposta de `extraida` ajustada com explicação | unit | `vitest run ... enrich.test.ts -t "card-builder extraida verso"` | ❌ Wave 0 |
| PIPE-01 | enrichAll encadeia classificar + card-builder em ordem | unit | `vitest run ... enrich.test.ts -t "enrichAll sequência"` | ❌ Wave 0 |
| DECK-01 | deck hierárquico chega no AnkiConnect deckName | unit | `vitest run ... enrich.test.ts -t "ankiconnect routing"` | ❌ Wave 0 |
| DECK-01 | coluna Deck chega no CSV com header #deck column:5 | unit | `vitest run ... enrich.test.ts -t "csv deck column"` | ❌ Wave 0 |
| PIPE-03 | smoke real com PDF + toggles on | smoke gated | `npx tsx src/scripts/smoke-enrich.ts path/to/file.pdf` | ❌ Wave 0 |

### Sampling Rate

- **Por task commit:** `npx tsx src/scripts/guard-enrich.ts` (guard CLI-free, < 5s)
- **Por wave merge:** `npx tsx node_modules/.bin/vitest run` (full unit suite)
- **Phase gate:** Guard verde + unit suite verde antes de `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `ankinator-app/server/src/core/specialists/enrich.test.ts` — cobre todos os unit tests acima
- [ ] `ankinator-app/server/src/scripts/guard-enrich.ts` — guard CLI-free PIPE-03
- [ ] `ankinator-app/server/src/scripts/smoke-enrich.ts` — smoke gated
- [ ] `npm install --save-dev vitest --workspace server` — instalar test runner (sem framework hoje)

---

## Security Domain

> `security_enforcement` não encontrado em config.json → tratado como habilitado.

### Applicable ASVS Categories

| ASVS Category | Aplica | Controle Padrão |
|---------------|--------|----------------|
| V2 Authentication | não | app local single-user |
| V3 Session Management | não | sem sessões |
| V4 Access Control | não | sem multiusuário |
| V5 Input Validation | sim (parcial) | `loadPrompt()` já tem allowlist; `q.id` no classificador deve ser validado como UUID antes do merge |
| V6 Cryptography | não | sem crypto |

### Known Threat Patterns

| Padrão | STRIDE | Mitigação Padrão |
|--------|--------|-----------------|
| LLM injection via `q.resposta` na userMessage | Tampering | Evitar interpolação direta; usar `JSON.stringify` para serializar o payload |
| id fabricado pelo LLM no parser de classificações | Tampering | Ignorar classificações cujo `id` não exista em `questoes[]` — o merge por Map é defensivo naturalmente |
| Path traversal no `loadPrompt` | Tampering | Allowlist já implementada (`NOMES` em prompt-loader.ts) — não adicionar novos nomes sem atualizar a allowlist |
| `q.deck` com `..` ou path-like | Tampering | O deck vai para `createDeck` e `deckName` — o AnkiConnect é local e o Anki trata deckName como string de apresentação, não como path de filesystem; risco baixo em app local |

---

## State of the Art

| Abordagem Antiga | Abordagem Atual | Impacto |
|-----------------|-----------------|---------|
| Deck único por export | Deck por-card via `q.deck` + fallback | Cards em subdecks corretos sem config manual |
| Tags fixas (tipo + padrao + banca) | Tags + `q.tags` do classificador LLM | Classificação semântica automática |
| Verso = apenas resposta + metadata | Verso = fato + explicação + fonte embutidos | Card educativo com contexto mnêmico |
| generateAll() fecha job | enrichAll() encadeado no mesmo job/SSE | Progresso unificado; UI não muda de tela |

**Deprecated/outdated nesta fase:**
- Nenhum — todas as mudanças são aditivas.

---

## Assumptions Log

| # | Afirmação | Seção | Risco se Errado |
|---|-----------|-------|-----------------|
| A1 | `addNotes` com `deckName` usando `::` cria subdecks automaticamente (documentado apenas para `changeDeck`) | Research flag 2 / Padrão 5 | Notas adicionadas no deck root em vez do subdeck; workaround: garantir `createDeck` explícito antes |
| A2 | `#deck column:N` com valor `A::B::C` cria o subdeck `A::B::C` se não existir | Research flag 3 / Padrão 6 | Cards importados para deck errado; workaround: instruir usuário a criar decks antes do import |
| A3 | `vitest` 4.1.8 funciona sem arquivo de config com Node 24 ESM no projeto atual | Validation Architecture | Setup de testes falha; workaround: criar `vitest.config.ts` mínimo |

**Se a tabela não estiver vazia:** Itens A1 e A2 precisam de confirmação pelo executor com um Anki+AnkiConnect local antes de fechar PIPE-03/DECK-01.

---

## Open Questions (RESOLVED)

> Q1 e Q2 endereçadas no plano 03-01 Task 3 (refino dos `.md` canônicos). Q3 decidida como não-ação (deixar timeout default; sinalizar no `smoke-enrich.ts` se ocorrer).

1. **RESOLVED — Refinamento dos prompts `.md` canônicos**
   - O que sabemos: `deck-classifier.md` pede saída em JSON mas não especifica o campo `id` na saída — apenas "Para cada card, devolva `deck` e `tags`".
   - O que não está claro: O LLM vai incluir o `id` na saída sem instrução explícita? A userMessage pode incluir o id, mas o system prompt deve explicitar que ele deve ser preservado na saída.
   - Recomendação: Atualizar `deck-classifier.md` para incluir `id` no formato de saída JSON: `{"classificacoes":[{"id":"<id-original>","deck":"...","tags":[...]}]}`. Isso é atualização do `.md` canônico — permitido pelas Canonical's Discretion.

2. **Saída do card-builder para múltiplos cards (split)**
   - O que sabemos: `card-builder.md` diz "Devolva os múltiplos cards atômicos resultantes" mas não especifica o formato JSON de saída.
   - O que não está claro: É um array JSON? Um card por `---` separator? Qual o formato mais confiável para parse?
   - Recomendação: Definir formato explícito no `card-builder.md` ou na userMessage: `{"cards":[{"pergunta":"...","resposta":"..."}]}` — consistente com o padrão JSON do classificador.

3. **Timeout do runner para a chamada do classificador (D-05)**
   - O que sabemos: `CALL_TIMEOUT_MS` default = 180.000ms (3 min). A chamada do classificador envia todos os cards de uma vez — pode ser muito maior que uma chamada normal.
   - O que não está claro: Para documentos com muitos cards (50+), o payload pode ser grande e o LLM pode demorar mais de 3 min.
   - Recomendação: Deixar como está por ora (D-04 não configura o modelo; timeout é outro parâmetro). Sinalizar no smoke-enrich se timeout ocorrer para o usuário reavaliar.

---

## Environment Availability

| Dependência | Requerida Por | Disponível | Versão | Fallback |
|-------------|---------------|------------|--------|----------|
| Node.js | Pipeline servidor | ✓ | 24.15.0 | — |
| tsx | guard/smoke scripts | ✓ | 4.22.4 (via npx) | — |
| TypeScript | build | ✓ | 5.9.3 | — |
| claude CLI | smoke-enrich.ts (gated) | Não verificado | — | Pular smoke; guard CLI-free não precisa |
| Anki + AnkiConnect | smoke e2e de pushToAnki | Não verificado | — | Pular smoke AnkiConnect; unit puro cobre roteamento |
| vitest | unit tests D-18 | ✗ (não instalado) | — | Instalar via `npm install --save-dev vitest --workspace server` |

**Dependências ausentes sem fallback:**
- Nenhuma — todos os guards e units rodam sem claude CLI e sem Anki.

**Dependências ausentes com fallback:**
- `vitest`: instalar em Wave 0. Sem ele, unit tests de D-18 não rodam.
- claude CLI: apenas o smoke gated precisa; guard CLI-free e unit puro são completamente offline.

---

## Sources

### Primary (HIGH confidence)

- Código fonte lido diretamente:
  - `ankinator-app/server/src/core/specialists/runner.ts` — interface `RunClaudeCliInput`, `buildSpawnArgs`, `runClaudeCli`
  - `ankinator-app/server/src/core/specialists/prompt-loader.ts` — `loadPrompt`, allowlist, cache
  - `ankinator-app/server/src/core/specialists/prompts/deck-classifier.md` — formato de saída atual (sem `id` na spec de saída)
  - `ankinator-app/server/src/core/specialists/prompts/card-builder.md` — preservar `[EXTRAÍDA]`, split, explicação+fonte
  - `ankinator-app/server/src/core/generation.ts` — `parseQuestoesJson`, `generateAll`, `mapRawQuestoes`
  - `ankinator-app/server/src/core/types.ts` — `Questao` (campos `deck?/tags?` existem desde SPEC-05)
  - `ankinator-app/server/src/store.ts` — `JobEvent` union, `jobStore.emit`
  - `ankinator-app/server/src/api.ts` — wiring `/generate`, SSE, encadeamento
  - `ankinator-app/server/src/core/exporters/csv.ts` — `tagsDaQuestao`, `versoDaQuestao`, `toAnkiCsv`
  - `ankinator-app/server/src/core/exporters/ankiconnect.ts` — `pushToAnki`, `versoHtml`, `tagsDaQuestao`
  - `ankinator-app/web/src/App.tsx` — `setCards`, `dropped`, `handleGenerate`, SSE listeners
  - `ankinator-app/web/src/types.ts` — `Questao` espelho, `GenerateOptions`
  - `ankinator-app/web/src/components/StructurePanel.tsx` — checkboxes existentes, props
  - `ankinator-app/web/src/components/ProgressPanel.tsx` — rendering de progresso por chunk
  - `ankinator-app/web/src/components/CardTable.tsx` — rendering de cards
  - `ankinator-app/web/src/components/Stepper.tsx` — 4 steps fixos
  - `ankinator-app/server/src/scripts/guard-default-loader.ts` — padrão guard CLI-free
  - `ankinator-app/server/src/scripts/smoke-runner.ts` — padrão smoke gated + `--assert-args`
  - `ankinator-app/server/package.json`, `ankinator-app/package.json` — dependências, workspaces
  - `.planning/codebase/TESTING.md` — baseline "sem test runner"
  - `.planning/codebase/CONVENTIONS.md` — estilo PT-BR, naming, ESM

### Secondary (MEDIUM confidence)

- [Anki Manual — Text Files Importing](https://docs.ankiweb.net/importing/text-files.html) — mecanismo `#deck column:N`; criação de deck quando ausente
- [AnkiConnect hexdocs — Deck Actions](https://anki-connect.hexdocs.pm/AnkiConnect.Actions.Deck.html) — `createDeck` com `::` cria hierarquia
- `npm view vitest version` → `4.1.8` — confirmação de versão disponível

### Tertiary (LOW confidence)

- WebSearch + fóruns AnkiWeb — comportamento de `::` em deck column CSV e `addNotes` → marcados [ASSUMED] no Assumptions Log

---

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — nenhum pacote novo; vitest verificado no registry
- Architecture Patterns: HIGH — baseado em código fonte lido
- Research Flags 1 e 4: HIGH — verificados diretamente no código
- Research Flags 2 e 3: MEDIUM — verificados em docs oficiais com um ponto [ASSUMED]
- Pitfalls: HIGH — derivados diretamente do código e das decisões CONTEXT.md

**Research date:** 2026-06-03
**Valid until:** 2026-07-03 (stack estável; AnkiConnect API é conservadora em mudanças)
