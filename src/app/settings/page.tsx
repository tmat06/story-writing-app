'use client';
import { useState } from 'react';
import { useWriterPrefs } from '@/hooks/useWriterPrefs';
import ConfirmDialog from '@/components/ConfirmDialog/ConfirmDialog';
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
      {/* Editor Typography */}
      <section className={styles.settingsGroup} aria-labelledby="typography-heading">
        <h2 id="typography-heading" className={styles.groupTitle}>
          Editor Typography
        </h2>
        <div className={styles.groupContent}>
          <div className={styles.settingRow}>
            <label htmlFor="font-size" className={styles.settingLabel}>
              <span className={styles.settingLabelText}>Font size</span>
              <span className={styles.settingLabelDescription}>Controls the text size in the story editor</span>
            </label>
            <select
              id="font-size"
              className={styles.select}
              value={prefs.fontSize}
              onChange={(e) => updatePref('fontSize', e.target.value as typeof prefs.fontSize)}
            >
              <option value="14px">14px / Small</option>
              <option value="16px">16px / Medium</option>
              <option value="18px">18px / Default</option>
              <option value="20px">20px / Large</option>
              <option value="22px">22px / X-Large</option>
            </select>
          </div>
          <div className={styles.settingRow}>
            <label htmlFor="line-height" className={styles.settingLabel}>
              <span className={styles.settingLabelText}>Line height</span>
              <span className={styles.settingLabelDescription}>Controls spacing between lines in the editor</span>
            </label>
            <select
              id="line-height"
              className={styles.select}
              value={prefs.lineHeight}
              onChange={(e) => updatePref('lineHeight', e.target.value as typeof prefs.lineHeight)}
            >
              <option value="1.5">1.5 / Compact</option>
              <option value="1.75">1.75 / Relaxed (Default)</option>
              <option value="2.0">2.0 / Spacious</option>
            </select>
          </div>
          <div className={styles.settingRow}>
            <label htmlFor="editor-width" className={styles.settingLabel}>
              <span className={styles.settingLabelText}>Editor width</span>
              <span className={styles.settingLabelDescription}>Controls the maximum column width of the editor</span>
            </label>
            <select
              id="editor-width"
              className={styles.select}
              value={prefs.editorWidth}
              onChange={(e) => updatePref('editorWidth', e.target.value as typeof prefs.editorWidth)}
            >
              <option value="60ch">60ch / Narrow</option>
              <option value="72ch">72ch / Default</option>
              <option value="80ch">80ch / Wide</option>
              <option value="90ch">90ch / Very Wide</option>
            </select>
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
            <input
              id="focus-by-default"
              type="checkbox"
              className={styles.toggle}
              checked={prefs.focusByDefault}
              onChange={(e) => updatePref('focusByDefault', e.target.checked)}
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
            <input
              id="reduced-motion"
              type="checkbox"
              className={styles.toggle}
              checked={prefs.reducedMotion}
              onChange={(e) => updatePref('reducedMotion', e.target.checked)}
            />
          </div>
          <div className={styles.settingRow}>
            <label htmlFor="high-contrast" className={styles.settingLabel}>
              <span className={styles.settingLabelText}>High-contrast text</span>
              <span className={styles.settingLabelDescription}>Increases text contrast for readability in the editor</span>
            </label>
            <input
              id="high-contrast"
              type="checkbox"
              className={styles.toggle}
              checked={prefs.highContrast}
              onChange={(e) => updatePref('highContrast', e.target.checked)}
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

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.resetButton}
          onClick={() => setShowResetDialog(true)}
        >
          Reset to defaults
        </button>
      </div>

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
