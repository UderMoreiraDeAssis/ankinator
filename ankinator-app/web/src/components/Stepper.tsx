import { IconCheck } from './icons';

export type Step = 'upload' | 'structure' | 'generating' | 'review';

const STEPS: { key: Step; label: string }[] = [
  { key: 'upload', label: 'Enviar PDF' },
  { key: 'structure', label: 'Estrutura' },
  { key: 'generating', label: 'Gerar' },
  { key: 'review', label: 'Revisar & Exportar' },
];

export function Stepper({ current }: { current: Step }) {
  const idx = STEPS.findIndex((s) => s.key === current);
  return (
    <ol className="flex flex-wrap items-center gap-x-2 gap-y-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm shadow-sm">
      {STEPS.map((s, i) => {
        const state = i < idx ? 'done' : i === idx ? 'active' : 'todo';
        return (
          <li key={s.key} className="flex items-center gap-2" aria-current={state === 'active' ? 'step' : undefined}>
            <span
              className={[
                'flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition',
                state === 'done' && 'bg-brand-600 text-white',
                state === 'active' && 'bg-brand-100 dark:bg-brand-500/20 text-brand-700 dark:text-brand-300 ring-2 ring-brand-500',
                state === 'todo' && 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {state === 'done' ? <IconCheck className="h-4 w-4" /> : i + 1}
            </span>
            <span
              className={[
                'hidden sm:inline',
                state === 'active' ? 'font-semibold text-brand-700 dark:text-brand-300' : state === 'done' ? 'font-medium text-slate-700 dark:text-slate-200' : 'text-slate-500 dark:text-slate-400',
              ].join(' ')}
            >
              {s.label}
            </span>
            {i < STEPS.length - 1 && (
              <span className={`mx-1 h-0.5 w-6 rounded-full ${i < idx ? 'bg-brand-600' : 'bg-slate-300 dark:bg-slate-600'}`} />
            )}
          </li>
        );
      })}
    </ol>
  );
}
