# Phase 4: Mnemônicos + Imagem SVG — Pesquisa

**Pesquisado:** 2026-06-03
**Domínio:** Especialistas LLM (batch/por-card), sanitização SVG server-side, embed inline no Anki
**Confiança geral:** MÉDIA-ALTA (stack confirmado; render Anki tem uma variável de risco MÉDIA documentada abaixo)

---

<user_constraints>
## Restrições do Usuário (de 04-CONTEXT.md)

### Decisões Bloqueadas (D-01 … D-14)

- **D-01** — Seletividade = o especialista decide (manda todos; devolve vazio para conceituais). Zero heurística no código.
- **D-02** — Granularidade mnemônico = BATCH único (1 chamada, todos os cards, casa por id). Espelha o classificador da Phase 3.
- **D-03** — Técnica de mnemônico = especialista escolhe sozinho; sem UI de seleção.
- **D-04** — Imagem encadeada: só para cards com `q.mnemonico` preenchido; roda APÓS o mnemônico.
- **D-05** — Granularidade imagem = por-card, SEM cap. Guarda de quota = default-OFF (D-12).
- **D-06** — Sanitização = lib dedicada (DOMPurify, perfil SVG). Robustez > leveza para controle de segurança.
- **D-07** — Allowlist geométrica ESTRITA: somente elementos/atributos conhecidos do `mnemonic-image.md`; fail-closed por omissão.
- **D-08** — Falha na sanitização = descarta o SVG; card mantém mnemônico-texto; erro no `enrich-progress`.
- **D-09** — Embed = `<svg>` sanitizado inline no verso. Zero arquivo de mídia, zero note type novo.
- **D-10** — CSV e AnkiConnect usam o MESMO mecanismo de embed.
- **D-11** — Mnemônico + imagem embutidos no verso via `versoHtml()`/`versoDaQuestao()`; nota `'Basic'` intacta.
- **D-12** — Defaults: mnemônico ON, imagem OFF.
- **D-13** — CardTable: só badges 📝/🖼️ read-only; NÃO renderizar o SVG.
- **D-14** — Verificação: unit puro com fixtures maliciosos + guard CLI-free (PIPE-03) + smoke gated opt-in.

### Liberdade do Claude (Claude's Discretion)

- Nomes exatos de funções/arquivos dos estágios em `enrich.ts`
- Lib de sanitização exata (`isomorphic-dompurify` vs `dompurify`+`jsdom`) — pesquisa abaixo recomenda
- Formato exato do JSON de saída do mnemônico e parser tolerante
- Rótulos de estágio no `enrich-progress`, ícones/badges exatos, ordem de montagem do verso
- Formato do `userMessage` que monta a entrada do batch mnemônico

### Ideias Adiadas (FORA DO ESCOPO)

- Seleção inteligente por-card de quais estágios rodar → Phase 5 (ORCH-01)
- Batching/cap suave da imagem → Phase 5 (ORCH-02)
- Seleção de técnica de mnemônico na UI → rejeitado (D-03)
- Preview do SVG na CardTable → rejeitado (D-13)
- Note type com campos separados / `storeMediaFile` → rejeitado (D-09/D-10/D-11)
- 1 retry na geração do SVG → rejeitado (D-08)
- Provider de imagem raster → v2 (IMGR-01)
</user_constraints>

---

<phase_requirements>
## Requisitos da Fase

| ID | Descrição | Suporte da Pesquisa |
|----|-----------|----------------------|
| MNEM-01 | Especialista de mnemônicos gera mnemônicos para cards de memorização | `mnemonic.md` já tem "Quando NÃO gerar" + "## Técnicas"; batch 1 chamada casado por id espelha D-05/D-06 da Phase 3 |
| MNEM-02 | Suporta técnicas variadas (acrônimo, história, loci) escolhidas pelo conteúdo | Controlado inteiramente pelo `mnemonic.md`; zero código de seleção no app |
| IMG-01 | Especialista de imagem gera SVG autocontido via assinatura Claude | `SvgClaudeImageProvider.generate()` já pronto e UNWIRED; só precisa ser plugado no `enrichAll()` |
| IMG-02 | SVG sanitizado (sem script, sem URLs externas) antes de embutir | `isomorphic-dompurify` 3.15.0 com allowlist geométrica estrita; config concreta documentada abaixo (Research flag 1) |
| IMG-03 | SVG embutido nos cards exportados (CSV e AnkiConnect) com render no Anki | `<svg>` inline funciona no Anki com ressalva de versão documentada (Research flag 2) |
</phase_requirements>

---

## Sumário

Esta fase adiciona dois estágios à `enrichAll()` existente: (1) mnemônico em batch (1 chamada, todos os cards, casado por id) e (2) imagem SVG por-card (gated por `q.mnemonico`, reusa `SvgClaudeImageProvider` UNWIRED). O andaime estrutural já existe — o trabalho real é a **fiação do estágio mnemônico**, a **fiação do estágio imagem**, a **sanitização server-side** e o **embed nos dois exporters**.

O ponto de risco mais relevante descoberto na pesquisa é a **instabilidade do render de SVG inline no Anki**: a versão 25.02.1 introduziu um DOMPurify interno que remove atributos SVG (id, version, fill em `<text>`). O SVG geométrico puro produzido pelo `mnemonic-image.md` (sem atributos problemáticos) deve sobreviver, mas o smoke gated (D-14) é o único gate confiável para confirmar isso — não há garantia de documentação oficial.

**Recomendação primária:** usar `isomorphic-dompurify` 3.15.0 (ESM nativo com condição `node`, sem glue manual de jsdom, Node 24.15.0 satisfaz o requisito `>=24.0.0`), com allowlist geométrica estrita via `ALLOWED_TAGS`+`ALLOWED_ATTR` explícitos (NÃO `USE_PROFILES`, que sobrescreve `ALLOWED_TAGS`).

---

## Mapa de Responsabilidade Arquitetural

| Capacidade | Tier Primário | Tier Secundário | Justificativa |
|------------|--------------|----------------|---------------|
| Geração do mnemônico (texto) | API/Backend (`enrich.ts`) | — | Chamada CLI ao Claude; dados do card nunca saem para o browser |
| Geração do SVG | API/Backend (`enrich.ts` → `image-provider.ts`) | — | Chamada CLI ao Claude; SVG gerado server-side |
| Sanitização do SVG | API/Backend (caminho de export) | — | D-06/D-08: sanitização deve acontecer antes de embutir; no Node |
| Embed no verso (CSV) | API/Backend (`exporters/csv.ts`) | — | Transformação de `Questao[]` em CSV ocorre inteiramente no server |
| Embed no verso (AnkiConnect) | API/Backend (`exporters/ankiconnect.ts`) | — | HTTP ao AnkiConnect ocorre server-side |
| Toggles de UI (mnemônico/imagem) | Frontend (`StructurePanel.tsx`) | — | `GenerateOptions` propagado ao server via POST `/api/generate` |
| Badges indicadores (CardTable) | Frontend (`CardTable.tsx`) | — | Read-only; sem render de SVG no browser (D-13) |
| Gate PIPE-03 (deveRodarEnrich) | API/Backend (`enrich.ts`) | — | Gate puro já existente; estender para incluir `mnemonico`/`imagem` |

---

## Stack Padrão

### Core — Nova Dependência

| Biblioteca | Versão | Propósito | Por que padrão |
|------------|--------|-----------|----------------|
| `isomorphic-dompurify` | 3.15.0 | Sanitização SVG server-side (Node) via jsdom encapsulado | Exporta condição `node` → `./dist/index.mjs` (ESM nativo); encapsula jsdom 29.1.1 sem glue manual; Node 24 satisfaz `>=24.0.0`; mantido ativamente (última atualização: 2026-05-28) |

[VERIFIED: npm registry — `npm view isomorphic-dompurify`]

### Reutilizados (sem nova instalação)

| Biblioteca | Versão | Propósito |
|------------|--------|-----------|
| `vitest` | 4.1.8 | Testes unit/guard da fase — já instalado no `devDependencies` do server |
| `csv-stringify` | 6.5.2 | CSV — já instalado; embed do SVG é apenas concatenação de string no verso |

[VERIFIED: npm registry — confirmado em `ankinator-app/server/package.json`]

### Alternativa Considerada e Descartada

| Em vez de | Poderia Usar | Trade-off |
|-----------|-------------|----------|
| `isomorphic-dompurify` | `dompurify` + `jsdom` explícitos | Mais controle; ~7 MB descompactado de jsdom; glue manual necessário: `new JSDOM('').window`; risco de `clearWindow()` não ser chamado → memory leak em processo longo. `isomorphic-dompurify` encapsula isso e já expõe `clearWindow()` na mesma API. Descartado: código extra sem ganho de segurança real. |
| `isomorphic-dompurify` | Sanitizador custom (regex/allowlist bespoke) | Rejeitado em D-06: allowlist manual adiciona parser próprio, viola "não escrever o próprio sanitizador", risco de bug bespoke no ponto mais crítico. |

**Instalação:**
```bash
npm install isomorphic-dompurify --workspace @ankinator/server
```

---

## Auditoria de Legitimidade dos Pacotes

> Protocolo executado. `slopcheck` não pôde ser instalado (permissão negada pelo classificador de sandbox). Pacotes verificados via `npm view` e repositório oficial.

| Pacote | Registry | Idade | Source Repo | Postinstall | Disposição |
|--------|----------|-------|-------------|-------------|-----------|
| `isomorphic-dompurify` | npm | ~6 anos (criado 2020-03-19) | github.com/kkomelin/isomorphic-dompurify | nenhum | Aprovado |
| `dompurify` (dep indireta) | npm | >10 anos | github.com/cure53/DOMPurify | nenhum | Aprovado |
| `jsdom` (dep indireta) | npm | >14 anos | github.com/jsdom/jsdom | nenhum | Aprovado |

**Pacotes removidos por SLOP:** nenhum
**Pacotes suspeitos:** nenhum

*Nota: `slopcheck` indisponível na sessão atual — planner deve adicionar `checkpoint:human-verify` antes do `npm install` caso queira validação formal. Os pacotes acima são amplamente conhecidos e verificados via repositório oficial.*

---

## Padrões de Arquitetura

### Diagrama do Fluxo — Phase 4

```
POST /api/generate
       │
       ▼
  generateAll()          ← sem mudança
       │
       ▼
  enrichAll(opts)        ← ESTENDE com estágios 3 e 4
       │
       ├── [opts.classificar] Estágio 1: classificador (1 chamada batch) ← existente
       │
       ├── [opts.cardBuilder] Estágio 2: card-builder (por-card)         ← existente
       │
       ├── [opts.mnemonico]   Estágio 3: mnemônico (1 chamada batch)     ← NOVO
       │       │  runClaudeCli(mnemonic.md, todos os cards)
       │       │  parseMnemonicosJson() → Map<id, {mnemonico, tecnica?}>
       │       │  merge por id → q.mnemonico (fail-soft: id ausente = sem mnemônico)
       │       └── enrich-progress: estagio='gerando-mnemonico'
       │
       └── [opts.imagem && q.mnemonico] Estágio 4: imagem (por-card)    ← NOVO
               │  para cada card com q.mnemonico:
               │    imageProvider.generate(q.mnemonico, q.resposta)
               │    sanitizarSvg(svg) → {ok: string} | {erro: string}
               │    ok → q.mnemonicoSvg = svgSanitizado
               │    erro → q.mnemonicoSvg = undefined; enrich-progress com erro
               └── enrich-progress: estagio='gerando-imagem'

POST /api/export/csv
       │
       ▼
  toAnkiCsv()
       │
       └── versoDaQuestao(q) → appende mnemônico-texto + SVG inline (gate: se ausente, byte-idêntico)

POST /api/export/ankiconnect
       │
       ▼
  pushToAnki()
       │
       └── versoHtml(q) → appende mnemônico-texto + SVG inline (gate: se ausente, byte-idêntico)
```

### Estrutura de Arquivos Afetados

```
ankinator-app/server/src/
├── core/specialists/
│   ├── enrich.ts                    ← ESTENDER: +2 estágios, +2 opts, +EnrichProgress estágios
│   ├── enrich.test.ts               ← ESTENDER: +fixtures maliciosos SVG, +casos batch mnemônico
│   ├── sanitize-svg.ts              ← NOVO: wrapper de sanitização (isomorphic-dompurify)
│   ├── prompts/
│   │   ├── mnemonic.md              ← REFINAR: ajustar saída p/ formato JSON batch (D-02)
│   │   └── mnemonic-image.md        ← REFINAR se necessário (já tem restrições de segurança)
│   └── image-provider.ts            ← CONECTAR: remover TODO(IMG-02); chamar sanitizarSvg()
├── core/exporters/
│   ├── csv.ts                       ← ESTENDER: versoDaQuestao() appende mnemonico+SVG
│   └── ankiconnect.ts               ← ESTENDER: versoHtml() appende mnemonico+SVG
├── store.ts                         ← ESTENDER: EnrichProgress.estagio += novos valores
└── scripts/
    ├── guard-enrich.ts              ← ESTENDER: cenários imagem off → deveRodarEnrich=false
    └── smoke-enrich.ts              ← ESTENDER: passo de smoke SVG gated

ankinator-app/web/src/
├── types.ts                         ← ESTENDER: GenerateOptions += mnemonico?, imagem?; EnrichProgress.estagio
├── components/
│   ├── StructurePanel.tsx           ← ESTENDER: +2 toggles no bloco "Modo educativo"
│   ├── CardTable.tsx                ← ESTENDER: +badges 📝/🖼️ por card
│   └── ProgressPanel.tsx           ← VERIFICAR: se já renderiza estágios arbitrários (provavelmente sim)
└── App.tsx                          ← VERIFICAR: se listener enrich-progress já é genérico
```

### Padrão 1: Batch Mnemônico Casa-por-id (Research flag 4 — D-02)

**O que:** 1 chamada CLI com todos os cards; parser tolera omissão e reordenação; merge por `Map`.

**Formato JSON de saída recomendado do especialista:**
```json
{
  "mnemonicos": [
    { "id": "uuid-do-card", "mnemonico": "CAMP = Cadastro, Avaliação, Mapeamento, Programa", "tecnica": "acrônimo" },
    { "id": "outro-uuid",   "mnemonico": "A ordem é: cobra → lince → falcão (história encadeada)", "tecnica": "história" }
  ]
}
```
`tecnica` é opcional (o especialista pode omitir). Cards conceituais: o especialista devolve a entrada sem o objeto, ou com `mnemonico: ""` — em ambos os casos o parser descarta.

**Parser tolerante (clone de `parseJsonBlock`):**
```typescript
// Fonte: padrão de parseClassificacoesJson (enrich.ts)
interface RawMnemonico {
  id?: string;
  mnemonico?: string;
  tecnica?: string;
}

export function parseMnemonicosJson(text: string): RawMnemonico[] {
  return parseJsonBlock<RawMnemonico>(text, 'mnemonicos');
}

// No estágio do enrichAll:
const byId = new Map(parsed
  .filter(m => m.id && m.mnemonico)  // descarta sem id ou vazio
  .map(m => [m.id!, m])
);
resultado = resultado.map(q => {
  const m = byId.get(q.id);
  return m ? { ...q, mnemonico: m.mnemonico } : q;  // ausente → card sem mnemônico (fail-soft)
});
```

[VERIFIED: codebase — espelha `parseClassificacoesJson` + merge `byId` de `enrich.ts`]

### Padrão 2: Sanitização SVG Server-side com isomorphic-dompurify (Research flag 1 — D-06/D-07)

**Configuração concreta (allowlist geométrica estrita de D-07):**

```typescript
// Fonte: DOMPurify docs (github.com/cure53/DOMPurify) + src/tags.ts + src/attrs.ts
// IMPORTANTE: NÃO usar USE_PROFILES — ele SOBRESCREVE ALLOWED_TAGS (confirmado na doc oficial)
import DOMPurify from 'isomorphic-dompurify';

// Tags geométricas que o mnemonic-image.md produz (D-07)
const SVG_TAGS = [
  'svg', 'g', 'defs',
  'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon',
  'text', 'tspan',
  'linearGradient', 'radialGradient', 'stop',
];

// Atributos seguros: geométricos + apresentação + acessibilidade mínima
const SVG_ATTRS = [
  // posição/geometria
  'viewBox', 'xmlns', 'width', 'height', 'x', 'y', 'x1', 'y1', 'x2', 'y2',
  'cx', 'cy', 'r', 'rx', 'ry',
  'd', 'points',
  'transform',
  // apresentação (subset seguro)
  'fill', 'fill-opacity', 'fill-rule',
  'stroke', 'stroke-width', 'stroke-dasharray', 'stroke-linecap', 'stroke-linejoin', 'stroke-opacity',
  'opacity',
  'color',
  // texto
  'font-family', 'font-size', 'font-weight', 'text-anchor',
  'dominant-baseline',
  // gradiente
  'gradientUnits', 'gradientTransform', 'offset', 'stop-color', 'stop-opacity',
  'x1', 'y1', 'x2', 'y2', 'fx', 'fy',
  // id para referência interna (sem xlink:href externo)
  'id',
  // misc
  'preserveAspectRatio', 'clip-path', 'mask',
];

export function sanitizarSvg(svgRaw: string): string | null {
  try {
    const limpo = DOMPurify.sanitize(svgRaw, {
      ALLOWED_TAGS: SVG_TAGS,
      ALLOWED_ATTR: SVG_ATTRS,
      // FORCE_BODY: false por default — mantém o <svg> como raiz
    });
    // fail-closed: se o resultado não começa com <svg, DOMPurify removeu tudo
    const trimmed = limpo.trim();
    if (!trimmed.startsWith('<svg')) return null;
    return trimmed;
  } catch {
    return null;  // D-08: qualquer erro → descarta
  }
}
```

**Compatibilidade ESM/Node (verificada):**
- `isomorphic-dompurify` 3.15.0 tem condição `node` → `import` → `./dist/index.mjs` (ESM nativo)
- Node 24.15.0 satisfaz o requisito `^20.19.0 || ^22.13.0 || >=24.0.0`
- `"type": "module"` + `moduleResolution: NodeNext` no server: importação direta funciona
- **Sem glue manual de jsdom**: a lib encapsula e gerencia a janela jsdom internamente
- Peso: `isomorphic-dompurify` ~25KB descompactado + jsdom 29 ~7MB — aceitável para app local server-side

[VERIFIED: npm registry — `npm view isomorphic-dompurify exports/engines` + `npm view jsdom dist.unpackedSize`]
[CITED: github.com/cure53/DOMPurify/blob/main/README.md — USE_PROFILES sobrescreve ALLOWED_TAGS]
[CITED: github.com/kkomelin/isomorphic-dompurify/releases/tag/3.0.0 — ESM support, Node requirement]

### Padrão 3: Verso com Mnemônico + SVG (Research flag 3 — D-11)

**Ordem de montagem legível:**
```
resposta (original) + explicação (metadata) + mnemônico-texto + SVG inline
```

**`versoDaQuestao` (csv.ts) — extensão com gate byte-identidade (PIPE-03):**
```typescript
function versoDaQuestao(q: Questao): string {
  let verso = q.resposta;
  // ... metadata existente (gabarito, alternativas, banca, ano) ...

  // EXTENSÃO PHASE 4: mnemônico-texto (gate: byte-idêntico se ausente)
  if (q.mnemonico) {
    verso += `\n\n💡 Mnemônico: ${q.mnemonico}`;
  }
  // SVG inline (gate: byte-idêntico se ausente)
  if (q.mnemonicoSvg) {
    verso += `\n\n${q.mnemonicoSvg}`;
  }
  return verso;
}
```

**`versoHtml` (ankiconnect.ts) — extensão com gate byte-identidade:**
```typescript
function versoHtml(q: Questao, fonte?: string): string {
  // ... código existente (escapeHtml, alternativas, gabarito, fonte/página) ...

  // EXTENSÃO PHASE 4: mnemônico-texto
  if (q.mnemonico) {
    back += `<br><br><b>💡 Mnemônico:</b> ${escapeHtml(q.mnemonico)}`;
  }
  // SVG inline — NÃO escapar; já sanitizado por sanitizarSvg()
  if (q.mnemonicoSvg) {
    back += `<br><br>${q.mnemonicoSvg}`;
  }
  return back;
}
```

**Cuidado com CSV:** a lib `csv-stringify` com `quoted: true` encapsula o campo verso em aspas duplas e escapa aspas internas com `""`. O `<svg>` contendo aspas em atributos (ex.: `fill="red"`) será corretamente escapado — não requer tratamento adicional além do que já existe.

[VERIFIED: codebase — padrão `versoDaQuestao`/`versoHtml` confirmado em `csv.ts`/`ankiconnect.ts`]

### Anti-padrões a Evitar

- **USE_PROFILES + ALLOWED_TAGS juntos:** `USE_PROFILES` SOBRESCREVE `ALLOWED_TAGS` — resultado é a allowlist ampla do perfil SVG, não a estrita de D-07. [CITED: DOMPurify README]
- **Embutir SVG sem verificar prefixo `<svg`:** DOMPurify pode retornar string vazia para entrada inválida; sempre checar que o resultado começa com `<svg` antes de gravar em `q.mnemonicoSvg`.
- **Usar `escapeHtml()` no SVG inline:** o SVG já está sanitizado — aplicar `escapeHtml()` converteria `<` em `&lt;` e quebraria a marcação.
- **Merge posicional no batch mnemônico:** como no classificador (Phase 3 D-06), NUNCA assumir que o índice da resposta corresponde ao índice do card. Sempre casar por `id` via `Map`.
- **Omitir o gate PIPE-03:** as novas opts (`mnemonico`, `imagem`) devem ser incluídas no `deveRodarEnrich` — qualquer toggle ligado → roda; todos desligados → byte-idêntico.

---

## Não Reimplementar (Don't Hand-Roll)

| Problema | Não Construir | Usar | Por quê |
|----------|-------------|------|---------|
| Sanitização SVG | Parser regex próprio / denylist de tags perigosas | `isomorphic-dompurify` com `ALLOWED_TAGS`/`ALLOWED_ATTR` | SVG tem >20 vetores de XSS conhecidos; allowlist positiva é a única defesa correta; denylist é burlável [CITED: DOMPurify README] |
| Parser JSON tolerante do mnemônico | Parser novo | `parseJsonBlock<T>` já existente em `enrich.ts` | Idêntico ao usado para classificações; reutilizar evita divergência |
| Merge por id | Loop posicional | `new Map(itens.map(i => [i.id, i]))` | Padrão já estabelecido e testado para o classificador (Phase 3 D-06) |
| Serialização do payload do mnemônico | Interpolação de template string com `q.resposta` cru | `JSON.stringify(cards, null, 2)` | T-03-02: nunca interpolar conteúdo do card cru — risco de injeção de prompt |

---

## Cobertura Adversarial da Allowlist — Fixtures Obrigatórios (Research flag 5 — D-07/D-14)

Os vetores abaixo são os vetores de ataque SVG documentados que os fixtures de teste DEVEM cobrir de forma determinística (sem CLI, sem quota):

| # | Vetor | Payload de Fixture | Comportamento Esperado com Allowlist Estrita |
|---|-------|-------------------|----------------------------------------------|
| F-01 | Tag `<script>` direta | `<svg><script>alert(1)</script></svg>` | `<script>` removida; SVG mantém raiz `<svg>` vazia |
| F-02 | Atributo `onload` na raiz | `<svg onload="alert(1)"><rect/></svg>` | `onload` removido; `<rect>` mantida se em ALLOWED_TAGS |
| F-03 | Atributo `onclick` em elemento geométrico | `<rect onclick="evil()"/>` | Atributo `onclick` removido; `<rect>` mantida |
| F-04 | `href` com `javascript:` em `<a>` | `<svg><a href="javascript:alert(1)"><text>x</text></a></svg>` | `<a>` não está em ALLOWED_TAGS → removida inteira (incluindo href) |
| F-05 | `<use>` com `xlink:href` externo | `<svg><use xlink:href="http://evil.com/payload.svg#x"/></svg>` | `<use>` não está em ALLOWED_TAGS → removida |
| F-06 | `<foreignObject>` com HTML embutido | `<svg><foreignObject><script>alert(1)</script></foreignObject></svg>` | `<foreignObject>` não está em ALLOWED_TAGS → removida |
| F-07 | `<image>` com href externo | `<svg><image href="http://evil.com/pixel.png"/></svg>` | `<image>` não está em ALLOWED_TAGS → removida |
| F-08 | `<animate>` / `<set>` | `<svg><rect/><animate attributeName="href" values="javascript:"/></svg>` | `<animate>` não está em ALLOWED_TAGS → removida |
| F-09 | CSS `url()` em atributo style | `<svg><rect style="fill:url(http://evil.com/x)"/></svg>` | `style` não está em ALLOWED_ATTR → atributo removido |
| F-10 | SVG bem-formado e geométrico | `<svg viewBox="0 0 100 100"><rect x="10" y="10" width="80" height="80" fill="blue"/></svg>` | Saída byte-idêntica (sem remoção) |
| F-11 | SVG vazio / entrada não-SVG | `""` / `<div>hello</div>` | `sanitizarSvg()` retorna `null` |
| F-12 | Cercas de código ` ```svg ` | ` ```svg\n<svg>...</svg>\n``` ` | O parser do especialista deve remover cercas ANTES de sanitizar |

**Como provar de forma determinística:**
```typescript
// enrich.test.ts — sem vi.mock do runner; DOMPurify roda puro em Node
import { sanitizarSvg } from '../specialists/sanitize-svg.js';
import { describe, it, expect } from 'vitest';

describe('sanitizarSvg — cobertura adversarial (D-07/D-14)', () => {
  it('F-01: remove <script>', () => {
    const out = sanitizarSvg('<svg><script>alert(1)</script></svg>');
    expect(out).not.toContain('<script>');
    expect(out).not.toContain('alert');
  });
  it('F-02: remove onload', () => {
    const out = sanitizarSvg('<svg onload="alert(1)"><rect/></svg>');
    expect(out).not.toContain('onload');
  });
  // ... um it por vetor
  it('F-10: SVG geométrico sai intacto', () => {
    const svg = '<svg viewBox="0 0 100 100"><rect x="10" y="10" width="80" height="80" fill="blue"/></svg>';
    const out = sanitizarSvg(svg);
    expect(out).not.toBeNull();
    expect(out).toContain('<rect');
  });
  it('F-11: retorna null para entrada não-SVG', () => {
    expect(sanitizarSvg('')).toBeNull();
    expect(sanitizarSvg('<div>hello</div>')).toBeNull();
  });
});
```

[CITED: github.com/cure53/DOMPurify/blob/main/src/tags.ts + src/attrs.ts — listas default]
[ASSUMED: comportamento exato de remoção por elemento; confirmação determinística requer rodar os testes]

---

## Render de `<svg>` Inline no Anki (Research flag 2 — D-09)

### Suporte Confirmado (com Ressalva)

**Anki Desktop (QtWebEngine):**
- SVG inline funciona desde versões antigas (confirmado em threads do fórum de 2021 em diante)
- **Risco documentado:** Anki 25.02.1 introduziu DOMPurify internamente e passou a remover alguns atributos SVG (`id`, `version`, `fill` em `<text>`) e `<iframe>`. O SVG geométrico puro produzido pelo `mnemonic-image.md` (sem esses atributos problemáticos nas versões anteriores, sem `id` no `<text>`) provavelmente sobrevive — mas **não há documentação oficial confirmando quais tags/atributos passam no filtro interno do Anki 25.02.x**.
- [CITED: github.com/ankitects/anki/issues/3931 — issue reportando stripping de atributos SVG no Anki 25.02.1]
- [CITED: forums.ankiweb.net/t/anki-25-02-1-removes-embedded-iframe-tags-and-svg-attributes — confirmação do stripping]

**AnkiDroid:**
- WebView do Android suporta SVG nativamente; alguns SVGs com características específicas falham de forma inconsistente (issue #14696 aberto, corrigido no milestone 2.17)
- SVG geométrico simples (sem filtros, sem `<foreignObject>`, sem recursos externos) geralmente funciona

**AnkiMobile (iOS):**
- Usa WKWebView (WebKit); suporte a SVG inline é esperado mas não foi encontrada documentação específica confirmando o comportamento com inline no campo

### Confiança no Render

**Confiança MÉDIA** — o smoke gated (D-14) é o único gate confiável. O planner deve incluir smoke que verifique o render real no Anki desktop (task humana, opt-in, não-automatizada).

### Fallbacks (gatilho de revisão de D-09 — NÃO implementar agora)

Se o smoke mostrar falha de render no Anki:

1. **Q-09b (data-URI base64):** `<img src="data:image/svg+xml;base64,${btoa(svg)}"/>` — evita stripping pelo parser do Anki, mas aumenta tamanho do campo ~33%
2. **Q-09c (arquivo de mídia):** `storeMediaFile` + `<img src="card-id.svg"/>` — render garantido, mas exige nova infra no AnkiConnect (novo campo `media` na chamada `addNotes`)

**Esses fallbacks são gatilho de revisão de D-09 após o smoke. Não implementar nesta fase.**

---

## Armadilhas Comuns (Common Pitfalls)

### Pitfall 1: `USE_PROFILES` sobrescreve `ALLOWED_TAGS`

**O que acontece:** Usar `{ USE_PROFILES: {svg: true}, ALLOWED_TAGS: [...] }` resulta na allowlist ampla do perfil SVG, ignorando o `ALLOWED_TAGS` customizado — a allowlist estrita de D-07 é silenciosamente ignorada.
**Por que acontece:** Comportamento documentado do DOMPurify — `USE_PROFILES` é exclusivo com `ALLOWED_TAGS`.
**Como evitar:** Usar APENAS `ALLOWED_TAGS` + `ALLOWED_ATTR` explícitos. Nunca combinar com `USE_PROFILES`.
**Sinal de alerta:** Tags como `<use>`, `<animate>`, `<foreignObject>` aparecem no SVG sanitizado.

[CITED: github.com/cure53/DOMPurify README.md]

### Pitfall 2: Aplicar `escapeHtml()` ao SVG sanitizado

**O que acontece:** Chamar `escapeHtml(q.mnemonicoSvg)` antes de embutir converte `<svg>` em `&lt;svg&gt;` — o Anki exibe o markup como texto puro.
**Por que acontece:** Confusão com o padrão existente de `escapeHtml(q.resposta)` no `versoHtml`.
**Como evitar:** O SVG foi sanitizado; embutir diretamente. Nunca escapar o `mnemonicoSvg`.

### Pitfall 3: Merge posicional no batch mnemônico

**O que acontece:** Assumir que o `mnemonicos[i]` corresponde ao `questoes[i]` — quando o especialista omite alguns cards (conceituais), os índices ficam desalinhados e os mnemônicos são atribuídos ao card errado.
**Por que acontece:** Tentação de simplicidade; o batch não garante ordem.
**Como evitar:** Sempre casar por `id` via `Map`. Padrão estabelecido na Phase 3 (D-06).

### Pitfall 4: `sanitizarSvg()` retorna string vazia em vez de `null`

**O que acontece:** DOMPurify retorna `""` para entrada completamente rejeitada (sem tag permitida). Se o código verifica `if (svg)` em vez de `if (svg?.startsWith('<svg'))`, uma string vazia passa pelo gate e é gravada em `q.mnemonicoSvg`.
**Por que acontece:** Verificação superficial do retorno.
**Como evitar:** `sanitizarSvg()` deve retornar `null` para qualquer saída que não comece com `<svg`. O estágio deve gravar `q.mnemonicoSvg` SOMENTE para retorno não-nulo.

### Pitfall 5: `mnemonic.md` sem instrução de formato JSON batch

**O que acontece:** O especialista devolve texto livre em vez do JSON `{mnemonicos:[...]}` — o parser retorna `[]` para todos os cards.
**Por que acontece:** O `mnemonic.md` atual (lido na pesquisa) descreve a saída como texto (`mnemonico` + mapeamento) — **não como JSON batch**.
**Como evitar:** O planner deve incluir task de refinamento do `mnemonic.md` para instruir o formato JSON batch na seção `## Saída`. O prompt deve especificar: `Devolva APENAS JSON no formato {"mnemonicos":[{"id":"...","mnemonico":"...","tecnica":"..."}]}`.

[VERIFIED: codebase — leitura de `prompts/mnemonic.md` confirma que a seção `## Saída` atual NÃO descreve JSON]

### Pitfall 6: `deveRodarEnrich` não atualizado para os novos toggles

**O que acontece:** Com `opts.mnemonico=true`, `deveRodarEnrich()` retorna `false` porque só verifica `classificar` e `cardBuilder` — o enrich não roda mesmo com mnemônico ligado.
**Por que acontece:** Não estender a função para incluir as novas opts.
**Como evitar:** `deveRodarEnrich` deve incluir: `return !!(opts.classificar || opts.cardBuilder || opts.mnemonico || opts.imagem)`.

### Pitfall 7: isomorphic-dompurify importado sem `.js` em NodeNext ESM

**O que acontece:** Em `"moduleResolution": "NodeNext"`, imports de pacotes npm NÃO precisam de extensão (o `exports` map resolve). Mas imports locais (ex.: `./sanitize-svg`) PRECISAM de `.js`. Confundir os dois leva a `ERR_MODULE_NOT_FOUND`.
**Por que acontece:** Regra do NodeNext: extensão obrigatória para módulos locais; módulos npm resolvidos via `exports` map.
**Como evitar:** `import DOMPurify from 'isomorphic-dompurify'` (sem extensão — correto). `import { sanitizarSvg } from './sanitize-svg.js'` (com `.js` — correto para ESM local).

---

## Exemplos de Código

### Exemplo 1: Estágio Mnemônico no `enrichAll`

```typescript
// Fonte: padrão de enrichAll (enrich.ts Phase 3) — estender com ESTÁGIO 3
// ESTÁGIO 3: Mnemônico (D-01/D-02/D-03)
if (opts.mnemonico) {
  onProgress?.({ estagio: 'gerando-mnemonico', index: 0, total: 1 });
  try {
    const cards = resultado.map(q => ({
      id: q.id,
      pergunta: q.pergunta,
      resposta: q.resposta,
      tipo: q.tipo,
    }));
    const userMessage = [
      'Gere mnemônicos para os cards a seguir. Devolva APENAS JSON no formato:',
      '{"mnemonicos":[{"id":"<id>","mnemonico":"<texto>","tecnica":"<técnica>"}]}',
      'Para cards conceituais/raciocínio, NÃO inclua na lista de retorno.',
      '',
      'Cards:',
      JSON.stringify(cards, null, 2),
    ].join('\n');
    const text = await runClaudeCli({
      systemPrompt: loadPrompt('mnemonic'),
      userMessage,
    });
    const mnemonicos = parseMnemonicosJson(text);
    const byId = new Map(
      mnemonicos
        .filter(m => m.id && m.mnemonico)
        .map(m => [m.id!, m])
    );
    resultado = resultado.map(q => {
      const m = byId.get(q.id);
      return m ? { ...q, mnemonico: m.mnemonico } : q;  // fail-soft: sem mnemônico para conceituais
    });
  } catch (err) {
    const erro = err instanceof Error ? err.message : String(err);
    onProgress?.({ estagio: 'gerando-mnemonico', index: 0, total: 1, erro });
    // Segue sem mnemônicos — nunca derruba o job (D-08)
  }
}
```

### Exemplo 2: Estágio Imagem no `enrichAll`

```typescript
// ESTÁGIO 4: Imagem SVG (D-04/D-05/D-08)
if (opts.imagem) {
  const comMnemonico = resultado.filter(q => q.mnemonico);
  const total = comMnemonico.length;
  const imageProvider = createImageProvider();

  for (let i = 0; i < resultado.length; i++) {
    const q = resultado[i];
    if (!q.mnemonico) continue;  // D-04: só cards com mnemônico

    onProgress?.({ estagio: 'gerando-imagem', index: i, total });
    try {
      const { svg } = await imageProvider.generate(q.mnemonico, q.resposta);
      const svgSanitizado = sanitizarSvg(svg);  // D-06/D-07
      if (svgSanitizado) {
        resultado[i] = { ...q, mnemonicoSvg: svgSanitizado };
      } else {
        // D-08: fail-closed — descarta o SVG, mantém o mnemônico-texto
        onProgress?.({ estagio: 'gerando-imagem', index: i, total, erro: 'SVG inválido após sanitização' });
      }
    } catch (err) {
      const erro = err instanceof Error ? err.message : String(err);
      onProgress?.({ estagio: 'gerando-imagem', index: i, total, erro });
      // D-08: mantém o card sem mnemonicoSvg — nunca perde o card
    }
  }
}
```

### Exemplo 3: Guard PIPE-03 Estendido

```typescript
// guard-enrich.ts — estender para incluir novos toggles
// Cenário: imagem=true mas mnemonico=false → deveRodarEnrich deve retornar true (imagem ligada)
const optsImagemOn = { classificar: false, cardBuilder: false, mnemonico: false, imagem: true };
if (!deveRodarEnrich(optsImagemOn)) {
  fail('deveRodarEnrich retornou false com imagem=true — violação de PIPE-03');
}
// Cenário: tudo off → byte-idêntico garantido
const todoOff = { classificar: false, cardBuilder: false, mnemonico: false, imagem: false };
if (deveRodarEnrich(todoOff) !== false) {
  fail('deveRodarEnrich retornou true com todos toggles off — violação de PIPE-03');
}
```

---

## Estado da Arte

| Abordagem Antiga | Abordagem Atual | Quando Mudou | Impacto |
|------------------|-----------------|--------------|---------|
| `USE_PROFILES: {svg: true}` (permissivo) | `ALLOWED_TAGS` geométrico estrito + `ALLOWED_ATTR` | DOMPurify 3.x (doc confirmada) | allowlist positiva garante fail-closed sem depender de denylist |
| `dompurify` + glue `new JSDOM('').window` manual | `isomorphic-dompurify` (encapsula jsdom, expõe `clearWindow()`) | v3.0.0 (2024) | Sem memory leak em processo longo; API limpa sem glue |
| SVG inline funcionava transparentemente no Anki (pré-25.02) | Anki 25.02.1 introduziu DOMPurify interno que remove alguns attrs | Anki 25.02.1 (2025) | Risco de stripping de atributos no Anki; smoke gated é o gate real |

**Obsoleto/Depreciado:**
- `jsdom` versões <20.0.0: vulneráveis a XSS conhecidos (citado na doc do DOMPurify — NÃO usar)
- `USE_PROFILES` combinado com `ALLOWED_TAGS`: silenciosamente ignora o `ALLOWED_TAGS`

---

## Log de Suposições

| # | Afirmação | Seção | Risco se Errado |
|---|-----------|-------|-----------------|
| A1 | SVG geométrico puro (sem `id`/`version` em `<text>`) sobrevive ao DOMPurify interno do Anki 25.02.x | Research flag 2 | SVG exibido como texto ou não exibido → acionar fallback D-09b/D-09c |
| A2 | O formato JSON `{mnemonicos:[{id,mnemonico,tecnica?}]}` será seguido pelo especialista após refinamento do `mnemonic.md` | Padrão 1 | Parser retorna `[]` → nenhum card recebe mnemônico → value proposition perdido |
| A3 | AnkiMobile (iOS) suporta SVG inline em campos de nota | Research flag 2 | Usuários iOS sem SVG → acionar fallback D-09b |
| A4 | `mnemonic-image.md` não precisa de refinamento além do que já tem (restrições de segurança OK) | Padrão 2 | Especialista produz SVG com elementos fora da allowlist → taxa de falha na sanitização alta |

**Se esta tabela está vazia:** não está — A1 e A3 são os mais relevantes para o planner.

---

## Perguntas Abertas

1. **Render SVG no Anki 25.02.x+**
   - O que sabemos: Anki 25.02.1 remove `id`, `version`, `fill` em `<text>` (entre outros). O `mnemonic-image.md` atual instrui a não usar scripts/URLs externas.
   - O que não está claro: quais atributos SVG exatamente o DOMPurify interno do Anki 25.02.x mantém.
   - Recomendação: o smoke gated (D-14) deve ser executado pelo usuário com o Anki atualizado ANTES do sign-off da fase.

2. **Necessidade de refinamento do `mnemonic-image.md`**
   - O que sabemos: o prompt atual não instrui o especialista a NÃO usar `id` em `<text>` — que o Anki 25.02 remove. Também não especifica o formato de saída (apenas `<svg>...</svg>` sem cercas).
   - Recomendação: refinar o prompt para: (a) não usar `id`, `version` no `<svg>` raiz, (b) confirmar que a saída é `<svg>...</svg>` sem texto antes/depois.

---

## Disponibilidade de Ambiente

| Dependência | Requerida por | Disponível | Versão | Fallback |
|-------------|--------------|-----------|--------|---------|
| Node.js | Runtime do server | ✓ | v24.15.0 | — |
| `vitest` | Testes unit/guard | ✓ | 4.1.8 (já instalado) | — |
| `isomorphic-dompurify` | IMG-02 (sanitização SVG) | A instalar | 3.15.0 | `dompurify` + `jsdom` explícito (mais verboso) |
| Anki desktop | Smoke gated (D-14) | Não verificado | — | Teste manual pelo usuário |
| AnkiConnect | Smoke gated (AnkiConnect) | Não verificado | — | Teste manual pelo usuário |

**Dependências ausentes sem fallback:** nenhuma bloqueante para desenvolvimento e testes unit/guard. O smoke gated requer Anki+AnkiConnect e é opt-in por design (D-14).

---

## Validation Architecture

> Baseia-se em D-14 e no padrão estabelecido nas Phases 1-3 (guard CLI-free + unit puro + smoke gated).

### Framework de Testes

| Propriedade | Valor |
|------------|-------|
| Framework | vitest 4.1.8 (já instalado no `devDependencies` do `@ankinator/server`) |
| Arquivo de config | não necessário — vitest detecta `*.test.ts` por padrão |
| Comando rápido (unit) | `npm test --workspace @ankinator/server` |
| Comando completo | `npm test --workspace @ankinator/server -- --reporter=verbose` |

### Estratégia de Validação em 3 Camadas (D-14)

#### Camada 1 — Unit Puro Determinístico (sem CLI, sem quota)

**Objetivo:** Provar que a allowlist geométrica remove TODOS os vetores de ataque SVG (Research flag 5).

**Arquivo:** `ankinator-app/server/src/core/specialists/enrich.test.ts` (estender) OU `sanitize-svg.test.ts` (novo arquivo dedicado)

**Cobertura obrigatória:**
- F-01 a F-12: todos os fixtures adversariais documentados na seção "Cobertura Adversarial"
- Batch mnemônico por id: id presente → mnemônico gravado; id ausente → card sem mnemônico (fail-soft)
- Parser batch: JSON com cercas ```json → parsed; campo `mnemonico` vazio → descartado; JSON inválido → `[]`
- Gate PIPE-03: `deveRodarEnrich({mnemonico:true, imagem:false})` → `true`; `deveRodarEnrich({mnemonico:false, imagem:false})` → `false`
- Fail-closed D-08: `sanitizarSvg('<script>alert(1)</script>')` → `null`; estágio imagem → card sem `mnemonicoSvg`

**Todos os testes desta camada devem ser executados SEM chamar o Claude CLI** (via `vi.mock('./runner.js')` para os testes de `enrichAll`, e diretamente sem mock para os testes de `sanitizarSvg` — DOMPurify roda em Node puro).

#### Camada 2 — Guard CLI-Free (PIPE-03 byte-identidade)

**Objetivo:** Provar que, com todos os toggles off, o `/generate` é byte-idêntico ao comportamento pré-Phase 4.

**Arquivo:** `ankinator-app/server/src/scripts/guard-enrich.ts` (estender)

**Cenários obrigatórios:**
```bash
# Deve retornar exit 0
tsx src/scripts/guard-enrich.ts --assert
```

- Cenário A: `{classificar:false, cardBuilder:false, mnemonico:false, imagem:false}` → `deveRodarEnrich()=false` → enrichAll NÃO chamado
- Cenário B: `{mnemonico:true}` → `deveRodarEnrich()=true` → enrichAll SERIA chamado
- Cenário C: `{imagem:true, mnemonico:false}` → `deveRodarEnrich()=true` → enrichAll SERIA chamado (imagem ligada mesmo sem mnemônico — o estágio imagem verifica `q.mnemonico` internamente)

**Comando de execução (CI-friendly, sem quota):**
```bash
tsx src/scripts/guard-enrich.ts --assert
```

#### Camada 3 — Smoke Gated Opt-in (com CLI real, com quota)

**Objetivo:** Confirmar render SVG real no Anki desktop (Research flag 2 — A1).

**Arquivo:** `ankinator-app/server/src/scripts/smoke-enrich.ts` (estender)

**Passos:**
1. (CLI-free) `loadPrompt('mnemonic')` + `loadPrompt('mnemonic-image')` — valida Pitfall 1 cross-mode
2. (CLI-free) `parseMnemonicosJson` com fixture — valida parser tolerante
3. (CLI-free) `sanitizarSvg` com SVG geométrico limpo → passa; com `<script>` → retorna null
4. (GATED) `enrichAll` real com 1 card de fixture + mnemônico + imagem — exercita o claude CLI e produz SVG
5. (GATED — MANUAL) Exportar via AnkiConnect e confirmar render no Anki desktop

**Passos 1-3 são CLI-free (podem rodar em CI). Passos 4-5 são opt-in (requerem `claude` com assinatura + Anki aberto).**

```bash
# CLI-free (passos 1-3):
tsx src/scripts/smoke-enrich.ts --assert-args

# Completo (passos 1-4, sem Passo 5):
tsx src/scripts/smoke-enrich.ts

# Passo 5 é tarefa humana — sign-off manual
```

### Mapa Requisitos → Testes

| Req ID | Comportamento | Tipo de Teste | Comando | Arquivo Existe? |
|--------|--------------|---------------|---------|----------------|
| MNEM-01 | Mnemônico gerado para card de memorização (mock LLM) | unit | `npm test` | ❌ Wave 0 — extender `enrich.test.ts` |
| MNEM-01 | Id ausente no JSON → card sem mnemônico (fail-soft) | unit | `npm test` | ❌ Wave 0 |
| MNEM-02 | Parser batch aceita `tecnica` opcional | unit | `npm test` | ❌ Wave 0 |
| IMG-01 | `enrichAll` chama `imageProvider.generate()` apenas para cards com `q.mnemonico` | unit (mock provider) | `npm test` | ❌ Wave 0 |
| IMG-02 | F-01 a F-12: vetores adversariais removidos pela allowlist | unit (DOMPurify puro) | `npm test` | ❌ Wave 0 |
| IMG-02 | SVG geométrico limpo → saída não-nula | unit | `npm test` | ❌ Wave 0 |
| IMG-03 | CSV com SVG inline → campo verso contém `<svg` | unit | `npm test` | ❌ Wave 0 |
| IMG-03 | AnkiConnect campo Back contém `<svg` | unit | `npm test` | ❌ Wave 0 |
| PIPE-03 | Toggles off → byte-idêntico (guard) | guard CLI-free | `tsx guard-enrich.ts --assert` | ❌ Wave 0 — extender `guard-enrich.ts` |
| IMG-03 | SVG render no Anki desktop | smoke manual | smoke-enrich.ts (Passo 5 humano) | ❌ Wave 0 — extender `smoke-enrich.ts` |

### Lacunas do Wave 0

- [ ] `sanitize-svg.ts` — módulo de sanitização (a criar, ou inline em `enrich.ts`)
- [ ] Fixtures adversariais F-01..F-12 em `enrich.test.ts` (ou `sanitize-svg.test.ts`)
- [ ] Casos de teste do batch mnemônico (parser por-id, fail-soft) em `enrich.test.ts`
- [ ] Casos de teste do embed nos exporters em `enrich.test.ts`
- [ ] Guard PIPE-03 estendido para `mnemonico`/`imagem` toggles
- [ ] Smoke gated estendido para passo de SVG real

---

## Domínio de Segurança

> `security_enforcement`: ativo (ausente no config = ativo).

### Categorias ASVS Aplicáveis

| Categoria ASVS | Aplica | Controle Padrão |
|----------------|--------|-----------------|
| V2 Autenticação | não | app local single-user |
| V3 Gestão de Sessão | não | sem sessão |
| V4 Controle de Acesso | não | sem auth |
| V5 Validação de Entrada | **sim** | allowlist geométrica DOMPurify (`ALLOWED_TAGS`/`ALLOWED_ATTR`) |
| V6 Criptografia | não | sem criptografia nesta fase |

### Ameaças Conhecidas para este Stack

| Padrão | STRIDE | Mitigação Padrão |
|--------|--------|-----------------|
| XSS via SVG inline (script, on*, javascript:) | Spoofing/Tampering | `isomorphic-dompurify` allowlist geométrica estrita (D-06/D-07) |
| XSS via `<use xlink:href="...">` externo | Tampering | `<use>` fora de ALLOWED_TAGS → removido |
| XSS via `<foreignObject>` + HTML embutido | Tampering | `<foreignObject>` fora de ALLOWED_TAGS → removido |
| Exfiltração via `<image href="http://...">` | Information Disclosure | `<image>` fora de ALLOWED_TAGS → removido |
| CSS `url()` em atributo `style` | Tampering | `style` fora de ALLOWED_ATTR → removido |
| Path traversal via `loadPrompt('../../etc/passwd')` | Tampering | Allowlist dos 5 nomes canônicos em `prompt-loader.ts` — já implementada |
| Prompt injection via interpolação de `q.resposta` | Tampering | Serializar payload via `JSON.stringify` (T-03-02 — padrão já estabelecido) |
| Embed de SVG não-sanitizado | Tampering | fail-closed D-08: `sanitizarSvg() === null` → descarta; nunca embute cru |

---

## Fontes

### Primárias (confiança ALTA)

- Codebase do projeto (leitura direta): `enrich.ts`, `image-provider.ts`, `generation.ts`, `csv.ts`, `ankiconnect.ts`, `types.ts`, `enrich.test.ts`, `guard-enrich.ts`, `smoke-enrich.ts`, `prompt-loader.ts`, `mnemonic.md`, `mnemonic-image.md`
- `npm view isomorphic-dompurify` — versão, engines, exports, dependencies, tamanho
- `npm view jsdom dist.unpackedSize` — tamanho do jsdom (~7MB)
- [github.com/cure53/DOMPurify/blob/main/src/tags.ts](https://github.com/cure53/DOMPurify/blob/main/src/tags.ts) — tags SVG default
- [github.com/cure53/DOMPurify/blob/main/src/attrs.ts](https://github.com/cure53/DOMPurify/blob/main/src/attrs.ts) — atributos SVG default

### Secundárias (confiança MÉDIA — verificado com fonte oficial)

- [github.com/cure53/DOMPurify/blob/main/README.md](https://github.com/cure53/DOMPurify) — USE_PROFILES sobrescreve ALLOWED_TAGS; uso server-side com jsdom; configuração SVG
- [github.com/kkomelin/isomorphic-dompurify/releases/tag/3.0.0](https://github.com/kkomelin/isomorphic-dompurify/releases/tag/3.0.0) — ESM support, Node requirement, clearWindow()
- [github.com/ankitects/anki/issues/3931](https://github.com/ankitects/anki/issues/3931) — stripping de atributos SVG no Anki 25.02.1
- [forums.ankiweb.net — Anki 25.02.1 removes SVG attributes](https://forums.ankiweb.net/t/anki-25-02-1-removes-embedded-iframe-tags-and-svg-attributes/59290) — confirmação do stripping

### Terciárias (confiança BAIXA — marcadas como ASSUMED)

- AnkiMobile SVG inline: sem fonte oficial confirmada [ASSUMED: A3]
- Comportamento exato do DOMPurify interno do Anki 25.02.x sobre SVG geométrico [ASSUMED: A1]

---

## Metadados

**Confiança por área:**
- Stack (isomorphic-dompurify, config de sanitização): ALTA — verificado via npm + doc oficial
- Arquitetura (estágios, padrões de batch/merge/fail-closed): ALTA — espelha padrões já implementados e testados na Phase 3
- Render SVG no Anki: MÉDIA — comportamento pré-25.02 confirmado; 25.02.x tem risco documentado

**Data da pesquisa:** 2026-06-03
**Válido até:** ~2026-07-03 (30 dias para stack estável; monitorar releases do Anki se o smoke mostrar problema)
