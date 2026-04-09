/**
 * GrayMatter — Types & Data Model
 *
 * Memories are categorized into brain "regions" which map to
 * conceptual areas on the 3D brain model.
 */

export type BrainRegion =
  | 'frontal'
  | 'temporal'
  | 'parietal'
  | 'occipital'
  | 'cerebellum'
  | 'limbic';

export interface Memory {
  id: string;
  content: string;
  summary: string;
  region: BrainRegion;
  tags: string[];
  importance: number;       // 0.0 – 1.0
  createdAt: string;        // ISO 8601
  updatedAt: string;        // ISO 8601
  source?: string;          // optional: which file / LLM this came from
  model?: string;           // optional: which model created this memory
  shared?: boolean;         // marked for team brain export
}

export interface MemoryStats {
  totalMemories: number;
  byRegion: Record<BrainRegion, number>;
  averageImportance: number;
  oldestMemory: string | null;
  newestMemory: string | null;
}

export interface HealthScore {
  score: number;      // 0–100
  label: string;      // 'Empty' | 'Sparse' | 'Growing' | 'Healthy' | 'Excellent'
  detail: string;     // human-readable breakdown
}

export interface MemoryState {
  memories: Memory[];
  stats: MemoryStats;
  health: HealthScore;
  lastUpdated: string;
}

export interface RegionMeta {
  label: string;
  description: string;
  examples: string;
  color: string;
  position: { x: number; y: number; z: number };
}

/** Region metadata for the 3D brain */
export const REGION_META: Record<BrainRegion, RegionMeta> = {
  frontal: {
    label: 'Decisions & Planning',
    description: 'Architecture choices, goals, strategies, and high-level decisions',
    examples: '"Migrate to GraphQL", "Use microservices", "Q3 roadmap goals"',
    color: '#FF6B6B',
    position: { x: 0.15, y: -0.45, z: 0.65 }
  },
  temporal: {
    label: 'Events & History',
    description: 'Past conversations, meetings, milestones, and timeline events',
    examples: '"Auth refactored last week", "Sprint planning Mondays 10am"',
    color: '#4ECDC4',
    position: { x: 0.75, y: 0.08, z: 0.18 }
  },
  parietal: {
    label: 'Technical Knowledge',
    description: 'Code patterns, frameworks, stack details, and structural information',
    examples: '"Uses Turborepo monorepo", "API runs on Express", "DB schema"',
    color: '#45B7D1',
    position: { x: 0, y: -0.72, z: -0.1 }
  },
  occipital: {
    label: 'Visual & Design',
    description: 'UI/UX preferences, design system rules, and visual patterns',
    examples: '"Uses 8px grid", "Tailwind CSS", "Prefers rounded corners"',
    color: '#96CEB4',
    position: { x: -0.05, y: -0.25, z: -0.72 }
  },
  cerebellum: {
    label: 'Habits & Workflows',
    description: 'Repeated routines, processes, commit conventions, and patterns',
    examples: '"Always run tests first", "Conventional commits", "PR reviews"',
    color: '#FFEAA7',
    position: { x: 0.05, y: 0.45, z: -0.52 }
  },
  limbic: {
    label: 'Preferences & Style',
    description: 'Personal tastes, language preferences, opinions, and personality',
    examples: '"Prefers TypeScript", "Likes dark mode", "Concise comments"',
    color: '#DDA0DD',
    position: { x: 0, y: -0.05, z: 0 }
  }
};
