import { useCallback, useRef, useState } from 'react';
import { IconFileUp, IconSpinner } from './icons';

export function FileDrop({ onFile, busy }: { onFile: (file: File) => void; busy: boolean }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      const file = files?.[0];
      if (!file) return;
      if (!file.name.toLowerCase().endsWith('.pdf')) {
        alert('Selecione um arquivo PDF.');
        return;
      }
      onFile(file);
    },
    [onFile]
  );

  const open = () => !busy && inputRef.current?.click();

  return (
    <div
      role="button"
      tabIndex={busy ? -1 : 0}
      aria-label="Selecionar arquivo PDF"
      aria-busy={busy}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        handleFiles(e.dataTransfer.files);
      }}
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          open();
        }
      }}
      className={[
        'mx-auto flex w-full max-w-xl cursor-pointer flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed px-6 py-10 text-center shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 sm:px-8 sm:py-16',
        dragging
          ? 'scale-[1.01] border-brand-500 bg-brand-50'
          : 'border-slate-300 bg-white hover:border-brand-400 hover:bg-slate-50',
        busy && 'pointer-events-none opacity-70',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-50 text-brand-500">
        {busy ? <IconSpinner className="h-8 w-8 animate-spin" /> : <IconFileUp className="h-8 w-8" />}
      </span>
      <div className="text-lg font-semibold text-slate-800 sm:text-xl">
        {busy ? 'Processando…' : dragging ? 'Solte o PDF para enviar' : 'Arraste um PDF aqui ou clique para selecionar'}
      </div>
      <p className="max-w-md text-sm text-slate-500">
        Apostilas, aulas e materiais de concurso. O conteúdo é estruturado com o OpenDataLoader e
        transformado em flashcards do Anki.
      </p>
    </div>
  );
}
