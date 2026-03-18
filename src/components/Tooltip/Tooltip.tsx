'use client';

import { useState, useEffect, useRef, useId, cloneElement, isValidElement } from 'react';
import styles from './Tooltip.module.css';

interface TooltipProps {
  content: string;
  children: React.ReactElement;
  delay?: number;
}

export function Tooltip({ content, children, delay = 400 }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tooltipId = useId();

  const show = () => {
    timerRef.current = setTimeout(() => setVisible(true), delay);
  };

  const hide = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setVisible(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') hide();
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  if (!isValidElement(children)) return children;

  const clonedChild = cloneElement(children as React.ReactElement<React.HTMLAttributes<HTMLElement>>, {
    'aria-describedby': tooltipId,
    onMouseEnter: show,
    onMouseLeave: hide,
    onFocus: show,
    onBlur: hide,
    onKeyDown: handleKeyDown,
  });

  return (
    <span className={styles.wrapper}>
      {clonedChild}
      {visible && (
        <span role="tooltip" id={tooltipId} className={styles.tooltip}>
          {content}
        </span>
      )}
    </span>
  );
}
