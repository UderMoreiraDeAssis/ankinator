---
phase: 02
slug: loader-pdf-langchain
status: verified
threats_open: 0
asvs_level: balanced
created: 2026-06-03
---

# Phase 02 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> Register authored at plan time (all 4 PLANs carry `<threat_model>` blocks) — auditor ran in **verify-mitigations** mode.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Node → Python sidecar (spawn argv) | `langchain-loader.ts` spawns `.py` with argv-array (no shell). | pdfPath, `--pages`, `--password` (secret) |
| Python stdout → Node (`JSON.parse`) | Sidecar stdout parsed by Node. Untrusted external-process input. | parsed document JSON |
| pip → PyPI (supply chain) | `pip install` pulls package + transitives. | package bytes |
| env var `ANKINATOR_PDF_LOADER` → loader selection | User env decides loader path; safe default `node` when unset. | loader name |
| `pythonBin()` env (`ANKINATOR_LANGCHAIN_PYTHON`/`ODL_PYTHON`) | User-set interpreter path. | interpreter path |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation / Evidence | Status |
|-----------|----------|-----------|-------------|------------------------|--------|
| T-02-SC | Tampering (supply chain) | `pip install langchain-opendataloader-pdf` | mitigate | Exact pin `==2.0.0` — `tools/requirements.txt:21`; opt-in dedicated venv | closed |
| T-02-03 | Tampering | argv `--pages`/`--password` → Python constructor | mitigate | argparse validates shape `odl_langchain_loader.py:37-52`; password → constructor only (`:74`), not logged | closed |
| T-02-05 | Tampering/Injection | `spawn(py, args)` | mitigate | argv-array `{ stdio:['ignore','pipe','pipe'] }` `langchain-loader.ts:51`; no `shell:true`; `redact()` scrubs password `:139-140` | closed |
| T-02-06 | Tampering | `JSON.parse(stdout)` of external process | mitigate | `JSON.parse` not eval `langchain-loader.ts:169`; malformed → SyntaxError re-thrown `:170-175` | closed |
| T-02-08 | Tampering | new branch in `loadDocument` regresses default | mitigate | strict `=== 'langchain'` `document-loader.ts:79`; default path `:90-97` unchanged when env unset | closed |
| T-02-01 | Tampering | `normalize(docs)` malformed input | accept | `coercePage()` guards page access `langchain-normalize.ts:53-55`; optional chaining `:100,180,197`; no eval | closed |
| T-02-02 | Denial of Service | large markdown join/regex | accept | all loops bounded `for...of`; no `while(true)`/unbounded recursion | closed |
| T-02-04 | Information Disclosure | stdout PDF content in logs | accept | no `writeFile`/`appendFile`/`createWriteStream`; stdout buffered `:52`, consumed by `JSON.parse` `:169` only | closed |
| T-02-07 | Spoofing | `pythonBin()` arbitrary interpreter via env | accept | reads only env vars `langchain-loader.ts:26-28`; no hardcoded paths; local single-user | closed |
| T-02-09 | Denial of Service | Java absent → runtime error on langchain path | accept | `code !== 0` throws + propagates `:149-157`; default Node path unaffected | closed |
| T-02-10 | Information Disclosure | stderr `[ankinator] loader:` log | accept | only loader NAME logged `document-loader.ts:82,86`; no content/secret/pdfPath | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-02-01 | T-02-01 | CLI local single-user; `coercePage()` defends all page access; no eval. Reconsider if multi-user/network-exposed. | gsd-security-auditor | 2026-06-03 |
| AR-02-02 | T-02-02 | Apostilas de concurso bounded; no unbounded loops. Reconsider for arbitrary-size external PDFs. | gsd-security-auditor | 2026-06-03 |
| AR-02-04 | T-02-04 | stdout consumed inline by `JSON.parse`, not persisted. Reconsider if logging middleware captures stdout. | gsd-security-auditor | 2026-06-03 |
| AR-02-07 | T-02-07 | Env vars set by local user; same trust boundary as `ODL_PYTHON` in prod. Reconsider for shared-env multi-user. | gsd-security-auditor | 2026-06-03 |
| AR-02-09 | T-02-09 | Java absent throws on opt-in path only; default Node path unaffected. Reconsider if langchain becomes default. | gsd-security-auditor | 2026-06-03 |
| AR-02-10 | T-02-10 | Log contains only string-literal loader name. Reconsider if pdfPath/opts added to log line. | gsd-security-auditor | 2026-06-03 |

*Accepted risks do not resurface in future audit runs.*

---

## Implementation Notes (non-blocking)

- **Password in `ps`/`/proc` during sidecar run (T-02-05):** password passed via argv → visible in `/proc/<pid>/cmdline` while sidecar runs. Documented residual at `langchain-loader.ts:136-138` (WR-04). Accepted scope; eliminating requires env/stdin passing (D-11 contract change).
- **Transitive deps not hash-pinned (T-02-SC):** only the direct package is pinned `==2.0.0`; pip resolves transitives at install. Acceptable for opt-in local tooling at this ASVS level.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-06-03 | 11 | 11 | 0 | gsd-security-auditor (verify-mitigations mode) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-06-03
