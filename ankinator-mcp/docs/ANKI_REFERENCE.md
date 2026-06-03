# Referências do Anki - Fontes de Dados

Este documento lista as fontes usadas para criar os dados estáticos da **Fase 3 - Anki References**.

**Data de criação:** 2025-11-22
**Versão do Ankimon:** V1.34
**Versão mínima do Anki:** 2.1.66

---

## 📋 Índice

1. [Versões do Anki](#versões-do-anki)
2. [Hooks do Anki](#hooks-do-anki)
3. [Instalação de Add-ons](#instalação-de-add-ons)
4. [Manutenção](#manutenção)

---

## Versões do Anki

**Arquivo:** `src/data/anki-versions.json`

### Fontes

**Primária:**
- `ankimon/addon.json`:
  - `"min_point_version": "2.1.66"`
  - `"max_tested_anki_version": "23.10.12"`
  - `"targets": ["anki21"]`

- `ankimon/src/Ankimon/manifest.json`:
  - Confirmação de compatibilidade com Anki 2.1.66+

**Secundária:**
- [Anki Releases Oficiais (GitHub)](https://github.com/ankitects/anki/releases)
- [Documentação oficial do Anki](https://docs.ankiweb.net/)

### Dados Extraídos

- **Versão mínima recomendada:** 2.1.66 (PyQt6 obrigatório)
- **Versão máxima testada:** 23.10.12 (baseado no Ankimon)
- **Breaking changes:**
  - PyQt5 descontinuado a partir de 2.1.66
  - Hook `reviewer_will_show_question` descontinuado
  - Mudanças na estrutura de templates de cards

### Versões Documentadas

1. **2.1.66** (2024-07-12) - PyQt6 obrigatório, PyQt5 descontinuado
2. **23.10.12** (2023-10-12) - Stable com PyQt6
3. **23.12.1** (2023-12-20) - Stable com PyQt6
4. **24.04.1** (2024-04-25) - Stable com PyQt6

---

## Hooks do Anki

**Arquivo:** `src/data/anki-hooks.json`

### Fontes

**Primária (código-fonte do Ankimon):**
- `ankimon/src/Ankimon/__init__.py`
- `ankimon/src/Ankimon/hooks.py`
- `ankimon/src/Ankimon/gui/windows.py`
- `ankimon/src/Ankimon/resources/manager.py`

**Secundária (documentação oficial):**
- [Anki Add-on Hooks Documentation](https://addon-docs.ankiweb.net/hooks-and-filters.html)
- [Código-fonte dos hooks (GitHub)](https://github.com/ankitects/anki/blob/main/qt/aqt/gui_hooks.py)

### Hooks Identificados (11 total)

Todos os hooks listados abaixo são **usados ativamente no Ankimon**:

#### Categoria: Reviewer (5 hooks)
1. `gui_hooks.reviewer_did_show_question` - Disparado após questão exibida
2. `gui_hooks.reviewer_did_show_answer` - Disparado após resposta exibida
3. `gui_hooks.reviewer_will_answer_card` - Antes de responder (pode cancelar)
4. `gui_hooks.reviewer_did_answer_card` - Após responder
5. `gui_hooks.card_will_show` - Antes de mostrar card (modifica HTML)

#### Categoria: Webview (1 hook)
6. `gui_hooks.webview_will_set_content` - Injeta HTML/CSS/JS em webviews

#### Categoria: Config (2 hooks)
7. `gui_hooks.addon_config_editor_will_save_json` - Antes de salvar config
8. `gui_hooks.addon_config_editor_will_display_json` - Antes de exibir config

#### Categoria: Sync (1 hook)
9. `gui_hooks.sync_did_finish` - Após sincronização com AnkiWeb

#### Categoria: Media (1 hook)
10. `gui_hooks.av_player_will_play` - Antes de tocar áudio/vídeo

#### Não categorizado (1 hook)
11. `gui_hooks.reviewer_will_end` - Quando revisor está prestes a fechar

### Estrutura de Dados

Para cada hook, documentamos:
- **Nome completo** (ex: `gui_hooks.reviewer_did_show_question`)
- **Categoria** (reviewer, webview, config, sync, media)
- **Descrição** clara do propósito
- **Parâmetros** com nome, tipo e descrição
- **Versões** (quando foi adicionado, se foi descontinuado)
- **Casos de uso comum** (3-5 exemplos práticos)
- **Exemplo de código** (sintaxe Python)
- **Flag `usado_em_ankimon`** (todos marcados como `true`)

### Nota sobre Versões

As informações de versão dos hooks são baseadas em:
- Anki 2.1.0 para hooks mais antigos (data genérica)
- Anki 2.1.20 para hooks mais recentes (ex: `webview_will_set_content`)
- Compatibilidade verificada com Anki 2.1.66+

---

## Instalação de Add-ons

**Arquivo:** `src/data/anki-installation.json`

### Fontes

**Primária (documentação do Ankimon):**
- `ankimon/HowToStart.md` - Guia completo de instalação
- `ankimon/README.md` - Visão geral e requisitos
- `ankimon/addon.json` - Código AnkiWeb: `1908235722`

**Secundária:**
- [Anki Manual - Add-ons](https://docs.ankiweb.net/addons.html)
- [AnkiWeb - Shared Add-ons](https://ankiweb.net/shared/info/1908235722)

### Dados Documentados

#### 1. Instalação Geral (via AnkiWeb)
- 4 passos básicos
- Código AnkiWeb no formato de 9-10 dígitos
- Atalhos de teclado: Ctrl+Shift+A (Win/Linux), Cmd+Shift+A (macOS)

#### 2. Instalação Manual (desenvolvimento)
- Localização da pasta de add-ons por SO:
  - **Windows:** `%APPDATA%/Anki2/addons21/`
  - **macOS:** `~/Library/Application Support/Anki2/addons21/`
  - **Linux:** `~/.local/share/Anki2/addons21/`
- 4 passos incluindo verificação

#### 3. Instalação do Ankimon (caso específico)
- **Código AnkiWeb:** 1908235722
- **6 passos detalhados:**
  1. Instalação via AnkiWeb
  2. Primeiro restart
  3. Download de recursos extras (~50MB)
  4. Segundo restart
  5. Escolha de starter Pokémon
  6. Terceiro restart final

- **Requisitos:**
  - Anki 2.1.66+ (PyQt6 obrigatório)
  - PyQt5 NÃO suportado
  - Linux: pacote oficial do GitHub (não flatpak/distro)
  - Conexão com internet para recursos extras

#### 4. Troubleshooting (5 problemas comuns)
1. **erro_pyqt5** - PyQt5 não suportado
2. **erro_arquivos_faltando** - Sprites/Pokémon não aparecem
3. **erro_linux** - Add-on não funciona em Linux
4. **erro_starter_nao_aparece** - Diálogo de escolha não apareceu
5. **erro_addon_desabilitado** - Ankimon desabilitado na lista

Cada problema documenta:
- **Sintoma** (o que o usuário vê)
- **Solução** (passos para resolver)

---

## Manutenção

### Quando Atualizar os Dados Estáticos

Os arquivos JSON em `src/data/` devem ser atualizados quando:

1. **Nova versão do Anki for lançada**
   - Atualizar `anki-versions.json`
   - Adicionar nova versão ao array `versoes`
   - Verificar breaking changes
   - Atualizar `versao_maxima_testada` se testado

2. **Hooks forem adicionados/descontinuados**
   - Atualizar `anki-hooks.json`
   - Adicionar novos hooks com documentação completa
   - Marcar hooks descontinuados em `versoes.descontinuado_em`
   - Atualizar `substituido_por` se aplicável

3. **Processo de instalação mudar**
   - Atualizar `anki-installation.json`
   - Modificar passos afetados
   - Adicionar novos troubleshooting se necessário

4. **Ankimon atualizar requisitos**
   - Verificar `ankimon/addon.json`
   - Atualizar versão mínima/máxima
   - Atualizar lista de requisitos
   - Verificar se novos hooks foram adicionados

### Processo de Atualização

1. **Editar JSON** em `src/data/`
2. **Copiar para dist:**
   ```bash
   cp src/data/*.json dist/data/
   ```
3. **Testar ferramentas:**
   ```bash
   npm run build
   npm test
   ```
4. **Validar manualmente:**
   ```bash
   npm run dev
   # Chamar ferramentas via cliente MCP
   ```
5. **Atualizar este arquivo** (`ANKI_REFERENCE.md`) com data de atualização

### Checklist de Validação

- [ ] JSON válido (sem erros de sintaxe)
- [ ] Todos os campos obrigatórios presentes
- [ ] URLs de releases estão corretos
- [ ] Exemplos de código funcionam
- [ ] Troubleshooting testado
- [ ] Testes de integração passando (100%)

---

## 📚 Links Úteis

**Documentação Oficial do Anki:**
- [Anki Manual](https://docs.ankiweb.net/)
- [Add-on Hooks Documentation](https://addon-docs.ankiweb.net/hooks-and-filters.html)
- [GitHub - Anki](https://github.com/ankitects/anki)

**Ankimon:**
- [AnkiWeb - Ankimon](https://ankiweb.net/shared/info/1908235722)
- Código local: `ankimon/` (add-on Python/PyQt6)

**Ferramentas MCP Fase 3:**
- `versoes_suportadas` - Lista versões compatíveis
- `instalacao_addon` - Guias de instalação
- `anki_hooks` - Documentação de hooks

---

**Última atualização:** 2025-11-22
**Baseado em:** Ankimon V1.34, Anki 2.1.66+
**Autor:** Fase 3 - MCP `anki-refs`
