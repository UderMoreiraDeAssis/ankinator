/**
 * Configuração do servidor, carregada de variáveis de ambiente.
 * Tenta carregar .env do diretório do app e do servidor (best-effort).
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
for (const envPath of [
  path.resolve(here, '../../.env'), // ankinator-app/.env
  path.resolve(here, '../.env'), // server/.env
]) {
  try {
    // Node 22+/24: carrega variáveis sem sobrescrever as já definidas
    process.loadEnvFile(envPath);
  } catch {
    /* arquivo ausente: ignora */
  }
}

type ProviderKind = 'cli' | 'api';

const providerEnv = (process.env.ANKINATOR_PROVIDER?.trim().toLowerCase() as ProviderKind) || 'cli';

/**
 * Loader de PDF: 'node' (padrão — @opendataloader/pdf via Java) ou 'langchain'
 * (opt-in — sidecar Python via langchain-opendataloader-pdf).
 * ANKINATOR_PDF_LOADER=node|langchain (default: 'node' — D-03, D-15)
 */
type PdfLoaderKind = 'node' | 'langchain';

const pdfLoaderEnv = (process.env.ANKINATOR_PDF_LOADER?.trim().toLowerCase() as PdfLoaderKind) || 'node';

export const config = {
  port: Number(process.env.PORT) || 8787,
  anthropicKey: process.env.ANTHROPIC_API_KEY?.trim() || '',
  /** Provedor de geração: 'cli' (assinatura, padrão) ou 'api' (key, por token). */
  provider: providerEnv === 'api' ? 'api' : ('cli' as ProviderKind),
  /** Modelo para a API (id completo). */
  model: process.env.ANKINATOR_MODEL?.trim() || 'claude-sonnet-4-6',
  /** Modelo para o CLI (alias 'sonnet'/'opus' ou id completo). */
  cliModel: process.env.ANKINATOR_CLI_MODEL?.trim() || 'sonnet',
  /**
   * Desliga o extended thinking NA GERAÇÃO de questões (CliProvider) injetando
   * MAX_THINKING_TOKENS=0 no env do spawn — espelha o que os 4 especialistas de
   * enrich já fazem (RT-imagem). Validação ao vivo 2026-06-05 mostrou a geração
   * com thinking LIGADO consumindo ~10min/26% do custo do job. Default OFF
   * (comportamento atual preservado, zero risco de regressão de qualidade);
   * ANKINATOR_GENERATION_DISABLE_THINKING=1|true|on liga (mais rápido/barato,
   * com possível custo de qualidade nas questões — medir antes de adotar).
   */
  generationDisableThinking: ['1', 'true', 'on', 'yes'].includes(
    (process.env.ANKINATOR_GENERATION_DISABLE_THINKING ?? '').trim().toLowerCase(),
  ),
  /**
   * Fidelidade DIFERENCIADA por tipo na geração (Phase 7 / QUAL-01). O system prompt afrouxa SÓ as
   * questões [CRIADA] (reformular/atomizar/discriminar/aplicar por inferência DIRETA do trecho),
   * mantendo [EXTRAÍDA] com fidelidade total e a ÂNCORA DURA p/ ambas (zero conhecimento externo;
   * números/datas/nomes/gabaritos só do trecho). Endereça o Destino #1 / UAT 2026-06-04 (questão
   * criada "colada crua").
   *
   * DEFAULT ON desde 2026-06-05 (sessão o): VALIDADO AO VIVO — 47 [CRIADA] lidas do Anki, atomicidade
   * forte e âncora verificada contra o PDF-fonte (46–47/47 ancoradas, zero alucinação perigosa).
   * Escape para o comportamento estrito legado (SYSTEM_FIDELITY byte-idêntico, guard SPEC-01 intacto):
   * ANKINATOR_CRIADA_FIDELITY=estrita|estrito|strict|0|false|off|no. Vazio ou qualquer outro valor = livre.
   */
  criadaFidelityLivre: !['estrita', 'estrito', 'strict', '0', 'false', 'off', 'no'].includes(
    (process.env.ANKINATOR_CRIADA_FIDELITY ?? '').trim().toLowerCase(),
  ),
  ankiconnectUrl: process.env.ANKICONNECT_URL?.trim() || 'http://127.0.0.1:8765',
  /**
   * Concorrência do estágio de geração de imagem SVG (pool em enrichAll — estágio 4).
   * ANKINATOR_IMAGE_CONCURRENCY (default 3). Suba com cautela: chamadas `claude`
   * simultâneas demais podem esbarrar na quota/rate-limit da assinatura.
   */
  imageConcurrency: Math.max(1, Number(process.env.ANKINATOR_IMAGE_CONCURRENCY) || 3),
  /**
   * Gestor de qualidade do SVG de mnemônico (estágio 4). Quando ligado, cada SVG passa
   * por `avaliarQualidadeSvg` (render-free) DEPOIS da sanitização: barra lixo visual
   * (texto sobreposto, fonte estourando a moldura, nuvem de palavras). Reprovado →
   * re-tentativa guiada (até imageMaxRetry); persistindo a reprovação → descarta a imagem
   * (card fica só com o mnemônico em texto). Default LIGADO; ANKINATOR_IMAGE_QUALITY=off desliga.
   */
  imageQuality: (process.env.ANKINATOR_IMAGE_QUALITY?.trim().toLowerCase() ?? '') !== 'off',
  /**
   * Máximo de re-tentativas guiadas do estágio imagem quando o SVG reprova no controle
   * de qualidade. ANKINATOR_IMAGE_MAX_RETRY (default 1; 0 = sem retry, reprova → descarta).
   * Cada retry é 1 chamada `claude` extra SÓ para os cards que reprovaram.
   */
  imageMaxRetry: Math.max(0, Number(process.env.ANKINATOR_IMAGE_MAX_RETRY ?? 1)),
  /**
   * Concorrência do estágio card-builder (pool em enrichAll — estágio 2).
   * ANKINATOR_CARDBUILDER_CONCURRENCY (default 3). Mesma cautela de quota do estágio imagem.
   */
  cardBuilderConcurrency: Math.max(1, Number(process.env.ANKINATOR_CARDBUILDER_CONCURRENCY) || 3),
  /**
   * Imagem SELETIVA (custo): quando ligado, o estágio 4 só gera SVG para mnemônicos
   * VISUAIS (loci/acrônimo) e de técnica desconhecida — pula os puramente verbais
   * (ver imageSkipTecnicas). A imagem é ~42% do custo do job e o mnemônico foi
   * liberalizado p/ a maioria dos cards. Default OFF (byte-idêntico ao legado);
   * ANKINATOR_IMAGE_SELECTIVE=1|true|on liga.
   */
  imageSelective: ['1', 'true', 'on', 'yes'].includes(
    (process.env.ANKINATOR_IMAGE_SELECTIVE ?? '').trim().toLowerCase(),
  ),
  /**
   * Técnicas de mnemônico VERBAIS que, sob imageSelective, NÃO recebem SVG.
   * ANKINATOR_IMAGE_SKIP_TECNICAS (csv; default 'história,rima'). Comparação
   * acento-insensível. Vazio na env → usa o default do enrich (não desliga a seletividade).
   */
  imageSkipTecnicas: (process.env.ANKINATOR_IMAGE_SKIP_TECNICAS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  /**
   * Teto do split 1→N do card-builder ('criada'). Trava a explosão de cards (run ao vivo:
   * 41→58), que cascateia custo nos estágios seguintes (mnemônico/imagem por-card).
   * ANKINATOR_CARDBUILDER_MAX_SPLIT (default 0 = ilimitado, byte-idêntico ao legado).
   */
  cardBuilderMaxSplit: Math.max(0, Number(process.env.ANKINATOR_CARDBUILDER_MAX_SPLIT) || 0),
  /**
   * Sobreposição entre blocos: nº de caracteres da cauda do bloco anterior anexados
   * como CONTEXTO (não como fonte de questões). ANKINATOR_CHUNK_OVERLAP (default 400; 0 desliga).
   */
  chunkOverlap: Math.max(0, Number(process.env.ANKINATOR_CHUNK_OVERLAP) || 400),
  /**
   * Loader de PDF selecionado: 'node' (padrão, D-03) ou 'langchain' (opt-in).
   * Controlado por ANKINATOR_PDF_LOADER=node|langchain.
   * Default 'node' é CRÍTICO para D-15: env unset → modo Node, sem Python/Java LangChain.
   */
  pdfLoader: pdfLoaderEnv === 'langchain' ? 'langchain' : ('node' as PdfLoaderKind),
  /**
   * Interpretador Python para o sidecar LangChain (D-02).
   * ANKINATOR_LANGCHAIN_PYTHON — interpretador do venv langchain dedicado (requer Java 11+ no PATH).
   * Fallback: ODL_PYTHON (compatibilidade com sidecar OCR da Phase 1).
   * Vazio ('') quando nenhuma var está definida — isLangchainAvailable() retornará false.
   *
   * Setup do sidecar LangChain (RT-05):
   *   1. Criar venv: python3 -m venv ~/.venvs/odl
   *   2. Instalar:   ~/.venvs/odl/bin/pip install langchain-opendataloader-pdf
   *   3. Definir:    ODL_PYTHON=~/.venvs/odl/bin/python3  (no .env ou shell)
   *   Requer também Java 11+ no PATH.
   */
  langchainPython: process.env.ANKINATOR_LANGCHAIN_PYTHON?.trim() || process.env.ODL_PYTHON?.trim() || '',
  hasApiKey(): boolean {
    return this.anthropicKey.length > 0;
  },
  /** A geração está disponível? (cli sempre; api só com key) */
  canGenerate(): boolean {
    return this.provider === 'cli' || this.hasApiKey();
  },
};
