import React, { useState, useRef } from 'react';
import { useApp } from '../context/AppContext.tsx';
import { useLocalMusic } from '../context/LocalMusicContext.tsx';
import {
  Settings,
  Cloud,
  Download,
  Upload,
  AlertTriangle,
  LogIn,
  LogOut,
  Plus,
  Trash2,
  Edit2,
  Sparkles,
  FileText,
  Calendar,
  Sliders,
  LayoutDashboard,
  Music,
  Volume2,
  Play,
  Pause,
  Power,
  Shuffle,
  Repeat,
  EyeOff,
  FileMusic,
} from 'lucide-react';

export const SettingsView: React.FC = () => {
  const {
    preferences,
    updatePreferences,
    activeSyllabus,
    updateSubject,
    addSubject,
    deleteSubject,
    milestones,
    addMilestone,
    updateMilestone,
    deleteMilestone,
    aiPersistentRules,
    addAIPersistentRule,
    toggleAIPersistentRule,
    deleteAIPersistentRule,
    aiChatHistory,
    clearAIChatHistory,
    uploadedFilesMetadata,
    deleteUploadedFileMetadata,
    currentUser,
    syncState,
    lastSyncTime,
    loginGoogle,
    logoutUser,
    exportJSON,
    importJSON,
    resetAllData,
  } = useApp();

  const {
    tracks,
    currentTrackIndex,
    currentTrack,
    isPlaying,
    isPausedByBackground,
    volume,
    setVolume,
    togglePlay,
    playTrack,
    masterEnabled,
    setMasterEnabled,
    resumeOnReturn,
    setResumeOnReturn,
    shuffleEnabled,
    toggleShuffle,
    repeatMode,
    cycleRepeatMode,
    importFiles,
    removeTrack,
    clearLibrary,
    clearPreferences,
    setIsPlayerOpen,
  } = useLocalMusic();

  const musicFileInputRef = useRef<HTMLInputElement | null>(null);
  const [showClearMusicConfirm, setShowClearMusicConfirm] = useState(false);

  const [confirmReset, setConfirmReset] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);

  // Subject quick editor state
  const [editingSubjectId, setEditingSubjectId] = useState<string | null>(null);
  const [editSubName, setEditSubName] = useState('');
  const [editSubCode, setEditSubCode] = useState('');
  const [editSubColor, setEditSubColor] = useState('#3B82F6');
  const [editSubPriority, setEditSubPriority] = useState<'high' | 'medium' | 'low'>('high');

  // New subject state
  const [newSubName, setNewSubName] = useState('');
  const [newSubCode, setNewSubCode] = useState('');

  // New milestone state
  const [newMilestoneTitle, setNewMilestoneTitle] = useState('');
  const [newMilestoneDate, setNewMilestoneDate] = useState('2027-03-04');

  // New AI Rule state
  const [newRuleText, setNewRuleText] = useState('');

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const success = importJSON(content);
      if (success) {
        setImportStatus('Backup restored successfully!');
      } else {
        setImportStatus('Failed to import backup: invalid file format.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const startEditSubject = (sub: any) => {
    setEditingSubjectId(sub.id);
    setEditSubName(sub.name);
    setEditSubCode(sub.code);
    setEditSubColor(sub.color);
    setEditSubPriority(sub.priority);
  };

  const saveEditSubject = (id: string) => {
    if (!editSubName.trim()) return;
    updateSubject(id, {
      name: editSubName.trim(),
      code: editSubCode.trim().toUpperCase() || 'SUB',
      color: editSubColor,
      priority: editSubPriority,
    });
    setEditingSubjectId(null);
  };

  const handleCreateSubject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubName.trim()) return;
    addSubject({
      name: newSubName.trim(),
      code: newSubCode.trim().toUpperCase() || newSubName.slice(0, 4).toUpperCase(),
      color: '#3B82F6',
      priority: 'high',
      units: [],
      isCustom: true,
    });
    setNewSubName('');
    setNewSubCode('');
  };

  const handleCreateMilestone = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMilestoneTitle.trim() || !newMilestoneDate) return;
    addMilestone({
      title: newMilestoneTitle.trim(),
      date: newMilestoneDate,
      subjects: activeSyllabus.subjects.map((s) => s.id),
      isBoardExam: true,
      isCompleted: false,
    });
    setNewMilestoneTitle('');
  };

  const handleCreateAIRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRuleText.trim()) return;
    addAIPersistentRule(newRuleText.trim(), 'general');
    setNewRuleText('');
  };

  const defaultIntervalDays = preferences.revisionIntervals?.[0] || 7;

  return (
    <div className="space-y-6 pb-16">
      {/* Header */}
      <div className="p-5 sm:p-6 rounded-2xl bg-white border border-[#E4DCC9] shadow-xs">
        <div className="flex items-center gap-2 text-xs font-bold text-[#42BDAE] uppercase tracking-wider mb-1">
          <Settings className="w-4 h-4" />
          <span>Global Personalization & System Control</span>
        </div>
        <h1 className="text-xl sm:text-2xl font-bold text-[#1B4D48] tracking-tight">
          Account Personalization, Rules & Cloud Sync
        </h1>
        <p className="text-xs text-[#4A6B66] mt-1 max-w-2xl">
          Every change made here immediately updates your syllabus, backlog, study planner, Topic Intelligence ranking, Home dashboard, and AI Assistant.
        </p>
      </div>

      {/* 1. Subjects & Global Renaming */}
      <div className="p-5 sm:p-6 rounded-2xl bg-white border border-[#E4DCC9] shadow-xs space-y-4">
        <div>
          <h2 className="text-base font-bold text-[#1B4D48]">
            1. Subjects & Global Subject Customization
          </h2>
          <p className="text-xs text-[#4A6B66] mt-0.5">
            Renaming a subject automatically cascades to your Syllabus, Backlog, Study Planner, Revision Queue, and PYQ Bank.
          </p>
        </div>

        <div className="space-y-2.5">
          {activeSyllabus.subjects.map((sub) => (
            <div
              key={sub.id}
              className="p-3.5 rounded-xl bg-[#FBF7EF] border border-[#E4DCC9] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
            >
              {editingSubjectId === sub.id ? (
                <div className="flex flex-wrap items-center gap-2 flex-1">
                  <input
                    type="text"
                    value={editSubName}
                    onChange={(e) => setEditSubName(e.target.value)}
                    className="px-2.5 py-1.5 rounded-lg bg-white border border-[#E4DCC9] text-[#1B4D48] font-semibold"
                    placeholder="Subject Name"
                  />
                  <input
                    type="text"
                    value={editSubCode}
                    onChange={(e) => setEditSubCode(e.target.value)}
                    className="w-20 px-2.5 py-1.5 rounded-lg bg-white border border-[#E4DCC9] text-[#1B4D48] font-mono"
                    placeholder="Code"
                  />
                  <input
                    type="color"
                    value={editSubColor}
                    onChange={(e) => setEditSubColor(e.target.value)}
                    className="w-8 h-8 rounded bg-transparent cursor-pointer"
                  />
                  <select
                    value={editSubPriority}
                    onChange={(e) => setEditSubPriority(e.target.value as any)}
                    className="px-2.5 py-1.5 rounded-lg bg-white border border-[#E4DCC9] text-[#1B4D48]"
                  >
                    <option value="high">High Priority</option>
                    <option value="medium">Medium Priority</option>
                    <option value="low">Low Priority</option>
                  </select>
                  <button
                    onClick={() => saveEditSubject(sub.id)}
                    className="px-3 py-1.5 rounded-lg bg-[#1B4D48] text-white font-bold cursor-pointer"
                  >
                    Save Globally
                  </button>
                  <button
                    onClick={() => setEditingSubjectId(null)}
                    className="px-2.5 py-1.5 rounded-lg bg-[#F5EFE2] text-[#4A6B66] cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-3">
                    <span
                      className="w-3.5 h-3.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: sub.color }}
                    />
                    <span className="font-bold text-[#1B4D48] text-sm">{sub.name}</span>
                    <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-white border border-[#E4DCC9] text-[#4A6B66]">
                      {sub.code}
                    </span>
                    <span className="text-[11px] uppercase font-semibold text-[#42BDAE]">
                      {sub.priority} priority
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => startEditSubject(sub)}
                      className="px-3 py-1.5 rounded-lg bg-white hover:bg-[#F5EFE2] border border-[#E4DCC9] text-[#1B4D48] font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5 text-[#42BDAE]" />
                      Rename / Edit
                    </button>
                    {activeSyllabus.subjects.length > 1 && (
                      <button
                        onClick={() => deleteSubject(sub.id)}
                        className="p-1.5 rounded-lg text-[#4A6B66] hover:text-rose-600 cursor-pointer"
                        title="Delete Subject"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>

        <form onSubmit={handleCreateSubject} className="flex flex-wrap items-center gap-2 pt-2 text-xs">
          <input
            type="text"
            placeholder="New Subject Name (e.g. Biology)"
            value={newSubName}
            onChange={(e) => setNewSubName(e.target.value)}
            className="px-3 py-2 rounded-xl bg-[#FBF7EF] border border-[#E4DCC9] text-[#1B4D48]"
          />
          <input
            type="text"
            placeholder="Code (e.g. BIO)"
            value={newSubCode}
            onChange={(e) => setNewSubCode(e.target.value)}
            className="w-28 px-3 py-2 rounded-xl bg-[#FBF7EF] border border-[#E4DCC9] text-[#1B4D48] font-mono"
          />
          <button
            type="submit"
            className="px-4 py-2 rounded-xl bg-[#1B4D48] hover:bg-[#153E3A] text-white font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add Subject
          </button>
        </form>
      </div>

      {/* 2. Study Planner, Revision Intervals & Completion Rules */}
      <div className="p-5 sm:p-6 rounded-2xl bg-white border border-[#E4DCC9] shadow-xs space-y-4">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-[#42BDAE]" />
          <h2 className="text-base font-bold text-[#1B4D48]">
            2. Study Planner, Revision Intervals & Priority Rules
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div>
            <label className="font-semibold text-[#4A6B66] block mb-1">
              Daily Available Study Time (Hours)
            </label>
            <input
              type="number"
              min="1"
              max="16"
              step="0.5"
              value={preferences.dailyStudyHoursLimit}
              onChange={(e) =>
                updatePreferences({ dailyStudyHoursLimit: Number(e.target.value) })
              }
              className="w-full p-2.5 rounded-xl bg-[#FBF7EF] border border-[#E4DCC9] text-[#1B4D48] font-mono font-bold"
            />
          </div>

          <div>
            <label className="font-semibold text-[#4A6B66] block mb-1">
              Default Spaced Revision Interval (Days)
            </label>
            <input
              type="number"
              min="1"
              max="60"
              value={defaultIntervalDays}
              onChange={(e) => {
                const days = Number(e.target.value) || 7;
                updatePreferences({
                  revisionIntervals: [days, days * 2, days * 4, days * 8],
                });
              }}
              className="w-full p-2.5 rounded-xl bg-[#FBF7EF] border border-[#E4DCC9] text-[#1B4D48] font-mono font-bold"
            />
          </div>

          <div>
            <label className="font-semibold text-[#4A6B66] block mb-1">
              Primary Exam Target Date
            </label>
            <input
              type="date"
              value={preferences.examTargetDate}
              onChange={(e) => updatePreferences({ examTargetDate: e.target.value })}
              className="w-full p-2.5 rounded-xl bg-[#FBF7EF] border border-[#E4DCC9] text-[#1B4D48] font-mono font-bold"
            />
          </div>
        </div>

        {/* Toggle Preferences */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs">
          <label className="p-3.5 rounded-xl bg-[#FBF7EF] border border-[#E4DCC9] flex items-center justify-between cursor-pointer">
            <div>
              <span className="font-bold text-[#1B4D48] block">
                Do Not Mark Topics Completed Automatically
              </span>
              <span className="text-[#4A6B66] text-[11px]">
                Require explicit "Completed" status selection rather than stage-based auto-completion.
              </span>
            </div>
            <input
              type="checkbox"
              checked={preferences.autoCompleteFromStages !== true}
              onChange={(e) =>
                updatePreferences({ autoCompleteFromStages: !e.target.checked })
              }
              className="w-4 h-4 accent-[#1B4D48]"
            />
          </label>

          <label className="p-3.5 rounded-xl bg-[#FBF7EF] border border-[#E4DCC9] flex items-center justify-between cursor-pointer">
            <div>
              <span className="font-bold text-[#1B4D48] block">
                Always Rank Topics Using Uploaded PYQs
              </span>
              <span className="text-[#4A6B66] text-[11px]">
                Prioritize syllabus topics by actual PYQ frequency and marks weightage.
              </span>
            </div>
            <input
              type="checkbox"
              checked={preferences.alwaysRankByPYQ !== false}
              onChange={(e) => updatePreferences({ alwaysRankByPYQ: e.target.checked })}
              className="w-4 h-4 accent-[#1B4D48]"
            />
          </label>
        </div>
      </div>

      {/* 3. Examination Milestones */}
      <div className="p-5 sm:p-6 rounded-2xl bg-white border border-[#E4DCC9] shadow-xs space-y-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-[#42BDAE]" />
          <h2 className="text-base font-bold text-[#1B4D48]">
            3. Editable Examination Dates & Milestones
          </h2>
        </div>

        <div className="space-y-2 text-xs">
          {milestones.map((m) => (
            <div
              key={m.id}
              className="p-3 rounded-xl bg-[#FBF7EF] border border-[#E4DCC9] flex flex-wrap items-center justify-between gap-2"
            >
              <input
                type="text"
                value={m.title}
                onChange={(e) => updateMilestone(m.id, { title: e.target.value })}
                className="flex-1 min-w-[200px] px-2.5 py-1.5 rounded-lg bg-white border border-[#E4DCC9] text-[#1B4D48] font-semibold"
              />
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={m.date}
                  onChange={(e) => updateMilestone(m.id, { date: e.target.value })}
                  className="px-2.5 py-1.5 rounded-lg bg-white border border-[#E4DCC9] text-[#1B4D48] font-mono"
                />
                <button
                  onClick={() => deleteMilestone(m.id)}
                  className="p-1.5 text-[#4A6B66] hover:text-rose-600 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        <form onSubmit={handleCreateMilestone} className="flex flex-wrap items-center gap-2 text-xs">
          <input
            type="text"
            placeholder="Milestone or Exam Name..."
            value={newMilestoneTitle}
            onChange={(e) => setNewMilestoneTitle(e.target.value)}
            className="flex-1 min-w-[200px] px-3 py-2 rounded-xl bg-[#FBF7EF] border border-[#E4DCC9] text-[#1B4D48]"
          />
          <input
            type="date"
            value={newMilestoneDate}
            onChange={(e) => setNewMilestoneDate(e.target.value)}
            className="px-3 py-2 rounded-xl bg-[#FBF7EF] border border-[#E4DCC9] text-[#1B4D48] font-mono"
          />
          <button
            type="submit"
            className="px-4 py-2 rounded-xl bg-[#1B4D48] hover:bg-[#153E3A] text-white font-bold cursor-pointer"
          >
            + Add Exam Target
          </button>
        </form>
      </div>

      {/* 4. Dashboard Layout & Card Visibility */}
      <div className="p-5 sm:p-6 rounded-2xl bg-white border border-[#E4DCC9] shadow-xs space-y-4">
        <div className="flex items-center gap-2">
          <LayoutDashboard className="w-4 h-4 text-[#42BDAE]" />
          <h2 className="text-base font-bold text-[#1B4D48]">
            4. Home Dashboard Layout & Card Visibility
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
          <label className="p-3 rounded-xl bg-[#FBF7EF] border border-[#E4DCC9] flex items-center justify-between cursor-pointer">
            <span className="text-[#1B4D48] font-medium">
              Show Only High-Priority Unfinished Topics on Home
            </span>
            <input
              type="checkbox"
              checked={preferences.showOnlyHighPriorityOnHome === true}
              onChange={(e) =>
                updatePreferences({ showOnlyHighPriorityOnHome: e.target.checked })
              }
              className="w-4 h-4 accent-[#1B4D48]"
            />
          </label>

          <label className="p-3 rounded-xl bg-[#FBF7EF] border border-[#E4DCC9] flex items-center justify-between cursor-pointer">
            <span className="text-[#1B4D48] font-medium">Show PYQ Analysis Card on Home</span>
            <input
              type="checkbox"
              checked={preferences.dashboardCards?.showPYQStats !== false}
              onChange={(e) =>
                updatePreferences({
                  dashboardCards: {
                    ...(preferences.dashboardCards || {}),
                    showPYQStats: e.target.checked,
                  },
                })
              }
              className="w-4 h-4 accent-[#1B4D48]"
            />
          </label>
        </div>
      </div>

      {/* 5. Saved AI Persistent Rules, OpenAI/Gemini Provider & Conversation History Controls */}
      <div className="p-5 sm:p-6 rounded-2xl bg-white border border-[#E4DCC9] shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-[#1B4D48] flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#42BDAE]" />
              5. AI Provider (OpenAI / Gemini), Persistent Instructions & History
            </h2>
            <p className="text-xs text-[#4A6B66] mt-0.5">
              Select your preferred AI provider (Auto, OpenAI API, Google Gemini API, or Local RBSE Engine) and manage persistent rules.
            </p>
          </div>

          <button
            onClick={clearAIChatHistory}
            className="px-3 py-1.5 rounded-xl bg-[#F5EFE2] hover:bg-[#E4DCC9] text-rose-700 border border-[#E4DCC9] text-xs font-semibold cursor-pointer self-start"
          >
            Clear AI Conversation History ({aiChatHistory.length} msgs)
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-1">
          <div>
            <label className="text-[#4A6B66] font-semibold block mb-1">
              Preferred AI Provider
            </label>
            <select
              value={preferences.aiProvider || 'auto'}
              onChange={(e) =>
                updatePreferences({
                  aiProvider: e.target.value as any,
                  aiStrictLocalOnly: e.target.value === 'local',
                })
              }
              className="w-full p-2.5 rounded-xl bg-[#FBF7EF] border border-[#E4DCC9] text-[#1B4D48]"
            >
              <option value="auto">Auto (OpenAI / Gemini + RBSE Fallback)</option>
              <option value="openai">OpenAI Official API (GPT-4o-mini)</option>
              <option value="gemini">Google Gemini API (Gemini 3.8 Flash)</option>
              <option value="local">Local RBSE Syllabus Engine (Offline)</option>
            </select>
          </div>

          <div>
            <label className="text-[#4A6B66] font-semibold block mb-1">
              OpenAI Model (Server-Side)
            </label>
            <input
              type="text"
              value={preferences.openaiModel || 'gpt-4o-mini'}
              onChange={(e) => updatePreferences({ openaiModel: e.target.value })}
              placeholder="gpt-4o-mini"
              className="w-full p-2.5 rounded-xl bg-[#FBF7EF] border border-[#E4DCC9] text-[#1B4D48] font-mono"
            />
          </div>

          <label className="p-2.5 rounded-xl bg-[#FBF7EF] border border-[#E4DCC9] flex items-center justify-between cursor-pointer self-end">
            <span className="text-[#1B4D48] font-medium">Strict Local-Only Mode</span>
            <input
              type="checkbox"
              checked={preferences.aiStrictLocalOnly === true}
              onChange={(e) =>
                updatePreferences({
                  aiStrictLocalOnly: e.target.checked,
                  aiProvider: e.target.checked ? 'local' : 'auto',
                })
              }
              className="w-4 h-4 accent-[#1B4D48]"
            />
          </label>
        </div>

        <div className="space-y-2 text-xs">
          {aiPersistentRules.map((rule) => (
            <div
              key={rule.id}
              className="p-3 rounded-xl bg-[#FBF7EF] border border-[#E4DCC9] flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-2.5 flex-1">
                <input
                  type="checkbox"
                  checked={rule.active}
                  onChange={() => toggleAIPersistentRule(rule.id)}
                  className="w-4 h-4 accent-[#1B4D48] cursor-pointer"
                />
                <span className={rule.active ? 'text-[#1B4D48] font-medium' : 'text-[#4A6B66] line-through'}>
                  {rule.instruction}
                </span>
              </div>
              <button
                onClick={() => deleteAIPersistentRule(rule.id)}
                className="p-1.5 text-[#4A6B66] hover:text-rose-600 cursor-pointer"
                title="Delete AI Rule"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        <form onSubmit={handleCreateAIRule} className="flex gap-2 text-xs">
          <input
            type="text"
            placeholder="Add persistent AI preference (e.g., Always rank my topics using uploaded PYQs)"
            value={newRuleText}
            onChange={(e) => setNewRuleText(e.target.value)}
            className="flex-1 px-3 py-2 rounded-xl bg-[#FBF7EF] border border-[#E4DCC9] text-[#1B4D48]"
          />
          <button
            type="submit"
            className="px-4 py-2 rounded-xl bg-[#1B4D48] hover:bg-[#153E3A] text-white font-bold cursor-pointer"
          >
            Save Rule
          </button>
        </form>
      </div>

      {/* 6. Uploaded PDF Files Metadata Registry */}
      <div className="p-5 sm:p-6 rounded-2xl bg-white border border-[#E4DCC9] shadow-xs space-y-3">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-[#42BDAE]" />
          <h2 className="text-base font-bold text-[#1B4D48]">
            6. Uploaded PDF Metadata Records ({uploadedFilesMetadata.length})
          </h2>
        </div>

        {uploadedFilesMetadata.length === 0 ? (
          <p className="text-xs text-[#4A6B66]">
            No PDF files imported yet. Uploaded Syllabus and PYQ PDFs will be logged here with page count and item counts.
          </p>
        ) : (
          <div className="space-y-2 text-xs">
            {uploadedFilesMetadata.map((meta) => (
              <div
                key={meta.id}
                className="p-3 rounded-xl bg-[#FBF7EF] border border-[#E4DCC9] flex items-center justify-between gap-2"
              >
                <div>
                  <span className="font-bold text-[#1B4D48]">{meta.fileName}</span>
                  <span className="ml-2 text-[#4A6B66] font-mono">
                    ({meta.fileType.toUpperCase()} • {meta.pageCount || 1} pages •{' '}
                    {meta.itemsExtractedCount} items)
                  </span>
                </div>
                <button
                  onClick={() => deleteUploadedFileMetadata(meta.id)}
                  className="p-1 text-[#4A6B66] hover:text-rose-600 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 7. Custom Local Background Music System (Foreground Only) */}
      <div className="p-5 sm:p-6 rounded-2xl bg-white border border-[#E4DCC9] shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E4DCC9] pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#75D9B4]/25 text-[#1B4D48]">
              <Music className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#1B4D48]">
                7. Custom Local Background Music (Foreground Only)
              </h2>
              <p className="text-xs text-[#4A6B66]">
                Plays strictly while AZORA / MyStudyPath is in the foreground using your imported local music files.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="file"
              ref={musicFileInputRef}
              multiple
              accept="audio/*,.mp3,.wav,.m4a,.ogg,.aac"
              onChange={async (e) => {
                if (e.target.files) {
                  await importFiles(e.target.files);
                  e.target.value = '';
                }
              }}
              className="hidden"
            />
            <button
              onClick={() => musicFileInputRef.current?.click()}
              className="px-3.5 py-2 rounded-xl bg-[#42BDAE] hover:bg-[#359e91] text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Import Music Files</span>
            </button>

            <button
              onClick={() => {
                setIsPlayerOpen(true);
                togglePlay();
              }}
              className={`px-3.5 py-2 rounded-xl font-semibold text-xs flex items-center gap-2 transition cursor-pointer ${
                isPlaying
                  ? 'bg-[#1B4D48] text-[#75D9B4] font-bold shadow-xs'
                  : 'bg-[#FBF7EF] hover:bg-[#F5EFE2] border border-[#E4DCC9] text-[#1B4D48]'
              }`}
            >
              {isPlaying ? (
                <>
                  <Pause className="w-3.5 h-3.5 fill-current" />
                  <span>Pause Music</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Play Music</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Status Notice if Paused by Background */}
        {isPausedByBackground && (
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs flex items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <EyeOff className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Music is currently <strong>Paused</strong> because the app was in the background.</span>
            </span>
          </div>
        )}

        {/* Primary Settings Toggles */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <label className="p-3.5 rounded-xl bg-[#FBF7EF] border border-[#E4DCC9] flex items-center justify-between cursor-pointer">
            <div>
              <span className="font-bold text-[#1B4D48] block">Master Background Music</span>
              <span className="text-[11px] text-[#4A6B66]">Master OFF switch overrides all playback settings</span>
            </div>
            <input
              type="checkbox"
              checked={masterEnabled}
              onChange={(e) => setMasterEnabled(e.target.checked)}
              className="w-4 h-4 rounded accent-[#1B4D48] cursor-pointer"
            />
          </label>

          <label className="p-3.5 rounded-xl bg-[#FBF7EF] border border-[#E4DCC9] flex items-center justify-between cursor-pointer">
            <div>
              <span className="font-bold text-[#1B4D48] block">Resume on Return to Foreground</span>
              <span className="text-[11px] text-[#4A6B66]">Auto-resume track when returning to visible app</span>
            </div>
            <input
              type="checkbox"
              checked={resumeOnReturn}
              onChange={(e) => setResumeOnReturn(e.target.checked)}
              className="w-4 h-4 rounded accent-[#1B4D48] cursor-pointer"
            />
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          {/* Active Track Info */}
          <div className="p-3.5 rounded-xl bg-[#FBF7EF] border border-[#E4DCC9] space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#42BDAE]">
              Active Track ({tracks.length} total)
            </span>
            {currentTrack ? (
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h4 className="font-bold text-[#1B4D48] text-sm truncate">{currentTrack.title}</h4>
                  <p className="text-[#4A6B66] text-[11px] font-mono mt-0.5 truncate">{currentTrack.filename}</p>
                </div>
              </div>
            ) : (
              <p className="text-[#4A6B66] text-xs italic">No music track loaded yet.</p>
            )}
          </div>

          {/* Volume Control */}
          <div className="p-3.5 rounded-xl bg-[#FBF7EF] border border-[#E4DCC9] space-y-2">
            <div className="flex items-center justify-between text-xs text-[#1B4D48]">
              <span className="font-bold flex items-center gap-1.5">
                <Volume2 className="w-4 h-4 text-[#42BDAE]" />
                Default Music Volume
              </span>
              <span className="font-mono text-[#1B4D48] font-bold">
                {Math.round(volume * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              className="w-full h-1.5 bg-[#E4DCC9] rounded-lg appearance-none cursor-pointer accent-[#42BDAE]"
            />
          </div>
        </div>

        {/* Imported Tracks Summary & Actions */}
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-[#1B4D48]">Imported Local Music Library ({tracks.length}):</span>
            {tracks.length > 0 && (
              <button
                onClick={() => setShowClearMusicConfirm(true)}
                className="text-rose-600 hover:text-rose-700 font-semibold text-[11px] cursor-pointer"
              >
                Clear All Music Tracks
              </button>
            )}
          </div>

          {showClearMusicConfirm && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs space-y-2">
              <p className="font-semibold">Remove all imported local music files from persistent IndexedDB library?</p>
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={async () => {
                    await clearLibrary();
                    setShowClearMusicConfirm(false);
                  }}
                  className="px-3 py-1 rounded bg-rose-600 text-white font-bold cursor-pointer"
                >
                  Confirm Clear
                </button>
                <button
                  onClick={() => setShowClearMusicConfirm(false)}
                  className="px-2.5 py-1 rounded bg-white border border-rose-200 text-rose-800 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {tracks.length === 0 ? (
            <div className="p-4 rounded-xl bg-[#FBF7EF] border border-[#E4DCC9] text-center text-xs text-[#4A6B66] space-y-2">
              <FileMusic className="w-6 h-6 text-[#42BDAE] mx-auto opacity-80" />
              <p>No custom music files imported yet. Select your downloaded MP3, WAV, M4A, or OGG files above.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
              {tracks.map((track, idx) => {
                const isSelected = idx === currentTrackIndex;
                return (
                  <div
                    key={track.id}
                    onClick={() => playTrack(idx)}
                    className={`p-2.5 rounded-xl border text-left flex items-center justify-between gap-2 transition cursor-pointer ${
                      isSelected
                        ? 'bg-[#75D9B4]/20 border-[#42BDAE] text-[#1B4D48]'
                        : 'bg-[#FBF7EF] border-[#E4DCC9] text-[#1B4D48] hover:border-[#42BDAE]'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="font-bold text-xs truncate">{track.title}</div>
                      <div className="text-[10px] text-[#4A6B66] truncate font-mono">{track.filename}</div>
                    </div>
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        await removeTrack(track.id);
                      }}
                      title="Delete track"
                      className="p-1 rounded text-[#4A6B66] hover:text-rose-600 transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 8. Cloud Firestore Sync & JSON Backup */}
      <div className="p-5 sm:p-6 rounded-2xl bg-white border border-[#E4DCC9] shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E4DCC9] pb-3">
          <div className="flex items-center gap-2">
            <Cloud className="w-5 h-5 text-[#42BDAE]" />
            <div>
              <h2 className="text-base font-bold text-[#1B4D48]">
                8. Firebase Cloud Sync & JSON Portability
              </h2>
              <p className="text-xs text-[#4A6B66]">
                Preserves your authenticated account storage across sessions.
              </p>
            </div>
          </div>

          <span className="text-xs font-mono font-bold px-3 py-1 rounded-lg bg-[#FBF7EF] border border-[#E4DCC9] text-[#1B4D48]">
            {syncState === 'synced'
              ? `Synced ${lastSyncTime || ''}`
              : syncState === 'syncing'
              ? 'Syncing...'
              : 'Local Account Storage Active'}
          </span>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            {currentUser ? (
              <button
                onClick={logoutUser}
                className="px-4 py-2 rounded-xl bg-[#FBF7EF] hover:bg-[#F5EFE2] border border-[#E4DCC9] text-[#1B4D48] font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <LogOut className="w-4 h-4 text-[#42BDAE]" />
                Sign Out ({currentUser.email})
              </button>
            ) : (
              <button
                onClick={loginGoogle}
                className="px-4 py-2 rounded-xl bg-[#1B4D48] hover:bg-[#153E3A] text-white font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <LogIn className="w-4 h-4" />
                Sign In with Google
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={exportJSON}
              className="px-3.5 py-2 rounded-xl bg-[#FBF7EF] hover:bg-[#F5EFE2] border border-[#E4DCC9] text-[#1B4D48] font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-4 h-4 text-[#42BDAE]" />
              Export JSON
            </button>

            <label className="px-3.5 py-2 rounded-xl bg-[#FBF7EF] hover:bg-[#F5EFE2] border border-[#E4DCC9] text-[#1B4D48] font-semibold flex items-center gap-1.5 cursor-pointer">
              <Upload className="w-4 h-4 text-[#42BDAE]" />
              <span>Import JSON</span>
              <input
                type="file"
                accept=".json,application/json"
                onChange={handleFileImport}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {importStatus && (
          <div className="p-3 rounded-xl bg-[#75D9B4]/20 border border-[#42BDAE] text-[#1B4D48] text-xs font-medium">
            {importStatus}
          </div>
        )}
      </div>

      {/* Danger Zone */}
      <div className="p-5 rounded-2xl bg-rose-50/70 border border-rose-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-rose-800 flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-rose-600" />
            Reset Application Data
          </h3>
          <p className="text-xs text-rose-700/80 mt-0.5">
            Requires explicit confirmation before resetting local cache to factory defaults.
          </p>
        </div>

        {!confirmReset ? (
          <button
            onClick={() => setConfirmReset(true)}
            className="px-4 py-2 rounded-xl bg-white hover:bg-rose-100 text-rose-700 border border-rose-300 text-xs font-bold cursor-pointer"
          >
            Reset All Data...
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                resetAllData();
                setConfirmReset(false);
              }}
              className="px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold cursor-pointer"
            >
              Confirm Reset
            </button>
            <button
              onClick={() => setConfirmReset(false)}
              className="px-3 py-2 rounded-xl bg-white border border-rose-200 text-rose-800 text-xs cursor-pointer"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
