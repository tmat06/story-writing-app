'use client';

import { useEffect, useRef, useState } from 'react';
import { useCommands, filterCommands, type Command } from '@/hooks/useCommands';
import styles from './CommandPalette.module.css';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenHelp: () => void;
}

const GROUP_ORDER: Command['group'][] = ['Navigation', 'Story', 'View', 'Panels', 'Actions', 'Help'];

export default function CommandPalette({ isOpen, onClose, onOpenHelp }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const commands = useCommands(onClose, onOpenHelp);
  const filtered = filterCommands(commands, query);

  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      inputRef.current?.focus();
      setQuery('');
      setHighlightedIndex(0);
    } else {
      previousFocusRef.current?.focus();
    }
  }, [isOpen]);

  // Reset highlight when filtered list changes
  useEffect(() => {
    setHighlightedIndex(0);
  }, [query]);

  if (!isOpen) return null;

  // Build grouped display list with flat indexes for keyboard nav
  const groupedItems: Array<{ type: 'header'; group: Command['group'] } | { type: 'command'; command: Command; index: number }> = [];
  let flatIndex = 0;
  const seenGroups = new Set<string>();

  for (const group of GROUP_ORDER) {
    const groupCmds = filtered.filter(c => c.group === group);
    if (groupCmds.length === 0) continue;
    if (!seenGroups.has(group)) {
      groupedItems.push({ type: 'header', group });
      seenGroups.add(group);
    }
    for (const cmd of groupCmds) {
      groupedItems.push({ type: 'command', command: cmd, index: flatIndex });
      flatIndex++;
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(i => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      filtered[highlightedIndex]?.action();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  }

  return (
    <div
      className={styles.scrim}
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className={styles.dialog}
        onClick={e => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className={styles.searchRow}>
          <input
            ref={inputRef}
            type="text"
            placeholder="Search commands…"
            className={styles.searchInput}
            value={query}
            onChange={e => setQuery(e.target.value)}
            aria-autocomplete="list"
            aria-controls="palette-listbox"
            aria-activedescendant={filtered[highlightedIndex] ? `cmd-${filtered[highlightedIndex].id}` : undefined}
          />
        </div>

        <ul id="palette-listbox" role="listbox" className={styles.list}>
          {groupedItems.length === 0 && (
            <li className={styles.emptyState}>No commands found</li>
          )}
          {groupedItems.map((item, i) => {
            if (item.type === 'header') {
              return (
                <li key={`group-${item.group}-${i}`} role="presentation" className={styles.groupHeader}>
                  {item.group}
                </li>
              );
            }
            const { command: cmd, index } = item;
            return (
              <li
                key={cmd.id}
                id={`cmd-${cmd.id}`}
                role="option"
                aria-selected={index === highlightedIndex}
                className={`${styles.row} ${index === highlightedIndex ? styles.rowHighlighted : ''}`}
                onClick={() => cmd.action()}
                onMouseEnter={() => setHighlightedIndex(index)}
              >
                <span className={styles.rowLabel}>{cmd.label}</span>
                {cmd.shortcut && <kbd className={styles.kbd}>{cmd.shortcut}</kbd>}
              </li>
            );
          })}
        </ul>

        <div className={styles.footer} aria-hidden="true">
          ↑↓ navigate · Enter run · Esc close · ? shortcuts
        </div>
      </div>
    </div>
  );
}
