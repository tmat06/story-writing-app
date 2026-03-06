import styles from "./page.module.css";

export default function Home() {
  return (
    <main className={styles.page}>
      <section className={styles.shell}>
        <header className={styles.header}>
          <h1 className={styles.title}>Story Writing App</h1>
          <p className={styles.tagline}>
            A calm drafting space for your next chapter.
          </p>
        </header>

        <label htmlFor="story-draft" className={styles.label}>
          Draft
        </label>
        <textarea
          id="story-draft"
          className={styles.editor}
          placeholder="Start writing your scene here..."
          aria-label="Story draft editor"
        />
      </section>
    </main>
  );
}
