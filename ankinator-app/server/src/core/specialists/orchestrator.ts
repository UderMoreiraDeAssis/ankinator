/**
 * Runner ORQUESTRADO (Destino #4 / Phase 5) — opt-in, com FALLBACK determinístico.
 *
 * Liga o subagent `ankinator-orchestrator` (definido em `.claude/agents/`) como o
 * "cérebro" que decide, POR CARD, quais estágios de enriquecimento rodar e delega aos
 * outros 4 subagents (deck-classifier, card-builder, mnemonic, image) via a ferramenta
 * **Task** — entregando o modo educativo "pelo mundo Claude" (subagents/skills), não só
 * arquivos de prompt.
 *
 * SEGURANÇA / NÃO-REGRESSÃO:
 *  - É um caminho SEPARADO do spawn de geração: `buildSpawnArgs` (runner.ts) NÃO é tocado,
 *    então o guard SPEC-01 (spawn byte-idêntico) permanece intacto.
 *  - Gated por `EnrichOpts.orchestrated` (env `ANKINATOR_ORCHESTRATED`, default OFF). Com OFF,
 *    `runEnrich` é byte-equivalente a `enrichAll` (pipeline atual preservado).
 *  - Em QUALQUER falha do orquestrador (spawn, JSON inválido, agente ausente, ids
 *    incompatíveis) cai DETERMINISTICAMENTE para `enrichAll` — nunca derruba o pipeline.
 *  - O SVG devolvido pelo orquestrador é gerado por LLM → passa pelo MESMO boundary de
 *    segurança (`sanitizarSvg`, fail-closed D-08) e pelo gate de qualidade antes de gravar.
 *
 * INCERTEZA (registrada): a execução headless de `claude -p --agent` com a tool Task
 * disparando subagents só se PROVA na assinatura do usuário (run ao vivo). O código,
 * o plano de spawn (assertável CLI-free) e o fallback são verificáveis aqui; o efeito
 * de ponta-a-ponta é validação AO VIVO (MO do projeto).
 */
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Questao } from '../types.js';
import { log, timer } from '../../logger.js';
import { recordUsage, usageFromEnvelope, type RawCliUsage } from '../usage.js';
import { sanitizarSvg } from './sanitize-svg.js';
import { avaliarQualidadeSvg } from './svg-quality.js';
import { enrichAll, type EnrichOpts, type EnrichProgress } from './enrich.js';

const CLI_BIN = process.env.ANKINATOR_CLAUDE_BIN?.trim() || 'claude';
/**
 * A orquestração é MULTI-TURN (orquestrador + N subagents via Task) → muito mais lenta
 * que uma chamada única. Timeout generoso, ajustável por env.
 */
const ORCH_TIMEOUT_MS = Number(process.env.ANKINATOR_ORCHESTRATOR_TIMEOUT_MS) || 600_000;
/** Nome do agente (frontmatter `name:` de `.claude/agents/ankinator-orchestrator.md`). */
const AGENT_NAME = 'ankinator-orchestrator';

function envBool(v: string | undefined): boolean {
  return ['1', 'true', 'on', 'yes'].includes((v ?? '').trim().toLowerCase());
}

export interface OrchestratorSpawnPlan {
  bin: string;
  args: string[];
  cwd: string;
  env: NodeJS.ProcessEnv;
}

/**
 * Resolve a raiz do repo (onde vive `.claude/agents/`). Override por env
 * `ANKINATOR_PROJECT_ROOT`; senão sobe 5 níveis a partir deste módulo
 * (`server/{src|dist}/core/specialists` → raiz do repo), espelhando o padrão
 * cross-mode do `langchain-loader.ts` (resolução via import.meta.url, nunca __dirname).
 */
export function resolveProjectRoot(): string {
  const fromEnv = process.env.ANKINATOR_PROJECT_ROOT?.trim();
  if (fromEnv) return fromEnv;
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, '../../../../..');
}

/** O agente orquestrador é descobrível na raiz? (`.claude/agents/<name>.md` existe?) */
export function orchestratorAgentDisponivel(projectRoot = resolveProjectRoot()): boolean {
  return existsSync(path.join(projectRoot, '.claude', 'agents', `${AGENT_NAME}.md`));
}

/** Os 4 subagents que o orquestrador aciona via Task (transformadores puros texto→JSON/SVG). */
const WORKER_AGENTS = ['ankinator-deck-classifier', 'ankinator-card-builder', 'ankinator-mnemonic', 'ankinator-image'];

/**
 * Um agente declara restrição EXPLÍCITA de tools no frontmatter? (`tools:` allowlist ou
 * `disallowedTools:`). Se OMITE `tools:`, herda TODO o toolset (Bash/Write/...) — e o
 * `--allowedTools` do PAI NÃO restringe um filho delegado via Task (confirmado). Logo a
 * única defesa é o frontmatter do próprio worker.
 */
function agentToolRestricted(projectRoot: string, name: string): boolean {
  try {
    const txt = readFileSync(path.join(projectRoot, '.claude', 'agents', `${name}.md`), 'utf8');
    const fm = txt.split('---')[1] ?? ''; // frontmatter entre os dois primeiros '---'
    return /^\s*tools\s*:/m.test(fm) || /^\s*disallowedTools\s*:/m.test(fm);
  } catch {
    return false;
  }
}

/**
 * PRECONDIÇÃO DE SEGURANÇA do modo orquestrado (achado da revisão adversarial): os 4 workers
 * acionados via Task devem declarar restrição de tools no frontmatter. Sem isso, rodar o
 * orquestrador da RAIZ do repo com `--permission-mode dontAsk` daria a um worker
 * prompt-injetado (conteúdo vindo do PDF do usuário) acesso ungated a Bash/Write. Se algum
 * worker NÃO está restrito, o dispatcher DESABILITA o modo orquestrado e cai p/ enrichAll.
 */
export function workersToolRestricted(projectRoot = resolveProjectRoot()): { ok: boolean; faltando: string[] } {
  const faltando = WORKER_AGENTS.filter((n) => !agentToolRestricted(projectRoot, n));
  return { ok: faltando.length === 0, faltando };
}

/**
 * Helper PURO: plano de spawn do `claude -p --agent` (NÃO spawna nada — assertável CLI-free,
 * como `buildSpawnArgs`). Difere do spawn de GERAÇÃO em três pontos, e SÓ neles:
 *   1. cwd = RAIZ do repo (não tmpdir) — p/ descobrir `.claude/agents/`.
 *   2. `--agent <orquestrador>` — roda COMO o subagent orquestrador.
 *   3. `--allowedTools Task Read` (least-privilege: delegar + ler) + `--permission-mode dontAsk`
 *      (não-interativo). `bypassPermissions` (env `ANKINATOR_ORCHESTRATED_BYPASS`) só se a
 *      validação ao vivo mostrar bloqueio de permissão num subagent.
 * Os demais flags (`-p --output-format json --model … --exclude-dynamic-system-prompt-sections
 * --strict-mcp-config`) espelham o spawn de geração (consistência + isolamento de MCP/contexto).
 */
export function buildOrchestratorSpawnArgs(opts: {
  model: string;
  projectRoot: string;
  agent?: string;
  bypassPermissions?: boolean;
}): OrchestratorSpawnPlan {
  const agent = opts.agent ?? AGENT_NAME;
  const args = [
    '-p',
    '--output-format',
    'json',
    '--model',
    opts.model,
    '--agent',
    agent,
    // least-privilege: Task (delegar aos subagents) + Read (frontmatter do orquestrador).
    // `--allowedTools` é variádico → consome 'Task' 'Read' até o próximo flag.
    '--allowedTools',
    'Task',
    'Read',
    '--permission-mode',
    opts.bypassPermissions ? 'bypassPermissions' : 'dontAsk',
    '--exclude-dynamic-system-prompt-sections',
    '--strict-mcp-config',
  ];
  return { bin: CLI_BIN, args, cwd: opts.projectRoot, env: { ...process.env } };
}

interface CliEnvelope {
  is_error?: boolean;
  result?: string;
  error?: string;
  total_cost_usd?: number;
  /** usage/custo do MESMO envelope — soma TODOS os turns (orquestrador + subagents Task). */
  usage?: RawCliUsage;
  duration_api_ms?: number;
}

/**
 * Executa `claude -p --agent` (orquestrador). `userMessage` por stdin (nunca em args —
 * mesma mitigação de injeção do runner). Retorna `envelope.result`.
 */
export function runOrchestratorCli(opts: {
  userMessage: string;
  model?: string;
  projectRoot?: string;
  bypassPermissions?: boolean;
}): Promise<string> {
  const model = opts.model || 'sonnet';
  const projectRoot = opts.projectRoot || resolveProjectRoot();
  const bypassPermissions = opts.bypassPermissions ?? envBool(process.env.ANKINATOR_ORCHESTRATED_BYPASS);
  return new Promise((resolve, reject) => {
    const plan = buildOrchestratorSpawnArgs({ model, projectRoot, bypassPermissions });
    if (bypassPermissions) {
      // Aviso ALTO (achado da revisão adversarial): bypassPermissions remove TODO gate de
      // permissão dos subagents, a partir da raiz do repo. Use SÓ p/ debug de validação ao
      // vivo, nunca em produção; prefira restringir os tools dos subagents em .claude/agents/.
      log.warn(
        'orquestrador',
        '⚠️  ANKINATOR_ORCHESTRATED_BYPASS ATIVO: subagents rodam SEM gate de permissão (bypassPermissions) a partir da raiz do repo. Apenas para debug; nunca em produção.',
        { projectRoot },
      );
    }
    log.info('orquestrador', 'chamada START', {
      model,
      projectRoot,
      bypass: bypassPermissions,
      userChars: opts.userMessage.length,
    });
    const fim = timer('orquestrador', `chamada (model=${model})`);

    const child = spawn(plan.bin, plan.args, { cwd: plan.cwd, stdio: ['pipe', 'pipe', 'pipe'], env: plan.env });
    let stdout = '';
    let stderr = '';
    const tmout = setTimeout(() => {
      child.kill('SIGKILL');
      log.error('orquestrador', `chamada TIMEOUT (${ORCH_TIMEOUT_MS}ms)`, { model });
      fim({ timeout: true });
      reject(new Error(`Orquestrador: tempo esgotado (${ORCH_TIMEOUT_MS}ms) ao chamar o claude CLI.`));
    }, ORCH_TIMEOUT_MS);

    child.stdout.on('data', (d) => (stdout += d.toString()));
    child.stderr.on('data', (d) => (stderr += d.toString()));
    child.on('error', (err) => {
      clearTimeout(tmout);
      log.error('orquestrador', `chamada ERRO de spawn: ${err.message}`, { bin: CLI_BIN });
      fim({ erro: 'spawn' });
      reject(new Error(`Orquestrador: falha ao executar "${CLI_BIN}": ${err.message}. O Claude Code está instalado e logado?`));
    });
    child.on('close', (code) => {
      clearTimeout(tmout);
      if (code !== 0) {
        log.error('orquestrador', `chamada saiu com código ${code}`, { model, stderr: stderr.slice(-300) });
        fim({ code });
        reject(new Error(`Orquestrador: claude CLI saiu com código ${code}. ${stderr.slice(-300)}`));
        return;
      }
      try {
        const env = JSON.parse(stdout) as CliEnvelope;
        if (env.is_error) {
          fim({ isError: true });
          reject(new Error(`Orquestrador: ${env.error || env.result || 'erro desconhecido'}`));
          return;
        }
        const out = env.result ?? '';
        // Contabiliza o custo/tokens do envelope (soma TODOS os turns: orquestrador + subagents
        // Task) sob o estágio 'orquestrador' — senão o resumo do job omitiria o custo do enrich
        // orquestrado (achado da validação ao vivo 2026-06-05: $0.82 ficava invisível).
        recordUsage('orquestrador', usageFromEnvelope(env.usage, env.total_cost_usd, env.duration_api_ms));
        log.info('orquestrador', 'chamada END', { model, outChars: out.length, custo: env.total_cost_usd });
        fim({ outChars: out.length });
        resolve(out);
      } catch {
        log.info('orquestrador', 'chamada END (stdout cru, sem envelope JSON)', { model, outChars: stdout.length });
        fim({ outChars: stdout.length, raw: true });
        resolve(stdout);
      }
    });

    child.stdin.write(opts.userMessage);
    child.stdin.end();
  });
}

/**
 * Monta a mensagem ao orquestrador: cards (serializados, nunca interpolados — anti-injeção),
 * toggles HABILITADOS (o orquestrador deve honrá-los: não roda estágio desligado) e o
 * contrato de saída ESTRITO (preserva ids; 1→1; só JSON).
 */
export function buildOrchestratorMessage(questoes: Questao[], opts: EnrichOpts): string {
  const cards = questoes.map((q) => ({
    id: q.id,
    tipo: q.tipo,
    pergunta: q.pergunta,
    resposta: q.resposta,
    ...(q.pageStart
      ? { fonte: q.pageEnd !== undefined && q.pageEnd !== q.pageStart ? `p.${q.pageStart}-${q.pageEnd}` : `p.${q.pageStart}` }
      : {}),
  }));
  const estagios = [
    `classificar=${!!opts.classificar}`,
    `cardBuilder=${!!opts.cardBuilder}`,
    `mnemonico=${!!opts.mnemonico}`,
    `imagem=${!!opts.imagem}`,
  ].join(', ');
  const linhas = [
    'Você recebe cards de flashcard JÁ GERADOS de material de concurso. Decida, POR CARD, quais estágios rodar e DELEGUE aos subagents via a ferramenta Task; depois agregue os resultados.',
    `Estágios HABILITADOS nesta execução (NÃO rode estágios desabilitados): ${estagios}.`,
  ];
  // Cobertura explícita por estágio: o usuário LIGOU estes toggles → o orquestrador deve
  // ENTREGAR, não economizar. Isto SOBREPÕE qualquer "use com parcimônia" do prompt do agente
  // (achado da validação ao vivo: imagens quase não eram geradas apesar de imagem=ON).
  if (opts.mnemonico) {
    linhas.push('- MNEMÔNICO ligado: gere `mnemonico` para a MAIORIA dos cards (siglas, listas, classificações, distinções, exceções, termos-chave). Só omita os raros sem nada concreto a fixar.');
  }
  if (opts.imagem) {
    linhas.push(
      '- IMAGEM ligada: o usuário PEDIU imagens explicitamente. Para CADA card que receber `mnemonico`, gere TAMBÉM um `mnemonicoSvg` (delegue ao `ankinator-image`): SVG geométrico simples, autocontido, SEM <script> nem URLs externas. NÃO economize nem aplique "parcimônia" — gere imagem para a GRANDE MAIORIA dos cards com mnemônico.',
    );
  }
  linhas.push(
    'Regras de saída (obrigatórias):',
    '- Preserve os ids EXATOS dos cards de entrada.',
    '- NÃO divida cards: 1 card de entrada → 1 card de saída (mesmo id).',
    '- Âncora dura: nenhum fato/número/data/nome fora do material do próprio card.',
    'Retorne APENAS JSON, sem nenhum texto fora dele, no formato:',
    '{"cards":[{"id":"<id>","deck":"<Matéria::Assunto::Subtópico>","tags":["t1","t2"],"mnemonico":"<opcional>","mnemonicoSvg":"<svg opcional>","resposta":"<opcional, só se reescrita>"}]}',
    '',
    'Cards:',
    JSON.stringify(cards, null, 2),
  );
  return linhas.join('\n');
}

/** Extrai o array `cards` do JSON do orquestrador, tolerando cercas ```json e ruído ao redor. */
export function parseOrchestratorCards(text: string): Array<Record<string, unknown>> {
  const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  const slice = start !== -1 && end !== -1 && end > start ? cleaned.slice(start, end + 1) : cleaned;
  let parsed: unknown;
  try {
    parsed = JSON.parse(slice);
  } catch {
    throw new Error('Orquestrador: saída não é JSON válido.');
  }
  const cards = (parsed as { cards?: unknown })?.cards;
  if (!Array.isArray(cards)) throw new Error('Orquestrador: JSON sem array "cards".');
  return cards as Array<Record<string, unknown>>;
}

/**
 * Funde a saída do orquestrador nos cards originais POR ID (nunca posicional — D-02/D-06).
 * O SVG passa pelo MESMO boundary de segurança/qualidade do enrich (sanitizarSvg fail-closed
 * D-08 + avaliarQualidadeSvg). Cards não retornados pelo orquestrador ficam INTACTOS.
 */
export interface MergeOpts {
  classificar?: boolean;
  cardBuilder?: boolean;
  mnemonico?: boolean;
  imagem?: boolean;
  imageQuality?: boolean;
}

/** Quantos campos o orquestrador realmente populou (observabilidade — "fez o trabalho?"). */
export interface MergeStats {
  deck: number;
  tags: number;
  resposta: number;
  mnemonico: number;
  svg: number;
  /** SVGs barrados pelo boundary de segurança/qualidade (não gravados). */
  svgDescartado: number;
}

export function mergeOrchestratorResult(
  questoes: Questao[],
  rawCards: Array<Record<string, unknown>>,
  opts: MergeOpts = {},
): { questoes: Questao[]; aplicados: number; stats: MergeStats } {
  const byId = new Map<string, Record<string, unknown>>();
  for (const rc of rawCards) {
    const id = typeof rc.id === 'string' ? rc.id : undefined;
    if (id) byId.set(id, rc);
  }
  const stats: MergeStats = { deck: 0, tags: 0, resposta: 0, mnemonico: 0, svg: 0, svgDescartado: 0 };
  let aplicados = 0;
  const out = questoes.map((q) => {
    const rc = byId.get(q.id);
    if (!rc) return q;
    aplicados++; // "aplicado" = casou por id (sinal anti-saída-incompatível); o gating abaixo decide os campos.
    const next: Questao = { ...q };
    // PARIDADE com enrichAll: cada campo só é gravado se o ESTÁGIO correspondente está
    // ligado nos toggles. O orquestrador (cujo agente classifica "SEMPRE") pode devolver
    // campos de estágios DESLIGADOS — descartamos para não divergir do pipeline determinístico
    // (achado da revisão adversarial: o merge não pode confiar só na instrução em linguagem natural).
    if (opts.classificar) {
      if (typeof rc.deck === 'string' && rc.deck.trim()) { next.deck = rc.deck.trim(); stats.deck++; }
      if (Array.isArray(rc.tags)) { next.tags = rc.tags.filter((t): t is string => typeof t === 'string'); stats.tags++; }
    }
    if (opts.cardBuilder && typeof rc.resposta === 'string' && rc.resposta.trim()) { next.resposta = rc.resposta; stats.resposta++; }
    if (opts.mnemonico) {
      if (typeof rc.mnemonico === 'string' && rc.mnemonico.trim()) { next.mnemonico = rc.mnemonico; stats.mnemonico++; }
      if (typeof rc.mnemonicoTecnica === 'string' && rc.mnemonicoTecnica.trim()) next.mnemonicoTecnica = rc.mnemonicoTecnica;
    }
    if (opts.imagem && typeof rc.mnemonicoSvg === 'string' && rc.mnemonicoSvg.trim()) {
      const limpo = sanitizarSvg(rc.mnemonicoSvg); // D-08 fail-closed: null se não-SVG/perigoso
      const okQualidade = limpo ? (opts.imageQuality === false ? true : avaliarQualidadeSvg(limpo).ok) : false;
      if (limpo && okQualidade) { next.mnemonicoSvg = limpo; stats.svg++; }
      else stats.svgDescartado++; // veio SVG mas falhou segurança/qualidade
    }
    return next;
  });
  return { questoes: out, aplicados, stats };
}

/**
 * Enriquecimento ORQUESTRADO: 1 chamada `claude -p --agent` que decide por-card e delega
 * aos subagents via Task; o resultado é fundido por id nos cards. Lança em falha (→ fallback).
 * `runOrchestrator` é injetável p/ teste CLI-free.
 */
export async function orchestratedEnrichAll(
  questoes: Questao[],
  opts: EnrichOpts,
  onProgress?: (e: EnrichProgress) => void,
  runOrchestrator: typeof runOrchestratorCli = runOrchestratorCli,
): Promise<Questao[]> {
  log.info('orquestrador', `enriquecimento orquestrado START (${questoes.length} cards)`, { cards: questoes.length });
  const fim = timer('orquestrador', 'enriquecimento orquestrado');
  // Progresso coarse: o orquestrador faz tudo numa interação; 'classificando' é o 1º estágio
  // que ele sempre roda (deck-classifier SEMPRE). Evita tocar o tipo EnrichProgress (web).
  onProgress?.({ estagio: 'classificando', index: 0, total: 1 });

  const userMessage = buildOrchestratorMessage(questoes, opts);
  const text = await runOrchestrator({ userMessage });
  const rawCards = parseOrchestratorCards(text);
  const { questoes: merged, aplicados, stats } = mergeOrchestratorResult(questoes, rawCards, {
    // gating por estágio = paridade com enrichAll (achado da revisão adversarial)
    classificar: opts.classificar,
    cardBuilder: opts.cardBuilder,
    mnemonico: opts.mnemonico,
    imagem: opts.imagem,
    imageQuality: opts.imageQuality,
  });
  if (aplicados === 0) {
    fim({ aplicados: 0 });
    throw new Error('Orquestrador: nenhum card correspondeu por id (saída incompatível).');
  }
  // Stats POR CAMPO (observabilidade): revela se o orquestrador de fato populou
  // mnemônico/SVG ou só deck/tags (achado da validação ao vivo: custo baixo sugeria poucos SVGs).
  log.info('orquestrador', `enriquecimento orquestrado END: ${aplicados}/${questoes.length} card(s) enriquecido(s)`, {
    aplicados,
    total: questoes.length,
    deck: stats.deck,
    tags: stats.tags,
    resposta: stats.resposta,
    mnemonico: stats.mnemonico,
    svg: stats.svg,
    svgDescartado: stats.svgDescartado,
  });
  fim({ aplicados });
  return merged;
}

export interface RunEnrichDeps {
  orchestrate?: typeof orchestratedEnrichAll;
  enrich?: typeof enrichAll;
  /** Precondição de segurança (injetável p/ teste); default workersToolRestricted. */
  precheck?: typeof workersToolRestricted;
}

/**
 * Dispatcher do enriquecimento (Destino #4). Roda o caminho ORQUESTRADO quando
 * `opts.orchestrated` (env `ANKINATOR_ORCHESTRATED`) está ligado E o agente é descobrível;
 * em QUALQUER falha cai DETERMINISTICAMENTE para `enrichAll`. Com `orchestrated` OFF (default)
 * é byte-equivalente a `enrichAll` (guards SPEC-01/PIPE-03 intactos). Deps injetáveis p/ teste.
 */
export async function runEnrich(
  questoes: Questao[],
  opts: EnrichOpts,
  onProgress?: (e: EnrichProgress) => void,
  deps: RunEnrichDeps = {},
): Promise<Questao[]> {
  const enrich = deps.enrich ?? enrichAll;
  if (!opts.orchestrated) return enrich(questoes, opts, onProgress);

  if (!orchestratorAgentDisponivel()) {
    log.warn('orquestrador', 'agente .claude/agents/ankinator-orchestrator.md não encontrado — fallback p/ enrichAll determinístico');
    return enrich(questoes, opts, onProgress);
  }
  // PRECONDIÇÃO DE SEGURANÇA (revisão adversarial): só roda o caminho privilegiado se os
  // workers acionados via Task estiverem tool-restritos no frontmatter; senão, fallback seguro.
  const precheck = deps.precheck ?? workersToolRestricted;
  const restr = precheck();
  if (!restr.ok) {
    log.warn(
      'orquestrador',
      `modo orquestrado DESABILITADO por segurança: subagent(s) sem restrição de tools no frontmatter (${restr.faltando.join(', ')}). Adicione "tools: []" a cada um em .claude/agents/. Fallback p/ enrichAll.`,
    );
    return enrich(questoes, opts, onProgress);
  }
  const orchestrate = deps.orchestrate ?? orchestratedEnrichAll;
  try {
    // HÍBRIDO (escolha do usuário): o orquestrador faz deck/tags/cardBuilder/mnemônico (rápido,
    // ~9min); a IMAGEM vai pelo estágio determinístico PARALELO (pool, confiável). Gerar ~50 SVGs
    // dentro do call único do orquestrador estourava o timeout de 10min (validação ao vivo 2026-06-05).
    const resultadoOrq = await orchestrate(questoes, { ...opts, imagem: false }, onProgress);
    if (!opts.imagem) return resultadoOrq;
    // só o estágio de imagem do enrichAll (gated por q.mnemonico que o orquestrador populou)
    return await enrich(resultadoOrq, { ...opts, classificar: false, cardBuilder: false, mnemonico: false, imagem: true }, onProgress);
  } catch (e) {
    log.warn('orquestrador', `falhou — fallback p/ enrichAll determinístico: ${e instanceof Error ? e.message : String(e)}`);
    return enrich(questoes, opts, onProgress);
  }
}
