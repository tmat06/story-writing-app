'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getStories } from '@/lib/stories';
import StoryCard from '@/components/StoryCard/StoryCard';
import { Skeleton } from '@/components/Skeleton/Skeleton';
import styles from "./page.module.css";

export default function Home() {
  const [stories, setStories] = useState<ReturnType<typeof getStories>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const loadStart = Date.now();
    setStories(getStories());
    const elapsed = Date.now() - loadStart;
    const remaining = Math.max(0, 160 - elapsed);
    const timer = setTimeout(() => setIsLoading(false), remaining);
    return () => clearTimeout(timer);
  }, []);

  const activeStories = stories.filter(s => !s.isArchived);
  const mostRecent = activeStories[0];

  const handleUpdate = () => {
    setStories(getStories());
  };

  const handleNavigate = (id: string) => {
    router.push(`/story/${id}`);
  };

  return (
    <div className={styles.page}>
      <section className={styles.welcome}>
        <h2 className={styles.welcomeTitle}>Welcome back</h2>
        <p className={styles.welcomeText}>
          A calm drafting space for your next chapter.
        </p>
      </section>

      <div className={styles.dashboard}>
        <section className={styles.quickResumeCard} aria-labelledby="quick-resume-heading">
          <h3 id="quick-resume-heading" className={styles.cardTitle}>
            Quick Resume
          </h3>
          {isLoading ? (
            <div className={styles.skeletonResume}>
              <Skeleton height="20px" width="65%" />
              <Skeleton height="12px" width="40%" />
              <Skeleton height="32px" width="120px" />
            </div>
          ) : mostRecent ? (
            <div className={`${styles.resumeContainer} ${styles.fadeIn}`}>
              <h4 className={styles.resumeTitle}>{mostRecent.title}</h4>
              <p className={styles.timestamp}>
                Last edited {formatRelativeTime(mostRecent.updatedAt)}
              </p>
              <button
                className={styles.resumeButton}
                onClick={() => handleNavigate(mostRecent.id)}
              >
                Resume writing
              </button>
            </div>
          ) : (
            <div className={`${styles.emptyState} ${styles.fadeIn}`}>
              <p className={styles.emptyText}>Nothing in progress</p>
              <p className={styles.emptyHint}>
                Your recently edited stories will appear here
              </p>
            </div>
          )}
        </section>

        <section className={styles.card} aria-labelledby="recent-stories-heading">
          <h3 id="recent-stories-heading" className={styles.cardTitle}>
            Recent Stories
          </h3>
          {isLoading ? (
            <div className={styles.skeletonList}>
              {[0, 1, 2].map(i => (
                <div key={i} className={styles.skeletonCard}>
                  <Skeleton height="16px" width="70%" />
                  <Skeleton height="12px" width="40%" />
                </div>
              ))}
            </div>
          ) : activeStories.length > 0 ? (
            <div className={styles.fadeIn}>
              <div className={styles.storyList}>
                {activeStories.slice(0, 3).map(story => (
                  <StoryCard
                    key={story.id}
                    story={story}
                    showActions={true}
                    onUpdate={handleUpdate}
                    onClick={() => handleNavigate(story.id)}
                  />
                ))}
              </div>
              <Link href="/stories" className={styles.viewAllLink}>View all stories →</Link>
            </div>
          ) : (
            <div className={`${styles.emptyState} ${styles.fadeIn}`}>
              <p className={styles.emptyText}>No stories yet</p>
              <p className={styles.emptyHint}>
                Create your first story from the Stories page
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
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
