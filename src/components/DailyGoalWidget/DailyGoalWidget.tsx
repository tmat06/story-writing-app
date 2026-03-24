'use client';

import { useState } from 'react';
import { useDailyGoal } from '@/hooks/useDailyGoal';
import type { DailyGoalConfig, GoalType } from '@/types/dailyGoal';
import styles from './DailyGoalWidget.module.css';

const WEEKDAY_INITIALS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function getWeekdayInitial(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return WEEKDAY_INITIALS[d.getDay()];
}

function getWeekdayName(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long' });
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
}

export default function DailyGoalWidget() {
  const { config, todayRecord, streaks, last14Days, setConfig, disableGoal } = useDailyGoal();
  const [editorOpen, setEditorOpen] = useState(false);
  const [goalType, setGoalType] = useState<GoalType>('words');
  const [goalAmount, setGoalAmount] = useState(500);
  const [weeklyTargetDays, setWeeklyTargetDays] = useState(5);

  const openEditor = () => {
    if (config) {
      setGoalType(config.type);
      setGoalAmount(config.amount);
      setWeeklyTargetDays(config.weeklyTargetDays);
    } else {
      setGoalType('words');
      setGoalAmount(500);
      setWeeklyTargetDays(5);
    }
    setEditorOpen(true);
  };

  const handleSave = () => {
    const newConfig: DailyGoalConfig = {
      type: goalType,
      amount: goalAmount,
      weeklyTargetDays,
      enabled: true,
      createdAt: config?.createdAt ?? Date.now(),
    };
    setConfig(newConfig);
    setEditorOpen(false);
  };

  const isActive = config && config.enabled;
  const current = isActive
    ? config.type === 'words'
      ? todayRecord?.wordsWritten ?? 0
      : todayRecord?.minutesWritten ?? 0
    : 0;
  const target = isActive ? config.amount : 0;
  const progressPct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
  const goalMet = todayRecord?.goalMet ?? false;
  const unit = isActive ? (config.type === 'words' ? 'words' : 'min') : 'words';

  const remaining = isActive ? Math.max(0, target - current) : 0;
  const helperText = goalMet
    ? 'Goal reached today'
    : remaining > 0
    ? `Need ${remaining} more ${config?.type === 'minutes' ? 'minutes' : 'words'} today`
    : '';

  return (
    <section className={styles.card} aria-labelledby="daily-goal-heading">
      <div className={styles.header}>
        <h3 id="daily-goal-heading" className={styles.title}>Daily goal</h3>
        {isActive && !editorOpen && (
          <button type="button" className={styles.editBtn} onClick={openEditor} aria-label="Edit daily goal">
            Edit
          </button>
        )}
      </div>

      {!isActive && !editorOpen && (
        <div className={styles.emptyState}>
          <p className={styles.emptyText}>Set a daily writing goal</p>
          <button type="button" className={styles.primaryBtn} onClick={openEditor}>
            Set daily goal
          </button>
        </div>
      )}

      {isActive && !editorOpen && (
        <>
          <div className={styles.metric}>
            <span className={styles.metricValue}>{current.toLocaleString()}</span>
            <span className={styles.metricDivider}>/</span>
            <span className={styles.metricTarget}>{target.toLocaleString()} {unit}</span>
          </div>

          <div
            className={styles.progressRail}
            role="progressbar"
            aria-valuenow={progressPct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Today's writing progress"
          >
            <div
              className={`${styles.progressFill} ${goalMet ? styles.progressFillSuccess : ''}`}
              style={{ width: `${progressPct}%` }}
            />
          </div>

          {helperText && (
            <p className={`${styles.helperText} ${goalMet ? styles.helperSuccess : ''}`}>
              {helperText}
            </p>
          )}

          <div className={styles.chips}>
            <span className={`${styles.chip} ${goalMet ? styles.chipSuccess : ''}`}>
              Current streak: {streaks.current}
            </span>
            <span className={`${styles.chip} ${goalMet ? styles.chipSuccess : ''}`}>
              Best: {streaks.longest}
            </span>
          </div>

          <div className={styles.heatmap} aria-label="14-day writing activity">
            {last14Days.map(({ date, record }) => {
              const met = record?.goalMet;
              const hasData = record !== null;
              let cellState: 'met' | 'missed' | 'empty';
              if (!hasData) cellState = 'empty';
              else if (met) cellState = 'met';
              else cellState = 'missed';

              const weekday = getWeekdayName(date);
              const formattedDate = formatDate(date);
              const statusLabel = !hasData ? 'no data' : met ? 'goal met' : 'goal missed';

              return (
                <div
                  key={date}
                  className={`${styles.heatCell} ${styles[`heatCell_${cellState}`]}`}
                  aria-label={`${weekday}, ${formattedDate}: ${statusLabel}`}
                  title={`${formattedDate}: ${statusLabel}`}
                >
                  <span className={styles.heatCellLabel}>{getWeekdayInitial(date)}</span>
                </div>
              );
            })}
          </div>
        </>
      )}

      {editorOpen && (
        <div className={styles.editor}>
          <div className={styles.editorRow}>
            <span className={styles.editorLabel}>Goal type</span>
            <div className={styles.segmentedControl} role="radiogroup" aria-label="Goal type">
              <label className={goalType === 'words' ? styles.segmentActive : styles.segment}>
                <input
                  type="radio"
                  name="widget-goal-type"
                  value="words"
                  checked={goalType === 'words'}
                  onChange={() => setGoalType('words')}
                />
                Words/day
              </label>
              <label className={goalType === 'minutes' ? styles.segmentActive : styles.segment}>
                <input
                  type="radio"
                  name="widget-goal-type"
                  value="minutes"
                  checked={goalType === 'minutes'}
                  onChange={() => setGoalType('minutes')}
                />
                Minutes/day
              </label>
            </div>
          </div>

          <div className={styles.editorRow}>
            <label htmlFor="widget-goal-amount" className={styles.editorLabel}>
              Daily target
            </label>
            <input
              id="widget-goal-amount"
              type="number"
              min="1"
              max="10000"
              className={styles.numberInput}
              value={goalAmount}
              onChange={(e) => setGoalAmount(Number(e.target.value))}
            />
          </div>

          <div className={styles.editorRow}>
            <label htmlFor="widget-weekly-days" className={styles.editorLabel}>
              Days per week
            </label>
            <input
              id="widget-weekly-days"
              type="number"
              min="1"
              max="7"
              className={styles.numberInput}
              value={weeklyTargetDays}
              onChange={(e) => setWeeklyTargetDays(Number(e.target.value))}
            />
          </div>

          <div className={styles.editorActions}>
            <button type="button" className={styles.primaryBtn} onClick={handleSave}>
              Save
            </button>
            <button type="button" className={styles.cancelBtn} onClick={() => setEditorOpen(false)}>
              Cancel
            </button>
            {isActive && (
              <button
                type="button"
                className={styles.disableBtn}
                onClick={() => { disableGoal(); setEditorOpen(false); }}
              >
                Disable goal
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
