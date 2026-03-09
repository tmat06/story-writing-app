import styles from './page.module.css';

export default function SettingsPage() {
  return (
    <div className={styles.page}>
      <section className={styles.settingsGroup} aria-labelledby="account-heading">
        <h2 id="account-heading" className={styles.groupTitle}>
          Account
        </h2>
        <div className={styles.groupContent}>
          <p className={styles.placeholder}>Account settings will appear here</p>
        </div>
      </section>

      <section className={styles.settingsGroup} aria-labelledby="preferences-heading">
        <h2 id="preferences-heading" className={styles.groupTitle}>
          Preferences
        </h2>
        <div className={styles.groupContent}>
          <p className={styles.placeholder}>Writing preferences will appear here</p>
        </div>
      </section>

      <section className={styles.settingsGroup} aria-labelledby="appearance-heading">
        <h2 id="appearance-heading" className={styles.groupTitle}>
          Appearance
        </h2>
        <div className={styles.groupContent}>
          <p className={styles.placeholder}>Appearance settings will appear here</p>
        </div>
      </section>
    </div>
  );
}
