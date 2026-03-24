'use client';
import { useState } from 'react';
import { useWriterPrefs } from '@/hooks/useWriterPrefs';
import ConfirmDialog from '@/components/ConfirmDialog/ConfirmDialog';
import SegmentedControl from '@/components/SegmentedControl/SegmentedControl';
import Switch from '@/components/Switch/Switch';
import styles from './page.module.css';

export default function SettingsPage() {
  const { prefs, updatePref, resetPrefs, saveStatus } = useWriterPrefs();
  const [showResetDialog, setShowResetDialog] = useState(false);

  const handleReset = () => {
    resetPrefs();
    setShowResetDialog(false);
  };

  return (
    <div className={styles.page}>
      <p className={styles.pageIntro}>Tune your writing environment.</p>

      {/* Editor Typography */}
      <section className={styles.settingsGroup} aria-labelledby="typography-heading">
        <h2 id="typography-heading" className={styles.groupTitle}>
          Editor Typography
        </h2>
        <div className={styles.groupContent}>
          <div className={styles.settingRow}>
            <div id="label-font-size" className={styles.settingLabel}>
              <span className={styles.settingLabelText}>Font size</span>
              <span className={styles.settingLabelDescription}>Controls the text size in the story editor</span>
            </div>
            <SegmentedControl
              aria-labelledby="label-font-size"
              options={[
                { value: '14px', label: '14px' },
                { value: '16px', label: '16px' },
                { value: '18px', label: '18px' },
                { value: '20px', label: '20px' },
                { value: '22px', label: '22px' },
              ]}
              value={prefs.fontSize}
              onChange={(v) => updatePref('fontSize', v)}
            />
          </div>
          <div className={styles.settingRow}>
            <div id="label-line-height" className={styles.settingLabel}>
              <span className={styles.settingLabelText}>Line height</span>
              <span className={styles.settingLabelDescription}>Controls spacing between lines in the editor</span>
            </div>
            <SegmentedControl
              aria-labelledby="label-line-height"
              options={[
                { value: '1.5', label: 'Compact' },
                { value: '1.75', label: 'Relaxed' },
                { value: '2.0', label: 'Spacious' },
              ]}
              value={prefs.lineHeight}
              onChange={(v) => updatePref('lineHeight', v)}
            />
          </div>
          <div className={styles.settingRow}>
            <div id="label-editor-width" className={styles.settingLabel}>
              <span className={styles.settingLabelText}>Editor width</span>
              <span className={styles.settingLabelDescription}>Controls the maximum column width of the editor</span>
            </div>
            <SegmentedControl
              aria-labelledby="label-editor-width"
              options={[
                { value: '60ch', label: 'Narrow' },
                { value: '72ch', label: 'Default' },
                { value: '80ch', label: 'Wide' },
                { value: '90ch', label: 'X-Wide' },
              ]}
              value={prefs.editorWidth}
              onChange={(v) => updatePref('editorWidth', v)}
            />
          </div>
        </div>
      </section>

      {/* Focus Behavior */}
      <section className={styles.settingsGroup} aria-labelledby="focus-heading">
        <h2 id="focus-heading" className={styles.groupTitle}>
          Focus Behavior
        </h2>
        <div className={styles.groupContent}>
          <div className={styles.settingRow}>
            <label htmlFor="focus-by-default" className={styles.settingLabel}>
              <span className={styles.settingLabelText}>Enter focus mode by default</span>
              <span className={styles.settingLabelDescription}>Automatically enables distraction-free mode when opening a story</span>
            </label>
            <Switch
              id="focus-by-default"
              checked={prefs.focusByDefault}
              onChange={(v) => updatePref('focusByDefault', v)}
              aria-describedby="focus-by-default-desc"
            />
          </div>
        </div>
      </section>

      {/* Accessibility & Readability */}
      <section className={styles.settingsGroup} aria-labelledby="accessibility-heading">
        <h2 id="accessibility-heading" className={styles.groupTitle}>
          Accessibility &amp; Readability
        </h2>
        <div className={styles.groupContent}>
          <div className={styles.settingRow}>
            <label htmlFor="reduced-motion" className={styles.settingLabel}>
              <span className={styles.settingLabelText}>Reduced motion</span>
              <span className={styles.settingLabelDescription}>Disables transitions and animations in the editor</span>
            </label>
            <Switch
              id="reduced-motion"
              checked={prefs.reducedMotion}
              onChange={(v) => updatePref('reducedMotion', v)}
            />
          </div>
          <div className={styles.settingRow}>
            <label htmlFor="high-contrast" className={styles.settingLabel}>
              <span className={styles.settingLabelText}>High-contrast text</span>
              <span className={styles.settingLabelDescription}>Increases text contrast for readability in the editor</span>
            </label>
            <Switch
              id="high-contrast"
              checked={prefs.highContrast}
              onChange={(v) => updatePref('highContrast', v)}
            />
          </div>
        </div>
      </section>

      <span
        className={styles.saveStatus}
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {saveStatus === 'saved' ? 'Preferences saved' : ''}
      </span>

      <section className={styles.dangerZone} aria-labelledby="danger-heading">
        <h2 id="danger-heading" className={styles.dangerTitle}>Reset preferences</h2>
        <div className={styles.dangerContent}>
          <p className={styles.dangerDescription}>
            Restore all preferences to their original defaults. This cannot be undone.
          </p>
          <button
            type="button"
            className={styles.resetButton}
            onClick={() => setShowResetDialog(true)}
          >
            Reset to defaults
          </button>
        </div>
      </section>

      <ConfirmDialog
        isOpen={showResetDialog}
        title="Reset to defaults"
        message="This will restore all preferences to their default values. This cannot be undone."
        confirmLabel="Reset"
        onConfirm={handleReset}
        onCancel={() => setShowResetDialog(false)}
      />
    </div>
  );
}
