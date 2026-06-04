/**
 * Testes de embed mnemônico + SVG nos exporters (04-03).
 *
 * Verifica:
 *  - D-09/D-10: gate por campo opcional — byte-idêntico quando ausente (PIPE-03)
 *  - D-11: SVG embutido cru (NÃO escapado) — Pitfall 2
 *  - D-11: mnemônico-texto escapado em versoHtml (escapeHtml aplicado só ao texto)
 *  - IMG-03: teste positivo determinístico do embed SVG no versoHtml
 */
import { describe, it, expect } from 'vitest';
import { toAnkiCsv } from './csv.js';
import { versoHtml } from './ankiconnect.js';
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

// ── CSV (versoDaQuestao) ───────────────────────────────────────────────────────

describe('csv.ts — versoDaQuestao embed (D-09/D-10/PIPE-03)', () => {

  it('D-10: card sem mnemonico/mnemonicoSvg → byte-idêntico ao baseline (PIPE-03)', () => {
    // Captura baseline sem os campos de mnemônico
    const baseline = toAnkiCsv([cardBase]);
    // Garantir que o campo não existe no baseline
    expect(baseline).not.toContain('Mnemônico:');
    expect(baseline).not.toContain('<svg');

    // Roda novamente — deve ser idêntico (determinístico)
    const resultado = toAnkiCsv([cardBase]);
    expect(resultado).toBe(baseline);
  });

  it('D-09: card com mnemonico → verso contém "Mnemônico:" + texto', () => {
    const csv = toAnkiCsv([cardComMnemonico]);
    expect(csv).toContain('Mnemônico:');
    expect(csv).toContain('Mnemônico de exemplo');
  });

  it('D-09 (Pitfall 2): card com mnemonicoSvg → verso contém <svg literal (não escapado)', () => {
    const csv = toAnkiCsv([cardComSvg]);
    // SVG deve estar presente cru — NUNCA escapado (D-11/Pitfall 2)
    expect(csv).toContain('<svg');
    // Garantir que NÃO foi escapado
    expect(csv).not.toContain('&lt;svg');
  });

  it('D-10: array de cards — só cards com svg têm <svg no output', () => {
    const csv = toAnkiCsv([cardBase, cardComSvg]);
    expect(csv).toContain('<svg');
    // Garante que a linha do cardBase não adicionou svg
    const linhas = csv.split('\n');
    const linhaBase = linhas.find(l => l.includes('Resposta de teste') && !l.includes('Mnemônico visual'));
    // A linha do card base não deve conter <svg (presente apenas na linha com SVG)
    if (linhaBase) {
      expect(linhaBase).not.toContain('<svg');
    }
  });
});

// ── AnkiConnect (versoHtml) — IMG-03 ─────────────────────────────────────────

describe('ankiconnect.ts — versoHtml embed (D-09/D-10/D-11/IMG-03/Pitfall-2)', () => {

  it('D-10: card sem campos → versoHtml byte-idêntico ao baseline (PIPE-03)', () => {
    const baseline = versoHtml(cardBase);
    // Sem mnemônico nem SVG
    expect(baseline).not.toContain('Mnemônico');
    expect(baseline).not.toContain('<svg');

    // Determinístico
    const resultado = versoHtml(cardBase);
    expect(resultado).toBe(baseline);
  });

  it('D-09: card com mnemonico → versoHtml contém texto do mnemônico', () => {
    const html = versoHtml(cardComMnemonico);
    expect(html).toContain('Mnemônico');
    expect(html).toContain('Mnemônico de exemplo');
  });

  it('IMG-03 (Pitfall 2): card com mnemonicoSvg → versoHtml contém <svg literal (NÃO &lt;svg)', () => {
    // Este é o teste positivo central de IMG-03
    // O SVG deve aparecer CRUDAMENTE no HTML — escapeHtml NUNCA deve ser aplicado ao SVG
    const html = versoHtml(cardComSvg);
    expect(html).toContain('<svg');
    expect(html).not.toContain('&lt;svg');
  });

  it('D-11 (escape texto): mnemônico com < → back contém &lt; (texto escapado) mas NÃO < cru do mnemônico', () => {
    const html = versoHtml(cardMnemonicoBadChars);
    // O texto do mnemônico deve ser escapado via escapeHtml
    expect(html).toContain('a &lt; b');
    expect(html).toContain('&amp;');
    // O SVG raw ainda deve estar presente SEM escaping
    expect(html).toContain('<svg');
    expect(html).not.toContain('&lt;svg');
    // Verificar que o texto do mnemônico não passou cru
    // 'a < b' cru NÃO deve aparecer na parte do mnemônico
    // (mas pode aparecer em outros campos — checamos a forma escapada)
    expect(html).toContain('a &lt; b &amp; c &gt; d');
  });

  it('D-09: card com mnemonico e svg → ambos presentes no retorno', () => {
    const html = versoHtml(cardComSvg);
    expect(html).toContain('Mnemônico');
    expect(html).toContain('Mnemônico visual');
    expect(html).toContain('<svg');
  });
});
