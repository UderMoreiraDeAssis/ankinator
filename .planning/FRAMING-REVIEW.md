# Revisão de Problem Framing — `.planning` do Ankinator

**Data:** 2026-06-06
**Método:** lentes do agente `gsd-framer` (Weinberg *Are Your Lights On?*, Dewey *How We Think*, Senge *Fifth Discipline*, Norman *Design of Everyday Things*, Kahneman *Thinking Fast and Slow*, Rittel & Webber *wicked problems*, Bezos reversível/irreversível, Karpathy). Conduzido como **revisão** (não reescrita) — este é um artefato novo; o diário de bordo (`STATE.md`/`TAREFAS.md`/`PROJECT.md`) **não foi tocado**. Fiel ao framer, que devolve um Brief e NÃO edita os outros docs.
**Como foi feito:** 5 lentes + 1 mapeador de consistência rodados em paralelo sobre todo o `.planning/` (47 achados, 8 contradições, 6 observações neutralizadoras). As 8 contradições foram re-verificadas à mão contra os arquivos (a etapa de verificação automática do workflow falhou em emitir saída estruturada na maioria dos agentes; a verificação aqui é de primeira mão).
**Escopo:** opera no nível do **problema**, não da solução técnica. Não propõe código.
**Status (2026-06-06):** ✅ **P2** (reconciliações de consistência) aplicadas e commitadas (`4338198`). ✅ **P0/P1** (recomendações de framing) aplicadas aos docs via **DEC-q** — Core Value reenquadrado (dono explícito), **Definição de Pronto** (gate ao vivo + eixos render×valor), barras de progresso render×valor, constraint de ops destrutivas. ⏳ Pendente de **execução** (não-doc): medir o sinal de retenção AO VIVO e commitar `live-validate.ts` como instrumento do gate.

> ⚠️ **Leia isto como consultivo, não como verdade revelada.** As bandeiras de severidade alta são oportunidades de framing, não defeitos de execução. A execução do projeto é forte (ver §6 Forças). O ponto cego é de **definição de pronto e de dono**, não de engenharia.

---

## 1. Problema (reenquadrado, do ponto de vista do dono)

**Como está hoje (PROJECT.md:9):** *"Gerar flashcards que maximizam a retenção a partir de um texto qualquer de concurso ... usando a assinatura Claude (sem custo por token)."*

**Reenquadramento sugerido (do dono):** *"O concurseiro que estuda por questões precisa **reter** o conteúdo de um PDF de concurso com **menos retrabalho de revisão** — hoje ele cola questões cruas/enciclopédicas no Anki e revisa mal. O Ankinator deve produzir cards que o **eu-futuro** (que revisa em D+7/D+30) de fato consiga estudar e lembrar."*

A diferença não é cosmética. O enunciado atual define sucesso pela **arquitetura** ("cadeia de especialistas", "orquestrador", "loader langchain de fato usado" — Destino #4/#5, ROADMAP:14-16) — ou seja, **o que o usuário pediu como mecanismo**. O reenquadramento define sucesso pelo **efeito no dono** (reter/revisar melhor). Weinberg teste 1: *quem realmente tem o problema?* É o estudante-que-revisa, e ele **nunca é nomeado** em PROJECT/ROADMAP/REQUIREMENTS (as palavras "concurseiro", "estudante", "eu futuro", "esquecimento", "spaced repetition", "FSRS" não aparecem; "retenção" só como slogan, 2×).

---

## 2. Stakeholders (Norman: o problema do ponto de vista de quem?)

| Stakeholder | Ponto de vista | Status no `.planning` |
|---|---|---|
| **Dono — o concurseiro que cria os cards** | "gerei cards bons sem trabalho manual" | Implícito; nomeado como "usuário"/"single-user" |
| **Dono silenciado — o eu-futuro que REVISA** | "consigo estudar/lembrar esses cards em D+7/D+30" | **Ausente.** Toda validação julga o card na CRIAÇÃO, nunca na REVISÃO |
| **Anki (plataforma de render)** | contratos: SVG sem `id/version`, subdeck `::` aninhado, tags planas, v25.02.x | **Stakeholder silencioso que já quebrou o resultado 2×** (SVG strip; deck achatado; tags duplicadas). Single-user esconde isso |
| **Quota/custo da assinatura** | "a cadeia por-card cabe sem throttle/timeout?" | Reconhecido como constraint; **a decisão central aberta gira inteiramente em torno dele** (orquestrado custa mais → manter opt-in) |
| **Avaliador pedagógico (ciência da aprendizagem)** | "esses cards seguem dificuldade desejável / discriminam distrator / não são redundantes?" | **Ausente como avaliador.** O `learning-scientist` existe só fundido na GERAÇÃO, nunca como crítico do output |

**Achado-chave (Norman, severidade alta):** listar o **Anki como stakeholder explícito com seus contratos** evitaria re-descobrir ao vivo os mesmos bugs de render (modo de falha histórico citado em STATE).

---

## 3. Critério de sucesso observável — a falha central de framing

O ROADMAP já fez **metade** da correção certa (ROADMAP:17): *"Validação de pronto = teste humano real ... abrir no Anki ... Testes determinísticos com runner mockado NÃO contam."* Isso é uma **força rara** (o projeto nomeou sua própria armadilha após o UAT 2026-06-04, onde 144 testes verdes coexistiram com "zero mnemônicos/imagens, questões inúteis coladas cruas").

**Mas a observável adotada ainda é a PRESENÇA do artefato, não o EFEITO no dono.** Toda validação "ao vivo" mede:
- *o card existe e chegou bonito* (STATE: "mnemônicos 48/58 + SVGs 48/48 chegam no Anki");
- *campos populados* (q-live2: "deck:6 tags:6 mnemonico:6 svg:6 de 6 → faz TRABALHO REAL");
- *atomicidade + ancoragem ao PDF* (DEC-o: "46–47/47 ancorados, zero alucinação perigosa").

Essas são condições **necessárias** (não alucinar, não colar enunciado, aparecer no Anki) — mas o planejamento as trata como **suficientes** para "maximiza retenção". **Substituição de Kahneman em ação:** a pergunta difícil ("o card faz reter?") foi trocada pela fácil ("o card é atômico/ancorado/bonito e aparece?").

➡️ **Recomendação (a mais importante desta revisão):** separar **duas observáveis** e duas barras de progresso:

| Observável | O que mede | Estado real |
|---|---|---|
| **(a) pronto-de-render** | card aparece correto/atômico/ancorado no Anki | **~99% — satisfeito e bem validado** |
| **(b) pronto-de-valor** | o dono retém / revisa melhor (recall após intervalo; lapse rate FSRS; auto-teste cego) | **~0% — nunca medido** |

O "~99% do Destino" (STATE:49) é honesto para **(a)** e enganoso para **(b)**. O Destino fala em cards "que de fato **valem a pena estudar**" (ROADMAP:9) — isso é (b). Enquanto o aceite for "(a)", o projeto pode chegar a **100% do ROADMAP e 0% do Core Value**.

---

## 4. Suposições do projeto (Weinberg teste 3 — nunca explicitadas) 

O `.planning` não tem seção de suposições. Reconstruídas, com *"o que muda se for falsa"*:

1. **"Atomicidade + ancoragem ao PDF = boa questão de estudo."** Se falsa: uma questão pode ser atômica/ancorada e ainda pedagogicamente fraca (testa trivialidade, não discrimina o que cai na prova). → usar o `learning-scientist` como **avaliador pós-hoc**, não só na geração.
2. **"Mnemônico melhora a retenção (e mais mnemônicos = melhor)."** Se falsa: o mnemônico "liberalizado p/ a maioria" (ROADMAP:37) vira ruído em cards de compreensão. → ORCH-01 deveria **conter** o mnemônico (só memorização pura), não maximizá-lo.
3. **"SVG esquemático do Claude basta como auxílio visual de memorização."** Justificada por RESTRIÇÃO (sem billing) e MECANISMO (Claude não faz raster), nunca por EFEITO. O histórico de SVG-lixo sugere fragilidade. → gatilho de reabertura deveria ser *"não ajuda a lembrar"*, não só *"usuário pediu fotorrealismo"* (PROJECT.md:35).
4. **"A assinatura aguenta a quota da cadeia por-card."** Já mostrou tensão (timeout de 10min no orquestrador → fallback de $8.55, ~10min desperdiçados). "NOCIONAL (assinatura cobre)" trata custo como zero, mas **tempo desperdiçado e timeout são custo real ao dono**. → declarar o limite observável (cards/run antes de estourar).
5. **"Transformar texto em QUESTÕES é a forma certa de aprender."** Premissa legítima do usuário (CLAUDE.md), mas tratada como verdade derivada. → registrar como premissa-do-usuário + sinal que a refutaria (retenção baixa apesar de cards "bons").
6. **"Validação feita pelo próprio agente lendo os cards = prova de valor."** A auto-validação (DEC-o, q-live2) prova **qualidade técnica** (anti-alucinação/atomicidade) — papel legítimo — mas o observador **não é o dono estudando**. → reservar um sign-off rápido do dono ("estudei 20, veredito") antes de declarar o Destino atingido.

---

## 5. Bandeiras vermelhas (de framing) — verificadas

> Severidade = risco ao framing/Core Value, **não** à execução. Todas conferidas contra os arquivos.

### Alta
- **B1 — O dono real (eu-futuro que revisa) nunca é nomeado; sucesso definido por mecanismo, não por retenção.** (§1, §2)
- **B2 — Core Value "maximizar retenção" sem NENHUM critério que meça retenção.** (§3) — "~99%" mede proxies de presença; a meta declarada vale 0% da barra.
- **B3 — Substituição: "faz reter?" → "é atômico/bonito/aparece?"** em todas as validações ao vivo. (§3)
- **B4 — O padrão "verde no teste → FALHA ao vivo" NÃO foi extinto.** Reaparece como "falta validação AO VIVO" em quase toda sessão (g/j/k/m/n) e o bug de tag dupla só apareceu ao vivo (q-live3). Senge: *shifting the burden* — mais testes mockados aliviam a ansiedade de progresso e atrofiam a validação real. A causa foi **nomeada** (ROADMAP:17) mas ainda **não virou GATE estrutural**: fases vão a "Complete"/✅ com "⏳ falta ao vivo" ao lado.
- **B5 — Nenhuma seção de "Hipóteses descartadas"/formulações alternativas (Dewey).** A arquitetura "5 especialistas + SVG" entrou no bootstrap como **âncora** e as Key Decisions a **racionalizam** (por restrição/implementação), não a competem contra alternativas de PRODUTO. (§7)
- **B6 — `turbovec` é andaime morto especulativo (Karpathy #2).** Código + 2 testes + sidecar + wheel Rust entregues para uma feature **deferida** cujo insumo (embeddings) o projeto **não produz**. Já gerou bug ao vivo (query 2D / `dim%8`) — custo de manutenção real de código não-usado.
- **B7 — Reorganizador de decks: feature inteira, DESTRUTIVA no Anki, fora do escopo declarado.** Sem requisito em REQUIREMENTS.md; o próprio projeto a chama "fora do ROADMAP de fases". Apaga decks/move cards sem requisito que autorize. **Fatia 2 (re-hierarquizar in-place) é destrutiva sem critério de sucesso definido.**
- **B8 — Phases 4.1/5/6/7 sem `PLAN.md` (Plans: TBD) mas marcadas "validado AO VIVO".** Critério emergiu durante a execução, não antes (Karpathy #4 goal-driven parcialmente violado). Funcionou, mas para a **Fatia 2 destrutiva** execução-ad-hoc tem o maior custo de erro — escrever PASS/FAIL **antes** de codar.

### Média
- **B9 — `[CRIADA]` virou default-ON invertendo o risco crítico (alucinação) com rigor de porta-2 numa decisão de porta-1.** Base: 1 run **não-isolado** (cardBuilder ON → ganho combinado) + reforço anti-leak que é **só prompt** ("efeito real só se prova no próximo run"). O leak #45 ("write-ahead log") passou pela 1ª camada. → rodar o A/B `=estrita` (já pendente) **antes** de manter default-ON, ou reverter para OFF até o A/B confirmar zero leak sem cardBuilder.
- **B10 — Anki como stakeholder de render silencioso** (já quebrou resultado 2×). (§2)
- **B11 — Quota/custo é stakeholder de fato que veta o default do orquestrado** — decisão sã (manter opt-in), mas a justificativa "custa mais" carece de número comparável A/B (custo TOTAL dos dois caminhos, não só o do orquestrador isolado).
- **B12 — Meta #2 do Destino ("riqueza visual nível Ankimon") repousa em auto-relato binário** ("Confirmado no Anki pelo usuário"), sem checklist verificável. "Nível Ankimon" é referência de **aparência**, não de pedagogia.
- **B13 — Risco de alucinação NÃO aparece em CONCERNS.md** apesar de ser declarado "risco crítico do projeto". A validação anti-alucinação é manual, 1 inspeção por run, 1 matéria (Banco de Dados) — não escala e é exatamente o que WYSIATI faz parecer suficiente.
- **B14 — ~20 env-knobs (não "~10")**; DEC-m justifica manter um knob "por consistência com os outros knobs" — argumento auto-reforçante (cada knob justifica o próximo). Senge: acumular opções adia a decisão de fundo (qual default certo). Para app local single-user é **reversível/barato** (média, não alta), mas o padrão de **adiar-via-knob** é o alerta.

### Baixa / observação
- **B15 — Premissa "questões é a forma certa de aprender"** tratada como fato (legítima, mas registrar como premissa-do-usuário).
- **B16 — `markitdown`**: loader opt-in cujo valor sobre o default no caso central (PDF de concurso) é **negativo** (blob plano perde hierarquia, que a sessão (c) provou ser causa-raiz de qualidade). Tolerável (reversível, nicho não-PDF), mas marcar que **não** é para PDFs de concurso — senão é scope creep "porque ficou fácil adicionar".

---

## 6. Forças de framing (manter e institucionalizar)

- ✅ **Auto-consciência rara:** o projeto **nomeou sua própria causa-raiz** ("testes mockam o runner → caminho real nunca exercitado; mockado não prova pronto") — ROADMAP:17, DEC-n, DEC-o.
- ✅ **Escopo negativo existe** (Out of Scope em PROJECT/REQUIREMENTS) — combate scope creep (raster, multiusuário, migrar p/ Python).
- ✅ **Reversibilidade bem calibrada (Bezos)** no padrão "opt-in default-OFF byte-idêntico" + fallback determinístico + guard SPEC-01 intocado. Mudanças aditivas, cirúrgicas (Karpathy #3).
- ✅ **Segurança proporcional ao risco real:** precondição `workersToolRestricted` (desabilita orquestrado se workers não forem tool-restritos) é robustez para um risco REAL (prompt-injection via PDF + Task delegando Bash/Write), não over-engineering.
- ✅ **Wicked problem tratado corretamente:** "cards que valem a pena" não tem regra de parada booleana; o projeto não finge resolver tudo — delimitou escopo e ancorou a parada na validação ao vivo (resposta certa a R&W).
- ✅ **Disciplina anti-andaime-morto declarada** (scaffold só vale se provado por smoke rodável) — embora o `turbovec` (B6) seja o caso em que essa disciplina virou racionalização.
- ✅ **Decisão central (orquestrado default?) bem posta** como porta-de-2-vias com tradeoff explícito e recomendação convergente (manter opt-in).

---

## 7. Hipóteses/formulações alternativas que NUNCA foram registradas (lacuna Dewey)

O planejamento elegeu uma solução sem registrar concorrentes. Reconstruções (≥3, exigência do framer) — **nenhuma foi pesada contra a atual** nos docs:

- **A (atual):** *muitos* cards atômicos enriquecidos por uma cadeia de 5 especialistas + SVG.
- **B:** *poucos* cards de **altíssima discriminação** (foco no que cai na prova) + agendamento de revisão (FSRS) — otimiza retenção, não volume.
- **C:** extrair o banco de questões existente e **atomizar só o que o dono reprova em auto-teste** — gera menos, mais cirúrgico, com sinal de retenção embutido.

➡️ Sem esse registro, não há como saber se o desenho atual é **o melhor** ou apenas **o primeiro**. Recomenda-se uma seção "Formulações consideradas" em PROJECT.md.

---

## 8. Auditoria de consistência do `.planning` (8 contradições — verificadas)

| # | Contradição | Veredito | Ação recomendada |
|---|---|---|---|
| **C0** | `REQUIREMENTS.md` marca **ORCH-01/02/03 = `[ ]` / "Pending"**; ROADMAP/STATE dizem **VALIDADO AO VIVO** (q-live2/q-live3). | **REAL, não neutralizada.** | Atualizar ORCH-01/02/03 → Complete (ou nota "validado como capacidade, opt-in"). |
| **C1** | `STATE.md` frontmatter **`percent: 45` / `completed_phases: 3`** vs corpo **`~99%`**. | **REAL (intra-arquivo).** Dois denominadores (fases-com-plano vs metas-do-Destino). | Recomputar o frontmatter **ou** anotar a dualidade ("45% = fases formalmente fechadas; ~99% = metas do Destino"). |
| **C2** | `ROADMAP.md` lista Phases 4/4.1/5/6/7 com **`[~]`** mas a tabela Progress marca **✅ + data "Completed"**; "Plans Complete: —". | **REAL (intra-arquivo).** | Reconciliar notação: ou `[x]` com nota "capacidade validada, ciclo de plano não fechado", ou manter `[~]` e tirar a data de "Completed". |
| **C3** | `PROJECT.md` "Last updated 2026-06-05" vs atividade 2026-06-06. | **REAL mas NEUTRALIZADA** pela convenção do rodapé (PROJECT = lar das decisões + bootstrap; status vive em ROADMAP/STATE). **Resíduo:** DEC-o (2026-06-05) está em STATE/ROADMAP mas **falta na tabela Key Decisions** (que para em DEC-n). | Só fechar o resíduo: **adicionar DEC-o (e DEC-p) à tabela Key Decisions** do PROJECT.md. |
| **C4** | `PROJECT.md` "Active" lista itens centrais como `[ ]` vs ROADMAP `[x]`/validado. | **REAL mas NEUTRALIZADA** (verificada pelo workflow) — rodapé declara Active = snapshot de bootstrap. | Nenhuma (convenção válida). Opcional: 1 linha no topo da seção "Active" reforçando "snapshot de bootstrap — status em ROADMAP/STATE". |
| **C5** | `REQUIREMENTS.md` congelado em 2026-06-03; **NÃO se declara snapshot** (≠ PROJECT.md). ORCH-* Pending; faltam ORCH-04/QUAL-01/AGENT-01/RICH-*/RT-* citados no ROADMAP. | **REAL, não neutralizada — é o artefato mais defasado.** | Ou atualizar REQUIREMENTS.md (status + requisitos novos), ou adicionar o **mesmo rodapé** do PROJECT.md ("snapshot de bootstrap; catálogo de facto é o ROADMAP"). |
| **C6** | `codebase/TESTING.md` + `PROJECT.md:46` "sem testes automatizados" vs **250 testes** (STATE). | **REAL** — explicada pela data de análise (codebase-docs = 2026-06-03, pré-vitext da Phase 3) mas **não marcada como obsoleta**. | Adicionar banner "Analysis Date 2026-06-03 — pré-Phase 3; ver STATE p/ estado corrente" nos 7 `codebase/*.md`; corrigir a linha de PROJECT.md. |
| **C7** | `STATE.md` "Total plans completed: **12**" (Performance Metrics) vs frontmatter "**16**". | **REAL (intra-arquivo)** — métricas de velocidade abandonadas na ~Phase 04. | Atualizar ou remover a seção Performance Metrics (telemetria parada). |

**ORCH-04 / requisitos-fantasma (observação do mapeador):** ORCH-04, RT-01/02/05, RICH-01/02/03, QUAL-01, AGENT-01 aparecem como "Requirements" de fases no ROADMAP **sem entrada** em REQUIREMENTS.md → o ROADMAP virou o catálogo de facto. Decidir qual doc é a fonte de verdade de requisitos.

---

## 9. Complexidade

**`normal`** (não operacional) — múltiplos stakeholders, problema parcialmente **wicked** (qualidade pedagógica = melhor/pior, sem regra de parada booleana), decisões com consequência (default do orquestrado; Fatia 2 destrutiva). O framing pesado se justifica.

---

## 10. Recomendações priorizadas (para o dono/`/gsd` materializar)

> O framer não edita os outros docs. Estas são ações para o **dono** (ou um `/gsd-docs-update`). Posso aplicar as de **consistência (P2)** sob demanda — são objetivas e reversíveis.

**P0 — Fechar o buraco do Core Value (framing):**
1. Nomear o **dono real** (concurseiro + eu-futuro) no PROJECT.md e reescrever o Core Value em termos de efeito.
2. Criar **uma observável de retenção** (ainda que leve): lapse/recall via FSRS no próprio Anki do dono, ou auto-teste cego em D+N. Separar as barras (a) render vs (b) valor.
3. Antes de declarar o Destino atingido, **um sign-off do dono estudando** (≠ agente lendo os cards).

**P1 — Tornar "ao vivo" um GATE, não uma nota lateral (Senge B4):**
4. Nenhuma fase vira "Complete"/✅ enquanto houver "⏳ falta ao vivo". Commitar `live-validate.ts` e elevá-lo a Definition of Done por fase.
5. Para a **Fatia 2 destrutiva** e o **default do orquestrado**: escrever PASS/FAIL **antes** de codar/rodar (Karpathy #4). Promover "operações destrutivas no Anki exigem desenho exposto + consentimento" de prosa-de-sessão para **Constraint** em PROJECT.md (hoje vive só na memória e some num `/clear`).

**P2 — Reconciliar consistência (objetivo, posso aplicar):**
6. Itens C0/C1/C2/C5/C6/C7 da §8 + DEC-o/DEC-p na tabela Key Decisions (C3) + banner de obsolescência nos `codebase/*.md`.

**P3 — Higiene de escopo (Karpathy/Bezos):**
7. Decidir `turbovec` (B6): remover do código-fonte para um branch/doc até o dedup ser escopado **junto** do gerador de embeddings (corte vertical), OU abrir requisito explícito. Idem reorganizador (B7) — abrir requisito ou marcar "utilitário fora da milestone".
8. Ampliar o **Out of Scope canônico**: OCR de PDF escaneado; ingestão não-PDF (markitdown); **medir retenção longitudinal**; multi-idioma. (Hoje só implícitos.)
9. Rodar o **A/B `=estrita`** antes de manter `[CRIADA]` default-ON (B9), e um A/B custo-total orquestrado vs `enrichAll` (B11) para a decisão de default deixar de ser intuição.

---

## 11. Veredito do framer

- **SUFICIÊNCIA (do framing):** `preciso_mais` — **não** por falta de execução, mas porque o **critério de valor (retenção) nunca foi definido nem medido**; o núcleo "o que muda no mundo quando resolvido" está respondido só no eixo render, não no eixo dono.
- **RAZÃO:** o projeto fechou "pronto-de-render" com rigor exemplar; falta a observável de "pronto-de-valor" e o registro de formulações alternativas/suposições.
- **Bandeiras irredutíveis aceitáveis:** wicked problem (qualidade pedagógica é melhor/pior) — a parada por validação ao vivo é a resposta correta; só falta uma **rubrica leve e estável** (atomicidade · ancoragem · não-alucinação · mnemônico discrimina distrator) para tornar o julgamento comparável entre runs.

*Revisão gerada por método `gsd-framer` em 2026-06-06. Artefato consultivo — nenhum doc de planejamento foi alterado.*
