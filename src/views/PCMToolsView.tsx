import React, { useState } from 'react';
import { useApp } from '../context/AppContext.tsx';
import { SubjectResource } from '../types/index.ts';
import {
  Wrench,
  Atom,
  FlaskConical,
  Calculator,
  Plus,
  Trash2,
  BookOpen,
  AlertOctagon,
  Sparkles,
  Search,
} from 'lucide-react';

interface PCMToolsViewProps {
  onOpenAITutorForMistake: (mistakeText: string) => void;
}

export const PCMToolsView: React.FC<PCMToolsViewProps> = ({ onOpenAITutorForMistake }) => {
  const { resources, addResource, deleteResource, activeSyllabus } = useApp();

  const [activeTab, setActiveTab] = useState<'physics' | 'chemistry' | 'math' | 'mistakes'>('physics');
  const [searchQuery, setSearchQuery] = useState('');

  const [showAddModal, setShowAddModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newType, setNewType] = useState<SubjectResource['type']>('formula');
  const [newChapterId, setNewChapterId] = useState('');
  const [newReagents, setNewReagents] = useState('');
  const [newConditions, setNewConditions] = useState('');
  const [newWhyMade, setNewWhyMade] = useState('');

  const filteredResources = resources.filter((res) => {
    if (activeTab === 'mistakes') {
      if (res.type !== 'mistake') return false;
    } else {
      if (res.subjectId !== activeTab) return false;
      if (res.type === 'mistake') return false;
    }

    if (
      searchQuery &&
      !res.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !res.content.toLowerCase().includes(searchQuery.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  const handleCreateResource = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    addResource({
      subjectId: activeTab === 'mistakes' ? 'physics' : activeTab,
      chapterId: newChapterId || 'ch-gen',
      type: activeTab === 'mistakes' ? 'mistake' : newType,
      title: newTitle,
      content: newContent,
      reactionDetails:
        activeTab === 'chemistry' && newType === 'reaction'
          ? {
              type: 'organic',
              reagents: newReagents,
              conditions: newConditions,
            }
          : undefined,
      mistakeDetails:
        activeTab === 'mistakes'
          ? {
              incorrectAttempt: newContent,
              correctConcept: newTitle,
              whyMade: newWhyMade,
            }
          : undefined,
    });

    setShowAddModal(false);
    setNewTitle('');
    setNewContent('');
    setNewReagents('');
    setNewConditions('');
    setNewWhyMade('');
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Wrench className="w-6 h-6 text-blue-600" />
            Physics, Chemistry & Math Tools
          </h1>
          <p className="text-xs text-slate-500 mt-1 max-w-xl">
            Formula notebooks with SI units and dimensions, derivation guides, named chemical reactions with reagents, exercise trackers, and chapter-linked mistake notebook.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-blue-500/20 transition active:scale-95 flex-shrink-0"
        >
          <Plus className="w-4 h-4" />
          Add Item
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3 overflow-x-auto">
        <button
          onClick={() => setActiveTab('physics')}
          className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-bold transition whitespace-nowrap ${
            activeTab === 'physics'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800'
          }`}
        >
          <Atom className="w-4 h-4" />
          Physics Formulas & Derivations
        </button>

        <button
          onClick={() => setActiveTab('chemistry')}
          className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-bold transition whitespace-nowrap ${
            activeTab === 'chemistry'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800'
          }`}
        >
          <FlaskConical className="w-4 h-4" />
          Chemistry Reactions & Concepts
        </button>

        <button
          onClick={() => setActiveTab('math')}
          className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-bold transition whitespace-nowrap ${
            activeTab === 'math'
              ? 'bg-purple-600 text-white shadow-xs'
              : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800'
          }`}
        >
          <Calculator className="w-4 h-4" />
          Math Formulas & Exercises
        </button>

        <button
          onClick={() => setActiveTab('mistakes')}
          className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-bold transition whitespace-nowrap ${
            activeTab === 'mistakes'
              ? 'bg-rose-600 text-white shadow-xs'
              : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800'
          }`}
        >
          <AlertOctagon className="w-4 h-4" />
          Mistake Notebook
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
        <input
          type="text"
          placeholder="Search formulas, derivations, reactions, symbols, or mistakes..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white"
        />
      </div>

      {/* Content Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredResources.length === 0 ? (
          <div className="col-span-full py-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 text-xs text-slate-500">
            No items recorded under this category yet. Click 'Add Item' to create custom formulas, derivations, or mistake notes.
          </div>
        ) : (
          filteredResources.map((res) => (
            <div
              key={res.id}
              className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                        res.type === 'formula'
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                          : res.type === 'reaction'
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                          : res.type === 'derivation'
                          ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300'
                          : res.type === 'mistake'
                          ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                          : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                      }`}
                    >
                      {res.type}
                    </span>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      {res.title}
                    </h3>
                  </div>

                  <button
                    onClick={() => deleteResource(res.id)}
                    className="p-1 rounded-md text-slate-400 hover:text-rose-600 transition"
                    title="Delete item"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Content body */}
                <div className="mt-2.5 p-3 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60 font-mono text-xs text-slate-800 dark:text-slate-200 whitespace-pre-line leading-relaxed">
                  {res.content}
                </div>

                {/* Symbols & Units Table for Physics */}
                {res.symbolsAndUnits && res.symbolsAndUnits.length > 0 && (
                  <div className="mt-2.5 space-y-1.5">
                    <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                      Symbols, SI Units & Dimensions:
                    </span>
                    <div className="grid grid-cols-1 gap-1">
                      {res.symbolsAndUnits.map((item, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between text-[11px] px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                        >
                          <span className="font-bold">{item.symbol}: {item.name}</span>
                          <span className="text-slate-500 font-mono">{item.siUnit} {item.dimensions ? `(${item.dimensions})` : ''}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Reaction Details for Chemistry */}
                {res.reactionDetails && (
                  <div className="mt-2.5 p-2.5 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/60 text-[11px] text-emerald-900 dark:text-emerald-200 space-y-1">
                    <div>
                      <span className="font-bold">Reagents: </span>
                      {res.reactionDetails.reagents}
                    </div>
                    <div>
                      <span className="font-bold">Conditions: </span>
                      {res.reactionDetails.conditions}
                    </div>
                    {res.reactionDetails.mechanismNotes && (
                      <div className="text-slate-600 dark:text-slate-400 italic">
                        {res.reactionDetails.mechanismNotes}
                      </div>
                    )}
                  </div>
                )}

                {/* Mistake Details */}
                {res.mistakeDetails && (
                  <div className="mt-2.5 space-y-2 text-xs">
                    <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-900 dark:text-rose-200">
                      <span className="font-bold">Why made: </span>
                      {res.mistakeDetails.whyMade || 'Calculation or sign slip'}
                    </div>
                    <button
                      onClick={() =>
                        onOpenAITutorForMistake(
                          `${res.title}: ${res.content}. Why made: ${res.mistakeDetails?.whyMade}`
                        )
                      }
                      className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold hover:underline flex items-center gap-1"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      Diagnose with AI Tutor
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Resource Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <form
            onSubmit={handleCreateResource}
            className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Add New {activeTab === 'mistakes' ? 'Mistake Note' : `${activeTab.toUpperCase()} Item`}
            </h3>

            {activeTab !== 'mistakes' && (
              <div className="text-xs">
                <label className="font-semibold text-slate-700 dark:text-slate-300">Item Type</label>
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value as any)}
                  className="mt-1 w-full p-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                >
                  <option value="formula">Formula with Symbols</option>
                  <option value="derivation">Derivation Steps</option>
                  <option value="reaction">Chemical Reaction</option>
                  <option value="note">Concept / Method Note</option>
                </select>
              </div>
            )}

            <div className="text-xs">
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                {activeTab === 'mistakes' ? 'Mistake Title / Concept Gap' : 'Title / Equation Name'}
              </label>
              <input
                type="text"
                required
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g. Lens Maker Formula or Factor of 1/2 in Kinetic Energy"
                className="mt-1 w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>

            <div className="text-xs">
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                {activeTab === 'mistakes' ? 'What was your incorrect attempt?' : 'Formula Expression / Content'}
              </label>
              <textarea
                rows={3}
                required
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                placeholder="Type equation, reaction, or notes..."
                className="mt-1 w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>

            {activeTab === 'chemistry' && newType === 'reaction' && (
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Reagents</label>
                  <input
                    type="text"
                    value={newReagents}
                    onChange={(e) => setNewReagents(e.target.value)}
                    placeholder="e.g. CHCl3 + aqueous NaOH"
                    className="mt-1 w-full p-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Conditions</label>
                  <input
                    type="text"
                    value={newConditions}
                    onChange={(e) => setNewConditions(e.target.value)}
                    placeholder="e.g. 340 K reflux"
                    className="mt-1 w-full p-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>
            )}

            {activeTab === 'mistakes' && (
              <div className="text-xs">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  Why did you make this mistake?
                </label>
                <input
                  type="text"
                  value={newWhyMade}
                  onChange={(e) => setNewWhyMade(e.target.value)}
                  placeholder="e.g. Did not convert cm to m; rushed through calculation"
                  className="mt-1 w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
              >
                Save Item
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
