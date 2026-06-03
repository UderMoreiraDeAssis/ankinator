---
name: mnemonic-image
description: "Especialista de imagem de mnemônico para concurso público: gera uma ilustração vetorial SVG autocontida (sem API/billing, sem raster) que reforça visualmente um mnemônico de flashcard — auxílio de memória, não decoração."
---

# Mnemonic Image

O conteúdo canônico (system prompt + conhecimento) deste especialista vive em
`ankinator-app/server/src/core/specialists/prompts/mnemonic-image.md` — esta é a ÚNICA fonte.
Leia esse arquivo e siga-o como sua especificação. NÃO duplique o texto aqui.

> Padrão de fonte única (progressive disclosure): a Skill descreve QUANDO usar e aponta para o
> `.md` canônico; o corpo da especificação não é copiado para evitar duas fontes divergentes.

## Quando usar

- Quando já existe um **mnemônico** (campo `mnemonico`) e se quer um reforço **visual** que ajude a fixá-lo.
- Quando se precisa de uma imagem **SVG autocontida** (vetor gerado pelo Claude, sem serviço externo pago).
- Para popular o campo `mnemonicoSvg` do card — lembrando que o SVG deve ser sanitizado antes do embed (fases 3-4).
