/**
 * Exportador CSV compatível com o Anki.
 * Formato: Frente;Verso;Tags;Fonte  (delimitador ';', UTF-8 com BOM).
 * Porta a lógica do antigo AnkiCsvFormatter para o novo tipo Questao.
 */
import { stringify } from 'csv-stringify/sync';
import path from 'node:path';
import type { Questao } from '../types.js';

export interface CsvOptions {
  /** Nome do arquivo PDF de origem (para o campo Fonte). */
  fonte?: string;
  /** Tags padrão adicionadas a todas as questões. */
  tagsPadrao?: string[];
}

function fonteDaQuestao(q: Questao, baseFonte: string): string {
  if (q.pageStart && q.pageEnd) {
    return q.pageStart === q.pageEnd
      ? `${baseFonte} (p.${q.pageStart})`
      : `${baseFonte} (p.${q.pageStart}-${q.pageEnd})`;
  }
  return baseFonte;
}

function tagsDaQuestao(q: Questao, padrao: string[]): string {
  const tags = new Set<string>([q.tipo, ...padrao]);
  if (q.metadata?.banca) {
    tags.add(q.metadata.banca.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, ''));
  }
  if (q.metadata?.ano) tags.add(String(q.metadata.ano));
  return [...tags].filter(Boolean).join(' ');
}

function versoDaQuestao(q: Questao): string {
  let verso = q.resposta;
  const m = q.metadata;
  if (m && Object.keys(m).length) {
    const linhas: string[] = [];
    if (m.gabarito) linhas.push(`Gabarito: ${m.gabarito}`);
    if (m.alternativas?.length) linhas.push(`Alternativas:\n${m.alternativas.join('\n')}`);
    if (m.banca) linhas.push(`Banca: ${m.banca}`);
    if (m.ano) linhas.push(`Ano: ${m.ano}`);
    if (linhas.length) verso += `\n\n${linhas.join('\n')}`;
  }
  return verso;
}

/** Gera o conteúdo CSV (string com BOM) para um conjunto de questões. */
export function toAnkiCsv(questoes: Questao[], opts: CsvOptions = {}): string {
  const baseFonte = opts.fonte ? path.basename(opts.fonte, path.extname(opts.fonte)) : 'material';
  const padrao = opts.tagsPadrao ?? [];

  const rows = questoes.map((q) => ({
    frente: q.pergunta,
    verso: versoDaQuestao(q),
    tags: tagsDaQuestao(q, padrao),
    fonte: fonteDaQuestao(q, baseFonte),
  }));

  const csv = stringify(rows, {
    header: true,
    columns: [
      { key: 'frente', header: 'Frente' },
      { key: 'verso', header: 'Verso' },
      { key: 'tags', header: 'Tags' },
      { key: 'fonte', header: 'Fonte' },
    ],
    delimiter: ';',
    quoted: true,
    quoted_string: true,
    escape: '"',
  });

  return '﻿' + csv;
}
