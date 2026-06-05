import { describe, it, expect } from 'vitest';
import {
  parseDeckText,
  normalizeForDedup,
  stripHtml,
  jaccard,
  partitionNovas,
} from './existing-deck.js';
import { buildUserMessage } from './prompts.js';
import type { GenerateOptions } from './types.js';

describe('stripHtml', () => {
  it('remove tags, <br>, [sound:], cloze e entidades', () => {
    expect(stripHtml('<b>Olá</b> mundo')).toBe('Olá mundo');
    expect(stripHtml('a<br>b')).toBe('a b');
    expect(stripHtml('x [sound:y.mp3] z')).toBe('x z');
    expect(stripHtml('{{c1::resposta::dica}} fim')).toBe('resposta fim');
    expect(stripHtml('Tom &amp; Jerry &lt;3')).toBe('Tom & Jerry <3');
  });
});

describe('normalizeForDedup', () => {
  it('minúsculas, sem acento, sem pontuação, espaços colapsados', () => {
    expect(normalizeForDedup('O que é ACID?')).toBe('o que e acid');
    expect(normalizeForDedup('  Múltipla   escolha! ')).toBe('multipla escolha');
  });
});

describe('parseDeckText (export plain-text do Anki)', () => {
  it('TSV simples: 1ª coluna = front', () => {
    const txt = 'Pergunta 1\tResposta 1\nPergunta 2\tResposta 2';
    expect(parseDeckText(txt)).toEqual(['Pergunta 1', 'Pergunta 2']);
  });

  it('respeita #separator e ignora cabeçalhos #', () => {
    const txt = ['#separator:comma', '#html:true', 'Frente A,Verso A', 'Frente B,Verso B'].join('\n');
    expect(parseDeckText(txt)).toEqual(['Frente A', 'Frente B']);
  });

  it('pula colunas meta (deck/notetype/tags) e pega o 1º campo de conteúdo', () => {
    const txt = [
      '#separator:tab',
      '#notetype column:1',
      '#deck column:2',
      'Basic\tMeuDeck\tQual a capital?\tBrasília',
    ].join('\n');
    expect(parseDeckText(txt)).toEqual(['Qual a capital?']);
  });

  it('remove HTML dos campos e ignora linhas vazias', () => {
    const txt = '<b>Negrito</b>\tx\n\n<i>Itálico</i>\ty';
    expect(parseDeckText(txt)).toEqual(['Negrito', 'Itálico']);
  });

  it('desfaz aspas de campo', () => {
    const txt = '"Campo, com vírgula"\tverso';
    expect(parseDeckText(txt)).toEqual(['Campo, com vírgula']);
  });
});

describe('jaccard', () => {
  it('1 para conjuntos iguais, 0 para disjuntos', () => {
    expect(jaccard(new Set(['a', 'b']), new Set(['a', 'b']))).toBe(1);
    expect(jaccard(new Set(['a']), new Set(['b']))).toBe(0);
  });
});

describe('partitionNovas (anti-duplicata mecânica)', () => {
  const getP = (q: { pergunta: string }) => q.pergunta;

  it('descarta duplicata exata (ignorando acento/caixa/HTML)', () => {
    const geradas = [{ pergunta: 'O que e ACID?' }, { pergunta: 'Nova pergunta sobre índices' }];
    const existentes = ['<b>O que é ACID?</b>'];
    const { novas, duplicadas } = partitionNovas(geradas, existentes, getP);
    expect(duplicadas.map(getP)).toEqual(['O que e ACID?']);
    expect(novas.map(getP)).toEqual(['Nova pergunta sobre índices']);
  });

  it('descarta quase-duplicata por similaridade de tokens', () => {
    const geradas = [{ pergunta: 'Quais são as quatro propriedades ACID de uma transação?' }];
    const existentes = ['Quais as quatro propriedades ACID de uma transação'];
    const { novas, duplicadas } = partitionNovas(geradas, existentes, getP);
    expect(novas).toHaveLength(0);
    expect(duplicadas).toHaveLength(1);
  });

  it('mantém questões genuinamente novas', () => {
    const geradas = [{ pergunta: 'O que é normalização de banco de dados?' }];
    const existentes = ['O que é uma chave estrangeira?'];
    const { novas } = partitionNovas(geradas, existentes, getP);
    expect(novas).toHaveLength(1);
  });

  it('deck vazio → tudo é novo', () => {
    const geradas = [{ pergunta: 'A' }, { pergunta: 'B' }];
    const { novas, duplicadas } = partitionNovas(geradas, [], getP);
    expect(novas).toHaveLength(2);
    expect(duplicadas).toHaveLength(0);
  });
});

describe('buildUserMessage — geração incremental', () => {
  const base: GenerateOptions = { incluirExtraidas: true, incluirCriadas: true };

  it('SEM existingQuestions: não injeta bloco de deck (não-regressão PIPE-03)', () => {
    const msg = buildUserMessage('conteúdo', ['Seção'], base);
    expect(msg).not.toContain('JÁ EXISTENTES NO DECK');
    expect(msg).not.toContain('retorne {"questoes":[]}');
  });

  it('COM existingQuestions: injeta bloco anti-duplicata + instrução de vazio', () => {
    const msg = buildUserMessage('conteúdo', ['Seção'], { ...base, existingQuestions: ['Pergunta antiga A'] });
    expect(msg).toContain('JÁ EXISTENTES NO DECK');
    expect(msg).toContain('Pergunta antiga A');
    expect(msg).toContain('retorne {"questoes":[]}');
  });
});
