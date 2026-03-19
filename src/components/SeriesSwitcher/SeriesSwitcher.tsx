'use client';

import { Series } from '@/types/series';
import styles from './SeriesSwitcher.module.css';

interface SeriesSwitcherProps {
  series: Series[];
  currentSeriesId: string;
  onSelect: (id: string) => void;
  onCreateSeries: () => void;
}

export default function SeriesSwitcher({
  series,
  currentSeriesId,
  onSelect,
  onCreateSeries,
}: SeriesSwitcherProps) {
  return (
    <div className={styles.wrapper}>
      <label className={styles.label} htmlFor="series-switcher">
        Series
      </label>
      <select
        id="series-switcher"
        className={styles.select}
        value={currentSeriesId}
        onChange={e => onSelect(e.target.value)}
      >
        {series.map(s => (
          <option key={s.id} value={s.id}>
            {s.title}
          </option>
        ))}
      </select>
      <button
        type="button"
        className={styles.newButton}
        onClick={onCreateSeries}
      >
        + New series
      </button>
    </div>
  );
}
