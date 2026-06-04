import { useMemo, useState } from 'react';
import type { Questao } from '../types';

interface Props {
  cards: Questao[];
  dropped: Set<string>;
  onEdit: (id: string, field: 'pergunta' | 'resposta', value: string) => void;
  onToggleDrop: (id: string) => void;
}

type Filter = 'all' | 'extraida' | 'criada';

export function CardTable({ cards, dropped, onEdit, onToggleDrop }: Props) {
  const [filter, setFilter] = useState<Filter>('all');
  const visible = useMemo(() => cards.filter((c) => filter === 'all' || c.tipo === filter), [cards, filter]);

  const counts = useMemo(
    () => ({
      all: cards.length,
      extraida: cards.filter((c) => c.tipo === 'extraida').length,
      criada: cards.filter((c) => c.tipo === 'criada').length,
    }),
    [cards]
  );

  return (
    <div className="rounded-2xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-5 py-3">
        {(['all', 'extraida', 'criada'] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={[
              'rounded-full px-3 py-1 text-sm font-medium transition',
              filter === f ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
            ].join(' ')}
          >
            {f === 'all' ? 'Todas' : f === 'extraida' ? 'Extraídas' : 'Criadas'} ({counts[f]})
          </button>
        ))}
        <span className="ml-auto text-sm text-slate-500">
          {cards.length - dropped.size} selecionadas para exportar
        </span>
      </div>

      <ul className="divide-y divide-slate-100">
        {visible.map((c, i) => {
          const isDropped = dropped.has(c.id);
          return (
            <li key={c.id} className={`p-4 transition ${isDropped ? 'bg-slate-50 opacity-50' : ''}`}>
              <div className="mb-2 flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-400">#{i + 1}</span>
                <span
                  className={[
                    'rounded px-1.5 py-0.5 text-xs font-medium',
                    c.tipo === 'extraida' ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-100 text-indigo-700',
                  ].join(' ')}
                >
                  {c.tipo === 'extraida' ? 'extraída' : 'criada'}
                </span>
                {c.pageStart && (
                  <span className="text-xs text-slate-400">
                    p.{c.pageStart}
                    {c.pageEnd !== c.pageStart ? `–${c.pageEnd}` : ''}
                  </span>
                )}
                {c.metadata?.banca && (
                  <span className="text-xs text-slate-400">· {c.metadata.banca}{c.metadata.ano ? ` ${c.metadata.ano}` : ''}</span>
                )}
                {/* badges deck/tags read-only — só quando preenchidos (SPEC-05 campos opcionais — D-17) */}
                {c.deck && (
                  <span className="rounded bg-violet-100 px-1.5 py-0.5 text-xs font-medium text-violet-700">
                    {c.deck}
                  </span>
                )}
                {c.tags?.length ? (
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">
                    {c.tags.slice(0, 3).join(' ')}
                    {c.tags.length > 3 ? ` +${c.tags.length - 3}` : ''}
                  </span>
                ) : null}
                {c.mnemonico && (
                  <span
                    className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700"
                    title={c.mnemonico.slice(0, 60)}
                  >
                    📝 mnemônico
                  </span>
                )}
                {c.mnemonicoSvg && (
                  <span className="rounded bg-sky-100 px-1.5 py-0.5 text-xs font-medium text-sky-700">
                    🖼️ SVG
                  </span>
                )}
                <button
                  onClick={() => onToggleDrop(c.id)}
                  className={[
                    'ml-auto rounded-lg px-2.5 py-1 text-xs font-medium transition',
                    isDropped
                      ? 'bg-brand-100 text-brand-700 hover:bg-brand-200'
                      : 'border border-slate-300 text-slate-500 hover:bg-slate-50',
                  ].join(' ')}
                >
                  {isDropped ? 'Restaurar' : 'Descartar'}
                </button>
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                <AutoTextarea
                  label="Pergunta"
                  value={c.pergunta}
                  disabled={isDropped}
                  onChange={(v) => onEdit(c.id, 'pergunta', v)}
                />
                <AutoTextarea
                  label="Resposta"
                  value={c.resposta}
                  disabled={isDropped}
                  onChange={(v) => onEdit(c.id, 'resposta', v)}
                />
              </div>
            </li>
          );
        })}
        {visible.length === 0 && (
          <li className="px-5 py-10 text-center text-sm text-slate-400">Nenhuma questão neste filtro.</li>
        )}
      </ul>
    </div>
  );
}

function AutoTextarea({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">{label}</span>
      <textarea
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        rows={Math.min(8, Math.max(2, Math.ceil(value.length / 60)))}
        className="w-full resize-y rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:border-brand-500 focus:bg-white focus:ring-1 focus:ring-brand-500 disabled:opacity-60"
      />
    </label>
  );
}
