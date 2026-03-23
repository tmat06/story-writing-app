import { Story } from '@/types/story';

const STORAGE_KEY = 'stories';

export function getStories(): Story[] {
  try {
    if (typeof window === 'undefined') return [];
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return [];
    const stories: Story[] = JSON.parse(data);
    return stories.sort((a, b) => b.updatedAt - a.updatedAt);
  } catch (error) {
    console.error('Failed to load stories:', error);
    return [];
  }
}

export function getStory(id: string): Story | null {
  const stories = getStories();
  return stories.find(s => s.id === id) || null;
}

export function createStory(title: string, opts?: { seriesId?: string }): Story {
  const now = Date.now();
  const story: Story = {
    id: crypto.randomUUID(),
    title,
    createdAt: now,
    updatedAt: now,
    isArchived: false,
    ...(opts?.seriesId ? { seriesId: opts.seriesId } : {}),
  };

  const stories = getStories();
  stories.push(story);
  saveStories(stories);
  return story;
}

export function updateStory(
  id: string,
  updates: Partial<Pick<Story, 'title' | 'isArchived' | 'seriesId'>>
): Story | null {
  const stories = getStories();
  const index = stories.findIndex(s => s.id === id);

  if (index === -1) return null;

  const updated = {
    ...stories[index],
    ...updates,
    updatedAt: Date.now(),
  };

  stories[index] = updated;
  saveStories(stories);
  return updated;
}

export function deleteStory(id: string): void {
  const stories = getStories();
  const filtered = stories.filter(s => s.id !== id);
  saveStories(filtered);
}

export function duplicateStory(sourceId: string): Story | null {
  const source = getStory(sourceId);
  if (!source) return null;

  const now = Date.now();
  const newId = crypto.randomUUID();

  // Clone story record
  const newStory: Story = {
    id: newId,
    title: `Copy of ${source.title}`,
    createdAt: now,
    updatedAt: now,
    isArchived: false,
    ...(source.seriesId ? { seriesId: source.seriesId } : {}),
  };
  const stories = getStories();
  stories.push(newStory);
  saveStories(stories);

  console.info('[Duplicate] Duplicated story %s → %s', sourceId, newId);

  // Clone scenes — remap each scene UUID, preserve all other fields + order
  const sourceScenes: import('@/types/scene').Scene[] = (() => {
    try {
      const raw = localStorage.getItem(`story-${sourceId}-scenes`);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  })();
  const sceneIdMap: Record<string, string> = {};
  const newScenes = sourceScenes.map(scene => {
    const newSceneId = crypto.randomUUID();
    sceneIdMap[scene.id] = newSceneId;
    return { ...scene, id: newSceneId };
  });
  try {
    localStorage.setItem(`story-${newId}-scenes`, JSON.stringify(newScenes));
  } catch { /* swallow — partial duplicate still opens */ }

  // Clone manuscript content
  try {
    const content = localStorage.getItem(`story_${sourceId}_content`);
    if (content !== null) {
      localStorage.setItem(`story_${newId}_content`, content);
    }
  } catch { /* swallow — content is optional */ }

  // Clone notes — remap note UUIDs + storyId + scene references
  try {
    const rawNotes = localStorage.getItem(`story-${sourceId}-notes`);
    if (rawNotes) {
      const sourceNotes = JSON.parse(rawNotes) as import('@/types/note').Note[];
      const newNotes = sourceNotes.map(note => ({
        ...note,
        id: crypto.randomUUID(),
        storyId: newId,
        ...(note.sceneId && sceneIdMap[note.sceneId]
          ? { sceneId: sceneIdMap[note.sceneId] }
          : {}),
      }));
      localStorage.setItem(`story-${newId}-notes`, JSON.stringify(newNotes));
    }
  } catch { /* swallow */ }

  return newStory;
}

function saveStories(stories: Story[]): void {
  try {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stories));
  } catch (error) {
    console.error('Failed to save stories:', error);
  }
}
