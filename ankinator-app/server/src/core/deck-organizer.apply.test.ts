/**
 * Testes de ORQUESTRAÇÃO do reorganizador (previewOrganize/applyOrganize) com o
 * AnkiConnect MOCKADO. Fecham a lacuna de cobertura dos caminhos destrutivos e travam
 * os 5 achados da revisão adversarial de segurança da Fatia 1.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock de TODAS as ops AnkiConnect usadas pelo deck-organizer (e pelo existing-deck,
// que importa notesInfoDoDeck do mesmo módulo) — nenhuma chamada de rede nos testes.
vi.mock('./exporters/ankiconnect.js', () => ({
  notesDoDeck: vi.fn(),
  notesInfoDoDeck: vi.fn(),
  cardIdsDoDeck: vi.fn(),
  cardIdsDiretosDoDeck: vi.fn(),
  moverCards: vi.fn(),
  apagarDecks: vi.fn(),
  adicionarTags: vi.fn(),
}));

import { previewOrganize, applyOrganize, type OrganizePlan } from './deck-organizer.js';
import {
  notesDoDeck,
  cardIdsDoDeck,
  cardIdsDiretosDoDeck,
  moverCards,
  apagarDecks,
  adicionarTags,
} from './exporters/ankiconnect.js';

beforeEach(() => vi.clearAllMocks());

describe('previewOrganize — dedup com decks sobrepostos (Finding 1)', () => {
  it('a MESMA nota em pai+subdeck é colapsada por noteId → nenhum repetido', async () => {
    vi.mocked(notesDoDeck).mockImplementation(async () => [
      { noteId: 1, front: 'O que é habeas corpus?', tags: [] }, // mesma nota retorna p/ pai E subdeck
    ]);
    const plan = await previewOrganize({ decks: ['Direito', 'Direito::Constitucional'], dedup: true });
    expect(plan.dedup!.groups).toEqual([]);
    expect(plan.dedup!.totalDuplicates).toBe(0);
  });

  it('controle positivo: notas DISTINTAS com o mesmo front continuam sendo agrupadas', async () => {
    vi.mocked(notesDoDeck).mockResolvedValue([
      { noteId: 1, front: 'O que é ACID?', tags: [] },
      { noteId: 2, front: 'O que é ACID?', tags: [] },
    ]);
    const plan = await previewOrganize({ decks: ['BD'], dedup: true });
    expect(plan.dedup!.groups).toHaveLength(1);
    expect(plan.dedup!.totalDuplicates).toBe(1);
  });
});

describe('applyOrganize — segurança do merge (Findings 2,3,4,5)', () => {
  it('NUNCA apaga o target, mesmo se o plano (adulterado) o listar (Finding 4)', async () => {
    vi.mocked(cardIdsDiretosDoDeck).mockResolvedValue([10, 11]);
    vi.mocked(moverCards).mockResolvedValue(undefined);
    vi.mocked(cardIdsDoDeck).mockResolvedValue([]); // tudo "vazio"
    vi.mocked(apagarDecks).mockResolvedValue(undefined);

    const plan: OrganizePlan = {
      decks: ['A', 'Alvo'], // target presente na seleção
      merge: { target: 'Alvo', moves: [{ deck: 'A', cardCount: 2 }], decksToDelete: ['A', 'Alvo'], preservedWithSubdecks: [], totalMoved: 2 },
    };
    const r = await applyOrganize(plan, { applyMerge: true });

    const apagados = vi.mocked(apagarDecks).mock.calls.flatMap((c) => c[0] as string[]);
    expect(apagados).not.toContain('Alvo'); // target jamais apagado
    expect(apagados).toContain('A');
    expect(r.merge!.deletedDecks).not.toContain('Alvo');
  });

  it('move CARDS DIRETOS (preserva subdecks) e só apaga origem que ficou vazia (Finding 2)', async () => {
    vi.mocked(cardIdsDiretosDoDeck).mockImplementation(async (d: string) => (d === 'A' ? [1, 2] : []));
    vi.mocked(moverCards).mockResolvedValue(undefined);
    // 'A' vazia (incl. subdecks); 'B' tem subdeck com card → preservada
    vi.mocked(cardIdsDoDeck).mockImplementation(async (d: string) => (d === 'A' ? [] : [99]));
    vi.mocked(apagarDecks).mockResolvedValue(undefined);

    const plan: OrganizePlan = {
      decks: ['A', 'B'],
      merge: { target: 'T', moves: [{ deck: 'A', cardCount: 2 }], decksToDelete: ['A'], preservedWithSubdecks: ['B'], totalMoved: 2 },
    };
    const r = await applyOrganize(plan, { applyMerge: true });

    expect(vi.mocked(cardIdsDiretosDoDeck)).toHaveBeenCalledWith('A', undefined); // move = cards diretos
    expect(vi.mocked(moverCards)).toHaveBeenCalledWith([1, 2], 'T', undefined);
    expect(r.merge!.movedCards).toBe(2);
    expect(r.merge!.deletedDecks).toEqual(['A']); // 'B' preservado (não-vazio)
  });

  it('plano malformado no merge (moves não-array) NÃO derruba o dedup — isolamento (Finding 3)', async () => {
    vi.mocked(cardIdsDoDeck).mockResolvedValue([7]); // X não-vazio → não apaga
    vi.mocked(adicionarTags).mockResolvedValue(undefined);
    const plan = {
      decks: ['X'],
      merge: { target: 'T', moves: null }, // malformado
      dedup: { groups: [{ keepNoteId: 1, dupNoteIds: [2], sampleFront: 'x', size: 2 }], totalDuplicates: 1, tag: 'duplicata' },
    } as unknown as OrganizePlan;

    const r = await applyOrganize(plan, { applyMerge: true, applyDedup: true });
    expect(vi.mocked(adicionarTags)).toHaveBeenCalledWith([2], ['duplicata'], undefined); // dedup rodou mesmo assim
    expect(r.dedup!.taggedNotes).toBe(1);
  });

  it('flag sem a seção correspondente → erro EXPLÍCITO, nunca no-op silencioso (Finding 5)', async () => {
    const plan: OrganizePlan = { decks: ['X'], dedup: { groups: [], totalDuplicates: 0, tag: 'duplicata' } };
    await expect(applyOrganize(plan, { applyMerge: true })).rejects.toThrow(/merge/i);
  });
});
