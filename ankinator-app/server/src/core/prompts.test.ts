/**
 * Testes — selectSystemFidelity (Phase 7 / QUAL-01: fidelidade diferenciada por tipo).
 *
 * Trava DUAS garantias:
 *  1. Regressão: o caminho default (knob OFF) é o `SYSTEM_FIDELITY` BYTE-IDÊNTICO — qualquer
 *     edição que mude o default é detectada aqui (o guard SPEC-01 também depende disso).
 *  2. Contrato da variante: a [EXTRAÍDA] mantém FIDELIDADE TOTAL, a [CRIADA] é afrouxada
 *     (reformular/atomizar/discriminar/aplicar por inferência DIRETA) e a ÂNCORA DURA de
 *     segurança (zero conhecimento externo; nada inventado) vale para AMBAS. Um futuro edit
 *     que remova a âncora ou afrouxe a [EXTRAÍDA] reprova aqui.
 */
import { describe, it, expect } from 'vitest';
import { selectSystemFidelity, SYSTEM_FIDELITY, SYSTEM_FIDELITY_CRIADA_LIVRE } from './prompts.js';

describe('selectSystemFidelity', () => {
  it('default (OFF) é SYSTEM_FIDELITY byte-idêntico — zero regressão / guard SPEC-01', () => {
    expect(selectSystemFidelity(false)).toBe(SYSTEM_FIDELITY);
  });

  it('ligado (ON) seleciona a variante de fidelidade diferenciada', () => {
    expect(selectSystemFidelity(true)).toBe(SYSTEM_FIDELITY_CRIADA_LIVRE);
  });

  it('a variante é DIFERENTE do default (afrouxa de fato)', () => {
    expect(SYSTEM_FIDELITY_CRIADA_LIVRE).not.toBe(SYSTEM_FIDELITY);
  });
});

describe('SYSTEM_FIDELITY_CRIADA_LIVRE — contrato', () => {
  it('mantém a [EXTRAÍDA] com fidelidade total', () => {
    expect(SYSTEM_FIDELITY_CRIADA_LIVRE).toContain('[EXTRAÍDA]');
    expect(SYSTEM_FIDELITY_CRIADA_LIVRE).toContain('FIDELIDADE TOTAL');
    expect(SYSTEM_FIDELITY_CRIADA_LIVRE).toContain('terminologia EXATA');
    // alternativas de múltipla escolha continuam OBRIGATÓRIAS (regressão da RT-fidelidade)
    expect(SYSTEM_FIDELITY_CRIADA_LIVRE).toContain('TODAS as alternativas');
  });

  it('afrouxa a [CRIADA]: reformular/atomizar/discriminar/aplicar, sem colar o enunciado', () => {
    expect(SYSTEM_FIDELITY_CRIADA_LIVRE).toContain('[CRIADA]');
    expect(SYSTEM_FIDELITY_CRIADA_LIVRE).toContain('NÃO cole o enunciado');
    expect(SYSTEM_FIDELITY_CRIADA_LIVRE).toContain('ATÔMICAS');
    expect(SYSTEM_FIDELITY_CRIADA_LIVRE).toContain('DISCRIMINAÇÃO');
    expect(SYSTEM_FIDELITY_CRIADA_LIVRE).toContain('APLICAÇÃO');
    expect(SYSTEM_FIDELITY_CRIADA_LIVRE).toContain('inferência DIRETA');
  });

  it('preserva a ÂNCORA DURA de segurança para AMBAS (não alucina)', () => {
    expect(SYSTEM_FIDELITY_CRIADA_LIVRE).toContain('ÂNCORA DE SEGURANÇA');
    expect(SYSTEM_FIDELITY_CRIADA_LIVRE).toContain('conhecimento externo');
    expect(SYSTEM_FIDELITY_CRIADA_LIVRE).toContain('ANCORADOS no trecho');
    expect(SYSTEM_FIDELITY_CRIADA_LIVRE).toContain('Risco crítico');
    // a [CRIADA] não pode introduzir fatos/números que o trecho não dê
    expect(SYSTEM_FIDELITY_CRIADA_LIVRE).toContain('NUNCA introduza fatos');
    // reforço anti-leak (sessão o, validação medir-c): mecanismos/siglas/exemplos externos
    // são proibidos mesmo quando corretos no mundo real (fecha o leak #45 "write-ahead log").
    expect(SYSTEM_FIDELITY_CRIADA_LIVRE).toContain('MECANISMOS');
    expect(SYSTEM_FIDELITY_CRIADA_LIVRE).toContain('AINDA QUE seja correto no mundo real');
  });
});
