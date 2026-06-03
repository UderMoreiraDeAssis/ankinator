# Ankinator 🎴

Transforma **PDFs de estudo** (apostilas, aulas, materiais de concurso) em **flashcards do Anki**, com:

- **Extração estruturada** via [OpenDataLoader](https://github.com/opendataloader-project) — ordem de leitura correta (multi-coluna), títulos, tabelas e nº de página real, em vez de texto plano embaralhado.
- **Geração de questões com o Claude** — aproveita as questões de prova já presentes no material **e** cria novas questões a partir dos conceitos, com fidelidade total ao texto.
- **App web local** — arraste o PDF, escolha as seções, gere, revise/edite os cards e exporte (CSV ou envio direto pro Anki via AnkiConnect).

```
PDF ─▶ OpenDataLoader (estrutura) ─▶ chunking semântico ─▶ Claude (extrair + criar)
    ─▶ revisão na UI ─▶ CSV  /  AnkiConnect
```

---

## Pré-requisitos

| Requisito | Para quê | Observação |
|---|---|---|
| **Node.js ≥ 20** | servidor + UI | testado em Node 24 |
| **Java ≥ 11** | OpenDataLoader (CLI Java) | `java -version` |
| **ANTHROPIC_API_KEY** | geração de questões | [console.anthropic.com](https://console.anthropic.com) |
| **Anki + add-on AnkiConnect** *(opcional)* | envio direto pro Anki | add-on código `2055492159` |
| **Python + `opendataloader-pdf[hybrid]`** *(opcional)* | OCR de PDFs escaneados | defina `ODL_PYTHON` |

> Sem API key o app ainda **extrai e mostra a estrutura** do PDF; só a geração de questões fica desabilitada.
> Sem Anki aberto, a exportação **CSV** continua funcionando normalmente.

---

## Setup

```bash
cd ankinator-app

# 1. Instalar dependências (server + web)
npm install

# 2. Configurar variáveis de ambiente
cp .env.example .env
#   edite .env e preencha ANTHROPIC_API_KEY
```

Variáveis (`.env`):

| Variável | Padrão | Descrição |
|---|---|---|
| `ANTHROPIC_API_KEY` | — | chave da Anthropic (geração de questões) |
| `ANKINATOR_MODEL` | `claude-sonnet-4-6` | modelo do Claude |
| `PORT` | `8787` | porta do servidor de API |
| `ANKICONNECT_URL` | `http://127.0.0.1:8765` | endpoint do AnkiConnect |
| `ODL_PYTHON` | — | interpretador Python com o backend híbrido (OCR) |

---

## Uso

### Desenvolvimento (hot-reload)

```bash
npm run dev          # sobe API (8787) + Vite (5173) juntos
# abra http://localhost:5173
```

### Produção (um único processo)

```bash
npm run build        # compila server e gera o bundle do front-end
npm start            # serve API + UI em http://localhost:8787
```

### Fluxo na interface

1. **Enviar PDF** — arraste o arquivo.
2. **Estrutura** — veja as seções detectadas; marque o que quer estudar; ajuste opções (extraídas/criadas, máx. por bloco, tags).
3. **Gerar** — acompanhe o progresso ao vivo (um bloco por seção/assunto).
4. **Revisar & Exportar** — edite ou descarte cards; baixe o **CSV** ou clique em **Enviar** para mandar pro Anki aberto.

---

## Arquitetura

```
ankinator-app/
├── server/                      # API Node/TS (Express)
│   └── src/
│       ├── core/
│       │   ├── document-loader.ts   # OpenDataLoader (Java) → markdown + seções
│       │   ├── ocr-loader.ts        # caminho OCR (backend Python, opcional)
│       │   ├── odl-parse.ts         # parser do JSON do OpenDataLoader
│       │   ├── chunker.ts           # chunking semântico por seção
│       │   ├── question-generator.ts# Claude (tool-use + prompt caching)
│       │   ├── prompts.ts           # prompts de fidelidade (extrair + criar)
│       │   └── exporters/{csv,ankiconnect}.ts
│       ├── api.ts                   # rotas HTTP
│       └── index.ts                 # bootstrap (serve a UI em produção)
└── web/                         # UI React + Vite + Tailwind
    └── src/{App.tsx, api.ts, components/*}
```

### Importação no Anki (CSV)

O CSV usa `;` como separador e UTF-8 com BOM. Campos: **Frente · Verso · Tags · Fonte**.
No Anki: *Importar arquivo* → separador `;` → mapeie os campos.

---

## Notas sobre o OpenDataLoader

- O pacote `@opendataloader/pdf` é um wrapper sobre um **CLI Java** (por isso o JDK 11+).
- Configuração afinada para apostilas de concurso: `tableMethod: cluster`, `readingOrder: xycut`, imagens desligadas; cabeçalho/rodapé e marca-d'água já são filtrados por padrão.
- **OCR**: o pipeline local (Java) **não** faz OCR de PDFs escaneados. Para isso há o backend híbrido Python (`pip install "opendataloader-pdf[hybrid]"` + `ODL_PYTHON`); o app detecta a disponibilidade e degrada graciosamente.
