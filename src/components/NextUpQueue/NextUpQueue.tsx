'use client';

import { useState, useEffect } from 'react';
import { getNextUpItems } from '@/lib/homeQueue';
import type { NextUpItem } from '@/types/nextUpQueue';
import { NextUpRow } from './NextUpRow';
import { NextUpEmptyState } from './NextUpEmptyState';
import styles from './NextUpQueue.module.css';

function NextUpSkeleton() {
  return (
    <ul className={styles.rowList} aria-label="Loading next actions">
      {[0, 1, 2].map((i) => (
        <li key={i} className={styles.skeletonRow}>
          <div className={styles.skeletonLeft}>
            <div className={styles.skeletonLine} />
            <div className={styles.skeletonLine} />
          </div>
          <div className={styles.skeletonCta} />
        </li>
      ))}
    </ul>
  );
}

export default function NextUpQueue() {
  const [items, setItems] = useState<NextUpItem[] | null>(null);
  const [ariaLiveMsg, setAriaLiveMsg] = useState('');

  useEffect(() => {
    const start = Date.now();
    const data = getNextUpItems();
    const elapsed = Date.now() - start;
    const remaining = Math.max(0, 160 - elapsed);
    const timer = setTimeout(() => setItems(data), remaining);
    return () => clearTimeout(timer);
  }, []);

  const handleDone = (item: NextUpItem) => {
    setItems((prev) => prev!.filter((i) => i.id !== item.id));
    setAriaLiveMsg('Item marked done');
  };

  const handleDismiss = (item: NextUpItem) => {
    setItems((prev) => prev!.filter((i) => i.id !== item.id));
    setAriaLiveMsg('Dismissed until tomorrow');
  };

  return (
    <section className={styles.nextUpCard} aria-labelledby="next-up-heading">
      <h3 id="next-up-heading" className={styles.cardTitle}>Next Up</h3>
      <div aria-live="polite" aria-atomic="true" className={styles.srOnly}>{ariaLiveMsg}</div>
      {items === null ? (
        <NextUpSkeleton />
      ) : items.length === 0 ? (
        <NextUpEmptyState />
      ) : (
        <ul className={styles.rowList} aria-label="Next actions">
          {items.map((item) => (
            <NextUpRow key={item.id} item={item} onDone={handleDone} onDismiss={handleDismiss} />
          ))}
        </ul>
      )}
    </section>
  );
}
