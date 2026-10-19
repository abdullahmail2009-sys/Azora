import React, { useState } from 'react';
import { useApp } from '../context/AppContext.tsx';
import {
  Topic,
  ALL_MASTERY_STAGES,
  MasteryStage,
  ConfidenceRating,
  TopicStatus,
} from '../types/index.ts';
import { checkPrerequisites } from '../utils/prerequisites.ts';
import { calculateTopicMasteryPercentage } from '../utils/progressCalc.ts';
import {
  X,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Clock,
  Target,
  Edit3,
  FileSearch,
  Calendar,
  BookOpen,
  Layers,
  Plus,
} from 'lucide-react';

interface TopicModalProps {
  topic: Topic;
  subjectName: string;
  chapterTitle: string;
  onClose: () => void;
  onOpenAITutorForTopic: (topicTitle: string, chapterTitle: string, subjectName: string) => void;
}

export const TopicModal: React.FC<TopicModalProps> = ({
  topic,
  subjectName,
  chapterTitle,
  onClose,
  onOpenAITutorForTopic,
}) => {
  const {
    activeSyllabus,
    masteryMap,
    updateTopicMastery,
    updateTopic,
    toggleMasteryStage,
    addRevisionTask,
    revisionTasks,
    studyTasks,
    addStudyTask,
    toggleStudyTask,
    pyqs,
    resources,
    addResource,
    preferences,
  } = useApp();

  // Locate unitId for topic structural edits
  const subjectObj = activeSyllabus.subjects.find((s) => s.id === topic.subjectId);
  const unitObj = subjectObj?.units.find((u) =>
    u.chapters.some((c) => c.id === topic.chapterId)
  );

  const mastery = masteryMap[topic.id] || {
    topicId: topic.id,
    chapterId: topic.chapterId,
    subjectId: topic.subjectId,
    status: 'Not Started' as TopicStatus,
    confidence: 3 as ConfidenceRating,
    isConfidenceRated: false,
    personalPriority: 'medium' as 'high' | 'medium' | 'low',
    completedStages: [] as MasteryStage[],
    difficulty: topic.difficulty,
    totalStudyMinutes: 0,
    questionsSolved: 0,
    questionsCorrect: 0,
    updatedAt: new Date().toISOString(),
  };

  const [notes, setNotes] = useState(mastery.notes || '');
  const [newSubtopicTitle, setNewSubtopicTitle] = useState('');
  const [loggedMinutes, setLoggedMinutes] = useState(0);
  const [nextRevDate, setNextRevDate] = useState(mastery.nextRevisionDate || '');
  const [newMistakeSummary, setNewMistakeSummary] = useState('');

  // Check prerequisites
  const completedTopicIds = new Set(
    Object.values(masteryMap)
      .filter((m) => m.status === 'Completed')
      .map((m) => m.topicId)
  );

  const prereqCheck = checkPrerequisites(topic.id, topic.prerequisites, completedTopicIds);
  const masteryPercentage = calculateTopicMasteryPercentage(mastery, topic.subjectId);

  // Relevant PYQs for this topic or chapter
  const relevantPYQs = pyqs.filter(
    (q) =>
      q.topicId === topic.id ||
      (q.chapterId === topic.chapterId &&
        q.questionText.toLowerCase().includes(topic.title.toLowerCase().split(' ')[0]))
  );

  // Relevant formulas & mistakes from resources
  const relevantFormulas = resources.filter(
    (r) =>
      r.type === 'formula' &&
      (r.topicId === topic.id || r.chapterId === topic.chapterId)
  );

  const topicMistakes = resources.filter(
    (r) =>
      r.type === 'mistake' &&
      (r.topicId === topic.id || r.chapterId === topic.chapterId)
  );

  const topicRevisions = revisionTasks.filter((r) => r.topicId === topic.id);

  // Linked Study / Backlog Tasks
  const linkedTasks = studyTasks.filter((t) => t.topicId === topic.id);

  const handleStatusChange = (val: TopicStatus) => {
    updateTopicMastery(topic.id, {
      status: val,
      completedDate:
        val === 'Completed' ? new Date().toISOString().split('T')[0] : mastery.completedDate,
    });
  };

  const handlePersonalPriorityChange = (val: 'high' | 'medium' | 'low') => {
    updateTopicMastery(topic.id, { personalPriority: val });
  };

  const handleConfidenceChange = (val: ConfidenceRating) => {
    updateTopicMastery(topic.id, { confidence: val, isConfidenceRated: true });
  };

  const handleDifficultyChange = (val: 'Easy' | 'Moderate' | 'Hard') => {
    updateTopicMastery(topic.id, { difficulty: val });
    if (unitObj) {
      updateTopic(topic.subjectId, unitObj.id, topic.chapterId, topic.id, { difficulty: val });
    }
  };

  const handleAddSubtopic = () => {
    if (!newSubtopicTitle.trim() || !unitObj) return;
    const nextSubs = [
      ...(topic.subtopics || []),
      { id: `sub-${Date.now()}`, title: newSubtopicTitle.trim() },
    ];
    updateTopic(topic.subjectId, unitObj.id, topic.chapterId, topic.id, {
      subtopics: nextSubs,
    });
    setNewSubtopicTitle('');
  };

  const handleLogStudyTime = () => {
    if (loggedMinutes > 0) {
      updateTopicMastery(topic.id, {
        totalStudyMinutes: mastery.totalStudyMinutes + loggedMinutes,
        lastStudiedDate: new Date().toISOString().split('T')[0],
      });
      setLoggedMinutes(0);
    }
  };

  const handleSaveNextRevisionDate = (dateVal: string) => {
    setNextRevDate(dateVal);
    updateTopicMastery(topic.id, { nextRevisionDate: dateVal });
    if (dateVal) {
      addRevisionTask({
        id: `rev-${topic.id}-${Date.now()}`,
        topicId: topic.id,
        chapterId: topic.chapterId,
        subjectId: topic.subjectId,
        topicTitle: topic.title,
        subjectName,
        revisionStep: 1,
        scheduledDate: dateVal,
        completed: false,
      });
    }
  };

  const handleAddQuickMistake = () => {
    if (!newMistakeSummary.trim()) return;
    addResource({
      subjectId: topic.subjectId,
      chapterId: topic.chapterId,
      topicId: topic.id,
      type: 'mistake',
      title: topic.title,
      content: newMistakeSummary.trim(),
      mistakeDetails: {
        incorrectAttempt: newMistakeSummary.trim(),
        correctConcept: 'Review derivation and key formula conditions',
        whyMade: 'Logged in topic detail view',
      },
    });
    setNewMistakeSummary('');
  };

  const handleScheduleLinkedTaskToday = () => {
    const todayStr = new Date().toISOString().split('T')[0];
    addStudyTask({
      date: todayStr,
      subjectId: topic.subjectId,
      subjectName,
      chapterId: topic.chapterId,
      chapterTitle,
      topicId: topic.id,
      topicTitle: topic.title,
      taskType: 'theory',
      plannedMinutes: 60,
      actualMinutes: 0,
      priority: mastery.personalPriority || 'high',
      energySlot: 'morning_high',
      completed: false,
      notes: 'Scheduled from Topic Detail Screen',
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
      <div className="w-full max-w-3xl bg-[#101626] rounded-3xl shadow-2xl border border-slate-800 my-auto overflow-hidden max-h-[92vh] flex flex-col text-slate-100">
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-slate-800 flex items-start justify-between bg-[#080C17]/70">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-blue-400 mb-1">
              <span>{subjectName}</span>
              <span>•</span>
              <span className="text-slate-400">{chapterTitle}</span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-white leading-snug">
              {topic.title}
            </h2>
            <div className="flex flex-wrap items-center gap-3 mt-2 text-xs">
              <span className="flex items-center gap-1 text-slate-400 font-mono">
                <Clock className="w-3.5 h-3.5 text-blue-400" />
                Actual: {mastery.totalStudyMinutes} mins
              </span>
              <span className="flex items-center gap-1 text-purple-400 font-bold font-mono">
                <Target className="w-3.5 h-3.5" />
                Mastery: {masteryPercentage}%
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close topic modal"
            className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 text-xs">
          {/* Prerequisite Alert */}
          {prereqCheck.hasUnmetPrerequisites && (
            <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-500/40 flex items-start gap-2.5 text-amber-200">
              <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Prerequisite Alert: </span>
                {prereqCheck.warningMessage}
              </div>
            </div>
          )}

          {/* Core Topic Controls: Status, Personal Priority, Difficulty, Confidence */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Status */}
            <div className="space-y-1">
              <label className="font-semibold text-slate-400 block">Topic Status</label>
              <select
                value={mastery.status}
                onChange={(e) => handleStatusChange(e.target.value as TopicStatus)}
                className="w-full p-2 rounded-xl bg-[#080C17] border border-slate-700 text-white font-semibold"
              >
                <option value="Not Started">Not Started</option>
                <option value="In Progress">In Progress</option>
                <option value="Completed">Completed</option>
                <option value="Needs Revision">Needs Revision</option>
                <option value="On Hold">On Hold</option>
              </select>
            </div>

            {/* Personal Priority */}
            <div className="space-y-1">
              <label className="font-semibold text-slate-400 block">Personal Priority</label>
              <select
                value={mastery.personalPriority || 'medium'}
                onChange={(e) =>
                  handlePersonalPriorityChange(e.target.value as 'high' | 'medium' | 'low')
                }
                className="w-full p-2 rounded-xl bg-[#080C17] border border-slate-700 text-white font-semibold"
              >
                <option value="high">High Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="low">Low Priority</option>
              </select>
            </div>

            {/* Difficulty */}
            <div className="space-y-1">
              <label className="font-semibold text-slate-400 block">Difficulty</label>
              <select
                value={mastery.difficulty || topic.difficulty}
                onChange={(e) =>
                  handleDifficultyChange(e.target.value as 'Easy' | 'Moderate' | 'Hard')
                }
                className="w-full p-2 rounded-xl bg-[#080C17] border border-slate-700 text-white font-semibold"
              >
                <option value="Easy">Easy</option>
                <option value="Moderate">Moderate</option>
                <option value="Hard">Hard</option>
              </select>
            </div>

            {/* Confidence (1-5) */}
            <div className="space-y-1">
              <label className="font-semibold text-slate-400 block">
                Confidence ({mastery.confidence}/5)
              </label>
              <div className="flex items-center gap-1">
                {([1, 2, 3, 4, 5] as ConfidenceRating[]).map((rating) => (
                  <button
                    key={rating}
                    onClick={() => handleConfidenceChange(rating)}
                    className={`flex-1 py-2 rounded-lg font-bold transition cursor-pointer ${
                      mastery.confidence === rating
                        ? 'bg-blue-600 text-white'
                        : 'bg-[#080C17] border border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {rating}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Actual Time Spent & Next Revision Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-2xl bg-[#080C17] border border-slate-800">

            <div className="space-y-1.5">
              <label className="font-semibold text-slate-400 block">
                Log Actual Study Time (Mins)
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="5"
                  step="15"
                  placeholder="e.g. 45"
                  value={loggedMinutes || ''}
                  onChange={(e) => setLoggedMinutes(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-[#101626] border border-slate-700 text-white font-mono"
                />
                <button
                  onClick={handleLogStudyTime}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold cursor-pointer"
                >
                  +Log
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-slate-400 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-purple-400" />
                Next Revision Date
              </label>
              <input
                type="date"
                value={nextRevDate}
                onChange={(e) => handleSaveNextRevisionDate(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg bg-[#101626] border border-slate-700 text-white font-mono"
              />
            </div>
          </div>

          {/* Subtopics Hierarchy & Editor */}
          <div className="space-y-2">
            <label className="font-bold text-slate-300 flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-blue-400" />
              Subtopics ({topic.subtopics?.length || 0})
            </label>
            <div className="p-3 rounded-xl bg-[#080C17] border border-slate-800 space-y-2">
              {topic.subtopics && topic.subtopics.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {topic.subtopics.map((sub, idx) => (
                    <span
                      key={sub.id || idx}
                      className="px-2.5 py-1 rounded-lg bg-[#101626] border border-slate-700 text-slate-200"
                    >
                      {sub.title}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-slate-500">No subtopics added yet.</p>
              )}
              <div className="flex gap-2 pt-1">
                <input
                  type="text"
                  placeholder="Add a subtopic..."
                  value={newSubtopicTitle}
                  onChange={(e) => setNewSubtopicTitle(e.target.value)}
                  className="flex-1 px-2.5 py-1.5 rounded-lg bg-[#101626] border border-slate-700 text-white"
                />
                <button
                  onClick={handleAddSubtopic}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold cursor-pointer"
                >
                  + Add Subtopic
                </button>
              </div>
            </div>
          </div>

          {/* Mastery Stages */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-bold text-slate-300">Mastery Stages Checklist</label>
              <span className="text-slate-400 font-mono">
                {mastery.completedStages.length}/{ALL_MASTERY_STAGES.length} Done
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {ALL_MASTERY_STAGES.map((stage) => {
                const isChecked = mastery.completedStages.includes(stage.id);
                return (
                  <button
                    key={stage.id}
                    onClick={() => toggleMasteryStage(topic.id, stage.id)}
                    className={`flex items-center justify-between p-2.5 rounded-xl border text-left transition cursor-pointer ${
                      isChecked
                        ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                        : 'bg-[#080C17] border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <span className="font-medium truncate pr-2">{stage.label}</span>
                    <CheckCircle2
                      className={`w-4 h-4 flex-shrink-0 ${
                        isChecked ? 'text-emerald-400' : 'text-slate-600'
                      }`}
                    />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Relevant Uploaded PYQs */}
          <div className="space-y-2">
            <label className="font-bold text-slate-300 flex items-center gap-1.5">
              <FileSearch className="w-3.5 h-3.5 text-purple-400" />
              Relevant Uploaded & Verified PYQs ({relevantPYQs.length})
            </label>
            <div className="p-3 rounded-xl bg-[#080C17] border border-slate-800 space-y-2">
              {relevantPYQs.length === 0 ? (
                <p className="text-slate-500">
                  No matching PYQs found in uploaded papers for this topic yet.
                </p>
              ) : (
                relevantPYQs.map((q) => (
                  <div
                    key={q.id}
                    className="p-2.5 rounded-lg bg-[#101626] border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                  >
                    <div className="text-slate-200">{q.questionText}</div>
                    <div className="flex items-center gap-1.5 flex-shrink-0 font-mono text-[11px]">
                      <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300">
                        {q.examYear}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                        {q.marks}M
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Linked Backlog & Planner Tasks */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-bold text-slate-300 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-blue-400" />
                Linked Backlog & Study Tasks ({linkedTasks.length})
              </label>
              <button
                onClick={handleScheduleLinkedTaskToday}
                className="text-blue-400 hover:underline flex items-center gap-1 font-semibold cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Schedule Session Today
              </button>
            </div>
            <div className="p-3 rounded-xl bg-[#080C17] border border-slate-800 space-y-2">
              {linkedTasks.length === 0 ? (
                <p className="text-slate-500">No study sessions scheduled for this topic yet.</p>
              ) : (
                linkedTasks.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between p-2 rounded-lg bg-[#101626] border border-slate-800"
                  >
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleStudyTask(t.id)}
                        className={`w-4 h-4 rounded flex items-center justify-center border cursor-pointer ${
                          t.completed
                            ? 'bg-emerald-600 border-emerald-600 text-white'
                            : 'border-slate-600'
                        }`}
                      >
                        {t.completed && <CheckCircle2 className="w-3 h-3" />}
                      </button>
                      <span className={t.completed ? 'line-through text-slate-500' : 'text-slate-200'}>
                        {t.date} • {t.taskType.toUpperCase()} ({t.plannedMinutes} mins)
                      </span>
                    </div>
                    <span className="text-[11px] font-mono text-slate-400">
                      {t.completed ? 'Completed' : 'Pending'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Notes & Formulas */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-bold text-slate-300">Personal Notes & Key Formulas</label>
              <button
                onClick={() => updateTopicMastery(topic.id, { notes })}
                className="text-blue-400 hover:underline flex items-center gap-1 font-semibold cursor-pointer"
              >
                <Edit3 className="w-3 h-3" />
                Save Notes
              </button>
            </div>
            {relevantFormulas.length > 0 && (
              <div className="p-2.5 rounded-xl bg-blue-950/30 border border-blue-500/30 space-y-1">
                {relevantFormulas.map((f) => (
                  <div key={f.id} className="font-mono text-blue-200">
                    <span className="font-bold">{f.title}: </span>
                    {f.content}
                  </div>
                ))}
              </div>
            )}
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Write formulas, derivations, key points, or textbook page numbers..."
              className="w-full p-3 rounded-xl bg-[#080C17] border border-slate-800 text-white"
            />
          </div>

          {/* Mistakes & Revision History */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3 rounded-xl bg-[#080C17] border border-slate-800 space-y-2">
              <span className="font-bold text-slate-300 block">
                Recorded Mistakes ({topicMistakes.length})
              </span>
              {topicMistakes.map((m) => (
                <div key={m.id} className="p-2 rounded bg-[#101626] text-rose-300">
                  • {m.content}
                </div>
              ))}
              <div className="flex gap-1.5 pt-1">
                <input
                  type="text"
                  placeholder="Log a mistake or weak point..."
                  value={newMistakeSummary}
                  onChange={(e) => setNewMistakeSummary(e.target.value)}
                  className="flex-1 px-2 py-1 rounded bg-[#101626] border border-slate-700 text-white"
                />
                <button
                  onClick={handleAddQuickMistake}
                  className="px-2.5 py-1 rounded bg-rose-600 text-white font-semibold cursor-pointer"
                >
                  Log
                </button>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-[#080C17] border border-slate-800 space-y-2">
              <span className="font-bold text-slate-300 block">
                Revision History ({topicRevisions.length})
              </span>
              {topicRevisions.length === 0 ? (
                <p className="text-slate-500">No revision cycles recorded yet.</p>
              ) : (
                topicRevisions.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between p-2 rounded bg-[#101626] text-slate-300"
                  >
                    <span>Step {r.revisionStep} Revision</span>
                    <span className="font-mono text-[11px]">
                      {r.scheduledDate} ({r.completed ? 'Done' : 'Scheduled'})
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-[#080C17]/80 flex items-center justify-between">
          <button
            onClick={() => onOpenAITutorForTopic(topic.title, chapterTitle, subjectName)}
            className="px-3.5 py-2 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Ask AI Assistant About Topic
          </button>

          <button
            onClick={() => {
              updateTopicMastery(topic.id, { notes });
              onClose();
            }}
            className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition cursor-pointer"
          >
            Save & Close
          </button>
        </div>
      </div>
    </div>
  );
};
