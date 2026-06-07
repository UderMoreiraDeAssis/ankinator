/**
 * Testes do runner ORQUESTRADO (Destino #4 / Phase 5). Tudo CLI-free:
 *  - plano de spawn (puro, assertável como buildSpawnArgs / guard SPEC-01);
 *  - parser tolerante da saída do orquestrador;
 *  - merge POR ID + boundary de segurança/qualidade do SVG;
 *  - dispatcher runEnrich: OFF = enrichAll; ON+falha = fallback determinístico (deps injetadas).
 */
import { describe, it, expect, vi } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Questao } from '../types.js';
import type { EnrichOpts } from './enrich.js';
import {
  buildOrchestratorSpawnArgs,
  buildOrchestratorMessage,
  resolveProjectRoot,
  parseOrchestratorCards,
  mergeOrchestratorResult,
  orchestratedEnrichAll,
  runEnrich,
  workersToolRestricted,
} from './orchestrator.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../..');

function card(over: Partial<Questao> = {}): Questao {
  return { id: 'c1', tipo: 'criada', pergunta: 'P?', resposta: 'R', ...over };
}

describe('buildOrchestratorSpawnArgs (puro, CLI-free)', () => {
  it('monta os args canônicos do --agent, cwd = raiz, least-privilege (dontAsk)', () => {
    const plan = buildOrchestratorSpawnArgs({ model: 'sonnet', projectRoot: '/repo' });
    expect(plan.args).toEqual([
      '-p',
      '--output-format',
      'json',
      '--model',
      'sonnet',
      '--agent',
      'ankinator-orchestrator',
      '--allowedTools',
      'Task',
      'Read',
      '--permission-mode',
      'dontAsk',
      '--exclude-dynamic-system-prompt-sections',
      '--strict-mcp-config',
    ]);
    expect(plan.cwd).toBe('/repo'); // raiz do repo, NÃO tmpdir
    expect(plan.bin).toBeTruthy();
    expect(plan.env).toBeTruthy();
  });

  it('bypassPermissions=true → --permission-mode bypassPermissions (escape de validação ao vivo)', () => {
    const plan = buildOrchestratorSpawnArgs({ model: 'sonnet', projectRoot: '/repo', bypassPermissions: true });
    const i = plan.args.indexOf('--permission-mode');
    expect(plan.args[i + 1]).toBe('bypassPermissions');
  });

  it('respeita agent custom e model', () => {
    const plan = buildOrchestratorSpawnArgs({ model: 'opus', projectRoot: '/r', agent: 'x' });
    expect(plan.args[plan.args.indexOf('--model') + 1]).toBe('opus');
    expect(plan.args[plan.args.indexOf('--agent') + 1]).toBe('x');
  });
});

describe('resolveProjectRoot', () => {
  it('honra ANKINATOR_PROJECT_ROOT', () => {
    const prev = process.env.ANKINATOR_PROJECT_ROOT;
    process.env.ANKINATOR_PROJECT_ROOT = '/custom/root';
    try {
      expect(resolveProjectRoot()).toBe('/custom/root');
    } finally {
      if (prev === undefined) delete process.env.ANKINATOR_PROJECT_ROOT;
      else process.env.ANKINATOR_PROJECT_ROOT = prev;
    }
  });
});

describe('buildOrchestratorMessage (cobertura por estágio)', () => {
  it('imagem ON → instrui gerar mnemonicoSvg p/ a maioria (sobrepõe "parcimônia")', () => {
    const msg = buildOrchestratorMessage([card({ id: 'a' })], { classificar: true, mnemonico: true, imagem: true });
    expect(msg).toMatch(/IMAGEM ligada/);
    expect(msg).toMatch(/mnemonicoSvg/);
    expect(msg).toMatch(/parcimônia/);
    expect(msg).toContain('imagem=true');
  });

  it('imagem OFF → SEM diretiva de imagem', () => {
    const msg = buildOrchestratorMessage([card({ id: 'a' })], { classificar: true, mnemonico: true, imagem: false });
    expect(msg).not.toMatch(/IMAGEM ligada/);
    expect(msg).toContain('imagem=false');
  });

  it('serializa os cards (id incluído) e nunca interpola cru', () => {
    const msg = buildOrchestratorMessage([card({ id: 'xyz', pergunta: 'P?' })], { mnemonico: true });
    expect(msg).toContain('"id": "xyz"');
  });
});

describe('parseOrchestratorCards (tolerante)', () => {
  it('JSON puro', () => {
    expect(parseOrchestratorCards('{"cards":[{"id":"a"}]}')).toEqual([{ id: 'a' }]);
  });
  it('cercas ```json + texto ao redor', () => {
    const t = 'Aqui está:\n```json\n{"cards":[{"id":"b","deck":"D"}]}\n```\nfim';
    expect(parseOrchestratorCards(t)).toEqual([{ id: 'b', deck: 'D' }]);
  });
  it('lança em JSON inválido', () => {
    expect(() => parseOrchestratorCards('não é json')).toThrow();
  });
  it('lança quando falta o array cards', () => {
    expect(() => parseOrchestratorCards('{"x":1}')).toThrow(/cards/);
  });
});

describe('mergeOrchestratorResult (por id + gating por toggle + boundary SVG)', () => {
  const ALL = { classificar: true, cardBuilder: true, mnemonico: true, imagem: true };

  it('funde deck/tags/mnemonico/resposta POR ID (estágios ligados); cards sem retorno ficam intactos', () => {
    const qs = [card({ id: 'a', resposta: 'orig-a' }), card({ id: 'b', resposta: 'orig-b' })];
    const { questoes, aplicados } = mergeOrchestratorResult(
      qs,
      [{ id: 'a', deck: 'Mat::Sub', tags: ['t1', 2, 't2'], mnemonico: 'M', resposta: 'novo-a' }],
      ALL,
    );
    expect(aplicados).toBe(1);
    expect(questoes[0]).toMatchObject({ id: 'a', deck: 'Mat::Sub', tags: ['t1', 't2'], mnemonico: 'M', resposta: 'novo-a' });
    expect(questoes[1]).toEqual(qs[1]); // 'b' intacto
  });

  it('GATING: estágio DESLIGADO → campo descartado (paridade com enrichAll)', () => {
    const qs = [card({ id: 'a', resposta: 'orig' })];
    // classificar OFF + cardBuilder OFF → deck/tags/resposta descartados; mnemonico ON → aplicado
    const { questoes } = mergeOrchestratorResult(
      qs,
      [{ id: 'a', deck: 'X', tags: ['t'], resposta: 'reescrita', mnemonico: 'M' }],
      { classificar: false, cardBuilder: false, mnemonico: true, imagem: false },
    );
    expect(questoes[0].deck).toBeUndefined();
    expect(questoes[0].tags).toBeUndefined();
    expect(questoes[0].resposta).toBe('orig'); // NÃO reescrita (cardBuilder off)
    expect(questoes[0].mnemonico).toBe('M'); // estágio ligado
  });

  it('ignora ids desconhecidos (nunca posicional)', () => {
    const qs = [card({ id: 'a' })];
    const { aplicados } = mergeOrchestratorResult(qs, [{ id: 'zzz', deck: 'X' }], ALL);
    expect(aplicados).toBe(0);
  });

  it('SVG perigoso é barrado (fail-closed D-08) → mnemonicoSvg não é gravado', () => {
    const qs = [card({ id: 'a' })];
    const { questoes } = mergeOrchestratorResult(qs, [{ id: 'a', mnemonicoSvg: '<script>alert(1)</script>' }], ALL);
    expect(questoes[0].mnemonicoSvg).toBeUndefined();
  });

  it('SVG geométrico válido passa (sanitizado) quando imagem ON e a qualidade não reprova', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40"/></svg>';
    const qs = [card({ id: 'a' })];
    const { questoes } = mergeOrchestratorResult(qs, [{ id: 'a', mnemonicoSvg: svg }], { imagem: true, imageQuality: false });
    expect(questoes[0].mnemonicoSvg).toContain('<svg');
    expect(questoes[0].mnemonicoSvg).toContain('circle');
  });

  it('imagem OFF → SVG (mesmo válido) NÃO é aplicado', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40"/></svg>';
    const qs = [card({ id: 'a' })];
    const { questoes } = mergeOrchestratorResult(qs, [{ id: 'a', mnemonicoSvg: svg }], { imagem: false });
    expect(questoes[0].mnemonicoSvg).toBeUndefined();
  });
});

describe('orchestratedEnrichAll (runner injetado, CLI-free)', () => {
  it('orquestra + funde por id (estágio classificar ligado)', async () => {
    const qs = [card({ id: 'a' }), card({ id: 'b' })];
    const fakeRun = vi.fn(async () => '{"cards":[{"id":"a","deck":"D1"},{"id":"b","deck":"D2"}]}');
    const out = await orchestratedEnrichAll(qs, { classificar: true }, undefined, fakeRun);
    expect(fakeRun).toHaveBeenCalledOnce();
    expect(out.map((q) => q.deck)).toEqual(['D1', 'D2']);
  });

  it('lança quando nenhum id corresponde (→ aciona fallback no dispatcher)', async () => {
    const qs = [card({ id: 'a' })];
    const fakeRun = vi.fn(async () => '{"cards":[{"id":"outro","deck":"D"}]}');
    await expect(orchestratedEnrichAll(qs, {}, undefined, fakeRun)).rejects.toThrow();
  });
});

describe('runEnrich (dispatcher + fallback determinístico)', () => {
  const opts = (o: Partial<EnrichOpts>): EnrichOpts => ({ classificar: true, ...o });

  it('orchestrated OFF → chama enrichAll, NÃO o orquestrador (byte-equivalente)', async () => {
    const enrich = vi.fn(async (q: Questao[]) => q);
    const orchestrate = vi.fn(async (q: Questao[]) => q);
    const qs = [card()];
    await runEnrich(qs, opts({ orchestrated: false }), undefined, { enrich, orchestrate });
    expect(enrich).toHaveBeenCalledOnce();
    expect(orchestrate).not.toHaveBeenCalled();
  });

  it('orchestrated ON + orquestrador OK → usa o resultado orquestrado', async () => {
    const prev = process.env.ANKINATOR_PROJECT_ROOT;
    process.env.ANKINATOR_PROJECT_ROOT = REPO_ROOT; // agente .claude/agents/ankinator-orchestrator.md existe
    try {
      const enrich = vi.fn(async (q: Questao[]) => q);
      const orchestrate = vi.fn(async () => [card({ id: 'a', deck: 'ORQ' })]);
      const out = await runEnrich([card({ id: 'a' })], opts({ orchestrated: true }), undefined, {
        enrich,
        orchestrate,
        precheck: () => ({ ok: true, faltando: [] }),
      });
      expect(orchestrate).toHaveBeenCalledOnce();
      expect(enrich).not.toHaveBeenCalled();
      expect(out[0].deck).toBe('ORQ');
    } finally {
      if (prev === undefined) delete process.env.ANKINATOR_PROJECT_ROOT;
      else process.env.ANKINATOR_PROJECT_ROOT = prev;
    }
  });

  it('orchestrated ON + imagem ON → HÍBRIDO: orquestrador SEM imagem + estágio imagem determinístico', async () => {
    const prev = process.env.ANKINATOR_PROJECT_ROOT;
    process.env.ANKINATOR_PROJECT_ROOT = REPO_ROOT;
    try {
      const orchestrate = vi.fn(async (q: Questao[], _o?: EnrichOpts) => q.map((c) => ({ ...c, mnemonico: 'M' })));
      const enrich = vi.fn(async (q: Questao[], _o?: EnrichOpts) => q.map((c) => ({ ...c, mnemonicoSvg: '<svg/>' })));
      const out = await runEnrich([card({ id: 'a' })], opts({ orchestrated: true, imagem: true }), undefined, {
        orchestrate,
        enrich,
        precheck: () => ({ ok: true, faltando: [] }),
      });
      expect(orchestrate).toHaveBeenCalledOnce();
      expect(orchestrate.mock.calls[0]?.[1]?.imagem).toBe(false); // orquestrador roda SEM imagem
      expect(enrich).toHaveBeenCalledOnce();
      // o estágio determinístico roda SÓ imagem (paralelo, confiável)
      expect(enrich.mock.calls[0]?.[1]).toMatchObject({ imagem: true, classificar: false, cardBuilder: false, mnemonico: false });
      expect(out[0].mnemonico).toBe('M'); // do orquestrador
      expect(out[0].mnemonicoSvg).toBe('<svg/>'); // do estágio determinístico
    } finally {
      if (prev === undefined) delete process.env.ANKINATOR_PROJECT_ROOT;
      else process.env.ANKINATOR_PROJECT_ROOT = prev;
    }
  });

  it('orchestrated ON + orquestrador FALHA → fallback determinístico p/ enrichAll', async () => {
    const prev = process.env.ANKINATOR_PROJECT_ROOT;
    process.env.ANKINATOR_PROJECT_ROOT = REPO_ROOT;
    try {
      const enrich = vi.fn(async (q: Questao[]) => q.map((c) => ({ ...c, deck: 'FALLBACK' })));
      const orchestrate = vi.fn(async () => {
        throw new Error('claude headless falhou');
      });
      const out = await runEnrich([card({ id: 'a' })], opts({ orchestrated: true }), undefined, {
        enrich,
        orchestrate,
        precheck: () => ({ ok: true, faltando: [] }),
      });
      expect(orchestrate).toHaveBeenCalledOnce();
      expect(enrich).toHaveBeenCalledOnce(); // fallback
      expect(out[0].deck).toBe('FALLBACK');
    } finally {
      if (prev === undefined) delete process.env.ANKINATOR_PROJECT_ROOT;
      else process.env.ANKINATOR_PROJECT_ROOT = prev;
    }
  });

  it('orchestrated ON + agente AUSENTE → fallback p/ enrichAll (sem chamar o orquestrador)', async () => {
    const prev = process.env.ANKINATOR_PROJECT_ROOT;
    process.env.ANKINATOR_PROJECT_ROOT = '/nao/existe/raiz';
    try {
      const enrich = vi.fn(async (q: Questao[]) => q);
      const orchestrate = vi.fn(async (q: Questao[]) => q);
      await runEnrich([card()], opts({ orchestrated: true }), undefined, { enrich, orchestrate });
      expect(enrich).toHaveBeenCalledOnce();
      expect(orchestrate).not.toHaveBeenCalled();
    } finally {
      if (prev === undefined) delete process.env.ANKINATOR_PROJECT_ROOT;
      else process.env.ANKINATOR_PROJECT_ROOT = prev;
    }
  });

  it('orchestrated ON + workers SEM restrição de tools → DESABILITADO por segurança (fallback)', async () => {
    const prev = process.env.ANKINATOR_PROJECT_ROOT;
    process.env.ANKINATOR_PROJECT_ROOT = REPO_ROOT; // orquestrador existe; precheck injetado reprova
    try {
      const enrich = vi.fn(async (q: Questao[]) => q);
      const orchestrate = vi.fn(async (q: Questao[]) => q);
      await runEnrich([card()], opts({ orchestrated: true }), undefined, {
        enrich,
        orchestrate,
        precheck: () => ({ ok: false, faltando: ['ankinator-image'] }),
      });
      expect(orchestrate).not.toHaveBeenCalled(); // precondição de segurança barra o caminho privilegiado
      expect(enrich).toHaveBeenCalledOnce();
    } finally {
      if (prev === undefined) delete process.env.ANKINATOR_PROJECT_ROOT;
      else process.env.ANKINATOR_PROJECT_ROOT = prev;
    }
  });
});

describe('workersToolRestricted (precondição de segurança)', () => {
  it('raiz sem .claude/agents → ok:false e lista os 4 workers faltando', () => {
    const r = workersToolRestricted('/nao/existe/raiz');
    expect(r.ok).toBe(false);
    expect(r.faltando).toHaveLength(4);
  });
});
