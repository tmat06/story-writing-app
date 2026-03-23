import type { Note } from '@/types/note';

function _storageKey(storyId: string): string {
  return `story-${storyId}-notes`;
}

function _saveNotes(storyId: string, notes: Note[]): void {
  localStorage.setItem(_storageKey(storyId), JSON.stringify(notes));
}

export function getNotes(storyId: string): Note[] {
  if (typeof window === 'undefined') return [];

  const stored = localStorage.getItem(_storageKey(storyId));
  if (!stored) return [];

  try {
    const notes = JSON.parse(stored) as Note[];
    return notes.sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return b.updatedAt - a.updatedAt;
    });
  } catch {
    return [];
  }
}

export function createNote(
  storyId: string,
  data: Pick<Note, 'scope' | 'title' | 'body'> & Partial<Pick<Note, 'sceneId' | 'chapterId'>>
): Note {
  const notes = getNotes(storyId);
  const now = Date.now();
  const note: Note = {
    id: crypto.randomUUID(),
    storyId,
    scope: data.scope,
    title: data.title,
    body: data.body,
    pinned: false,
    createdAt: now,
    updatedAt: now,
    ...(data.sceneId ? { sceneId: data.sceneId } : {}),
    ...(data.chapterId ? { chapterId: data.chapterId } : {}),
  };
  notes.push(note);
  _saveNotes(storyId, notes);
  return note;
}

export function updateNote(
  storyId: string,
  id: string,
  data: Partial<Pick<Note, 'title' | 'body' | 'pinned' | 'sceneId' | 'chapterId'>>
): Note | null {
  const notes = getNotes(storyId);
  const note = notes.find((n) => n.id === id);
  if (!note) return null;

  Object.assign(note, data, { updatedAt: Date.now() });
  _saveNotes(storyId, notes);
  return note;
}

export function clearNotesData(storyId: string): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(_storageKey(storyId));
}

export function deleteNote(storyId: string, id: string): void {
  const notes = getNotes(storyId);
  _saveNotes(storyId, notes.filter((n) => n.id !== id));
}
