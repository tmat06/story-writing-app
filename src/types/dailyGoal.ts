export type GoalType = 'words' | 'minutes';

export interface DailyGoalConfig {
  type: GoalType;
  amount: number;
  weeklyTargetDays: number;
  enabled: boolean;
  createdAt: number;
}

export interface DailyRecord {
  date: string;
  wordsWritten: number;
  minutesWritten: number;
  goalMet: boolean;
  goalSnapshot: DailyGoalConfig;
}

// shape: { 'YYYY-MM-DD': { storyId: wordCountAtDayStart } }
export type DailyStorySnapshots = Record<string, Record<string, number>>;
