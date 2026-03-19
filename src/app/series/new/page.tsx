'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSeries } from '@/lib/series';
import styles from './page.module.css';

export default function NewSeriesPage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || isCreating) return;
    setIsCreating(true);
    const series = createSeries(title.trim());
    router.push(`/series/${series.id}`);
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.title}>Start your first series</h1>
        <p className={styles.description}>
          A series lets you manage shared characters, locations, and lore across
          multiple stories in one place.
        </p>
        <form onSubmit={handleSubmit} className={styles.form}>
          <label htmlFor="series-title" className={styles.label}>
            Series name
          </label>
          <input
            id="series-title"
            type="text"
            className={styles.input}
            placeholder="e.g. The Ember Trilogy"
            value={title}
            onChange={e => setTitle(e.target.value)}
            autoFocus
          />
          <button
            type="submit"
            className={styles.submitButton}
            disabled={!title.trim() || isCreating}
          >
            {isCreating ? 'Creating…' : 'Create series'}
          </button>
        </form>
      </div>
    </div>
  );
}
