---
phase: 4
slug: mnem-nicos-imagem-svg
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-03
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from RESEARCH.md `## Validation Architecture` and CONTEXT.md D-14.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (já instalado — CONTEXT.md D-14) |
| **Config file** | {planner: confirmar vitest config em ankinator-app/server} |
| **Quick run command** | `{planner: comando unit puro do enrich/sanitização}` |
| **Full suite command** | `{planner: suite completa do server}` |
| **Estimated runtime** | ~{N} seconds |

---

## Sampling Rate

- **After every task commit:** Run `{quick run command}`
- **After every plan wave:** Run `{full suite command}`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** {N} seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| {N}-01-01 | 01 | 1 | REQ-{XX} | T-{N}-01 / — | {expected secure behavior or "N/A"} | unit | `{command}` | ✅ / ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Eixos de validação obrigatórios (D-14, ver RESEARCH.md §Validation Architecture):*
*(1) unit puro determinístico com fixtures maliciosos F-01..F-12 provando remoção dos vetores SVG (sem CLI/quota);*
*(2) guard CLI-free provando byte-identidade do `/generate` com toggles OFF (PIPE-03);*
*(3) smoke gated/opt-in que gera o SVG real e confirma render no Anki (único gate confiável p/ 25.02.x).*

---

## Wave 0 Requirements

- [ ] `{tests/test_file}` — stubs for MNEM-01/02, IMG-01/02/03
- [ ] `{shared fixtures}` — fixtures maliciosos de SVG (F-01..F-12)
- [ ] vitest já instalado — sem install de framework

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Render do `<svg>` inline no Anki desktop/mobile | IMG-03 | Depende do QtWebEngine/AnkiMobile (CLI gera SVG real, custa quota) | smoke gated opt-in → importar card e conferir render no Anki |

*If none: "All phase behaviors have automated verification."*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < {N}s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
