import type { ChunkProgress, EnrichProgress } from '../types';

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

  return (
    <div className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-8">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-800">Gerando questões…</h2>
        <span className="text-sm text-slate-500">
          {done}/{total} blocos
        </span>
      </div>
      <p className="mb-5 text-sm text-slate-500">{fileName}</p>

      <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-brand-600 transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-3 flex items-center justify-between text-sm">
        <span className="font-medium text-brand-700">{questoes} questões geradas</span>
        {erros > 0 && <span className="text-amber-600">{erros} bloco(s) com erro</span>}
      </div>

      <ul className="mt-5 max-h-56 space-y-1 overflow-y-auto text-xs">
        {progress.map((p) => (
          <li
            key={p.index}
            className={`flex items-center justify-between rounded px-2 py-1 ${p.erro ? 'bg-amber-50 text-amber-700' : 'text-slate-500'}`}
          >
            <span className="truncate">
              Bloco {p.index + 1}: {p.sectionTitles.join(' › ') || '—'}
            </span>
            <span className="ml-2 shrink-0 font-medium">{p.erro ? 'erro' : `+${p.questoesNoBloco}`}</span>
          </li>
        ))}
      </ul>

      {enrichProgress && (
        <div className="mt-3 flex items-center justify-between rounded bg-slate-50 px-2 py-1.5 text-xs text-slate-600">
          <span>
            {enrichProgress.estagio === 'classificando'
              ? 'Classificando deck + tags…'
              : enrichProgress.estagio === 'reescrevendo'
              ? `Reescrevendo card ${enrichProgress.index + 1}/${enrichProgress.total}…`
              : enrichProgress.estagio === 'gerando-mnemonico'
              ? 'Gerando mnemônicos…'
              : `Gerando imagem ${enrichProgress.index + 1}/${enrichProgress.total}…`}
          </span>
          {enrichProgress.erro && <span className="text-amber-600">erro</span>}
        </div>
      )}
    </div>
  );
}
