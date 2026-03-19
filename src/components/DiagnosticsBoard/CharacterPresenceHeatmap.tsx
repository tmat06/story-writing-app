import React, { useMemo, useRef } from 'react';
import { Tooltip } from '@/components/Tooltip/Tooltip';
import type { CharacterPresenceMatrix } from '@/types/diagnostics';
import styles from './CharacterPresenceHeatmap.module.css';

interface CharacterPresenceHeatmapProps {
  matrix: CharacterPresenceMatrix;
  filter: 'all' | 'major';
  onCellClick: (character: string, chapter: string) => void;
}

function getCellOpacity(count: number): number {
  if (count === 0) return 0;
  if (count === 1) return 0.2;
  if (count === 2) return 0.5;
  return 1.0;
}

interface RowProps {
  character: string;
  chapters: string[];
  counts: number[];
  onCellClick: (character: string, chapter: string) => void;
  rowRef?: React.RefObject<HTMLDivElement | null>;
}

const CharacterRow = React.memo(function CharacterRow({ character, chapters, counts, onCellClick }: RowProps) {
  return (
    <div role="row" className={styles.row}>
      <div role="rowheader" className={styles.charName}>{character}</div>
      {chapters.map((chapter, chapIdx) => {
        const count = counts[chapIdx];
        const opacity = getCellOpacity(count);
        return (
          <Tooltip key={chapter} content={`${chapter} | ${character}: ${count} scene${count !== 1 ? 's' : ''}`}>
            <div
              role="gridcell"
              tabIndex={0}
              aria-label={`${character} in ${chapter}: ${count} scene${count !== 1 ? 's' : ''}`}
              className={styles.cell}
              style={{ backgroundColor: `rgba(244, 232, 201, ${opacity})` }}
              onClick={() => onCellClick(character, chapter)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onCellClick(character, chapter);
                }
              }}
            />
          </Tooltip>
        );
      })}
    </div>
  );
});

export function CharacterPresenceHeatmap({ matrix, filter, onCellClick }: CharacterPresenceHeatmapProps) {
  const gridRef = useRef<HTMLDivElement>(null);

  const filteredRows = useMemo(() => {
    if (filter === 'major') {
      return matrix.characters
        .map((char, charIdx) => ({ char, charIdx }))
        .filter(({ charIdx }) => {
          const total = matrix.matrix[charIdx].reduce((s, n) => s + n, 0);
          return total >= 3;
        });
    }
    return matrix.characters.map((char, charIdx) => ({ char, charIdx }));
  }, [matrix, filter]);

  if (matrix.characters.length === 0) {
    return (
      <div className={styles.card}>
        <h3 className={styles.heading}>Character Presence</h3>
        <p className={styles.empty}>No character data. Tag characters on scenes to see the heatmap.</p>
      </div>
    );
  }

  return (
    <div className={styles.card}>
      <h3 className={styles.heading}>Character Presence</h3>
      <div className={styles.scrollWrapper}>
        <div
          ref={gridRef}
          role="grid"
          aria-label="Character presence by chapter heatmap"
          className={styles.grid}
        >
          <caption className={styles.srOnly}>Character presence by chapter heatmap</caption>
          {/* Header row */}
          <div role="row" className={styles.headerRow}>
            <div role="columnheader" className={styles.charName} />
            {matrix.chapters.map((ch) => (
              <div key={ch} role="columnheader" className={styles.chapterHeader}>
                {ch}
              </div>
            ))}
          </div>
          {/* Data rows */}
          {filteredRows.map(({ char, charIdx }) => (
            <CharacterRow
              key={char}
              character={char}
              chapters={matrix.chapters}
              counts={matrix.matrix[charIdx]}
              onCellClick={onCellClick}
            />
          ))}
          {filteredRows.length === 0 && (
            <p className={styles.empty}>No major characters (3+ scenes). Switch to &ldquo;All&rdquo; filter.</p>
          )}
        </div>
      </div>
    </div>
  );
}
