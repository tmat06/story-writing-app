import type { Story } from './story';
import type { Scene } from './scene';
import type { Note } from './note';
import type { RevisionPass } from './revision';
import type { SubmissionEntry } from './submission';
import type { CanonEntity, SceneEntityLink } from './series';

export const BUNDLE_SCHEMA_VERSION = 1;

export interface BundleAssetCounts {
  scenes: number;
  notes: number;
  revisionPasses: number;
  sceneContentKeys: number;
  submissions: number;
  canonEntities: number;
  sceneEntityLinks: number;
}

export interface StoryBundle {
  schemaVersion: number;
  exportedAt: number;
  checksum: string;
  story: Story;
  scenes: Scene[];
  notes: Note[];
  revisionPasses: RevisionPass[];
  manuscriptContent: string;
  manuscriptSnapshot: string;
  sceneContents: Record<string, string>;
  submissions: SubmissionEntry[];
  canonEntities: CanonEntity[];
  sceneEntityLinks: SceneEntityLink[];
}

export type BundleParseResult =
  | { ok: true; bundle: StoryBundle; assetCounts: BundleAssetCounts }
  | { ok: false; error: 'corrupt' | 'incompatible_version' | 'checksum_mismatch' | 'missing_assets'; detail?: string };
