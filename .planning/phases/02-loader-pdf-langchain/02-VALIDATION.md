---
phase: 2
slug: loader-pdf-langchain
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-03
---

# Phase 2 — Validation Strategy

> Contrato de validação por-fase para amostragem de feedback durante a execução.
> Baseline do projeto (TESTING.md): **sem test runner** instalado. Disciplina herdada da Phase 1: **asserção determinística CLI-free** (script `tsx` com `process.exit(1)`) + smoke *gated* em disponibilidade. Esta fase é determinística — NÃO faz chamadas LLM.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Nenhum runner (jest/vitest ausentes). Padrão do projeto: script `tsx`/`node` standalone que faz `process.exit(1)` em falha (molde `smoke-runner.ts --assert-args`). |
| **Config file** | none — scripts standalone em `ankinator-app/server/src/scripts/` |
| **Quick run command** | `cd ankinator-app/server && tsx src/scripts/assert-langchain-normalize.ts` (CLI-free, SEM Python/Java — unit puro D-14) |
| **Full suite command** | quick + `tsx src/scripts/guard-default-loader.ts --assert` (D-15) + `tsx src/scripts/smoke-langchain-loader.ts <pdf>` (gated em disponibilidade Python+pacote+Java — D-14) |
| **Estimated runtime** | ~2–3s (caminho CLI-free); smoke gated adicional só quando há Python/Java |

---

## Sampling Rate

- **After every task commit:** `assert-langchain-normalize.ts` (CLI-free, < 1s, roda sempre — não depende de Python/Java).
- **After every plan wave:** unit + `guard-default-loader.ts --assert` (ambos CLI-free, determinísticos); smoke gated quando o ambiente tiver Python/Java.
- **Before `/gsd:verify-work`:** unit + guard D-15 **verdes obrigatórios** (CLI-free); smoke gated executado com **PDF real** (confirma A1/A2/A3 das Open Questions).
- **Max feedback latency:** ~5s (caminho CLI-free).

---

## Per-Task Verification Map

> Task IDs preenchidos quando os PLAN.md forem criados (planner). Linhas abaixo mapeadas por requisito + tipo de teste já fixados pela Validation Architecture (RESEARCH §Validation Architecture + refinamentos R1/R2).

| Task (TBD) | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|------------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 02-NN (normalize) | 1 | PDF-03 | — | N/A (sem entrada não-confiável de rede; parse local) | unit puro CLI-free | `tsx src/scripts/assert-langchain-normalize.ts` | ❌ W0 | ⬜ pending |
| 02-NN (sidecar) | 1 | PDF-01 | — | N/A | smoke gated | `tsx src/scripts/smoke-langchain-loader.ts <pdf>` | ❌ W0 | ⬜ pending |
| 02-NN (branch+fallback) | 2 | PDF-02 | — | fallback silencioso só por indisponibilidade; erro de runtime propaga (D-04) | smoke gated + asserção do branch | coberto pelo smoke (langchain set) e pela ausência (fallback→node) | ❌ W0 | ⬜ pending |
| 02-NN (guard default) | 2 | PDF-03 (não-regressão) | — | default (env unset) byte-idêntico, SEM Python/Java (D-15) | guard determinístico CLI-free | `tsx src/scripts/guard-default-loader.ts --assert` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `ankinator-app/server/src/scripts/assert-langchain-normalize.ts` — unit puro D-14 (fixture `Document[]` → `LoadedDocument`; cobre PDF-03 + `numPages=max(page)` + `title=1º heading|null` + **R1 páginas não-contíguas**).
- [ ] `ankinator-app/server/src/scripts/smoke-langchain-loader.ts` — smoke gated D-14 (clone de `smoke-loader.ts`; cobre PDF-01/PDF-02; pula se `isLangchainAvailable()` false).
- [ ] `ankinator-app/server/src/scripts/guard-default-loader.ts` (ou flag `--assert` em smoke existente) — guard CLI-free D-15 (não-regressão do default; espelha SPEC-01/`smoke-runner --assert-args`).
- [ ] Fixture `Document[]` representativa embutida no unit ou em `scripts/fixtures/`: **≥2 páginas, ≥1 heading ATX `#`, ≥1 página sem heading, e números de página NÃO-contíguos** (ex.: page 1 e page 3) para exercitar R1.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Extração real PDF→Document[]→LoadedDocument ponta-a-ponta com `langchain-opendataloader-pdf` | PDF-01/PDF-02/PDF-03 | Exige ambiente com Python ≥3.10 + pacote pin + **Java 11+** (R2) — não disponível no caminho CLI-free do CI | `cd ankinator-app/server && ANKINATOR_PDF_LOADER=langchain tsx src/scripts/smoke-langchain-loader.ts <pdf-real>`; confirmar markdown com `#`, `numPages` coerente, fallback→node quando pacote/Java ausente |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (3 scripts + fixture)
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s (CLI-free)
- [ ] `nyquist_compliant: true` set in frontmatter (após Wave 0 scaffolds existirem)

**Approval:** pending
