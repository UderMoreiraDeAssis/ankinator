/**
 * Fatia 2 (re-hierarquização + padronização de tags) — testes das funções PURAS.
 * Não tocam o Anki (planejamento puro). A orquestração/apply destrutivos exigem
 * revisão adversarial + validação AO VIVO em deck descartável antes de confiar.
 */
import { describe, it, expect } from 'vitest';
import { canonTag, planTagStd, planRehier } from './deck-organizer.js';

describe('Fatia 2 — canonTag', () => {
  it('normaliza namespace, acento, caixa e separadores', () => {
    expect(canonTag('Banca::FGV')).toBe('fgv');
    expect(canonTag('FGV')).toBe('fgv');
    expect(canonTag('Transações')).toBe('transacoes');
    expect(canonTag('ano::2023')).toBe('2023');
    expect(canonTag('Modelo Relacional')).toBe('modelo-relacional');
  });
});

describe('Fatia 2 — planTagStd', () => {
  it('agrupa variantes e elege a canônica (mais frequente)', () => {
    const counts = new Map<string, number>([
      ['FGV', 2],
      ['fgv', 1],
      ['banca::fgv', 1],
      ['2023', 3],
    ]);
    const plan = planTagStd(counts);
    expect(plan.groups).toHaveLength(1);
    expect(plan.groups[0].canonical).toBe('FGV');
    expect([...plan.groups[0].variants].sort()).toEqual(['banca::fgv', 'fgv']);
    expect(plan.totalVariants).toBe(2);
  });
  it('não cria grupo p/ tag sem divergência', () => {
    expect(planTagStd(new Map([['unica', 5]])).groups).toHaveLength(0);
  });
});

describe('Fatia 2 — planRehier', () => {
  const notes = [
    { noteId: 1, front: 'q1', cards: [11], deckAtual: 'Velho' }, // move
    { noteId: 2, front: 'q2', cards: [22], deckAtual: 'BD::ACID' }, // == sugestão → unchanged
    { noteId: 3, front: 'q3', cards: [], deckAtual: 'Velho' }, // sem cards → semSugestao
    { noteId: 4, front: 'q4', cards: [44], deckAtual: 'Velho' }, // sem sugestão → semSugestao
  ];
  const byId = new Map<string, { deck?: string }>([
    ['1', { deck: 'BD::Transações' }],
    ['2', { deck: 'BD::ACID' }],
    ['3', { deck: 'BD::X' }],
  ]);

  it('move só notas com sugestão != atual e com cards', () => {
    const plan = planRehier(notes, byId);
    expect(plan.moves).toHaveLength(1);
    expect(plan.moves[0]).toMatchObject({ noteId: 1, to: 'BD::Transações', from: 'Velho', cards: [11] });
    expect(plan.unchanged).toBe(1); // nota 2
    expect(plan.semSugestao).toBe(2); // nota 3 (sem cards) + nota 4 (sem sugestão)
    expect(plan.total).toBe(4);
  });

  it('aninha sob base quando fornecido', () => {
    const plan = planRehier([notes[0]], new Map([['1', { deck: 'A::B' }]]), 'Raiz');
    expect(plan.moves[0].to).toBe('Raiz::A::B');
  });
});
