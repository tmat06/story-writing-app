'use client';

import { ReactNode, useState, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import Navigation from '@/components/Navigation/Navigation';
import Header from '@/components/Header/Header';
import ContentContainer from '@/components/ContentContainer/ContentContainer';
import { useGlobalShortcuts } from '@/hooks/useGlobalShortcuts';
import CommandPalette from '@/components/CommandPalette/CommandPalette';
import ShortcutHelp from '@/components/ShortcutHelp/ShortcutHelp';
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
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const pathname = usePathname();
  const pageTitle = getPageTitle(pathname);

  const handleCloseOverlay = useCallback(() => {
    setIsPaletteOpen(false);
    setIsHelpOpen(false);
  }, []);

  useGlobalShortcuts({
    onOpenPalette: () => setIsPaletteOpen(true),
    onOpenHelp: () => setIsHelpOpen(true),
    isPaletteOpen,
    isHelpOpen,
    onClose: handleCloseOverlay,
  });

  const handleMenuToggle = () => {
    setIsMobileNavOpen(!isMobileNavOpen);
  };

  const handleNavLinkClick = () => {
    // Close mobile nav when a link is clicked
    setIsMobileNavOpen(false);
  };

  const isEditorRoute = pathname.startsWith('/story/');

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
        {!isEditorRoute && <Header title={pageTitle} onMenuToggle={handleMenuToggle} />}
        {isEditorRoute ? (
          <main id="main-content" className={styles.editorMainWrapper}>
            {children}
          </main>
        ) : (
          <div id="main-content">
            <ContentContainer>{children}</ContentContainer>
          </div>
        )}
      </div>

      <CommandPalette
        isOpen={isPaletteOpen}
        onClose={handleCloseOverlay}
        onOpenHelp={() => { setIsPaletteOpen(false); setIsHelpOpen(true); }}
      />
      <ShortcutHelp
        isOpen={isHelpOpen}
        onClose={handleCloseOverlay}
      />
    </div>
  );
}
