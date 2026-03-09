import styles from "./page.module.css";

export default function Home() {
  return (
    <div className={styles.page}>
      <section className={styles.welcome}>
        <h2 className={styles.welcomeTitle}>Welcome back</h2>
        <p className={styles.welcomeText}>
          A calm drafting space for your next chapter.
        </p>
      </section>

      <div className={styles.dashboard}>
        <section className={styles.card} aria-labelledby="recent-stories-heading">
          <h3 id="recent-stories-heading" className={styles.cardTitle}>
            Recent Stories
          </h3>
          <div className={styles.emptyState}>
            <p className={styles.emptyText}>No stories yet</p>
            <p className={styles.emptyHint}>
              Create your first story from the Stories page
            </p>
          </div>
        </section>

        <section className={styles.card} aria-labelledby="quick-resume-heading">
          <h3 id="quick-resume-heading" className={styles.cardTitle}>
            Quick Resume
          </h3>
          <div className={styles.emptyState}>
            <p className={styles.emptyText}>Nothing in progress</p>
            <p className={styles.emptyHint}>
              Your recently edited stories will appear here
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
