'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './ShortcutHelp.module.css';

interface ShortcutHelpProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ShortcutEntry {
  group: string;
  label: string;
  keys: string[];
  note?: string;
}

const SHORTCUTS: ShortcutEntry[] = [
  { group: 'Global', label: 'Open command palette', keys: ['Cmd', 'K'] },
  { group: 'Global', label: 'Keyboard shortcuts', keys: ['?'] },
  { group: 'Global', label: 'Close / dismiss', keys: ['Esc'] },
  { group: 'Story — Views', label: 'Switch view (via palette)', keys: ['Cmd', 'K'] },
  { group: 'Story — Actions', label: 'Enter focus mode (via palette)', keys: ['Cmd', 'K'] },
  { group: 'Story — Actions', label: 'Add scene (via palette)', keys: ['Cmd', 'K'] },
  { group: 'Story — Panels', label: 'Open / close panels (via palette)', keys: ['Cmd', 'K'] },
];

export default function ShortcutHelp({ isOpen, onClose }: ShortcutHelpProps) {
  const [filter, setFilter] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      setFilter('');
      requestAnimationFrame(() => inputRef.current?.focus());
    } else {
      previousFocusRef.current?.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        onClose();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filtered = filter.trim()
    ? SHORTCUTS.filter(s =>
        s.label.toLowerCase().includes(filter.toLowerCase()) ||
        s.group.toLowerCase().includes(filter.toLowerCase())
      )
    : SHORTCUTS;

  const groups = Array.from(new Set(filtered.map(s => s.group)));

  return (
    <div className={styles.overlay} onClick={onClose} role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcut-help-title"
        className={styles.dialog}
        onClick={e => e.stopPropagation()}
      >
        <div className={styles.header}>
          <h2 id="shortcut-help-title" className={styles.title}>Keyboard Shortcuts</h2>
          <button className={styles.closeButton} onClick={onClose} aria-label="Close shortcuts">×</button>
        </div>

        <div className={styles.filterRow}>
          <input
            ref={inputRef}
            type="text"
            placeholder="Filter shortcuts…"
            className={styles.filterInput}
            value={filter}
            onChange={e => setFilter(e.target.value)}
          />
        </div>

        <div className={styles.body}>
          {groups.length === 0 && (
            <p className={styles.emptyState}>No shortcuts found</p>
          )}
          {groups.map(group => (
            <section key={group} className={styles.section}>
              <h3 className={styles.groupTitle}>{group}</h3>
              <dl className={styles.list}>
                {filtered.filter(s => s.group === group).map((s, i) => (
                  <div key={i} className={styles.row}>
                    <dt className={styles.label}>{s.label}</dt>
                    <dd className={styles.keys}>
                      {s.keys.map((k, ki) => (
                        <span key={ki}>
                          <kbd className={styles.kbd}>{k}</kbd>
                          {ki < s.keys.length - 1 && <span className={styles.plus}>+</span>}
                        </span>
                      ))}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
