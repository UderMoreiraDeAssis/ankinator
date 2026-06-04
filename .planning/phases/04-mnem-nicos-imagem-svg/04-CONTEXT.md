# Phase 4: Mnemônicos + Imagem SVG - Context

**Gathered:** 2026-06-03
**Status:** Ready for planning
**Source:** `/gsd:discuss-phase 4 --power` → `finalize` — 14 perguntas geradas; **14 respondidas (100%)**, cada uma com justificativa ancorada no código e cruzando questões entre si (ver `04-QUESTIONS.json` / `04-QUESTIONS.html`).

<domain>
## Phase Boundary

Adicionar os **dois últimos especialistas de conteúdo** — **mnemônico** (MNEM-01/02) e **imagem de mnemônico** (SVG gerado pelo Claude, IMG-01) — como novos estágios da `enrichAll()` existente, com **sanitização** do SVG (IMG-02) e **embed** nos cards exportados (CSV + AnkiConnect, IMG-03), **sem regredir** o fluxo padrão. Entrega MNEM-01, MNEM-02, IMG-01, IMG-02, IMG-03.

**Dentro do escopo:**
- Estágio **mnemônico**: 1 chamada CLI em **batch** com todos os cards (casa por id); o `mnemonic.md` decide quem recebe (devolve vazio p/ conceituais) e qual técnica usar.
- Estágio **imagem**: **encadeado após o mnemônico**, por-card, **só** nos cards com `q.mnemonico` preenchido; reusa o `SvgClaudeImageProvider` já pronto (porém UNWIRED).
- **Sanitização** do SVG via **lib dedicada (DOMPurify, perfil SVG)** com **allowlist geométrica estrita**; falha → **fail-closed** (descarta o SVG, mantém o mnemônico-texto, erro no `enrich-progress`).
- **Embed** = `<svg>` sanitizado **inline no verso** (`q.resposta`/`versoHtml`), **mesmo mecanismo** nos dois exporters, note type `'Basic'` intacto.
- **UI**: toggles no bloco "Modo educativo" do `StructurePanel` — **mnemônico LIGADO / imagem DESLIGADA**; `CardTable` só com **badges** (📝/🖼️) read-only, **sem renderizar** o SVG.
- **Verificação**: unit puro com fixtures maliciosos + guard CLI-free (PIPE-03 byte-identidade) + smoke gated do SVG real.

**Fora do escopo (FIXO):**
- **Seleção inteligente por-card** de quais estágios rodar e **batching** p/ poupar quota → **Phase 5** (ORCH-01/02/03). Aqui o mnemônico manda todos e o especialista filtra; a imagem é por-card sem cap.
- **Cap suave / número mágico** de imagens por lote → rejeitado (Q-05); 1º incremento de Phase 5 se o smoke mostrar dor de quota.
- Seleção de técnica na UI, **preview do SVG** no app web, **note type novo** / arquivos de mídia / `storeMediaFile`, **retry** na geração de SVG — todos rejeitados nas decisões abaixo.
- Provider de imagem **raster** (fotorrealismo) → v2 (IMGR-01).

**Herdado das fases 1-3 (não re-decidir):**
- Enrich roda **encadeado no mesmo job** de `/generate`; progresso via evento `enrich-progress` na union `JobEvent`; estágios vivem em `core/specialists/enrich.ts` (`enrichAll`). [Phase 3 D-01/D-02/D-03]
- Especialistas usam modelo **`sonnet`** (default do runner). [Phase 3 D-04]
- **Isolamento de erro por-card**: nunca derruba o job; card mantém conteúdo cru. [Phase 3 D-13]
- Progresso **dentro do passo `generating`**; NÃO adicionar 5º step no `Stepper`. [Phase 3 D-16]
- **Fonte única `.md`**: `mnemonic.md` e `mnemonic-image.md` já existem — **refinar, não duplicar**.
- Tipo `Questao` já tem `mnemonico?`/`mnemonicoSvg?` em server e web — **sem mudança de tipo** (SPEC-05).
- Andaime pronto: `ImageProvider` + `SvgClaudeImageProvider` (`createImageProvider`) existem, porém **UNWIRED**.
- Bloco "Modo educativo" (`StructurePanel`) é **extensível** [Phase 3 D-14]; defaults sob restrição de quota [Phase 3 D-15].

</domain>

<decisions>
## Implementation Decisions

Cada decisão D-NN corresponde à pergunta Q-NN do `04-QUESTIONS.json` (justificativa completa em `chat_more`). As referências "Phase 3 D-NN" apontam para `03-CONTEXT.md`.

### Estágio Mnemônico (MNEM-01, MNEM-02)
- **D-01 (Q-01) — Seletividade = o ESPECIALISTA decide (envia todos, devolve vazio p/ conceituais).** Roda o `mnemonic` para todo o lote; o `.md` já tem a seção "Quando NÃO gerar" (recusa cards conceituais/raciocínio → vazio). **Zero heurística duplicada no código**; a seleção "real" por-card é explicitamente ORCH-01/Phase 5. O custo de gastar chamada em cards vazios é anulado por D-02 (1 chamada batch). Rejeitado: (b) heurística no código duplica a regra do `.md` e antecipa ORCH-01; (c) polui cards conceituais com mnemônicos forçados.
- **D-02 (Q-02) — Granularidade = BATCH único (todos numa chamada, casa por id).** Espelha o classificador (Phase 3 D-05: 1 chamada com TODOS; D-06: parser casa-por-id via `Map`, anti-posicional). O mnemônico **não divide cards** (≠ card-builder) e produz texto casável por id → o padrão do classificador serve direto. Poupa quota (o gargalo) e é o que torna D-01 barato (conceituais vazios não viram spawns extras). Degrada com graça: id ausente no parse → card sem mnemônico (mantém cru, Phase 3 D-13). Rejeitado: (a) por-card multiplicaria a quota sem o ganho que justifica o por-card no card-builder (o split 1→N, que aqui não existe).
- **D-03 (Q-03) — Técnica (MNEM-02) = o ESPECIALISTA escolhe sozinho (sem UI).** O `mnemonic.md` já traz "## Técnicas (escolha a melhor para o card)" (acrônimo/história/loci/rima) guiado pelo conteúdo — leitura literal de MNEM-02 ("escolhidas conforme o conteúdo"), **zero superfície de UI**. Rejeitado: (b) adiciona estado de UI + parâmetro no prompt e contradiz "conforme o conteúdo". **Reversível:** expor uma preferência opcional depois é incremento barato (gatilho se o usuário pedir).

### Estágio Imagem SVG (IMG-01)
- **D-04 (Q-04) — Imagem ENCADEADA: só p/ cards que já têm mnemônico.** O estágio imagem roda **APÓS** o de mnemônico, só nos cards com `q.mnemonico` preenchido. Fiel a IMG-01 ("o SVG ilustra o mnemônico") e à assinatura pronta `generate(mnemonic, context)` (`image-provider.ts`); o `mnemonic-image.md` reforça "refletir FIELMENTE o mnemônico". Sem mnemônico não há o que ilustrar. Rejeitado: (b) desacopla mas foge de IMG-01 e mudaria a entrada do provider (retrabalho). Forma a cadeia **D-01→D-02→D-04**.
- **D-05 (Q-05) — Granularidade/cap = por-card, SEM cap (confiar no default-OFF + toggle).** A imagem é a chamada **mais cara** e batching/seletividade é explicitamente ORCH-02/Phase 5 — adiar a otimização é consciente (mesmo motivo do card-builder por-card sem cap, Phase 3 D-12). Mínima superfície, com o **default-OFF** (D-12) como guarda. Rejeitado: (b) cap suave introduz número mágico (N=10) que nenhum requisito pede, antecipa ORCH-02 e exige novo sinal no `enrich-progress` — flexibilidade especulativa rejeitada em casos análogos. **Reversível:** se o smoke real mostrar dor de quota num lote grande, o cap suave é o 1º incremento.

### Sanitização do SVG (IMG-02)
- **D-06 (Q-06) — Estratégia = lib dedicada (DOMPurify, perfil SVG).** IMG-02 é **security-sensitive** e a fonte **não** é plenamente confiável (o PDF de origem pode tentar injeção indireta p/ o Claude emitir `<script>`/`on*`/`href` externo no SVG, que **executa JS** em Anki/QtWebEngine e no preview web). Sanitizar SVG corretamente é notoriamente difícil (`<script>`, `on*`, `javascript:`, `<use>`/`xlink:href`, CSS `url()`, `<animate>`/`<set>`) → **não escrever o próprio sanitizador**; usar lib mantida/auditada. Nomeada a tensão com "mínimas dependências" do projeto: p/ um controle de segurança de **baixa reversibilidade**, robustez supera leveza. Rejeitado: (c) prompt+regex é denylist sem allowlist positiva (burlável); (b) allowlist manual adiciona parser próprio e carrega risco de bug bespoke no ponto mais crítico. Defesa em camadas com D-07/D-08/D-14.
- **D-07 (Q-07) — Allowlist = geométrica ESTRITA.** Permite só o conhecido-seguro que o `mnemonic-image.md` produz (`path, rect, circle, line, polygon, text, g, defs, linearGradient, stop` + atributos de estilo) e descarta TODO o resto por omissão (`<script>`, `on*`, `<foreignObject>`, `<use>`/`href`, `<animate>` caem fora) — **allowlist > denylist**, fail-closed por construção. Rejeitado: (b) allowlist ampla aumenta a superfície de risco sem ganho (o Claude não emite exótico aqui). Aperta o `ALLOWED_TAGS` da lib de D-06; testada por D-14.
- **D-08 (Q-08) — Falha na sanitização = descartar o SVG; card mantém só o mnemônico-texto; erro no `enrich-progress`.** Espelha Phase 3 D-13 (isolamento por-card; nunca derruba o job). O mnemônico-texto é o valor primário; o SVG é reforço (D-04) → fail-closed: nunca embute markup sujo. Rejeitado: (b) "embutir o que sobrou" arrisca markup parcial/perigoso; (c) 1 retry gasta +1 chamada na etapa **mais cara** (o pior lugar p/ queimar quota). Compõe com D-04/D-06/D-14.

### Embed no Export (IMG-03)
- **D-09 (Q-09) — Mecanismo = SVG INLINE no HTML do verso (`<svg>…</svg>` direto).** Análogo direto de Phase 3 D-11 (embutir conteúdo no campo, zero arquivo de mídia, zero mudança de note type). Hoje o CSV é texto puro sem mídia e o AnkiConnect só usa `addNotes` (sem `storeMediaFile`). Inline concatena o `<svg>` sanitizado ao fim do verso — **um caminho** p/ os dois exporters (D-10/D-11), inspecionável (sem inchaço base64) e reusável no preview. Rejeitado: (b) data-URI base64 incha o CSV ~33% sem ganho sobre o inline; (c) arquivo de mídia exige infra nova no AnkiConnect e atrito de `collection.media` no import do CSV. O smoke (D-14) confirma o render no Anki.
- **D-10 (Q-10) — CSV e AnkiConnect usam o MESMO mecanismo (inline, sem mídia externa).** Par direto de D-09: como o embed é inline no campo, os dois exporters fazem a mesma concatenação de string no verso → **um só código de embed**, PIPE-03 trivial (toggles off ⇒ `q.mnemonicoSvg` undefined ⇒ saída byte-idêntica) e um só caminho de teste. Rejeitado: (b) por-exporter duplica código/testes e exige infra de mídia que nenhum exporter tem hoje. **Reversível:** migrar p/ `storeMediaFile` nativo é opção futura se o inline mostrar limite (gatilho com D-09).
- **D-11 (Q-11) — Mnemônico + imagem moram EMBUTIDOS no verso; nota `'Basic'` intacta.** Espelha Phase 3 D-11 exatamente: anexa mnemônico-texto + SVG sanitizado ao fim do verso via o `versoHtml()`/`versoDaQuestao()` existente; os campos `q.mnemonico`/`q.mnemonicoSvg` **armazenam** o dado (escritos pelos especialistas), o **export** anexa. Zero mudança de note type → menor superfície, evita o pitfall do tipo `Questao` duplicado. Rejeitado: (b) note type novo exige criar/gerenciar modelo nos dois exporters (mais superfície, mesmo risco do tipo duplicado). Compõe com D-09/D-10.

### UI & Revisão (PIPE-02)
- **D-12 (Q-12) — Defaults = Mnemônico LIGADO, Imagem DESLIGADA.** Aplica o precedente de defaults-SPLIT da Phase 3 (D-15: barato/universal LIGADO, multiplicador caro DESLIGADO). Com D-02 o mnemônico é **uma chamada batch barata** (não-multiplicador), o análogo do classificador → LIGADO, entregando o valor central da fase "de fábrica" a quem estuda p/ concurso. A imagem é a chamada por-card **mais cara** (D-05 sem cap) → DESLIGADA, opt-in consciente (o guarda de quota). Rejeitado: (a) "ambos off" subtrai o valor barato do mnemônico; (c) "ambos on" liga o estágio mais caro por default. **Reversível:** desligar o mnemônico-automático em decks conceituais é 1 clique.
- **D-13 (Q-13) — `CardTable` = só BADGE indicador (📝 mnemônico / 🖼️ SVG), sem renderizar.** Espelha a mínima superfície de Phase 3 D-17 (read-only, sem render rico). Renderizar SVG no app web é uma superfície de sanitização **diferente** do Anki (risco de XSS via `dangerouslySetInnerHTML` dentro do React) → não renderizar o que não precisa (defesa em camadas); o usuário confere o render real no Anki (o alvo de verdade). Rejeitado: (b) preview abre essa segunda superfície + layout p/ uma ferramenta single-user onde o resultado aparece no Anki de qualquer forma. **Reversível:** preview é incremento futuro e reusaria o sanitizador de D-06 (DOMPurify nativo no browser).

### Verificação & Não-regressão
- **D-14 (Q-14) — Verificação = unit puro c/ fixtures maliciosos + guard CLI-free (PIPE-03) + smoke gated do SVG real.** Replica a disciplina provada nas Phases 1-3 (Phase 3 D-18) e é **obrigatória** por a sanitização ser security-sensitive: (1) **unit puro** (vitest, já instalado) com fixtures maliciosos — `<script>`, `onload`, `href` externo, `<foreignObject>`, `<use>` — provando remoção **sem queimar quota** e de forma **determinística**; (2) **guard CLI-free** provando que, com toggles off, o estágio imagem não é chamado e `/generate` fica byte-idêntico (PIPE-03); (3) **smoke opt-in** que gera o SVG real só sob demanda. Rejeitado: (b) "só smoke" queima quota e é não-determinístico no CI — inaceitável p/ um controle de segurança, que exige casos adversariais repetíveis. Fecha o ciclo D-06/D-07/D-08.

### Claude's Discretion
- Nomes exatos de funções/arquivos dos estágios mnemônico e imagem dentro de `enrich.ts`.
- A lib de sanitização exata (`isomorphic-dompurify` vs `dompurify` + `jsdom`) — desde que aplique o **perfil SVG + a allowlist geométrica estrita de D-07**, seja **fail-closed** (D-08) e o build fique verde (ver Research flag 1).
- Formato exato do prompt/userMessage que monta a entrada do batch mnemônico (lista de cards) — respeitando o `mnemonic.md` canônico (fonte única, não duplicar).
- Formato do JSON de saída do mnemônico (ex.: `{mnemonicos:[{id, mnemonico, tecnica?}]}`) e o parser tolerante casa-por-id (clone do `parseQuestoesJson`, D-02).
- Rótulos dos estágios no `enrich-progress`, ícones/badges exatos na `CardTable`, e a ordem de montagem do verso (mnemônico-texto / SVG / explicação existente) no `versoHtml`/csv.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.** Todo path é relativo à raiz do repo (`/home/t316360/plottwist/ankinator`).

### Decisões & escopo da milestone
- `.planning/PROJECT.md` — Key Decisions (imagem de mnemônico = **SVG gerado pelo Claude** + interface `ImageProvider`; cadeia = modo "educativo" opcional; 5 especialistas) + **Constraints** (imagem **sem serviço externo pago**; SVG **sanitizado** antes de embutir; quota é gargalo; **não regredir**).
- `.planning/REQUIREMENTS.md` — **MNEM-01, MNEM-02, IMG-01, IMG-02, IMG-03** (escopo desta fase) + "Out of Scope" (raster) + v2 `IMGR-01`.
- `.planning/ROADMAP.md` §"Phase 4: Mnemônicos + Imagem SVG" — goal + 3 success criteria. §"Phase 5: Orquestrador Anki" — fronteira do que **NÃO** entra (decisão por-card, batching/seletividade ORCH-01/02/03).

### Mapas do codebase (estado atual)
- `.planning/codebase/ARCHITECTURE.md` — pipeline `PDF→LoadedDocument→SemanticChunk→Questao→Exporters`; camadas; tipos centrais.
- `.planning/codebase/CONVENTIONS.md` — estilo, naming, idioma PT em comentários/commits.
- `.planning/codebase/TESTING.md` — disciplina guard CLI-free / unit puro / smoke gated (informa D-14).
- `.planning/codebase/CONCERNS.md` — tipo `Questao` duplicado server/web (motiva D-11).
- `.planning/phases/01-andaime-dos-especialistas/01-CONTEXT.md` — andaime: `ImageProvider`/`SvgClaudeImageProvider`/`createImageProvider` (SPEC-04), runner, prompt-loader.
- `.planning/phases/03-classificador-de-deck-card-educativo/03-CONTEXT.md` — padrões reusados: batch-por-id (D-05/D-06), embed no verso sem note type novo (D-11), isolamento por-card (D-13), defaults-split por quota (D-15), verificação (D-18).

### Código fonte a respeitar/estender
- `ankinator-app/server/src/core/specialists/runner.ts` — `runClaudeCli()` / `buildSpawnArgs()` (assinatura, default `sonnet`). Base da chamada batch do mnemônico (D-02).
- `ankinator-app/server/src/core/specialists/prompt-loader.ts` — `loadPrompt(nome)`. Usar p/ `mnemonic` e `mnemonic-image`.
- `ankinator-app/server/src/core/specialists/prompts/mnemonic.md` — fonte única; já tem "Quando NÃO gerar" (D-01) e "## Técnicas" (D-03). **Refinar, não duplicar.**
- `ankinator-app/server/src/core/specialists/prompts/mnemonic-image.md` — fonte única; já pede sem `<script>`/URLs externas/`foreignObject` e "refletir FIELMENTE o mnemônico" (D-04/D-06). Refinar.
- `ankinator-app/server/src/core/specialists/image-provider.ts` — `ImageProvider` + `SvgClaudeImageProvider.generate(mnemonic, context)` (~linhas 19-26) + `createImageProvider()` (default `svg-claude`); **TODO(IMG-02)** (~linha 42). **UNWIRED** — plugar no estágio imagem (D-04/D-06/D-08).
- `ankinator-app/server/src/core/specialists/enrich.ts` — `enrichAll()` (Phase 3). Adicionar estágio mnemônico (batch, D-01/D-02) e estágio imagem (por-card, gated por `q.mnemonico`, D-04/D-05) com isolamento por-card (D-08).
- `ankinator-app/server/src/core/specialists/enrich.test.ts` — testes do enrich (vitest). Estender com fixtures maliciosos de sanitização + casos de batch mnemônico (D-14).
- `ankinator-app/server/src/core/generation.ts` — `parseQuestoesJson()` (molde do parser tolerante casa-por-id, D-02), `generateAll()` (padrão de isolamento de erro, D-08).
- `ankinator-app/server/src/core/types.ts` — `Questao` (já tem `mnemonico?`/`mnemonicoSvg?` por SPEC-05). **NÃO adicionar campos** (D-11).
- `ankinator-app/server/src/store.ts` — `JobEvent` union + `enrich-progress` (Phase 3 D-02). Rotular estágios mnemônico/imagem + erros (D-08).
- `ankinator-app/server/src/core/exporters/csv.ts` — `versoHtml`/montagem do verso. Anexar mnemônico-texto + `<svg>` inline (D-09/D-10/D-11) com gate (byte-identidade quando sem SVG, PIPE-03).
- `ankinator-app/server/src/core/exporters/ankiconnect.ts` — `pushToAnki()` (`addNotes`, note type `'Basic'` ~linha 113). Anexar inline no verso, **mesmo mecanismo** do CSV (D-09/D-10/D-11); **sem** `storeMediaFile`.
- `ankinator-app/web/src/components/StructurePanel.tsx` — bloco "Modo educativo" extensível (Phase 3 D-14). Adicionar toggles mnemônico (default ON) / imagem (default OFF) (D-12).
- `ankinator-app/web/src/components/CardTable.tsx` — badges 📝/🖼️ read-only (D-13); **NÃO** renderizar o SVG.
- `ankinator-app/web/src/components/ProgressPanel.tsx` — estender p/ as fases de enrich mnemônico/imagem via `enrich-progress`.
- `ankinator-app/web/src/components/Stepper.tsx` — 4 passos fixos; **NÃO** adicionar step (Phase 3 D-16).
- `ankinator-app/web/src/types.ts` — `Questao` espelhado + `GenerateOptions`. Espelhar as novas toggles (sem tocar campos de `Questao`, D-11).
- `ankinator-app/web/src/App.tsx` — `options` + listener `enrich-progress`.
- `ankinator-app/server/src/scripts/guard-enrich.ts` + `smoke-enrich.ts` — moldes p/ guard CLI-free + smoke gated de D-14.

### Externo
- **DOMPurify (perfil SVG)** — **NOVA dependência** (1ª externa da milestone; D-06). A sanitização roda **server-side** (no caminho de export), logo precisa de DOM no Node → avaliar `isomorphic-dompurify` ou `dompurify` + `jsdom`. No browser DOMPurify é nativo (relevante só se um preview in-app voltar, D-13). **Confirmar na pesquisa** (Research flag 1).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `SvgClaudeImageProvider` / `createImageProvider()` (`image-provider.ts`, Phase 1) — provider pronto (`generate(mnemonic, context)` → `loadPrompt('mnemonic-image')` + `runClaudeCli`), porém **UNWIRED**. O estágio imagem (D-04) só precisa plugá-lo no `enrich`.
- `enrich.enrichAll()` (Phase 3) — loop sequencial + isolamento de erro por unidade + `onProgress`: molde p/ os 2 novos estágios (mnemônico batch / imagem por-card).
- `generation.parseQuestoesJson()` — parser tolerante (remove cercas ```json, recorta `{...}`): molde direto p/ o parser casa-por-id do batch mnemônico (D-02).
- `prompts/mnemonic.md` + `prompts/mnemonic-image.md` — fontes únicas já com as regras (quando NÃO gerar, técnicas, "sem script/URL externa"): **refinar** (D-01/D-03/D-06).
- Evento `enrich-progress` na union `JobEvent` (`store.ts`, Phase 3) — reusar p/ rotular os estágios e reportar erros de sanitização (D-08).
- `scripts/guard-enrich.ts` + `scripts/smoke-enrich.ts` + `enrich.test.ts` (vitest 4.1.8) — padrão guard CLI-free + smoke gated + unit puro: molde p/ D-14.

### Established Patterns
- **Batch 1-chamada-casa-por-id** (classificador, Phase 3 D-05/D-06) → estágio mnemônico (D-02): 1 chamada com todos, parser anti-posicional.
- **Embed inline no verso sem mudar note type** (Phase 3 D-11) → mnemônico-texto + SVG inline (D-09/D-10/D-11), nota `'Basic'`.
- **Isolamento de erro por-card** (`generateAll`, Phase 3 D-13) → fail-closed da sanitização (D-08).
- **Defaults-split por quota** (Phase 3 D-15: barato/universal ON, multiplicador caro OFF) → mnemônico batch ON, imagem por-card OFF (D-12).
- **Verificação CLI-free + smoke gated + unit puro** (Phases 1-3, D-18) → base de D-14.
- **Fonte única `.md` espelhada em Skill** (SPEC-02/03): o conteúdo vive no `.md` canônico, nunca duplicado no código.

### Integration Points
- `enrichAll()` ganha o estágio **mnemônico** (batch, após classificar/card-builder) e o estágio **imagem** (por-card, gated por `q.mnemonico`, após o mnemônico) — D-01/D-02/D-04/D-05.
- Estágio imagem chama `imageProvider.generate(q.mnemonico, context)` → SVG → **sanitiza (DOMPurify, allowlist geométrica)** → grava `q.mnemonicoSvg` **ou descarta** (fail-closed) — D-06/D-07/D-08.
- Exporters anexam `q.mnemonico` (texto) + `q.mnemonicoSvg` (`<svg>` inline) ao fim do verso, **mesmo código** nos dois (D-09/D-10/D-11), com gate p/ byte-identidade quando ausentes (PIPE-03).
- UI: `StructurePanel` adiciona 2 toggles → `options` (D-12); `enrich-progress` → `ProgressPanel` (estágios); `CardTable` mostra badges 📝/🖼️ (D-13).

</code_context>

<specifics>
## Specific Ideas

- O usuário respondeu as 14 perguntas aplicando rigorosamente os princípios Karpathy e cruzando decisões: **simplicidade/superfície mínima** (D-01 zero heurística no código; D-05 sem cap/número mágico; D-09/D-11 inline sem note type novo; D-13 sem render no front), **mudança cirúrgica/aditiva** (D-09/D-10/D-11 com gate preservam PIPE-03 byte-idêntico), **correção sobre conveniência** (D-02 casa por id; D-06 lib auditada em vez de sanitizador bespoke), **critério verificável** (D-14 fixtures maliciosos determinísticos), **decisões reversíveis sinalizadas** (D-03 técnica na UI, D-05 cap suave, D-12 desligar mnemônico, D-13 preview futuro).
- **Exceção security-first (D-06):** a única vez em que o usuário escolheu **mais** dependência — nomeou a tensão com "mínimas dependências" do projeto, mas, por a sanitização de SVG ser um controle de segurança de **baixa reversibilidade** (renderiza em contexto que executa JS), priorizou robustez auditada (DOMPurify) sobre leveza. Defesa em camadas: D-06 (lib) + D-07 (allowlist estrita) + D-08 (fail-closed) + D-13 (não renderizar no front) + D-14 (fixtures adversariais).
- **Coerência de cadeia entre respostas:** D-01→D-02→D-04 (especialista filtra + batch barato + imagem só com mnemônico); D-06→D-07→D-08→D-14 (lib + allowlist + fail-closed + fixtures); D-09→D-10→D-11 (inline + mesmo mecanismo + no verso); D-02→D-12 (mnemônico batch barato → ON) e D-05→D-12 (imagem cara → OFF). Não há decisão órfã.
- **Tensão central — quota vs. valor:** mnemônico é batch barato (D-02) → default ON (D-12); imagem é por-card caro (D-05) → default OFF (D-12). Batching/seletividade real fica para o orquestrador da Phase 5 (ORCH-01/02), conscientemente adiado.

### Research flags (o `gsd-phase-researcher` deve confirmar/aprofundar)
1. **DOMPurify server-side (D-06):** confirmar a forma de rodar DOMPurify no Node p/ o caminho de export — `isomorphic-dompurify` (encapsula `jsdom`) vs `dompurify` + `jsdom` explícito. Definir o perfil SVG (`USE_PROFILES:{svg:true, svgFilters:true}`) e o `ALLOWED_TAGS` geométrico estrito de D-07. Pesar o peso do `jsdom` contra "mínimas dependências"; se proibitivo, avaliar sanitizar no front antes do export (muda o ponto de embed).
2. **Render de `<svg>` inline no Anki (D-09):** o smoke (D-14) deve confirmar que `<svg>…</svg>` inline no campo Back renderiza no Anki desktop (QtWebEngine) e no AnkiMobile/AnkiDroid. Se inline falhar, o fallback é data-URI (Q-09b) e, em último caso, media file (Q-09c) — **gatilho de revisão de D-09**.
3. **Verso com mnemônico + SVG (D-11):** confirmar que `versoHtml()` (ankiconnect) e a coluna Verso (csv) montam "resposta + explicação + mnemônico-texto + SVG" de forma legível (quebras/markdown) sem estourar o layout do card.
4. **Parser batch mnemônico por id (D-02):** definir o JSON de saída e o parser tolerante a omissão/reordenação (id ausente → card sem mnemônico, fail-soft, D-08), espelhando `parseQuestoesJson`/o parser de classificações da Phase 3.
5. **Cobertura adversarial da allowlist (D-07/D-14):** garantir que os fixtures cubram os vetores conhecidos de SVG — `<script>`, `on*`, `javascript:`, `<use>`/`xlink:href`, `<foreignObject>`, CSS `url()`, `<animate>`/`<set>`, `<image href>` externo.

</specifics>

<deferred>
## Deferred Ideas

- **Seleção inteligente por-card** de quais estágios rodar — Phase 5 (ORCH-01). Aqui o mnemônico envia todos e o especialista filtra (D-01).
- **Batching / cap suave da imagem** (poupar quota) — Phase 5 (ORCH-02). Imagem por-card sem cap (D-05) é deliberado; cap suave (N primeiros) é o 1º incremento se o smoke real mostrar dor.
- **Seleção de técnica de mnemônico na UI** — rejeitado agora (D-03); incremento barato se o usuário pedir.
- **Preview do SVG na `CardTable`** — rejeitado agora (D-13); reusaria o sanitizador de D-06 (DOMPurify nativo no browser); gatilho se houver demanda por revisão in-app.
- **Note type Anki com campos separados (Mnemônico/Imagem) + arquivos de mídia / `storeMediaFile`** — rejeitado agora (D-09/D-10/D-11); migrar se o inline mostrar limite no Anki.
- **1 retry na geração do SVG antes de descartar** — rejeitado agora (D-08); reabrir se a taxa de falha justificar +1 chamada na etapa mais cara.
- **Provider de imagem raster (fotorrealismo)** — v2 (IMGR-01), fora da milestone; SVG via Claude cobre o caso.

</deferred>

---

*Phase: 4-mnem-nicos-imagem-svg*
*Context gathered: 2026-06-03*
