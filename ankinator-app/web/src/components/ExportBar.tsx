import { useEffect, useState } from 'react';
import { api } from '../api';
import type { AnkiStatus, PushResult, Questao } from '../types';
import { IconCheck, IconDownload, IconRefresh, IconSend } from './icons';

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
  const [pushing, setPushing] = useState(false);
  const [result, setResult] = useState<PushResult | null>(null);
  const [error, setError] = useState<string | null>(null);

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
      const r = await api.pushToAnki(cards, deck, fonte, tags, allowDup);
      setResult(r);
      await refreshAnki();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPushing(false);
    }
  };

  return (
    <div className="sticky bottom-4 mt-6 rounded-2xl border border-slate-200 bg-white/95 p-5 shadow-lg backdrop-blur">
      <div className="grid gap-4 md:grid-cols-2">
        {/* CSV */}
        <div className="flex flex-col gap-2 rounded-xl bg-slate-50/60 p-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <IconDownload className="h-4 w-4 text-slate-500" />
            Exportar CSV
          </h3>
          <p className="text-xs text-slate-500">Arquivo compatível com a importação do Anki (Frente; Verso; Tags; Fonte).</p>
          <button
            onClick={downloadCsv}
            disabled={cards.length === 0}
            className="mt-auto inline-flex items-center justify-center gap-2 rounded-xl border border-brand-600 px-4 py-2.5 text-sm font-semibold text-brand-700 transition hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <IconDownload className="h-4 w-4" />
            Baixar {cards.length} questões (.csv)
          </button>
        </div>

        {/* AnkiConnect */}
        <div className="flex flex-col gap-2 rounded-xl bg-brand-50/40 p-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-brand-700">
              <IconSend className="h-4 w-4" />
              Enviar ao Anki
            </h3>
            <div className="flex items-center gap-1">
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                  anki?.online ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                }`}
              >
                <span className={`h-2 w-2 rounded-full ${anki?.online ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                {anki?.online ? `online (v${anki.version})` : 'offline'}
              </span>
              <button
                onClick={refreshAnki}
                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                title="Atualizar status do Anki"
                aria-label="Atualizar status do Anki"
              >
                <IconRefresh className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="flex gap-2">
            <input
              list="decks"
              value={deck}
              onChange={(e) => setDeck(e.target.value)}
              placeholder="Nome do deck"
              className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
            />
            <datalist id="decks">
              {decks.map((d) => (
                <option key={d} value={d} />
              ))}
            </datalist>
            <button
              onClick={push}
              disabled={!anki?.online || pushing || cards.length === 0 || !deck.trim()}
              className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              <IconSend className="h-4 w-4" />
              {pushing ? 'Enviando…' : 'Enviar'}
            </button>
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-500">
            <input type="checkbox" checked={allowDup} onChange={(e) => setAllowDup(e.target.checked)} className="rounded border-slate-300 text-brand-600" />
            Permitir duplicatas
          </label>
          {!anki?.online && (
            <p className="text-xs text-slate-500">Abra o Anki com o add-on AnkiConnect (código 2055492159) para habilitar o envio.</p>
          )}
        </div>
      </div>

      {result && (
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700" role="status">
          <IconCheck className="h-4 w-4 shrink-0" />
          <span>
            {result.enviadas} enviadas ao deck “{result.deck}”
            {result.ignoradas > 0 && ` · ${result.ignoradas} ignoradas (duplicatas)`}
          </span>
        </div>
      )}
      {error && (
        <div className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}
