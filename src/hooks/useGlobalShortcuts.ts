'use client';

import { useEffect } from 'react';

function isEditableTarget(el: EventTarget | null): boolean {
  if (!el || !(el instanceof HTMLElement)) return false;
  const tag = el.tagName.toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
  if (el.isContentEditable) return true;
  return false;
}

export interface ShortcutCallbacks {
  onOpenPalette: () => void;
  onOpenHelp: () => void;
  isPaletteOpen: boolean;
  isHelpOpen: boolean;
  onClose: () => void;
}

export function useGlobalShortcuts(cb: ShortcutCallbacks): void {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Always allow Escape to close
      if (e.key === 'Escape') {
        if (cb.isPaletteOpen || cb.isHelpOpen) {
          e.preventDefault();
          cb.onClose();
        }
        return;
      }

      // Guard editable fields for all other shortcuts
      if (isEditableTarget(document.activeElement)) return;

      // Cmd/Ctrl + K → open palette
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        cb.isPaletteOpen ? cb.onClose() : cb.onOpenPalette();
        return;
      }

      // ? → open help sheet (not in editable — already guarded above)
      if (e.key === '?' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        cb.onOpenHelp();
        return;
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cb.isPaletteOpen, cb.isHelpOpen, cb.onOpenPalette, cb.onOpenHelp, cb.onClose]);
}
