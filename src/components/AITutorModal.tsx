import React, { useState } from 'react';
import {
  Sparkles,
  X,
  HelpCircle,
  Loader2,
  AlertCircle,
  BookmarkPlus,
  CheckCircle2,
  GraduationCap,
} from 'lucide-react';
import { useApp } from '../context/AppContext.tsx';
import { AI_TUTOR_MODES } from '../utils/aiActionEngine.ts';
import { apiUrl } from '../utils/apiClient.ts';
import type { AITutorMode } from '../types/index.ts';

interface AITutorModalProps {
  initialTopic?: string;
  initialChapter?: string;
  initialSubject?: string;
  onClose: () => void;
}

export const AITutorModal: React.FC<AITutorModalProps> = ({
  initialTopic = '',
  initialChapter = '',
  initialSubject = 'Physics',
  onClose,
}) => {
  const { activeSyllabus, preferences, addResource, addPYQ } = useApp();

  const [mode, setMode] = useState<'explain' | 'quiz' | 'mistake'>('explain');
  const [tutorMode, setTutorMode] = useState<AITutorMode>(
    preferences.defaultTutorMode || 'concept_teacher'
  );
  const [subject, setSubject] = useState(initialSubject || 'Physics');
  const [chapter, setChapter] = useState(initialChapter || 'Electric Charges and Fields');
  const [topic, setTopic] = useState(initialTopic || "Gauss's Law & Applications");
  const [userQuery, setUserQuery] = useState('');
  const [studentAttempt, setStudentAttempt] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [providerLabel, setProviderLabel] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  const [explanationResult, setExplanationResult] = useState<string | null>(null);
  const [quizQuestions, setQuizQuestions] = useState<any[]>([]);
  const [diagnosisResult, setDiagnosisResult] = useState<string | null>(null);
  const [revealedAnswers, setRevealedAnswers] = useState<Record<number, boolean>>({});

  const activeProvider = preferences.aiProvider || 'auto';

  const handleExplain = async () => {
    if (!topic.trim()) {
      setError('Please provide a topic name to explain.');
      return;
    }
    setError(null);
    setSavedNotice(null);
    setLoading(true);
    setExplanationResult(null);

    try {
      const res = await fetch(apiUrl('/api/ai/explain'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topicTitle: topic,
          chapterTitle: chapter,
          subjectName: subject,
          userQuery,
          tutorMode,
          provider: activeProvider,
          openaiModel: preferences.openaiModel,
          geminiModel: preferences.geminiModel,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate explanation');
      }
      setExplanationResult(data.explanation);
      setProviderLabel(data.source || data.providerUsed || 'RBSE AI Tutor');
    } catch (err: any) {
      setError(err.message || 'An error occurred while contacting AI Tutor.');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateQuiz = async () => {
    if (!chapter.trim() && !topic.trim()) {
      setError('Please provide a chapter or topic name for the practice quiz.');
      return;
    }
    setError(null);
    setSavedNotice(null);
    setLoading(true);
    setQuizQuestions([]);
    setRevealedAnswers({});

    try {
      const res = await fetch(apiUrl('/api/ai/quiz'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chapterTitle: chapter || topic,
          subjectName: subject,
          topicTitle: topic,
          provider: activeProvider,
          openaiModel: preferences.openaiModel,
          geminiModel: preferences.geminiModel,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate quiz');
      }
      setQuizQuestions(data.questions || []);
      setProviderLabel(
        data.providerUsed === 'openai'
          ? `OpenAI (${data.modelUsed})`
          : data.providerUsed === 'gemini'
          ? `Google Gemini (${data.modelUsed})`
          : 'AZORA RBSE Board Practice Engine'
      );
    } catch (err: any) {
      setError(err.message || 'An error occurred while generating quiz.');
    } finally {
      setLoading(false);
    }
  };

  const handleDiagnoseMistake = async () => {
    if (!userQuery.trim()) {
      setError('Please describe the error or problem where you made a mistake.');
      return;
    }
    setError(null);
    setSavedNotice(null);
    setLoading(true);
    setDiagnosisResult(null);

    try {
      const res = await fetch(apiUrl('/api/ai/analyze-mistake'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject,
          chapter,
          mistakeDescription: userQuery,
          studentAttempt,
          provider: activeProvider,
          openaiModel: preferences.openaiModel,
          geminiModel: preferences.geminiModel,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to analyze mistake');
      }
      setDiagnosisResult(data.diagnosis);
      setProviderLabel(
        data.providerUsed === 'openai'
          ? `OpenAI (${data.modelUsed})`
          : data.providerUsed === 'gemini'
          ? `Google Gemini (${data.modelUsed})`
          : 'AZORA RBSE Diagnostic Engine'
      );
    } catch (err: any) {
      setError(err.message || 'An error occurred while analyzing mistake.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveExplanationToNotes = () => {
    if (!explanationResult) return;
    addResource({
      subjectId: subject.toLowerCase().includes('chem')
        ? 'chemistry'
        : subject.toLowerCase().includes('math')
        ? 'mathematics'
        : 'physics',
      chapterId: 'ch-ai-saved',
      type: 'note',
      title: `AI Tutor (${tutorMode.replace(/_/g, ' ')}): ${topic}`,
      content: explanationResult,
    });
    setSavedNotice('Saved explanation to your Subject Formula & Note Bank!');
  };

  const handleSaveQuizToBank = (q: any) => {
    addPYQ({
      subjectId: subject.toLowerCase().includes('chem')
        ? 'chemistry'
        : subject.toLowerCase().includes('math')
        ? 'mathematics'
        : 'physics',
      subjectName: subject,
      chapterId: 'ch-ai-practice',
      chapterTitle: chapter || 'Practice Chapter',
      topicTitle: topic || undefined,
      questionText: q.question,
      marks: Number(q.marks) || 2,
      examYear: '2027-28 Practice',
      examName: 'RBSE AI Practice Set',
      questionType: q.marks >= 4 ? 'Derivation' : q.marks === 2 ? 'Short Answer' : 'Conceptual',
      source: 'AI Tutor Practice Generator',
      verificationStatus: 'ai_practice',
      attemptStatus: 'unattempted',
      solution: `${q.modelAnswer}${q.boardTip ? `\nBoard Tip: ${q.boardTip}` : ''}`,
    });
    setSavedNotice(`Saved "${q.question.slice(0, 40)}..." to your Practice Question Bank!`);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ai-tutor-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#1B4D48]/50 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto"
    >
      <div className="w-full max-w-2xl bg-[#FBF7EF] rounded-3xl shadow-2xl border border-[#E4DCC9] my-auto overflow-hidden max-h-[92vh] flex flex-col text-[#1B4D48]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#E4DCC9] flex items-center justify-between bg-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#1B4D48] text-white flex items-center justify-center shadow-sm">
              <GraduationCap className="w-5 h-5 text-[#75D9B4]" />
            </div>
            <div>
              <h2
                id="ai-tutor-modal-title"
                className="text-base sm:text-lg font-bold text-[#1B4D48] flex items-center gap-2"
              >
                RBSE Class 12 AI Tutor & Practice Engine
              </h2>
              <p className="text-xs text-[#4A6B66]">
                Multi-provider (OpenAI / Gemini / RBSE Engine) · Session {activeSyllabus.academicSession || '2026–27'} Syllabus Grounded
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close AI Tutor"
            className="p-2 rounded-xl text-[#4A6B66] hover:text-[#1B4D48] hover:bg-[#F5EFE2] transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Tabs */}
        <div className="flex border-b border-[#E4DCC9] bg-[#F5EFE2] p-1.5 gap-1">
          <button
            onClick={() => setMode('explain')}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition cursor-pointer ${
              mode === 'explain'
                ? 'bg-[#1B4D48] text-white shadow-xs'
                : 'text-[#4A6B66] hover:text-[#1B4D48]'
            }`}
          >
            Explain Concept / Derivation
          </button>
          <button
            onClick={() => setMode('quiz')}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition cursor-pointer ${
              mode === 'quiz'
                ? 'bg-[#1B4D48] text-white shadow-xs'
                : 'text-[#4A6B66] hover:text-[#1B4D48]'
            }`}
          >
            Generate Board Quiz (1/2/4M)
          </button>
          <button
            onClick={() => setMode('mistake')}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition cursor-pointer ${
              mode === 'mistake'
                ? 'bg-[#1B4D48] text-white shadow-xs'
                : 'text-[#4A6B66] hover:text-[#1B4D48]'
            }`}
          >
            Diagnose Mistake
          </button>
        </div>

        {/* Body Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 text-xs">
          {/* Input fields */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div>
              <label className="font-bold text-[#1B4D48]">Subject</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Physics / Chemistry / Math"
                className="mt-1 w-full px-3 py-2 rounded-xl border border-[#E4DCC9] bg-white text-[#1B4D48] font-medium"
              />
            </div>
            <div>
              <label className="font-bold text-[#1B4D48]">Chapter</label>
              <input
                type="text"
                value={chapter}
                onChange={(e) => setChapter(e.target.value)}
                placeholder="e.g. Electric Charges"
                className="mt-1 w-full px-3 py-2 rounded-xl border border-[#E4DCC9] bg-white text-[#1B4D48] font-medium"
              />
            </div>
            <div>
              <label className="font-bold text-[#1B4D48]">Topic</label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. Gauss's Law"
                className="mt-1 w-full px-3 py-2 rounded-xl border border-[#E4DCC9] bg-white text-[#1B4D48] font-medium"
              />
            </div>
          </div>

          {mode === 'explain' && (
            <div className="space-y-3">
              {/* 7 Specialized RBSE Tutor Modes */}
              <div>
                <label className="font-bold text-[#1B4D48] block mb-1.5">
                  Select Pedagogical Tutor Mode:
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {AI_TUTOR_MODES.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setTutorMode(m.id)}
                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition cursor-pointer ${
                        tutorMode === m.id
                          ? 'bg-[#42BDAE] text-white border-[#42BDAE]'
                          : 'bg-white text-[#1B4D48] border-[#E4DCC9] hover:bg-[#F5EFE2]'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="font-bold text-[#1B4D48]">
                  Specific question, numerical, or derivation focus (Optional)
                </label>
                <textarea
                  rows={2}
                  value={userQuery}
                  onChange={(e) => setUserQuery(e.target.value)}
                  placeholder="e.g., Derive electric field due to an infinite line charge using Gauss's Law with RBSE marking steps..."
                  className="mt-1 w-full p-2.5 rounded-xl border border-[#E4DCC9] bg-white text-[#1B4D48]"
                />
                <button
                  onClick={handleExplain}
                  disabled={loading}
                  className="mt-2.5 w-full py-2.5 rounded-xl bg-[#1B4D48] hover:bg-[#153E3A] text-white font-bold flex items-center justify-center gap-2 transition disabled:opacity-50 cursor-pointer"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4 text-[#75D9B4]" />
                  )}
                  Generate RBSE Explanation ({AI_TUTOR_MODES.find((m) => m.id === tutorMode)?.shortLabel})
                </button>
              </div>
            </div>
          )}

          {mode === 'quiz' && (
            <div>
              <p className="text-[#4A6B66] mb-2.5">
                Generates 3 board-formatted practice questions (1-mark conceptual, 2-mark reasoning/numerical, 4-mark derivation) with step-by-step RBSE marking scheme solutions.
              </p>
              <button
                onClick={handleGenerateQuiz}
                disabled={loading}
                className="w-full py-2.5 rounded-xl bg-[#1B4D48] hover:bg-[#153E3A] text-white font-bold flex items-center justify-center gap-2 transition disabled:opacity-50 cursor-pointer"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <HelpCircle className="w-4 h-4 text-[#75D9B4]" />
                )}
                Generate 3 Board Practice Questions
              </button>
            </div>
          )}

          {mode === 'mistake' && (
            <div className="space-y-3">
              <div>
                <label className="font-bold text-[#1B4D48]">
                  What question or calculation went wrong?
                </label>
                <textarea
                  rows={2}
                  value={userQuery}
                  onChange={(e) => setUserQuery(e.target.value)}
                  placeholder="e.g. Lost 2 marks on calculating EMF from Nernst equation because of log concentration sign..."
                  className="mt-1 w-full p-2.5 rounded-xl border border-[#E4DCC9] bg-white text-[#1B4D48]"
                />
              </div>
              <div>
                <label className="font-bold text-[#1B4D48]">
                  Your attempt or thoughts (Optional)
                </label>
                <input
                  type="text"
                  value={studentAttempt}
                  onChange={(e) => setStudentAttempt(e.target.value)}
                  placeholder="e.g. I put anode concentration in denominator instead of numerator"
                  className="mt-1 w-full p-2.5 rounded-xl border border-[#E4DCC9] bg-white text-[#1B4D48]"
                />
              </div>
              <button
                onClick={handleDiagnoseMistake}
                disabled={loading}
                className="w-full py-2.5 rounded-xl bg-[#E06D53] hover:bg-[#c95b42] text-white font-bold flex items-center justify-center gap-2 transition disabled:opacity-50 cursor-pointer"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <AlertCircle className="w-4 h-4" />
                )}
                Diagnose Conceptual Root Cause
              </button>
            </div>
          )}

          {/* Saved Notice */}
          {savedNotice && (
            <div className="p-3 rounded-xl bg-[#75D9B4]/25 border border-[#42BDAE] text-[#1B4D48] font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#1B4D48] shrink-0" />
              <span>{savedNotice}</span>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Results Display */}
          {explanationResult && (
            <div className="p-4 rounded-2xl bg-white border border-[#E4DCC9] space-y-3 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E4DCC9] pb-2.5">
                <div>
                  <span className="font-bold text-[#1B4D48] text-sm">
                    {topic} — {AI_TUTOR_MODES.find((m) => m.id === tutorMode)?.label}
                  </span>
                  {providerLabel && (
                    <span className="block text-[10px] text-[#4A6B66] mt-0.5">
                      Source: {providerLabel}
                    </span>
                  )}
                </div>
                <button
                  onClick={handleSaveExplanationToNotes}
                  className="px-3 py-1.5 rounded-xl bg-[#75D9B4]/30 hover:bg-[#75D9B4]/50 text-[#1B4D48] font-bold text-[11px] flex items-center gap-1.5 transition cursor-pointer"
                >
                  <BookmarkPlus className="w-3.5 h-3.5" />
                  Save to Formula/Note Bank
                </button>
              </div>
              <div className="text-xs leading-relaxed whitespace-pre-line text-[#1B4D48]">
                {explanationResult}
              </div>
            </div>
          )}

          {quizQuestions.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[#1B4D48] text-sm">
                  Generated RBSE Board Practice Questions
                </span>
                {providerLabel && (
                  <span className="text-[10px] text-[#4A6B66]">{providerLabel}</span>
                )}
              </div>
              {quizQuestions.map((q, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-2xl bg-white border border-[#E4DCC9] space-y-2.5 shadow-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-[#1B4D48] px-2.5 py-0.5 rounded-lg bg-[#75D9B4]/30">
                      Q{idx + 1} ({q.marks} Mark{q.marks > 1 ? 's' : ''})
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleSaveQuizToBank(q)}
                        className="text-[11px] text-[#4A6B66] hover:text-[#1B4D48] font-semibold flex items-center gap-1 cursor-pointer"
                      >
                        <BookmarkPlus className="w-3.5 h-3.5" />
                        Save to Bank
                      </button>
                      <button
                        onClick={() =>
                          setRevealedAnswers((prev) => ({ ...prev, [idx]: !prev[idx] }))
                        }
                        className="text-xs text-[#42BDAE] hover:underline font-bold cursor-pointer"
                      >
                        {revealedAnswers[idx] ? 'Hide Answer' : 'Show Model Answer'}
                      </button>
                    </div>
                  </div>
                  <div className="font-semibold text-[#1B4D48] text-xs leading-relaxed">
                    {q.question}
                  </div>
                  {revealedAnswers[idx] && (
                    <div className="p-3 rounded-xl bg-[#FBF7EF] border border-[#E4DCC9] text-[#1B4D48] space-y-1.5">
                      <div className="font-bold text-[11px] text-[#42BDAE]">
                        Step-by-Step Marking Scheme Answer:
                      </div>
                      <div className="whitespace-pre-line">{q.modelAnswer}</div>
                      {q.boardTip && (
                        <div className="text-[11px] text-[#4A6B66] pt-1 italic">
                          Board Exam Tip: {q.boardTip}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {diagnosisResult && (
            <div className="p-4 rounded-2xl bg-white border border-[#E4DCC9] text-[#1B4D48] space-y-2 shadow-xs">
              <div className="flex items-center justify-between border-b border-[#E4DCC9] pb-2">
                <span className="font-bold text-sm text-[#1B4D48]">
                  Conceptual Diagnosis & Board Rule of Thumb
                </span>
                {providerLabel && (
                  <span className="text-[10px] text-[#4A6B66]">{providerLabel}</span>
                )}
              </div>
              <div className="whitespace-pre-line text-xs leading-relaxed">{diagnosisResult}</div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 sm:p-4 border-t border-[#E4DCC9] bg-white flex items-center justify-between text-[11px] text-[#4A6B66]">
          <span>Grounded in RBSE Class 12 Session {activeSyllabus.academicSession || '2026–27'} Curriculum</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-[#F5EFE2] hover:bg-[#E4DCC9] text-[#1B4D48] font-bold transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
