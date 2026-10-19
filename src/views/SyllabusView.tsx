import React, { useState } from 'react';
import { useApp } from '../context/AppContext.tsx';
import { Topic, Chapter, Unit, Subject, MasteryStage, ConfidenceRating, TopicStatus } from '../types/index.ts';
import { calculateTopicMasteryPercentage, isTopicCompleted } from '../utils/progressCalc.ts';
import {
  Search,
  CheckCircle2,
  Clock,
  ExternalLink,
  ShieldCheck,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Archive,
  Plus,
  FileCheck,
  Upload,
  Trash2,
  Edit2,
  BookOpen,
  X,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';

interface SyllabusViewProps {
  onSelectTopic: (topicId: string) => void;
  onOpenSyllabusDiff: () => void;
  onOpenAITutor: () => void;
  onNavigateToImportPDF?: () => void;
}

type ModalType =
  | { kind: 'clear_default' }
  | { kind: 'confirm_delete'; label: string; onConfirm: () => void }
  | { kind: 'add_subject' }
  | { kind: 'edit_subject'; subject: Subject }
  | { kind: 'add_unit'; subjectId: string }
  | { kind: 'edit_unit'; subjectId: string; unit: Unit }
  | { kind: 'add_chapter'; subjectId: string; unitId: string }
  | { kind: 'edit_chapter'; subjectId: string; unitId: string; chapter: Chapter }
  | { kind: 'add_topic'; subjectId: string; unitId: string; chapterId: string }
  | { kind: 'edit_topic'; subjectId: string; unitId: string; chapterId: string; topic: Topic };

export const SyllabusView: React.FC<SyllabusViewProps> = ({
  onSelectTopic,
  onOpenSyllabusDiff,
  onOpenAITutor,
  onNavigateToImportPDF,
}) => {
  const {
    activeSyllabus,
    masteryMap,
    toggleMasteryStage,
    updateTopicMastery,
    bulkUpdateChapterTopics,
    clearDefaultSyllabus,
    addSubject,
    updateSubject,
    deleteSubject,
    addUnit,
    updateUnit,
    deleteUnit,
    addChapter,
    updateChapter,
    deleteChapter,
    addTopic,
    updateTopic,
    deleteTopic,
  } = useApp();

  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(
    activeSyllabus.subjects[0]?.id || ''
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [expandedUnits, setExpandedUnits] = useState<Record<string, boolean>>({
    'phy-u1': true,
    'che-u1': true,
    'math-u1': true,
  });
  const [showExcludedSection, setShowExcludedSection] = useState(false);

  // Active Modal state
  const [activeModal, setActiveModal] = useState<ModalType | null>(null);

  // Form Fields
  const [formData, setFormData] = useState({
    title: '',
    code: '',
    color: '#2563eb',
    number: 1,
    marks: 0,
    isWeightageEstimated: true,
    difficulty: 'Moderate' as 'Easy' | 'Moderate' | 'Hard',
    estimatedHours: 4,
    priority: 'high' as 'high' | 'medium' | 'low',
  });

  const selectedSubject =
    activeSyllabus.subjects.find((s) => s.id === selectedSubjectId) ||
    activeSyllabus.subjects[0];

  const toggleUnit = (unitId: string) => {
    setExpandedUnits((prev) => ({ ...prev, [unitId]: !prev[unitId] }));
  };

  const openModal = (modal: ModalType) => {
    if (modal.kind === 'edit_subject') {
      setFormData({
        title: modal.subject.name,
        code: modal.subject.code,
        color: modal.subject.color,
        number: 1,
        marks: 0,
        isWeightageEstimated: true,
        difficulty: 'Moderate',
        estimatedHours: 4,
        priority: modal.subject.priority,
      });
    } else if (modal.kind === 'edit_unit') {
      setFormData({
        title: modal.unit.title,
        code: '',
        color: '#2563eb',
        number: modal.unit.number,
        marks: modal.unit.officialMarks || 0,
        isWeightageEstimated: true,
        difficulty: 'Moderate',
        estimatedHours: 4,
        priority: 'high',
      });
    } else if (modal.kind === 'edit_chapter') {
      setFormData({
        title: modal.chapter.title,
        code: '',
        color: '#2563eb',
        number: modal.chapter.number,
        marks: modal.chapter.officialWeightageMarks || 0,
        isWeightageEstimated: modal.chapter.isWeightageEstimated ?? true,
        difficulty: 'Moderate',
        estimatedHours: 4,
        priority: 'high',
      });
    } else if (modal.kind === 'edit_topic') {
      setFormData({
        title: modal.topic.title,
        code: modal.topic.code || '',
        color: '#2563eb',
        number: 1,
        marks: 0,
        isWeightageEstimated: true,
        difficulty: modal.topic.difficulty || 'Moderate',
        estimatedHours: modal.topic.estimatedHours || 4,
        priority: 'high',
      });
    } else {
      // Defaults for adds
      setFormData({
        title: '',
        code: 'SUB',
        color: '#2563eb',
        number: 1,
        marks: 0,
        isWeightageEstimated: true,
        difficulty: 'Moderate',
        estimatedHours: 4,
        priority: 'high',
      });
    }
    setActiveModal(modal);
  };

  const handleModalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeModal) return;

    if (activeModal.kind === 'add_subject') {
      addSubject({
        name: formData.title.trim(),
        code: formData.code.trim().toUpperCase(),
        color: formData.color,
        priority: formData.priority,
        units: [],
        isCustom: true,
      });
    } else if (activeModal.kind === 'edit_subject') {
      updateSubject(activeModal.subject.id, {
        name: formData.title.trim(),
        code: formData.code.trim().toUpperCase(),
        color: formData.color,
        priority: formData.priority,
      });
    } else if (activeModal.kind === 'add_unit') {
      addUnit(activeModal.subjectId, {
        number: Number(formData.number),
        title: formData.title.trim(),
        officialMarks: Number(formData.marks),
        chapters: [],
      });
    } else if (activeModal.kind === 'edit_unit') {
      updateUnit(activeModal.subjectId, activeModal.unit.id, {
        number: Number(formData.number),
        title: formData.title.trim(),
        officialMarks: Number(formData.marks),
      });
    } else if (activeModal.kind === 'add_chapter') {
      addChapter(activeModal.subjectId, activeModal.unitId, {
        number: Number(formData.number),
        title: formData.title.trim(),
        officialWeightageMarks: Number(formData.marks),
        isWeightageEstimated: formData.isWeightageEstimated,
        topics: [],
      });
    } else if (activeModal.kind === 'edit_chapter') {
      updateChapter(activeModal.subjectId, activeModal.unitId, activeModal.chapter.id, {
        number: Number(formData.number),
        title: formData.title.trim(),
        officialWeightageMarks: Number(formData.marks),
        isWeightageEstimated: formData.isWeightageEstimated,
      });
    } else if (activeModal.kind === 'add_topic') {
      addTopic(activeModal.subjectId, activeModal.unitId, activeModal.chapterId, {
        title: formData.title.trim(),
        code: formData.code.trim() || undefined,
        subtopics: [],
        difficulty: formData.difficulty,
        estimatedHours: Number(formData.estimatedHours),
      });
    } else if (activeModal.kind === 'edit_topic') {
      updateTopic(activeModal.subjectId, activeModal.unitId, activeModal.chapterId, activeModal.topic.id, {
        title: formData.title.trim(),
        code: formData.code.trim() || undefined,
        difficulty: formData.difficulty,
        estimatedHours: Number(formData.estimatedHours),
      });
    }

    setActiveModal(null);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Official Syllabus Status & Verification Banner */}
      <div className="p-4 sm:p-5 rounded-3xl bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center flex-shrink-0 mt-0.5">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-amber-900 dark:text-amber-200">
                Syllabus Control & Status:
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-amber-200 text-amber-900 dark:bg-amber-900 dark:text-amber-100">
                {activeSyllabus.statusLabel}
              </span>
              <span className="text-xs text-amber-700 dark:text-amber-300">
                (Session {activeSyllabus.academicSession})
              </span>
            </div>
            <p className="text-xs text-amber-800/90 dark:text-amber-300/80 mt-1">
              Primary Source:{' '}
              <a
                href={activeSyllabus.officialSourceUrl}
                target="_blank"
                rel="noreferrer"
                className="underline font-semibold hover:text-amber-950 dark:hover:text-amber-100 inline-flex items-center gap-0.5"
              >
                {activeSyllabus.officialSourceUrl} <ExternalLink className="w-3 h-3" />
              </a>
              {' '}• Last checked: {activeSyllabus.lastCheckedDate}. You can import your own syllabus PDF or enter subjects, chapters, and topics manually.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
          {onNavigateToImportPDF && (
            <button
              onClick={onNavigateToImportPDF}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-blue-500/20 cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              Import Syllabus PDF
            </button>
          )}

          <button
            onClick={() => openModal({ kind: 'add_subject' })}
            className="px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 transition flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4 text-blue-600" />
            Add Subject
          </button>

          {activeSyllabus.subjects.length > 0 && (
            <button
              onClick={() => openModal({ kind: 'clear_default' })}
              className="px-3.5 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 text-xs font-semibold hover:bg-rose-100 dark:hover:bg-rose-900/40 transition flex items-center gap-1.5 shadow-xs cursor-pointer"
              title="Remove prefilled default chapters and start with an empty syllabus"
            >
              <Trash2 className="w-4 h-4 text-rose-600" />
              Clear Default Syllabus
            </button>
          )}

          <button
            onClick={onOpenSyllabusDiff}
            className="px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 text-xs font-semibold hover:bg-amber-100/50 dark:hover:bg-slate-700 transition flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <FileCheck className="w-4 h-4 text-amber-600" />
            Compare Official Editions
          </button>
        </div>
      </div>

      {/* Empty State Banner if syllabus has 0 subjects */}
      {activeSyllabus.subjects.length === 0 ? (
        <div className="py-16 text-center bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-300 dark:border-slate-800 p-8 space-y-4 shadow-xs">
          <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 mx-auto flex items-center justify-center">
            <BookOpen className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              Your syllabus is empty
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
              You have a clean slate. Import your own syllabus PDF document with our structured preview, or manually add your subjects, units, chapters, and topics.
            </p>
          </div>
          <div className="flex items-center justify-center gap-3 pt-2">
            {onNavigateToImportPDF && (
              <button
                onClick={onNavigateToImportPDF}
                className="px-5 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition flex items-center gap-2 shadow-md shadow-blue-500/20 cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                Import Syllabus PDF
              </button>
            )}
            <button
              onClick={() => openModal({ kind: 'add_subject' })}
              className="px-5 py-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-800 dark:text-slate-200 text-xs font-semibold transition flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Add Subject Manually
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Subject Filter Bar */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
            {activeSyllabus.subjects.map((sub) => {
              const isSelected = sub.id === (selectedSubject?.id || selectedSubjectId);
              return (
                <button
                  key={sub.id}
                  onClick={() => setSelectedSubjectId(sub.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                    isSelected
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                      : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: isSelected ? '#ffffff' : sub.color }}
                  />
                  <span>{sub.name}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-md ${
                      isSelected ? 'bg-blue-700 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                    }`}
                  >
                    {sub.code}
                  </span>
                </button>
              );
            })}

            <button
              onClick={() => openModal({ kind: 'add_subject' })}
              className="flex items-center gap-1.5 px-3 py-2 rounded-2xl text-xs font-semibold border border-dashed border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
              title="Add another subject"
            >
              <Plus className="w-3.5 h-3.5" />
              New Subject
            </button>
          </div>

          {/* Subject Details Bar */}
          {selectedSubject && (
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span
                  className="w-4 h-4 rounded-full flex-shrink-0"
                  style={{ backgroundColor: selectedSubject.color }}
                />
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    {selectedSubject.name} ({selectedSubject.code})
                  </h2>
                  <div className="text-xs text-slate-500">
                    {selectedSubject.units.length} Unit{selectedSubject.units.length !== 1 ? 's' : ''} • Priority: {selectedSubject.priority}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => openModal({ kind: 'add_unit', subjectId: selectedSubject.id })}
                  className="px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-xs font-semibold hover:bg-blue-100 transition cursor-pointer flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Unit
                </button>

                <button
                  onClick={() => openModal({ kind: 'edit_subject', subject: selectedSubject })}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                  title="Edit Subject"
                >
                  <Edit2 className="w-4 h-4" />
                </button>

                <button
                  onClick={() =>
                    setActiveModal({
                      kind: 'confirm_delete',
                      label: `subject "${selectedSubject.name}" and all its units`,
                      onConfirm: () => deleteSubject(selectedSubject.id),
                    })
                  }
                  className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                  title="Delete Subject"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Search and Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="Search topics, derivations, formulas in active subject..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500 shadow-xs"
              />
            </div>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3.5 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-blue-500 shadow-xs"
            >
              <option value="all">All Topics</option>
              <option value="completed">Completed Only</option>
              <option value="in_progress">In Progress</option>
              <option value="weak">Weak Topics (Confidence &lt;= 2)</option>
            </select>
          </div>

          {/* Units & Chapters List */}
          {selectedSubject && (
            <div className="space-y-4">
              {selectedSubject.units.length === 0 ? (
                <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 text-xs text-slate-500 space-y-2">
                  <p>No units added to {selectedSubject.name} yet.</p>
                  <button
                    onClick={() => openModal({ kind: 'add_unit', subjectId: selectedSubject.id })}
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer"
                  >
                    Add Unit 1 to {selectedSubject.name}
                  </button>
                </div>
              ) : (
                selectedSubject.units.map((unit) => {
                  const isExpanded = expandedUnits[unit.id] ?? true;

                  return (
                    <div
                      key={unit.id}
                      className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden"
                    >
                      {/* Unit Header */}
                      <div className="w-full px-5 py-4 bg-slate-50/70 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between text-left transition">
                        <button
                          onClick={() => toggleUnit(unit.id)}
                          className="flex items-center gap-2.5 flex-1 cursor-pointer"
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-slate-400" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-slate-400" />
                          )}
                          <div>
                            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                              Unit {unit.number}: {unit.title.replace(/^Unit\s*\d+\s*:\s*/i, '')}
                            </h3>
                            <div className="text-[11px] text-slate-500">
                              {unit.chapters.length} Chapter{unit.chapters.length !== 1 ? 's' : ''}
                              {unit.officialMarks ? ` • Total Marks: ~${unit.officialMarks}` : ''}
                            </div>
                          </div>
                        </button>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button
                            onClick={() => openModal({ kind: 'add_chapter', subjectId: selectedSubject.id, unitId: unit.id })}
                            className="px-2.5 py-1 rounded-lg bg-blue-100/70 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-xs font-semibold hover:bg-blue-200 transition cursor-pointer flex items-center gap-1"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            Add Chapter
                          </button>

                          <button
                            onClick={() => openModal({ kind: 'edit_unit', subjectId: selectedSubject.id, unit })}
                            className="p-1 rounded-lg text-slate-400 hover:text-blue-600 transition cursor-pointer"
                            title="Edit Unit"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() =>
                              setActiveModal({
                                kind: 'confirm_delete',
                                label: `Unit "${unit.title}" and its chapters`,
                                onConfirm: () => deleteUnit(selectedSubject.id, unit.id),
                              })
                            }
                            className="p-1 rounded-lg text-slate-400 hover:text-rose-600 transition cursor-pointer"
                            title="Delete Unit"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Chapters within Unit */}
                      {isExpanded && (
                        <div className="p-4 sm:p-5 space-y-6">
                          {unit.chapters.length === 0 ? (
                            <div className="p-4 text-center text-xs text-slate-500 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                              No chapters in this unit. Click 'Add Chapter' to start adding content.
                            </div>
                          ) : (
                            unit.chapters.map((chapter) => {
                              if (chapter.isArchived || chapter.isExcluded) return null;

                              const activeTopics = chapter.topics.filter((t) => {
                                if (t.isArchived || t.isExcluded) return false;
                                if (searchQuery && !t.title.toLowerCase().includes(searchQuery.toLowerCase())) {
                                  return false;
                                }
                                if (filterStatus === 'completed') {
                                  return isTopicCompleted(masteryMap[t.id]);
                                }
                                if (filterStatus === 'in_progress') {
                                  const m = masteryMap[t.id];
                                  return m && m.status === 'In Progress';
                                }
                                if (filterStatus === 'weak') {
                                  const m = masteryMap[t.id];
                                  return m && m.confidence <= 2;
                                }
                                return true;
                              });

                              if (searchQuery && activeTopics.length === 0) return null;

                              return (
                                <div
                                  key={chapter.id}
                                  className="rounded-2xl border border-slate-200/90 dark:border-slate-800/80 p-4 bg-slate-50/30 dark:bg-slate-800/20 space-y-3"
                                >
                                  {/* Chapter Header & Bulk Actions */}
                                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/60 dark:border-slate-800/60 pb-3">
                                    <div>
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200">
                                          Ch {chapter.number}
                                        </span>
                                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                                          {chapter.title}
                                        </h4>
                                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                          {chapter.officialWeightageMarks && chapter.officialWeightageMarks > 0
                                            ? chapter.isWeightageEstimated
                                              ? `~${chapter.officialWeightageMarks} M (My estimate — not officially verified)`
                                              : `${chapter.officialWeightageMarks} M (Board weightage)`
                                            : 'Weightage unset'}
                                        </span>
                                      </div>
                                    </div>

                                    {/* Chapter Controls */}
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                      <button
                                        onClick={() => openModal({ kind: 'add_topic', subjectId: selectedSubject.id, unitId: unit.id, chapterId: chapter.id })}
                                        className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950 px-2 py-1 rounded-lg transition cursor-pointer flex items-center gap-1"
                                      >
                                        <Plus className="w-3 h-3" />
                                        Add Topic
                                      </button>

                                      <button
                                        onClick={() =>
                                          bulkUpdateChapterTopics(chapter.id, {
                                            status: 'Completed',
                                            completedStages: [
                                              'theory',
                                              'notes',
                                              'formula_sheet',
                                              'ncert_exercises',
                                              'pyqs',
                                            ],
                                          })
                                        }
                                        className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950 px-2 py-1 rounded-lg transition cursor-pointer"
                                      >
                                        Mark Done
                                      </button>

                                      <button
                                        onClick={() => openModal({ kind: 'edit_chapter', subjectId: selectedSubject.id, unitId: unit.id, chapter })}
                                        className="p-1 rounded text-slate-400 hover:text-blue-600 transition cursor-pointer"
                                        title="Edit Chapter"
                                      >
                                        <Edit2 className="w-3.5 h-3.5" />
                                      </button>

                                      <button
                                        onClick={() =>
                                          setActiveModal({
                                            kind: 'confirm_delete',
                                            label: `chapter "${chapter.title}" and its topics`,
                                            onConfirm: () =>
                                              deleteChapter(selectedSubject.id, unit.id, chapter.id),
                                          })
                                        }
                                        className="p-1 rounded text-slate-400 hover:text-rose-600 transition cursor-pointer"
                                        title="Delete Chapter"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </div>

                                  {/* Topics List */}
                                  <div className="space-y-2.5">
                                    {activeTopics.length === 0 ? (
                                      <div className="text-center py-3 text-xs text-slate-400">
                                        No topics found. Click 'Add Topic' to add topics to this chapter.
                                      </div>
                                    ) : (
                                      activeTopics.map((topic) => {
                                        const m = masteryMap[topic.id];
                                        const isComp = isTopicCompleted(m);
                                        const conf = m ? m.confidence : 3;

                                        return (
                                          <div
                                            key={topic.id}
                                            className={`p-3 rounded-xl border transition flex flex-col md:flex-row md:items-center justify-between gap-3 ${
                                              isComp
                                                ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/60'
                                                : conf <= 2
                                                ? 'bg-rose-50/40 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/60'
                                                : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/80 shadow-xs'
                                            }`}
                                          >
                                            <div className="flex items-start gap-3">
                                              <button
                                                onClick={() =>
                                                  updateTopicMastery(topic.id, {
                                                    status: isComp ? 'In Progress' : 'Completed',
                                                    completedStages: isComp
                                                      ? []
                                                      : ['theory', 'notes', 'formula_sheet'],
                                                  })
                                                }
                                                className={`w-5 h-5 rounded-lg flex items-center justify-center border transition mt-0.5 cursor-pointer ${
                                                  isComp
                                                    ? 'bg-emerald-600 border-emerald-600 text-white'
                                                    : 'border-slate-300 dark:border-slate-600 hover:border-blue-500'
                                                }`}
                                              >
                                                {isComp && <CheckCircle2 className="w-4 h-4" />}
                                              </button>

                                              <div>
                                                <div className="text-xs font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                                                  <span>{topic.title}</span>
                                                  {topic.difficulty === 'Hard' && (
                                                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                                                      Hard
                                                    </span>
                                                  )}
                                                </div>

                                                <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5 flex-wrap">
                                                  <span>
                                                    Confidence:{' '}
                                                    <strong
                                                      className={
                                                        conf <= 2
                                                          ? 'text-rose-600 font-bold'
                                                          : conf >= 4
                                                          ? 'text-emerald-600 font-bold'
                                                          : 'text-amber-600'
                                                      }
                                                    >
                                                      {conf}/5
                                                    </strong>
                                                  </span>
                                                </div>
                                              </div>
                                            </div>

                                            {/* Action Buttons */}
                                            <div className="flex items-center gap-2 justify-end">
                                              <button
                                                onClick={() => onSelectTopic(topic.id)}
                                                className="px-3 py-1 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-blue-600 hover:text-white text-slate-700 dark:text-slate-200 text-xs font-medium transition cursor-pointer"
                                              >
                                                Track & Derivations
                                              </button>

                                              <button
                                                onClick={() =>
                                                  openModal({
                                                    kind: 'edit_topic',
                                                    subjectId: selectedSubject.id,
                                                    unitId: unit.id,
                                                    chapterId: chapter.id,
                                                    topic,
                                                  })
                                                }
                                                className="p-1 rounded text-slate-400 hover:text-blue-600 transition cursor-pointer"
                                                title="Edit Topic"
                                              >
                                                <Edit2 className="w-3.5 h-3.5" />
                                              </button>

                                              <button
                                                onClick={() =>
                                                  setActiveModal({
                                                    kind: 'confirm_delete',
                                                    label: `topic "${topic.title}"`,
                                                    onConfirm: () =>
                                                      deleteTopic(
                                                        selectedSubject.id,
                                                        unit.id,
                                                        chapter.id,
                                                        topic.id
                                                      ),
                                                  })
                                                }
                                                className="p-1 rounded text-slate-400 hover:text-rose-600 transition cursor-pointer"
                                                title="Delete Topic"
                                              >
                                                <Trash2 className="w-3.5 h-3.5" />
                                              </button>
                                            </div>
                                          </div>
                                        );
                                      })
                                    )}
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </>
      )}

      {/* Official Excluded / Rationalized Topics Reference Section */}
      <div className="rounded-3xl bg-slate-100/70 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Archive className="w-4 h-4 text-slate-500" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Officially Excluded / Rationalized Topics Section
            </h3>
          </div>
          <button
            onClick={() => setShowExcludedSection((prev) => !prev)}
            className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
          >
            {showExcludedSection ? 'Hide Excluded Items' : 'Show Excluded Items'}
          </button>
        </div>
        <p className="text-xs text-slate-500">
          Maintained in a separate reference section per official RBSE guidelines. Excluded items do not count towards active progress percentages.
        </p>

        {showExcludedSection && (
          <div className="space-y-2 pt-2">
            {activeSyllabus.excludedItems?.map((item) => (
              <div
                key={item.id}
                className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs space-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    [{item.subjectName}] {item.itemTitle}
                  </span>
                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                    {item.itemType} Excluded
                  </span>
                </div>
                <p className="text-slate-600 dark:text-slate-400">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">Reason:</span> {item.reason}
                </p>
                <p className="text-[11px] text-slate-500">
                  <span className="font-semibold">Source:</span> {item.source}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Confirmation Modal: Clear Default Syllabus */}
      {activeModal?.kind === 'clear_default' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 dark:bg-rose-950/60 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Clear Prefilled Default Syllabus?
                </h3>
                <p className="text-xs text-rose-600 dark:text-rose-400 font-medium">
                  Start with a clean, empty syllabus
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              This will remove the 47 preloaded default chapters and 106 topics. You will be able to enter your own syllabus manually or import it from your own PDF document.
            </p>

            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 text-[11px] text-slate-500 border border-slate-200 dark:border-slate-700">
              <span className="font-bold text-slate-700 dark:text-slate-300">Safety Guarantee: </span>
              Your personal study notes, formula cards, mistake records, and mock tests will remain completely safe.
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setActiveModal(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  clearDefaultSyllabus();
                  setActiveModal(null);
                }}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition cursor-pointer shadow-xs"
              >
                Yes, Clear Default Syllabus
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Delete Syllabus Item */}
      {activeModal?.kind === 'confirm_delete' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Confirm Deletion</h3>
                <p className="text-xs text-slate-600">
                  Are you sure you want to delete {activeModal.label}?
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setActiveModal(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  activeModal.onConfirm();
                  setActiveModal(null);
                }}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition cursor-pointer shadow-xs"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CRUD Modal for Subject / Unit / Chapter / Topic */}
      {activeModal && activeModal.kind !== 'clear_default' && activeModal.kind !== 'confirm_delete' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <form
            onSubmit={handleModalSubmit}
            className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {activeModal.kind === 'add_subject' && 'Add Subject'}
                {activeModal.kind === 'edit_subject' && 'Edit Subject'}
                {activeModal.kind === 'add_unit' && 'Add Unit'}
                {activeModal.kind === 'edit_unit' && 'Edit Unit'}
                {activeModal.kind === 'add_chapter' && 'Add Chapter'}
                {activeModal.kind === 'edit_chapter' && 'Edit Chapter'}
                {activeModal.kind === 'add_topic' && 'Add Topic'}
                {activeModal.kind === 'edit_topic' && 'Edit Topic'}
              </h3>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs">
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                {activeModal.kind.includes('subject') ? 'Subject Name *' : 'Title *'}
              </label>
              <input
                type="text"
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g. Physics, Electrostatics, Coulomb's Law"
                className="mt-1 w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium"
              />
            </div>

            {activeModal.kind.includes('subject') && (
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Subject Code</label>
                  <input
                    type="text"
                    required
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    placeholder="e.g. 12-PHY"
                    className="mt-1 w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Accent Color</label>
                  <input
                    type="color"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    className="mt-1 w-full h-10 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 cursor-pointer p-1"
                  />
                </div>
              </div>
            )}

            {(activeModal.kind.includes('unit') || activeModal.kind.includes('chapter')) && (
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Number / Order</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.number}
                    onChange={(e) => setFormData({ ...formData, number: Number(e.target.value) })}
                    className="mt-1 w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Marks Weightage</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.marks}
                    onChange={(e) => setFormData({ ...formData, marks: Number(e.target.value) })}
                    className="mt-1 w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>
            )}

            {activeModal.kind.includes('chapter') && (
              <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 text-xs">
                <label className="flex items-center gap-2 cursor-pointer font-semibold text-amber-900 dark:text-amber-200">
                  <input
                    type="checkbox"
                    checked={formData.isWeightageEstimated}
                    onChange={(e) => setFormData({ ...formData, isWeightageEstimated: e.target.checked })}
                    className="rounded text-amber-600 focus:ring-amber-500"
                  />
                  <span>Label as "My estimate — not officially verified"</span>
                </label>
                <p className="text-[11px] text-amber-800 dark:text-amber-300 mt-1">
                  Ensures personal estimations are clearly separated from confirmed board publications.
                </p>
              </div>
            )}

            {activeModal.kind.includes('topic') && (
              <div className="text-xs">
                <label className="font-semibold text-slate-700 dark:text-slate-300">Difficulty</label>
                <select
                  value={formData.difficulty}
                  onChange={(e) => setFormData({ ...formData, difficulty: e.target.value as any })}
                  className="mt-1 w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                >
                  <option value="Easy">Easy</option>
                  <option value="Moderate">Moderate</option>
                  <option value="Hard">Hard</option>
                </select>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition cursor-pointer shadow-xs"
              >
                Save Changes
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
