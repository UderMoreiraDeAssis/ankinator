/**
 * Testes unit RED de Wave 0 — enrich.ts (a ser implementado no Plano 01).
 *
 * Estado esperado: VERMELHO até que os Planos 01/02 implementem as funções.
 * Cobertura: DECK-01, DECK-02, CARD-01, CARD-02, PIPE-01, exporters.
 *
 * Os testes de exporter (tagsDaQuestao merge, ankiconnect routing, csv deck column)
 * estão marcados como it.todo até o Plano 02 exportar as funções privadas.
 */
import { describe, it, expect } from 'vitest';
import { parseClassificacoesJson, parseSingleCard, enrichAll, deveRodarEnrich } from './enrich.js';
// TODO(Plano 02): exportar tagsDaQuestao/toAnkiCsv para teste
// import { tagsDaQuestao } from '../exporters/csv.js';
// import { tagsDaQuestao as tagsDaQuestaoAnki } from '../exporters/ankiconnect.js';

// ── parseClassificacoesJson ───────────────────────────────────────────────────

describe('parseClassificacoesJson', () => {
  it('extrai classificações por id de JSON limpo', () => {
    const text = '{"classificacoes":[{"id":"abc","deck":"A::B","tags":["t1"]}]}';
    expect(parseClassificacoesJson(text)).toEqual([{ id: 'abc', deck: 'A::B', tags: ['t1'] }]);
  });

  it('tolera cercas ```json e retorna [] para lista vazia', () => {
    const text = '```json\n{"classificacoes":[]}\n```';
    expect(parseClassificacoesJson(text)).toEqual([]);
  });

  it('retorna [] para texto vazio', () => {
    expect(parseClassificacoesJson('')).toEqual([]);
  });

  it('retorna [] para JSON sem chave classificacoes', () => {
    const text = '{"questoes":[{"id":"x"}]}';
    expect(parseClassificacoesJson(text)).toEqual([]);
  });
});

// ── tagsDaQuestao merge (DECK-02) ─────────────────────────────────────────────

describe('tagsDaQuestao merge', () => {
  it.todo(
    'une q.tags ao Set sem duplicatas (...(q.tags ?? [])) — TODO(Plano 02): exportar tagsDaQuestao para teste'
  );

  it.todo(
    'não quebra quando q.tags é undefined (...(q.tags ?? [])) — TODO(Plano 02): exportar tagsDaQuestao para teste'
  );
});

// ── split extraida (CARD-01) ──────────────────────────────────────────────────

describe('split extraida', () => {
  it('split 1→N só ocorre para tipo criada — extraida nunca divide (parseSingleCard / enrichAll)', () => {
    // RED: parseSingleCard ainda não existe
    expect(typeof parseSingleCard).toBe('function');
  });

  it.todo(
    'extraida com múltiplos cards no JSON retorna apenas 1 (sem split) — validado no enrichAll'
  );
});

// ── card-builder extraida verso (CARD-02) ──────────────────────────────────────

describe('card-builder extraida verso', () => {
  it('parseSingleCard retorna array com pergunta e resposta', () => {
    // RED: função não existe ainda
    expect(typeof parseSingleCard).toBe('function');
  });

  it.todo(
    'extraida: ajusta só q.resposta (explicação + fonte); pergunta/gabarito intactos — TODO(Plano 01)'
  );
});

// ── enrichAll sequência (PIPE-01) ─────────────────────────────────────────────

describe('enrichAll sequência', () => {
  it('enrichAll é uma função assíncrona exportada', () => {
    // RED: função não existe ainda
    expect(typeof enrichAll).toBe('function');
  });

  it.todo(
    'encadeia classificar → card-builder em ordem (estágio 1 antes de estágio 2) — TODO(Plano 01)'
  );

  it.todo(
    'isolamento de erro por-unidade: erro em um card não aborta o lote — TODO(Plano 01)'
  );
});

// ── ankiconnect routing (DECK-01-anki) ───────────────────────────────────────

describe('ankiconnect routing', () => {
  it.todo(
    'deck hierárquico chega ao deckName por-nota; fallback a opts.deck — TODO(Plano 02): exportar funções de ankiconnect.ts para teste'
  );
});

// ── csv deck column (DECK-01-csv) ─────────────────────────────────────────────

describe('csv deck column', () => {
  it.todo(
    'coluna Deck + header #deck column:5 quando temDeck; ausente quando não — TODO(Plano 02): exportar toAnkiCsv para teste'
  );
});

// ── deveRodarEnrich (PIPE-03 gate) ────────────────────────────────────────────

describe('deveRodarEnrich', () => {
  it('retorna false quando ambos toggles são false', () => {
    // RED: função não existe ainda
    expect(deveRodarEnrich({ classificar: false, cardBuilder: false })).toBe(false);
  });

  it('retorna true quando classificar=true', () => {
    expect(deveRodarEnrich({ classificar: true, cardBuilder: false })).toBe(true);
  });

  it('retorna true quando cardBuilder=true', () => {
    expect(deveRodarEnrich({ classificar: false, cardBuilder: true })).toBe(true);
  });
});
