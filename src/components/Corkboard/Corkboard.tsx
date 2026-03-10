import { useState, useEffect } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
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
  scenes: Scene[];
  onSceneClick: (sceneId: string) => void;
  onReorder: (sceneId: string, newOrder: number) => void;
  onStatusChange: (sceneId: string, status: SceneStatus) => void;
  loading?: boolean;
}

interface SortableSceneCardProps {
  scene: Scene;
  onClick: () => void;
  onStatusChange: (status: SceneStatus) => void;
}

function SortableSceneCard({
  scene,
  onClick,
  onStatusChange,
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
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <SceneCard
        scene={scene}
        onClick={onClick}
        onStatusChange={onStatusChange}
        isDragging={isDragging}
      />
    </div>
  );
}

function SkeletonCard() {
  return <div className={styles.skeleton} />;
}

export function Corkboard({
  scenes: initialScenes,
  onSceneClick,
  onReorder,
  onStatusChange,
  loading = false,
}: CorkboardProps) {
  const [scenes, setScenes] = useState(initialScenes);

  useEffect(() => {
    setScenes(initialScenes);
  }, [initialScenes]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = scenes.findIndex((s) => s.id === active.id);
      const newIndex = scenes.findIndex((s) => s.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        const reorderedScenes = arrayMove(scenes, oldIndex, newIndex);
        setScenes(reorderedScenes);

        // Call the callback with the new order
        const newOrder = newIndex + 1;
        onReorder(active.id as string, newOrder);
      }
    }
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
        <div className={styles.toolbar}>
          <span className={styles.sceneCount}>0 scenes</span>
          <div className={styles.toolbarRight} />
        </div>
        <div className={styles.emptyState}>
          <p>No scenes yet. Create your first scene to get started.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div
        className={styles.toolbar}
        role="toolbar"
        aria-label="Scene planning controls"
      >
        <span className={styles.sceneCount}>
          {scenes.length} {scenes.length === 1 ? 'scene' : 'scenes'}
        </span>
        <div className={styles.toolbarRight}>
          {/* Future: filter controls */}
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={scenes.map((s) => s.id)}
          strategy={rectSortingStrategy}
        >
          <div className={styles.grid} role="list">
            {scenes.map((scene) => (
              <SortableSceneCard
                key={scene.id}
                scene={scene}
                onClick={() => onSceneClick(scene.id)}
                onStatusChange={(status) => onStatusChange(scene.id, status)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
