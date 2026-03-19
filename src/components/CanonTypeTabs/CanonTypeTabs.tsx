'use client';

import { CanonEntityType } from '@/types/series';
import styles from './CanonTypeTabs.module.css';

const TABS: { type: CanonEntityType; label: string }[] = [
  { type: 'character', label: 'Characters' },
  { type: 'location', label: 'Locations' },
  { type: 'lore', label: 'Lore' },
];

interface CanonTypeTabsProps {
  activeType: CanonEntityType;
  onChange: (type: CanonEntityType) => void;
  counts: Record<CanonEntityType, number>;
}

export default function CanonTypeTabs({ activeType, onChange, counts }: CanonTypeTabsProps) {
  return (
    <div className={styles.tablist} role="tablist" aria-label="Canon entity types">
      {TABS.map(tab => (
        <button
          key={tab.type}
          role="tab"
          aria-selected={activeType === tab.type}
          className={`${styles.tab} ${activeType === tab.type ? styles.active : ''}`}
          onClick={() => onChange(tab.type)}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onChange(tab.type);
            }
          }}
        >
          {tab.label}
          {counts[tab.type] > 0 && (
            <span className={styles.badge}>{counts[tab.type]}</span>
          )}
        </button>
      ))}
    </div>
  );
}
