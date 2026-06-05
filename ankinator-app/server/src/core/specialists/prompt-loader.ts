/**
 * Carregador dos prompts canônicos dos especialistas.
 *
 * Cada especialista tem UM `.md` canônico em `src/core/specialists/prompts/<nome>.md`
 * (fonte única — D-04/D-07). `loadPrompt(nome)` lê esse arquivo em runtime, com cache
 * e allowlist.
 *
 * INVARIANTE CRÍTICO (Pitfall 1): o build `tsc` puro NÃO copia `.md` para `dist/`
 * (`include: src/**\/*.ts`, sem passo de cópia de assets). Logo o `.md` SÓ existe na
 * árvore `src/`. Resolvemos SEMPRE de `src/`, nunca de `dist/`.
 *
 * Técnica escolhida (a): a partir de `fileURLToPath(import.meta.url)` (padrão ESM do
 * projeto — ver config.ts:5-8, NUNCA `__dirname`), se o caminho do módulo contiver um
 * segmento `dist` (modo produção `node dist/...`), troca-se esse segmento por `src`.
 * Em modo `tsx` (dev) o módulo já roda de `src/`, então o caminho fica intacto.
 * Em ambos os casos compomos `.../src/core/specialists/prompts/<nome>.md`.
 *
 * Por que (a) e não (b) [subir até o package.json do server]: a heurística dist→src é
 * mínima, sem I/O extra de busca ascendente, e o layout `dist/` é o espelho 1:1 de
 * `src/` (mesma profundidade `core/specialists/`), então a troca de segmento é exata.
 *
 * CAVEAT (Assumption A1 — registrado também no 01-02-SUMMARY.md): isto pressupõe que a
 * árvore `src/` acompanha o deploy (app local single-user roda do checkout). Se algum
 * dia houver deploy "dist-only" sem `src/`, trocar para o Plano B: copiar `prompts/*.md`
 * para `dist/core/specialists/prompts/` num passo pós-`tsc` e resolver relativo ao módulo.
 *
 * SEGURANÇA (Security Domain — path traversal): `nome` é validado contra a allowlist dos
 * 5 nomes canônicos ANTES do `readFileSync`. `nome` nunca vem de input de usuário nesta fase.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Allowlist dos nomes canônicos (D-07). Bloqueia path traversal. */
const NOMES = ['anki-orchestrator', 'deck-classifier', 'card-builder', 'mnemonic', 'mnemonic-image', 'learning-scientist'] as const;
type NomeCanonico = (typeof NOMES)[number];

const cache = new Map<string, string>();

/**
 * Resolve o diretório `.../src/core/specialists` a partir do módulo atual,
 * trocando o segmento `dist` por `src` quando em produção (`node dist/...`).
 */
function resolveSpecialistsSrcDir(): string {
  const here = path.dirname(fileURLToPath(import.meta.url)); // dev: .../src/core/specialists ; prod: .../dist/core/specialists
  const parts = here.split(path.sep);
  const idx = parts.lastIndexOf('dist');
  if (idx !== -1) parts[idx] = 'src';
  return parts.join(path.sep);
}

/**
 * Lê o `.md` canônico de um especialista. Valida o nome contra a allowlist,
 * resolve sempre de `src/`, e cacheia (carrega 1x por nome).
 */
export function loadPrompt(nome: string): string {
  if (!(NOMES as readonly string[]).includes(nome)) {
    throw new Error(`Especialista desconhecido: "${nome}". Permitidos: ${NOMES.join(', ')}.`);
  }
  const cached = cache.get(nome);
  if (cached !== undefined) return cached;

  const base = resolveSpecialistsSrcDir();
  const file = path.join(base, 'prompts', `${nome as NomeCanonico}.md`);
  const text = readFileSync(file, 'utf8');
  cache.set(nome, text);
  return text;
}
