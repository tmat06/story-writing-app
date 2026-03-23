'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getStories } from '@/lib/stories';
import { getAllSubmissionsAcrossStories, computeReminderStatus } from '@/lib/submissions';
import StoryCard from '@/components/StoryCard/StoryCard';
import styles from "./page.module.css";

export default function Home() {
  const [stories, setStories] = useState<ReturnType<typeof getStories>>([]);
  const router = useRouter();

  useEffect(() => {
    setStories(getStories());
  }, []);

  const activeStories = stories.filter(s => !s.isArchived);
  const mostRecent = activeStories[0];

  const urgentSubmissions = useMemo(() => {
    if (typeof window === 'undefined' || stories.length === 0) return [];
    const allSubs = getAllSubmissionsAcrossStories();
    return allSubs
      .filter((s) => {
        const rs = computeReminderStatus(s);
        return rs === 'overdue' || rs === 'follow_up_due';
      })
      .sort((a, b) => {
        const order = { overdue: 0, follow_up_due: 1, on_track: 2, none: 3 };
        return order[computeReminderStatus(a)] - order[computeReminderStatus(b)];
      })
      .slice(0, 3);
  }, [stories]);

  const handleUpdate = () => {
    setStories(getStories());
  };

  const storyTitleMap = useMemo(
    () => Object.fromEntries(stories.map((s) => [s.id, s.title])),
    [stories]
  );

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
          {mostRecent ? (
            <div className={styles.resumeContainer}>
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
            <div className={styles.emptyState}>
              <p className={styles.emptyText}>Nothing in progress</p>
              <p className={styles.emptyHint}>
                Your recently edited stories will appear here
              </p>
            </div>
          )}
        </section>

        {stories.length > 0 && (
          <section className={styles.followUpsCard} aria-labelledby="follow-ups-heading">
            <h3 id="follow-ups-heading" className={styles.cardTitle}>
              Follow-ups
            </h3>
            {urgentSubmissions.length > 0 ? (
              <ul className={styles.followUpList}>
                {urgentSubmissions.map((sub) => {
                  const rs = computeReminderStatus(sub);
                  return (
                    <li key={sub.id} className={styles.followUpItem}>
                      <span className={styles.followUpRecipient}>{sub.recipientName || 'Untitled'}</span>
                      <span className={styles.followUpStory}>{storyTitleMap[sub.storyId] ?? 'Unknown story'}</span>
                      <span className={rs === 'overdue' ? styles.chipOverdue : styles.chipDue}>
                        {rs === 'overdue' ? 'Overdue' : 'Follow-up due'}
                      </span>
                      <a
                        href={`/story/${sub.storyId}?tab=submissions`}
                        className={styles.followUpLink}
                      >
                        Open →
                      </a>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className={styles.emptyState}>
                <p className={styles.emptyText}>No follow-ups due</p>
              </div>
            )}
          </section>
        )}

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
