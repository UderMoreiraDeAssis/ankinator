/**
 * Types for Release Notes (Fase 4)
 *
 * Tipos para parsing e formatação de changelogs e roadmap
 */

/**
 * Entrada de changelog parseada de CHANGELOG.md ou update_txt.md
 */
export interface ChangelogEntry {
  version: string;                           // "0.1.0-alpha", "v1.285", "Unreleased"
  date: string;                              // "2025-11-22", "TBD"
  type?: 'alpha' | 'beta' | 'stable' | 'unreleased';
  categories: Record<string, string[]>;       // { Added: [...], Fixed: [...] }
}

/**
 * Versão formatada para output de ultimas_mudancas
 */
export interface Version {
  versao: string;
  data: string;
  tipo?: string;
  categorias: Record<string, string[]>;
}

/**
 * Fase do roadmap parseada de ROADMAP.md
 */
export interface RoadmapPhase {
  fase: string;                               // "Fase 4"
  nome: string;                               // "MCP release-notes"
  status: 'complete' | 'in-progress' | 'planned';
  ferramentas: string[];                      // ["ultimas_mudancas", "roadmap"]
  criterios: string;                          // Descrição dos critérios
  items_completos: number;                    // Contador de [x]
  items_totais: number;                       // Total de items
}

/**
 * Configuração para parsing de release notes
 */
export interface ReleaseNotesConfig {
  maxVersions: number;
  includeUnreleased: boolean;
  format: 'markdown' | 'bullets';
}

/**
 * Status geral do projeto baseado no roadmap
 */
export interface ProjectStatus {
  fases_completas: number;
  fases_totais: number;
  progresso_percentual: number;
}

/**
 * Resultado completo do parsing de roadmap
 */
export interface RoadmapData {
  phases: RoadmapPhase[];
  nextActions: string[];
  risks: string[];
  status: ProjectStatus;
}
