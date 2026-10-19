export interface BacklogMetrics {
  remainingTopics: number;
  completedTopics: number;
  totalTopics: number;
  availableDays: number;
  requiredTopicsPerDay: number;
  estimatedRemainingHours: number;
  dailyHoursLimit: number;
  requiredDailyStudyHours: number;
  projectedFinishDate: string;
  isFeasible: boolean;
  workloadDeficitHours: number;
  feasibilityWarning?: string;
  advice: string[];
}

/**
 * Calculates remaining study workload and pace against target exam date.
 */
export function calculateBacklogAndPace(
  totalTopics: number,
  completedTopics: number,
  targetDateStr: string,
  dailyHoursLimit: number = 6,
  averageHoursPerTopic: number = 2.5,
  currentDateStr?: string
): BacklogMetrics {
  const now = currentDateStr ? new Date(currentDateStr) : new Date();
  const targetDate = new Date(targetDateStr);

  const diffTime = targetDate.getTime() - now.getTime();
  const availableDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

  const remainingTopics = Math.max(0, totalTopics - completedTopics);
  const requiredTopicsPerDay =
    availableDays > 0 ? Number((remainingTopics / availableDays).toFixed(2)) : remainingTopics;

  const estimatedRemainingHours = remainingTopics * averageHoursPerTopic;
  const requiredDailyStudyHours =
    availableDays > 0
      ? Number((estimatedRemainingHours / availableDays).toFixed(1))
      : estimatedRemainingHours;

  const daysNeededAtCurrentLimit =
    dailyHoursLimit > 0 ? Math.ceil(estimatedRemainingHours / dailyHoursLimit) : 999;

  const projectedDate = new Date(now);
  projectedDate.setDate(projectedDate.getDate() + daysNeededAtCurrentLimit);
  const projectedFinishDate = projectedDate.toISOString().split('T')[0];

  const isFeasible = requiredDailyStudyHours <= dailyHoursLimit;
  const workloadDeficitHours = Math.max(
    0,
    Number((estimatedRemainingHours - availableDays * dailyHoursLimit).toFixed(1))
  );

  const advice: string[] = [];
  let feasibilityWarning: string | undefined;

  if (!isFeasible) {
    feasibilityWarning = `Schedule deficit: You need ~${requiredDailyStudyHours}h/day, which exceeds your planned ${dailyHoursLimit}h/day limit by ${workloadDeficitHours} total hours.`;
    advice.push(
      `Increase high-yield focus: prioritize topics with marks weightage >= 5 marks.`
    );
    advice.push(
      `Consider adjusting daily target to ${Math.min(10, Math.ceil(requiredDailyStudyHours))}h/day on weekends.`
    );
    advice.push(
      `Streamline mastery stages: focus on NCERT summary, formula sheet, and RBSE PYQs first.`
    );
  } else {
    advice.push(
      `On track: At your pace of ~${requiredTopicsPerDay} topics/day (~${requiredDailyStudyHours}h/day), you will finish by ${projectedFinishDate}.`
    );
    advice.push(
      `Sufficient buffer remains for full-syllabus mock tests and multiple revision cycles before the board exam.`
    );
  }

  return {
    remainingTopics,
    completedTopics,
    totalTopics,
    availableDays,
    requiredTopicsPerDay,
    estimatedRemainingHours,
    dailyHoursLimit,
    requiredDailyStudyHours,
    projectedFinishDate,
    isFeasible,
    workloadDeficitHours,
    feasibilityWarning,
    advice,
  };
}
