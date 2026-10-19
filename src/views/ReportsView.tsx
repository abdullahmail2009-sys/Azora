import React from 'react';
import { useApp } from '../context/AppContext.tsx';
import { calculateBacklogAndPace } from '../utils/backlogCalc.ts';
import {
  BarChart3,
  TrendingUp,
  AlertTriangle,
  Clock,
  Award,
  Layers,
  ShieldCheck,
  CheckCircle2,
  Info,
} from 'lucide-react';
import { VisualProgressDashboard } from '../components/VisualProgressDashboard.tsx';

export const ReportsView: React.FC = () => {
  const { progressSummary, activeSyllabus, masteryMap, preferences } = useApp();

  const todayStr = new Date().toISOString().split('T')[0];

  const backlogMetrics = calculateBacklogAndPace(
    progressSummary.totalTopics,
    progressSummary.completedTopics,
    preferences.examTargetDate,
    preferences.dailyStudyHoursLimit,
    2.5,
    todayStr
  );

  // High-Yield Priority Matrix Calculation
  interface PriorityChapterItem {
    subjectName: string;
    chapterNumber: number;
    chapterTitle: string;
    marks: number;
    averageConfidence: number;
    completedTopics: number;
    totalTopics: number;
    priorityScore: number;
    rationale: string;
  }

  const priorityChapters: PriorityChapterItem[] = [];

  activeSyllabus.subjects.forEach((sub) => {
    sub.units.forEach((u) => {
      u.chapters.forEach((c) => {
        if (c.isArchived || c.isExcluded) return;

        const activeTopics = c.topics.filter((t) => !t.isArchived && !t.isExcluded);
        if (activeTopics.length === 0) return;

        let totalConf = 0;
        let compCount = 0;

        activeTopics.forEach((t) => {
          const m = masteryMap[t.id];
          if (m) {
            totalConf += m.confidence;
            if (m.status === 'Completed' || (m.completedStages.includes('theory') && m.completedStages.includes('notes'))) {
              compCount++;
            }
          } else {
            totalConf += 3;
          }
        });

        const avgConf = Number((totalConf / activeTopics.length).toFixed(1));
        const marks = c.officialWeightageMarks || 4;

        // Priority Score heuristic: High marks weightage + low confidence + incomplete topics
        const priorityScore = marks * 2.5 + (5 - avgConf) * 3 + (activeTopics.length - compCount) * 1.5;

        let rationale = '';
        if (marks >= 6 && avgConf <= 3) {
          rationale = 'Urgent High Yield: Substantial board marks weightage (>= 6 M) with low confidence rating.';
        } else if (compCount === 0) {
          rationale = 'High Priority: Key foundation chapter not yet initiated in active syllabus.';
        } else if (avgConf <= 2.5) {
          rationale = 'Needs Attention: Multiple student-reported conceptual gaps in exercises.';
        } else {
          rationale = 'Maintenance: On track with good confidence; periodic spaced revision recommended.';
        }

        priorityChapters.push({
          subjectName: sub.name,
          chapterNumber: c.number,
          chapterTitle: c.title,
          marks,
          averageConfidence: avgConf,
          completedTopics: compCount,
          totalTopics: activeTopics.length,
          priorityScore: Number(priorityScore.toFixed(1)),
          rationale,
        });
      });
    });
  });

  // Sort descending by priority score
  priorityChapters.sort((a, b) => b.priorityScore - a.priorityScore);

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-blue-600" />
            Academic Analytics & Backlog Calculator
          </h1>
          <p className="text-xs text-slate-500 mt-1 max-w-xl">
            Real-time syllabus completion statistics, high-yield chapter prioritization matrix, and dynamic workload deficit calculator before the March 2028 RBSE Board Examination.
          </p>
        </div>
      </div>

      {/* Progress Breakdown Quadrant */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-xs font-semibold text-slate-500">Syllabus Coverage</span>
          <div className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-1">
            {progressSummary.overallCoveragePercentage}%
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            (completed weighted units ÷ total active weighted units) × 100
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-xs font-semibold text-slate-500">Mastery Stage Depth</span>
          <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-1">
            {progressSummary.masteryPercentage}%
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Average across 9 mastery stages per topic
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-xs font-semibold text-slate-500">Spaced Revision Rate</span>
          <div className="text-2xl font-black text-purple-600 dark:text-purple-400 mt-1">
            {progressSummary.revisionPercentage}%
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Completed adaptive review steps
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-xs font-semibold text-slate-500">Practice Question Accuracy</span>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
            {progressSummary.questionAccuracyPercentage}%
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Verified RBSE PYQ & test questions
          </div>
        </div>
      </div>

      {/* Recharts Visual Progress Dashboard (Subject & Unit Completion Percentages) */}
      <VisualProgressDashboard />

      {/* Dynamic Backlog & Pace Calculator Card */}
      <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-600" />
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Dynamic Backlog & Completion Pace Calculator
              </h2>
              <p className="text-xs text-slate-500">
                Paced against target date: {preferences.examTargetDate}
              </p>
            </div>
          </div>

          <span
            className={`text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1.5 ${
              backlogMetrics.isFeasible
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
            }`}
          >
            {backlogMetrics.isFeasible ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" /> Pace is Feasible
              </>
            ) : (
              <>
                <AlertTriangle className="w-3.5 h-3.5" /> Workload Deficit Alert
              </>
            )}
          </span>
        </div>

        {/* Backlog stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40">
            <span className="text-slate-500">Remaining Topics:</span>
            <div className="text-lg font-black text-slate-900 dark:text-white mt-0.5">
              {backlogMetrics.remainingTopics}
            </div>
          </div>
          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40">
            <span className="text-slate-500">Available Days:</span>
            <div className="text-lg font-black text-slate-900 dark:text-white mt-0.5">
              {backlogMetrics.availableDays} Days
            </div>
          </div>
          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40">
            <span className="text-slate-500">Required Daily Pace:</span>
            <div className="text-lg font-black text-blue-600 dark:text-blue-400 mt-0.5">
              ~{backlogMetrics.requiredTopicsPerDay} Topics/Day
            </div>
          </div>
          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40">
            <span className="text-slate-500">Projected Finish Date:</span>
            <div className="text-lg font-black text-slate-900 dark:text-white mt-0.5">
              {backlogMetrics.projectedFinishDate}
            </div>
          </div>
        </div>

        {/* Warning / Feasibility Guidance */}
        {backlogMetrics.feasibilityWarning && (
          <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-900 dark:text-rose-200 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Workload Deficit Detected: </span>
              {backlogMetrics.feasibilityWarning}
            </div>
          </div>
        )}

        <div className="p-3.5 rounded-2xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/60 text-xs space-y-1 text-blue-950 dark:text-blue-200">
          <span className="font-bold">Algorithmic Study Recommendations:</span>
          {backlogMetrics.advice.map((adv, idx) => (
            <div key={idx} className="text-slate-700 dark:text-slate-300">
              • {adv}
            </div>
          ))}
        </div>
      </div>

      {/* ROI & High-Yield Prioritization Matrix */}
      <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-500" />
            ROI & High-Yield Chapter Prioritization Matrix
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Prioritizes chapters with high verified historical marks weightage and low student confidence. Does not promise that historical weightage guarantees future questions.
          </p>
        </div>

        <div className="space-y-3">
          {priorityChapters.slice(0, 8).map((ch, idx) => (
            <div
              key={idx}
              className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs space-y-2"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold flex items-center justify-center">
                    {idx + 1}
                  </span>
                  <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
                    [{ch.subjectName}]
                  </span>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    {ch.chapterTitle}
                  </h3>
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <span className="font-bold text-amber-600 dark:text-amber-400">
                    {ch.marks} Marks
                  </span>
                  <span>•</span>
                  <span
                    className={`font-semibold ${
                      ch.averageConfidence <= 2.5
                        ? 'text-rose-600'
                        : ch.averageConfidence === 3
                        ? 'text-amber-500'
                        : 'text-emerald-600'
                    }`}
                  >
                    Confidence: {ch.averageConfidence}/5
                  </span>
                  <span>•</span>
                  <span className="text-slate-500">
                    {ch.completedTopics}/{ch.totalTopics} Topics
                  </span>
                </div>
              </div>

              <div className="text-xs text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-xl">
                <span className="font-semibold text-slate-700 dark:text-slate-300">Recommendation: </span>
                {ch.rationale}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
