import styles from './page.module.css';

interface StoryPageProps {
  params: Promise<{ id: string }>;
}

export default async function StoryPage({ params }: StoryPageProps) {
  const { id } = await params;

  return (
    <div className={styles.page}>
      <div className={styles.editorLayout}>
        <div className={styles.editorMain}>
          <div className={styles.editorHeader}>
            <input
              type="text"
              className={styles.titleInput}
              placeholder="Untitled Story"
              aria-label="Story title"
              defaultValue={`Story ${id}`}
            />
          </div>
          <div className={styles.editorCanvas}>
            <label htmlFor="story-editor" className={styles.visuallyHidden}>
              Story content editor
            </label>
            <textarea
              id="story-editor"
              className={styles.editor}
              placeholder="Start writing your story..."
              aria-label="Story content editor"
            />
          </div>
        </div>
        <aside className={styles.sidebar}>
          <div className={styles.sidebarSection}>
            <h3 className={styles.sidebarTitle}>Notes</h3>
            <div className={styles.sidebarPlaceholder}>
              <p className={styles.placeholderText}>
                Notes and outline will appear here
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
