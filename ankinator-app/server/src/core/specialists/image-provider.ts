/**
 * Interface `ImageProvider` + implementação `svg-claude` (SPEC-04).
 *
 * `SvgClaudeImageProvider` é funcional e está plugada no pipeline de enriquecimento
 * via `enrichAll()` (estágio 4). Invocada quando `opts.imagem=true` e o card possui
 * `q.mnemonico` (gate D-04). Usa o runner compartilhado e o prompt `mnemonic-image`.
 *
 * NÃO há provider raster (D-09): apenas SVG. A interface está pronta para que um
 * provider raster futuro (IMGR-01 v2) seja registrado atrás dela.
 *
 * Vive 100% no server (D-08): geração de SVG = chamada de LLM via assinatura,
 * exclusivamente no backend (o browser não tem credenciais nem FS).
 */
import { runClaudeCli } from './runner.js';
import { loadPrompt } from './prompt-loader.js';

/** Provedor de imagem de mnemônico. Retorna SVG autocontido (D-08). */
export interface ImageProvider {
  readonly nome: string;
  /**
   * Gera uma imagem (SVG) que reforça visualmente `mnemonic`, usando `context`
   * (o conteúdo do card) para manter fidelidade ao material.
   *
   * @param feedback  Motivos pelos quais o SVG ANTERIOR foi reprovado no controle de
   *                  qualidade (svg-quality). Quando presente, são injetados no prompt
   *                  para a re-tentativa corrigir os defeitos (texto sobreposto, fonte
   *                  estourando, etc.). Ausente/vazio na primeira tentativa.
   */
  generate(mnemonic: string, context: string, feedback?: string[]): Promise<{ svg: string }>;
}

/**
 * Implementação default: gera o SVG via assinatura Claude (sem custo por token),
 * reusando o runner compartilhado (`runClaudeCli`) e o prompt canônico
 * `mnemonic-image` (fonte única — `prompts/mnemonic-image.md`).
 */
export class SvgClaudeImageProvider implements ImageProvider {
  readonly nome = 'svg-claude';

  async generate(mnemonic: string, context: string, feedback?: string[]): Promise<{ svg: string }> {
    const systemPrompt = loadPrompt('mnemonic-image');
    // Usa AMBOS os parâmetros (Pitfall 5: sem parâmetro não usado) — o mnemônico
    // é o quê ilustrar, o contexto mantém a imagem fiel ao material do card.
    let userMessage = `Mnemônico:\n${mnemonic}\n\nContexto do card:\n${context}`;
    // Re-tentativa guiada: o SVG anterior reprovou no controle de qualidade. Injeta os
    // motivos para o modelo corrigir os defeitos concretos (sobreposição/fonte/overflow).
    if (feedback && feedback.length > 0) {
      userMessage +=
        `\n\nATENÇÃO: o SVG que você gerou antes foi REPROVADO no controle de qualidade ` +
        `pelos motivos abaixo. Gere um SVG NOVO que corrija TODOS eles:\n- ${feedback.join('\n- ')}`;
    }
    // disableThinking: gerar SVG é tarefa criativa aberta que dispara extended thinking —
    // o modelo ruminava >180s e estourava o timeout (bug RT 2026-06-04). O SVG é saída
    // estruturada e não precisa de thinking; com ele off a chamada completa em ~27s.
    const svg = await runClaudeCli({ systemPrompt, userMessage, disableThinking: true, stage: 'imagem' });
    // Retorna o SVG cru. A sanitização acontece no estágio imagem do enrichAll (separação de
    // responsabilidades — o provider apenas gera; o estágio decide o que fazer com o resultado).
    return { svg };
  }
}

/**
 * Factory do provider de imagem. Retorna `svg-claude` por default, espelhando
 * o shape de `createProvider()` (providers/index.ts — default no fim).
 */
export function createImageProvider(): ImageProvider {
  // TODO(v2): selecionar provider raster por env quando IMGR-01 existir.
  return new SvgClaudeImageProvider();
}
