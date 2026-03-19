import { Series } from '@/types/series';
import { getStories, updateStory } from '@/lib/stories';
import { getCanonEntities, deleteCanonEntity } from '@/lib/canon';

const STORAGE_KEY = 'series';

function loadSeries(): Series[] {
  try {
    if (typeof window === 'undefined') return [];
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return [];
    return JSON.parse(data) as Series[];
  } catch {
    return [];
  }
}

function saveSeries(series: Series[]): void {
  try {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(series));
  } catch (error) {
    console.error('Failed to save series:', error);
  }
}

export function getSeries(): Series[] {
  return loadSeries().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getSeriesById(id: string): Series | undefined {
  return loadSeries().find(s => s.id === id);
}

export function createSeries(title: string): Series {
  const now = Date.now();
  const series: Series = {
    id: crypto.randomUUID(),
    title,
    createdAt: now,
    updatedAt: now,
  };
  const all = loadSeries();
  all.push(series);
  saveSeries(all);
  return series;
}

export function updateSeries(
  id: string,
  updates: Partial<Pick<Series, 'title'>>
): Series {
  const all = loadSeries();
  const index = all.findIndex(s => s.id === id);
  if (index === -1) throw new Error(`Series ${id} not found`);
  const updated: Series = { ...all[index], ...updates, updatedAt: Date.now() };
  all[index] = updated;
  saveSeries(all);
  return updated;
}

export function deleteSeries(id: string): void {
  // 1. Clear seriesId on all member stories
  const memberStories = getStories().filter(s => s.seriesId === id);
  memberStories.forEach(s => updateStory(s.id, { seriesId: undefined }));

  // 2. Delete all CanonEntity records for this series (cascade to SceneEntityLinks via deleteCanonEntity)
  const entities = getCanonEntities(id);
  entities.forEach(e => deleteCanonEntity(e.id));

  // 3. Delete the Series record
  const all = loadSeries();
  saveSeries(all.filter(s => s.id !== id));
}
