/**
 * Testes do gestor de qualidade visual de SVG (svg-quality.ts).
 * CLI-free e determinístico (render-free) — mesmo padrão de sanitize-svg.test.ts.
 */
import { describe, it, expect } from 'vitest';
import {
  avaliarQualidadeSvg,
  parseViewBox,
  extractTextElements,
  DEFAULT_SVG_QUALITY,
} from './svg-quality.js';

describe('parseViewBox', () => {
  it('lê o viewBox (minx miny w h)', () => {
    expect(parseViewBox('<svg viewBox="0 0 400 300"></svg>')).toEqual({ width: 400, height: 300 });
  });

  it('cai para width/height quando não há viewBox', () => {
    expect(parseViewBox('<svg width="200" height="120"></svg>')).toEqual({ width: 200, height: 120 });
  });

  it('retorna null quando não há dimensões', () => {
    expect(parseViewBox('<svg></svg>')).toBeNull();
  });
});

describe('extractTextElements', () => {
  it('extrai x/y/font-size/âncora/comprimento de cada <text>', () => {
    const svg = '<svg viewBox="0 0 100 100"><text x="10" y="20" font-size="14" text-anchor="middle">Olá mundo</text></svg>';
    const els = extractTextElements(svg);
    expect(els).toHaveLength(1);
    expect(els[0]).toMatchObject({ x: 10, y: 20, fontSize: 14, anchor: 'middle', len: 9 });
  });

  it('usa o maior font-size entre o <text> e seus <tspan>', () => {
    const svg = '<svg><text x="0" y="0" font-size="12">a<tspan font-size="48">B</tspan></text></svg>';
    expect(extractTextElements(svg)[0].fontSize).toBe(48);
  });
});

describe('avaliarQualidadeSvg — aprova imagens legítimas', () => {
  it('SVG iconográfico (poucos rótulos curtos, fonte ok, sem sobreposição) → ok', () => {
    const svg =
      '<svg viewBox="0 0 400 300">' +
      '<rect x="20" y="20" width="120" height="70" fill="#eee"/>' +
      '<text x="200" y="40" font-size="20" text-anchor="middle">Transparência</text>' +
      '<text x="200" y="160" font-size="18" text-anchor="middle">Dados abertos</text>' +
      '<circle cx="200" cy="240" r="28"/>' +
      '</svg>';
    const v = avaliarQualidadeSvg(svg);
    expect(v.ok).toBe(true);
    expect(v.motivos).toEqual([]);
  });

  it('SVG só com formas (sem texto) → ok', () => {
    const v = avaliarQualidadeSvg('<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="40"/></svg>');
    expect(v.ok).toBe(true);
  });

  it('sem viewBox + poucos rótulos curtos não-sobrepostos → ok (checks de viewBox pulados, sem crash)', () => {
    const svg = '<svg><text x="10" y="20" font-size="12">Um</text><text x="10" y="80" font-size="12">Dois</text></svg>';
    expect(() => avaliarQualidadeSvg(svg)).not.toThrow();
    expect(avaliarQualidadeSvg(svg).ok).toBe(true);
  });
});

describe('avaliarQualidadeSvg — reprova lixo visual', () => {
  it('nuvem de palavras: rótulos demais → reprova', () => {
    const texts = Array.from(
      { length: 16 },
      (_, i) => `<text x="10" y="${15 + i * 17}" font-size="10">x</text>`
    ).join('');
    const v = avaliarQualidadeSvg(`<svg viewBox="0 0 400 300">${texts}</svg>`);
    expect(v.ok).toBe(false);
    expect(v.motivos.join(' ')).toMatch(/Texto demais/);
    expect(v.metrics.textNodes).toBe(16);
  });

  it('fonte estourando a moldura (font-size grande vs altura do viewBox) → reprova', () => {
    const svg = '<svg viewBox="0 0 400 300"><text x="10" y="200" font-size="140">DADOS</text></svg>';
    const v = avaliarQualidadeSvg(svg);
    expect(v.ok).toBe(false);
    expect(v.motivos.join(' ')).toMatch(/Fonte grande demais/);
  });

  it('texto fora dos limites do viewBox → reprova', () => {
    const svg =
      '<svg viewBox="0 0 400 300"><text x="380" y="50" font-size="20">palavra muito longa que sai</text></svg>';
    const v = avaliarQualidadeSvg(svg);
    expect(v.ok).toBe(false);
    expect(v.motivos.join(' ')).toMatch(/fora da moldura/);
    expect(v.metrics.outOfBounds).toBeGreaterThan(0);
  });

  it('rótulos sobrepostos (modo de falha mostrado) → reprova', () => {
    const svg =
      '<svg viewBox="0 0 400 300">' +
      '<text x="50" y="150" font-size="24">público vê tudo</text>' +
      '<text x="52" y="152" font-size="24">dados abertos</text>' +
      '<text x="54" y="154" font-size="24">governo transparente</text>' +
      '</svg>';
    const v = avaliarQualidadeSvg(svg);
    expect(v.ok).toBe(false);
    expect(v.motivos.join(' ')).toMatch(/sobrepostos/);
    expect(v.metrics.overlappingPairs).toBeGreaterThan(DEFAULT_SVG_QUALITY.maxOverlappingPairs);
  });

  it('frases longas (muitos caracteres somados) → reprova', () => {
    // 13 rótulos (≤ maxTextNodes) de 20 chars, espaçados/in-bounds → isola o check de total de chars
    const texts = Array.from(
      { length: 13 },
      (_, i) => `<text x="6" y="${15 + i * 21}" font-size="11">abcdefghij abcdefgh</text>`
    ).join('');
    const v = avaliarQualidadeSvg(`<svg viewBox="0 0 600 320">${texts}</svg>`);
    expect(v.ok).toBe(false);
    expect(v.motivos.join(' ')).toMatch(/Texto longo demais/);
    expect(v.metrics.totalTextChars).toBeGreaterThan(DEFAULT_SVG_QUALITY.maxTotalTextChars);
  });
});
