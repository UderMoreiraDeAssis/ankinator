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
import { log } from '../logger.js';

const CHARS_PER_TOKEN = 4;

export interface ChunkOptions {
  /** Orçamento aproximado de caracteres por bloco (~tokens*4). */
  maxCharsPerChunk?: number;
  /** Se fornecido, considera apenas as seções com estes ids. */
  selectedSectionIds?: string[];
  /** Sobreposição: nº de caracteres da cauda do bloco anterior anexados como contexto (0 = sem overlap). */
  overlapChars?: number;
}

const estTokens = (chars: number) => Math.ceil(chars / CHARS_PER_TOKEN);

/**
 * Extrai a cauda (~overlapChars) de um markdown, começando numa fronteira limpa
 * (após uma quebra de parágrafo, senão de linha) para não cortar no meio de uma frase.
 */
function overlapTail(markdown: string, overlapChars: number): string {
  if (overlapChars <= 0 || !markdown) return '';
  if (markdown.length <= overlapChars) return markdown.trim();
  const tail = markdown.slice(-overlapChars);
  const par = tail.indexOf('\n\n');
  if (par >= 0) return tail.slice(par + 2).trim();
  const nl = tail.indexOf('\n');
  return (nl >= 0 ? tail.slice(nl + 1) : tail).trim();
}

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

  // reindexa + anexa a sobreposição (cauda do bloco anterior) como CONTEXTO de cada bloco.
  // O overlap NÃO entra no orçamento de empacotamento (é adicionado depois) e é entregue
  // ao modelo separado do TRECHO, marcado como "não gere questões daqui" (anti-duplicata).
  const overlapChars = opts.overlapChars ?? 0;
  const finalChunks = chunks.map((c, i) => {
    const ctx = i > 0 ? overlapTail(chunks[i - 1].markdown, overlapChars) : '';
    return { ...c, index: i, ...(ctx ? { contextoAnterior: ctx } : {}) };
  });

  // Resumo do plano de chunking: quantas seções entraram, quantos blocos saíram,
  // o overlap aplicado e o tamanho (chars) de cada bloco — para o usuário ver o
  // empacotamento e calibrar maxCharsPerChunk / ANKINATOR_CHUNK_OVERLAP.
  log.info('chunker', `${selected.length} seção(ões) selecionada(s) → ${finalChunks.length} chunk(s)`, {
    secoesSelecionadas: selected.length,
    chunks: finalChunks.length,
    maxCharsPerChunk: maxChars,
    overlapChars,
    tamanhos: finalChunks.map((c) => c.charCount),
  });

  return finalChunks;
}
