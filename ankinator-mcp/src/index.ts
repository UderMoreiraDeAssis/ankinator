import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { promises as fs } from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import { PDFParse } from 'pdf-parse';
import Anthropic from '@anthropic-ai/sdk';
import crypto from 'crypto';
import {
  parseChangelog,
  parseUpdateTxt,
  parseRoadmap,
  formatAsChronologicalBullets,
  mergeChangelogs,
  suggestReadmePlacement,
} from './helpers/changelog-parser.js';
import { ChangelogEntry } from './types/release-notes.js';
import { PdfManager } from './pdf-manager.js';
import { ChunkSessionManager } from './chunk-session-manager.js';
import { TokenEstimator } from './token-utils.js';
import { QuestionSessionManager } from './managers/question-session-manager.js';
import { AnkiCsvFormatter } from './utils/anki-csv-formatter.js';
import { Questao, QuestaoMetadata } from './types/questao-types.js';

const server = new McpServer({
  name: 'ankinator-mcp',
  version: '1.0.0',
});

// Initialize manager classes
const pdfManager = new PdfManager();
const chunkSessionManager = new ChunkSessionManager(path.resolve(__dirname, '..'));
const questionSessionManager = new QuestionSessionManager(path.resolve(__dirname, '..'));

const listarDocsInput = z.object({}).strict();
const listarDocsOutput = z
  .object({
    docs: z
      .array(
        z.object({
          path: z.string(),
          title: z.string().nullable(),
        }),
      )
      .min(1),
  })
  .strict();

const resumirArvoreInput = z
  .object({
    base: z
      .enum(['root', 'ankimon', 'server'])
      .default('root')
      .describe('root=repo principal, ankimon=add-on, server=ankinator-mcp'),
  })
  .strict();
type ResumirArvoreArgs = z.infer<typeof resumirArvoreInput>;

const resumirArvoreOutput = z
  .object({
    entries: z.array(z.string()),
  })
  .strict();

const extrairSecaoInput = z
  .object({
    path: z.string().describe('Caminho relativo ou absoluto do arquivo Markdown.'),
    titulo: z.string().describe('Título exato da seção a ser extraída (sem #).'),
    maxChars: z.number().int().positive().max(8000).default(2000).describe('Limite de caracteres da resposta.'),
  })
  .strict();
type ExtrairSecaoArgs = z.infer<typeof extrairSecaoInput>;

const extrairSecaoOutput = z
  .object({
    path: z.string(),
    titulo: z.string(),
    conteudo: z.string(),
  })
  .strict();

const DIST_DIR = path.resolve(__dirname);
const PROJECT_ROOT = path.resolve(DIST_DIR, '..', '..');
const SERVER_ROOT = path.resolve(DIST_DIR, '..');
const ALLOWED_ROOTS = [PROJECT_ROOT, path.join(PROJECT_ROOT, 'ankimon'), SERVER_ROOT];

type ResolvedPath = {
  resolved: string;
  base: string;
};

const truncateText = (text: string, limit = 2000): string => {
  if (text.length <= limit) return text;
  return `${text.slice(0, limit)}\n\n[truncado — output limitado a ${limit} caracteres]`;
};

const resolveWithinAllowed = (userPath: string): ResolvedPath => {
  const base = path.isAbsolute(userPath) ? '' : PROJECT_ROOT;
  const resolved = path.resolve(base || '/', userPath);
  const allowedBase = ALLOWED_ROOTS.find((root) => resolved === root || resolved.startsWith(`${root}${path.sep}`));

  if (!allowedBase) {
    const allowedList = ALLOWED_ROOTS.map((root) => path.relative(PROJECT_ROOT, root) || '.').join(', ');
    throw new Error(`Path fora da zona permitida. Use caminhos sob: ${allowedList}`);
  }

  return { resolved, base: allowedBase };
};

const readFileSafe = async (userPath: string): Promise<{ path: string; content: string }> => {
  const { resolved } = resolveWithinAllowed(userPath);
  const content = await fs.readFile(resolved, 'utf8');
  return { path: resolved, content };
};

const findTitle = (content: string): string | undefined => {
  const heading = content
    .split(/\r?\n/)
    .find((line) => /^#{1,6}\s+/.test(line.trim()));
  return heading?.replace(/^#{1,6}\s+/, '').trim();
};

const extractSection = (content: string, headingQuery: string): string | null => {
  const lines = content.split(/\r?\n/);
  let startIndex = -1;
  let startLevel = 0;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    const match = /^(#{1,6})\s+(.*)$/.exec(line);
    if (!match) continue;
    const level = match[1].length;
    const title = match[2].trim();
    if (title.toLowerCase() === headingQuery.toLowerCase()) {
      startIndex = i + 1;
      startLevel = level;
      break;
    }
  }

  if (startIndex === -1) return null;

  const collected: string[] = [];
  for (let j = startIndex; j < lines.length; j += 1) {
    const line = lines[j];
    const headingMatch = /^(#{1,6})\s+/.exec(line.trim());
    if (headingMatch && headingMatch[1].length <= startLevel) break;
    collected.push(line);
  }

  return collected.join('\n').trim();
};

// CSV Validation Schemas (Phase 2)
const csvRowSchema = z.object({
  pergunta: z.string().min(1, 'Pergunta não pode ser vazia'),
  resposta: z.string().min(1, 'Resposta não pode ser vazia'),
  opcoes: z.string().optional(),
  dificuldade: z.enum(['facil', 'medio', 'dificil', 'muito_dificil']).optional(),
  categoria: z.string().optional(),
});

const validarCsvInput = z.object({
  path: z.string().describe('Caminho do arquivo CSV a validar'),
  maxRows: z.number().int().positive().max(1000).default(200).describe('Limite de linhas a processar'),
}).strict();
type ValidarCsvArgs = z.infer<typeof validarCsvInput>;

const validarCsvOutput = z.object({
  totalLinhas: z.number(),
  validas: z.number(),
  invalidas: z.number(),
  erros: z.array(z.object({
    linha: z.number(),
    mensagem: z.string(),
  })),
}).strict();

const sampleRowsInput = z.object({
  path: z.string().describe('Caminho do arquivo CSV'),
  n: z.number().int().positive().max(50).default(5).describe('Número de linhas a exibir'),
}).strict();
type SampleRowsArgs = z.infer<typeof sampleRowsInput>;

const sampleRowsOutput = z.object({
  linhas: z.array(z.record(z.string(), z.any())),
  total: z.number(),
}).strict();

const contarCamposInput = z.object({
  path: z.string().describe('Caminho do arquivo CSV'),
}).strict();
type ContarCamposArgs = z.infer<typeof contarCamposInput>;

const contarCamposOutput = z.object({
  totalLinhas: z.number(),
  totalColunas: z.number(),
  colunas: z.array(z.string()),
  camposVazios: z.record(z.string(), z.number()),
}).strict();

// PDF Extraction Schemas (Phase 6)
const EXTRACTION_PROMPT = `Quando receber um PDF de aula, sua única tarefa é extrair questões e respostas fidedignas para uso no Anki.

Regras estritas:

1. Não interprete, não expanda, não exemplifique além do texto.
2. Não gere conteúdo baseado em conhecimento externo.
3. Se o trecho for vago ou incompleto, não complete — sinalize a lacuna.
4. Toda informação nas respostas deve ser diretamente verificável no PDF.
5. Formato de saída: lista com Q: e A:, uma por linha.

Risco crítico: Qualquer distorção levará o usuário a memorizar conteúdo incorreto.

Identidade do usuário: default_user
Objetivo declarado: Estudar com flashcards 100% alinhados ao material original.`;

const extrairQuestoesInput = z.object({
  path: z.string().describe('Caminho do arquivo PDF'),
  maxQuestions: z.number().int().positive().max(100).default(20).describe('Número máximo de questões a gerar'),
}).strict();
type ExtrairQuestoesArgs = z.infer<typeof extrairQuestoesInput>;

const extrairQuestoesOutput = z.object({
  questoes: z.string(),
  total: z.number(),
}).strict();

const previewQuestoesInput = z.object({
  path: z.string().describe('Caminho do arquivo PDF'),
  n: z.number().int().positive().max(10).default(5).describe('Número de questões de preview'),
}).strict();
type PreviewQuestoesArgs = z.infer<typeof previewQuestoesInput>;

const previewQuestoesOutput = z.object({
  preview: z.string(),
  total: z.number(),
}).strict();

const converterParaCsvInput = z.object({
  questoes: z.string().describe('String com questões no formato Q:/A:'),
  categoria: z.string().optional().describe('Categoria/tag padrão para todas as questões'),
}).strict();
type ConverterParaCsvArgs = z.infer<typeof converterParaCsvInput>;

const converterParaCsvOutput = z.object({
  csv: z.string(),
  linhas: z.number(),
}).strict();

// Phase 6 - Extract PDF Text (without API key)
const extrairTextoPdfInput = z.object({
  path: z.string().describe('Caminho do arquivo PDF'),
  maxChars: z.number().int().positive().max(100000).default(50000).describe('Limite de caracteres do texto'),
  incluir_prompt: z.boolean().default(true).describe('Incluir prompt de extração rigorosa'),
}).strict();
type ExtrairTextoPdfArgs = z.infer<typeof extrairTextoPdfInput>;

const extrairTextoPdfOutput = z.object({
  texto: z.string(),
  num_chars: z.number(),
  num_pages: z.number(),
  prompt_extracao: z.string().optional(),
  truncado: z.boolean(),
}).strict();

// Phase 6.5 - Chunked PDF Extraction (for long PDFs) - SEM API KEY
const extrairPdfChunksInput = z.object({
  path: z.string().describe('Caminho do arquivo PDF'),
  chunk_size: z.number().int().positive().max(20).default(5).describe('Número de páginas por chunk (default: auto)'),
  overlap: z.number().int().min(0).max(10).default(2).describe('Overlap entre chunks em páginas'),
  incluir_prompt: z.boolean().default(true).describe('Incluir prompt de extração de questões'),
}).strict();
type ExtrairPdfChunksArgs = z.infer<typeof extrairPdfChunksInput>;

const extrairPdfChunksOutput = z.object({
  chunks: z.array(z.object({
    chunk_index: z.number(),
    page_start: z.number(),
    page_end: z.number(),
    texto: z.string(),
    num_chars: z.number(),
  })),
  total_chunks: z.number(),
  total_pages: z.number(),
  total_chars: z.number(),
  chunk_size_usado: z.number(),
  overlap_usado: z.number(),
  prompt_sugerido: z.string().optional(),
}).strict();

// NEW: Session-based PDF extraction (token-safe)
const iniciarExtracaoPdfInput = z.object({
  path: z.string().describe('Caminho do arquivo PDF'),
  chunk_size: z.number().int().positive().max(20).default(5).describe('Número de páginas por chunk'),
  overlap: z.number().int().min(0).max(10).default(2).describe('Overlap entre chunks em páginas'),
}).strict();

const iniciarExtracaoPdfOutput = z.object({
  session_id: z.string().describe('ID da sessão para buscar chunks'),
  total_chunks: z.number(),
  total_pages: z.number(),
  chunk_metadata: z.array(z.object({
    chunk_index: z.number(),
    page_range: z.string(),
    char_count: z.number(),
    preview: z.string(),
  })),
  prompt_template: z.string().describe('Template de prompt para processar chunks'),
  estimated_total_tokens: z.number(),
}).strict();

const obterChunksPdfInput = z.object({
  session_id: z.string().describe('ID da sessão retornado por iniciar_extracao_pdf'),
  chunk_indices: z.array(z.number().int().min(0)).optional().describe('Índices específicos dos chunks (opcional)'),
  start_index: z.number().int().min(0).optional().describe('Índice inicial para busca em batch'),
  auto_batch: z.boolean().default(true).describe('Ajustar automaticamente quantidade de chunks pelo limite de tokens'),
}).strict();

const obterChunksPdfOutput = z.object({
  session_id: z.string(),
  chunks: z.array(z.object({
    chunk_index: z.number(),
    page_start: z.number(),
    page_end: z.number(),
    texto: z.string(),
    num_chars: z.number(),
  })),
  batch_info: z.object({
    returned_count: z.number(),
    has_more: z.boolean(),
    next_index: z.number().optional(),
    estimated_tokens_used: z.number(),
  }),
}).strict();

// Phase 7 - Question Management and Anki Export
const questaoMetadataSchema = z.object({
  banca: z.string().optional(),
  ano: z.number().optional(),
  alternativas: z.array(z.string()).optional(),
  gabarito: z.string().optional(),
}).strict();

const questaoSchema = z.object({
  tipo: z.enum(['extraida', 'criada']),
  pergunta: z.string().min(1),
  resposta: z.string().min(1),
  metadata: questaoMetadataSchema.optional(),
}).strict();

const salvarQuestoesChunkInput = z.object({
  session_id: z.string().describe('ID da sessão retornado por iniciar_extracao_pdf'),
  chunk_index: z.number().int().min(0).describe('Índice do chunk processado'),
  page_start: z.number().int().min(1).describe('Primeira página do chunk'),
  page_end: z.number().int().min(1).describe('Última página do chunk'),
  questoes: z.array(questaoSchema).describe('Array de questões extraídas/criadas'),
}).strict();

const salvarQuestoesChunkOutput = z.object({
  session_id: z.string(),
  chunk_index: z.number(),
  questoes_salvas: z.number(),
  total_questoes_sessao: z.number(),
}).strict();

const obterQuestoesSessaoInput = z.object({
  session_id: z.string().describe('ID da sessão com questões salvas'),
  formato: z.enum(['json', 'csv']).default('json').describe('Formato de saída: json (estruturado) ou csv (Anki)'),
  incluir_estatisticas: z.boolean().default(true).describe('Incluir estatísticas sobre as questões'),
}).strict();

const obterQuestoesSessaoOutput = z.object({
  session_id: z.string(),
  formato: z.string(),
  questoes: z.union([
    z.array(z.object({
      chunk_index: z.number(),
      page_start: z.number(),
      page_end: z.number(),
      questoes: z.array(questaoSchema),
    })),
    z.string(), // CSV content
  ]),
  estatisticas: z.object({
    total_chunks: z.number(),
    total_questoes: z.number(),
    questoes_extraidas: z.number(),
    questoes_criadas: z.number(),
  }).optional(),
}).strict();

const validarCsvAnkiInput = z.object({
  csv_content: z.string().describe('Conteúdo CSV a validar (formato Anki)'),
}).strict();

const validarCsvAnkiOutput = z.object({
  valido: z.boolean(),
  erros: z.array(z.string()),
  total_linhas: z.number(),
  avisos: z.array(z.string()).optional(),
}).strict();

// Phase 6.6 - Iterative Question Extraction (loop-based)
const extrairQuestoesIterativoInput = z.object({
  path: z.string().describe('Caminho do arquivo PDF'),
  chunk_size: z.number().int().positive().max(20).default(5).describe('Número de páginas por chunk'),
  overlap: z.number().int().min(0).max(10).default(2).describe('Overlap entre chunks'),
  start_chunk: z.number().int().min(0).default(0).describe('Índice do chunk inicial (para retomar processamento)'),
  max_chunks: z.number().int().positive().max(100).default(90).describe('Máximo de chunks a processar (limite de iterações)'),
  chunk_batch_size: z.number().int().positive().max(10).default(1).describe('Quantos chunks retornar por iteração'),
}).strict();
type ExtrairQuestoesIterativoArgs = z.infer<typeof extrairQuestoesIterativoInput>;

const extrairQuestoesIterativoOutput = z.object({
  iteration: z.number().describe('Número da iteração atual'),
  chunks_batch: z.array(z.object({
    chunk_index: z.number(),
    page_start: z.number(),
    page_end: z.number(),
    texto: z.string(),
    num_chars: z.number(),
    prompt_contexto: z.string(),
  })),
  progress: z.object({
    chunk_atual: z.number(),
    total_chunks: z.number(),
    percentual: z.number(),
    chunks_restantes: z.number(),
  }),
  metadata: z.object({
    total_pages: z.number(),
    total_chars: z.number(),
    chunk_size_usado: z.number(),
    overlap_usado: z.number(),
  }),
  has_more: z.boolean().describe('Se há mais chunks para processar'),
  next_start_chunk: z.number().optional().describe('Índice do próximo chunk a processar'),
}).strict();

// Phase 3 - Anki References Schemas
const versoesSuportadasInput = z.object({
  incluir_breaking_changes: z.boolean().default(true).describe('Incluir breaking changes nas versões'),
}).strict();
type VersoesSuportadasArgs = z.infer<typeof versoesSuportadasInput>;

const versoesSuportadasOutput = z.object({
  versao_minima: z.string(),
  versao_maxima_testada: z.string(),
  versoes_detalhadas: z.array(z.object({
    versao: z.string(),
    data_lancamento: z.string(),
    tipo: z.string(),
    compatibilidade: z.record(z.string(), z.any()),
    breaking_changes: z.array(z.string()).optional(),
  })),
}).strict();

const instalacaoAddonInput = z.object({
  tipo: z.enum(['geral', 'manual', 'ankimon']).default('geral').describe('Tipo de instalação: geral (AnkiWeb), manual (desenvolvimento), ankimon (caso específico)'),
  incluir_troubleshooting: z.boolean().default(true).describe('Incluir seção de troubleshooting'),
}).strict();
type InstalacaoAddonArgs = z.infer<typeof instalacaoAddonInput>;

const instalacaoAddonOutput = z.object({
  titulo: z.string(),
  passos: z.array(z.object({
    numero: z.number(),
    acao: z.string(),
    detalhes: z.union([z.string(), z.record(z.string(), z.string())]),
  })),
  codigo_ankiweb: z.string().optional(),
  requisitos: z.array(z.string()).optional(),
  troubleshooting: z.record(z.string(), z.object({
    sintoma: z.string(),
    solucao: z.string(),
  })).optional(),
}).strict();

const ankiHooksInput = z.object({
  categoria: z.enum(['reviewer', 'webview', 'config', 'sync', 'media', 'todos']).default('todos').describe('Filtrar hooks por categoria'),
  apenas_usados_ankimon: z.boolean().default(false).describe('Mostrar apenas hooks usados no Ankimon'),
  incluir_exemplos: z.boolean().default(true).describe('Incluir exemplos de código'),
  versao_anki: z.string().optional().describe('Filtrar por versão do Anki (ex: 2.1.66)'),
}).strict();
type AnkiHooksArgs = z.infer<typeof ankiHooksInput>;

const ankiHooksOutput = z.object({
  total_hooks: z.number(),
  categorias: z.record(z.string(), z.string()),
  hooks: z.array(z.object({
    nome: z.string(),
    categoria: z.string(),
    descricao: z.string(),
    parametros: z.array(z.object({
      nome: z.string(),
      tipo: z.string(),
      descricao: z.string(),
    })),
    uso_comum: z.array(z.string()),
    exemplo: z.string().optional(),
    usado_em_ankimon: z.boolean(),
  })),
}).strict();

// Phase 4 - Release Notes Schemas
const ultimasMudancasInput = z.object({
  fonte: z.enum(['ankinator-mcp', 'ankimon', 'ambos'])
    .default('ankinator-mcp')
    .describe('Qual changelog ler: ankinator-mcp, ankimon ou ambos'),
  limite_versoes: z.number()
    .int()
    .positive()
    .max(10)
    .default(3)
    .describe('Quantas versões mostrar (padrão: 3, máx: 10)'),
  incluir_unreleased: z.boolean()
    .default(false)
    .describe('Incluir mudanças não lançadas (seção [Unreleased])'),
  formato: z.enum(['markdown', 'bullets'])
    .default('bullets')
    .describe('Formato de saída: markdown completo ou bullets cronológicos'),
}).strict();
type UltimasMudancasArgs = z.infer<typeof ultimasMudancasInput>;

const ultimasMudancasOutput = z.object({
  fonte: z.string(),
  versoes: z.array(z.object({
    versao: z.string(),
    data: z.string(),
    tipo: z.string().optional(),
    categorias: z.record(z.string(), z.array(z.string())),
  })),
  total_versoes: z.number(),
  sugestao_readme: z.string(),
}).strict();

const roadmapInput = z.object({
  incluir_completas: z.boolean()
    .default(false)
    .describe('Incluir fases já completas no output'),
  apenas_proximas: z.boolean()
    .default(true)
    .describe('Mostrar apenas próximas ações (não todo o roadmap)'),
  formato: z.enum(['markdown', 'bullets'])
    .default('bullets')
    .describe('Formato de saída: markdown completo ou bullets de ação'),
}).strict();
type RoadmapArgs = z.infer<typeof roadmapInput>;

const roadmapOutput = z.object({
  status_geral: z.object({
    fases_completas: z.number(),
    fases_totais: z.number(),
    progresso_percentual: z.number(),
  }),
  proximas_acoes: z.array(z.string()),
  fases_pendentes: z.array(z.object({
    fase: z.string(),
    nome: z.string(),
    ferramentas: z.array(z.string()),
    criterios: z.string(),
  })),
  riscos_conhecidos: z.array(z.string()),
  sugestao_readme: z.string(),
}).strict();

// Initialize Anthropic client (optional, only if API key is set)
let anthropicClient: Anthropic | null = null;
try {
  if (process.env.ANTHROPIC_API_KEY) {
    anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
} catch (error) {
  // API key not set, will error when tools are called
}

// PDF helper functions moved to PdfManager class

// Gera hash para deduplicação
const hashQuestion = (pergunta: string, resposta: string): string => {
  const normalized = `${pergunta.toLowerCase().trim()}|||${resposta.toLowerCase().trim()}`;
  return crypto.createHash('md5').update(normalized).digest('hex');
};

// Valida se questão tem estrutura mínima
const isValidQuestion = (q: { pergunta: string; resposta: string }): boolean => {
  return !!(
    q.pergunta &&
    q.resposta &&
    q.pergunta.trim().length >= 10 &&
    q.resposta.trim().length >= 3
  );
};

const parseQuestionsFromText = (text: string): Array<{ pergunta: string; resposta: string }> => {
  const lines = text.split('\n');
  const questions: Array<{ pergunta: string; resposta: string }> = [];
  let currentQ: string | null = null;
  let currentA: string | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('Q:')) {
      // Se já temos uma questão completa, salva antes de começar nova
      if (currentQ && currentA) {
        questions.push({ pergunta: currentQ, resposta: currentA });
      }
      currentQ = trimmed.substring(2).trim();
      currentA = null;
    } else if (trimmed.startsWith('A:')) {
      currentA = trimmed.substring(2).trim();
    } else if (trimmed && currentA) {
      // Continua resposta em múltiplas linhas
      currentA += ' ' + trimmed;
    } else if (trimmed && currentQ && !currentA) {
      // Continua pergunta em múltiplas linhas
      currentQ += ' ' + trimmed;
    }
  }

  // Adiciona última questão se existir
  if (currentQ && currentA) {
    questions.push({ pergunta: currentQ, resposta: currentA });
  }

  return questions;
};

// Phase 3 - Anki References Helper Functions

/**
 * Lê arquivo JSON de dados estáticos
 */
const readJsonData = async (filename: string): Promise<any> => {
  const dataPath = path.join(__dirname, 'data', filename);
  const content = await fs.readFile(dataPath, 'utf8');
  return JSON.parse(content);
};

/**
 * Formata versões do Anki como Markdown
 */
const formatVersoesAsMarkdown = (data: any): string => {
  let md = `## Versões do Anki Suportadas\n\n`;
  md += `**Versão mínima recomendada:** ${data.versao_minima}\n`;
  md += `**Versão máxima testada:** ${data.versao_maxima_testada}\n\n`;
  md += `### Versões Detalhadas\n\n`;

  for (const v of data.versoes_detalhadas) {
    md += `#### ${v.versao} (${v.tipo}) - ${v.data_lancamento}\n`;
    md += `**Compatibilidade:**\n`;
    for (const [key, value] of Object.entries(v.compatibilidade)) {
      md += `- ${key}: ${value}\n`;
    }

    if (v.breaking_changes && v.breaking_changes.length > 0) {
      md += `\n**Breaking Changes:**\n`;
      for (const bc of v.breaking_changes) {
        md += `- ${bc}\n`;
      }
    }

    md += `\n---\n\n`;
  }

  return md;
};

/**
 * Formata guia de instalação como Markdown
 */
const formatInstalacaoAsMarkdown = (data: any, tipo: string): string => {
  let md = `## ${data.titulo}\n\n`;

  // Código AnkiWeb (se tipo ankimon)
  if (data.codigo_ankiweb) {
    md += `**Código AnkiWeb:** ${data.codigo_ankiweb}\n\n`;
  }

  // Requisitos
  if (data.requisitos) {
    md += `### Requisitos\n`;
    for (const req of data.requisitos) {
      md += `- ${req}\n`;
    }
    md += `\n`;
  }

  // Passos
  md += `### Passos de Instalação\n\n`;
  for (const passo of data.passos) {
    md += `${passo.numero}. **${passo.acao}**\n`;

    if (typeof passo.detalhes === 'string') {
      md += `   - ${passo.detalhes}\n\n`;
    } else {
      // detalhes_por_os
      md += `   **Por sistema operacional:**\n`;
      for (const [os, detail] of Object.entries(passo.detalhes)) {
        md += `   - **${os}:** ${detail}\n`;
      }
      md += `\n`;
    }
  }

  // Troubleshooting
  if (data.troubleshooting) {
    md += `### Troubleshooting\n\n`;
    for (const [key, issue] of Object.entries(data.troubleshooting)) {
      const { sintoma, solucao } = issue as any;
      md += `**${key.replace(/_/g, ' ')}:**\n`;
      md += `- **Sintoma:** ${sintoma}\n`;
      md += `- **Solução:** ${solucao}\n\n`;
    }
  }

  return md;
};

/**
 * Formata hooks como Markdown
 */
const formatHooksAsMarkdown = (data: any, incluir_exemplos: boolean): string => {
  let md = `## Hooks do Anki Disponíveis\n\n`;
  md += `**Total de hooks:** ${data.total_hooks}\n`;
  md += `**Categorias:**\n`;
  for (const [cat, desc] of Object.entries(data.categorias)) {
    md += `- **${cat}:** ${desc}\n`;
  }
  md += `\n---\n\n`;

  for (const hook of data.hooks) {
    md += `### ${hook.nome}\n`;
    md += `**Categoria:** ${hook.categoria}\n`;
    md += `**Usado no Ankimon:** ${hook.usado_em_ankimon ? '✅ Sim' : '❌ Não'}\n\n`;
    md += `**Descrição:**\n${hook.descricao}\n\n`;

    if (hook.parametros && hook.parametros.length > 0) {
      md += `**Parâmetros:**\n`;
      for (const param of hook.parametros) {
        md += `- \`${param.nome}\` (${param.tipo}): ${param.descricao}\n`;
      }
      md += `\n`;
    }

    md += `**Uso Comum:**\n`;
    for (const uso of hook.uso_comum) {
      md += `- ${uso}\n`;
    }
    md += `\n`;

    if (incluir_exemplos && hook.exemplo) {
      md += `**Exemplo:**\n\`\`\`python\n${hook.exemplo}\n\`\`\`\n\n`;
    }

    md += `---\n\n`;
  }

  return md;
};

/**
 * Verifica se hook estava disponível em uma versão específica
 */
const isHookAvailableInVersion = (hook: any, versao: string): boolean => {
  const versaoNum = parseFloat(versao.replace(/[^\d.]/g, ''));
  const addedNum = parseFloat(hook.versoes.adicionado_em.replace(/[^\d.]/g, ''));

  if (versaoNum < addedNum) return false;

  if (hook.versoes.descontinuado_em) {
    const descontinuadoNum = parseFloat(hook.versoes.descontinuado_em.replace(/[^\d.]/g, ''));
    if (versaoNum >= descontinuadoNum) return false;
  }

  return true;
};

const listDefaultDocs = async () => {
  const candidates = [
    'README.md',
    path.join('ankimon', 'README.md'),
    path.join('ankimon', 'HowToStart.md'),
    path.join('ankimon', 'CONFIG.md'),
    path.join('ankimon', 'update_txt.md'),
  ];

  const found: Array<{ path: string; title: string | undefined }> = [];

  for (const rel of candidates) {
    try {
      const { content } = await readFileSafe(rel);
      found.push({ path: rel, title: findTitle(content) });
    } catch (error) {
      // ignore missing/forbidden files
    }
  }

  if (found.length === 0) {
    throw new Error('Nenhum doc padrão encontrado. Confira os caminhos ou adicione novos arquivos.');
  }

  return found;
};

server.registerTool(
  'listar_docs',
  {
    title: 'Listar documentos do projeto',
    description: 'Lista docs principais (README, HowToStart, CONFIG) com título detectado para facilitar referências no README.',
    inputSchema: listarDocsInput,
    outputSchema: listarDocsOutput,
  } as any,
  async (_args?: unknown) => {
    const docs = await listDefaultDocs();
    const output = {
      docs: docs.map((doc) => ({ path: doc.path, title: doc.title ?? null })),
    };

    return {
      content: [
        {
          type: 'text' as const,
          text: truncateText(
            output.docs
              .map((doc) => `- ${doc.path}${doc.title ? ` — ${doc.title}` : ''}`)
              .join('\n'),
          ),
        },
      ],
      structuredContent: output,
    };
  },
);

server.registerTool(
  'resumir_arvore',
  {
    title: 'Resumo da árvore de docs',
    description: 'Lista pastas e arquivos de documentação relevantes em um nível, ajudando a localizar seções.',
    inputSchema: resumirArvoreInput,
    outputSchema: resumirArvoreOutput,
  } as any,
  async (args: any) => {
    const base = args?.base ?? 'root';
    const basePath = base === 'ankimon' ? path.join(PROJECT_ROOT, 'ankimon') : base === 'server' ? SERVER_ROOT : PROJECT_ROOT;
    resolveWithinAllowed(basePath); // validation only
    const names = await fs.readdir(basePath, { withFileTypes: true });
    const filtered = names
      .filter((dirent) => dirent.isDirectory() || dirent.name.endsWith('.md') || dirent.name.endsWith('.txt'))
      .map((dirent) => `${dirent.isDirectory() ? '📁' : '📄'} ${dirent.name}`);

    const output = { entries: filtered };
    return {
      content: [
        {
          type: 'text' as const,
          text: truncateText(filtered.join('\n')),
        },
      ],
      structuredContent: output,
    };
  },
);

server.registerTool(
  'extrair_secao',
  {
    title: 'Extrair seção de Markdown',
    description: 'Retorna o conteúdo de uma seção específica (por título exato) de um arquivo Markdown local.',
    inputSchema: extrairSecaoInput,
    outputSchema: extrairSecaoOutput,
  } as any,
  async (args: any) => {
    if (!args) {
      throw new Error('Parâmetros obrigatórios ausentes. Informe path, titulo e maxChars (opcional).');
    }
    const { path: userPath, titulo, maxChars = 2000 } = args;
    const { resolved } = resolveWithinAllowed(userPath);
    const { content } = await readFileSafe(resolved);
    const section = extractSection(content, titulo);

    if (!section) {
      throw new Error(`Seção "${titulo}" não encontrada em ${userPath}. Verifique a grafia e tente novamente.`);
    }

    const output = { path: userPath, titulo, conteudo: truncateText(section, maxChars) };
    return {
      content: [
        {
          type: 'text' as const,
          text: output.conteudo,
        },
      ],
      structuredContent: output,
    };
  },
);

// Phase 2 - CSV Validation Tools
server.registerTool(
  'validar_csv',
  {
    title: 'Validar arquivo CSV',
    description: 'Valida formato de perguntas em CSV usando schema Zod. Reporta linhas com erros, campos faltantes e estatísticas.',
    inputSchema: validarCsvInput,
    outputSchema: validarCsvOutput,
  } as any,
  async (args: any) => {
    const { path: userPath, maxRows = 200 } = args;
    const { resolved } = resolveWithinAllowed(userPath);
    const content = await fs.readFile(resolved, 'utf8');

    const records = parse(content, {
      columns: true,
      skip_empty_lines: true,
      relax_column_count: true,
    });

    const linhasProcessar = records.slice(0, maxRows);
    const erros: Array<{ linha: number; mensagem: string }> = [];
    let validas = 0;

    linhasProcessar.forEach((row: any, index: number) => {
      const result = csvRowSchema.safeParse(row);
      if (!result.success) {
        const mensagens = result.error.issues.map((err: any) => `${err.path.join('.')}: ${err.message}`).join('; ');
        erros.push({ linha: index + 2, mensagem: mensagens });
      } else {
        validas += 1;
      }
    });

    const output = {
      totalLinhas: linhasProcessar.length,
      validas,
      invalidas: erros.length,
      erros: erros.slice(0, 50),
    };

    const resumo = `Total: ${output.totalLinhas} linhas | Válidas: ${output.validas} | Inválidas: ${output.invalidas}`;
    const detalhes = erros.length > 0
      ? '\n\nErros encontrados:\n' + erros.slice(0, 20).map(e => `Linha ${e.linha}: ${e.mensagem}`).join('\n')
      : '\n\nTodas as linhas estão válidas!';

    return {
      content: [
        {
          type: 'text' as const,
          text: truncateText(resumo + detalhes, 2000),
        },
      ],
      structuredContent: output,
    };
  },
);

server.registerTool(
  'sample_rows',
  {
    title: 'Visualizar primeiras linhas do CSV',
    description: 'Retorna as primeiras N linhas do CSV em formato legível para preview rápido.',
    inputSchema: sampleRowsInput,
    outputSchema: sampleRowsOutput,
  } as any,
  async (args: any) => {
    const { path: userPath, n = 5 } = args;
    const { resolved } = resolveWithinAllowed(userPath);
    const content = await fs.readFile(resolved, 'utf8');

    const records = parse(content, {
      columns: true,
      skip_empty_lines: true,
      relax_column_count: true,
    });

    const amostra = records.slice(0, n);
    const output = {
      linhas: amostra,
      total: records.length,
    };

    const texto = `Mostrando ${amostra.length} de ${records.length} linhas:\n\n` +
      amostra.map((row: any, i: number) => {
        const campos = Object.entries(row)
          .map(([k, v]) => `  ${k}: ${v}`)
          .join('\n');
        return `Linha ${i + 1}:\n${campos}`;
      }).join('\n\n');

    return {
      content: [
        {
          type: 'text' as const,
          text: truncateText(texto, 2000),
        },
      ],
      structuredContent: output,
    };
  },
);

server.registerTool(
  'contar_campos',
  {
    title: 'Análise de campos do CSV',
    description: 'Conta colunas, identifica campos vazios e fornece estatísticas sobre a estrutura do CSV.',
    inputSchema: contarCamposInput,
    outputSchema: contarCamposOutput,
  } as any,
  async (args: any) => {
    const { path: userPath } = args;
    const { resolved } = resolveWithinAllowed(userPath);
    const content = await fs.readFile(resolved, 'utf8');

    const records = parse(content, {
      columns: true,
      skip_empty_lines: true,
      relax_column_count: true,
    });

    if (records.length === 0) {
      throw new Error('CSV vazio ou sem dados válidos');
    }

    const colunas = Object.keys(records[0] as Record<string, any>);
    const camposVazios: Record<string, number> = {};

    colunas.forEach(col => {
      camposVazios[col] = records.filter((row: any) => !row[col] || row[col].trim() === '').length;
    });

    const output = {
      totalLinhas: records.length,
      totalColunas: colunas.length,
      colunas,
      camposVazios,
    };

    const texto = `Análise do CSV:\n` +
      `- Total de linhas: ${output.totalLinhas}\n` +
      `- Total de colunas: ${output.totalColunas}\n` +
      `- Colunas: ${colunas.join(', ')}\n\n` +
      `Campos vazios por coluna:\n` +
      Object.entries(camposVazios)
        .map(([col, count]) => `  ${col}: ${count} vazios`)
        .join('\n');

    return {
      content: [
        {
          type: 'text' as const,
          text: truncateText(texto, 2000),
        },
      ],
      structuredContent: output,
    };
  },
);

// Phase 6 - PDF to Questions Tools
server.registerTool(
  'extrair_questoes',
  {
    title: 'Extrair questões de PDF',
    description: 'Extrai questões fidedignas de PDF usando prompt rigoroso. Retorna formato Q:/A: pronto para conversão.',
    inputSchema: extrairQuestoesInput,
    outputSchema: extrairQuestoesOutput,
  } as any,
  async (args: any) => {
    if (!anthropicClient) {
      throw new Error(
        'ANTHROPIC_API_KEY não configurada. Configure a variável de ambiente antes de usar esta ferramenta.\n\n' +
        'Exemplo: export ANTHROPIC_API_KEY="sua-api-key-aqui"'
      );
    }

    const { path: userPath, maxQuestions = 20 } = args;
    const { resolved } = resolveWithinAllowed(userPath);
    const pdfText = await pdfManager.extractText(resolved);

    // Limita texto para evitar excesso de tokens
    const maxChars = 50000;
    const textToProcess = pdfText.length > maxChars
      ? pdfText.substring(0, maxChars) + '\n\n[PDF truncado para processamento]'
      : pdfText;

    const response = await anthropicClient.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 4096,
      system: EXTRACTION_PROMPT,
      messages: [{
        role: 'user',
        content: `Extraia até ${maxQuestions} questões e respostas do seguinte texto de PDF:\n\n${textToProcess}`
      }]
    });

    const questoesText = response.content[0].type === 'text' ? response.content[0].text : '';
    const parsedQuestions = parseQuestionsFromText(questoesText);

    const output = {
      questoes: questoesText,
      total: parsedQuestions.length,
    };

    const aviso = parsedQuestions.length === 0
      ? '\n\n[AVISO: Nenhuma questão extraída. Verifique o conteúdo do PDF.]'
      : `\n\n[INFO: ${parsedQuestions.length} questões geradas. Revisão manual recomendada antes da importação.]`;

    return {
      content: [
        {
          type: 'text' as const,
          text: truncateText(`Questões extraídas (${parsedQuestions.length}):\n\n${questoesText}${aviso}`, 8000),
        },
      ],
      structuredContent: output,
    };
  },
);

server.registerTool(
  'preview_questoes',
  {
    title: 'Preview de questões do PDF',
    description: 'Gera preview das primeiras N questões antes de processar PDF completo.',
    inputSchema: previewQuestoesInput,
    outputSchema: previewQuestoesOutput,
  } as any,
  async (args: any) => {
    if (!anthropicClient) {
      throw new Error(
        'ANTHROPIC_API_KEY não configurada. Configure a variável de ambiente antes de usar esta ferramenta.\n\n' +
        'Exemplo: export ANTHROPIC_API_KEY="sua-api-key-aqui"'
      );
    }

    const { path: userPath, n = 5 } = args;
    const { resolved } = resolveWithinAllowed(userPath);
    const pdfText = await pdfManager.extractText(resolved);

    // Para preview, usa menos texto (primeiras ~10k caracteres)
    const previewText = pdfText.substring(0, 10000);

    const response = await anthropicClient.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 2048,
      system: EXTRACTION_PROMPT,
      messages: [{
        role: 'user',
        content: `Extraia até ${n} questões e respostas do seguinte trecho de PDF (preview):\n\n${previewText}`
      }]
    });

    const previewQuestoes = response.content[0].type === 'text' ? response.content[0].text : '';
    const parsedQuestions = parseQuestionsFromText(previewQuestoes);

    const output = {
      preview: previewQuestoes,
      total: parsedQuestions.length,
    };

    return {
      content: [
        {
          type: 'text' as const,
          text: truncateText(
            `Preview (primeiras ${parsedQuestions.length} questões do PDF):\n\n${previewQuestoes}\n\n` +
            `[Preview OK. Use 'extrair_questoes' para processar o PDF completo.]`,
            2000
          ),
        },
      ],
      structuredContent: output,
    };
  },
);

server.registerTool(
  'converter_para_csv',
  {
    title: 'Converter questões para CSV',
    description: 'Converte questões Q:/A: para formato CSV compatível com validador da Fase 2.',
    inputSchema: converterParaCsvInput,
    outputSchema: converterParaCsvOutput,
  } as any,
  async (args: any) => {
    const { questoes, categoria = '' } = args;
    const parsedQuestions = parseQuestionsFromText(questoes);

    if (parsedQuestions.length === 0) {
      throw new Error('Nenhuma questão válida encontrada no formato Q:/A:');
    }

    // Gera CSV com header
    const csvLines = ['pergunta,resposta,categoria'];

    for (const q of parsedQuestions) {
      // Escapa aspas duplas no CSV
      const perguntaEscaped = q.pergunta.replace(/"/g, '""');
      const respostaEscaped = q.resposta.replace(/"/g, '""');
      const categoriaEscaped = categoria.replace(/"/g, '""');

      csvLines.push(`"${perguntaEscaped}","${respostaEscaped}","${categoriaEscaped}"`);
    }

    const csvContent = csvLines.join('\n');

    const output = {
      csv: csvContent,
      linhas: parsedQuestions.length,
    };

    return {
      content: [
        {
          type: 'text' as const,
          text: truncateText(
            `CSV gerado com ${parsedQuestions.length} questões:\n\n${csvContent}\n\n` +
            `[Use 'validar_csv' para validar antes de importar no Anki]`,
            2000
          ),
        },
      ],
      structuredContent: output,
    };
  },
);

server.registerTool(
  'extrair_texto_pdf',
  {
    title: 'Extrair texto de PDF (sem API key)',
    description: 'Extrai texto de PDF para processamento por Claude na conversa. Não requer ANTHROPIC_API_KEY.',
    inputSchema: extrairTextoPdfInput,
    outputSchema: extrairTextoPdfOutput,
  } as any,
  async (args: any) => {
    const { path: userPath, maxChars = 50000, incluir_prompt = true } = args;
    try {
      const { resolved } = resolveWithinAllowed(userPath);

      // Extrai texto do PDF usando PdfManager
      const pdfText = await pdfManager.extractText(resolved);

      if (!pdfText || pdfText.trim().length === 0) {
        return {
          content: [{
            type: 'text' as const,
            text: 'PDF não contém texto extraível. Possíveis causas:\n- PDF escaneado (apenas imagens)\n- PDF protegido\nSolução: Use PDF com texto selecionável ou aplique OCR.'
          }],
          isError: true,
          structuredContent: {
            error: 'NO_EXTRACTABLE_TEXT',
            message: 'PDF não contém texto extraível',
          },
        };
      }

      // Conta número de páginas (estimativa baseada em quebras de página)
      const estimatedPages = Math.max(1, Math.ceil(pdfText.length / 3000));

      // Trunca se necessário
      const truncado: boolean = pdfText.length > maxChars;
      const textoFinal = truncado
        ? pdfText.substring(0, maxChars) + '\n\n[... texto truncado para ' + maxChars + ' caracteres]'
        : pdfText;

      const output = {
        texto: textoFinal,
        num_chars: textoFinal.length,
        num_pages: estimatedPages,
        prompt_extracao: incluir_prompt ? EXTRACTION_PROMPT : undefined,
        truncado: truncado,
      };

      let mensagem = `📄 Texto extraído do PDF:\n\n`;
      mensagem += `📊 Estatísticas:\n`;
      mensagem += `   - Caracteres: ${textoFinal.length.toLocaleString()}\n`;
      mensagem += `   - Páginas (estimadas): ${estimatedPages}\n`;
      mensagem += `   - Truncado: ${truncado ? 'Sim' : 'Não'}\n\n`;

      if (incluir_prompt) {
        mensagem += `🤖 Instruções para Claude:\n\n${EXTRACTION_PROMPT}\n\n`;
        mensagem += `📝 Agora processe o texto abaixo seguindo as instruções acima e extraia questões no formato Q:/A:\n\n`;
      }

      mensagem += `─`.repeat(80) + '\n';
      mensagem += truncateText(textoFinal, 2000);
      mensagem += `\n` + `─`.repeat(80);

      if (incluir_prompt) {
        mensagem += `\n\n💡 Próximo passo: Após gerar as questões, use 'converter_para_csv' para criar o arquivo CSV.`;
      }

      return {
        content: [{
          type: 'text' as const,
          text: mensagem,
        }],
        structuredContent: output,
      };
    } catch (error) {
      return {
        content: [{
          type: 'text' as const,
          text: `Erro ao extrair texto do PDF: ${(error as Error).message}`
        }],
        isError: true,
        structuredContent: {
          error: 'EXTRACTION_FAILED',
          message: (error as Error).message,
        },
      };
    }
  },
);

server.registerTool(
  'extrair_questoes_iterativo',
  {
    title: 'Extrair questões iterativamente (LOOP automático)',
    description: 'Processa PDF em loop iterativo, retornando chunks em batches. Claude processa cada batch extraindo/criando questões. Sistema de progresso incluso. Funciona como sequential-thinking com iterações.',
    inputSchema: extrairQuestoesIterativoInput,
    outputSchema: extrairQuestoesIterativoOutput,
  } as any,
  async (args: any) => {
    const {
      path: userPath,
      chunk_size = 5,
      overlap = 2,
      start_chunk = 0,
      max_chunks = 90,
      chunk_batch_size = 1,
    } = args;
    try {
      const { resolved } = resolveWithinAllowed(userPath);

      // Extrai PDF com metadados usando PdfManager
      const { text: pdfText, numPages } = await pdfManager.extractWithMetadata(resolved);

      if (!pdfText || pdfText.trim().length === 0) {
        return {
          content: [{
            type: 'text' as const,
            text: 'PDF não contém texto extraível.'
          }],
          isError: true,
          structuredContent: {
            error: 'NO_EXTRACTABLE_TEXT',
            message: 'PDF não contém texto extraível',
          },
        };
      }

      // Determina chunk_size ideal adaptativo
      const finalChunkSize = pdfManager.getAdaptiveChunkSize(numPages, chunk_size);

      // Simula divisão em páginas e cria chunks usando PdfManager
      const pages = pdfManager.simulatePages(pdfText, numPages);
      const chunks = pdfManager.createChunks(pages, finalChunkSize, overlap);

      // Auto-adjust batch size based on average chunk size
      const avgChunkSize = chunks.reduce((sum, c) => sum + c.text.length, 0) / chunks.length;
      const recommendedBatchSize = TokenEstimator.getRecommendedChunkBatchSize(avgChunkSize);
      const safeBatchSize = Math.min(chunk_batch_size, recommendedBatchSize);

    // Determina range de chunks para esta iteração
    const endChunk = Math.min(start_chunk + safeBatchSize, chunks.length, start_chunk + max_chunks);
    const chunksBatch = chunks.slice(start_chunk, endChunk);

    // Prompt template (returned only once on first iteration)
    const promptTemplate = `Analise o seguinte trecho do PDF de estudo para concursos (PMBOK 6):

INSTRUÇÕES:
1. EXTRAIA questões de concurso que já existem no texto (mantenha fielmente enunciado e gabarito)
   - Prefixe com [EXTRAÍDA]
   - Mantenha banca, ano e instituição se houver

2. CRIE novas questões de estudo baseadas nos conceitos apresentados
   - Prefixe com [CRIADA]
   - Foque em conceitos-chave que cairiam em concursos públicos
   - Varie níveis de dificuldade (básico, intermediário, avançado)

FORMATO de saída:
Q: [texto da questão]
A: [resposta/gabarito]`;

    // NO PROMPT IN CHUNKS - just metadata and text
    const chunksBatchOutput = chunksBatch.map(chunk => ({
      chunk_index: chunk.chunkIndex,
      page_start: chunk.pageStart,
      page_end: chunk.pageEnd,
      texto: chunk.text,
      num_chars: chunk.text.length,
    }));

    const hasMore = endChunk < chunks.length;
    const nextStartChunk = hasMore ? endChunk : undefined;

    const progress = {
      chunk_atual: endChunk,
      total_chunks: chunks.length,
      percentual: Math.round((endChunk / chunks.length) * 100),
      chunks_restantes: chunks.length - endChunk,
    };

    const output = {
      iteration: Math.floor(start_chunk / safeBatchSize) + 1,
      chunks_batch: chunksBatchOutput,
      progress,
      metadata: {
        total_pages: numPages,
        total_chars: pdfText.length,
        chunk_size_usado: finalChunkSize,
        overlap_usado: overlap,
        batch_size_ajustado: safeBatchSize,
        recommended_batch_size: recommendedBatchSize,
      },
      has_more: hasMore,
      next_start_chunk: nextStartChunk,
      prompt_template: start_chunk === 0 ? promptTemplate : undefined, // Only on first iteration
    };

    // Validate token limit
    const estimatedTokens = TokenEstimator.estimateObjectTokens(output);
    if (estimatedTokens > TokenEstimator.SAFE_LIMIT_TOKENS) {
      return {
        content: [{
          type: 'text' as const,
          text: `Erro: Batch muito grande (${estimatedTokens} tokens). ` +
                `Reduza chunk_batch_size para ${Math.floor(safeBatchSize / 2)} ou menos.`
        }],
        isError: true,
        structuredContent: {
          error: 'BATCH_TOO_LARGE',
          message: `Batch too large: ${estimatedTokens} tokens`,
          estimated_tokens: estimatedTokens,
          safe_limit: TokenEstimator.SAFE_LIMIT_TOKENS,
          recommended_batch_size: Math.floor(safeBatchSize / 2),
        },
      };
    }

    let mensagem = `🔄 Iteração ${output.iteration} - Processamento de chunks\n\n`;
    mensagem += `📊 Progresso: ${progress.chunk_atual}/${progress.total_chunks} chunks (${progress.percentual}%)\n`;
    mensagem += `📦 Chunks neste batch: ${chunksBatchOutput.length}\n`;
    mensagem += `⏭️  Chunks restantes: ${progress.chunks_restantes}\n`;
    mensagem += `🎯 Tokens estimados: ${TokenEstimator.formatTokenCount(estimatedTokens)} (${TokenEstimator.getLimitPercentage(estimatedTokens)}%)\n\n`;

    if (start_chunk === 0) {
      mensagem += `📋 Prompt template incluído no output (use-o para processar cada chunk)\n\n`;
    }

    mensagem += `📝 Chunks para processar:\n`;
    chunksBatchOutput.forEach((chunk, idx) => {
      mensagem += `   ${idx + 1}. Chunk ${chunk.chunk_index} (págs ${chunk.page_start}-${chunk.page_end}): ${chunk.num_chars.toLocaleString()} chars\n`;
    });

    if (hasMore) {
      mensagem += `\n🔁 Há mais chunks! Próxima iteração começa no chunk ${nextStartChunk}`;
      mensagem += `\n💡 Para continuar, chame novamente com start_chunk=${nextStartChunk}`;
    } else {
      mensagem += `\n✅ Todos os chunks processados! Extração completa.`;
    }

      return {
        content: [{
          type: 'text' as const,
          text: mensagem,
        }],
        structuredContent: output,
      };
    } catch (error) {
      return {
        content: [{
          type: 'text' as const,
          text: `Erro na extração iterativa: ${(error as Error).message}`
        }],
        isError: true,
        structuredContent: {
          error: 'ITERATIVE_EXTRACTION_FAILED',
          message: (error as Error).message,
        },
      };
    }
  },
);

// NEW: Session-based PDF extraction tools (token-safe)
server.registerTool(
  'iniciar_extracao_pdf',
  {
    title: 'Iniciar Extração de PDF (Session-Based)',
    description: 'Inicia sessão de extração de PDF. Retorna session_id e metadados dos chunks. Use obter_chunks_pdf para buscar chunks específicos. Token-safe: retorna apenas metadados, não o texto completo.',
    inputSchema: iniciarExtracaoPdfInput,
    outputSchema: iniciarExtracaoPdfOutput,
  } as any,
  async (args: any) => {
    const { path: userPath, chunk_size = 5, overlap = 2 } = args;

    try {
      const { resolved } = resolveWithinAllowed(userPath);
      const { text: pdfText, numPages } = await pdfManager.extractWithMetadata(resolved);

      if (!pdfText || pdfText.trim().length === 0) {
        return {
          content: [{
            type: 'text' as const,
            text: 'PDF não contém texto extraível.'
          }],
          isError: true,
          structuredContent: {
            error: 'NO_EXTRACTABLE_TEXT',
            message: 'PDF não contém texto extraível',
          },
        };
      }

      const finalChunkSize = pdfManager.getAdaptiveChunkSize(numPages, chunk_size);
      const pages = pdfManager.simulatePages(pdfText, numPages);
      const chunks = pdfManager.createChunks(pages, finalChunkSize, overlap);

      // Create session and store chunks
      const sessionId = await chunkSessionManager.createSession(
        resolved,
        chunks,
        finalChunkSize,
        overlap
      );

      // Get lightweight metadata
      const metadata = await chunkSessionManager.getChunkMetadata(sessionId);

      // Prompt template (returned ONCE, not duplicated)
      const promptTemplate = `Analise o seguinte trecho do PDF de estudo para concursos (PMBOK 6):

INSTRUÇÕES:
1. EXTRAIA questões de concurso que já existem no texto (mantenha fielmente enunciado e gabarito)
   - Prefixe com [EXTRAÍDA]
2. CRIE novas questões de estudo baseadas nos conceitos apresentados
   - Prefixe com [CRIADA]

FORMATO de saída:
Q: [texto da questão]
A: [resposta/gabarito]`;

      const output = {
        session_id: sessionId,
        total_chunks: chunks.length,
        total_pages: numPages,
        chunk_metadata: metadata.map(m => ({
          chunk_index: m.chunkIndex,
          page_range: `${m.pageStart}-${m.pageEnd}`,
          char_count: m.charCount,
          preview: m.preview,
        })),
        prompt_template: promptTemplate,
        estimated_total_tokens: TokenEstimator.estimateTokens(pdfText),
      };

      // Validate response size
      try {
        TokenEstimator.validateResponseSize(output);
      } catch (error) {
        console.error('[iniciar_extracao_pdf] Warning:', error);
      }

      const mensagem = `✅ Sessão criada: ${sessionId}\n\n` +
                      `📊 Estatísticas:\n` +
                      `   - Total de chunks: ${chunks.length}\n` +
                      `   - Total de páginas: ${numPages}\n` +
                      `   - Chunk size: ${finalChunkSize} páginas\n` +
                      `   - Overlap: ${overlap} páginas\n\n` +
                      `💡 Use 'obter_chunks_pdf' com session_id="${sessionId}" para buscar chunks.`;

      return {
        content: [{
          type: 'text' as const,
          text: mensagem,
        }],
        structuredContent: output,
      };
    } catch (error) {
      return {
        content: [{
          type: 'text' as const,
          text: `Erro ao iniciar extração: ${(error as Error).message}`
        }],
        isError: true,
        structuredContent: {
          error: 'SESSION_CREATION_FAILED',
          message: (error as Error).message,
        },
      };
    }
  },
);

server.registerTool(
  'obter_chunks_pdf',
  {
    title: 'Obter Chunks de PDF',
    description: 'Busca chunks específicos de uma sessão de extração. Suporta busca por índices ou batch automático com controle de tokens. Token-safe: ajusta automaticamente a quantidade de chunks retornados.',
    inputSchema: obterChunksPdfInput,
    outputSchema: obterChunksPdfOutput,
  } as any,
  async (args: any) => {
    const { session_id, chunk_indices, start_index, auto_batch = true } = args;

    try {
      let chunks: any[];
      let hasMore = false;
      let nextIndex: number | undefined;

      if (chunk_indices && chunk_indices.length > 0) {
        // Fetch specific chunks by index
        chunks = await chunkSessionManager.getChunks(session_id, chunk_indices);
        hasMore = false;
      } else if (auto_batch) {
        // Auto-batch with token limit
        const result = await chunkSessionManager.getChunkBatch(
          session_id,
          start_index || 0,
          TokenEstimator.SAFE_LIMIT_TOKENS
        );
        chunks = result.chunks;
        hasMore = result.hasMore;
        nextIndex = result.nextIndex;
      } else {
        return {
          content: [{
            type: 'text' as const,
            text: 'Deve fornecer chunk_indices ou usar auto_batch=true'
          }],
          isError: true,
          structuredContent: {
            error: 'INVALID_REQUEST',
            message: 'Deve fornecer chunk_indices ou usar auto_batch=true',
          },
        };
      }

      const estimatedTokens = TokenEstimator.estimateObjectTokens(chunks);

      const output = {
        session_id,
        chunks,
        batch_info: {
          returned_count: chunks.length,
          has_more: hasMore,
          next_index: nextIndex,
          estimated_tokens_used: estimatedTokens,
        },
      };

      // Validate before returning
      try {
        TokenEstimator.validateResponseSize(output);
      } catch (error) {
        return {
          content: [{
            type: 'text' as const,
            text: `Erro: Batch muito grande (${estimatedTokens} tokens). Use start_index com valores menores.`
          }],
          isError: true,
          structuredContent: {
            error: 'RESPONSE_TOO_LARGE',
            message: `Batch too large: ${estimatedTokens} tokens`,
            estimated_tokens: estimatedTokens,
          },
        };
      }

      const mensagem = `📦 Retornados ${chunks.length} chunks da sessão ${session_id}\n\n` +
                      `📊 Token usage: ${TokenEstimator.formatTokenCount(estimatedTokens)} ` +
                      `(${TokenEstimator.getLimitPercentage(estimatedTokens)}% do limite)\n\n` +
                      `${hasMore ? `⏭️  Mais chunks disponíveis. Use start_index=${nextIndex}` : '✅ Todos os chunks retornados.'}`;

      return {
        content: [{
          type: 'text' as const,
          text: mensagem,
        }],
        structuredContent: output,
      };
    } catch (error) {
      return {
        content: [{
          type: 'text' as const,
          text: `Erro ao obter chunks: ${(error as Error).message}`
        }],
        isError: true,
        structuredContent: {
          error: 'CHUNK_RETRIEVAL_FAILED',
          message: (error as Error).message,
        },
      };
    }
  },
);

// Phase 7 - Question Management and Anki Export Tools
server.registerTool(
  'salvar_questoes_chunk',
  {
    title: 'Salvar Questões de um Chunk',
    description: 'Salva questões extraídas/criadas de um chunk processado. Questões ficam persistidas na sessão para posterior geração de CSV Anki.',
    inputSchema: salvarQuestoesChunkInput,
    outputSchema: salvarQuestoesChunkOutput,
  } as any,
  async (args: any) => {
    const { session_id, chunk_index, page_start, page_end, questoes } = args;

    try {
      // Validate questoes format
      const validatedQuestoes: Questao[] = questoes.map((q: any) => ({
        tipo: q.tipo,
        pergunta: q.pergunta,
        resposta: q.resposta,
        metadata: q.metadata,
      }));

      // Save questions
      await questionSessionManager.saveQuestions(
        session_id,
        chunk_index,
        page_start,
        page_end,
        validatedQuestoes
      );

      // Get updated statistics
      const stats = await questionSessionManager.getStatistics(session_id);

      const output = {
        session_id,
        chunk_index,
        questoes_salvas: validatedQuestoes.length,
        total_questoes_sessao: stats.totalQuestions,
      };

      const mensagem = `✅ Questões salvas com sucesso!\n\n` +
                      `📊 Estatísticas:\n` +
                      `   - Chunk: ${chunk_index} (págs ${page_start}-${page_end})\n` +
                      `   - Questões salvas neste chunk: ${validatedQuestoes.length}\n` +
                      `   - Total de questões na sessão: ${stats.totalQuestions}\n` +
                      `   - Extraídas: ${stats.questoesExtraidas} | Criadas: ${stats.questoesCriadas}\n\n` +
                      `💡 Use 'obter_questoes_sessao' para gerar CSV do Anki`;

      return {
        content: [{
          type: 'text' as const,
          text: mensagem,
        }],
        structuredContent: output,
      };
    } catch (error) {
      return {
        content: [{
          type: 'text' as const,
          text: `Erro ao salvar questões: ${(error as Error).message}`
        }],
        isError: true,
        structuredContent: {
          error: 'SAVE_QUESTIONS_FAILED',
          message: (error as Error).message,
        },
      };
    }
  },
);

server.registerTool(
  'obter_questoes_sessao',
  {
    title: 'Obter Questões da Sessão',
    description: 'Retorna todas as questões salvas de uma sessão em formato JSON ou CSV para Anki. Use formato="csv" para gerar arquivo pronto para importação no Anki.',
    inputSchema: obterQuestoesSessaoInput,
    outputSchema: obterQuestoesSessaoOutput,
  } as any,
  async (args: any) => {
    const { session_id, formato = 'json', incluir_estatisticas = true } = args;

    try {
      // Check if session exists
      const exists = await questionSessionManager.sessionExists(session_id);
      if (!exists) {
        return {
          content: [{
            type: 'text' as const,
            text: `Sessão ${session_id} não encontrada ou ainda não possui questões salvas.\n\n` +
                  `Use 'salvar_questoes_chunk' para salvar questões primeiro.`
          }],
          isError: true,
          structuredContent: {
            error: 'SESSION_NOT_FOUND',
            message: `Session ${session_id} not found`,
          },
        };
      }

      const chunks = await questionSessionManager.getAllQuestions(session_id);

      if (chunks.length === 0) {
        return {
          content: [{
            type: 'text' as const,
            text: `Sessão ${session_id} não possui questões salvas ainda.\n\n` +
                  `Use 'salvar_questoes_chunk' para salvar questões primeiro.`
          }],
          isError: true,
          structuredContent: {
            error: 'NO_QUESTIONS_FOUND',
            message: 'No questions saved in this session',
          },
        };
      }

      let questoesOutput: any;
      let mensagem = '';

      if (formato === 'csv') {
        // Get all questions flattened
        const allQuestions = await questionSessionManager.getAllQuestionsFlat(session_id);

        // Get chunk session to find PDF path
        const chunkSession = chunkSessionManager.getSession(session_id);
        const pdfPath = chunkSession?.pdfPath || 'unknown.pdf';

        // Generate CSV
        const csvContent = AnkiCsvFormatter.formatToAnkiCSV(allQuestions, pdfPath);

        questoesOutput = csvContent;

        const stats = await questionSessionManager.getStatistics(session_id);

        mensagem = `📄 CSV gerado para importação no Anki!\n\n` +
                  `📊 Estatísticas:\n` +
                  `   - Total de questões: ${stats.totalQuestions}\n` +
                  `   - Extraídas: ${stats.questoesExtraidas}\n` +
                  `   - Criadas: ${stats.questoesCriadas}\n` +
                  `   - Chunks processados: ${stats.totalChunks}\n\n` +
                  `✅ CSV pronto! Formato: Frente;Verso;Tags;Fonte\n` +
                  `💾 Copie o conteúdo do campo 'questoes' e salve como .csv\n` +
                  `📥 Importe no Anki: File > Import > selecione o arquivo CSV\n\n` +
                  `💡 Use 'validar_csv_anki' para validar o CSV antes de importar`;
      } else {
        // JSON format
        questoesOutput = chunks;

        const stats = await questionSessionManager.getStatistics(session_id);

        mensagem = `📋 Questões retornadas em formato JSON\n\n` +
                  `📊 Estatísticas:\n` +
                  `   - Total de questões: ${stats.totalQuestions}\n` +
                  `   - Extraídas: ${stats.questoesExtraidas}\n` +
                  `   - Criadas: ${stats.questoesCriadas}\n` +
                  `   - Chunks processados: ${stats.totalChunks}\n\n` +
                  `💡 Use formato="csv" para gerar CSV do Anki`;
      }

      const output: any = {
        session_id,
        formato,
        questoes: questoesOutput,
      };

      if (incluir_estatisticas) {
        const stats = await questionSessionManager.getStatistics(session_id);
        output.estatisticas = {
          total_chunks: stats.totalChunks,
          total_questoes: stats.totalQuestions,
          questoes_extraidas: stats.questoesExtraidas,
          questoes_criadas: stats.questoesCriadas,
        };
      }

      return {
        content: [{
          type: 'text' as const,
          text: mensagem,
        }],
        structuredContent: output,
      };
    } catch (error) {
      return {
        content: [{
          type: 'text' as const,
          text: `Erro ao obter questões: ${(error as Error).message}`
        }],
        isError: true,
        structuredContent: {
          error: 'GET_QUESTIONS_FAILED',
          message: (error as Error).message,
        },
      };
    }
  },
);

server.registerTool(
  'validar_csv_anki',
  {
    title: 'Validar CSV do Anki',
    description: 'Valida formato CSV gerado para importação no Anki. Verifica estrutura, encoding e possíveis problemas.',
    inputSchema: validarCsvAnkiInput,
    outputSchema: validarCsvAnkiOutput,
  } as any,
  async (args: any) => {
    const { csv_content } = args;

    try {
      const validation = AnkiCsvFormatter.validateCSV(csv_content);

      let mensagem = '';

      if (validation.valid) {
        mensagem = `✅ CSV válido para importação no Anki!\n\n` +
                  `📊 Estatísticas:\n` +
                  `   - Total de cards: ${validation.lineCount}\n` +
                  `   - Encoding: UTF-8 com BOM ✓\n` +
                  `   - Formato: Anki CSV (4 colunas) ✓\n\n` +
                  `💾 Pronto para importar no Anki!`;
      } else {
        mensagem = `❌ CSV com problemas!\n\n` +
                  `📋 Erros encontrados:\n`;

        validation.errors.forEach((error, idx) => {
          mensagem += `   ${idx + 1}. ${error}\n`;
        });

        mensagem += `\n📊 Total de cards: ${validation.lineCount}\n\n` +
                   `💡 Corrija os erros antes de importar no Anki`;
      }

      const output = {
        valido: validation.valid,
        erros: validation.errors,
        total_linhas: validation.lineCount,
      };

      return {
        content: [{
          type: 'text' as const,
          text: mensagem,
        }],
        structuredContent: output,
      };
    } catch (error) {
      return {
        content: [{
          type: 'text' as const,
          text: `Erro ao validar CSV: ${(error as Error).message}`
        }],
        isError: true,
        structuredContent: {
          error: 'VALIDATION_FAILED',
          message: (error as Error).message,
        },
      };
    }
  },
);

// DEPRECATED: Use iniciar_extracao_pdf + obter_chunks_pdf instead
server.registerTool(
  'extrair_pdf_chunks',
  {
    title: '[DEPRECATED] Extrair PDF em chunks (SEM API key)',
    description: '[DEPRECATED - Use iniciar_extracao_pdf + obter_chunks_pdf] Extrai PDF em chunks estruturados com overlap. AVISO: Pode exceder limite de tokens com PDFs grandes!',
    inputSchema: extrairPdfChunksInput,
    outputSchema: extrairPdfChunksOutput,
  } as any,
  async (args: any) => {
    const {
      path: userPath,
      chunk_size = 5,
      overlap = 2,
      incluir_prompt = true,
    } = args;
    try {
      const { resolved } = resolveWithinAllowed(userPath);

      // Extrai PDF com metadados usando PdfManager
      const { text: pdfText, numPages } = await pdfManager.extractWithMetadata(resolved);

      if (!pdfText || pdfText.trim().length === 0) {
        return {
          content: [{
            type: 'text' as const,
            text: 'PDF não contém texto extraível.'
          }],
          isError: true,
          structuredContent: {
            error: 'NO_EXTRACTABLE_TEXT',
            message: 'PDF não contém texto extraível',
          },
        };
      }

      // Determina chunk_size ideal adaptativo
      const finalChunkSize = pdfManager.getAdaptiveChunkSize(numPages, chunk_size);

      // Simula divisão em páginas e cria chunks usando PdfManager
      const pages = pdfManager.simulatePages(pdfText, numPages);
      const chunks = pdfManager.createChunks(pages, finalChunkSize, overlap);

    // Prepara chunks para output
    const chunksOutput = chunks.map(chunk => ({
      chunk_index: chunk.chunkIndex,
      page_start: chunk.pageStart,
      page_end: chunk.pageEnd,
      texto: chunk.text,
      num_chars: chunk.text.length,
    }));

    const promptSugerido = incluir_prompt ?
      `Para cada chunk abaixo, analise o conteúdo e:
1. EXTRAIA questões de concurso que já existem no texto (com gabarito)
2. CRIE novas questões de estudo baseadas nos conceitos apresentados

Formato de saída para cada questão:
Q: [texto da questão]
A: [resposta/gabarito]

IMPORTANTE:
- Para questões já existentes: mantenha fielmente o enunciado e gabarito
- Para questões criadas: baseie-se nos conceitos, definições e exemplos do texto
- Crie questões de diferentes níveis (básico, intermediário, avançado)
- Foque em conceitos-chave que cairiam em concursos públicos` : undefined;

    const output = {
      chunks: chunksOutput,
      total_chunks: chunks.length,
      total_pages: numPages,
      total_chars: pdfText.length,
      chunk_size_usado: finalChunkSize,
      overlap_usado: overlap,
      prompt_sugerido: promptSugerido,
    };

    let mensagem = `📄 PDF extraído em chunks!\n\n`;
    mensagem += `📊 Estatísticas:\n`;
    mensagem += `   - Total de páginas: ${output.total_pages}\n`;
    mensagem += `   - Total de chunks: ${output.total_chunks}\n`;
    mensagem += `   - Chunk size: ${finalChunkSize} páginas\n`;
    mensagem += `   - Overlap: ${overlap} páginas\n`;
    mensagem += `   - Total de caracteres: ${output.total_chars.toLocaleString()}\n\n`;

    if (incluir_prompt) {
      mensagem += `🤖 Prompt sugerido incluído no output.\n\n`;
    }

    mensagem += `📦 Chunks retornados:\n`;
    for (let i = 0; i < Math.min(3, chunksOutput.length); i++) {
      const chunk = chunksOutput[i];
      mensagem += `   ${i + 1}. Chunk ${chunk.chunk_index} (págs ${chunk.page_start}-${chunk.page_end}): ${chunk.num_chars.toLocaleString()} chars\n`;
    }

    if (chunksOutput.length > 3) {
      mensagem += `   ... e mais ${chunksOutput.length - 3} chunks\n`;
    }

    mensagem += `\n💡 Agora Claude processará cada chunk para extrair/criar questões!`;

      return {
        content: [{
          type: 'text' as const,
          text: truncateText(mensagem, 4000),
        }],
        structuredContent: output,
      };
    } catch (error) {
      return {
        content: [{
          type: 'text' as const,
          text: `Erro ao extrair PDF em chunks: ${(error as Error).message}`
        }],
        isError: true,
        structuredContent: {
          error: 'CHUNK_EXTRACTION_FAILED',
          message: (error as Error).message,
        },
      };
    }
  },
);

// Phase 3 - Anki References Tools
server.registerTool(
  'versoes_suportadas',
  {
    title: 'Versões do Anki suportadas',
    description: 'Lista versões do Anki compatíveis com add-ons, incluindo requisitos de PyQt e breaking changes.',
    inputSchema: versoesSuportadasInput,
    outputSchema: versoesSuportadasOutput,
  } as any,
  async (args: any) => {
    const { incluir_breaking_changes = true } = args || {};
    const versionsData = await readJsonData('anki-versions.json');

    const versoes = versionsData.versoes.map((v: any) => ({
      versao: v.versao,
      data_lancamento: v.data_lancamento,
      tipo: v.tipo,
      compatibilidade: v.compatibilidade,
      ...(incluir_breaking_changes && v.breaking_changes.length > 0
        ? { breaking_changes: v.breaking_changes }
        : {}),
    }));

    const output = {
      versao_minima: versionsData.versao_minima_recomendada,
      versao_maxima_testada: versionsData.versao_maxima_testada,
      versoes_detalhadas: versoes,
    };

    const markdown = formatVersoesAsMarkdown(output);

    return {
      content: [
        {
          type: 'text' as const,
          text: truncateText(markdown, 4000),
        },
      ],
      structuredContent: output,
    };
  },
);

server.registerTool(
  'instalacao_addon',
  {
    title: 'Instruções de instalação de add-on',
    description: 'Retorna guia de instalação de add-ons do Anki em Markdown, pronto para README.',
    inputSchema: instalacaoAddonInput,
    outputSchema: instalacaoAddonOutput,
  } as any,
  async (args: any) => {
    const { tipo = 'geral', incluir_troubleshooting = true } = args || {};
    const installData = await readJsonData('anki-installation.json');

    let guia: any;
    switch (tipo) {
      case 'manual':
        guia = installData.instalacao_manual;
        break;
      case 'ankimon':
        guia = installData.instalacao_ankimon;
        break;
      default:
        guia = installData.instalacao_geral;
    }

    const output = {
      titulo: guia.titulo,
      passos: guia.passos || guia.passos_extras,
      ...(guia.codigo_ankiweb ? { codigo_ankiweb: guia.codigo_ankiweb } : {}),
      ...(guia.requisitos ? { requisitos: guia.requisitos } : {}),
      ...(incluir_troubleshooting ? { troubleshooting: installData.troubleshooting } : {}),
    };

    const markdown = formatInstalacaoAsMarkdown(output, tipo);

    return {
      content: [
        {
          type: 'text' as const,
          text: truncateText(markdown, 6000),
        },
      ],
      structuredContent: output,
    };
  },
);

server.registerTool(
  'anki_hooks',
  {
    title: 'Documentação de hooks do Anki',
    description: 'Lista hooks disponíveis do Anki com descrições, parâmetros e exemplos. Suporta filtros por categoria e versão.',
    inputSchema: ankiHooksInput,
    outputSchema: ankiHooksOutput,
  } as any,
  async (args: any) => {
    const {
      categoria = 'todos',
      apenas_usados_ankimon = false,
      incluir_exemplos = true,
      versao_anki
    } = args || {};

    const hooksData = await readJsonData('anki-hooks.json');

    let filtered = hooksData.hooks;

    // Filtrar por categoria
    if (categoria !== 'todos') {
      filtered = filtered.filter((h: any) => h.categoria === categoria);
    }

    // Filtrar apenas usados no Ankimon
    if (apenas_usados_ankimon) {
      filtered = filtered.filter((h: any) => h.usado_em_ankimon);
    }

    // Filtrar por versão (verificar se hook estava disponível)
    if (versao_anki) {
      filtered = filtered.filter((h: any) => isHookAvailableInVersion(h, versao_anki));
    }

    const output = {
      total_hooks: filtered.length,
      categorias: hooksData.categorias,
      hooks: filtered.map((h: any) => ({
        nome: h.nome,
        categoria: h.categoria,
        descricao: h.descricao,
        parametros: h.parametros,
        uso_comum: h.uso_comum,
        ...(incluir_exemplos ? { exemplo: h.exemplo } : {}),
        usado_em_ankimon: h.usado_em_ankimon,
      })),
    };

    const markdown = formatHooksAsMarkdown(output, incluir_exemplos);

    return {
      content: [
        {
          type: 'text' as const,
          text: truncateText(markdown, 8000),
        },
      ],
      structuredContent: output,
    };
  },
);

// PHASE 4 - Release Notes Tools

server.registerTool(
  'ultimas_mudancas',
  {
    title: 'Últimas mudanças do projeto',
    description: 'Lê e formata changelog do projeto (ankinator-mcp, ankimon ou ambos) em bullets cronológicos.',
    inputSchema: ultimasMudancasInput,
    outputSchema: ultimasMudancasOutput,
  } as any,
  async (args: any) => {
    const {
      fonte = 'ankinator-mcp',
      limite_versoes = 3,
      incluir_unreleased = false,
      formato = 'bullets',
    } = args || {};

    let mcpEntries: ChangelogEntry[] = [];
    let ankimonEntry: ChangelogEntry | null = null;

    // Ler changelog do MCP se necessário
    if (fonte === 'ankinator-mcp' || fonte === 'ambos') {
      const changelogPath = path.join(SERVER_ROOT, 'CHANGELOG.md');
      const changelogContent = await fs.readFile(changelogPath, 'utf8');
      mcpEntries = parseChangelog(changelogContent);
    }

    // Ler changelog do Ankimon se necessário
    if (fonte === 'ankimon' || fonte === 'ambos') {
      const updateTxtPath = path.join(PROJECT_ROOT, 'ankimon', 'update_txt.md');
      try {
        const updateTxtContent = await fs.readFile(updateTxtPath, 'utf8');
        ankimonEntry = parseUpdateTxt(updateTxtContent);
      } catch (error) {
        // Arquivo não existe ou não pode ser lido
        ankimonEntry = null;
      }
    }

    // Mesclar changelogs se fonte === 'ambos'
    let allEntries: ChangelogEntry[] = [];
    if (fonte === 'ambos') {
      allEntries = mergeChangelogs(mcpEntries, ankimonEntry);
    } else if (fonte === 'ankinator-mcp') {
      allEntries = mcpEntries;
    } else if (fonte === 'ankimon' && ankimonEntry) {
      allEntries = [ankimonEntry];
    }

    // Filtrar unreleased se necessário
    if (!incluir_unreleased) {
      allEntries = allEntries.filter(entry => entry.type !== 'unreleased');
    }

    // Limitar número de versões
    const limitedEntries = allEntries.slice(0, limite_versoes);

    // Formatar output
    const versoes = limitedEntries.map(entry => ({
      versao: entry.version,
      data: entry.date,
      tipo: entry.type,
      categorias: entry.categories,
    }));

    const output = {
      fonte,
      versoes,
      total_versoes: limitedEntries.length,
      sugestao_readme: suggestReadmePlacement('changelog'),
    };

    // Formatar como bullets ou markdown
    let text = '';
    if (formato === 'bullets') {
      text = formatAsChronologicalBullets(limitedEntries, limite_versoes);
      text += '\n\n' + output.sugestao_readme;
    } else {
      // Markdown completo (já formatado pelos helpers)
      text = limitedEntries.map(entry => {
        let md = `## [${entry.version}] - ${entry.date}\n\n`;
        for (const [category, items] of Object.entries(entry.categories)) {
          md += `### ${category}\n\n`;
          for (const item of items) {
            md += `- ${item}\n`;
          }
          md += '\n';
        }
        return md;
      }).join('\n');
      text += '\n\n' + output.sugestao_readme;
    }

    return {
      content: [
        {
          type: 'text' as const,
          text: truncateText(text, 8000),
        },
      ],
      structuredContent: output,
    };
  },
);

server.registerTool(
  'roadmap',
  {
    title: 'Roadmap do projeto',
    description: 'Lê e formata roadmap do projeto com status, próximas ações e riscos conhecidos.',
    inputSchema: roadmapInput,
    outputSchema: roadmapOutput,
  } as any,
  async (args: any) => {
    const {
      incluir_completas = false,
      apenas_proximas = true,
      formato = 'bullets',
    } = args || {};

    // Ler ROADMAP.md
    const roadmapPath = path.join(SERVER_ROOT, 'ROADMAP.md');
    const roadmapContent = await fs.readFile(roadmapPath, 'utf8');
    const roadmapData = parseRoadmap(roadmapContent);

    // Filtrar fases completas se necessário
    let phases = roadmapData.phases;
    if (!incluir_completas) {
      phases = phases.filter(p => p.status !== 'complete');
    }

    // Preparar fases pendentes para output
    const fases_pendentes = phases
      .filter(p => p.status !== 'complete')
      .map(p => ({
        fase: p.fase,
        nome: p.nome,
        ferramentas: p.ferramentas,
        criterios: p.criterios,
      }));

    const output = {
      status_geral: roadmapData.status,
      proximas_acoes: apenas_proximas
        ? roadmapData.nextActions.slice(0, 5)  // Limitar a 5 próximas ações
        : roadmapData.nextActions,
      fases_pendentes,
      riscos_conhecidos: roadmapData.risks.slice(0, 5),  // Limitar a 5 riscos
      sugestao_readme: suggestReadmePlacement('roadmap'),
    };

    // Formatar texto
    let text = '';
    if (formato === 'bullets') {
      text = `## Status do Projeto\n\n`;
      text += `**Progresso:** ${roadmapData.status.progresso_percentual}% completo\n`;
      text += `**Fases completas:** ${roadmapData.status.fases_completas}/${roadmapData.status.fases_totais}\n\n`;

      if (apenas_proximas) {
        text += `### Próximas Ações:\n\n`;
        for (const action of output.proximas_acoes) {
          text += `- ${action}\n`;
        }
      } else {
        text += `### Fases Pendentes:\n\n`;
        for (const fase of fases_pendentes) {
          text += `- **${fase.fase}** - ${fase.nome}\n`;
          if (fase.ferramentas.length > 0) {
            text += `  - Ferramentas: ${fase.ferramentas.join(', ')}\n`;
          }
        }
      }

      if (output.riscos_conhecidos.length > 0) {
        text += `\n### Riscos Conhecidos:\n\n`;
        for (const risk of output.riscos_conhecidos) {
          text += `- ${risk}\n`;
        }
      }

      text += '\n\n' + output.sugestao_readme;
    } else {
      // Markdown completo
      text = `# Roadmap\n\n`;
      text += `## Status: ${roadmapData.status.progresso_percentual}% Completo\n\n`;

      for (const phase of phases) {
        const status = phase.status === 'complete' ? '✅' : '⏳';
        text += `### ${status} ${phase.fase} - ${phase.nome}\n\n`;
        if (phase.ferramentas.length > 0) {
          text += `**Ferramentas:** ${phase.ferramentas.join(', ')}\n\n`;
        }
        if (phase.criterios) {
          text += `**Critérios:** ${phase.criterios}\n\n`;
        }
      }

      text += '\n\n' + output.sugestao_readme;
    }

    return {
      content: [
        {
          type: 'text' as const,
          text: truncateText(text, 8000),
        },
      ],
      structuredContent: output,
    };
  },
);

async function main() {
  // Initialize session managers
  await chunkSessionManager.initialize();
  await questionSessionManager.initialize();

  // Set up periodic cleanup of old sessions (every 6 hours)
  setInterval(async () => {
    try {
      const cleanedChunks = await chunkSessionManager.cleanupOldSessions();
      const cleanedQuestions = await questionSessionManager.cleanupOldSessions();
      if (cleanedChunks > 0 || cleanedQuestions > 0) {
        console.error(`[Cleanup] Removed ${cleanedChunks} chunk sessions, ${cleanedQuestions} question sessions`);
      }
    } catch (error) {
      console.error('[Cleanup] Error during session cleanup:', error);
    }
  }, 6 * 60 * 60 * 1000); // 6 hours

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Ankinator MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
