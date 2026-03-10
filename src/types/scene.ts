/**
 * Scene status lifecycle states
 */
export type SceneStatus = 'planned' | 'drafting' | 'done';

/**
 * Scene data model for corkboard planning view
 */
export interface Scene {
  /** Unique scene identifier */
  id: string;

  /** Scene title/name */
  title: string;

  /** Chapter this scene belongs to */
  chapter: string;

  /** Short summary of the scene (2-3 sentences) */
  summary: string;

  /** Current status of the scene */
  status: SceneStatus;

  /** Position/order number for sequencing (lower = earlier) */
  order: number;
}
