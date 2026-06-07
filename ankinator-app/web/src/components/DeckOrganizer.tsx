import { useEffect, useState } from 'react';
import { api } from '../api';
import type { OrganizeApplyResult, OrganizePlan } from '../types';
import { IconLayers, IconSpinner, IconCheck } from './icons';

interface Props {
  onClose: () => void;
}

type Phase = 'config' | 'preview' | 'applying' | 'done';

/**
 * Reorganizador de decks do Anki (Parte B, Fatia 1) — modal não-intrusivo.
 *
 * Fluxo de DUAS FASES (segurança — mexe na coleção real): configurar → PRÉVIA (só lê,
 * mostra o diff) → revisar/aprovar → APLICAR. Merge é destrutivo (move cards + apaga
 * decks vazios); repetidos é não-destrutivo (marca a tag "duplicata").
 */
export function DeckOrganizer({ onClose }: Props) {
  const [decks, setDecks] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [doDedup, setDoDedup] = useState(true);
  const [doMerge, setDoMerge] = useState(false);
  const [mergeTarget, setMergeTarget] = useState('');
  const [filter, setFilter] = useState('');

  const [phase, setPhase] = useState<Phase>('config');
  const [plan, setPlan] = useState<OrganizePlan | null>(null);
  const [applyMerge, setApplyMerge] = useState(true);
  const [applyDedup, setApplyDedup] = useState(true);
  const [result, setResult] = useState<OrganizeApplyResult | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ankiOffline, setAnkiOffline] = useState(false);

  useEffect(() => {
    api
      .ankiStatus()
      .then((s) => {
        if (s.online) api.ankiDecks().then(setDecks).catch(() => {});
        else setAnkiOffline(true);
      })
      .catch(() => setAnkiOffline(true));
  }, []);

  const toggleDeck = (d: string) =>
    setSelected((prev) => {
      const n = new Set(prev);
      n.has(d) ? n.delete(d) : n.add(d);
      return n;
    });

  const filteredDecks = filter.trim()
    ? decks.filter((d) => d.toLowerCase().includes(filter.trim().toLowerCase()))
    : decks;
  const selecionarFiltrados = () => setSelected((prev) => new Set([...prev, ...filteredDecks]));
  const limparSelecao = () => setSelected(new Set());

  const podeGerar = selected.size > 0 && (doDedup || (doMerge && mergeTarget.trim().length > 0));

  const gerarPrevia = async () => {
    setError(null);
    setLoading(true);
    setPlan(null);
    try {
      const body: { decks: string[]; merge?: { target: string }; dedup?: boolean } = { decks: [...selected] };
      if (doMerge && mergeTarget.trim()) body.merge = { target: mergeTarget.trim() };
      if (doDedup) body.dedup = true;
      const p = await api.organizePreview(body);
      setPlan(p);
      setApplyMerge(!!p.merge);
      setApplyDedup(!!p.dedup);
      setPhase('preview');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const aplicar = async () => {
    if (!plan) return;
    setError(null);
    setLoading(true);
    setPhase('applying');
    try {
      const r = await api.organizeApply({
        plan,
        applyMerge: applyMerge && !!plan.merge,
        applyDedup: applyDedup && !!plan.dedup,
      });
      setResult(r);
      setPhase('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPhase('preview');
    } finally {
      setLoading(false);
    }
  };

  const nadaPraAplicar = (!applyMerge || !plan?.merge) && (!applyDedup || !plan?.dedup);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3 dark:border-slate-700">
          <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-slate-50">
            <IconLayers className="h-5 w-5 text-teal-500" /> Organizar decks do Anki
          </h2>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="rounded p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            ✕
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {ankiOffline && (
            <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-900/30 dark:text-rose-300">
              Anki/AnkiConnect offline. Abra o Anki (com o add-on AnkiConnect) para reorganizar decks.
            </p>
          )}
          {error && (
            <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-900/30 dark:text-rose-300">{error}</p>
          )}

          {/* ── FASE 1: configurar ─────────────────────────────────────────── */}
          {phase === 'config' && (
            <div className="space-y-4">
              <div>
                <div className="mb-1.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Decks ({selected.size} de {decks.length} selecionado{selected.size === 1 ? '' : 's'})
                  </h3>
                  {decks.length > 0 && (
                    <div className="flex shrink-0 gap-3">
                      <button
                        type="button"
                        onClick={selecionarFiltrados}
                        disabled={filteredDecks.length === 0 || filteredDecks.every((d) => selected.has(d))}
                        className="text-xs font-medium text-brand-600 transition hover:underline disabled:opacity-40 disabled:no-underline dark:text-brand-400"
                      >
                        Selecionar {filter.trim() ? 'filtrados' : 'tudo'}
                      </button>
                      <button
                        type="button"
                        onClick={limparSelecao}
                        disabled={selected.size === 0}
                        className="text-xs font-medium text-slate-500 transition hover:underline disabled:opacity-40 disabled:no-underline dark:text-slate-400"
                      >
                        Limpar
                      </button>
                    </div>
                  )}
                </div>
                {decks.length === 0 ? (
                  <p className="text-sm text-slate-400">Nenhum deck encontrado.</p>
                ) : (
                  <>
                    <input
                      type="text"
                      value={filter}
                      onChange={(e) => setFilter(e.target.value)}
                      placeholder="Filtrar decks…"
                      aria-label="Filtrar decks"
                      className="mb-2 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                    />
                    <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700">
                      {filteredDecks.length === 0 ? (
                        <p className="px-3 py-2 text-sm text-slate-400">Nenhum deck corresponde a “{filter.trim()}”.</p>
                      ) : (
                        filteredDecks.map((d) => (
                          <label
                            key={d}
                            className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800/60"
                          >
                            <input
                              type="checkbox"
                              checked={selected.has(d)}
                              onChange={() => toggleDeck(d)}
                              className="shrink-0 accent-brand-600"
                            />
                            <span className="min-w-0 break-words">{d}</span>
                          </label>
                        ))
                      )}
                    </div>
                  </>
                )}
              </div>

              <div className="space-y-2 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                  <input type="checkbox" checked={doDedup} onChange={(e) => setDoDedup(e.target.checked)} className="accent-brand-600" />
                  Achar repetidos <span className="text-xs font-normal text-slate-400">(marca a cópia extra com a tag “duplicata”)</span>
                </label>
                <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                  <input type="checkbox" checked={doMerge} onChange={(e) => setDoMerge(e.target.checked)} className="accent-brand-600" />
                  Unir decks (merge) <span className="text-xs font-normal text-slate-400">(move os cards diretos para um deck-alvo)</span>
                </label>
                {doMerge && (
                  <div className="pl-6">
                    <input
                      list="organize-merge-target"
                      value={mergeTarget}
                      onChange={(e) => setMergeTarget(e.target.value)}
                      placeholder="Deck-alvo (existente ou novo)"
                      className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                    />
                    <datalist id="organize-merge-target">
                      {decks.map((d) => (
                        <option key={d} value={d} />
                      ))}
                    </datalist>
                  </div>
                )}
              </div>

              <div className="flex justify-end">
                <button
                  onClick={gerarPrevia}
                  disabled={!podeGerar || loading}
                  className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-40"
                >
                  {loading && <IconSpinner className="h-4 w-4 animate-spin" />} Gerar prévia
                </button>
              </div>
            </div>
          )}

          {/* ── FASE 2: prévia / diff ──────────────────────────────────────── */}
          {phase === 'preview' && plan && (
            <div className="space-y-4">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Prévia (nada foi alterado ainda). Revise e marque o que aplicar.
              </p>

              {plan.merge && (
                <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 dark:border-amber-800 dark:bg-amber-900/20">
                  <label className="flex items-center gap-2 text-sm font-semibold text-amber-800 dark:text-amber-200">
                    <input type="checkbox" checked={applyMerge} onChange={(e) => setApplyMerge(e.target.checked)} className="accent-amber-600" />
                    Unir em “{plan.merge.target}” <span className="text-xs font-normal">(destrutivo)</span>
                  </label>
                  <ul className="mt-1.5 space-y-0.5 pl-6 text-xs text-amber-900/80 dark:text-amber-200/80">
                    <li>Mover <strong>{plan.merge.totalMoved}</strong> card(s) direto(s) de {plan.merge.moves.length} deck(s) → “{plan.merge.target}”.</li>
                    {plan.merge.decksToDelete.length > 0 && (
                      <li>Apagar (ficarão vazios): {plan.merge.decksToDelete.map((d) => `“${d}”`).join(', ')}.</li>
                    )}
                    {plan.merge.preservedWithSubdecks.length > 0 && (
                      <li>Preservados (têm subdecks): {plan.merge.preservedWithSubdecks.map((d) => `“${d}”`).join(', ')}.</li>
                    )}
                  </ul>
                </div>
              )}

              {plan.dedup && (
                <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                  <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                    <input type="checkbox" checked={applyDedup} onChange={(e) => setApplyDedup(e.target.checked)} className="accent-brand-600" />
                    Marcar {plan.dedup.totalDuplicates} repetido(s) com a tag “{plan.dedup.tag}”
                  </label>
                  {plan.dedup.groups.length === 0 ? (
                    <p className="mt-1.5 pl-6 text-xs text-slate-400">Nenhum repetido encontrado.</p>
                  ) : (
                    <ul className="mt-1.5 max-h-40 space-y-1 overflow-y-auto pl-6 text-xs text-slate-500 dark:text-slate-400">
                      {plan.dedup.groups.slice(0, 30).map((g) => (
                        <li key={g.keepNoteId} className="break-words">
                          <span className="rounded bg-slate-100 px-1 dark:bg-slate-800">{g.size}×</span> {g.sampleFront || '(sem texto)'}
                        </li>
                      ))}
                      {plan.dedup.groups.length > 30 && <li className="text-slate-400">… e mais {plan.dedup.groups.length - 30} grupo(s).</li>}
                    </ul>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between gap-2">
                <button
                  onClick={() => setPhase('config')}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800/60"
                >
                  Voltar
                </button>
                <button
                  onClick={aplicar}
                  disabled={loading || nadaPraAplicar}
                  className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-40"
                >
                  {loading && <IconSpinner className="h-4 w-4 animate-spin" />} Aplicar
                </button>
              </div>
            </div>
          )}

          {phase === 'applying' && (
            <p className="flex items-center gap-2 py-6 text-sm text-slate-500 dark:text-slate-400">
              <IconSpinner className="h-4 w-4 animate-spin" /> Aplicando no Anki…
            </p>
          )}

          {/* ── FASE 3: resultado ──────────────────────────────────────────── */}
          {phase === 'done' && result && (
            <div className="space-y-3">
              <p className="flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                <IconCheck className="h-4 w-4" /> Reorganização aplicada.
              </p>
              {result.merge && (
                <p className="text-sm text-slate-700 dark:text-slate-200">
                  Merge: <strong>{result.merge.movedCards}</strong> card(s) movido(s), {result.merge.deletedDecks.length} deck(s) apagado(s).
                </p>
              )}
              {result.dedup && (
                <p className="text-sm text-slate-700 dark:text-slate-200">
                  Repetidos: <strong>{result.dedup.taggedNotes}</strong> nota(s) marcada(s) com “{result.dedup.tag}”.
                </p>
              )}
              {[...(result.merge?.erros ?? []), ...(result.dedup?.erros ?? [])].length > 0 && (
                <div className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:bg-rose-900/30 dark:text-rose-300">
                  <p className="font-semibold">Avisos ({[...(result.merge?.erros ?? []), ...(result.dedup?.erros ?? [])].length}):</p>
                  <ul className="mt-1 list-disc space-y-0.5 pl-4">
                    {[...(result.merge?.erros ?? []), ...(result.dedup?.erros ?? [])].slice(0, 10).map((e, i) => (
                      <li key={i} className="break-words">{e}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="flex justify-end">
                <button
                  onClick={onClose}
                  className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
                >
                  Fechar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
