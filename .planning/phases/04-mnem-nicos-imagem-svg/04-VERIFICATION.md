---
phase: 04-mnem-nicos-imagem-svg
verified: 2026-06-04T00:30:00Z
status: human_needed
score: 3/3 must-haves verified (code capability)
overrides_applied: 0
human_verification:
  - test: "UI visual check: run `cd ankinator-app/web && npm run dev` + server; confirm toggle defaults (Mnemônico ON / Imagem OFF) in StructurePanel 'Modo educativo' block; confirm read-only badges 📝/🖼️ on CardTable (NO SVG render); confirm progress labels 'Gerando mnemônicos…' and 'Gerando imagem N/total…' during generation."
    expected: "Mnemônico checkbox is checked by default; Imagem de mnemônico is unchecked; badges appear on cards that have mnemonic/SVG; SVG is NOT rendered as an image in the table (only a badge); progress bar shows correct stage labels."
    why_human: "React component visual defaults and conditional rendering cannot be verified deterministically by grep; requires a running browser session."
  - test: "Anki render check (IMG-03 runtime): generate a deck with mnemônico+imagem both ON, export via CSV and AnkiConnect, open in Anki 25.02.x, confirm the <svg> renders as an image in the Back field of a card that has mnemonicoSvg, and that cards without SVG are unchanged."
    expected: "SVG renders as a graphic (not as raw text '<svg...>') in the Back field. Cards without mnemonicoSvg are byte-identical to Phase 3 baseline."
    why_human: "Anki QtWebEngine rendering is a runtime/desktop behavior; no programmatic check can substitute for visual confirmation in the actual Anki application."
  - test: "Live generation quality (MNEM-01/IMG-01 runtime): run a full end-to-end generation on a real concurso PDF with mnemônico=true and imagem=true; inspect the mnemônico text and generated SVG in the card review table."
    expected: "Cards of memorization type (lists, dates, acronyms) receive a mnemonic with a clearly indicated technique (acrônimo/história/loci/rima); cards of conceptual/reasoning type have no mnemonic. Generated SVG illustrates the mnemonic visually."
    why_human: "LLM output quality (technique selection, fidelity of mnemonic to content, SVG illustrative quality) requires a human run against real Claude signature CLI."
---

# Phase 04: Mnemônicos + Imagem SVG — Verification Report

**Phase Goal:** Adicionar os especialistas de mnemônico e de imagem de mnemônico (SVG gerado pelo Claude), com sanitização do SVG e embed nos cards exportados (CSV e AnkiConnect).
**Verified:** 2026-06-04T00:30:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | Cards de memorização recebem um mnemônico apropriado (técnica escolhida pelo conteúdo). | VERIFIED (code) / ? HUMAN (runtime quality) | `enrichAll` estágio 3 faz 1 chamada batch, merge por id via `Map`, fail-soft para omissões; `mnemonic.md` prompt instrui técnica por card; 82 testes passando incluindo batch por id, merge anti-posicional, deveRodarEnrich. Runtime quality requires human sign-off. |
| 2 | É gerado um SVG autocontido ilustrando o mnemônico, sanitizado (sem script/URLs externas). | VERIFIED (code) | `sanitize-svg.ts` allowlist geométrica estrita (SVG_TAGS/SVG_ATTRS), sem USE_PROFILES, fail-closed (`startsWith('<svg')`), WR-01 fix (url() external → null), CR-01 fix (re-sanitização no boundary de export em csv.ts e ankiconnect.ts). 36 testes adversariais passando. |
| 3 | O SVG aparece corretamente nos cards exportados via CSV e AnkiConnect. | VERIFIED (code) / ? HUMAN (Anki render) | `csv.ts` embeds `q.mnemonicoSvg` raw (re-sanitized at boundary, never escapeHtml). `ankiconnect.ts versoHtml` idem; exported and tested. 26 embed tests pass including `<svg` literal in output and `&lt;svg` absent. Anki rendering requires human sign-off. |

**Score:** 3/3 truths verified at code-capability level. All 3 require human sign-off for runtime/visual dimensions.

---

### Deferred Items

None — all 5 requirement IDs (MNEM-01, MNEM-02, IMG-01, IMG-02, IMG-03) are covered by this phase.

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `ankinator-app/server/src/core/specialists/sanitize-svg.ts` | Sanitization with geometric allowlist, fail-closed, WR-01 url() fix | VERIFIED | exports `sanitizarSvg`; `ALLOWED_TAGS`/`ALLOWED_ATTR` present; no `USE_PROFILES`; `startsWith('<svg')` gate; url() post-filter rejects external refs; try/catch → null |
| `ankinator-app/server/src/core/specialists/sanitize-svg.test.ts` | 12+ adversarial fixtures F-01..F-12 | VERIFIED | 18 `it()` calls; 36 tests pass (includes CR-01/WR-01 boundary tests) |
| `ankinator-app/server/src/core/specialists/prompts/mnemonic.md` | JSON batch format `{"mnemonicos":[...]}` | VERIFIED | Section `## Saída` contains `{"mnemonicos":[` literal and omission rule for conceptual cards |
| `ankinator-app/server/src/core/specialists/prompts/mnemonic-image.md` | Negation rules for id/version and `<svg` start | VERIFIED | "Não use os atributos `id` ou `version` no elemento `<svg>` raiz"; starts-with-`<svg` rule present |
| `ankinator-app/server/src/core/specialists/enrich.ts` | Stage 3 (mnemonic batch), stage 4 (image per-card, gated), parseMnemonicosJson, deveRodarEnrich extended | VERIFIED | Exports `parseMnemonicosJson`, `enrichAll`, `deveRodarEnrich`; `gerando-mnemonico`/`gerando-imagem` literals; `new Map(` in stage 3; `if (!q.mnemonico) continue` gate; `sanitizarSvg` imported; `createImageProvider` wired |
| `ankinator-app/server/src/core/specialists/enrich.test.ts` | Behavioral tests for mnemonic batch, image stage, deveRodarEnrich | VERIFIED | 42 `it()` calls; 82 tests pass including merge by id, fail-soft, gate D-04, fail-closed |
| `ankinator-app/server/src/core/specialists/image-provider.ts` | TODO(IMG-02) removed; provider only generates | VERIFIED | No `TODO(IMG-02` in file; comment clarifies sanitization happens in enrichAll stage |
| `ankinator-app/server/src/core/exporters/csv.ts` | Embeds mnemônico text + SVG raw; re-sanitizes at boundary (CR-01) | VERIFIED | imports `sanitizarSvg`; `if (q.mnemonico)` and `if (q.mnemonicoSvg)` gates; `sanitizarSvg(q.mnemonicoSvg)` called before embed; no `escapeHtml` on SVG |
| `ankinator-app/server/src/core/exporters/ankiconnect.ts` | `export function versoHtml`; SVG not escaped; mnemonic text escaped; re-sanitizes at boundary (CR-01) | VERIFIED | `export function versoHtml`; imports `sanitizarSvg`; `sanitizarSvg(q.mnemonicoSvg)` called; `escapeHtml(q.mnemonico)` for text; no `escapeHtml(q.mnemonicoSvg)` call |
| `ankinator-app/server/src/core/exporters/exporters-embed.test.ts` | SVG present → `<svg` in output; absent → byte-identical; SVG not escaped; text escaped | VERIFIED | 26 tests pass; IMG-03 positive test: `expect(html).toContain('<svg')` and `expect(html).not.toContain('&lt;svg')` |
| `ankinator-app/server/src/api.ts` | mnemonico (default true) and imagem (default false) in enrichOpts | VERIFIED | Lines 161-162: `mnemonico: options?.mnemonico ?? true` and `imagem: options?.imagem ?? false` |
| `ankinator-app/web/src/types.ts` | GenerateOptions += mnemonico?/imagem?; EnrichProgress.estagio += new literals | VERIFIED | `mnemonico?: boolean`, `imagem?: boolean` in GenerateOptions; union includes `'gerando-mnemonico' \| 'gerando-imagem'` |
| `ankinator-app/web/src/components/StructurePanel.tsx` | 2 toggles: Mnemônico (default ON) and Imagem de mnemônico (default OFF) | VERIFIED | `checked={options.mnemonico !== false}` and `checked={options.imagem === true}`; both `onChange` handlers call `setOptions` |
| `ankinator-app/web/src/components/CardTable.tsx` | Badges 📝/🖼️ read-only; no SVG render; no dangerouslySetInnerHTML | VERIFIED | `{c.mnemonico && <span ...>📝 mnemônico</span>}` and `{c.mnemonicoSvg && <span ...>🖼️ SVG</span>}`; no `dangerouslySetInnerHTML` in file |
| `ankinator-app/web/src/components/ProgressPanel.tsx` | Labels for gerando-mnemonico and gerando-imagem stages | VERIFIED | Ternary covers `'gerando-mnemonico'` → 'Gerando mnemônicos…' and `'gerando-imagem'` → 'Gerando imagem N/total…' |
| `ankinator-app/web/src/App.tsx` | defaults mnemonico:true / imagem:false in useState | VERIFIED | `mnemonico: true` and `imagem: false` in useState<GenerateOptions> initial value |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `enrich.ts` | `sanitize-svg.ts` | `import { sanitizarSvg } from './sanitize-svg.js'` | WIRED | Line 27; called in stage 4 at line 338 |
| `enrich.ts` | `image-provider.ts` | `import { createImageProvider } from './image-provider.js'` | WIRED | Line 26; called in stage 4 at line 329 |
| `enrich.ts` | stage 3 merge by id | `new Map(parsed.filter(m => m.id && m.mnemonico).map(...))` | WIRED | Line 310; anti-positional |
| `api.ts` | `enrichAll` | `enrichOpts` with `mnemonico ?? true` / `imagem ?? false` | WIRED | Lines 161-162 |
| `csv.ts` | `q.mnemonicoSvg` | `sanitizarSvg(q.mnemonicoSvg)` then raw concat | WIRED | Lines 60-61; CR-01 fix present |
| `ankiconnect.ts` | `q.mnemonicoSvg` | `sanitizarSvg(q.mnemonicoSvg)` then raw concat | WIRED | Lines 98-99; CR-01 fix present |
| `StructurePanel.tsx` | `setOptions` | `onChange` for mnemonico/imagem toggles | WIRED | Lines 158-159, 165-166 |
| `CardTable.tsx` | `c.mnemonico / c.mnemonicoSvg` | badge conditional read-only | WIRED | Lines 82-94; no dangerouslySetInnerHTML |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| `enrich.ts` stage 3 | `q.mnemonico` | `runClaudeCli({ systemPrompt: loadPrompt('mnemonic'), userMessage })` | Yes — live Claude CLI call; mocked in tests | FLOWING (deterministic path proven; live path requires runtime) |
| `enrich.ts` stage 4 | `q.mnemonicoSvg` | `imageProvider.generate(q.mnemonico, q.resposta)` → `sanitizarSvg(svg)` | Yes — live Claude CLI call via SvgClaudeImageProvider; mocked in tests | FLOWING (deterministic path proven; live path requires runtime) |
| `csv.ts` | `verso` with SVG | `q.mnemonicoSvg` from job.questoes (sanitized in enrich); re-sanitized at export boundary | Yes | FLOWING |
| `ankiconnect.ts versoHtml` | `back` with SVG | `q.mnemonicoSvg` re-sanitized at export boundary | Yes | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| sanitize-svg tests pass (F-01..F-12 + WR-01 fixtures) | `npm test -- sanitize-svg` | 36/36 pass | PASS |
| enrich tests pass (batch by id, fail-soft, image gate, fail-closed) | `npm test -- enrich` | 82/82 pass | PASS |
| exporters-embed tests pass (IMG-03 positive, byte-identity, CR-01) | `npm test -- exporters-embed` | 26/26 pass | PASS |
| Full server test suite | `npm test` | 144/144 pass, 6 files | PASS |
| guard-enrich --assert (PIPE-03 gate, 4 toggles) | `npx tsx src/scripts/guard-enrich.ts --assert` | exit 0, 5 scenarios OK | PASS |
| smoke-enrich --assert-args (prompts + parsers + sanitizer CLI-free) | `npx tsx src/scripts/smoke-enrich.ts --assert-args` | exit 0, all checks OK | PASS |
| Web build (tsc + vite) | `cd ankinator-app/web && npm run build` | exit 0, 36 modules | PASS |
| Server build (tsc) | `cd ankinator-app/server && npm run build` | exit 0 | PASS |

---

### Probe Execution

No probe-*.sh files declared or conventional for this phase. Behavioral spot-checks above serve as the equivalent verification.

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| MNEM-01 | 04-02, 04-04, 04-03 | Especialista de mnemônicos gera mnemônicos para cards de memorização | SATISFIED (code) / NEEDS HUMAN (quality) | enrichAll stage 3: batch call, merge by id, fail-soft; deveRodarEnrich covers toggle; 82 enrich tests |
| MNEM-02 | 04-01, 04-02 | Suporta técnicas variadas (acrônimo, história, loci, rima) escolhidas conforme conteúdo | SATISFIED | mnemonic.md prompt instructs technique selection; JSON batch format includes `tecnica` field; parseMnemonicosJson handles optional tecnica |
| IMG-01 | 04-02, 04-04 | Especialista de imagem gera SVG autocontido via assinatura Claude | SATISFIED (code) | SvgClaudeImageProvider wired in enrichAll stage 4; runClaudeCli + mnemonic-image prompt; stage gated by q.mnemonico |
| IMG-02 | 04-01, 04-02 | SVG sanitizado (sem script, sem URLs externas) antes de ser embutido | SATISFIED | sanitize-svg.ts: ALLOWED_TAGS/ALLOWED_ATTR allowlist, no USE_PROFILES, startsWith('<svg') fail-closed, WR-01 url() post-filter; CR-01 re-sanitization at export boundary in both exporters; 36 adversarial tests |
| IMG-03 | 04-03 | SVG embutido nos cards exportados (CSV e AnkiConnect) de forma que o Anki renderize | SATISFIED (code) / NEEDS HUMAN (Anki render) | csv.ts and ankiconnect.ts both embed raw SVG (never escapeHtml on SVG); versoHtml exported and tested with IMG-03 positive test (`<svg` literal, not `&lt;svg`); human check for Anki rendering is deferred |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `image-provider.ts` | 53 | `TODO(v2): selecionar provider raster por env quando IMGR-01 existir.` | INFO | References formal future work (IMGR-01 v2 requirement, out of scope for this phase). Not a blocker — this is a forward-looking extension point, not incomplete functionality for Phase 4. |
| `enrich.ts` | 329 | `createImageProvider()` called outside per-card try/catch (WR-03 from code review) | WARNING | If createImageProvider ever throws (currently cannot), the entire enrichAll would fail. Currently safe since factory always succeeds, but noted as technical debt. Not a blocker for this phase's goals. |
| `mnemonic-image.md` | 20-22 | Stale "andaime" disclaimer "Nesta fase de andaime este prompt ainda NÃO é chamado pelo pipeline." (IN-03 from code review) | WARNING | Misleading to future maintainers. Not a functional issue. |
| `guard-enrich.ts`, `smoke-enrich.ts` | headers | "Estado Wave 0: VERMELHO" banners (IN-04 from code review) | INFO | Stale documentation. Not a functional issue. |

No `TBD`, `FIXME`, or `XXX` markers found in any phase-modified file.

---

### Security Fixes Verified (from 04-REVIEW.md)

**CR-01 (CLOSED):** Both `csv.ts` (line 60) and `ankiconnect.ts` (line 98) now import and call `sanitizarSvg(q.mnemonicoSvg)` at the export boundary before embedding. The fix is present in both files with explanatory comments referencing CR-01. The `exporters-embed.test.ts` includes two tests specifically verifying this fix (`CR-01: SVG malicioso do req.body é re-sanitizado no boundary` and `CR-01/WR-01: SVG com url() externo é descartado no boundary`). Both pass.

**WR-01 (CLOSED):** `sanitize-svg.ts` (lines 99-105) adds a post-DOMPurify url() value filter: any `url(...)` reference whose target does not start with `#` (internal fragment) causes the function to return null. This covers the `fill="url(http://...)"`, `stroke="url(...)"`, `clip-path="url(...)"`, and `mask="url(data:...)"` vectors that DOMPurify's attribute name allowlist cannot block.

---

### Human Verification Required

#### 1. UI Visual Check — Toggle Defaults and Badges

**Test:** Run `cd ankinator-app/web && npm run dev` and the server. Navigate to the generation flow.
**Expected:** In the "Modo educativo" block of StructurePanel: toggle "Mnemônico" is ON (checked) by default; toggle "Imagem de mnemônico" is OFF (unchecked) by default. After generating cards with mnemônicos, the CardTable shows 📝 badge on cards with a mnemonic and 🖼️ badge on cards with SVG — and the SVG is NOT rendered as an image (only the badge appears). During enrichment with imagem=ON, the progress bar shows "Gerando imagem N/total…" label.
**Why human:** React component visual state, conditional badge rendering, and progress label display are runtime/browser behaviors that cannot be verified deterministically from source code.

#### 2. Anki Render Check (IMG-03 Runtime)

**Test:** Generate a deck with mnemônico=ON and imagem=ON using a real concurso PDF. Export via AnkiConnect (or import CSV) into a test deck in Anki 25.02.x. Open a card that has `mnemonicoSvg` in the Back field.
**Expected:** The SVG renders as a graphic image (not as raw text `<svg...>`) in the Back field. Cards without `mnemonicoSvg` are visually identical to Phase 3 cards. AnkiDroid/AnkiMobile rendering is a bonus check.
**Why human:** Anki's QtWebEngine SVG rendering behavior (including the Anki 25.02.x DOMPurify pass that may strip certain attributes) is a runtime desktop behavior that requires visual confirmation in the actual application.

#### 3. Live Generation Quality (MNEM-01/IMG-01 Runtime)

**Test:** Run a full end-to-end generation on a real concurso PDF (with lists, dates, or acronyms present) with mnemônico=ON. Review generated cards in the CardTable.
**Expected:** Cards with memorization content (lists, sequences, role/classification sets) have a mnemonic with a clearly identified technique. Cards of conceptual/reasoning type have no mnemonic. Generated SVGs (if imagem=ON) are visually recognizable illustrations of the mnemonic content.
**Why human:** LLM output quality (technique appropriateness, fidelity to card content, absence of hallucinated items, SVG illustrative quality) depends on the live Claude signature CLI and cannot be verified from code.

---

### Gaps Summary

No functional gaps found. All code-deterministic aspects of the phase goal are implemented and tested. The three human verification items above are required for full sign-off on runtime behavior (Anki rendering, UI visual confirmation, LLM generation quality) — these were intentionally deferred from mid-phase checkpoints to end-of-phase per the context notes.

Two open code review warnings (WR-03: createImageProvider outside try/catch; IN-03: stale prompt disclaimer; IN-04: stale script banners) are technical debt items that do not block the phase goal and do not affect correctness in the current implementation.

---

_Verified: 2026-06-04T00:30:00Z_
_Verifier: Claude (gsd-verifier)_
