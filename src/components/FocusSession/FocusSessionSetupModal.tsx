'use client';

import { useEffect, useRef, useState } from 'react';
import type { Scene } from '@/types/scene';
import type { ObjectiveType } from '@/types/session';
import { countWords } from '@/lib/sessions';
import styles from './FocusSessionSetupModal.module.css';

const OBJECTIVE_OPTIONS: { value: ObjectiveType; label: string }[] = [
  { value: 'draft-beat', label: 'Draft a beat' },
  { value: 'revise-pacing', label: 'Revise pacing' },
  { value: 'tighten-dialogue', label: 'Tighten dialogue' },
  { value: 'polish-description', label: 'Polish description' },
  { value: 'review-continuity', label: 'Review continuity' },
  { value: 'other', label: 'Other…' },
];

const TIMER_PRESETS = [
  { value: 0, label: 'Off' },
  { value: 15, label: '15 min' },
  { value: 25, label: '25 min' },
  { value: 45, label: '45 min' },
];

interface FocusSessionSetupModalProps {
  isOpen: boolean;
  scenes: Scene[];
  currentSceneId: string | null;
  currentContent: string;
  onStart: (config: {
    sceneId: string;
    sceneName: string;
    objectiveType: ObjectiveType;
    objectiveText: string;
    timerPresetMinutes: number;
    wordsAtStart: number;
  }) => void;
  onCancel: () => void;
}

export function FocusSessionSetupModal({
  isOpen,
  scenes,
  currentSceneId,
  currentContent,
  onStart,
  onCancel,
}: FocusSessionSetupModalProps) {
  const [sceneId, setSceneId] = useState(currentSceneId ?? '');
  const [objectiveType, setObjectiveType] = useState<ObjectiveType | ''>('');
  const [otherText, setOtherText] = useState('');
  const [timerPreset, setTimerPreset] = useState<number>(25);
  const [customMinutes, setCustomMinutes] = useState(30);
  const [isCustom, setIsCustom] = useState(false);
  const sceneSelectRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    if (isOpen) {
      setSceneId(currentSceneId ?? (scenes[0]?.id ?? ''));
      setObjectiveType('');
      setOtherText('');
      setTimerPreset(25);
      setIsCustom(false);
      setTimeout(() => sceneSelectRef.current?.focus(), 0);
    }
  }, [isOpen, currentSceneId, scenes]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onCancel();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const canStart = sceneId !== '' && objectiveType !== '' && (objectiveType !== 'other' || otherText.trim() !== '');

  const handleStart = () => {
    if (!canStart) return;
    const scene = scenes.find((s) => s.id === sceneId);
    const objectiveText =
      objectiveType === 'other'
        ? otherText.trim()
        : (OBJECTIVE_OPTIONS.find((o) => o.value === objectiveType)?.label ?? '');
    const minutes = isCustom ? customMinutes : timerPreset;
    onStart({
      sceneId,
      sceneName: scene?.title ?? sceneId,
      objectiveType: objectiveType as ObjectiveType,
      objectiveText,
      timerPresetMinutes: minutes,
      wordsAtStart: countWords(currentContent),
    });
  };

  const handleTimerPresetClick = (value: number) => {
    setTimerPreset(value);
    setIsCustom(false);
  };

  return (
    <div className={styles.overlay} onClick={onCancel}>
      <div
        className={styles.dialog}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="setup-title"
      >
        <h2 id="setup-title" className={styles.title}>
          Start Focus Session
        </h2>

        <div className={styles.field}>
          <label htmlFor="session-scene" className={styles.label}>
            Target scene
          </label>
          <select
            id="session-scene"
            ref={sceneSelectRef}
            className={styles.select}
            value={sceneId}
            onChange={(e) => setSceneId(e.target.value)}
          >
            {scenes.length === 0 && (
              <option value="">No scenes available</option>
            )}
            {scenes.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.field}>
          <label htmlFor="session-objective" className={styles.label}>
            Objective type
          </label>
          <select
            id="session-objective"
            className={styles.select}
            value={objectiveType}
            onChange={(e) => setObjectiveType(e.target.value as ObjectiveType | '')}
          >
            <option value="">Select an objective…</option>
            {OBJECTIVE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {objectiveType === 'other' && (
          <div className={styles.field}>
            <label htmlFor="session-other-text" className={styles.label}>
              Describe your objective
            </label>
            <input
              id="session-other-text"
              type="text"
              className={styles.input}
              maxLength={60}
              placeholder="e.g. Fix the opening hook"
              value={otherText}
              onChange={(e) => setOtherText(e.target.value)}
            />
          </div>
        )}

        <div className={styles.field}>
          <span className={styles.label}>Timer</span>
          <div className={styles.timerRow} role="radiogroup" aria-label="Timer preset">
            {TIMER_PRESETS.map((p) => (
              <label key={p.value} className={`${styles.timerOption} ${!isCustom && timerPreset === p.value ? styles.timerOptionActive : ''}`}>
                <input
                  type="radio"
                  name="timer-preset"
                  value={p.value}
                  checked={!isCustom && timerPreset === p.value}
                  onChange={() => handleTimerPresetClick(p.value)}
                  className={styles.radioHidden}
                />
                {p.label}
              </label>
            ))}
            <label className={`${styles.timerOption} ${isCustom ? styles.timerOptionActive : ''}`}>
              <input
                type="radio"
                name="timer-preset"
                value="custom"
                checked={isCustom}
                onChange={() => setIsCustom(true)}
                className={styles.radioHidden}
              />
              Custom
            </label>
          </div>
          {isCustom && (
            <div className={styles.customTimer}>
              <input
                type="number"
                className={styles.input}
                min={1}
                max={180}
                value={customMinutes}
                onChange={(e) => setCustomMinutes(Math.min(180, Math.max(1, Number(e.target.value))))}
                aria-label="Custom timer minutes"
              />
              <span className={styles.customTimerLabel}>minutes</span>
            </div>
          )}
        </div>

        <div className={styles.actions}>
          <button className={styles.cancelButton} onClick={onCancel}>
            Cancel
          </button>
          <button
            className={styles.startButton}
            onClick={handleStart}
            disabled={!canStart}
          >
            Start session
          </button>
        </div>
      </div>
    </div>
  );
}
