export type CanonEntityType = 'character' | 'location' | 'lore';

export interface Series {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
}

export interface CanonEntity {
  id: string;
  seriesId: string;
  type: CanonEntityType;
  name: string;
  summary: string;
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

export interface SceneEntityLink {
  id: string;
  entityId: string;
  storyId: string;
  sceneId: string;
  createdAt: number;
}
