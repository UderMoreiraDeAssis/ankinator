/**
 * Parser da saída do OpenDataLoader (JSON + Markdown) → LoadedDocument.
 * Compartilhado pelo loader local (Java) e pelo loader de OCR (Python).
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type { DocElement, LoadedDocument, Section } from './types.js';
import { groupSections } from './section-grouping.js';
import { log } from '../logger.js';

export interface RawNode {
  type?: string;
  id?: number;
  'page number'?: number;
  'heading level'?: number;
  content?: string;
  source?: string;
  rows?: RawTableRow[];
  kids?: RawNode[];
  /** Itens de um nó `list` — o OpenDataLoader os guarda AQUI, não em `content`/`kids`. */
  'list items'?: RawNode[];
}
interface RawTableRow {
  cells?: { content?: string; kids?: RawNode[] }[];
}

const TEXT_TYPES = new Set(['heading', 'paragraph', 'caption', 'list', 'title']);

function collectText(nodes: RawNode[]): string {
  let out = '';
  for (const n of nodes) {
    if (n.content) out += n.content + ' ';
    if (n.kids) out += collectText(n.kids);
  }
  return out;
}

function renderTable(node: RawNode): string | null {
  const rows = node.rows ?? [];
  const lines: string[] = [];
  let hasText = false;
  for (const row of rows) {
    const cells = (row.cells ?? []).map((c) => {
      const txt = (c.content ?? collectText(c.kids ?? [])).replace(/\s+/g, ' ').trim();
      if (txt) hasText = true;
      return txt;
    });
    lines.push('| ' + cells.join(' | ') + ' |');
  }
  return hasText ? lines.join('\n') : null;
}

/**
 * Renderiza um nó `list` do OpenDataLoader em markdown.
 *
 * Bug histórico (RT-fidelidade): a lista guarda os itens no campo `"list items"`
 * (cada item com seu `content`), NÃO em `content`/`kids`. O `flatten` antigo só
 * lia `content`/`kids` → descartava 100% das listas (alternativas A-E de questões,
 * róis taxativos, bullets) dos chunks vistos pelo modelo, fazendo-o relatar que
 * "as alternativas não estavam no trecho".
 */
function renderList(node: RawNode): string | null {
  const items = node['list items'] ?? [];
  const parts: string[] = [];
  for (const item of items) {
    const txt = (item.content ?? '').trim();
    if (txt) parts.push(txt);
    // conteúdo aninhado (sublistas/parágrafos dentro do item)
    if (item.kids?.length) {
      const sub: DocElement[] = [];
      flatten(item.kids, sub);
      const subMd = sub.map(elementToMarkdown).join('\n').trim();
      if (subMd) parts.push(subMd);
    }
  }
  const out = parts.join('\n').trim();
  return out || null;
}

function flatten(nodes: RawNode[], acc: DocElement[]): void {
  for (const n of nodes) {
    const page = n['page number'] ?? acc.at(-1)?.page ?? 1;
    if (n.type === 'table') {
      const md = renderTable(n);
      if (md) acc.push({ type: 'table', id: n.id, page, content: md });
      continue;
    }
    if (n.type === 'list') {
      const md = renderList(n);
      if (md) acc.push({ type: 'list', id: n.id, page, content: md });
      continue;
    }
    if (n.type && TEXT_TYPES.has(n.type) && n.content) {
      acc.push({
        type: n.type,
        id: n.id,
        page,
        headingLevel: n.type === 'heading' ? n['heading level'] ?? 1 : undefined,
        content: n.content.trim(),
      });
    }
    if (n.kids && n.kids.length) flatten(n.kids, acc);
  }
}

/** Wrapper puro p/ teste: achata a árvore JSON do OpenDataLoader em DocElement[]. */
export function flattenNodes(nodes: RawNode[]): DocElement[] {
  const acc: DocElement[] = [];
  flatten(nodes, acc);
  return acc;
}

/**
 * Limpa artefatos do markdown cru do OpenDataLoader:
 * - remove linhas de tabela vazias (`| | |`, `|---|`, etc. sem texto);
 * - colapsa 3+ linhas em branco em 2.
 */
// D-09: exportado para reuso no módulo langchain-normalize
export function cleanMarkdown(md: string): string {
  const lines = md.split('\n');
  const kept: string[] = [];
  for (const line of lines) {
    const t = line.trim();
    // linha de tabela cujo conteúdo entre pipes é só espaços/traços
    if (/^\|[\s|:-]*\|$/.test(t) && !/[A-Za-z0-9À-ÿ]/.test(t)) continue;
    kept.push(line);
  }
  return kept.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function elementToMarkdown(el: DocElement): string {
  if (el.type === 'heading') {
    const level = Math.min(Math.max(el.headingLevel ?? 1, 1), 6);
    return `${'#'.repeat(level)} ${el.content}`;
  }
  return el.content ?? '';
}

function buildSections(elements: DocElement[], fallbackTitle: string): Section[] {
  const sections: Section[] = [];
  let current:
    | { title: string; level: number; pageStart: number; pageEnd: number; parts: string[] }
    | null = null;

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
  };

  for (const el of elements) {
    if (el.type === 'heading') {
      flush();
      current = {
        title: el.content ?? fallbackTitle,
        level: el.headingLevel ?? 1,
        pageStart: el.page,
        pageEnd: el.page,
        parts: [elementToMarkdown(el)],
      };
    } else {
      if (!current) {
        current = { title: fallbackTitle, level: 1, pageStart: el.page, pageEnd: el.page, parts: [] };
      }
      current.parts.push(elementToMarkdown(el));
      current.pageEnd = Math.max(current.pageEnd, el.page);
    }
  }
  flush();

  return sections.filter(
    (s) => s.markdown.replace(/^#+\s.*$/m, '').trim().length > 0 || sections.length === 1
  );
}

/**
 * Lê os arquivos `<base>.json` e `<base>.md` gerados em `outDir` e monta o LoadedDocument.
 */
export async function parseOdlOutput(outDir: string, pdfPath: string): Promise<LoadedDocument> {
  const base = path.basename(pdfPath, path.extname(pdfPath));
  const jsonPath = path.join(outDir, `${base}.json`);
  const mdPath = path.join(outDir, `${base}.md`);

  const [jsonRaw, markdown] = await Promise.all([
    fs.readFile(jsonPath, 'utf8'),
    fs.readFile(mdPath, 'utf8').catch(() => ''),
  ]);
  const json = JSON.parse(jsonRaw) as RawNode & {
    'file name'?: string;
    'number of pages'?: number;
    title?: string | null;
  };

  const elements: DocElement[] = [];
  flatten(json.kids ?? [], elements);

  log.info('odl-parse', `loader=node: ${elements.length} elemento(s) achatado(s)`, {
    loader: 'node',
    elementos: elements.length,
    numPages: (json['number of pages'] as number) ?? 1,
  });

  const fallbackTitle = (json.title as string) || base;
  // Agrupamento hierárquico + revisor determinístico: sub-headings profundos (rótulos
  // de lista mal-detectados como heading) dobram no bloco pai; órfãos minúsculos fundem.
  // Logamos ANTES e DEPOIS de groupSections para o usuário ver o reagrupamento acontecer.
  const secoesBrutas = buildSections(elements, fallbackTitle);
  log.debug('odl-parse', `buildSections: ${secoesBrutas.length} bloco(s) bruto(s)`, { blocos: secoesBrutas.length });
  const sections = groupSections(secoesBrutas);
  const sinalizadas = sections.filter((s) => s.aviso).length;
  log.info('odl-parse',
    `buildSections: ${secoesBrutas.length} → groupSections: ${sections.length} bloco(s) (${sinalizadas} sinalizado(s))`,
    { antes: secoesBrutas.length, depois: sections.length, sinalizados: sinalizadas }
  );

  return {
    fileName: (json['file name'] as string) ?? path.basename(pdfPath),
    numPages: (json['number of pages'] as number) ?? 1,
    title: (json.title as string) ?? null,
    markdown: markdown.trim() || elements.map(elementToMarkdown).join('\n\n'),
    sections,
    elements,
    usedOcr: false,
  };
}
