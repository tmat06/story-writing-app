'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getSeries } from '@/lib/series';
import styles from './Navigation.module.css';

interface NavigationProps {
  currentPath: string;
  isOpen?: boolean;
  onLinkClick?: () => void;
}

export default function Navigation({ currentPath, isOpen, onLinkClick }: NavigationProps) {
  const [hasSeries, setHasSeries] = useState(false);

  useEffect(() => {
    setHasSeries(getSeries().length > 0);
  }, []);

  type NavItem = { href: string; label: string; secondary?: boolean };

  const navItems: NavItem[] = hasSeries
    ? [
        { href: '/', label: 'Home' },
        { href: '/stories', label: 'Stories' },
        { href: '/series', label: 'Series' },
        { href: '/settings', label: 'Settings', secondary: true },
      ]
    : [
        { href: '/', label: 'Home' },
        { href: '/stories', label: 'Stories' },
        { href: '/settings', label: 'Settings', secondary: true },
      ];

  return (
    <nav className={`${styles.nav} ${isOpen ? styles.open : ''}`} aria-label="Main navigation">
      <div className={styles.identity}>
        <Link href="/" className={styles.logo}>
          Story Writing App
        </Link>
      </div>

      <ul className={styles.navList} role="list">
        {navItems.map((item, index) => {
          const isActive = item.href === '/series'
            ? currentPath.startsWith('/series')
            : currentPath === item.href;
          const showSeparator = item.secondary && (index === 0 || !navItems[index - 1].secondary);
          return (
            <li key={item.href}>
              {showSeparator && <div className={styles.navSeparator} aria-hidden="true" />}
              <Link
                href={item.href}
                className={`${styles.navLink} ${item.secondary ? styles.navLinkSecondary : ''} ${isActive ? styles.active : ''}`}
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
