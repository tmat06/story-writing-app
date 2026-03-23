'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getStories } from '@/lib/stories';
import StoryCard from '@/components/StoryCard/StoryCard';
import NextUpQueue from '@/components/NextUpQueue/NextUpQueue';
import styles from "./page.module.css";

export default function Home() {
  const [stories, setStories] = useState<ReturnType<typeof getStories>>([]);
  const router = useRouter();

  useEffect(() => {
    setStories(getStories());
  }, []);

  const activeStories = stories.filter(s => !s.isArchived);

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
        <NextUpQueue />

        <section className={styles.card} aria-labelledby="recent-stories-heading">
          <h3 id="recent-stories-heading" className={styles.cardTitle}>
            Recent Stories
          </h3>
          {activeStories.length > 0 ? (
            <div>
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
            <div className={styles.emptyState}>
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
