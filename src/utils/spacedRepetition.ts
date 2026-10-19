import type { SpacedRevisionTask, ConfidenceRating } from '../types/index.ts';

export const DEFAULT_SCHEDULE_DAYS: Record<number, number> = {
  1: 1,
  2: 7,
  3: 15,
  4: 30,
};

export const ADVANCED_SCHEDULE_DAYS: Record<number, number> = {
  1: 3,
  2: 7,
  3: 21,
  4: 45,
};

/**
 * Calculates scheduled revision date given completion date, step, schedule type,
 * and adaptive confidence/recall heuristic modifier.
 */
export function calculateNextRevisionDate(
  baseDateStr: string,
  step: 1 | 2 | 3 | 4,
  scheduleType: 'default' | 'advanced' = 'default',
  lastConfidence?: ConfidenceRating,
  lastRecall?: 'High' | 'Medium' | 'Low'
): string {
  const schedule =
    scheduleType === 'advanced' ? ADVANCED_SCHEDULE_DAYS : DEFAULT_SCHEDULE_DAYS;
  let intervalDays = schedule[step] || 7;

  // Adaptive revision heuristic:
  // Low confidence or poor recall: move revision earlier (tighten interval)
  if (lastConfidence && lastConfidence <= 2) {
    intervalDays = Math.max(1, Math.floor(intervalDays * 0.5));
  } else if (lastRecall === 'Low') {
    intervalDays = Math.max(1, Math.floor(intervalDays * 0.6));
  } else if (lastConfidence === 5 && lastRecall === 'High') {
    // High mastery: allow normal or slightly expanded interval up to 1.25x
    intervalDays = Math.round(intervalDays * 1.25);
  }

  const baseDate = new Date(baseDateStr);
  if (isNaN(baseDate.getTime())) {
    const today = new Date();
    today.setDate(today.getDate() + intervalDays);
    return today.toISOString().split('T')[0];
  }

  baseDate.setDate(baseDate.getDate() + intervalDays);
  return baseDate.toISOString().split('T')[0];
}

export type RevisionUrgency = 'overdue' | 'due_today' | 'upcoming' | 'completed';

export function getRevisionUrgency(
  task: SpacedRevisionTask,
  currentDateStr: string
): RevisionUrgency {
  if (task.completed) return 'completed';
  if (task.scheduledDate < currentDateStr) return 'overdue';
  if (task.scheduledDate === currentDateStr) return 'due_today';
  return 'upcoming';
}

/**
 * Deduplicates revision tasks ensuring no duplicate step exists for a given topic.
 */
export function deduplicateRevisions(
  existingTasks: SpacedRevisionTask[],
  newTask: SpacedRevisionTask
): SpacedRevisionTask[] {
  const filtered = existingTasks.filter(
    (t) => !(t.topicId === newTask.topicId && t.revisionStep === newTask.revisionStep)
  );
  return [...filtered, newTask];
}

/**
 * Groups and filters revision tasks for display.
 */
export function categorizeRevisions(
  tasks: SpacedRevisionTask[],
  todayStr: string
): {
  dueToday: SpacedRevisionTask[];
  overdue: SpacedRevisionTask[];
  upcoming: SpacedRevisionTask[];
  completedHistory: SpacedRevisionTask[];
} {
  const dueToday: SpacedRevisionTask[] = [];
  const overdue: SpacedRevisionTask[] = [];
  const upcoming: SpacedRevisionTask[] = [];
  const completedHistory: SpacedRevisionTask[] = [];

  tasks.forEach((task) => {
    const urgency = getRevisionUrgency(task, todayStr);
    if (urgency === 'completed') {
      completedHistory.push(task);
    } else if (urgency === 'due_today') {
      dueToday.push(task);
    } else if (urgency === 'overdue') {
      overdue.push(task);
    } else {
      upcoming.push(task);
    }
  });

  // Sort upcoming and overdue by scheduled date
  overdue.sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate));
  dueToday.sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate));
  upcoming.sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate));
  completedHistory.sort(
    (a, b) => (b.completedDate || '').localeCompare(a.completedDate || '')
  );

  return { dueToday, overdue, upcoming, completedHistory };
}
