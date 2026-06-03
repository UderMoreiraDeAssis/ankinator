export interface SectionInfo {
  id: string;
  title: string;
  level: number;
  pageStart: number;
  pageEnd: number;
  charCount: number;
}

export interface ExtractResult {
  docId: string;
  fileName: string;
  numPages: number;
  title: string | null;
  usedOcr: boolean;
  totalChars: number;
  sections: SectionInfo[];
  markdownPreview: string;
}

export interface QuestaoMetadata {
  banca?: string;
  ano?: number;
  alternativas?: string[];
  gabarito?: string;
}

export interface Questao {
  id: string;
  tipo: 'extraida' | 'criada';
  pergunta: string;
  resposta: string;
  pageStart?: number;
  pageEnd?: number;
  metadata?: QuestaoMetadata;
  // ── SPEC-05 (opcionais; ignorados quando ausentes; embed real nas fases 3-4) ──
  deck?: string;          // hierarquia Anki "Matéria::Assunto::Subtópico"
  tags?: string[];        // banca, ano, nível, tema
  mnemonico?: string;     // texto do mnemônico
  mnemonicoSvg?: string;  // SVG autocontido do mnemônico
}

export interface ChunkProgress {
  index: number;
  total: number;
  sectionTitles: string[];
  questoesNoBloco: number;
  erro?: string;
}

export interface GenerateOptions {
  maxPerChunk?: number;
  incluirExtraidas?: boolean;
  incluirCriadas?: boolean;
  tags?: string[];
  /** Rodar especialista classificador de deck+tags após a geração. Default: true. */
  classificar?: boolean;
  /** Rodar especialista card-builder após a classificação. Default: false. */
  cardBuilder?: boolean;
}

/** Espelho do EnrichProgress do server — consumido por App.tsx e ProgressPanel. */
export interface EnrichProgress {
  estagio: 'classificando' | 'reescrevendo';
  index: number;
  total: number;
  erro?: string;
}

export interface JobState {
  id: string;
  status: 'running' | 'done' | 'error';
  totalChunks: number;
  progress: ChunkProgress[];
  questoes: Questao[];
  erros: { chunkIndex: number; mensagem: string }[];
  error?: string;
}

export interface AnkiStatus {
  online: boolean;
  version?: number;
  error?: string;
}

export interface PushResult {
  deck: string;
  enviadas: number;
  ignoradas: number;
  total: number;
}
