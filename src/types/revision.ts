export type PassType = 'arc-consistency' | 'promise-payoff' | 'voice-drift';
export type ItemStatus = 'open' | 'accepted' | 'dismissed';

export interface RevisionItem {
  id: string;
  passId: string;
  sceneId: string | null;
  chapter: string;
  sceneTitle: string;
  prompt: string;
  status: ItemStatus;
  rationale: string;
}

export interface RevisionPass {
  id: string;
  storyId: string;
  type: PassType;
  startedAt: number;
  completedAt?: number;
  items: RevisionItem[];
}
