export type NoteScope = 'scene' | 'chapter' | 'manuscript';

export interface Note {
  id: string;
  storyId: string;
  scope: NoteScope;
  sceneId?: string;      // set when scope === 'scene'
  chapterId?: string;    // set when scope === 'chapter' (use scene.chapter field)
  title: string;
  body: string;
  pinned: boolean;
  createdAt: number;     // Date.now()
  updatedAt: number;
}
