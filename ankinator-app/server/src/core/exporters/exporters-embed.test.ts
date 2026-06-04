/**
 * Testes de embed mnemônico + SVG nos exporters (04-03 / Phase 6).
 *
 * Phase 6: frente e verso agora emitem HTML rico (card-html.ts).
 * As asserções foram atualizadas para o novo formato; os invariantes de
 * segurança CR-01/WR-01 e os gates de campo opcional (PIPE-03) são preservados.
 *
 * Invariantes mantidos:
 *  - PIPE-03: gate por campo opcional — byte-idêntico quando ausente
 *  - Pitfall 2 / D-11: SVG embutido cru (NÃO escapado)
 *  - D-11: mnemônico-texto escapado (escapeHtml aplicado)
 *  - IMG-03: embed SVG inline no verso (não data-URI)
 *  - CR-01: SVG malicioso re-sanitizado no boundary de export
 *  - WR-01: url() externo descartado (fail-closed)
 *  - RICH-01: frente contém barra deck (📘) e pergunta escapada
 *  - RICH-02: verso contém seção "✅ Resposta" com resposta escapada
 *  - RICH-03: verso contém seção "💡 Mnemônico" apenas quando presente
 */
import { describe, it, expect } from 'vitest';
import { toAnkiCsv } from './csv.js';
import { versoHtml } from './ankiconnect.js';
import { buildFrontHtml, buildBackHtml, splitOpcoes, renderOpcoesList } from './card-html.js';
import type { Questao } from '../types.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const cardBase: Questao = {
  id: 'test-01',
  tipo: 'criada',
  pergunta: 'Pergunta de teste',
  resposta: 'Resposta de teste',
  pageStart: 1,
  pageEnd: 1,
};

const cardComMnemonico: Questao = {
  ...cardBase,
  mnemonico: 'Mnemônico de exemplo',
};

const cardComSvg: Questao = {
  ...cardBase,
  mnemonico: 'Mnemônico visual',
  mnemonicoSvg: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><circle cx="50" cy="50" r="40"/></svg>',
};

const cardMnemonicoBadChars: Questao = {
  ...cardBase,
  mnemonico: 'a < b & c > d',
  mnemonicoSvg: '<svg xmlns="http://www.w3.org/2000/svg"><rect width="50" height="50"/></svg>',
};

const cardSvgMalicioso: Questao = {
  ...cardBase,
  mnemonicoSvg: '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><script>alert(2)</script><rect width="10" height="10"/></svg>',
};
const cardSvgExterno: Questao = {
  ...cardBase,
  mnemonicoSvg: '<svg xmlns="http://www.w3.org/2000/svg"><rect fill="url(http://evil.com/leak)" width="10" height="10"/></svg>',
};

// ── card-html.ts — buildFrontHtml ─────────────────────────────────────────────

describe('card-html.ts — buildFrontHtml (RICH-01)', () => {

  it('RICH-01: frente contém barra deck (📘) e pergunta escapada', () => {
    const html = buildFrontHtml(cardBase);
    expect(html).toContain('📘');
    expect(html).toContain('Pergunta de teste');
    // sem deck → usa "Card"
    expect(html).toContain('Card');
  });

  it('RICH-01: frente com q.deck → label com :: substituído por · ', () => {
    const card: Questao = { ...cardBase, deck: 'Matéria::Assunto::Sub' };
    const html = buildFrontHtml(card);
    expect(html).toContain('Matéria · Assunto · Sub');
    expect(html).not.toContain('Matéria::Assunto');
  });

  it('RICH-01: frente sem deck mas com tags → usa primeira tag', () => {
    const card: Questao = { ...cardBase, tags: ['direito-constitucional'] };
    const html = buildFrontHtml(card);
    expect(html).toContain('direito-constitucional');
  });

  it('RICH-01: pergunta com < e & é escapada na frente', () => {
    const card: Questao = { ...cardBase, pergunta: 'A < B & C' };
    const html = buildFrontHtml(card);
    expect(html).toContain('A &lt; B &amp; C');
    expect(html).not.toContain('A < B');
  });

  it('RICH-01: frente é determinística (byte-idêntica em chamadas repetidas)', () => {
    const h1 = buildFrontHtml(cardBase);
    const h2 = buildFrontHtml(cardBase);
    expect(h1).toBe(h2);
  });
});

// ── card-html.ts — buildBackHtml ──────────────────────────────────────────────

describe('card-html.ts — buildBackHtml (RICH-02/03)', () => {

  it('RICH-02: verso contém seção "✅ Resposta" com texto da resposta', () => {
    const html = buildBackHtml(cardBase);
    expect(html).toContain('✅ Resposta');
    expect(html).toContain('Resposta de teste');
  });

  it('RICH-02: verso com gabarito → contém "Gabarito:"', () => {
    const card: Questao = { ...cardBase, metadata: { gabarito: 'A' } };
    const html = buildBackHtml(card);
    expect(html).toContain('Gabarito:');
    expect(html).toContain('A');
  });

  it('RICH-02: verso com alternativas → contém "Alternativas:" e cada alternativa como <li>', () => {
    const card: Questao = { ...cardBase, metadata: { alternativas: ['(A) Sim', '(B) Não'] } };
    const html = buildBackHtml(card);
    expect(html).toContain('Alternativas:');
    expect(html).toContain('(A) Sim');
    // escapeHtml só escapa &, <, >, " — caracteres acentuados passam literalmente
    expect(html).toContain('(B) Não');
    // Novo: alternativas renderizadas como lista ordenada (não mais <br>-joined)
    expect(html).toContain('<ol');
    expect(html).toContain('<li');
  });

  it('RICH-03: verso SEM mnemônico → NÃO contém seção "💡 Mnemônico" (PIPE-03 gate)', () => {
    const html = buildBackHtml(cardBase);
    expect(html).not.toContain('💡');
    expect(html).not.toContain('Mnemônico');
  });

  it('RICH-03: verso COM mnemônico → contém seção "💡 Mnemônico" + texto', () => {
    const html = buildBackHtml(cardComMnemonico);
    expect(html).toContain('💡');
    expect(html).toContain('Mnemônico de exemplo');
  });

  it('IMG-03: verso com mnemonicoSvg → contém <svg literal (NÃO &lt;svg)', () => {
    const html = buildBackHtml(cardComSvg);
    expect(html).toContain('<svg');
    expect(html).not.toContain('&lt;svg');
  });

  it('RICH-02: verso com fonte → contém 📎 e o nome da fonte', () => {
    const html = buildBackHtml(cardBase, 'livro-direito');
    expect(html).toContain('📎');
    expect(html).toContain('livro-direito');
  });

  it('RICH-02: verso sem fonte/pageStart → sem rodapé 📎', () => {
    const cardSemPagina: Questao = { id: 'x', tipo: 'criada', pergunta: 'Q', resposta: 'R' };
    const html = buildBackHtml(cardSemPagina);
    expect(html).not.toContain('📎');
  });

  it('D-11: mnemônico com < e & é escapado (texto não passa cru)', () => {
    const html = buildBackHtml(cardMnemonicoBadChars);
    expect(html).toContain('a &lt; b &amp; c &gt; d');
    // texto cru NÃO deve aparecer fora dos atributos style
    expect(html).not.toMatch(/[^;]a < b/);
  });

  it('D-11 (Pitfall 2): mnemonicoSvg cru (não escapado) mesmo quando mnemônico tem chars especiais', () => {
    const html = buildBackHtml(cardMnemonicoBadChars);
    // SVG deve aparecer sem escaping
    expect(html).toContain('<svg');
    expect(html).not.toContain('&lt;svg');
  });

  it('CR-01: SVG malicioso re-sanitizado no boundary — sem onload/script/alert', () => {
    const html = buildBackHtml(cardSvgMalicioso);
    expect(html).not.toContain('onload');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('alert');
  });

  it('WR-01: SVG com url() externo descartado (fail-closed, sem evil.com)', () => {
    const html = buildBackHtml(cardSvgExterno);
    expect(html).not.toContain('evil.com');
    expect(html).not.toContain('url(http');
  });

  it('PIPE-03: verso sem mnemonicoSvg é byte-idêntico ao baseline', () => {
    const baseline = buildBackHtml(cardBase);
    const resultado = buildBackHtml(cardBase);
    expect(resultado).toBe(baseline);
    expect(resultado).not.toContain('<svg');
  });
});

// ── CSV (toAnkiCsv) ───────────────────────────────────────────────────────────

describe('csv.ts — toAnkiCsv HTML rico (RICH-01/02/03 + PIPE-03)', () => {

  it('RICH-01: frente do CSV contém 📘 e a pergunta', () => {
    const csv = toAnkiCsv([cardBase]);
    expect(csv).toContain('📘');
    expect(csv).toContain('Pergunta de teste');
  });

  it('RICH-02: verso do CSV contém "✅ Resposta"', () => {
    const csv = toAnkiCsv([cardBase]);
    expect(csv).toContain('✅ Resposta');
    expect(csv).toContain('Resposta de teste');
  });

  it('PIPE-03: card sem mnemônico → CSV não contém seção mnemônico', () => {
    const csv = toAnkiCsv([cardBase]);
    expect(csv).not.toContain('💡');
    // Baseline determinístico
    const resultado = toAnkiCsv([cardBase]);
    expect(resultado).toBe(csv);
  });

  it('RICH-03: card com mnemônico → CSV contém "💡" e texto do mnemônico', () => {
    const csv = toAnkiCsv([cardComMnemonico]);
    expect(csv).toContain('💡');
    expect(csv).toContain('Mnemônico de exemplo');
  });

  it('D-11 (Pitfall 2): card com mnemonicoSvg → verso contém <svg literal (não escapado)', () => {
    const csv = toAnkiCsv([cardComSvg]);
    expect(csv).toContain('<svg');
    expect(csv).not.toContain('&lt;svg');
  });

  it('PIPE-03: array de cards — só cards com svg têm <svg no output', () => {
    const csv = toAnkiCsv([cardBase, cardComSvg]);
    expect(csv).toContain('<svg');
    // A linha do cardBase não deve conter <svg
    const linhas = csv.split('\n');
    const linhaBase = linhas.find(l => l.includes('Pergunta de teste') && !l.includes('Mnemônico visual'));
    if (linhaBase) {
      expect(linhaBase).not.toContain('<svg');
    }
  });

  it('CR-01: SVG malicioso re-sanitizado no boundary (sem onload/script/alert)', () => {
    const csv = toAnkiCsv([cardSvgMalicioso]);
    expect(csv).not.toContain('onload');
    expect(csv).not.toContain('<script');
    expect(csv).not.toContain('alert');
  });

  it('CR-01/WR-01: SVG com url() externo descartado (fail-closed, sem evil.com)', () => {
    const csv = toAnkiCsv([cardSvgExterno]);
    expect(csv).not.toContain('evil.com');
    expect(csv).not.toContain('url(http');
  });
});

// ── splitOpcoes ───────────────────────────────────────────────────────────────

describe('card-html.ts — splitOpcoes', () => {

  it('detecta opções A-C e separa o enunciado', () => {
    const { stem, opcoes } = splitOpcoes('Pergunta? A) um B) dois C) três');
    expect(stem).toBe('Pergunta?');
    expect(opcoes).toHaveLength(3);
    expect(opcoes[0]).toMatch(/^A\)/);
    expect(opcoes[1]).toMatch(/^B\)/);
    expect(opcoes[2]).toMatch(/^C\)/);
  });

  it('texto sem opções → opcoes vazio, stem é o texto completo', () => {
    const { stem, opcoes } = splitOpcoes('Qual é o conceito de isolamento?');
    expect(opcoes).toHaveLength(0);
    expect(stem).toBe('Qual é o conceito de isolamento?');
  });

  it('opções sem "A)" no início → não detecta (sequência deve começar em A)', () => {
    const { stem, opcoes } = splitOpcoes('Pergunta? B) dois C) três');
    expect(opcoes).toHaveLength(0);
    expect(stem).toBe('Pergunta? B) dois C) três');
  });

  it('apenas uma opção → não detecta (mínimo 2)', () => {
    const { opcoes } = splitOpcoes('Pergunta? A) única opção aqui');
    expect(opcoes).toHaveLength(0);
  });

  it('detecta opções A-E (cinco alternativas)', () => {
    const { stem, opcoes } = splitOpcoes('Enunciado: A) alfa B) beta C) gama D) delta E) épsilon');
    expect(stem).toBe('Enunciado:');
    expect(opcoes).toHaveLength(5);
    expect(opcoes[4]).toMatch(/^E\)/);
  });

});

// ── renderOpcoesList ──────────────────────────────────────────────────────────

describe('card-html.ts — renderOpcoesList', () => {

  it('retorna string vazia quando lista vazia', () => {
    expect(renderOpcoesList([])).toBe('');
  });

  it('produz <ol> com um <li> por opção', () => {
    const html = renderOpcoesList(['A) sim', 'B) não']);
    expect(html).toContain('<ol');
    expect(html.match(/<li/g)).toHaveLength(2);
  });

  it('opções sem letra recebem prefixo A)/B)/...', () => {
    const html = renderOpcoesList(['primeira', 'segunda']);
    expect(html).toContain('A) primeira');
    expect(html).toContain('B) segunda');
  });

  it('opções com letra mantêm o marcador original', () => {
    const html = renderOpcoesList(['A) alfa', 'B) beta']);
    expect(html).toContain('A) alfa');
    expect(html).toContain('B) beta');
    // Não deve duplicar o marcador
    expect(html).not.toContain('A) A) alfa');
  });

  it('HTML no conteúdo da opção é escapado (segurança)', () => {
    const html = renderOpcoesList(['<script>alert(1)</script>']);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('caracteres especiais & e < são escapados', () => {
    const html = renderOpcoesList(['A & B < C']);
    expect(html).toContain('&amp;');
    expect(html).toContain('&lt;');
  });

});

// ── buildFrontHtml — alternativas como lista ──────────────────────────────────

describe('card-html.ts — buildFrontHtml com alternativas (MC)', () => {

  it('pergunta com opções embutidas → front contém <ol> e opções não juntadas no stem', () => {
    const card: Questao = {
      ...cardBase,
      pergunta: 'Qual processamento? A) Natureza B) Isolamento C) Composição',
    };
    const html = buildFrontHtml(card);
    expect(html).toContain('<ol');
    expect(html).toContain('<li');
    // O stem (sem as opções inline) deve aparecer
    expect(html).toContain('Qual processamento?');
    // As opções não devem estar juntadas com o stem no parágrafo
    // (verificado pela presença do <ol> separado)
    expect(html).toContain('A) Natureza');
    expect(html).toContain('B) Isolamento');
    expect(html).toContain('C) Composição');
  });

  it('metadata.alternativas presente (>=2) → usa metadata, não o texto inline', () => {
    const card: Questao = {
      ...cardBase,
      pergunta: 'Questão MC com opções no metadata',
      metadata: {
        alternativas: ['A) Opção metadata 1', 'B) Opção metadata 2'],
      },
    };
    const html = buildFrontHtml(card);
    expect(html).toContain('<ol');
    expect(html).toContain('A) Opção metadata 1');
    expect(html).toContain('B) Opção metadata 2');
  });

  it('pergunta simples (sem MC) → sem <ol> na frente', () => {
    const html = buildFrontHtml(cardBase);
    expect(html).not.toContain('<ol');
    expect(html).toContain('Pergunta de teste');
  });

  it('segurança: conteúdo das alternativas embutidas é escapado', () => {
    const card: Questao = {
      ...cardBase,
      pergunta: 'Pergunta? A) alfa<script> B) beta',
    };
    const html = buildFrontHtml(card);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

});

// ── buildBackHtml — alternativas como lista ───────────────────────────────────

describe('card-html.ts — buildBackHtml com alternativas como lista (MC)', () => {

  it('metadata.alternativas → verso contém <ol> (não mais <br>-joined)', () => {
    const card: Questao = {
      ...cardBase,
      metadata: { alternativas: ['A) Sim', 'B) Não', 'C) Talvez'] },
    };
    const html = buildBackHtml(card);
    expect(html).toContain('<ol');
    expect(html).toContain('<li');
    expect(html).toContain('A) Sim');
    expect(html).toContain('B) Não');
    expect(html).toContain('C) Talvez');
  });

  it('pergunta com opções embutidas e sem metadata → back detecta e renderiza lista', () => {
    const card: Questao = {
      ...cardBase,
      pergunta: 'Qual é? A) Alpha B) Beta C) Gamma',
    };
    const html = buildBackHtml(card);
    expect(html).toContain('<ol');
    expect(html).toContain('A) Alpha');
  });

  it('sem alternativas em nenhuma fonte → sem <ol> no verso', () => {
    const html = buildBackHtml(cardBase);
    expect(html).not.toContain('<ol');
  });

});

// ── AnkiConnect (versoHtml) — IMG-03 ─────────────────────────────────────────

describe('ankiconnect.ts — versoHtml HTML rico (RICH-02/03 + IMG-03 + CR-01/WR-01)', () => {

  it('RICH-02: versoHtml contém "✅ Resposta" e a resposta', () => {
    const html = versoHtml(cardBase);
    expect(html).toContain('✅ Resposta');
    expect(html).toContain('Resposta de teste');
  });

  it('PIPE-03: versoHtml sem mnemônico → sem seção mnemônico (byte-idêntico)', () => {
    const baseline = versoHtml(cardBase);
    expect(baseline).not.toContain('💡');
    expect(baseline).not.toContain('Mnemônico');
    expect(baseline).not.toContain('<svg');
    // Determinístico
    expect(versoHtml(cardBase)).toBe(baseline);
  });

  it('RICH-03: versoHtml com mnemônico → contém "💡" e texto do mnemônico', () => {
    const html = versoHtml(cardComMnemonico);
    expect(html).toContain('💡');
    expect(html).toContain('Mnemônico de exemplo');
  });

  it('IMG-03 (Pitfall 2): versoHtml com mnemonicoSvg → <svg literal (NÃO &lt;svg)', () => {
    const html = versoHtml(cardComSvg);
    expect(html).toContain('<svg');
    expect(html).not.toContain('&lt;svg');
  });

  it('D-11: mnemônico com < e & escapado no versoHtml', () => {
    const html = versoHtml(cardMnemonicoBadChars);
    expect(html).toContain('a &lt; b &amp; c &gt; d');
    expect(html).toContain('<svg');
    expect(html).not.toContain('&lt;svg');
  });

  it('CR-01: versoHtml re-sanitiza SVG malicioso no boundary (sem onload/script/alert)', () => {
    const html = versoHtml(cardSvgMalicioso);
    expect(html).not.toContain('onload');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('alert');
  });

  it('WR-01: versoHtml descarta SVG com url() externo (sem evil.com)', () => {
    const html = versoHtml(cardSvgExterno);
    expect(html).not.toContain('evil.com');
  });
});
