import { useState } from 'react';
import type { ExtractResult, GenerateOptions } from '../types';
import type { DeckRef } from '../api';
import { DeckBasePicker } from './DeckBasePicker';
import { IconBook, IconBulb, IconEye, IconImage, IconLayers, IconSliders, IconSparkles, IconSpinner, IconTag } from './icons';

interface Props {
  extract: ExtractResult;
  selected: Set<string>;
  onToggle: (id: string) => void;
  onSelectAll: (all: boolean) => void;
  options: GenerateOptions;
  setOptions: (o: GenerateOptions) => void;
  tagsInput: string;
  setTagsInput: (s: string) => void;
  setDeckSource: (d: DeckRef | null) => void;
  onGenerate: () => void;
  canGenerate: boolean;
  provider: 'cli' | 'api';
  busy: boolean;
}

export function StructurePanel(props: Props) {
  const { extract, selected, onToggle, onSelectAll, options, setOptions, tagsInput, setTagsInput, setDeckSource, onGenerate, canGenerate, provider, busy } = props;
  // Bloco cujo conteúdo extraído está em prévia (null = nenhum). Antes só o início do
  // documento era visível; agora a prévia segue o bloco que o usuário escolhe inspecionar.
  const [previewId, setPreviewId] = useState<string | null>(null);
  const previewSection = previewId ? extract.sections.find((s) => s.id === previewId) ?? null : null;
  const allSelected = selected.size === extract.sections.length;
  const selectedChars = extract.sections.filter((s) => selected.has(s.id)).reduce((a, s) => a + s.charCount, 0);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      {/* Seções */}
      <div className="min-w-0 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-base font-semibold text-slate-800 dark:text-slate-100">
              <IconLayers className="h-5 w-5 shrink-0 text-brand-600 dark:text-brand-400" />
              Estrutura do documento
            </h2>
            <p className="break-words text-sm text-slate-500 dark:text-slate-400">
              {extract.fileName} · {extract.numPages} página(s) · {extract.sections.length} seção(ões)
              {extract.usedOcr && <span className="ml-2 rounded bg-amber-100 dark:bg-amber-500/15 px-1.5 py-0.5 text-xs text-amber-700 dark:text-amber-300">OCR</span>}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              onClick={() => onSelectAll(true)}
              disabled={allSelected}
              className="rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Selecionar tudo
            </button>
            <button
              onClick={() => onSelectAll(false)}
              disabled={selected.size === 0}
              className="rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Desmarcar tudo
            </button>
          </div>
        </div>

        <ul className="max-h-[420px] divide-y divide-slate-100 dark:divide-slate-800 overflow-y-auto rounded-lg border border-slate-100 dark:border-slate-800">
          {extract.sections.map((s) => (
            <li key={s.id} className={`flex items-center gap-1 pr-1.5 ${previewId === s.id ? 'bg-brand-50 dark:bg-brand-500/15' : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'}`}>
              <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 px-3 py-2.5">
                <input
                  type="checkbox"
                  checked={selected.has(s.id)}
                  onChange={() => onToggle(s.id)}
                  className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-brand-600 focus:ring-brand-500"
                />
                <span className="min-w-0 flex-1" style={{ paddingLeft: `${Math.max(0, (s.level - 1) * 12)}px` }}>
                  <span className="block truncate text-sm font-medium text-slate-700 dark:text-slate-200">{s.title}</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    p.{s.pageStart}
                    {s.pageEnd !== s.pageStart ? `–${s.pageEnd}` : ''} · {(s.charCount / 1000).toFixed(1)}k car.
                    {s.aviso && (
                      <span
                        className="ml-1.5 rounded bg-amber-100 dark:bg-amber-500/15 px-1 py-0.5 font-medium text-amber-700 dark:text-amber-300"
                        title={s.aviso}
                      >
                        ⚠ revisar
                      </span>
                    )}
                  </span>
                </span>
              </label>
              <button
                type="button"
                onClick={() => setPreviewId((cur) => (cur === s.id ? null : s.id))}
                aria-pressed={previewId === s.id}
                aria-label={`Prévia do bloco: ${s.title}`}
                title="Ver o conteúdo extraído deste bloco"
                className={[
                  'shrink-0 rounded-lg p-1.5 transition',
                  previewId === s.id
                    ? 'bg-brand-100 dark:bg-brand-500/20 text-brand-700 dark:text-brand-300'
                    : 'text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 dark:hover:text-slate-300',
                ].join(' ')}
              >
                <IconEye className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>

        {/* Prévia do bloco SELECIONADO (não mais só o início do documento). Útil para
            conferir a fidelidade da extração bloco a bloco — ex.: alternativas A–E. */}
        {previewSection ? (
          <div className="mt-3 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
            <div className="flex items-start justify-between gap-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 px-3 py-2">
              <div className="min-w-0">
                <p className="break-words text-sm font-medium text-slate-700 dark:text-slate-200">{previewSection.title}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  p.{previewSection.pageStart}
                  {previewSection.pageEnd !== previewSection.pageStart ? `–${previewSection.pageEnd}` : ''} ·{' '}
                  {(previewSection.charCount / 1000).toFixed(1)}k caracteres
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewId(null)}
                aria-label="Fechar prévia"
                className="-m-1 shrink-0 rounded p-1 text-slate-400 dark:text-slate-500 transition hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 dark:hover:text-slate-300"
              >
                ✕
              </button>
            </div>
            <pre className="max-h-72 overflow-auto whitespace-pre-wrap bg-slate-900 p-3 text-xs text-slate-200">
              {previewSection.markdown || '(bloco sem conteúdo textual extraído)'}
            </pre>
          </div>
        ) : (
          <p className="mt-3 flex items-center gap-1.5 text-sm text-slate-400 dark:text-slate-500">
            Clique no ícone <IconEye className="inline h-4 w-4" /> de um bloco para ver seu conteúdo extraído.
          </p>
        )}
      </div>

      {/* Opções de geração */}
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5">
        <h2 className="flex items-center gap-2 text-base font-semibold text-slate-800 dark:text-slate-100">
          <IconSliders className="h-5 w-5 shrink-0 text-brand-600 dark:text-brand-400" />
          Opções de geração
        </h2>

        <label className="flex items-center justify-between text-sm text-slate-700 dark:text-slate-200">
          <span>Questões extraídas (provas)</span>
          <input
            type="checkbox"
            checked={options.incluirExtraidas !== false}
            onChange={(e) => setOptions({ ...options, incluirExtraidas: e.target.checked })}
            className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-brand-600"
          />
        </label>
        <label className="flex items-center justify-between text-sm text-slate-700 dark:text-slate-200">
          <span>Questões criadas (conceitos)</span>
          <input
            type="checkbox"
            checked={options.incluirCriadas !== false}
            onChange={(e) => setOptions({ ...options, incluirCriadas: e.target.checked })}
            className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-brand-600"
          />
        </label>

        <label className="text-sm text-slate-700 dark:text-slate-200">
          <span className="mb-1 block">Máx. de questões por bloco: {options.maxPerChunk ?? 15}</span>
          <input
            type="range"
            min={3}
            max={30}
            value={options.maxPerChunk ?? 15}
            onChange={(e) => setOptions({ ...options, maxPerChunk: Number(e.target.value) })}
            className="w-full accent-brand-600"
          />
        </label>

        <label className="text-sm text-slate-700 dark:text-slate-200">
          <span className="mb-1 block">Tags padrão (separadas por espaço)</span>
          <input
            type="text"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder="concurso pmbok"
            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
          />
        </label>

        <div className="rounded-lg bg-slate-50 dark:bg-slate-800/60 p-3 text-xs text-slate-500 dark:text-slate-400">
          {selected.size} seção(ões) · ~{(selectedChars / 1000).toFixed(1)}k caracteres selecionados
        </div>

        {/* Bloco "Modo educativo" (D-14) — toggles em formato de cartão (ícone + descrição).
            Phase 4 adiciona aqui: mnemônico e imagem. */}
        <div className="border-t border-slate-100 dark:border-slate-800 pt-3">
          <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            <IconSparkles className="h-4 w-4 text-violet-500" />
            Modo educativo
          </h3>
          <div className="space-y-2">
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 dark:border-slate-700 p-3 transition hover:border-brand-400 hover:bg-slate-50 dark:hover:bg-slate-800/60">
              <span className="mt-0.5 shrink-0 text-violet-500">
                <IconTag className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-slate-700 dark:text-slate-200">Classificar deck + tags</span>
                <span className="block text-xs text-slate-500 dark:text-slate-400">Organiza em deck hierárquico e adiciona tags.</span>
              </span>
              <input
                type="checkbox"
                checked={options.classificar !== false}
                onChange={(e) => setOptions({ ...options, classificar: e.target.checked })}
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 dark:border-slate-600 text-brand-600"
              />
            </label>
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 dark:border-slate-700 p-3 transition hover:border-brand-400 hover:bg-slate-50 dark:hover:bg-slate-800/60">
              <span className="mt-0.5 shrink-0 text-emerald-500">
                <IconBook className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-slate-700 dark:text-slate-200">Card educativo</span>
                <span className="block text-xs text-slate-500 dark:text-slate-400">Reescreve a resposta de forma atômica e didática.</span>
              </span>
              <input
                type="checkbox"
                checked={options.cardBuilder === true}
                onChange={(e) => setOptions({ ...options, cardBuilder: e.target.checked })}
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 dark:border-slate-600 text-brand-600"
              />
            </label>
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 dark:border-slate-700 p-3 transition hover:border-brand-400 hover:bg-slate-50 dark:hover:bg-slate-800/60">
              <span className="mt-0.5 shrink-0 text-amber-500">
                <IconBulb className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-slate-700 dark:text-slate-200">Mnemônico</span>
                <span className="block text-xs text-slate-500 dark:text-slate-400">Cria uma técnica de memorização para o card.</span>
              </span>
              <input
                type="checkbox"
                checked={options.mnemonico !== false}
                onChange={(e) => setOptions({ ...options, mnemonico: e.target.checked })}
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 dark:border-slate-600 text-brand-600"
              />
            </label>
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 dark:border-slate-700 p-3 transition hover:border-brand-400 hover:bg-slate-50 dark:hover:bg-slate-800/60">
              <span className="mt-0.5 shrink-0 text-sky-500">
                <IconImage className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-slate-700 dark:text-slate-200">Imagem de mnemônico</span>
                <span className="block text-xs text-slate-500 dark:text-slate-400">Gera um SVG ilustrando o mnemônico.</span>
              </span>
              <input
                type="checkbox"
                checked={options.imagem === true}
                onChange={(e) => setOptions({ ...options, imagem: e.target.checked })}
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 dark:border-slate-600 text-brand-600"
              />
            </label>
          </div>
        </div>

        {/* Deck base (opcional) — geração incremental: só o que falta no PDF. */}
        <DeckBasePicker onChange={setDeckSource} disabled={busy} />

        <div className="rounded-lg bg-slate-50 dark:bg-slate-800/60 p-2 text-center text-xs text-slate-500 dark:text-slate-400">
          Geração via{' '}
          {provider === 'cli' ? (
            <span className="font-medium text-emerald-700 dark:text-emerald-300">assinatura (Claude Code) · sem custo de API</span>
          ) : (
            <span className="font-medium text-brand-700 dark:text-brand-300">API Anthropic · por token</span>
          )}
        </div>

        {!canGenerate && (
          <div className="rounded-lg bg-amber-50 dark:bg-amber-900/30 p-3 text-xs text-amber-700 dark:text-amber-300">
            ⚠️ Geração indisponível: provedor <code>api</code> sem <code>ANTHROPIC_API_KEY</code>. Configure o <code>.env</code> ou use <code>ANKINATOR_PROVIDER=cli</code>.
          </div>
        )}

        <button
          onClick={onGenerate}
          disabled={!canGenerate || selected.size === 0 || busy}
          className="mt-1 inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {busy ? (
            <>
              <IconSpinner className="h-4 w-4 animate-spin" />
              Gerando…
            </>
          ) : (
            `Gerar questões (${selected.size} ${selected.size === 1 ? 'seção' : 'seções'})`
          )}
        </button>
      </div>
    </div>
  );
}
