'use client';

import { useState, useEffect, useCallback } from 'react';
import type { DailyGoalConfig, DailyRecord } from '@/types/dailyGoal';
import {
  getGoalConfig,
  setGoalConfig,
  getGoalHistory,
  getRecord,
  upsertRecord,
  computeStreaks,
  getLast14Days,
  todayDateString,
} from '@/lib/dailyGoal';

export interface DailyGoalState {
  config: DailyGoalConfig | null;
  todayRecord: DailyRecord | null;
  streaks: { current: number; longest: number };
  last14Days: Array<{ date: string; record: DailyRecord | null }>;
  setConfig: (c: DailyGoalConfig) => void;
  disableGoal: () => void;
}

export function useDailyGoal(): DailyGoalState {
  const [config, setConfigState] = useState<DailyGoalConfig | null>(null);
  const [todayRecord, setTodayRecord] = useState<DailyRecord | null>(null);
  const [streaks, setStreaks] = useState<{ current: number; longest: number }>({ current: 0, longest: 0 });
  const [last14Days, setLast14Days] = useState<Array<{ date: string; record: DailyRecord | null }>>([]);

  const refresh = useCallback(() => {
    const cfg = getGoalConfig();
    const today = todayDateString();
    const history = getGoalHistory();
    const rec = getRecord(today);

    setConfigState(cfg);
    setTodayRecord(rec);
    setStreaks(computeStreaks(history));
    setLast14Days(getLast14Days().map((date) => ({ date, record: history.find((r) => r.date === date) ?? null })));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleSetConfig = useCallback((c: DailyGoalConfig) => {
    setGoalConfig(c);
    const today = todayDateString();
    upsertRecord(today, {});
    refresh();
  }, [refresh]);

  const disableGoal = useCallback(() => {
    const cfg = getGoalConfig();
    if (cfg) {
      setGoalConfig({ ...cfg, enabled: false });
      refresh();
    }
  }, [refresh]);

  return {
    config,
    todayRecord,
    streaks,
    last14Days,
    setConfig: handleSetConfig,
    disableGoal,
  };
}
