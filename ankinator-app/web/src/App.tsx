import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from './api';
import type { ChunkProgress, ExtractResult, GenerateOptions, Questao } from './types';
import { Stepper, type Step } from './components/Stepper';
import { FileDrop } from './components/FileDrop';
import { StructurePanel } from './components/StructurePanel';
import { ProgressPanel } from './components/ProgressPanel';
import { CardTable } from './components/CardTable';
import { ExportBar } from './components/ExportBar';

export function App() {
  const [step, setStep] = useState<Step>('upload');
  const [hasApiKey, setHasApiKey] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [extract, setExtract] = useState<ExtractResult | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [options, setOptions] = useState<GenerateOptions>({ maxPerChunk: 15, incluirExtraidas: true, incluirCriadas: true });
  const [tagsInput, setTagsInput] = useState('concurso');

  const [progress, setProgress] = useState<ChunkProgress[]>([]);
  const [totalChunks, setTotalChunks] = useState(0);
  const [cards, setCards] = useState<Questao[]>([]);
  const [dropped, setDropped] = useState<Set<string>>(new Set());
  const esRef = useRef<EventSource | null>(null);

  const tags = useMemo(() => tagsInput.split(/\s+/).map((t) => t.trim()).filter(Boolean), [tagsInput]);

  useEffect(() => {
    api.health().then((h) => setHasApiKey(h.hasApiKey)).catch(() => setHasApiKey(false));
    return () => esRef.current?.close();
  }, []);

  // --- Upload + extração ---
  const handleFile = async (file: File) => {
    setError(null);
    setBusy(true);
    try {
      const { docId } = await api.upload(file);
      const result = await api.extract(docId);
      setExtract(result);
      setSelected(new Set(result.sections.map((s) => s.id)));
      setStep('structure');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  // --- Geração ---
  const handleGenerate = async () => {
    if (!extract) return;
    setError(null);
    setBusy(true);
    setProgress([]);
    setCards([]);
    setDropped(new Set());
    try {
      const { jobId, totalChunks } = await api.generate(extract.docId, [...selected], { ...options, tags });
      setTotalChunks(totalChunks);
      setStep('generating');

      const es = api.jobEvents(jobId);
      esRef.current = es;
      es.addEventListener('progress', (ev) => {
        const data = JSON.parse((ev as MessageEvent).data) as ChunkProgress;
        setProgress((prev) => [...prev, data]);
      });
      es.addEventListener('done', async () => {
        es.close();
        const job = await api.job(jobId);
        setCards(job.questoes);
        setStep('review');
        setBusy(false);
      });
      es.addEventListener('error', async () => {
        es.close();
        const job = await api.job(jobId).catch(() => null);
        if (job?.error) setError(job.error);
        else setError('Falha na geração (conexão perdida).');
        setBusy(false);
        setStep('structure');
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  const reset = () => {
    esRef.current?.close();
    setStep('upload');
    setExtract(null);
    setSelected(new Set());
    setProgress([]);
    setCards([]);
    setDropped(new Set());
    setError(null);
  };

  const keptCards = useMemo(() => cards.filter((c) => !dropped.has(c.id)), [cards, dropped]);

  return (
    <div className="mx-auto flex min-h-full max-w-5xl flex-col px-4 py-8">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="text-3xl">🎴</span>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Ankinator</h1>
            <p className="text-sm text-slate-500">PDF de estudo → flashcards do Anki</p>
          </div>
        </div>
        <Stepper current={step} />
      </header>

      {error && (
        <div className="mb-6 flex items-start justify-between gap-3 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="font-medium text-rose-500 hover:text-rose-700">
            ✕
          </button>
        </div>
      )}

      <main className="flex-1">
        {step === 'upload' && <FileDrop onFile={handleFile} busy={busy} />}

        {step === 'structure' && extract && (
          <StructurePanel
            extract={extract}
            selected={selected}
            onToggle={(id) =>
              setSelected((prev) => {
                const next = new Set(prev);
                next.has(id) ? next.delete(id) : next.add(id);
                return next;
              })
            }
            onSelectAll={(all) => setSelected(all ? new Set(extract.sections.map((s) => s.id)) : new Set())}
            options={options}
            setOptions={setOptions}
            tagsInput={tagsInput}
            setTagsInput={setTagsInput}
            onGenerate={handleGenerate}
            hasApiKey={hasApiKey}
            busy={busy}
          />
        )}

        {step === 'generating' && extract && (
          <ProgressPanel total={totalChunks} progress={progress} fileName={extract.fileName} />
        )}

        {step === 'review' && extract && (
          <>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-800">{cards.length} questões geradas</h2>
                <p className="text-sm text-slate-500">Revise e edite antes de exportar. {extract.fileName}</p>
              </div>
              <button onClick={reset} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50">
                Novo PDF
              </button>
            </div>
            <CardTable
              cards={cards}
              dropped={dropped}
              onEdit={(id, field, value) => setCards((prev) => prev.map((c) => (c.id === id ? { ...c, [field]: value } : c)))}
              onToggleDrop={(id) =>
                setDropped((prev) => {
                  const next = new Set(prev);
                  next.has(id) ? next.delete(id) : next.add(id);
                  return next;
                })
              }
            />
            <ExportBar cards={keptCards} fonte={extract.fileName} tags={tags} />
          </>
        )}
      </main>

      <footer className="mt-10 text-center text-xs text-slate-400">
        Ankinator · extração com OpenDataLoader · geração com Claude
      </footer>
    </div>
  );
}
