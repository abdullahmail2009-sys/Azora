import type {
  TopicMasteryState,
  DailyStudyTask,
  SpacedRevisionTask,
  MockTestRecord,
  Subject,
} from '../types/index.ts';

export interface StreakActivityItem {
  id: string;
  type: 'topic_completed' | 'topic_studied' | 'study_task' | 'revision' | 'mock_test';
  title: string;
  subtitle: string;
  topicId?: string;
  minutes?: number;
}

export interface DailyStreakDay {
  date: string; // YYYY-MM-DD
  dayLabel: string; // e.g., 'Mon'
  shortDateLabel: string; // e.g., 'Oct 19'
  dayNumber: string; // e.g., '19'
  isActive: boolean;
  isToday: boolean;
  activityCount: number;
  studyMinutes: number;
  activities: StreakActivityItem[];
}

export type StreakFireVariant = 'ember' | 'spark' | 'flame' | 'milestone-blaze' | 'milestone-supernova';

export interface StreakMilestoneInfo {
  isMilestoneDay: boolean;
  achievedMilestone: number | null;
  exactMilestoneReached: number | null;
  nextMilestone: number;
  daysToNextMilestone: number;
  milestoneProgressPercent: number;
  fireVariant: StreakFireVariant;
  milestoneTitle: string;
  milestoneSubtitle: string;
}

export interface StudyStreakSummary {
  currentStreak: number;
  longestStreak: number;
  totalActiveDays: number;
  isActiveToday: boolean;
  streakAtRisk: boolean;
  todayMinutes: number;
  todayActivitiesCount: number;
  lastActiveDate: string | null;
  last7Days: DailyStreakDay[];
  milestone: StreakMilestoneInfo;
}

export interface StreakDataInput {
  masteryMap: Record<string, TopicMasteryState>;
  studyTasks: DailyStudyTask[];
  revisionTasks: SpacedRevisionTask[];
  mockTests: MockTestRecord[];
  subjects?: Subject[];
}

export const STREAK_MILESTONES = [1, 3, 7, 14, 21, 30, 60, 100] as const;

/**
 * Returns local calendar date formatted as YYYY-MM-DD (respects user's local timezone and midnight boundaries).
 */
export function getLocalDateStr(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Detects and removes legacy factory-seeded demo records that previously caused a newly installed app
 * to display a fabricated 7-day study streak, while preserving all genuine user study records.
 */
const LEGACY_SEED_MASTERY_SIGNATURES: Record<
  string,
  { totalStudyMinutes: number; questionsSolved: number; questionsCorrect: number; confidence: number }
> = {
  'phy-c1-t1': { totalStudyMinutes: 90, questionsSolved: 15, questionsCorrect: 13, confidence: 4 },
  'phy-c1-t2': { totalStudyMinutes: 150, questionsSolved: 20, questionsCorrect: 19, confidence: 5 },
  'phy-c1-t3': { totalStudyMinutes: 80, questionsSolved: 8, questionsCorrect: 6, confidence: 3 },
  'che-c1-t1': { totalStudyMinutes: 110, questionsSolved: 14, questionsCorrect: 12, confidence: 4 },
  'math-c1-t1': { totalStudyMinutes: 120, questionsSolved: 25, questionsCorrect: 23, confidence: 5 },
};

export function isLegacySeedMasteryRecord(record: TopicMasteryState | undefined): boolean {
  if (!record || !record.topicId) return false;
  const sig = LEGACY_SEED_MASTERY_SIGNATURES[record.topicId];
  if (!sig) return false;
  if (record.notes && record.notes.trim().length > 0) return false;
  if (record.isConfidenceRated === true) return false;
  return (
    record.totalStudyMinutes === sig.totalStudyMinutes &&
    record.questionsSolved === sig.questionsSolved &&
    record.questionsCorrect === sig.questionsCorrect &&
    record.confidence === sig.confidence
  );
}

export function sanitizeLegacySeedData(input: {
  masteryMap?: Record<string, TopicMasteryState>;
  studyTasks?: DailyStudyTask[];
  mockTests?: MockTestRecord[];
}): {
  masteryMap: Record<string, TopicMasteryState>;
  studyTasks: DailyStudyTask[];
  mockTests: MockTestRecord[];
  didSanitize: boolean;
} {
  let didSanitize = false;
  const cleanedMastery: Record<string, TopicMasteryState> = {};

  for (const [key, val] of Object.entries(input.masteryMap || {})) {
    if (isLegacySeedMasteryRecord(val)) {
      didSanitize = true;
      continue;
    }
    cleanedMastery[key] = val;
  }

  const cleanedTasks: DailyStudyTask[] = (input.studyTasks || []).map((task) => {
    if (
      task &&
      task.id === 'task-seed-1' &&
      !task.completed &&
      task.actualMinutes === 45 &&
      !task.completedAt
    ) {
      didSanitize = true;
      return {
        ...task,
        actualMinutes: 0,
      };
    }
    return task;
  });

  const cleanedTests: MockTestRecord[] = (input.mockTests || []).filter((test) => {
    if (
      test &&
      test.id === 'test-seed-1' &&
      test.testName === 'Physics Unit 1 Chapter Test (Electrostatics)' &&
      test.marksObtained === 21 &&
      test.maxMarks === 25
    ) {
      didSanitize = true;
      return false;
    }
    return true;
  });

  return {
    masteryMap: cleanedMastery,
    studyTasks: cleanedTasks,
    mockTests: cleanedTests,
    didSanitize,
  };
}

export function getStreakMilestoneInfo(
  currentStreak: number,
  isActiveToday: boolean,
  todayActivitiesCount = 0
): StreakMilestoneInfo {
  const safeStreak = Math.max(0, Math.floor(currentStreak));

  let achievedMilestone: number | null = null;
  for (const m of STREAK_MILESTONES) {
    if (safeStreak >= m) {
      achievedMilestone = m;
    }
  }
  if (safeStreak > 100) {
    achievedMilestone = Math.floor(safeStreak / 25) * 25;
  }

  const isExactStandardMilestone =
    safeStreak > 0 &&
    ((STREAK_MILESTONES as readonly number[]).includes(safeStreak) ||
      (safeStreak > 100 && safeStreak % 25 === 0));

  const exactMilestoneReached = isExactStandardMilestone ? safeStreak : null;

  // Next milestone target
  let nextMilestone = 1;
  if (safeStreak >= 100) {
    nextMilestone = (Math.floor(safeStreak / 25) + 1) * 25;
  } else {
    const foundNext = STREAK_MILESTONES.find((m) => m > safeStreak);
    nextMilestone = foundNext ?? 125;
  }

  const prevThreshold = achievedMilestone ?? 0;
  const span = Math.max(1, nextMilestone - prevThreshold);
  const covered = Math.max(0, safeStreak - prevThreshold);
  const milestoneProgressPercent = isExactStandardMilestone
    ? 100
    : Math.min(99, Math.round((covered / span) * 100));

  const daysToNextMilestone = Math.max(1, nextMilestone - safeStreak);

  // A daily milestone is active when the user hits an exact streak milestone day or completes 2+ activities today
  const isMilestoneDay =
    (isExactStandardMilestone && isActiveToday) ||
    (isActiveToday && todayActivitiesCount >= 2);

  let fireVariant: StreakFireVariant = 'ember';
  if (safeStreak === 0) {
    fireVariant = 'ember';
  } else if (safeStreak >= 14 && isMilestoneDay) {
    fireVariant = 'milestone-supernova';
  } else if (isMilestoneDay || safeStreak >= 7) {
    fireVariant = 'milestone-blaze';
  } else if (safeStreak >= 3) {
    fireVariant = 'flame';
  } else {
    fireVariant = 'spark';
  }

  let milestoneTitle = 'Start Your Study Streak';
  let milestoneSubtitle = 'Complete 1 topic or task today to unlock your 1-Day Spark milestone';

  if (exactMilestoneReached && isActiveToday) {
    milestoneTitle = `${exactMilestoneReached}-Day Milestone Achieved!`;
    milestoneSubtitle = `Milestone flame unlocked · ${daysToNextMilestone} more ${
      daysToNextMilestone === 1 ? 'day' : 'days'
    } to reach your ${nextMilestone}-Day Milestone`;
  } else if (isActiveToday && todayActivitiesCount >= 2) {
    milestoneTitle = `Daily Momentum Milestone (${todayActivitiesCount} Activities Today)`;
    milestoneSubtitle = `${safeStreak}-Day streak active · ${daysToNextMilestone} ${
      daysToNextMilestone === 1 ? 'day' : 'days'
    } until ${nextMilestone}-Day Milestone`;
  } else if (safeStreak > 0) {
    milestoneTitle = achievedMilestone
      ? `${achievedMilestone}-Day Milestone Tier`
      : `${safeStreak}-Day Active Streak`;
    milestoneSubtitle = `${daysToNextMilestone} more consecutive ${
      daysToNextMilestone === 1 ? 'day' : 'days'
    } to unlock the ${nextMilestone}-Day Milestone`;
  }

  return {
    isMilestoneDay,
    achievedMilestone,
    exactMilestoneReached,
    nextMilestone,
    daysToNextMilestone,
    milestoneProgressPercent,
    fireVariant,
    milestoneTitle,
    milestoneSubtitle,
  };
}

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function normalizeDateStr(raw?: string | null): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  const datePart = trimmed.slice(0, 10);
  if (!DATE_REGEX.test(datePart)) return null;
  const [y, m, d] = datePart.split('-').map(Number);
  if (!y || m < 1 || m > 12 || d < 1 || d > 31) return null;
  return datePart;
}

export function addDaysUTC(dateStr: string, deltaDays: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + deltaDays));
  return dt.toISOString().slice(0, 10);
}

export function diffDaysUTC(dateA: string, dateB: string): number {
  const [y1, m1, d1] = dateA.split('-').map(Number);
  const [y2, m2, d2] = dateB.split('-').map(Number);
  const ms1 = Date.UTC(y1, m1 - 1, d1);
  const ms2 = Date.UTC(y2, m2 - 1, d2);
  return Math.round((ms2 - ms1) / (1000 * 60 * 60 * 24));
}

function formatDayMetadata(dateStr: string): {
  dayLabel: string;
  shortDateLabel: string;
  dayNumber: string;
} {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const dayLabel = WEEKDAYS[dt.getUTCDay()] || 'Day';
  const monthLabel = MONTHS[dt.getUTCMonth()] || '';
  const dayNumber = String(d);
  return {
    dayLabel,
    shortDateLabel: `${monthLabel} ${d}`,
    dayNumber,
  };
}

/**
 * Computes consecutive daily study streak metrics and a 7-day activity breakdown
 * directly from AppContext state (masteryMap, studyTasks, revisionTasks, mockTests).
 */
export function calculateStudyStreak(
  input: StreakDataInput,
  todayStr: string = getLocalDateStr()
): StudyStreakSummary {
  const validToday = normalizeDateStr(todayStr) || getLocalDateStr();

  // Build topic lookup map from syllabus if provided
  const topicMetaMap = new Map<
    string,
    { title: string; subjectName: string; chapterTitle: string }
  >();
  if (input.subjects) {
    for (const sub of input.subjects) {
      for (const unit of sub.units || []) {
        for (const chap of unit.chapters || []) {
          for (const top of chap.topics || []) {
            topicMetaMap.set(top.id, {
              title: top.title,
              subjectName: sub.name,
              chapterTitle: chap.title,
            });
          }
        }
      }
    }
  }

  const dayActivitiesMap = new Map<string, StreakActivityItem[]>();
  const dayMinutesMap = new Map<string, number>();

  const addActivity = (dateRaw: string | undefined | null, item: StreakActivityItem, minutes = 0) => {
    const d = normalizeDateStr(dateRaw);
    if (!d || d > validToday) return;
    const list = dayActivitiesMap.get(d) || [];
    if (!list.some((existing) => existing.id === item.id)) {
      list.push(item);
      dayActivitiesMap.set(d, list);
    }
    if (minutes > 0) {
      dayMinutesMap.set(d, (dayMinutesMap.get(d) || 0) + minutes);
    }
  };

  // 1. Inspect Topic Mastery entries (only count genuine qualifying study activity)
  Object.values(input.masteryMap || {}).forEach((m) => {
    if (!m || !m.topicId) return;
    if (isLegacySeedMasteryRecord(m)) return;

    const hasQualifyingActivity =
      m.status === 'Completed' ||
      m.status === 'In Progress' ||
      m.status === 'Needs Revision' ||
      (Array.isArray(m.completedStages) && m.completedStages.length > 0) ||
      (m.totalStudyMinutes || 0) > 0 ||
      (m.questionsSolved || 0) > 0 ||
      Boolean(m.completedDate);
    if (!hasQualifyingActivity) return;

    const meta = topicMetaMap.get(m.topicId);
    const topicTitle = meta?.title || m.topicId;
    const subLabel = meta ? `${meta.subjectName} · ${meta.chapterTitle}` : m.subjectId || 'Syllabus Topic';

    const completedDate = normalizeDateStr(m.completedDate);
    const lastStudiedDate = normalizeDateStr(m.lastStudiedDate);
    const startDate = normalizeDateStr(m.startDate);

    if (completedDate) {
      addActivity(
        completedDate,
        {
          id: `mastery-comp-${m.topicId}-${completedDate}`,
          type: 'topic_completed',
          title: topicTitle,
          subtitle: `Completed · ${subLabel}`,
          topicId: m.topicId,
        },
        completedDate === lastStudiedDate ? m.totalStudyMinutes || 0 : 0
      );
    }

    if (lastStudiedDate) {
      addActivity(
        lastStudiedDate,
        {
          id: `mastery-study-${m.topicId}-${lastStudiedDate}`,
          type: completedDate === lastStudiedDate ? 'topic_completed' : 'topic_studied',
          title: topicTitle,
          subtitle:
            completedDate === lastStudiedDate
              ? `Completed · ${subLabel}`
              : `Studied (${m.status}) · ${subLabel}`,
          topicId: m.topicId,
        },
        completedDate === lastStudiedDate ? 0 : m.totalStudyMinutes || 0
      );
    }

    if (startDate && startDate !== completedDate && startDate !== lastStudiedDate) {
      addActivity(
        startDate,
        {
          id: `mastery-start-${m.topicId}-${startDate}`,
          type: 'topic_studied',
          title: topicTitle,
          subtitle: `Started topic · ${subLabel}`,
          topicId: m.topicId,
        },
        0
      );
    }
  });

  // 2. Inspect Daily Study Tasks (completed tasks or tasks with logged actualMinutes > 0)
  (input.studyTasks || []).forEach((task) => {
    if (!task) return;
    if (task.id === 'task-seed-1' && !task.completed && task.actualMinutes === 45 && !task.completedAt) {
      return;
    }
    const hasActivity = Boolean(task.completed) || (task.actualMinutes || 0) > 0;
    if (!hasActivity) return;

    const activityDate =
      (task.completed && normalizeDateStr(task.completedAt)) || normalizeDateStr(task.date);
    if (!activityDate) return;

    const mins =
      (task.actualMinutes || 0) > 0
        ? task.actualMinutes
        : task.completed
        ? task.plannedMinutes || 0
        : 0;

    addActivity(
      activityDate,
      {
        id: `task-${task.id}-${activityDate}`,
        type: 'study_task',
        title: task.topicTitle || 'Study Session',
        subtitle: `${task.subjectName} · ${task.completed ? 'Task Completed' : `${mins}m logged`}`,
        topicId: task.topicId,
        minutes: mins,
      },
      mins
    );
  });

  // 3. Inspect Completed Spaced Revision Tasks
  (input.revisionTasks || []).forEach((rev) => {
    if (!rev || !rev.completed) return;
    const revDate = normalizeDateStr(rev.completedDate) || normalizeDateStr(rev.scheduledDate);
    if (!revDate) return;

    addActivity(
      revDate,
      {
        id: `rev-${rev.id}-${revDate}`,
        type: 'revision',
        title: rev.topicTitle,
        subtitle: `${rev.subjectName} · Revision Step ${rev.revisionStep} Completed`,
        topicId: rev.topicId,
      },
      25
    );
  });

  // 4. Inspect Mock Tests
  (input.mockTests || []).forEach((test) => {
    if (!test) return;
    if (
      test.id === 'test-seed-1' &&
      test.testName === 'Physics Unit 1 Chapter Test (Electrostatics)' &&
      test.marksObtained === 21 &&
      test.maxMarks === 25
    ) {
      return;
    }
    const testDate = normalizeDateStr(test.date);
    if (!testDate) return;

    addActivity(
      testDate,
      {
        id: `test-${test.id}-${testDate}`,
        type: 'mock_test',
        title: test.testName,
        subtitle: `${test.subjectName} · Scored ${test.marksObtained}/${test.maxMarks}`,
        minutes: test.timeTakenMinutes || 0,
      },
      test.timeTakenMinutes || 0
    );
  });

  // Sorted unique active dates <= validToday
  const activeDatesAsc = Array.from(dayActivitiesMap.keys())
    .filter((d) => (dayActivitiesMap.get(d)?.length || 0) > 0 && d <= validToday)
    .sort();

  const activeSet = new Set(activeDatesAsc);
  const totalActiveDays = activeDatesAsc.length;
  const lastActiveDate =
    activeDatesAsc.length > 0 ? activeDatesAsc[activeDatesAsc.length - 1] : null;

  const isActiveToday = activeSet.has(validToday);
  const yesterdayStr = addDaysUTC(validToday, -1);
  const isActiveYesterday = activeSet.has(yesterdayStr);

  // Calculate current consecutive streak
  let currentStreak = 0;
  if (isActiveToday || isActiveYesterday) {
    let cursor = isActiveToday ? validToday : yesterdayStr;
    while (activeSet.has(cursor)) {
      currentStreak += 1;
      cursor = addDaysUTC(cursor, -1);
    }
  }

  // Calculate longest consecutive streak across all history
  let longestStreak = 0;
  let runningRun = 0;
  for (let i = 0; i < activeDatesAsc.length; i++) {
    if (i === 0) {
      runningRun = 1;
    } else {
      const gap = diffDaysUTC(activeDatesAsc[i - 1], activeDatesAsc[i]);
      if (gap === 1) {
        runningRun += 1;
      } else if (gap > 1) {
        runningRun = 1;
      }
    }
    if (runningRun > longestStreak) {
      longestStreak = runningRun;
    }
  }

  // Build last 7 days timeline ending on validToday
  const last7Days: DailyStreakDay[] = [];
  for (let offset = -6; offset <= 0; offset++) {
    const d = addDaysUTC(validToday, offset);
    const meta = formatDayMetadata(d);
    const activities = dayActivitiesMap.get(d) || [];
    const studyMinutes = dayMinutesMap.get(d) || 0;
    last7Days.push({
      date: d,
      dayLabel: meta.dayLabel,
      shortDateLabel: meta.shortDateLabel,
      dayNumber: meta.dayNumber,
      isActive: activities.length > 0,
      isToday: d === validToday,
      activityCount: activities.length,
      studyMinutes,
      activities,
    });
  }

  const todayEntry = last7Days[last7Days.length - 1];
  const todayActivitiesCount = todayEntry?.activityCount || 0;
  const milestone = getStreakMilestoneInfo(currentStreak, isActiveToday, todayActivitiesCount);

  return {
    currentStreak,
    longestStreak: Math.max(longestStreak, currentStreak),
    totalActiveDays,
    isActiveToday,
    streakAtRisk: !isActiveToday && currentStreak > 0,
    todayMinutes: todayEntry?.studyMinutes || 0,
    todayActivitiesCount,
    lastActiveDate,
    last7Days,
    milestone,
  };
}
