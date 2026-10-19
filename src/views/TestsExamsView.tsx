import React, { useState } from 'react';
import { useApp } from '../context/AppContext.tsx';
import { MockTestRecord, MilestoneItem } from '../types/index.ts';
import {
  FileText,
  Award,
  Calendar,
  AlertTriangle,
  Plus,
  Clock,
  TrendingUp,
  CheckCircle2,
  X,
  Target,
  Edit2,
  Trash2,
  Archive,
  RotateCcw,
  ShieldCheck,
  Tag,
  HelpCircle,
} from 'lucide-react';

export const TestsExamsView: React.FC = () => {
  const {
    mockTests,
    milestones,
    activeSyllabus,
    addMockTest,
    addMilestone,
    updateMilestone,
    deleteMilestone,
    toggleMilestone,
    archiveMilestone,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'tests' | 'milestones'>('tests');
  const [showAddTestModal, setShowAddTestModal] = useState(false);
  const [showAddMilestoneModal, setShowAddMilestoneModal] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState<MilestoneItem | null>(null);
  const [showArchivedMilestones, setShowArchivedMilestones] = useState(false);
  const [confirmDeleteMilestoneId, setConfirmDeleteMilestoneId] = useState<string | null>(null);

  // New Mock Test State
  const [testName, setTestName] = useState('');
  const [testDate, setTestDate] = useState(new Date().toISOString().split('T')[0]);
  const [testSubjectId, setTestSubjectId] = useState(activeSyllabus.subjects[0]?.id || 'physics');
  const [maxMarks, setMaxMarks] = useState(56);
  const [marksObtained, setMarksObtained] = useState(45);
  const [timeTaken, setTimeTaken] = useState(180);
  const [mistakeDescription, setMistakeDescription] = useState('');
  const [selectedChapterForError, setSelectedChapterForError] = useState('');
  const [testNotes, setTestNotes] = useState('');

  // Milestone Form State (Add / Edit)
  const [milestoneTitle, setMilestoneTitle] = useState('');
  const [milestoneDate, setMilestoneDate] = useState('');
  const [milestoneTargetMonth, setMilestoneTargetMonth] = useState('');
  const [milestoneAcademicYear, setMilestoneAcademicYear] = useState('2026–27');
  const [milestoneDateStatus, setMilestoneDateStatus] = useState<'target' | 'tentative' | 'verified'>('target');
  const [milestoneSubjects, setMilestoneSubjects] = useState('Physics, Chemistry, Mathematics');
  const [milestoneIsBoardExam, setMilestoneIsBoardExam] = useState(false);
  const [milestoneNotes, setMilestoneNotes] = useState('');
  const [targetPercentage, setTargetPercentage] = useState(90);

  const selectedSubject = activeSyllabus.subjects.find((s) => s.id === testSubjectId);
  const subjectChapters = selectedSubject?.units.flatMap((u) => u.chapters) || [];

  const handleCreateMockTest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!testName.trim()) return;

    const chosenChapter = subjectChapters.find((c) => c.id === selectedChapterForError);

    addMockTest({
      testName,
      date: testDate,
      subjectId: testSubjectId,
      subjectName: selectedSubject?.name || 'Subject',
      maxMarks,
      marksObtained,
      timeTakenMinutes: timeTaken,
      chapterPerformance: chosenChapter
        ? [
            {
              chapterId: chosenChapter.id,
              chapterTitle: chosenChapter.title,
              marksScored: marksObtained,
              maxMarks: maxMarks,
              errorsCount: mistakeDescription ? 1 : 0,
              flaggedWeakness: marksObtained < maxMarks * 0.6,
            },
          ]
        : [],
      mistakes: mistakeDescription
        ? [
            {
              id: `mistake-${Date.now()}`,
              chapterId: selectedChapterForError || 'gen',
              topicId: chosenChapter?.topics[0]?.id,
              questionReference: 'Exam review',
              description: mistakeDescription,
              confidenceImpact: -1,
            },
          ]
        : [],
      notes: testNotes,
    });

    setShowAddTestModal(false);
    setTestName('');
    setMistakeDescription('');
    setTestNotes('');
  };

  const handleOpenAddMilestone = () => {
    setEditingMilestone(null);
    setMilestoneTitle('');
    setMilestoneDate('');
    setMilestoneTargetMonth('');
    setMilestoneAcademicYear('2026–27');
    setMilestoneDateStatus('target');
    setMilestoneSubjects('Physics, Chemistry, Mathematics, English, Hindi');
    setMilestoneIsBoardExam(false);
    setMilestoneNotes('');
    setTargetPercentage(90);
    setShowAddMilestoneModal(true);
  };

  const handleOpenEditMilestone = (m: MilestoneItem) => {
    setEditingMilestone(m);
    setMilestoneTitle(m.title);
    setMilestoneDate(m.date || '');
    setMilestoneTargetMonth(m.targetMonth || '');
    setMilestoneAcademicYear(m.academicYear || '2026–27');
    setMilestoneDateStatus(m.dateStatus || 'target');
    setMilestoneSubjects(m.subjects.join(', '));
    setMilestoneIsBoardExam(Boolean(m.isBoardExam));
    setMilestoneNotes(m.notes || '');
    setTargetPercentage(m.targetPercentage || 90);
    setShowAddMilestoneModal(true);
  };

  const handleSaveMilestone = (e: React.FormEvent) => {
    e.preventDefault();
    if (!milestoneTitle.trim()) return;

    const parsedSubjects = milestoneSubjects
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    if (editingMilestone) {
      updateMilestone(editingMilestone.id, {
        title: milestoneTitle.trim(),
        date: milestoneDate,
        targetMonth: milestoneTargetMonth.trim(),
        academicYear: milestoneAcademicYear.trim(),
        dateStatus: milestoneDateStatus,
        subjects: parsedSubjects.length > 0 ? parsedSubjects : ['General'],
        isBoardExam: milestoneIsBoardExam,
        notes: milestoneNotes.trim(),
        targetPercentage,
      });
    } else {
      addMilestone({
        title: milestoneTitle.trim(),
        date: milestoneDate,
        targetMonth: milestoneTargetMonth.trim(),
        academicYear: milestoneAcademicYear.trim(),
        dateStatus: milestoneDateStatus,
        subjects: parsedSubjects.length > 0 ? parsedSubjects : ['General'],
        isBoardExam: milestoneIsBoardExam,
        notes: milestoneNotes.trim(),
        targetPercentage,
        isCompleted: false,
      });
    }

    setShowAddMilestoneModal(false);
    setEditingMilestone(null);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Award className="w-6 h-6 text-blue-600" />
            Mock Tests, Error Linker & Exam Countdown Center
          </h1>
          <p className="text-xs text-slate-500 mt-1 max-w-xl">
            Track test scores with error linking, configure personal target exam dates, manage countdowns, and distinguish verified official dates from tentative planning targets.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={handleOpenAddMilestone}
            className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            Add Exam Target
          </button>
          <button
            onClick={() => setShowAddTestModal(true)}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-blue-500/20 transition active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Record Mock Test
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        <button
          onClick={() => setActiveTab('tests')}
          className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-bold transition ${
            activeTab === 'tests'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800'
          }`}
        >
          <FileText className="w-4 h-4" />
          Mock Test History ({mockTests.length})
        </button>

        <button
          onClick={() => setActiveTab('milestones')}
          className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-bold transition ${
            activeTab === 'milestones'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800'
          }`}
        >
          <Target className="w-4 h-4" />
          Exam Milestones & Countdowns ({milestones.length})
        </button>
      </div>

      {/* Mock Tests Tab */}
      {activeTab === 'tests' && (
        <div className="space-y-4">
          {mockTests.length === 0 ? (
            <div className="py-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 text-xs text-slate-500">
              No mock tests recorded yet. Click 'Record Mock Test' to log scores and link chapter errors.
            </div>
          ) : (
            mockTests.map((t) => {
              const percentage = Math.round((t.marksObtained / t.maxMarks) * 100);

              return (
                <div
                  key={t.id}
                  className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200">
                          {t.subjectName}
                        </span>
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                          {t.testName}
                        </h3>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-3">
                        <span>Date: {t.date}</span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" /> {t.timeTakenMinutes} mins
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="text-lg font-black text-slate-900 dark:text-white">
                          {t.marksObtained} <span className="text-xs text-slate-400">/ {t.maxMarks}</span>
                        </div>
                        <div
                          className={`text-xs font-bold ${
                            percentage >= 80
                              ? 'text-emerald-600'
                              : percentage >= 60
                              ? 'text-amber-500'
                              : 'text-rose-600'
                          }`}
                        >
                          {percentage}%
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Chapter performance & error linking */}
                  {t.mistakes && t.mistakes.length > 0 && (
                    <div className="p-3 rounded-2xl bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 space-y-1.5 text-xs text-rose-900 dark:text-rose-200">
                      <div className="flex items-center gap-1.5 font-bold text-rose-700 dark:text-rose-300">
                        <AlertTriangle className="w-4 h-4" />
                        <span>Error Linker Activated: Confidence auto-adjusted for weak topics</span>
                      </div>
                      {t.mistakes.map((m) => (
                        <div key={m.id} className="text-[11px] text-rose-800 dark:text-rose-300">
                          • {m.questionReference}: {m.description}
                        </div>
                      ))}
                    </div>
                  )}

                  {t.notes && (
                    <div className="text-xs text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/40 p-3 rounded-2xl">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">Review Notes: </span>
                      {t.notes}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Exam Countdown Center Tab */}
      {activeTab === 'milestones' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Target className="w-4 h-4 text-blue-600" />
                Exam Countdown Center & Target Timeline
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Personal planning targets and officially verified board dates. Click Edit on any exam to customize date, target month, or subjects.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowArchivedMilestones(!showArchivedMilestones)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer flex items-center gap-1.5 ${
                  showArchivedMilestones
                    ? 'bg-slate-200 dark:bg-slate-700 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white'
                    : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                }`}
              >
                <Archive className="w-3.5 h-3.5" />
                {showArchivedMilestones ? 'Showing Archived' : 'Show Archived'}
              </button>
              <button
                onClick={handleOpenAddMilestone}
                className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Exam / Milestone
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {milestones
              .filter((m) => (showArchivedMilestones ? Boolean(m.isArchived) : !m.isArchived))
              .map((m) => {
                let daysLeft: number | null = null;
                let isPast = false;

                if (m.date) {
                  const parts = m.date.split('-').map(Number);
                  if (parts.length === 3) {
                    const [y, mo, d] = parts;
                    const targetDateObj = new Date(y, mo - 1, d);
                    const todayObj = new Date();
                    todayObj.setHours(0, 0, 0, 0);
                    const diffMs = targetDateObj.getTime() - todayObj.getTime();
                    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
                    if (diffDays < 0) {
                      isPast = true;
                    } else {
                      daysLeft = diffDays;
                    }
                  }
                }

                return (
                  <div
                    key={m.id}
                    className={`p-5 rounded-3xl border transition space-y-3.5 ${
                      m.isCompleted
                        ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/60'
                        : m.isBoardExam
                        ? 'bg-gradient-to-br from-blue-50/80 to-indigo-50/80 dark:from-blue-950/40 dark:to-indigo-950/40 border-blue-200 dark:border-blue-900/60 shadow-xs'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xs'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                          {m.isBoardExam && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-600 text-white">
                              Board Exam
                            </span>
                          )}
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              m.dateStatus === 'verified'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200'
                                : m.dateStatus === 'tentative'
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200'
                                : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                            }`}
                          >
                            {m.dateStatus === 'verified'
                              ? 'Official Date (Verified)'
                              : m.dateStatus === 'tentative'
                              ? 'Tentative'
                              : 'Personal Target'}
                          </span>
                          {m.academicYear && (
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">
                              {m.academicYear}
                            </span>
                          )}
                        </div>

                        <h3 className="text-base font-bold text-slate-900 dark:text-white">
                          {m.title}
                        </h3>

                        <div className="text-xs text-slate-500 mt-1">
                          {m.date ? (
                            <span>Target Date: <strong className="text-slate-700 dark:text-slate-300">{m.date}</strong></span>
                          ) : m.targetMonth ? (
                            <span>Target Period: <strong className="text-slate-700 dark:text-slate-300">{m.targetMonth}</strong> (Exact day unset)</span>
                          ) : (
                            <span className="text-amber-600 dark:text-amber-400 font-semibold">Exam date not set</span>
                          )}
                        </div>
                      </div>

                      <div className="text-right flex-shrink-0">
                        <div
                          className={`text-xl font-black ${
                            m.isCompleted
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : isPast
                              ? 'text-slate-400'
                              : daysLeft !== null
                              ? 'text-blue-600 dark:text-blue-400'
                              : 'text-amber-600 dark:text-amber-400'
                          }`}
                        >
                          {m.isCompleted
                            ? 'Completed'
                            : isPast
                            ? 'Concluded'
                            : daysLeft !== null
                            ? `${daysLeft} Days`
                            : 'Date Unset'}
                        </div>
                        {m.targetPercentage && (
                          <div className="text-[10px] text-slate-500 font-semibold">
                            Goal: {m.targetPercentage}%
                          </div>
                        )}
                      </div>
                    </div>

                    {m.notes && (
                      <div className="text-xs text-slate-600 dark:text-slate-400 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800/80">
                        {m.notes}
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-2.5 border-t border-slate-100 dark:border-slate-800 gap-2 flex-wrap">
                      <span className="text-[11px] text-slate-500 truncate max-w-[200px]">
                        {m.subjects.join(', ')}
                      </span>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleOpenEditMilestone(m)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800 transition cursor-pointer"
                          title="Edit Milestone"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => archiveMilestone(m.id)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-slate-800 transition cursor-pointer"
                          title={m.isArchived ? 'Restore Milestone' : 'Archive Milestone'}
                        >
                          <Archive className="w-3.5 h-3.5" />
                        </button>

                        {confirmDeleteMilestoneId === m.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => {
                                deleteMilestone(m.id);
                                setConfirmDeleteMilestoneId(null);
                              }}
                              className="px-2 py-1 rounded-lg bg-rose-600 text-white text-[10px] font-bold cursor-pointer"
                            >
                              Delete
                            </button>
                            <button
                              onClick={() => setConfirmDeleteMilestoneId(null)}
                              className="px-2 py-1 rounded-lg bg-slate-100 text-slate-700 text-[10px] font-semibold cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmDeleteMilestoneId(m.id)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-slate-800 transition cursor-pointer"
                            title="Delete Milestone"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}

                        <button
                          onClick={() => toggleMilestone(m.id)}
                          className={`px-3 py-1 rounded-xl text-xs font-semibold transition cursor-pointer ${
                            m.isCompleted
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                          }`}
                        >
                          {m.isCompleted ? (
                            <span className="flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Done
                            </span>
                          ) : (
                            'Mark Done'
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Record Mock Test Modal */}
      {showAddTestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <form
            onSubmit={handleCreateMockTest}
            className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Record Mock or School Examination Test
            </h3>

            <div className="text-xs">
              <label className="font-semibold text-slate-700 dark:text-slate-300">Test Title</label>
              <input
                type="text"
                required
                value={testName}
                onChange={(e) => setTestName(e.target.value)}
                placeholder="e.g. Electrostatics & Current Electricity Half-Term Test"
                className="mt-1 w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300">Subject</label>
                <select
                  value={testSubjectId}
                  onChange={(e) => setTestSubjectId(e.target.value)}
                  className="mt-1 w-full p-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                >
                  {activeSyllabus.subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300">Date</label>
                <input
                  type="date"
                  value={testDate}
                  onChange={(e) => setTestDate(e.target.value)}
                  className="mt-1 w-full p-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300">Max Marks</label>
                <input
                  type="number"
                  min="5"
                  value={maxMarks}
                  onChange={(e) => setMaxMarks(Number(e.target.value))}
                  className="mt-1 w-full p-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300">Marks Scored</label>
                <input
                  type="number"
                  min="0"
                  max={maxMarks}
                  value={marksObtained}
                  onChange={(e) => setMarksObtained(Number(e.target.value))}
                  className="mt-1 w-full p-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300">Duration (min)</label>
                <input
                  type="number"
                  min="15"
                  value={timeTaken}
                  onChange={(e) => setTimeTaken(Number(e.target.value))}
                  className="mt-1 w-full p-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>
            </div>

            {/* Error Linker Field */}
            <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 space-y-2 text-xs">
              <span className="font-bold text-amber-900 dark:text-amber-200">
                Link Chapter Weakness (Error Linker)
              </span>
              <div>
                <label className="text-[11px] text-slate-600 dark:text-slate-400">Chapter with error:</label>
                <select
                  value={selectedChapterForError}
                  onChange={(e) => setSelectedChapterForError(e.target.value)}
                  className="mt-1 w-full p-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                >
                  <option value="">Select Chapter (Optional)</option>
                  {subjectChapters.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] text-slate-600 dark:text-slate-400">Mistake description:</label>
                <input
                  type="text"
                  value={mistakeDescription}
                  onChange={(e) => setMistakeDescription(e.target.value)}
                  placeholder="e.g. Lost 3 marks in Wheatstone bridge balanced condition numerical"
                  className="mt-1 w-full p-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="text-xs">
              <label className="font-semibold text-slate-700 dark:text-slate-300">General Notes</label>
              <textarea
                rows={2}
                value={testNotes}
                onChange={(e) => setTestNotes(e.target.value)}
                placeholder="Overall review, time management, areas to improve..."
                className="mt-1 w-full p-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddTestModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
              >
                Save Test & Apply Linker
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Add / Edit Milestone Modal */}
      {showAddMilestoneModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <form
            onSubmit={handleSaveMilestone}
            className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Target className="w-5 h-5 text-blue-600" />
                {editingMilestone ? 'Edit Examination Milestone' : 'Add Examination Milestone / Target'}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowAddMilestoneModal(false);
                  setEditingMilestone(null);
                }}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs">
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                Exam / Milestone Name *
              </label>
              <input
                type="text"
                required
                value={milestoneTitle}
                onChange={(e) => setMilestoneTitle(e.target.value)}
                placeholder="e.g. Half-Yearly Examination, JEE Main Session 1"
                className="mt-1 w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  Exact Date (Optional if unset)
                </label>
                <input
                  type="date"
                  value={milestoneDate}
                  onChange={(e) => setMilestoneDate(e.target.value)}
                  className="mt-1 w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Leave blank if only target period is known
                </span>
              </div>

              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  Target Period / Month
                </label>
                <input
                  type="text"
                  value={milestoneTargetMonth}
                  onChange={(e) => setMilestoneTargetMonth(e.target.value)}
                  placeholder="e.g. Last week of July 2028"
                  className="mt-1 w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Displayed when exact calendar day is unset
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  Academic Year
                </label>
                <input
                  type="text"
                  value={milestoneAcademicYear}
                  onChange={(e) => setMilestoneAcademicYear(e.target.value)}
                  placeholder="e.g. 2027–28 or 2028"
                  className="mt-1 w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  Date Verification Status
                </label>
                <select
                  value={milestoneDateStatus}
                  onChange={(e) => setMilestoneDateStatus(e.target.value as any)}
                  className="mt-1 w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                >
                  <option value="target">My target (Personal planning)</option>
                  <option value="tentative">Tentative (Awaiting official circular)</option>
                  <option value="verified">Officially verified (Confirmed by Board/NTA)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  Target Score Goal (%)
                </label>
                <input
                  type="number"
                  min="40"
                  max="100"
                  value={targetPercentage}
                  onChange={(e) => setTargetPercentage(Number(e.target.value))}
                  className="mt-1 w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex items-center gap-2 pt-6">
                <input
                  type="checkbox"
                  id="isBoardExamCheck"
                  checked={milestoneIsBoardExam}
                  onChange={(e) => setMilestoneIsBoardExam(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="isBoardExamCheck" className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  Official Board Examination
                </label>
              </div>
            </div>

            <div className="text-xs">
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                Linked Subjects (comma-separated)
              </label>
              <input
                type="text"
                value={milestoneSubjects}
                onChange={(e) => setMilestoneSubjects(e.target.value)}
                placeholder="Physics, Chemistry, Mathematics, English, Hindi"
                className="mt-1 w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>

            <div className="text-xs">
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                Notes & Strategy Guidelines
              </label>
              <textarea
                rows={2}
                value={milestoneNotes}
                onChange={(e) => setMilestoneNotes(e.target.value)}
                placeholder="Key focus areas, syllabus scope, revision milestones..."
                className="mt-1 w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setShowAddMilestoneModal(false);
                  setEditingMilestone(null);
                }}
                className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition cursor-pointer shadow-xs"
              >
                {editingMilestone ? 'Update Milestone' : 'Save Milestone'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
