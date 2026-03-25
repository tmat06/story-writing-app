import { useState, useEffect, useRef, useMemo } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Scene, SceneStatus } from '@/types/scene';
import { SceneCard } from '@/components/SceneCard/SceneCard';
import styles from './Corkboard.module.css';

interface CorkboardProps {
  storyId: string;
  scenes: Scene[];
  onSceneClick: (sceneId: string) => void;
  onReorder: (sceneId: string, newOrder: number) => void;
  onStatusChange: (sceneId: string, status: SceneStatus) => void;
  onBulkStatusChange: (sceneIds: string[], status: SceneStatus) => void;
  onAddScene: (scene: Omit<Scene, 'id' | 'order'>) => void;
  onFieldChange: (sceneId: string, field: 'intent' | 'pov' | 'characters', value: string) => void;
  statusFilter?: SceneStatus | 'all';
  loading?: boolean;
  focusedSceneId?: string | null;
  onFocusClear?: () => void;
}

interface SortableSceneCardProps {
  storyId: string;
  scene: Scene;
  onClick: () => void;
  onStatusChange: (status: SceneStatus) => void;
  onFieldChange: (field: 'intent' | 'pov' | 'characters', value: string) => void;
  isSynced?: boolean;
  isDropTarget?: boolean;
  isFocused?: boolean;
  isSelected?: boolean;
  onSelect?: (sceneId: string, shiftActive: boolean) => void;
}

function SortableSceneCard({
  storyId,
  scene,
  onClick,
  onStatusChange,
  onFieldChange,
  isSynced,
  isDropTarget,
  isFocused,
  isSelected,
  onSelect,
}: SortableSceneCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: scene.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div id={`scene-card-${scene.id}`} ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <SceneCard
        storyId={storyId}
        scene={scene}
        onClick={onClick}
        onStatusChange={onStatusChange}
        onFieldChange={onFieldChange}
        isDragging={isDragging}
        isSynced={isSynced}
        isDropTarget={isDropTarget}
        isFocused={isFocused}
        isSelected={isSelected}
        onSelect={onSelect}
      />
    </div>
  );
}

function SkeletonCard() {
  return <div className={styles.skeleton} />;
}

const STARTER_BEATS: Omit<Scene, 'id' | 'order'>[] = [
  {
    title: 'Act 1 Setup',
    chapter: 'Chapter 1',
    summary: '',
    status: 'planned',
    intent: 'Establish world and protagonist',
    pov: '',
  },
  {
    title: 'First Turn',
    chapter: 'Chapter 1',
    summary: '',
    status: 'planned',
    intent: 'Disrupt the status quo',
    pov: '',
  },
  {
    title: 'Commitment',
    chapter: 'Chapter 1',
    summary: '',
    status: 'planned',
    intent: 'Lock protagonist into the journey',
    pov: '',
  },
];

interface ChapterFilter {
  chapter: string | null;
}

export function Corkboard({
  storyId,
  scenes: initialScenes,
  onSceneClick,
  onReorder,
  onStatusChange,
  onBulkStatusChange,
  onAddScene,
  onFieldChange,
  statusFilter = 'all',
  loading = false,
  focusedSceneId,
  onFocusClear,
}: CorkboardProps) {
  const [scenes, setScenes] = useState(initialScenes);
  const [chapterFilter, setChapterFilter] = useState<ChapterFilter>(() => {
    if (typeof window === 'undefined') return { chapter: null };
    const key = `story-${storyId}-board-chapter-filter`;
    try {
      const stored = localStorage.getItem(key);
      if (stored) return JSON.parse(stored) as ChapterFilter;
    } catch (e) {
      console.warn(`Failed to parse chapter filter for story ${storyId}`, e);
    }
    return { chapter: null };
  });
  const [syncedIds, setSyncedIds] = useState<Set<string>>(new Set());
  const syncTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const prevScenesRef = useRef<Scene[]>(initialScenes);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [selectedSceneIds, setSelectedSceneIds] = useState<Set<string>>(new Set());
  const lastSelectedIdRef = useRef<string | null>(null);

  useEffect(() => {
    const prev = prevScenesRef.current;
    const changed = initialScenes
      .filter((s) => {
        const p = prev.find((p) => p.id === s.id);
        return p && JSON.stringify(p) !== JSON.stringify(s);
      })
      .map((s) => s.id);

    setScenes(initialScenes);
    prevScenesRef.current = initialScenes;

    if (changed.length > 0) {
      setSyncedIds((prev) => new Set([...prev, ...changed]));
      changed.forEach((id) => {
        if (syncTimers.current.has(id)) clearTimeout(syncTimers.current.get(id));
        const timer = setTimeout(() => {
          setSyncedIds((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
          syncTimers.current.delete(id);
        }, 800);
        syncTimers.current.set(id, timer);
      });
    }
  }, [initialScenes]);

  useEffect(() => {
    const timers = syncTimers.current;
    return () => { timers.forEach((t) => clearTimeout(t)); };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(`story-${storyId}-board-chapter-filter`, JSON.stringify(chapterFilter));
  }, [storyId, chapterFilter]);

  useEffect(() => {
    if (!focusedSceneId) return;
    const el = document.getElementById(`scene-card-${focusedSceneId}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const timer = setTimeout(() => onFocusClear?.(), 2000);
    return () => clearTimeout(timer);
  }, [focusedSceneId, onFocusClear]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragOver = (event: DragOverEvent) => {
    setOverId(event.over ? (event.over.id as string) : null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    setOverId(null);
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = scenes.findIndex((s) => s.id === active.id);
      const newIndex = scenes.findIndex((s) => s.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        const reorderedScenes = arrayMove(scenes, oldIndex, newIndex);
        setScenes(reorderedScenes);

        const newOrder = newIndex + 1;
        onReorder(active.id as string, newOrder);
      }
    }
  };

  // Clear selection when filters change
  useEffect(() => {
    setSelectedSceneIds(new Set());
    lastSelectedIdRef.current = null;
  }, [statusFilter, chapterFilter]);

  const availableChapters = Array.from(new Set(scenes.map((s) => s.chapter))).sort();

  const displayScenes = scenes.filter((s) => {
    const statusMatch = statusFilter === 'all' || s.status === statusFilter;
    const chapterMatch = chapterFilter.chapter === null || s.chapter === chapterFilter.chapter;
    return statusMatch && chapterMatch;
  });

  const statusCounts = useMemo(() => ({
    planned: displayScenes.filter(s => s.status === 'planned').length,
    drafting: displayScenes.filter(s => s.status === 'drafting').length,
    done: displayScenes.filter(s => s.status === 'done').length,
  }), [displayScenes]);
  const total = displayScenes.length;

  const handleSceneSelect = (sceneId: string, shiftActive: boolean = false) => {
    if (shiftActive && lastSelectedIdRef.current) {
      const ids = displayScenes.map(s => s.id);
      const a = ids.indexOf(lastSelectedIdRef.current);
      const b = ids.indexOf(sceneId);
      const [lo, hi] = a < b ? [a, b] : [b, a];
      const rangeIds = ids.slice(lo, hi + 1);
      setSelectedSceneIds(prev => {
        const next = new Set(prev);
        rangeIds.forEach(id => next.add(id));
        return next;
      });
    } else {
      setSelectedSceneIds(prev => {
        const next = new Set(prev);
        if (next.has(sceneId)) next.delete(sceneId); else next.add(sceneId);
        return next;
      });
    }
    lastSelectedIdRef.current = sceneId;
  };

  const handleSelectAll = () => {
    setSelectedSceneIds(new Set(displayScenes.map(s => s.id)));
  };

  const handleClearSelection = () => {
    setSelectedSceneIds(new Set());
    lastSelectedIdRef.current = null;
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.toolbar}>
          <span className={styles.sceneCount}>Loading...</span>
          <div className={styles.toolbarRight} />
        </div>
        <div className={styles.grid}>
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (scenes.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.emptyState}>
          <h2 className={styles.emptyTitle}>Start planning your story</h2>
          <p className={styles.emptyBody}>
            Add beats one by one, or start with these suggested scenes:
          </p>
          <div className={styles.starterBeats}>
            {STARTER_BEATS.map((beat) => (
              <button
                key={beat.title}
                className={styles.starterBeat}
                onClick={() => onAddScene(beat)}
              >
                <span className={styles.starterBeatTitle}>{beat.title}</span>
                <span className={styles.starterBeatIntent}>{beat.intent}</span>
              </button>
            ))}
          </div>
          <button
            className={styles.addSceneBtn}
            onClick={() =>
              onAddScene({
                title: 'New Scene',
                chapter: 'Chapter 1',
                summary: '',
                status: 'planned',
                intent: '',
                pov: '',
              })
            }
          >
            + Create first beat
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {total > 0 && (
        <div className={styles.progressStripWrapper}>
          <div className={styles.progressStrip}>
            <div className={`${styles.progressSegment} ${styles.segmentPlanned}`}
                 style={{ width: `${(statusCounts.planned / total) * 100}%` }} />
            <div className={`${styles.progressSegment} ${styles.segmentDrafting}`}
                 style={{ width: `${(statusCounts.drafting / total) * 100}%` }} />
            <div className={`${styles.progressSegment} ${styles.segmentDone}`}
                 style={{ width: `${(statusCounts.done / total) * 100}%` }} />
          </div>
          <div className={styles.progressLabels}>
            <span className={styles.labelPlanned}>{statusCounts.planned} planned</span>
            <span className={styles.labelDrafting}>{statusCounts.drafting} drafting</span>
            <span className={styles.labelDone}>{statusCounts.done} done</span>
          </div>
        </div>
      )}

      {availableChapters.length > 0 && (
        <div className={styles.chapterFilterRow} role="group" aria-label="Filter by chapter">
          <span className={styles.filterLabel}>Chapter</span>
          <button
            className={`${styles.chapterChip} ${chapterFilter.chapter === null ? styles.chapterChipActive : ''}`}
            onClick={() => setChapterFilter({ chapter: null })}
            aria-pressed={chapterFilter.chapter === null}
          >
            All
          </button>
          {availableChapters.map((ch) => (
            <button
              key={ch}
              className={`${styles.chapterChip} ${chapterFilter.chapter === ch ? styles.chapterChipActive : ''}`}
              onClick={() => setChapterFilter({ chapter: ch })}
              aria-pressed={chapterFilter.chapter === ch}
            >
              {ch}
            </button>
          ))}
        </div>
      )}

      {displayScenes.length > 0 && (
        <div
          className={styles.selectionRow}
          role="toolbar"
          aria-label="Scene selection controls"
        >
          <button
            onClick={handleSelectAll}
            className={styles.bulkBtnSecondary}
          >
            Select all
          </button>

          {selectedSceneIds.size > 0 && (
            <>
              <span className={styles.selectionCount}>
                {selectedSceneIds.size} selected
              </span>
              <div
                className={styles.bulkActionGroup}
                role="group"
                aria-label="Bulk scene status actions"
              >
                <button
                  className={styles.bulkBtn}
                  onClick={() => {
                    onBulkStatusChange(Array.from(selectedSceneIds), 'planned');
                    handleClearSelection();
                  }}
                >
                  Set Planned
                </button>
                <button
                  className={styles.bulkBtn}
                  onClick={() => {
                    onBulkStatusChange(Array.from(selectedSceneIds), 'drafting');
                    handleClearSelection();
                  }}
                >
                  Set Drafting
                </button>
                <button
                  className={styles.bulkBtn}
                  onClick={() => {
                    onBulkStatusChange(Array.from(selectedSceneIds), 'done');
                    handleClearSelection();
                  }}
                >
                  Set Done
                </button>
              </div>
              <button
                onClick={handleClearSelection}
                className={styles.bulkBtnSecondary}
                aria-label="Clear selection"
              >
                ✕ Clear
              </button>
            </>
          )}
        </div>
      )}

      <DndContext
        sensors={selectedSceneIds.size > 0 ? [] : sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={scenes.map((s) => s.id)}
          strategy={rectSortingStrategy}
        >
          <div className={styles.grid} role="list">
            {displayScenes.map((scene) => (
              <SortableSceneCard
                key={scene.id}
                storyId={storyId}
                scene={scene}
                onClick={() => onSceneClick(scene.id)}
                onStatusChange={(status) => onStatusChange(scene.id, status)}
                onFieldChange={(field, value) => onFieldChange(scene.id, field, value)}
                isSynced={syncedIds.has(scene.id)}
                isDropTarget={overId === scene.id && activeId !== scene.id}
                isFocused={focusedSceneId === scene.id}
                isSelected={selectedSceneIds.has(scene.id)}
                onSelect={(id, shiftActive) => handleSceneSelect(id, shiftActive)}
              />
            ))}
          </div>
          {scenes.length > 0 && displayScenes.length === 0 && (
            <div className={styles.filteredEmpty}>
              <p>No scenes match this filter.</p>
              <button
                className={styles.clearFiltersBtn}
                onClick={() => setChapterFilter({ chapter: null })}
              >
                Clear filters
              </button>
            </div>
          )}
        </SortableContext>
      </DndContext>
    </div>
  );
}
