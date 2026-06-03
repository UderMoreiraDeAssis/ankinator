/**
 * Normalização pura: Document[] (sidecar LangChain) → LoadedDocument.
 * PDF-03 — D-07, D-08, D-09, D-10.
 *
 * Função PURA: sem I/O (sem fs, sem spawn, sem Python/Java).
 * Testável de forma determinística CLI-free (D-14).
 */
import crypto from 'node:crypto';
import path from 'node:path';
import { cleanMarkdown } from './odl-parse.js';
import type { DocElement, LoadedDocument, Section } from './types.js';

/**
 * Forma esperada de cada documento emitido pelo sidecar Python.
 * Espelha D-01: array JSON [{page_content, metadata}] impresso no stdout.
 */
export interface RawDoc {
  page_content: string;
  metadata: {
    source?: string;
    format?: string;
    /** Número da página — 1-indexed (Pitfall 1: NÃO usar +1 em numPages). */
    page?: number;
  };
}

/** Regex para headings ATX: `# título`, `## título`, ..., `###### título`. */
const ATX = /^(#{1,6})\s+(.+?)\s*#*$/;

/**
 * Extrai seções a partir dos Documents brutos, reparseando os headings ATX
 * de cada `page_content`. Espelha a lógica de `buildSections` de `odl-parse.ts`
 * (flush/pageStart/pageEnd/filtro de seção vazia), porém recebe markdown bruto
 * em vez de `DocElement[]` — adaptação de D-07.
 *
 * Rastreamento de página: cada Document conhece sua `metadata.page`, portanto
 * as seções têm `pageStart`/`pageEnd` derivados dos Documents (não de elementos).
 * R1: não iterar range 1..N; iterar sobre os Documents emitidos.
 */
function buildSectionsFromMarkdown(docs: RawDoc[], fallbackTitle: string): Section[] {
  const sections: Section[] = [];

  /** Seção em construção. */
  let current: {
    title: string;
    level: number;
    pageStart: number;
    pageEnd: number;
    parts: string[];
  } | null = null;

  /** Salva a seção corrente em `sections[]`. */
  const flush = () => {
    if (!current) return;
    const markdown = current.parts.join('\n\n').trim();
    sections.push({
      id: crypto.randomUUID(),
      title: current.title,
      level: current.level,
      pageStart: current.pageStart,
      pageEnd: current.pageEnd,
      markdown,
      charCount: markdown.length,
    });
    current = null;
  };

  for (const doc of docs) {
    const page = doc.metadata.page ?? 1;
    const lines = doc.page_content.split('\n');

    for (const line of lines) {
      const match = line.match(ATX);
      if (match) {
        // Flush da seção anterior e abre nova seção a partir deste heading ATX.
        flush();
        // D-07: clampar nível 1..6 (espelhando `elementToMarkdown` de odl-parse.ts).
        const level = Math.min(Math.max(match[1].length, 1), 6);
        const title = match[2];
        const headingLine = '#'.repeat(level) + ' ' + title;
        current = {
          title,
          level,
          pageStart: page,
          pageEnd: page,
          parts: [headingLine],
        };
      } else {
        if (!current) {
          // Conteúdo antes do primeiro heading → seção fallback.
          current = {
            title: fallbackTitle,
            level: 1,
            pageStart: page,
            pageEnd: page,
            parts: [],
          };
        }
        if (line.trim()) {
          current.parts.push(line);
        }
        // Atualiza pageEnd com a página corrente conforme o conteúdo avança.
        current.pageEnd = Math.max(current.pageEnd, page);
      }
    }

    // Ao terminar um Document, atualiza pageEnd (cobre headings no último Document).
    if (current) {
      current.pageEnd = Math.max(current.pageEnd, page);
    }
  }

  flush();

  // Filtro de seção vazia — idêntico ao de `buildSections` (linhas 136-138 de odl-parse.ts):
  // manter seção se tiver conteúdo além do título OU se for a única seção.
  return sections.filter(
    (s) => s.markdown.replace(/^#+\s.*$/m, '').trim().length > 0 || sections.length === 1
  );
}

/**
 * Converte o array de Documents emitidos pelo sidecar Python no `LoadedDocument`
 * consumido pelo pipeline Ankinator.
 *
 * @param docs   Array de Documents (saída do `json.dumps` do sidecar — D-01).
 * @param pdfPath Caminho do PDF original (usado para `fileName` e `fallbackTitle`).
 * @returns `LoadedDocument` pronto para `chunkDocument` e geração de questões.
 */
export function normalize(docs: RawDoc[], pdfPath: string): LoadedDocument {
  const fileName = path.basename(pdfPath);
  const fallbackTitle = path.basename(pdfPath, path.extname(pdfPath));

  // D-08: 1 'text block' por Document emitido (não por página física — R1).
  // O chunker ignora `elements`; preservamos para inspeção/depuração.
  const elements: DocElement[] = docs.map((d) => ({
    type: 'text block' as const,
    page: d.metadata.page ?? 1,
    content: d.page_content,
  }));

  // D-09: markdown completo = join das páginas + cleanMarkdown (reuso de odl-parse.ts).
  // SEM marcadores de página (ex.: "Page 1 of N" — removidos pelo join limpo).
  const rawMarkdown = docs.map((d) => d.page_content).join('\n\n');
  const markdown = cleanMarkdown(rawMarkdown);

  // D-07: sections reparseando headings ATX do markdown bruto de cada Document.
  const sections = buildSectionsFromMarkdown(docs, fallbackTitle);

  // D-10: campos-topo derivados.
  // Pitfall 1 — page é 1-indexed → numPages = max(page) SEM +1.
  // R1 — não assumir Documents contíguos; usar max dos valores emitidos.
  const pages = docs.map((d) => d.metadata.page ?? 1);
  const numPages = pages.length ? Math.max(...pages) : 1;

  // Pitfall 4 — title = 1º heading ATX no markdown bruto, OU null (nunca a 1ª linha de texto).
  let title: string | null = null;
  for (const line of rawMarkdown.split('\n')) {
    const match = line.match(ATX);
    if (match) {
      title = match[2];
      break;
    }
  }

  return {
    fileName,
    numPages,
    title,
    markdown,
    sections,
    elements,
    usedOcr: false,
  };
}
