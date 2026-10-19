import type {
  Subject,
  TopicMasteryState,
  DailyStudyTask,
  SpacedRevisionTask,
  PYQRecord,
  TopicStatus,
  Subtopic,
} from '../types/index.ts';
import { isTopicCompleted } from './progressCalc.ts';
import { calculateTopicIntelligence, type EvidencePriorityLevel } from './pyqIntelligenceEngine.ts';

export interface BacklogTopicItem {
  topicId: string;
  topicTitle: string;
  topicCode?: string;
  subtopics: Subtopic[];
  chapterId: string;
  chapterNumber: number;
  chapterTitle: string;
  unitId: string;
  unitTitle: string;
  subjectId: string;
  subjectName: string;
  subjectColor: string;
  status: 'Not Started' | 'In Progress' | 'Needs Revision' | 'On Hold';
  isOverdue: boolean;
  overdueDays: number;
  priority: 'high' | 'medium' | 'low';
  pyqPriorityLevel: EvidencePriorityLevel;
  pyqCount: number;
  pyqMarks: number;
  estimatedHours: number;
  remainingMinutes: number;
  loggedMinutes: number;
  confidence: number | null;
  backlogReason: string;
  linkedTaskIds: string[];
  scheduledDate?: string;
}

export interface BacklogChapterGroup {
  chapterId: string;
  chapterNumber: number;
  chapterTitle: string;
  unitId: string;
  unitTitle: string;
  unfinishedTopicsCount: number;
  overdueCount: number;
  totalEstimatedHours: number;
  highestPriority: 'high' | 'medium' | 'low';
  topics: BacklogTopicItem[];
}

export interface BacklogSubjectGroup {
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  subjectColor: string;
  unfinishedTopicsCount: number;
  overdueCount: number;
  totalEstimatedHours: number;
  chapters: BacklogChapterGroup[];
}

export interface BacklogFilterOptions {
  subjectId?: string; // 'all' or specific subjectId (e.g. 'physics')
  chapterId?: string; // 'all' or specific chapterId
  status?: 'all' | 'Not Started' | 'In Progress' | 'Needs Revision' | 'On Hold';
  priority?: 'all' | 'high' | 'medium' | 'low';
  examTargetSubjects?: string[]; // Filter by milestone's subjects
  onlyOverdue?: boolean;
  maxEstimatedHours?: number; // e.g. 2, 4, or undefined
  searchQuery?: string;
}

/**
 * Normalizes any legacy status into the 5 core statuses requested:
 * Not Started, In Progress, Completed, Needs Revision, On Hold
 */
export function normalizeBacklogStatus(
  rawStatus?: TopicStatus
): 'Not Started' | 'In Progress' | 'Completed' | 'Needs Revision' | 'On Hold' {
  if (!rawStatus || rawStatus === 'Not Started') return 'Not Started';
  if (rawStatus === 'Completed') return 'Completed';
  if (rawStatus === 'On Hold') return 'On Hold';
  if (rawStatus === 'Needs Revision' || rawStatus === 'Weak Topic') return 'Needs Revision';
  return 'In Progress';
}

/**
 * Builds the hierarchical Subject -> Chapter -> Topic -> Subtopic backlog structure
 * with explicit backlog reasons, overdue detection, and filter support.
 */
export function buildHierarchicalBacklog(
  subjects: Subject[],
  masteryMap: Record<string, TopicMasteryState>,
  studyTasks: DailyStudyTask[],
  revisionTasks: SpacedRevisionTask[],
  pyqs: PYQRecord[],
  filters: BacklogFilterOptions = {},
  todayStr: string = new Date().toISOString().split('T')[0],
  allowAutoCompleteFromStages = false
): {
  subjectGroups: BacklogSubjectGroup[];
  totalUnfinishedTopics: number;
  totalOverdueTopics: number;
  totalEstimatedHours: number;
  flatTopics: BacklogTopicItem[];
} {
  const intelligenceMap = new Map(
    calculateTopicIntelligence(subjects, pyqs, masteryMap, allowAutoCompleteFromStages).map((i) => [
      i.topicId,
      i,
    ])
  );

  const subjectGroups: BacklogSubjectGroup[] = [];
  const flatTopics: BacklogTopicItem[] = [];
  let totalUnfinishedTopics = 0;
  let totalOverdueTopics = 0;
  let totalEstimatedHours = 0;

  for (const sub of subjects) {
    // Filter by Subject
    if (
      filters.subjectId &&
      filters.subjectId !== 'all' &&
      sub.id.toLowerCase() !== filters.subjectId.toLowerCase() &&
      sub.name.toLowerCase() !== filters.subjectId.toLowerCase()
    ) {
      continue;
    }

    // Filter by Exam Target subjects if specified
    if (filters.examTargetSubjects && filters.examTargetSubjects.length > 0) {
      const matchesExam = filters.examTargetSubjects.some(
        (es) =>
          es.toLowerCase() === sub.name.toLowerCase() ||
          es.toLowerCase() === sub.id.toLowerCase()
      );
      if (!matchesExam) continue;
    }

    const chapterGroups: BacklogChapterGroup[] = [];
    let subUnfinished = 0;
    let subOverdue = 0;
    let subHours = 0;

    for (const unit of sub.units) {
      if (unit.isArchived) continue;
      for (const chap of unit.chapters) {
        if (chap.isArchived || chap.isExcluded) continue;

        if (filters.chapterId && filters.chapterId !== 'all' && chap.id !== filters.chapterId) {
          continue;
        }

        const chapTopics: BacklogTopicItem[] = [];
        let chapOverdue = 0;
        let chapHours = 0;
        let highestPriority: 'high' | 'medium' | 'low' = 'low';

        for (const topic of chap.topics) {
          if (topic.isArchived || topic.isExcluded) continue;

          const m = masteryMap[topic.id];
          const completed = isTopicCompleted(m, allowAutoCompleteFromStages);

          // Completed topics are not in the unfinished backlog unless explicitly marked Needs Revision
          const normStatus = completed ? 'Completed' : normalizeBacklogStatus(m?.status);
          if (normStatus === 'Completed') continue;

          // Check linked planner tasks and revisions for overdue state
          const topicStudyTasks = studyTasks.filter((t) => t.topicId === topic.id && !t.completed);
          const topicRevTasks = revisionTasks.filter((r) => r.topicId === topic.id && !r.completed);

          let isOverdue = false;
          let overdueDays = 0;
          let earliestOverdueDate = '';

          for (const st of topicStudyTasks) {
            if (st.date < todayStr) {
              isOverdue = true;
              if (!earliestOverdueDate || st.date < earliestOverdueDate) {
                earliestOverdueDate = st.date;
              }
            }
          }

          for (const rt of topicRevTasks) {
            if (rt.scheduledDate < todayStr) {
              isOverdue = true;
              if (!earliestOverdueDate || rt.scheduledDate < earliestOverdueDate) {
                earliestOverdueDate = rt.scheduledDate;
              }
            }
          }

          if (m?.targetDate && m.targetDate < todayStr) {
            isOverdue = true;
            if (!earliestOverdueDate || m.targetDate < earliestOverdueDate) {
              earliestOverdueDate = m.targetDate;
            }
          }

          if (isOverdue && earliestOverdueDate) {
            const diffMs =
              new Date(todayStr).getTime() - new Date(earliestOverdueDate).getTime();
            overdueDays = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)));
          }

          const intel = intelligenceMap.get(topic.id);
          const pyqCount = intel?.pyqCount || 0;
          const pyqMarks = intel?.totalPyqMarks || 0;
          const pyqPriorityLevel = intel?.priorityLevel || 'Insufficient PYQ evidence';

          // Determine effective priority
          let priority: 'high' | 'medium' | 'low' =
            m?.personalPriority || topic.personalPriority || sub.priority || 'medium';
          if (pyqPriorityLevel === 'High Priority' || isOverdue || normStatus === 'Needs Revision') {
            priority = 'high';
          }

          // Determine explicit reason this topic is in the backlog
          const reasons: string[] = [];
          if (m?.backlogReason) {
            reasons.push(m.backlogReason);
          }
          if (isOverdue) {
            reasons.push(`Overdue by ${overdueDays} day${overdueDays > 1 ? 's' : ''} (since ${earliestOverdueDate})`);
          }
          if (normStatus === 'Needs Revision') {
            const confText = m?.confidence ? ` (Confidence ${m.confidence}/5)` : '';
            reasons.push(`Flagged for revision${confText}`);
          } else if (normStatus === 'On Hold') {
            reasons.push('Explicitly placed On Hold for later completion');
          } else if (normStatus === 'In Progress') {
            const mins = m?.totalStudyMinutes || 0;
            reasons.push(
              mins > 0 ? `Started (${mins}m logged) — unfinished` : 'In Progress — unfinished'
            );
          } else {
            reasons.push('Unfinished syllabus topic (Not Started)');
          }

          if (pyqCount > 0) {
            reasons.push(`Appeared in ${pyqCount} PYQ${pyqCount > 1 ? 's' : ''}`);
          }

          const estHours = topic.estimatedHours || 2;
          const loggedMins = m?.totalStudyMinutes || 0;
          const remainingMins = Math.max(15, estHours * 60 - loggedMins);

          // Apply filters
          if (filters.status && filters.status !== 'all' && normStatus !== filters.status) {
            continue;
          }
          if (filters.priority && filters.priority !== 'all' && priority !== filters.priority) {
            continue;
          }
          if (filters.onlyOverdue && !isOverdue) {
            continue;
          }
          if (filters.maxEstimatedHours && estHours > filters.maxEstimatedHours) {
            continue;
          }
          if (filters.searchQuery && filters.searchQuery.trim()) {
            const q = filters.searchQuery.toLowerCase().trim();
            const matchTitle =
              topic.title.toLowerCase().includes(q) ||
              chap.title.toLowerCase().includes(q) ||
              sub.name.toLowerCase().includes(q) ||
              topic.subtopics.some((s) => s.title.toLowerCase().includes(q));
            if (!matchTitle) continue;
          }

          const item: BacklogTopicItem = {
            topicId: topic.id,
            topicTitle: topic.title,
            topicCode: topic.code,
            subtopics: topic.subtopics || [],
            chapterId: chap.id,
            chapterNumber: chap.number,
            chapterTitle: chap.title,
            unitId: unit.id,
            unitTitle: unit.title,
            subjectId: sub.id,
            subjectName: sub.name,
            subjectColor: sub.color,
            status: normStatus,
            isOverdue,
            overdueDays,
            priority,
            pyqPriorityLevel,
            pyqCount,
            pyqMarks,
            estimatedHours: estHours,
            remainingMinutes: remainingMins,
            loggedMinutes: loggedMins,
            confidence: m && m.isConfidenceRated !== false ? m.confidence : null,
            backlogReason: reasons.join(' · '),
            linkedTaskIds: topicStudyTasks.map((t) => t.id),
            scheduledDate: topicStudyTasks[0]?.date,
          };

          chapTopics.push(item);
          flatTopics.push(item);

          subUnfinished++;
          totalUnfinishedTopics++;
          chapHours += estHours;
          subHours += estHours;
          totalEstimatedHours += estHours;

          if (isOverdue) {
            chapOverdue++;
            subOverdue++;
            totalOverdueTopics++;
          }
          if (priority === 'high') highestPriority = 'high';
          else if (priority === 'medium' && highestPriority === 'low') highestPriority = 'medium';
        }

        if (chapTopics.length > 0) {
          chapterGroups.push({
            chapterId: chap.id,
            chapterNumber: chap.number,
            chapterTitle: chap.title,
            unitId: unit.id,
            unitTitle: unit.title,
            unfinishedTopicsCount: chapTopics.length,
            overdueCount: chapOverdue,
            totalEstimatedHours: Math.round(chapHours * 10) / 10,
            highestPriority,
            topics: chapTopics,
          });
        }
      }
    }

    if (chapterGroups.length > 0) {
      subjectGroups.push({
        subjectId: sub.id,
        subjectName: sub.name,
        subjectCode: sub.code,
        subjectColor: sub.color,
        unfinishedTopicsCount: subUnfinished,
        overdueCount: subOverdue,
        totalEstimatedHours: Math.round(subHours * 10) / 10,
        chapters: chapterGroups,
      });
    }
  }

  return {
    subjectGroups,
    totalUnfinishedTopics,
    totalOverdueTopics,
    totalEstimatedHours: Math.round(totalEstimatedHours * 10) / 10,
    flatTopics,
  };
}
