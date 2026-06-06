/**
 * Testes unit — turbovec.ts (CLI-free).
 *
 * Cobertura: parseSmokeOutput() — parse determinístico do JSON de saída do smoke.
 * NÃO spawna Python. Prova o CONTRATO sem rodar o sidecar.
 *
 * Objetivo: detectar drift de API turbovec (projeto v0.x — RESEARCH E2).
 * Se turbovec mudar o shape do JSON de saída do smoke, estes testes quebram —
 * alerta que o pin ou o sidecar precisam ser revisados.
 */
import { describe, it, expect } from 'vitest';
import { parseSmokeOutput } from './turbovec.js';

describe('parseSmokeOutput — contrato do smoke JSON (RESEARCH B.2 / E2)', () => {
  // ── Happy path ────────────────────────────────────────────────────────────

  it('JSON válido {ok:true, k:5, top_indices:[...]} → retorna resultado tipado', () => {
    const stdout = JSON.stringify({ ok: true, k: 5, top_indices: [0, 12, 3, 7, 1] });
    const result = parseSmokeOutput(stdout, '');
    expect(result.ok).toBe(true);
    expect(result.k).toBe(5);
    expect(result.top_indices).toEqual([0, 12, 3, 7, 1]);
  });

  it('JSON com k diferente → retorna com k correto', () => {
    const stdout = JSON.stringify({ ok: true, k: 3, top_indices: [0, 5, 2] });
    const result = parseSmokeOutput(stdout, '');
    expect(result.k).toBe(3);
    expect(result.top_indices).toHaveLength(3);
  });

  // ── Erros de contrato ─────────────────────────────────────────────────────

  it('stdout não é JSON → lança erro contextual', () => {
    expect(() => parseSmokeOutput('not valid json', 'some stderr')).toThrow(
      /stdout não é JSON válido/
    );
  });

  it('stdout é null → lança erro', () => {
    expect(() => parseSmokeOutput('null', '')).toThrow(/esperado objeto JSON/);
  });

  it('stdout é array (não objeto) → lança erro', () => {
    expect(() => parseSmokeOutput('[1,2,3]', '')).toThrow(/esperado objeto JSON/);
  });

  it('objeto sem ok → lança erro', () => {
    const stdout = JSON.stringify({ k: 5, top_indices: [0, 1] });
    expect(() => parseSmokeOutput(stdout, '')).toThrow(/esperado \{ok: true\}/);
  });

  it('ok === false → lança erro', () => {
    const stdout = JSON.stringify({ ok: false, error: 'falhou' });
    expect(() => parseSmokeOutput(stdout, 'stderr text')).toThrow(/esperado \{ok: true\}/);
  });

  it('ok === null → lança erro', () => {
    const stdout = JSON.stringify({ ok: null, k: 5 });
    expect(() => parseSmokeOutput(stdout, '')).toThrow(/esperado \{ok: true\}/);
  });

  it('ok === 1 (truthy mas não true) → lança erro (contrato estrito)', () => {
    const stdout = JSON.stringify({ ok: 1, k: 5, top_indices: [0] });
    expect(() => parseSmokeOutput(stdout, '')).toThrow(/esperado \{ok: true\}/);
  });

  // ── Contexto de erro no stderr ────────────────────────────────────────────

  it('inclui trecho do stderr na mensagem de erro de JSON inválido', () => {
    let errMsg = '';
    try {
      parseSmokeOutput('not json', 'TurboQuantIndex: dimension mismatch');
    } catch (e) {
      errMsg = (e as Error).message;
    }
    expect(errMsg).toContain('TurboQuantIndex: dimension mismatch');
  });
});
