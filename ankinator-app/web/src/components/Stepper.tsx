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
    <ol className="flex items-center gap-2 text-sm">
      {STEPS.map((s, i) => {
        const state = i < idx ? 'done' : i === idx ? 'active' : 'todo';
        return (
          <li key={s.key} className="flex items-center gap-2">
            <span
              className={[
                'flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition',
                state === 'done' && 'bg-brand-600 text-white',
                state === 'active' && 'bg-brand-100 text-brand-700 ring-2 ring-brand-500',
                state === 'todo' && 'bg-slate-200 text-slate-500',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {state === 'done' ? '✓' : i + 1}
            </span>
            <span className={state === 'todo' ? 'text-slate-400' : 'text-slate-700 font-medium'}>{s.label}</span>
            {i < STEPS.length - 1 && <span className="mx-1 h-px w-6 bg-slate-300" />}
          </li>
        );
      })}
    </ol>
  );
}
