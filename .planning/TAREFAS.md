# Tarefas — Ankinator (retomar após `/clear`)

> **Como retomar:** abra uma sessão no projeto e diga:
> *"Leia `.planning/TAREFAS.md`, o `.planning/STATE.md` e o `.planning/ROADMAP.md` (🎯 Destino) e continue."*
> O destino completo está no ROADMAP. Estado atual no STATE.

---

## 🔴 UI — tela "Estrutura" (apontado pelo usuário em 2026-06-04)

Arquivos: `ankinator-app/web/src/components/StructurePanel.tsx` + `ankinator-app/web/src/App.tsx`.

- [ ] **UI-1 — Rolagem horizontal (layout "muito ruim").**
  Causa raiz: em `StructurePanel.tsx`, o grid `lg:grid-cols-[1fr_320px]` (linha 26) tem o item da esquerda **sem `min-w-0`**, e o `<p>` do nome do arquivo (linhas 32–35) **sem `break-words`/`truncate`**. O filename longo (`1780585021362-curso-230990-...-completo.pdf`) não quebra → estoura a coluna `1fr` → estoura a página → scroll horizontal.
  Fix: `min-w-0` no item esquerdo do grid + `break-words` (ou `truncate`) no `<p>` do filename. Revisar `App.tsx:128` (`max-w-5xl`) e adicionar `overflow-x-hidden` no container se preciso. Testar com zoom out (Image #4/#5).

- [ ] **UI-2 — Botões "Selecionar tudo" e "Desmarcar tudo".**
  Hoje `StructurePanel.tsx:37–42` é **um toggle** ("Selecionar tudo" ↔ "Limpar") e o "Limpar" **só aparece quando TUDO está selecionado** — a partir de seleção parcial não há como desmarcar tudo.
  Fix: dois botões explícitos sempre visíveis — **"Selecionar tudo"** (`onSelectAll(true)`) e **"Desmarcar tudo"** (`onSelectAll(false)`). A infra já existe (`App.tsx:163`).

- [ ] **UI-3 — Erros de escrita.**
  O usuário apontou erros de escrita na tela. Fazer uma **passada completa de revisão ortográfica** em todos os textos da UI (`web/src/components/*.tsx` + `App.tsx`) e confirmar com o usuário os pontos exatos. Atenção a acentuação/concordância nos rótulos e no rodapé.

- [ ] **UI-4 — Polir o layout geral** (telas Estrutura e Revisar): densidade, espaçamento, responsividade; reduzir whitespace excessivo. Referência de riqueza visual: addon `ankimon`.

---

## 🟡 Pipeline — Destino (validar e completar)

- [ ] **RT — Validar mnemônicos/imagens AO VIVO.** Rodar geração real (mnemônico ON, imagem ON). Conferir o **Terminal 1 do server** (`[ankinator/mnemônico]` / `[ankinator/imagem]` / `[ankinator] PDF loader: ...`) e os cards no Anki. O especialista de mnemônico já foi liberalizado (gera para a maioria); confirmar que agora aparecem.

- [ ] **Phase 5/7 — Runner ORQUESTRADO (opt-in).** Wire o subagent `ankinator-orchestrator` (`.claude/agents/`): novo runner que roda `claude` **da raiz do projeto** + tool **Task** liberada, gated por env `ANKINATOR_ORCHESTRATED`, com **fallback determinístico** (não derruba o pipeline atual). Plano de spawn testável (CLI-free) como o `buildSpawnArgs`. Validar com a assinatura do usuário (incerteza: claude headless `-p` + subagents).

- [ ] **Phase 7 — Qualidade das questões `[CRIADA]`.** Afrouxar `SYSTEM_FIDELITY` em `ankinator-app/server/src/core/prompts.ts` SÓ para questões `[CRIADA]` — devem ser atomizadas/reformuladas a partir dos conceitos, não o enunciado colado. Manter fidelidade estrita para `[EXTRAÍDA]`.

---

## ✅ Já entregue nesta sessão (não refazer)

- Cards educativos ricos (`card-html.ts`) — **confirmado no Anki** (layout seccionado, alternativas como lista ordenada).
- Segurança SVG: CR-01 (re-sanitização no boundary) + WR-01 (rejeição de `url()` externo) + testes.
- Phase 4.1: erro do CLI visível (log + SSE), parse tolerante, fallback posicional, loader langchain auto + logado.
- Mnemônico liberalizado (gera p/ maioria) + alternativas sempre capturadas (prompt).
- 5 subagents reais em `.claude/agents/` (mnemonic, image, deck-classifier, card-builder, orchestrator).

Como rodar a UI: 2 terminais em `ankinator-app/` → `npm run dev:server` (8787) e `npm run dev:web` (5173) → navegador em http://localhost:5173.
