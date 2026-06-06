/**
 * Testes unit — document-loader.ts (RT-05).
 *
 * Cobertura: chooseLoader() — seleção de loader sem spawnar Python/Java.
 * CLI-free: não usa isLangchainAvailable()/isMarkitdownAvailable() reais;
 * injeta os resultados via parâmetro.
 */
import { describe, it, expect } from 'vitest';
import { chooseLoader } from './document-loader.js';

describe('chooseLoader RT-05', () => {
  // ── ANKINATOR_PDF_LOADER=langchain explícito ──────────────────────────────

  it('env=langchain + langchain disponível → escolhe langchain', () => {
    const { loader, reason } = chooseLoader('langchain', true, false);
    expect(loader).toBe('langchain');
    expect(reason).toContain('langchain');
  });

  it('env=langchain + langchain indisponível → lança erro com instrução de setup', () => {
    expect(() => chooseLoader('langchain', false, false)).toThrow(/ODL_PYTHON/);
  });

  // ── ANKINATOR_PDF_LOADER=node explícito ───────────────────────────────────

  it('env=node + langchain disponível → escolhe node (força explícita)', () => {
    const { loader, reason } = chooseLoader('node', true, false);
    expect(loader).toBe('node');
    expect(reason).toContain('node');
  });

  it('env=node + langchain indisponível → escolhe node', () => {
    const { loader } = chooseLoader('node', false, false);
    expect(loader).toBe('node');
  });

  // ── ANKINATOR_PDF_LOADER unset / auto ─────────────────────────────────────

  it('env=undefined + langchain disponível → auto-prefere langchain (RT-05)', () => {
    const { loader, reason } = chooseLoader(undefined, true, false);
    expect(loader).toBe('langchain');
    expect(reason).toContain('auto');
  });

  it('env=undefined + langchain indisponível → fallback para node com motivo (RT-05)', () => {
    const { loader, reason } = chooseLoader(undefined, false, false);
    expect(loader).toBe('node');
    expect(reason).toContain('auto');
  });

  it('env="" (vazio) + langchain disponível → tratado como unset → langchain', () => {
    const { loader } = chooseLoader('', true, false);
    expect(loader).toBe('langchain');
  });

  it('env="" (vazio) + langchain indisponível → tratado como unset → node', () => {
    const { loader } = chooseLoader('', false, false);
    expect(loader).toBe('node');
  });

  // ── Tolerância a maiúsculas/espaços ───────────────────────────────────────

  it('env="  LangChain  " (trim + lowercase) → comporta-se como langchain', () => {
    const { loader } = chooseLoader('  LangChain  ', true, false);
    expect(loader).toBe('langchain');
  });

  it('env="  NODE  " → comporta-se como node', () => {
    const { loader } = chooseLoader('  NODE  ', false, false);
    expect(loader).toBe('node');
  });

  // ── ANKINATOR_PDF_LOADER=markitdown (novo — opt-in, A1) ──────────────────

  it('env=markitdown + markitdown disponível → escolhe markitdown', () => {
    const { loader, reason } = chooseLoader('markitdown', false, true);
    expect(loader).toBe('markitdown');
    expect(reason).toContain('markitdown');
  });

  it('env=markitdown + markitdown indisponível → lança erro com instrução de setup', () => {
    expect(() => chooseLoader('markitdown', false, false)).toThrow(/ANKINATOR_MARKITDOWN_PYTHON/);
  });

  it('env=markitdown + markitdown indisponível → mensagem menciona requirements-markitdown.txt', () => {
    expect(() => chooseLoader('markitdown', false, false)).toThrow(/requirements-markitdown\.txt/);
  });

  it('env=undefined + markitdown disponível → NUNCA auto-seleciona markitdown (default intocado — A1)', () => {
    const { loader } = chooseLoader(undefined, false, true);
    // Mesmo com markitdown disponível, auto-seleção é sempre node (langchain indisponível)
    expect(loader).toBe('node');
  });

  it('env=undefined + langchain disponível + markitdown disponível → auto-seleciona langchain (não markitdown)', () => {
    const { loader } = chooseLoader(undefined, true, true);
    expect(loader).toBe('langchain');
  });

  it('env="  MARKITDOWN  " (trim + lowercase) → comporta-se como markitdown', () => {
    const { loader } = chooseLoader('  MARKITDOWN  ', false, true);
    expect(loader).toBe('markitdown');
  });
});
