import type { DailyGoalConfig, DailyRecord, DailyStorySnapshots } from '@/types/dailyGoal';

const GOAL_CONFIG_KEY    = 'daily_goal_config';
const GOAL_HISTORY_KEY   = 'daily_goal_records';
const WORD_SNAPSHOTS_KEY = 'daily_goal_word_snapshots';

export function todayDateString(): string {
  return new Date().toLocaleDateString('en-CA');
}

// --- Config CRUD ---

export function getGoalConfig(): DailyGoalConfig | null {
  try {
    const raw = localStorage.getItem(GOAL_CONFIG_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as DailyGoalConfig;
  } catch {
    return null;
  }
}

export function setGoalConfig(config: DailyGoalConfig): void {
  try {
    localStorage.setItem(GOAL_CONFIG_KEY, JSON.stringify(config));
  } catch {
    // quota exceeded or SSR
  }
}

export function clearGoalConfig(): void {
  try {
    const config = getGoalConfig();
    if (config) {
      setGoalConfig({ ...config, enabled: false });
    }
  } catch {
    // ignore
  }
}

// --- History CRUD ---

export function getGoalHistory(): DailyRecord[] {
  try {
    const raw = localStorage.getItem(GOAL_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as DailyRecord[];
    return parsed.sort((a, b) => b.date.localeCompare(a.date));
  } catch {
    return [];
  }
}

export function getRecord(date: string): DailyRecord | null {
  const history = getGoalHistory();
  return history.find((r) => r.date === date) ?? null;
}

export function upsertRecord(date: string, patch: Partial<DailyRecord>): DailyRecord {
  const history = getGoalHistory();
  const config = getGoalConfig();
  const existing = history.find((r) => r.date === date);

  const base: DailyRecord = existing ?? {
    date,
    wordsWritten: 0,
    minutesWritten: 0,
    goalMet: false,
    goalSnapshot: config ?? ({ type: 'words', amount: 500, weeklyTargetDays: 5, enabled: true, createdAt: Date.now() } as DailyGoalConfig),
  };

  const merged: DailyRecord = { ...base, ...patch };

  if (config && config.enabled) {
    merged.goalMet = config.type === 'words'
      ? merged.wordsWritten >= config.amount
      : merged.minutesWritten >= config.amount;
    merged.goalSnapshot = config;
  } else {
    merged.goalMet = false;
  }

  const updated = existing
    ? history.map((r) => (r.date === date ? merged : r))
    : [merged, ...history];

  try {
    localStorage.setItem(GOAL_HISTORY_KEY, JSON.stringify(updated));
  } catch {
    // quota exceeded
  }

  return merged;
}

// --- Word snapshot logic ---

function getSnapshots(): DailyStorySnapshots {
  try {
    const raw = localStorage.getItem(WORD_SNAPSHOTS_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as DailyStorySnapshots;
  } catch {
    return {};
  }
}

function saveSnapshots(snapshots: DailyStorySnapshots): void {
  try {
    localStorage.setItem(WORD_SNAPSHOTS_KEY, JSON.stringify(snapshots));
  } catch {
    // quota exceeded
  }
}

export function getWordSnapshot(date: string, storyId: string): number {
  const snapshots = getSnapshots();
  return snapshots[date]?.[storyId] ?? -1;
}

export function initWordSnapshot(date: string, storyId: string, wordCount: number): void {
  const snapshots = getSnapshots();
  if (snapshots[date]?.[storyId] !== undefined) return;
  if (!snapshots[date]) snapshots[date] = {};
  snapshots[date][storyId] = wordCount;
  saveSnapshots(snapshots);
}

export function recordStoryWordSnapshot(storyId: string, currentWordCount: number): void {
  const date = todayDateString();
  const existing = getWordSnapshot(date, storyId);

  if (existing === -1) {
    initWordSnapshot(date, storyId, currentWordCount);
    return;
  }

  const delta = currentWordCount - existing;
  if (delta > 0) {
    const record = getRecord(date);
    upsertRecord(date, { wordsWritten: (record?.wordsWritten ?? 0) + delta });
  }

  // Always refresh snapshot to current
  const snapshots = getSnapshots();
  if (!snapshots[date]) snapshots[date] = {};
  snapshots[date][storyId] = currentWordCount;
  saveSnapshots(snapshots);
}

// --- Focus minutes recording ---

export function recordFocusMinutes(minutes: number): void {
  const date = todayDateString();
  const record = getRecord(date);
  upsertRecord(date, { minutesWritten: (record?.minutesWritten ?? 0) + minutes });
}

// --- Streak calculator ---

export function computeStreaks(history: DailyRecord[]): { current: number; longest: number } {
  if (history.length === 0) return { current: 0, longest: 0 };

  const today = todayDateString();

  // current streak: consecutive goalMet days ending today or yesterday
  let current = 0;
  const sortedDesc = [...history].sort((a, b) => b.date.localeCompare(a.date));

  // Determine start: if today has a record and goalMet, start from today; else start from yesterday
  const todayRecord = sortedDesc.find((r) => r.date === today);
  let checkDate = new Date();
  if (!todayRecord || !todayRecord.goalMet) {
    checkDate.setDate(checkDate.getDate() - 1);
  }

  for (let i = 0; i < sortedDesc.length; i++) {
    const expectedDate = new Date(checkDate);
    expectedDate.setDate(checkDate.getDate() - i);
    const expectedStr = expectedDate.toLocaleDateString('en-CA');
    const record = sortedDesc.find((r) => r.date === expectedStr);
    if (record && record.goalMet) {
      current++;
    } else {
      break;
    }
  }

  // longest streak: sliding window over full history sorted oldest-first
  const sortedAsc = [...history].sort((a, b) => a.date.localeCompare(b.date));
  let longest = 0;
  let run = 0;
  let prevDate: Date | null = null;

  for (const record of sortedAsc) {
    const recDate = new Date(record.date + 'T12:00:00');
    if (record.goalMet) {
      if (prevDate) {
        const diff = (recDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24);
        if (Math.round(diff) === 1) {
          run++;
        } else {
          run = 1;
        }
      } else {
        run = 1;
      }
      if (run > longest) longest = run;
      prevDate = recDate;
    } else {
      run = 0;
      prevDate = null;
    }
  }

  return { current, longest };
}

// --- 14-day window ---

export function getLast14Days(): string[] {
  const days: string[] = [];
  const today = new Date();
  for (let i = 13; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    days.push(d.toLocaleDateString('en-CA'));
  }
  return days;
}
