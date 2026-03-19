'use client';

import { useState } from 'react';
import { CanonEntity, CanonEntityType } from '@/types/series';
import styles from './CanonEntityTable.module.css';

interface CanonEntityTableProps {
  entities: CanonEntity[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreateEntity: (name: string, summary: string) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  activeType: CanonEntityType;
}

function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

const TYPE_LABELS: Record<CanonEntityType, string> = {
  character: 'character',
  location: 'location',
  lore: 'lore entry',
};

export default function CanonEntityTable({
  entities,
  selectedId,
  onSelect,
  onCreateEntity,
  searchQuery,
  onSearchChange,
  activeType,
}: CanonEntityTableProps) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newSummary, setNewSummary] = useState('');

  const filtered = entities.filter(e =>
    e.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    onCreateEntity(newName.trim(), newSummary.trim());
    setNewName('');
    setNewSummary('');
    setShowCreateForm(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent, id: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect(id);
    }
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.toolbar}>
        <div className={styles.searchWrapper}>
          <label htmlFor="canon-search" className={styles.visuallyHidden}>
            Search entities
          </label>
          <input
            id="canon-search"
            type="text"
            className={styles.search}
            placeholder={`Search ${activeType}s…`}
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
          />
        </div>
        <button
          type="button"
          className={styles.createButton}
          onClick={() => setShowCreateForm(true)}
        >
          + Add {TYPE_LABELS[activeType]}
        </button>
      </div>

      <div role="grid" aria-label={`${activeType} entities`} className={styles.grid}>
        {filtered.length === 0 && !showCreateForm ? (
          <div className={styles.emptyState}>
            <p>No {activeType}s yet.</p>
            <button
              type="button"
              className={styles.emptyCreateButton}
              onClick={() => setShowCreateForm(true)}
            >
              Create first shared {TYPE_LABELS[activeType]}
            </button>
          </div>
        ) : (
          filtered.map(entity => (
            <div
              key={entity.id}
              role="row"
              tabIndex={0}
              className={`${styles.row} ${selectedId === entity.id ? styles.selected : ''}`}
              onClick={() => onSelect(entity.id)}
              onKeyDown={e => handleKeyDown(e, entity.id)}
              aria-selected={selectedId === entity.id}
            >
              <div className={styles.rowMain}>
                <span className={styles.rowName}>{entity.name}</span>
                {entity.tags.length > 0 && (
                  <span className={styles.rowTags}>
                    {entity.tags.join(', ')}
                  </span>
                )}
              </div>
              <span className={styles.rowMeta}>{formatRelativeTime(entity.updatedAt)}</span>
            </div>
          ))
        )}

        {showCreateForm && (
          <form className={styles.createForm} onSubmit={handleCreate}>
            <input
              type="text"
              className={styles.createInput}
              placeholder={`${TYPE_LABELS[activeType]} name`}
              value={newName}
              onChange={e => setNewName(e.target.value)}
              autoFocus
            />
            <textarea
              className={styles.createTextarea}
              placeholder="Brief summary (optional)"
              value={newSummary}
              onChange={e => setNewSummary(e.target.value)}
              rows={2}
            />
            <div className={styles.createActions}>
              <button type="submit" className={styles.saveButton} disabled={!newName.trim()}>
                Save
              </button>
              <button
                type="button"
                className={styles.cancelButton}
                onClick={() => {
                  setShowCreateForm(false);
                  setNewName('');
                  setNewSummary('');
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
