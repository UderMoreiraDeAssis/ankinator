/**
 * Exportador CSV compatível com o Anki.
 * Formato: Frente;Verso;Tags;Fonte  (delimitador ';', UTF-8 com BOM).
 * Porta a lógica do antigo AnkiCsvFormatter para o novo tipo Questao.
 *
 * Phase 6: frente e verso agora usam buildFrontHtml/buildBackHtml (card-html.ts)
 * para gerar HTML educacional rico autocontido com inline CSS. O Anki renderiza
 * HTML em campos de notas importadas via CSV.
 */
import { stringify } from 'csv-stringify/sync';
import path from 'node:path';
import type { Questao } from '../types.js';
import { buildFrontHtml, buildBackHtml } from './card-html.js';

export interface CsvOptions {
  /** Nome do arquivo PDF de origem (para o campo Fonte). */
  fonte?: string;
  /** Tags padrão adicionadas a todas as questões. */
  tagsPadrao?: string[];
  /** Deck fallback quando q.deck está ausente (D-08). */
  deck?: string;
}

function fonteDaQuestao(q: Questao, baseFonte: string): string {
  if (q.pageStart && q.pageEnd) {
    return q.pageStart === q.pageEnd
      ? `${baseFonte} (p.${q.pageStart})`
      : `${baseFonte} (p.${q.pageStart}-${q.pageEnd})`;
  }
  return baseFonte;
}

export function tagsDaQuestao(q: Questao, padrao: string[]): string {
  const tags = new Set<string>([q.tipo, ...padrao, ...(q.tags ?? [])]);
  if (q.metadata?.banca) {
    tags.add(q.metadata.banca.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, ''));
  }
  if (q.metadata?.ano) tags.add(String(q.metadata.ano));
  return [...tags].filter(Boolean).join(' ');
}

/** Gera o conteúdo CSV (string com BOM) para um conjunto de questões. */
export function toAnkiCsv(questoes: Questao[], opts: CsvOptions = {}): string {
  const baseFonte = opts.fonte ? path.basename(opts.fonte, path.extname(opts.fonte)) : 'material';
  const padrao = opts.tagsPadrao ?? [];
  const deckFallback = opts.deck ?? 'Ankinator';

  // gate: coluna Deck só quando algum card tem q.deck preenchido (D-08 / PIPE-03 byte-identidade)
  const temDeck = questoes.some((q) => q.deck);

  // Phase 6: frente = HTML rico, verso = HTML rico com fonte opcional
  // buildBackHtml recebe o baseFonte para o rodapé (📎 linha)
  const rows = questoes.map((q) => ({
    frente: buildFrontHtml(q),
    verso: buildBackHtml(q, opts.fonte ? baseFonte : undefined),
    tags: tagsDaQuestao(q, padrao),
    fonte: fonteDaQuestao(q, baseFonte),
    ...(temDeck ? { deck: q.deck ?? deckFallback } : {}),
  }));

  const columns = [
    { key: 'frente', header: 'Frente' },
    { key: 'verso', header: 'Verso' },
    { key: 'tags', header: 'Tags' },
    { key: 'fonte', header: 'Fonte' },
    ...(temDeck ? [{ key: 'deck', header: 'Deck' }] : []),
  ];

  const csvBody = stringify(rows, {
    header: true,
    columns,
    delimiter: ';',
    quoted: true,
    quoted_string: true,
    escape: '"',
  });

  // BOM primeiro, depois headers Anki, depois dados (Pitfall 7)
  const headerLines = temDeck ? '#separator:Semicolon\n#deck column:5\n' : '';
  return '﻿' + headerLines + csvBody;
}
