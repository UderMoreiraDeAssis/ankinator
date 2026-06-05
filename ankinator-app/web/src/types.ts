export interface SectionInfo {
  id: string;
  title: string;
  level: number;
  pageStart: number;
  pageEnd: number;
  charCount: number;
  /** Markdown completo do bloco — usado na prévia por-bloco da tela "Estrutura". */
  markdown: string;
  /** Aviso do revisor determinístico (bloco suspeito de fragmentação). Ausente = OK. */
  aviso?: string;
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
  mnemonicoTecnica?: string; // técnica do mnemônico (acrônimo|história|loci|rima) — gate da imagem seletiva
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
  /** Rodar especialista de mnemônicos após a geração. Phase 4: default true no App.tsx — D-12. */
  mnemonico?: boolean;
  /** Rodar especialista de imagem de mnemônico (SVG). Phase 4: default false no App.tsx — D-12. */
  imagem?: boolean;
}

/** Espelho do EnrichProgress do server — consumido por App.tsx e ProgressPanel. */
export interface EnrichProgress {
  estagio: 'classificando' | 'reescrevendo' | 'gerando-mnemonico' | 'gerando-imagem';
  index: number;
  total: number;
  erro?: string;
}

/** Deck base (opcional) para geração incremental: deck do Anki ao vivo OU arquivo enviado. */
export type DeckSourceInput = { ankiDeck: string } | { deckFileId: string; fileName: string };

/** Prévia do deck base — quantas questões já existem (+ amostra). */
export interface DeckPreview {
  count: number;
  sample: string[];
}

/** Resultado da geração incremental contra o deck base. Espelha o server. */
export interface IncrementalInfo {
  deckCompleto: boolean;
  novas: number;
  duplicadasRemovidas: number;
  existentes: number;
}

export interface JobState {
  id: string;
  status: 'running' | 'done' | 'error';
  totalChunks: number;
  progress: ChunkProgress[];
  questoes: Questao[];
  erros: { chunkIndex: number; mensagem: string }[];
  incremental?: IncrementalInfo;
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

// ── Reorganizador de decks (Parte B, Fatia 1) — espelha o server (deck-organizer.ts) ──

export interface OrganizeMergePlan {
  target: string;
  /** Origens (≠ target) e quantos cards DIRETOS seriam movidos de cada uma. */
  moves: { deck: string; cardCount: number }[];
  /** Origens que ficariam vazias e seriam apagadas. */
  decksToDelete: string[];
  /** Origens PRESERVADAS por terem subdecks com cards (não apagadas). */
  preservedWithSubdecks: string[];
  totalMoved: number;
}

export interface OrganizeDupGroup {
  keepNoteId: number;
  dupNoteIds: number[];
  sampleFront: string;
  size: number;
}

export interface OrganizeDedupPlan {
  groups: OrganizeDupGroup[];
  totalDuplicates: number;
  tag: string;
}

export interface OrganizePlan {
  decks: string[];
  merge?: OrganizeMergePlan;
  dedup?: OrganizeDedupPlan;
}

export interface OrganizeApplyResult {
  merge?: { movedCards: number; deletedDecks: string[]; erros: string[] };
  dedup?: { taggedNotes: number; tag: string; erros: string[] };
}
