import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import {
  SyllabusVersion,
  Subject,
  Unit,
  Chapter,
  Topic,
  TopicMasteryState,
  SpacedRevisionTask,
  DailyStudyTask,
  SubjectResource,
  MockTestRecord,
  PYQRecord,
  MilestoneItem,
  UserPreferences,
  MasteryStage,
  ConfidenceRating,
  TopicStatus,
  ProgressSummary,
  UploadedFileMetadata,
  AIPersistentRule,
  AIChatMessage,
  AIActionProposal,
} from '../types/index.ts';
import { OFFICIAL_RBSE_2026_27_SYLLABUS } from '../data/defaultSyllabus.ts';
import {
  DEFAULT_PHYSICS_RESOURCES,
  DEFAULT_CHEMISTRY_RESOURCES,
  DEFAULT_MATH_RESOURCES,
} from '../data/defaultSubjectTools.ts';
import { DEFAULT_PYQS } from '../data/defaultPYQs.ts';
import { calculateOverallProgress } from '../utils/progressCalc.ts';
import { calculateStudyStreak, StudyStreakSummary } from '../utils/streakCalc.ts';
import { mergeParsedSyllabusIntoActive, ParsedSubjectPreview } from '../utils/pdfSyllabusParser.ts';
import {
  auth,
  db,
  signInWithGoogle as fbSignIn,
  checkGoogleRedirectResult,
  signOutUser as fbSignOut,
  OperationType,
  handleFirestoreError,
} from '../services/firebase.ts';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';

interface AppContextType {
  activeSyllabus: SyllabusVersion;
  masteryMap: Record<string, TopicMasteryState>;
  revisionTasks: SpacedRevisionTask[];
  studyTasks: DailyStudyTask[];
  resources: SubjectResource[];
  mockTests: MockTestRecord[];
  pyqs: PYQRecord[];
  milestones: MilestoneItem[];
  preferences: UserPreferences;
  uploadedFilesMetadata: UploadedFileMetadata[];
  aiPersistentRules: AIPersistentRule[];
  aiChatHistory: AIChatMessage[];
  backlogFilterState: { subjectId: string; chapterId: string };
  setBacklogFilterState: React.Dispatch<React.SetStateAction<{ subjectId: string; chapterId: string }>>;
  currentUser: FirebaseUser | null;
  syncState: 'synced' | 'syncing' | 'offline_local' | 'error';
  lastSyncTime: string | null;
  progressSummary: ProgressSummary;
  studyStreak: StudyStreakSummary;
  // Actions
  updateTopicMastery: (topicId: string, partial: Partial<TopicMasteryState>) => void;
  bulkUpdateChapterTopics: (chapterId: string, partial: Partial<TopicMasteryState>) => void;
  toggleMasteryStage: (topicId: string, stage: MasteryStage) => void;
  addRevisionTask: (task: SpacedRevisionTask) => void;
  completeRevisionTask: (taskId: string, confidence: ConfidenceRating, recall: 'High' | 'Medium' | 'Low') => void;
  addStudyTask: (task: Omit<DailyStudyTask, 'id'>) => void;
  updateStudyTask: (taskId: string, partial: Partial<DailyStudyTask>) => void;
  toggleStudyTask: (taskId: string) => void;
  deleteStudyTask: (taskId: string) => void;
  addResource: (resource: Omit<SubjectResource, 'id' | 'createdAt'>) => void;
  deleteResource: (id: string) => void;
  addMockTest: (test: Omit<MockTestRecord, 'id'>) => void;
  updatePYQAttempt: (id: string, status: 'correct' | 'incorrect' | 'needs_practice') => void;
  addPYQ: (pyq: Omit<PYQRecord, 'id'>) => void;
  bulkAddPYQs: (newPyqs: Omit<PYQRecord, 'id'>[]) => number;
  updatePYQ: (id: string, partial: Partial<PYQRecord>) => void;
  deletePYQ: (id: string) => void;
  addUploadedFileMetadata: (meta: Omit<UploadedFileMetadata, 'id' | 'uploadDate'>) => void;
  deleteUploadedFileMetadata: (id: string) => void;
  addAIPersistentRule: (instruction: string, category?: AIPersistentRule['category']) => void;
  toggleAIPersistentRule: (id: string) => void;
  deleteAIPersistentRule: (id: string) => void;
  addAIChatMessage: (msg: AIChatMessage) => void;
  clearAIChatHistory: () => void;
  executeAIAction: (action: AIActionProposal, onNavigate?: (tab: string) => void) => string;
  addMilestone: (milestone: Omit<MilestoneItem, 'id'>) => void;
  updateMilestone: (id: string, partial: Partial<MilestoneItem>) => void;
  deleteMilestone: (id: string) => void;
  toggleMilestone: (id: string) => void;
  archiveMilestone: (id: string) => void;
  updatePreferences: (partial: Partial<UserPreferences>) => void;
  importSyllabusVersion: (newVersion: SyllabusVersion) => void;
  mergeImportedSyllabus: (parsedSubjects: any[]) => {
    subjects: number;
    units: number;
    chapters: number;
    topics: number;
  };
  clearDefaultSyllabus: () => void;
  addSubject: (subject: Omit<Subject, 'id'>) => void;
  updateSubject: (id: string, partial: Partial<Subject>) => void;
  deleteSubject: (id: string) => void;
  reorderSubjects: (subjects: Subject[]) => void;
  addUnit: (subjectId: string, unit: Omit<Unit, 'id' | 'subjectId'>) => void;
  updateUnit: (subjectId: string, unitId: string, partial: Partial<Unit>) => void;
  deleteUnit: (subjectId: string, unitId: string) => void;
  addChapter: (subjectId: string, unitId: string, chapter: Omit<Chapter, 'id' | 'unitId' | 'subjectId'>) => void;
  updateChapter: (subjectId: string, unitId: string, chapterId: string, partial: Partial<Chapter>) => void;
  deleteChapter: (subjectId: string, unitId: string, chapterId: string) => void;
  addTopic: (subjectId: string, unitId: string, chapterId: string, topic: Omit<Topic, 'id' | 'chapterId' | 'unitId' | 'subjectId'>) => void;
  updateTopic: (subjectId: string, unitId: string, chapterId: string, topicId: string, partial: Partial<Topic>) => void;
  deleteTopic: (subjectId: string, unitId: string, chapterId: string, topicId: string) => void;
  resetAllData: () => void;
  loginGoogle: () => Promise<void>;
  logoutUser: () => Promise<void>;
  exportJSON: () => void;
  importJSON: (jsonString: string) => boolean;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY = 'mystudypath_rbse12_state_v1';

const DEFAULT_PREFERENCES: UserPreferences = {
  targetSession: '2026–27',
  targetYear: '2027',
  examTargetDate: '2027-02-14',
  dailyStudyHoursLimit: 6,
  sessionDurationMinutes: 60,
  dailyBreakMinutes: 15,
  preferredHighEnergySlot: 'morning',
  revisionScheduleType: 'default',
  revisionIntervals: [1, 3, 7, 21],
  autoRescheduleOverdueRevisions: true,
  weakConfidenceThreshold: 2,
  masteryConfidenceThreshold: 4,
  autoCompleteFromStages: false,
  alwaysRankByPYQ: true,
  showOnlyHighPriorityOnHome: false,
  statusLabels: {
    'Not Started': 'Not Started',
    'In Progress': 'In Progress',
    Completed: 'Completed',
    'Needs Revision': 'Needs Revision',
    'On Hold': 'On Hold',
  },
  autoReschedulePlannerTasks: true,
  prioritizeWeakHighYield: true,
  enableStudyReminders: true,
  reminderSound: false,
  subjectPriorities: {
    physics: 'high',
    chemistry: 'high',
    mathematics: 'high',
    english: 'medium',
    hindi: 'medium',
  },
  dashboardCardOrder: [
    'overall_progress',
    'subject_progress',
    'priority_unfinished',
    'backlog_overview',
    'study_next',
    'exam_targets',
  ],
  dashboardCards: {
    showCountdown: true,
    showRawCompletion: true,
    showWeightedCoverage: true,
    showChaptersStatus: true,
    showRevisionsDue: true,
    showRequiredPace: true,
    showSubjectPriorities: true,
    showTodayTasks: true,
    showWeakTopics: true,
    showBacklogSummary: true,
    showPYQStats: true,
  },
  theme: 'light',
  fontSize: 'normal',
  reducedMotion: false,
  bilingualGlossaryEnabled: true,
  pdfAutoDetectUnits: true,
  pdfDefaultDifficulty: 'Moderate',
  aiAssistantEnabled: true,
  aiStrictLocalOnly: false,
  aiProvider: 'auto',
  openaiModel: 'gpt-4o-mini',
  geminiModel: 'gemini-3.8-flash',
  defaultTutorMode: 'concept_teacher',
};

const DEFAULT_MILESTONES: MilestoneItem[] = [
  {
    id: 'mile-half-yearly',
    title: 'Half-Yearly Examination',
    date: '2026-12-10',
    targetMonth: 'December 2026',
    academicYear: '2026–27',
    dateStatus: 'target',
    subjects: ['Physics', 'Chemistry', 'Mathematics', 'English', 'Hindi'],
    targetPercentage: 85,
    isCompleted: false,
    notes: 'Personal target for school half-yearly exams (date editable)',
  },
  {
    id: 'mile-unit-test-3',
    title: 'Third Unit Test / Third Periodic Test',
    date: '2027-01-14',
    targetMonth: 'January 2027',
    academicYear: '2026–27',
    dateStatus: 'target',
    subjects: ['Physics', 'Chemistry', 'Mathematics', 'English', 'Hindi'],
    targetPercentage: 90,
    isCompleted: false,
    notes: 'Target date around January 14 (editable periodic test)',
  },
  {
    id: 'mile-jee-main-1',
    title: 'JEE Main Session 1',
    date: '2027-01-21',
    targetMonth: 'January 2027',
    academicYear: '2027',
    dateStatus: 'target',
    subjects: ['Physics', 'Chemistry', 'Mathematics'],
    targetPercentage: 95,
    isCompleted: false,
    notes: 'National entrance target date around January 21',
  },
  {
    id: 'mile-annual-board',
    title: 'Annual Board Examination',
    date: '2027-02-14',
    targetMonth: 'February 2027',
    academicYear: '2026–27',
    dateStatus: 'target',
    subjects: ['Physics', 'Chemistry', 'Mathematics', 'English', 'Hindi'],
    targetPercentage: 95,
    isBoardExam: true,
    isCompleted: false,
    notes: 'Target date around February 14 (Personal planning target, not official)',
  },
  {
    id: 'mile-jee-main-2',
    title: 'JEE Main Session 2',
    date: '2027-04-20',
    targetMonth: 'April 2027',
    academicYear: '2027',
    dateStatus: 'target',
    subjects: ['Physics', 'Chemistry', 'Mathematics'],
    targetPercentage: 95,
    isCompleted: false,
    notes: 'Target date around April 20',
  },
  {
    id: 'mile-jee-advanced',
    title: 'JEE Advanced',
    date: '', // Unset exact calendar date
    targetMonth: 'Last week of May 2027',
    academicYear: '2027',
    dateStatus: 'target',
    subjects: ['Physics', 'Chemistry', 'Mathematics'],
    targetPercentage: 90,
    isCompleted: false,
    notes: 'Target period: May/June 2027 (exact date unset)',
  },
];

// Seed starter progress for realistic testability
function getInitialMasteryMap(): Record<string, TopicMasteryState> {
  const map: Record<string, TopicMasteryState> = {};
  const relDate = (offsetDays: number): string => {
    const dt = new Date();
    dt.setDate(dt.getDate() + offsetDays);
    return dt.toISOString().split('T')[0];
  };

  // Starter completed topics for Electrostatics
  map['phy-c1-t1'] = {
    topicId: 'phy-c1-t1',
    chapterId: 'phy-c1',
    subjectId: 'physics',
    status: 'Completed',
    confidence: 4,
    completedStages: ['theory', 'notes', 'formula_sheet', 'ncert_exercises', 'pyqs', 'revision_1'],
    difficulty: 'Easy',
    totalStudyMinutes: 90,
    questionsSolved: 15,
    questionsCorrect: 13,
    startDate: relDate(-6),
    completedDate: relDate(-5),
    lastStudiedDate: relDate(-3),
    updatedAt: new Date().toISOString(),
  };

  map['phy-c1-t2'] = {
    topicId: 'phy-c1-t2',
    chapterId: 'phy-c1',
    subjectId: 'physics',
    status: 'Completed',
    confidence: 5,
    completedStages: ['theory', 'notes', 'formula_sheet', 'ncert_exercises', 'pyqs', 'revision_1', 'revision_2'],
    difficulty: 'Moderate',
    totalStudyMinutes: 150,
    questionsSolved: 20,
    questionsCorrect: 19,
    startDate: relDate(-5),
    completedDate: relDate(-3),
    lastStudiedDate: relDate(-2),
    updatedAt: new Date().toISOString(),
  };

  map['phy-c1-t3'] = {
    topicId: 'phy-c1-t3',
    chapterId: 'phy-c1',
    subjectId: 'physics',
    status: 'In Progress',
    confidence: 3,
    completedStages: ['theory', 'notes'],
    difficulty: 'Moderate',
    totalStudyMinutes: 80,
    questionsSolved: 8,
    questionsCorrect: 6,
    startDate: relDate(-2),
    lastStudiedDate: relDate(-1),
    updatedAt: new Date().toISOString(),
  };

  map['che-c1-t1'] = {
    topicId: 'che-c1-t1',
    chapterId: 'che-c1',
    subjectId: 'chemistry',
    status: 'Completed',
    confidence: 4,
    completedStages: ['theory', 'notes', 'formula_sheet', 'ncert_exercises', 'pyqs'],
    difficulty: 'Moderate',
    totalStudyMinutes: 110,
    questionsSolved: 14,
    questionsCorrect: 12,
    startDate: relDate(-5),
    completedDate: relDate(-4),
    lastStudiedDate: relDate(-2),
    updatedAt: new Date().toISOString(),
  };

  map['math-c1-t1'] = {
    topicId: 'math-c1-t1',
    chapterId: 'math-c1',
    subjectId: 'mathematics',
    status: 'Completed',
    confidence: 5,
    completedStages: ['theory', 'notes', 'ncert_exercises', 'pyqs', 'revision_1'],
    difficulty: 'Moderate',
    totalStudyMinutes: 120,
    questionsSolved: 25,
    questionsCorrect: 23,
    startDate: relDate(-6),
    completedDate: relDate(-4),
    lastStudiedDate: relDate(-1),
    updatedAt: new Date().toISOString(),
  };

  return map;
}

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [syncState, setSyncState] = useState<'synced' | 'syncing' | 'offline_local' | 'error'>('offline_local');
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);

  // Core state collections
  const [activeSyllabus, setActiveSyllabus] = useState<SyllabusVersion>(OFFICIAL_RBSE_2026_27_SYLLABUS);
  const [masteryMap, setMasteryMap] = useState<Record<string, TopicMasteryState>>(getInitialMasteryMap);
  const [revisionTasks, setRevisionTasks] = useState<SpacedRevisionTask[]>([
    {
      id: 'rev-seed-1',
      topicId: 'phy-c1-t2',
      chapterId: 'phy-c1',
      subjectId: 'physics',
      topicTitle: "Coulomb's Law & Superposition Principle",
      subjectName: 'Physics',
      revisionStep: 3,
      scheduledDate: new Date().toISOString().split('T')[0], // Due today!
      completed: false,
    },
    {
      id: 'rev-seed-2',
      topicId: 'che-c1-t1',
      chapterId: 'che-c1',
      subjectId: 'chemistry',
      topicTitle: "Henry's Law & Raoult's Law",
      subjectName: 'Chemistry',
      revisionStep: 1,
      scheduledDate: new Date().toISOString().split('T')[0], // Due today!
      completed: false,
    },
  ]);

  const [studyTasks, setStudyTasks] = useState<DailyStudyTask[]>([
    {
      id: 'task-seed-1',
      date: new Date().toISOString().split('T')[0],
      subjectId: 'physics',
      subjectName: 'Physics',
      chapterId: 'phy-c1',
      chapterTitle: 'Electric Charges and Fields',
      topicId: 'phy-c1-t3',
      topicTitle: 'Electric Field Lines & Electric Dipole',
      taskType: 'numericals',
      plannedMinutes: 60,
      actualMinutes: 45,
      priority: 'high',
      energySlot: 'morning_high',
      completed: false,
      notes: 'Solve NCERT Ex 1.8 to 1.12 dipole torque problems',
    },
    {
      id: 'task-seed-2',
      date: new Date().toISOString().split('T')[0],
      subjectId: 'mathematics',
      subjectName: 'Mathematics',
      chapterId: 'math-c1',
      chapterTitle: 'Relations and Functions',
      topicId: 'math-c1-t2',
      topicTitle: 'One-One (Injective) & Onto (Surjective) Functions',
      taskType: 'ncert',
      plannedMinutes: 75,
      actualMinutes: 0,
      priority: 'high',
      energySlot: 'evening_high',
      completed: false,
      notes: 'Practice Ex 1.2 Q1 to Q8 with injectivity proofs',
    },
  ]);

  const [resources, setResources] = useState<SubjectResource[]>([
    ...DEFAULT_PHYSICS_RESOURCES,
    ...DEFAULT_CHEMISTRY_RESOURCES,
    ...DEFAULT_MATH_RESOURCES,
  ]);

  const [mockTests, setMockTests] = useState<MockTestRecord[]>([
    {
      id: 'test-seed-1',
      testName: 'Physics Unit 1 Chapter Test (Electrostatics)',
      date: '2026-10-15',
      subjectId: 'physics',
      subjectName: 'Physics',
      maxMarks: 25,
      marksObtained: 21,
      timeTakenMinutes: 60,
      chapterPerformance: [
        {
          chapterId: 'phy-c1',
          chapterTitle: 'Electric Charges and Fields',
          marksScored: 21,
          maxMarks: 25,
          errorsCount: 1,
          flaggedWeakness: false,
        },
      ],
      mistakes: [
        {
          id: 'mistake-seed-1',
          chapterId: 'phy-c1',
          topicId: 'phy-c1-t3',
          questionReference: 'Q4 (Dipole in uniform field)',
          description: 'Forgot factor of sin(theta) when calculating potential energy U = -p.E',
          confidenceImpact: -1,
        },
      ],
      notes: 'Strong in Gauss Law derivations; need careful vector algebra on dipole torque and potential energy.',
    },
  ]);

  const [pyqs, setPyqs] = useState<PYQRecord[]>(DEFAULT_PYQS);
  const [milestones, setMilestones] = useState<MilestoneItem[]>(DEFAULT_MILESTONES);
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [uploadedFilesMetadata, setUploadedFilesMetadata] = useState<UploadedFileMetadata[]>([]);
  const [aiPersistentRules, setAiPersistentRules] = useState<AIPersistentRule[]>([
    {
      id: 'rule-seed-1',
      instruction: 'Always rank my topics using uploaded PYQs.',
      category: 'prioritization',
      active: true,
      createdAt: '2026-10-18T00:00:00.000Z',
    },
    {
      id: 'rule-seed-2',
      instruction: 'Show backlog grouped by subject and chapter.',
      category: 'backlog',
      active: true,
      createdAt: '2026-10-18T00:00:00.000Z',
    },
    {
      id: 'rule-seed-3',
      instruction: 'Do not mark topics complete automatically.',
      category: 'completion',
      active: true,
      createdAt: '2026-10-18T00:00:00.000Z',
    },
  ]);
  const [aiChatHistory, setAiChatHistory] = useState<AIChatMessage[]>([
    {
      id: 'msg-welcome',
      role: 'assistant',
      content:
        'Welcome to your Personal AI Study Assistant! I have live, authenticated access to your syllabus, PYQ intelligence rankings, backlog, study planner, and preferences. Tell me what to show, plan, prioritize, or edit — for example: *"Show my Physics backlog"*, *"Mark Electric Field Lines as completed"*, or *"Create a 7-day plan using my available study hours"*.',
      timestamp: new Date().toISOString(),
    },
  ]);
  const [backlogFilterState, setBacklogFilterState] = useState<{ subjectId: string; chapterId: string }>({
    subjectId: 'all',
    chapterId: 'all',
  });

  // Apply theme & font size globally to document (AZORA uses bright, student-friendly warm-cream light theme)
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('dark');
    if (preferences.fontSize === 'compact') {
      root.style.fontSize = '14px';
    } else if (preferences.fontSize === 'comfortable') {
      root.style.fontSize = '17px';
    } else {
      root.style.fontSize = '16px';
    }
  }, [preferences.theme, preferences.fontSize]);

  // Load state from LocalStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        if (data.activeSyllabus) {
          setActiveSyllabus({
            ...data.activeSyllabus,
            academicSession: '2026–27',
            title: data.activeSyllabus.title?.replace(/2027[–-]28/g, '2026–27') || 'RBSE Class 12 Core Academic Syllabus (Session 2026–27)',
          });
        }
        if (data.masteryMap) setMasteryMap(data.masteryMap);
        if (data.revisionTasks) setRevisionTasks(data.revisionTasks);
        if (data.studyTasks) setStudyTasks(data.studyTasks);
        if (data.resources) setResources(data.resources);
        if (data.mockTests) setMockTests(data.mockTests);
        if (data.pyqs) setPyqs(data.pyqs);
        if (data.milestones) {
          const hasStaleMilestone =
            Array.isArray(data.milestones) &&
            data.milestones.some((m: any) => (m.id === 'mile-1' && m.date === '2027-09-20') || m.academicYear === '2027–28' || m.date?.startsWith('2028'));
          if (hasStaleMilestone || data.milestones.length === 0) {
            setMilestones(DEFAULT_MILESTONES);
          } else {
            setMilestones(data.milestones);
          }
        }
        if (data.preferences) {
          const rawGem = data.preferences.geminiModel;
          const validGem =
            !rawGem || rawGem === 'gemini-2.5-flash' || rawGem === 'gemini-1.5-flash'
              ? 'gemini-3.8-flash'
              : rawGem;
          setPreferences((prev) => ({
            ...prev,
            ...data.preferences,
            geminiModel: validGem,
            targetSession: '2026–27',
            targetYear: '2027',
            theme: 'light',
            aiProvider: data.preferences.aiProvider || 'auto',
            aiStrictLocalOnly:
              data.preferences.aiProvider ? Boolean(data.preferences.aiStrictLocalOnly) : false,
          }));
        }
        if (data.uploadedFilesMetadata) setUploadedFilesMetadata(data.uploadedFilesMetadata);
        if (data.aiPersistentRules) setAiPersistentRules(data.aiPersistentRules);
        if (data.aiChatHistory) setAiChatHistory(data.aiChatHistory);
        if (data.lastSyncTime) setLastSyncTime(data.lastSyncTime);
      }
    } catch (e) {
      console.warn('Could not read from local storage:', e);
    }
  }, []);

  // Save to LocalStorage whenever key state changes
  useEffect(() => {
    try {
      const payload = {
        activeSyllabus,
        masteryMap,
        revisionTasks,
        studyTasks,
        resources,
        mockTests,
        pyqs,
        milestones,
        preferences,
        uploadedFilesMetadata,
        aiPersistentRules,
        aiChatHistory,
        lastSyncTime,
      };
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(payload));
    } catch (e) {
      console.error('Failed to write to local storage:', e);
    }
  }, [
    activeSyllabus,
    masteryMap,
    revisionTasks,
    studyTasks,
    resources,
    mockTests,
    pyqs,
    milestones,
    preferences,
    uploadedFilesMetadata,
    aiPersistentRules,
    aiChatHistory,
    lastSyncTime,
  ]);

  // Auth listener & Firestore synchronization
  useEffect(() => {
    // Complete any pending Android WebView OAuth redirect once on mount;
    // onAuthStateChanged below will handle the resulting authenticated user state.
    checkGoogleRedirectResult().catch(() => {});

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        setSyncState('syncing');
        try {
          const userDocRef = doc(db, 'users', user.uid);
          let snap;
          try {
            snap = await getDoc(userDocRef);
          } catch (getErr: any) {
            if (getErr?.code === 'permission-denied' || getErr?.message?.includes('permission')) {
              handleFirestoreError(getErr, OperationType.GET, `users/${user.uid}`);
            }
            throw getErr;
          }

          if (snap && snap.exists()) {
            const cloudData = snap.data();
            if (cloudData.masteryMap) setMasteryMap((prev) => ({ ...prev, ...cloudData.masteryMap }));
            if (cloudData.preferences) {
              const rawGem = cloudData.preferences.geminiModel;
              const validGem =
                !rawGem || rawGem === 'gemini-2.5-flash' || rawGem === 'gemini-1.5-flash'
                  ? 'gemini-3.8-flash'
                  : rawGem;
              setPreferences((prev) => ({
                ...prev,
                ...cloudData.preferences,
                geminiModel: validGem,
                theme: 'light',
              }));
            }
            if (cloudData.activeSyllabus) setActiveSyllabus(cloudData.activeSyllabus);
            if (cloudData.studyTasks) setStudyTasks(cloudData.studyTasks);
            if (cloudData.revisionTasks) setRevisionTasks(cloudData.revisionTasks);
            if (cloudData.resources) setResources(cloudData.resources);
            if (cloudData.mockTests) setMockTests(cloudData.mockTests);
            if (cloudData.pyqs) setPyqs(cloudData.pyqs);
            if (cloudData.milestones) setMilestones(cloudData.milestones);
            if (cloudData.uploadedFilesMetadata) setUploadedFilesMetadata(cloudData.uploadedFilesMetadata);
            if (cloudData.aiPersistentRules) setAiPersistentRules(cloudData.aiPersistentRules);
            if (cloudData.aiChatHistory) setAiChatHistory(cloudData.aiChatHistory);
          } else {
            // First time sync to Firestore: persist full local state so no categories are lost
            try {
              await setDoc(
                userDocRef,
                {
                  uid: user.uid,
                  email: user.email,
                  displayName: user.displayName,
                  academicSession: preferences.targetSession || '2026–27',
                  examTargetDate: preferences.examTargetDate || '2027-02-14',
                  dailyTargetHours: preferences.dailyStudyHoursLimit || 6,
                  revisionScheduleType: preferences.revisionScheduleType || 'default',
                  highEnergyTime: preferences.preferredHighEnergySlot || 'morning',
                  masteryMap,
                  preferences,
                  activeSyllabus,
                  studyTasks,
                  revisionTasks,
                  resources,
                  mockTests,
                  pyqs,
                  milestones,
                  uploadedFilesMetadata,
                  aiPersistentRules,
                  aiChatHistory,
                  updatedAt: new Date().toISOString(),
                },
                { merge: true }
              );
            } catch (setErr: any) {
              if (setErr?.code === 'permission-denied' || setErr?.message?.includes('permission')) {
                handleFirestoreError(setErr, OperationType.WRITE, `users/${user.uid}`);
              }
              throw setErr;
            }
          }
          const nowStr = new Date().toLocaleTimeString();
          setLastSyncTime(nowStr);
          setSyncState('synced');
        } catch (err) {
          console.error('Firestore sync error:', err);
          setSyncState('offline_local');
        }
      } else {
        setSyncState('offline_local');
      }
    });

    return () => unsubscribe();
  }, []);

  // Debounced cloud synchronization when logged in
  useEffect(() => {
    if (!currentUser || syncState === 'syncing') return;
    const timer = setTimeout(async () => {
      try {
        const userDocRef = doc(db, 'users', currentUser.uid);
        await setDoc(
          userDocRef,
          {
            masteryMap,
            preferences,
            activeSyllabus,
            studyTasks,
            revisionTasks,
            resources,
            mockTests,
            pyqs,
            milestones,
            uploadedFilesMetadata,
            aiPersistentRules,
            aiChatHistory,
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
        setLastSyncTime(new Date().toLocaleTimeString());
        setSyncState('synced');
      } catch (err: any) {
        console.warn('Background Firestore sync paused, local changes safe:', err);
      }
    }, 1200);

    return () => clearTimeout(timer);
  }, [
    currentUser,
    masteryMap,
    preferences,
    activeSyllabus,
    studyTasks,
    revisionTasks,
    resources,
    mockTests,
    pyqs,
    milestones,
    uploadedFilesMetadata,
    aiPersistentRules,
    aiChatHistory,
  ]);

  // Calculate overall progress summary using reactive data
  const progressSummary = useMemo(() => {
    return calculateOverallProgress(
      activeSyllabus.subjects,
      masteryMap,
      Boolean(preferences.autoCompleteFromStages)
    );
  }, [activeSyllabus, masteryMap, preferences.autoCompleteFromStages]);

  // Calculate consecutive daily study streak using reactive AppContext data
  const studyStreak = useMemo(() => {
    return calculateStudyStreak({
      masteryMap,
      studyTasks,
      revisionTasks,
      mockTests,
      subjects: activeSyllabus.subjects,
    });
  }, [masteryMap, studyTasks, revisionTasks, mockTests, activeSyllabus.subjects]);

  // Actions
  const updateTopicMastery = useCallback(
    (topicId: string, partial: Partial<TopicMasteryState>) => {
      setMasteryMap((prev) => {
        const existing = prev[topicId] || {
          topicId,
          chapterId: '',
          subjectId: '',
          status: 'Not Started',
          confidence: 3,
          isConfidenceRated: false,
          completedStages: [],
          difficulty: 'Moderate',
          totalStudyMinutes: 0,
          questionsSolved: 0,
          questionsCorrect: 0,
          updatedAt: new Date().toISOString(),
        };
        const isConfidenceRated =
          partial.confidence !== undefined ? true : existing.isConfidenceRated;
        const todayStr = new Date().toISOString().split('T')[0];
        let nextRevDate = partial.nextRevisionDate ?? existing.nextRevisionDate;

        if (partial.status === 'Completed' && !nextRevDate) {
          const baseDays = preferences.revisionIntervals?.[0] || 3;
          const d = new Date();
          d.setDate(d.getDate() + baseDays);
          nextRevDate = d.toISOString().split('T')[0];
        }

        const updated: TopicMasteryState = {
          ...existing,
          ...partial,
          isConfidenceRated,
          completedDate:
            partial.status === 'Completed'
              ? existing.completedDate || todayStr
              : partial.status
              ? undefined
              : existing.completedDate,
          lastStudiedDate:
            partial.lastStudiedDate !== undefined
              ? partial.lastStudiedDate
              : partial.status === 'Not Started'
              ? existing.lastStudiedDate
              : todayStr,
          nextRevisionDate: nextRevDate,
          updatedAt: new Date().toISOString(),
        };
        return { ...prev, [topicId]: updated };
      });
    },
    [preferences.revisionIntervals]
  );

  const bulkUpdateChapterTopics = useCallback(
    (chapterId: string, partial: Partial<TopicMasteryState>) => {
      setMasteryMap((prev) => {
        const next = { ...prev };
        activeSyllabus.subjects.forEach((sub) => {
          sub.units.forEach((u) => {
            u.chapters.forEach((c) => {
              if (c.id === chapterId) {
                c.topics.forEach((t) => {
                  const existing = next[t.id] || {
                    topicId: t.id,
                    chapterId: c.id,
                    subjectId: sub.id,
                    status: 'Not Started',
                    confidence: 3,
                    isConfidenceRated: false,
                    completedStages: [],
                    difficulty: t.difficulty,
                    totalStudyMinutes: 0,
                    questionsSolved: 0,
                    questionsCorrect: 0,
                    updatedAt: new Date().toISOString(),
                  };
                  next[t.id] = {
                    ...existing,
                    ...partial,
                    updatedAt: new Date().toISOString(),
                  };
                });
              }
            });
          });
        });
        return next;
      });
    },
    [activeSyllabus]
  );

  const toggleMasteryStage = useCallback(
    (topicId: string, stage: MasteryStage) => {
      setMasteryMap((prev) => {
        const existing = prev[topicId] || {
          topicId,
          chapterId: '',
          subjectId: '',
          status: 'In Progress',
          confidence: 3,
          isConfidenceRated: false,
          completedStages: [],
          difficulty: 'Moderate',
          totalStudyMinutes: 0,
          questionsSolved: 0,
          questionsCorrect: 0,
          updatedAt: new Date().toISOString(),
        };

        const hasStage = existing.completedStages.includes(stage);
        const newStages = hasStage
          ? existing.completedStages.filter((s) => s !== stage)
          : [...existing.completedStages, stage];

        let newStatus = existing.status;
        // Only auto-complete from stages if user explicitly enabled autoCompleteFromStages
        if (
          preferences.autoCompleteFromStages &&
          newStages.includes('theory') &&
          newStages.includes('notes') &&
          (newStages.includes('pyqs') || newStages.includes('ncert_exercises'))
        ) {
          newStatus = 'Completed';
        } else if (newStages.length > 0 && newStatus === 'Not Started') {
          newStatus = 'In Progress';
        }

        return {
          ...prev,
          [topicId]: {
            ...existing,
            completedStages: newStages,
            status: newStatus,
            lastStudiedDate: new Date().toISOString().split('T')[0],
            updatedAt: new Date().toISOString(),
          },
        };
      });
    },
    [preferences.autoCompleteFromStages]
  );

  const addRevisionTask = useCallback((task: SpacedRevisionTask) => {
    setRevisionTasks((prev) => {
      const filtered = prev.filter(
        (t) => !(t.topicId === task.topicId && t.revisionStep === task.revisionStep)
      );
      return [...filtered, task];
    });
  }, []);

  const completeRevisionTask = useCallback(
    (taskId: string, confidence: ConfidenceRating, recall: 'High' | 'Medium' | 'Low') => {
      setRevisionTasks((prev) =>
        prev.map((t) => {
          if (t.id === taskId) {
            return {
              ...t,
              completed: true,
              completedDate: new Date().toISOString().split('T')[0],
              confidenceScore: confidence,
              recallAccuracy: recall,
            };
          }
          return t;
        })
      );
    },
    []
  );

  const addStudyTask = useCallback((task: Omit<DailyStudyTask, 'id'>) => {
    const newTask: DailyStudyTask = {
      ...task,
      id: `task-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    };
    setStudyTasks((prev) => [newTask, ...prev]);
  }, []);

  const updateStudyTask = useCallback((taskId: string, partial: Partial<DailyStudyTask>) => {
    setStudyTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, ...partial } : t))
    );
  }, []);

  const toggleStudyTask = useCallback((taskId: string) => {
    setStudyTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? {
              ...t,
              completed: !t.completed,
              completedAt: !t.completed ? new Date().toISOString() : undefined,
            }
          : t
      )
    );
  }, []);

  const deleteStudyTask = useCallback((taskId: string) => {
    setStudyTasks((prev) => prev.filter((t) => t.id !== taskId));
  }, []);

  const addResource = useCallback((resource: Omit<SubjectResource, 'id' | 'createdAt'>) => {
    const newRes: SubjectResource = {
      ...resource,
      id: `res-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    setResources((prev) => [newRes, ...prev]);
  }, []);

  const deleteResource = useCallback((id: string) => {
    setResources((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const addMockTest = useCallback(
    (test: Omit<MockTestRecord, 'id'>) => {
      const newTest: MockTestRecord = {
        ...test,
        id: `test-${Date.now()}`,
      };
      setMockTests((prev) => [newTest, ...prev]);

      if (test.mistakes && test.mistakes.length > 0) {
        test.mistakes.forEach((m) => {
          if (m.topicId) {
            updateTopicMastery(m.topicId, {
              status: 'Needs Revision',
              confidence: 2,
            });
          }
        });
      }
    },
    [updateTopicMastery]
  );

  const updatePYQAttempt = useCallback(
    (id: string, status: 'correct' | 'incorrect' | 'needs_practice') => {
      setPyqs((prev) => prev.map((q) => (q.id === id ? { ...q, attemptStatus: status } : q)));
    },
    []
  );

  const addPYQ = useCallback((pyq: Omit<PYQRecord, 'id'>) => {
    const newQ: PYQRecord = {
      ...pyq,
      id: `pyq-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    };
    setPyqs((prev) => [newQ, ...prev]);
  }, []);

  const bulkAddPYQs = useCallback((newPyqs: Omit<PYQRecord, 'id'>[]): number => {
    const records: PYQRecord[] = newPyqs.map((q, idx) => ({
      ...q,
      id: `pyq-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 5)}`,
    }));
    setPyqs((prev) => [...records, ...prev]);
    return records.length;
  }, []);

  const updatePYQ = useCallback((id: string, partial: Partial<PYQRecord>) => {
    setPyqs((prev) => prev.map((q) => (q.id === id ? { ...q, ...partial } : q)));
  }, []);

  const deletePYQ = useCallback((id: string) => {
    setPyqs((prev) => prev.filter((q) => q.id !== id));
  }, []);

  const addUploadedFileMetadata = useCallback(
    (meta: Omit<UploadedFileMetadata, 'id' | 'uploadDate'>) => {
      const newMeta: UploadedFileMetadata = {
        ...meta,
        id: `file-${Date.now()}`,
        uploadDate: new Date().toISOString(),
      };
      setUploadedFilesMetadata((prev) => [newMeta, ...prev]);
    },
    []
  );

  const deleteUploadedFileMetadata = useCallback((id: string) => {
    setUploadedFilesMetadata((prev) => prev.filter((m) => m.id !== id));
  }, []);

  const addAIPersistentRule = useCallback(
    (instruction: string, category: AIPersistentRule['category'] = 'general') => {
      const newRule: AIPersistentRule = {
        id: `rule-${Date.now()}`,
        instruction,
        category,
        active: true,
        createdAt: new Date().toISOString(),
      };
      setAiPersistentRules((prev) => [newRule, ...prev]);
    },
    []
  );

  const toggleAIPersistentRule = useCallback((id: string) => {
    setAiPersistentRules((prev) =>
      prev.map((r) => (r.id === id ? { ...r, active: !r.active } : r))
    );
  }, []);

  const deleteAIPersistentRule = useCallback((id: string) => {
    setAiPersistentRules((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const addAIChatMessage = useCallback((msg: AIChatMessage) => {
    setAiChatHistory((prev) => [...prev, msg]);
  }, []);

  const clearAIChatHistory = useCallback(() => {
    setAiChatHistory([
      {
        id: `msg-welcome-${Date.now()}`,
        role: 'assistant',
        content: 'Conversation history cleared. Your syllabus, PYQs, backlog, and persistent preferences remain intact. How can I help you next?',
        timestamp: new Date().toISOString(),
      },
    ]);
  }, []);

  const addMilestone = useCallback((milestone: Omit<MilestoneItem, 'id'>) => {
    const newM: MilestoneItem = {
      ...milestone,
      id: `mile-${Date.now()}`,
    };
    setMilestones((prev) => [...prev, newM].sort((a, b) => a.date.localeCompare(b.date)));
  }, []);

  const toggleMilestone = useCallback((id: string) => {
    setMilestones((prev) =>
      prev.map((m) => (m.id === id ? { ...m, isCompleted: !m.isCompleted } : m))
    );
  }, []);

  const updateMilestone = useCallback((id: string, partial: Partial<MilestoneItem>) => {
    setMilestones((prev) => prev.map((m) => (m.id === id ? { ...m, ...partial } : m)));
  }, []);

  const deleteMilestone = useCallback((id: string) => {
    setMilestones((prev) => prev.filter((m) => m.id !== id));
  }, []);

  const archiveMilestone = useCallback((id: string) => {
    setMilestones((prev) =>
      prev.map((m) => (m.id === id ? { ...m, isArchived: !m.isArchived } : m))
    );
  }, []);

  const updatePreferences = useCallback((partial: Partial<UserPreferences>) => {
    setPreferences((prev) => ({ ...prev, ...partial }));
  }, []);

  const importSyllabusVersion = useCallback((newVersion: SyllabusVersion) => {
    setActiveSyllabus(newVersion);
  }, []);

  const mergeImportedSyllabus = useCallback(
    (parsedSubjects: ParsedSubjectPreview[]) => {
      const { updatedSubjects, addedCounts, newTopicIds } = mergeParsedSyllabusIntoActive(
        activeSyllabus,
        parsedSubjects
      );

      setActiveSyllabus((prev) => ({
        ...prev,
        subjects: updatedSubjects,
        lastCheckedDate: new Date().toISOString().split('T')[0],
        verificationStatus:
          prev.verificationStatus === 'verified_rbse' ? 'verified_rbse' : 'user_defined',
      }));

      setMasteryMap((prev) => {
        const nextMap = { ...prev };
        newTopicIds.forEach((tId) => {
          if (!nextMap[tId]) {
            nextMap[tId] = {
              topicId: tId,
              chapterId: '',
              subjectId: '',
              status: 'Not Started',
              confidence: 3,
              isConfidenceRated: false,
              completedStages: [],
              difficulty: 'Moderate',
              totalStudyMinutes: 0,
              questionsSolved: 0,
              questionsCorrect: 0,
              updatedAt: new Date().toISOString(),
            };
          }
        });
        return nextMap;
      });

      return addedCounts;
    },
    [activeSyllabus]
  );

  const clearDefaultSyllabus = useCallback(() => {
    setActiveSyllabus((prev) => ({
      ...prev,
      subjects: [],
      statusLabel: 'User Custom Syllabus',
      verificationStatus: 'user_defined',
      lastCheckedDate: new Date().toISOString().split('T')[0],
    }));
    setStudyTasks((prev) => prev.filter((t) => !t.id.startsWith('task-seed-')));
    setRevisionTasks((prev) => prev.filter((r) => !r.id.startsWith('rev-seed-')));
    setMasteryMap({});
  }, []);

  const addSubject = useCallback((subject: Omit<Subject, 'id'>) => {
    const newSub: Subject = {
      ...subject,
      id: `sub-${Date.now()}`,
      units: subject.units || [],
      isCustom: true,
    };
    setActiveSyllabus((prev) => ({
      ...prev,
      subjects: [...prev.subjects, newSub],
    }));
  }, []);

  // Global Subject Update: propagates subject name changes to planner, revisions, PYQs, and tests
  const updateSubject = useCallback((id: string, partial: Partial<Subject>) => {
    setActiveSyllabus((prev) => ({
      ...prev,
      subjects: prev.subjects.map((s) => (s.id === id ? { ...s, ...partial } : s)),
    }));
    if (partial.name) {
      const newName = partial.name;
      setStudyTasks((prev) =>
        prev.map((t) => (t.subjectId === id ? { ...t, subjectName: newName } : t))
      );
      setRevisionTasks((prev) =>
        prev.map((r) => (r.subjectId === id ? { ...r, subjectName: newName } : r))
      );
      setPyqs((prev) =>
        prev.map((q) => (q.subjectId === id ? { ...q, subjectName: newName } : q))
      );
      setMockTests((prev) =>
        prev.map((m) => (m.subjectId === id ? { ...m, subjectName: newName } : m))
      );
    }
    if (partial.priority) {
      setPreferences((prev) => ({
        ...prev,
        subjectPriorities: {
          ...prev.subjectPriorities,
          [id]: partial.priority!,
        },
      }));
    }
  }, []);

  const deleteSubject = useCallback((id: string) => {
    setActiveSyllabus((prev) => ({
      ...prev,
      subjects: prev.subjects.filter((s) => s.id !== id),
    }));
  }, []);

  const reorderSubjects = useCallback((subjects: Subject[]) => {
    setActiveSyllabus((prev) => ({
      ...prev,
      subjects,
    }));
  }, []);

  const addUnit = useCallback((subjectId: string, unit: Omit<Unit, 'id' | 'subjectId'>) => {
    const newUnit: Unit = {
      ...unit,
      id: `u-${Date.now()}`,
      subjectId,
      chapters: unit.chapters || [],
    };
    setActiveSyllabus((prev) => ({
      ...prev,
      subjects: prev.subjects.map((s) =>
        s.id === subjectId ? { ...s, units: [...s.units, newUnit] } : s
      ),
    }));
  }, []);

  const updateUnit = useCallback((subjectId: string, unitId: string, partial: Partial<Unit>) => {
    setActiveSyllabus((prev) => ({
      ...prev,
      subjects: prev.subjects.map((s) =>
        s.id === subjectId
          ? {
              ...s,
              units: s.units.map((u) => (u.id === unitId ? { ...u, ...partial } : u)),
            }
          : s
      ),
    }));
  }, []);

  const deleteUnit = useCallback((subjectId: string, unitId: string) => {
    setActiveSyllabus((prev) => ({
      ...prev,
      subjects: prev.subjects.map((s) =>
        s.id === subjectId
          ? {
              ...s,
              units: s.units.filter((u) => u.id !== unitId),
            }
          : s
      ),
    }));
  }, []);

  const addChapter = useCallback(
    (subjectId: string, unitId: string, chapter: Omit<Chapter, 'id' | 'unitId' | 'subjectId'>) => {
      const newChap: Chapter = {
        ...chapter,
        id: `c-${Date.now()}`,
        unitId,
        subjectId,
        topics: chapter.topics || [],
      };
      setActiveSyllabus((prev) => ({
        ...prev,
        subjects: prev.subjects.map((s) =>
          s.id === subjectId
            ? {
                ...s,
                units: s.units.map((u) =>
                  u.id === unitId ? { ...u, chapters: [...u.chapters, newChap] } : u
                ),
              }
            : s
        ),
      }));
    },
    []
  );

  const updateChapter = useCallback(
    (subjectId: string, unitId: string, chapterId: string, partial: Partial<Chapter>) => {
      setActiveSyllabus((prev) => ({
        ...prev,
        subjects: prev.subjects.map((s) =>
          s.id === subjectId
            ? {
                ...s,
                units: s.units.map((u) =>
                  u.id === unitId
                    ? {
                        ...u,
                        chapters: u.chapters.map((c) =>
                          c.id === chapterId ? { ...c, ...partial } : c
                        ),
                      }
                    : u
                ),
              }
            : s
        ),
      }));
      if (partial.title) {
        const newTitle = partial.title;
        setStudyTasks((prev) =>
          prev.map((t) => (t.chapterId === chapterId ? { ...t, chapterTitle: newTitle } : t))
        );
        setPyqs((prev) =>
          prev.map((q) => (q.chapterId === chapterId ? { ...q, chapterTitle: newTitle } : q))
        );
      }
    },
    []
  );

  const deleteChapter = useCallback((subjectId: string, unitId: string, chapterId: string) => {
    setActiveSyllabus((prev) => ({
      ...prev,
      subjects: prev.subjects.map((s) =>
        s.id === subjectId
          ? {
              ...s,
              units: s.units.map((u) =>
                u.id === unitId
                  ? {
                      ...u,
                      chapters: u.chapters.filter((c) => c.id !== chapterId),
                    }
                  : u
              ),
            }
          : s
      ),
    }));
  }, []);

  const addTopic = useCallback(
    (
      subjectId: string,
      unitId: string,
      chapterId: string,
      topic: Omit<Topic, 'id' | 'chapterId' | 'unitId' | 'subjectId'>
    ) => {
      const newTopicId = `top-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
      const newTop: Topic = {
        ...topic,
        id: newTopicId,
        chapterId,
        unitId,
        subjectId,
        subtopics: topic.subtopics || [],
      };
      setActiveSyllabus((prev) => ({
        ...prev,
        subjects: prev.subjects.map((s) =>
          s.id === subjectId
            ? {
                ...s,
                units: s.units.map((u) =>
                  u.id === unitId
                    ? {
                        ...u,
                        chapters: u.chapters.map((c) =>
                          c.id === chapterId ? { ...c, topics: [...c.topics, newTop] } : c
                        ),
                      }
                    : u
                ),
              }
            : s
        ),
      }));
      setMasteryMap((prev) => ({
        ...prev,
        [newTopicId]: {
          topicId: newTopicId,
          chapterId,
          subjectId,
          status: 'Not Started',
          confidence: 3,
          isConfidenceRated: false,
          completedStages: [],
          difficulty: newTop.difficulty || 'Moderate',
          totalStudyMinutes: 0,
          questionsSolved: 0,
          questionsCorrect: 0,
          updatedAt: new Date().toISOString(),
        },
      }));
    },
    []
  );

  const updateTopic = useCallback(
    (
      subjectId: string,
      unitId: string,
      chapterId: string,
      topicId: string,
      partial: Partial<Topic>
    ) => {
      setActiveSyllabus((prev) => ({
        ...prev,
        subjects: prev.subjects.map((s) =>
          s.id === subjectId
            ? {
                ...s,
                units: s.units.map((u) =>
                  u.id === unitId
                    ? {
                        ...u,
                        chapters: u.chapters.map((c) =>
                          c.id === chapterId
                            ? {
                                ...c,
                                topics: c.topics.map((t) =>
                                  t.id === topicId ? { ...t, ...partial } : t
                                ),
                              }
                            : c
                        ),
                      }
                    : u
                ),
              }
            : s
        ),
      }));
      if (partial.title) {
        const newTitle = partial.title;
        setStudyTasks((prev) =>
          prev.map((t) => (t.topicId === topicId ? { ...t, topicTitle: newTitle } : t))
        );
        setRevisionTasks((prev) =>
          prev.map((r) => (r.topicId === topicId ? { ...r, topicTitle: newTitle } : r))
        );
        setPyqs((prev) =>
          prev.map((q) => (q.topicId === topicId ? { ...q, topicTitle: newTitle } : q))
        );
      }
    },
    []
  );

  const deleteTopic = useCallback(
    (subjectId: string, unitId: string, chapterId: string, topicId: string) => {
      setActiveSyllabus((prev) => ({
        ...prev,
        subjects: prev.subjects.map((s) =>
          s.id === subjectId
            ? {
                ...s,
                units: s.units.map((u) =>
                  u.id === unitId
                    ? {
                        ...u,
                        chapters: u.chapters.map((c) =>
                          c.id === chapterId
                            ? {
                                ...c,
                                topics: c.topics.filter((t) => t.id !== topicId),
                              }
                            : c
                        ),
                      }
                    : u
                ),
              }
            : s
        ),
      }));
    },
    []
  );

  // Execute an AI Action Proposal directly against real application state
  const executeAIAction = useCallback(
    (action: AIActionProposal, onNavigate?: (tab: string) => void): string => {
      const p = action.payload || {};
      switch (action.type) {
        case 'MARK_TOPIC_STATUS': {
          updateTopicMastery(p.topicId, {
            chapterId: p.chapterId,
            subjectId: p.subjectId,
            status: p.status,
          });
          return `Verified: "${p.topicTitle}" is now marked as ${p.status}.`;
        }
        case 'MOVE_TASK': {
          const existing = studyTasks.find((t) => t.topicId === p.topicId && !t.completed);
          if (existing) {
            updateStudyTask(existing.id, { date: p.targetDate });
          } else {
            addStudyTask({
              date: p.targetDate,
              subjectId: p.subjectId,
              subjectName: p.subjectName,
              chapterId: p.chapterId,
              chapterTitle: p.chapterTitle,
              topicId: p.topicId,
              topicTitle: p.topicTitle,
              taskType: 'theory',
              plannedMinutes: p.plannedMinutes || 60,
              actualMinutes: 0,
              priority: 'high',
              energySlot: 'morning_high',
              completed: false,
              notes: 'Scheduled by AI Assistant',
            });
          }
          return `Verified: "${p.topicTitle}" scheduled for ${p.targetDate}.`;
        }
        case 'GENERATE_STUDY_PLAN': {
          const tasks: Omit<DailyStudyTask, 'id'>[] = Array.isArray(p.tasks) ? p.tasks : [];
          tasks.forEach((t) => addStudyTask(t));
          return `Verified: Added ${tasks.length} study sessions to your Study Planner.`;
        }
        case 'UPDATE_PREFERENCE': {
          updatePreferences(p);
          return `Verified: Updated your global personal preferences.`;
        }
        case 'SAVE_PERSISTENT_RULE': {
          addAIPersistentRule(p.instruction, p.category);
          if (p.preferenceUpdates) {
            updatePreferences(p.preferenceUpdates);
          }
          return `Verified: Saved persistent rule "${p.instruction}".`;
        }
        case 'IMPORT_TOPICS': {
          const titles: string[] = Array.isArray(p.topicTitles) ? p.topicTitles : [];
          titles.forEach((title) => {
            addTopic(p.subjectId, p.unitId, p.chapterId, {
              title,
              subtopics: [],
              difficulty: preferences.pdfDefaultDifficulty || 'Moderate',
              estimatedHours: 2,
            });
          });
          return `Verified: Imported ${titles.length} topics into ${p.chapterTitle}.`;
        }
        case 'PRIORITIZE_BY_PYQ': {
          updatePreferences({ alwaysRankByPYQ: true });
          return `Verified: Topic Intelligence Engine ranking applied using uploaded PYQ evidence.`;
        }
        case 'SCHEDULE_REVISION': {
          addRevisionTask({
            id: `rev-ai-${Date.now()}`,
            topicId: p.topicId,
            chapterId: p.chapterId || '',
            subjectId: p.subjectId || 'physics',
            topicTitle: p.topicTitle,
            subjectName: p.subjectName || 'Physics',
            revisionStep: 1,
            scheduledDate: p.scheduledDate || new Date().toISOString().split('T')[0],
            completed: false,
          });
          return `Verified: Added spaced revision task for "${p.topicTitle}" on ${p.scheduledDate || 'today'}.`;
        }
        case 'ADD_FORMULA_NOTE': {
          addResource({
            subjectId: p.subjectId || 'physics',
            chapterId: p.chapterId || '',
            topicId: p.topicId,
            type: p.resourceType || 'note',
            title: p.title || 'AI Study Note',
            content: p.content || '',
          });
          return `Verified: Saved "${p.title}" to your Formula & Note Bank.`;
        }
        case 'NAVIGATE_FILTER': {
          if (p.subjectId || p.chapterId) {
            setBacklogFilterState({
              subjectId: p.subjectId || 'all',
              chapterId: p.chapterId || 'all',
            });
          }
          if (p.tab && onNavigate) {
            onNavigate(p.tab);
          }
          return `Opened ${p.tab || 'backlog'} view with requested filters.`;
        }
        default:
          return 'Action executed.';
      }
    },
    [
      updateTopicMastery,
      studyTasks,
      updateStudyTask,
      addStudyTask,
      addRevisionTask,
      addResource,
      updatePreferences,
      addAIPersistentRule,
      addTopic,
      preferences.pdfDefaultDifficulty,
    ]
  );

  const resetAllData = useCallback(() => {
    setActiveSyllabus(OFFICIAL_RBSE_2026_27_SYLLABUS);
    setMasteryMap(getInitialMasteryMap());
    setResources([
      ...DEFAULT_PHYSICS_RESOURCES,
      ...DEFAULT_CHEMISTRY_RESOURCES,
      ...DEFAULT_MATH_RESOURCES,
    ]);
    setPyqs(DEFAULT_PYQS);
    setMilestones(DEFAULT_MILESTONES);
    setStudyTasks([]);
    setRevisionTasks([]);
    setMockTests([]);
    setPreferences(DEFAULT_PREFERENCES);
    setUploadedFilesMetadata([]);
    setAiPersistentRules([
      {
        id: 'rule-seed-1',
        instruction: 'Always rank my topics using uploaded PYQs.',
        category: 'prioritization',
        active: true,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'rule-seed-2',
        instruction: 'Show backlog grouped by subject and chapter.',
        category: 'backlog',
        active: true,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'rule-seed-3',
        instruction: 'Do not mark topics complete automatically.',
        category: 'completion',
        active: true,
        createdAt: new Date().toISOString(),
      },
    ]);
    setAiChatHistory([
      {
        id: 'msg-welcome',
        role: 'assistant',
        content:
          'Welcome to your Personal AI Study Assistant! I have live, authenticated access to your syllabus, PYQ intelligence rankings, backlog, study planner, and preferences. Tell me what to show, plan, prioritize, or edit — for example: *"Show my Physics backlog"*, *"Mark Electric Field Lines as completed"*, or *"Create a 7-day plan using my available study hours"*.',
        timestamp: new Date().toISOString(),
      },
    ]);
    localStorage.removeItem(LOCAL_STORAGE_KEY);
  }, []);

  const loginGoogle = useCallback(async () => {
    try {
      setSyncState('syncing');
      const user = await fbSignIn();
      if (user) {
        setSyncState('synced');
        setLastSyncTime(new Date().toLocaleTimeString());
      }
    } catch (e) {
      console.error('Login error:', e);
      setSyncState('error');
    }
  }, []);

  const logoutUser = useCallback(async () => {
    await fbSignOut();
    setCurrentUser(null);
    setSyncState('offline_local');
  }, []);

  const exportJSON = useCallback(() => {
    const exportObject = {
      app: 'AZORA',
      version: '2.0',
      exportDate: new Date().toISOString(),
      activeSyllabus,
      masteryMap,
      revisionTasks,
      studyTasks,
      resources,
      mockTests,
      pyqs,
      milestones,
      preferences,
      uploadedFilesMetadata,
      aiPersistentRules,
      aiChatHistory,
    };
    const blob = new Blob([JSON.stringify(exportObject, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `AZORA_Backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [
    activeSyllabus,
    masteryMap,
    revisionTasks,
    studyTasks,
    resources,
    mockTests,
    pyqs,
    milestones,
    preferences,
    uploadedFilesMetadata,
    aiPersistentRules,
    aiChatHistory,
  ]);

  const importJSON = useCallback((jsonString: string): boolean => {
    try {
      const data = JSON.parse(jsonString);
      if (!data || typeof data !== 'object') return false;
      if (data.masteryMap) setMasteryMap(data.masteryMap);
      if (data.activeSyllabus) setActiveSyllabus(data.activeSyllabus);
      if (data.revisionTasks) setRevisionTasks(data.revisionTasks);
      if (data.studyTasks) setStudyTasks(data.studyTasks);
      if (data.resources) setResources(data.resources);
      if (data.mockTests) setMockTests(data.mockTests);
      if (data.pyqs) setPyqs(data.pyqs);
      if (data.milestones) setMilestones(data.milestones);
      if (data.preferences) {
        setPreferences((prev) => ({
          ...DEFAULT_PREFERENCES,
          ...prev,
          ...data.preferences,
          theme: 'light',
        }));
      }
      if (data.uploadedFilesMetadata) setUploadedFilesMetadata(data.uploadedFilesMetadata);
      if (data.aiPersistentRules) setAiPersistentRules(data.aiPersistentRules);
      if (data.aiChatHistory) setAiChatHistory(data.aiChatHistory);
      return true;
    } catch (e) {
      console.error('Import parse error:', e);
      return false;
    }
  }, []);

  const value = {
    activeSyllabus,
    masteryMap,
    revisionTasks,
    studyTasks,
    resources,
    mockTests,
    pyqs,
    milestones,
    preferences,
    uploadedFilesMetadata,
    aiPersistentRules,
    aiChatHistory,
    backlogFilterState,
    setBacklogFilterState,
    currentUser,
    syncState,
    lastSyncTime,
    progressSummary,
    studyStreak,
    updateTopicMastery,
    bulkUpdateChapterTopics,
    toggleMasteryStage,
    addRevisionTask,
    completeRevisionTask,
    addStudyTask,
    updateStudyTask,
    toggleStudyTask,
    deleteStudyTask,
    addResource,
    deleteResource,
    addMockTest,
    updatePYQAttempt,
    addPYQ,
    bulkAddPYQs,
    updatePYQ,
    deletePYQ,
    addUploadedFileMetadata,
    deleteUploadedFileMetadata,
    addAIPersistentRule,
    toggleAIPersistentRule,
    deleteAIPersistentRule,
    addAIChatMessage,
    clearAIChatHistory,
    executeAIAction,
    addMilestone,
    updateMilestone,
    deleteMilestone,
    toggleMilestone,
    archiveMilestone,
    updatePreferences,
    importSyllabusVersion,
    mergeImportedSyllabus,
    clearDefaultSyllabus,
    addSubject,
    updateSubject,
    deleteSubject,
    reorderSubjects,
    addUnit,
    updateUnit,
    deleteUnit,
    addChapter,
    updateChapter,
    deleteChapter,
    addTopic,
    updateTopic,
    deleteTopic,
    resetAllData,
    loginGoogle,
    logoutUser,
    exportJSON,
    importJSON,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export function useApp(): AppContextType {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return ctx;
}

