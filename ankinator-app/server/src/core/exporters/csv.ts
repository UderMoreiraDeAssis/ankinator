/**
 * Exportador CSV compatível com o Anki.
 * Formato: Frente;Verso;Tags;Fonte  (delimitador ';', UTF-8 com BOM).
 * Porta a lógica do antigo AnkiCsvFormatter para o novo tipo Questao.
 */
import { stringify } from 'csv-stringify/sync';
import path from 'node:path';
import type { Questao } from '../types.js';
import { sanitizarSvg } from '../specialists/sanitize-svg.js';

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
  // Phase 4: mnemônico-texto (gate: byte-idêntico quando ausente — PIPE-03/D-10)
  if (q.mnemonico) {
    verso += `\n\n💡 Mnemônico: ${q.mnemonico}`;
  }
  // SVG inline (gate: byte-idêntico quando ausente — PIPE-03/D-10)
  // NUNCA chamar escapeHtml() no SVG — já sanitizado no Plano 02 (D-08);
  // escaping quebraria a marcação SVG no Anki (Pitfall 2)
  if (q.mnemonicoSvg) {
    // CR-01: re-sanitizar no boundary de export — sanitizarSvg só roda na geração
    // (enrich), então payloads vindos direto do req.body burlariam a sanitização.
    // Fail-closed (D-08): descarta o SVG se inválido. Idempotente p/ SVG já-limpo.
    const svgLimpo = sanitizarSvg(q.mnemonicoSvg);
    if (svgLimpo) verso += `\n\n${svgLimpo}`;
  }
  return verso;
}

/** Gera o conteúdo CSV (string com BOM) para um conjunto de questões. */
export function toAnkiCsv(questoes: Questao[], opts: CsvOptions = {}): string {
  const baseFonte = opts.fonte ? path.basename(opts.fonte, path.extname(opts.fonte)) : 'material';
  const padrao = opts.tagsPadrao ?? [];
  const deckFallback = opts.deck ?? 'Ankinator';

  // gate: coluna Deck só quando algum card tem q.deck preenchido (D-08 / PIPE-03 byte-identidade)
  const temDeck = questoes.some((q) => q.deck);

  const rows = questoes.map((q) => ({
    frente: q.pergunta,
    verso: versoDaQuestao(q),
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
