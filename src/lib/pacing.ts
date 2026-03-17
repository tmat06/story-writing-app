import type { Scene } from '@/types/scene';
import type {
  TensionTag,
  SensitivityLevel,
  ChapterPacingStats,
  ScenePacingData,
  PacingAlert,
  PacingSnapshot,
} from '@/types/pacing';

const THRESHOLDS: Record<SensitivityLevel, { warn: number; alert: number }> = {
  tight:    { warn: 0.15, alert: 0.30 },
  moderate: { warn: 0.25, alert: 0.50 },
  loose:    { warn: 0.40, alert: 0.70 },
};

export function getSceneWordCount(storyId: string, sceneId: string): number {
  if (typeof window === 'undefined') return 0;
  const content = localStorage.getItem(`story_${storyId}_scene_${sceneId}_content`) ?? '';
  return content.trim() ? content.trim().split(/\s+/).length : 0;
}

export function getTensionTags(storyId: string): Record<string, TensionTag> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(`story-${storyId}-tension-tags`);
    return raw ? (JSON.parse(raw) as Record<string, TensionTag>) : {};
  } catch {
    return {};
  }
}

export function setTensionTag(
  storyId: string,
  sceneId: string,
  tag: TensionTag | null
): void {
  if (typeof window === 'undefined') return;
  const tags = getTensionTags(storyId);
  if (tag === null) {
    delete tags[sceneId];
  } else {
    tags[sceneId] = tag;
  }
  localStorage.setItem(`story-${storyId}-tension-tags`, JSON.stringify(tags));
}

export function computeChapterStats(storyId: string, scenes: Scene[]): ChapterPacingStats[] {
  const tags = getTensionTags(storyId);
  const chapterMap = new Map<string, ScenePacingData[]>();

  const sorted = [...scenes].sort((a, b) => a.order - b.order);
  for (const scene of sorted) {
    const wordCount = getSceneWordCount(storyId, scene.id);
    const tensionTag = tags[scene.id] ?? null;
    const entry: ScenePacingData = {
      sceneId: scene.id,
      sceneTitle: scene.title,
      chapter: scene.chapter,
      wordCount,
      tensionTag,
    };
    if (!chapterMap.has(scene.chapter)) {
      chapterMap.set(scene.chapter, []);
    }
    chapterMap.get(scene.chapter)!.push(entry);
  }

  const stats: ChapterPacingStats[] = [];
  for (const [chapter, sceneData] of chapterMap) {
    const totalWords = sceneData.reduce((sum, s) => sum + s.wordCount, 0);
    const tagDistribution: Record<TensionTag, number> = {
      setup: 0, build: 0, peak: 0, release: 0,
    };
    for (const s of sceneData) {
      if (s.tensionTag) tagDistribution[s.tensionTag]++;
    }
    const hasPeakOrRelease = tagDistribution.peak > 0 || tagDistribution.release > 0;
    stats.push({ chapter, scenes: sceneData, totalWords, tagDistribution, hasPeakOrRelease });
  }
  return stats;
}

export function computeStoryMedianWordCount(stats: ChapterPacingStats[]): number {
  if (stats.length === 0) return 0;
  const words = stats.map((s) => s.totalWords).sort((a, b) => a - b);
  const mid = Math.floor(words.length / 2);
  return words.length % 2 === 0 ? (words[mid - 1] + words[mid]) / 2 : words[mid];
}

export function computeAlerts(
  stats: ChapterPacingStats[],
  sensitivity: SensitivityLevel,
  dismissedIds: Set<string>
): PacingAlert[] {
  const alerts: PacingAlert[] = [];
  const threshold = THRESHOLDS[sensitivity];
  const median = computeStoryMedianWordCount(stats);

  // Alert A: Long low-tension run (≥4 consecutive setup/build/null scenes)
  const allScenes = stats.flatMap((ch) => ch.scenes);
  let runStart = -1;
  let runLength = 0;
  let runChapter = '';
  let runFirstSceneId = '';

  const emitAlertA = () => {
    if (runLength >= 4) {
      const alertId = `alert-A-${runChapter.replace(/\s+/g, '-')}-${runFirstSceneId}`;
      if (!dismissedIds.has(alertId)) {
        alerts.push({
          id: alertId,
          type: 'low-tension-run',
          severity: 'warning',
          message: `${runChapter}: ${runLength} consecutive scenes without peak or release tension.`,
          chapterLabel: runChapter,
          sceneId: runFirstSceneId,
          dismissed: false,
        });
      }
    }
  };

  for (let i = 0; i < allScenes.length; i++) {
    const s = allScenes[i];
    const isLow = s.tensionTag === 'setup' || s.tensionTag === 'build' || s.tensionTag === null;

    if (isLow) {
      if (runLength === 0) {
        runStart = i;
        runChapter = s.chapter;
        runFirstSceneId = s.sceneId;
      }
      if (s.chapter !== runChapter) {
        // chapter boundary — emit previous run if long enough
        emitAlertA();
        runLength = 1;
        runChapter = s.chapter;
        runFirstSceneId = s.sceneId;
      } else {
        runLength++;
      }
    } else {
      emitAlertA();
      runLength = 0;
      runStart = -1;
    }
  }
  emitAlertA();

  // Alert B: Chapter length outlier
  if (median > 0) {
    for (const ch of stats) {
      const deviation = Math.abs(ch.totalWords - median) / median;
      if (deviation > threshold.alert) {
        const alertId = `alert-B-${ch.chapter.replace(/\s+/g, '-')}`;
        if (!dismissedIds.has(alertId)) {
          const direction = ch.totalWords > median ? 'much longer' : 'much shorter';
          alerts.push({
            id: alertId,
            type: 'length-outlier',
            severity: 'warning',
            message: `${ch.chapter} is ${direction} than other chapters (${ch.totalWords} vs ~${Math.round(median)} words median).`,
            chapterLabel: ch.chapter,
            sceneId: ch.scenes[0]?.sceneId ?? null,
            dismissed: false,
          });
        }
      }
    }
  }

  // Alert C: No tags (< 30% scenes tagged)
  const totalScenes = allScenes.length;
  const taggedCount = allScenes.filter((s) => s.tensionTag !== null).length;
  if (totalScenes > 0 && taggedCount / totalScenes < 0.30) {
    const alertId = 'alert-C-story';
    if (!dismissedIds.has(alertId)) {
      alerts.push({
        id: alertId,
        type: 'no-tags',
        severity: 'info',
        message: `Only ${taggedCount} of ${totalScenes} scenes have tension tags. Add tags to unlock pacing alerts.`,
        chapterLabel: '',
        sceneId: null,
        dismissed: false,
      });
    }
  }

  console.log(`[pacing] computed ${alerts.length} alerts for story`);

  // Sort: warnings first, then info; cap at 8
  return alerts
    .sort((a, b) => {
      if (a.severity === b.severity) return 0;
      return a.severity === 'warning' ? -1 : 1;
    })
    .slice(0, 8);
}

export function getDismissedAlerts(storyId: string): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(`story-${storyId}-dismissed-alerts`);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

export function dismissAlert(storyId: string, alertId: string): void {
  if (typeof window === 'undefined') return;
  const dismissed = getDismissedAlerts(storyId);
  dismissed.add(alertId);
  localStorage.setItem(
    `story-${storyId}-dismissed-alerts`,
    JSON.stringify(Array.from(dismissed))
  );
}

export function saveSnapshot(storyId: string, snapshot: PacingSnapshot): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(`pacing-snapshot-${storyId}`, JSON.stringify(snapshot));
}

export function loadSnapshot(storyId: string): PacingSnapshot | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(`pacing-snapshot-${storyId}`);
    return raw ? (JSON.parse(raw) as PacingSnapshot) : null;
  } catch {
    return null;
  }
}
