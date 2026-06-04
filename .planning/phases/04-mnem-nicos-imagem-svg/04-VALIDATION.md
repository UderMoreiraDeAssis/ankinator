---
phase: 4
slug: mnem-nicos-imagem-svg
status: ready
nyquist_compliant: true
wave_0_complete: true
created: 2026-06-03
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from RESEARCH.md `## Validation Architecture` and CONTEXT.md D-14.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (já instalado em `ankinator-app/server`; script `test: vitest run`) |
| **Config file** | none — vitest roda via `npm test` no `ankinator-app/server` |
| **Quick run command** | `cd ankinator-app/server && npm test -- <padrão>` |
| **Full suite command** | `cd ankinator-app/server && npm test && npm run build` |
| **Web type-check/build** | `cd ankinator-app/web && npm run build` (`tsc -b && vite build`) |
| **Guard CLI-free** | `cd ankinator-app/server && npm run test:guard` (byte-identidade PIPE-03) |
| **Smoke gated (opt-in)** | `cd ankinator-app/server && npm run smoke` (gera SVG real sob demanda) |
| **Estimated runtime** | ~5–15 s (unit); smoke é opt-in e custa quota |

---

## Sampling Rate

- **After every task commit:** Run o `npm test -- <padrão>` da task (sanitize-svg / enrich / exporters-embed).
- **After every plan wave:** Run `npm test` (server) + `npm run build` (server e web).
- **Before `/gsd:verify-work`:** suite unit verde + ambos os builds verdes + guard CLI-free verde.
- **Max feedback latency:** ~15 s (unit puro, sem CLI/quota).

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | IMG-02 | T-04-01 (supply-chain dep) | pacote `isomorphic-dompurify` legítimo (versão/autoria/downloads) | checkpoint:human | manual — gate blocking-human | n/a | ⬜ pending |
| 04-01-02 | 01 | 1 | IMG-02 | T-04-02 (XSS via SVG) | F-01..F-12 removidos; só allowlist geométrica sobrevive; fail-closed | unit (tdd) | `cd ankinator-app/server && npm test -- sanitize-svg` (≥12 verdes) | ❌ W0 (criado na task, RED→GREEN) | ⬜ pending |
| 04-01-03 | 01 | 1 | MNEM-02 | — | prompt emite JSON `{mnemonicos:[{id,mnemonico,tecnica?}]}`; sem `id`/`version` no SVG | source | `npm run build` (server) + asserção de conteúdo em `mnemonic.md`/`mnemonic-image.md` | ✅ | ⬜ pending |
| 04-02-01 | 02 | 2 | MNEM-01, MNEM-02 | — | batch casa-por-id (Map, anti-posicional); id ausente → card sem mnemônico (fail-soft) | unit (tdd) | `cd ankinator-app/server && npm test -- enrich` | ❌ W0 (RED→GREEN) | ⬜ pending |
| 04-02-02 | 02 | 2 | IMG-01, IMG-02 | T-04-03 (markup sujo embutido) | imagem só p/ cards com `q.mnemonico`; SVG null → sem `mnemonicoSvg` + erro (fail-closed) | unit (tdd) | `npm test -- enrich` | ❌ W0 (RED→GREEN) | ⬜ pending |
| 04-02-03 | 02 | 2 | IMG-02 | — | sanitização aplicada no estágio; tipos ESM consistentes | unit + build | `npm test -- enrich` + `npm run build` | ✅ | ⬜ pending |
| 04-03-01 | 03 | 3 | IMG-03 | T-04-04 (escape incorreto) | `<svg` literal (não `&lt;svg`) no verso; texto do mnemônico via `escapeHtml` | unit (tdd) | `cd ankinator-app/server && npm test -- exporters-embed` | ❌ W0 (RED→GREEN) | ⬜ pending |
| 04-03-02 | 03 | 3 | MNEM-01, IMG-03 | — | defaults D-12 propagados (`mnemonico ?? true`, `imagem ?? false`) | source/build | `npm run build` (server) + asserção de string | ✅ | ⬜ pending |
| 04-03-03 | 03 | 3 | IMG-03 | T-04-05 (regressão PIPE-03) | toggles OFF ⇒ `/generate` byte-idêntico ao baseline | guard + smoke | `npm run test:guard` (byte-id) + `npm run smoke` (gated) | ✅ | ⬜ pending |
| 04-03-04 | 03 | 3 | IMG-03 | — | `<svg>` inline renderiza no Anki desktop/mobile | checkpoint:human | manual — gate blocking-human (smoke real) | n/a | ⬜ pending |
| 04-04-01 | 04 | 1 | MNEM-01, IMG-01 | — | union `EnrichProgress.estagio` + `GenerateOptions` ampliados sem erro de tipo | source/build | `cd ankinator-app/web && npm run build` (tsc -b cobre os tipos) | ✅ | ⬜ pending |
| 04-04-02 | 04 | 1 | MNEM-01, IMG-01 | T-04-06 (XSS no front) | badges read-only; **sem** `dangerouslySetInnerHTML`/render de SVG (D-13) | source/build | `npm run build` (web) + asserção `grep -L dangerouslySetInnerHTML CardTable.tsx` | ✅ | ⬜ pending |
| 04-04-03 | 04 | 1 | MNEM-01, IMG-01 | — | toggles default ON/OFF; badges 📝/🖼️; rótulos de progresso corretos | checkpoint:human | manual — gate blocking (visual) | n/a | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

**Sem Wave 0 separado.** vitest já está instalado (`ankinator-app/server`, script `test: vitest run`) e a infra de teste existe (`enrich.test.ts`, `scripts/guard-enrich.ts`, `scripts/smoke-*.ts`). Os arquivos de teste novos são criados **dentro das próprias tasks TDD** (RED→GREEN), padrão já provado na Phase 2:

- `sanitize-svg.test.ts` (fixtures F-01..F-12) — criado na task **04-01-02** (tdd).
- novos `describe` em `enrich.test.ts` (batch por-id, fail-closed) — tasks **04-02-01 / 04-02-02** (tdd).
- `exporters-embed.test.ts` (`<svg` literal, escape do texto, byte-id) — task **04-03-01** (tdd).

Nenhuma dependência de Wave 0 bloqueia a execução. `wave_0_complete: true` reflete "nenhum setup de infra pendente antes da Wave 1".

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Render do `<svg>` inline no card Anki (desktop + mobile) | IMG-03 | Depende do QtWebEngine/AnkiMobile; gerar SVG real custa quota; Anki 25.02.x tem DOMPurify interno (risco documentado no RESEARCH) | smoke gated opt-in (`npm run smoke`) → importar card no Anki e confirmar render. Checkpoint **04-03-04** (blocking-human). |
| UI "Modo educativo": toggles (mnemônico ON / imagem OFF), badges 📝/🖼️ read-only, rótulos de progresso | MNEM-01, IMG-01 | **Por design (D-13):** UI mínima (toggles + badges read-only, sem render de SVG). Cobertura automatizada = `tsc -b` (tipos) ; comportamento visual = checkpoint humano. **Sem** testes de componente React (superfície mínima, evita 2ª superfície de sanitização). | `cd ankinator-app/web && npm run dev` → conferir defaults dos toggles, badges read-only e rótulos de progresso dos novos estágios. Checkpoint **04-04-03** (blocking). |

---

## Validation Sign-Off

- [x] All tasks têm `<automated>` verify (auto/tdd) ou são checkpoints humanos documentados (manual-only)
- [x] Sampling continuity: nenhuma sequência de 3 tasks `auto` sem automated verify
- [x] Wave 0: sem setup pendente (vitest instalado; testes novos criados inline nas tasks TDD)
- [x] No watch-mode flags (vitest `run`, não `watch`)
- [x] Feedback latency < 15s (unit puro)
- [x] `nyquist_compliant: true`

**Approval:** approved 2026-06-03 (contrato operacional; UI documentada como manual-only por D-13)
