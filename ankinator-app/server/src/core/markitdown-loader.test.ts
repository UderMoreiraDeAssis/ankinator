/**
 * Testes unit — markitdown-loader.ts (CLI-free).
 *
 * Cobertura:
 *   1. parseSidecarOutput() — guardas CR-02 (array?, page_content:string?) e
 *      parse determinístico do stdout JSON do sidecar.
 *   2. normalize() com 1 Document (page=1) — contrato do loader markitdown:
 *      numPages===1 (limitação documentada) e seções a partir de headings ATX.
 *
 * NÃO spawna Python. Prova o CONTRATO sem rodar o sidecar.
 * NÃO modifica langchain-normalize.ts — testa o reuso conforme especificado.
 */
import { describe, it, expect } from 'vitest';
import { parseSidecarOutput } from './markitdown-loader.js';
import { normalize } from './langchain-normalize.js';

// ── parseSidecarOutput: guardas CR-02 ────────────────────────────────────────

describe('parseSidecarOutput — guardas CR-02 (T-k3b-03)', () => {
  const emptyOpts = {};

  it('stdout JSON válido com 1 Document → retorna array', () => {
    const stdout = JSON.stringify([
      { page_content: '# Título\n\ntexto do documento', metadata: { source: '/x/a.pdf', format: 'markdown', page: 1 } },
    ]);
    const result = parseSidecarOutput(stdout, '', emptyOpts);
    expect(result).toHaveLength(1);
    expect(result[0].page_content).toBe('# Título\n\ntexto do documento');
    expect(result[0].metadata.page).toBe(1);
  });

  it('stdout não é JSON → lança erro contextual', () => {
    expect(() => parseSidecarOutput('not json here', 'some stderr', emptyOpts)).toThrow(
      /stdout não é JSON válido/
    );
  });

  it('stdout é objeto (não array) → lança erro', () => {
    expect(() => parseSidecarOutput('{"ok": true}', '', emptyOpts)).toThrow(
      /esperado array de Documents/
    );
  });

  it('stdout é null → lança erro', () => {
    expect(() => parseSidecarOutput('null', '', emptyOpts)).toThrow(
      /esperado array de Documents/
    );
  });

  it('stdout array com item sem page_content → lança erro', () => {
    const stdout = JSON.stringify([{ metadata: { page: 1 } }]);
    expect(() => parseSidecarOutput(stdout, '', emptyOpts)).toThrow(
      /Document\[0\] inválido/
    );
  });

  it('stdout array com page_content número (não string) → lança erro', () => {
    const stdout = JSON.stringify([{ page_content: 42, metadata: { page: 1 } }]);
    expect(() => parseSidecarOutput(stdout, '', emptyOpts)).toThrow(
      /Document\[0\] inválido/
    );
  });

  it('redação de senha no stderr quando stdout inválido', () => {
    const opts = { password: 'senha-secreta' };
    let errMsg = '';
    try {
      parseSidecarOutput('not json', 'erro com senha-secreta aqui', opts);
    } catch (e) {
      errMsg = (e as Error).message;
    }
    expect(errMsg).not.toContain('senha-secreta');
    expect(errMsg).toContain('***');
  });
});

// ── normalize() com 1 Document (page=1) — contrato do markitdown loader ─────

describe('normalize() reusado com 1 Document — contrato markitdown (RESEARCH A.2)', () => {
  it('numPages === 1 (limitação documentada: blob único, page=1)', () => {
    const docs = [
      { page_content: '# Título\n\ntexto', metadata: { source: '/x/a.pdf', format: 'markdown', page: 1 } },
    ];
    const result = normalize(docs, '/x/a.pdf');
    expect(result.numPages).toBe(1);
  });

  it('fileName derivado do pdfPath', () => {
    const docs = [
      { page_content: '# Título\n\ntexto', metadata: { source: '/docs/apostila.pdf', format: 'markdown', page: 1 } },
    ];
    const result = normalize(docs, '/docs/apostila.pdf');
    expect(result.fileName).toBe('apostila.pdf');
  });

  it('title = 1º heading ATX', () => {
    const docs = [
      { page_content: '# Direito Constitucional\n\nConteúdo do capítulo.', metadata: { page: 1 } },
    ];
    const result = normalize(docs, '/x/b.pdf');
    expect(result.title).toBe('Direito Constitucional');
  });

  it('seções extraídas de headings ATX (buildSectionsFromMarkdown)', () => {
    const docs = [
      {
        page_content: '# Capítulo 1\n\nTexto intro.\n\n## Seção 1.1\n\nConteúdo relevante.',
        metadata: { page: 1 },
      },
    ];
    const result = normalize(docs, '/x/c.pdf');
    // Deve ter pelo menos 1 seção (pode ser agrupada pelo groupSections)
    expect(result.sections.length).toBeGreaterThan(0);
    // Todas as seções devem ter pageStart e pageEnd igual a 1 (blob único)
    for (const s of result.sections) {
      expect(s.pageStart).toBe(1);
      expect(s.pageEnd).toBe(1);
    }
  });

  it('conteúdo sem headings → 1 seção fallback com título derivado do arquivo', () => {
    const docs = [
      { page_content: 'Parágrafo sem heading.\nMais texto aqui.', metadata: { page: 1 } },
    ];
    const result = normalize(docs, '/x/apostila-direito.pdf');
    expect(result.sections).toHaveLength(1);
    expect(result.sections[0].pageStart).toBe(1);
  });

  it('usedOcr deve ser false (markitdown não usa OCR)', () => {
    const docs = [
      { page_content: '# Doc\n\ntexto', metadata: { page: 1 } },
    ];
    const result = normalize(docs, '/x/d.pdf');
    expect(result.usedOcr).toBe(false);
  });
});
