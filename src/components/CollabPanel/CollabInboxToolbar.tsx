import type { ThreadStatus } from '@/types/collaboration';
import type { Scene } from '@/types/scene';
import styles from './CollabInboxToolbar.module.css';

const STATUS_OPTIONS: { value: ThreadStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'needs-author', label: 'Needs Author' },
  { value: 'resolved', label: 'Resolved' },
];

interface CollabInboxToolbarProps {
  unresolvedCount: number;
  statusFilter: ThreadStatus | 'all';
  assigneeFilter: string;
  sceneFilter: string | null | 'all';
  scenes: Scene[];
  onStatusFilterChange: (status: ThreadStatus | 'all') => void;
  onAssigneeFilterChange: (assignee: string) => void;
  onSceneFilterChange: (sceneId: string | null | 'all') => void;
}

export function CollabInboxToolbar({
  unresolvedCount,
  statusFilter,
  assigneeFilter,
  sceneFilter,
  scenes,
  onStatusFilterChange,
  onAssigneeFilterChange,
  onSceneFilterChange,
}: CollabInboxToolbarProps) {
  return (
    <div className={styles.toolbar}>
      <div className={styles.topRow}>
        <span className={styles.count}>
          {unresolvedCount} unresolved
        </span>
      </div>
      <div className={styles.filters}>
        <div className={styles.statusFilters} role="group" aria-label="Filter by status">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              className={`${styles.filterBtn} ${statusFilter === opt.value ? styles.filterBtnActive : ''}`}
              onClick={() => onStatusFilterChange(opt.value as ThreadStatus | 'all')}
              aria-pressed={statusFilter === opt.value}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <input
          type="text"
          className={styles.assigneeInput}
          placeholder="Filter by assignee"
          value={assigneeFilter}
          onChange={(e) => onAssigneeFilterChange(e.target.value)}
          aria-label="Filter by assignee name"
        />
        <select
          className={styles.sceneSelect}
          value={sceneFilter === 'all' ? 'all' : sceneFilter === null ? 'story' : sceneFilter}
          onChange={(e) => {
            const val = e.target.value;
            if (val === 'all') onSceneFilterChange('all');
            else if (val === 'story') onSceneFilterChange(null);
            else onSceneFilterChange(val);
          }}
          aria-label="Filter by scene"
        >
          <option value="all">All scenes</option>
          <option value="story">Story-level</option>
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
