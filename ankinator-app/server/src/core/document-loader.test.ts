/**
 * Testes unit — document-loader.ts (RT-05).
 *
 * Cobertura: chooseLoader() — seleção de loader sem spawnar Python/Java.
 * CLI-free: não usa isLangchainAvailable() real; injeta o resultado via parâmetro.
 */
import { describe, it, expect } from 'vitest';
import { chooseLoader } from './document-loader.js';

describe('chooseLoader RT-05', () => {
  // ── ANKINATOR_PDF_LOADER=langchain explícito ──────────────────────────────

  it('env=langchain + langchain disponível → escolhe langchain', () => {
    const { loader, reason } = chooseLoader('langchain', true);
    expect(loader).toBe('langchain');
    expect(reason).toContain('langchain');
  });

  it('env=langchain + langchain indisponível → lança erro com instrução de setup', () => {
    expect(() => chooseLoader('langchain', false)).toThrow(/ODL_PYTHON/);
  });

  // ── ANKINATOR_PDF_LOADER=node explícito ───────────────────────────────────

  it('env=node + langchain disponível → escolhe node (força explícita)', () => {
    const { loader, reason } = chooseLoader('node', true);
    expect(loader).toBe('node');
    expect(reason).toContain('node');
  });

  it('env=node + langchain indisponível → escolhe node', () => {
    const { loader } = chooseLoader('node', false);
    expect(loader).toBe('node');
  });

  // ── ANKINATOR_PDF_LOADER unset / auto ─────────────────────────────────────

  it('env=undefined + langchain disponível → auto-prefere langchain (RT-05)', () => {
    const { loader, reason } = chooseLoader(undefined, true);
    expect(loader).toBe('langchain');
    expect(reason).toContain('auto');
  });

  it('env=undefined + langchain indisponível → fallback para node com motivo (RT-05)', () => {
    const { loader, reason } = chooseLoader(undefined, false);
    expect(loader).toBe('node');
    expect(reason).toContain('auto');
  });

  it('env="" (vazio) + langchain disponível → tratado como unset → langchain', () => {
    const { loader } = chooseLoader('', true);
    expect(loader).toBe('langchain');
  });

  it('env="" (vazio) + langchain indisponível → tratado como unset → node', () => {
    const { loader } = chooseLoader('', false);
    expect(loader).toBe('node');
  });

  // ── Tolerância a maiúsculas/espaços ───────────────────────────────────────

  it('env="  LangChain  " (trim + lowercase) → comporta-se como langchain', () => {
    const { loader } = chooseLoader('  LangChain  ', true);
    expect(loader).toBe('langchain');
  });

  it('env="  NODE  " → comporta-se como node', () => {
    const { loader } = chooseLoader('  NODE  ', false);
    expect(loader).toBe('node');
  });
});
