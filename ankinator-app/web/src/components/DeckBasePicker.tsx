import { useEffect, useRef, useState } from 'react';
import { api, type DeckRef } from '../api';
import type { DeckPreview } from '../types';
import { IconCheck, IconLayers, IconSpinner } from './icons';

interface Props {
  /** Empurra o deck base escolhido para o pai (null = geração normal, sem incremento). */
  onChange: (deck: DeckRef | null) => void;
  disabled?: boolean;
}

type Mode = 'none' | 'anki' | 'file';

/**
 * Seletor opcional de DECK BASE para geração incremental: o Ankinator adiciona apenas
 * questões que ainda não estão no deck (sem extrapolar o PDF) e avisa quando o deck já
 * está completo. Fonte: deck aberto no Anki (AnkiConnect) OU arquivo .txt/.apkg enviado.
 */
export function DeckBasePicker({ onChange, disabled }: Props) {
  const [mode, setMode] = useState<Mode>('none');
  const [decks, setDecks] = useState<string[]>([]);
  const [ankiDeck, setAnkiDeck] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [preview, setPreview] = useState<DeckPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);

  // Lista de decks do Anki (best-effort; falha silenciosa só aqui = UX, não dado crítico).
  useEffect(() => {
    api.ankiStatus().then((s) => {
      if (s.online) api.ankiDecks().then(setDecks).catch(() => {});
    });
  }, []);

  const limpar = () => {
    setPreview(null);
    setError(null);
  };

  const escolherModo = (m: Mode) => {
    setMode(m);
    limpar();
    setFileName(null);
    if (m === 'none') onChange(null);
    else if (m === 'anki') onChange(ankiDeck.trim() ? { ankiDeck: ankiDeck.trim() } : null);
    // 'file' só vira deckRef após upload bem-sucedido
    else onChange(null);
  };

  const onAnkiDeck = (v: string) => {
    setAnkiDeck(v);
    limpar();
    onChange(v.trim() ? { ankiDeck: v.trim() } : null);
  };

  const verificar = async (deck: DeckRef) => {
    setLoading(true);
    setError(null);
    setPreview(null);
    try {
      setPreview(await api.deckPreview(deck));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const onFile = async (file: File) => {
    setLoading(true);
    setError(null);
    setPreview(null);
    setFileName(file.name);
    try {
      const { deckFileId } = await api.uploadDeck(file);
      const ref: DeckRef = { deckFileId };
      onChange(ref);
      setPreview(await api.deckPreview(ref));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      onChange(null);
    } finally {
      setLoading(false);
    }
  };

  const tabClass = (m: Mode) =>
    `flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition ${
      mode === m
        ? 'bg-brand-600 text-white shadow-sm'
        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
    }`;

  return (
    <div className="border-t border-slate-100 dark:border-slate-800 pt-3">
      <h3 className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        <IconLayers className="h-4 w-4 text-teal-500" />
        Deck base (opcional)
      </h3>
      <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">
        Incrementa um deck existente: gera só o que <strong>falta</strong> no PDF, sem duplicar.
      </p>

      <div className="mb-2 flex gap-1 rounded-lg bg-slate-50 dark:bg-slate-800/60 p-1">
        <button type="button" disabled={disabled} onClick={() => escolherModo('none')} className={tabClass('none')}>
          Nenhum
        </button>
        <button type="button" disabled={disabled} onClick={() => escolherModo('anki')} className={tabClass('anki')}>
          Deck do Anki
        </button>
        <button type="button" disabled={disabled} onClick={() => escolherModo('file')} className={tabClass('file')}>
          Arquivo
        </button>
      </div>

      {mode === 'anki' && (
        <div className="flex gap-2">
          <input
            list="deck-base-list"
            value={ankiDeck}
            onChange={(e) => onAnkiDeck(e.target.value)}
            placeholder="Nome do deck no Anki"
            disabled={disabled}
            className="min-w-0 flex-1 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
          />
          <datalist id="deck-base-list">
            {decks.map((d) => (
              <option key={d} value={d} />
            ))}
          </datalist>
          <button
            type="button"
            onClick={() => ankiDeck.trim() && verificar({ ankiDeck: ankiDeck.trim() })}
            disabled={disabled || loading || !ankiDeck.trim()}
            className="shrink-0 rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60 disabled:opacity-40"
          >
            Verificar
          </button>
        </div>
      )}

      {mode === 'file' && (
        <div>
          <input
            ref={fileInput}
            type="file"
            accept=".txt,.csv,.tsv,.apkg,.colpkg"
            disabled={disabled}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
            }}
            className="block w-full text-xs text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-xs file:font-medium file:text-brand-700 hover:file:bg-brand-100 dark:text-slate-400 dark:file:bg-brand-500/15 dark:file:text-brand-300"
          />
          <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">Export do Anki: .txt (“Notes in Plain Text”) ou .apkg.</p>
          {fileName && <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400" title={fileName}>{fileName}</p>}
        </div>
      )}

      {/* Feedback da prévia */}
      {loading && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
          <IconSpinner className="h-3.5 w-3.5 animate-spin" /> Lendo o deck base…
        </p>
      )}
      {preview && !loading && (
        <p className="mt-2 flex items-center gap-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 px-2.5 py-1.5 text-xs text-emerald-700 dark:text-emerald-300">
          <IconCheck className="h-3.5 w-3.5 shrink-0" />
          {preview.count} questão(ões) já no deck — só o que faltar será gerado.
        </p>
      )}
      {error && !loading && (
        <p className="mt-2 rounded-lg bg-rose-50 dark:bg-rose-900/30 px-2.5 py-1.5 text-xs text-rose-700 dark:text-rose-300">{error}</p>
      )}
    </div>
  );
}
