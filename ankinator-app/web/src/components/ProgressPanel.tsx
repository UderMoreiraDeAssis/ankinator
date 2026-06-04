import type { ChunkProgress, EnrichProgress } from '../types';
import { IconCheck, IconSpinner } from './icons';

interface Props {
  total: number;
  progress: ChunkProgress[];
  fileName: string;
  enrichProgress?: EnrichProgress | null;
}

export function ProgressPanel({ total, progress, fileName, enrichProgress }: Props) {
  const done = progress.length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const questoes = progress.reduce((a, p) => a + p.questoesNoBloco, 0);
  const erros = progress.filter((p) => p.erro).length;
  const completo = pct === 100;

  return (
    <div className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="flex min-w-0 items-center gap-2 text-lg font-semibold text-slate-800">
          {completo ? (
            <IconCheck className="h-5 w-5 shrink-0 text-emerald-600" />
          ) : (
            <IconSpinner className="h-5 w-5 shrink-0 animate-spin text-brand-600" />
          )}
          <span className="truncate">{completo ? 'Geração concluída' : 'Gerando questões…'}</span>
        </h2>
        <span className="shrink-0 text-sm font-semibold text-slate-600">
          {pct}% · {done}/{total}
        </span>
      </div>
      <p className="mb-5 truncate text-sm text-slate-500" title={fileName}>
        {fileName}
      </p>

      <div
        className="h-3 w-full overflow-hidden rounded-full bg-slate-100"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Progresso da geração"
      >
        <div
          className={`h-full rounded-full transition-all duration-300 ${completo ? 'bg-emerald-500' : 'bg-brand-600'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-3 flex items-center justify-between text-sm">
        <span className="font-medium text-brand-700">{questoes} questões geradas</span>
        {erros > 0 && <span className="text-amber-600">{erros} bloco(s) com erro</span>}
      </div>

      <h3 className="mb-2 mt-6 border-t border-slate-100 pt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Blocos
      </h3>
      <ul className="max-h-56 space-y-1 overflow-y-auto text-sm">
        {progress.map((p) => (
          <li
            key={p.index}
            className={`flex items-center justify-between rounded px-2 py-1.5 ${p.erro ? 'bg-amber-50 text-amber-700' : 'text-slate-600'}`}
          >
            <span className="truncate" title={`Bloco ${p.index + 1}: ${p.sectionTitles.join(' › ') || '—'}`}>
              Bloco {p.index + 1}: {p.sectionTitles.join(' › ') || '—'}
            </span>
            <span className="ml-2 shrink-0 font-medium">{p.erro ? 'erro' : `+${p.questoesNoBloco}`}</span>
          </li>
        ))}
      </ul>

      {enrichProgress && (
        <div className="mt-4 flex items-center justify-between gap-2 border-t border-slate-100 pt-4 text-sm text-slate-600">
          <span className="flex min-w-0 items-center gap-2">
            <IconSpinner className="h-4 w-4 shrink-0 animate-spin text-brand-600" />
            <span className="truncate">
              {enrichProgress.estagio === 'classificando'
                ? 'Classificando deck + tags…'
                : enrichProgress.estagio === 'reescrevendo'
                ? `Reescrevendo card ${enrichProgress.index + 1}/${enrichProgress.total}…`
                : enrichProgress.estagio === 'gerando-mnemonico'
                ? 'Gerando mnemônicos…'
                : `Gerando imagem ${enrichProgress.index + 1}/${enrichProgress.total}…`}
            </span>
          </span>
          {enrichProgress.erro && <span className="shrink-0 text-amber-600">erro</span>}
        </div>
      )}
    </div>
  );
}
