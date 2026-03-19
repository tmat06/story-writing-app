import { CanonEntity, CanonEntityType, SceneEntityLink } from '@/types/series';

const ENTITIES_KEY = 'canon_entities';
const LINKS_KEY = 'scene_entity_links';

function loadEntities(): CanonEntity[] {
  try {
    if (typeof window === 'undefined') return [];
    const data = localStorage.getItem(ENTITIES_KEY);
    if (!data) return [];
    return JSON.parse(data) as CanonEntity[];
  } catch {
    return [];
  }
}

function saveEntities(entities: CanonEntity[]): void {
  try {
    if (typeof window === 'undefined') return;
    localStorage.setItem(ENTITIES_KEY, JSON.stringify(entities));
  } catch (error) {
    console.error('Failed to save canon entities:', error);
  }
}

function loadLinks(): SceneEntityLink[] {
  try {
    if (typeof window === 'undefined') return [];
    const data = localStorage.getItem(LINKS_KEY);
    if (!data) return [];
    return JSON.parse(data) as SceneEntityLink[];
  } catch {
    return [];
  }
}

function saveLinks(links: SceneEntityLink[]): void {
  try {
    if (typeof window === 'undefined') return;
    localStorage.setItem(LINKS_KEY, JSON.stringify(links));
  } catch (error) {
    console.error('Failed to save scene entity links:', error);
  }
}

export function getCanonEntities(seriesId: string): CanonEntity[] {
  return loadEntities().filter(e => e.seriesId === seriesId);
}

export function getCanonEntity(id: string): CanonEntity | undefined {
  return loadEntities().find(e => e.id === id);
}

export function createCanonEntity(
  seriesId: string,
  type: CanonEntityType,
  name: string,
  summary = '',
  tags: string[] = []
): CanonEntity {
  const now = Date.now();
  const entity: CanonEntity = {
    id: crypto.randomUUID(),
    seriesId,
    type,
    name,
    summary,
    tags,
    createdAt: now,
    updatedAt: now,
  };
  const all = loadEntities();
  all.push(entity);
  saveEntities(all);
  return entity;
}

export function updateCanonEntity(
  id: string,
  updates: Partial<Pick<CanonEntity, 'name' | 'summary' | 'tags'>>
): CanonEntity {
  const all = loadEntities();
  const index = all.findIndex(e => e.id === id);
  if (index === -1) throw new Error(`CanonEntity ${id} not found`);
  const updated: CanonEntity = { ...all[index], ...updates, updatedAt: Date.now() };
  all[index] = updated;
  saveEntities(all);
  return updated;
}

export function deleteCanonEntity(id: string): void {
  saveEntities(loadEntities().filter(e => e.id !== id));
  saveLinks(loadLinks().filter(l => l.entityId !== id));
}

export function getSceneEntityLinks(entityId: string): SceneEntityLink[] {
  return loadLinks().filter(l => l.entityId === entityId);
}

export function getSceneEntityLinksByScene(sceneId: string): SceneEntityLink[] {
  return loadLinks().filter(l => l.sceneId === sceneId);
}

export function linkEntityToScene(
  entityId: string,
  storyId: string,
  sceneId: string
): SceneEntityLink {
  const link: SceneEntityLink = {
    id: crypto.randomUUID(),
    entityId,
    storyId,
    sceneId,
    createdAt: Date.now(),
  };
  const all = loadLinks();
  all.push(link);
  saveLinks(all);
  return link;
}

export function unlinkEntityFromScene(linkId: string): void {
  saveLinks(loadLinks().filter(l => l.id !== linkId));
}

export function getEntityImpactSummary(
  entityId: string
): { storyCount: number; sceneCount: number; storyIds: string[] } {
  const links = getSceneEntityLinks(entityId);
  const storyIds = [...new Set(links.map(l => l.storyId))];
  return { storyCount: storyIds.length, sceneCount: links.length, storyIds };
}
