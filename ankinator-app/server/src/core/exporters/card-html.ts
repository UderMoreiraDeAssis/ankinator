/**
 * Construtor de HTML educacional rico para cards do Anki.
 *
 * Gera HTML autocontido com inline CSS — funciona tanto em campos importados via
 * CSV quanto em notas enviadas via AnkiConnect (Basic notes Front/Back).
 *
 * Segurança (RICH-01):
 * - TODOS os textos passam por escapeHtml antes de entrar no HTML.
 * - O único conteúdo bruto é o SVG, que DEVE ser re-sanitizado via sanitizarSvg
 *   no boundary de export (CR-01/WR-01). Nunca chamar escapeHtml no SVG.
 */
import type { Questao } from '../types.js';
import { sanitizarSvg } from '../specialists/sanitize-svg.js';

/** Escapa caracteres perigosos em HTML e converte newlines em <br>. */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/\n/g, '<br>');
}

/**
 * Separa o enunciado das alternativas de múltipla escolha embutidas no texto.
 * Detecta marcadores "A)" "B)" ... (A-E, maiúsc/minúsc) em sequência iniciando em A.
 */
export function splitOpcoes(pergunta: string): { stem: string; opcoes: string[] } {
  const re = /(^|\s)([A-Ea-e])\)\s/g;
  const marks: { idx: number; letter: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(pergunta)) !== null) {
    marks.push({ idx: m.index + m[1].length, letter: m[2].toUpperCase() });
  }
  if (marks.length < 2 || marks[0].letter !== 'A') return { stem: pergunta.trim(), opcoes: [] };
  const stem = pergunta.slice(0, marks[0].idx).trim();
  const opcoes: string[] = [];
  for (let i = 0; i < marks.length; i++) {
    const end = i + 1 < marks.length ? marks[i + 1].idx : pergunta.length;
    opcoes.push(pergunta.slice(marks[i].idx, end).trim());
  }
  return { stem, opcoes };
}

/**
 * Renderiza alternativas como lista estilizada (cada uma em sua linha, com letra).
 * Aceita opções já com marcador ("A) ...") ou sem (prefixa "A)" pelo índice). Tudo escapado.
 */
export function renderOpcoesList(opcoes: string[]): string {
  if (!opcoes.length) return '';
  const itens = opcoes.map((op, i) => {
    const raw = op.trim();
    const temLetra = /^[A-Ea-e][\).]/.test(raw) || /^\([A-Ea-e]\)/.test(raw);
    const txt = temLetra ? raw : `${String.fromCharCode(65 + i)}) ${raw}`;
    return `<li style="padding:7px 11px;margin:5px 0;background:#f9fafb;border:1px solid #e5e7eb;border-radius:7px;font-size:15px;line-height:1.45;color:#374151;">${escapeHtml(txt)}</li>`;
  }).join('');
  return `<ol style="margin:12px 0 0;padding:0;list-style:none;">${itens}</ol>`;
}

/**
 * Retorna o label do deck para exibição no cabeçalho do card.
 * Substitui '::' por ' · '. Se não houver deck, usa a primeira tag ou 'Card'.
 */
function deckLabel(q: Questao): string {
  if (q.deck) {
    return escapeHtml(q.deck.replace(/::/g, ' · '));
  }
  if (q.tags && q.tags.length > 0) {
    return escapeHtml(q.tags[0]);
  }
  return 'Card';
}

/**
 * Constrói o HTML da frente (Front) do card.
 *
 * Estrutura:
 * - Barra deck/tag com gradiente índigo
 * - Bloco branco com a pergunta (enunciado separado das alternativas)
 * - Lista estilizada de alternativas (quando presentes — MC questions)
 */
export function buildFrontHtml(q: Questao): string {
  const label = deckLabel(q);
  const parsed = splitOpcoes(q.pergunta);
  const opcoes = (q.metadata?.alternativas?.length ?? 0) >= 2
    ? q.metadata!.alternativas!
    : parsed.opcoes;
  const stem = parsed.opcoes.length ? parsed.stem : q.pergunta;
  const stemHtml = escapeHtml(stem);
  const listHtml = renderOpcoesList(opcoes);

  return (
    `<div style="font-family:-apple-system,'Segoe UI',Roboto,sans-serif;max-width:680px;margin:0 auto;text-align:left;">` +
    `<div style="display:flex;align-items:center;gap:8px;padding:8px 14px;border-radius:10px 10px 0 0;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;font-size:13px;font-weight:600;">` +
    `\u{1F4D8} <span>${label}</span>` +
    `</div>` +
    `<div style="padding:18px 16px;font-size:19px;line-height:1.5;color:#1f2937;background:#fff;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 10px 10px;">` +
    `${stemHtml}` +
    `${listHtml}` +
    `</div>` +
    `</div>`
  );
}

/**
 * Constrói o HTML do verso (Back) do card.
 *
 * Estrutura:
 * - Seção resposta (verde) com gabarito e alternativas opcionais
 * - Seção mnemônico (âmbar) com SVG inline opcional
 * - Rodapé de fonte opcional
 *
 * @param q - Questão com os dados do card.
 * @param fonte - Nome base do arquivo fonte (sem extensão), para rodapé.
 */
export function buildBackHtml(q: Questao, fonte?: string): string {
  const resposta = escapeHtml(q.resposta);
  const m = q.metadata;

  // ── Seção resposta (sempre presente) ────────────────────────────────────────
  let respostaSection =
    `<div style="padding:14px 16px;background:#ecfdf5;border-left:4px solid #10b981;border-radius:8px;margin-bottom:12px;">` +
    `<div style="font-size:12px;font-weight:700;color:#059669;letter-spacing:.04em;text-transform:uppercase;">✅ Resposta</div>` +
    `<div style="font-size:17px;line-height:1.5;color:#111827;margin-top:4px;">${resposta}</div>`;

  if (m?.gabarito) {
    respostaSection +=
      `<div style="margin-top:8px;font-size:14px;color:#374151;"><b>Gabarito:</b> ${escapeHtml(m.gabarito)}</div>`;
  }

  const backOpcoes = (m?.alternativas?.length ?? 0) >= 1
    ? m!.alternativas!
    : splitOpcoes(q.pergunta).opcoes;
  if (backOpcoes.length) {
    respostaSection +=
      `<div style="margin-top:8px;font-size:14px;color:#374151;font-weight:600;">Alternativas:</div>` +
      renderOpcoesList(backOpcoes);
  }

  respostaSection += `</div>`;

  // ── Seção mnemônico (gate: só quando q.mnemonico presente — PIPE-03) ─────────
  let mnemonicoSection = '';
  if (q.mnemonico) {
    const mnemonicoTexto = escapeHtml(q.mnemonico);

    // CR-01: re-sanitizar SVG no boundary de export
    // Fail-closed (D-08): descarta se inválido. Idempotente para SVG já limpo.
    // NUNCA chamar escapeHtml() no SVG — Pitfall 2 / D-11
    let svgBlock = '';
    if (q.mnemonicoSvg) {
      const svgLimpo = sanitizarSvg(q.mnemonicoSvg);
      if (svgLimpo) {
        svgBlock =
          `<div style="margin-top:10px;text-align:center;">${svgLimpo}</div>`;
      }
    }

    mnemonicoSection =
      `<div style="padding:14px 16px;background:#fffbeb;border-left:4px solid #f59e0b;border-radius:8px;margin-bottom:12px;">` +
      `<div style="font-size:12px;font-weight:700;color:#b45309;letter-spacing:.04em;text-transform:uppercase;">\u{1F4A1} Mnemônico</div>` +
      `<div style="font-size:16px;line-height:1.5;color:#1f2937;margin-top:4px;">${mnemonicoTexto}</div>` +
      svgBlock +
      `</div>`;
  }

  // ── Rodapé de fonte (gate: só quando fonte ou pageStart presente) ─────────────
  let fonteFooter = '';
  if (fonte || q.pageStart) {
    const src = fonte ? escapeHtml(fonte) : '';
    let pg = '';
    if (q.pageStart) {
      pg = q.pageStart === q.pageEnd
        ? ` (p.${q.pageStart})`
        : ` (p.${q.pageStart}-${q.pageEnd})`;
    }
    fonteFooter =
      `<div style="font-size:12px;color:#6b7280;margin-top:8px;">\u{1F4CE} ${src}${pg}</div>`;
  }

  return (
    `<div style="font-family:-apple-system,'Segoe UI',Roboto,sans-serif;max-width:680px;margin:0 auto;text-align:left;">` +
    respostaSection +
    mnemonicoSection +
    fonteFooter +
    `</div>`
  );
}
