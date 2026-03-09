import styles from './Header.module.css';

interface HeaderProps {
  title: string;
  onMenuToggle?: () => void;
}

export default function Header({ title, onMenuToggle }: HeaderProps) {
  return (
    <header className={styles.header}>
      {onMenuToggle && (
        <button
          className={styles.menuButton}
          onClick={onMenuToggle}
          aria-label="Toggle navigation menu"
          type="button"
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <line x1="3" y1="12" x2="21" y2="12"></line>
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <line x1="3" y1="18" x2="21" y2="18"></line>
          </svg>
        </button>
      )}
      <h1 className={styles.title}>{title}</h1>
      <div className={styles.actions}>
        {/* Reserved for future actions */}
      </div>
    </header>
  );
}
