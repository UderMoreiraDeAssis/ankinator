import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import type { AnkiStatus, PushResult, Questao } from '../types';
import { IconCheck, IconDownload, IconLayers, IconRefresh, IconSend } from './icons';

interface Props {
  cards: Questao[]; // já filtrados (apenas os mantidos)
  fonte: string;
  tags: string[];
}

export function ExportBar({ cards, fonte, tags }: Props) {
  const [anki, setAnki] = useState<AnkiStatus | null>(null);
  const [deck, setDeck] = useState('Ankinator');
  const [decks, setDecks] = useState<string[]>([]);
  const [allowDup, setAllowDup] = useState(false);
  const [nestUnder, setNestUnder] = useState(true);
  const [pushing, setPushing] = useState(false);
  const [result, setResult] = useState<PushResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const pickerRef = useRef<HTMLDivElement | null>(null);

  // Fecha o seletor de decks ao clicar fora.
  useEffect(() => {
    if (!pickerOpen) return;
    const onDown = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setPickerOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [pickerOpen]);

  const refreshAnki = async () => {
    const status = await api.ankiStatus();
    setAnki(status);
    if (status.online) {
      try {
        setDecks(await api.ankiDecks());
      } catch {
        /* ignore */
      }
    }
  };

  useEffect(() => {
    refreshAnki();
  }, []);

  const downloadCsv = async () => {
    setError(null);
    try {
      const blob = await api.exportCsv(cards, fonte, tags);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${fonte.replace(/\.[^.]+$/, '')}-questoes.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const push = async () => {
    setPushing(true);
    setError(null);
    setResult(null);
    try {
      const r = await api.pushToAnki(cards, deck, fonte, tags, allowDup, nestUnder);
      setResult(r);
      await refreshAnki();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPushing(false);
    }
  };

  return (
    <div className="sticky bottom-4 mt-6 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-800 p-5 shadow-lg backdrop-blur">
      <div className="grid gap-4 md:grid-cols-2">
        {/* CSV */}
        <div className="flex flex-col gap-2 rounded-xl bg-slate-50/60 dark:bg-slate-800/60 p-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
            <IconDownload className="h-4 w-4 text-slate-500 dark:text-slate-400" />
            Exportar CSV
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">Arquivo compatível com a importação do Anki (Frente; Verso; Tags; Fonte).</p>
          <button
            onClick={downloadCsv}
            disabled={cards.length === 0}
            className="mt-auto inline-flex items-center justify-center gap-2 rounded-xl border border-brand-600 px-4 py-2.5 text-sm font-semibold text-brand-700 dark:text-brand-300 transition hover:bg-brand-50 dark:hover:bg-brand-500/15 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <IconDownload className="h-4 w-4" />
            Baixar {cards.length} questões (.csv)
          </button>
        </div>

        {/* AnkiConnect */}
        <div className="flex flex-col gap-2 rounded-xl bg-brand-50/40 dark:bg-brand-500/15 p-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-brand-700 dark:text-brand-300">
              <IconSend className="h-4 w-4" />
              Enviar ao Anki
            </h3>
            <div className="flex items-center gap-1">
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                  anki?.online ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                }`}
              >
                <span className={`h-2 w-2 rounded-full ${anki?.online ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                {anki?.online ? `online (v${anki.version})` : 'offline'}
              </span>
              <button
                onClick={refreshAnki}
                className="rounded-lg p-1.5 text-slate-400 dark:text-slate-500 transition hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 dark:hover:text-slate-300"
                title="Atualizar status do Anki"
                aria-label="Atualizar status do Anki"
              >
                <IconRefresh className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="flex gap-2">
            <div ref={pickerRef} className="relative min-w-0 flex-1">
              <div className="flex">
                <input
                  list="decks"
                  value={deck}
                  onChange={(e) => setDeck(e.target.value)}
                  placeholder="Nome do deck"
                  className="min-w-0 flex-1 rounded-l-lg border border-r-0 border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-400 px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                />
                <button
                  type="button"
                  onClick={() => {
                    setFilter('');
                    setPickerOpen((o) => !o);
                  }}
                  disabled={!anki?.online || decks.length === 0}
                  title="Escolher um deck existente do Anki"
                  aria-label="Escolher um deck existente do Anki"
                  aria-expanded={pickerOpen}
                  className="inline-flex shrink-0 items-center rounded-r-lg border border-slate-300 bg-slate-50 px-2.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
                >
                  <IconLayers className="h-4 w-4" />
                </button>
              </div>
              <datalist id="decks">
                {decks.map((d) => (
                  <option key={d} value={d} />
                ))}
              </datalist>
              {pickerOpen && (
                <div className="absolute bottom-full z-20 mb-1 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-800">
                  <input
                    autoFocus
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    placeholder="Filtrar decks…"
                    className="w-full border-b border-slate-200 bg-transparent px-3 py-2 text-sm outline-none dark:border-slate-700 dark:text-slate-100 dark:placeholder:text-slate-400"
                  />
                  <ul className="max-h-52 overflow-y-auto py-1">
                    {decks
                      .filter((d) => d.toLowerCase().includes(filter.trim().toLowerCase()))
                      .map((d) => (
                        <li key={d}>
                          <button
                            type="button"
                            onClick={() => {
                              setDeck(d);
                              setPickerOpen(false);
                            }}
                            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-slate-700 transition hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-700/60"
                          >
                            {d === deck ? (
                              <IconCheck className="h-3.5 w-3.5 shrink-0 text-brand-600 dark:text-brand-400" />
                            ) : (
                              <span className="h-3.5 w-3.5 shrink-0" />
                            )}
                            <span className="min-w-0 break-words">{d}</span>
                          </button>
                        </li>
                      ))}
                    {decks.filter((d) => d.toLowerCase().includes(filter.trim().toLowerCase())).length === 0 && (
                      <li className="px-3 py-2 text-xs text-slate-400">Nenhum deck corresponde.</li>
                    )}
                  </ul>
                </div>
              )}
            </div>
            <button
              onClick={push}
              disabled={!anki?.online || pushing || cards.length === 0 || !deck.trim()}
              className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300 dark:disabled:bg-slate-700"
            >
              <IconSend className="h-4 w-4" />
              {pushing ? 'Enviando…' : 'Enviar'}
            </button>
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <input type="checkbox" checked={nestUnder} onChange={(e) => setNestUnder(e.target.checked)} className="rounded border-slate-300 dark:border-slate-600 text-brand-600" />
            Aninhar subdecks sob este deck <span className="text-slate-400 dark:text-slate-500">(Deck::Assunto::Subtópico)</span>
          </label>
          <label className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <input type="checkbox" checked={allowDup} onChange={(e) => setAllowDup(e.target.checked)} className="rounded border-slate-300 dark:border-slate-600 text-brand-600" />
            Permitir duplicatas
          </label>
          {!anki?.online && (
            <p className="text-xs text-slate-500 dark:text-slate-400">Abra o Anki com o add-on AnkiConnect (código 2055492159) para habilitar o envio.</p>
          )}
        </div>
      </div>

      {result && (
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300" role="status">
          <IconCheck className="h-4 w-4 shrink-0" />
          <span>
            {result.enviadas} enviadas ao deck “{result.deck}”
            {result.ignoradas > 0 && ` · ${result.ignoradas} ignoradas (duplicatas)`}
          </span>
        </div>
      )}
      {error && (
        <div className="mt-3 rounded-lg bg-rose-50 dark:bg-rose-900/30 px-3 py-2 text-sm text-rose-700 dark:text-rose-300" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}
