/**
 * Testes — section-grouping.ts (agrupamento hierárquico + revisor) e overlap do chunker.
 *
 * Regressão do bug 2026-06-04: rótulos de lista em negrito ("• Dados numéricos:") eram
 * detectados como headings nível 6 pelo OpenDataLoader; como buildSections abria uma
 * seção a cada heading, uma seção coerente ("1.4 Formatos de dados digitais") fraturava
 * em vários blocos minúsculos e isolados.
 */
import { describe, it, expect } from 'vitest';
import {
  regroupSections,
  reviewSections,
  groupSections,
  DEFAULT_BOUNDARY_LEVEL,
} from './section-grouping.js';
import { chunkDocument } from './chunker.js';
import type { LoadedDocument, Section } from './types.js';

let n = 0;
function sec(title: string, level: number, markdown: string, page = 17): Section {
  return { id: `s${n++}`, title, level, pageStart: page, pageEnd: page, markdown, charCount: markdown.length };
}

const longBody = (label: string) => 'x '.repeat(120) + label; // ~240 chars de corpo

// ── regroupSections (hierárquico) ───────────────────────────────────────────

describe('regroupSections — agrupamento hierárquico', () => {
  it('o caso do print: sub-headings de lista (nível 6) dobram no bloco pai (nível 2)', () => {
    const sections = [
      sec('1.4 Formatos de dados digitais', 2, `## 1.4 Formatos de dados digitais\n\n${longBody('Temos 5 grupos de tipos de dados.')}`),
      sec('• Dados numéricos:', 6, '###### • Dados numéricos:\n\nINT: inteiros. FLOAT: decimais. REAL: reais.'),
      sec('• Dados de datas:', 6, '###### • Dados de datas:\n\nDATE: datas. TIME: horas.'),
      sec('• Dados binários:', 6, '###### • Dados binários:\n\nBINARY. VARBINARY.'),
    ];

    const out = regroupSections(sections);

    // tudo virou UM bloco coerente
    expect(out).toHaveLength(1);
    expect(out[0].title).toBe('1.4 Formatos de dados digitais');
    // conteúdo dos sub-grupos preservado dentro do bloco pai
    expect(out[0].markdown).toContain('INT: inteiros');
    expect(out[0].markdown).toContain('DATE: datas');
    expect(out[0].markdown).toContain('BINARY');
    // sub-rótulos rebaixados para negrito — NÃO restam headings ###### dentro do bloco
    expect(out[0].markdown).toContain('**• Dados numéricos:**');
    expect(out[0].markdown).not.toContain('######');
    // páginas e charCount recalculados
    expect(out[0].charCount).toBe(out[0].markdown.length);
  });

  it('headings irmãos rasos (nível 2) permanecem em blocos separados', () => {
    const out = regroupSections([
      sec('1.4 Tema A', 2, `## 1.4 Tema A\n\n${longBody('a')}`),
      sec('1.5 Tema B', 2, `## 1.5 Tema B\n\n${longBody('b')}`),
    ]);
    expect(out).toHaveLength(2);
    expect(out.map((s) => s.title)).toEqual(['1.4 Tema A', '1.5 Tema B']);
  });

  it('boundary adaptativo: doc só com headings profundos ainda segmenta (não vira 1 blocão)', () => {
    // nenhum heading <= 3; o mais raso é 5 → boundary sobe para 5 (não some tudo num bloco)
    const out = regroupSections([
      sec('A', 5, `##### A\n\n${longBody('a')}`),
      sec('B', 5, `##### B\n\n${longBody('b')}`),
      sec('sub de B', 6, '###### sub de B\n\ndetalhe'),
    ]);
    expect(out).toHaveLength(2); // A, e B com "sub de B" dobrado dentro
    expect(out[1].markdown).toContain('detalhe');
    expect(out[1].markdown).toContain('**sub de B**');
  });

  it('1ª seção profunda sem pai não é perdida (vira o bloco aberto)', () => {
    const out = regroupSections([
      sec('órfã profunda', 6, '###### órfã profunda\n\nconteúdo'),
      sec('1 Título', 1, `# 1 Título\n\n${longBody('t')}`),
    ]);
    // boundary = max(3, min(6,1)=1) = 3; nível 6 abre (não há pai) → 2 blocos
    expect(out).toHaveLength(2);
    expect(out[0].markdown).toContain('conteúdo');
  });

  it('sem alteração para 0 ou 1 seção', () => {
    expect(regroupSections([])).toEqual([]);
    const one = [sec('única', 2, '## única\n\ncorpo')];
    expect(regroupSections(one)).toEqual(one);
  });
});

// ── reviewSections (revisor determinístico) ─────────────────────────────────

describe('reviewSections — funde órfãos e sinaliza curtos', () => {
  it('funde bloco só-título (corpo quase-vazio) no anterior', () => {
    const out = reviewSections([
      sec('Grande', 2, `## Grande\n\n${longBody('g')}`),
      sec('Capítulo X', 1, '# Capítulo X'), // só título, sem corpo
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].markdown).toContain('# Capítulo X');
  });

  it('a 1ª seção órfã funde no SEGUINTE (preserva título/level do bloco real)', () => {
    const out = reviewSections([
      sec('Capítulo', 1, '# Capítulo'), // órfã na 1ª posição
      sec('1.1 Conteúdo', 2, `## 1.1 Conteúdo\n\n${longBody('c')}`),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].title).toBe('1.1 Conteúdo');
    expect(out[0].markdown).toContain('# Capítulo');
  });

  it('sinaliza (aviso) blocos curtos que sobrevivem, sem fundi-los à força', () => {
    const curto = 'corpo de bloco curto com uma frase so, entre quarenta e cento e quarenta caracteres'; // ~82: 40<corpo<140
    const out = reviewSections([
      sec('Grande', 2, `## Grande\n\n${longBody('g')}`),
      sec('Curto', 2, `## Curto\n\n${curto}`),
    ]);
    expect(out).toHaveLength(2); // não fundiu (corpo >= mergeChars)
    expect(out[1].aviso).toBeDefined();
    expect(out[0].aviso).toBeUndefined();
  });

  it('bloco único nunca recebe aviso (é o documento inteiro)', () => {
    const out = reviewSections([sec('doc', 1, '# doc\n\nok')]);
    expect(out[0].aviso).toBeUndefined();
  });
});

// ── groupSections (pipeline) ────────────────────────────────────────────────

describe('groupSections — reagrupa e depois revisa', () => {
  it('boundary padrão é 3', () => {
    expect(DEFAULT_BOUNDARY_LEVEL).toBe(3);
  });

  it('caso do print ponta-a-ponta → 1 bloco coerente, sem aviso', () => {
    const out = groupSections([
      sec('1.4 Formatos de dados digitais', 2, `## 1.4 Formatos de dados digitais\n\n${longBody('Temos 5 grupos.')}`),
      sec('• Dados numéricos:', 6, '###### • Dados numéricos:\n\nINT, FLOAT, REAL'),
      sec('• Dados de datas:', 6, '###### • Dados de datas:\n\nDATE, TIME'),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].aviso).toBeUndefined();
    expect(out[0].markdown).toContain('INT, FLOAT, REAL');
  });
});

// ── chunker: sobreposição (overlap) ─────────────────────────────────────────

function docComSecoes(sections: Section[]): LoadedDocument {
  return {
    fileName: 'x.pdf', numPages: 1, title: null, markdown: '', sections, elements: [], usedOcr: false,
  };
}

describe('chunkDocument — overlap', () => {
  // duas seções grandes o bastante para virarem 2 blocos distintos (cada ~759 ≤ 1000; juntas > 1000)
  const big = (label: string) => sec(label, 2, `## ${label}\n\n` + `${label} `.repeat(150));

  it('overlapChars > 0 → blocos a partir do 2º recebem contextoAnterior; o 1º não', () => {
    const doc = docComSecoes([big('Alfa'), big('Beta')]);
    const chunks = chunkDocument(doc, { maxCharsPerChunk: 1000, overlapChars: 200 });
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0].contextoAnterior).toBeUndefined();
    expect(chunks[1].contextoAnterior).toBeDefined();
    // o contexto vem da cauda do bloco anterior
    expect(chunks[1].contextoAnterior!.length).toBeGreaterThan(0);
    expect(chunks[0].markdown).toContain(chunks[1].contextoAnterior!.slice(-20));
  });

  it('sem overlap (default 0) → nenhum bloco tem contextoAnterior (não-regressão)', () => {
    const doc = docComSecoes([big('Alfa'), big('Beta')]);
    const chunks = chunkDocument(doc, { maxCharsPerChunk: 1000 });
    expect(chunks.every((c) => c.contextoAnterior === undefined)).toBe(true);
  });
});
