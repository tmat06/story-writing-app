import Link from 'next/link';
import styles from './Navigation.module.css';

interface NavigationProps {
  currentPath: string;
  isOpen?: boolean;
  onLinkClick?: () => void;
}

export default function Navigation({ currentPath, isOpen, onLinkClick }: NavigationProps) {
  const navItems = [
    { href: '/', label: 'Home' },
    { href: '/stories', label: 'Stories' },
    { href: '/settings', label: 'Settings' },
  ];

  return (
    <nav className={`${styles.nav} ${isOpen ? styles.open : ''}`} aria-label="Main navigation">
      <div className={styles.identity}>
        <Link href="/" className={styles.logo}>
          Story Writing App
        </Link>
      </div>

      <ul className={styles.navList} role="list">
        {navItems.map((item) => {
          const isActive = currentPath === item.href;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`${styles.navLink} ${isActive ? styles.active : ''}`}
                aria-current={isActive ? 'page' : undefined}
                onClick={onLinkClick}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>

      <div className={styles.utility}>
        {/* Reserved for future actions */}
      </div>
    </nav>
  );
}
