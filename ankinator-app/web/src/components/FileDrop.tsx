import { useCallback, useRef, useState } from 'react';

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

  return (
    <div
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
      onClick={() => !busy && inputRef.current?.click()}
      className={[
        'flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-8 py-16 text-center transition',
        dragging ? 'border-brand-500 bg-brand-50' : 'border-slate-300 bg-white hover:border-brand-400 hover:bg-slate-50',
        busy && 'pointer-events-none opacity-60',
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
      <div className="text-5xl">{busy ? '⏳' : '📄'}</div>
      <div className="text-lg font-semibold text-slate-700">
        {busy ? 'Processando…' : 'Arraste um PDF aqui ou clique para selecionar'}
      </div>
      <p className="max-w-md text-sm text-slate-500">
        Apostilas, aulas e materiais de concurso. O conteúdo é estruturado com o OpenDataLoader e
        transformado em flashcards do Anki.
      </p>
    </div>
  );
}
