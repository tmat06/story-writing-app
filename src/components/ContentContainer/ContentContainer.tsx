import { ReactNode } from 'react';
import styles from './ContentContainer.module.css';

interface ContentContainerProps {
  children: ReactNode;
}

export default function ContentContainer({ children }: ContentContainerProps) {
  return (
    <main className={styles.main}>
      {children}
    </main>
  );
}
