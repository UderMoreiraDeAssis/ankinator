/**
 * Testes da lógica PURA do reorganizador de decks (deck-organizer.ts).
 * CLI-free e sem AnkiConnect — cobre groupDuplicates (repetidos) e planMerge (união).
 */
import { describe, it, expect } from 'vitest';
import { groupDuplicates, planMerge, DUP_TAG } from './deck-organizer.js';

describe('groupDuplicates', () => {
  it('agrupa duplicata EXATA (mantém a 1ª, marca a 2ª)', () => {
    const groups = groupDuplicates([
      { noteId: 1, front: 'Qual a capital do Brasil?' },
      { noteId: 2, front: 'Qual a capital do Brasil?' },
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].keepNoteId).toBe(1);
    expect(groups[0].dupNoteIds).toEqual([2]);
    expect(groups[0].size).toBe(2);
  });

  it('agrupa quase-duplicata por Jaccard ≥ limiar (reescrita próxima)', () => {
    const groups = groupDuplicates([
      { noteId: 10, front: 'Qual é a capital do Brasil?' },
      { noteId: 11, front: 'Qual a capital do Brasil?' },
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].dupNoteIds).toEqual([11]);
  });

  it('NÃO agrupa fronts claramente diferentes', () => {
    const groups = groupDuplicates([
      { noteId: 1, front: 'Capital do Brasil' },
      { noteId: 2, front: 'Maior rio do mundo em extensão' },
      { noteId: 3, front: 'Fórmula da água' },
    ]);
    expect(groups).toEqual([]);
  });

  it('três idênticas → 1 grupo de tamanho 3 (mantém 1, marca 2)', () => {
    const groups = groupDuplicates([
      { noteId: 1, front: 'O que é ACID?' },
      { noteId: 2, front: 'O que é ACID?' },
      { noteId: 3, front: 'O que é ACID?' },
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].keepNoteId).toBe(1);
    expect(groups[0].dupNoteIds).toEqual([2, 3]);
    expect(groups[0].size).toBe(3);
  });

  it('front vazio (sem texto comparável) não entra em grupo algum', () => {
    const groups = groupDuplicates([
      { noteId: 1, front: '   ' },
      { noteId: 2, front: '<br>' },
    ]);
    expect(groups).toEqual([]);
  });

  it('limpa HTML no sampleFront', () => {
    const groups = groupDuplicates([
      { noteId: 1, front: '<b>Capital</b> do Brasil?' },
      { noteId: 2, front: 'Capital do Brasil?' },
    ]);
    expect(groups[0].sampleFront).not.toContain('<b>');
    expect(groups[0].sampleFront).toContain('Capital do Brasil');
  });

  it('mesma nota repetida (mesmo noteId) NÃO é duplicata de si mesma — decks sobrepostos (regressão)', () => {
    // Cenário: selecionar pai + subdeck faz a mesma nota aparecer 2× na lista.
    const groups = groupDuplicates([
      { noteId: 7, front: 'O que é um índice?' },
      { noteId: 7, front: 'O que é um índice?' },
    ]);
    expect(groups).toEqual([]);
  });
});

describe('planMerge', () => {
  it('target ENTRE os selecionados nunca é movido nem apagado', () => {
    const plan = planMerge(
      [
        { deck: 'A', directCount: 3, hasSubdeckCards: false },
        { deck: 'B', directCount: 2, hasSubdeckCards: false },
        { deck: 'Alvo', directCount: 1, hasSubdeckCards: false },
      ],
      'Alvo'
    );
    expect(plan.moves.map((m) => m.deck)).toEqual(['A', 'B']);
    expect(plan.decksToDelete).toEqual(['A', 'B']);
    expect(plan.decksToDelete).not.toContain('Alvo');
    expect(plan.totalMoved).toBe(5);
  });

  it('target NOVO (fora dos selecionados): todas as origens entram em moves e delete', () => {
    const plan = planMerge(
      [
        { deck: 'A', directCount: 3, hasSubdeckCards: false },
        { deck: 'B', directCount: 2, hasSubdeckCards: false },
      ],
      'Combinado'
    );
    expect(plan.target).toBe('Combinado');
    expect(plan.moves.map((m) => m.deck)).toEqual(['A', 'B']);
    expect(plan.decksToDelete).toEqual(['A', 'B']);
    expect(plan.totalMoved).toBe(5);
  });

  it('deck vazio fica fora de moves mas ainda é apagado (origem ≠ target, sem subdecks)', () => {
    const plan = planMerge(
      [
        { deck: 'Vazio', directCount: 0, hasSubdeckCards: false },
        { deck: 'B', directCount: 2, hasSubdeckCards: false },
      ],
      'T'
    );
    expect(plan.moves.map((m) => m.deck)).toEqual(['B']); // 'Vazio' não move
    expect(plan.decksToDelete).toEqual(['Vazio', 'B']); // mas é apagado
    expect(plan.totalMoved).toBe(2);
  });

  it('origem COM subdecks é PRESERVADA (não apagada) e só move cards diretos (regressão)', () => {
    const plan = planMerge(
      [
        { deck: 'Pai', directCount: 2, hasSubdeckCards: true },
        { deck: 'Folha', directCount: 3, hasSubdeckCards: false },
      ],
      'T'
    );
    expect(plan.moves.map((m) => m.deck)).toEqual(['Pai', 'Folha']); // ambos movem cards DIRETOS
    expect(plan.decksToDelete).toEqual(['Folha']); // só a folha (sem subdecks) é apagada
    expect(plan.preservedWithSubdecks).toEqual(['Pai']); // Pai preservado (tem subdeck cheio)
    expect(plan.totalMoved).toBe(5);
  });
});

describe('DUP_TAG', () => {
  it('a tag default das cópias extras é "duplicata" (não-destrutivo)', () => {
    expect(DUP_TAG).toBe('duplicata');
  });
});
