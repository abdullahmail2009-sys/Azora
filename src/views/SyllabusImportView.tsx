import React, { useState, useRef } from 'react';
import { useApp } from '../context/AppContext.tsx';
import {
  extractTextFromPDF,
  structureRawSyllabusText,
  ParsedSubjectPreview,
  PDFParseProgress,
} from '../utils/pdfSyllabusParser.ts';
import { apiUrl } from '../utils/apiClient.ts';
import {
  Upload,
  FileText,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
  RefreshCw,
  Trash2,
  Plus,
  BookOpen,
  Sparkles,
  Layers,
  FileCheck,
  HelpCircle,
} from 'lucide-react';

interface SyllabusImportViewProps {
  onBackToSyllabus: () => void;
  onNavigateToPlanner?: () => void;
}

export const SyllabusImportView: React.FC<SyllabusImportViewProps> = ({
  onBackToSyllabus,
  onNavigateToPlanner,
}) => {
  const { activeSyllabus, mergeImportedSyllabus } = useApp();

  // File state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [progress, setProgress] = useState<PDFParseProgress | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Parsing & Review state
  const [extractedRawText, setExtractedRawText] = useState<string>('');
  const [parsedSubjects, setParsedSubjects] = useState<ParsedSubjectPreview[]>([]);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [showRawTextFallback, setShowRawTextFallback] = useState(false);
  const [manualPastedText, setManualPastedText] = useState('');

  // AI OCR extraction state (optional, explicit consent required)
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [aiConsentApproved, setAiConsentApproved] = useState(false);

  // Success summary state
  const [importSummary, setImportSummary] = useState<{
    subjects: number;
    units: number;
    chapters: number;
    topics: number;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Helper to format bytes
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  // Toggle tree section expansion
  const toggleExpand = (id: string) => {
    setExpandedSections((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Handle PDF file selection
  const handleFileChange = async (file: File) => {
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      setErrorMessage('Please select a valid PDF document (.pdf format).');
      return;
    }

    if (file.size === 0) {
      setErrorMessage('The selected file is empty (0 bytes).');
      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      setErrorMessage('The PDF is larger than 25 MB. Please select a smaller document or extract.');
      return;
    }

    setSelectedFile(file);
    setErrorMessage(null);
    setImportSummary(null);

    // Start extraction
    try {
      const result = await extractTextFromPDF(file, (p) => setProgress(p));
      setExtractedRawText(result.fullText);

      if (!result.fullText || result.fullText.trim().length < 20) {
        // Scanned PDF / image-only notice
        setErrorMessage(
          'This PDF appears to be a scanned image with no embedded text layer. You can paste the text manually below or use the AI-assisted OCR option.'
        );
        setShowRawTextFallback(true);
        return;
      }

      // Structure parsed text into subjects/units/chapters/topics
      const structured = structureRawSyllabusText(result.fullText, activeSyllabus.subjects);
      setParsedSubjects(structured);

      // Auto-expand first subject & unit
      const initialExpanded: Record<string, boolean> = {};
      structured.forEach((s) => {
        initialExpanded[s.id] = true;
        s.units.forEach((u) => {
          initialExpanded[u.id] = true;
        });
      });
      setExpandedSections(initialExpanded);
    } catch (err: any) {
      console.error('PDF parsing error:', err);
      setErrorMessage(err.message || 'Failed to extract text from the PDF. Please verify the file.');
    } finally {
      setProgress(null);
    }
  };

  // Reset file selection
  const handleResetFile = () => {
    setSelectedFile(null);
    setExtractedRawText('');
    setParsedSubjects([]);
    setProgress(null);
    setErrorMessage(null);
    setImportSummary(null);
    setShowRawTextFallback(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Process manually pasted or OCR text
  const handleProcessManualText = () => {
    if (!manualPastedText.trim()) return;
    setErrorMessage(null);
    const structured = structureRawSyllabusText(manualPastedText, activeSyllabus.subjects);
    setParsedSubjects(structured);

    const initialExpanded: Record<string, boolean> = {};
    structured.forEach((s) => {
      initialExpanded[s.id] = true;
      s.units.forEach((u) => {
        initialExpanded[u.id] = true;
      });
    });
    setExpandedSections(initialExpanded);
    setShowRawTextFallback(false);
  };

  // AI-Assisted OCR option with explicit user confirmation
  const handleAiOcrExtraction = async () => {
    if (!selectedFile) return;
    if (!aiConsentApproved) {
      setErrorMessage('Please confirm consent before sending the document for AI-assisted OCR extraction.');
      return;
    }

    setIsAiProcessing(true);
    setErrorMessage(null);

    try {
      // Read file as base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const res = reader.result as string;
          const base64 = res.split(',')[1] || res;
          resolve(base64);
        };
        reader.onerror = reject;
      });
      reader.readAsDataURL(selectedFile);
      const base64Data = await base64Promise;

      const resp = await fetch(apiUrl('/api/gemini/scan-syllabus'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pdfBase64: base64Data,
          filename: selectedFile.name,
          academicSession: activeSyllabus.academicSession || '2026-27',
        }),
      });

      if (!resp.ok) {
        throw new Error(`AI extraction service returned error status ${resp.status}`);
      }

      const data = await resp.json();
      if (data.rawText) {
        setExtractedRawText(data.rawText);
        const structured = structureRawSyllabusText(data.rawText, activeSyllabus.subjects);
        setParsedSubjects(structured);
      } else if (data.subjects) {
        setParsedSubjects(data.subjects);
      }
    } catch (err: any) {
      setErrorMessage(`AI OCR extraction encountered an error: ${err.message}. You may paste text manually.`);
    } finally {
      setIsAiProcessing(false);
    }
  };

  // Selection toggle handlers
  const toggleSubjectSelect = (subId: string) => {
    setParsedSubjects((prev) =>
      prev.map((s) => {
        if (s.id !== subId) return s;
        const nextVal = !s.selected;
        return {
          ...s,
          selected: nextVal,
          units: s.units.map((u) => ({
            ...u,
            selected: nextVal,
            chapters: u.chapters.map((c) => ({
              ...c,
              selected: nextVal,
              topics: c.topics.map((t) => ({ ...t, selected: nextVal })),
            })),
          })),
        };
      })
    );
  };

  const toggleUnitSelect = (subId: string, unitId: string) => {
    setParsedSubjects((prev) =>
      prev.map((s) => {
        if (s.id !== subId) return s;
        const targetUnit = s.units.find((u) => u.id === unitId);
        const nextVal = targetUnit ? !targetUnit.selected : true;

        const updatedUnits = s.units.map((u) =>
          u.id === unitId
            ? {
                ...u,
                selected: nextVal,
                chapters: u.chapters.map((c) => ({
                  ...c,
                  selected: nextVal,
                  topics: c.topics.map((t) => ({ ...t, selected: nextVal })),
                })),
              }
            : u
        );

        const anyUnitSelected = updatedUnits.some((u) => u.selected);
        return { ...s, selected: anyUnitSelected, units: updatedUnits };
      })
    );
  };

  const toggleChapterSelect = (subId: string, unitId: string, chapId: string) => {
    setParsedSubjects((prev) =>
      prev.map((s) => {
        if (s.id !== subId) return s;
        return {
          ...s,
          units: s.units.map((u) => {
            if (u.id !== unitId) return u;
            const targetChap = u.chapters.find((c) => c.id === chapId);
            const nextVal = targetChap ? !targetChap.selected : true;

            const updatedChaps = u.chapters.map((c) =>
              c.id === chapId
                ? {
                    ...c,
                    selected: nextVal,
                    topics: c.topics.map((t) => ({ ...t, selected: nextVal })),
                  }
                : c
            );

            const anyChapSelected = updatedChaps.some((c) => c.selected);
            return { ...u, selected: anyChapSelected, chapters: updatedChaps };
          }),
        };
      })
    );
  };

  const toggleTopicSelect = (subId: string, unitId: string, chapId: string, topId: string) => {
    setParsedSubjects((prev) =>
      prev.map((s) => {
        if (s.id !== subId) return s;
        return {
          ...s,
          units: s.units.map((u) => {
            if (u.id !== unitId) return u;
            return {
              ...u,
              chapters: u.chapters.map((c) => {
                if (c.id !== chapId) return c;
                const updatedTopics = c.topics.map((t) =>
                  t.id === topId ? { ...t, selected: !t.selected } : t
                );
                const anyTopicSelected = updatedTopics.some((t) => t.selected);
                return { ...c, selected: anyTopicSelected, topics: updatedTopics };
              }),
            };
          }),
        };
      })
    );
  };

  // Global Select / Deselect All
  const setAllSelection = (select: boolean) => {
    setParsedSubjects((prev) =>
      prev.map((s) => ({
        ...s,
        selected: select,
        units: s.units.map((u) => ({
          ...u,
          selected: select,
          chapters: u.chapters.map((c) => ({
            ...c,
            selected: select,
            topics: c.topics.map((t) => ({ ...t, selected: select })),
          })),
        })),
      }))
    );
  };

  // Change target mapped subject
  const handleMapTargetSubject = (parsedSubId: string, targetId: string) => {
    const existing = activeSyllabus.subjects.find((s) => s.id === targetId);
    setParsedSubjects((prev) =>
      prev.map((s) => {
        if (s.id !== parsedSubId) return s;
        return {
          ...s,
          targetSubjectId: targetId === 'new' ? undefined : targetId,
          name: existing ? existing.name : s.name,
          code: existing ? existing.code : s.code,
          color: existing ? existing.color : s.color,
        };
      })
    );
  };

  // Count total selected items
  const counts = parsedSubjects.reduce(
    (acc, s) => {
      if (!s.selected) return acc;
      s.units.forEach((u) => {
        if (!u.selected) return;
        acc.units++;
        u.chapters.forEach((c) => {
          if (!c.selected) return;
          acc.chapters++;
          c.topics.forEach((t) => {
            if (t.selected) acc.topics++;
          });
        });
      });
      return acc;
    },
    { units: 0, chapters: 0, topics: 0 }
  );

  // Execute safe merge into active syllabus
  const handleConfirmImport = () => {
    if (counts.topics === 0 && counts.chapters === 0) {
      setErrorMessage('Please select at least one unit, chapter, or topic to import.');
      return;
    }

    try {
      const added = mergeImportedSyllabus(parsedSubjects);
      setImportSummary({
        subjects: added.subjects,
        units: added.units,
        chapters: added.chapters,
        topics: added.topics,
      });
    } catch (err: any) {
      setErrorMessage(`Failed to import items into syllabus: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16">
      {/* Header with Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToSyllabus}
            className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer shadow-xs"
            title="Back to Syllabus"
          >
            <ArrowLeft className="w-5 h-5 text-slate-700 dark:text-slate-300" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                Import Syllabus PDF
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                Safe Merge
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
              Select your own PDF document, review the extracted structure, and select units to import without overwriting existing records.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onBackToSyllabus}
            className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
          >
            Cancel & Return
          </button>
        </div>
      </div>

      {/* Preservation & Privacy Notice */}
      <div className="p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-emerald-800 dark:text-emerald-300 leading-relaxed">
          <span className="font-bold">Zero-Data-Loss Guarantee: </span>
          Your existing notes, completed topics, formula sheets, mistakes, and confidence ratings are protected. Imported items will be added to your syllabus tree without overwriting any existing progress.
        </div>
      </div>

      {/* Error message banner */}
      {errorMessage && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1 text-xs text-rose-800 dark:text-rose-300">
            <p className="font-bold">Notice</p>
            <p className="mt-0.5">{errorMessage}</p>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-xs font-bold text-rose-600 dark:text-rose-400 hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Success Modal / State */}
      {importSummary && (
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border-2 border-emerald-500 shadow-xl space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Syllabus Items Imported Successfully!
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                The selected structure has been merged into your active syllabus.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-3">
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-center">
              <span className="text-2xl font-black text-slate-900 dark:text-white">
                {importSummary.subjects}
              </span>
              <p className="text-[11px] text-slate-500 font-medium">New Subjects</p>
            </div>
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-center">
              <span className="text-2xl font-black text-blue-600 dark:text-blue-400">
                {importSummary.units}
              </span>
              <p className="text-[11px] text-slate-500 font-medium">Units Added</p>
            </div>
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-center">
              <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                {importSummary.chapters}
              </span>
              <p className="text-[11px] text-slate-500 font-medium">Chapters Added</p>
            </div>
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-center">
              <span className="text-2xl font-black text-purple-600 dark:text-purple-400">
                {importSummary.topics}
              </span>
              <p className="text-[11px] text-slate-500 font-medium">Topics Added</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              onClick={onBackToSyllabus}
              className="px-5 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-500/20 transition flex items-center gap-2 cursor-pointer"
            >
              <BookOpen className="w-4 h-4" />
              View Updated Syllabus
            </button>
            {onNavigateToPlanner && (
              <button
                onClick={onNavigateToPlanner}
                className="px-5 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs transition flex items-center gap-2 cursor-pointer"
              >
                <Layers className="w-4 h-4" />
                Schedule in Planner
              </button>
            )}
            <button
              onClick={handleResetFile}
              className="px-4 py-2.5 rounded-2xl text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white text-xs font-semibold transition"
            >
              Import Another File
            </button>
          </div>
        </div>
      )}

      {/* Step 1: File Picker & Upload Section */}
      {!importSummary && (
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-400 text-xs font-black flex items-center justify-center">
                1
              </div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Select PDF Syllabus Document
              </h2>
            </div>
            {selectedFile && (
              <button
                onClick={handleResetFile}
                className="text-xs text-rose-600 dark:text-rose-400 font-semibold hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" /> Remove file
              </button>
            )}
          </div>

          {!selectedFile ? (
            <div>
              {/* Drop Zone */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    handleFileChange(e.dataTransfer.files[0]);
                  }
                }}
                onClick={() => fileInputRef.current?.click()}
                className={`p-8 sm:p-12 border-2 border-dashed rounded-3xl flex flex-col items-center justify-center text-center cursor-pointer transition ${
                  isDragging
                    ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/20'
                    : 'border-slate-300 dark:border-slate-700 hover:border-blue-400 hover:bg-slate-50/50 dark:hover:bg-slate-800/40'
                }`}
              >
                <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-3">
                  <Upload className="w-7 h-7" />
                </div>
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  Tap to browse or drop your PDF here
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm">
                  Compatible with Android file pickers, phone storage, and Google Drive PDFs. Maximum file size: 25 MB.
                </p>
                <span className="mt-4 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs">
                  Choose PDF File
                </span>
              </div>

              {/* Hidden File Input */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileChange(e.target.files[0]);
                  }
                }}
              />
            </div>
          ) : (
            <div className="space-y-3">
              {/* Selected File Card */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400 flex items-center justify-center flex-shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {selectedFile.name}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {formatFileSize(selectedFile.size)} • PDF Document
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-100 transition cursor-pointer"
                  >
                    Change File
                  </button>
                  <button
                    onClick={handleResetFile}
                    className="p-1.5 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                    title="Remove"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Progress Indicator */}
              {progress && (
                <div className="p-4 rounded-2xl bg-blue-50/60 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 space-y-2">
                  <div className="flex items-center justify-between text-xs text-blue-900 dark:text-blue-300 font-semibold">
                    <span className="flex items-center gap-2">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      {progress.message}
                    </span>
                    {progress.totalPages > 0 && (
                      <span>
                        {Math.round((progress.currentPage / progress.totalPages) * 100)}%
                      </span>
                    )}
                  </div>
                  <div className="w-full bg-blue-200 dark:bg-blue-900 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-blue-600 h-full transition-all duration-200"
                      style={{
                        width: `${
                          progress.totalPages > 0
                            ? Math.round((progress.currentPage / progress.totalPages) * 100)
                            : 40
                        }%`,
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Fallback Option: Paste text manually or use AI OCR */}
          {showRawTextFallback && (
            <div className="mt-4 p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-900 dark:text-amber-200">
                <HelpCircle className="w-4 h-4 text-amber-600" />
                Scanned PDF or Manual Input Options
              </div>
              <p className="text-xs text-amber-800/90 dark:text-amber-300">
                If the document does not contain computer-readable text, paste the syllabus text below or enable the AI-assisted OCR option.
              </p>

              <textarea
                value={manualPastedText}
                onChange={(e) => setManualPastedText(e.target.value)}
                placeholder="Paste syllabus text here (e.g., Unit 1: Electrostatics, Chapter 1: Electric Charges and Fields, Topics...)"
                rows={4}
                className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-mono"
              />

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <button
                  onClick={handleProcessManualText}
                  disabled={!manualPastedText.trim()}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold transition cursor-pointer"
                >
                  Parse Pasted Text
                </button>

                {/* AI-assisted OCR with explicit user consent */}
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={aiConsentApproved}
                      onChange={(e) => setAiConsentApproved(e.target.checked)}
                      className="rounded text-blue-600 focus:ring-0"
                    />
                    <span>Allow AI-assisted extraction</span>
                  </label>
                  <button
                    onClick={handleAiOcrExtraction}
                    disabled={!selectedFile || isAiProcessing || !aiConsentApproved}
                    className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                  >
                    {isAiProcessing ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5" />
                    )}
                    Run AI OCR
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Step 2: Interactive Structure Review & Tree Selection */}
      {!importSummary && parsedSubjects.length > 0 && (
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-400 text-xs font-black flex items-center justify-center">
                2
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  Preview & Select Items to Import
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Check or uncheck subjects, units, chapters, and topics. Only selected items will be added.
                </p>
              </div>
            </div>

            {/* Selection actions & counter */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-3 py-1 rounded-full border border-blue-200 dark:border-blue-900">
                {counts.units} Units • {counts.chapters} Chapters • {counts.topics} Topics Selected
              </span>
              <button
                onClick={() => setAllSelection(true)}
                className="px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
              >
                Select All
              </button>
              <button
                onClick={() => setAllSelection(false)}
                className="px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
              >
                Deselect All
              </button>
            </div>
          </div>

          {/* Tree View */}
          <div className="space-y-4">
            {parsedSubjects.map((sub) => {
              const isSubExpanded = !!expandedSections[sub.id];

              return (
                <div
                  key={sub.id}
                  className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-slate-50/50 dark:bg-slate-900/50"
                >
                  {/* Subject Header */}
                  <div className="p-4 bg-slate-100/80 dark:bg-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={sub.selected}
                        onChange={() => toggleSubjectSelect(sub.id)}
                        className="w-4 h-4 text-blue-600 rounded-sm focus:ring-0 cursor-pointer"
                      />
                      <button
                        onClick={() => toggleExpand(sub.id)}
                        className="flex items-center gap-2 font-bold text-xs text-slate-900 dark:text-white cursor-pointer"
                      >
                        {isSubExpanded ? (
                          <ChevronDown className="w-4 h-4 text-slate-400" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-slate-400" />
                        )}
                        <span
                          className="w-2.5 h-2.5 rounded-full inline-block"
                          style={{ backgroundColor: sub.color }}
                        />
                        <span>{sub.name}</span>
                        <span className="text-[11px] text-slate-500 font-normal">
                          ({sub.units.length} Units)
                        </span>
                      </button>
                    </div>

                    {/* Target Subject Mapping Selector */}
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-slate-500 font-medium">Merge target:</span>
                      <select
                        value={sub.targetSubjectId || 'new'}
                        onChange={(e) => handleMapTargetSubject(sub.id, e.target.value)}
                        className="px-2.5 py-1 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-hidden"
                      >
                        <option value="new">+ Create as New Subject</option>
                        {activeSyllabus.subjects.map((existSub) => (
                          <option key={existSub.id} value={existSub.id}>
                            Existing: {existSub.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Units List */}
                  {isSubExpanded && (
                    <div className="p-4 space-y-4">
                      {sub.units.length === 0 ? (
                        <p className="text-xs text-slate-400 italic">No units detected in this subject.</p>
                      ) : (
                        sub.units.map((unit) => {
                          const isUnitExpanded = !!expandedSections[unit.id];

                          return (
                            <div
                              key={unit.id}
                              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden"
                            >
                              {/* Unit Header */}
                              <div className="p-3 bg-slate-50 dark:bg-slate-800/90 flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2.5">
                                  <input
                                    type="checkbox"
                                    checked={unit.selected}
                                    onChange={() => toggleUnitSelect(sub.id, unit.id)}
                                    className="w-4 h-4 text-blue-600 rounded-sm focus:ring-0 cursor-pointer"
                                  />
                                  <button
                                    onClick={() => toggleExpand(unit.id)}
                                    className="flex items-center gap-1.5 font-bold text-xs text-slate-800 dark:text-slate-200 text-left cursor-pointer"
                                  >
                                    {isUnitExpanded ? (
                                      <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                                    ) : (
                                      <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                                    )}
                                    <span>
                                      Unit {unit.number}: {unit.title}
                                    </span>
                                  </button>
                                </div>

                                <div className="flex items-center gap-2">
                                  {unit.officialMarks !== undefined && (
                                    <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-md">
                                      {unit.officialMarks} Marks
                                    </span>
                                  )}
                                  <span className="text-[11px] text-slate-400">
                                    {unit.chapters.length} Chapters
                                  </span>
                                </div>
                              </div>

                              {/* Chapters List */}
                              {isUnitExpanded && (
                                <div className="p-3 space-y-3">
                                  {unit.chapters.map((chap) => {
                                    const isChapExpanded = !!expandedSections[chap.id];

                                    return (
                                      <div
                                        key={chap.id}
                                        className="rounded-lg border border-slate-100 dark:border-slate-700/80 bg-slate-50/40 dark:bg-slate-800/40 p-2.5"
                                      >
                                        <div className="flex items-center justify-between gap-2">
                                          <div className="flex items-center gap-2">
                                            <input
                                              type="checkbox"
                                              checked={chap.selected}
                                              onChange={() =>
                                                toggleChapterSelect(sub.id, unit.id, chap.id)
                                              }
                                              className="w-3.5 h-3.5 text-blue-600 rounded-sm focus:ring-0 cursor-pointer"
                                            />
                                            <button
                                              onClick={() => toggleExpand(chap.id)}
                                              className="flex items-center gap-1 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:text-blue-600 cursor-pointer text-left"
                                            >
                                              {isChapExpanded ? (
                                                <ChevronDown className="w-3 h-3 text-slate-400" />
                                              ) : (
                                                <ChevronRight className="w-3 h-3 text-slate-400" />
                                              )}
                                              <span>
                                                Ch {chap.number}: {chap.title}
                                              </span>
                                            </button>
                                          </div>

                                          <div className="flex items-center gap-2">
                                            {chap.officialWeightageMarks !== undefined && (
                                              <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950 px-1.5 py-0.5 rounded-sm">
                                                {chap.officialWeightageMarks} M
                                              </span>
                                            )}
                                            <span className="text-[10px] text-slate-400">
                                              {chap.topics.length} Topics
                                            </span>
                                          </div>
                                        </div>

                                        {/* Topics List under Chapter */}
                                        {isChapExpanded && (
                                          <div className="mt-2 pl-6 space-y-1.5 border-l-2 border-slate-200 dark:border-slate-700">
                                            {chap.topics.map((top) => (
                                              <div
                                                key={top.id}
                                                className="flex items-start gap-2 py-1 text-xs"
                                              >
                                                <input
                                                  type="checkbox"
                                                  checked={top.selected}
                                                  onChange={() =>
                                                    toggleTopicSelect(sub.id, unit.id, chap.id, top.id)
                                                  }
                                                  className="w-3.5 h-3.5 text-blue-600 rounded-sm focus:ring-0 cursor-pointer mt-0.5"
                                                />
                                                <div className="min-w-0 flex-1">
                                                  <span className="text-slate-700 dark:text-slate-300 font-medium">
                                                    {top.title}
                                                  </span>
                                                  {top.subtopics.length > 0 && (
                                                    <p className="text-[11px] text-slate-400 mt-0.5">
                                                      Subtopics: {top.subtopics.join(', ')}
                                                    </p>
                                                  )}
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Step 3: Confirmation Footer */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="text-xs text-slate-500">
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                Ready to import:
              </span>{' '}
              {counts.units} Units, {counts.chapters} Chapters, {counts.topics} Topics selected.
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleResetFile}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition"
              >
                Discard & Reset
              </button>
              <button
                onClick={handleConfirmImport}
                disabled={counts.topics === 0 && counts.chapters === 0}
                className="px-6 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-bold text-xs shadow-md shadow-blue-500/20 transition flex items-center gap-2 cursor-pointer"
              >
                <FileCheck className="w-4 h-4" />
                Confirm & Import Selected Items
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
