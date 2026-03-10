import styles from './MetadataFilters.module.css';

interface MetadataFiltersProps {
  povOptions: string[];
  locationOptions: string[];
  timeframeOptions: string[];
  activePov: string | null;
  activeLocation: string | null;
  activeTimeframe: string | null;
  onFilterChange: (field: 'pov' | 'location' | 'timeframe', value: string | null) => void;
  onClearAll: () => void;
}

export function MetadataFilters({
  povOptions,
  locationOptions,
  timeframeOptions,
  activePov,
  activeLocation,
  activeTimeframe,
  onFilterChange,
  onClearAll,
}: MetadataFiltersProps) {
  const hasActiveFilters = activePov !== null || activeLocation !== null || activeTimeframe !== null;
  const hasAnyOptions = povOptions.length > 0 || locationOptions.length > 0 || timeframeOptions.length > 0;

  if (!hasAnyOptions) return null;

  return (
    <div className={styles.filters} role="group" aria-label="Filter scenes by metadata">
      {povOptions.length > 0 && (
        <div className={styles.filterField}>
          <label htmlFor="filter-pov" className={styles.label}>POV</label>
          <select
            id="filter-pov"
            className={`${styles.select} ${activePov ? styles.active : ''}`}
            value={activePov ?? ''}
            onChange={(e) => onFilterChange('pov', e.target.value || null)}
            aria-label="Filter by POV character"
          >
            <option value="">All</option>
            {povOptions.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>
      )}

      {locationOptions.length > 0 && (
        <div className={styles.filterField}>
          <label htmlFor="filter-location" className={styles.label}>Location</label>
          <select
            id="filter-location"
            className={`${styles.select} ${activeLocation ? styles.active : ''}`}
            value={activeLocation ?? ''}
            onChange={(e) => onFilterChange('location', e.target.value || null)}
            aria-label="Filter by location"
          >
            <option value="">All</option>
            {locationOptions.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>
      )}

      {timeframeOptions.length > 0 && (
        <div className={styles.filterField}>
          <label htmlFor="filter-timeframe" className={styles.label}>Timeframe</label>
          <select
            id="filter-timeframe"
            className={`${styles.select} ${activeTimeframe ? styles.active : ''}`}
            value={activeTimeframe ?? ''}
            onChange={(e) => onFilterChange('timeframe', e.target.value || null)}
            aria-label="Filter by timeframe"
          >
            <option value="">All</option>
            {timeframeOptions.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>
      )}

      {hasActiveFilters && (
        <button
          className={styles.clearButton}
          onClick={onClearAll}
          type="button"
          aria-label="Clear all filters"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
