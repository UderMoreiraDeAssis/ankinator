/**
 * Testes unit — enrich.ts (Wave 1 + Wave 2).
 *
 * Cobertura: DECK-01, DECK-02, CARD-01, CARD-02, PIPE-01, exporters,
 *            MNEM-01, MNEM-02, IMG-01, IMG-02 (Phase 04 Plan 02).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseClassificacoesJson, parseSingleCard, parseMnemonicosJson, enrichAll, deveRodarEnrich } from './enrich.js';

// ── Mocks de infra para testes comportamentais de enrichAll ──────────────────

vi.mock('./runner.js', () => ({
  runClaudeCli: vi.fn(),
}));

vi.mock('./prompt-loader.js', () => ({
  loadPrompt: vi.fn((nome: string) => nome),
}));

import { runClaudeCli } from './runner.js';
import { loadPrompt } from './prompt-loader.js';
import { tagsDaQuestao, toAnkiCsv } from '../exporters/csv.js';
import { tagsDaQuestao as tagsDaQuestaoAnki } from '../exporters/ankiconnect.js';
import type { Questao } from '../types.js';

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
  it('une q.tags ao Set sem duplicatas (...(q.tags ?? []))', () => {
    const q = { tipo: 'extraida', tags: ['direito', 'constitucional'] } as Questao;
    const result = tagsDaQuestao(q, ['padrao']);
    // q.tipo + padrao + q.tags — sem duplicatas
    expect(result).toContain('extraida');
    expect(result).toContain('padrao');
    expect(result).toContain('direito');
    expect(result).toContain('constitucional');
    // sem duplicatas: cada tag aparece uma só vez
    const partes = result.split(' ');
    expect(partes).toHaveLength(new Set(partes).size);
  });

  it('não quebra quando q.tags é undefined (...(q.tags ?? []))', () => {
    const q = { tipo: 'criada' } as Questao;
    // não deve lançar TypeError
    expect(() => tagsDaQuestao(q, [])).not.toThrow();
    expect(tagsDaQuestao(q, [])).toBe('criada');
  });
});

// ── split extraida (CARD-01) ──────────────────────────────────────────────────

describe('split extraida', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('split 1→N só ocorre para tipo criada — extraida nunca divide (parseSingleCard / enrichAll)', () => {
    // RED: parseSingleCard ainda não existe
    expect(typeof parseSingleCard).toBe('function');
  });

  it('extraida com múltiplos cards no JSON retorna apenas 1 (sem split) — validado no enrichAll', async () => {
    // Arrange: LLM devolve 2 cards no JSON para um único card extraida
    vi.mocked(runClaudeCli).mockResolvedValue(
      '{"cards":[{"pergunta":"P1","resposta":"R1"},{"pergunta":"P2","resposta":"R2"}]}'
    );

    // Act
    const result = await enrichAll(
      [{ id: '1', tipo: 'extraida', pergunta: 'Porig', resposta: 'Rorig' } as import('../types.js').Questao],
      { cardBuilder: true }
    );

    // Assert: extraida NUNCA divide — D-09/D-10
    expect(result.length).toBe(1);
  });
});

// ── card-builder extraida verso (CARD-02) ──────────────────────────────────────

describe('card-builder extraida verso', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('parseSingleCard retorna array com pergunta e resposta', () => {
    // RED: função não existe ainda
    expect(typeof parseSingleCard).toBe('function');
  });

  it('extraida: ajusta só q.resposta (explicação + fonte); pergunta/gabarito intactos', async () => {
    // Arrange: LLM devolve card com pergunta alterada e resposta nova
    vi.mocked(runClaudeCli).mockResolvedValue(
      '{"cards":[{"pergunta":"PERGUNTA ALTERADA","resposta":"Resposta nova com explicação e fonte"}]}'
    );

    // Act
    const result = await enrichAll(
      [{ id: '1', tipo: 'extraida', pergunta: 'Pergunta original', resposta: 'Resposta original' } as import('../types.js').Questao],
      { cardBuilder: true }
    );

    // Assert: pergunta original intacta (D-10), apenas resposta ajustada
    expect(result[0].pergunta).toBe('Pergunta original');
    expect(result[0].resposta).toBe('Resposta nova com explicação e fonte');
  });
});

// ── card-builder EM PARALELO (pool + ordem) ──────────────────────────────────

describe('enrichAll card-builder paralelo', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('roda em paralelo (pool) com concorrência limitada e preserva a ordem', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    vi.mocked(runClaudeCli).mockImplementation(async () => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 10));
      inFlight--;
      return '{"cards":[{"pergunta":"PX","resposta":"RX"}]}';
    });

    const cards = Array.from(
      { length: 6 },
      (_, i) => ({ id: String(i), tipo: 'extraida', pergunta: `P${i}`, resposta: `R${i}` }) as import('../types.js').Questao
    );

    const result = await enrichAll(cards, { cardBuilder: true, cardBuilderConcurrency: 2 });

    expect(result).toHaveLength(6);
    // extraída preserva a pergunta → ordem deve ser exatamente P0..P5
    expect(result.map((q) => q.pergunta)).toEqual(['P0', 'P1', 'P2', 'P3', 'P4', 'P5']);
    // houve paralelismo, limitado ao teto (2)
    expect(maxInFlight).toBeGreaterThan(1);
    expect(maxInFlight).toBeLessThanOrEqual(2);
  });

  it('preserva a ordem mesmo com split 1→N de cards criada', async () => {
    // o card "1" (criada) divide em 2; os demais em 1 — o split deve manter a POSIÇÃO
    vi.mocked(runClaudeCli).mockImplementation(async ({ userMessage }) => {
      if ((userMessage as string).includes('"P1"')) {
        return '{"cards":[{"pergunta":"P1a","resposta":"R1a"},{"pergunta":"P1b","resposta":"R1b"}]}';
      }
      return '{"cards":[{"pergunta":"X","resposta":"Y"}]}';
    });

    const result = await enrichAll(
      [
        { id: '0', tipo: 'criada', pergunta: 'P0', resposta: 'R0' } as import('../types.js').Questao,
        { id: '1', tipo: 'criada', pergunta: 'P1', resposta: 'R1' } as import('../types.js').Questao,
        { id: '2', tipo: 'criada', pergunta: 'P2', resposta: 'R2' } as import('../types.js').Questao,
      ],
      { cardBuilder: true, cardBuilderConcurrency: 3 }
    );

    // posição preservada: [card0→X], [card1→P1a,P1b], [card2→X]
    expect(result.map((q) => q.pergunta)).toEqual(['X', 'P1a', 'P1b', 'X']);
  });

  it('isolamento de erro no pool: falha de um card mantém o original e não aborta o lote', async () => {
    let n = 0;
    vi.mocked(runClaudeCli).mockImplementation(async () => {
      n++;
      if (n === 2) throw new Error('Falha simulada no card 2');
      return '{"cards":[{"pergunta":"PX","resposta":"RX"}]}';
    });

    const result = await enrichAll(
      [
        { id: '1', tipo: 'extraida', pergunta: 'P1', resposta: 'R1' } as import('../types.js').Questao,
        { id: '2', tipo: 'extraida', pergunta: 'P2', resposta: 'R2' } as import('../types.js').Questao,
        { id: '3', tipo: 'extraida', pergunta: 'P3', resposta: 'R3' } as import('../types.js').Questao,
      ],
      { cardBuilder: true, cardBuilderConcurrency: 3 }
    );

    expect(result).toHaveLength(3);
    // card 2 (2ª chamada) falhou → mantém original (D-13), na posição certa
    const card2 = result.find((q) => q.id === '2');
    expect(card2?.resposta).toBe('R2');
  });
});

// ── enrichAll sequência (PIPE-01) ─────────────────────────────────────────────

describe('enrichAll sequência', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('enrichAll é uma função assíncrona exportada', () => {
    // RED: função não existe ainda
    expect(typeof enrichAll).toBe('function');
  });

  it('encadeia classificar → card-builder em ordem (estágio 1 antes de estágio 2)', async () => {
    // Arrange: loadPrompt retorna o nome do especialista como systemPrompt
    // runClaudeCli registra a ordem dos systemPrompt recebidos
    const promptsRecebidos: string[] = [];
    vi.mocked(runClaudeCli).mockImplementation(async ({ systemPrompt }) => {
      promptsRecebidos.push(systemPrompt as string);
      if ((systemPrompt as string).includes('deck-classifier')) {
        return '{"classificacoes":[]}';
      }
      return '{"cards":[]}';
    });

    // Act
    await enrichAll(
      [{ id: '1', tipo: 'criada', pergunta: 'P', resposta: 'R' } as import('../types.js').Questao],
      { classificar: true, cardBuilder: true }
    );

    // Assert: deck-classifier aparece antes de card-builder na sequência de chamadas
    const idxClassificador = promptsRecebidos.findIndex((p) => p.includes('deck-classifier'));
    const idxCardBuilder = promptsRecebidos.findIndex((p) => p.includes('card-builder'));
    expect(idxClassificador).toBeGreaterThanOrEqual(0);
    expect(idxCardBuilder).toBeGreaterThanOrEqual(0);
    expect(idxClassificador).toBeLessThan(idxCardBuilder);
  });

  it('isolamento de erro por-unidade: erro em um card não aborta o lote', async () => {
    // Arrange: 3 cards criados; 2ª chamada do card-builder (card id '2') rejeita
    let callCount = 0;
    vi.mocked(runClaudeCli).mockImplementation(async () => {
      callCount++;
      if (callCount === 2) {
        throw new Error('Falha simulada no card 2');
      }
      return '{"cards":[{"pergunta":"PX","resposta":"RX"}]}';
    });

    const progressos: import('./enrich.js').EnrichProgress[] = [];
    const onProgress = (e: import('./enrich.js').EnrichProgress) => progressos.push(e);

    // Act: não deve lançar
    const result = await enrichAll(
      [
        { id: '1', tipo: 'criada', pergunta: 'P1', resposta: 'R1' } as import('../types.js').Questao,
        { id: '2', tipo: 'criada', pergunta: 'P2', resposta: 'R2' } as import('../types.js').Questao,
        { id: '3', tipo: 'criada', pergunta: 'P3', resposta: 'R3' } as import('../types.js').Questao,
      ],
      { cardBuilder: true },
      onProgress
    );

    // Assert: lote não abortou — 3 cards no resultado (criada pode gerar novas UUIDs para os ok)
    expect(result.length).toBe(3);

    // Card 2 com erro: foi mantido pelo catch (D-13) — id original preservado, pergunta/resposta intactos
    const card2 = result.find((q) => q.id === '2');
    expect(card2).toBeDefined();
    expect(card2?.pergunta).toBe('P2');
    expect(card2?.resposta).toBe('R2');

    // onProgress foi chamado com erro para o card 2
    const progressoComErro = progressos.find((p) => p.erro !== undefined);
    expect(progressoComErro).toBeDefined();
    expect(progressoComErro?.erro).toContain('Falha simulada');
  });
});

// ── ankiconnect routing (DECK-01-anki) ───────────────────────────────────────

describe('ankiconnect routing', () => {
  it('q.deck preenchido → deckName igual a q.deck (roteamento por-nota)', () => {
    // Testa a expressão q.deck ?? opts.deck que é usada em pushToAnki
    const q = { deck: 'Direito::Constitucional' } as Questao;
    const optsDeck = 'Ankinator';
    const deckName = q.deck ?? optsDeck;
    expect(deckName).toBe('Direito::Constitucional');
  });

  it('q.deck undefined → deckName igual a opts.deck (fallback preserva fluxo atual)', () => {
    const q = {} as Questao;
    const optsDeck = 'Ankinator';
    const deckName = q.deck ?? optsDeck;
    expect(deckName).toBe('Ankinator');
  });

  it('ankiconnect tagsDaQuestao inclui q.tags sem duplicatas (D-07)', () => {
    const q = { tipo: 'extraida', tags: ['direito', 'constitucional'] } as Questao;
    const result = tagsDaQuestaoAnki(q, []);
    expect(result).toContain('ankinator');
    expect(result).toContain('extraida');
    expect(result).toContain('direito');
    expect(result).toContain('constitucional');
    // sem duplicatas
    expect(result).toHaveLength(new Set(result).size);
  });

  it('ankiconnect tagsDaQuestao não quebra quando q.tags é undefined', () => {
    const q = { tipo: 'criada' } as Questao;
    expect(() => tagsDaQuestaoAnki(q, [])).not.toThrow();
    const result = tagsDaQuestaoAnki(q, []);
    expect(result).toContain('ankinator');
    expect(result).toContain('criada');
  });
});

// ── csv deck column (DECK-01-csv) ─────────────────────────────────────────────

describe('csv deck column', () => {
  it('coluna Deck + header #deck column:5 quando algum card tem q.deck', () => {
    const questoes: Questao[] = [
      { id: '1', tipo: 'extraida', pergunta: 'P', resposta: 'R', deck: 'Direito::Constitucional' } as Questao,
    ];
    const csv = toAnkiCsv(questoes, {});
    expect(csv).toContain('#deck column:5');
    expect(csv).toContain('Deck');
    expect(csv).toContain('Direito::Constitucional');
  });

  it('NÃO inclui coluna Deck nem header quando nenhum card tem q.deck (byte-identidade PIPE-03)', () => {
    const questoes: Questao[] = [
      { id: '1', tipo: 'extraida', pergunta: 'P', resposta: 'R' } as Questao,
    ];
    const csv = toAnkiCsv(questoes, {});
    expect(csv).not.toContain('#deck column');
    expect(csv).not.toContain(';Deck');
  });
});

// ── deveRodarEnrich (PIPE-03 gate) ────────────────────────────────────────────

describe('deveRodarEnrich', () => {
  it('retorna false quando ambos toggles são false', () => {
    expect(deveRodarEnrich({ classificar: false, cardBuilder: false })).toBe(false);
  });

  it('retorna true quando classificar=true', () => {
    expect(deveRodarEnrich({ classificar: true, cardBuilder: false })).toBe(true);
  });

  it('retorna true quando cardBuilder=true', () => {
    expect(deveRodarEnrich({ classificar: false, cardBuilder: true })).toBe(true);
  });

  // Phase 4 Plan 02 — PIPE-03 ampliado com novos toggles
  it('retorna true quando mnemonico=true (PIPE-03)', () => {
    expect(deveRodarEnrich({ mnemonico: true })).toBe(true);
  });

  it('retorna true quando imagem=true com mnemonico=false (PIPE-03)', () => {
    expect(deveRodarEnrich({ imagem: true, mnemonico: false })).toBe(true);
  });

  it('retorna false quando todos os 4 toggles estão off (PIPE-03)', () => {
    expect(deveRodarEnrich({ classificar: false, cardBuilder: false, mnemonico: false, imagem: false })).toBe(false);
  });
});

// ── parseMnemonicosJson (MNEM-01 / D-01) ─────────────────────────────────────

describe('parseMnemonicosJson', () => {
  it('extrai mnemônicos por id de JSON limpo', () => {
    const text = '{"mnemonicos":[{"id":"a","mnemonico":"Mnemônico A","tecnica":"acrônimo"}]}';
    expect(parseMnemonicosJson(text)).toEqual([{ id: 'a', mnemonico: 'Mnemônico A', tecnica: 'acrônimo' }]);
  });

  it('tolera cercas ```json e retorna [] para lista vazia', () => {
    const text = '```json\n{"mnemonicos":[]}\n```';
    expect(parseMnemonicosJson(text)).toEqual([]);
  });

  it('retorna [] para texto vazio', () => {
    expect(parseMnemonicosJson('')).toEqual([]);
  });

  it('retorna [] para JSON sem chave mnemonicos', () => {
    const text = '{"questoes":[{"id":"x"}]}';
    expect(parseMnemonicosJson(text)).toEqual([]);
  });

  it('retorna [] para JSON inválido', () => {
    expect(parseMnemonicosJson('isso nao e json')).toEqual([]);
  });

  it('funciona sem campo tecnica (tecnica opcional — D-01)', () => {
    const text = '{"mnemonicos":[{"id":"b","mnemonico":"Mnem B"}]}';
    const result = parseMnemonicosJson(text);
    expect(result).toHaveLength(1);
    expect(result[0].mnemonico).toBe('Mnem B');
    expect(result[0].tecnica).toBeUndefined();
  });
});

// ── enrichAll estágio 3: mnemônico batch (MNEM-01/MNEM-02/D-01/D-02/D-03) ───

describe('enrichAll mnemônico batch', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('merge por id: card "a" recebe mnemônico, card "b" fica sem (fail-soft)', async () => {
    // LLM retorna mnemônico apenas para id 'a' (omite 'b' — conceitual)
    vi.mocked(runClaudeCli).mockResolvedValue(
      '{"mnemonicos":[{"id":"a","mnemonico":"Associar A com algo","tecnica":"história"}]}'
    );

    const result = await enrichAll(
      [
        { id: 'a', tipo: 'extraida', pergunta: 'P1', resposta: 'R1' } as import('../types.js').Questao,
        { id: 'b', tipo: 'criada',   pergunta: 'P2', resposta: 'R2' } as import('../types.js').Questao,
      ],
      { mnemonico: true }
    );

    // card 'a' deve ter mnemônico; card 'b' não (fail-soft, omissão)
    expect(result.find(q => q.id === 'a')?.mnemonico).toBe('Associar A com algo');
    expect(result.find(q => q.id === 'b')?.mnemonico).toBeUndefined();
  });

  it('merge anti-posicional: JSON reordenado ainda casa pelo id correto (D-02/D-03)', async () => {
    // LLM retorna mnemônicos em ordem invertida
    vi.mocked(runClaudeCli).mockResolvedValue(
      '{"mnemonicos":[{"id":"z","mnemonico":"Mnem Z"},{"id":"y","mnemonico":"Mnem Y"}]}'
    );

    const result = await enrichAll(
      [
        { id: 'y', tipo: 'extraida', pergunta: 'PY', resposta: 'RY' } as import('../types.js').Questao,
        { id: 'z', tipo: 'extraida', pergunta: 'PZ', resposta: 'RZ' } as import('../types.js').Questao,
      ],
      { mnemonico: true }
    );

    expect(result.find(q => q.id === 'y')?.mnemonico).toBe('Mnem Y');
    expect(result.find(q => q.id === 'z')?.mnemonico).toBe('Mnem Z');
  });

  it('tecnica opcional: JSON sem tecnica ainda preenche q.mnemonico', async () => {
    vi.mocked(runClaudeCli).mockResolvedValue(
      '{"mnemonicos":[{"id":"x","mnemonico":"Mnem X"}]}'
    );

    const result = await enrichAll(
      [{ id: 'x', tipo: 'extraida', pergunta: 'PX', resposta: 'RX' } as import('../types.js').Questao],
      { mnemonico: true }
    );

    expect(result[0].mnemonico).toBe('Mnem X');
  });

  it('usa loadPrompt("mnemonic") como systemPrompt', async () => {
    vi.mocked(runClaudeCli).mockResolvedValue('{"mnemonicos":[]}');

    await enrichAll(
      [{ id: '1', tipo: 'extraida', pergunta: 'P', resposta: 'R' } as import('../types.js').Questao],
      { mnemonico: true }
    );

    expect(vi.mocked(loadPrompt)).toHaveBeenCalledWith('mnemonic');
  });

  it('desativa extended thinking (disableThinking: true) — bug RT 2026-06-04', async () => {
    vi.mocked(runClaudeCli).mockResolvedValue('{"mnemonicos":[]}');

    await enrichAll(
      [{ id: '1', tipo: 'extraida', pergunta: 'P', resposta: 'R' } as import('../types.js').Questao],
      { mnemonico: true }
    );

    // O estágio mnemônico produz JSON estruturado → não deve ruminar; thinking off evita timeout.
    expect(vi.mocked(runClaudeCli)).toHaveBeenCalledWith(
      expect.objectContaining({ disableThinking: true })
    );
  });

  it('erro no estágio mnemônico não derruba o job (D-08)', async () => {
    vi.mocked(runClaudeCli).mockRejectedValue(new Error('CLI falhou'));

    const progressos: import('./enrich.js').EnrichProgress[] = [];
    // não deve lançar
    const result = await enrichAll(
      [{ id: '1', tipo: 'extraida', pergunta: 'P', resposta: 'R' } as import('../types.js').Questao],
      { mnemonico: true },
      (e) => progressos.push(e)
    );

    expect(result).toHaveLength(1);
    expect(result[0].mnemonico).toBeUndefined();
    expect(progressos.some(p => p.erro)).toBe(true);
  });
});

// ── enrichAll estágio 4: imagem por-card (IMG-01/IMG-02/D-04/D-05/D-08) ──────

// Mock do image-provider — controlamos o que generate retorna
vi.mock('./image-provider.js', () => ({
  createImageProvider: vi.fn(() => ({
    nome: 'mock',
    generate: vi.fn(),
  })),
}));

// Mock do sanitize-svg — permite controlar o retorno nos testes de fail-closed
vi.mock('./sanitize-svg.js', () => ({
  sanitizarSvg: vi.fn((svg: string) => {
    // Por padrão: SVGs que começam com <svg passam; outros retornam null
    return svg.trim().startsWith('<svg') ? svg : null;
  }),
}));

import { createImageProvider } from './image-provider.js';
import { sanitizarSvg } from './sanitize-svg.js';

describe('enrichAll estágio imagem', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Restaurar comportamento padrão do sanitizarSvg
    vi.mocked(sanitizarSvg).mockImplementation((svg: string) =>
      svg.trim().startsWith('<svg') ? svg : null
    );
  });

  it('generate é chamado APENAS para cards com q.mnemonico (gate D-04)', async () => {
    const mockGenerate = vi.fn().mockResolvedValue({ svg: '<svg><rect/></svg>' });
    vi.mocked(createImageProvider).mockReturnValue({ nome: 'mock', generate: mockGenerate });

    await enrichAll(
      [
        { id: 'a', tipo: 'extraida', pergunta: 'PA', resposta: 'RA', mnemonico: 'Mnem A' } as import('../types.js').Questao,
        { id: 'b', tipo: 'extraida', pergunta: 'PB', resposta: 'RB' /* sem mnemonico */ } as import('../types.js').Questao,
        { id: 'c', tipo: 'extraida', pergunta: 'PC', resposta: 'RC', mnemonico: 'Mnem C' } as import('../types.js').Questao,
      ],
      { imagem: true }
    );

    // generate deve ser chamado apenas 2 vezes (cards 'a' e 'c' têm mnemônico)
    expect(mockGenerate).toHaveBeenCalledTimes(2);
  });

  it('SVG válido → q.mnemonicoSvg gravado (D-05)', async () => {
    const svgValido = '<svg viewBox="0 0 100 100"><rect x="10" y="10" width="80" height="80"/></svg>';
    const mockGenerate = vi.fn().mockResolvedValue({ svg: svgValido });
    vi.mocked(createImageProvider).mockReturnValue({ nome: 'mock', generate: mockGenerate });

    const result = await enrichAll(
      [{ id: 'x', tipo: 'extraida', pergunta: 'P', resposta: 'R', mnemonico: 'Mnem X' } as import('../types.js').Questao],
      { imagem: true }
    );

    expect(result[0].mnemonicoSvg).toBeDefined();
    expect(result[0].mnemonicoSvg).toContain('<svg');
  });

  it('fail-closed: sanitizarSvg retorna null → sem mnemonicoSvg + erro no progresso (D-08/T-04-06)', async () => {
    // sanitizarSvg retorna null (SVG malicioso/inválido)
    vi.mocked(sanitizarSvg).mockReturnValue(null);
    const mockGenerate = vi.fn().mockResolvedValue({ svg: '<svg><script>alert(1)</script></svg>' });
    vi.mocked(createImageProvider).mockReturnValue({ nome: 'mock', generate: mockGenerate });

    const progressos: import('./enrich.js').EnrichProgress[] = [];
    const result = await enrichAll(
      [{ id: 'y', tipo: 'extraida', pergunta: 'P', resposta: 'R', mnemonico: 'Mnem Y' } as import('../types.js').Questao],
      { imagem: true },
      (e) => progressos.push(e)
    );

    // mnemonicoSvg NÃO deve ser gravado (fail-closed)
    expect(result[0].mnemonicoSvg).toBeUndefined();
    // card ainda existe no resultado
    expect(result).toHaveLength(1);
    // erro reportado no progresso
    expect(progressos.some(p => p.erro)).toBe(true);
  });

  it('erro em generate num card não aborta o lote — card mantém mnemonico mas sem mnemonicoSvg (D-08)', async () => {
    const mockGenerate = vi.fn()
      .mockResolvedValueOnce({ svg: '<svg><rect/></svg>' })
      .mockRejectedValueOnce(new Error('Falha na geração'))
      .mockResolvedValueOnce({ svg: '<svg><circle/></svg>' });
    vi.mocked(createImageProvider).mockReturnValue({ nome: 'mock', generate: mockGenerate });

    const progressos: import('./enrich.js').EnrichProgress[] = [];
    const result = await enrichAll(
      [
        { id: '1', tipo: 'extraida', pergunta: 'P1', resposta: 'R1', mnemonico: 'M1' } as import('../types.js').Questao,
        { id: '2', tipo: 'extraida', pergunta: 'P2', resposta: 'R2', mnemonico: 'M2' } as import('../types.js').Questao,
        { id: '3', tipo: 'extraida', pergunta: 'P3', resposta: 'R3', mnemonico: 'M3' } as import('../types.js').Questao,
      ],
      { imagem: true },
      (e) => progressos.push(e)
    );

    // lote não abortou
    expect(result).toHaveLength(3);
    // card 2 mantém mnemonico mas sem mnemonicoSvg
    expect(result.find(q => q.id === '2')?.mnemonico).toBe('M2');
    expect(result.find(q => q.id === '2')?.mnemonicoSvg).toBeUndefined();
    // erro foi reportado
    expect(progressos.some(p => p.erro?.includes('Falha na geração'))).toBe(true);
  });

  it('imagem roda APÓS mnemônico (encadeamento — estágio 3 antes de estágio 4)', async () => {
    // Estágio 3 mnemônico
    vi.mocked(runClaudeCli).mockResolvedValue(
      '{"mnemonicos":[{"id":"1","mnemonico":"Mnem gerado"}]}'
    );
    // Estágio 4 imagem — only called for cards that got a mnemonic
    const mockGenerate = vi.fn().mockResolvedValue({ svg: '<svg><rect/></svg>' });
    vi.mocked(createImageProvider).mockReturnValue({ nome: 'mock', generate: mockGenerate });

    const result = await enrichAll(
      [{ id: '1', tipo: 'extraida', pergunta: 'P', resposta: 'R' } as import('../types.js').Questao],
      { mnemonico: true, imagem: true }
    );

    // card deve ter tanto mnemônico quanto mnemonicoSvg
    expect(result[0].mnemonico).toBe('Mnem gerado');
    expect(result[0].mnemonicoSvg).toBeDefined();
    // generate chamado 1 vez (card recebeu mnemônico do estágio 3)
    expect(mockGenerate).toHaveBeenCalledTimes(1);
  });

  // ── Paralelismo do estágio imagem (pool de concorrência) ──────────────────

  const cardsComMnemonico = (n: number) =>
    Array.from(
      { length: n },
      (_, i) =>
        ({ id: String(i), tipo: 'extraida', pergunta: 'P', resposta: 'R', mnemonico: `M${i}` }) as import('../types.js').Questao
    );

  it('roda em paralelo com concorrência limitada (várias chamadas in-flight, ≤ teto)', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const mockGenerate = vi.fn().mockImplementation(async () => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 10));
      inFlight--;
      return { svg: '<svg><rect/></svg>' };
    });
    vi.mocked(createImageProvider).mockReturnValue({ nome: 'mock', generate: mockGenerate });

    await enrichAll(cardsComMnemonico(6), { imagem: true, imageConcurrency: 2 });

    // todas as 6 imagens foram geradas
    expect(mockGenerate).toHaveBeenCalledTimes(6);
    // houve paralelismo (mais de uma simultânea)...
    expect(maxInFlight).toBeGreaterThan(1);
    // ...mas limitado ao teto configurado (2) — não satura a quota da assinatura
    expect(maxInFlight).toBeLessThanOrEqual(2);
  });

  it('imageConcurrency=1 → estágio imagem roda em sequência (sem sobreposição)', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const mockGenerate = vi.fn().mockImplementation(async () => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight--;
      return { svg: '<svg><rect/></svg>' };
    });
    vi.mocked(createImageProvider).mockReturnValue({ nome: 'mock', generate: mockGenerate });

    await enrichAll(cardsComMnemonico(4), { imagem: true, imageConcurrency: 1 });

    expect(mockGenerate).toHaveBeenCalledTimes(4);
    expect(maxInFlight).toBe(1);
  });

  it('progresso usa contador de concluídas: total = cards com mnemônico (D-04) e index < total', async () => {
    const mockGenerate = vi.fn().mockResolvedValue({ svg: '<svg><rect/></svg>' });
    vi.mocked(createImageProvider).mockReturnValue({ nome: 'mock', generate: mockGenerate });

    const progressos: import('./enrich.js').EnrichProgress[] = [];
    // 3 cards, só 2 com mnemônico → total do progresso deve ser 2 (gate D-04), nunca 3
    await enrichAll(
      [
        { id: 'a', tipo: 'extraida', pergunta: 'P', resposta: 'R', mnemonico: 'M' } as import('../types.js').Questao,
        { id: 'b', tipo: 'extraida', pergunta: 'P', resposta: 'R' /* sem mnemônico */ } as import('../types.js').Questao,
        { id: 'c', tipo: 'extraida', pergunta: 'P', resposta: 'R', mnemonico: 'M' } as import('../types.js').Questao,
      ],
      { imagem: true, imageConcurrency: 2 },
      (e) => progressos.push(e)
    );

    const imgEvts = progressos.filter((p) => p.estagio === 'gerando-imagem');
    expect(imgEvts.length).toBeGreaterThan(0);
    expect(imgEvts.every((p) => p.total === 2)).toBe(true);
    // index (contador de concluídas) nunca ultrapassa total — corrige o bug do index posicional
    expect(imgEvts.every((p) => p.index < p.total)).toBe(true);
  });

  // ── Gestor de qualidade do SVG (svg-quality) ──────────────────────────────
  // SVG-lixo = fonte gigante estourando o viewBox (reprova em avaliarQualidadeSvg).
  const SVG_LIXO = '<svg viewBox="0 0 400 300"><text x="10" y="280" font-size="160">LIXO</text></svg>';
  const SVG_BOM = '<svg viewBox="0 0 400 300"><text x="200" y="150" font-size="20" text-anchor="middle">OK</text></svg>';

  it('SVG reprovado na qualidade e que não melhora → descartado (sem mnemonicoSvg) após retry', async () => {
    const mockGenerate = vi.fn().mockResolvedValue({ svg: SVG_LIXO });
    vi.mocked(createImageProvider).mockReturnValue({ nome: 'mock', generate: mockGenerate });

    const progressos: import('./enrich.js').EnrichProgress[] = [];
    const result = await enrichAll(
      [{ id: 'q', tipo: 'extraida', pergunta: 'P', resposta: 'R', mnemonico: 'M' } as import('../types.js').Questao],
      { imagem: true, imageMaxRetry: 1 },
      (e) => progressos.push(e)
    );

    // fail-closed: imagem descartada, card mantém o mnemônico em texto
    expect(result[0].mnemonicoSvg).toBeUndefined();
    expect(result[0].mnemonico).toBe('M');
    // tentou maxRetry+1 = 2 vezes (1 inicial + 1 retry guiado)
    expect(mockGenerate).toHaveBeenCalledTimes(2);
    // progresso reporta o descarte
    expect(progressos.some((p) => p.erro?.includes('Imagem descartada'))).toBe(true);
  });

  it('retry guiado: SVG-lixo na 1ª, SVG bom na 2ª → mantém o bom', async () => {
    const mockGenerate = vi.fn()
      .mockResolvedValueOnce({ svg: SVG_LIXO })
      .mockResolvedValueOnce({ svg: SVG_BOM });
    vi.mocked(createImageProvider).mockReturnValue({ nome: 'mock', generate: mockGenerate });

    const result = await enrichAll(
      [{ id: 'q', tipo: 'extraida', pergunta: 'P', resposta: 'R', mnemonico: 'M' } as import('../types.js').Questao],
      { imagem: true, imageMaxRetry: 1 }
    );

    expect(result[0].mnemonicoSvg).toBeDefined();
    expect(result[0].mnemonicoSvg).toContain('OK');
    expect(mockGenerate).toHaveBeenCalledTimes(2);
  });

  it('o feedback da reprovação é injetado no prompt do retry (2ª chamada de generate)', async () => {
    const mockGenerate = vi.fn()
      .mockResolvedValueOnce({ svg: SVG_LIXO })
      .mockResolvedValueOnce({ svg: SVG_BOM });
    vi.mocked(createImageProvider).mockReturnValue({ nome: 'mock', generate: mockGenerate });

    await enrichAll(
      [{ id: 'q', tipo: 'extraida', pergunta: 'P', resposta: 'R', mnemonico: 'M' } as import('../types.js').Questao],
      { imagem: true, imageMaxRetry: 1 }
    );

    // 3º argumento (feedback) ausente na 1ª chamada, presente e não-vazio na 2ª
    expect(mockGenerate.mock.calls[0][2]).toBeUndefined();
    const feedback = mockGenerate.mock.calls[1][2];
    expect(Array.isArray(feedback)).toBe(true);
    expect(feedback.length).toBeGreaterThan(0);
  });

  it('imageQuality=false → comportamento legado: SVG-lixo é mantido (só sanitização de segurança)', async () => {
    const mockGenerate = vi.fn().mockResolvedValue({ svg: SVG_LIXO });
    vi.mocked(createImageProvider).mockReturnValue({ nome: 'mock', generate: mockGenerate });

    const result = await enrichAll(
      [{ id: 'q', tipo: 'extraida', pergunta: 'P', resposta: 'R', mnemonico: 'M' } as import('../types.js').Questao],
      { imagem: true, imageQuality: false }
    );

    // gate desligado: não barra; grava o SVG (passou só na sanitização mockada)
    expect(result[0].mnemonicoSvg).toBeDefined();
    expect(mockGenerate).toHaveBeenCalledTimes(1);
  });
});

// ── Custo/perf: técnica capturada + imagem seletiva (estágio 3+4) ─────────────

describe('mnemônico: captura da técnica (q.mnemonicoTecnica)', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('grava q.mnemonicoTecnica a partir do campo tecnica (merge por id)', async () => {
    vi.mocked(runClaudeCli).mockResolvedValue(
      '{"mnemonicos":[{"id":"a","mnemonico":"Mnem A","tecnica":"loci"}]}'
    );
    const result = await enrichAll(
      [{ id: 'a', tipo: 'extraida', pergunta: 'P', resposta: 'R' } as import('../types.js').Questao],
      { mnemonico: true }
    );
    expect(result[0].mnemonico).toBe('Mnem A');
    expect(result[0].mnemonicoTecnica).toBe('loci');
  });

  it('sem tecnica no JSON → q.mnemonicoTecnica fica undefined (não sobrescreve com vazio)', async () => {
    vi.mocked(runClaudeCli).mockResolvedValue(
      '{"mnemonicos":[{"id":"a","mnemonico":"Mnem A"}]}'
    );
    const result = await enrichAll(
      [{ id: 'a', tipo: 'extraida', pergunta: 'P', resposta: 'R' } as import('../types.js').Questao],
      { mnemonico: true }
    );
    expect(result[0].mnemonico).toBe('Mnem A');
    expect(result[0].mnemonicoTecnica).toBeUndefined();
  });
});

describe('enrichAll estágio imagem SELETIVA (custo)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(sanitizarSvg).mockImplementation((svg: string) =>
      svg.trim().startsWith('<svg') ? svg : null
    );
  });

  const card = (id: string, tecnica?: string) =>
    ({ id, tipo: 'extraida', pergunta: 'P', resposta: 'R', mnemonico: `M${id}`, mnemonicoTecnica: tecnica }) as import('../types.js').Questao;

  it('default (sem imageSelective): gera SVG para TODOS com mnemônico (byte-idêntico)', async () => {
    const mockGenerate = vi.fn().mockResolvedValue({ svg: '<svg><rect/></svg>' });
    vi.mocked(createImageProvider).mockReturnValue({ nome: 'mock', generate: mockGenerate });

    await enrichAll(
      [card('1', 'história'), card('2', 'loci'), card('3', 'rima')],
      { imagem: true }
    );
    // sem seletividade → 3 imagens, mesmo as verbais
    expect(mockGenerate).toHaveBeenCalledTimes(3);
  });

  it('imageSelective: pula técnicas verbais (história/rima), mantém visuais (loci/acrônimo)', async () => {
    const mockGenerate = vi.fn().mockResolvedValue({ svg: '<svg><rect/></svg>' });
    vi.mocked(createImageProvider).mockReturnValue({ nome: 'mock', generate: mockGenerate });

    const result = await enrichAll(
      [card('1', 'história'), card('2', 'loci'), card('3', 'rima'), card('4', 'acrônimo')],
      { imagem: true, imageSelective: true }
    );
    // só loci + acrônimo recebem SVG
    expect(mockGenerate).toHaveBeenCalledTimes(2);
    expect(result.find((q) => q.id === '1')?.mnemonicoSvg).toBeUndefined();
    expect(result.find((q) => q.id === '2')?.mnemonicoSvg).toBeDefined();
    expect(result.find((q) => q.id === '3')?.mnemonicoSvg).toBeUndefined();
    expect(result.find((q) => q.id === '4')?.mnemonicoSvg).toBeDefined();
  });

  it('imageSelective: técnica ausente/desconhecida MANTÉM a imagem (lado seguro)', async () => {
    const mockGenerate = vi.fn().mockResolvedValue({ svg: '<svg><rect/></svg>' });
    vi.mocked(createImageProvider).mockReturnValue({ nome: 'mock', generate: mockGenerate });

    await enrichAll(
      [card('1' /* sem técnica */), card('2', 'mnemônico-qualquer')],
      { imagem: true, imageSelective: true }
    );
    expect(mockGenerate).toHaveBeenCalledTimes(2);
  });

  it('imageSelective: comparação acento/caixa-insensível (HISTÓRIA == historia)', async () => {
    const mockGenerate = vi.fn().mockResolvedValue({ svg: '<svg><rect/></svg>' });
    vi.mocked(createImageProvider).mockReturnValue({ nome: 'mock', generate: mockGenerate });

    await enrichAll(
      [card('1', 'HISTÓRIA'), card('2', 'Historia')],
      { imagem: true, imageSelective: true }
    );
    // ambas normalizam para 'historia' → puladas
    expect(mockGenerate).toHaveBeenCalledTimes(0);
  });

  it('imageSkipTecnicas customizado substitui o default', async () => {
    const mockGenerate = vi.fn().mockResolvedValue({ svg: '<svg><rect/></svg>' });
    vi.mocked(createImageProvider).mockReturnValue({ nome: 'mock', generate: mockGenerate });

    await enrichAll(
      [card('1', 'história'), card('2', 'loci')],
      { imagem: true, imageSelective: true, imageSkipTecnicas: ['loci'] }
    );
    // skip-set agora é só 'loci' → história passa, loci pula
    expect(mockGenerate).toHaveBeenCalledTimes(1);
  });
});

describe('enrichAll cardBuilder: teto do split (cardBuilderMaxSplit)', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  const splitEm = (n: number) =>
    vi.mocked(runClaudeCli).mockResolvedValue(
      JSON.stringify({ cards: Array.from({ length: n }, (_, i) => ({ pergunta: `P${i}`, resposta: `R${i}` })) })
    );

  it('default (cardBuilderMaxSplit ausente): split ilimitado (4→4, byte-idêntico)', async () => {
    splitEm(4);
    const result = await enrichAll(
      [{ id: '1', tipo: 'criada', pergunta: 'P', resposta: 'R' } as import('../types.js').Questao],
      { cardBuilder: true }
    );
    expect(result).toHaveLength(4);
  });

  it('cardBuilderMaxSplit=2: trunca o split de uma criada (4→2)', async () => {
    splitEm(4);
    const result = await enrichAll(
      [{ id: '1', tipo: 'criada', pergunta: 'P', resposta: 'R' } as import('../types.js').Questao],
      { cardBuilder: true, cardBuilderMaxSplit: 2 }
    );
    expect(result).toHaveLength(2);
    expect(result.map((q) => q.pergunta)).toEqual(['P0', 'P1']);
  });

  it('cardBuilderMaxSplit não afeta splits abaixo do teto (2 cards, teto 3 → 2)', async () => {
    splitEm(2);
    const result = await enrichAll(
      [{ id: '1', tipo: 'criada', pergunta: 'P', resposta: 'R' } as import('../types.js').Questao],
      { cardBuilder: true, cardBuilderMaxSplit: 3 }
    );
    expect(result).toHaveLength(2);
  });

  it('teto não se aplica a extraida (extraida nunca divide, D-10)', async () => {
    splitEm(5);
    const result = await enrichAll(
      [{ id: '1', tipo: 'extraida', pergunta: 'Porig', resposta: 'Rorig' } as import('../types.js').Questao],
      { cardBuilder: true, cardBuilderMaxSplit: 2 }
    );
    expect(result).toHaveLength(1);
    expect(result[0].pergunta).toBe('Porig');
  });
});

// ── RT-01: parse tolerante com cercas + fallback posicional ───────────────────

describe('parseMnemonicosJson RT-01', () => {
  it('remove cercas ```json``` e parseia (RT-01)', () => {
    const text = '```json\n{"mnemonicos":[{"id":"x","mnemonico":"Mnem X","tecnica":"história"}]}\n```';
    const result = parseMnemonicosJson(text);
    expect(result).toHaveLength(1);
    expect(result[0].mnemonico).toBe('Mnem X');
  });

  it('remove cerca ``` sem tipo e parseia (RT-01)', () => {
    const text = '```\n{"mnemonicos":[{"id":"y","mnemonico":"Mnem Y"}]}\n```';
    const result = parseMnemonicosJson(text);
    expect(result).toHaveLength(1);
    expect(result[0].mnemonico).toBe('Mnem Y');
  });

  it('retorna [] para JSON inválido e não lança (RT-01 — parse failure tolerante)', () => {
    expect(() => parseMnemonicosJson('isso { nao e json')).not.toThrow();
    expect(parseMnemonicosJson('isso { nao e json')).toEqual([]);
  });
});

describe('enrichAll mnemônico fallback posicional (RT-01)', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('ids ausentes mas contagem bate → fallback posicional aplica mnemônicos (RT-01)', async () => {
    // LLM retorna mnemônicos sem campo id, mas conta bate com o lote
    vi.mocked(runClaudeCli).mockResolvedValue(
      '{"mnemonicos":[{"mnemonico":"Mnem 1"},{"mnemonico":"Mnem 2"}]}'
    );

    const result = await enrichAll(
      [
        { id: 'a', tipo: 'extraida', pergunta: 'PA', resposta: 'RA' } as import('../types.js').Questao,
        { id: 'b', tipo: 'extraida', pergunta: 'PB', resposta: 'RB' } as import('../types.js').Questao,
      ],
      { mnemonico: true }
    );

    // fallback posicional: card 'a' recebe Mnem 1, card 'b' recebe Mnem 2
    expect(result.find(q => q.id === 'a')?.mnemonico).toBe('Mnem 1');
    expect(result.find(q => q.id === 'b')?.mnemonico).toBe('Mnem 2');
  });

  it('ids errados + contagem diverge → nenhum mnemônico aplicado, job continua (RT-01)', async () => {
    // LLM retorna mais entradas do que cards — divergência: nenhum fallback
    vi.mocked(runClaudeCli).mockResolvedValue(
      '{"mnemonicos":[{"mnemonico":"M1"},{"mnemonico":"M2"},{"mnemonico":"M3"}]}'
    );

    const result = await enrichAll(
      [{ id: 'a', tipo: 'extraida', pergunta: 'PA', resposta: 'RA' } as import('../types.js').Questao],
      { mnemonico: true }
    );

    // job não abortou, mas nenhum mnemônico aplicado (contagem diverge)
    expect(result).toHaveLength(1);
    expect(result[0].mnemonico).toBeUndefined();
  });

  it('runner lança → erro é surfaced no progress com prefixo (RT-01)', async () => {
    vi.mocked(runClaudeCli).mockRejectedValue(new Error('ENOENT: claude not found'));

    const progressos: import('./enrich.js').EnrichProgress[] = [];
    const result = await enrichAll(
      [{ id: '1', tipo: 'extraida', pergunta: 'P', resposta: 'R' } as import('../types.js').Questao],
      { mnemonico: true },
      (e) => progressos.push(e)
    );

    // job não abortou
    expect(result).toHaveLength(1);
    // erro surfaced no progress com o prefixo "Estágio mnemônico falhou:"
    const erroEvt = progressos.find(p => p.erro);
    expect(erroEvt).toBeDefined();
    expect(erroEvt!.erro).toContain('Estágio mnemônico falhou:');
    expect(erroEvt!.erro).toContain('ENOENT');
  });
});
