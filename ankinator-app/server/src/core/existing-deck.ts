/**
 * Leitura de um DECK EXISTENTE (opcional) para geração incremental.
 *
 * Objetivo (pedido do usuário): além do PDF, aceitar um deck já existente para que
 * o Ankinator adicione APENAS questões que ainda não estão cobertas — sem extrapolar
 * o contexto do PDF — e responda "deck já completo" quando o material do PDF já está
 * inteiramente coberto pelas questões do deck.
 *
 * O dado essencial, vindo de QUALQUER fonte, é a lista de PERGUNTAS (fronts) já
 * existentes. Este módulo isola cada fonte atrás de uma única fronteira que devolve
 * `string[]` (fronts normalizados o suficiente para dedup):
 *   - AnkiConnect ao vivo  (deck aberto no Anki) — findNotes + notesInfo.
 *   - Arquivo .txt/.csv     (export "Notes in Plain Text" do Anki) — parser puro.
 *   - Arquivo .apkg         (pacote Anki) — unzip + leitura do SQLite (notes.flds).
 *
 * Também expõe a camada de deduplicação MECÂNICA (rede de segurança sobre a semântica
 * feita pelo LLM): normalização + similaridade de tokens (Jaccard).
 *
 * Compatibilidade Anki: o esquema SQLite usa `notes.flds` (campos separados por \x1f)
 * em todas as versões (anki2 / anki21 / anki21b). O `.anki21b` é zstd-comprimido
 * (Anki ≥ 2.1.50 sem "legacy support"): descomprimido via node:zlib (Node ≥ 22.15).
 */
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { DatabaseSync } from 'node:sqlite';
import { notesInfoDoDeck } from './exporters/ankiconnect.js';
import { log } from '../logger.js';

const execFileAsync = promisify(execFile);

/** Fonte do deck existente (opcional). Ausente → geração não-incremental (fluxo de hoje). */
export type DeckSource =
  | { type: 'ankiconnect'; deck: string }
  | { type: 'file'; filePath: string; fileName: string };

// ── Normalização / HTML ────────────────────────────────────────────────────────

/** Remove tags HTML, marcadores Anki ([sound:], cloze) e decodifica entidades comuns. */
export function stripHtml(s: string): string {
  return s
    .replace(/\{\{c\d+::(.*?)(?:::.*?)?\}\}/g, '$1') // cloze {{c1::x::dica}} → x
    .replace(/\[sound:[^\]]*\]/g, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/** Forma normalizada para comparação de duplicatas: minúsculas, sem acento/pontuação. */
export function normalizeForDedup(s: string): string {
  return stripHtml(s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // remove acentos (diacríticos combinantes)
    .replace(/[^\p{L}\p{N}\s]/gu, ' ') // pontuação → espaço
    .replace(/\s+/g, ' ')
    .trim();
}

// ── Deduplicação mecânica (rede de segurança sobre a semântica do LLM) ──────────

function tokenSet(s: string): Set<string> {
  return new Set(normalizeForDedup(s).split(' ').filter(Boolean));
}

/** Similaridade de Jaccard entre dois conjuntos de tokens (0..1). */
export function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size && !b.size) return 1;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter);
}

/**
 * Limiar de similaridade a partir do qual uma pergunta gerada é tratada como
 * duplicata de uma já existente. 0.82 captura reescritas próximas sem ser tão
 * agressivo a ponto de descartar questões genuinamente novas sobre o mesmo tema.
 */
export const DUP_THRESHOLD = 0.82;

/**
 * Particiona `geradas` em novas × duplicatas, comparando cada pergunta gerada contra
 * o conjunto de fronts existentes (igualdade normalizada OU Jaccard ≥ DUP_THRESHOLD).
 * Função PURA — não conhece Questao; recebe/retorna o que o chamador precisar via getKey.
 */
export function partitionNovas<T>(
  geradas: readonly T[],
  existentes: readonly string[],
  getPergunta: (item: T) => string
): { novas: T[]; duplicadas: T[] } {
  const exatos = new Set(existentes.map(normalizeForDedup));
  const tokensExistentes = existentes.map(tokenSet);
  const novas: T[] = [];
  const duplicadas: T[] = [];
  for (const item of geradas) {
    const pergunta = getPergunta(item);
    const norm = normalizeForDedup(pergunta);
    if (!norm) {
      novas.push(item); // sem texto comparável → não descarta
      continue;
    }
    let dup = exatos.has(norm);
    if (!dup) {
      const tk = tokenSet(pergunta);
      dup = tokensExistentes.some((te) => jaccard(tk, te) >= DUP_THRESHOLD);
    }
    (dup ? duplicadas : novas).push(item);
  }
  return { novas, duplicadas };
}

// ── Parser do export plain-text do Anki (.txt/.csv) ─────────────────────────────

const SEP_MAP: Record<string, string> = {
  tab: '\t',
  comma: ',',
  semicolon: ';',
  space: ' ',
  pipe: '|',
  colon: ':',
};

/**
 * Extrai os fronts de um export "Notes in Plain Text" do Anki.
 *
 * Formato: linhas iniciadas por `#` são cabeçalhos (`#separator:tab`, `#html:true`,
 * `#guid column:1`, `#notetype column:2`, `#deck column:3`, `#tags column:N`). As
 * demais são notas: campos separados pelo separador; o "front" é a 1ª coluna que NÃO
 * é meta (guid/notetype/deck/tags). Sem dicas de coluna → 1ª coluna.
 *
 * PURO (sem I/O). Limitação assumida: campos entre aspas com quebras de linha
 * multi-físicas não são reconstituídos (raro em fronts de questão) — a 1ª linha basta.
 */
export function parseDeckText(content: string): string[] {
  const linhas = content.split(/\r?\n/);
  let sep = '\t';
  const metaCols = new Set<number>(); // índices 0-based de colunas meta
  let i = 0;
  for (; i < linhas.length; i++) {
    const linha = linhas[i];
    if (!linha.startsWith('#')) break;
    const m = /^#([^:]+):(.*)$/.exec(linha);
    if (!m) continue;
    const chave = m[1].trim().toLowerCase();
    const valor = m[2].trim();
    if (chave === 'separator') {
      sep = SEP_MAP[valor.toLowerCase()] ?? (valor.length === 1 ? valor : '\t');
    } else if (chave.endsWith('column')) {
      // ex.: "guid column", "notetype column", "deck column", "tags column"
      const nome = chave.replace(/\s*column$/, '').trim();
      const idx = Number(valor) - 1;
      if (Number.isInteger(idx) && idx >= 0 && ['guid', 'notetype', 'deck', 'tags'].includes(nome)) {
        metaCols.add(idx);
      }
    }
  }

  const fronts: string[] = [];
  for (; i < linhas.length; i++) {
    const linha = linhas[i];
    if (!linha.trim()) continue;
    const campos = linha.split(sep).map(desaspar);
    // front = 1ª coluna não-meta com texto
    let front = '';
    for (let c = 0; c < campos.length; c++) {
      if (metaCols.has(c)) continue;
      const limpo = stripHtml(campos[c]);
      if (limpo) {
        front = limpo;
        break;
      }
    }
    if (front) fronts.push(front);
  }
  return fronts;
}

/** Remove aspas de campo do Anki/CSV e desfaz o escape `""` → `"`. */
function desaspar(campo: string): string {
  const t = campo.trim();
  if (t.length >= 2 && t.startsWith('"') && t.endsWith('"')) {
    return t.slice(1, -1).replace(/""/g, '"');
  }
  return campo;
}

// ── Leitura de .apkg (unzip + SQLite) ───────────────────────────────────────────

/** Nomes possíveis do arquivo de coleção dentro do .apkg, em ordem de preferência. */
const COLLECTION_FILES = ['collection.anki2', 'collection.anki21', 'collection.anki21b'] as const;

/**
 * Extrai os fronts de um arquivo .apkg: descompacta (unzip), localiza o SQLite da
 * coleção (descomprimindo zstd quando for `.anki21b`) e lê `notes.flds` (1º campo).
 * Falha com erro EXPLÍCITO (nunca silencioso) quando o formato não é suportado.
 */
export async function readApkgFronts(apkgPath: string): Promise<string[]> {
  const tmpDir = path.join(os.tmpdir(), `ankinator-apkg-${crypto.randomUUID()}`);
  await fs.mkdir(tmpDir, { recursive: true });
  try {
    try {
      await execFileAsync('unzip', ['-o', '-q', '-d', tmpDir, apkgPath]);
    } catch (err) {
      throw new Error(
        `Não foi possível descompactar o .apkg (precisa do utilitário "unzip" no PATH): ${
          err instanceof Error ? err.message : String(err)
        }. Alternativa: exporte o deck como .txt ("Notes in Plain Text") ou use o deck ao vivo via AnkiConnect.`
      );
    }

    let colFile: string | undefined;
    for (const nome of COLLECTION_FILES) {
      const p = path.join(tmpDir, nome);
      if (await existe(p)) {
        colFile = p;
        break;
      }
    }
    if (!colFile) {
      throw new Error('Arquivo de coleção (collection.anki2/anki21/anki21b) não encontrado no .apkg.');
    }

    // .anki21b é zstd-comprimido → descomprime para um SQLite temporário.
    let sqlitePath = colFile;
    if (colFile.endsWith('.anki21b')) {
      const comprimido = await fs.readFile(colFile);
      const descomprimido = zlib.zstdDecompressSync(comprimido);
      sqlitePath = path.join(tmpDir, 'collection.decompressed.sqlite');
      await fs.writeFile(sqlitePath, descomprimido);
    }

    const db = new DatabaseSync(sqlitePath, { readOnly: true });
    try {
      const rows = db.prepare('SELECT flds FROM notes').all() as { flds: string }[];
      const fronts: string[] = [];
      for (const row of rows) {
        const primeiro = String(row.flds ?? '').split('\x1f')[0];
        const limpo = stripHtml(primeiro);
        if (limpo) fronts.push(limpo);
      }
      return fronts;
    } finally {
      db.close();
    }
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

async function existe(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

// ── Fronteira única: fonte → fronts ─────────────────────────────────────────────

/**
 * Resolve a fonte do deck em uma lista de fronts existentes. Erros são propagados
 * (o chamador decide como reportar) — NUNCA falha-suave silenciosa.
 */
export async function resolveExistingDeck(source: DeckSource): Promise<string[]> {
  if (source.type === 'ankiconnect') {
    const notas = await notesInfoDoDeck(source.deck);
    return notas.map(stripHtml).filter(Boolean);
  }
  // arquivo: decide pelo conteúdo/extensão
  const ext = source.fileName.toLowerCase();
  if (ext.endsWith('.apkg') || ext.endsWith('.colpkg')) {
    return readApkgFronts(source.filePath);
  }
  // .txt/.csv/.tsv ou desconhecido → tenta como plain-text
  const conteudo = await fs.readFile(source.filePath, 'utf8');
  return parseDeckText(conteudo);
}

/**
 * Resolve a fonte e devolve um resumo (contagem + amostra) — para a prévia na UI.
 * Loga quantos fronts foram lidos (observabilidade).
 */
export async function previewExistingDeck(source: DeckSource): Promise<{ count: number; sample: string[] }> {
  const fronts = await resolveExistingDeck(source);
  log.info('deck', `deck base resolvido: ${fronts.length} questão(ões) existente(s)`, {
    fonte: source.type === 'ankiconnect' ? `anki:${source.deck}` : source.fileName,
    count: fronts.length,
  });
  return { count: fronts.length, sample: fronts.slice(0, 8) };
}
