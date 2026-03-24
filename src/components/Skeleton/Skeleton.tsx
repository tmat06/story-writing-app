import styles from './Skeleton.module.css';

interface SkeletonProps {
  width?: string;
  height?: string;
  borderRadius?: string;
  className?: string;
}

export function Skeleton({
  width = '100%',
  height = '16px',
  borderRadius,
  className,
}: SkeletonProps) {
  return (
    <div
      className={`${styles.skeleton}${className ? ` ${className}` : ''}`}
      style={{ width, height, ...(borderRadius ? { borderRadius } : {}) }}
      aria-hidden="true"
    />
  );
}
