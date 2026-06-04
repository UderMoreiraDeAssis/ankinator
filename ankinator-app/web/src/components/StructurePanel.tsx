import { useState } from 'react';
import type { ExtractResult, GenerateOptions } from '../types';

interface Props {
  extract: ExtractResult;
  selected: Set<string>;
  onToggle: (id: string) => void;
  onSelectAll: (all: boolean) => void;
  options: GenerateOptions;
  setOptions: (o: GenerateOptions) => void;
  tagsInput: string;
  setTagsInput: (s: string) => void;
  onGenerate: () => void;
  canGenerate: boolean;
  provider: 'cli' | 'api';
  busy: boolean;
}

export function StructurePanel(props: Props) {
  const { extract, selected, onToggle, onSelectAll, options, setOptions, tagsInput, setTagsInput, onGenerate, canGenerate, provider, busy } = props;
  const [showPreview, setShowPreview] = useState(false);
  const allSelected = selected.size === extract.sections.length;
  const selectedChars = extract.sections.filter((s) => selected.has(s.id)).reduce((a, s) => a + s.charCount, 0);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      {/* Seções */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-800">Estrutura do documento</h2>
            <p className="text-sm text-slate-500">
              {extract.fileName} · {extract.numPages} página(s) · {extract.sections.length} seção(ões)
              {extract.usedOcr && <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-700">OCR</span>}
            </p>
          </div>
          <button
            onClick={() => onSelectAll(!allSelected)}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            {allSelected ? 'Limpar' : 'Selecionar tudo'}
          </button>
        </div>

        <ul className="max-h-[420px] divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-100">
          {extract.sections.map((s) => (
            <li key={s.id}>
              <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={selected.has(s.id)}
                  onChange={() => onToggle(s.id)}
                  className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                />
                <span className="min-w-0 flex-1" style={{ paddingLeft: `${Math.max(0, (s.level - 1) * 12)}px` }}>
                  <span className="block truncate text-sm font-medium text-slate-700">{s.title}</span>
                  <span className="text-xs text-slate-400">
                    p.{s.pageStart}
                    {s.pageEnd !== s.pageStart ? `–${s.pageEnd}` : ''} · {(s.charCount / 1000).toFixed(1)}k car.
                  </span>
                </span>
              </label>
            </li>
          ))}
        </ul>

        <button
          onClick={() => setShowPreview((v) => !v)}
          className="mt-3 text-sm font-medium text-brand-600 hover:text-brand-700"
        >
          {showPreview ? '▾ Ocultar' : '▸ Mostrar'} prévia do conteúdo extraído
        </button>
        {showPreview && (
          <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-900 p-3 text-xs text-slate-200">
            {extract.markdownPreview}
          </pre>
        )}
      </div>

      {/* Opções de geração */}
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-base font-semibold text-slate-800">Opções de geração</h2>

        <label className="flex items-center justify-between text-sm text-slate-700">
          <span>Questões extraídas (provas)</span>
          <input
            type="checkbox"
            checked={options.incluirExtraidas !== false}
            onChange={(e) => setOptions({ ...options, incluirExtraidas: e.target.checked })}
            className="h-4 w-4 rounded border-slate-300 text-brand-600"
          />
        </label>
        <label className="flex items-center justify-between text-sm text-slate-700">
          <span>Questões criadas (conceitos)</span>
          <input
            type="checkbox"
            checked={options.incluirCriadas !== false}
            onChange={(e) => setOptions({ ...options, incluirCriadas: e.target.checked })}
            className="h-4 w-4 rounded border-slate-300 text-brand-600"
          />
        </label>

        <label className="text-sm text-slate-700">
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

        <label className="text-sm text-slate-700">
          <span className="mb-1 block">Tags padrão (separadas por espaço)</span>
          <input
            type="text"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder="concurso pmbok"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
          />
        </label>

        <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
          {selected.size} seção(ões) · ~{(selectedChars / 1000).toFixed(1)}k caracteres selecionados
        </div>

        {/* Bloco "Modo educativo" (D-14) — mesma estrutura dos checkboxes acima.
            Phase 4 adiciona aqui: mnemônico e imagem. */}
        <div className="border-t border-slate-100 pt-3">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Modo educativo
          </h3>
          <label className="flex items-center justify-between text-sm text-slate-700">
            <span>Classificar deck + tags</span>
            <input
              type="checkbox"
              checked={options.classificar !== false}
              onChange={(e) => setOptions({ ...options, classificar: e.target.checked })}
              className="h-4 w-4 rounded border-slate-300 text-brand-600"
            />
          </label>
          <label className="mt-2 flex items-center justify-between text-sm text-slate-700">
            <span>Card educativo</span>
            <input
              type="checkbox"
              checked={options.cardBuilder === true}
              onChange={(e) => setOptions({ ...options, cardBuilder: e.target.checked })}
              className="h-4 w-4 rounded border-slate-300 text-brand-600"
            />
          </label>
          <label className="mt-2 flex items-center justify-between text-sm text-slate-700">
            <span>Mnemônico</span>
            <input
              type="checkbox"
              checked={options.mnemonico !== false}
              onChange={(e) => setOptions({ ...options, mnemonico: e.target.checked })}
              className="h-4 w-4 rounded border-slate-300 text-brand-600"
            />
          </label>
          <label className="mt-2 flex items-center justify-between text-sm text-slate-700">
            <span>Imagem de mnemônico</span>
            <input
              type="checkbox"
              checked={options.imagem === true}
              onChange={(e) => setOptions({ ...options, imagem: e.target.checked })}
              className="h-4 w-4 rounded border-slate-300 text-brand-600"
            />
          </label>
        </div>

        <div className="rounded-lg bg-slate-50 p-2 text-center text-xs text-slate-500">
          Geração via{' '}
          {provider === 'cli' ? (
            <span className="font-medium text-emerald-700">assinatura (Claude Code) · sem custo de API</span>
          ) : (
            <span className="font-medium text-brand-700">API Anthropic · por token</span>
          )}
        </div>

        {!canGenerate && (
          <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-700">
            ⚠️ Geração indisponível: provedor <code>api</code> sem <code>ANTHROPIC_API_KEY</code>. Configure o <code>.env</code> ou use <code>ANKINATOR_PROVIDER=cli</code>.
          </div>
        )}

        <button
          onClick={onGenerate}
          disabled={!canGenerate || selected.size === 0 || busy}
          className="mt-1 rounded-xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {busy ? 'Gerando…' : `Gerar questões (${selected.size} seção${selected.size === 1 ? '' : 'ões'})`}
        </button>
      </div>
    </div>
  );
}
