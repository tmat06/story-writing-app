export type TensionTag = 'setup' | 'build' | 'peak' | 'release';
export type SensitivityLevel = 'tight' | 'moderate' | 'loose';
export type AlertSeverity = 'info' | 'warning';

export interface PacingAlert {
  id: string;
  type: 'low-tension-run' | 'length-outlier' | 'no-tags';
  severity: AlertSeverity;
  message: string;
  chapterLabel: string;
  sceneId: string | null;
  dismissed: boolean;
}

export interface ScenePacingData {
  sceneId: string;
  sceneTitle: string;
  chapter: string;
  wordCount: number;
  tensionTag: TensionTag | null;
}

export interface ChapterPacingStats {
  chapter: string;
  scenes: ScenePacingData[];
  totalWords: number;
  tagDistribution: Record<TensionTag, number>;
  hasPeakOrRelease: boolean;
}

export interface PacingSnapshot {
  takenAt: number;
  alertCount: number;
  chapterStats: ChapterPacingStats[];
}
