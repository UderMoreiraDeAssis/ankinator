/**
 * Gestor de qualidade VISUAL de SVG de mnemônico (render-free, zero custo LLM).
 *
 * PROBLEMA que este módulo resolve:
 *   `sanitizarSvg()` valida apenas SEGURANÇA (allowlist de tags/atributos + bloqueio
 *   de url() externo). Um SVG perfeitamente "seguro" pode ainda ser LIXO VISUAL —
 *   dezenas de `<text>` sobrepostos, fonte gigante estourando o viewBox, frases longas
 *   empilhadas (o modelo não "enxerga" o que desenha e empilha texto às cegas).
 *   Esse SVG passava na sanitização e ia pro Anki como imagem ilegível.
 *
 * O que este módulo FAZ:
 *   Avalia heurísticas determinísticas (sem rasterizar — só parsing de atributos) que
 *   mapeiam o modo de falha real: nuvem de palavras, fonte estourando, texto fora da
 *   moldura, rótulos sobrepostos. Retorna um veredito {ok, motivos[], metrics}. Os
 *   `motivos` são em PT e servem DUPLAMENTE: (1) log de diagnóstico e (2) feedback
 *   injetado no prompt na re-tentativa ("seu SVG anterior foi reprovado por X; corrija").
 *
 * O que este módulo NÃO faz:
 *   Não julga "é uma BOA ilustração?" (isso exigiria visão/rasterização). Ele barra o
 *   LIXO ESTRUTURAL — fail-closed para "sem imagem" é melhor que "imagem ilegível".
 *
 * Módulo PURO e testável CLI-free (mesmo padrão de section-grouping.ts / sanitize-svg.ts).
 */

// ── Tipos exportados ──────────────────────────────────────────────────────────

export interface SvgQualityMetrics {
  /** Nº de elementos `<text>` no SVG. */
  textNodes: number;
  /** Soma de caracteres de texto visível (todos os `<text>`). */
  totalTextChars: number;
  /** Maior font-size encontrado (px). */
  maxFontSize: number;
  /** Dimensões do viewBox (ou null se ausente/ilegível). */
  viewBox: { width: number; height: number } | null;
  /** Nº de rótulos cujo box estimado escapa os limites do viewBox. */
  outOfBounds: number;
  /** Nº de pares de rótulos com sobreposição significativa estimada. */
  overlappingPairs: number;
}

export interface SvgQualityVerdict {
  /** true ⇔ nenhum motivo de reprovação (motivos vazio). */
  ok: boolean;
  /** Motivos de reprovação em PT (vazio se ok). Reusados como feedback na re-tentativa. */
  motivos: string[];
  metrics: SvgQualityMetrics;
}

export interface SvgQualityThresholds {
  /** Máx. de elementos `<text>` antes de virar "nuvem de palavras". */
  maxTextNodes: number;
  /** Máx. de caracteres de texto somados (rótulos curtos, não frases). */
  maxTotalTextChars: number;
  /** font-size máximo como fração da ALTURA do viewBox (acima disso, estoura a moldura). */
  maxFontFraction: number;
  /** Máx. de pares de rótulos sobrepostos tolerados (acima disso, reprova). */
  maxOverlappingPairs: number;
  /** Folga (fração da dimensão) antes de considerar um rótulo "fora da moldura". */
  boundsMargin: number;
}

/**
 * Limiares padrão — calibrados para barrar o LIXO mostrado (font gigante + textos
 * empilhados + fora da moldura) SEM reprovar imagens iconográficas legítimas
 * (1 título + poucos rótulos curtos). Generosos de propósito: a re-tentativa e o
 * descarte cobrem os casos de fronteira.
 */
export const DEFAULT_SVG_QUALITY: SvgQualityThresholds = {
  maxTextNodes: 14,
  maxTotalTextChars: 240,
  maxFontFraction: 0.3,
  maxOverlappingPairs: 1,
  boundsMargin: 0.06,
};

// ── Parsing render-free (regex sobre SVG já sanitizado/bem-formado) ────────────

interface TextEl {
  x: number | undefined;
  y: number | undefined;
  fontSize: number;
  anchor: 'start' | 'middle' | 'end';
  len: number;
}

/** Lê o valor de um atributo de uma string de atributos (`fill="..."`/`x='...'`). */
function attrOf(attrs: string, name: string): string | undefined {
  const m = attrs.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, 'i'));
  return m ? m[1] : undefined;
}

function numOf(v: string | undefined): number | undefined {
  if (v === undefined) return undefined;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : undefined;
}

/** Extrai {width,height} do viewBox (ou dos atributos width/height como fallback). */
export function parseViewBox(svg: string): { width: number; height: number } | null {
  const vb = svg.match(/viewBox\s*=\s*["']\s*([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s*["']/i);
  if (vb) {
    const width = parseFloat(vb[3]);
    const height = parseFloat(vb[4]);
    if (width > 0 && height > 0) return { width, height };
  }
  // Fallback: width/height numéricos no <svg> raiz (px sem unidade)
  const head = svg.slice(0, svg.indexOf('>') + 1);
  const w = numOf(attrOf(head, 'width'));
  const h = numOf(attrOf(head, 'height'));
  if (w && h && w > 0 && h > 0) return { width: w, height: h };
  return null;
}

/**
 * Extrai os elementos `<text>` com posição, maior font-size (próprio ou de tspans
 * filhos), âncora e comprimento do texto visível (tags internas removidas).
 */
export function extractTextElements(svg: string): TextEl[] {
  const els: TextEl[] = [];
  const re = /<text\b([^>]*)>([\s\S]*?)<\/text>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(svg)) !== null) {
    const attrs = m[1];
    const inner = m[2];
    const content = inner.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    const ownFs = numOf(attrOf(attrs, 'font-size')) ?? 0;
    // tspans podem carregar font-size próprio — pega o maior (estoura quem for maior)
    const tspanFs = [...inner.matchAll(/font-size\s*=\s*["']?\s*([\d.]+)/gi)].map((t) => parseFloat(t[1]));
    const fontSize = Math.max(ownFs, 0, ...tspanFs);
    const anchorRaw = (attrOf(attrs, 'text-anchor') ?? 'start').toLowerCase();
    const anchor = anchorRaw === 'middle' ? 'middle' : anchorRaw === 'end' ? 'end' : 'start';
    els.push({ x: numOf(attrOf(attrs, 'x')), y: numOf(attrOf(attrs, 'y')), fontSize, anchor, len: content.length });
  }
  return els;
}

// ── Geometria estimada (caixa de texto aproximada a partir de baseline/âncora) ──

interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/**
 * Estima a caixa delimitadora de um rótulo a partir de x/y (baseline), âncora,
 * comprimento e font-size. Aproximação grosseira (~0.55em/char, altura ~1.1em),
 * suficiente para flagrar sobreposição/overflow GROSSEIROS — não é um renderizador.
 */
function estimateBox(t: TextEl): Box | null {
  if (t.x === undefined || t.y === undefined || t.fontSize <= 0 || t.len === 0) return null;
  const width = t.len * t.fontSize * 0.55;
  const height = t.fontSize * 1.1;
  const left = t.anchor === 'middle' ? t.x - width / 2 : t.anchor === 'end' ? t.x - width : t.x;
  const top = t.y - t.fontSize; // baseline → topo ≈ y - ascent (~font-size)
  return { left, top, right: left + width, bottom: top + height };
}

function intersectionArea(a: Box, b: Box): number {
  const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
  const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
  return w > 0 && h > 0 ? w * h : 0;
}

function area(b: Box): number {
  return Math.max(0, b.right - b.left) * Math.max(0, b.bottom - b.top);
}

// ── Avaliação ──────────────────────────────────────────────────────────────────

/**
 * Avalia a qualidade visual de um SVG de mnemônico (já sanitizado).
 *
 * Cada heurística violada vira um `motivo` em PT (também usado como feedback na
 * re-tentativa). `ok` = nenhum motivo. Checagens que dependem do viewBox são
 * puladas se o viewBox estiver ausente (não reprova por isso — só não as avalia).
 *
 * Limiares: usa `DEFAULT_SVG_QUALITY` (constante exportado e editável para calibração).
 *
 * @param svg   SVG sanitizado (string começando com `<svg`).
 */
export function avaliarQualidadeSvg(svg: string): SvgQualityVerdict {
  const thr = DEFAULT_SVG_QUALITY;
  const motivos: string[] = [];
  const viewBox = parseViewBox(svg);
  const texts = extractTextElements(svg);

  const totalTextChars = texts.reduce((s, t) => s + t.len, 0);
  const maxFontSize = texts.reduce((s, t) => Math.max(s, t.fontSize), 0);

  // 1. Nuvem de palavras: rótulos demais.
  if (texts.length > thr.maxTextNodes) {
    motivos.push(
      `Texto demais: ${texts.length} rótulos de texto (máximo ${thr.maxTextNodes}). ` +
        `Use POUCOS rótulos curtos e ícones — a imagem é um auxílio de memória, não um texto.`
    );
  }

  // 2. Texto longo demais somado: frases empilhadas em vez de rótulos.
  if (totalTextChars > thr.maxTotalTextChars) {
    motivos.push(
      `Texto longo demais no total (${totalTextChars} caracteres, máximo ${thr.maxTotalTextChars}). ` +
        `Não escreva frases — apenas rótulos curtos (palavras-chave/siglas).`
    );
  }

  // 3. Fonte estourando a moldura (font-size grande relativo à altura do viewBox).
  if (viewBox && maxFontSize > viewBox.height * thr.maxFontFraction) {
    motivos.push(
      `Fonte grande demais: font-size ${Math.round(maxFontSize)} num viewBox de altura ` +
        `${Math.round(viewBox.height)} — o texto estoura a moldura. Use font-size ≤ ` +
        `${Math.floor(viewBox.height * thr.maxFontFraction)}.`
    );
  }

  // 4. Rótulos fora dos limites do viewBox (texto escapando a área visível).
  let outOfBounds = 0;
  if (viewBox) {
    const mx = viewBox.width * thr.boundsMargin;
    const my = viewBox.height * thr.boundsMargin;
    for (const t of texts) {
      const box = estimateBox(t);
      if (!box) continue;
      if (
        box.left < -mx ||
        box.top < -my ||
        box.right > viewBox.width + mx ||
        box.bottom > viewBox.height + my
      ) {
        outOfBounds++;
      }
    }
    if (outOfBounds > 0) {
      motivos.push(
        `${outOfBounds} rótulo(s) de texto fora da moldura (viewBox ${Math.round(viewBox.width)}×` +
          `${Math.round(viewBox.height)}). Reposicione TODO o texto dentro da área visível.`
      );
    }
  }

  // 5. Rótulos sobrepostos (núcleo do modo de falha mostrado).
  const boxes = texts.map(estimateBox).filter((b): b is Box => b !== null);
  let overlappingPairs = 0;
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const inter = intersectionArea(boxes[i], boxes[j]);
      if (inter <= 0) continue;
      const menor = Math.min(area(boxes[i]), boxes[j] ? area(boxes[j]) : Infinity);
      if (menor > 0 && inter > 0.4 * menor) overlappingPairs++;
    }
  }
  if (overlappingPairs > thr.maxOverlappingPairs) {
    motivos.push(
      `${overlappingPairs} par(es) de rótulos sobrepostos. Reposicione os textos para que ` +
        `NÃO se sobreponham (espace verticalmente / use um rótulo por linha).`
    );
  }

  return {
    ok: motivos.length === 0,
    motivos,
    metrics: { textNodes: texts.length, totalTextChars, maxFontSize, viewBox, outOfBounds, overlappingPairs },
  };
}
