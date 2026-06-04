/**
 * Sanitização SVG server-side com allowlist geométrica estrita.
 *
 * D-06: Usa lib dedicada (isomorphic-dompurify) em vez de sanitizador bespoke.
 * D-07: Allowlist geométrica estrita — somente elementos e atributos conhecidos
 *       produzidos pelo mnemonic-image.md; fail-closed por omissão.
 * D-08: Falha na sanitização = descarta o SVG (retorna null); nunca markup parcial.
 *
 * CRÍTICO — Pitfall 1: NUNCA combinar o perfil SVG com ALLOWED_TAGS.
 * O parâmetro de perfil SVG do DOMPurify sobrescreve ALLOWED_TAGS silenciosamente
 * (comportamento documentado). Usar APENAS ALLOWED_TAGS + ALLOWED_ATTR explícitos.
 *
 * Pitfall 7 (ESM/NodeNext):
 * - Módulo npm: import sem extensão (exports map resolve) ← este arquivo
 * - Módulo local: import com .js (NodeNext obriga) ← importadores deste arquivo
 */
import DOMPurify from 'isomorphic-dompurify'; // sem extensão — exports map do pacote

/**
 * Allowlist geométrica estrita de tags SVG (D-07).
 * Somente elementos que o mnemonic-image.md produz: formas básicas, gradientes, texto.
 * Tags como <use>, <animate>, <foreignObject>, <image>, <script>, <a>, <set>
 * NÃO constam aqui e são removidas por omissão (fail-closed).
 */
const SVG_TAGS = [
  // raiz e agrupamento
  'svg', 'g', 'defs',
  // formas geométricas
  'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon',
  // texto
  'text', 'tspan',
  // gradientes
  'linearGradient', 'radialGradient', 'stop',
];

/**
 * Allowlist de atributos seguros (D-07).
 * Subset cobrindo geometria, apresentação, texto e gradiente.
 * 'style' NUNCA entra aqui — F-09: CSS url() em style é vetor de exfiltração.
 * 'id' permitido APENAS para referência interna de gradiente (linearGradient/radialGradient).
 * Sem xlink:href externo possível: <use>/<image> estão fora de SVG_TAGS.
 */
const SVG_ATTRS = [
  // posição e tamanho
  'viewBox', 'xmlns', 'width', 'height',
  'x', 'y', 'x1', 'y1', 'x2', 'y2',
  'cx', 'cy', 'r', 'rx', 'ry',
  // geometria de caminho e polígono
  'd', 'points',
  // transformações
  'transform',
  // preenchimento e contorno (D-07: subset seguro de apresentação)
  'fill', 'fill-opacity', 'fill-rule',
  'stroke', 'stroke-width', 'stroke-dasharray', 'stroke-linecap', 'stroke-linejoin', 'stroke-opacity',
  'opacity', 'color',
  // texto
  'font-family', 'font-size', 'font-weight', 'text-anchor', 'dominant-baseline',
  // gradientes
  'gradientUnits', 'gradientTransform', 'offset', 'stop-color', 'stop-opacity',
  'fx', 'fy',
  // referência interna (sem xlink:href externo — <use>/<image> fora de SVG_TAGS)
  'id',
  // miscelânea segura
  'preserveAspectRatio', 'clip-path', 'mask',
  // NOTA: 'style' INTENCIONALMENTE AUSENTE — F-09 depende desta omissão
];

/**
 * Sanitiza um SVG bruto usando allowlist geométrica estrita (D-06/D-07).
 *
 * Regras:
 * 1. Passa o SVG pelo DOMPurify com ALLOWED_TAGS + ALLOWED_ATTR (apenas allowlist positiva).
 * 2. Fail-closed (D-08, Pitfall 4): se o resultado não começa com '<svg', retorna null.
 *    Isso cobre: entrada vazia, markup não-SVG, SVG totalmente rejeitado pelo DOMPurify.
 * 3. Qualquer exceção → retorna null (nunca propaga erro para cima).
 *
 * @param svgRaw - Markup SVG bruto (sem cercas de código — parser do especialista remove antes).
 * @returns SVG sanitizado (string começando com '<svg') ou null se inválido/perigoso.
 */
export function sanitizarSvg(svgRaw: string): string | null {
  try {
    // ALLOWED_TAGS e ALLOWED_ATTR são os únicos parâmetros — Pitfall 1: sem parâmetros de perfil
    const limpo = DOMPurify.sanitize(svgRaw, {
      ALLOWED_TAGS: SVG_TAGS,
      ALLOWED_ATTR: SVG_ATTRS,
      // FORCE_BODY: false por default — mantém o <svg> como raiz sem envoltura adicional
    });

    // Gate fail-closed (D-08): resultado deve começar com <svg (Pitfall 4)
    // DOMPurify retorna "" para entrada completamente rejeitada; "" não começa com <svg → null
    const trimmed = limpo.trim();
    if (!trimmed.startsWith('<svg')) return null;

    // WR-01: o ALLOWED_ATTR do DOMPurify allowlista o NOME do atributo (fill, stroke,
    // clip-path, mask, ...) mas NÃO valida o VALOR — url() externo sobrevive nesses
    // atributos de apresentação (vetor de exfiltração/SSRF que o F-09 só cobre via 'style').
    // Só url(#fragmento) interno (gradientes/clip internos) é seguro. Fail-closed (D-08):
    // qualquer url() não-interno descarta o SVG inteiro.
    const urlRefs = trimmed.match(/url\(\s*['"]?\s*[^)]*/gi);
    if (urlRefs) {
      for (const ref of urlRefs) {
        const alvo = ref.replace(/^url\(\s*['"]?\s*/i, '');
        if (!alvo.startsWith('#')) return null;
      }
    }

    return trimmed;
  } catch {
    // D-08: qualquer erro interno do DOMPurify → descarta silenciosamente
    return null;
  }
}
