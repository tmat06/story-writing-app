'use client';

import Link from 'next/link';
import { Story } from '@/types/story';
import { Series } from '@/types/series';
import { getSeriesById } from '@/lib/series';
import StoryActionMenu from '@/components/StoryActionMenu/StoryActionMenu';
import styles from './StoryCard.module.css';

interface StoryCardProps {
  story: Story;
  showActions?: boolean;
  availableSeries?: Series[];
  onUpdate?: () => void;
  onClick?: () => void;
}

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

export default function StoryCard({
  story,
  showActions = false,
  availableSeries = [],
  onUpdate,
  onClick,
}: StoryCardProps) {
  const CardWrapper = onClick ? 'button' : 'div';
  const archivedClass = story.isArchived ? ` ${styles.archived}` : '';
  const wrapperProps = onClick
    ? {
        onClick,
        className: `${styles.card} ${styles.clickable}${archivedClass}`,
        type: 'button' as const,
      }
    : { className: `${styles.card}${archivedClass}` };

  const series = story.seriesId ? getSeriesById(story.seriesId) : undefined;

  return (
    <CardWrapper {...wrapperProps}>
      <div className={styles.content}>
        <h4 className={styles.title}>{story.title}</h4>
        {series && (
          <Link
            href={`/series/${series.id}`}
            className={styles.seriesBadge}
            onClick={e => e.stopPropagation()}
          >
            {series.title}
          </Link>
        )}
        <p className={styles.timestamp}>
          Last edited {formatRelativeTime(story.updatedAt)}
        </p>
      </div>
      {showActions && onUpdate && (
        <div className={styles.actions}>
          <StoryActionMenu
            storyId={story.id}
            storyTitle={story.title}
            isArchived={story.isArchived}
            seriesId={story.seriesId}
            availableSeries={availableSeries}
            onUpdate={onUpdate}
          />
        </div>
      )}
    </CardWrapper>
  );
}
