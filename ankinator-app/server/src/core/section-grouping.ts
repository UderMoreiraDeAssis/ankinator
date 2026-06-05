/**
 * Reagrupamento hierárquico de seções + revisor determinístico (zero quota).
 *
 * PROBLEMA (2026-06-04): o OpenDataLoader marca rótulos de lista em negrito
 * ("• Dados numéricos:", "• Dados de datas:", …) como HEADINGS profundos
 * (nível 6). Como `buildSections` abria uma seção a CADA heading, uma seção
 * coerente como "1.4 Formatos de dados digitais" era fraturada em vários blocos
 * minúsculos, isolados e sem contexto — o modelo via cada fragmento sozinho e
 * podia classificá-lo/enviesá-lo diferente. Os dois loaders (odl-parse e
 * langchain-normalize) sofriam do mesmo bug.
 *
 * SOLUÇÃO (escolha do usuário): agrupamento HIERÁRQUICO por nível — só headings
 * "de topo" (nível ≤ boundary) abrem bloco; sub-headings profundos são dobrados
 * como CONTEÚDO do bloco pai. Depois um REVISOR determinístico funde fragmentos
 * órfãos minúsculos no vizinho e sinaliza blocos suspeitos (`aviso`). Sem nenhuma
 * chamada de LLM.
 *
 * Como cada `Section` já carrega `level`, isto é um pós-processador PURO sobre
 * `Section[]`, compartilhado pelos dois loaders (DRY).
 */
import type { Section } from './types.js';

/** Headings até este nível abrem bloco; mais profundos dobram no pai. */
export const DEFAULT_BOUNDARY_LEVEL = 3;
/** Corpo abaixo disto = órfão quase-vazio → fundido no vizinho (revisor, passo 1). */
export const DEFAULT_MERGE_CHARS = 40;
/** Corpo abaixo disto (mas ≥ merge) = bloco curto → sinalizado p/ revisão (revisor, passo 2). */
export const DEFAULT_MIN_SECTION_CHARS = 140;

export interface GroupOptions {
  boundaryLevel?: number;
  /** Corpo mínimo abaixo do qual um bloco é SINALIZADO para revisão. */
  minSectionChars?: number;
  /** Corpo mínimo abaixo do qual um bloco órfão é FUNDIDO no vizinho. */
  mergeChars?: number;
}

/** Conta os caracteres do CORPO (markdown sem as linhas de heading ATX). */
function bodyChars(markdown: string): number {
  return markdown
    .replace(/^#{1,6}\s.*$/gm, '')
    .replace(/\s+/g, ' ')
    .trim().length;
}

/** Rebaixa a 1ª linha (se for heading ATX) para negrito — ao dobrar sub-heading no pai. */
function demoteLeadingHeading(markdown: string): string {
  return markdown.replace(
    /^#{1,6}[ \t]+(.+?)(?:[ \t]+#+)?[ \t]*(\r?\n|$)/,
    (_m, texto: string, fim: string) => `**${texto.trim()}**${fim}`
  );
}

/**
 * Agrupamento hierárquico: sub-headings profundos (nível > boundary) são dobrados
 * como conteúdo do bloco "de topo" anterior, em vez de abrir um bloco novo.
 *
 * O boundary é ADAPTATIVO: nunca menor que o nível mais raso presente, para que um
 * documento cujos headings são todos profundos ainda seja segmentado (e não vire um
 * único bloco gigante).
 */
export function regroupSections(sections: Section[], boundaryLevel = DEFAULT_BOUNDARY_LEVEL): Section[] {
  if (sections.length <= 1) return sections;
  const minLevel = Math.min(...sections.map((s) => s.level));
  const boundary = Math.max(boundaryLevel, minLevel);

  const out: Section[] = [];
  let aberta: Section | null = null;

  for (const s of sections) {
    if (!aberta || s.level <= boundary) {
      // novo bloco "de topo" — mantém id/title/level próprios
      if (aberta) out.push(aberta);
      aberta = { ...s };
      continue;
    }
    // aberta é não-null aqui (o caso !aberta foi tratado acima); s é sub-heading
    // profundo → dobra como conteúdo do pai (sub-rótulo em negrito, não heading).
    const markdown = `${aberta.markdown}\n\n${demoteLeadingHeading(s.markdown)}`.trim();
    const dobrada: Section = {
      ...aberta,
      markdown,
      charCount: markdown.length,
      pageStart: Math.min(aberta.pageStart, s.pageStart),
      pageEnd: Math.max(aberta.pageEnd, s.pageEnd),
    };
    aberta = dobrada;
  }
  if (aberta) out.push(aberta);
  return out;
}

/**
 * Revisor determinístico (zero quota), em dois passos independentes:
 *  1. FUNDE órfãos quase-vazios (corpo < mergeChars — ex.: bloco só-título) no vizinho
 *     (anterior; a 1ª seção, no seguinte);
 *  2. SINALIZA via `aviso` os blocos que sobrevivem mas ainda estão curtos
 *     (corpo < flagChars) — o usuário decide se revisa, não fundimos à força.
 */
export function reviewSections(
  sections: Section[],
  opts: { mergeChars?: number; flagChars?: number } = {}
): Section[] {
  const mergeChars = opts.mergeChars ?? DEFAULT_MERGE_CHARS;
  const flagChars = opts.flagChars ?? DEFAULT_MIN_SECTION_CHARS;
  if (sections.length === 0) return sections;

  // 1) funde órfãos quase-vazios no anterior
  const fundidas: Section[] = [];
  for (const s of sections) {
    const anterior = fundidas[fundidas.length - 1];
    if (anterior && bodyChars(s.markdown) < mergeChars) {
      const markdown = `${anterior.markdown}\n\n${s.markdown}`.trim();
      fundidas[fundidas.length - 1] = {
        ...anterior,
        markdown,
        charCount: markdown.length,
        pageStart: Math.min(anterior.pageStart, s.pageStart),
        pageEnd: Math.max(anterior.pageEnd, s.pageEnd),
      };
    } else {
      fundidas.push({ ...s });
    }
  }
  // a 1ª seção, se órfã, funde no SEGUINTE (não tinha anterior para absorvê-la)
  if (fundidas.length >= 2 && bodyChars(fundidas[0].markdown) < mergeChars) {
    const primeira = fundidas[0];
    const segunda = fundidas[1];
    const markdown = `${primeira.markdown}\n\n${segunda.markdown}`.trim();
    fundidas[1] = {
      ...segunda, // mantém title/level/id da seção "real" seguinte
      markdown,
      charCount: markdown.length,
      pageStart: Math.min(primeira.pageStart, segunda.pageStart),
      pageEnd: Math.max(primeira.pageEnd, segunda.pageEnd),
    };
    fundidas.shift();
  }

  // 2) sinaliza curtos (apenas quando há mais de um bloco — um bloco único é o doc inteiro)
  const unica = fundidas.length === 1;
  return fundidas.map((s) =>
    !unica && bodyChars(s.markdown) < flagChars
      ? { ...s, aviso: 'Bloco curto — confira se a extração não fragmentou o conteúdo.' }
      : s
  );
}

/** Conveniência: reagrupa (hierárquico) e depois revisa (funde órfãos + sinaliza). */
export function groupSections(sections: Section[], opts: GroupOptions = {}): Section[] {
  const reagrupadas = regroupSections(sections, opts.boundaryLevel ?? DEFAULT_BOUNDARY_LEVEL);
  return reviewSections(reagrupadas, {
    mergeChars: opts.mergeChars ?? DEFAULT_MERGE_CHARS,
    flagChars: opts.minSectionChars ?? DEFAULT_MIN_SECTION_CHARS,
  });
}
