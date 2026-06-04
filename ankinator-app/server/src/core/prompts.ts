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
  opts: GenerateOptions
): string {
  const modos: string[] = [];
  if (opts.incluirExtraidas !== false) modos.push('EXTRAIR questões de prova já presentes no trecho');
  if (opts.incluirCriadas !== false) modos.push('CRIAR novas questões de estudo a partir dos conceitos');
  const max = opts.maxPerChunk ?? 15;
  const titulo = sectionTitles.length ? `Seção(ões): ${sectionTitles.join(' › ')}\n\n` : '';

  return `${titulo}Objetivo neste trecho: ${modos.join(' e ')}.
Gere no máximo ${max} questões no total (priorize qualidade e cobertura dos conceitos centrais).

TRECHO DO MATERIAL:
"""
${chunkMarkdown}
"""`;
}
