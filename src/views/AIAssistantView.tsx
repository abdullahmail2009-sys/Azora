import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext.tsx';
import { processAIInstruction, AI_TUTOR_MODES } from '../utils/aiActionEngine.ts';
import { apiUrl } from '../utils/apiClient.ts';
import type { AIActionProposal, AIChatMessage, AITutorMode, AIProviderType } from '../types/index.ts';
import {
  Sparkles,
  Send,
  CheckCircle2,
  Play,
  Trash2,
  BookmarkCheck,
  Plus,
  Layers,
  ExternalLink,
  GraduationCap,
  Cpu,
  Loader2,
} from 'lucide-react';

interface AIAssistantViewProps {
  setActiveTab: (tab: string) => void;
  onSelectTopic: (topicId: string) => void;
}

export const AIAssistantView: React.FC<AIAssistantViewProps> = ({
  setActiveTab,
  onSelectTopic,
}) => {
  const {
    activeSyllabus,
    masteryMap,
    studyTasks,
    revisionTasks,
    pyqs,
    resources,
    preferences,
    updatePreferences,
    aiPersistentRules,
    aiChatHistory,
    addAIChatMessage,
    clearAIChatHistory,
    addAIPersistentRule,
    toggleAIPersistentRule,
    deleteAIPersistentRule,
    executeAIAction,
  } = useApp();

  const [inputPrompt, setInputPrompt] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTutorMode, setActiveTutorMode] = useState<AITutorMode>(
    preferences.defaultTutorMode || 'concept_teacher'
  );
  const [newRuleText, setNewRuleText] = useState('');
  const [newRuleCategory, setNewRuleCategory] = useState<
    'prioritization' | 'backlog' | 'planner' | 'dashboard' | 'completion' | 'general'
  >('general');
  const [executedActionStatus, setExecutedActionStatus] = useState<Record<string, string>>({});
  const [providerStatus, setProviderStatus] = useState<{
    openaiConfigured: boolean;
    geminiConfigured: boolean;
    defaultOpenaiModel: string;
    defaultGeminiModel: string;
  }>({
    openaiConfigured: false,
    geminiConfigured: false,
    defaultOpenaiModel: 'gpt-4o-mini',
    defaultGeminiModel: 'gemini-3.8-flash',
  });

  useEffect(() => {
    let mounted = true;
    fetch(apiUrl('/api/ai/status'))
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (mounted && data) {
          setProviderStatus({
            openaiConfigured: Boolean(data.openaiConfigured),
            geminiConfigured: Boolean(data.geminiConfigured),
            defaultOpenaiModel: data.defaultOpenaiModel || 'gpt-4o-mini',
            defaultGeminiModel: data.defaultGeminiModel || 'gemini-3.8-flash',
          });
        }
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  const quickCommands = [
    "Explain Gauss's Law with RBSE board marking scheme.",
    'Derive Electric Field on the axial line of an Electric Dipole.',
    'Explain Nernst Equation and solve a standard numerical.',
    'Show my Physics backlog.',
    'Show every unfinished topic in Electric Charges and Fields.',
    'Give me all high-priority Chemistry topics that I have not studied.',
    'Create a 7-day plan using my available study hours.',
    'Prioritize all topics using my uploaded PYQs.',
    'Mark Electric Field Lines & Electric Dipole as completed.',
    'Move Electric Field Lines & Electric Dipole to tomorrow.',
    'Change my revision interval to 7 days.',
    'Always rank my topics using uploaded PYQs.',
  ];

  const handleSendMessage = async (textOverride?: string) => {
    const prompt = (textOverride ?? inputPrompt).trim();
    if (!prompt || isProcessing) return;

    if (!textOverride) setInputPrompt('');
    setIsProcessing(true);

    const userMsg: AIChatMessage = {
      id: `msg-u-${Date.now()}`,
      role: 'user',
      content: prompt,
      timestamp: new Date().toISOString(),
    };
    addAIChatMessage(userMsg);

    try {
      // 1. Evaluate instruction against real application data & RBSE academic knowledge
      const parsed = processAIInstruction(
        prompt,
        {
          subjects: activeSyllabus.subjects,
          masteryMap,
          studyTasks,
          revisionTasks,
          pyqs,
          preferences,
          resources,
        },
        new Date().toISOString().split('T')[0],
        activeTutorMode
      );

      // 2. Auto-execute safe single-step actions immediately and record verification
      const autoResults: string[] = [];
      const updatedActions: AIActionProposal[] = parsed.actions.map((act) => {
        if (!act.requiresConfirmation && act.type !== 'NAVIGATE_FILTER') {
          const verification = executeAIAction(act, setActiveTab);
          autoResults.push(verification);
          setExecutedActionStatus((prev) => ({ ...prev, [act.id]: verification }));
          return { ...act, executed: true };
        }
        return act;
      });

      let finalReply = parsed.reply;
      let providerUsedLabel = 'AZORA Local RBSE Engine';

      if (autoResults.length > 0) {
        finalReply = `${parsed.reply}\n\n${autoResults.join('\n')}`;
      }

      // 3. Call server-side unified AI endpoint (OpenAI / Gemini) unless user forced local-only
      const selectedProvider = preferences.aiProvider || 'auto';
      if (!preferences.aiStrictLocalOnly && selectedProvider !== 'local') {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 28000);
        try {
          const recentHistory = [...aiChatHistory.slice(-6), userMsg].map((m) => ({
            role: m.role,
            content: m.content,
          }));
          const res = await fetch(apiUrl('/api/ai/chat'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({
              userPrompt: prompt,
              messages: recentHistory,
              localAnalysisReply: finalReply,
              tutorMode: parsed.tutorMode || activeTutorMode,
              provider: selectedProvider,
              openaiModel: preferences.openaiModel,
              geminiModel: preferences.geminiModel,
              enableSearchGrounding: Boolean(preferences.enableSearchGrounding),
              stream: false,
              contextSummary:
                parsed.selectiveContext ||
                `Subjects: ${activeSyllabus.subjects.map((s) => s.name).join(', ')}. Daily study hours: ${preferences.dailyStudyHoursLimit}h.`,
            }),
          });
          if (res.ok) {
            const data = await res.json();
            if (data.reply && data.liveApiConnected) {
              finalReply = `${data.reply}${
                autoResults.length > 0 ? `\n\n${autoResults.join('\n')}` : ''
              }`;
              providerUsedLabel =
                data.providerUsed === 'openai'
                  ? `OpenAI (${data.modelUsed})`
                  : `Google Gemini (${data.modelUsed})`;
            } else if (data.diagnostics && (selectedProvider === 'openai' || selectedProvider === 'gemini')) {
              providerUsedLabel = 'AZORA Local RBSE Engine (Cloud Fallback)';
            }
          } else {
            providerUsedLabel = 'AZORA Local RBSE Engine (Offline Fallback)';
          }
        } catch (err: any) {
          providerUsedLabel =
            err?.name === 'AbortError'
              ? 'AZORA Local RBSE Engine (Timeout Fallback)'
              : 'AZORA Local RBSE Engine (Offline Fallback)';
        } finally {
          clearTimeout(timeoutId);
        }
      }

      const assistantMsg: AIChatMessage = {
        id: `msg-a-${Date.now() + 1}`,
        role: 'assistant',
        content: finalReply,
        timestamp: new Date().toISOString(),
        providerUsed: providerUsedLabel,
        tutorMode: parsed.tutorMode || activeTutorMode,
        actions: updatedActions,
        matchedTopics: parsed.matchedTopics,
      };

      addAIChatMessage(assistantMsg);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExecuteActionButton = (action: AIActionProposal) => {
    const verification = executeAIAction(action, setActiveTab);
    setExecutedActionStatus((prev) => ({
      ...prev,
      [action.id]: verification,
    }));
  };

  const handleAddRuleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRuleText.trim()) return;
    addAIPersistentRule(newRuleText.trim(), newRuleCategory);
    setNewRuleText('');
  };

  const currentProvider: AIProviderType = preferences.aiProvider || 'auto';

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="p-5 sm:p-6 rounded-2xl bg-white border border-[#E4DCC9] shadow-xs flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-[#42BDAE] uppercase tracking-wider mb-1">
            <GraduationCap className="w-4 h-4" />
            <span>RBSE Class 12 AI Tutor & Live Action Center</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#1B4D48]">
            AI Study Assistant, Concept Tutor & Planner Automation
          </h1>
          <p className="text-xs text-[#4A6B66] mt-1 max-w-2xl">
            Ask conceptual doubts, step-by-step derivations, numerical problems, or execute live commands on your syllabus, PYQ intelligence rankings, backlog, and study planner.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Gemini Model Selector */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FBF7EF] border border-[#E4DCC9] text-xs">
            <Cpu className="w-3.5 h-3.5 text-[#42BDAE]" />
            <span className="font-semibold text-[#4A6B66]">Gemini Model:</span>
            <select
              aria-label="Select Gemini Model"
              value={preferences.geminiModel || 'gemini-3.8-flash'}
              onChange={(e) => updatePreferences({ geminiModel: e.target.value })}
              className="bg-transparent font-bold text-[#1B4D48] focus:outline-none cursor-pointer"
            >
              <option value="gemini-3.8-flash">gemini-3.8-flash (General Tasks & Search)</option>
              <option value="gemini-4-argon">gemini-4-argon (Complex Reasoning & Math)</option>
              <option value="gemini-3.1-flash-lite">gemini-3.1-flash-lite (Fast Tasks)</option>
            </select>
          </div>

          {/* Search Grounding Toggle */}
          <button
            onClick={() => updatePreferences({ enableSearchGrounding: !preferences.enableSearchGrounding })}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition cursor-pointer ${
              preferences.enableSearchGrounding
                ? 'bg-[#1B4D48] text-[#75D9B4] border-[#1B4D48]'
                : 'bg-[#FBF7EF] text-[#4A6B66] border-[#E4DCC9] hover:bg-[#F5EFE2]'
            }`}
            title="Enable Google Search Grounding for real-time web information"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#75D9B4]" />
            <span>Search Grounding: {preferences.enableSearchGrounding ? 'ON' : 'OFF'}</span>
          </button>

          {/* Clear History */}
          <button
            onClick={clearAIChatHistory}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#F5EFE2] hover:bg-[#E4DCC9] text-[#1B4D48] border border-[#E4DCC9] text-xs font-semibold transition cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5 text-[#E06D53]" />
            <span>Clear Chat History</span>
          </button>
        </div>
      </div>

      {/* 7 Specialized RBSE Tutor Mode Pills */}
      <div className="p-4 rounded-2xl bg-white border border-[#E4DCC9] shadow-xs space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-bold text-[#1B4D48] flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[#42BDAE]" />
            Active Pedagogical Tutor Mode:
          </span>
          <span className="text-[11px] text-[#4A6B66]">
            {AI_TUTOR_MODES.find((m) => m.id === activeTutorMode)?.description}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {AI_TUTOR_MODES.map((m) => (
            <button
              key={m.id}
              onClick={() => {
                setActiveTutorMode(m.id);
                updatePreferences({ defaultTutorMode: m.id });
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                activeTutorMode === m.id
                  ? 'bg-[#1B4D48] text-white border-[#1B4D48] shadow-xs'
                  : 'bg-[#FBF7EF] text-[#1B4D48] border-[#E4DCC9] hover:bg-[#F5EFE2]'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left/Main Column: Chat & Action Execution (8 cols) */}
        <div className="lg:col-span-8 flex flex-col rounded-2xl bg-white border border-[#E4DCC9] shadow-xs overflow-hidden">
          {/* Quick Command Prompts */}
          <div className="p-4 bg-[#FBF7EF] border-b border-[#E4DCC9]">
            <div className="text-xs font-bold text-[#1B4D48] mb-2">
              Quick Academic & Action Prompts (click to execute):
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {quickCommands.map((cmd, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendMessage(cmd)}
                  disabled={isProcessing}
                  className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-[#75D9B4]/25 text-[#1B4D48] border border-[#E4DCC9] hover:border-[#42BDAE] text-xs font-medium text-left transition cursor-pointer disabled:opacity-50"
                >
                  {cmd}
                </button>
              ))}
            </div>
          </div>

          {/* Conversation Messages */}
          <div className="p-5 space-y-4 max-h-[560px] overflow-y-auto bg-white">
            {aiChatHistory.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${
                  msg.role === 'user' ? 'items-end' : 'items-start'
                }`}
              >
                <div
                  className={`max-w-2xl rounded-2xl p-4 text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-[#1B4D48] text-white'
                      : 'bg-[#FBF7EF] border border-[#E4DCC9] text-[#1B4D48]'
                  }`}
                >
                  {msg.role === 'assistant' && msg.providerUsed && (
                    <div className="flex items-center justify-between gap-2 mb-2 pb-1.5 border-b border-[#E4DCC9] text-[10px] font-semibold text-[#4A6B66]">
                      <span>
                        {AI_TUTOR_MODES.find((m) => m.id === msg.tutorMode)?.label ||
                          'AZORA Study Assistant'}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-white border border-[#E4DCC9] text-[#1B4D48]">
                        {msg.providerUsed}
                      </span>
                    </div>
                  )}

                  <div className="whitespace-pre-line text-xs sm:text-sm leading-relaxed">
                    {msg.content.replace(/\*\*/g, '').replace(/\*"([^"]+)"\*/g, '"$1"')}
                  </div>

                  {/* Matched Topics Table / List */}
                  {msg.matchedTopics && msg.matchedTopics.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-[#E4DCC9] space-y-2">
                      <div className="text-xs font-bold text-[#1B4D48]">
                        Matched Syllabus Topics ({msg.matchedTopics.length}):
                      </div>
                      <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                        {msg.matchedTopics.map((t) => (
                          <div
                            key={t.topicId}
                            className="p-2.5 rounded-xl bg-white border border-[#E4DCC9] flex items-center justify-between gap-3"
                          >
                            <div>
                              <button
                                onClick={() => onSelectTopic(t.topicId)}
                                className="text-xs font-bold text-[#1B4D48] hover:text-[#42BDAE] text-left transition cursor-pointer"
                              >
                                {t.topicTitle}
                              </button>
                              <div className="text-[11px] text-[#4A6B66] tabular-nums">
                                {t.subjectName} · {t.chapterTitle} · Status: {t.status} ·{' '}
                                {t.priority}
                              </div>
                            </div>
                            <button
                              onClick={() => onSelectTopic(t.topicId)}
                              className="px-2.5 py-1 rounded-lg bg-[#F5EFE2] hover:bg-[#75D9B4]/40 text-[#1B4D48] text-[11px] font-bold shrink-0 transition cursor-pointer"
                            >
                              Inspect
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Action Proposals / Executed Actions */}
                  {msg.actions && msg.actions.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-[#E4DCC9] space-y-2">
                      {msg.actions.map((act) => {
                        const statusText = executedActionStatus[act.id];
                        const isExecuted = Boolean(act.executed || statusText);
                        return (
                          <div
                            key={act.id}
                            className="p-3 rounded-xl bg-white border border-[#E4DCC9] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                          >
                            <div>
                              <div className="text-xs font-bold text-[#1B4D48] flex items-center gap-1.5">
                                {isExecuted ? (
                                  <CheckCircle2 className="w-4 h-4 text-[#42BDAE] shrink-0" />
                                ) : (
                                  <Sparkles className="w-4 h-4 text-[#42BDAE] shrink-0" />
                                )}
                                <span>{act.title}</span>
                              </div>
                              <div className="text-xs text-[#4A6B66] mt-0.5">
                                {statusText || act.description}
                              </div>
                            </div>

                            {act.type === 'NAVIGATE_FILTER' ? (
                              <button
                                onClick={() => handleExecuteActionButton(act)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1B4D48] hover:bg-[#153E3A] text-white text-xs font-bold shrink-0 transition cursor-pointer"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                                <span>Open Filtered View</span>
                              </button>
                            ) : !isExecuted ? (
                              <button
                                onClick={() => handleExecuteActionButton(act)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#42BDAE] hover:bg-[#359e91] text-white text-xs font-bold shrink-0 transition cursor-pointer"
                              >
                                <Play className="w-3.5 h-3.5" />
                                <span>Confirm & Execute</span>
                              </button>
                            ) : (
                              <span className="text-xs font-bold text-[#42BDAE] shrink-0">
                                Saved & Verified
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Input Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="p-4 bg-[#FBF7EF] border-t border-[#E4DCC9] flex items-center gap-3"
          >
            <input
              type="text"
              value={inputPrompt}
              onChange={(e) => setInputPrompt(e.target.value)}
              placeholder="Ask any Class 12 concept, derivation, numerical, or study command..."
              aria-label="Instruction for AI Assistant"
              className="flex-1 px-4 py-3 rounded-xl bg-white border border-[#E4DCC9] text-sm text-[#1B4D48] placeholder:text-[#4A6B66]/70 focus:outline-none focus:border-[#42BDAE]"
            />
            <button
              type="submit"
              disabled={!inputPrompt.trim() || isProcessing}
              aria-label="Send instruction"
              className="flex items-center gap-2 px-5 py-3 rounded-xl bg-[#1B4D48] hover:bg-[#153E3A] disabled:opacity-50 text-white text-xs font-bold transition cursor-pointer"
            >
              {isProcessing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              <span>{isProcessing ? 'Thinking...' : 'Ask / Execute'}</span>
            </button>
          </form>
        </div>

        {/* Right Column: Persistent Personal Instructions & Rules (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="p-5 rounded-2xl bg-white border border-[#E4DCC9] shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BookmarkCheck className="w-5 h-5 text-[#42BDAE]" />
                <h2 className="text-base font-bold text-[#1B4D48]">
                  Persistent AI Preferences
                </h2>
              </div>
              <span className="text-xs font-bold text-[#4A6B66] tabular-nums">
                {aiPersistentRules.filter((r) => r.active).length} active
              </span>
            </div>

            <p className="text-xs text-[#4A6B66] leading-relaxed">
              Standing instructions saved here apply across your Home screen, Backlog, PYQ rankings, and Study Planner.
            </p>

            {/* Add New Persistent Preference */}
            <form onSubmit={handleAddRuleSubmit} className="space-y-2.5 pt-1">
              <input
                type="text"
                value={newRuleText}
                onChange={(e) => setNewRuleText(e.target.value)}
                placeholder='e.g., "Always rank my topics using uploaded PYQs"'
                aria-label="New persistent preference instruction"
                className="w-full px-3 py-2 rounded-xl bg-[#FBF7EF] border border-[#E4DCC9] text-xs text-[#1B4D48] placeholder:text-[#4A6B66]/70 focus:outline-none focus:border-[#42BDAE]"
              />
              <div className="flex items-center gap-2">
                <select
                  aria-label="Preference category"
                  value={newRuleCategory}
                  onChange={(e) => setNewRuleCategory(e.target.value as any)}
                  className="flex-1 px-3 py-2 rounded-xl bg-[#FBF7EF] border border-[#E4DCC9] text-xs text-[#1B4D48] font-medium"
                >
                  <option value="prioritization">Topic Prioritization</option>
                  <option value="backlog">Backlog Display</option>
                  <option value="planner">Study Planner</option>
                  <option value="dashboard">Home Dashboard</option>
                  <option value="completion">Completion Rules</option>
                  <option value="general">General</option>
                </select>
                <button
                  type="submit"
                  className="flex items-center gap-1 px-3.5 py-2 rounded-xl bg-[#1B4D48] hover:bg-[#153E3A] text-white text-xs font-bold transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Save Rule</span>
                </button>
              </div>
            </form>

            {/* Saved Rules List */}
            <div className="space-y-2.5 pt-2">
              {aiPersistentRules.map((rule) => (
                <div
                  key={rule.id}
                  className="p-3 rounded-xl bg-[#FBF7EF] border border-[#E4DCC9] flex items-start justify-between gap-3"
                >
                  <label className="flex items-start gap-2.5 text-xs text-[#1B4D48] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={rule.active}
                      onChange={() => toggleAIPersistentRule(rule.id)}
                      className="mt-0.5 rounded border-[#E4DCC9] accent-[#1B4D48]"
                    />
                    <div>
                      <div
                        className={
                          rule.active ? 'font-semibold text-[#1B4D48]' : 'line-through text-[#4A6B66]'
                        }
                      >
                        {rule.instruction}
                      </div>
                      <div className="text-[11px] text-[#4A6B66] mt-0.5">
                        Scope: {rule.category}
                      </div>
                    </div>
                  </label>
                  <button
                    onClick={() => deleteAIPersistentRule(rule.id)}
                    aria-label={`Delete rule ${rule.instruction}`}
                    className="p-1 text-[#4A6B66] hover:text-[#E06D53] transition cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Direct Navigation Shortcuts */}
          <div className="p-4 rounded-2xl bg-white border border-[#E4DCC9] shadow-xs space-y-2.5">
            <div className="text-xs font-bold text-[#1B4D48]">
              Inspect Updated App Data
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setActiveTab('backlog')}
                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-[#FBF7EF] hover:bg-[#F5EFE2] border border-[#E4DCC9] text-xs font-bold text-[#1B4D48] transition cursor-pointer"
              >
                <Layers className="w-3.5 h-3.5 text-[#42BDAE]" />
                <span>Open Backlog</span>
              </button>
              <button
                onClick={() => setActiveTab('planner')}
                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-[#FBF7EF] hover:bg-[#F5EFE2] border border-[#E4DCC9] text-xs font-bold text-[#1B4D48] transition cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-[#42BDAE]" />
                <span>Open Planner</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
