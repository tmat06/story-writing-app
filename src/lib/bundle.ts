import { getStory, getStories } from '@/lib/stories';
import { getScenes } from '@/lib/scenes';
import { getNotes } from '@/lib/notes';
import { getPasses } from '@/lib/revision';
import { getSubmissions } from '@/lib/submissions';
import type { CanonEntity, SceneEntityLink } from '@/types/series';
import {
  BUNDLE_SCHEMA_VERSION,
  type StoryBundle,
  type BundleParseResult,
  type BundleAssetCounts,
} from '@/types/bundle';
import type { Story } from '@/types/story';
import type { Scene } from '@/types/scene';
import type { Note } from '@/types/note';
import type { RevisionPass } from '@/types/revision';
import type { SubmissionEntry } from '@/types/submission';

async function computeChecksum(payload: object): Promise<string> {
  const text = JSON.stringify(payload);
  const bytes = new TextEncoder().encode(text);
  const buffer = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function loadAllCanonEntities(): CanonEntity[] {
  try {
    if (typeof window === 'undefined') return [];
    const data = localStorage.getItem('canon_entities');
    if (!data) return [];
    return JSON.parse(data) as CanonEntity[];
  } catch {
    return [];
  }
}

function loadAllSceneEntityLinks(): SceneEntityLink[] {
  try {
    if (typeof window === 'undefined') return [];
    const data = localStorage.getItem('scene_entity_links');
    if (!data) return [];
    return JSON.parse(data) as SceneEntityLink[];
  } catch {
    return [];
  }
}

function saveAllCanonEntities(entities: CanonEntity[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('canon_entities', JSON.stringify(entities));
}

function saveAllSceneEntityLinks(links: SceneEntityLink[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('scene_entity_links', JSON.stringify(links));
}

export async function exportStoryBundle(storyId: string): Promise<void> {
  const story = getStory(storyId);
  if (!story) {
    console.error('[BundleExport] Story not found:', storyId);
    return;
  }

  const scenes = getScenes(storyId);
  const notes = getNotes(storyId);
  const revisionPasses = getPasses(storyId);
  const manuscriptContent = localStorage.getItem(`story_${storyId}_content`) ?? '';
  const manuscriptSnapshot = localStorage.getItem(`story_${storyId}_snapshot`) ?? '';

  const sceneContents: Record<string, string> = {};
  for (const scene of scenes) {
    sceneContents[scene.id] =
      localStorage.getItem(`story_${storyId}_scene_${scene.id}_content`) ?? '';
  }

  const submissions = getSubmissions(storyId);

  const sceneIds = new Set(scenes.map(s => s.id));
  const allLinks = loadAllSceneEntityLinks();
  const storyLinks = allLinks.filter(l => sceneIds.has(l.sceneId));
  const linkedEntityIds = new Set(storyLinks.map(l => l.entityId));
  const allEntities = loadAllCanonEntities();
  const storyEntities = allEntities.filter(e => linkedEntityIds.has(e.id));

  const payload = {
    story,
    scenes,
    notes,
    revisionPasses,
    manuscriptContent,
    manuscriptSnapshot,
    sceneContents,
    submissions,
    canonEntities: storyEntities,
    sceneEntityLinks: storyLinks,
  };

  const checksum = await computeChecksum(payload);

  const bundle: StoryBundle = {
    schemaVersion: BUNDLE_SCHEMA_VERSION,
    exportedAt: Date.now(),
    checksum,
    ...payload,
  };

  const safeTitle = story.title.replace(/[^a-z0-9_-]/gi, '_').toLowerCase();
  const json = JSON.stringify(bundle, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safeTitle}.storybundle`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function parseBundle(file: File): Promise<BundleParseResult> {
  let text: string;
  try {
    text = await file.text();
  } catch {
    // fallback for older Safari
    text = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });
  }

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: 'corrupt' };
  }

  const bundle = raw as Partial<StoryBundle>;

  if (bundle.schemaVersion !== BUNDLE_SCHEMA_VERSION) {
    return {
      ok: false,
      error: 'incompatible_version',
      detail: `Bundle v${bundle.schemaVersion} not supported`,
    };
  }

  if (!bundle.story || !Array.isArray(bundle.scenes) || !bundle.checksum) {
    return { ok: false, error: 'missing_assets', detail: 'Required bundle fields are missing' };
  }

  // Recompute checksum (exclude checksum field itself)
  const { checksum, schemaVersion, exportedAt, ...payloadFields } = bundle as StoryBundle;
  void schemaVersion;
  void exportedAt;
  const recomputed = await computeChecksum(payloadFields);
  if (recomputed !== checksum) {
    return { ok: false, error: 'checksum_mismatch' };
  }

  const b = bundle as StoryBundle;
  const assetCounts: BundleAssetCounts = {
    scenes: b.scenes.length,
    notes: (b.notes ?? []).length,
    revisionPasses: (b.revisionPasses ?? []).length,
    sceneContentKeys: Object.keys(b.sceneContents ?? {}).length,
    submissions: (b.submissions ?? []).length,
    canonEntities: (b.canonEntities ?? []).length,
    sceneEntityLinks: (b.sceneEntityLinks ?? []).length,
  };

  return { ok: true, bundle: b, assetCounts };
}

export function importBundle(bundle: StoryBundle): string {
  const newStoryId = crypto.randomUUID();
  const idMap = new Map<string, string>();
  for (const scene of bundle.scenes) {
    idMap.set(scene.id, crypto.randomUUID());
  }

  // Write story
  const stories = getStories();
  const newStory: Story = {
    ...bundle.story,
    id: newStoryId,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  stories.push(newStory);
  localStorage.setItem('stories', JSON.stringify(stories));

  // Write scenes with remapped IDs
  const newScenes: Scene[] = bundle.scenes.map(scene => ({
    ...scene,
    id: idMap.get(scene.id)!,
  }));
  localStorage.setItem(`story-${newStoryId}-scenes`, JSON.stringify(newScenes));

  // Write notes with remapped storyId and sceneId/chapterId references
  const newNotes: Note[] = (bundle.notes ?? []).map(note => ({
    ...note,
    id: crypto.randomUUID(),
    storyId: newStoryId,
    ...(note.sceneId ? { sceneId: idMap.get(note.sceneId) ?? note.sceneId } : {}),
  }));
  localStorage.setItem(`story-${newStoryId}-notes`, JSON.stringify(newNotes));

  // Write revision passes with remapped item sceneIds
  const newPasses: RevisionPass[] = (bundle.revisionPasses ?? []).map(pass => ({
    ...pass,
    id: crypto.randomUUID(),
    storyId: newStoryId,
    items: pass.items.map(item => ({
      ...item,
      id: crypto.randomUUID(),
      sceneId: item.sceneId ? (idMap.get(item.sceneId) ?? item.sceneId) : item.sceneId,
    })),
  }));
  localStorage.setItem(`story-${newStoryId}-revision`, JSON.stringify(newPasses));

  // Write manuscript content and snapshot
  localStorage.setItem(`story_${newStoryId}_content`, bundle.manuscriptContent ?? '');
  localStorage.setItem(`story_${newStoryId}_snapshot`, bundle.manuscriptSnapshot ?? '');

  // Write scene contents
  for (const [oldSceneId, content] of Object.entries(bundle.sceneContents ?? {})) {
    const newSceneId = idMap.get(oldSceneId);
    if (newSceneId) {
      localStorage.setItem(`story_${newStoryId}_scene_${newSceneId}_content`, content);
    }
  }

  // Write submissions with new IDs and storyId
  const newSubmissions: SubmissionEntry[] = (bundle.submissions ?? []).map(sub => ({
    ...sub,
    id: crypto.randomUUID(),
    storyId: newStoryId,
  }));
  localStorage.setItem(`story-${newStoryId}-submissions`, JSON.stringify(newSubmissions));

  // Append canon entities and links with new UUIDs, remapping scene references
  if ((bundle.canonEntities ?? []).length > 0 || (bundle.sceneEntityLinks ?? []).length > 0) {
    const entityIdMap = new Map<string, string>();
    const allEntities = loadAllCanonEntities();
    for (const entity of bundle.canonEntities ?? []) {
      const newEntityId = crypto.randomUUID();
      entityIdMap.set(entity.id, newEntityId);
      allEntities.push({ ...entity, id: newEntityId });
    }
    saveAllCanonEntities(allEntities);

    const allLinks = loadAllSceneEntityLinks();
    for (const link of bundle.sceneEntityLinks ?? []) {
      const newSceneId = idMap.get(link.sceneId);
      const newEntityId = entityIdMap.get(link.entityId);
      if (newSceneId && newEntityId) {
        allLinks.push({
          ...link,
          id: crypto.randomUUID(),
          storyId: newStoryId,
          sceneId: newSceneId,
          entityId: newEntityId,
        });
      }
    }
    saveAllSceneEntityLinks(allLinks);
  }

  console.info('[BundleImport] Imported story:', newStoryId);
  return newStoryId;
}
