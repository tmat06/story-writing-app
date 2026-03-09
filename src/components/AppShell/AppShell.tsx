'use client';

import { ReactNode, useState } from 'react';
import { usePathname } from 'next/navigation';
import Navigation from '@/components/Navigation/Navigation';
import Header from '@/components/Header/Header';
import ContentContainer from '@/components/ContentContainer/ContentContainer';
import styles from './AppShell.module.css';

interface AppShellProps {
  children: ReactNode;
}

function getPageTitle(pathname: string): string {
  if (pathname === '/') return 'Home';
  if (pathname === '/stories') return 'Stories';
  if (pathname.startsWith('/story/')) return 'Story Editor';
  if (pathname === '/settings') return 'Settings';
  return 'Story Writing App';
}

export default function AppShell({ children }: AppShellProps) {
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const pathname = usePathname();
  const pageTitle = getPageTitle(pathname);

  const handleMenuToggle = () => {
    setIsMobileNavOpen(!isMobileNavOpen);
  };

  const handleNavLinkClick = () => {
    // Close mobile nav when a link is clicked
    setIsMobileNavOpen(false);
  };

  return (
    <div className={styles.shell}>
      {/* Skip to main content link for accessibility */}
      <a href="#main-content" className={styles.skipLink}>
        Skip to main content
      </a>

      <div className={`${styles.navWrapper} ${isMobileNavOpen ? styles.navOpen : ''}`}>
        <Navigation
          currentPath={pathname}
          isOpen={isMobileNavOpen}
          onLinkClick={handleNavLinkClick}
        />
        {/* Overlay for mobile nav */}
        {isMobileNavOpen && (
          <div
            className={styles.overlay}
            onClick={handleNavLinkClick}
            aria-hidden="true"
          />
        )}
      </div>

      <div className={styles.mainWrapper}>
        <Header title={pageTitle} onMenuToggle={handleMenuToggle} />
        <div id="main-content">
          <ContentContainer>{children}</ContentContainer>
        </div>
      </div>
    </div>
  );
}
