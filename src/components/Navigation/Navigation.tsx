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

  const baseNavItems = [
    { href: '/', label: 'Home' },
    { href: '/stories', label: 'Stories' },
  ];

  const seriesItem = { href: '/series', label: 'Series' };

  const navItems = hasSeries
    ? [...baseNavItems, seriesItem, { href: '/settings', label: 'Settings' }]
    : [...baseNavItems, { href: '/settings', label: 'Settings' }];

  return (
    <nav className={`${styles.nav} ${isOpen ? styles.open : ''}`} aria-label="Main navigation">
      <div className={styles.identity}>
        <Link href="/" className={styles.logo}>
          Story Writing App
        </Link>
      </div>

      <ul className={styles.navList} role="list">
        {navItems.map((item) => {
          const isActive = item.href === '/series'
            ? currentPath.startsWith('/series')
            : currentPath === item.href;
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
