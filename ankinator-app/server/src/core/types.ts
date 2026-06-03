/**
 * Tipos centrais do pipeline Ankinator.
 *
 * Fluxo: PDF --(DocumentLoader/OpenDataLoader)--> LoadedDocument
 *        --(Chunker)--> SemanticChunk[]
 *        --(QuestionGenerator/Claude)--> Questao[]
 *        --(Exporters)--> CSV / AnkiConnect
 */

/** Tipos de elemento normalizados a partir do JSON do OpenDataLoader. */
export type ElementType =
  | 'heading'
  | 'paragraph'
  | 'caption'
  | 'table'
  | 'image'
  | 'list'
  | 'text block'
  | string;

/** Um elemento de conteúdo do documento (árvore achatada em ordem de leitura). */
export interface DocElement {
  type: ElementType;
  id?: number;
  page: number;
  /** Nível do título (1 = mais alto) quando type === 'heading'. */
  headingLevel?: number;
  /** Texto do elemento (heading/paragraph/caption) ou tabela renderizada em markdown. */
  content?: string;
}

/**
 * Uma seção do documento: bloco de conteúdo iniciado por um título
 * (ou o documento inteiro, quando não há títulos).
 */
export interface Section {
  id: string;
  title: string;
  level: number;
  pageStart: number;
  pageEnd: number;
  /** Markdown da seção (inclui o título e o texto até o próximo título de mesmo nível ou superior). */
  markdown: string;
  charCount: number;
}

/** Documento carregado e estruturado pelo OpenDataLoader. */
export interface LoadedDocument {
  fileName: string;
  numPages: number;
  title: string | null;
  /** Markdown completo, em ordem de leitura, pronto para o LLM. */
  markdown: string;
  /** Seções derivadas dos títulos (para navegação na UI e chunking semântico). */
  sections: Section[];
  /** Elementos achatados (para inspeção/depuração). */
  elements: DocElement[];
  /** true quando o caminho de OCR (backend Python) foi usado. */
  usedOcr: boolean;
}

/** Bloco semântico que será enviado ao LLM para gerar questões. */
export interface SemanticChunk {
  index: number;
  /** Títulos das seções que compõem este bloco. */
  sectionTitles: string[];
  pageStart: number;
  pageEnd: number;
  markdown: string;
  charCount: number;
  estimatedTokens: number;
}

/** Metadados opcionais de uma questão extraída de prova. */
export interface QuestaoMetadata {
  banca?: string;
  ano?: number;
  alternativas?: string[];
  gabarito?: string;
}

/**
 * Uma questão de flashcard.
 * - 'extraida': já existia no material (prova/exercício) — fidelidade total.
 * - 'criada': gerada a partir dos conceitos do texto.
 */
export interface Questao {
  id: string;
  tipo: 'extraida' | 'criada';
  pergunta: string;
  resposta: string;
  /** Faixa de páginas de origem, para atribuição da fonte no card. */
  pageStart?: number;
  pageEnd?: number;
  metadata?: QuestaoMetadata;
  // ── SPEC-05 (opcionais; ignorados quando ausentes; embed real nas fases 3-4) ──
  deck?: string;          // hierarquia Anki "Matéria::Assunto::Subtópico"
  tags?: string[];        // banca, ano, nível, tema
  mnemonico?: string;     // texto do mnemônico
  mnemonicoSvg?: string;  // SVG autocontido do mnemônico
}

/** Opções de geração de questões. */
export interface GenerateOptions {
  /** Máximo de questões por bloco (aproximado). */
  maxPerChunk?: number;
  /** Gerar questões extraídas do material. */
  incluirExtraidas?: boolean;
  /** Gerar questões novas a partir dos conceitos. */
  incluirCriadas?: boolean;
  /** Tema/tags padrão (ex.: 'pmbok', 'concurso'). */
  tags?: string[];
  /** Modelo do Claude a usar. */
  model?: string;
}
