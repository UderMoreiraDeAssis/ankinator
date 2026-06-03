/**
 * Anki CSV Formatter
 * Converts questions to Anki-compatible CSV format
 */

import { stringify } from 'csv-stringify/sync';
import { Questao, AnkiCard } from '../types/questao-types.js';
import path from 'path';

export class AnkiCsvFormatter {
  /**
   * Convert questoes to Anki CSV format
   * Format: Frente;Verso;Tags;Fonte
   */
  static formatToAnkiCSV(
    questoes: Questao[],
    pdfPath: string,
    chunkInfo?: { pageStart: number; pageEnd: number }
  ): string {
    const pdfName = path.basename(pdfPath, '.pdf');
    const fonte = chunkInfo
      ? `${pdfName} (p.${chunkInfo.pageStart}-${chunkInfo.pageEnd})`
      : pdfName;

    const cards: AnkiCard[] = questoes.map(q => this.questaoToAnkiCard(q, fonte));

    // Generate CSV with UTF-8 BOM for Windows compatibility
    const csv = stringify(cards, {
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

    // Add UTF-8 BOM
    return '\uFEFF' + csv;
  }

  /**
   * Convert single Questao to AnkiCard
   */
  private static questaoToAnkiCard(questao: Questao, fonte: string): AnkiCard {
    const frente = `Q: ${questao.pergunta}`;

    let verso = `A: ${questao.resposta}`;

    // Add metadata if available (for extracted questions)
    if (questao.metadata && Object.keys(questao.metadata).length > 0) {
      verso += '\n\nMetadata:';

      if (questao.metadata.banca) {
        verso += `\nBanca: ${questao.metadata.banca}`;
      }

      if (questao.metadata.ano) {
        verso += `\nAno: ${questao.metadata.ano}`;
      }

      if (questao.metadata.gabarito) {
        verso += `\nGabarito: ${questao.metadata.gabarito}`;
      }

      if (questao.metadata.alternativas && questao.metadata.alternativas.length > 0) {
        verso += `\nAlternativas:\n${questao.metadata.alternativas.join('\n')}`;
      }
    }

    // Generate tags
    const tags = this.generateTags(questao);

    return {
      frente,
      verso,
      tags,
      fonte,
    };
  }

  /**
   * Generate tags for a question
   */
  private static generateTags(questao: Questao): string {
    const tags: string[] = [];

    // Add type tag
    tags.push(questao.tipo);

    // Add metadata tags if available
    if (questao.metadata) {
      if (questao.metadata.banca) {
        // Normalize banca name for tag (lowercase, no spaces)
        const bancaTag = questao.metadata.banca
          .toLowerCase()
          .replace(/\s+/g, '-')
          .replace(/[^\w-]/g, '');
        tags.push(bancaTag);
      }

      if (questao.metadata.ano) {
        tags.push(questao.metadata.ano.toString());
      }
    }

    // Add default tags
    tags.push('pmbok');
    tags.push('concurso');

    return tags.join(' ');
  }

  /**
   * Validate CSV content
   */
  static validateCSV(csvContent: string): {
    valid: boolean;
    errors: string[];
    lineCount: number;
  } {
    const errors: string[] = [];
    const lines = csvContent.split('\n');
    const lineCount = lines.length - 1; // Exclude header

    // Check UTF-8 BOM
    if (!csvContent.startsWith('\uFEFF')) {
      errors.push('Missing UTF-8 BOM (may cause encoding issues on Windows)');
    }

    // Check header
    const headerLine = csvContent.replace('\uFEFF', '').split('\n')[0];
    const expectedHeader = 'Frente;Verso;Tags;Fonte';
    if (!headerLine.includes(expectedHeader)) {
      errors.push(`Invalid header. Expected: ${expectedHeader}`);
    }

    // Check minimum content
    if (lineCount < 1) {
      errors.push('No data rows found');
    }

    // Basic validation
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const fieldCount = line.split(';').length;
      if (fieldCount !== 4) {
        errors.push(`Line ${i}: Expected 4 fields, found ${fieldCount}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      lineCount,
    };
  }
}
