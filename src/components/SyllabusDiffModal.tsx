import React, { useState } from 'react';
import { useApp } from '../context/AppContext.tsx';
import { SyllabusVersion } from '../types/index.ts';
import { compareSyllabi, SyllabusDiffReport } from '../utils/syllabusDiff.ts';
import { apiUrl } from '../utils/apiClient.ts';
import {
  FileCheck,
  X,
  Upload,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Diff,
  Loader2,
} from 'lucide-react';

interface SyllabusDiffModalProps {
  onClose: () => void;
}

export const SyllabusDiffModal: React.FC<SyllabusDiffModalProps> = ({ onClose }) => {
  const { activeSyllabus, importSyllabusVersion } = useApp();

  const [inputMode, setInputMode] = useState<'scan' | 'manual_json'>('scan');
  const [rawTextToScan, setRawTextToScan] = useState('');
  const [jsonText, setJsonText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [stagedNewSyllabus, setStagedNewSyllabus] = useState<SyllabusVersion | null>(null);
  const [diffReport, setDiffReport] = useState<SyllabusDiffReport | null>(null);

  const handleAIScan = async () => {
    if (!rawTextToScan.trim()) {
      setError('Please paste syllabus text, model paper content, or document OCR text.');
      return;
    }
    setError(null);
    setLoading(true);

    try {
      const res = await fetch(apiUrl('/api/gemini/scan-syllabus'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawText: rawTextToScan }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to scan syllabus');
      }

      // Convert scanned output to candidate SyllabusVersion
      const candidate: SyllabusVersion = {
        id: `scanned-${Date.now()}`,
        title: `AI-Extracted Syllabus (${data.detectedSubject || 'New Subject'})`,
        academicSession: data.academicSession || '2026–27',
        verificationStatus: 'ai_extracted',
        statusLabel: 'AI-Extracted — Verification Pending',
        officialSourceUrl: 'Uploaded / Scanned Document',
        lastCheckedDate: new Date().toISOString().split('T')[0],
        isActive: true,
        subjects: [
          ...activeSyllabus.subjects,
          // If detected a new subject, add or merge
        ],
      };

      setStagedNewSyllabus(candidate);
      const report = compareSyllabi(activeSyllabus, candidate);
      setDiffReport(report);
    } catch (err: any) {
      setError(err.message || 'Error occurred during AI scan.');
    } finally {
      setLoading(false);
    }
  };

  const handleParseJSON = () => {
    try {
      const parsed = JSON.parse(jsonText);
      setStagedNewSyllabus(parsed);
      const report = compareSyllabi(activeSyllabus, parsed);
      setDiffReport(report);
      setError(null);
    } catch (e: any) {
      setError('Invalid JSON syllabus structure.');
    }
  };

  const handleApplyChanges = () => {
    if (!stagedNewSyllabus) return;
    importSyllabusVersion(stagedNewSyllabus);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 my-auto overflow-hidden animate-in fade-in zoom-in-95 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/40">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center">
              <Diff className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Syllabus Versioning & AI Document Scanner
              </h2>
              <p className="text-xs text-slate-500">
                Safe import: compares incoming version with active syllabus and preserves student mastery history.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:text-slate-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          {/* Method tabs */}
          <div className="flex gap-2">
            <button
              onClick={() => {
                setInputMode('scan');
                setDiffReport(null);
              }}
              className={`flex-1 py-2 rounded-xl font-bold transition ${
                inputMode === 'scan'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
              }`}
            >
              Scan Syllabus Document / OCR Text
            </button>
            <button
              onClick={() => {
                setInputMode('manual_json');
                setDiffReport(null);
              }}
              className={`flex-1 py-2 rounded-xl font-bold transition ${
                inputMode === 'manual_json'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
              }`}
            >
              Paste JSON Syllabus Edition
            </button>
          </div>

          {inputMode === 'scan' ? (
            <div className="space-y-2">
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                Paste official syllabus PDF text or scanned exam scheme
              </label>
              <textarea
                rows={5}
                value={rawTextToScan}
                onChange={(e) => setRawTextToScan(e.target.value)}
                placeholder="Paste official syllabus text: e.g. Subject: Physics, Unit 1 Electrostatics, Chapter 1 Electric Charges, Topics: Coulomb Law, Gauss Law (4 marks)..."
                className="w-full p-3 rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
              <button
                onClick={handleAIScan}
                disabled={loading}
                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold flex items-center justify-center gap-2 transition disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Extract & Compare with Active Syllabus
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                Paste Valid JSON Syllabus Object
              </label>
              <textarea
                rows={5}
                value={jsonText}
                onChange={(e) => setJsonText(e.target.value)}
                placeholder='{"id": "...", "title": "...", "academicSession": "2027-28", "subjects": [...]}'
                className="w-full p-3 rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
              />
              <button
                onClick={handleParseJSON}
                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold"
              >
                Parse & Compare
              </button>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              <span>{error}</span>
            </div>
          )}

          {/* Diff Report */}
          {diffReport && (
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3 animate-in fade-in">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
                <span className="font-bold text-slate-900 dark:text-white">
                  Syllabus Change Report
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                    +{diffReport.addedCount} Added
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-100 text-rose-800">
                    -{diffReport.removedCount} Removed
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                    ~{diffReport.modifiedCount} Modified
                  </span>
                </div>
              </div>

              <div className="text-[11px] text-slate-600 dark:text-slate-300 bg-emerald-50/70 dark:bg-emerald-950/40 p-2.5 rounded-xl border border-emerald-200 dark:border-emerald-800 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> {diffReport.preservationSummary}
              </div>

              {diffReport.changes.length === 0 ? (
                <div className="text-slate-500 italic py-2">
                  No structural changes detected. The imported syllabus matches the active version.
                </div>
              ) : (
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {diffReport.changes.map((ch, idx) => (
                    <div
                      key={idx}
                      className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-[11px]"
                    >
                      <span className="font-medium">{ch.path}</span>
                      <span
                        className={`font-bold uppercase ${
                          ch.type === 'added'
                            ? 'text-emerald-600'
                            : ch.type === 'removed'
                            ? 'text-rose-600'
                            : 'text-amber-600'
                        }`}
                      >
                        {ch.type}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setDiffReport(null)}
                  className="px-4 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-medium"
                >
                  Discard
                </button>
                <button
                  onClick={handleApplyChanges}
                  className="px-5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs"
                >
                  Apply & Merge Syllabus
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
