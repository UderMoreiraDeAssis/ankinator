/**
 * Testes determinísticos da sanitização SVG — cobertura adversarial F-01..F-12.
 *
 * D-07/D-14: Esses fixtures provam que a allowlist geométrica estrita remove
 * TODOS os vetores de ataque SVG conhecidos, sem chamadas ao Claude CLI.
 * DOMPurify roda em Node puro — NÃO requer vi.mock.
 */
import { describe, it, expect } from 'vitest';
import { sanitizarSvg } from './sanitize-svg.js';

describe('sanitizarSvg — cobertura adversarial (D-07/D-14)', () => {
  // F-01: Tag <script> direta
  it('F-01: remove tag <script> embutida no SVG', () => {
    const out = sanitizarSvg('<svg><script>alert(1)</script></svg>');
    expect(out).not.toContain('<script>');
    expect(out).not.toContain('alert');
  });

  // F-02: Atributo de evento onload na raiz
  it('F-02: remove atributo onload da raiz SVG', () => {
    const out = sanitizarSvg('<svg onload="alert(1)"><rect/></svg>');
    expect(out).not.toContain('onload');
  });

  // F-03: Atributo onclick em elemento geométrico — <rect> deve sobreviver
  it('F-03: remove onclick mas mantém o elemento <rect>', () => {
    const out = sanitizarSvg('<svg><rect onclick="evil()"/></svg>');
    expect(out).not.toContain('onclick');
    // rect faz parte de SVG_TAGS — deve ser mantido
    expect(out).toContain('<rect');
  });

  // F-04: <a> com href javascript: — <a> fora de ALLOWED_TAGS, removida inteira
  it('F-04: remove <a> com href javascript: (tag fora da allowlist)', () => {
    const out = sanitizarSvg('<svg><a href="javascript:alert(1)"><text>x</text></a></svg>');
    expect(out).not.toContain('javascript:');
    // <a> não está em SVG_TAGS; o texto descendente pode ou não sobreviver dependendo do DOMPurify
  });

  // F-05: <use> com xlink:href externo — fora de ALLOWED_TAGS
  it('F-05: remove <use xlink:href> externo (tag fora da allowlist)', () => {
    const out = sanitizarSvg('<svg><use xlink:href="http://evil.com/payload.svg#x"/></svg>');
    expect(out).not.toContain('xlink:href');
    expect(out).not.toContain('evil.com');
  });

  // F-06: <foreignObject> com HTML embutido — fora de ALLOWED_TAGS
  it('F-06: remove <foreignObject> com script embutido', () => {
    const out = sanitizarSvg('<svg><foreignObject><script>alert(1)</script></foreignObject></svg>');
    expect(out).not.toContain('foreignObject');
    expect(out).not.toContain('<script>');
  });

  // F-07: <image> com href externo — fora de ALLOWED_TAGS
  it('F-07: remove <image href> externo (tag fora da allowlist)', () => {
    const out = sanitizarSvg('<svg><image href="http://evil.com/pixel.png"/></svg>');
    expect(out).not.toContain('<image');
    expect(out).not.toContain('evil.com');
  });

  // F-08: <animate> e <set> — fora de ALLOWED_TAGS
  it('F-08: remove <animate> e <set> (tags fora da allowlist)', () => {
    const outAnimate = sanitizarSvg('<svg><rect/><animate attributeName="href" values="javascript:"/></svg>');
    expect(outAnimate).not.toContain('<animate');
    const outSet = sanitizarSvg('<svg><rect/><set attributeName="href" to="javascript:"/></svg>');
    expect(outSet).not.toContain('<set');
  });

  // F-09: atributo style com CSS url() — style fora de ALLOWED_ATTR
  it('F-09: remove atributo style com CSS url() (style fora da allowlist)', () => {
    const out = sanitizarSvg('<svg><rect style="fill:url(http://evil.com/x)"/></svg>');
    expect(out).not.toContain('style=');
    expect(out).not.toContain('evil.com');
  });

  // F-10: SVG geométrico limpo — deve passar intacto (não nulo, contém <rect)
  it('F-10: SVG geométrico limpo passa sem remoção (saída não-nula, contém <rect)', () => {
    const svg = '<svg viewBox="0 0 100 100"><rect x="10" y="10" width="80" height="80" fill="blue"/></svg>';
    const out = sanitizarSvg(svg);
    expect(out).not.toBeNull();
    expect(out).toContain('<rect');
  });

  // F-11: entradas inválidas — fail-closed retorna null (D-08)
  it('F-11: retorna null para string vazia', () => {
    expect(sanitizarSvg('')).toBeNull();
  });

  it('F-11: retorna null para markup não-SVG (<div>)', () => {
    expect(sanitizarSvg('<div>hello</div>')).toBeNull();
  });

  // F-12: contrato de cercas — o parser do especialista remove ```svg ANTES de sanitizar;
  // sanitizarSvg recebe o markup puro (sem cercas). Testar que markup puro funciona.
  it('F-12: markup SVG puro (sem cercas) passa pela sanitização normalmente', () => {
    // Contrato: cercas removidas pelo parser antes de chegar aqui.
    // Se chegassem, "```svg" não começa com <svg → retorna null (fail-closed).
    const svgPuro = '<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="red"/></svg>';
    const out = sanitizarSvg(svgPuro);
    expect(out).not.toBeNull();
    expect(out).toContain('<circle');

    // Confirma que cercas ANTES do <svg são rejeitadas (fail-closed — D-08)
    const comCerca = '```svg\n<svg><circle cx="50" cy="50" r="40"/></svg>\n```';
    expect(sanitizarSvg(comCerca)).toBeNull();
  });

  // WR-01: url() externo em atributos de apresentação (fill/stroke/clip-path/mask) → null
  it('WR-01: rejeita fill="url(http://...)" externo (fail-closed)', () => {
    expect(sanitizarSvg('<svg xmlns="http://www.w3.org/2000/svg"><rect fill="url(http://evil.com/leak)" width="10" height="10"/></svg>')).toBeNull();
  });
  it('WR-01: rejeita stroke="url(https://...)" externo', () => {
    expect(sanitizarSvg('<svg xmlns="http://www.w3.org/2000/svg"><rect stroke="url(https://evil.com/y)" width="10" height="10"/></svg>')).toBeNull();
  });
  it('WR-01: rejeita clip-path/mask com url() externo', () => {
    expect(sanitizarSvg('<svg xmlns="http://www.w3.org/2000/svg"><rect clip-path="url(http://evil.com/z)" width="10" height="10"/></svg>')).toBeNull();
    expect(sanitizarSvg('<svg xmlns="http://www.w3.org/2000/svg"><rect mask="url(//evil.com/w)" width="10" height="10"/></svg>')).toBeNull();
  });
  it('WR-01: rejeita fill="url(data:...)"', () => {
    expect(sanitizarSvg('<svg xmlns="http://www.w3.org/2000/svg"><rect fill="url(data:image/svg+xml;base64,AAA)" width="10" height="10"/></svg>')).toBeNull();
  });
  it('WR-01: PRESERVA gradiente interno url(#id) (não é null e mantém a ref interna)', () => {
    const out = sanitizarSvg('<svg xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="g"><stop offset="0" stop-color="red"/></linearGradient></defs><rect fill="url(#g)" width="10" height="10"/></svg>');
    expect(out).not.toBeNull();
    expect(out).toContain('url(#g)');
  });
});
