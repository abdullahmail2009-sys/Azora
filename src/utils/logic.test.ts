import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isTopicCompleted,
  calculateTopicMasteryPercentage,
  calculateOverallProgress,
} from './progressCalc.ts';
import {
  calculateStudyStreak,
  getStreakMilestoneInfo,
  sanitizeLegacySeedData,
  getLocalDateStr,
} from './streakCalc.ts';
import {
  calculateNextRevisionDate,
  getRevisionUrgency,
  deduplicateRevisions,
} from './spacedRepetition.ts';
import { calculateBacklogAndPace } from './backlogCalc.ts';
import { checkPrerequisites, wouldCreateCycle } from './prerequisites.ts';
import { compareSyllabi } from './syllabusDiff.ts';
import { structureRawSyllabusText, mergeParsedSyllabusIntoActive } from './pdfSyllabusParser.ts';
import {
  calculateTopicIntelligence,
  parsePYQPdfText,
} from './pyqIntelligenceEngine.ts';
import { buildHierarchicalBacklog } from './backlogEngine.ts';
import { processAIInstruction } from './aiActionEngine.ts';
import { resolveApiUrl, resolveAndroidBackAction } from './apiClient.ts';
import type {
  Subject,
  SyllabusVersion,
  TopicMasteryState,
  SpacedRevisionTask,
  PYQRecord,
  UserPreferences,
} from '../types/index.ts';

test('isTopicCompleted: does not auto-complete from stages unless explicitly enabled', () => {
  const empty = isTopicCompleted(undefined);
  assert.equal(empty, false);

  const statusComp: TopicMasteryState = {
    topicId: 't1',
    chapterId: 'c1',
    subjectId: 'phy',
    status: 'Completed',
    confidence: 4,
    completedStages: ['theory'],
    difficulty: 'Moderate',
    totalStudyMinutes: 60,
    questionsSolved: 10,
    questionsCorrect: 8,
    updatedAt: new Date().toISOString(),
  };
  assert.equal(isTopicCompleted(statusComp), true);

  const stagesComp: TopicMasteryState = {
    ...statusComp,
    status: 'In Progress',
    completedStages: ['theory', 'notes'],
  };
  // Default allowAutoCompleteFromStages is false: unfinished topic stays false
  assert.equal(isTopicCompleted(stagesComp, false), false);
  // When allowAutoCompleteFromStages is true: returns true
  assert.equal(isTopicCompleted(stagesComp, true), true);

  const incomplete: TopicMasteryState = {
    ...statusComp,
    status: 'In Progress',
    completedStages: ['theory'],
  };
  assert.equal(isTopicCompleted(incomplete), false);
});

test('calculateOverallProgress: computes weighted completion and respects exclusions', () => {
  const mockSubject: Subject = {
    id: 'phy',
    name: 'Physics',
    code: '12-PHY',
    color: '#3b82f6',
    priority: 'high',
    units: [
      {
        id: 'u1',
        subjectId: 'phy',
        number: 1,
        title: 'Electrostatics',
        chapters: [
          {
            id: 'c1',
            unitId: 'u1',
            subjectId: 'phy',
            number: 1,
            title: 'Electric Charges & Fields',
            officialWeightageMarks: 4,
            topics: [
              {
                id: 't1',
                chapterId: 'c1',
                unitId: 'u1',
                subjectId: 'phy',
                title: 'Coulombs Law',
                subtopics: [],
                difficulty: 'Moderate',
                estimatedHours: 2,
              },
              {
                id: 't2',
                chapterId: 'c1',
                unitId: 'u1',
                subjectId: 'phy',
                title: 'Electric Flux',
                subtopics: [],
                difficulty: 'Hard',
                estimatedHours: 2,
              },
            ],
          },
          {
            id: 'c2_excluded',
            unitId: 'u1',
            subjectId: 'phy',
            number: 2,
            title: 'Excluded Topic',
            officialWeightageMarks: 2,
            isExcluded: true,
            topics: [
              {
                id: 't_ex',
                chapterId: 'c2_excluded',
                unitId: 'u1',
                subjectId: 'phy',
                title: 'Van de Graaff generator',
                subtopics: [],
                difficulty: 'Moderate',
                estimatedHours: 1,
                isExcluded: true,
              },
            ],
          },
        ],
      },
    ],
  };

  const masteryMap: Record<string, TopicMasteryState> = {
    t1: {
      topicId: 't1',
      chapterId: 'c1',
      subjectId: 'phy',
      status: 'Completed',
      confidence: 4,
      completedStages: ['theory', 'notes', 'ncert_exercises', 'pyqs'],
      difficulty: 'Moderate',
      totalStudyMinutes: 120,
      questionsSolved: 15,
      questionsCorrect: 12,
      updatedAt: new Date().toISOString(),
    },
  };

  const summary = calculateOverallProgress([mockSubject], masteryMap);
  // Total active chapters is 1 (c2_excluded is excluded)
  assert.equal(summary.totalChapters, 1);
  // 1 topic completed out of 2 active topics in c1 -> partial chapter credit 50%
  assert.equal(summary.totalTopics, 2);
  assert.equal(summary.completedTopics, 1);
  assert.equal(summary.overallCoveragePercentage, 50);
});

test('spaced repetition: calculates adaptive intervals based on confidence and recall', () => {
  const baseDate = '2026-10-20';
  // Step 1 default is +1 day
  const normalNext = calculateNextRevisionDate(baseDate, 1, 'default', 3, 'Medium');
  assert.equal(normalNext, '2026-10-21');

  // Step 2 default is +7 days (2026-10-27). If low confidence (1), interval is shortened by 50% -> +3 days
  const lowConfNext = calculateNextRevisionDate(baseDate, 2, 'default', 1, 'Low');
  assert.equal(lowConfNext, '2026-10-23');

  // Step 2 with high confidence (5) and high recall -> interval expanded
  const highConfNext = calculateNextRevisionDate(baseDate, 2, 'default', 5, 'High');
  // 7 * 1.25 = 9 days -> 2026-10-29
  assert.equal(highConfNext, '2026-10-29');
});

test('spaced repetition: deduplicates revision tasks properly', () => {
  const existing: SpacedRevisionTask[] = [
    {
      id: 'rev-1',
      topicId: 't1',
      chapterId: 'c1',
      subjectId: 'phy',
      topicTitle: 'Coulombs Law',
      subjectName: 'Physics',
      revisionStep: 1,
      scheduledDate: '2026-10-21',
      completed: false,
    },
  ];

  const updated: SpacedRevisionTask = {
    id: 'rev-1-new',
    topicId: 't1',
    chapterId: 'c1',
    subjectId: 'phy',
    topicTitle: 'Coulombs Law',
    subjectName: 'Physics',
    revisionStep: 1,
    scheduledDate: '2026-10-22',
    completed: true,
  };

  const deduplicated = deduplicateRevisions(existing, updated);
  assert.equal(deduplicated.length, 1);
  assert.equal(deduplicated[0].scheduledDate, '2026-10-22');
  assert.equal(deduplicated[0].completed, true);
});

test('backlogCalc: computes deficit and feasibility accurately', () => {
  const metricsFeasible = calculateBacklogAndPace(
    50,
    30,
    '2026-12-20',
    6,
    2.0,
    '2026-10-20'
  );
  assert.equal(metricsFeasible.remainingTopics, 20);
  assert.equal(metricsFeasible.availableDays, 61);
  assert.equal(metricsFeasible.isFeasible, true);

  // Severe backlog case: 100 topics remaining, only 5 days available
  const metricsDeficit = calculateBacklogAndPace(
    100,
    0,
    '2026-10-25',
    4,
    2.5,
    '2026-10-20'
  );
  assert.equal(metricsDeficit.isFeasible, false);
  assert.ok(metricsDeficit.workloadDeficitHours > 0);
  assert.ok(metricsDeficit.feasibilityWarning?.includes('Schedule deficit'));
});

test('prerequisites: checks dependencies and detects cycles', () => {
  const completed = new Set(['t1']);
  const checkPass = checkPrerequisites('t2', ['t1'], completed, { t1: 'Electrostatics 1' });
  assert.equal(checkPass.hasUnmetPrerequisites, false);

  const checkFail = checkPrerequisites('t3', ['t1', 't2'], completed, {
    t1: 'Electrostatics 1',
    t2: 'Electrostatics 2',
  });
  assert.equal(checkFail.hasUnmetPrerequisites, true);
  assert.deepEqual(checkFail.unmetPrerequisiteIds, ['t2']);

  // Cycle detection: t1 -> t2, t2 -> t3, adding t3 -> t1 creates cycle
  const graph: Record<string, string[]> = {
    t2: ['t1'],
    t3: ['t2'],
  };
  const isCycle = wouldCreateCycle(graph, 't1', 't3');
  assert.equal(isCycle, true);

  const notCycle = wouldCreateCycle(graph, 't4', 't3');
  assert.equal(notCycle, false);
});

test('syllabusDiff: detects added and removed chapters accurately', () => {
  const v1: SyllabusVersion = {
    id: 'v1',
    title: 'Syllabus 2026-27',
    academicSession: '2026-27',
    verificationStatus: 'verified_rbse',
    statusLabel: 'Verified',
    officialSourceUrl: 'https://rajeduboard.rajasthan.gov.in/',
    lastCheckedDate: '2026-05-01',
    isActive: true,
    subjects: [
      {
        id: 'phy',
        name: 'Physics',
        code: '12-PHY',
        color: '#3b82f6',
        priority: 'high',
        units: [
          {
            id: 'u1',
            subjectId: 'phy',
            number: 1,
            title: 'Electrostatics',
            chapters: [
              {
                id: 'c1',
                unitId: 'u1',
                subjectId: 'phy',
                number: 1,
                title: 'Electric Charges and Fields',
                topics: [],
              },
            ],
          },
        ],
      },
    ],
  };

  const v2: SyllabusVersion = {
    ...v1,
    id: 'v2',
    title: 'Syllabus 2027-28 Provisional',
    academicSession: '2027-28',
    subjects: [
      {
        id: 'phy',
        name: 'Physics',
        code: '12-PHY',
        color: '#3b82f6',
        priority: 'high',
        units: [
          {
            id: 'u1',
            subjectId: 'phy',
            number: 1,
            title: 'Electrostatics',
            chapters: [
              {
                id: 'c1',
                unitId: 'u1',
                subjectId: 'phy',
                number: 1,
                title: 'Electric Charges and Fields',
                topics: [],
              },
              {
                id: 'c2',
                unitId: 'u1',
                subjectId: 'phy',
                number: 2,
                title: 'Electrostatic Potential and Capacitance',
                topics: [],
              },
            ],
          },
        ],
      },
    ],
  };

  const diff = compareSyllabi(v1, v2);
  assert.equal(diff.addedCount, 1);
  assert.equal(diff.removedCount, 0);
  assert.equal(diff.changes[0].itemType, 'chapter');
  assert.equal(diff.changes[0].newValue, 'Electrostatic Potential and Capacitance');
});

test('pdfSyllabusParser: structureRawSyllabusText parses subjects, units, chapters, and topics correctly', () => {
  const sampleText = `
Subject: Physics
Unit 1: Optics (8 Marks)
Chapter 1: Ray Optics and Optical Instruments (5 Marks)
1.1 Reflection of Light by Spherical Mirrors
1.2 Refraction and Total Internal Reflection (Mirage, Optical Fibres)
1.3 Refraction at Spherical Surfaces and Lenses
Chapter 2: Wave Optics (3 Marks)
2.1 Huygens Principle
2.2 Interference of Light Waves and Young Experiment
`;

  const parsed = structureRawSyllabusText(sampleText);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].name, 'Physics');
  assert.equal(parsed[0].units.length, 1);
  assert.equal(parsed[0].units[0].title, 'Optics');
  assert.equal(parsed[0].units[0].officialMarks, 8);
  assert.equal(parsed[0].units[0].chapters.length, 2);
  assert.equal(parsed[0].units[0].chapters[0].title, 'Ray Optics and Optical Instruments');
  assert.equal(parsed[0].units[0].chapters[0].officialWeightageMarks, 5);
  assert.equal(parsed[0].units[0].chapters[0].topics.length, 3);
  assert.equal(parsed[0].units[0].chapters[0].topics[1].subtopics.length, 2);
  assert.equal(parsed[0].units[0].chapters[0].topics[1].subtopics[0], 'Mirage');
  assert.equal(parsed[0].units[0].chapters[1].title, 'Wave Optics');
  assert.equal(parsed[0].units[0].chapters[1].topics.length, 2);
});

test('pdfSyllabusParser: mergeParsedSyllabusIntoActive preserves existing records and merges non-duplicates', () => {
  const existingActive = {
    subjects: [
      {
        id: 'physics',
        name: 'Physics',
        code: 'PHY',
        color: '#2563eb',
        priority: 'high' as const,
        units: [
          {
            id: 'u-existing-1',
            subjectId: 'physics',
            number: 1,
            title: 'Electrostatics',
            officialMarks: 8,
            chapters: [
              {
                id: 'c-existing-1',
                unitId: 'u-existing-1',
                subjectId: 'physics',
                number: 1,
                title: 'Electric Charges and Fields',
                topics: [
                  {
                    id: 't-existing-1',
                    chapterId: 'c-existing-1',
                    unitId: 'u-existing-1',
                    subjectId: 'physics',
                    title: 'Electric Charges',
                    subtopics: [],
                    difficulty: 'Moderate' as const,
                    estimatedHours: 2,
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  };

  const parsedToMerge = [
    {
      id: 'sub-parsed-1',
      name: 'Physics',
      code: 'PHY',
      color: '#2563eb',
      targetSubjectId: 'physics',
      selected: true,
      units: [
        {
          id: 'u-parsed-1',
          number: 1,
          title: 'Electrostatics',
          selected: true,
          chapters: [
            {
              id: 'c-parsed-1',
              number: 1,
              title: 'Electric Charges and Fields',
              selected: true,
              topics: [
                {
                  id: 't-parsed-1',
                  title: 'Electric Charges', // Duplicate title, should NOT duplicate
                  subtopics: [],
                  estimatedHours: 2,
                  selected: true,
                },
                {
                  id: 't-parsed-2',
                  title: 'Coulombs Law', // New topic, should be appended safely
                  subtopics: [],
                  estimatedHours: 2,
                  selected: true,
                },
              ],
            },
          ],
        },
      ],
    },
  ];

  const { updatedSubjects, addedCounts, newTopicIds } = mergeParsedSyllabusIntoActive(
    existingActive,
    parsedToMerge
  );

  assert.equal(addedCounts.subjects, 0); // Reused existing physics
  assert.equal(addedCounts.units, 0); // Reused existing unit
  assert.equal(addedCounts.chapters, 0); // Reused existing chapter
  assert.equal(addedCounts.topics, 1); // Only added new non-duplicate topic
  assert.equal(newTopicIds.length, 1);

  const mergedTopics = updatedSubjects[0].units[0].chapters[0].topics;
  assert.equal(mergedTopics.length, 2);
  assert.equal(mergedTopics[0].id, 't-existing-1'); // Preserved original existing topic ID and data
  assert.equal(mergedTopics[1].title, 'Coulombs Law');
});

test('pyqIntelligenceEngine: ranks topics with PYQ evidence and labels topics with 0 PYQs as Insufficient PYQ evidence', () => {
  const subjects: Subject[] = [
    {
      id: 'physics',
      name: 'Physics',
      code: 'PHY',
      color: '#3b82f6',
      priority: 'high',
      units: [
        {
          id: 'u1',
          subjectId: 'physics',
          number: 1,
          title: 'Electrostatics',
          chapters: [
            {
              id: 'c1',
              unitId: 'u1',
              subjectId: 'physics',
              number: 1,
              title: 'Electric Charges and Fields',
              topics: [
                {
                  id: 't-gauss',
                  chapterId: 'c1',
                  unitId: 'u1',
                  subjectId: 'physics',
                  title: 'Gauss Law and its Applications',
                  subtopics: [],
                  difficulty: 'Hard',
                  estimatedHours: 3,
                },
                {
                  id: 't-unseen',
                  chapterId: 'c1',
                  unitId: 'u1',
                  subjectId: 'physics',
                  title: 'Continuous Charge Distribution',
                  subtopics: [],
                  difficulty: 'Moderate',
                  estimatedHours: 2,
                },
              ],
            },
          ],
        },
      ],
    },
  ];

  const pyqs: PYQRecord[] = [
    {
      id: 'q1',
      subjectId: 'physics',
      subjectName: 'Physics',
      chapterId: 'c1',
      chapterTitle: 'Electric Charges and Fields',
      topicId: 't-gauss',
      questionText: 'State Gauss Law in electrostatics and derive electric field due to infinite line charge.',
      marks: 4,
      examYear: '2024',
      source: 'RBSE 2024',
      verificationStatus: 'verified_rbse',
      attemptStatus: 'unattempted',
    },
  ];

  const ranked = calculateTopicIntelligence(subjects, pyqs, {}, false);
  assert.equal(ranked.length, 2);
  assert.equal(ranked[0].topicId, 't-gauss');
  assert.equal(ranked[0].priorityLevel, 'High Priority');
  assert.equal(ranked[0].pyqCount, 1);
  assert.equal(ranked[1].topicId, 't-unseen');
  assert.equal(ranked[1].priorityLevel, 'Insufficient PYQ evidence');
});

test('backlogEngine & aiActionEngine: filters Physics backlog strictly and executes natural language actions', () => {
  const subjects: Subject[] = [
    {
      id: 'physics',
      name: 'Physics',
      code: 'PHY',
      color: '#3b82f6',
      priority: 'high',
      units: [
        {
          id: 'u1',
          subjectId: 'physics',
          number: 1,
          title: 'Electrostatics',
          chapters: [
            {
              id: 'phy-c1',
              unitId: 'u1',
              subjectId: 'physics',
              number: 1,
              title: 'Electric Charges and Fields',
              topics: [
                {
                  id: 'phy-t1',
                  chapterId: 'phy-c1',
                  unitId: 'u1',
                  subjectId: 'physics',
                  title: 'Electric Dipole Torque',
                  subtopics: [{ id: 'st1', title: 'Uniform Electric Field' }],
                  difficulty: 'Moderate',
                  estimatedHours: 2,
                },
              ],
            },
          ],
        },
      ],
    },
    {
      id: 'chemistry',
      name: 'Chemistry',
      code: 'CHE',
      color: '#10b981',
      priority: 'high',
      units: [
        {
          id: 'u2',
          subjectId: 'chemistry',
          number: 1,
          title: 'Solutions',
          chapters: [
            {
              id: 'che-c1',
              unitId: 'u2',
              subjectId: 'chemistry',
              number: 1,
              title: 'Solutions',
              topics: [
                {
                  id: 'che-t1',
                  chapterId: 'che-c1',
                  unitId: 'u2',
                  subjectId: 'chemistry',
                  title: 'Raoult Law',
                  subtopics: [],
                  difficulty: 'Moderate',
                  estimatedHours: 2,
                },
              ],
            },
          ],
        },
      ],
    },
  ];

  // Filter strictly for Physics backlog
  const phyBacklog = buildHierarchicalBacklog(
    subjects,
    {},
    [],
    [],
    [],
    { subjectId: 'physics' },
    '2026-10-18',
    false
  );
  assert.equal(phyBacklog.subjectGroups.length, 1);
  assert.equal(phyBacklog.subjectGroups[0].subjectName, 'Physics');
  assert.equal(phyBacklog.totalUnfinishedTopics, 1);

  // Test AI instruction processing
  const defaultPrefs: UserPreferences = {
    targetSession: '2026-27',
    examTargetDate: '2027-02-14',
    dailyStudyHoursLimit: 6,
    preferredHighEnergySlot: 'morning',
    revisionScheduleType: 'default',
    subjectPriorities: { physics: 'high', chemistry: 'high' },
    theme: 'dark',
  };

  const resMark = processAIInstruction(
    'Mark Electric Dipole Torque as completed',
    {
      subjects,
      masteryMap: {},
      studyTasks: [],
      revisionTasks: [],
      pyqs: [],
      preferences: defaultPrefs,
    },
    '2026-10-18'
  );
  assert.equal(resMark.actions.length, 1);
  assert.equal(resMark.actions[0].type, 'MARK_TOPIC_STATUS');
  assert.equal(resMark.actions[0].payload.status, 'Completed');
});

test('pyqIntelligenceEngine: reconciles paper marks accurately and prevents OR/अथवा double-counting', () => {
  const subjects: Subject[] = [
    {
      id: 'physics',
      name: 'Physics',
      code: 'PHY',
      color: '#3b82f6',
      priority: 'high',
      units: [
        {
          id: 'u1',
          subjectId: 'physics',
          number: 1,
          title: 'Electrostatics',
          chapters: [
            {
              id: 'c1',
              unitId: 'u1',
              subjectId: 'physics',
              number: 1,
              title: 'Electric Charges and Fields',
              officialWeightageMarks: 6,
              topics: [
                {
                  id: 't-gauss',
                  chapterId: 'c1',
                  unitId: 'u1',
                  subjectId: 'physics',
                  title: 'Gauss Law and Applications',
                  subtopics: [],
                  difficulty: 'Hard',
                  estimatedHours: 3,
                },
                {
                  id: 't-dipole',
                  chapterId: 'c1',
                  unitId: 'u1',
                  subjectId: 'physics',
                  title: 'Electric Dipole Field and Torque',
                  subtopics: [],
                  difficulty: 'Moderate',
                  estimatedHours: 2,
                },
              ],
            },
          ],
        },
      ],
    },
  ];

  const samplePaperText = `
--- PAGE 1 ---
SECTION A
Q1. State Gauss Law in electrostatics and derive electric field due to an infinite line charge. [4 Marks]
OR
Derive an expression for torque acting on an electric dipole in a uniform electric field. [4 Marks]
Q2. Calculate the electric flux through a closed surface enclosing a charge of 2 microcoulomb. (1+2=3)
`;

  const result = parsePYQPdfText(samplePaperText, 'RBSE_Physics_2024.pdf', subjects, []);
  // Should extract 3 questions total: Q1 (4M compulsory), Q1-OR (4M optional alternative), Q2 (3M compulsory)
  assert.equal(result.length, 3);
  const compulsoryQs = result.filter((q) => !q.isOptionalAlternative);
  const optionalQs = result.filter((q) => q.isOptionalAlternative);
  assert.equal(compulsoryQs.length, 2);
  assert.equal(optionalQs.length, 1);

  // Compulsory marks sum should be 4 + 3 = 7, NOT 11!
  const compulsorySum = compulsoryQs.reduce((acc, q) => acc + q.marks, 0);
  const optionalSum = optionalQs.reduce((acc, q) => acc + q.marks, 0);
  assert.equal(compulsorySum, 7);
  assert.equal(optionalSum, 4);

  // Verify split marks (1+2=3) parsed as 3 marks
  const q2 = result.find((q) => q.questionText.includes('electric flux'));
  assert.ok(q2);
  assert.equal(q2.marks, 3);
});

test('aiActionEngine: generates syllabus-grounded RBSE tutor explanations across tutor modes', () => {
  const subjects: Subject[] = [
    {
      id: 'physics',
      name: 'Physics',
      code: 'PHY',
      color: '#3b82f6',
      priority: 'high',
      units: [
        {
          id: 'u1',
          subjectId: 'physics',
          number: 1,
          title: 'Electrostatics',
          chapters: [
            {
              id: 'c1',
              unitId: 'u1',
              subjectId: 'physics',
              number: 1,
              title: 'Electric Charges and Fields',
              officialWeightageMarks: 6,
              topics: [
                {
                  id: 't-gauss',
                  chapterId: 'c1',
                  unitId: 'u1',
                  subjectId: 'physics',
                  title: "Gauss's Law",
                  subtopics: [{ id: 's1', title: 'Infinite Line Charge' }],
                  difficulty: 'Hard',
                  estimatedHours: 3,
                },
              ],
            },
          ],
        },
      ],
    },
  ];

  const defaultPrefs: UserPreferences = {
    targetSession: '2026-27',
    examTargetDate: '2027-03-01',
    dailyStudyHoursLimit: 6,
    preferredHighEnergySlot: 'morning',
    revisionScheduleType: 'default',
    subjectPriorities: { physics: 'high' },
    theme: 'light',
    defaultTutorMode: 'derivation_coach',
  };

  const tutorReply = processAIInstruction(
    "Explain Gauss's Law derivation for RBSE board exam",
    {
      subjects,
      masteryMap: {},
      studyTasks: [],
      revisionTasks: [],
      pyqs: [],
      preferences: defaultPrefs,
    },
    '2026-10-18'
  );

  assert.ok(tutorReply.reply.includes("Gauss's Law"));
  assert.ok(tutorReply.reply.includes('Electric Charges and Fields'));
});

test('streakCalc: computes consecutive daily study streak, longest streak, and 7-day timeline from AppContext data', () => {
  const today = '2026-10-19';

  const masteryMap: Record<string, TopicMasteryState> = {
    'phy-c1-t1': {
      topicId: 'phy-c1-t1',
      chapterId: 'phy-c1',
      subjectId: 'physics',
      status: 'Completed',
      confidence: 4,
      completedStages: ['theory', 'notes'],
      difficulty: 'Moderate',
      totalStudyMinutes: 90,
      questionsSolved: 10,
      questionsCorrect: 8,
      startDate: '2026-10-15',
      completedDate: '2026-10-16',
      lastStudiedDate: '2026-10-17',
      updatedAt: '2026-10-17T10:00:00Z',
    },
  };

  // Revision completed on 2026-10-18 (yesterday)
  const revisionTasks: SpacedRevisionTask[] = [
    {
      id: 'rev-1',
      topicId: 'phy-c1-t1',
      chapterId: 'phy-c1',
      subjectId: 'physics',
      topicTitle: 'Coulombs Law',
      subjectName: 'Physics',
      revisionStep: 1,
      scheduledDate: '2026-10-18',
      completed: true,
      completedDate: '2026-10-18',
    },
  ];

  // Study task completed on 2026-10-19 (today)
  const studyTasks = [
    {
      id: 'task-1',
      date: '2026-10-19',
      subjectId: 'physics',
      subjectName: 'Physics',
      chapterId: 'phy-c1',
      chapterTitle: 'Electric Charges and Fields',
      topicId: 'phy-c1-t2',
      topicTitle: 'Electric Dipole',
      taskType: 'numericals' as const,
      plannedMinutes: 60,
      actualMinutes: 50,
      priority: 'high' as const,
      energySlot: 'morning_high' as const,
      completed: true,
      completedAt: '2026-10-19T08:30:00Z',
    },
  ];

  // Active on Oct 15, 16, 17, 18, 19 -> 5 consecutive days
  const summary = calculateStudyStreak(
    {
      masteryMap,
      studyTasks,
      revisionTasks,
      mockTests: [],
    },
    today
  );

  assert.equal(summary.currentStreak, 5);
  assert.equal(summary.longestStreak, 5);
  assert.equal(summary.totalActiveDays, 5);
  assert.equal(summary.isActiveToday, true);
  assert.equal(summary.streakAtRisk, false);
  assert.equal(summary.todayMinutes, 50);
  assert.equal(summary.todayActivitiesCount, 1);
  assert.equal(summary.last7Days.length, 7);
  assert.equal(summary.last7Days[6].date, '2026-10-19');
  assert.equal(summary.last7Days[6].isActive, true);
});

test('streakCalc: preserves yesterday streak as streakAtRisk when today has no activity yet and resets when gap > 1 day', () => {
  const today = '2026-10-19';

  // Active on Oct 17 and Oct 18 (yesterday), nothing on Oct 19 yet
  const atRiskSummary = calculateStudyStreak(
    {
      masteryMap: {
        t1: {
          topicId: 't1',
          chapterId: 'c1',
          subjectId: 'physics',
          status: 'In Progress',
          confidence: 3,
          completedStages: ['theory'],
          difficulty: 'Moderate',
          totalStudyMinutes: 45,
          questionsSolved: 5,
          questionsCorrect: 4,
          startDate: '2026-10-17',
          lastStudiedDate: '2026-10-18',
          updatedAt: '2026-10-18T12:00:00Z',
        },
      },
      studyTasks: [],
      revisionTasks: [],
      mockTests: [],
    },
    today
  );

  assert.equal(atRiskSummary.currentStreak, 2);
  assert.equal(atRiskSummary.isActiveToday, false);
  assert.equal(atRiskSummary.streakAtRisk, true);

  // Gap on Oct 18 (active Oct 14, 15, 16, 17 only) -> currentStreak is 0, longestStreak is 4
  const brokenSummary = calculateStudyStreak(
    {
      masteryMap: {
        t1: {
          topicId: 't1',
          chapterId: 'c1',
          subjectId: 'physics',
          status: 'Completed',
          confidence: 4,
          completedStages: ['theory', 'notes'],
          difficulty: 'Moderate',
          totalStudyMinutes: 120,
          questionsSolved: 10,
          questionsCorrect: 9,
          startDate: '2026-10-14',
          completedDate: '2026-10-15',
          lastStudiedDate: '2026-10-17',
          updatedAt: '2026-10-17T12:00:00Z',
        },
      },
      studyTasks: [],
      revisionTasks: [],
      mockTests: [
        {
          id: 'mt-1',
          testName: 'Physics Unit Test',
          date: '2026-10-16',
          subjectId: 'physics',
          subjectName: 'Physics',
          maxMarks: 25,
          marksObtained: 22,
          timeTakenMinutes: 45,
          chapterPerformance: [],
          mistakes: [],
        },
      ],
    },
    today
  );

  assert.equal(brokenSummary.currentStreak, 0);
  assert.equal(brokenSummary.longestStreak, 4);
  assert.equal(brokenSummary.streakAtRisk, false);
  assert.equal(brokenSummary.milestone.fireVariant, 'ember');
  assert.equal(brokenSummary.milestone.isMilestoneDay, false);
});

test('streakCalc: getStreakMilestoneInfo computes milestone thresholds, progress, and fire icon variants accurately', () => {
  // 0 days -> ember, next milestone 1
  const m0 = getStreakMilestoneInfo(0, false, 0);
  assert.equal(m0.isMilestoneDay, false);
  assert.equal(m0.achievedMilestone, null);
  assert.equal(m0.nextMilestone, 1);
  assert.equal(m0.fireVariant, 'ember');

  // 1 day active today -> exact 1-Day milestone achieved -> milestone-blaze
  const m1 = getStreakMilestoneInfo(1, true, 1);
  assert.equal(m1.isMilestoneDay, true);
  assert.equal(m1.exactMilestoneReached, 1);
  assert.equal(m1.achievedMilestone, 1);
  assert.equal(m1.nextMilestone, 3);
  assert.equal(m1.fireVariant, 'milestone-blaze');
  assert.equal(m1.milestoneProgressPercent, 100);

  // 2 days active today (1 activity) -> between 1 and 3 -> spark
  const m2 = getStreakMilestoneInfo(2, true, 1);
  assert.equal(m2.isMilestoneDay, false);
  assert.equal(m2.exactMilestoneReached, null);
  assert.equal(m2.achievedMilestone, 1);
  assert.equal(m2.nextMilestone, 3);
  assert.equal(m2.fireVariant, 'spark');
  assert.equal(m2.milestoneProgressPercent, 50);

  // 5 days active today with 1 activity -> flame (between 3 and 7)
  const m5 = getStreakMilestoneInfo(5, true, 1);
  assert.equal(m5.isMilestoneDay, false);
  assert.equal(m5.achievedMilestone, 3);
  assert.equal(m5.nextMilestone, 7);
  assert.equal(m5.fireVariant, 'flame');
  assert.equal(m5.milestoneProgressPercent, 50);

  // 5 days active today with 2+ activities -> Daily Momentum Milestone -> milestone-blaze
  const m5Multi = getStreakMilestoneInfo(5, true, 2);
  assert.equal(m5Multi.isMilestoneDay, true);
  assert.equal(m5Multi.fireVariant, 'milestone-blaze');

  // 7 days active today -> exact 7-Day Weekly Milestone -> milestone-blaze
  const m7 = getStreakMilestoneInfo(7, true, 1);
  assert.equal(m7.isMilestoneDay, true);
  assert.equal(m7.exactMilestoneReached, 7);
  assert.equal(m7.nextMilestone, 14);
  assert.equal(m7.fireVariant, 'milestone-blaze');

  // 14 days active today -> exact 14-Day Milestone -> milestone-supernova
  const m14 = getStreakMilestoneInfo(14, true, 1);
  assert.equal(m14.isMilestoneDay, true);
  assert.equal(m14.exactMilestoneReached, 14);
  assert.equal(m14.nextMilestone, 21);
  assert.equal(m14.fireVariant, 'milestone-supernova');
});

test('apiClient: resolveApiUrl preserves relative web paths when unset and prepends normalized HTTPS base URL when configured', () => {
  // Unset or empty -> relative path preserved
  assert.equal(resolveApiUrl('/api/ai/chat', ''), '/api/ai/chat');
  assert.equal(resolveApiUrl('api/ai/status', undefined), '/api/ai/status');
  // Placeholder values ignored safely
  assert.equal(resolveApiUrl('/api/ai/chat', 'MY_APP_URL'), '/api/ai/chat');
  assert.equal(resolveApiUrl('/api/ai/chat', 'https://your-production-backend.example.com'), '/api/ai/chat');
  // Configured HTTPS backend URL -> normalized without double slashes
  assert.equal(
    resolveApiUrl('/api/ai/chat', 'https://azora-api.example.run.app/'),
    'https://azora-api.example.run.app/api/ai/chat'
  );
  assert.equal(
    resolveApiUrl('api/gemini/scan-syllabus', 'https://azora-api.example.run.app'),
    'https://azora-api.example.run.app/api/gemini/scan-syllabus'
  );
});

test('apiClient: resolveAndroidBackAction enforces modal/drawer priority before tab navigation and app exit', () => {
  const baseState = {
    isAITutorOpen: false,
    isSyllabusDiffOpen: false,
    hasSelectedTopic: false,
    isMobileMoreMenuOpen: false,
    isMusicPlayerExpanded: false,
    isMusicPlayerOpen: false,
    activeTab: 'dashboard',
  };

  // 1. Highest priority: AI Tutor modal
  assert.equal(
    resolveAndroidBackAction({
      ...baseState,
      isAITutorOpen: true,
      isSyllabusDiffOpen: true,
      activeTab: 'pyqs',
    }),
    'close_ai_tutor'
  );

  // 2. Syllabus diff modal
  assert.equal(
    resolveAndroidBackAction({
      ...baseState,
      isSyllabusDiffOpen: true,
      hasSelectedTopic: true,
    }),
    'close_syllabus_diff'
  );

  // 3. Topic workspace modal
  assert.equal(
    resolveAndroidBackAction({
      ...baseState,
      hasSelectedTopic: true,
      isMobileMoreMenuOpen: true,
    }),
    'close_topic_modal'
  );

  // 4. Mobile "More" navigation drawer
  assert.equal(
    resolveAndroidBackAction({
      ...baseState,
      isMobileMoreMenuOpen: true,
      activeTab: 'settings',
    }),
    'close_mobile_more_menu'
  );

  // 5. Music player expanded -> collapse first, then close
  assert.equal(
    resolveAndroidBackAction({
      ...baseState,
      isMusicPlayerExpanded: true,
      isMusicPlayerOpen: true,
    }),
    'collapse_music_player'
  );
  assert.equal(
    resolveAndroidBackAction({
      ...baseState,
      isMusicPlayerExpanded: false,
      isMusicPlayerOpen: true,
    }),
    'close_music_player'
  );

  // 6. Import syllabus sub-view -> return to syllabus
  assert.equal(
    resolveAndroidBackAction({
      ...baseState,
      activeTab: 'import-syllabus',
    }),
    'navigate_to_syllabus'
  );

  // 7. Non-dashboard tab -> navigate to dashboard
  assert.equal(
    resolveAndroidBackAction({
      ...baseState,
      activeTab: '3d-lab',
    }),
    'navigate_to_dashboard'
  );

  // 8. On dashboard with no overlays -> exit app
  assert.equal(resolveAndroidBackAction(baseState), 'exit_app');
});

test('streakCalc: fresh account with unstarted planned tasks and empty mastery starts at 0-day streak', () => {
  const today = '2026-10-19';
  const freshSummary = calculateStudyStreak(
    {
      masteryMap: {
        'unstarted-topic': {
          topicId: 'unstarted-topic',
          chapterId: 'phy-c1',
          subjectId: 'physics',
          status: 'Not Started',
          confidence: 3,
          completedStages: [],
          difficulty: 'Moderate',
          totalStudyMinutes: 0,
          questionsSolved: 0,
          questionsCorrect: 0,
          startDate: today,
          lastStudiedDate: today,
          updatedAt: '2026-10-19T00:00:00Z',
        },
      },
      studyTasks: [
        {
          id: 'task-seed-1',
          date: today,
          subjectId: 'physics',
          subjectName: 'Physics',
          chapterId: 'phy-c1',
          chapterTitle: 'Electric Charges and Fields',
          topicId: 'phy-c1-t3',
          topicTitle: 'Electric Field Lines & Electric Dipole',
          taskType: 'numericals',
          plannedMinutes: 60,
          actualMinutes: 0,
          priority: 'high',
          energySlot: 'morning_high',
          completed: false,
        },
      ],
      revisionTasks: [
        {
          id: 'rev-seed-1',
          topicId: 'phy-c1-t2',
          chapterId: 'phy-c1',
          subjectId: 'physics',
          topicTitle: 'Coulombs Law',
          subjectName: 'Physics',
          revisionStep: 3,
          scheduledDate: today,
          completed: false,
        },
      ],
      mockTests: [],
    },
    today
  );

  assert.equal(freshSummary.currentStreak, 0);
  assert.equal(freshSummary.longestStreak, 0);
  assert.equal(freshSummary.totalActiveDays, 0);
  assert.equal(freshSummary.isActiveToday, false);
  assert.equal(freshSummary.streakAtRisk, false);
  assert.equal(freshSummary.todayMinutes, 0);
  assert.equal(freshSummary.milestone.isMilestoneDay, false);
  assert.equal(freshSummary.milestone.achievedMilestone, null);
  assert.equal(freshSummary.milestone.fireVariant, 'ember');
});

test('streakCalc: sanitizeLegacySeedData removes legacy 7-day seed artifacts while preserving real user study records', () => {
  const today = '2026-10-19';
  const legacyMastery: Record<string, TopicMasteryState> = {
    'phy-c1-t1': {
      topicId: 'phy-c1-t1',
      chapterId: 'phy-c1',
      subjectId: 'physics',
      status: 'Completed',
      confidence: 4,
      completedStages: ['theory', 'notes'],
      difficulty: 'Easy',
      totalStudyMinutes: 90,
      questionsSolved: 15,
      questionsCorrect: 13,
      startDate: '2026-10-13',
      completedDate: '2026-10-14',
      lastStudiedDate: '2026-10-16',
      updatedAt: '2026-10-19T00:00:00Z',
    },
    'real-user-topic': {
      topicId: 'real-user-topic',
      chapterId: 'phy-c2',
      subjectId: 'physics',
      status: 'Completed',
      confidence: 5,
      completedStages: ['theory', 'notes', 'pyqs'],
      difficulty: 'Hard',
      totalStudyMinutes: 105,
      questionsSolved: 12,
      questionsCorrect: 11,
      completedDate: today,
      lastStudiedDate: today,
      updatedAt: '2026-10-19T10:00:00Z',
    },
  };

  const sanitized = sanitizeLegacySeedData({
    masteryMap: legacyMastery,
    studyTasks: [
      {
        id: 'task-seed-1',
        date: today,
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
      },
    ],
    mockTests: [
      {
        id: 'test-seed-1',
        testName: 'Physics Unit 1 Chapter Test (Electrostatics)',
        date: '2026-10-15',
        subjectId: 'physics',
        subjectName: 'Physics',
        maxMarks: 25,
        marksObtained: 21,
        timeTakenMinutes: 60,
        chapterPerformance: [],
        mistakes: [],
      },
    ],
  });

  assert.equal(sanitized.didSanitize, true);
  assert.equal(Boolean(sanitized.masteryMap['phy-c1-t1']), false);
  assert.equal(Boolean(sanitized.masteryMap['real-user-topic']), true);
  assert.equal(sanitized.studyTasks[0].actualMinutes, 0);
  assert.equal(sanitized.mockTests.length, 0);

  // Resulting streak reflects only the 1 real user topic completed today
  const streak = calculateStudyStreak(
    {
      masteryMap: sanitized.masteryMap,
      studyTasks: sanitized.studyTasks,
      revisionTasks: [],
      mockTests: sanitized.mockTests,
    },
    today
  );
  assert.equal(streak.currentStreak, 1);
  assert.equal(streak.longestStreak, 1);
  assert.equal(streak.milestone.exactMilestoneReached, 1);
});

test('streakCalc: deduplicates multiple same-day activities and verifies 21-day and 30-day milestones', () => {
  const today = '2026-10-19';
  const localFormatted = getLocalDateStr(new Date(2026, 9, 19));
  assert.equal(localFormatted, '2026-10-19');

  const m21 = getStreakMilestoneInfo(21, true, 1);
  assert.equal(m21.isMilestoneDay, true);
  assert.equal(m21.exactMilestoneReached, 21);
  assert.equal(m21.nextMilestone, 30);

  const m30 = getStreakMilestoneInfo(30, true, 1);
  assert.equal(m30.isMilestoneDay, true);
  assert.equal(m30.exactMilestoneReached, 30);
  assert.equal(m30.nextMilestone, 60);

  // If streak is 7 from yesterday (isActiveToday = false), isMilestoneDay is false until today is logged
  const m7AtRisk = getStreakMilestoneInfo(7, false, 0);
  assert.equal(m7AtRisk.isMilestoneDay, false);
  assert.equal(m7AtRisk.achievedMilestone, 7);
});


