/**
 * Types for question extraction and Anki formatting
 */

export interface QuestaoMetadata {
  banca?: string;
  ano?: number;
  alternativas?: string[];
  gabarito?: string;
}

export interface Questao {
  tipo: 'extraida' | 'criada';
  pergunta: string;
  resposta: string;
  metadata?: QuestaoMetadata;
}

export interface QuestaoChunk {
  chunk_index: number;
  page_start: number;
  page_end: number;
  questoes: Questao[];
}

export interface QuestaoSession {
  session_id: string;
  pdf_path: string;
  created_at: string;
  chunks: QuestaoChunk[];
}

export interface AnkiCard {
  frente: string;
  verso: string;
  tags: string;
  fonte: string;
}
