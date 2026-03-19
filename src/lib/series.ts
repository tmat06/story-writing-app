import { Series } from '@/types/series';

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
    storyIds: [],
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
  updates: Partial<Pick<Series, 'title' | 'storyIds'>>
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
  saveSeries(loadSeries().filter(s => s.id !== id));
}

export function addStoryToSeries(seriesId: string, storyId: string): Series {
  const series = getSeriesById(seriesId);
  if (!series) throw new Error(`Series ${seriesId} not found`);
  if (series.storyIds.includes(storyId)) return series;
  return updateSeries(seriesId, { storyIds: [...series.storyIds, storyId] });
}

export function removeStoryFromSeries(seriesId: string, storyId: string): Series {
  const series = getSeriesById(seriesId);
  if (!series) throw new Error(`Series ${seriesId} not found`);
  return updateSeries(seriesId, { storyIds: series.storyIds.filter(id => id !== storyId) });
}
