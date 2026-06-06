# Tarefas — Ankinator (retomar após `/clear`)

> **Como retomar:** abra uma sessão no projeto e diga:
> *"Leia `.planning/TAREFAS.md`, o `.planning/STATE.md` e o `.planning/ROADMAP.md` (🎯 Destino) e continue."*
> O destino completo está no ROADMAP. Estado atual no STATE.

---

## ▶ ESTADO ATUAL — RETOMAR AQUI (2026-06-06, sessão k3b — markitdown + turbovec + validação ao vivo)

**Quick task `/gsd-quick --discuss --research`; decisão delegada → skill `tomada-de-decisao` (modo Estruturado) + sequential-thinking.** Dois repos adicionados via o **padrão sidecar Python da Phase 2**, **server-only, default loader + dedup Jaccard INTOCADOS**, e **VALIDADOS AO VIVO por mim** (venvs reais — você liberou validação autônoma).

### Decisão tri-eixo (Matriz Ponderada + reversibilidade + pré-mortem/devil's advocate)
- **markitdown** = loader PDF **opt-in** (`ANKINATOR_PDF_LOADER=markitdown`; sem Java, ao contrário do langchain que exige Java 25). Default INTOCADO; nunca auto-selecionado.
- **turbovec** = **scaffold provado por smoke** (busca vetorial TurboQuant), **dedup deferido** — turbovec consome embeddings que o projeto ainda NÃO gera. Não plugado no pipeline.
- **embeddings** = deferir; quando o dedup semântico for construído, fonte = **LOCAL grátis** (sentence-transformers), API paga REJEITADA (R2).

### ✅ Validação AO VIVO (eu rodei; venvs reais)
- **markitdown[pdf]==0.1.6**: sidecar extrai o PDF real `curso-230990` (166k chars, exit 0); `loadDocument` + `ANKINATOR_PDF_LOADER=markitdown` → log `PDF loader: markitdown` + LoadedDocument **numPages=1**. ⚠️ **Achado honesto:** markitdown gera **blob plano** (PDF sem headings ATX → 1 seção); o chunker ainda fatia por tamanho, mas perde-se a hierarquia que o langchain-opendataloader dá (tradeoff do "sem Java").
- **turbovec==0.7.0**: `smoke`/`add`/`search` + `runTurbovecSmoke()` E2E OK. ⚠️ **Bug real achado+corrigido AO VIVO (commit `1c1d9ea`):** `search` exige query **2D** (batch) e `dim` **múltiplo de 8** — o teste CLI-free **mockado não pegava** (lição reforçada: mock ≠ ao vivo).
- Venvs wired no `.env` local (`ANKINATOR_MARKITDOWN_PYTHON`/`ANKINATOR_TURBOVEC_PYTHON`); default loader segue langchain.

### Commits (no `main`)
`c3526d9` markitdown loader · `f05ec1e` turbovec scaffold · `7469be3` .env.example/requirements · `a8047df` docs(CONTEXT/RESEARCH/PLAN/SUMMARY/STATE) · `1c1d9ea` fix turbovec sidecar (ao vivo). Suíte completa + tsc + guard-default-loader verdes; arquivos protegidos (langchain/odl/deck-organizer/existing-deck) intocados.

### ▶ Pendente (não-bloqueante)
- Run completo PDF→cards→Anki **com** `ANKINATOR_PDF_LOADER=markitdown` (validei o LOADER; o downstream é o mesmo pipeline já validado). Decidir se markitdown vale como opção dado o blob plano (talvez só p/ formatos que o langchain não cobre — Office/imagem/áudio, follow-up).
- **Fase futura "dedup semântico"** (turbovec + embeddings local) — registrada em STATE → Deferred Items; **destrutiva no Anki → expor desenho + consentimento** antes.
- Destino #4: decidir se o orquestrado vira default (recomendação: manter opt-in).

---

## ▶ ESTADO ANTERIOR — sessão q-live2/q-live3 (2026-06-06, VALIDAÇÃO AUTÔNOMA AO VIVO)

**O usuário me desbloqueou para rodar a validação ao vivo eu mesmo** ("vc nao precisa depender de mim... o PDF de testes está em `/home/t316360/plottwist/material`"), deletou o loop de 15min e criou um de 2h. Resultado: **TODA a validação ao vivo pendente do Destino #4 + os 3 fixes de p-fix2 = PASS.**

### 🔬 COMO (reproduzível)
Driver novo `server/src/scripts/live-validate.ts` (espelha o /generate+/export do `api.ts`; mesmos defaults/knobs via `config`):
`ANKINATOR_ORCHESTRATED=1 ANKINATOR_PDF_LOADER=node tsx src/scripts/live-validate.ts <pdf> AnkinatorTeste "4,5" 6`
Seções 4 "Tipos de BD"(5870c) + 5 "ACID"(5078c) → 1 bloco 10950c → 6 cards. `claude` CLI 2.1.162 + AnkiConnect ON. Run total 177,7s.

### ✅ DESTINO #4 — QUALIDADE DO ORQUESTRADO = PASS
- **Orquestrador rodou SEM fallback:** `[orquestrador] chamada START→END` ($0.213, ~81s), `enriquecimento orquestrado END: 6/6`. `claude -p --agent ankinator-orchestrator` + Task funciona também na minha sessão (nested claude).
- **Faz TRABALHO REAL (resolve a dúvida do p-live):** stats por-campo `deck:6 tags:6 mnemonico:6 svg:6 de 6` — populou mnemônico p/ TODOS, não só deck/tags. (`svg:0` NO orquestrador é esperado = híbrido; os 6 SVGs vieram do pool.)
- **Híbrido sem timeout (fix p-fix2 #3):** imagem pelo pool determinístico paralelo → `imagens 6/6, 0 reprovadas` (1 SVG reprovado por 15 rótulos → retry → recuperado). Enrich total ~2,3min (longe dos 10min que estouravam antes).
- **Qualidade pedagógica boa:** mnemônico ACID = "A Chuva Isola a Duração" + discriminação do intruso ("PRIVACIDADE é da LGPD, não do ACID"); ganchos com discriminação de distrator; deck hierárquico rico (`Banco de Dados::Transações::Propriedades ACID`).

### ✅ p-fix2 #1 + #2 — VALIDADOS via AnkiConnect (notesInfo/deckNames)
- **Subdecks ANINHADOS (#2):** cards em `AnkinatorTeste::Transações::Propriedades ACID`, `AnkinatorTeste::Modelo Relacional::Características e Diferenças`, `AnkinatorTeste::Conceitos Fundamentais::Autodescrição e Metadados` — `reRootDeck` trocou a Matéria pela raiz do envio. Fim do "deck plano".
- **Tags PLANAS (#1):** todas as notas com último segmento, sem `::`, dedup — ex. `['2023','ankinator','extraida','fundatec','intermediario','modelo-relacional']`. Zero `::`.

### ⚠️ Artefatos desta sessão
- **Deck de teste `AnkinatorTeste`** (6 cards) no seu Anki — descartável; apague no Anki (deck → Delete) quando quiser.
- **Driver `server/src/scripts/live-validate.ts`** (novo, não-commitado) — útil p/ re-rodar; junto dos outros smoke/guard. 249 testes + tsc verdes com ele.

### ✅ RUN #2 (q-live3) — 2º tipo de conteúdo + BUG de tag achado e CORRIGIDO
Rodei a seção **"LISTA DE QUESTÕES"** (idx 9, 16 cards, deck `AnkinatorTesteCriada`) — confirma o orquestrado num 2º tipo de conteúdo e maior volume: orquestrador SEM fallback (~4min, $0.426), `deck:16 tags:16 resposta:2 mnemonico:16 svg:16 de 16`, híbrido sem timeout; via AnkiConnect, **subdecks ricos** (`::Arquitetura ANSI-SPARC::Independência de Dados`, `::Controle de Concorrência::Bloqueio e Deadlock`, `::Objetos de Banco de Dados::Views`, …) + tags planas. Mnemônicos bons (ANSI/SPARC: *"muda o porão, a sala e o quarto não tremem"*).

**ACHADO+FIX (bug real exposto pela validação):** 4/16 notas saíam com tag de origem **DUPLA e contraditória** (`criada`+`extraida`). Causa: o classificador do orquestrador emite `origem::criada` por conta própria, e o exporter já adiciona `origem::<q.tipo>` → o `Set` juntava as duas. **Origem é fato do PIPELINE (`q.tipo`), não classificação.** Fix cirúrgico no boundary `tagsDaQuestao` (`ankiconnect.ts` + `csv.ts`): descarta tags do classificador que achatam p/ `criada`/`extraida`; só `q.tipo` define origem. +1 teste de regressão. **250 testes (249→+1) + tsc + guards verdes.** (Cards já no deck de teste têm a tag dupla antiga — descartável.)

### ▶ PENDENTE (decisão do usuário)
- **Orquestrado vira DEFAULT?** Funciona e dá qualidade, MAS custa mais que o `enrichAll` determinístico (orquestrador $0.21 + imagens) e é o caminho `claude -p --agent` (mais pesado). Hoje é opt-in safe (default OFF, fallback). **Recomendo manter opt-in** — Destino #4 já está SATISFEITO como capacidade (agentes Claude de 1ª classe + orquestrador coordenando por-card).
- Trabalho de p/p-fix/p-fix2 + este driver seguem **não-commitados** (não commito sem você pedir).
- Frentes não-Destino: (perf+) paralelizar mnemônico/classificar (expor desenho); (a) Fatia 2 reorganizador (destrutiva, expor desenho).

---

## ▶ ESTADO ANTERIOR — sessão p (2026-06-05, fim da sessão p)

**Sessão (p) — rumo ao 🎯 Destino: fechei #5 e construí #4 (autônomo, ultracode).** Das 5 metas do Destino, #1/#2/#3 já estavam fechadas; ataquei as 2 que faltavam.

### 🔬 VALIDAÇÃO AO VIVO (run real do usuário 2026-06-05 21:10–21:27) = **PASS no mecanismo** ✅
PDF real `curso-230990` (85 pág), `ANKINATOR_ORCHESTRATED=1`, tudo ligado, `criadaFidelidade:livre`.
- **#5 CONFIRMADO ao vivo:** log `PDF loader: langchain (auto …)` — o loader LangChain foi de fato usado num PDF real.
- **#4 PASS no mecanismo (a maior incerteza, RESOLVIDA):** `[orquestrador] chamada START {projectRoot:"…/ankinator", bypass:false}` → rodou da raiz, least-privilege (preflight passou); `chamada END {outChars:23800, custo:0.8164}` → **retornou JSON válido, SEM erro, SEM fallback**; `enriquecimento orquestrado END: 36/36 enriquecido(s)` → todos fundidos por id; **36 cards no Anki, 0 erros**. Ou seja, `claude -p --agent`+Task headless **FUNCIONA na assinatura**.
- ⚠️ **2 achados do run (ambos CORRIGIDOS nesta sessão):**
  1. **Custo subnotificado:** o resumo dizia `$1.4330 / geração 100%`, mas a chamada do orquestrador custou **$0.8164** e ficava INVISÍVEL (runOrchestratorCli não gravava usage). Custo real do job ≈ **$2.25**. → Fix: novo estágio `orquestrador` em `usage.ts` + `recordUsage` no orquestrador (aparece no resumo agora).
  2. **Visibilidade do trabalho:** "36/36 enriquecido" = só casou por id, NÃO diz se populou mnemônico/SVG (o $0.82/9min é barato vs. o pipeline determinístico → suspeita de poucos SVGs). → Fix: `mergeOrchestratorResult` agora conta `{deck,tags,resposta,mnemonico,svg,svgDescartado}` e loga no END.
- ✅ **JULGAMENTO DO USUÁRIO (qualidade):** a maioria dos cards veio SEM imagem, apesar de imagem=ON. **Causa:** o prompt do agente `ankinator-orchestrator` manda usar imagem "com parcimônia" → ele gerava mnemônico mas pulava o SVG (bate com o custo baixo $0.82). **FIX (código, sem gate):** `buildOrchestratorMessage` agora, quando `imagem=ON`, instrui explicitamente "o usuário PEDIU imagens; gere `mnemonicoSvg` p/ a GRANDE MAIORIA dos cards com mnemônico, ignorando 'parcimônia'" (a user-message sobrepõe o default soft do system-prompt do agente). ⏳ Re-rodar p/ confirmar (a nova linha de stats mostrará `svg:N`).

### 🛠️ FOLLOW-UP (feedback do usuário) — 2 fixes
1. **Imagens no modo orquestrado** (acima): `buildOrchestratorMessage` cobre imagem/mnemônico explicitamente quando ligados.
2. **UI "Organizar decks" melhorada** (`web/src/components/DeckOrganizer.tsx`): lista de decks longa era sofrível — adicionei **filtro de busca** ("Filtrar decks…"), botões **"Selecionar tudo/filtrados"** + **"Limpar"**, contador "(N de M selecionado)", e aumentei a altura da lista (max-h-44→64). Padrão consistente com o StructurePanel (UI-2).

**245 testes (242→+3) + tsc + guard SPEC-01/enrich/default-loader + web tsc-b/vite build verdes.**

### 🛠️ FOLLOW-UP 2 (run #2 + feedback do usuário) — diagnóstico ao vivo + 3 fixes
**Run #2 (PDF curso-230990, ANKINATOR_ORCHESTRATED=1):** SVGs apareceram, MAS o **orquestrador ESTOUROU o timeout de 10min** (forçar ~50 imagens num call único) → caiu pro **fallback determinístico** (que gerou as 50/50 imagens, $8.55). Ou seja, as imagens vieram do fallback, não do orquestrador (~10min desperdiçados antes). O usuário também reportou, ao inspecionar o Anki (confirmado via AnkiConnect): (a) cards todos em deck PLANO "Banco de Dados" (sem subníveis), (b) etiquetas duplicadas e com `::` (`fgv`+`banca::fgv`, `2023`+`ano::2023`).
- **DIAGNÓSTICO (AnkiConnect ao vivo):** os 52 cards estavam em `Banco de Dados` plano; o export CRIA hierarquia (q.deck rooteado na Matéria "Tecnologia da Informação"), mas o **merge do organizador ACHATA** (move cards diretos → 1 deck). Tags: o classificador emite namespaced (`banca::`,`ano::`,`nivel::`,`tema::`,`origem::`) E o exporter adiciona planas de metadata → duplicação.
- **3 FIXES (escolhas do usuário via AskUserQuestion):**
  1. **Tags PLANAS** (`tagsDaQuestao` em `ankiconnect.ts`+`csv.ts`): `achatarTag` pega o último segmento (`banca::fgv`→`fgv`) e deduplica → sem `::`, sem duplicar. (+3 testes)
  2. **Subdecks aninhados sob o deck do envio** (`reRootDeck` + `nestUnderDeck` em `ankiconnect.ts`; wired api.ts `/export/ankiconnect` + web `api.pushToAnki` + checkbox "Aninhar subdecks sob este deck" em `ExportBar.tsx`, **default ON**): re-enraíza q.deck trocando a Matéria pelo deck escolhido → `Banco de Dados::Assunto::Subtópico` (cabeçalho do card + deckName consistentes). Não-destrutivo, dispensa o merge.
  3. **Híbrido no orquestrado** (`runEnrich` em `orchestrator.ts`): o orquestrador roda deck/tags/cardBuilder/mnemônico (rápido); a **imagem vai pelo estágio determinístico PARALELO** (pool) — elimina o timeout de 10min. (+1 teste)
- **249 testes (245→+4) + tsc + guard SPEC-01/enrich/default-loader + web tsc-b/vite verdes.** ⏳ Re-rodar p/ confirmar ao vivo: subdecks `Banco de Dados::…`, tags planas, e orquestrado+imagem sem timeout.

### ✅ Destino #5 — Loader LangChain DE FATO usado (FECHADO, verificado por mim, sem run ao vivo)
- Criei `~/.venvs/odl` + `pip install langchain-opendataloader-pdf==2.0.0` (Python 3.13 + Java 25 ✓), e fiei `ANKINATOR_LANGCHAIN_PYTHON=/home/t316360/.venvs/odl/bin/python3` no `ankinator-app/.env`.
- **Provado E2E:** o sidecar `tools/odl_langchain_loader.py` extrai Documents normalizados de `curso-8.pdf` (exit 0, `{page_content,metadata}` válidos — valida o wrapper Java também); `isLangchainAvailable()===true`; `chooseLoader(unset) → langchain (auto)`. O app agora **auto-prefere o LangChain**. Suíte verde com o `.env` novo = zero regressão. (Phase 2 deixa de ser "loader inativo".)

### 🔨 Destino #4 — Orquestrador Anki por-card WIRED (construído, opt-in OFF, falta validação AO VIVO)
- Novo `core/specialists/orchestrator.ts`: dispatcher `runEnrich` que, com `ANKINATOR_ORCHESTRATED=1`, roda `claude -p --agent ankinator-orchestrator` da **raiz do repo** (`--allowedTools Task Read --permission-mode dontAsk`) — o subagent decide por-card e delega via **Task** aos 4 workers; o resultado é fundido **por id**. **Fallback DETERMINÍSTICO p/ `enrichAll`** em qualquer falha (spawn/parse/timeout/agente-ausente/0-id-match/precondição). Default OFF = byte-equivalente (guard SPEC-01 generation spawn INTOCADO; PIPE-03/D-15 verdes).
- Flags **verificados contra `claude --help`** (não chutei): `--agent`, `--allowedTools <tools...>` variádico, `--permission-mode` (choices incl. `dontAsk`/`bypassPermissions`), `--exclude-dynamic-system-prompt-sections`, `--strict-mcp-config`. Pesquisa de mecânica headless por subagent claude-code-guide.
- **Revisão adversarial multi-lente (workflow ultracode, 4 lentes + verificação): 3 achados MEDIUM confirmados, todos corrigidos:**
  1. **(segurança)** os 4 workers não declaravam `tools:` → ao serem delegados via Task herdariam TODO o toolset (Bash/Write/…); `--allowedTools` do pai NÃO restringe o filho. **Mitigado EM CÓDIGO** por uma **precondição de segurança** (`workersToolRestricted`): o modo orquestrado **se recusa a rodar** (cai p/ `enrichAll`) se os workers não estiverem tool-restritos. ✅ **`tools: []` + `disallowedTools` APLICADO nos 4 agentes** (`.claude/agents/ankinator-{deck-classifier,card-builder,mnemonic,image}.md`) — você aprovou (a edição é self-mod, foi gated pelo classificador). `workersToolRestricted()` agora retorna `{ok:true}` → modo orquestrado **destravado E seguro** (workers sem Bash/Write/…).
  2. **(segurança)** escape `ANKINATOR_ORCHESTRATED_BYPASS` (bypassPermissions) → **aviso ALTO** no log + a precondição acima também o cobre.
  3. **(correção)** `mergeOrchestratorResult` ignorava os toggles → **gating por estágio** (deck/tags⟸classificar, resposta⟸cardBuilder, mnemônico⟸mnemonico, svg⟸imagem) = paridade com `enrichAll`. SVG do orquestrador passa pelo MESMO boundary `sanitizarSvg`(fail-closed)+`avaliarQualidadeSvg`.
- **242 testes (220→+22) + tsc --noEmit + guard SPEC-01 + guard-enrich + guard-default-loader verdes.** Arquivos: `core/specialists/orchestrator.ts` (+`orchestrator.test.ts`), `enrich.ts` (EnrichOpts +`orchestrated`), `config.ts` (+knob), `api.ts` (swap `enrichAll`→`runEnrich`), `.env`/`.env.example` (docs). Web INTOCADO.

**▶ PRÓXIMO PASSO (escolha do usuário):**
1. ✅ **FEITO — `tools: []` aplicado nos 4 workers** (você aprovou); preflight `workersToolRestricted` PASSA; modo orquestrado destravado e seguro. **242 testes + tsc + guard SPEC-01 verdes** após a edição.
2. **▶ Validar #4 AO VIVO** (assinatura): `ANKINATOR_ORCHESTRATED=1 npm run dev:server` num PDF real → ver no log `orquestrador chamada START`/`END` e se os cards saem enriquecidos; se headless `-p --agent` + Task falhar, o fallback determinístico mantém o pipeline (você vê `falhou — fallback p/ enrichAll`). Knob de debug: `ANKINATOR_ORCHESTRATED_BYPASS=1` (aviso alto no log).
3. **Validar #5 AO VIVO** (opcional): re-extrair um PDF e ver no log `PDF loader: langchain`.
4. Demais frentes não-Destino: (medir-b) custo/perf; (a) Fatia 2 reorganizador (destrutiva); (perf+) paralelizar mnemônico/classificar.

---

## ▶ ESTADO ANTERIOR — sessão o (2026-06-05)

### 🔬 VEREDITO medir-c AO VIVO (run real 2026-06-05) = **PASS** (com 1 flag *mild*) ✅

Run real: PDF `curso-230990`, CLI/assinatura, deck base "Banco de Dados", **tudo ligado**, `ANKINATOR_CRIADA_FIDELITY=livre`. Knob **confirmado no log** (`criadaFidelidade:"livre"` — o de-risco funcionou). Puxei os **63 cards do Anki** via AnkiConnect (`notesInfo`, tag `origem::criada`), li as **47 `[CRIADA]`** e cruzei os fatos suspeitos contra o **PDF-fonte** (`pdftotext`).

- **Eixo ATOMICIDADE = PASS FORTE.** Zero enunciado colado. Discriminação (#4/#5 internos×restritos; #9–#14; #41/#42 Round Robin×Least Connections) + atomização progressiva (#33–#37 quebram 2PC→fase1→fase2→problema→3PC). **Resolve o Destino #1 / UAT 2026-06-04 ("colada crua").**
- **Eixo ÂNCORA = PASS com 1 flag.** Ancorados na fonte (verificado): `8.777`(2×), `NTEXT/TEXT/VARCHAR`, `2PC/3PC/Pré-comprometimento/preparação/bloqueio`, `Round Robin/Least Connections`, `Dirty Read`, `ANSI/SPARC`. **Único vazamento = #45 "write-ahead log"** (`durabilidade` 15× mas `write-ahead`/`WAL`/`log-de-transação` **0×** na fonte) — elaboração externa **correta no mundo real, porém fora do trecho** (*mild*, não-perigosa). #44 "firmware" = distrator benigno fora do trecho. **46–47/47 limpos, ZERO alucinação perigosa.**
- **⚠️ Caveat de atribuição:** run com **cardBuilder ON** → o ganho é **knob + cardBuilder combinados**, não isolado. Falta o A/B (`estrita`) p/ atribuir ao knob.
- **Custo (não-bloqueante = medir-b):** $11,60 nocional / $0,18 card / 119 chamadas (imagem 44% + cardBuilder 27% + geração 26%). Geração **ainda thinking ON** (~11min); split **42→63 sem teto** — alavancas l/m (`ANKINATOR_GENERATION_DISABLE_THINKING`, `ANKINATOR_CARDBUILDER_MAX_SPLIT`) não usadas.

**✅ ROLLOUT APLICADO (escolha do usuário = "virar default ON + reforço anti-leak"):**
- **Default ON** — `config.ts` invertido: vazio/`livre`/`1`/`on`/`true` = livre; **escape estrito** `ANKINATOR_CRIADA_FIDELITY=estrita|estrito|strict|0|false|off|no` → `selectSystemFidelity(false)` → `SYSTEM_FIDELITY` **byte-idêntico** (guard SPEC-01 intacto).
- **Reforço anti-leak** no `SYSTEM_FIDELITY_CRIADA_LIVRE` (âncora item 2): MECANISMOS/SIGLAS-TÉCNICAS/EXEMPLOS/distratores externos proibidos **"AINDA QUE corretos no mundo real"** → fecha o leak **#45** (write-ahead log) e o **#44** (firmware). Travado por 2 asserts em `prompts.test.ts`.
- **220 testes + tsc --noEmit + guard SPEC-01 + guard-enrich verdes.**
- ⚠️ **A/B agora INVERTE:** run default = **livre**; p/ a comparação estrita use `ANKINATOR_CRIADA_FIDELITY=estrita`. (A/B p/ isolar knob×cardBuilder segue pendente, não-bloqueante.)

**▶ PRÓXIMA FRENTE (escolha do usuário, todas desbloqueadas):** (medir-b) custo/perf AO VIVO; (a) Fatia 2 do reorganizador (destrutiva — expor desenho antes); (d) runner orquestrado (Phase 5); (perf+) paralelizar mnemônico/classificar; ou o **A/B** p/ atribuição limpa do knob.

---

**Sessão (o) — medir-c DE-RISCADO (autônomo, pré-run).** O usuário escolheu a frente **medir-c** (validar a `[CRIADA]` AO VIVO). Antes de gastar um run da assinatura, verifiquei INDEPENDENTEMENTE (não confiei na sessão n) e tapei o único furo que tornaria a validação enganosa:
- ✅ **Fiação completa do knob** `ANKINATOR_CRIADA_FIDELITY`: env→`config.criadaFidelityLivre`→`api.ts:412 createProvider`→AMBOS providers→`selectSystemFidelity` (CLI L44 / API L28). Íntegra.
- ✅ **`tipo` sobrevive até o card**: `mapRawQuestoes` carimba `extraida|criada`; o split 1→N do card-builder **herda `tipo`**; `extraida` nunca divide. → A tela de revisão (`CardTable`) tem **filtro "Criadas (N)" + badge + pergunta/resposta + fonte `p.X`** = superfície de inspeção pronta. (medir-c **não precisa de Anki** — a inspeção é na revisão do app.)
- ⚠️→✅ **Furo tapado:** o `/generate` START não confirmava se o knob engatou. Adicionei `criadaFidelidade: 'livre'|'estrita'` ao log (1 linha cirúrgica em `api.ts`, padrão dos outros knobs / DEC-m). Sem isso, um env mal-digitado produziria cards colados **sem aviso** → você concluiria "FAIL: prompt ruim" quando o knob nunca ligou (run desperdiçado).
- ✅ **220 testes + tsc --noEmit + guard SPEC-01 (byte-idêntico) + guard-enrich verdes** (zero regressão; só `api.ts` tocado, spawn intacto, web não tocado).

**▶ RECEITA medir-c (refinada — isola o knob; FALTA só o seu run):**
1. `ANKINATOR_CRIADA_FIDELITY=livre npm run dev:server` (term 1) + `npm run dev:web` (term 2) → http://localhost:5173.
2. Suba `curso-230990` (ou qualquer PDF que **já é lista de questões** — força a `[CRIADA]` a CRIAR, não ecoar).
3. **Confirme que o knob engatou:** no terminal do server, no START do job, veja `criadaFidelidade: 'livre'`. Se vier `'estrita'`, o env não carregou → corrija ANTES de julgar.
4. Na **Estrutura**, selecione **1–2 blocos "LISTA DE QUESTÕES"** e **DESLIGUE todos os toggles de enrich** (classificar/cardBuilder/mnemônico/imagem). Motivo: o card-builder TAMBÉM atomiza → ligado, confundiria o teste; desligado, a `[CRIADA]` que você lê é a **geração PURA** (= efeito isolado do knob). Também fica rápido/barato.
5. Revisão → filtro **"Criadas"** → leia ~10. Use o badge `p.X` + o 👁 do bloco na Estrutura pra **cruzar a âncora** (todo número/data/nome tem de estar no trecho).
6. **PASS** = perguntas atômicas / de discriminação / de aplicação (**≠ enunciado colado**) **E** zero fato/número/data fora do trecho. **FAIL** = enunciado colado OU qualquer fato inventado.
7. **A/B (default agora é livre — INVERTIDO no rollout):** rode `ANKINATOR_CRIADA_FIDELITY=estrita npm run dev:server` (confirme `criadaFidelidade: 'estrita'`), regenere os MESMOS blocos, compare "Criadas". `livre` (default) deve ficar mais atômica/variada; **ambas** ancoradas.
8. **Ação:** PASS → me peça pra virar **default ON**; FAIL → cole a `[CRIADA]` que falhou (pergunta+resposta) + o trecho, que eu ajusto o `SYSTEM_FIDELITY_CRIADA_LIVRE`.

---

## ▶ ESTADO ANTERIOR (fim da sessão n)

**Tudo verde no CÓDIGO (estado final da sessão n, verificado por agente independente):** server `tsc --noEmit` + **220 testes FINAIS** (l→m→n: 203→214→220; +6 na sessão n em `core/prompts.test.ts`); guard SPEC-01 (spawn byte-idêntico) + guard-enrich; web `tsc -b` + `vite build`. Nada pendente em código. O que falta é só **validação AO VIVO** do knob da sessão n (ver "Falta AO VIVO" abaixo) — o código não regrediu (default OFF = byte-idêntico), só não foi exercitado com o env ligado.

**Frente (c) Qualidade `[CRIADA]` ENTREGUE nesta sessão** (escolhida pelo usuário): fidelidade DIFERENCIADA por tipo, opt-in, default byte-idêntico. Ver "Entregue (sessão n)" abaixo. **Falta só medir AO VIVO** (a [CRIADA] vira questão de verdade SEM alucinar — teste mockado não conta, é o eixo que só o run real fecha).

**Desenho exposto antes de codar (lição DEC-m aplicada):** apresentei ao usuário (1) o NÍVEL de afrouxamento — escolhido **Moderado** (discriminação/aplicação por inferência direta, âncora dura mantida) sobre Conservador; (2) o ROLLOUT — escolhido **knob opt-in default-OFF** (padrão do projeto, reversível p/ o risco crítico) sobre "novo default direto". Rejeitada a alternativa "duas chamadas separadas" (dobraria custo da geração).

**Frente (b) Custo/perf ENTREGUE nesta sessão** (imagem seletiva + teto no split do cardBuilder — ambos opt-in, default byte-idêntico). Ver "Entregue (sessão m)" abaixo. **Falta só medir AO VIVO** (não-bloqueante).

**Decisão formal DEC-m (2026-06-05):** manter o env knob `ANKINATOR_IMAGE_SKIP_TECNICAS` (não enxugar). Modo RÁPIDO (reversível, baixo impacto, autoridade delegada). Justificativa: (P1) o usuário mede e re-sintoniza knobs — qual técnica é "verbal" é o parâmetro a tunar após medir; (P2) consistência com os ~10 env-knobs de custo já existentes > economia de ~7 linhas (Karpathy #3 "match existing style" pesa mais que #2 aqui, pois remover criaria assimetria); (P3) reversibilidade assimétrica — manter-e-errar é trivial/invisível (env vazio = idêntico), remover-e-errar gera re-trabalho. **Gatilho de revisão:** só inverter se o usuário pedir minimalismo agressivo contra o padrão, ou se abandonarmos o padrão de env-knobs. → **Nenhuma mudança de código necessária; a implementação da sessão m já é a opção recomendada.**

**Lição de processo (feedback do usuário, sessão m):** apresentar as opções de DESENHO antes de codar quando há mais de uma interpretação razoável (ex.: denylist vs allowlist; "técnica desconhecida → mantém imagem"). O ponto fraco não foi o knob, foi escolher o desenho sem expor o tradeoff antes (Karpathy #1).

### 🔬 VALIDAÇÃO AO VIVO 2026-06-05 — RUN COMPLETO no Anki ✅ (fecha pendências g–k)
PDF `curso-230990` (86 pág), provedor CLI/assinatura, deck base "Banco de Dados", **tudo ligado** no 2º job. **0 erros em tudo.**
- **Seletor de deck (k)** ✅ — 2º envio usou o picker p/ selecionar o deck EXISTENTE "Banco de Dados" (1º foi default "Ankinator").
- **Organizador de decks Fatia 1** ✅ — múltiplas rodadas: 07:03 merge 106 cards→"Banco de Dados" + 26 decks apagados + 26 notas "duplicata"; 12:16 merge 44 cards + 36 decks apagados + 30 notas "duplicata". **0 erros.** Prévia→aplicar, subdecks preservados, dedup não-destrutivo — TUDO confirmado ao vivo.
- **Gate de qualidade de imagem** ✅ — 3 SVGs reprovados ao vivo (rótulos sobrepostos / >14 rótulos) → todos recuperados no retry guiado → `imagens 48/48, 0 reprovadas`. Lixo do print original NÃO chega mais ao Anki.
- **Geração incremental** ✅ — leu 114→158 questões do deck base; gerou só novas (45, depois 41).
- **Pipeline completo** ✅ — 58 cards (todos os estágios) → Anki.
- **Observações (perf/custo, não-bloqueantes):** job completo $10,68 NOCIONAL (assinatura cobre; só referência de volume), $0,18/card, 111 chamadas, 2,2M cache-read. Quebra de custo: imagem 42% + cardBuilder 28% + geração 26%. **Geração ainda com thinking LIGADO** (disableThinking:false) ~10min. cardBuilder dobrou 41→58 (split sem teto) → mais imagens. Mnemônico 48/58.

**▶ Fatia 2 do reorganizador AGORA DESBLOQUEADA** (Fatia 1 validada ao vivo = condição satisfeita). Decisão de próximo passo pendente do usuário (ver pergunta).

**Entregue (sessão n) — Frente (c) Qualidade `[CRIADA]` (escolhida pelo usuário):** fidelidade DIFERENCIADA por tipo na geração, opt-in, **default byte-idêntico**. **220 testes (214→+6) + tsc --noEmit + guard SPEC-01 (spawn byte-idêntico) + guard-enrich verdes.**
- **Problema (Destino #1 + UAT 2026-06-04):** `[EXTRAÍDA]` e `[CRIADA]` são geradas na MESMA chamada sob um único `SYSTEM_FIDELITY` cujas "Regras invioláveis" (não interprete/expanda/exemplifique; resposta *diretamente verificável*; terminologia *exata*) prendem as DUAS → a `[CRIADA]` saía quase colada ("questão inútil crua" reprovada no UAT).
- **Solução (1 chamada, contratos por tipo):** nova `SYSTEM_FIDELITY_CRIADA_LIVRE` em `prompts.ts` — `[EXTRAÍDA]` mantém FIDELIDADE TOTAL (terminologia exata, todas as alternativas); `[CRIADA]` afrouxa (reformular/atomizar/discriminar/aplicar por inferência DIRETA, NÃO colar o enunciado); **ÂNCORA DURA p/ AMBAS** (zero conhecimento externo; números/datas/nomes/gabaritos só do trecho — o risco crítico do projeto). Seletor puro `selectSystemFidelity(criadaFidelityLivre)` → default `false` devolve `SYSTEM_FIDELITY` **byte-idêntico** (guard SPEC-01 intacto, `SYSTEM_FIDELITY` NÃO foi tocado).
- **Knob:** `config.criadaFidelityLivre` (env `ANKINATOR_CRIADA_FIDELITY=livre|1|true|on`, **default OFF**) threadado igual ao precedente `cliDisableThinking`: `config` → `api.ts` `createProvider({...})` → `ProviderConfig.criadaFidelityLivre` → construtor de **AMBOS** os providers (CLI real + API; o system prompt vale p/ os dois). Arquivos: `core/prompts.ts` (+`core/prompts.test.ts`, 6 testes), `config.ts`, `core/providers/index.ts`, `core/providers/cli-provider.ts`, `core/providers/api-provider.ts`, `api.ts`. Server-only (sem mudança de UI/web — env knob, igual aos knobs de custo).
- ⏳ **Falta AO VIVO — receita com PASS/FAIL** (assinatura+Anki, **não-bloqueante**): (1) `ANKINATOR_CRIADA_FIDELITY=livre npm run dev:server` + `npm run dev:web`; (2) subir o **mesmo PDF da validação anterior** (`curso-230990`) — de preferência um que já é lista de questões, p/ ver a `[CRIADA]` CRIAR em vez de ecoar; (3) inspecionar ~10 cards `[CRIADA]`. **PASS** = perguntas atômicas/de discriminação/aplicação (≠ enunciado colado) **E** zero fatos/números/datas fora do trecho (âncora segurou). **FAIL** = enunciado colado OU qualquer fato inventado. (4) **AÇÃO:** PASS → propor virar default ON; FAIL → desligar o env e registrar QUAL `[CRIADA]` falhou p/ ajustar o prompt. A/B: rodar o mesmo PDF SEM o env (default) e comparar. (Nota: o knob em si ainda NÃO foi exercitado AO VIVO — o código está verde, mas o run real com env ON é o que falta.)

**Entregue (sessão m) — Frente (b) Custo/perf (escolhida pelo usuário):** duas alavancas determinísticas, opt-in, **default byte-idêntico** (padrão do projeto). **214 testes (203→+11) + tsc + guard SPEC-01 (spawn byte-idêntico, MAX_THINKING_TOKENS ausente por default) + guard-enrich + web tsc/vite verdes.**
- **Imagem seletiva** — hoje o estágio 4 gera SVG p/ TODO card com `q.mnemonico` (gate D-04); como o mnemônico foi liberalizado p/ a maioria, quase todo card ganhava SVG (= **42% do custo** do run). O especialista de mnemônico já retornava `tecnica` (acrônimo|história|loci|rima) mas era **descartado** → agora capturado em `Questao.mnemonicoTecnica` (server+web, SPEC-05, mesmo commit). Novo `imageSelective` (env `ANKINATOR_IMAGE_SELECTIVE`, **default OFF**): quando LIGADO, pula a imagem p/ mnemônicos puramente VERBAIS (denylist `imageSkipTecnicas`, default `história,rima`, via `ANKINATOR_IMAGE_SKIP_TECNICAS`; comparação acento/caixa-insensível) e MANTÉM os visuais (loci/acrônimo) e técnica desconhecida/ausente (**lado seguro: na dúvida, mantém**). Log do START mostra quantos pulados. Default OFF = alvos idênticos ao legado.
- **Teto no split do cardBuilder** — 'criada' dividia 1→N sem teto (run ao vivo 41→58 cards → cascata de custo em mnemônico/imagem por-card). Novo `cardBuilderMaxSplit` (env `ANKINATOR_CARDBUILDER_MAX_SPLIT`, **default 0 = ilimitado/byte-idêntico**): >0 trunca o split ('criada' nunca vira mais que N; extraída intacta, D-10) e loga `N split(s) truncado(s)`.
- Fiação: `config.ts` → `api.ts` (env vazia de skip-técnicas → `undefined` p/ o default valer) → `EnrichOpts` em `enrich.ts`. Arquivos: `core/types.ts`, `web/src/types.ts`, `core/specialists/enrich.ts`, `core/specialists/enrich.test.ts`, `config.ts`, `api.ts`.
- ⏳ **Falta AO VIVO** (assinatura+Anki): ligar `ANKINATOR_IMAGE_SELECTIVE=1` num run real e medir a queda de chamadas/custo de imagem (esperado: pula histórias/rimas); e `ANKINATOR_CARDBUILDER_MAX_SPLIT=N` p/ confirmar que a explosão de cards é contida. Medir custo/estágio antes de adotar como default.

**Entregue (sessão l):**
- **Knob de perf: thinking OFF na geração (opt-in).** A validação ao vivo mostrou a geração com extended thinking LIGADO (~10min/26% do custo), enquanto os 4 especialistas de enrich já desligam. Novo `config.generationDisableThinking` (env `ANKINATOR_GENERATION_DISABLE_THINKING=1|true|on`, **default OFF**) → threadado `ProviderConfig.cliDisableThinking` → `CliProvider(model, disableThinking)` → `runClaudeCli({disableThinking})` (injeta `MAX_THINKING_TOKENS=0` no env, mesmo mecanismo do RT-imagem). **Default OFF = spawn byte-idêntico** (guard SPEC-01 verde, `MAX_THINKING_TOKENS ausente por default`). Liga p/ cortar tempo/custo da geração, com possível custo de qualidade (medir antes de adotar). Arquivos: `config.ts`, `core/providers/index.ts`, `core/providers/cli-provider.ts`, `api.ts`. **203 testes + tsc --noEmit + guard SPEC-01 verdes.**

**Entregue (sessão k):**
- **Seletor de deck na barra "Enviar ao Anki"** (`web/src/components/ExportBar.tsx`) — pedido do usuário (print): antes o campo de deck só tinha `<datalist>` (autocomplete oculto). Agora há um **botão 📚 (IconLayers)** que abre um **dropdown filtrável e rolável** com os decks existentes consultados ao Anki (`api.ankiDecks` → AnkiConnect `deckNames`, **mesma fonte do DeckOrganizer/DeckBasePicker**), com a seleção atual marcada (✓) e fechamento ao clicar fora. O input livre + datalist seguem (criar deck novo). Botão desabilita se Anki offline / sem decks. tsc -b + vite build verdes. ✅ **VALIDADO ao vivo 2026-06-05** (envio p/ deck existente "Banco de Dados" via picker).

**Entregue (sessões g–j):**
- **Gate de qualidade de imagem** (`server/src/core/specialists/svg-quality.ts`): barra SVG-lixo (texto sobreposto / fonte estourando o viewBox) no estágio 4, com **retry guiado + descarte** (fail-closed p/ "sem imagem"); prompt `mnemonic-image` endurecido. Simplificação Karpathy aplicada (param morto `thr` removido). ✅ **VALIDADO ao vivo 2026-06-05** (3 reprovações reais recuperadas no retry → 48/48, 0 reprovadas).
- **Reorganizador de decks — FATIA 1 COMPLETA (server + UI):** unir decks (**merge**, move só cards diretos → preserva subdecks) + **achar repetidos** (marca tag `duplicata`, NÃO-destrutivo), fluxo **prévia→aplicar**. Auditado por **revisão adversarial multi-agente** → 5 bugs de segurança corrigidos + testes de regressão (`deck-organizer.apply.test.ts`). UI = modal **"Organizar decks"** no header. ✅ **VALIDADO ao vivo 2026-06-05** (merge + dedup, múltiplas rodadas, 0 erros).

**▶ PRÓXIMAS AÇÕES (nesta ordem):**
1. ✅ **[FEITO ao vivo 2026-06-05] Gate de imagem validado** — 3 SVGs reprovados no run real, recuperados no retry → 48/48, 0 reprovadas. Lixo não chega mais ao Anki.
2. ✅ **[FEITO ao vivo 2026-06-05] Reorganizador validado** — merge + dedup em múltiplas rodadas, 0 erros (106+44 cards movidos, 62 decks apagados, 56 notas marcadas "duplicata"). Seletor de deck (k) também exercitado (envio p/ "Banco de Dados").
3. ✅ **[FEITO sessão m] Frente (b) Custo/perf** — imagem seletiva por técnica + teto no split do cardBuilder (opt-in, default byte-idêntico). Decisão DEC-m formalizada (manter env knob). Falta só medir AO VIVO o ganho (não-bloqueante).
4. **▶ AGUARDANDO DIREÇÃO DO USUÁRIO — escolher a próxima frente (todas desbloqueadas):**
   - **(medir-c) ⭐ Validar qualidade `[CRIADA]` AO VIVO (recomendado p/ fechar a sessão n):** `ANKINATOR_CRIADA_FIDELITY=livre` num PDF real — receita PASS/FAIL completa no bloco "Entregue (sessão n)" acima. Não-destrutivo; decide se vira default.
   - **(medir b) Validar custo/perf AO VIVO:** rodar com `ANKINATOR_IMAGE_SELECTIVE=1` e `ANKINATOR_CARDBUILDER_MAX_SPLIT=N` num PDF real e comparar o resumo de custo/estágio (esperado: menos chamadas de imagem; split contido). Decidir se viram default.
   - **(a) FATIA 2 do reorganizador:** re-hierarquizar (Matéria::Assunto::Subtópico via classificador) + padronizar tags. Desbloqueada (Fatia 1 validada ao vivo). **Destrutiva** → confirmar antes de construir (modo de falha histórico = código destrutivo não-validado). **Lição DEC-m: expor o desenho antes de codar.**
   - ✅ **[FEITO sessão n] (c) Phase 7 — qualidade `[CRIADA]`:** fidelidade diferenciada por tipo via knob opt-in `ANKINATOR_CRIADA_FIDELITY=livre` (default OFF = byte-idêntico). `[CRIADA]` afrouxada (atomizar/discriminar/aplicar por inferência direta), `[EXTRAÍDA]` estrita, âncora dura p/ ambas. Falta medir AO VIVO (melhora sem alucinar).
   - **(d) Runner ORQUESTRADO (Phase 5):** wire do `ankinator-orchestrator` (claude da raiz + Task), gated por env, com fallback determinístico. Incerteza: claude headless `-p` + subagents.
   - **(perf+) Outras alavancas de custo:** paralelizar mnemônico/classificar (hoje chamadas únicas grandes), subir concorrência da imagem.

**Como rodar:** 2 terminais em `ankinator-app/` → `npm run dev:server` (8787) e `npm run dev:web` (5173) → navegador em http://localhost:5173.

---

## ✅ Rodada 2026-06-04 (g) — Gestor de qualidade de imagem (SVG-lixo barrado) · falta só validação VISUAL

> **Gatilho (print do usuário):** o estágio imagem gerou um SVG ILEGÍVEL — várias camadas de
> texto sobrepostas ("público vê", "dados abertos") + "DADOS" gigante estourando a moldura. Esse
> lixo passava porque a ÚNICA validação do SVG era de SEGURANÇA (`sanitizarSvg`: allowlist de
> tags/atributos + bloqueio de `url()`); **não havia nenhuma checagem de qualidade VISUAL**. O
> modelo, que não enxerga o que desenha, empilha texto às cegas.

- [x] **QUAL-IMG-1 — Gestor de qualidade do SVG (render-free, zero custo LLM).** ✅ 2026-06-04
  Novo módulo PURO `core/specialists/svg-quality.ts` (`avaliarQualidadeSvg(svg) → {ok, motivos[], metrics}`).
  Heurísticas determinísticas (parsing de atributos, SEM rasterizar) que mapeiam o modo de falha real:
  (1) **nuvem de palavras** (nº de `<text>` > 14); (2) **frases empilhadas** (total de chars > 240);
  (3) **fonte estourando** (font-size > 30% da altura do viewBox); (4) **texto fora da moldura**
  (box estimado escapa o viewBox); (5) **rótulos sobrepostos** (interseção de boxes estimados — núcleo
  do bug mostrado). Limiares generosos (`DEFAULT_SVG_QUALITY`) p/ não reprovar imagens iconográficas
  legítimas. Os `motivos` (PT) servem DUPLO: log + feedback do retry.
  **Integração no estágio 4 (`enrich.ts`):** gerar → sanitizar (segurança) → **avaliar qualidade** →
  reprovou? **re-gera 1× com os motivos injetados no prompt** (`ImageProvider.generate(mnem, ctx, feedback?)`)
  → reprovou de novo? **descarta a imagem** (card mantém o mnemônico em TEXTO — fail-closed para "sem
  imagem", NUNCA "imagem-lixo"). Knobs em `config.ts`: `ANKINATOR_IMAGE_QUALITY` (default ON; `off`
  = legado) e `ANKINATOR_IMAGE_MAX_RETRY` (default 1; 0 = sem retry). Threadado por `EnrichOpts` → `api.ts`.
  **Endurecimento na fonte:** `prompts/mnemonic-image.md` + espelho `.claude/agents/ankinator-image.md`
  ganharam "Controle de qualidade (REGRAS DURAS)" — ≤6 rótulos, sem frases, font-size ≤ H/6, sem
  sobreposição, tudo dentro da moldura, desenho carrega o significado (reduz a taxa de reprovação).
  **185 testes** (+9: 9 em `svg-quality.test.ts` + 4 de integração retry/descarte/qualidade-off em
  `enrich.test.ts`) + tsc --noEmit + guard SPEC-01 (mnemonic-image 2036→3098c, aceito) + PIPE-03 verdes.
  ⏳ Falta VISUAL AO VIVO: re-rodar com imagem ON e confirmar no Anki que (a) não chega mais SVG-lixo;
  (b) os logs mostram `reprovada(s) na qualidade` quando barra; (c) cards bons mantêm a imagem.

- [~] **ORG-DECK — Organizador de decks do Anki (Parte B). FATIA 1 (merge+repetidos, SERVER) ✅ 2026-06-04.**
  **Fatia 1 entregue (server, determinística, sem IA):** `core/deck-organizer.ts` (puro `groupDuplicates` via Jaccard + `planMerge` + orquestração `previewOrganize`/`applyOrganize` em 2 FASES prévia→aplicar, isolamento de erro por-op; re-lê card ids no apply; só apaga deck após confirmar vazio); ops AnkiConnect novas em `exporters/ankiconnect.ts` (`notesDoDeck`/`cardIdsDoDeck`/`moverCards`/`apagarDecks`/`adicionarTags`); rotas `POST /deck/organize/preview` (read-only) + `/deck/organize/apply`. Dedup NÃO-destrutivo (marca tag `duplicata` — escolha do usuário). 195 testes + tsc verdes. **Endurecida (revisão adversarial multi-agente, 2026-06-05):** 5 achados de segurança corrigidos + travados por testes (`deck-organizer.apply.test.ts`, AnkiConnect mockado) — colapso por noteId (decks sobrepostos não auto-marcam nota única), merge preserva subdecks (`cardIdsDiretosDoDeck`, move só cards diretos), validação de shape do plano (400 ≠ 502), apply NUNCA apaga o target (re-deriva de plan.decks), erro explícito p/ flag sem seção, clamp do dedupThreshold. **203 testes verdes.** **UI ✅** (modal "Organizar decks" no header → configurar (decks + dedup/merge) → PRÉVIA/diff (revela cards movidos, decks a apagar, subdecks PRESERVADOS) → aplicar (com erros parciais); `web/src/components/DeckOrganizer.tsx` + `api.organizePreview/organizeApply` + tipos espelho; tsc -b + vite build verdes). **FALTA só a FATIA 2** (re-hierarquizar + padronizar tags via classificador/IA) e a **validação AO VIVO** no Anki real (usuário).
  Reorganiza o deck EXISTENTE do usuário (não só o que o app gera). 4 escopos confirmados:
  (1) **re-hierarquizar** (Matéria::Assunto::Subtópico via o classificador existente); (2) **dedupe + mesclar**
  (quase-duplicatas entre decks, reusar Jaccard do INCR-1/`existing-deck.ts`); (3) **mover cards do Ankinator**
  (rotear ao subdeck certo, não jogar tudo em "Ankinator"); (4) **padronizar tags**. Gap a construir no
  AnkiConnect (`exporters/ankiconnect.ts`): `changeDeck`, `deleteDecks`, renomear deck, `addTags`/`removeTags`/
  `replaceTags`, `findNotes`+`notesInfo` para dedupe. **Pré-requisito de segurança:** operações DESTRUTIVAS
  (mover/apagar/mesclar) no deck real do usuário exigem PRÉVIA + confirmação (dry-run → diff → aplicar).
  Fazer DEPOIS da validação visual do gate de imagem.

---

## ✅ Rodada 2026-06-04 (f) — Custo de tokens nos logs + Deck incremental · falta só validação AO VIVO

- [x] **COST-1 — Custo de tokens por estágio nos logs.** ✅ 2026-06-04
  O envelope do `claude -p --output-format json` JÁ traz `usage` (in/out/cache tokens) + `total_cost_usd` + `duration_api_ms` no MESMO JSON de onde extraíamos `result` → capturar é de graça (zero chamadas extras). Novo `server/src/core/usage.ts` (acumulador bucketizado por estágio: snapshot→diff isola 1 job). `runner.ts` captura/loga tokens+custo por chamada e aceita `stage?` (NÃO entra em `buildSpawnArgs` → guard SPEC-01 intacto). 5 call-sites rotulados: `geracao`/`classificar`/`cardBuilder`/`mnemonico`/`imagem`. `api.ts` `/generate` loga ao fim do job o **resumo de custo/tokens com quebra por estágio** (+ `custoPorCard` + `%` por estágio). Degrada gracioso se o CLI não retornar `usage`. **Agora dá pra equilibrar custo × tempo × qualidade** (lado a lado com o perfil de TEMPO do logger). tsc + SPEC-01 + 154 testes verdes.

- [x] **INCR-1 — Geração incremental contra um deck base (opcional).** ✅ 2026-06-04
  Aceita um deck existente além do PDF para adicionar SÓ o que falta (sem extrapolar o PDF) e responde **"deck já completo"** quando o material está todo coberto. **Fontes (ambas):** AnkiConnect ao vivo (`findNotes`+`notesInfo`, inclui subdecks) E upload de arquivo `.txt/.csv/.apkg` (parser plain-text puro; `.apkg` via `unzip`+`node:sqlite`, com zstd p/ `.anki21b`). **Anti-duplicata em 2 camadas:** (1) semântica — fronts existentes injetados no `buildUserMessage` ("não repita; gere só o que falta; vazio se coberto", cap 200/bloco); (2) mecânica — `partitionNovas` (igualdade normalizada + Jaccard ≥ 0.82) ANTES do enrich (enriquece só as novas = mais barato). `deckCompleto = 0 novas`. **Opcional:** sem deck → fluxo byte-idêntico ao de hoje (PIPE-03 preservado). Arquivos: `core/existing-deck.ts` (novo, +14 testes), `exporters/ankiconnect.ts` (notesInfoDoDeck), `prompts.ts`, `types.ts`, `store.ts` (deckFileStore + IncrementalInfo), `api.ts` (`/deck/upload`, `/deck/preview`, `/generate` estendido). **UI:** `components/DeckBasePicker.tsx` (novo — modo Anki/arquivo + prévia "N questões já no deck") na tela "Estrutura"; banner de resultado incremental / "deck completo" na revisão. **168 testes + tsc + vite build verdes.**
  ⏳ Falta AO VIVO (assinatura + Anki aberto): rodar um PDF já estudado contra o próprio deck e confirmar (a) que só entram questões novas, (b) o "deck completo" quando nada falta, (c) ler um `.apkg` real.

- **Addon AnkiWeb 2036732292 (avaliado):** é o **Anki Connect Plus**, *soft fork* do AnkiConnect que mantém 100% da API (mesmas actions, version 6) + extras de sync; compatível com Anki ≥ 23.10.1. O Ankinator só usa actions padrão (`findNotes`/`notesInfo`/`deckNames`/`addNotes`) → **drop-in compatível com ambos; não precisa trocar.** Mantido o AnkiConnect padrão (2055492159).

---

## ✅ UI — tela "Estrutura" — CONCLUÍDA (2026-06-04) · falta só validação VISUAL do usuário

Arquivos: `ankinator-app/web/src/components/StructurePanel.tsx` + `ankinator-app/web/src/App.tsx`.

- [x] **UI-1 — Rolagem horizontal (layout "muito ruim").** ✅ 2026-06-04
  Causa raiz: em `StructurePanel.tsx`, o grid `lg:grid-cols-[1fr_320px]` tem o item da esquerda **sem `min-w-0`**, e o `<p>` do nome do arquivo **sem `break-words`**. O filename longo não quebra → estoura a coluna `1fr` → scroll horizontal.
  Fix aplicado: `min-w-0` no item esquerdo do grid + `min-w-0`/`gap-3` no flex do header + `break-words` no `<p>` do filename. tsc -b verde. (Validação visual final com o usuário nos 2 terminais.)

- [x] **UI-2 — Botões "Selecionar tudo" e "Desmarcar tudo".** ✅ 2026-06-04
  Antes `StructurePanel.tsx` era **um toggle** ("Selecionar tudo" ↔ "Limpar"), e "Limpar" só aparecia com TUDO selecionado.
  Fix aplicado: dois botões explícitos sempre visíveis — **"Selecionar tudo"** (`onSelectAll(true)`, desabilitado quando tudo já está marcado) e **"Desmarcar tudo"** (`onSelectAll(false)`, desabilitado quando nada está marcado), agrupados em `flex shrink-0 gap-2`.

- [x] **UI-3 — Erros de escrita.** ✅ 2026-06-04
  Revisão ortográfica de todos os `*.tsx` feita. Corrigidos 2 bugs OBJETIVOS de pluralização: (a) `StructurePanel` CTA renderizava "5 seçãoões" → agora "5 seções"; (b) `CardTable` "1 selecionadas" → "1 selecionada". Falsos positivos descartados (verificação adversarial): "cards" e "duplicatas" estão corretos no contexto. Demais textos sem erro de pt-BR.

- [x] **UI-4 — Polir o layout geral** ✅ 2026-06-04 (objetivos + riqueza Ankimon)
  Correções objetivas: responsividade/overflow (header, Stepper, badges CardTable, input ExportBar, banner de erro), contraste WCAG (slate-400→500), padding responsivo, ARIA (progressbar, role alert/status, foco teclado na dropzone).
  Riqueza Ankimon: ícones SVG inline (`components/icons.tsx`, zero dep), cabeçalhos de seção com acento, "Modo educativo" como cartões-toggle (ícone + descrição), badge de status do Anki, estado de conclusão na barra de progresso, spinners, sombras/seccionamento. `tsc -b` + `vite build` verdes. Validação visual final com o usuário.

---

## 🔬 Validação AO VIVO 2026-06-04 ~21:00 — RUN COMPLETO no Anki ✅ (e gargalos expostos pelo logging)

PDF real `curso-230990` (86 pág., 147.050 chars), provedor CLI (assinatura), **tudo ligado** (classificar + cardBuilder + mnemônico + imagem). **100 cards chegaram no Anki, 0 erros.**

**Validações confirmadas AO VIVO:**
- **CHUNK-1 (agrupamento hierárquico):** `buildSections: 110 → groupSections: 11 blocos (0 sinalizados)`. A fratura foi resolvida em PDF real — seções coerentes ("ESTRATÉGIA FLASHCARDS" 24k, "QUESTÕES COMENTADAS" 40k, "LISTA DE QUESTÕES" 20k…). Extração 4,4s.
- **CHUNK-3 (overlap):** 1 seção (24k) → 3 chunks (11218/11922/918), overlap 400, 2 chunks com `contextoAnterior`.
- **PERF-2 (card-builder paralelo):** pool=3 (3 chamadas simultâneas visíveis), 45→100 cards (split 1→N de 'criada'), 0 falhas, **118s (~2min)** — antes seria ~6min sequencial. Funde cientista-aprendizagem (systemChars 5452).
- **Estágio imagem paralelo:** 99/99 SVGs, 0 falhas, pool=3.
- **OBS-1 (logging):** abriu a caixa-preta de tempo por chamada `claude` (ver gargalos abaixo).
- **Export:** 100 → Anki, 0 ignoradas, 1,3s.

**⏱️ Perfil de tempo do job (total ~21,7 min para 100 cards):**
| Etapa | Tempo | Nota |
|---|---|---|
| Geração (3 blocos, 45 q) | ~3min08s | ⚠ **thinking ON** (disableThinking:false) → 67–91s/bloco |
| Classificar | 68s | 1 chamada (45 cards) |
| Card-builder (pool 3) | ~2min | 45→100 cards |
| Mnemônico (batch único) | **~3min** | 1 chamada com 100 cards (não paraleliza) |
| **Imagem (pool 3)** | **~12,5min** | 🔴 **GARGALO: ~57% do tempo total** |

**🎯 Oportunidades de melhoria (próxima rodada — escolher):**
1. **Imagem é o gargalo dominante (12,5min/57%).** Mesmo com pool=3. Opções: subir `ANKINATOR_IMAGE_CONCURRENCY`; tornar imagem **seletiva** (só cards de memorização, via orquestrador — Phase 5); ou off por padrão.
2. **Geração com thinking ON** (67–91s/bloco). O fix RT-imagem desligou thinking só nos 4 especialistas de enrich, **não** no `CliProvider` de geração. Avaliar `disableThinking` na geração (risco: qualidade).
3. **Mnemônico = 3min numa única chamada** (100 cards). Não paraleliza; avaliar split em lotes paralelos. Classificar idem (68s).
4. **Card-builder dobrou 45→100 cards** (split de 'criada'). Mais cards = mais imagens = mais tempo. Verificar se a explosão é desejada ou se precisa de teto.

---

## ✅ Rodada 2026-06-04 (d) — Logging verboso + dark mode + card-builder paralelo + cientista da aprendizagem

- [x] **OBS-1 — Logging verboso do server.** ✅ 2026-06-04 (workflow, 1 agente)
  Novo `server/src/logger.ts` (`log.{debug,info,warn,error}` + `timer()` com `process.hrtime.bigint()`; `ANKINATOR_LOG_LEVEL` default `debug`; cores ANSI com degrade). Instrumentado: `api.ts` (rotas + /extract loga loader/páginas/seções/avisos + /generate plano de chunks/total), `generation.ts` (START/END por bloco), `enrich.ts` (START/END + contagens por estágio), **`runner.ts` (cada chamada `claude`: model, systemChars, userChars, outChars, ms — abre a caixa-preta de TEMPO)**, `chunker.ts` (plano), `odl-parse.ts` (buildSections N→groupSections M, K sinalizados).

- [x] **UI-7 — Tema claro/escuro (Tailwind v4).** ✅ 2026-06-04 (workflow, 7 agentes paralelos)
  `@custom-variant dark` no `index.css` (acionado por `.dark` no `<html>`); script anti-flash em `index.html`; `ThemeToggle.tsx` (persiste em localStorage, default = preferência do SO) montado no header; variantes `dark:` ADITIVAS nos 7 componentes (App, Stepper, FileDrop, ProgressPanel, ExportBar, CardTable, StructurePanel) via mapeamento compartilhado. tsc -b + vite build verdes. ⏳ Falta conferência VISUAL do usuário (alternar o toggle).

- [x] **PERF-2 — Card-builder em paralelo.** ✅ 2026-06-04
  ESTÁGIO 2 do `enrichAll` (1 chamada `claude`/card) era sequencial → agora pool `runPool` com ordem preservada (saída indexada; split 1→N de 'criada' mantém posição), isolamento de erro por-card (D-13). `ANKINATOR_CARDBUILDER_CONCURRENCY` (default 3) via config→api→`EnrichOpts.cardBuilderConcurrency`. +3 testes (paralelismo, ordem com split, isolamento).

- [x] **AGENT-2 — Especialista "Cientista da Aprendizagem" (fundir + standalone).** ✅ 2026-06-04
  Canônico novo `prompts/learning-scientist.md` (princípios baseados em evidência — recuperação ativa, atomicidade, dificuldade desejável, discriminação, elaboração — fundamentado em **Make It Stick** [Roediger/McDaniel/Brown], **How We Learn** [Carey], Willingham, Bjork, meta-análise Dunlosky et al. 2013, Woźniak). **Fundido** ao prompt do card-builder no estágio 2 (`systemPrompt = card-builder + learning-scientist`) — SEM chamada LLM extra. **Standalone**: `.claude/agents/ankinator-learning-scientist.md` + `.claude/skills/learning-scientist/SKILL.md`. Allowlist do prompt-loader estendida (6 nomes). **154 testes + tsc + vite build verdes.**

---

## ✅ Rodada 2026-06-04 (c) — Chunking: agrupamento hierárquico + revisor + overlap · falta só validação AO VIVO

> Causa-raiz provada (print do usuário): o OpenDataLoader marca rótulos de lista em negrito ("• Dados numéricos:") como **headings nível 6**; o `buildSections` abria uma seção a CADA heading → uma seção coerente ("1.4 Formatos de dados digitais") fraturava em 6 blocos minúsculos e isolados. Confirmado no markdown (`###### • Dados numéricos:`). Overlap era ZERO; não havia revisor.

- [x] **CHUNK-1 — Agrupamento HIERÁRQUICO por nível.** ✅ 2026-06-04
  Novo módulo PURO compartilhado `server/src/core/section-grouping.ts` (`regroupSections`): só headings rasos (nível ≤ boundary; default 3, **adaptativo** = `max(3, nível mais raso)` p/ docs só-profundos não viram 1 blocão) abrem bloco; sub-headings profundos dobram como CONTEÚDO do pai (rótulo rebaixado `######`→`**negrito**`). Aplicado nos DOIS loaders (`odl-parse.parseOdlOutput` e `langchain-normalize.normalize`) — como cada `Section` já tem `level`, é pós-processador sobre `Section[]` (DRY).

- [x] **CHUNK-2 — Revisor determinístico (zero quota).** ✅ 2026-06-04
  `reviewSections`: (1) FUNDE órfãos quase-vazios (corpo < 40 chars, ex.: bloco só-título) no vizinho; (2) SINALIZA via `Section.aviso` os blocos curtos sobreviventes (corpo < 140) — o usuário decide, não funde à força. `aviso` propaga p/ `SectionInfo` e aparece como badge ⚠ na tela "Estrutura".

- [x] **CHUNK-3 — Sobreposição (overlap) entre blocos.** ✅ 2026-06-04
  `chunker.ts`: `overlapChars` (env `ANKINATOR_CHUNK_OVERLAP`, default 400) anexa a cauda do bloco anterior como `SemanticChunk.contextoAnterior`. Entregue ao modelo via `buildUserMessage` num bloco **"CONTEXTO — NÃO gere questões daqui"** (anti-duplicata entre blocos vizinhos). Não entra no orçamento de empacotamento.
  Arquivos: `section-grouping.ts` (novo), `chunker.ts`, `prompts.ts`, `providers/{cli,api}-provider.ts`, `config.ts`, `api.ts`, `types.ts` (+`Section.aviso`/`SemanticChunk.contextoAnterior`), `web/src/types.ts`, `web/src/components/StructurePanel.tsx` (badge ⚠), `section-grouping.test.ts` (13 testes). **151 testes src + tsc + vite build verdes.**
  ⏳ Falta AO VIVO: re-extrair o PDF e ver na tela "Estrutura" que "1.4" virou 1 bloco coerente; e conferir que o overlap não gera questões duplicadas entre blocos.
  Nota: o vitest contava em dobro quando havia `dist/` (rodava `src` + `dist` compilado) — número real = 7 arquivos / 151 testes (limpar `dist/` antes de medir).

---

## ✅ Rodada 2026-06-04 (b) — UX da Estrutura + paralelismo do estágio imagem · falta só validação AO VIVO

- [x] **UX-5 — Prévia por bloco selecionado (tela "Estrutura").** ✅ 2026-06-04
  Antes: a tela só mostrava `extract.markdownPreview` = `doc.markdown.slice(0,4000)` = sempre o INÍCIO do doc (≈ "primeiro bloco"), dificultando conferir a extração bloco a bloco (ex.: alternativas A–E após o fix RT-fidelidade).
  Fix: cada seção ganhou um botão de prévia (👁 `IconEye`); clicar abre um painel com o **markdown completo daquele bloco** (título, faixa de páginas, nº de caracteres). O servidor passou a enviar `markdown` por seção no `/extract` (o doc já está em cache em memória — `documentStore`). `markdownPreview` foi mantido no contrato (não removido). Arquivos: `server/src/api.ts` (+`SectionInfo.markdown`), `web/src/types.ts`, `web/src/components/{icons,StructurePanel}.tsx`. tsc -b + vite build verdes.

- [x] **UX-6 — Paralelizar o estágio imagem (gargalo ~80% do tempo).** ✅ 2026-06-04
  Antes: ESTÁGIO 4 do `enrichAll` era um `for` sequencial (~25s/card via CLI → 17 cards ≈ 7 min).
  Fix: pool de concorrência limitada (`runPool`) processa vários cards ao mesmo tempo, preservando gate `q.mnemonico` (D-04), isolamento de erro por-card (D-13) e fail-closed na sanitização (D-08). Pré-filtra alvos com índice original → escrita em índice exclusivo (sem corrida). Progresso trocou o `index` posicional por **contador de concluídas** (corrige bug latente onde `index` podia exceder `total`). Concorrência padrão 3, ajustável via `ANKINATOR_IMAGE_CONCURRENCY` (config.ts → api.ts → `EnrichOpts.imageConcurrency`). Arquivos: `server/src/core/specialists/enrich.ts`, `server/src/config.ts`, `server/src/api.ts` (+3 testes em `enrich.test.ts`). **273 testes verdes** (eram 270) + tsc + builds verdes.
  ⏳ Falta: validação AO VIVO do usuário — medir o ganho real de tempo e confirmar que a quota da assinatura aguenta `imageConcurrency=3` (se reclamar de rate-limit, baixar via env p/ 2; se aguentar, pode subir).

---

## 🟡 Pipeline — Destino (validar e completar) — ▶ **RETOMAR AQUI**

> Tudo abaixo depende do **runtime/assinatura do usuário** (não validável sozinho). Comece pela RT.

### 🔭 PRÓXIMA DECISÃO (menu — escolher depois do re-teste do usuário)

> ⚡ ATUALIZAÇÃO 2026-06-04 (re-teste do usuário): mnemônicos + SVGs **apareceram no Anki** → RT-imagem confirmado AO VIVO. Porém o re-teste expôs um bug NOVO de fidelidade (RT-fidelidade abaixo): a questão CEBRASPE/DPE-RO/2022 saiu "sem alternativas" sendo que o material as exibe (a–e). **Causa-raiz provada e CORRIGIDA** (parser descartava 100% dos nós `list`). Menu abaixo segue válido para o que vem depois; a Opção 1 (investigar) foi executada e fechou com o fix.

> Contexto: o bug do estágio imagem (timeout 180s = extended thinking) foi **corrigido e provado** (RT-imagem abaixo). O usuário vai re-rodar a geração e conferir no Anki. Estas são as opções de trabalho a seguir — o usuário escolhe uma quando voltar com o resultado:
>
> 1. **Esperar a validação do usuário** (default seguro). Se o re-teste mostrar mnemônicos+SVGs OK no Anki → RT fecha; se algo ainda falhar, investigar com a evidência nova (terminal + o que apareceu no Anki).
> 2. **Phase 7 — Qualidade `[CRIADA]`.** Afrouxar `SYSTEM_FIDELITY` em `server/src/core/prompts.ts` SÓ para questões `[CRIADA]` (atomizar/reformular a partir dos conceitos, não colar o enunciado); manter fidelidade estrita p/ `[EXTRAÍDA]`. Auto-contido + testes; valida ao vivo só quando o usuário rodar. (= bullet "Phase 7" abaixo.)
> 3. **RT-05 — Ativar loader langchain.** Setup de env na máquina do usuário (venv + pip + `ODL_PYTHON`, requer Java 11+). (= bullet "RT-05" abaixo.)
> 4. ~~**Paralelizar estágio imagem.**~~ ✅ FEITO 2026-06-04 (b) — ver abaixo.

- [x] **RT-fidelidade — Listas (alternativas A-E / róis) descartadas no parser. CORRIGIDO.** ✅ 2026-06-04
  Sintoma (re-teste do usuário): card da questão CEBRASPE/DPE-RO/2022 afirmou "Alternativas não transcritas no trecho", mas o PDF exibe as 5 alternativas (a–e).
  **Causa-raiz (provada com o PDF real `curso-230990`):** o `flatten()` em `core/odl-parse.ts` só lia os campos `content`/`kids` dos nós do OpenDataLoader. Mas o nó `type:"list"` guarda os itens em **`"list items"`** (cada um com seu `content`). Resultado: **144 listas do documento (100%) eram descartadas** dos chunks vistos pelo modelo → ele honestamente relatava que as alternativas não estavam no trecho. (O `doc.markdown` cru tinha as listas; só as `sections`/chunks — que alimentam o modelo — as perdiam.) Confirmado que NÃO era prompt, NÃO era chunking, NÃO era o modelo, NÃO era o loader: o text-layer (poppler) e o `convert()` cru traziam as 5 alternativas; quem perdia era nosso parser do JSON.
  **Fix cirúrgico:** branch `type==='list'` em `flatten()` + helper `renderList()` que lê `"list items"` (e recursão nos `kids` aninhados de cada item) → emite um `DocElement` `list`. RawNode estendido com `'list items'`. `flattenNodes()` exportado p/ teste. Arquivos: `core/odl-parse.ts` (+ `core/odl-parse.test.ts`, 4 testes).
  **Provado E2E:** no PDF real, o chunk da questão agora tem **5/5 alternativas** logo após o enunciado. tsc verde + **270 testes** (eram 262, +4 fidelidade +… ) + suíte completa verde. Beneficia ambos os loaders (node Java E OCR Python compartilham `parseOdlOutput`).

- [x] **RT-imagem — Estágio imagem AO VIVO: TIMEOUT corrigido.** ✅ 2026-06-04
  Sintoma (terminal do usuário): 17/17 cards `Estágio imagem falhou: Tempo esgotado (180000ms)`.
  **Causa-raiz (reproduzida via CLI):** gerar SVG é tarefa criativa aberta → o modelo entra em **extended thinking** e rumina >180s SEM emitir markup → estoura o timeout do runner. (Chamadas triviais e o mnemônico batch voltavam em ~5s porque não exigem raciocínio.)
  **Fix cirúrgico:** flag opt-in `disableThinking` em `runClaudeCli`/`buildSpawnArgs` (`runner.ts`) injeta `MAX_THINKING_TOKENS=0` no **env** do spawn (NÃO nos args → guard SPEC-01 intacto). Ligada nos 4 especialistas de enriquecimento (imagem, mnemônico, classificador, card-builder — todos saída estruturada). `CliProvider` de geração de questões **inalterado** (thinking preservado).
  **Provado:** chamada real do provider 180s→**25.4s** com SVG válido. tsc + 262 testes + smoke-runner `--assert-args` verdes (+`image-provider.test.ts`, +guard de env). Arquivos: `runner.ts`, `image-provider.ts`, `enrich.ts`, `smoke-runner.ts`, `enrich.test.ts`, `image-provider.test.ts`.

- [x] **RT-confirmação — re-rodar geração e VER no Anki.** ✅ 2026-06-04 — usuário re-rodou (mnemônico ON, imagem ON): **mnemônicos + SVGs apareceram no Anki** (RT-imagem confirmado AO VIVO). O re-teste também expôs o bug de fidelidade das listas → ver **RT-fidelidade** acima (corrigido).

- [ ] **RT-05 — Ativar loader langchain (opcional).** Terminal mostra `PDF loader: node (auto … ODL_PYTHON não definido)` → langchain nunca ativa. Código pronto (Phase 4.1); falta só env/setup: `python3 -m venv ~/.venvs/odl && ~/.venvs/odl/bin/pip install langchain-opendataloader-pdf` + `ODL_PYTHON=~/.venvs/odl/bin/python3` no `.env` (requer Java 11+). Posso configurar se quiser.

- [ ] **Phase 5/7 — Runner ORQUESTRADO (opt-in).** Wire o subagent `ankinator-orchestrator` (`.claude/agents/`): novo runner que roda `claude` **da raiz do projeto** + tool **Task** liberada, gated por env `ANKINATOR_ORCHESTRATED`, com **fallback determinístico** (não derruba o pipeline atual). Plano de spawn testável (CLI-free) como o `buildSpawnArgs`. Validar com a assinatura do usuário (incerteza: claude headless `-p` + subagents).

- [ ] **Phase 7 — Qualidade das questões `[CRIADA]`.** Afrouxar `SYSTEM_FIDELITY` em `ankinator-app/server/src/core/prompts.ts` SÓ para questões `[CRIADA]` — devem ser atomizadas/reformuladas a partir dos conceitos, não o enunciado colado. Manter fidelidade estrita para `[EXTRAÍDA]`.

---

## ✅ Já entregue (não refazer)

- **UI tela "Estrutura" (2026-06-04):** UI-1 (scroll), UI-2 (botões selecionar/desmarcar), UI-3 (ortografia: "seçãoões"/"selecionadas"), UI-4 (responsividade/overflow/contraste/ARIA + riqueza Ankimon: `components/icons.tsx`, cartões-toggle, badges de status, spinners, seccionamento). `tsc -b` + `vite build` verdes. Arquivos: `web/src/components/{icons,Stepper,FileDrop,ProgressPanel,ExportBar,CardTable,StructurePanel}.tsx` + `App.tsx`.
- Cards educativos ricos (`card-html.ts`) — **confirmado no Anki** (layout seccionado, alternativas como lista ordenada).
- Segurança SVG: CR-01 (re-sanitização no boundary) + WR-01 (rejeição de `url()` externo) + testes.
- Phase 4.1: erro do CLI visível (log + SSE), parse tolerante, fallback posicional, loader langchain auto + logado.
- Mnemônico liberalizado (gera p/ maioria) + alternativas sempre capturadas (prompt).
- 5 subagents reais em `.claude/agents/` (mnemonic, image, deck-classifier, card-builder, orchestrator).

Como rodar a UI: 2 terminais em `ankinator-app/` → `npm run dev:server` (8787) e `npm run dev:web` (5173) → navegador em http://localhost:5173.
