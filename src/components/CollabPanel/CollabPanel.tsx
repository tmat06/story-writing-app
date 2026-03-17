'use client';

import { useState, useCallback } from 'react';
import type { CollabThread, CollabFilters, ThreadStatus } from '@/types/collaboration';
import type { Scene } from '@/types/scene';
import {
  getThreads,
  getUnresolvedCount,
  updateThread,
  filterThreads,
} from '@/lib/collaboration';
import { CollabInboxToolbar } from './CollabInboxToolbar';
import { CollabThreadRow } from './CollabThreadRow';
import { CollabThreadDetail } from './CollabThreadDetail';
import { AddThreadModal } from './AddThreadModal';
import styles from './CollabPanel.module.css';

type PanelView = 'inbox' | 'decision-log';

interface CollabPanelProps {
  storyId: string;
  scenes: Scene[];
  onSceneJump: (sceneId: string | null) => void;
}

export function CollabPanel({ storyId, scenes, onSceneJump }: CollabPanelProps) {
  const [view, setView] = useState<PanelView>('inbox');
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState<ThreadStatus | 'all'>('all');
  const [assigneeFilter, setAssigneeFilter] = useState('');
  const [sceneFilter, setSceneFilter] = useState<string | null | 'all'>('all');
  const [threads, setThreads] = useState<CollabThread[]>(() => getThreads(storyId));
  const [unresolvedCount, setUnresolvedCount] = useState(() => getUnresolvedCount(storyId));

  const refresh = useCallback(() => {
    setThreads(getThreads(storyId));
    setUnresolvedCount(getUnresolvedCount(storyId));
  }, [storyId]);

  const activeThread = threads.find((t) => t.id === activeThreadId) ?? null;

  const applyFilters = (
    allThreads: CollabThread[],
    sf: ThreadStatus | 'all',
    af: string,
    sceneFlt: string | null | 'all'
  ): CollabThread[] => {
    const f: CollabFilters = {};
    if (sf !== 'all') f.status = [sf];
    if (af.trim()) f.assignee = af.trim();
    if (sceneFlt !== 'all') f.sceneId = sceneFlt;
    return filterThreads(allThreads, f);
  };

  const displayThreads = view === 'decision-log'
    ? threads.filter((t) => t.status === 'resolved' && t.decision)
    : applyFilters(threads, statusFilter, assigneeFilter, sceneFilter);

  const handleStatusChange = (threadId: string, status: ThreadStatus) => {
    updateThread(storyId, threadId, { status });
    refresh();
  };

  const handleSceneJump = (sceneId: string | null) => {
    onSceneJump(sceneId);
  };

  const clearFilters = () => {
    setStatusFilter('all');
    setAssigneeFilter('');
    setSceneFilter('all');
  };

  const hasFilters = statusFilter !== 'all' || assigneeFilter !== '' || sceneFilter !== 'all';

  return (
    <div className={styles.panel}>
      <div className={styles.viewToggle}>
        <button
          className={`${styles.viewBtn} ${view === 'inbox' ? styles.viewBtnActive : ''}`}
          onClick={() => setView('inbox')}
        >
          Inbox
        </button>
        <button
          className={`${styles.viewBtn} ${view === 'decision-log' ? styles.viewBtnActive : ''}`}
          onClick={() => setView('decision-log')}
        >
          Decision log
        </button>
      </div>

      {view === 'inbox' && (
        <CollabInboxToolbar
          unresolvedCount={unresolvedCount}
          statusFilter={statusFilter}
          assigneeFilter={assigneeFilter}
          sceneFilter={sceneFilter}
          scenes={scenes}
          onStatusFilterChange={setStatusFilter}
          onAssigneeFilterChange={setAssigneeFilter}
          onSceneFilterChange={setSceneFilter}
        />
      )}

      <div className={styles.threadList}>
        {displayThreads.length === 0 ? (
          <div className={styles.emptyState}>
            {view === 'decision-log' ? (
              <p className={styles.emptyText}>No decisions recorded yet.</p>
            ) : hasFilters ? (
              <>
                <p className={styles.emptyText}>No results for current filters.</p>
                <button className={styles.clearFilterBtn} onClick={clearFilters}>
                  Clear filters
                </button>
              </>
            ) : (
              <p className={styles.emptyText}>
                No unresolved threads — back to drafting!
              </p>
            )}
          </div>
        ) : (
          displayThreads.map((thread) => (
            <CollabThreadRow
              key={thread.id}
              thread={thread}
              isActive={activeThreadId === thread.id}
              onSelect={(id) =>
                setActiveThreadId((prev) => (prev === id ? null : id))
              }
              onSceneJump={handleSceneJump}
              onStatusChange={handleStatusChange}
            />
          ))
        )}
      </div>

      {activeThread && (
        <CollabThreadDetail
          thread={activeThread}
          onClose={() => setActiveThreadId(null)}
          onMutate={refresh}
        />
      )}

      {view === 'inbox' && (
        <div className={styles.addRow}>
          <button
            className={styles.addBtn}
            onClick={() => setShowAddModal(true)}
          >
            + Add thread
          </button>
        </div>
      )}

      {showAddModal && (
        <AddThreadModal
          storyId={storyId}
          scenes={scenes}
          onClose={() => setShowAddModal(false)}
          onCreated={() => {
            refresh();
            setShowAddModal(false);
          }}
        />
      )}
    </div>
  );
}
