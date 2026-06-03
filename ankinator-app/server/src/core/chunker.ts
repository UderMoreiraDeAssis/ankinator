/**
 * Chunking semântico.
 *
 * Substitui o antigo `simulatePages` (dividia o texto por média de caracteres,
 * errando os limites de página). Aqui empacotamos SEÇÕES reais (derivadas dos
 * títulos pelo OpenDataLoader) em blocos que cabem num orçamento de tokens,
 * preservando fronteiras de assunto. Seções grandes demais são subdivididas por
 * parágrafos, sem quebrar no meio de uma frase quando possível.
 */
import type { LoadedDocument, Section, SemanticChunk } from './types.js';

const CHARS_PER_TOKEN = 4;

export interface ChunkOptions {
  /** Orçamento aproximado de caracteres por bloco (~tokens*4). */
  maxCharsPerChunk?: number;
  /** Se fornecido, considera apenas as seções com estes ids. */
  selectedSectionIds?: string[];
}

const estTokens = (chars: number) => Math.ceil(chars / CHARS_PER_TOKEN);

/** Divide o markdown de uma seção grande em pedaços por parágrafo. */
function splitLargeSection(section: Section, maxChars: number): string[] {
  const paragraphs = section.markdown.split(/\n{2,}/);
  const pieces: string[] = [];
  let buf = '';
  for (const p of paragraphs) {
    if (buf && buf.length + p.length + 2 > maxChars) {
      pieces.push(buf.trim());
      buf = '';
    }
    // parágrafo único maior que o orçamento: corta em frases
    if (p.length > maxChars) {
      const sentences = p.split(/(?<=[.!?])\s+/);
      for (const s of sentences) {
        if (buf && buf.length + s.length + 1 > maxChars) {
          pieces.push(buf.trim());
          buf = '';
        }
        buf += (buf ? ' ' : '') + s;
      }
    } else {
      buf += (buf ? '\n\n' : '') + p;
    }
  }
  if (buf.trim()) pieces.push(buf.trim());
  return pieces.length ? pieces : [section.markdown];
}

/**
 * Empacota as seções do documento em blocos semânticos.
 */
export function chunkDocument(doc: LoadedDocument, opts: ChunkOptions = {}): SemanticChunk[] {
  const maxChars = opts.maxCharsPerChunk ?? 12000;
  const selected = opts.selectedSectionIds
    ? doc.sections.filter((s) => opts.selectedSectionIds!.includes(s.id))
    : doc.sections;

  const chunks: SemanticChunk[] = [];
  let cur: { titles: string[]; pageStart: number; pageEnd: number; parts: string[]; chars: number } | null = null;

  const flush = () => {
    if (!cur || !cur.parts.join('').trim()) {
      cur = null;
      return;
    }
    const markdown = cur.parts.join('\n\n').trim();
    chunks.push({
      index: chunks.length,
      sectionTitles: cur.titles,
      pageStart: cur.pageStart,
      pageEnd: cur.pageEnd,
      markdown,
      charCount: markdown.length,
      estimatedTokens: estTokens(markdown.length),
    });
    cur = null;
  };

  for (const section of selected) {
    if (section.charCount > maxChars) {
      // seção grande: emite o bloco atual e quebra a seção em vários blocos
      flush();
      const pieces = splitLargeSection(section, maxChars);
      pieces.forEach((piece) => {
        chunks.push({
          index: chunks.length,
          sectionTitles: [section.title],
          pageStart: section.pageStart,
          pageEnd: section.pageEnd,
          markdown: piece,
          charCount: piece.length,
          estimatedTokens: estTokens(piece.length),
        });
      });
      continue;
    }

    if (cur && cur.chars + section.charCount > maxChars) flush();
    if (!cur) {
      cur = { titles: [], pageStart: section.pageStart, pageEnd: section.pageEnd, parts: [], chars: 0 };
    }
    cur.titles.push(section.title);
    cur.parts.push(section.markdown);
    cur.chars += section.charCount;
    cur.pageStart = Math.min(cur.pageStart, section.pageStart);
    cur.pageEnd = Math.max(cur.pageEnd, section.pageEnd);
  }
  flush();

  // reindexa para garantir índices contíguos
  return chunks.map((c, i) => ({ ...c, index: i }));
}
