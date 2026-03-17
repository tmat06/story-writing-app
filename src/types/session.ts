export type ObjectiveType =
  | 'draft-beat'
  | 'revise-pacing'
  | 'tighten-dialogue'
  | 'polish-description'
  | 'review-continuity'
  | 'other';

export type ObjectiveStatus = 'in-progress' | 'complete';

export interface FocusSession {
  id: string;
  storyId: string;
  sceneId: string;
  /** Denormalized scene title for display after scene may change */
  sceneName: string;
  objectiveType: ObjectiveType;
  /** Label for named types; freeform text for 'other' */
  objectiveText: string;
  /** Session start timestamp in ms */
  startedAt: number;
  /** Session end timestamp in ms; null while active */
  endedAt: number | null;
  /** 0 = no timer (elapsed mode) */
  timerPresetMinutes: number;
  wordsAtStart: number;
  /** null while active */
  wordsAtEnd: number | null;
  objectiveStatus: ObjectiveStatus;
  handoffNote: string;
  nextSceneId: string | null;
}

export interface ActiveSessionState {
  sessionId: string;
  elapsedSeconds: number;
  isPaused: boolean;
  wordsAtStart: number;
}
