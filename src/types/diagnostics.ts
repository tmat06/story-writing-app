export type DiagnosticSeverity = 'info' | 'warning' | 'alert';
export type DiagnosticWarningType =
  | 'pov-dominance'
  | 'character-absence'
  | 'no-pov-metadata'
  | 'no-character-metadata';

export interface DiagnosticWarning {
  id: string;
  type: DiagnosticWarningType;
  severity: DiagnosticSeverity;
  message: string;
  chapterLabel: string;
  sceneIds: string[];
  dismissed: boolean;
  snoozedUntil?: number;
}

export interface DiagnosticThresholds {
  povDominancePct: number;
  characterAbsenceChapters: number;
  snoozeHours: number;
}

export interface PovChapterShare {
  chapter: string;
  total: number;
  breakdown: Record<string, number>;
}

export interface CharacterPresenceMatrix {
  characters: string[];
  chapters: string[];
  matrix: number[][];
}

export interface DiagnosticsDismissalState {
  [warningId: string]: {
    dismissed: boolean;
    snoozedUntil?: number;
  };
}
