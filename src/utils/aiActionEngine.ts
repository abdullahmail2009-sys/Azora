import type {
  Subject,
  TopicMasteryState,
  DailyStudyTask,
  SpacedRevisionTask,
  PYQRecord,
  UserPreferences,
  AIActionProposal,
  TopicStatus,
  AITutorMode,
  SubjectResource,
} from '../types/index.ts';
import { buildHierarchicalBacklog } from './backlogEngine.ts';
import { calculateTopicIntelligence } from './pyqIntelligenceEngine.ts';

export interface ParsedAIResponse {
  reply: string;
  actions: AIActionProposal[];
  tutorMode?: AITutorMode;
  isAcademicTutorQuery?: boolean;
  selectiveContext?: string;
  matchedTopics: {
    topicId: string;
    topicTitle: string;
    chapterTitle: string;
    subjectName: string;
    status: TopicStatus;
    priority: string;
  }[];
}

export const AI_TUTOR_MODES: {
  id: AITutorMode;
  label: string;
  shortLabel: string;
  description: string;
  systemPromptDirective: string;
}[] = [
  {
    id: 'concept_teacher',
    label: 'Concept Teacher',
    shortLabel: 'Concept',
    description: 'Clear Class 12 conceptual explanation with definitions, SI units, formulas, and board exam tips.',
    systemPromptDirective:
      'Explain the concept clearly at an RBSE Class 12 level. State definitions, physical/chemical/mathematical meaning, standard formulas with full symbol names and SI units, and 1-2 common board mistakes to avoid.',
  },
  {
    id: 'guided_tutor',
    label: 'Guided Socratic Tutor',
    shortLabel: 'Guided',
    description: 'Step-by-step guided hints and check-for-understanding questions before revealing the full answer.',
    systemPromptDirective:
      'Guide the student step-by-step. Break the concept into 3 progressive steps, give a clear hint for the key step, and provide the complete solution below so they are never blocked.',
  },
  {
    id: 'board_examiner',
    label: 'RBSE Board Examiner',
    shortLabel: 'Examiner',
    description: 'Step-wise RBSE marking scheme breakdown (1M / 2M / 4M) and how to write full-mark answers.',
    systemPromptDirective:
      'Act as an official RBSE Class 12 Board Examiner. Present the exact step-wise marking breakdown (e.g., 0.5M formula, 1M diagram/substitution, 0.5M final answer with SI unit) and highlight keywords examiners look for.',
  },
  {
    id: 'numerical_solver',
    label: 'Numerical Problem Solver',
    shortLabel: 'Numerical',
    description: 'Given data, formula selection, unit conversion, step-by-step substitution, and final check.',
    systemPromptDirective:
      'Solve or set up the numerical problem using the strict 5-step board format: (1) Given Data with SI conversions, (2) Formula Used with symbol definitions, (3) Step-by-Step Substitution, (4) Final Answer with SI Unit, (5) Sanity Check.',
  },
  {
    id: 'derivation_coach',
    label: 'Derivation & Proof Coach',
    shortLabel: 'Derivation',
    description: 'Assumptions, diagram description, mathematical steps, and boundary/special cases.',
    systemPromptDirective:
      'Structure the derivation or proof for RBSE 3-mark and 4-mark board questions: (1) Statement & Assumptions, (2) Labeled Diagram Description, (3) Step-by-Step Mathematical Derivation, (4) Final Boxed Expression & Special Cases.',
  },
  {
    id: 'revision_coach',
    label: 'Rapid Revision Coach',
    shortLabel: 'Revision',
    description: 'High-yield summary sheet, key formulas, PYQ frequency, and 3 quick recall checks.',
    systemPromptDirective:
      'Create a high-yield 5-minute revision summary: key bullet points, must-memorize formulas/reactions, frequent RBSE PYQ angles, and 3 quick active-recall check questions.',
  },
  {
    id: 'doubt_solver',
    label: 'Doubt & Misconception Solver',
    shortLabel: 'Doubt Solver',
    description: 'Pinpoints the root conceptual confusion, contrasts wrong vs. right intuition, and gives a rule of thumb.',
    systemPromptDirective:
      'Directly resolve the student’s doubt or misconception: (1) Identify the exact point of confusion, (2) Contrast the common trap vs. the correct Class 12 principle, (3) Give a memorable rule-of-thumb.',
  },
];

const WORD_NUMBERS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  fourteen: 14,
  fifteen: 15,
  twenty: 20,
  thirty: 30,
};

function parseNumberFromText(text: string, fallback: number): number {
  const numMatch = text.match(/\b(\d+)\b/);
  if (numMatch) return parseInt(numMatch[1], 10);
  const lower = text.toLowerCase();
  for (const [word, val] of Object.entries(WORD_NUMBERS)) {
    if (new RegExp(`\\b${word}\\b`, 'i').test(lower)) return val;
  }
  return fallback;
}

/**
 * Finds a topic or chapter in the user's syllabus from natural language text.
 */
export function findTargetTopicOrChapter(
  query: string,
  subjects: Subject[]
): {
  subject?: Subject;
  chapter?: {
    id: string;
    unitId: string;
    title: string;
    subjectId: string;
    subjectName: string;
    officialWeightageMarks?: number;
  };
  topic?: {
    id: string;
    title: string;
    subtopics: string[];
    chapterId: string;
    chapterTitle: string;
    unitId: string;
    subjectId: string;
    subjectName: string;
    estimatedHours: number;
    difficulty: 'Easy' | 'Moderate' | 'Hard';
  };
} {
  const lower = query.toLowerCase();

  let matchedSubject: Subject | undefined;
  for (const sub of subjects) {
    if (
      lower.includes(sub.name.toLowerCase()) ||
      lower.includes(sub.id.toLowerCase()) ||
      (sub.name.toLowerCase() === 'mathematics' && /\bmath(s)?\b/.test(lower)) ||
      (sub.id === 'physics' && /भौतिक/.test(lower)) ||
      (sub.id === 'chemistry' && /रसायन/.test(lower)) ||
      (sub.id === 'mathematics' && /गणित/.test(lower))
    ) {
      matchedSubject = sub;
      break;
    }
  }

  let bestTopic: {
    id: string;
    title: string;
    subtopics: string[];
    chapterId: string;
    chapterTitle: string;
    unitId: string;
    subjectId: string;
    subjectName: string;
    estimatedHours: number;
    difficulty: 'Easy' | 'Moderate' | 'Hard';
    score: number;
  } | null = null;

  let bestChapter: {
    id: string;
    unitId: string;
    title: string;
    subjectId: string;
    subjectName: string;
    officialWeightageMarks?: number;
    score: number;
  } | null = null;

  for (const sub of subjects) {
    for (const unit of sub.units) {
      if (unit.isArchived) continue;
      for (const chap of unit.chapters) {
        if (chap.isArchived || chap.isExcluded) continue;
        const cTitle = chap.title.toLowerCase();
        if (
          lower.includes(cTitle) ||
          (unit.title &&
            lower.includes(unit.title.toLowerCase().replace(/^unit\s*\d+\s*:\s*/i, '')))
        ) {
          const score = cTitle.length;
          if (!bestChapter || score > bestChapter.score) {
            bestChapter = {
              id: chap.id,
              unitId: unit.id,
              title: chap.title,
              subjectId: sub.id,
              subjectName: sub.name,
              officialWeightageMarks: chap.officialWeightageMarks,
              score,
            };
          }
        }

        for (const topic of chap.topics) {
          if (topic.isArchived || topic.isExcluded) continue;
          const tTitle = topic.title.toLowerCase();
          if (lower.includes(tTitle)) {
            const score = tTitle.length + 10;
            if (!bestTopic || score > bestTopic.score) {
              bestTopic = {
                id: topic.id,
                title: topic.title,
                subtopics: topic.subtopics.map((st) => st.title),
                chapterId: chap.id,
                chapterTitle: chap.title,
                unitId: unit.id,
                subjectId: sub.id,
                subjectName: sub.name,
                estimatedHours: topic.estimatedHours || 2,
                difficulty: topic.difficulty || 'Moderate',
                score,
              };
            }
          } else {
            const words = `${tTitle} ${topic.subtopics.map((st) => st.title.toLowerCase()).join(' ')}`
              .replace(/[^a-z0-9\s]/g, ' ')
              .split(/\s+/)
              .filter((w) => w.length >= 4);
            if (words.length > 0) {
              const matchedWords = words.filter((w) => lower.includes(w));
              if (
                matchedWords.length >= Math.min(2, words.length) &&
                matchedWords.length / Math.min(4, words.length) >= 0.5
              ) {
                const score = matchedWords.length * 4;
                if (!bestTopic || score > bestTopic.score) {
                  bestTopic = {
                    id: topic.id,
                    title: topic.title,
                    subtopics: topic.subtopics.map((st) => st.title),
                    chapterId: chap.id,
                    chapterTitle: chap.title,
                    unitId: unit.id,
                    subjectId: sub.id,
                    subjectName: sub.name,
                    estimatedHours: topic.estimatedHours || 2,
                    difficulty: topic.difficulty || 'Moderate',
                    score,
                  };
                }
              }
            }
          }
        }
      }
    }
  }

  return {
    subject: matchedSubject,
    chapter: bestChapter
      ? {
          id: bestChapter.id,
          unitId: bestChapter.unitId,
          title: bestChapter.title,
          subjectId: bestChapter.subjectId,
          subjectName: bestChapter.subjectName,
          officialWeightageMarks: bestChapter.officialWeightageMarks,
        }
      : undefined,
    topic: bestTopic
      ? {
          id: bestTopic.id,
          title: bestTopic.title,
          subtopics: bestTopic.subtopics,
          chapterId: bestTopic.chapterId,
          chapterTitle: bestTopic.chapterTitle,
          unitId: bestTopic.unitId,
          subjectId: bestTopic.subjectId,
          subjectName: bestTopic.subjectName,
          estimatedHours: bestTopic.estimatedHours,
          difficulty: bestTopic.difficulty,
        }
      : undefined,
  };
}

/**
 * Builds a rich, syllabus-grounded academic explanation or tutor response using the student's actual
 * syllabus hierarchy, saved formulas/derivations, PYQs, and mastery state.
 */
export function buildSyllabusGroundedTutorResponse(
  query: string,
  tutorMode: AITutorMode,
  state: {
    subjects: Subject[];
    masteryMap: Record<string, TopicMasteryState>;
    pyqs: PYQRecord[];
    resources?: SubjectResource[];
  }
): {
  reply: string;
  selectiveContext: string;
  matchedTopic?: ReturnType<typeof findTargetTopicOrChapter>['topic'];
} {
  const target = findTargetTopicOrChapter(query, state.subjects);
  const modeMeta = AI_TUTOR_MODES.find((m) => m.id === tutorMode) || AI_TUTOR_MODES[0];

  const topic = target.topic;
  const chapter = target.chapter;
  const subject = target.subject;

  // Gather related PYQs
  const relatedPyqs = state.pyqs.filter((p) => {
    if (topic && p.topicId === topic.id) return true;
    if (chapter && p.chapterId === chapter.id) return true;
    if (topic && p.questionText.toLowerCase().includes(topic.title.split(' ')[0].toLowerCase()))
      return true;
    return false;
  });

  // Gather related formulas / derivations / notes
  const relatedResources = (state.resources || []).filter((r) => {
    if (topic && r.topicId === topic.id) return true;
    if (chapter && r.chapterId === chapter.id) return true;
    if (topic && r.title.toLowerCase().includes(topic.title.split(' ')[0].toLowerCase()))
      return true;
    return false;
  });

  const mastery = topic ? state.masteryMap[topic.id] : undefined;

  const contextLines: string[] = [
    `Tutor Mode: ${modeMeta.label} (${modeMeta.systemPromptDirective})`,
  ];

  if (topic) {
    contextLines.push(
      `Matched Syllabus Topic: "${topic.title}" in Chapter "${topic.chapterTitle}" (${topic.subjectName}).`
    );
    if (topic.subtopics.length > 0) {
      contextLines.push(`Official Subtopics: ${topic.subtopics.join(', ')}.`);
    }
    contextLines.push(
      `Student Mastery Status: ${mastery?.status || 'Not Started'}, Confidence: ${
        mastery?.confidence || 3
      }/5, Study Time Logged: ${mastery?.totalStudyMinutes || 0} mins.`
    );
    if (mastery?.notes) contextLines.push(`Student Saved Notes: ${mastery.notes}`);
    if (mastery?.formulas) contextLines.push(`Student Saved Formulas: ${mastery.formulas}`);
  } else if (chapter) {
    contextLines.push(
      `Matched Syllabus Chapter: "${chapter.title}" (${chapter.subjectName})${
        chapter.officialWeightageMarks ? ` · Official Weightage: ${chapter.officialWeightageMarks} Marks` : ''
      }.`
    );
  } else if (subject) {
    contextLines.push(`Matched Subject: ${subject.name}.`);
  }

  if (relatedResources.length > 0) {
    contextLines.push(
      `Relevant Formula / Derivation Records:\n` +
        relatedResources
          .slice(0, 3)
          .map(
            (r) =>
              `- [${r.type.toUpperCase()}] ${r.title}: ${r.content}${
                r.symbolsAndUnits
                  ? ` (Units: ${r.symbolsAndUnits.map((s) => `${s.symbol}=${s.name} [${s.siUnit}]`).join(', ')})`
                  : ''
              }`
          )
          .join('\n')
    );
  }

  if (relatedPyqs.length > 0) {
    contextLines.push(
      `Verified PYQ Evidence (${relatedPyqs.length} questions):\n` +
        relatedPyqs
          .slice(0, 3)
          .map((q) => `- [${q.examYear} · ${q.marks}M · ${q.questionType || 'Board Q'}] ${q.questionText}`)
          .join('\n')
    );
  }

  const selectiveContext = contextLines.join('\n');

  // Build structured deterministic academic guide (used immediately and enhanced when cloud AI is active)
  const sections: string[] = [];
  const headerTitle = topic
    ? `${topic.title} (${topic.subjectName} · ${topic.chapterTitle})`
    : chapter
    ? `${chapter.title} (${chapter.subjectName})`
    : subject
    ? `${subject.name} — RBSE Class 12`
    : `RBSE Class 12 Academic Guidance`;

  sections.push(`### ${modeMeta.label}: ${headerTitle}`);

  if (topic && topic.subtopics.length > 0) {
    sections.push(`**Syllabus Scope & Subtopics:**\n• ${topic.subtopics.join('\n• ')}`);
  }

  if (relatedResources.length > 0) {
    const resLines = relatedResources.slice(0, 3).map((r) => {
      const unitInfo =
        r.symbolsAndUnits && r.symbolsAndUnits.length > 0
          ? `\n  *Symbols & SI Units:* ${r.symbolsAndUnits
              .map((s) => `${s.symbol} = ${s.name} (${s.siUnit})`)
              .join('; ')}`
          : '';
      return `• **${r.title}** (${r.type.toUpperCase()}):\n  ${r.content}${unitInfo}`;
    });
    sections.push(`**Core Formulas, Derivations & Key Concepts:**\n${resLines.join('\n\n')}`);
  } else if (topic) {
    sections.push(
      `**Step-by-StepRBSE Board Framework (${modeMeta.shortLabel}):**\n` +
        `1. **Core Definition & Principle:** State the fundamental law or definition of *${topic.title}* clearly with standard conditions.\n` +
        `2. **Mathematical Expression & SI Units:** Write the governing formula, define every symbol, and state the SI unit and dimensional formula.\n` +
        `3. **Board Marking Scheme Tip:** In RBSE 2-mark and 4-mark questions on *${topic.title}*, always include a neat labeled diagram/circuit or balanced equation (carries 0.5 to 1 mark) and box the final expression.`
    );
  } else {
    sections.push(
      `**RBSE Class 12 Study Guidance (${modeMeta.shortLabel}):**\n` +
        `• Focus on official NCERT/RBSE textbook definitions, step-by-step derivations, and SI units.\n` +
        `• Mention a specific chapter or topic name (e.g., *"Explain Gauss's Law"*, *"Derive Lens Maker's Formula"*, *"Solve Nernst Equation numerical"*) to pull linked formulas and board PYQs from your syllabus.`
    );
  }

  if (relatedPyqs.length > 0) {
    const pyqLines = relatedPyqs
      .slice(0, 3)
      .map(
        (q) =>
          `• **[${q.examYear} · ${q.marks} Marks · ${q.questionType || 'Board'}]** ${q.questionText}${
            q.solution ? `\n  *Key / Model Answer:* ${q.solution}` : ''
          }`
      );
    sections.push(`**Previous Year Board Questions (PYQ Evidence):**\n${pyqLines.join('\n')}`);
  }

  if (mastery) {
    sections.push(
      `**Your Current Mastery State:** Status: **${mastery.status}** · Confidence: **${mastery.confidence}/5** · Logged Time: **${mastery.totalStudyMinutes} mins**.`
    );
  }

  return {
    reply: sections.join('\n\n'),
    selectiveContext,
    matchedTopic: topic,
  };
}

/**
 * Evaluates a user's natural language prompt against the live application state
 * and produces executable actions + data views + academic tutor guidance.
 */
export function processAIInstruction(
  userPrompt: string,
  state: {
    subjects: Subject[];
    masteryMap: Record<string, TopicMasteryState>;
    studyTasks: DailyStudyTask[];
    revisionTasks: SpacedRevisionTask[];
    pyqs: PYQRecord[];
    preferences: UserPreferences;
    resources?: SubjectResource[];
  },
  todayStr: string = new Date().toISOString().split('T')[0],
  activeTutorMode: AITutorMode = 'concept_teacher'
): ParsedAIResponse {
  const prompt = userPrompt.trim();
  const lower = prompt.toLowerCase();
  const actions: AIActionProposal[] = [];
  const matchedTopics: ParsedAIResponse['matchedTopics'] = [];

  const target = findTargetTopicOrChapter(prompt, state.subjects);
  const allowAutoComplete = Boolean(state.preferences.autoCompleteFromStages);

  // 1. Check for Persistent Preference / Rule instructions
  if (
    /\b(always|never|do not mark topics complete automatically|from now on|in future|remember to)\b/i.test(
      lower
    )
  ) {
    let category: 'prioritization' | 'backlog' | 'planner' | 'dashboard' | 'completion' | 'general' =
      'general';
    const prefUpdates: Partial<UserPreferences> = {};

    if (/rank.*pyq|prioritize.*pyq/i.test(lower)) {
      category = 'prioritization';
      prefUpdates.alwaysRankByPYQ = true;
    } else if (/do not mark.*complete automatically|never.*auto.*complete/i.test(lower)) {
      category = 'completion';
      prefUpdates.autoCompleteFromStages = false;
    } else if (/high[\s-]*priority.*home/i.test(lower)) {
      category = 'dashboard';
      prefUpdates.showOnlyHighPriorityOnHome = true;
    } else if (/backlog.*group|subject and chapter/i.test(lower)) {
      category = 'backlog';
    } else if (/study hours|available.*hours/i.test(lower)) {
      category = 'planner';
    }

    actions.push({
      id: `act-rule-${Date.now()}`,
      type: 'SAVE_PERSISTENT_RULE',
      title: 'Save Persistent Personalization Rule',
      description: `Save rule: "${prompt}" and apply across all relevant screens.`,
      payload: {
        instruction: prompt,
        category,
        preferenceUpdates: prefUpdates,
      },
      requiresConfirmation: false,
    });

    return {
      reply: `Saved your personal preference: "${prompt}". I have updated your global settings and will apply this rule automatically across your dashboard, backlog, and study planner.`,
      actions,
      matchedTopics,
    };
  }

  // 2. Mark a topic as Completed / In Progress / Needs Revision / On Hold / Not Started
  if (
    /\b(mark|set|change)\b.*\b(completed|complete|done|in progress|needs revision|on hold|not started)\b/i.test(
      lower
    )
  ) {
    let newStatus: TopicStatus = 'Completed';
    if (/in progress/i.test(lower)) newStatus = 'In Progress';
    else if (/needs revision/i.test(lower)) newStatus = 'Needs Revision';
    else if (/on hold/i.test(lower)) newStatus = 'On Hold';
    else if (/not started/i.test(lower)) newStatus = 'Not Started';

    if (target.topic) {
      actions.push({
        id: `act-status-${Date.now()}`,
        type: 'MARK_TOPIC_STATUS',
        title: `Mark "${target.topic.title}" as ${newStatus}`,
        description: `Updates status of ${target.topic.title} (${target.topic.subjectName} · ${target.topic.chapterTitle}) to ${newStatus} and recalculates progress & backlog.`,
        payload: {
          topicId: target.topic.id,
          chapterId: target.topic.chapterId,
          subjectId: target.topic.subjectId,
          topicTitle: target.topic.title,
          status: newStatus,
        },
        requiresConfirmation: false,
      });

      return {
        reply: `Updated "${target.topic.title}" (${target.topic.subjectName} → ${target.topic.chapterTitle}) to **${newStatus}**. Your overall syllabus progress, subject breakdown, and backlog have been recalculated.`,
        actions,
        matchedTopics: [
          {
            topicId: target.topic.id,
            topicTitle: target.topic.title,
            chapterTitle: target.topic.chapterTitle,
            subjectName: target.topic.subjectName,
            status: newStatus,
            priority: 'Updated',
          },
        ],
      };
    }

    return {
      reply:
        'Which syllabus topic would you like me to update? Please mention the topic name (for example: *"Mark Electric Field Lines as completed"*).',
      actions: [],
      matchedTopics: [],
    };
  }

  // 3. Move or schedule a topic to tomorrow / today
  if (/\b(move|schedule|reschedule|push|shift)\b.*\b(tomorrow|today|next day)\b/i.test(lower)) {
    const isTomorrow = /\btomorrow|next day\b/i.test(lower);
    const baseDate = new Date(`${todayStr}T00:00:00`);
    if (isTomorrow) baseDate.setDate(baseDate.getDate() + 1);
    const targetDateStr = baseDate.toISOString().split('T')[0];

    if (target.topic) {
      actions.push({
        id: `act-move-${Date.now()}`,
        type: 'MOVE_TASK',
        title: `Schedule "${target.topic.title}" for ${isTomorrow ? 'Tomorrow' : 'Today'} (${targetDateStr})`,
        description: `Moves or creates a study session for ${target.topic.title} on ${targetDateStr}.`,
        payload: {
          topicId: target.topic.id,
          topicTitle: target.topic.title,
          chapterId: target.topic.chapterId,
          chapterTitle: target.topic.chapterTitle,
          subjectId: target.topic.subjectId,
          subjectName: target.topic.subjectName,
          targetDate: targetDateStr,
          plannedMinutes: state.preferences.sessionDurationMinutes || 60,
        },
        requiresConfirmation: false,
      });

      return {
        reply: `Scheduled **"${target.topic.title}"** (${target.topic.subjectName}) for **${
          isTomorrow ? 'tomorrow' : 'today'
        } (${targetDateStr})** in your Study Planner.`,
        actions,
        matchedTopics: [],
      };
    }
  }

  // 4. Change revision interval or daily study hours
  if (/\b(revision interval|spaced interval|revision schedule)\b/i.test(lower)) {
    const days = parseNumberFromText(lower, 7);
    const updatedIntervals = [days, days * 2, days * 4, days * 8];
    actions.push({
      id: `act-pref-rev-${Date.now()}`,
      type: 'UPDATE_PREFERENCE',
      title: `Set Revision Interval to ${days} Days`,
      description: `Updates spaced repetition base interval to ${days} days (${updatedIntervals.join(', ')}d).`,
      payload: {
        revisionIntervals: updatedIntervals,
      },
      requiresConfirmation: false,
    });

    return {
      reply: `Updated your revision interval to **${days} days** (progression: ${updatedIntervals.join(
        ' → '
      )} days) and saved it to your account preferences.`,
      actions,
      matchedTopics: [],
    };
  }

  if (/\b(change|set|update)\b.*\b(study hours|daily hours|available hours)\b/i.test(lower)) {
    const hours = parseNumberFromText(lower, 6);
    actions.push({
      id: `act-pref-hrs-${Date.now()}`,
      type: 'UPDATE_PREFERENCE',
      title: `Set Daily Study Hours to ${hours}h`,
      description: `Updates daily available study time to ${hours} hours/day.`,
      payload: {
        dailyStudyHoursLimit: hours,
      },
      requiresConfirmation: false,
    });

    return {
      reply: `Updated your daily available study hours to **${hours} hours/day**. Your Study Planner and backlog calculations now use this limit.`,
      actions,
      matchedTopics: [],
    };
  }

  // 5. Hide or show dashboard cards
  if (
    /\b(hide|remove|show|enable|display)\b.*\b(card|dashboard|pyq|countdown|backlog|weak|progress)\b/i.test(
      lower
    )
  ) {
    const isHide = /\b(hide|remove|disable)\b/i.test(lower);
    const currentCards = state.preferences.dashboardCards || {};
    const updatedCards = { ...currentCards };
    let cardLabel = 'Dashboard card';

    if (/pyq/i.test(lower)) {
      updatedCards.showPYQStats = !isHide;
      cardLabel = 'PYQ Statistics Card';
    } else if (/countdown|exam/i.test(lower)) {
      updatedCards.showCountdown = !isHide;
      cardLabel = 'Exam Countdown Card';
    } else if (/backlog/i.test(lower)) {
      updatedCards.showBacklogSummary = !isHide;
      cardLabel = 'Backlog Overview Card';
    } else if (/weak/i.test(lower)) {
      updatedCards.showWeakTopics = !isHide;
      cardLabel = 'High-Priority Unfinished / Weak Topics Card';
    } else if (/today|plan/i.test(lower)) {
      updatedCards.showTodayTasks = !isHide;
      cardLabel = "Today's Study Plan Card";
    }

    actions.push({
      id: `act-dash-${Date.now()}`,
      type: 'UPDATE_PREFERENCE',
      title: `${isHide ? 'Hide' : 'Show'} ${cardLabel}`,
      description: `Updates Home dashboard visibility for ${cardLabel}.`,
      payload: {
        dashboardCards: updatedCards,
      },
      requiresConfirmation: false,
    });

    return {
      reply: `${isHide ? 'Hidden' : 'Enabled'} the **${cardLabel}** on your Home dashboard and saved your layout preference.`,
      actions,
      matchedTopics: [],
    };
  }

  // 6. Import topic names via chat command
  if (/\bimport\b.*\btopic/i.test(lower) && (lower.includes(':') || lower.includes(','))) {
    const colonIdx = prompt.indexOf(':');
    const rawList = colonIdx !== -1 ? prompt.slice(colonIdx + 1) : prompt;
    const topicNames = rawList
      .split(/,|;|\n/)
      .map((s) => s.trim())
      .filter((s) => s.length >= 2 && !/^into\s+/i.test(s));

    if (topicNames.length > 0) {
      const targetSub = target.subject || state.subjects[0];
      const targetChap =
        target.chapter ||
        (targetSub?.units?.[0]?.chapters?.[0]
          ? {
              id: targetSub.units[0].chapters[0].id,
              unitId: targetSub.units[0].id,
              title: targetSub.units[0].chapters[0].title,
              subjectId: targetSub.id,
              subjectName: targetSub.name,
            }
          : undefined);

      if (targetChap) {
        actions.push({
          id: `act-import-topics-${Date.now()}`,
          type: 'IMPORT_TOPICS',
          title: `Import ${topicNames.length} Topics into ${targetChap.title}`,
          description: `Adds ${topicNames.join(', ')} under ${targetChap.subjectName} → ${targetChap.title}.`,
          payload: {
            subjectId: targetChap.subjectId,
            unitId: targetChap.unitId,
            chapterId: targetChap.id,
            chapterTitle: targetChap.title,
            topicTitles: topicNames,
          },
          requiresConfirmation: topicNames.length > 3,
        });

        return {
          reply:
            topicNames.length > 3
              ? `Prepared **${topicNames.length} topics** to import into **${targetChap.subjectName} → ${targetChap.title}**. Please review and confirm below:`
              : `Imported **${topicNames.length} topics** (${topicNames.join(', ')}) into **${targetChap.subjectName} → ${targetChap.title}**.`,
          actions,
          matchedTopics: [],
        };
      }
    }
  }

  // 7. Create a multi-day or chapter study plan using available study hours
  if (/\b(make a plan|create a.*plan|generate.*plan|schedule.*plan|finish it|recovery plan)\b/i.test(lower)) {
    const numDays = parseNumberFromText(lower, 7);
    const dailyHours = state.preferences.dailyStudyHoursLimit || 6;
    const sessionMins = state.preferences.sessionDurationMinutes || 60;
    const sessionsPerDay = Math.max(1, Math.floor((dailyHours * 60) / sessionMins));

    const backlog = buildHierarchicalBacklog(
      state.subjects,
      state.masteryMap,
      state.studyTasks,
      state.revisionTasks,
      state.pyqs,
      {
        subjectId: target.subject?.id,
        chapterId: target.chapter?.id,
      },
      todayStr,
      allowAutoComplete
    );

    const candidateTopics = backlog.flatTopics.slice(0, numDays * sessionsPerDay);

    if (candidateTopics.length === 0) {
      return {
        reply: `You have no unfinished backlog topics${
          target.chapter
            ? ` in ${target.chapter.title}`
            : target.subject
            ? ` in ${target.subject.name}`
            : ''
        } to schedule!`,
        actions: [],
        matchedTopics: [],
      };
    }

    const plannedTasks: Omit<DailyStudyTask, 'id'>[] = [];
    const startDate = new Date(`${todayStr}T00:00:00`);

    candidateTopics.forEach((item, idx) => {
      const dayOffset = Math.floor(idx / sessionsPerDay);
      const d = new Date(startDate);
      d.setDate(d.getDate() + dayOffset);
      const dateStr = d.toISOString().split('T')[0];

      plannedTasks.push({
        date: dateStr,
        subjectId: item.subjectId,
        subjectName: item.subjectName,
        chapterId: item.chapterId,
        chapterTitle: item.chapterTitle,
        topicId: item.topicId,
        topicTitle: item.topicTitle,
        taskType: item.status === 'Needs Revision' ? 'revision' : 'theory',
        plannedMinutes: sessionMins,
        actualMinutes: 0,
        priority: item.priority,
        energySlot: idx % 2 === 0 ? 'morning_high' : 'evening_high',
        completed: false,
        notes: `AI Study Plan (${dailyHours}h/day budget) · ${item.backlogReason}`,
      });
    });

    actions.push({
      id: `act-plan-${Date.now()}`,
      type: 'GENERATE_STUDY_PLAN',
      title: `Create ${numDays}-Day Study Plan (${plannedTasks.length} Sessions)`,
      description: `Schedules ${plannedTasks.length} unfinished topics across ${numDays} days using your ${dailyHours}h/day available study time.`,
      payload: {
        tasks: plannedTasks,
      },
      requiresConfirmation: false,
    });

    return {
      reply: `Created a **${numDays}-day study plan** with **${plannedTasks.length} study sessions** (${sessionMins} mins each, respecting your **${dailyHours}h/day** study limit)${
        target.chapter
          ? ` for **${target.chapter.title}**`
          : target.subject
          ? ` for **${target.subject.name}**`
          : ''
      }. Added directly to your Study Planner.`,
      actions,
      matchedTopics: candidateTopics.slice(0, 8).map((t) => ({
        topicId: t.topicId,
        topicTitle: t.topicTitle,
        chapterTitle: t.chapterTitle,
        subjectName: t.subjectName,
        status: t.status,
        priority:
          t.pyqPriorityLevel !== 'Insufficient PYQ evidence' ? t.pyqPriorityLevel : t.priority,
      })),
    };
  }

  // 8. Prioritize topics using uploaded PYQs or high-priority unstudied queries
  if (/\b(prioritize|rank|high[\s-]*priority)\b/i.test(lower)) {
    const intel = calculateTopicIntelligence(
      state.subjects,
      state.pyqs,
      state.masteryMap,
      allowAutoComplete
    );

    const filtered = intel.filter((item) => {
      if (target.subject && item.subjectId !== target.subject.id) return false;
      if (target.chapter && item.chapterId !== target.chapter.id) return false;
      if (/\b(not studied|unfinished|incomplete|unstudied)\b/i.test(lower) && item.isCompleted) {
        return false;
      }
      if (/\bhigh[\s-]*priority\b/i.test(lower)) {
        return item.priorityLevel === 'High Priority' || item.personalPriority === 'high';
      }
      return true;
    });

    const topItems = filtered.slice(0, 12);

    actions.push({
      id: `act-prio-${Date.now()}`,
      type: 'PRIORITIZE_BY_PYQ',
      title: 'Apply PYQ Evidence-Based Topic Ranking',
      description: `Ranks ${intel.length} syllabus topics by PYQ appearances, marks, and completion state.`,
      payload: {
        subjectId: target.subject?.id || 'all',
      },
      requiresConfirmation: false,
    });

    return {
      reply:
        topItems.length > 0
          ? `Ranked your${
              target.subject ? ` **${target.subject.name}**` : ''
            } topics using uploaded PYQ evidence and completion status. Found **${
              filtered.length
            } matching topics** (showing top ${topItems.length} below):`
          : `No matching high-priority unstudied topics found${
              target.subject ? ` in ${target.subject.name}` : ''
            }. Note: Topics without uploaded PYQs are labeled "Insufficient PYQ evidence".`,
      actions,
      matchedTopics: topItems.map((i) => ({
        topicId: i.topicId,
        topicTitle: i.topicTitle,
        chapterTitle: i.chapterTitle,
        subjectName: i.subjectName,
        status: i.completionStatus,
        priority: `${i.priorityLevel} (${i.pyqCount} PYQs · ${i.compulsoryPyqMarks}M)`,
      })),
    };
  }

  // 9. Show backlog / unfinished topics (by subject, chapter, or across all subjects)
  if (/\b(backlog|unfinished|incomplete|pending|not started)\b/i.test(lower)) {
    const backlog = buildHierarchicalBacklog(
      state.subjects,
      state.masteryMap,
      state.studyTasks,
      state.revisionTasks,
      state.pyqs,
      {
        subjectId: target.subject?.id || 'all',
        chapterId: target.chapter?.id || 'all',
      },
      todayStr,
      allowAutoComplete
    );

    const scopeLabel = target.chapter
      ? `${target.chapter.subjectName} → ${target.chapter.title}`
      : target.subject
      ? target.subject.name
      : 'All Subjects';

    actions.push({
      id: `act-nav-backlog-${Date.now()}`,
      type: 'NAVIGATE_FILTER',
      title: `Open ${scopeLabel} Backlog View`,
      description: `Opens the Backlog manager filtered to ${scopeLabel} (${backlog.totalUnfinishedTopics} unfinished topics).`,
      payload: {
        tab: 'backlog',
        subjectId: target.subject?.id || 'all',
        chapterId: target.chapter?.id || 'all',
      },
      requiresConfirmation: false,
    });

    return {
      reply: `Found **${backlog.totalUnfinishedTopics} unfinished topic${
        backlog.totalUnfinishedTopics === 1 ? '' : 's'
      }** in **${scopeLabel}** (${
        backlog.totalOverdueTopics
      } overdue). Here is the breakdown:`,
      actions,
      matchedTopics: backlog.flatTopics.slice(0, 15).map((t) => ({
        topicId: t.topicId,
        topicTitle: t.topicTitle,
        chapterTitle: t.chapterTitle,
        subjectName: t.subjectName,
        status: t.status,
        priority: t.priority.toUpperCase(),
      })),
    };
  }

  // 10. Academic / Conceptual / Derivation / Numerical / Exam Tutor Question
  const isAcademicQuestion =
    Boolean(target.topic || target.chapter) ||
    /\b(explain|derive|derivation|solve|calculate|what is|why|how|formula|reaction|theorem|law|proof|numerical|question|quiz|viva|mistake|doubt|concept|exam tip)\b/i.test(
      lower
    );

  if (isAcademicQuestion) {
    // Infer tutor mode from prompt if not explicitly changed
    let inferredMode: AITutorMode = activeTutorMode;
    if (/\b(derive|derivation|proof|prove)\b/i.test(lower)) inferredMode = 'derivation_coach';
    else if (/\b(calculate|numerical|solve|find the value)\b/i.test(lower))
      inferredMode = 'numerical_solver';
    else if (/\b(marking scheme|examiner|board marks|how to write)\b/i.test(lower))
      inferredMode = 'board_examiner';
    else if (/\b(revise|summary|quick revision)\b/i.test(lower)) inferredMode = 'revision_coach';
    else if (/\b(doubt|confused|mistake|why not)\b/i.test(lower)) inferredMode = 'doubt_solver';

    const tutorRes = buildSyllabusGroundedTutorResponse(prompt, inferredMode, {
      subjects: state.subjects,
      masteryMap: state.masteryMap,
      pyqs: state.pyqs,
      resources: state.resources,
    });

    if (tutorRes.matchedTopic) {
      const m = state.masteryMap[tutorRes.matchedTopic.id];
      matchedTopics.push({
        topicId: tutorRes.matchedTopic.id,
        topicTitle: tutorRes.matchedTopic.title,
        chapterTitle: tutorRes.matchedTopic.chapterTitle,
        subjectName: tutorRes.matchedTopic.subjectName,
        status: m?.status || 'Not Started',
        priority: tutorRes.matchedTopic.difficulty,
      });

      actions.push({
        id: `act-rev-${Date.now()}`,
        type: 'SCHEDULE_REVISION',
        title: `Schedule Revision for "${tutorRes.matchedTopic.title}"`,
        description: `Adds a spaced revision task for ${tutorRes.matchedTopic.title} to reinforce this concept.`,
        payload: {
          topicId: tutorRes.matchedTopic.id,
          topicTitle: tutorRes.matchedTopic.title,
          chapterId: tutorRes.matchedTopic.chapterId,
          subjectId: tutorRes.matchedTopic.subjectId,
          subjectName: tutorRes.matchedTopic.subjectName,
          scheduledDate: todayStr,
        },
        requiresConfirmation: true,
      });
    }

    return {
      reply: tutorRes.reply,
      actions,
      tutorMode: inferredMode,
      isAcademicTutorQuery: true,
      selectiveContext: tutorRes.selectiveContext,
      matchedTopics,
    };
  }

  // Default helpful summary with current syllabus & backlog stats
  const fullBacklog = buildHierarchicalBacklog(
    state.subjects,
    state.masteryMap,
    state.studyTasks,
    state.revisionTasks,
    state.pyqs,
    {},
    todayStr,
    allowAutoComplete
  );

  return {
    reply: `I have live access to your RBSE Class 12 syllabus (${state.subjects.length} subjects), ${fullBacklog.totalUnfinishedTopics} unfinished backlog topics, ${state.pyqs.length} PYQ records, and your formula/derivation bank. You can ask me to:\n• **Explain Concepts & Derivations:** *"Explain Gauss's Law with board marking scheme"* or *"Derive Lens Maker's Formula"*\n• **Manage Backlog:** *"Show my Physics backlog"* or *"Show every unfinished topic in Electrostatics"*\n• **Update Progress:** *"Mark Electric Field Lines as completed"*\n• **Build Study Plans:** *"Create a 7-day plan using my available study hours"*\n• **Rank by PYQ Evidence:** *"Prioritize all topics using my uploaded PYQs"*`,
    actions: [],
    tutorMode: activeTutorMode,
    isAcademicTutorQuery: true,
    selectiveContext: `Student has ${state.subjects.length} subjects, ${fullBacklog.totalUnfinishedTopics} unfinished topics (${fullBacklog.totalEstimatedHours}h remaining), and ${state.pyqs.length} PYQs.`,
    matchedTopics: fullBacklog.flatTopics.slice(0, 5).map((t) => ({
      topicId: t.topicId,
      topicTitle: t.topicTitle,
      chapterTitle: t.chapterTitle,
      subjectName: t.subjectName,
      status: t.status,
      priority: t.priority,
    })),
  };
}
