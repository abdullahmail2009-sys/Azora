import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext.tsx';
import { DailyStudyTask } from '../types/index.ts';
import { RevisionView } from './RevisionView.tsx';
import { TestsExamsView } from './TestsExamsView.tsx';
import { PCMToolsView } from './PCMToolsView.tsx';
import { ReportsView } from './ReportsView.tsx';
import {
  Calendar,
  Plus,
  CheckCircle2,
  Trash2,
  Sparkles,
  AlertCircle,
  Sun,
  Moon,
  Sunset,
  RotateCcw,
  Award,
  Wrench,
  BarChart3,
  Play,
  Pause,
  Timer,
} from 'lucide-react';

export interface StudyPlannerViewProps {
  initialSection?: 'schedule' | 'revisions' | 'tests-exams' | 'pcm-tools' | 'reports';
  onOpenAITutorForMistake?: (mistakeText: string) => void;
}

export const StudyPlannerView: React.FC<StudyPlannerViewProps> = ({
  initialSection = 'schedule',
  onOpenAITutorForMistake = () => {},
}) => {
  const {
    activeSyllabus,
    studyTasks,
    addStudyTask,
    updateStudyTask,
    toggleStudyTask,
    deleteStudyTask,
    updateTopicMastery,
    masteryMap,
    preferences,
  } = useApp();

  const [activeSubSection, setActiveSubSection] = useState<
    'schedule' | 'revisions' | 'tests-exams' | 'pcm-tools' | 'reports'
  >(initialSection);

  useEffect(() => {
    setActiveSubSection(initialSection);
  }, [initialSection]);

  const todayStr = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState(todayStr);

  const [showAddModal, setShowAddModal] = useState(false);
  const [newSubjectId, setNewSubjectId] = useState(activeSyllabus.subjects[0]?.id || 'physics');
  const [newChapterId, setNewChapterId] = useState('');
  const [newTopicId] = useState('');
  const [newTopicTitle, setNewTopicTitle] = useState('');
  const [newTaskType, setNewTaskType] = useState<DailyStudyTask['taskType']>('theory');
  const [newPlannedMinutes, setNewPlannedMinutes] = useState(60);
  const [newEnergySlot, setNewEnergySlot] = useState<DailyStudyTask['energySlot']>('morning_high');
  const [newPriority] = useState<DailyStudyTask['priority']>('high');
  const [newNotes, setNewNotes] = useState('');

  // Active Focus Session Timer State
  const [focusTask, setFocusTask] = useState<DailyStudyTask | null>(null);
  const [timerDurationMins, setTimerDurationMins] = useState<number>(
    preferences.sessionDurationMinutes || 45
  );
  const [secondsLeft, setSecondsLeft] = useState<number>(
    (preferences.sessionDurationMinutes || 45) * 60
  );
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);
  const [timerFeedback, setTimerFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (!isTimerRunning) return;
    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          setIsTimerRunning(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isTimerRunning]);

  const startFocusOnTask = (task: DailyStudyTask) => {
    setFocusTask(task);
    const mins = task.plannedMinutes || preferences.sessionDurationMinutes || 45;
    setTimerDurationMins(mins);
    setSecondsLeft(mins * 60);
    setIsTimerRunning(true);
    setTimerFeedback(null);
  };

  const handleCompleteFocusSession = () => {
    const elapsedMins = Math.max(
      5,
      Math.round((timerDurationMins * 60 - secondsLeft) / 60) || timerDurationMins
    );
    if (focusTask) {
      updateStudyTask(focusTask.id, {
        completed: true,
        actualMinutes: (focusTask.actualMinutes || 0) + elapsedMins,
      });
      if (focusTask.topicId) {
        const existingMastery = masteryMap[focusTask.topicId];
        updateTopicMastery(focusTask.topicId, {
          chapterId: focusTask.chapterId,
          subjectId: focusTask.subjectId,
          totalStudyMinutes: (existingMastery?.totalStudyMinutes || 0) + elapsedMins,
          lastStudiedDate: todayStr,
        });
      }
      setTimerFeedback(
        `Logged ${elapsedMins} mins for "${focusTask.topicTitle}" and marked task completed.`
      );
    } else {
      setTimerFeedback(`Completed ${elapsedMins}m focus session.`);
    }
    setIsTimerRunning(false);
    setFocusTask(null);
    setSecondsLeft(timerDurationMins * 60);
  };

  const formatTimer = (totalSecs: number) => {
    const m = Math.floor(totalSecs / 60);
    const s = totalSecs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const currentSubject = activeSyllabus.subjects.find((s) => s.id === newSubjectId);
  const allChapters = currentSubject?.units.flatMap((u) => u.chapters) || [];
  const currentChapter = allChapters.find((c) => c.id === newChapterId);

  // Filter tasks for selected date
  const dateTasks = studyTasks.filter((t) => t.date === selectedDate);
  const totalPlannedMinutes = dateTasks.reduce((acc, t) => acc + t.plannedMinutes, 0);
  const dailyHoursLimit = preferences.dailyStudyHoursLimit;
  const isOverLimit = totalPlannedMinutes > dailyHoursLimit * 60;

  const handleAutoGeneratePlan = () => {
    // Collect uncompleted high priority topics across active subjects
    let addedCount = 0;
    activeSyllabus.subjects.forEach((sub) => {
      if (addedCount >= 3) return;
      sub.units.forEach((u) => {
        u.chapters.forEach((c) => {
          if (c.isArchived || c.isExcluded || addedCount >= 3) return;
          c.topics.forEach((t) => {
            if (t.isArchived || t.isExcluded || addedCount >= 3) return;
            // Check if already in tasks for today
            const alreadyScheduled = studyTasks.some(
              (st) => st.date === selectedDate && st.topicId === t.id
            );
            if (!alreadyScheduled) {
              addStudyTask({
                date: selectedDate,
                subjectId: sub.id,
                subjectName: sub.name,
                chapterId: c.id,
                chapterTitle: c.title,
                topicId: t.id,
                topicTitle: t.title,
                taskType:
                  sub.id === 'physics'
                    ? 'numericals'
                    : sub.id === 'chemistry'
                    ? 'ncert'
                    : 'theory',
                plannedMinutes: 60,
                actualMinutes: 0,
                priority: 'high',
                energySlot:
                  addedCount === 0
                    ? 'morning_high'
                    : addedCount === 1
                    ? 'evening_high'
                    : 'night_review',
                completed: false,
                notes: 'Auto-scheduled high priority focus session',
              });
              addedCount++;
            }
          });
        });
      });
    });
  };

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTopicTitle.trim()) return;

    addStudyTask({
      date: selectedDate,
      subjectId: newSubjectId,
      subjectName: currentSubject?.name || 'Subject',
      chapterId: newChapterId || 'custom-ch',
      chapterTitle: currentChapter?.title || 'General Chapter',
      topicId: newTopicId || `custom-${Date.now()}`,
      topicTitle: newTopicTitle,
      taskType: newTaskType,
      plannedMinutes: newPlannedMinutes,
      actualMinutes: 0,
      priority: newPriority,
      energySlot: newEnergySlot,
      completed: false,
      notes: newNotes,
    });

    setShowAddModal(false);
    setNewTopicTitle('');
    setNewNotes('');
  };

  const energySlots = [
    { id: 'morning_high', label: 'Morning High-Focus', icon: Sun, color: 'text-[#C87D18]' },
    { id: 'afternoon_medium', label: 'Afternoon Practice', icon: Sun, color: 'text-[#42BDAE]' },
    { id: 'evening_high', label: 'Evening Problem Solving', icon: Sunset, color: 'text-[#2574A9]' },
    { id: 'night_review', label: 'Night Quick Review', icon: Moon, color: 'text-[#5C4799]' },
  ];

  const plannerSubTabs = [
    { id: 'schedule' as const, label: 'Daily Schedule', icon: Calendar },
    { id: 'revisions' as const, label: 'Spaced Revisions', icon: RotateCcw },
    { id: 'tests-exams' as const, label: 'Mock Tests & Targets', icon: Award },
    { id: 'pcm-tools' as const, label: 'Formula & Mistake Tools', icon: Wrench },
    { id: 'reports' as const, label: 'Pace & Analytics', icon: BarChart3 },
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* Segmented Study Hub Sub-Navigation */}
      <div className="p-1.5 rounded-2xl bg-[#F5EFE2] border border-[#E2DAC7] flex items-center gap-1.5 overflow-x-auto">
        {plannerSubTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSubSection === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubSection(tab.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                isActive
                  ? 'bg-[#1B4D48] text-[#FBF7EF] shadow-2xs'
                  : 'text-[#4A6B66] hover:text-[#1B4D48] hover:bg-[#EDE5D4]'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-[#75D9B4]' : 'text-[#42BDAE]'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {activeSubSection === 'revisions' && <RevisionView />}
      {activeSubSection === 'tests-exams' && <TestsExamsView />}
      {activeSubSection === 'pcm-tools' && (
        <PCMToolsView onOpenAITutorForMistake={onOpenAITutorForMistake} />
      )}
      {activeSubSection === 'reports' && <ReportsView />}

      {activeSubSection === 'schedule' && (
        <>
          {/* Planner Header & Daily Controls */}
          <div className="p-5 sm:p-6 rounded-3xl bg-[#F5EFE2] border border-[#E2DAC7] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-[#1B4D48] flex items-center gap-2.5">
                <Calendar className="w-6 h-6 text-[#42BDAE]" />
                <span>Automatic Daily Study Planner</span>
              </h1>
              <p className="text-xs text-[#4A6B66] mt-1">
                Schedules demanding derivations & numericals during high-energy slots; light revisions during lower-energy windows.
              </p>
            </div>

            <div className="flex items-center gap-2.5 flex-wrap">
              <button
                onClick={handleAutoGeneratePlan}
                className="px-3.5 py-2 rounded-xl bg-[#75D9B4]/30 hover:bg-[#75D9B4]/45 text-[#1B4D48] border border-[#42BDAE]/60 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-[#1B4D48]" />
                <span>Auto-Generate Plan</span>
              </button>
              <button
                onClick={() => setShowAddModal(true)}
                className="px-3.5 py-2 rounded-xl bg-[#1B4D48] hover:bg-[#143B37] text-[#FBF7EF] text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition cursor-pointer"
              >
                <Plus className="w-4 h-4 text-[#75D9B4]" />
                <span>Add Task</span>
              </button>
            </div>
          </div>

          {/* Date Picker Bar & Daily Hour Limit */}
          <div className="p-4 rounded-2xl bg-[#F5EFE2] border border-[#E2DAC7] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <label className="text-xs font-bold text-[#1B4D48]">Selected Date:</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-[#D4CCB8] bg-[#FBF7EF] text-xs font-semibold text-[#1B4D48]"
              />
              {selectedDate === todayStr && (
                <span className="text-[11px] font-semibold text-[#26877B]">· Today</span>
              )}
            </div>

            <div className="flex items-center gap-4 text-xs tabular-nums">
              <div>
                <span className="text-[#4A6B66]">Planned Today: </span>
                <span className={`font-bold ${isOverLimit ? 'text-[#9E2E44]' : 'text-[#1B4D48]'}`}>
                  {(totalPlannedMinutes / 60).toFixed(1)} hrs
                </span>
                <span className="text-[#4A6B66]"> / {dailyHoursLimit}h max</span>
              </div>
              {isOverLimit && (
                <span className="text-[#9E2E44] font-semibold flex items-center gap-1 text-[11px]">
                  <AlertCircle className="w-3.5 h-3.5" /> Exceeds daily study limit!
                </span>
              )}
            </div>
          </div>

          {/* Built-In Focus Session Timer Bar */}
          <div className="p-4 sm:p-5 rounded-2xl bg-[#F5EFE2] border border-[#E2DAC7] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#1B4D48] text-[#75D9B4] flex items-center justify-center shrink-0">
                <Timer className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-bold text-[#1B4D48] flex items-center gap-2">
                  <span>Active Study Focus Timer</span>
                  {focusTask && (
                    <span className="text-[#26877B] font-semibold">
                      · {focusTask.topicTitle} ({focusTask.subjectName})
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-[#4A6B66] mt-0.5">
                  {timerFeedback ||
                    'Select a preset duration or click "Focus" on any scheduled task below to track actual study minutes.'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="flex items-center gap-1 bg-[#EDE5D5] p-1 rounded-xl text-xs">
                {[25, 45, 60].map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => {
                      setIsTimerRunning(false);
                      setTimerDurationMins(mins);
                      setSecondsLeft(mins * 60);
                    }}
                    className={`px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer ${
                      timerDurationMins === mins
                        ? 'bg-[#1B4D48] text-[#FBF7EF]'
                        : 'text-[#4A6B66] hover:text-[#1B4D48]'
                    }`}
                  >
                    {mins}m
                  </button>
                ))}
              </div>

              <div className="px-3.5 py-1.5 rounded-xl bg-[#FBF7EF] border border-[#D8CEB8] font-mono text-base font-bold text-[#1B4D48] tabular-nums">
                {formatTimer(secondsLeft)}
              </div>

              <button
                type="button"
                onClick={() => setIsTimerRunning((prev) => !prev)}
                className="px-3.5 py-2 rounded-xl bg-[#1B4D48] hover:bg-[#143B37] text-[#FBF7EF] text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                {isTimerRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                <span>{isTimerRunning ? 'Pause' : 'Start Focus'}</span>
              </button>

              {(isTimerRunning || focusTask || secondsLeft < timerDurationMins * 60) && (
                <button
                  type="button"
                  onClick={handleCompleteFocusSession}
                  className="px-3.5 py-2 rounded-xl bg-[#42BDAE] hover:bg-[#35A597] text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Log & Complete</span>
                </button>
              )}
            </div>
          </div>

          {/* Tasks Organized by Energy Slots */}
          <div className="space-y-4">
            {energySlots.map((slot) => {
              const slotTasks = dateTasks.filter((t) => t.energySlot === slot.id);
              const SlotIcon = slot.icon;

              return (
                <div
                  key={slot.id}
                  className="p-5 rounded-2xl bg-[#F5EFE2] border border-[#E2DAC7] shadow-xs space-y-3"
                >
                  <div className="flex items-center justify-between border-b border-[#E2DAC7] pb-2.5">
                    <div className="flex items-center gap-2">
                      <SlotIcon className={`w-4 h-4 ${slot.color}`} />
                      <h3 className="text-xs font-bold text-[#1B4D48] uppercase tracking-wider">
                        {slot.label}
                      </h3>
                    </div>
                    <span className="text-[11px] text-[#4A6B66] tabular-nums">
                      {slotTasks.length} Task{slotTasks.length !== 1 ? 's' : ''}
                    </span>
                  </div>

                  {slotTasks.length === 0 ? (
                    <div className="text-xs text-[#4A6B66] py-2">
                      No tasks assigned to this slot yet.
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {slotTasks.map((task) => (
                        <div
                          key={task.id}
                          className={`p-3.5 rounded-xl border transition flex items-center justify-between gap-3 ${
                            task.completed
                              ? 'bg-[#FBF7EF]/60 border-[#E5DEC9] opacity-75'
                              : 'bg-[#FBF7EF] border-[#E5DEC9] shadow-2xs'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => toggleStudyTask(task.id)}
                              aria-label={`Toggle completion for ${task.topicTitle}`}
                              className={`w-5 h-5 rounded-lg flex items-center justify-center border transition cursor-pointer ${
                                task.completed
                                  ? 'bg-[#42BDAE] border-[#42BDAE] text-white'
                                  : 'border-[#C8BFA8] hover:border-[#42BDAE]'
                              }`}
                            >
                              {task.completed && <CheckCircle2 className="w-4 h-4" />}
                            </button>
                            <div>
                              <div className="text-xs font-bold text-[#1B4D48] flex items-center gap-2 flex-wrap">
                                <span
                                  className={
                                    task.completed ? 'line-through text-[#6E8B87]' : 'text-[#1B4D48]'
                                  }
                                >
                                  {task.topicTitle}
                                </span>
                                <span className="text-[11px] font-medium text-[#26877B]">
                                  · {task.subjectName}
                                </span>
                              </div>
                              <div className="text-[11px] text-[#4A6B66] mt-0.5 tabular-nums">
                                {task.taskType.toUpperCase()} · Planned: {task.plannedMinutes}m
                                {task.notes && ` · Notes: ${task.notes}`}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5">
                            {!task.completed && (
                              <button
                                type="button"
                                onClick={() => startFocusOnTask(task)}
                                className="px-2.5 py-1 rounded-lg bg-[#75D9B4]/30 hover:bg-[#75D9B4]/45 text-[#1B4D48] border border-[#42BDAE]/50 text-[11px] font-semibold flex items-center gap-1 transition cursor-pointer"
                                title="Start focus timer for this task"
                              >
                                <Play className="w-3 h-3" />
                                <span>Focus</span>
                              </button>
                            )}
                            <button
                              onClick={() => deleteStudyTask(task.id)}
                              aria-label={`Delete task ${task.topicTitle}`}
                              className="p-1.5 rounded-lg text-[#4A6B66] hover:text-[#9E2E44] transition cursor-pointer"
                              title="Delete task"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Add Task Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1B4D48]/35 backdrop-blur-xs p-4">
          <form
            onSubmit={handleCreateTask}
            className="w-full max-w-lg bg-[#FBF7EF] rounded-3xl p-6 shadow-2xl border border-[#E2DAC7] space-y-4 text-[#1B4D48]"
          >
            <h3 className="text-base font-bold text-[#1B4D48]">Add New Daily Study Task</h3>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="font-semibold text-[#4A6B66]">Subject</label>
                <select
                  value={newSubjectId}
                  onChange={(e) => {
                    setNewSubjectId(e.target.value);
                    setNewChapterId('');
                  }}
                  className="mt-1 w-full p-2 rounded-xl border border-[#D4CCB8] bg-white text-[#1B4D48]"
                >
                  {activeSyllabus.subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold text-[#4A6B66]">Chapter</label>
                <select
                  value={newChapterId}
                  onChange={(e) => setNewChapterId(e.target.value)}
                  className="mt-1 w-full p-2 rounded-xl border border-[#D4CCB8] bg-white text-[#1B4D48]"
                >
                  <option value="">Select Chapter (Optional)</option>
                  {allChapters.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="text-xs">
              <label className="font-semibold text-[#4A6B66]">Topic or Task Goal</label>
              <input
                type="text"
                required
                value={newTopicTitle}
                onChange={(e) => setNewTopicTitle(e.target.value)}
                placeholder="e.g. Derive Lens Maker's formula and solve 5 numericals"
                className="mt-1 w-full p-2.5 rounded-xl border border-[#D4CCB8] bg-white text-[#1B4D48]"
              />
            </div>

            <div className="grid grid-cols-3 gap-3 text-xs">
              <div>
                <label className="font-semibold text-[#4A6B66]">Task Type</label>
                <select
                  value={newTaskType}
                  onChange={(e) => setNewTaskType(e.target.value as any)}
                  className="mt-1 w-full p-2 rounded-xl border border-[#D4CCB8] bg-white text-[#1B4D48]"
                >
                  <option value="theory">Theory Lecture</option>
                  <option value="notes">Notes Making</option>
                  <option value="numericals">Numericals</option>
                  <option value="ncert">NCERT Exercises</option>
                  <option value="pyq">Board PYQs</option>
                  <option value="revision">Revision</option>
                  <option value="test">Mock Test</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-[#4A6B66]">Energy Window</label>
                <select
                  value={newEnergySlot}
                  onChange={(e) => setNewEnergySlot(e.target.value as any)}
                  className="mt-1 w-full p-2 rounded-xl border border-[#D4CCB8] bg-white text-[#1B4D48]"
                >
                  <option value="morning_high">Morning High</option>
                  <option value="afternoon_medium">Afternoon Medium</option>
                  <option value="evening_high">Evening High</option>
                  <option value="night_review">Night Review</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-[#4A6B66]">Duration (min)</label>
                <input
                  type="number"
                  min="15"
                  step="15"
                  value={newPlannedMinutes}
                  onChange={(e) => setNewPlannedMinutes(Number(e.target.value))}
                  className="mt-1 w-full p-2 rounded-xl border border-[#D4CCB8] bg-white text-[#1B4D48]"
                />
              </div>
            </div>

            <div className="text-xs">
              <label className="font-semibold text-[#4A6B66]">Notes (Optional)</label>
              <input
                type="text"
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                placeholder="Specific problem numbers, textbook pages..."
                className="mt-1 w-full p-2 rounded-xl border border-[#D4CCB8] bg-white text-[#1B4D48]"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 rounded-xl border border-[#D4CCB8] bg-[#F5EFE2] text-xs font-semibold text-[#1B4D48] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-[#1B4D48] hover:bg-[#143B37] text-[#FBF7EF] text-xs font-semibold shadow-2xs cursor-pointer"
              >
                Schedule Task
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
