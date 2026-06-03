/**
 * Changelog Parser (Fase 4)
 *
 * Helpers para parsing de CHANGELOG.md, update_txt.md e ROADMAP.md
 */

import {
  ChangelogEntry,
  RoadmapPhase,
  RoadmapData,
  ProjectStatus,
} from '../types/release-notes.js';

/**
 * Parser de CHANGELOG.md no formato Keep a Changelog
 *
 * Estrutura esperada:
 * ## [versão] - data
 * ### Categoria
 * - item
 *
 * @param content Conteúdo do CHANGELOG.md
 * @returns Array de entradas de changelog
 */
export function parseChangelog(content: string): ChangelogEntry[] {
  const entries: ChangelogEntry[] = [];
  const lines = content.split('\n');

  let currentEntry: ChangelogEntry | null = null;
  let currentCategory: string | null = null;

  // Regex para detectar versões: ## [0.1.0-alpha] - 2025-11-22
  const versionRegex = /^##\s+\[([^\]]+)\]\s*-\s*(.+)/;
  // Regex para detectar categorias: ### Added, ### Fixed, etc.
  const categoryRegex = /^###\s+(.+?)(?:\s+-\s+.*)?$/;
  // Regex para detectar bullets: - item
  const bulletRegex = /^-\s+(.+)/;

  for (const line of lines) {
    // Detectar nova versão
    const versionMatch = line.match(versionRegex);
    if (versionMatch) {
      // Salvar entry anterior se existir
      if (currentEntry) {
        entries.push(currentEntry);
      }

      const version = versionMatch[1];
      const date = versionMatch[2].trim();

      // Detectar tipo (alpha, beta, stable, unreleased)
      let type: ChangelogEntry['type'] | undefined;
      if (version.toLowerCase().includes('unreleased')) {
        type = 'unreleased';
      } else if (version.includes('alpha')) {
        type = 'alpha';
      } else if (version.includes('beta')) {
        type = 'beta';
      } else {
        type = 'stable';
      }

      currentEntry = {
        version,
        date,
        type,
        categories: {},
      };
      currentCategory = null;
      continue;
    }

    // Detectar nova categoria
    const categoryMatch = line.match(categoryRegex);
    if (categoryMatch && currentEntry) {
      const category = categoryMatch[1].trim();
      currentCategory = category;
      if (!currentEntry.categories[category]) {
        currentEntry.categories[category] = [];
      }
      continue;
    }

    // Detectar bullet point
    const bulletMatch = line.match(bulletRegex);
    if (bulletMatch && currentEntry && currentCategory) {
      const bullet = bulletMatch[1].trim();
      currentEntry.categories[currentCategory].push(bullet);
    }
  }

  // Adicionar última entry
  if (currentEntry) {
    entries.push(currentEntry);
  }

  return entries;
}

/**
 * Parser de update_txt.md do Ankimon
 *
 * Estrutura esperada:
 * ### 🚀 **Sneak Peek at Update v1.285!** 🚀
 * - 🛠️ Feature 1
 * - 🆕 Feature 2
 *
 * @param content Conteúdo do update_txt.md
 * @returns Single changelog entry do Ankimon
 */
export function parseUpdateTxt(content: string): ChangelogEntry | null {
  const lines = content.split('\n');

  // Regex para detectar versão: v1.285
  const versionRegex = /v(\d+\.\d+)/;
  let version = 'Unknown';

  // Detectar versão
  for (const line of lines) {
    const versionMatch = line.match(versionRegex);
    if (versionMatch) {
      version = `v${versionMatch[1]}`;
      break;
    }
  }

  // Se não encontrou versão, retornar null
  if (version === 'Unknown') {
    return null;
  }

  const categories: Record<string, string[]> = {
    Fixed: [],
    Added: [],
    Changed: [],
    Other: [],
  };

  // Mapeamento de emojis para categorias
  const emojiMap: Record<string, string> = {
    '🛠️': 'Fixed',
    '🔧': 'Fixed',
    '🆕': 'Added',
    '🎨': 'Changed',
    '🔄': 'Fixed',
    '🌟': 'Added',
  };

  // Coletar bullets
  const bulletRegex = /^-\s+(.+)/;
  for (const line of lines) {
    const bulletMatch = line.match(bulletRegex);
    if (bulletMatch) {
      const bullet = bulletMatch[1].trim();

      // Detectar categoria por emoji
      let category = 'Other';
      for (const [emoji, cat] of Object.entries(emojiMap)) {
        if (bullet.startsWith(emoji)) {
          category = cat;
          break;
        }
      }

      // Remover emoji do bullet
      const cleanBullet = bullet.replace(/^[🛠️🔧🆕🎨🔄🌟]\s*/, '');
      categories[category].push(cleanBullet);
    }
  }

  // Remover categorias vazias
  Object.keys(categories).forEach((cat) => {
    if (categories[cat].length === 0) {
      delete categories[cat];
    }
  });

  return {
    version,
    date: 'TBD',
    type: 'stable',
    categories,
  };
}

/**
 * Parser de ROADMAP.md
 *
 * Estrutura esperada:
 * ### Fase N — Nome
 * - [x] Completo
 * - [ ] Pendente
 *
 * @param content Conteúdo do ROADMAP.md
 * @returns Dados completos do roadmap
 */
export function parseRoadmap(content: string): RoadmapData {
  const lines = content.split('\n');
  const phases: RoadmapPhase[] = [];
  const nextActions: string[] = [];
  const risks: string[] = [];

  let currentPhase: RoadmapPhase | null = null;
  let inNextActions = false;
  let inRisks = false;

  // Regex para detectar fases: ### Fase 4 — MCP release-notes
  const phaseRegex = /^###\s+Fase\s+(\d+)\s+—\s+(.+?)(?:\s+✅\s+COMPLETA)?$/;
  // Regex para detectar checkbox: - [x] item ou - [ ] item
  const checkboxRegex = /^-\s+\[([ x])\]\s+(.+)/;
  // Regex para detectar seções especiais
  const nextActionsRegex = /^##\s+Próximas ações/i;
  const risksRegex = /^##\s+Riscos e mitigação/i;

  for (const line of lines) {
    // Detectar seção "Próximas ações"
    if (line.match(nextActionsRegex)) {
      inNextActions = true;
      inRisks = false;
      // Finalizar fase atual antes de sair
      if (currentPhase) {
        // Detectar se fase está completa baseado em checkboxes
        if (currentPhase.items_totais > 0 && currentPhase.items_completos === currentPhase.items_totais) {
          currentPhase.status = 'complete';
        }
        phases.push(currentPhase);
        currentPhase = null;
      }
      continue;
    }

    // Detectar seção "Riscos"
    if (line.match(risksRegex)) {
      inRisks = true;
      inNextActions = false;
      // Finalizar fase atual antes de sair
      if (currentPhase) {
        // Detectar se fase está completa baseado em checkboxes
        if (currentPhase.items_totais > 0 && currentPhase.items_completos === currentPhase.items_totais) {
          currentPhase.status = 'complete';
        }
        phases.push(currentPhase);
        currentPhase = null;
      }
      continue;
    }

    // Resetar flags em nova seção ##
    if (line.startsWith('## ') && !line.match(nextActionsRegex) && !line.match(risksRegex)) {
      inNextActions = false;
      inRisks = false;
    }

    // Detectar nova fase
    const phaseMatch = line.match(phaseRegex);
    if (phaseMatch) {
      // Salvar fase anterior
      if (currentPhase) {
        // Detectar se fase está completa baseado em checkboxes
        if (currentPhase.items_totais > 0 && currentPhase.items_completos === currentPhase.items_totais) {
          currentPhase.status = 'complete';
        }
        phases.push(currentPhase);
      }

      const phaseNum = phaseMatch[1];
      const phaseName = phaseMatch[2].trim();
      const hasCompleteMarker = line.includes('✅ COMPLETA');

      currentPhase = {
        fase: `Fase ${phaseNum}`,
        nome: phaseName,
        status: hasCompleteMarker ? 'complete' : 'planned',
        ferramentas: [],
        criterios: '',
        items_completos: 0,
        items_totais: 0,
      };
      inNextActions = false;
      inRisks = false;
      continue;
    }

    // Detectar checkbox em fase
    const checkboxMatch = line.match(checkboxRegex);
    if (checkboxMatch && currentPhase) {
      const isChecked = checkboxMatch[1] === 'x';
      const item = checkboxMatch[2].trim();

      currentPhase.items_totais++;
      if (isChecked) {
        currentPhase.items_completos++;
      }

      // Extrair ferramentas (detectar padrão "Ferramentas:")
      if (item.toLowerCase().startsWith('ferramentas:')) {
        const toolsMatch = item.match(/`([^`]+)`/g);
        if (toolsMatch) {
          currentPhase.ferramentas = toolsMatch.map((t) => t.replace(/`/g, ''));
        }
      }

      // Extrair critérios (detectar padrão "Critérios:")
      if (item.toLowerCase().startsWith('critérios:') || item.toLowerCase().startsWith('criterios:')) {
        currentPhase.criterios = item.replace(/^critérios?:\s*/i, '');
      }

      continue;
    }

    // Coletar bullets em "Próximas ações"
    if (inNextActions && line.startsWith('- ')) {
      const action = line.replace(/^-\s+/, '').trim();
      // Filtrar linhas de checklist (✅)
      if (!action.startsWith('✅')) {
        nextActions.push(action);
      }
    }

    // Coletar bullets em "Riscos"
    if (inRisks && line.startsWith('- ')) {
      const risk = line.replace(/^-\s+/, '').trim();
      risks.push(risk);
    }
  }

  // Adicionar última fase
  if (currentPhase) {
    // Detectar se fase está completa baseado em checkboxes
    if (currentPhase.items_totais > 0 && currentPhase.items_completos === currentPhase.items_totais) {
      currentPhase.status = 'complete';
    }
    phases.push(currentPhase);
  }

  // Calcular status geral
  const completedPhases = phases.filter((p) => p.status === 'complete').length;
  const totalPhases = phases.length;
  const progressPercentage = totalPhases > 0 ? Math.round((completedPhases / totalPhases) * 100) : 0;

  const status: ProjectStatus = {
    fases_completas: completedPhases,
    fases_totais: totalPhases,
    progresso_percentual: progressPercentage,
  };

  return {
    phases,
    nextActions,
    risks,
    status,
  };
}

/**
 * Formata versões como bullets cronológicos
 *
 * @param entries Array de changelog entries
 * @param limit Número máximo de versões a retornar
 * @returns String formatada em bullets
 */
export function formatAsChronologicalBullets(entries: ChangelogEntry[], limit: number): string {
  const limitedEntries = entries.slice(0, limit);
  const bullets: string[] = [];

  for (const entry of limitedEntries) {
    const versionLine = `**[${entry.version}]** - ${entry.date}`;
    bullets.push(versionLine);

    // Adicionar categorias
    for (const [category, items] of Object.entries(entry.categories)) {
      if (items.length > 0) {
        bullets.push(`  - **${category}:**`);
        for (const item of items) {
          bullets.push(`    - ${item}`);
        }
      }
    }

    bullets.push(''); // Linha em branco entre versões
  }

  return bullets.join('\n');
}

/**
 * Mescla changelogs de diferentes fontes em ordem cronológica
 *
 * @param mcpEntries Changelog do ankinator-mcp
 * @param ankimonEntry Changelog do ankimon
 * @returns Array mesclado e ordenado
 */
export function mergeChangelogs(mcpEntries: ChangelogEntry[], ankimonEntry: ChangelogEntry | null): ChangelogEntry[] {
  const merged: ChangelogEntry[] = [...mcpEntries];

  if (ankimonEntry) {
    merged.push(ankimonEntry);
  }

  // Ordenar por data (mais recente primeiro)
  // Nota: Assumindo formato ISO ou comparável
  merged.sort((a, b) => {
    if (a.date === 'TBD') return 1;
    if (b.date === 'TBD') return -1;
    return b.date.localeCompare(a.date);
  });

  return merged;
}

/**
 * Sugere onde inserir conteúdo no README
 *
 * @param type Tipo de conteúdo (changelog ou roadmap)
 * @returns Sugestão de inserção
 */
export function suggestReadmePlacement(type: 'changelog' | 'roadmap'): string {
  if (type === 'changelog') {
    return `
📝 **Sugestão de inserção no README:**

1. **Opção A - Seção dedicada:**
   Criar seção "## 📋 Changelog" após a seção "## Instalação".
   Inserir os bullets de versões mais recentes (últimas 2-3 versões).
   Adicionar link: "Ver histórico completo em [CHANGELOG.md](./CHANGELOG.md)"

2. **Opção B - Badge/Link:**
   Adicionar badge de versão no topo do README apontando para CHANGELOG.md:
   [![Changelog](https://img.shields.io/badge/changelog-0.1.0--alpha-blue)](./CHANGELOG.md)

3. **Opção C - Footer:**
   Adicionar link no rodapé da documentação na seção "Documentação Completa".
`.trim();
  } else {
    return `
📝 **Sugestão de inserção no README:**

1. **Opção A - Seção "Roadmap":**
   Criar seção "## 🗺️ Roadmap" após "## Features" ou "## Funcionalidades".
   Inserir progresso percentual e próximas ações em formato de lista.

2. **Opção B - Badge de progresso:**
   Adicionar badge visual de progresso no topo:
   ![Progresso](https://img.shields.io/badge/progresso-71%25-brightgreen)

3. **Opção C - Seção "Status do Projeto":**
   Criar seção "## 📊 Status do Projeto" mostrando:
   - Fases completas vs. totais
   - Próximas 3 ações planejadas
   - Link para ROADMAP.md completo
`.trim();
  }
}
