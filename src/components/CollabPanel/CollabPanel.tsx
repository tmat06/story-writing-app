'use client';

import { useState, useCallback } from 'react';
import { getThreads, filterThreads, getUnresolvedCount, updateThread } from '@/lib/collaboration';
import type { CollabThread, ThreadStatus } from '@/types/collaboration';
import type { Scene } from '@/types/scene';
import { CollabInboxToolbar } from './CollabInboxToolbar';
import { CollabThreadRow } from './CollabThreadRow';
import { CollabThreadDetail } from './CollabThreadDetail';
import { AddThreadModal } from './AddThreadModal';
import styles from './CollabPanel.module.css';

interface Props {
  storyId: string;
  scenes: Scene[];
  onSceneJump: (sceneId: string) => void;
}

type PanelView = 'inbox' | 'decisions';

function applyFilters(
  threads: CollabThread[],
  filters: { status: ThreadStatus | 'all'; assignee: string; sceneId: string }
): CollabThread[] {
  return filterThreads(threads, filters);
}

export function CollabPanel({ storyId, scenes, onSceneJump }: Props) {
  const [view, setView] = useState<PanelView>('inbox');
  const [statusFilter, setStatusFilter] = useState<ThreadStatus | 'all'>('all');
  const [assigneeFilter, setAssigneeFilter] = useState('');
  const [sceneFilter, setSceneFilter] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  const threads = getThreads(storyId);
  const unresolvedCount = getUnresolvedCount(storyId);

  const filtered = applyFilters(threads, {
    status: statusFilter,
    assignee: assigneeFilter,
    sceneId: sceneFilter,
  });

  const decisionThreads = threads.filter((t) => !!t.decision);

  const handleToggle = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const handleStatusChange = (threadId: string, status: ThreadStatus) => {
    updateThread(storyId, threadId, { status });
    refresh();
  };

  return (
    <div className={styles.panel} aria-label="Collaboration panel">
      <div className={styles.viewToggle} role="tablist" aria-label="Collaboration view">
        <button
          role="tab"
          aria-selected={view === 'inbox'}
          id="tab-collab-inbox"
          aria-controls="panel-collab-inbox"
          className={`${styles.viewTab} ${view === 'inbox' ? styles.viewTabActive : ''}`}
          onClick={() => setView('inbox')}
        >
          Inbox
          {unresolvedCount > 0 && <span className={styles.badge}>{unresolvedCount > 99 ? '99+' : unresolvedCount}</span>}
        </button>
        <button
          role="tab"
          aria-selected={view === 'decisions'}
          id="tab-collab-decisions"
          aria-controls="panel-collab-decisions"
          className={`${styles.viewTab} ${view === 'decisions' ? styles.viewTabActive : ''}`}
          onClick={() => setView('decisions')}
        >
          Decision log
        </button>
      </div>

      {view === 'inbox' ? (
        <div role="tabpanel" id="panel-collab-inbox" aria-labelledby="tab-collab-inbox">
          <CollabInboxToolbar
            unresolvedCount={unresolvedCount}
            statusFilter={statusFilter}
            assigneeFilter={assigneeFilter}
            sceneFilter={sceneFilter}
            scenes={scenes}
            onStatusChange={setStatusFilter}
            onAssigneeChange={setAssigneeFilter}
            onSceneChange={setSceneFilter}
            onAddThread={() => setShowModal(true)}
          />
          <div className={styles.threadList}>
            {filtered.length === 0 && (
              <div className={styles.empty}>
                {threads.length === 0
                  ? <p>No threads yet. Start a collaboration by creating a thread.</p>
                  : <p>No results for current filters. <button className={styles.clearFiltersBtn} onClick={() => { setStatusFilter('all'); setAssigneeFilter(''); setSceneFilter(''); }}>Clear filters</button></p>
                }
              </div>
            )}
            {filtered.map((thread) => (
              <div key={thread.id} className={styles.threadItem}>
                <CollabThreadRow
                  thread={thread}
                  isExpanded={expandedId === thread.id}
                  onToggle={() => handleToggle(thread.id)}
                  onStatusChange={(status) => handleStatusChange(thread.id, status)}
                  onJumpToScene={() => onSceneJump(thread.sceneId)}
                />
                {expandedId === thread.id && (
                  <CollabThreadDetail
                    thread={thread}
                    onUpdate={refresh}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div role="tabpanel" id="panel-collab-decisions" aria-labelledby="tab-collab-decisions">
          <div className={styles.threadList}>
            {decisionThreads.length === 0 && (
              <div className={styles.empty}>
                <p>No decisions recorded yet.</p>
              </div>
            )}
            {decisionThreads.map((thread) => (
              <div key={thread.id} className={styles.decisionLogItem}>
                <div className={styles.decisionLogHeader}>
                  <span className={`${styles.decisionBadge} ${styles[`decision_${thread.decision!.action}`]}`}>
                    {thread.decision!.action === 'accepted' ? 'Accepted' : 'Rejected'}
                  </span>
                  <span className={styles.decisionLogTitle}>{thread.title}</span>
                </div>
                <div className={styles.decisionLogMeta}>
                  <span>{thread.sceneTitle}</span>
                  <span>{thread.decision!.actor}</span>
                  <span>{new Date(thread.decision!.timestamp).toLocaleDateString()}</span>
                </div>
                {thread.decision!.note && (
                  <p className={styles.decisionLogNote}>{thread.decision!.note}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {showModal && (
        <AddThreadModal
          storyId={storyId}
          scenes={scenes}
          onCreated={() => { setShowModal(false); refresh(); }}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
