'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { CanonEntity, SceneEntityLink } from '@/types/series';
import { Story } from '@/types/story';
import styles from './EntityReferenceList.module.css';

interface EntityReferenceListProps {
  entity: CanonEntity | null;
  links: SceneEntityLink[];
  stories: Story[];
  onClose?: () => void;
  onUpdateEntity?: (
    id: string,
    updates: Partial<Pick<CanonEntity, 'name' | 'summary' | 'tags'>>
  ) => void;
  onOpenSceneLinkDialog?: () => void;
}

const TYPE_LABEL: Record<string, string> = {
  character: 'Character',
  location: 'Location',
  lore: 'Lore',
};

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function EntityReferenceList({
  entity,
  links,
  stories,
  onClose,
  onUpdateEntity,
  onOpenSceneLinkDialog,
}: EntityReferenceListProps) {
  const [expandedStories, setExpandedStories] = useState<Set<string>>(new Set());
  const [editName, setEditName] = useState('');
  const [editSummary, setEditSummary] = useState('');
  const [editTags, setEditTags] = useState('');
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (entity) {
      setEditName(entity.name);
      setEditSummary(entity.summary);
      setEditTags(entity.tags.join(', '));
      setEditing(false);
    }
  }, [entity]);

  if (!entity) {
    return (
      <div className={styles.empty}>
        <p>Select an entity to see details</p>
      </div>
    );
  }

  const storyMap = new Map(stories.map(s => [s.id, s]));

  const linksByStory = links.reduce<Record<string, SceneEntityLink[]>>((acc, link) => {
    if (!acc[link.storyId]) acc[link.storyId] = [];
    acc[link.storyId].push(link);
    return acc;
  }, {});

  const linkedStoryIds = Object.keys(linksByStory);

  const toggleStory = (storyId: string) => {
    setExpandedStories(prev => {
      const next = new Set(prev);
      if (next.has(storyId)) next.delete(storyId);
      else next.add(storyId);
      return next;
    });
  };

  const handleSaveEdit = () => {
    if (!onUpdateEntity) return;
    const parsedTags = editTags.split(',').map(t => t.trim()).filter(Boolean);
    onUpdateEntity(entity.id, {
      name: editName.trim(),
      summary: editSummary.trim(),
      tags: parsedTags,
    });
    setEditing(false);
  };

  return (
    <div className={styles.panel}>
      {onClose && (
        <button
          type="button"
          className={styles.closeButton}
          onClick={onClose}
          aria-label="Close detail panel"
        >
          ✕
        </button>
      )}

      <div className={styles.header}>
        {editing ? (
          <input
            type="text"
            className={styles.editNameInput}
            value={editName}
            onChange={e => setEditName(e.target.value)}
            aria-label="Entity name"
          />
        ) : (
          <h1 className={styles.entityName}>{entity.name}</h1>
        )}
        <span className={styles.typeBadge}>{TYPE_LABEL[entity.type]}</span>
      </div>

      {editing ? (
        <textarea
          className={styles.editSummaryTextarea}
          value={editSummary}
          onChange={e => setEditSummary(e.target.value)}
          rows={3}
          aria-label="Entity summary"
        />
      ) : (
        entity.summary && <p className={styles.summary}>{entity.summary}</p>
      )}

      {editing ? (
        <div className={styles.editTagsRow}>
          <label htmlFor="entity-tags-input" className={styles.editTagsLabel}>
            Tags (comma-separated)
          </label>
          <input
            id="entity-tags-input"
            type="text"
            className={styles.editTagsInput}
            value={editTags}
            onChange={e => setEditTags(e.target.value)}
            placeholder="e.g. protagonist, magic, chapter-1"
          />
        </div>
      ) : (
        entity.tags.length > 0 && (
          <div className={styles.tags}>
            {entity.tags.map(tag => (
              <span key={tag} className={styles.tag}>{tag}</span>
            ))}
          </div>
        )
      )}

      {onUpdateEntity && (
        <div className={styles.editActions}>
          {editing ? (
            <>
              <button
                type="button"
                className={styles.saveEditButton}
                onClick={handleSaveEdit}
                disabled={!editName.trim()}
              >
                Save
              </button>
              <button
                type="button"
                className={styles.cancelEditButton}
                onClick={() => {
                  setEditName(entity.name);
                  setEditSummary(entity.summary);
                  setEditTags(entity.tags.join(', '));
                  setEditing(false);
                }}
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              type="button"
              className={styles.editButton}
              onClick={() => setEditing(true)}
            >
              Edit
            </button>
          )}
        </div>
      )}

      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>
            Appears in ({links.length} scene{links.length !== 1 ? 's' : ''})
          </h2>
          {onOpenSceneLinkDialog && (
            <button
              type="button"
              className={styles.linkSceneButton}
              onClick={onOpenSceneLinkDialog}
              aria-label="Link to a scene"
            >
              + Link to scene
            </button>
          )}
        </div>
        {linkedStoryIds.length === 0 ? (
          <p className={styles.noLinks}>Not linked to any scenes yet.</p>
        ) : (
          <ul className={styles.storyList}>
            {linkedStoryIds.map(storyId => {
              const story = storyMap.get(storyId);
              const storyLinks = linksByStory[storyId];
              const isExpanded = expandedStories.has(storyId);
              return (
                <li key={storyId} className={styles.storyGroup}>
                  <button
                    type="button"
                    className={styles.storyToggle}
                    onClick={() => toggleStory(storyId)}
                    aria-expanded={isExpanded}
                  >
                    <span className={styles.storyTitle}>
                      {story?.title ?? 'Unknown story'}
                    </span>
                    <span className={styles.sceneCount}>
                      {storyLinks.length} scene{storyLinks.length !== 1 ? 's' : ''}
                    </span>
                    <span className={styles.chevron}>{isExpanded ? '▲' : '▼'}</span>
                  </button>
                  {isExpanded && (
                    <ul className={styles.sceneList}>
                      {storyLinks.map(link => (
                        <li key={link.id}>
                          <Link
                            href={`/story/${link.storyId}?scene=${link.sceneId}`}
                            className={styles.sceneLink}
                          >
                            Scene {link.sceneId.slice(0, 8)}…
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <p className={styles.lastUpdated}>Last updated {formatDate(entity.updatedAt)}</p>
    </div>
  );
}
