import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext.tsx';
import {
  buildHierarchicalBacklog,
  BacklogFilterOptions,
  BacklogTopicItem,
} from '../utils/backlogEngine.ts';
import { TopicStatus } from '../types/index.ts';
import {
  Layers,
  Filter,
  CheckCircle2,
  Play,
  CalendarPlus,
  RotateCcw,
  Edit3,
  Trash2,
  ChevronDown,
  ChevronRight,
  Clock,
  AlertTriangle,
  Search,
  Sparkles,
} from 'lucide-react';

interface BacklogViewProps {
  onSelectTopic: (topicId: string) => void;
  onNavigateToAI?: () => void;
}

export const BacklogView: React.FC<BacklogViewProps> = ({
  onSelectTopic,
  onNavigateToAI,
}) => {
  const {
    activeSyllabus,
    masteryMap,
    studyTasks,
    revisionTasks,
    pyqs,
    milestones,
    preferences,
    backlogFilterState,
    setBacklogFilterState,
    updateTopicMastery,
    addStudyTask,
    updateStudyTask,
    deleteStudyTask,
    addRevisionTask,
  } = useApp();

  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(
    backlogFilterState.subjectId || 'all'
  );
  const [selectedChapterId, setSelectedChapterId] = useState<string>(
    backlogFilterState.chapterId || 'all'
  );
  const [selectedStatus, setSelectedStatus] = useState<
    'all' | 'Not Started' | 'In Progress' | 'Needs Revision' | 'On Hold'
  >('all');
  const [selectedPriority, setSelectedPriority] = useState<'all' | 'high' | 'medium' | 'low'>(
    'all'
  );
  const [selectedExamMilestoneId, setSelectedExamMilestoneId] = useState<string>('all');
  const [onlyOverdue, setOnlyOverdue] = useState<boolean>(false);
  const [maxEstimatedHours, setMaxEstimatedHours] = useState<number | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [collapsedChapters, setCollapsedChapters] = useState<Record<string, boolean>>({});
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  // Sync external AI/dashboard filter navigation
  useEffect(() => {
    if (backlogFilterState.subjectId) {
      setSelectedSubjectId(backlogFilterState.subjectId);
    }
    if (backlogFilterState.chapterId) {
      setSelectedChapterId(backlogFilterState.chapterId);
    }
  }, [backlogFilterState]);

  const showFeedback = (msg: string) => {
    setActionFeedback(msg);
    setTimeout(() => setActionFeedback(null), 3500);
  };

  const availableChapters = useMemo(() => {
    const chaps: { id: string; title: string; subjectId: string; subjectName: string }[] = [];
    for (const sub of activeSyllabus.subjects) {
      if (selectedSubjectId !== 'all' && sub.id !== selectedSubjectId) continue;
      for (const u of sub.units) {
        if (u.isArchived) continue;
        for (const c of u.chapters) {
          if (c.isArchived || c.isExcluded) continue;
          chaps.push({
            id: c.id,
            title: c.title,
            subjectId: sub.id,
            subjectName: sub.name,
          });
        }
      }
    }
    return chaps;
  }, [activeSyllabus.subjects, selectedSubjectId]);

  const examTargetSubjects = useMemo(() => {
    if (selectedExamMilestoneId === 'all') return undefined;
    const m = milestones.find((item) => item.id === selectedExamMilestoneId);
    return m?.subjects;
  }, [selectedExamMilestoneId, milestones]);

  const todayStr = new Date().toISOString().split('T')[0];

  const backlogData = useMemo(() => {
    const filters: BacklogFilterOptions = {
      subjectId: selectedSubjectId,
      chapterId: selectedChapterId,
      status: selectedStatus,
      priority: selectedPriority,
      examTargetSubjects,
      onlyOverdue,
      maxEstimatedHours,
      searchQuery,
    };
    return buildHierarchicalBacklog(
      activeSyllabus.subjects,
      masteryMap,
      studyTasks,
      revisionTasks,
      pyqs,
      filters,
      todayStr,
      Boolean(preferences.autoCompleteFromStages)
    );
  }, [
    activeSyllabus.subjects,
    masteryMap,
    studyTasks,
    revisionTasks,
    pyqs,
    selectedSubjectId,
    selectedChapterId,
    selectedStatus,
    selectedPriority,
    examTargetSubjects,
    onlyOverdue,
    maxEstimatedHours,
    searchQuery,
    todayStr,
    preferences.autoCompleteFromStages,
  ]);

  const handleStatusChange = (item: BacklogTopicItem, newStatus: TopicStatus) => {
    updateTopicMastery(item.topicId, {
      chapterId: item.chapterId,
      subjectId: item.subjectId,
      status: newStatus,
    });
    showFeedback(`Updated "${item.topicTitle}" status to ${newStatus}.`);
  };

  const handleStartStudying = (item: BacklogTopicItem) => {
    updateTopicMastery(item.topicId, {
      chapterId: item.chapterId,
      subjectId: item.subjectId,
      status: 'In Progress',
      startDate: todayStr,
      lastStudiedDate: todayStr,
    });
    // Ensure a task is on today's study plan
    const hasTodayTask = studyTasks.some(
      (t) => t.topicId === item.topicId && t.date === todayStr && !t.completed
    );
    if (!hasTodayTask) {
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
        priority: item.priority,
        energySlot: 'morning_high',
        completed: false,
        notes: `Started from Backlog · ${item.backlogReason}`,
      });
    }
    showFeedback(`Started studying "${item.topicTitle}" and added to Today's Study Plan.`);
  };

  const handleScheduleTopic = (item: BacklogTopicItem, dayOffset: number) => {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + dayOffset);
    const dateStr = targetDate.toISOString().split('T')[0];

    const existingTask = studyTasks.find((t) => t.topicId === item.topicId && !t.completed);
    if (existingTask) {
      updateStudyTask(existingTask.id, { date: dateStr });
      showFeedback(`Rescheduled "${item.topicTitle}" to ${dateStr}.`);
    } else {
      addStudyTask({
        date: dateStr,
        subjectId: item.subjectId,
        subjectName: item.subjectName,
        chapterId: item.chapterId,
        chapterTitle: item.chapterTitle,
        topicId: item.topicId,
        topicTitle: item.topicTitle,
        taskType: item.status === 'Needs Revision' ? 'revision' : 'theory',
        plannedMinutes: preferences.sessionDurationMinutes || 60,
        actualMinutes: 0,
        priority: item.priority,
        energySlot: 'morning_high',
        completed: false,
        notes: `Scheduled from Backlog`,
      });
      showFeedback(`Scheduled "${item.topicTitle}" for ${dateStr}.`);
    }
  };

  const handleFlagForRevision = (item: BacklogTopicItem) => {
    updateTopicMastery(item.topicId, {
      chapterId: item.chapterId,
      subjectId: item.subjectId,
      status: 'Needs Revision',
    });
    addRevisionTask({
      id: `rev-${Date.now()}`,
      topicId: item.topicId,
      chapterId: item.chapterId,
      subjectId: item.subjectId,
      topicTitle: item.topicTitle,
      subjectName: item.subjectName,
      revisionStep: 1,
      scheduledDate: todayStr,
      completed: false,
    });
    showFeedback(`Marked "${item.topicTitle}" as Needs Revision and queued in Spaced Revision.`);
  };

  const handleRemoveFromStudyPlan = (item: BacklogTopicItem) => {
    if (item.linkedTaskIds.length > 0) {
      item.linkedTaskIds.forEach((id) => deleteStudyTask(id));
      showFeedback(
        `Removed "${item.topicTitle}" from active Study Plan tasks (syllabus topic preserved).`
      );
    } else {
      updateTopicMastery(item.topicId, {
        chapterId: item.chapterId,
        subjectId: item.subjectId,
        status: 'On Hold',
        backlogReason: 'Placed On Hold by user',
      });
      showFeedback(
        `Placed "${item.topicTitle}" On Hold (syllabus topic preserved).`
      );
    }
  };

  const toggleChapterCollapse = (chapterId: string) => {
    setCollapsedChapters((prev) => ({
      ...prev,
      [chapterId]: !prev[chapterId],
    }));
  };

  const resetFilters = () => {
    setSelectedSubjectId('all');
    setSelectedChapterId('all');
    setSelectedStatus('all');
    setSelectedPriority('all');
    setSelectedExamMilestoneId('all');
    setOnlyOverdue(false);
    setMaxEstimatedHours(undefined);
    setSearchQuery('');
    setBacklogFilterState({ subjectId: 'all', chapterId: 'all' });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Backlog Manager
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Actionable hierarchy: Subject → Chapter → Topic → Subtopic. Unfinished topics remain in backlog until you explicitly mark them Completed.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {onNavigateToAI && (
            <button
              onClick={onNavigateToAI}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white text-xs font-semibold transition cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>Plan Backlog with AI</span>
            </button>
          )}
        </div>
      </div>

      {/* Feedback Banner */}
      {actionFeedback && (
        <div
          role="status"
          className="p-3.5 rounded-xl bg-blue-950/80 border border-blue-700/60 text-blue-200 text-xs font-medium flex items-center justify-between"
        >
          <span>{actionFeedback}</span>
          <button
            onClick={() => setActionFeedback(null)}
            className="text-blue-400 hover:text-white ml-4 text-xs"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 rounded-2xl bg-[#0F1629] border border-slate-800/90">
          <div className="text-xs text-slate-400">Unfinished Topics</div>
          <div className="text-2xl font-bold text-white tabular-nums mt-1">
            {backlogData.totalUnfinishedTopics}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">
            {selectedSubjectId === 'all'
              ? `Across ${backlogData.subjectGroups.length} subjects`
              : `Filtered to ${
                  activeSyllabus.subjects.find((s) => s.id === selectedSubjectId)?.name ||
                  selectedSubjectId
                }`}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#0F1629] border border-slate-800/90">
          <div className="text-xs text-slate-400">Overdue Tasks / Topics</div>
          <div className="text-2xl font-bold text-rose-400 tabular-nums mt-1">
            {backlogData.totalOverdueTopics}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">Past target or scheduled date</div>
        </div>

        <div className="p-4 rounded-2xl bg-[#0F1629] border border-slate-800/90">
          <div className="text-xs text-slate-400">Completion Rule</div>
          <div className="text-sm font-semibold text-purple-300 mt-1.5">
            {preferences.autoCompleteFromStages ? 'Auto-Stage Enabled' : 'Manual Completion Only'}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">
            Syllabus topics are never deleted when removed from plan
          </div>
        </div>
      </div>

      {/* Subject Quick Selector Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => {
            setSelectedSubjectId('all');
            setSelectedChapterId('all');
            setBacklogFilterState({ subjectId: 'all', chapterId: 'all' });
          }}
          className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
            selectedSubjectId === 'all'
              ? 'bg-blue-600 text-white'
              : 'bg-[#0F1629] text-slate-300 hover:bg-slate-800 border border-slate-800'
          }`}
        >
          All Subjects
        </button>
        {activeSyllabus.subjects.map((sub) => (
          <button
            key={sub.id}
            onClick={() => {
              setSelectedSubjectId(sub.id);
              setSelectedChapterId('all');
              setBacklogFilterState({ subjectId: sub.id, chapterId: 'all' });
            }}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
              selectedSubjectId === sub.id
                ? 'bg-blue-600 text-white'
                : 'bg-[#0F1629] text-slate-300 hover:bg-slate-800 border border-slate-800'
            }`}
          >
            {sub.name} Only
          </button>
        ))}
      </div>

      {/* Detailed Filters Bar */}
      <div className="p-4 rounded-2xl bg-[#0F1629] border border-slate-800/90 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
            <Filter className="w-3.5 h-3.5 text-blue-400" />
            <span>Filter Backlog Hierarchy</span>
          </div>
          <button
            onClick={resetFilters}
            className="text-xs text-blue-400 hover:text-blue-300 cursor-pointer"
          >
            Reset All Filters
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          {/* Search */}
          <div className="relative lg:col-span-2">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search topic, subtopic, or chapter..."
              aria-label="Search backlog topics"
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#080C17] border border-slate-800 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Chapter Filter */}
          <div>
            <select
              aria-label="Filter by Chapter"
              value={selectedChapterId}
              onChange={(e) => setSelectedChapterId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-[#080C17] border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
            >
              <option value="all">All Chapters</option>
              {availableChapters.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.subjectName}: {c.title}
                </option>
              ))}
            </select>
          </div>

          {/* Topic Status Filter */}
          <div>
            <select
              aria-label="Filter by Topic Status"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as any)}
              className="w-full px-3 py-2 rounded-xl bg-[#080C17] border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
            >
              <option value="all">All Unfinished Statuses</option>
              <option value="Not Started">Not Started</option>
              <option value="In Progress">In Progress</option>
              <option value="Needs Revision">Needs Revision</option>
              <option value="On Hold">On Hold</option>
            </select>
          </div>

          {/* Priority Filter */}
          <div>
            <select
              aria-label="Filter by Priority"
              value={selectedPriority}
              onChange={(e) => setSelectedPriority(e.target.value as any)}
              className="w-full px-3 py-2 rounded-xl bg-[#080C17] border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
            >
              <option value="all">All Priorities</option>
              <option value="high">High Priority</option>
              <option value="medium">Medium Priority</option>
              <option value="low">Low Priority</option>
            </select>
          </div>

          {/* Exam Target Filter */}
          <div>
            <select
              aria-label="Filter by Exam Target"
              value={selectedExamMilestoneId}
              onChange={(e) => setSelectedExamMilestoneId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-[#080C17] border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
            >
              <option value="all">All Exam Targets</option>
              {milestones
                .filter((m) => !m.isArchived)
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.title}
                  </option>
                ))}
            </select>
          </div>
        </div>

        {/* Secondary filter controls: Overdue toggle */}
        <div className="flex flex-wrap items-center gap-4 pt-1">
          <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={onlyOverdue}
              onChange={(e) => setOnlyOverdue(e.target.checked)}
              className="rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-blue-500"
            />
            <span>Overdue tasks/topics only</span>
          </label>
        </div>
      </div>

      {/* Hierarchical Backlog List: Subject -> Chapter -> Topic -> Subtopic */}
      {backlogData.subjectGroups.length === 0 ? (
        <div className="p-10 rounded-2xl bg-[#0F1629] border border-slate-800 text-center space-y-3">
          <Layers className="w-10 h-10 text-blue-400 mx-auto" />
          <h2 className="text-base font-bold text-white">
            No Unfinished Backlog Topics Match Current Filters
          </h2>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Either all topics in this selection are marked Completed, or your filters narrowed the list.
          </p>
          <button
            onClick={resetFilters}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition cursor-pointer"
          >
            Show All Unfinished Topics
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {backlogData.subjectGroups.map((subGroup) => (
            <section
              key={subGroup.subjectId}
              className="rounded-2xl bg-[#0F1629] border border-slate-800/90 overflow-hidden"
            >
              {/* Subject Header */}
              <div className="px-5 py-4 bg-slate-900/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-white">{subGroup.subjectName}</h2>
                  <p className="text-xs text-slate-400 mt-0.5 tabular-nums">
                    {subGroup.unfinishedTopicsCount} unfinished topics ·{' '}
                    {subGroup.chapters.length} chapters
                    {subGroup.overdueCount > 0 ? ` · ${subGroup.overdueCount} overdue` : ''}
                  </p>
                </div>
              </div>

              {/* Chapters inside Subject */}
              <div className="divide-y divide-slate-800/80">
                {subGroup.chapters.map((chapGroup) => {
                  const isCollapsed = Boolean(collapsedChapters[chapGroup.chapterId]);
                  return (
                    <div key={chapGroup.chapterId} className="bg-[#0F1629]">
                      {/* Chapter Row */}
                      <button
                        onClick={() => toggleChapterCollapse(chapGroup.chapterId)}
                        className="w-full px-5 py-3.5 flex items-center justify-between text-left hover:bg-slate-800/40 transition cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5">
                          {isCollapsed ? (
                            <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-blue-400 shrink-0" />
                          )}
                          <div>
                            <div className="text-sm font-semibold text-slate-100">
                              Chapter {chapGroup.chapterNumber}: {chapGroup.chapterTitle}
                            </div>
                            <div className="text-xs text-slate-400 mt-0.5 tabular-nums">
                              {chapGroup.unitTitle} · {chapGroup.unfinishedTopicsCount} unfinished
                              topics · Highest Priority:{' '}
                              {chapGroup.highestPriority.toUpperCase()}
                            </div>
                          </div>
                        </div>
                      </button>

                      {/* Topics inside Chapter */}
                      {!isCollapsed && (
                        <div className="px-5 pb-4 pt-1 space-y-3">
                          {chapGroup.topics.map((topic) => (
                            <div
                              key={topic.topicId}
                              className="p-4 rounded-xl bg-[#080C17] border border-slate-800/90 hover:border-slate-700 transition space-y-3"
                            >
                              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
                                <div className="space-y-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <button
                                      onClick={() => onSelectTopic(topic.topicId)}
                                      className="text-sm font-bold text-white hover:text-blue-400 text-left transition cursor-pointer"
                                    >
                                      {topic.topicTitle}
                                    </button>
                                  </div>

                                  {/* Unboxed clean metadata line per Zero-Pill rule */}
                                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 tabular-nums">
                                    <span
                                      className={
                                        topic.status === 'Needs Revision'
                                          ? 'text-amber-400 font-semibold'
                                          : topic.status === 'In Progress'
                                          ? 'text-blue-400 font-semibold'
                                          : topic.status === 'On Hold'
                                          ? 'text-purple-400 font-semibold'
                                          : 'text-slate-300'
                                      }
                                    >
                                      Status: {preferences.statusLabels?.[topic.status] || topic.status}
                                    </span>
                                    {topic.isOverdue && (
                                      <>
                                        <span aria-hidden="true">·</span>
                                        <span className="text-rose-400 font-semibold flex items-center gap-1">
                                          <AlertTriangle className="w-3.5 h-3.5" />
                                          Overdue ({topic.overdueDays}d)
                                        </span>
                                      </>
                                    )}
                                    <span aria-hidden="true">·</span>
                                    <span
                                      className={
                                        topic.priority === 'high'
                                          ? 'text-rose-300 font-semibold'
                                          : topic.priority === 'medium'
                                          ? 'text-blue-300'
                                          : 'text-slate-400'
                                      }
                                    >
                                      Priority: {topic.priority.toUpperCase()}
                                    </span>
                                    {topic.scheduledDate && (
                                      <>
                                        <span aria-hidden="true">·</span>
                                        <span className="text-emerald-400">
                                          Planned: {topic.scheduledDate}
                                        </span>
                                      </>
                                    )}
                                  </div>

                                  {/* Explicit Reason in Backlog */}
                                  <p className="text-xs text-slate-400">
                                    <span className="text-slate-500">Backlog Reason:</span>{' '}
                                    {topic.backlogReason}
                                  </p>

                                  {/* Subtopics Hierarchy */}
                                  {topic.subtopics.length > 0 && (
                                    <div className="pt-1.5">
                                      <div className="text-[11px] font-medium text-slate-400 mb-1">
                                        Subtopics ({topic.subtopics.length}):
                                      </div>
                                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-300">
                                        {topic.subtopics.map((st, idx) => (
                                          <span key={st.id || idx} className="flex items-center gap-1.5">
                                            <span className="text-slate-600">•</span>
                                            <span>{st.title}</span>
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>

                                {/* Direct Backlog Topic Actions */}
                                <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                                  <button
                                    onClick={() => handleStatusChange(topic, 'Completed')}
                                    aria-label={`Mark ${topic.topicTitle} complete`}
                                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-950/70 hover:bg-emerald-900/80 text-emerald-300 border border-emerald-800/70 text-xs font-medium transition cursor-pointer"
                                  >
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    <span>Mark Complete</span>
                                  </button>

                                  <button
                                    onClick={() => handleStartStudying(topic)}
                                    aria-label={`Start studying ${topic.topicTitle}`}
                                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-950/70 hover:bg-blue-900/80 text-blue-300 border border-blue-800/70 text-xs font-medium transition cursor-pointer"
                                  >
                                    <Play className="w-3.5 h-3.5" />
                                    <span>Start Studying</span>
                                  </button>

                                  <button
                                    onClick={() => handleScheduleTopic(topic, 0)}
                                    aria-label={`Schedule ${topic.topicTitle} for today`}
                                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 text-xs font-medium transition cursor-pointer"
                                  >
                                    <CalendarPlus className="w-3.5 h-3.5 text-purple-400" />
                                    <span>Today</span>
                                  </button>

                                  <button
                                    onClick={() => handleScheduleTopic(topic, 1)}
                                    aria-label={`Reschedule ${topic.topicTitle} to tomorrow`}
                                    className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 text-xs font-medium transition cursor-pointer"
                                  >
                                    Tomorrow
                                  </button>

                                  <button
                                    onClick={() => handleFlagForRevision(topic)}
                                    aria-label={`Revise ${topic.topicTitle}`}
                                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-950/60 hover:bg-amber-900/70 text-amber-300 border border-amber-800/60 text-xs font-medium transition cursor-pointer"
                                  >
                                    <RotateCcw className="w-3.5 h-3.5" />
                                    <span>Revise</span>
                                  </button>

                                  <button
                                    onClick={() => onSelectTopic(topic.topicId)}
                                    aria-label={`Edit ${topic.topicTitle}`}
                                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 text-xs font-medium transition cursor-pointer"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                    <span>Edit</span>
                                  </button>

                                  <button
                                    onClick={() => handleRemoveFromStudyPlan(topic)}
                                    aria-label={`Put ${topic.topicTitle} on hold or remove from plan`}
                                    title="Remove from active study plan or place On Hold (Never deletes syllabus topic)"
                                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-rose-950/60 text-slate-400 hover:text-rose-300 border border-slate-800 text-xs font-medium transition cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    <span>{topic.linkedTaskIds.length > 0 ? 'Unschedule' : 'On Hold'}</span>
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
};
