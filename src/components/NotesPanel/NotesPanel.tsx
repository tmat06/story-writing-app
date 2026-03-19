'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import ConfirmDialog from '@/components/ConfirmDialog/ConfirmDialog';
import { getNotes, createNote, updateNote, deleteNote } from '@/lib/notes';
import { relativeTime } from '@/lib/relativeTime';
import type { Note, NoteScope } from '@/types/note';
import type { Scene } from '@/types/scene';
import styles from './NotesPanel.module.css';

interface NotesPanelProps {
  storyId: string;
  scenes: Scene[];
  focusedSceneId: string | null;
  onInsert: (text: string) => void;
}

export function NotesPanel({ storyId, scenes, focusedSceneId, onInsert }: NotesPanelProps) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [scope, setScope] = useState<NoteScope>('scene');
  const [search, setSearch] = useState('');
  const [pinnedOnly, setPinnedOnly] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftBody, setDraftBody] = useState('');
  const [saveSignal, setSaveSignal] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [insertConfirmed, setInsertConfirmed] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [liveAnnouncement, setLiveAnnouncement] = useState('');

  const searchRef = useRef<HTMLInputElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveStatusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshNotes = useCallback(() => {
    setNotes(getNotes(storyId));
  }, [storyId]);

  useEffect(() => {
    refreshNotes();
  }, [refreshNotes]);

  // Populate draft fields when selection changes
  useEffect(() => {
    if (selectedId === null) {
      setDraftTitle('');
      setDraftBody('');
      return;
    }
    const note = notes.find((n) => n.id === selectedId);
    if (note) {
      setDraftTitle(note.title);
      setDraftBody(note.body);
    }
  }, [selectedId, notes]);

  // Autosave on draft changes (debounced 1500ms)
  useEffect(() => {
    if (!selectedId) return;

    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    setSaveSignal('saving');

    autosaveTimer.current = setTimeout(() => {
      updateNote(storyId, selectedId, { title: draftTitle, body: draftBody });
      refreshNotes();
      setSaveSignal('saved');
      setLiveAnnouncement('Saved just now');

      if (saveStatusTimer.current) clearTimeout(saveStatusTimer.current);
      saveStatusTimer.current = setTimeout(() => {
        setSaveSignal('idle');
        setLiveAnnouncement('');
      }, 2000);
    }, 1500);

    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftTitle, draftBody]);

  // Cmd/Ctrl+F to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const filteredNotes = notes.filter((n) => {
    if (n.scope !== scope) return false;
    if (pinnedOnly && !n.pinned) return false;
    if (search) {
      const q = search.toLowerCase();
      return n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q);
    }
    return true;
  });

  const pinnedFiltered = filteredNotes.filter((n) => n.pinned);
  const unpinnedFiltered = filteredNotes.filter((n) => !n.pinned);

  const handleNewNote = () => {
    const focusedScene = scenes.find((s) => s.id === focusedSceneId);
    const note = createNote(storyId, {
      scope,
      title: '',
      body: '',
      sceneId: scope === 'scene' ? (focusedSceneId ?? undefined) : undefined,
      chapterId: scope === 'chapter' ? (focusedScene?.chapter ?? undefined) : undefined,
    });
    refreshNotes();
    setSelectedId(note.id);
    requestAnimationFrame(() => {
      titleInputRef.current?.focus();
    });
  };

  const handleTogglePin = (noteId: string, currentPinned: boolean) => {
    updateNote(storyId, noteId, { pinned: !currentPinned });
    refreshNotes();
  };

  const handleInsert = () => {
    onInsert(draftBody);
    setInsertConfirmed(true);
    setLiveAnnouncement('Inserted into draft');
    setTimeout(() => {
      setInsertConfirmed(false);
      setLiveAnnouncement('');
    }, 1500);
  };

  const handleDeleteConfirm = () => {
    if (!selectedId) return;
    deleteNote(storyId, selectedId);
    setSelectedId(null);
    refreshNotes();
    setShowDeleteDialog(false);
    setLiveAnnouncement('Note deleted');
    setTimeout(() => setLiveAnnouncement(''), 2000);
  };

  return (
    <div className={styles.panel}>
      {/* Accessible live region */}
      <div aria-live="polite" className={styles.visuallyHidden}>
        {liveAnnouncement}
      </div>

      {/* Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.scopeControl} role="group" aria-label="Note scope">
          {(['scene', 'chapter', 'manuscript'] as NoteScope[]).map((s) => (
            <button
              key={s}
              className={`${styles.scopeBtn} ${scope === s ? styles.scopeBtnActive : ''}`}
              onClick={() => setScope(s)}
              aria-pressed={scope === s}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
        <div className={styles.searchRow}>
          <input
            ref={searchRef}
            type="search"
            className={styles.searchInput}
            placeholder="Search notes…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search notes"
          />
          {search && (
            <button
              className={styles.searchClearBtn}
              onClick={() => setSearch('')}
              aria-label="Clear search"
            >
              ×
            </button>
          )}
        </div>
        <div className={styles.secondRow}>
          <label className={styles.pinnedToggle}>
            <input
              type="checkbox"
              checked={pinnedOnly}
              onChange={(e) => setPinnedOnly(e.target.checked)}
            />
            Pinned only
          </label>
          <button className={styles.newNoteBtn} onClick={handleNewNote}>
            + New note
          </button>
        </div>
      </div>

      {/* Notes list */}
      <div className={styles.list} role="list">
        {filteredNotes.length === 0 && search === '' && (
          <div className={styles.emptyState}>
            <p>No {scope} notes yet.</p>
            <button className={styles.newNoteBtn} onClick={handleNewNote}>
              Create your first {scope} note
            </button>
          </div>
        )}
        {filteredNotes.length === 0 && search !== '' && (
          <div className={styles.emptyState}>
            <p>No matches for &ldquo;{search}&rdquo;</p>
            <button className={styles.clearSearchBtn} onClick={() => setSearch('')}>
              Clear search
            </button>
          </div>
        )}

        {pinnedFiltered.length > 0 && (
          <>
            <div className={styles.groupLabel}>Pinned</div>
            {pinnedFiltered.map((note) => (
              <NoteRow
                key={note.id}
                note={note}
                isActive={note.id === selectedId}
                onSelect={setSelectedId}
                onTogglePin={handleTogglePin}
              />
            ))}
          </>
        )}
        {unpinnedFiltered.length > 0 && (
          <>
            {pinnedFiltered.length > 0 && <div className={styles.groupLabel}>Notes</div>}
            {unpinnedFiltered.map((note) => (
              <NoteRow
                key={note.id}
                note={note}
                isActive={note.id === selectedId}
                onSelect={setSelectedId}
                onTogglePin={handleTogglePin}
              />
            ))}
          </>
        )}
      </div>

      {/* Note editor */}
      <div className={styles.editor}>
        {selectedId !== null ? (
          <>
            <input
              ref={titleInputRef}
              type="text"
              className={styles.titleInput}
              placeholder="Note title…"
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              aria-label="Note title"
            />
            <textarea
              className={styles.bodyTextarea}
              placeholder="Write your note…"
              value={draftBody}
              onChange={(e) => setDraftBody(e.target.value)}
              aria-label="Note body"
            />
            <div className={styles.editorFooter}>
              <button
                className={styles.insertBtn}
                onClick={handleInsert}
                aria-label="Insert note into draft"
              >
                {insertConfirmed ? 'Inserted ✓' : 'Insert into draft'}
              </button>
              <button
                className={styles.deleteBtn}
                onClick={() => setShowDeleteDialog(true)}
                aria-label="Delete note"
              >
                Delete
              </button>
              <span className={styles.saveStatus} aria-hidden="true">
                {saveSignal === 'saving' && 'Saving…'}
                {saveSignal === 'saved' && 'Saved just now'}
              </span>
            </div>
          </>
        ) : (
          <p className={styles.editorEmptyState}>Select a note or create one</p>
        )}
      </div>

      <ConfirmDialog
        isOpen={showDeleteDialog}
        title="Delete note"
        message="This note will be permanently deleted. This cannot be undone."
        confirmLabel="Delete"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setShowDeleteDialog(false)}
        destructive
      />
    </div>
  );
}

interface NoteRowProps {
  note: Note;
  isActive: boolean;
  onSelect: (id: string) => void;
  onTogglePin: (id: string, pinned: boolean) => void;
}

function NoteRow({ note, isActive, onSelect, onTogglePin }: NoteRowProps) {
  return (
    <div
      role="listitem"
      className={`${styles.noteRow} ${isActive ? styles.noteRowActive : ''}`}
      onClick={() => onSelect(note.id)}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(note.id);
        }
      }}
      aria-selected={isActive}
    >
      <div className={styles.noteRowMeta}>
        <span className={styles.noteRowTitle}>{note.title || 'Untitled note'}</span>
        <span className={styles.noteRowExcerpt}>{note.body}</span>
        <div className={styles.noteRowFooter}>
          <span>{relativeTime(note.updatedAt)}</span>
        </div>
      </div>
      <button
        className={`${styles.pinBtn} ${note.pinned ? styles.pinBtnActive : ''}`}
        onClick={(e) => {
          e.stopPropagation();
          onTogglePin(note.id, note.pinned);
        }}
        aria-label={note.pinned ? 'Unpin note' : 'Pin note'}
        aria-pressed={note.pinned}
      >
        📌
      </button>
    </div>
  );
}
