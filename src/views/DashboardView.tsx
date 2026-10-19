import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext.tsx';
import { calculateTopicIntelligence } from '../utils/pyqIntelligenceEngine.ts';
import { buildHierarchicalBacklog } from '../utils/backlogEngine.ts';
import {
  FileUp,
  Sparkles,
  CheckCircle2,
  Circle,
  SlidersHorizontal,
  ArrowUp,
  ArrowDown,
  Layers,
  Calendar,
  Edit3,
  Check,
  X,
  Plus,
  Flame,
  FlameKindling,
  Trophy,
  Clock,
  CalendarCheck2,
} from 'lucide-react';
import { VisualProgressDashboard } from '../components/VisualProgressDashboard.tsx';
import { STREAK_MILESTONES, type StreakFireVariant } from '../utils/streakCalc.ts';

interface StreakFireIconProps {
  variant: StreakFireVariant;
  isMilestoneDay: boolean;
  size?: 'sm' | 'md' | 'lg';
  testId?: string;
}

const StreakFireIcon: React.FC<StreakFireIconProps> = ({
  variant,
  isMilestoneDay,
  size = 'md',
  testId,
}) => {
  const iconSizeClass =
    size === 'sm' ? 'w-3.5 h-3.5' : size === 'lg' ? 'w-5 h-5' : 'w-4 h-4';

  if (variant === 'milestone-supernova' || variant === 'milestone-blaze' || isMilestoneDay) {
    return (
      <span
        data-testid={testId}
        data-fire-variant={variant}
        data-milestone-achieved="true"
        className="relative inline-flex items-center justify-center animate-fire-milestone-bounce"
        title="Daily Milestone Flame Unlocked"
      >
        <FlameKindling
          className={`${iconSizeClass} text-[#1B4D48] fill-[#42BDAE] animate-flame-float`}
        />
        <Sparkles className="w-2.5 h-2.5 text-[#1B4D48] absolute -top-1 -right-1" />
      </span>
    );
  }

  if (variant === 'flame' || variant === 'spark') {
    return (
      <span
        data-testid={testId}
        data-fire-variant={variant}
        data-milestone-achieved="false"
        className="inline-flex items-center justify-center"
      >
        <Flame className={`${iconSizeClass} text-[#1B4D48] fill-[#75D9B4]`} />
      </span>
    );
  }

  return (
    <span
      data-testid={testId}
      data-fire-variant="ember"
      data-milestone-achieved="false"
      className="inline-flex items-center justify-center opacity-75"
    >
      <Flame className={`${iconSizeClass} text-[#4A6B66]`} />
    </span>
  );
};

interface DashboardViewProps {
  setActiveTab: (tab: string) => void;
  onSelectTopic: (topicId: string) => void;
  onOpenAITutor: () => void;
}

const DEFAULT_CARD_ORDER = [
  'study_streak',
  'overall_progress',
  'subject_progress',
  'priority_unfinished',
  'backlog_overview',
  'study_next',
  'exam_targets',
];

export const DashboardView: React.FC<DashboardViewProps> = ({
  setActiveTab,
  onSelectTopic,
}) => {
  const {
    activeSyllabus,
    masteryMap,
    studyTasks,
    revisionTasks,
    pyqs,
    milestones,
    preferences,
    progressSummary,
    studyStreak,
    toggleStudyTask,
    addStudyTask,
    updateMilestone,
    updatePreferences,
    setBacklogFilterState,
  } = useApp();

  const [showCustomizePanel, setShowCustomizePanel] = useState(false);
  const [editingMilestoneId, setEditingMilestoneId] = useState<string | null>(null);
  const [editMilestoneTitle, setEditMilestoneTitle] = useState('');
  const [editMilestoneDate, setEditMilestoneDate] = useState('');

  const todayStr = new Date().toISOString().split('T')[0];
  const [selectedStreakDate, setSelectedStreakDate] = useState<string>(todayStr);
  const allowAutoComplete = Boolean(preferences.autoCompleteFromStages);

  // 1. Topic Intelligence ranking (Evidence-based unfinished important topics)
  const priorityUnfinishedTopics = useMemo(() => {
    const allIntel = calculateTopicIntelligence(
      activeSyllabus.subjects,
      pyqs,
      masteryMap,
      allowAutoComplete
    );
    const unfinished = allIntel.filter((item) => !item.isCompleted);
    if (preferences.showOnlyHighPriorityOnHome) {
      return unfinished
        .filter(
          (i) => i.priorityLevel === 'High Priority' || i.personalPriority === 'high'
        )
        .slice(0, 6);
    }
    return unfinished.slice(0, 6);
  }, [
    activeSyllabus.subjects,
    pyqs,
    masteryMap,
    allowAutoComplete,
    preferences.showOnlyHighPriorityOnHome,
  ]);

  // 2. Backlog summary
  const backlogSummary = useMemo(() => {
    return buildHierarchicalBacklog(
      activeSyllabus.subjects,
      masteryMap,
      studyTasks,
      revisionTasks,
      pyqs,
      {},
      todayStr,
      allowAutoComplete
    );
  }, [
    activeSyllabus.subjects,
    masteryMap,
    studyTasks,
    revisionTasks,
    pyqs,
    todayStr,
    allowAutoComplete,
  ]);

  // 3. Today's study plan
  const todayTasks = useMemo(() => {
    return studyTasks.filter((t) => t.date === todayStr);
  }, [studyTasks, todayStr]);

  // 4. Upcoming active exam milestones
  const activeMilestones = useMemo(() => {
    return milestones.filter((m) => !m.isArchived);
  }, [milestones]);

  const cardOrder = useMemo(() => {
    const saved =
      preferences.dashboardCardOrder && preferences.dashboardCardOrder.length > 0
        ? preferences.dashboardCardOrder
        : DEFAULT_CARD_ORDER;
    if (saved.includes('study_streak')) {
      return saved;
    }
    return ['study_streak', ...saved];
  }, [preferences.dashboardCardOrder]);

  const dashCards = preferences.dashboardCards || {
    showStudyStreak: true,
    showRawCompletion: true,
    showSubjectPriorities: true,
    showWeakTopics: true,
    showBacklogSummary: true,
    showTodayTasks: true,
    showCountdown: true,
  };

  const isCardVisible = (cardKey: string): boolean => {
    switch (cardKey) {
      case 'study_streak':
        return dashCards.showStudyStreak !== false;
      case 'overall_progress':
        return dashCards.showRawCompletion !== false;
      case 'subject_progress':
        return dashCards.showSubjectPriorities !== false;
      case 'priority_unfinished':
        return dashCards.showWeakTopics !== false;
      case 'backlog_overview':
        return dashCards.showBacklogSummary !== false;
      case 'study_next':
        return dashCards.showTodayTasks !== false;
      case 'exam_targets':
        return dashCards.showCountdown !== false;
      default:
        return true;
    }
  };

  const toggleCardVisibility = (cardKey: string) => {
    const current = { ...dashCards };
    switch (cardKey) {
      case 'study_streak':
        current.showStudyStreak = !(current.showStudyStreak !== false);
        break;
      case 'overall_progress':
        current.showRawCompletion = !(current.showRawCompletion !== false);
        break;
      case 'subject_progress':
        current.showSubjectPriorities = !(current.showSubjectPriorities !== false);
        break;
      case 'priority_unfinished':
        current.showWeakTopics = !(current.showWeakTopics !== false);
        break;
      case 'backlog_overview':
        current.showBacklogSummary = !(current.showBacklogSummary !== false);
        break;
      case 'study_next':
        current.showTodayTasks = !(current.showTodayTasks !== false);
        break;
      case 'exam_targets':
        current.showCountdown = !(current.showCountdown !== false);
        break;
    }
    updatePreferences({ dashboardCards: current });
  };

  const moveCard = (index: number, direction: -1 | 1) => {
    const newOrder = [...cardOrder];
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= newOrder.length) return;
    const temp = newOrder[index];
    newOrder[index] = newOrder[targetIdx];
    newOrder[targetIdx] = temp;
    updatePreferences({ dashboardCardOrder: newOrder });
  };

  const toggleHighlightSubject = (subId: string) => {
    const current = preferences.highlightedSubjects || [];
    const next = current.includes(subId)
      ? current.filter((id) => id !== subId)
      : [...current, subId];
    updatePreferences({ highlightedSubjects: next });
  };

  const startEditingMilestone = (id: string, title: string, date: string) => {
    setEditingMilestoneId(id);
    setEditMilestoneTitle(title);
    setEditMilestoneDate(date);
  };

  const saveMilestoneEdit = (id: string) => {
    updateMilestone(id, {
      title: editMilestoneTitle.trim() || 'Exam Target',
      date: editMilestoneDate,
    });
    setEditingMilestoneId(null);
  };

  const calculateDaysLeft = (dateStr: string): string => {
    if (!dateStr) return 'Date unset';
    const target = new Date(`${dateStr}T00:00:00`);
    const now = new Date(`${todayStr}T00:00:00`);
    if (isNaN(target.getTime())) return 'Date unset';
    const diffDays = Math.round((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return 'Target date passed';
    if (diffDays === 0) return 'Today';
    return `${diffDays}d remaining`;
  };

  const handleQuickAddNextTopicToToday = (topicId: string) => {
    const item = priorityUnfinishedTopics.find((t) => t.topicId === topicId);
    if (!item) return;
    addStudyTask({
      date: todayStr,
      subjectId: item.subjectId,
      subjectName: item.subjectName,
      chapterId: item.chapterId,
      chapterTitle: item.chapterTitle,
      topicId: item.topicId,
      topicTitle: item.topicTitle,
      taskType: 'theory',
      plannedMinutes: preferences.sessionDurationMinutes || 60,
      actualMinutes: 0,
      priority: 'high',
      energySlot: 'morning_high',
      completed: false,
      notes: `Added from Home High-Priority Unfinished list`,
    });
  };

  const selectedDayData = useMemo(() => {
    return (
      studyStreak.last7Days.find((d) => d.date === selectedStreakDate) ||
      studyStreak.last7Days[studyStreak.last7Days.length - 1]
    );
  }, [studyStreak.last7Days, selectedStreakDate]);

  const CARD_LABELS: Record<string, string> = {
    study_streak: 'Daily Study Streak Tracker',
    overall_progress: '1. Overall Syllabus Progress',
    subject_progress: 'Subject-Wise Progress',
    priority_unfinished: '2. Important Unfinished Topics (PYQ Ranked)',
    backlog_overview: '3. Current Backlog by Subject',
    study_next: "4. What Should I Study Next? (Today's Plan)",
    exam_targets: 'Upcoming Editable Exam Targets',
  };

  return (
    <div className="space-y-6">
      {/* Top Action Header */}
      <div className="p-5 sm:p-6 rounded-3xl bg-[#F5EFE2] border border-[#E2DAC7] flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1B4D48] text-balance">
              AZORA Study Command Center
            </h1>
            <span
              key={`header-streak-${studyStreak.currentStreak}-${studyStreak.todayActivitiesCount}`}
              data-testid="header-streak-badge"
              data-milestone-achieved={String(studyStreak.milestone.isMilestoneDay)}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl border text-[#1B4D48] text-xs font-bold tabular-nums animate-streak-bounce-in ${
                studyStreak.milestone.isMilestoneDay
                  ? 'bg-[#75D9B4]/45 border-[#1B4D48] shadow-xs'
                  : 'bg-[#75D9B4]/30 border-[#42BDAE]'
              }`}
            >
              <StreakFireIcon
                variant={studyStreak.milestone.fireVariant}
                isMilestoneDay={studyStreak.milestone.isMilestoneDay}
                size="sm"
                testId="header-streak-fire-icon"
              />
              <span>
                {studyStreak.currentStreak} Day{studyStreak.currentStreak === 1 ? '' : 's'} Streak
              </span>
              {studyStreak.milestone.exactMilestoneReached && (
                <span className="text-[10px] font-extrabold text-[#1B4D48]">
                  · Milestone!
                </span>
              )}
            </span>
          </div>
          <p className="text-sm text-[#4A6B66] mt-1 tabular-nums">
            Session {preferences.targetSession || activeSyllabus.academicSession} ·{' '}
            {progressSummary.completedTopics} of {progressSummary.totalTopics} topics completed ·{' '}
            {backlogSummary.totalUnfinishedTopics} in backlog · Daily budget:{' '}
            {preferences.dailyStudyHoursLimit}h
          </p>
        </div>

        {/* Primary Quick Actions: Import PDF, Ask AI, Customize Home */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setActiveTab('import-syllabus')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#42BDAE] hover:bg-[#35A597] text-[#FBF7EF] text-xs font-semibold transition cursor-pointer"
          >
            <FileUp className="w-4 h-4" />
            <span>Import PDF</span>
          </button>

          <button
            onClick={() => setActiveTab('ai-assistant')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1B4D48] hover:bg-[#143B37] text-[#FBF7EF] text-xs font-semibold transition cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-[#75D9B4]" />
            <span>Ask AI Assistant</span>
          </button>

          <button
            onClick={() => setShowCustomizePanel((prev) => !prev)}
            aria-expanded={showCustomizePanel}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-[#FBF7EF] hover:bg-[#EDE5D4] text-[#1B4D48] border border-[#E2DAC7] text-xs font-medium transition cursor-pointer"
          >
            <SlidersHorizontal className="w-4 h-4 text-[#42BDAE]" />
            <span>Customize Home</span>
          </button>
        </div>
      </div>

      {/* Dashboard Customization Drawer */}
      {showCustomizePanel && (
        <div className="p-5 rounded-2xl bg-[#F5EFE2] border border-[#42BDAE]/60 space-y-4">
          <div className="flex items-center justify-between border-b border-[#E2DAC7] pb-3">
            <div>
              <h2 className="text-sm font-bold text-[#1B4D48]">
                Customize Home Dashboard Layout & Highlights
              </h2>
              <p className="text-xs text-[#4A6B66]">
                Choose which cards appear, reorder them, or highlight priority subjects. Saved automatically to your account.
              </p>
            </div>
            <button
              onClick={() => setShowCustomizePanel(false)}
              className="text-xs font-semibold text-[#1B4D48] hover:underline cursor-pointer"
            >
              Done
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Card Visibility & Order */}
            <div className="space-y-2">
              <div className="text-xs font-semibold text-[#1B4D48]">
                Dashboard Sections (Toggle & Reorder)
              </div>
              {cardOrder.map((key, idx) => {
                const visible = isCardVisible(key);
                return (
                  <div
                    key={key}
                    className="p-2.5 rounded-xl bg-[#FBF7EF] border border-[#E2DAC7] flex items-center justify-between gap-2"
                  >
                    <label className="flex items-center gap-2.5 text-xs text-[#1B4D48] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={visible}
                        onChange={() => toggleCardVisibility(key)}
                        className="rounded border-[#C8BFA8] text-[#42BDAE]"
                      />
                      <span>{CARD_LABELS[key] || key}</span>
                    </label>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => moveCard(idx, -1)}
                        disabled={idx === 0}
                        aria-label={`Move ${CARD_LABELS[key]} up`}
                        className="p-1 rounded hover:bg-[#EDE5D4] disabled:opacity-30 text-[#4A6B66] hover:text-[#1B4D48] cursor-pointer"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => moveCard(idx, 1)}
                        disabled={idx === cardOrder.length - 1}
                        aria-label={`Move ${CARD_LABELS[key]} down`}
                        className="p-1 rounded hover:bg-[#EDE5D4] disabled:opacity-30 text-[#4A6B66] hover:text-[#1B4D48] cursor-pointer"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Highlighted Subjects & Filter Rules */}
            <div className="space-y-4">
              <div>
                <div className="text-xs font-semibold text-[#1B4D48] mb-2">
                  Highlight Specific Subjects on Home
                </div>
                <div className="flex flex-wrap gap-2">
                  {activeSyllabus.subjects.map((sub) => {
                    const isHighlighted = (preferences.highlightedSubjects || []).includes(
                      sub.id
                    );
                    return (
                      <button
                        key={sub.id}
                        onClick={() => toggleHighlightSubject(sub.id)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition cursor-pointer ${
                          isHighlighted
                            ? 'bg-[#75D9B4]/30 border-[#42BDAE] text-[#1B4D48] font-semibold'
                            : 'bg-[#FBF7EF] border-[#E2DAC7] text-[#4A6B66] hover:text-[#1B4D48]'
                        }`}
                      >
                        {sub.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-2 border-t border-[#E2DAC7] space-y-2">
                <label className="flex items-center gap-2.5 text-xs text-[#1B4D48] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(preferences.showOnlyHighPriorityOnHome)}
                    onChange={(e) =>
                      updatePreferences({ showOnlyHighPriorityOnHome: e.target.checked })
                    }
                    className="rounded border-[#C8BFA8] text-[#42BDAE]"
                  />
                  <span>Show only High-Priority unfinished topics on Home</span>
                </label>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Ordered Dashboard Cards */}
      <div className="space-y-6">
        {cardOrder.map((cardKey) => {
          if (!isCardVisible(cardKey)) return null;

          if (cardKey === 'study_streak') {
            const dailyTargetMinutes = (preferences.dailyStudyHoursLimit || 6) * 60;
            const todayGoalPercent = Math.min(
              100,
              Math.round((studyStreak.todayMinutes / Math.max(1, dailyTargetMinutes)) * 100)
            );
            return (
              <section
                key="study_streak"
                data-testid="study-streak-tracker"
                data-milestone-day={String(studyStreak.milestone.isMilestoneDay)}
                data-fire-variant={studyStreak.milestone.fireVariant}
                className="p-5 rounded-2xl bg-[#F5EFE2] border border-[#E2DAC7] space-y-4 animate-streak-bounce-in"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="flex items-start gap-3">
                    <div
                      key={`streak-icon-${studyStreak.currentStreak}-${studyStreak.todayActivitiesCount}-${studyStreak.milestone.fireVariant}`}
                      data-testid="streak-milestone-icon-box"
                      className={`w-11 h-11 rounded-xl border flex items-center justify-center shrink-0 transition-all animate-fire-milestone-bounce ${
                        studyStreak.milestone.isMilestoneDay
                          ? 'bg-[#75D9B4]/55 border-[#1B4D48] shadow-xs ring-2 ring-[#42BDAE]/40'
                          : studyStreak.currentStreak > 0
                          ? 'bg-[#75D9B4]/30 border-[#42BDAE]'
                          : 'bg-[#FBF7EF] border-[#E2DAC7]'
                      }`}
                    >
                      <StreakFireIcon
                        variant={studyStreak.milestone.fireVariant}
                        isMilestoneDay={studyStreak.milestone.isMilestoneDay}
                        size="lg"
                        testId="streak-fire-icon"
                      />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-base font-bold text-[#1B4D48]">
                          Daily Study Streak Tracker
                        </h2>
                        <span
                          data-testid="streak-status-badge"
                          className={`px-2.5 py-0.5 rounded-lg text-[11px] font-semibold border ${
                            studyStreak.milestone.isMilestoneDay
                              ? 'bg-[#1B4D48] border-[#1B4D48] text-[#FBF7EF]'
                              : studyStreak.isActiveToday
                              ? 'bg-[#75D9B4]/30 border-[#42BDAE] text-[#1B4D48]'
                              : studyStreak.streakAtRisk
                              ? 'bg-[#B8A4EF]/25 border-[#6A55A6]/40 text-[#1B4D48]'
                              : 'bg-[#FBF7EF] border-[#E2DAC7] text-[#4A6B66]'
                          }`}
                        >
                          {studyStreak.milestone.exactMilestoneReached && studyStreak.isActiveToday
                            ? `${studyStreak.milestone.exactMilestoneReached}-Day Milestone Achieved!`
                            : studyStreak.milestone.isMilestoneDay
                            ? 'Daily Milestone Ignited'
                            : studyStreak.isActiveToday
                            ? 'Active Today'
                            : studyStreak.streakAtRisk
                            ? 'Study Today to Keep Streak'
                            : 'Ready to Start'}
                        </span>
                      </div>
                      <p className="text-xs text-[#4A6B66] mt-0.5">
                        Tracks consecutive days of study activity from your syllabus mastery, daily planner tasks, spaced revisions, and mock tests
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => setActiveTab('planner')}
                    className="text-xs font-semibold text-[#1B4D48] hover:text-[#42BDAE] self-start sm:self-auto cursor-pointer"
                  >
                    Open Daily Planner →
                  </button>
                </div>

                {/* Daily Milestone Progress & Fire Evolution Strip */}
                <div
                  data-testid="streak-milestone-banner"
                  className="p-3.5 rounded-xl bg-[#FBF7EF] border border-[#E5DEC9] flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="text-xs font-bold text-[#1B4D48] flex flex-wrap items-center gap-1.5">
                      <span>{studyStreak.milestone.milestoneTitle}</span>
                      <span className="text-[11px] font-medium text-[#4A6B66]">
                        · Next target: {studyStreak.milestone.nextMilestone} Days
                      </span>
                    </div>
                    <div className="text-[11px] text-[#4A6B66] leading-relaxed">
                      {studyStreak.milestone.milestoneSubtitle}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                    {STREAK_MILESTONES.slice(0, 6).map((mTarget) => {
                      const reached = studyStreak.currentStreak >= mTarget;
                      const isCurrentExact = studyStreak.currentStreak === mTarget;
                      return (
                        <div
                          key={mTarget}
                          data-testid={`milestone-step-${mTarget}`}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold tabular-nums border flex items-center gap-1 transition-all ${
                            isCurrentExact
                              ? 'bg-[#1B4D48] text-[#FBF7EF] border-[#1B4D48] animate-fire-milestone-bounce'
                              : reached
                              ? 'bg-[#75D9B4]/35 text-[#1B4D48] border-[#42BDAE]'
                              : 'bg-[#F5EFE2] text-[#688A85] border-[#E2DAC7]'
                          }`}
                        >
                          {reached ? (
                            <FlameKindling className="w-3 h-3 shrink-0" />
                          ) : (
                            <Flame className="w-3 h-3 shrink-0 opacity-50" />
                          )}
                          <span>{mTarget}d</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 4 Streak Summary KPI Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
                  <div className="p-4 rounded-xl bg-[#FBF7EF] border border-[#E5DEC9]">
                    <div className="flex items-center justify-between text-xs text-[#4A6B66]">
                      <span>Consecutive Streak</span>
                      <StreakFireIcon
                        variant={studyStreak.milestone.fireVariant}
                        isMilestoneDay={studyStreak.milestone.isMilestoneDay}
                        size="sm"
                      />
                    </div>
                    <div
                      key={`kpi-streak-${studyStreak.currentStreak}`}
                      data-testid="current-streak-value"
                      className="text-2xl font-bold text-[#1B4D48] tabular-nums mt-1 animate-fire-milestone-bounce"
                    >
                      {studyStreak.currentStreak} {studyStreak.currentStreak === 1 ? 'Day' : 'Days'}
                    </div>
                    <div className="text-xs text-[#5B7A75] mt-0.5">
                      {studyStreak.isActiveToday
                        ? "Today's activity recorded"
                        : studyStreak.streakAtRisk
                        ? 'Studied yesterday · Log today'
                        : 'Log a study session today'}
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-[#FBF7EF] border border-[#E5DEC9]">
                    <div className="flex items-center justify-between text-xs text-[#4A6B66]">
                      <span>Longest Streak</span>
                      <Trophy className="w-4 h-4 text-[#26877B]" />
                    </div>
                    <div
                      data-testid="longest-streak-value"
                      className="text-2xl font-bold text-[#26877B] tabular-nums mt-1"
                    >
                      {studyStreak.longestStreak} {studyStreak.longestStreak === 1 ? 'Day' : 'Days'}
                    </div>
                    <div className="text-xs text-[#5B7A75] mt-0.5 tabular-nums">
                      Personal best consecutive run
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-[#FBF7EF] border border-[#E5DEC9]">
                    <div className="flex items-center justify-between text-xs text-[#4A6B66]">
                      <span>Today's Study Log</span>
                      <Clock className="w-4 h-4 text-[#2574A9]" />
                    </div>
                    <div
                      data-testid="today-minutes-value"
                      className="text-2xl font-bold text-[#2574A9] tabular-nums mt-1"
                    >
                      {studyStreak.todayMinutes}m
                    </div>
                    <div className="text-xs text-[#5B7A75] mt-0.5 tabular-nums">
                      {studyStreak.todayActivitiesCount}{' '}
                      {studyStreak.todayActivitiesCount === 1 ? 'activity' : 'activities'} ·{' '}
                      {todayGoalPercent}% of {preferences.dailyStudyHoursLimit}h goal
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-[#FBF7EF] border border-[#E5DEC9]">
                    <div className="flex items-center justify-between text-xs text-[#4A6B66]">
                      <span>Total Active Days</span>
                      <CalendarCheck2 className="w-4 h-4 text-[#6A55A6]" />
                    </div>
                    <div
                      data-testid="total-active-days-value"
                      className="text-2xl font-bold text-[#6A55A6] tabular-nums mt-1"
                    >
                      {studyStreak.totalActiveDays}
                    </div>
                    <div className="text-xs text-[#5B7A75] mt-0.5 tabular-nums">
                      {studyStreak.lastActiveDate
                        ? `Last active: ${studyStreak.lastActiveDate}`
                        : 'No days logged yet'}
                    </div>
                  </div>
                </div>

                {/* 7-Day Consecutive Activity Timeline */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#1B4D48]">
                      Last 7 Days Activity Timeline (Click any day to inspect logged progress)
                    </span>
                    <span className="text-[11px] text-[#4A6B66] tabular-nums">
                      {studyStreak.last7Days.filter((d) => d.isActive).length} of 7 days active
                    </span>
                  </div>

                  <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                    {studyStreak.last7Days.map((day) => {
                      const isSelected = selectedDayData?.date === day.date;
                      return (
                        <button
                          key={day.date}
                          type="button"
                          onClick={() => setSelectedStreakDate(day.date)}
                          aria-label={`${day.dayLabel} ${day.shortDateLabel}: ${
                            day.isActive ? `${day.activityCount} activities` : 'No activity'
                          }`}
                          aria-pressed={isSelected}
                          className={`p-2.5 rounded-xl border text-center transition cursor-pointer flex flex-col items-center justify-between gap-1.5 ${
                            isSelected
                              ? 'bg-[#75D9B4]/30 border-[#1B4D48] ring-1 ring-[#1B4D48]'
                              : day.isActive
                              ? 'bg-[#FBF7EF] border-[#42BDAE] hover:bg-[#75D9B4]/15'
                              : 'bg-[#FBF7EF]/70 border-[#E5DEC9] hover:border-[#C8BFA8]'
                          }`}
                        >
                          <div className="flex items-center gap-1">
                            <span className="text-[11px] font-bold text-[#1B4D48]">
                              {day.dayLabel}
                            </span>
                            {day.isToday && (
                              <span className="px-1.5 py-0.2 rounded bg-[#1B4D48] text-[#FBF7EF] text-[9px] font-bold">
                                TODAY
                              </span>
                            )}
                          </div>

                          <div
                            className={`w-8 h-8 rounded-xl flex items-center justify-center transition ${
                              day.isToday && day.isActive && studyStreak.milestone.isMilestoneDay
                                ? 'bg-[#1B4D48] text-[#75D9B4] animate-fire-milestone-bounce'
                                : day.isActive
                                ? 'bg-[#42BDAE] text-[#FBF7EF]'
                                : 'bg-[#EAE2D0] text-[#6E8B87]'
                            }`}
                          >
                            {day.isToday && day.isActive && studyStreak.milestone.isMilestoneDay ? (
                              <FlameKindling className="w-4 h-4 stroke-[2.2]" />
                            ) : day.isActive ? (
                              <Check className="w-4 h-4 stroke-[2.5]" />
                            ) : (
                              <span className="text-xs font-semibold tabular-nums">
                                {day.dayNumber}
                              </span>
                            )}
                          </div>

                          <div className="space-y-0.5">
                            <div className="text-[10px] font-semibold text-[#1B4D48] tabular-nums">
                              {day.shortDateLabel}
                            </div>
                            <div className="text-[10px] text-[#4A6B66] tabular-nums">
                              {day.isActive
                                ? `${day.activityCount} ${
                                    day.activityCount === 1 ? 'item' : 'items'
                                  }`
                                : 'Rest / 0'}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Selected Day Activity Breakdown */}
                {selectedDayData && (
                  <div className="p-4 rounded-xl bg-[#FBF7EF] border border-[#E5DEC9] space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 border-b border-[#ECE4D4] pb-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-[#1B4D48]">
                          {selectedDayData.isToday
                            ? `Today (${selectedDayData.shortDateLabel})`
                            : `${selectedDayData.dayLabel}, ${selectedDayData.shortDateLabel}`}{' '}
                          Activity Log
                        </span>
                        <span className="text-xs text-[#4A6B66] tabular-nums">
                          · {selectedDayData.activityCount}{' '}
                          {selectedDayData.activityCount === 1 ? 'activity' : 'activities'}
                          {selectedDayData.studyMinutes > 0
                            ? ` · ${selectedDayData.studyMinutes}m studied`
                            : ''}
                        </span>
                      </div>

                      {selectedDayData.isToday && todayTasks.some((t) => !t.completed) && (
                        <button
                          type="button"
                          onClick={() => {
                            const nextIncomplete = todayTasks.find((t) => !t.completed);
                            if (nextIncomplete) {
                              toggleStudyTask(nextIncomplete.id);
                            }
                          }}
                          className="px-2.5 py-1 rounded-lg bg-[#75D9B4]/35 hover:bg-[#75D9B4]/55 text-[#1B4D48] border border-[#42BDAE] text-xs font-semibold transition cursor-pointer self-start sm:self-auto"
                        >
                          ✓ Complete Next Scheduled Task
                        </button>
                      )}
                    </div>

                    {selectedDayData.activities.length === 0 ? (
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 py-1">
                        <p className="text-xs text-[#4A6B66]">
                          No study sessions, topic completions, or revisions recorded on{' '}
                          {selectedDayData.shortDateLabel}.
                        </p>
                        {selectedDayData.isToday && (
                          <button
                            type="button"
                            onClick={() => setActiveTab('syllabus')}
                            className="px-3 py-1.5 rounded-lg bg-[#1B4D48] text-[#FBF7EF] text-xs font-semibold cursor-pointer self-start sm:self-auto"
                          >
                            Update a Topic Now →
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                        {selectedDayData.activities.map((act) => (
                          <div
                            key={act.id}
                            className="p-2.5 rounded-xl bg-[#F5EFE2] border border-[#E2DAC7] flex items-center justify-between gap-2.5"
                          >
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-[#1B4D48] truncate">
                                {act.title}
                              </div>
                              <div className="text-[11px] text-[#4A6B66] truncate mt-0.5">
                                {act.subtitle}
                              </div>
                            </div>
                            {act.topicId && (
                              <button
                                type="button"
                                onClick={() => onSelectTopic(act.topicId!)}
                                className="px-2.5 py-1 rounded-lg bg-[#FBF7EF] hover:bg-[#EDE5D4] text-[#1B4D48] border border-[#E2DAC7] text-[11px] font-semibold shrink-0 cursor-pointer"
                              >
                                Topic →
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </section>
            );
          }

          if (cardKey === 'overall_progress') {
            return (
              <section
                key="overall_progress"
                className="p-5 rounded-2xl bg-[#F5EFE2] border border-[#E2DAC7]"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
                  <div>
                    <h2 className="text-base font-bold text-[#1B4D48]">
                      1. Overall Syllabus Progress
                    </h2>
                    <p className="text-xs text-[#4A6B66]">
                      Calculated strictly from your saved syllabus topics ({progressSummary.totalTopics}{' '}
                      active topics across {activeSyllabus.subjects.length} subjects)
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveTab('syllabus')}
                    className="text-xs font-semibold text-[#1B4D48] hover:text-[#42BDAE] self-start sm:self-auto cursor-pointer"
                  >
                    Open My Syllabus →
                  </button>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="p-4 rounded-xl bg-[#FBF7EF] border border-[#E5DEC9]">
                    <div className="text-xs text-[#4A6B66]">Raw Topic Completion</div>
                    <div className="text-2xl font-bold text-[#1B4D48] tabular-nums mt-1">
                      {progressSummary.rawCoveragePercentage}%
                    </div>
                    <div className="text-xs text-[#5B7A75] mt-0.5 tabular-nums">
                      {progressSummary.completedTopics} / {progressSummary.totalTopics} topics completed
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-[#FBF7EF] border border-[#E5DEC9]">
                    <div className="text-xs text-[#4A6B66]">In Progress Topics</div>
                    <div className="text-2xl font-bold text-[#26877B] tabular-nums mt-1">
                      {progressSummary.inProgressTopics}
                    </div>
                    <div className="text-xs text-[#5B7A75] mt-0.5 tabular-nums">
                      Currently being studied
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-[#FBF7EF] border border-[#E5DEC9]">
                    <div className="text-xs text-[#4A6B66]">Unfinished Backlog</div>
                    <div className="text-2xl font-bold text-[#6A55A6] tabular-nums mt-1">
                      {backlogSummary.totalUnfinishedTopics}
                    </div>
                    <div className="text-xs text-[#5B7A75] mt-0.5 tabular-nums">
                      {backlogSummary.totalOverdueTopics} overdue topics
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-[#FBF7EF] border border-[#E5DEC9]">
                    <div className="text-xs text-[#4A6B66]">Uploaded / Saved PYQs</div>
                    <div className="text-2xl font-bold text-[#2574A9] tabular-nums mt-1">
                      {pyqs.length}
                    </div>
                    <div className="text-xs text-[#5B7A75] mt-0.5 tabular-nums">
                      Used for topic prioritization
                    </div>
                  </div>
                </div>
              </section>
            );
          }

          if (cardKey === 'subject_progress') {
            const highlighted = preferences.highlightedSubjects || [];
            return (
              <section
                key="subject_progress"
                className="p-5 rounded-2xl bg-[#F5EFE2] border border-[#E2DAC7] space-y-4"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-bold text-[#1B4D48]">Subject-Wise Progress</h2>
                    <p className="text-xs text-[#4A6B66]">
                      Click any subject to filter its unfinished backlog topics
                    </p>
                  </div>
                </div>

                {progressSummary.subjectBreakdown.length === 0 ? (
                  <div className="p-6 rounded-xl bg-[#FBF7EF] border border-[#E5DEC9] text-center space-y-2">
                    <p className="text-xs text-[#4A6B66]">
                      Your syllabus is currently empty. Import a Syllabus PDF or add subjects manually.
                    </p>
                    <button
                      onClick={() => setActiveTab('import-syllabus')}
                      className="px-3.5 py-2 rounded-xl bg-[#1B4D48] text-[#FBF7EF] text-xs font-semibold cursor-pointer"
                    >
                      Import Syllabus PDF
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                    {progressSummary.subjectBreakdown.map((sub) => {
                      const isHighlighted = highlighted.includes(sub.subjectId);
                      const remainingCount = Math.max(0, sub.totalTopics - sub.completedTopics);
                      return (
                        <button
                          key={sub.subjectId}
                          onClick={() => {
                            setBacklogFilterState({
                              subjectId: sub.subjectId,
                              chapterId: 'all',
                            });
                            setActiveTab('backlog');
                          }}
                          className={`p-4 rounded-xl text-left transition cursor-pointer border ${
                            isHighlighted
                              ? 'bg-[#75D9B4]/20 border-[#42BDAE]'
                              : 'bg-[#FBF7EF] border-[#E5DEC9] hover:border-[#42BDAE]'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-bold text-[#1B4D48] truncate">
                              {sub.subjectName}
                            </span>
                            <span className="text-xs font-mono font-semibold text-[#26877B] tabular-nums">
                              {sub.rawCoveragePercentage}%
                            </span>
                          </div>

                          <div className="w-full h-1.5 bg-[#EAE2D0] rounded-full overflow-hidden mt-2.5">
                            <div
                              className="h-full bg-gradient-to-r from-[#75D9B4] via-[#42BDAE] to-[#69B7EC] rounded-full transition-all"
                              style={{ width: `${sub.rawCoveragePercentage}%` }}
                            />
                          </div>

                          <div className="mt-2.5 text-[11px] text-[#4A6B66] tabular-nums">
                            {sub.completedTopics}/{sub.totalTopics} done · {remainingCount} left
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Recharts Visual Progress Analytics (Completion % per Subject & Unit) */}
                <div className="pt-2">
                  <VisualProgressDashboard
                    onSelectSubjectFilter={(subId) => {
                      if (subId !== 'all') {
                        setBacklogFilterState({ subjectId: subId, chapterId: 'all' });
                      }
                    }}
                  />
                </div>
              </section>
            );
          }

          if (cardKey === 'priority_unfinished') {
            return (
              <section
                key="priority_unfinished"
                className="p-5 rounded-2xl bg-[#F5EFE2] border border-[#E2DAC7] space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <h2 className="text-base font-bold text-[#1B4D48]">
                      2. Important Unfinished Topics (Evidence-Based PYQ Ranking)
                    </h2>
                    <p className="text-xs text-[#4A6B66]">
                      Ranked using your uploaded PYQ appearances, marks, and personal priority
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveTab('pyqs')}
                    className="text-xs font-semibold text-[#1B4D48] hover:text-[#42BDAE] self-start sm:self-auto cursor-pointer"
                  >
                    Open Topic Intelligence Engine →
                  </button>
                </div>

                {priorityUnfinishedTopics.length === 0 ? (
                  <div className="p-6 rounded-xl bg-[#FBF7EF] border border-[#E5DEC9] text-center text-xs text-[#4A6B66]">
                    All high-priority topics are completed or no topics match the filter.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {priorityUnfinishedTopics.map((item) => (
                      <div
                        key={item.topicId}
                        className="p-4 rounded-xl bg-[#FBF7EF] border border-[#E5DEC9] flex flex-col justify-between gap-3"
                      >
                        <div>
                          <button
                            onClick={() => onSelectTopic(item.topicId)}
                            className="text-sm font-bold text-[#1B4D48] hover:text-[#42BDAE] text-left transition cursor-pointer"
                          >
                            {item.topicTitle}
                          </button>
                          <div className="text-xs text-[#4A6B66] mt-1 tabular-nums">
                            {item.subjectName} · {item.chapterTitle} · {item.priorityLevel}
                          </div>
                          <div className="text-[11px] text-[#5B7A75] mt-1">
                            {item.priorityReason}
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-[#ECE4D4]">
                          <span className="text-xs text-[#4A6B66] tabular-nums">
                            Status: {item.completionStatus}
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleQuickAddNextTopicToToday(item.topicId)}
                              className="px-2.5 py-1 rounded-lg bg-[#75D9B4]/30 hover:bg-[#75D9B4]/50 text-[#1B4D48] border border-[#42BDAE]/50 text-xs font-semibold transition cursor-pointer"
                            >
                              + Study Today
                            </button>
                            <button
                              onClick={() => onSelectTopic(item.topicId)}
                              className="px-2.5 py-1 rounded-lg bg-[#F2ECE0] hover:bg-[#E6DEC8] text-[#1B4D48] border border-[#E2DAC7] text-xs font-medium transition cursor-pointer"
                            >
                              Details
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            );
          }

          if (cardKey === 'backlog_overview') {
            return (
              <section
                key="backlog_overview"
                className="p-5 rounded-2xl bg-[#F5EFE2] border border-[#E2DAC7] space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <h2 className="text-base font-bold text-[#1B4D48]">
                      3. Current Backlog Overview
                    </h2>
                    <p className="text-xs text-[#4A6B66] tabular-nums">
                      {backlogSummary.totalUnfinishedTopics} unfinished topics ({backlogSummary.totalOverdueTopics}{' '}
                      overdue) · Select a subject to inspect its specific chapter & topic hierarchy
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setBacklogFilterState({ subjectId: 'all', chapterId: 'all' });
                      setActiveTab('backlog');
                    }}
                    className="flex items-center gap-1.5 text-xs font-semibold text-[#1B4D48] hover:text-[#42BDAE] self-start sm:self-auto cursor-pointer"
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>Open Full Backlog Manager →</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                  {backlogSummary.subjectGroups.map((sg) => (
                    <button
                      key={sg.subjectId}
                      onClick={() => {
                        setBacklogFilterState({
                          subjectId: sg.subjectId,
                          chapterId: 'all',
                        });
                        setActiveTab('backlog');
                      }}
                      className="p-3.5 rounded-xl bg-[#FBF7EF] border border-[#E5DEC9] hover:border-[#42BDAE] text-left transition cursor-pointer"
                    >
                      <div className="text-sm font-bold text-[#1B4D48]">{sg.subjectName}</div>
                      <div className="text-lg font-bold text-[#26877B] tabular-nums mt-1">
                        {sg.unfinishedTopicsCount} topics
                      </div>
                      <div className="text-[11px] text-[#4A6B66] tabular-nums mt-0.5">
                        {sg.chapters.length} chapters
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            );
          }

          if (cardKey === 'study_next') {
            return (
              <div
                key="study_next"
                className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch"
              >
                {/* Today's Study Plan (7 cols) */}
                <section className="lg:col-span-7 p-5 rounded-2xl bg-[#F5EFE2] border border-[#E2DAC7] flex flex-col justify-between space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-base font-bold text-[#1B4D48]">
                          4. What Should I Study Next? (Today's Plan)
                        </h2>
                        <p className="text-xs text-[#4A6B66] tabular-nums">
                          {todayStr} · Daily target: {preferences.dailyStudyHoursLimit}h
                        </p>
                      </div>
                      <button
                        onClick={() => setActiveTab('planner')}
                        className="text-xs font-semibold text-[#1B4D48] hover:text-[#42BDAE] cursor-pointer"
                      >
                        Manage Planner →
                      </button>
                    </div>

                    {todayTasks.length === 0 ? (
                      <div className="p-6 rounded-xl bg-[#FBF7EF] border border-[#E5DEC9] text-center space-y-2">
                        <p className="text-xs text-[#4A6B66]">
                          No study sessions scheduled for today yet.
                        </p>
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => setActiveTab('planner')}
                            className="px-3 py-1.5 rounded-lg bg-[#42BDAE] text-[#FBF7EF] text-xs font-semibold cursor-pointer"
                          >
                            Schedule a Session
                          </button>
                          <button
                            onClick={() => setActiveTab('ai-assistant')}
                            className="px-3 py-1.5 rounded-lg bg-[#1B4D48] text-[#FBF7EF] text-xs font-semibold cursor-pointer"
                          >
                            Ask AI to Plan 7 Days
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {todayTasks.map((task) => (
                          <div
                            key={task.id}
                            className="p-3.5 rounded-xl bg-[#FBF7EF] border border-[#E5DEC9] flex items-center justify-between gap-3"
                          >
                            <div className="flex items-start gap-3">
                              <button
                                onClick={() => toggleStudyTask(task.id)}
                                aria-label={`Toggle completion for ${task.topicTitle}`}
                                className="mt-0.5 text-[#4A6B66] hover:text-[#42BDAE] transition cursor-pointer"
                              >
                                {task.completed ? (
                                  <CheckCircle2 className="w-5 h-5 text-[#42BDAE]" />
                                ) : (
                                  <Circle className="w-5 h-5" />
                                )}
                              </button>
                              <div>
                                <button
                                  onClick={() => onSelectTopic(task.topicId)}
                                  className={`text-sm font-semibold text-left transition cursor-pointer ${
                                    task.completed
                                      ? 'line-through text-[#6E8B87]'
                                      : 'text-[#1B4D48] hover:text-[#42BDAE]'
                                  }`}
                                >
                                  {task.topicTitle}
                                </button>
                                <div className="text-xs text-[#4A6B66] tabular-nums mt-0.5">
                                  {task.subjectName} · {task.chapterTitle} · {task.plannedMinutes}m
                                </div>
                              </div>
                            </div>

                            <button
                              onClick={() => onSelectTopic(task.topicId)}
                              className="px-2.5 py-1 rounded-lg bg-[#F2ECE0] hover:bg-[#E6DEC8] text-[#1B4D48] border border-[#E2DAC7] text-xs font-medium shrink-0 cursor-pointer"
                            >
                              Open Topic
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </section>

                {/* Quick Import & AI Assistant Action Card (5 cols) */}
                <section className="lg:col-span-5 p-5 rounded-2xl bg-[#F5EFE2] border border-[#E2DAC7] flex flex-col justify-between space-y-4">
                  <div className="space-y-3">
                    <h2 className="text-base font-bold text-[#1B4D48]">
                      PDF Imports & AI Automation
                    </h2>
                    <p className="text-xs text-[#4A6B66] leading-relaxed">
                      Import your Syllabus PDF or Previous Year Question (PYQ) papers from your phone or computer. Extract topics, match PYQs automatically, or instruct the AI Assistant to edit your study plan.
                    </p>

                    <div className="space-y-2.5 pt-1">
                      <button
                        onClick={() => setActiveTab('import-syllabus')}
                        className="w-full p-3.5 rounded-xl bg-[#FBF7EF] hover:bg-[#EFE8D8] border border-[#E5DEC9] hover:border-[#42BDAE] flex items-center justify-between text-left transition cursor-pointer"
                      >
                        <div>
                          <div className="text-xs font-bold text-[#1B4D48]">
                            Import Syllabus PDF
                          </div>
                          <div className="text-[11px] text-[#4A6B66] mt-0.5">
                            Extract subjects, units, chapters, topics & subtopics
                          </div>
                        </div>
                        <FileUp className="w-4 h-4 text-[#42BDAE] shrink-0" />
                      </button>

                      <button
                        onClick={() => setActiveTab('pyqs')}
                        className="w-full p-3.5 rounded-xl bg-[#FBF7EF] hover:bg-[#EFE8D8] border border-[#E5DEC9] hover:border-[#69B7EC] flex items-center justify-between text-left transition cursor-pointer"
                      >
                        <div>
                          <div className="text-xs font-bold text-[#1B4D48]">
                            Import PYQ Paper PDF & Rank Topics
                          </div>
                          <div className="text-[11px] text-[#4A6B66] mt-0.5">
                            Extract board/JEE questions, match to syllabus & detect duplicates
                          </div>
                        </div>
                        <FileUp className="w-4 h-4 text-[#2574A9] shrink-0" />
                      </button>

                      <button
                        onClick={() => setActiveTab('ai-assistant')}
                        className="w-full p-3.5 rounded-xl bg-[#75D9B4]/25 hover:bg-[#75D9B4]/35 border border-[#42BDAE]/60 flex items-center justify-between text-left transition cursor-pointer"
                      >
                        <div>
                          <div className="text-xs font-bold text-[#1B4D48]">
                            Ask AI Assistant to Edit Your Plan
                          </div>
                          <div className="text-[11px] text-[#355A55] mt-0.5">
                            "Show my Physics backlog" · "Create a 7-day plan"
                          </div>
                        </div>
                        <Sparkles className="w-4 h-4 text-[#1B4D48] shrink-0" />
                      </button>
                    </div>
                  </div>
                </section>
              </div>
            );
          }

          if (cardKey === 'exam_targets') {
            return (
              <section
                key="exam_targets"
                className="p-5 rounded-2xl bg-[#F5EFE2] border border-[#E2DAC7] space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <h2 className="text-base font-bold text-[#1B4D48]">
                      Upcoming Editable Exam Targets
                    </h2>
                    <p className="text-xs text-[#4A6B66]">
                      Click the edit icon on any exam target to change its date or title immediately
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveTab('settings')}
                    className="flex items-center gap-1 text-xs font-semibold text-[#1B4D48] hover:text-[#42BDAE] self-start sm:self-auto cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Manage All Milestones in Settings →</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {activeMilestones.map((m) => {
                    const isEditing = editingMilestoneId === m.id;
                    return (
                      <div
                        key={m.id}
                        className="p-4 rounded-xl bg-[#FBF7EF] border border-[#E5DEC9] flex flex-col justify-between gap-2"
                      >
                        {isEditing ? (
                          <div className="space-y-2">
                            <input
                              type="text"
                              value={editMilestoneTitle}
                              onChange={(e) => setEditMilestoneTitle(e.target.value)}
                              aria-label="Exam Target Title"
                              className="w-full px-2.5 py-1.5 rounded-lg bg-[#F5EFE2] border border-[#D4CCB8] text-xs text-[#1B4D48]"
                            />
                            <input
                              type="date"
                              value={editMilestoneDate}
                              onChange={(e) => setEditMilestoneDate(e.target.value)}
                              aria-label="Exam Target Date"
                              className="w-full px-2.5 py-1.5 rounded-lg bg-[#F5EFE2] border border-[#D4CCB8] text-xs text-[#1B4D48]"
                            />
                            <div className="flex items-center gap-2 pt-1">
                              <button
                                onClick={() => saveMilestoneEdit(m.id)}
                                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#1B4D48] text-[#FBF7EF] text-xs font-semibold cursor-pointer"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>Save</span>
                              </button>
                              <button
                                onClick={() => setEditingMilestoneId(null)}
                                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#EAE2D0] text-[#1B4D48] text-xs cursor-pointer"
                              >
                                <X className="w-3.5 h-3.5" />
                                <span>Cancel</span>
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="text-sm font-bold text-[#1B4D48]">{m.title}</div>
                                <div className="text-xs text-[#4A6B66] tabular-nums mt-0.5 flex items-center gap-1.5">
                                  <Calendar className="w-3.5 h-3.5 text-[#42BDAE]" />
                                  <span>{m.date || m.targetMonth || 'Date unset'}</span>
                                </div>
                              </div>
                              <button
                                onClick={() => startEditingMilestone(m.id, m.title, m.date)}
                                aria-label={`Edit ${m.title}`}
                                className="p-1.5 rounded-lg text-[#4A6B66] hover:text-[#1B4D48] hover:bg-[#EDE5D4] transition cursor-pointer"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            <div className="flex items-center justify-between pt-2 border-t border-[#ECE4D4] text-xs tabular-nums">
                              <span className="font-semibold text-[#26877B]">
                                {calculateDaysLeft(m.date)}
                              </span>
                              <span className="text-[#5B7A75]">
                                {m.dateStatus === 'verified'
                                  ? 'Official Date'
                                  : m.dateStatus === 'tentative'
                                  ? 'Tentative'
                                  : 'Personal Target'}
                              </span>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          }

          return null;
        })}
      </div>
    </div>
  );
};
