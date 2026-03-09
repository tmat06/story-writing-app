import styles from './page.module.css';

export default function StoriesPage() {
  return (
    <div className={styles.page}>
      <div className={styles.toolbar}>
        <div className={styles.searchWrapper}>
          <label htmlFor="story-search" className={styles.visuallyHidden}>
            Search stories
          </label>
          <input
            type="text"
            id="story-search"
            className={styles.searchInput}
            placeholder="Search stories..."
            aria-label="Search stories"
          />
        </div>
        <div className={styles.filters}>
          <span className={styles.filterLabel}>Filter & Sort</span>
        </div>
      </div>

      <div className={styles.storiesList}>
        <div className={styles.emptyState}>
          <p className={styles.emptyTitle}>No stories yet</p>
          <p className={styles.emptyText}>
            Create your first story to get started
          </p>
        </div>
      </div>
    </div>
  );
}
