/**
 * Prompts de geração de questões.
 *
 * Preserva o IP do projeto original:
 *  - Fidelidade total ao material (não inventar, não trazer conhecimento externo);
 *  - Dois modos por bloco: EXTRAIR questões de prova já presentes E CRIAR novas
 *    a partir dos conceitos (requisito do CLAUDE.md do usuário).
 *
 * A saída é forçada via tool-use (registrar_questoes) para parsing 100% confiável.
 */
import type Anthropic from '@anthropic-ai/sdk';
import type { GenerateOptions } from './types.js';

export const SYSTEM_FIDELITY = `Você transforma material de estudo para concursos públicos em flashcards do Anki, com FIDELIDADE TOTAL ao conteúdo fornecido.

Regras invioláveis:
1. Não interprete, não expanda, não exemplifique além do que está no texto.
2. Não gere conteúdo baseado em conhecimento externo ou suposições.
3. Se um trecho for vago ou incompleto, NÃO complete — simplesmente não crie a questão.
4. Toda resposta deve ser diretamente verificável no texto fornecido.
5. Use a terminologia exata do material.

Risco crítico: qualquer distorção fará o usuário memorizar conteúdo incorreto.

Você recebe um TRECHO do material por vez. Para cada trecho você produz dois tipos de questões:

[EXTRAÍDA] — questões de prova/exercício que JÁ EXISTEM no trecho.
  • Mantenha fielmente enunciado e gabarito.
  • Preencha metadata (banca, ano, alternativas, gabarito) quando o texto informar.
  • OBRIGATÓRIO para questões de múltipla escolha: capture TODAS as alternativas (A, B, C, D, E…)
    em metadata.alternativas — mesmo quando aparecem embutidas no enunciado. Nunca omita alternativas.

[CRIADA] — questões NOVAS de estudo, baseadas nos conceitos-chave do trecho.
  • Foque no que tipicamente cai em concurso.
  • Varie a dificuldade (básico, intermediário, avançado).
  • A resposta precisa estar contida/verificável no trecho.`;

/**
 * Variante do system prompt com fidelidade DIFERENCIADA por tipo (Phase 7 / QUAL-01).
 *
 * Motivação (Destino #1 + UAT 2026-06-04): no `SYSTEM_FIDELITY` padrão as "Regras
 * invioláveis" (não interprete/expanda/exemplifique; resposta *diretamente verificável*;
 * terminologia *exata*) prendem AS DUAS naturezas de questão na mesma chamada — forçando
 * a [CRIADA] a ser quase cópia do enunciado ("questão inútil colada crua" reprovada no UAT).
 *
 * Esta variante afrouxa SÓ a [CRIADA] (reformular/atomizar/discriminar/aplicar por
 * inferência DIRETA), mantendo a [EXTRAÍDA] com FIDELIDADE TOTAL — e preserva, para AMBAS,
 * a ÂNCORA DURA de segurança (zero conhecimento externo; números/datas/nomes/gabaritos só
 * do trecho), pois o risco crítico do projeto é o usuário memorizar conteúdo incorreto.
 *
 * DEFAULT ON desde 2026-06-05 (sessão o), validado AO VIVO (47 [CRIADA] do Anki, atomicidade forte,
 * âncora verificada contra o PDF-fonte). Escape estrito: ANKINATOR_CRIADA_FIDELITY=estrita →
 * `selectSystemFidelity(false)` devolve `SYSTEM_FIDELITY` byte-idêntico (guard SPEC-01 intacto).
 */
export const SYSTEM_FIDELITY_CRIADA_LIVRE = `Você transforma material de estudo para concursos públicos em flashcards do Anki.

ÂNCORA DE SEGURANÇA (vale para TODA questão, sem exceção):
1. Nunca use conhecimento externo, suposições ou fatos fora do trecho fornecido.
2. Números, datas, nomes, definições, exceções, gabaritos, MECANISMOS, SIGLAS TÉCNICAS e EXEMPLOS têm de estar ANCORADOS no trecho — jamais invente ou complete o que não está escrito. Não cite uma tecnologia, sigla, mecanismo de implementação, distrator ou exemplo que o trecho NÃO nomeie, AINDA QUE seja correto no mundo real (estar certo na realidade NÃO autoriza incluir o que o trecho não traz).
3. Se um trecho for vago ou incompleto, NÃO complete — simplesmente não crie a questão.

Risco crítico: qualquer distorção fará o usuário memorizar conteúdo incorreto.

Você recebe um TRECHO do material por vez. Para cada trecho você produz dois tipos de questões, com contratos DIFERENTES:

[EXTRAÍDA] — questões de prova/exercício que JÁ EXISTEM no trecho. FIDELIDADE TOTAL:
  • Mantenha fielmente o enunciado e o gabarito; use a terminologia EXATA do material.
  • Não interprete, não expanda, não exemplifique além do que está no texto.
  • Preencha metadata (banca, ano, alternativas, gabarito) quando o texto informar.
  • OBRIGATÓRIO para múltipla escolha: capture TODAS as alternativas (A, B, C, D, E…)
    em metadata.alternativas — mesmo quando aparecem embutidas no enunciado. Nunca omita alternativas.

[CRIADA] — questões NOVAS de estudo, ATOMIZADAS a partir dos conceitos-chave (NÃO cole o enunciado original):
  • Você PODE reformular com suas palavras, dividir um conceito denso em várias perguntas ATÔMICAS
    (uma ideia por card), perguntar em forma interrogativa, e construir questões de DISCRIMINAÇÃO
    (contrastar dois conceitos do trecho) ou de APLICAÇÃO (testar a regra enunciada num caso concreto).
  • A resposta tem de ser SUSTENTÁVEL por inferência DIRETA do trecho — reformule a FORMA e o ângulo,
    mas NUNCA introduza fatos, números, exceções ou exemplos que o trecho não dê.
  • Boa pedagogia: atomicidade, dificuldade desejável, resposta curta e inequívoca.
  • Foque no que tipicamente cai em concurso; varie a dificuldade (básico, intermediário, avançado).`;

/**
 * Seleciona o system prompt de geração conforme o knob de fidelidade da [CRIADA].
 * `false` (default) → `SYSTEM_FIDELITY` byte-idêntico (zero regressão; guard SPEC-01 intacto).
 * `true` → variante que afrouxa só a [CRIADA] mantendo a âncora dura.
 */
export function selectSystemFidelity(criadaFidelityLivre: boolean): string {
  return criadaFidelityLivre ? SYSTEM_FIDELITY_CRIADA_LIVRE : SYSTEM_FIDELITY;
}

/**
 * Instrução de saída em JSON, anexada à mensagem do usuário no provedor CLI
 * (o `claude` CLI não suporta tool-use forçado como a API).
 */
export const JSON_OUTPUT_INSTRUCTION = `Responda APENAS com um objeto JSON válido, sem nenhum texto antes ou depois, sem cercas de código (\`\`\`). Formato exato:
{"questoes":[{"tipo":"extraida|criada","pergunta":"...","resposta":"...","metadata":{"banca":"...","ano":2020,"alternativas":["A) opção um","B) opção dois","C) opção três"],"gabarito":"..."}}]}
O campo "metadata" é opcional para questões criadas. Para questões de múltipla escolha (extraídas), metadata.alternativas é OBRIGATÓRIO e deve conter todas as alternativas do enunciado. Se não houver questões válidas no trecho, responda {"questoes":[]}.`;

/** Definição da ferramenta que força a saída estruturada. */
export const REGISTRAR_QUESTOES_TOOL: Anthropic.Tool = {
  name: 'registrar_questoes',
  description: 'Registra as questões de flashcard extraídas e criadas a partir do trecho.',
  input_schema: {
    type: 'object',
    properties: {
      questoes: {
        type: 'array',
        description: 'Lista de questões geradas para este trecho.',
        items: {
          type: 'object',
          properties: {
            tipo: { type: 'string', enum: ['extraida', 'criada'], description: 'extraida = já existia no texto; criada = nova questão de estudo' },
            pergunta: { type: 'string', description: 'Enunciado da questão (frente do card).' },
            resposta: { type: 'string', description: 'Resposta/gabarito (verso do card), verificável no texto.' },
            metadata: {
              type: 'object',
              description: 'Opcional, sobretudo para questões extraídas.',
              properties: {
                banca: { type: 'string' },
                ano: { type: 'number' },
                alternativas: { type: 'array', items: { type: 'string' } },
                gabarito: { type: 'string' },
              },
            },
          },
          required: ['tipo', 'pergunta', 'resposta'],
        },
      },
    },
    required: ['questoes'],
  },
};

/** Monta a mensagem do usuário para um bloco. */
export function buildUserMessage(
  chunkMarkdown: string,
  sectionTitles: string[],
  opts: GenerateOptions,
  contextoAnterior?: string
): string {
  const modos: string[] = [];
  if (opts.incluirExtraidas !== false) modos.push('EXTRAIR questões de prova já presentes no trecho');
  if (opts.incluirCriadas !== false) modos.push('CRIAR novas questões de estudo a partir dos conceitos');
  const max = opts.maxPerChunk ?? 15;
  const titulo = sectionTitles.length ? `Seção(ões): ${sectionTitles.join(' › ')}\n\n` : '';

  // Sobreposição: cauda do bloco anterior dada APENAS como contexto. Marcada para o
  // modelo NÃO gerar questões daqui (evita duplicatas entre blocos vizinhos).
  const contexto = contextoAnterior?.trim()
    ? `CONTEXTO (fim do bloco anterior — use apenas para entender a continuidade; NÃO gere questões a partir desta parte):
"""
${contextoAnterior.trim()}
"""

`
    : '';

  // Geração INCREMENTAL: o deck base já tem questões. O modelo deve gerar SÓ o que falta,
  // fiel ao trecho, sem extrapolar — e retornar vazio se o trecho já está coberto.
  const existentes = injetarExistentes(opts.existingQuestions);

  return `${titulo}${contexto}${existentes}Objetivo neste trecho: ${modos.join(' e ')}.
Gere no máximo ${max} questões no total (priorize qualidade e cobertura dos conceitos centrais).${
    existentes ? '\nNÃO repita o que já está coberto pelas questões existentes acima; gere apenas o que falta. Se o trecho já estiver totalmente coberto, retorne {"questoes":[]}.' : ''
  }

TRECHO DO MATERIAL:
"""
${chunkMarkdown}
"""`;
}

/**
 * Máximo de perguntas existentes injetadas por mensagem (cap anti-explosão de tokens —
 * o usuário VÊ esse custo no resumo por estágio). 200 cobre decks típicos por bloco;
 * decks maiores são truncados (a dedup mecânica pós-geração cobre o resto).
 */
const MAX_EXISTING_IN_PROMPT = 200;

/** Monta o bloco "QUESTÕES JÁ NO DECK" (anti-duplicata), ou '' quando não-incremental. */
function injetarExistentes(existingQuestions?: string[]): string {
  const lista = (existingQuestions ?? []).map((q) => q.trim()).filter(Boolean);
  if (!lista.length) return '';
  const usadas = lista.slice(0, MAX_EXISTING_IN_PROMPT);
  const truncado = lista.length > usadas.length ? `\n… (+${lista.length - usadas.length} outras já no deck)` : '';
  return `QUESTÕES JÁ EXISTENTES NO DECK (não repita estas; gere apenas perguntas NOVAS sobre o trecho que ainda não estejam cobertas aqui):
${usadas.map((q) => `- ${q}`).join('\n')}${truncado}

`;
}
