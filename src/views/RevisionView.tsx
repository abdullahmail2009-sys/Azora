import React, { useState } from 'react';
import { useApp } from '../context/AppContext.tsx';
import { SpacedRevisionTask, ConfidenceRating } from '../types/index.ts';
import {
  categorizeRevisions,
  calculateNextRevisionDate,
} from '../utils/spacedRepetition.ts';
import {
  RotateCcw,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Clock,
  Sparkles,
  HelpCircle,
  X,
  History,
} from 'lucide-react';

export const RevisionView: React.FC = () => {
  const {
    revisionTasks,
    completeRevisionTask,
    addRevisionTask,
    preferences,
    updatePreferences,
  } = useApp();

  const todayStr = new Date().toISOString().split('T')[0];
  const { dueToday, overdue, upcoming, completedHistory } = categorizeRevisions(
    revisionTasks,
    todayStr
  );

  const [activeTab, setActiveTab] = useState<'due' | 'upcoming' | 'history'>('due');
  const [selectedTaskToComplete, setSelectedTaskToComplete] = useState<SpacedRevisionTask | null>(null);
  const [evalConfidence, setEvalConfidence] = useState<ConfidenceRating>(4);
  const [evalRecall, setEvalRecall] = useState<'High' | 'Medium' | 'Low'>('High');

  const handleFinishRevision = () => {
    if (!selectedTaskToComplete) return;

    // 1. Mark current step completed with confidence & recall
    completeRevisionTask(selectedTaskToComplete.id, evalConfidence, evalRecall);

    // 2. If step < 4, adaptively schedule next step based on confidence heuristic
    if (selectedTaskToComplete.revisionStep < 4) {
      const nextStep = (selectedTaskToComplete.revisionStep + 1) as 1 | 2 | 3 | 4;
      const nextDate = calculateNextRevisionDate(
        todayStr,
        nextStep,
        preferences.revisionScheduleType,
        evalConfidence,
        evalRecall
      );

      addRevisionTask({
        id: `rev-${selectedTaskToComplete.topicId}-step-${nextStep}-${Date.now()}`,
        topicId: selectedTaskToComplete.topicId,
        chapterId: selectedTaskToComplete.chapterId,
        subjectId: selectedTaskToComplete.subjectId,
        topicTitle: selectedTaskToComplete.topicTitle,
        subjectName: selectedTaskToComplete.subjectName,
        revisionStep: nextStep,
        scheduledDate: nextDate,
        completed: false,
      });
    }

    setSelectedTaskToComplete(null);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header & Schedule Heuristic Picker */}
      <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <RotateCcw className="w-6 h-6 text-blue-600" />
            Spaced Repetition & Revision Engine
          </h1>
          <p className="text-xs text-slate-500 mt-1 max-w-xl">
            Adaptive heuristic schedule: intervals dynamically tighten when confidence is low or mistakes recur, ensuring high recall before RBSE board exams.
          </p>
        </div>

        {/* Schedule Mode Selector */}
        <div className="flex items-center gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl flex-shrink-0 text-xs">
          <button
            onClick={() => updatePreferences({ revisionScheduleType: 'default' })}
            className={`px-3 py-1.5 rounded-xl font-bold transition ${
              preferences.revisionScheduleType === 'default'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            Default (1-7-15-30)
          </button>
          <button
            onClick={() => updatePreferences({ revisionScheduleType: 'advanced' })}
            className={`px-3 py-1.5 rounded-xl font-bold transition ${
              preferences.revisionScheduleType === 'advanced'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            Advanced (3-7-21-45)
          </button>
        </div>
      </div>

      {/* Quick Summary Pill Bar */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        <button
          onClick={() => setActiveTab('due')}
          className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-bold transition ${
            activeTab === 'due'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
          }`}
        >
          <span>Due & Overdue</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] ${
              overdue.length > 0 ? 'bg-rose-500 text-white' : 'bg-blue-700 text-white'
            }`}
          >
            {dueToday.length + overdue.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('upcoming')}
          className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-bold transition ${
            activeTab === 'upcoming'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
          }`}
        >
          <span>Upcoming Calendar</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
            {upcoming.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-bold transition ${
            activeTab === 'history'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
          }`}
        >
          <span>Completed History</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
            {completedHistory.length}
          </span>
        </button>
      </div>

      {/* Due & Overdue Tab Content */}
      {activeTab === 'due' && (
        <div className="space-y-4">
          {/* Overdue alert if any */}
          {overdue.length > 0 && (
            <div className="p-4 rounded-3xl bg-rose-50/80 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/80 text-xs text-rose-900 dark:text-rose-200 space-y-2">
              <div className="flex items-center gap-2 font-bold text-rose-700 dark:text-rose-300">
                <AlertCircle className="w-4 h-4" />
                <span>{overdue.length} Overdue Revision{overdue.length > 1 ? 's' : ''} Require Immediate Attention</span>
              </div>
              <p className="text-[11px] text-rose-800/80 dark:text-rose-300/80">
                Delaying revisions causes rapid memory decay. Complete these short reviews to restore retention.
              </p>
            </div>
          )}

          {dueToday.length === 0 && overdue.length === 0 ? (
            <div className="py-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                All Revisions Caught Up!
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                No topics due for revision today. Check upcoming calendar or complete new syllabus topics to trigger scheduled reviews.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {[...overdue, ...dueToday].map((task) => (
                <div
                  key={task.id}
                  className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900 dark:text-white">
                        {task.topicTitle}
                      </span>
                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                        {task.subjectName}
                      </span>
                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                        Step {task.revisionStep}/4
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Scheduled: {task.scheduledDate}</span>
                      {task.scheduledDate < todayStr && (
                        <span className="text-rose-600 font-bold">
                          • Overdue by {Math.ceil((new Date().getTime() - new Date(task.scheduledDate).getTime()) / (1000 * 60 * 60 * 24))} day(s)
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => setSelectedTaskToComplete(task)}
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition active:scale-95"
                  >
                    Perform Revision & Recall Test
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Upcoming Tab Content */}
      {activeTab === 'upcoming' && (
        <div className="space-y-3">
          {upcoming.length === 0 ? (
            <div className="py-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 text-xs text-slate-500">
              No upcoming revisions queued.
            </div>
          ) : (
            upcoming.map((task) => (
              <div
                key={task.id}
                className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between"
              >
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">
                    {task.topicTitle}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {task.subjectName} • Step {task.revisionStep}/4 • Due in {task.scheduledDate}
                  </div>
                </div>
                <span className="text-xs text-slate-400 font-medium">
                  {task.scheduledDate}
                </span>
              </div>
            ))
          )}
        </div>
      )}

      {/* Completed History Tab */}
      {activeTab === 'history' && (
        <div className="space-y-3">
          {completedHistory.length === 0 ? (
            <div className="py-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 text-xs text-slate-500">
              No completed revisions recorded yet.
            </div>
          ) : (
            completedHistory.map((task) => (
              <div
                key={task.id}
                className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between"
              >
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <span>{task.topicTitle}</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                      Step {task.revisionStep}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Completed: {task.completedDate || 'Recently'} • Confidence: {task.confidenceScore || 4}/5 • Recall: {task.recallAccuracy || 'High'}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Revision Completion & Recall Heuristic Modal */}
      {selectedTaskToComplete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400">
                  Step {selectedTaskToComplete.revisionStep} Review Check
                </span>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {selectedTaskToComplete.topicTitle}
                </h3>
              </div>
              <button
                onClick={() => setSelectedTaskToComplete(null)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300">
              Review your handwritten notes or formula sheet for this topic, test yourself on active recall, then record your performance below:
            </p>

            {/* Active Recall Result */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Self-Assessed Recall Accuracy:
              </label>
              <div className="flex gap-2">
                {(['High', 'Medium', 'Low'] as const).map((recall) => (
                  <button
                    key={recall}
                    type="button"
                    onClick={() => setEvalRecall(recall)}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold border transition ${
                      evalRecall === recall
                        ? recall === 'High'
                          ? 'bg-emerald-50 border-emerald-500 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200'
                          : recall === 'Medium'
                          ? 'bg-amber-50 border-amber-500 text-amber-700 dark:bg-amber-950 dark:text-amber-200'
                          : 'bg-rose-50 border-rose-500 text-rose-700 dark:bg-rose-950 dark:text-rose-200'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {recall}
                  </button>
                ))}
              </div>
            </div>

            {/* Confidence Rating (1-5) */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Confidence Level (1 to 5):
              </label>
              <div className="flex gap-1.5">
                {([1, 2, 3, 4, 5] as ConfidenceRating[]).map((rating) => (
                  <button
                    key={rating}
                    type="button"
                    onClick={() => setEvalConfidence(rating)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition ${
                      evalConfidence === rating
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {rating}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-slate-500 flex items-center gap-1.5">
                {evalConfidence <= 2 || evalRecall === 'Low' ? (
                  <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" /> Adaptive heuristic will shorten the next revision interval.
                  </span>
                ) : (
                  <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> High recall will schedule normal spaced interval.
                  </span>
                )}
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setSelectedTaskToComplete(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleFinishRevision}
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs"
              >
                Log Revision Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
