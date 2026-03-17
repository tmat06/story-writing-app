'use client';

import type { RevisionPass, ItemStatus } from '@/types/revision';
import { RevisionChecklistItem } from './RevisionChecklistItem';
import styles from './RevisionPassPanel.module.css';

interface Props {
  pass: RevisionPass;
  onItemSave: (itemId: string, status: ItemStatus, rationale: string) => void;
  onSceneJump: (sceneId: string) => void;
}

export function RevisionChecklist({ pass, onItemSave, onSceneJump }: Props) {
  const chapters = Array.from(new Set(pass.items.map((i) => i.chapter)));

  if (pass.items.length === 0) {
    return (
      <p className={styles.emptyState}>
        Add scenes in the Corkboard to get scene-linked items.
      </p>
    );
  }

  return (
    <div className={styles.checklist}>
      {chapters.map((chapter) => {
        const items = pass.items.filter((i) => i.chapter === chapter);
        return (
          <div key={chapter} className={styles.chapterGroup}>
            <h4 className={styles.chapterHeading}>{chapter}</h4>
            {items.map((item) => (
              <RevisionChecklistItem
                key={item.id}
                item={item}
                onSave={onItemSave}
                onSceneJump={onSceneJump}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}
