'use client';

import type { ThreadStatus } from '@/types/collaboration';
import type { Scene } from '@/types/scene';
import styles from './CollabPanel.module.css';

interface Props {
  unresolvedCount: number;
  statusFilter: ThreadStatus | 'all';
  assigneeFilter: string;
  sceneFilter: string;
  scenes: Scene[];
  onStatusChange: (status: ThreadStatus | 'all') => void;
  onAssigneeChange: (assignee: string) => void;
  onSceneChange: (sceneId: string) => void;
  onAddThread: () => void;
}

const STATUS_OPTIONS: Array<{ value: ThreadStatus | 'all'; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'needs-author', label: 'Needs author' },
  { value: 'open', label: 'Open' },
  { value: 'resolved', label: 'Resolved' },
];

export function CollabInboxToolbar({
  unresolvedCount,
  statusFilter,
  assigneeFilter,
  sceneFilter,
  scenes,
  onStatusChange,
  onAssigneeChange,
  onSceneChange,
  onAddThread,
}: Props) {
  return (
    <div className={styles.toolbar}>
      <div className={styles.toolbarTop}>
        <span className={styles.unresolvedChip}>
          {unresolvedCount} unresolved
        </span>
        <button className={styles.addThreadBtn} onClick={onAddThread} aria-label="New thread">
          + New
        </button>
      </div>
      <div className={styles.toolbarFilters}>
        <div className={styles.statusFilters} role="group" aria-label="Filter by status">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              className={`${styles.filterBtn} ${statusFilter === opt.value ? styles.filterBtnActive : ''}`}
              onClick={() => onStatusChange(opt.value)}
              aria-pressed={statusFilter === opt.value}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <input
          type="text"
          className={styles.filterInput}
          placeholder="Assignee"
          aria-label="Filter by assignee"
          value={assigneeFilter}
          onChange={(e) => onAssigneeChange(e.target.value)}
        />
        <select
          className={styles.filterSelect}
          aria-label="Filter by scene"
          value={sceneFilter}
          onChange={(e) => onSceneChange(e.target.value)}
        >
          <option value="">All scenes</option>
          {scenes.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
