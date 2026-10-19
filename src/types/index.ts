export type VerificationStatus = 'verified_rbse' | 'provisional' | 'user_defined' | 'ai_extracted';

export type MasteryStage =
  | 'theory'
  | 'notes'
  | 'formula_sheet'
  | 'ncert_exercises'
  | 'pyqs'
  | 'revision_1'
  | 'revision_2'
  | 'revision_3'
  | 'test_completed';

export const ALL_MASTERY_STAGES: { id: MasteryStage; label: string; shortLabel: string; applicableSubjects?: string[] }[] = [
  { id: 'theory', label: 'Theory / Lecture Completed', shortLabel: 'Theory' },
  { id: 'notes', label: 'Handwritten Notes Prepared', shortLabel: 'Notes' },
  { id: 'formula_sheet', label: 'Formula / Derivation Sheet', shortLabel: 'Formulas', applicableSubjects: ['physics', 'chemistry', 'mathematics'] },
  { id: 'ncert_exercises', label: 'Textbook / NCERT Exercises', shortLabel: 'NCERT' },
  { id: 'pyqs', label: 'Board PYQs Solved', shortLabel: 'PYQs' },
  { id: 'revision_1', label: 'Revision 1 (Day 1-3)', shortLabel: 'Rev 1' },
  { id: 'revision_2', label: 'Revision 2 (Day 7)', shortLabel: 'Rev 2' },
  { id: 'revision_3', label: 'Revision 3 (Day 15-21)', shortLabel: 'Rev 3' },
  { id: 'test_completed', label: 'Topic / Chapter Test', shortLabel: 'Test' },
];

export type TopicStatus =
  | 'Not Started'
  | 'In Progress'
  | 'Completed'
  | 'Needs Revision'
  | 'On Hold'
  | 'Weak Topic'
  | 'Practice Pending'
  | 'Test Pending';

export type ConfidenceRating = 1 | 2 | 3 | 4 | 5;

export type ConfidenceBand = 'Weak' | 'Needs Practice' | 'Exam Ready';

export function getConfidenceBand(rating: number): ConfidenceBand {
  if (rating <= 2) return 'Weak';
  if (rating <= 3.5) return 'Needs Practice';
  return 'Exam Ready';
}

export interface Subtopic {
  id: string;
  title: string;
  completed?: boolean;
}

export interface Topic {
  id: string;
  chapterId: string;
  unitId: string;
  subjectId: string;
  title: string;
  code?: string;
  subtopics: Subtopic[];
  difficulty: 'Easy' | 'Moderate' | 'Hard';
  estimatedHours?: number;
  personalPriority?: 'high' | 'medium' | 'low';
  prerequisites?: string[]; // IDs of prerequisite topics
  isArchived?: boolean;
  isExcluded?: boolean;
  exclusionReason?: string;
  exclusionSource?: string;
}

export interface Chapter {
  id: string;
  unitId: string;
  subjectId: string;
  number: number;
  title: string;
  officialWeightageMarks?: number;
  isWeightageEstimated?: boolean;
  topics: Topic[];
  isArchived?: boolean;
  isExcluded?: boolean;
  exclusionReason?: string;
  exclusionSource?: string;
}

export interface Unit {
  id: string;
  subjectId: string;
  number: number;
  title: string;
  officialMarks?: number;
  chapters: Chapter[];
  isArchived?: boolean;
}

export interface Subject {
  id: string;
  name: string;
  code: string;
  color: string;
  priority: 'high' | 'medium' | 'low';
  units: Unit[];
  isCustom?: boolean;
}

export interface SyllabusVersion {
  id: string;
  title: string;
  academicSession: string; // "2026-27"
  verificationStatus: VerificationStatus;
  statusLabel: string;
  officialSourceUrl: string;
  lastCheckedDate: string;
  publishedDate?: string;
  isActive: boolean;
  subjects: Subject[];
  excludedItems?: {
    id: string;
    subjectId: string;
    subjectName: string;
    itemTitle: string;
    itemType: 'chapter' | 'topic';
    reason: string;
    source: string;
  }[];
}

export interface TopicMasteryState {
  topicId: string;
  chapterId: string;
  subjectId: string;
  status: TopicStatus;
  confidence: ConfidenceRating;
  isConfidenceRated?: boolean;
  personalPriority?: 'high' | 'medium' | 'low';
  backlogReason?: string;
  completedStages: MasteryStage[];
  customStagesConfig?: MasteryStage[];
  difficulty: 'Easy' | 'Moderate' | 'Hard';
  totalStudyMinutes: number;
  questionsSolved: number;
  questionsCorrect: number;
  notes?: string;
  formulas?: string;
  mistakesHistory?: string[];
  startDate?: string;
  completedDate?: string;
  targetDate?: string;
  nextRevisionDate?: string;
  lastStudiedDate?: string;
  updatedAt: string;
}

export interface SpacedRevisionTask {
  id: string;
  topicId: string;
  chapterId: string;
  subjectId: string;
  topicTitle: string;
  subjectName: string;
  revisionStep: 1 | 2 | 3 | 4;
  scheduledDate: string; // YYYY-MM-DD
  completed: boolean;
  completedDate?: string;
  confidenceScore?: ConfidenceRating;
  recallAccuracy?: 'High' | 'Medium' | 'Low';
  notes?: string;
}

export interface DailyStudyTask {
  id: string;
  date: string; // YYYY-MM-DD
  subjectId: string;
  subjectName: string;
  chapterId: string;
  chapterTitle: string;
  topicId: string;
  topicTitle: string;
  taskType: 'theory' | 'notes' | 'numericals' | 'ncert' | 'pyq' | 'revision' | 'test';
  plannedMinutes: number;
  actualMinutes: number;
  priority: 'high' | 'medium' | 'low';
  energySlot: 'morning_high' | 'afternoon_medium' | 'evening_high' | 'night_review';
  completed: boolean;
  completedAt?: string;
  notes?: string;
}

export interface SubjectResource {
  id: string;
  subjectId: string;
  chapterId: string;
  topicId?: string;
  type: 'formula' | 'derivation' | 'reaction' | 'mistake' | 'note' | 'link' | 'attachment';
  title: string;
  content: string;
  // Specific fields
  symbolsAndUnits?: { symbol: string; name: string; siUnit: string; dimensions?: string }[];
  reactionDetails?: { type: 'physical' | 'organic' | 'inorganic'; reagents: string; conditions: string; mechanismNotes?: string };
  mistakeDetails?: { incorrectAttempt: string; correctConcept: string; whyMade: string; testId?: string };
  mathExerciseDetails?: { exerciseNo: string; questionNo: string; status: 'solved' | 'unsolved' | 'incorrect' | 'repeated' };
  attachmentUrl?: string;
  createdAt: string;
}

export interface MockTestRecord {
  id: string;
  testName: string;
  date: string;
  subjectId: string;
  subjectName: string;
  maxMarks: number;
  marksObtained: number;
  timeTakenMinutes: number;
  chapterPerformance: {
    chapterId: string;
    chapterTitle: string;
    marksScored: number;
    maxMarks: number;
    errorsCount: number;
    flaggedWeakness?: boolean;
  }[];
  mistakes: {
    id: string;
    chapterId: string;
    topicId?: string;
    questionReference: string;
    description: string;
    confidenceImpact: number; // e.g., -1
  }[];
  notes?: string;
}

export interface PYQRecord {
  id: string;
  subjectId: string;
  subjectName: string;
  chapterId: string;
  chapterTitle: string;
  topicId?: string;
  topicTitle?: string;
  questionText: string;
  marks: number;
  examYear: string; // e.g., "2024", "2023", "2022"
  examName?: string; // e.g., "RBSE Annual Board", "JEE Main"
  questionType?: string; // e.g., "Derivation", "Numerical", "Short Answer", "MCQ"
  source: string; // e.g., "RBSE Annual Board Examination Paper Code 12-PHY-A"
  sourceFileName?: string;
  pageNumber?: number;
  questionNumber?: string;
  parentQuestionNumber?: string;
  sectionName?: string;
  isOptionalAlternative?: boolean;
  alternativeToQuestionNumber?: string;
  marksConfidence?: 'high' | 'medium' | 'low';
  mappingConfidence?: number;
  mappingEvidence?: string[];
  correctionHistory?: {
    timestamp: string;
    field: string;
    oldValue: string;
    newValue: string;
  }[];
  verificationStatus: 'verified_rbse' | 'uploaded_pending' | 'ai_practice' | 'student_custom';
  attemptStatus: 'unattempted' | 'correct' | 'incorrect' | 'needs_practice';
  isUnmatched?: boolean;
  solution?: string;
  notes?: string;
}

export type PDFDocumentCategory =
  | 'official_syllabus'
  | 'pyq_paper'
  | 'model_paper'
  | 'exam_blueprint'
  | 'marking_scheme'
  | 'notes_reference';

export type PDFPipelineStage =
  | 'uploaded'
  | 'validated'
  | 'text_extracted'
  | 'questions_segmented'
  | 'marks_parsed'
  | 'topics_mapped'
  | 'reconciled'
  | 'ready_for_review';

export interface MarksReconciliationReport {
  fileName: string;
  detectedExamName: string;
  detectedExamYear: string;
  documentCategory: PDFDocumentCategory;
  officialMaxMarks: number | null;
  compulsoryMarksSum: number;
  optionalAlternativeMarksSum: number;
  unclassifiedMarksSum: number;
  questionsWithMissingMarks: number;
  totalQuestionsExtracted: number;
  compulsoryQuestionsCount: number;
  optionalQuestionsCount: number;
  reconciliationStatus:
    | 'verified_match'
    | 'discrepancy_detected'
    | 'partial_extraction'
    | 'unverified_max_marks';
  discrepancies: string[];
}

export interface UploadedFileMetadata {
  id: string;
  fileName: string;
  fileType: 'syllabus_pdf' | 'pyq_pdf' | 'notes_pdf';
  documentCategory?: PDFDocumentCategory;
  uploadDate: string;
  pageCount: number;
  itemsExtractedCount: number;
  ocrUsed?: boolean;
  targetSubject?: string;
  examYear?: string;
  officialMaxMarks?: number;
  compulsoryMarksExtracted?: number;
  reconciliationStatus?: MarksReconciliationReport['reconciliationStatus'];
  notes?: string;
}

export type AIProviderType = 'auto' | 'gemini' | 'openai' | 'local';

export type AITutorMode =
  | 'concept_teacher'
  | 'guided_tutor'
  | 'board_examiner'
  | 'numerical_solver'
  | 'derivation_coach'
  | 'revision_coach'
  | 'doubt_solver';

export interface AIPersistentRule {
  id: string;
  instruction: string;
  category: 'prioritization' | 'backlog' | 'planner' | 'dashboard' | 'completion' | 'general';
  active: boolean;
  createdAt: string;
}

export interface AIActionProposal {
  id: string;
  type:
    | 'MARK_TOPIC_STATUS'
    | 'MOVE_TASK'
    | 'GENERATE_STUDY_PLAN'
    | 'UPDATE_PREFERENCE'
    | 'SAVE_PERSISTENT_RULE'
    | 'IMPORT_TOPICS'
    | 'PRIORITIZE_BY_PYQ'
    | 'NAVIGATE_FILTER'
    | 'ADD_FORMULA_NOTE'
    | 'SCHEDULE_REVISION';
  title: string;
  description: string;
  payload: any;
  requiresConfirmation?: boolean;
  executed?: boolean;
}

export interface AIChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  providerUsed?: string;
  tutorMode?: AITutorMode;
  actions?: AIActionProposal[];
  matchedTopics?: {
    topicId: string;
    topicTitle: string;
    chapterTitle: string;
    subjectName: string;
    status: TopicStatus;
    priority: string;
  }[];
}

export interface MilestoneItem {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD or empty
  targetMonth?: string; // e.g., "Last week of July", "January"
  academicYear?: string; // e.g., "2026-27" or "2027"
  dateStatus?: 'target' | 'tentative' | 'verified'; // "Personal Target", "Tentative", "Officially Verified"
  subjects: string[];
  targetPercentage?: number;
  isBoardExam?: boolean;
  isCompleted?: boolean;
  isArchived?: boolean;
  notes?: string;
}

export interface UserPreferences {
  targetSession: string; // "2026–27"
  targetYear?: string; // e.g., "2027"
  examTargetDate: string; // "2027-02-14"
  dailyStudyHoursLimit: number; // e.g., 6 hours
  sessionDurationMinutes?: number; // e.g., 60 mins
  dailyBreakMinutes?: number; // e.g., 15 mins
  preferredHighEnergySlot: 'morning' | 'afternoon' | 'evening' | 'night';
  revisionScheduleType: 'default' | 'advanced';
  revisionIntervals?: number[]; // [1, 3, 7, 21, 60]
  autoRescheduleOverdueRevisions?: boolean;
  weakConfidenceThreshold?: number; // default 2
  masteryConfidenceThreshold?: number; // default 4
  requiredCompletionStages?: string[];
  autoCompleteFromStages?: boolean; // default false: do not auto-complete unless user explicitly marks Completed
  alwaysRankByPYQ?: boolean;
  showOnlyHighPriorityOnHome?: boolean;
  statusLabels?: Record<string, string>;
  autoReschedulePlannerTasks?: boolean;
  prioritizeWeakHighYield?: boolean;
  enableStudyReminders?: boolean;
  reminderSound?: boolean;
  subjectPriorities: Record<string, 'high' | 'medium' | 'low'>;
  subjectEstimatedMarks?: Record<string, number>;
  highlightedSubjects?: string[];
  dashboardCardOrder?: string[];
  dashboardCards?: {
    showStudyStreak?: boolean;
    showCountdown?: boolean;
    showRawCompletion?: boolean;
    showWeightedCoverage?: boolean;
    showChaptersStatus?: boolean;
    showRevisionsDue?: boolean;
    showRequiredPace?: boolean;
    showSubjectPriorities?: boolean;
    showTodayTasks?: boolean;
    showWeakTopics?: boolean;
    showBacklogSummary?: boolean;
    showPYQStats?: boolean;
  };
  theme: 'light' | 'dark' | 'system';
  fontSize?: 'compact' | 'normal' | 'comfortable';
  reducedMotion?: boolean;
  bilingualGlossaryEnabled?: boolean;
  pdfAutoDetectUnits?: boolean;
  pdfDefaultDifficulty?: 'Easy' | 'Moderate' | 'Hard';
  aiAssistantEnabled?: boolean;
  aiStrictLocalOnly?: boolean;
  aiProvider?: AIProviderType;
  openaiModel?: string;
  geminiModel?: string;
  enableSearchGrounding?: boolean;
  defaultTutorMode?: AITutorMode;
}

export interface ProgressSummary {
  totalChapters: number;
  completedChapters: number;
  totalTopics: number;
  completedTopics: number;
  inProgressTopics: number;
  weakTopics: number;
  rawCoveragePercentage: number;
  overallCoveragePercentage: number;
  masteryPercentage: number;
  revisionPercentage: number;
  questionAccuracyPercentage: number;
  subjectBreakdown: {
    subjectId: string;
    subjectName: string;
    color: string;
    totalTopics: number;
    completedTopics: number;
    rawCoveragePercentage: number;
    coveragePercentage: number;
    masteryPercentage: number;
    totalMarksWeightage: number;
    completedMarksWeightage: number;
    weakTopicsCount: number;
    priority: 'high' | 'medium' | 'low';
  }[];
}

