"use client";

import { useRef, useEffect, useCallback } from "react";
import styles from "./CommandOverflowMenu.module.css";

interface CommandOverflowMenuProps {
  items: { label: string; onClick: () => void }[];
  open: boolean;
  onToggle: () => void;
  className?: string;
}

export function CommandOverflowMenu({
  items,
  open,
  onToggle,
  className,
}: CommandOverflowMenuProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Outside-click dismiss
  useEffect(() => {
    if (!open) return;
    const handleMouseDown = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        onToggle();
      }
    };
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [open, onToggle]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!open) return;
      const focusableItems = itemRefs.current.filter(Boolean) as HTMLButtonElement[];
      const currentIndex = focusableItems.indexOf(
        document.activeElement as HTMLButtonElement
      );
      if (e.key === "ArrowDown") {
        e.preventDefault();
        const next = (currentIndex + 1) % focusableItems.length;
        focusableItems[next]?.focus();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const prev = (currentIndex - 1 + focusableItems.length) % focusableItems.length;
        focusableItems[prev]?.focus();
      } else if (e.key === "Escape") {
        onToggle();
        toggleRef.current?.focus();
      } else if (e.key === "Tab") {
        onToggle();
      }
    },
    [open, onToggle]
  );

  const handleItemClick = (onClick: () => void) => {
    onClick();
    onToggle();
  };

  const wrapperClass = [styles.wrapper, className].filter(Boolean).join(" ");

  return (
    <div ref={wrapperRef} className={wrapperClass} onKeyDown={handleKeyDown}>
      <button
        ref={toggleRef}
        type="button"
        className={styles.toggle}
        aria-label="More actions"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={onToggle}
      >
        ···
      </button>
      {open && (
        <div role="menu" className={styles.panel}>
          {items.map((item, index) => (
            <button
              key={item.label}
              ref={(el) => { itemRefs.current[index] = el; }}
              role="menuitem"
              className={styles.item}
              onClick={() => handleItemClick(item.onClick)}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
