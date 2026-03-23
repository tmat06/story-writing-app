import { Story } from '@/types/story';
import { clearAutosaveData } from './autosave';
import { clearScenesData } from './scenes';
import { clearNotesData } from './notes';
import { clearSubmissionsData } from './submissions';
import { clearRevisionData } from './revision';
import { clearResumeStateData } from './resumeState';
import { clearPreviewData } from './previewLinks';

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

  // Clean up all story-scoped localStorage artifacts
  clearAutosaveData(id);
  clearScenesData(id);
  clearNotesData(id);
  clearSubmissionsData(id);
  clearRevisionData(id);
  clearResumeStateData(id);
  clearPreviewData(id);
}

function saveStories(stories: Story[]): void {
  try {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stories));
  } catch (error) {
    console.error('Failed to save stories:', error);
  }
}
