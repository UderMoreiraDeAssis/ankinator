import { useEffect, useState } from 'react';
import { api } from '../api';
import type { AnkiStatus, PushResult, Questao } from '../types';

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
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-slate-700">Exportar CSV</h3>
          <p className="text-xs text-slate-500">Arquivo compatível com a importação do Anki (Frente; Verso; Tags; Fonte).</p>
          <button
            onClick={downloadCsv}
            disabled={cards.length === 0}
            className="rounded-xl border border-brand-600 px-4 py-2.5 text-sm font-semibold text-brand-700 transition hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            ⬇️ Baixar {cards.length} cards (.csv)
          </button>
        </div>

        {/* AnkiConnect */}
        <div className="flex flex-col gap-2 border-t border-slate-100 pt-4 md:border-l md:border-t-0 md:pl-5 md:pt-0">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-700">Enviar ao Anki</h3>
            <span
              className={`flex items-center gap-1 text-xs ${anki?.online ? 'text-emerald-600' : 'text-slate-400'}`}
            >
              <span className={`h-2 w-2 rounded-full ${anki?.online ? 'bg-emerald-500' : 'bg-slate-300'}`} />
              {anki?.online ? `online (v${anki.version})` : 'offline'}
              <button onClick={refreshAnki} className="ml-1 text-slate-400 hover:text-slate-600" title="Atualizar">
                ↻
              </button>
            </span>
          </div>
          <div className="flex gap-2">
            <input
              list="decks"
              value={deck}
              onChange={(e) => setDeck(e.target.value)}
              placeholder="Nome do deck"
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
            />
            <datalist id="decks">
              {decks.map((d) => (
                <option key={d} value={d} />
              ))}
            </datalist>
            <button
              onClick={push}
              disabled={!anki?.online || pushing || cards.length === 0 || !deck.trim()}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {pushing ? 'Enviando…' : 'Enviar'}
            </button>
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-500">
            <input type="checkbox" checked={allowDup} onChange={(e) => setAllowDup(e.target.checked)} className="rounded border-slate-300 text-brand-600" />
            Permitir duplicatas
          </label>
          {!anki?.online && (
            <p className="text-xs text-slate-400">Abra o Anki com o add-on AnkiConnect (2055492159) para habilitar o envio.</p>
          )}
        </div>
      </div>

      {result && (
        <div className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          ✓ {result.enviadas} enviadas ao deck “{result.deck}”
          {result.ignoradas > 0 && ` · ${result.ignoradas} ignoradas (duplicatas)`}
        </div>
      )}
      {error && <div className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}
    </div>
  );
}
