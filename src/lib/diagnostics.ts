import type { Scene } from '@/types/scene';
import type {
  DiagnosticThresholds,
  DiagnosticsDismissalState,
  DiagnosticWarning,
  PovChapterShare,
  CharacterPresenceMatrix,
} from '@/types/diagnostics';

const DEFAULT_THRESHOLDS: DiagnosticThresholds = {
  povDominancePct: 70,
  characterAbsenceChapters: 3,
  snoozeHours: 48,
};

export function getDiagnosticsThresholds(storyId: string): DiagnosticThresholds {
  if (typeof window === 'undefined') return { ...DEFAULT_THRESHOLDS };
  try {
    const raw = localStorage.getItem(`story-${storyId}-diagnostic-thresholds`);
    return raw ? { ...DEFAULT_THRESHOLDS, ...(JSON.parse(raw) as Partial<DiagnosticThresholds>) } : { ...DEFAULT_THRESHOLDS };
  } catch {
    return { ...DEFAULT_THRESHOLDS };
  }
}

export function setDiagnosticsThresholds(storyId: string, t: DiagnosticThresholds): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(`story-${storyId}-diagnostic-thresholds`, JSON.stringify(t));
}

export function getDiagnosticDismissals(storyId: string): DiagnosticsDismissalState {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(`story-${storyId}-diagnostic-dismissals`);
    return raw ? (JSON.parse(raw) as DiagnosticsDismissalState) : {};
  } catch {
    return {};
  }
}

function saveDismissals(storyId: string, state: DiagnosticsDismissalState): void {
  localStorage.setItem(`story-${storyId}-diagnostic-dismissals`, JSON.stringify(state));
}

export function dismissDiagnosticWarning(storyId: string, warningId: string): void {
  if (typeof window === 'undefined') return;
  const state = getDiagnosticDismissals(storyId);
  state[warningId] = { dismissed: true };
  saveDismissals(storyId, state);
}

export function snoozeDiagnosticWarning(storyId: string, warningId: string, hours: number): void {
  if (typeof window === 'undefined') return;
  const state = getDiagnosticDismissals(storyId);
  state[warningId] = { dismissed: false, snoozedUntil: Date.now() + hours * 3600 * 1000 };
  saveDismissals(storyId, state);
}

export function computePovDistribution(scenes: Scene[]): PovChapterShare[] {
  const sorted = [...scenes].sort((a, b) => a.order - b.order);
  const chapterOrder: string[] = [];
  const chapterMap = new Map<string, Record<string, number>>();

  for (const scene of sorted) {
    const pov = scene.pov?.trim() || '';
    if (!chapterMap.has(scene.chapter)) {
      chapterOrder.push(scene.chapter);
      chapterMap.set(scene.chapter, {});
    }
    const breakdown = chapterMap.get(scene.chapter)!;
    breakdown[pov] = (breakdown[pov] ?? 0) + 1;
  }

  return chapterOrder.map((chapter) => {
    const breakdown = chapterMap.get(chapter)!;
    const total = Object.values(breakdown).reduce((s, n) => s + n, 0);
    return { chapter, total, breakdown };
  });
}

export function computeCharacterPresenceMatrix(scenes: Scene[]): CharacterPresenceMatrix {
  const sorted = [...scenes].sort((a, b) => a.order - b.order);

  // Collect all unique characters and chapters in manuscript order
  const characterSet = new Set<string>();
  const chapterOrder: string[] = [];
  const chapterSeen = new Set<string>();

  for (const scene of sorted) {
    if (!chapterSeen.has(scene.chapter)) {
      chapterOrder.push(scene.chapter);
      chapterSeen.add(scene.chapter);
    }
    for (const char of scene.characters ?? []) {
      const trimmed = char.trim();
      if (trimmed) characterSet.add(trimmed);
    }
  }

  const characters = Array.from(characterSet).sort();
  const chapters = chapterOrder;

  // Build matrix[charIdx][chapIdx]
  const matrix: number[][] = characters.map(() => chapters.map(() => 0));

  for (const scene of sorted) {
    const chapIdx = chapters.indexOf(scene.chapter);
    if (chapIdx === -1) continue;
    for (const char of scene.characters ?? []) {
      const trimmed = char.trim();
      const charIdx = characters.indexOf(trimmed);
      if (charIdx !== -1) {
        matrix[charIdx][chapIdx]++;
      }
    }
  }

  return { characters, chapters, matrix };
}

export function computeDiagnosticsWarnings(
  scenes: Scene[],
  thresholds: DiagnosticThresholds,
  dismissals: DiagnosticsDismissalState,
  now: number = Date.now()
): DiagnosticWarning[] {
  const warnings: DiagnosticWarning[] = [];
  const sorted = [...scenes].sort((a, b) => a.order - b.order);

  // W-C: no-pov-metadata
  const totalScenes = sorted.length;
  if (totalScenes > 0) {
    const withPov = sorted.filter((s) => s.pov?.trim()).length;
    if (withPov / totalScenes < 0.3) {
      const id = 'diag-no-pov-meta';
      warnings.push({
        id,
        type: 'no-pov-metadata',
        severity: 'info',
        message: `Only ${withPov} of ${totalScenes} scenes have a POV character. Tag scenes to unlock POV balance diagnostics.`,
        chapterLabel: '',
        sceneIds: [],
        dismissed: false,
      });
    }
  }

  // W-D: no-character-metadata
  if (totalScenes > 0) {
    const withChars = sorted.filter((s) => (s.characters?.length ?? 0) > 0).length;
    if (withChars / totalScenes < 0.3) {
      const id = 'diag-no-char-meta';
      warnings.push({
        id,
        type: 'no-character-metadata',
        severity: 'info',
        message: `Only ${withChars} of ${totalScenes} scenes have character data. Tag characters to unlock presence diagnostics.`,
        chapterLabel: '',
        sceneIds: [],
        dismissed: false,
      });
    }
  }

  // W-A: pov-dominance — per chapter
  const povDist = computePovDistribution(sorted);
  for (const { chapter, total, breakdown } of povDist) {
    if (total < 2) continue;
    const namedPovs = Object.entries(breakdown).filter(([name]) => name !== '');
    if (namedPovs.length < 2) continue;
    for (const [pov, count] of namedPovs) {
      const pct = (count / total) * 100;
      if (pct > thresholds.povDominancePct) {
        const id = `diag-pov-dom-${chapter.replace(/\s+/g, '-')}`;
        const sceneIds = sorted
          .filter((s) => s.chapter === chapter && (s.pov?.trim() || '') === pov)
          .map((s) => s.id);
        warnings.push({
          id,
          type: 'pov-dominance',
          severity: 'warning',
          message: `${chapter}: "${pov}" has ${Math.round(pct)}% of scenes — above the ${thresholds.povDominancePct}% threshold.`,
          chapterLabel: chapter,
          sceneIds,
          dismissed: false,
        });
        break; // one warning per chapter
      }
    }
  }

  // W-B: character-absence — consecutive chapters
  const matrix = computeCharacterPresenceMatrix(sorted);
  for (let charIdx = 0; charIdx < matrix.characters.length; charIdx++) {
    const char = matrix.characters[charIdx];
    let runLength = 0;
    let firstAbsentChapter = '';
    for (let chapIdx = 0; chapIdx < matrix.chapters.length; chapIdx++) {
      if (matrix.matrix[charIdx][chapIdx] === 0) {
        if (runLength === 0) firstAbsentChapter = matrix.chapters[chapIdx];
        runLength++;
      } else {
        if (runLength >= thresholds.characterAbsenceChapters) {
          const id = `diag-char-abs-${char.replace(/\s+/g, '-')}-${firstAbsentChapter.replace(/\s+/g, '-')}`;
          warnings.push({
            id,
            type: 'character-absence',
            severity: 'warning',
            message: `"${char}" is absent for ${runLength} consecutive chapters (starting ${firstAbsentChapter}).`,
            chapterLabel: firstAbsentChapter,
            sceneIds: [],
            dismissed: false,
          });
        }
        runLength = 0;
        firstAbsentChapter = '';
      }
    }
    if (runLength >= thresholds.characterAbsenceChapters) {
      const id = `diag-char-abs-${char.replace(/\s+/g, '-')}-${firstAbsentChapter.replace(/\s+/g, '-')}`;
      warnings.push({
        id,
        type: 'character-absence',
        severity: 'warning',
        message: `"${char}" is absent for ${runLength} consecutive chapters (starting ${firstAbsentChapter}).`,
        chapterLabel: firstAbsentChapter,
        sceneIds: [],
        dismissed: false,
      });
    }
  }

  // Filter dismissed/snoozed
  const filtered = warnings.filter((w) => {
    const entry = dismissals[w.id];
    if (!entry) return true;
    if (entry.dismissed) return false;
    if (entry.snoozedUntil && entry.snoozedUntil > now) return false;
    return true;
  });

  // Sort: alert → warning → info
  const severityOrder: Record<string, number> = { alert: 0, warning: 1, info: 2 };
  return filtered
    .sort((a, b) => (severityOrder[a.severity] ?? 2) - (severityOrder[b.severity] ?? 2))
    .slice(0, 10);
}

export function getPovBalanceStatus(warnings: DiagnosticWarning[]): 'ok' | 'warn' | 'alert' {
  const hasDominance = warnings.some((w) => w.type === 'pov-dominance');
  if (hasDominance) return 'warn';
  return 'ok';
}

export function getAbsentCharactersCount(warnings: DiagnosticWarning[]): number {
  return warnings.filter((w) => w.type === 'character-absence').length;
}
