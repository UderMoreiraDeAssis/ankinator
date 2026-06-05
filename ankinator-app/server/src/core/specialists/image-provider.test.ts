/**
 * Testes unit — image-provider.ts (SvgClaudeImageProvider).
 *
 * Foco: garantir que a geração de SVG desativa o extended thinking (disableThinking: true).
 * Causa do bug RT (2026-06-04): gerar SVG dispara extended thinking; o modelo ruminava
 * >180s sem emitir markup e estourava o timeout do runner. O corte do thinking derruba a
 * chamada de >180s (timeout) para ~27s (sucesso). Este teste trava a fiação no site do bug.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./runner.js', () => ({
  runClaudeCli: vi.fn(),
}));

vi.mock('./prompt-loader.js', () => ({
  loadPrompt: vi.fn((nome: string) => `PROMPT:${nome}`),
}));

import { runClaudeCli } from './runner.js';
import { loadPrompt } from './prompt-loader.js';
import { createImageProvider, SvgClaudeImageProvider } from './image-provider.js';

describe('SvgClaudeImageProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(runClaudeCli).mockResolvedValue('<svg viewBox="0 0 10 10"><rect/></svg>');
  });

  it('desativa extended thinking ao gerar SVG (disableThinking: true) — bug RT', async () => {
    const provider = createImageProvider();
    await provider.generate('CRUD = Create, Read, Update, Delete', 'operações de banco');

    expect(vi.mocked(runClaudeCli)).toHaveBeenCalledWith(
      expect.objectContaining({ disableThinking: true })
    );
  });

  it('usa o prompt canônico mnemonic-image como systemPrompt', async () => {
    const provider = new SvgClaudeImageProvider();
    await provider.generate('m', 'c');

    expect(vi.mocked(loadPrompt)).toHaveBeenCalledWith('mnemonic-image');
    expect(vi.mocked(runClaudeCli)).toHaveBeenCalledWith(
      expect.objectContaining({ systemPrompt: 'PROMPT:mnemonic-image' })
    );
  });

  it('passa mnemônico e contexto no userMessage (Pitfall 5 — ambos usados)', async () => {
    const provider = new SvgClaudeImageProvider();
    await provider.generate('MNEM-XYZ', 'CTX-ABC');

    const call = vi.mocked(runClaudeCli).mock.calls[0][0];
    expect(call.userMessage).toContain('MNEM-XYZ');
    expect(call.userMessage).toContain('CTX-ABC');
  });

  it('retorna o SVG cru do runner (sanitização é responsabilidade do estágio)', async () => {
    const provider = new SvgClaudeImageProvider();
    const { svg } = await provider.generate('m', 'c');
    expect(svg).toBe('<svg viewBox="0 0 10 10"><rect/></svg>');
  });
});
