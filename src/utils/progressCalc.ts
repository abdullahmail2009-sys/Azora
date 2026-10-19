import type {
  Subject,
  Chapter,
  Topic,
  TopicMasteryState,
  ProgressSummary,
  MasteryStage,
} from '../types/index.ts';
import { ALL_MASTERY_STAGES } from '../types/index.ts';


/**
 * A topic is considered "Completed" in syllabus coverage when:
 * 1. Its status is explicitly 'Completed' OR
 * 2. If allowAutoCompleteFromStages is explicitly enabled, key foundation stages ('theory' + 'notes') are marked done.
 * A chapter is considered completed when ALL active non-excluded topics in it are completed.
 */
export function isTopicCompleted(
  mastery?: TopicMasteryState,
  allowAutoCompleteFromStages = false
): boolean {
  if (!mastery) return false;
  if (mastery.status === 'Completed') return true;
  if (allowAutoCompleteFromStages) {
    return (
      mastery.completedStages.includes('theory') &&
      mastery.completedStages.includes('notes')
    );
  }
  return false;
}

/**
 * Calculates mastery depth percentage for a single topic (0-100%).
 * Evaluates the fraction of configured mastery stages that have been checked off.
 */
export function calculateTopicMasteryPercentage(
  mastery?: TopicMasteryState,
  subjectId?: string
): number {
  if (!mastery || !mastery.completedStages) return 0;
  const applicableStages = ALL_MASTERY_STAGES.filter((s) => {
    if (!s.applicableSubjects) return true;
    return subjectId ? s.applicableSubjects.includes(subjectId.toLowerCase()) : true;
  });

  const totalPossible = applicableStages.length;
  if (totalPossible === 0) return 0;
  const completedCount = mastery.completedStages.filter((stage) =>
    applicableStages.some((as) => as.id === stage)
  ).length;

  return Math.round((completedCount / totalPossible) * 100);
}

/**
 * Calculates progress across subjects, chapters, and topics using
 * official weightage marks when available, or transparent equal weighting by active topic count.
 * Excludes archived and rationalized/excluded topics.
 */
export function calculateOverallProgress(
  subjects: Subject[],
  masteryMap: Record<string, TopicMasteryState>,
  allowAutoCompleteFromStages = false
): ProgressSummary {
  let totalChapters = 0;
  let completedChapters = 0;
  let totalTopics = 0;
  let completedTopics = 0;
  let inProgressTopics = 0;
  let weakTopics = 0;

  let totalActiveWeightedUnits = 0;
  let completedWeightedUnits = 0;

  let totalMasterySum = 0;
  let totalRevisionsCompleted = 0;
  let totalRevisionsTarget = 0;

  let totalQuestionsSolved = 0;
  let totalQuestionsCorrect = 0;

  const subjectBreakdown = subjects.map((subject) => {
    let subTotalTopics = 0;
    let subCompletedTopics = 0;
    let subWeakCount = 0;
    let subTotalWeightage = 0;
    let subCompletedWeightage = 0;
    let subMasterySum = 0;

    subject.units.forEach((unit) => {
      if (unit.isArchived) return;

      unit.chapters.forEach((chapter) => {
        if (chapter.isArchived || chapter.isExcluded) return;

        totalChapters++;
        const activeTopics = chapter.topics.filter(
          (t) => !t.isArchived && !t.isExcluded
        );

        let chapterAllCompleted = activeTopics.length > 0;
        const chapterWeight = chapter.officialWeightageMarks && chapter.officialWeightageMarks > 0
          ? chapter.officialWeightageMarks
          : activeTopics.length; // fallback equal topic weighting

        subTotalWeightage += chapterWeight;
        totalActiveWeightedUnits += chapterWeight;

        let chapterCompletedTopicsCount = 0;

        activeTopics.forEach((topic) => {
          totalTopics++;
          subTotalTopics++;
          const m = masteryMap[topic.id];

          const isComp = isTopicCompleted(m, allowAutoCompleteFromStages);
          if (isComp) {
            completedTopics++;
            subCompletedTopics++;
            chapterCompletedTopicsCount++;
          } else if (m && m.status !== 'Not Started') {
            inProgressTopics++;
            chapterAllCompleted = false;
          } else {
            chapterAllCompleted = false;
          }

          if (m) {
            if (m.confidence <= 2 || m.status === 'Weak Topic') {
              weakTopics++;
              subWeakCount++;
            }
            const masteryScore = calculateTopicMasteryPercentage(m, subject.id);
            subMasterySum += masteryScore;
            totalMasterySum += masteryScore;

            if (m.questionsSolved > 0) {
              totalQuestionsSolved += m.questionsSolved;
              totalQuestionsCorrect += m.questionsCorrect;
            }

            // Spaced revision targets
            totalRevisionsTarget += 3;
            if (m.completedStages.includes('revision_1')) totalRevisionsCompleted++;
            if (m.completedStages.includes('revision_2')) totalRevisionsCompleted++;
            if (m.completedStages.includes('revision_3')) totalRevisionsCompleted++;
          } else {
            totalRevisionsTarget += 3;
          }
        });

        if (chapterAllCompleted && activeTopics.length > 0) {
          completedChapters++;
          subCompletedWeightage += chapterWeight;
          completedWeightedUnits += chapterWeight;
        } else if (activeTopics.length > 0) {
          // Partial chapter weighted credit proportional to topic completion
          const partial = (chapterCompletedTopicsCount / activeTopics.length) * chapterWeight;
          subCompletedWeightage += partial;
          completedWeightedUnits += partial;
        }
      });
    });

    const rawCoveragePercentage =
      subTotalTopics > 0 ? Math.round((subCompletedTopics / subTotalTopics) * 100) : 0;
    const coveragePercentage =
      subTotalWeightage > 0
        ? Math.round((subCompletedWeightage / subTotalWeightage) * 100)
        : rawCoveragePercentage;
    const masteryPercentage =
      subTotalTopics > 0 ? Math.round(subMasterySum / subTotalTopics) : 0;

    return {
      subjectId: subject.id,
      subjectName: subject.name,
      color: subject.color,
      totalTopics: subTotalTopics,
      completedTopics: subCompletedTopics,
      rawCoveragePercentage,
      coveragePercentage,
      masteryPercentage,
      totalMarksWeightage: subTotalWeightage,
      completedMarksWeightage: Math.round(subCompletedWeightage * 10) / 10,
      weakTopicsCount: subWeakCount,
      priority: subject.priority || 'medium',
    };
  });

  const rawCoveragePercentage =
    totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0;

  const overallCoveragePercentage =
    totalActiveWeightedUnits > 0
      ? Math.round((completedWeightedUnits / totalActiveWeightedUnits) * 100)
      : rawCoveragePercentage;

  const masteryPercentage =
    totalTopics > 0 ? Math.round(totalMasterySum / totalTopics) : 0;

  const revisionPercentage =
    totalRevisionsTarget > 0
      ? Math.round((totalRevisionsCompleted / totalRevisionsTarget) * 100)
      : 0;

  const questionAccuracyPercentage =
    totalQuestionsSolved > 0
      ? Math.round((totalQuestionsCorrect / totalQuestionsSolved) * 100)
      : 0;

  return {
    totalChapters,
    completedChapters,
    totalTopics,
    completedTopics,
    inProgressTopics,
    weakTopics,
    rawCoveragePercentage,
    overallCoveragePercentage,
    masteryPercentage,
    revisionPercentage,
    questionAccuracyPercentage,
    subjectBreakdown,
  };
}
