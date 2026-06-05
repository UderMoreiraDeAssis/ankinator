/**
 * Testes unit — odl-parse.ts (RT-fidelidade).
 *
 * Regressão do bug em que nós `list` do OpenDataLoader eram 100% descartados:
 * os itens moram no campo `"list items"` (não em `content`/`kids`), então as
 * alternativas A-E de questões e róis taxativos sumiam dos chunks vistos pelo modelo.
 */
import { describe, it, expect } from 'vitest';
import { flattenNodes, type RawNode } from './odl-parse.js';

describe('odl-parse — captura de listas (RT-fidelidade)', () => {
  it('nó "list" com "list items" → alternativas A-E preservadas no DocElement', () => {
    const json: RawNode[] = [
      { type: 'paragraph', 'page number': 36, content: '(CEBRASPE/DPE RO/2022) ... é o' },
      {
        type: 'list',
        id: 9,
        'page number': 36,
        'list items': [
          { type: 'list item', content: 'a) modelo físico.' },
          { type: 'list item', content: 'b) esquema do banco de dados.' },
          { type: 'list item', content: 'c) diagrama de fluxo de dados.' },
          { type: 'list item', content: 'd) modelo lógico.' },
          { type: 'list item', content: 'e) modelo conceitual.' },
        ],
      },
    ];
    const els = flattenNodes(json);
    const listEl = els.find((e) => e.type === 'list');
    expect(listEl).toBeDefined();
    expect(listEl!.page).toBe(36);
    for (const alt of ['a) modelo físico.', 'b) esquema do banco de dados.', 'c) diagrama de fluxo de dados.', 'd) modelo lógico.', 'e) modelo conceitual.']) {
      expect(listEl!.content).toContain(alt);
    }
  });

  it('item de lista com kids aninhados → conteúdo aninhado também é capturado', () => {
    const json: RawNode[] = [
      {
        type: 'list',
        'page number': 1,
        'list items': [
          { type: 'list item', content: 'I - primeiro', kids: [{ type: 'paragraph', 'page number': 1, content: 'detalhe do primeiro' }] },
        ],
      },
    ];
    const listEl = flattenNodes(json).find((e) => e.type === 'list');
    expect(listEl!.content).toContain('I - primeiro');
    expect(listEl!.content).toContain('detalhe do primeiro');
  });

  it('lista sem itens → não emite elemento (sem ruído)', () => {
    const els = flattenNodes([{ type: 'list', 'page number': 1, 'list items': [] }]);
    expect(els.find((e) => e.type === 'list')).toBeUndefined();
  });

  it('parágrafos e headings continuam capturados (não-regressão)', () => {
    const els = flattenNodes([
      { type: 'heading', 'heading level': 2, 'page number': 1, content: 'Título' },
      { type: 'paragraph', 'page number': 1, content: 'corpo' },
    ]);
    expect(els.map((e) => e.type)).toEqual(['heading', 'paragraph']);
    expect(els[0].content).toBe('Título');
  });
});
