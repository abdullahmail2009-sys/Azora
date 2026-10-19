import React, { useState, useMemo, useRef } from 'react';
import { useApp } from '../context/AppContext.tsx';
import { TopicStatus, MarksReconciliationReport } from '../types/index.ts';
import { extractTextFromPDF, PDFParseProgress } from '../utils/pdfSyllabusParser.ts';
import { apiUrl } from '../utils/apiClient.ts';
import {
  calculateTopicIntelligence,
  parsePYQPdfWithReconciliation,
  computeMarksReconciliation,
  calculateChapterWeightageDistribution,
  ExtractedPYQCandidate,
} from '../utils/pyqIntelligenceEngine.ts';
import {
  FileSearch,
  Search,
  CheckCircle2,
  XCircle,
  RotateCcw,
  ShieldCheck,
  Plus,
  Eye,
  EyeOff,
  Upload,
  AlertTriangle,
  Sparkles,
  FileText,
  Layers,
  CheckSquare,
  Square,
  Trash2,
  ExternalLink,
  SlidersHorizontal,
  Scale,
  BarChart3,
  GitBranch,
} from 'lucide-react';

interface PYQViewProps {
  onSelectTopic?: (topicId: string) => void;
}

export const PYQView: React.FC<PYQViewProps> = ({ onSelectTopic }) => {
  const {
    pyqs,
    activeSyllabus,
    masteryMap,
    preferences,
    updatePYQAttempt,
    addPYQ,
    bulkAddPYQs,
    updatePYQ,
    deletePYQ,
    addUploadedFileMetadata,
    updateTopicMastery,
  } = useApp();

  const [activeMode, setActiveMode] = useState<
    'intelligence' | 'weightage' | 'questions' | 'import'
  >('intelligence');

  // Topic Intelligence Filters
  const [intelSubjectFilter, setIntelSubjectFilter] = useState<string>('all');
  const [intelChapterFilter, setIntelChapterFilter] = useState<string>('all');
  const [intelYearFilter, setIntelYearFilter] = useState<string>('all');
  const [intelStatusFilter, setIntelStatusFilter] = useState<string>('all');
  const [intelPriorityFilter, setIntelPriorityFilter] = useState<string>('all');
  const [intelSearch, setIntelSearch] = useState<string>('');

  // Question Bank Filters
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedOrigin, setSelectedOrigin] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [revealedSolutions, setRevealedSolutions] = useState<Record<string, boolean>>({});

  // Manual Add Question Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newSubjectId, setNewSubjectId] = useState(activeSyllabus.subjects[0]?.id || 'physics');
  const [newChapterId, setNewChapterId] = useState('');
  const [newTopicId, setNewTopicId] = useState('');
  const [newQuestionText, setNewQuestionText] = useState('');
  const [newMarks, setNewMarks] = useState(3);
  const [newYear, setNewYear] = useState('2024');
  const [newExamName, setNewExamName] = useState('RBSE Class 12 Board');
  const [newQuestionType, setNewQuestionType] = useState<string>('Short Answer');
  const [newSource, setNewSource] = useState('RBSE Board Paper');
  const [newSolution, setNewSolution] = useState('');
  const [newIsAiGenerated, setNewIsAiGenerated] = useState(false);

  // PDF Import & Combined Analysis State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [parseProgress, setParseProgress] = useState<PDFParseProgress | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [extractedCandidates, setExtractedCandidates] = useState<ExtractedPYQCandidate[]>([]);
  const [uploadedFileNames, setUploadedFileNames] = useState<string[]>([]);
  const [candidateFilter, setCandidateFilter] = useState<
    'all' | 'unmatched' | 'duplicates' | 'optional_or'
  >('all');
  const [manualPasteText, setManualPasteText] = useState('');
  const [showManualPaste, setShowManualPaste] = useState(false);
  const [isOcrRunning, setIsOcrRunning] = useState(false);
  const [pendingOcrFile, setPendingOcrFile] = useState<File | null>(null);
  const [declaredPaperTotalOverride, setDeclaredPaperTotalOverride] = useState<number | null>(null);
  const [lastRawExtractedText, setLastRawExtractedText] = useState<string>('');

  // Live Marks Reconciliation Report (recomputes whenever candidates or paper total override changes)
  const marksReconciliationReport = useMemo<MarksReconciliationReport | null>(() => {
    if (extractedCandidates.length === 0) return null;
    const baseReport = computeMarksReconciliation(
      extractedCandidates,
      lastRawExtractedText,
      uploadedFileNames[uploadedFileNames.length - 1] || 'Uploaded_Paper.pdf',
      declaredPaperTotalOverride
    );
    return baseReport;
  }, [extractedCandidates, lastRawExtractedText, uploadedFileNames, declaredPaperTotalOverride]);

  // Compute Topic Intelligence Engine rankings
  const topicIntelligenceItems = useMemo(() => {
    return calculateTopicIntelligence(
      activeSyllabus.subjects,
      pyqs,
      masteryMap,
      preferences.autoCompleteFromStages === true
    );
  }, [
    activeSyllabus.subjects,
    pyqs,
    masteryMap,
    preferences.autoCompleteFromStages,
  ]);

  // Compute Chapter Weightage & Marks Distribution
  const chapterWeightageList = useMemo(() => {
    return calculateChapterWeightageDistribution(activeSyllabus.subjects, pyqs);
  }, [activeSyllabus.subjects, pyqs]);

  const availableChaptersForIntel = useMemo(() => {
    if (intelSubjectFilter === 'all') {
      return activeSyllabus.subjects.flatMap((s) => s.units.flatMap((u) => u.chapters));
    }
    const sub = activeSyllabus.subjects.find((s) => s.id === intelSubjectFilter);
    return sub ? sub.units.flatMap((u) => u.chapters) : [];
  }, [activeSyllabus.subjects, intelSubjectFilter]);

  const availableYears = useMemo(() => {
    const years = new Set<string>();
    pyqs.forEach((q) => {
      if (q.examYear) years.add(q.examYear);
    });
    return Array.from(years).sort().reverse();
  }, [pyqs]);

  const filteredIntelItems = useMemo(() => {
    return topicIntelligenceItems.filter((item) => {
      if (intelSubjectFilter !== 'all' && item.subjectId !== intelSubjectFilter) return false;
      if (intelChapterFilter !== 'all' && item.chapterId !== intelChapterFilter) return false;
      if (intelStatusFilter !== 'all' && item.completionStatus !== intelStatusFilter) return false;
      if (intelPriorityFilter !== 'all' && item.priorityLevel !== intelPriorityFilter) return false;
      if (intelYearFilter !== 'all' && !item.yearsAppeared.includes(intelYearFilter)) return false;
      if (intelSearch.trim()) {
        const q = intelSearch.toLowerCase();
        const matchTopic = item.topicTitle.toLowerCase().includes(q);
        const matchChap = item.chapterTitle.toLowerCase().includes(q);
        const matchSub = item.subjectName.toLowerCase().includes(q);
        if (!matchTopic && !matchChap && !matchSub) return false;
      }
      return true;
    });
  }, [
    topicIntelligenceItems,
    intelSubjectFilter,
    intelChapterFilter,
    intelStatusFilter,
    intelPriorityFilter,
    intelYearFilter,
    intelSearch,
  ]);

  // Handle Multiple PDF Files Selection for PYQ Analysis
  const handleSelectPDFs = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setImportError(null);
    setPendingOcrFile(null);

    const files = Array.from(fileList);
    let combinedCandidates = [...extractedCandidates];
    const newNames = [...uploadedFileNames];

    for (const file of files) {
      if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
        setImportError(`Skipped "${file.name}": Only PDF files (.pdf) are supported.`);
        continue;
      }
      if (file.size === 0) {
        setImportError(`"${file.name}" is empty (0 bytes).`);
        continue;
      }

      try {
        const res = await extractTextFromPDF(file, (prog) => setParseProgress(prog));
        if (!res.fullText || res.fullText.trim().length < 20) {
          setPendingOcrFile(file);
          setImportError(
            `"${file.name}" appears to be a scanned image PDF without embedded text (${res.pagesNeedingOcr.length} scanned pages). Click "Run AI OCR on Scanned PDF" or paste text manually.`
          );
          addUploadedFileMetadata({
            fileName: file.name,
            fileType: 'pyq_pdf',
            pageCount: res.pageCount,
            itemsExtractedCount: 0,
            ocrUsed: false,
            notes: 'Scanned PDF with no text layer',
          });
          continue;
        }

        setLastRawExtractedText(res.fullText);
        const { candidates: parsedFromDoc, reconciliation } = parsePYQPdfWithReconciliation(
          res.fullText,
          file.name,
          activeSyllabus.subjects,
          pyqs
        );
        if (reconciliation.officialMaxMarks) {
          setDeclaredPaperTotalOverride(reconciliation.officialMaxMarks);
        }

        const deduplicatedAgainstSession = parsedFromDoc.map((cand) => {
          const dupInSession = combinedCandidates.find(
            (existing) =>
              existing.questionText.toLowerCase().slice(0, 45) ===
              cand.questionText.toLowerCase().slice(0, 45)
          );
          if (dupInSession) {
            return {
              ...cand,
              isDuplicate: true,
              duplicateOfId: dupInSession.id,
            };
          }
          return cand;
        });

        combinedCandidates = [...combinedCandidates, ...deduplicatedAgainstSession];
        if (!newNames.includes(file.name)) newNames.push(file.name);

        addUploadedFileMetadata({
          fileName: file.name,
          fileType: 'pyq_pdf',
          pageCount: res.pageCount,
          itemsExtractedCount: parsedFromDoc.length,
          ocrUsed: false,
          notes: `Category: ${reconciliation.documentCategory} | Compulsory Marks: ${reconciliation.compulsoryMarksSum}`,
        });
      } catch (err: any) {
        setImportError(`Failed to read "${file.name}": ${err.message || 'Corrupted or unreadable PDF'}`);
      } finally {
        setParseProgress(null);
      }
    }

    setExtractedCandidates(combinedCandidates);
    setUploadedFileNames(newNames);
    if (combinedCandidates.length > 0) {
      setActiveMode('import');
    }
  };

  // Run AI OCR on a scanned PYQ PDF
  const handleRunAiOcrOnPyqPdf = async () => {
    if (!pendingOcrFile) return;
    setIsOcrRunning(true);
    setImportError(null);

    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const res = reader.result as string;
          resolve(res.split(',')[1] || res);
        };
        reader.onerror = reject;
      });
      reader.readAsDataURL(pendingOcrFile);
      const base64Data = await base64Promise;

      const resp = await fetch(apiUrl('/api/gemini/scan-syllabus'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pdfBase64: base64Data,
          filename: pendingOcrFile.name,
          academicSession: activeSyllabus.academicSession || '2026-27',
        }),
      });

      if (!resp.ok) {
        throw new Error(`OCR service returned HTTP ${resp.status}`);
      }
      const data = await resp.json();
      const rawText = data.rawText || '';
      if (!rawText.trim()) {
        throw new Error('OCR could not detect readable question text from the scanned PDF.');
      }

      setLastRawExtractedText(rawText);
      const { candidates: parsedFromOcr, reconciliation } = parsePYQPdfWithReconciliation(
        rawText,
        pendingOcrFile.name,
        activeSyllabus.subjects,
        pyqs
      );
      if (reconciliation.officialMaxMarks) {
        setDeclaredPaperTotalOverride(reconciliation.officialMaxMarks);
      }
      setExtractedCandidates((prev) => [...prev, ...parsedFromOcr]);
      setUploadedFileNames((prev) =>
        prev.includes(pendingOcrFile.name) ? prev : [...prev, pendingOcrFile.name]
      );
      setPendingOcrFile(null);
      setActiveMode('import');
    } catch (err: any) {
      setImportError(`OCR failed: ${err.message}`);
    } finally {
      setIsOcrRunning(false);
    }
  };

  const handleParseManualText = () => {
    if (!manualPasteText.trim()) return;
    setLastRawExtractedText(manualPasteText);
    const { candidates: parsed, reconciliation } = parsePYQPdfWithReconciliation(
      manualPasteText,
      'Manual_PYQ_Extract.pdf',
      activeSyllabus.subjects,
      pyqs
    );
    if (reconciliation.officialMaxMarks) {
      setDeclaredPaperTotalOverride(reconciliation.officialMaxMarks);
    }
    setExtractedCandidates((prev) => [...prev, ...parsed]);
    if (!uploadedFileNames.includes('Manual_PYQ_Extract.pdf')) {
      setUploadedFileNames((prev) => [...prev, 'Manual_PYQ_Extract.pdf']);
    }
    setManualPasteText('');
    setShowManualPaste(false);
  };

  const handleUpdateCandidate = (id: string, updates: Partial<ExtractedPYQCandidate>) => {
    setExtractedCandidates((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        const next = { ...c, ...updates };
        if (updates.topicId && updates.topicId !== 'unmatched') {
          next.isUnmatched = false;
        }
        return next;
      })
    );
  };

  const handleConfirmImportCandidates = () => {
    const selected = extractedCandidates.filter((c) => c.selected);
    if (selected.length === 0) return;

    bulkAddPYQs(
      selected.map((c) => ({
        subjectId: c.subjectId,
        subjectName: c.subjectName,
        chapterId: c.chapterId,
        chapterTitle: c.chapterTitle,
        topicId: c.topicId,
        topicTitle: c.topicTitle,
        questionText: c.questionText,
        marks: c.marks,
        marksConfidence: c.marksConfidence,
        marksRawSnippet: c.marksRawSnippet,
        isOptionalAlternative: c.isOptionalAlternative,
        optionalGroupKey: c.optionalGroupKey,
        sectionLabel: c.sectionLabel,
        examYear: c.examYear,
        examName: c.examName,
        questionType: c.questionType,
        source: `${c.sourceFileName} (p.${c.pageNumber})`,
        sourceFileName: c.sourceFileName,
        pageNumber: c.pageNumber,
        verificationStatus: 'uploaded_pending',
        isUnmatched: c.isUnmatched,
        attemptStatus: 'unattempted',
      }))
    );

    setExtractedCandidates([]);
    setUploadedFileNames([]);
    setDeclaredPaperTotalOverride(null);
    setActiveMode('intelligence');
  };

  const filteredPYQs = useMemo(() => {
    return pyqs.filter((q) => {
      if (selectedSubject !== 'all' && q.subjectId !== selectedSubject) return false;
      if (selectedYear !== 'all' && q.examYear !== selectedYear) return false;
      if (selectedStatus !== 'all' && q.attemptStatus !== selectedStatus) return false;
      if (selectedOrigin === 'extracted' && q.verificationStatus !== 'uploaded_pending') return false;
      if (selectedOrigin === 'verified' && q.verificationStatus !== 'verified_rbse') return false;
      if (selectedOrigin === 'ai' && q.verificationStatus !== 'ai_practice') return false;
      if (selectedOrigin === 'unmatched' && !q.isUnmatched) return false;
      if (
        searchQuery &&
        !q.questionText.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !q.chapterTitle.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !(q.topicTitle || '').toLowerCase().includes(searchQuery.toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [pyqs, selectedSubject, selectedYear, selectedStatus, selectedOrigin, searchQuery]);

  const handleAddManualQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuestionText.trim()) return;

    const sub = activeSyllabus.subjects.find((s) => s.id === newSubjectId);
    const ch = sub?.units.flatMap((u) => u.chapters).find((c) => c.id === newChapterId);
    const top = ch?.topics.find((t) => t.id === newTopicId);

    addPYQ({
      subjectId: newSubjectId,
      subjectName: sub?.name || 'Subject',
      chapterId: newChapterId || 'ch-gen',
      chapterTitle: ch?.title || 'General Chapter',
      topicId: top?.id,
      topicTitle: top?.title,
      questionText: newQuestionText.trim(),
      marks: Number(newMarks) || 2,
      examYear: newYear,
      examName: newExamName,
      questionType: newQuestionType,
      source: newIsAiGenerated ? 'AI Practice Generator' : newSource,
      verificationStatus: newIsAiGenerated ? 'ai_practice' : 'verified_rbse',
      isUnmatched: !top,
      attemptStatus: 'unattempted',
      solution: newSolution,
    });

    setShowAddModal(false);
    setNewQuestionText('');
    setNewSolution('');
  };

  const filteredCandidates = useMemo(() => {
    if (candidateFilter === 'unmatched') return extractedCandidates.filter((c) => c.isUnmatched);
    if (candidateFilter === 'duplicates') return extractedCandidates.filter((c) => c.isDuplicate);
    if (candidateFilter === 'optional_or')
      return extractedCandidates.filter((c) => c.isOptionalAlternative);
    return extractedCandidates;
  }, [extractedCandidates, candidateFilter]);

  return (
    <div className="space-y-6 pb-16">
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,application/pdf"
        multiple
        onChange={(e) => handleSelectPDFs(e.target.files)}
        className="hidden"
      />

      {/* Top Header & Prominent Import PDF Action */}
      <div className="p-5 sm:p-6 rounded-2xl bg-white border border-[#1B4D48]/12 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-[#42BDAE] uppercase tracking-wider mb-1">
            <FileSearch className="w-4 h-4" />
            <span>PYQ Intelligence & Marks Reconciliation Engine</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#1B4D48] tracking-tight">
            Evidence-Based Topic Prioritization & Question Bank
          </h1>
          <p className="text-xs text-[#4A6B67] mt-1 max-w-2xl">
            Rank every syllabus topic using actual PYQ appearances, compulsory marks weightage (excluding OR-choice double counting), completion status, and prerequisites.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2.5 rounded-xl bg-[#1B4D48] hover:bg-[#153D39] text-white text-xs font-bold flex items-center gap-2 shadow-sm transition cursor-pointer"
          >
            <Upload className="w-4 h-4 text-[#75D9B4]" />
            Import PDF (PYQ Paper)
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className="px-3.5 py-2.5 rounded-xl bg-[#FBF7EF] hover:bg-[#42BDAE]/10 text-[#1B4D48] border border-[#1B4D48]/20 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
          >
            <Plus className="w-4 h-4 text-[#42BDAE]" />
            Add Question
          </button>
        </div>
      </div>

      {/* Mode Switcher Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1B4D48]/10 pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setActiveMode('intelligence')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeMode === 'intelligence'
                ? 'bg-[#1B4D48] text-white shadow-sm'
                : 'bg-white text-[#4A6B67] hover:text-[#1B4D48] border border-[#1B4D48]/12'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Topic Intelligence ({topicIntelligenceItems.length})
          </button>

          <button
            onClick={() => setActiveMode('weightage')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeMode === 'weightage'
                ? 'bg-[#1B4D48] text-white shadow-sm'
                : 'bg-white text-[#4A6B67] hover:text-[#1B4D48] border border-[#1B4D48]/12'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            Chapter Marks Weightage
          </button>

          <button
            onClick={() => setActiveMode('questions')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeMode === 'questions'
                ? 'bg-[#1B4D48] text-white shadow-sm'
                : 'bg-white text-[#4A6B67] hover:text-[#1B4D48] border border-[#1B4D48]/12'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            PYQ Question Bank ({pyqs.length})
          </button>

          <button
            onClick={() => setActiveMode('import')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeMode === 'import'
                ? 'bg-[#42BDAE] text-white shadow-sm'
                : 'bg-white text-[#4A6B67] hover:text-[#1B4D48] border border-[#1B4D48]/12'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            PDF Review & Marks Reconciliation
            {extractedCandidates.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-md bg-white/25 text-white text-[10px]">
                {extractedCandidates.length}
              </span>
            )}
          </button>
        </div>

        {/* Evidence Disclaimer Pill */}
        <div className="flex items-center gap-1.5 text-[11px] text-[#1B4D48] bg-[#75D9B4]/20 border border-[#42BDAE]/30 px-3 py-1.5 rounded-lg font-medium">
          <ShieldCheck className="w-3.5 h-3.5 text-[#1B4D48] flex-shrink-0" />
          <span>Evidence-based analysis from uploaded papers — OR choices reconciled</span>
        </div>
      </div>

      {/* Multi-Stage PDF Pipeline Progress */}
      {parseProgress && (
        <div className="p-4 rounded-xl bg-[#69B7EC]/15 border border-[#69B7EC]/40 text-xs text-[#1B4D48] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-[#1B4D48] text-white font-mono text-[10px] uppercase">
              {parseProgress.stage || 'extracting'}
            </span>
            <span className="font-semibold">{parseProgress.message}</span>
          </div>
          <span className="font-mono font-bold">
            Page {parseProgress.currentPage} / {parseProgress.totalPages}
          </span>
        </div>
      )}

      {importError && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-300 text-xs text-amber-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <span className="font-medium">{importError}</span>
          </div>
          <div className="flex items-center gap-2">
            {pendingOcrFile && (
              <button
                onClick={handleRunAiOcrOnPyqPdf}
                disabled={isOcrRunning}
                className="px-3 py-1.5 rounded-lg bg-[#1B4D48] hover:bg-[#153D39] text-white font-bold transition cursor-pointer"
              >
                {isOcrRunning ? 'Running OCR...' : 'Run AI OCR on Scanned PDF'}
              </button>
            )}
            <button
              onClick={() => {
                setShowManualPaste(true);
                setActiveMode('import');
              }}
              className="px-3 py-1.5 rounded-lg bg-white hover:bg-[#FBF7EF] text-[#1B4D48] border border-[#1B4D48]/20 font-bold transition cursor-pointer"
            >
              Paste Text Manually
            </button>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODE 1: TOPIC INTELLIGENCE ENGINE
          ===================================================================== */}
      {activeMode === 'intelligence' && (
        <div className="space-y-5">
          {/* Summary Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 rounded-xl bg-white border border-[#1B4D48]/12 shadow-sm">
              <div className="text-[11px] text-[#4A6B67] font-semibold">Total Syllabus Topics</div>
              <div className="text-2xl font-bold text-[#1B4D48] font-mono mt-1">
                {topicIntelligenceItems.length}
              </div>
            </div>
            <div className="p-4 rounded-xl bg-white border border-[#1B4D48]/12 shadow-sm">
              <div className="text-[11px] text-[#4A6B67] font-semibold">High-Priority Topics</div>
              <div className="text-2xl font-bold text-rose-600 font-mono mt-1">
                {topicIntelligenceItems.filter((i) => i.priorityLevel === 'High Priority').length}
              </div>
            </div>
            <div className="p-4 rounded-xl bg-white border border-[#1B4D48]/12 shadow-sm">
              <div className="text-[11px] text-[#4A6B67] font-semibold">Topics with PYQ Matches</div>
              <div className="text-2xl font-bold text-[#42BDAE] font-mono mt-1">
                {topicIntelligenceItems.filter((i) => i.pyqCount > 0).length}
              </div>
            </div>
            <div className="p-4 rounded-xl bg-white border border-[#1B4D48]/12 shadow-sm">
              <div className="text-[11px] text-[#4A6B67] font-semibold">Insufficient PYQ Evidence</div>
              <div className="text-2xl font-bold text-[#4A6B67] font-mono mt-1">
                {
                  topicIntelligenceItems.filter(
                    (i) => i.priorityLevel === 'Insufficient PYQ evidence'
                  ).length
                }
              </div>
            </div>
          </div>

          {/* Comprehensive Filters Bar */}
          <div className="p-4 rounded-2xl bg-white border border-[#1B4D48]/12 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#1B4D48] flex items-center gap-1.5">
                <SlidersHorizontal className="w-3.5 h-3.5 text-[#42BDAE]" />
                Filter Topic Intelligence Ranking
              </span>
              <button
                onClick={() => {
                  setIntelSubjectFilter('all');
                  setIntelChapterFilter('all');
                  setIntelYearFilter('all');
                  setIntelStatusFilter('all');
                  setIntelPriorityFilter('all');
                  setIntelSearch('');
                }}
                className="text-[11px] font-bold text-[#42BDAE] hover:underline cursor-pointer"
              >
                Reset Filters
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[#4A6B67]" />
                <input
                  type="text"
                  placeholder="Search topic or chapter..."
                  value={intelSearch}
                  onChange={(e) => setIntelSearch(e.target.value)}
                  className="w-full pl-8 pr-2.5 py-2 rounded-xl bg-[#FBF7EF] border border-[#1B4D48]/15 text-xs text-[#1B4D48]"
                />
              </div>

              <select
                value={intelSubjectFilter}
                onChange={(e) => {
                  setIntelSubjectFilter(e.target.value);
                  setIntelChapterFilter('all');
                }}
                className="p-2 rounded-xl bg-[#FBF7EF] border border-[#1B4D48]/15 text-xs text-[#1B4D48] font-medium"
              >
                <option value="all">All Subjects</option>
                {activeSyllabus.subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>

              <select
                value={intelChapterFilter}
                onChange={(e) => setIntelChapterFilter(e.target.value)}
                className="p-2 rounded-xl bg-[#FBF7EF] border border-[#1B4D48]/15 text-xs text-[#1B4D48] font-medium"
              >
                <option value="all">All Chapters</option>
                {availableChaptersForIntel.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>

              <select
                value={intelYearFilter}
                onChange={(e) => setIntelYearFilter(e.target.value)}
                className="p-2 rounded-xl bg-[#FBF7EF] border border-[#1B4D48]/15 text-xs text-[#1B4D48] font-medium"
              >
                <option value="all">All Exam Years</option>
                {availableYears.map((yr) => (
                  <option key={yr} value={yr}>
                    {yr} Paper
                  </option>
                ))}
              </select>

              <select
                value={intelStatusFilter}
                onChange={(e) => setIntelStatusFilter(e.target.value)}
                className="p-2 rounded-xl bg-[#FBF7EF] border border-[#1B4D48]/15 text-xs text-[#1B4D48] font-medium"
              >
                <option value="all">All Completion Statuses</option>
                <option value="Not Started">Not Started</option>
                <option value="In Progress">In Progress</option>
                <option value="Completed">Completed</option>
                <option value="Needs Revision">Needs Revision</option>
                <option value="On Hold">On Hold</option>
              </select>

              <select
                value={intelPriorityFilter}
                onChange={(e) => setIntelPriorityFilter(e.target.value)}
                className="p-2 rounded-xl bg-[#FBF7EF] border border-[#1B4D48]/15 text-xs text-[#1B4D48] font-medium"
              >
                <option value="all">All Priority Levels</option>
                <option value="High Priority">High Priority</option>
                <option value="Moderate Priority">Moderate Priority</option>
                <option value="Standard Priority">Standard Priority</option>
                <option value="Insufficient PYQ evidence">Insufficient PYQ evidence</option>
              </select>
            </div>
          </div>

          {/* Ranked Topic List */}
          <div className="space-y-3">
            {filteredIntelItems.map((item, idx) => {
              const priorityBadgeClass =
                item.priorityLevel === 'High Priority'
                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                  : item.priorityLevel === 'Moderate Priority'
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : item.priorityLevel === 'Standard Priority'
                  ? 'bg-[#75D9B4]/20 text-[#1B4D48] border-[#42BDAE]/40'
                  : 'bg-[#FBF7EF] text-[#4A6B67] border-[#1B4D48]/15';

              const sourceStrings = item.sources.map(
                (s) =>
                  `${s.sourceFileName || s.examName}${s.pageNumber ? ` (p.${s.pageNumber})` : ''}`
              );

              return (
                <div
                  key={item.topicId}
                  className="p-4 sm:p-5 rounded-2xl bg-white border border-[#1B4D48]/12 hover:border-[#42BDAE] shadow-sm transition space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-[#FBF7EF] text-[#1B4D48] border border-[#1B4D48]/15">
                          #{idx + 1}
                        </span>
                        <span
                          className="text-[11px] font-bold px-2 py-0.5 rounded"
                          style={{
                            backgroundColor: `${item.subjectColor}20`,
                            color: item.subjectColor,
                          }}
                        >
                          {item.subjectName}
                        </span>
                        <span className="text-xs text-[#4A6B67] font-semibold">
                          {item.chapterTitle}
                        </span>
                        <span
                          className={`text-[11px] font-bold px-2.5 py-0.5 rounded-md border ${priorityBadgeClass}`}
                        >
                          {item.priorityLevel}
                        </span>
                      </div>

                      <h3 className="text-sm sm:text-base font-bold text-[#1B4D48]">
                        {item.topicTitle}
                      </h3>

                      {item.subtopics.length > 0 && (
                        <div className="text-[11px] text-[#4A6B67]">
                          <span className="text-[#1B4D48] font-semibold">Subtopics: </span>
                          {item.subtopics.join(' • ')}
                        </div>
                      )}
                    </div>

                    {/* Completion Status & Quick Detail Button */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <select
                        value={item.completionStatus}
                        onChange={(e) =>
                          updateTopicMastery(item.topicId, {
                            status: e.target.value as TopicStatus,
                          })
                        }
                        className="px-2.5 py-1.5 rounded-xl bg-[#FBF7EF] border border-[#1B4D48]/20 text-xs font-bold text-[#1B4D48]"
                      >
                        <option value="Not Started">Not Started</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Completed">Completed</option>
                        <option value="Needs Revision">Needs Revision</option>
                        <option value="On Hold">On Hold</option>
                      </select>

                      {onSelectTopic && (
                        <button
                          onClick={() => onSelectTopic(item.topicId)}
                          className="px-3 py-1.5 rounded-xl bg-[#42BDAE]/15 hover:bg-[#42BDAE]/25 text-[#1B4D48] border border-[#42BDAE]/30 text-xs font-bold flex items-center gap-1 transition cursor-pointer"
                        >
                          <span>Details</span>
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Evidence Metrics Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 border-t border-[#1B4D48]/10 text-xs">
                    <div className="p-2.5 rounded-xl bg-[#FBF7EF] border border-[#1B4D48]/10">
                      <span className="text-[10px] text-[#4A6B67] uppercase font-bold block">
                        PYQ Frequency & Marks
                      </span>
                      <span className="font-mono font-bold text-[#1B4D48] mt-0.5 block">
                        {item.pyqCount > 0
                          ? `${item.pyqCount} Qs • ${item.totalPyqMarks} Marks`
                          : '0 Matching PYQs'}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-[#FBF7EF] border border-[#1B4D48]/10">
                      <span className="text-[10px] text-[#4A6B67] uppercase font-bold block">
                        Relevant Years
                      </span>
                      <span className="font-mono font-bold text-[#1B4D48] mt-0.5 block">
                        {item.yearsAppeared.length > 0
                          ? item.yearsAppeared.join(', ')
                          : 'None in uploaded papers'}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-[#FBF7EF] border border-[#1B4D48]/10">
                      <span className="text-[10px] text-[#4A6B67] uppercase font-bold block">
                        Question Patterns
                      </span>
                      <span className="font-semibold text-[#1B4D48] mt-0.5 block truncate">
                        {item.questionPatterns.length > 0
                          ? item.questionPatterns.join(', ')
                          : 'Standard syllabus item'}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-[#FBF7EF] border border-[#1B4D48]/10">
                      <span className="text-[10px] text-[#4A6B67] uppercase font-bold block">
                        Source Document & Page
                      </span>
                      <span className="font-semibold text-[#1B4D48] mt-0.5 block truncate">
                        {sourceStrings.length > 0
                          ? sourceStrings.join('; ')
                          : 'Syllabus baseline'}
                      </span>
                    </div>
                  </div>

                  {/* Reason for Ranking */}
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs bg-[#75D9B4]/10 px-3 py-2 rounded-xl border border-[#42BDAE]/25">
                    <div className="text-[#1B4D48]">
                      <span className="font-bold text-[#1B4D48]">Ranking Evidence: </span>
                      {item.priorityReason}
                    </div>
                    {item.prerequisites.length > 0 && (
                      <span className="text-[11px] text-amber-800 font-semibold">
                        Prerequisites: {item.prerequisites.join(', ')}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* =====================================================================
          MODE 1B: CHAPTER MARKS WEIGHTAGE & RECONCILIATION ANALYTICS
          ===================================================================== */}
      {activeMode === 'weightage' && (
        <div className="space-y-4">
          <div className="p-5 rounded-2xl bg-white border border-[#1B4D48]/12 shadow-sm">
            <h3 className="text-base font-bold text-[#1B4D48] flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-[#42BDAE]" />
              Chapter-Wise Official RBSE Weightage vs. Observed PYQ Marks
            </h3>
            <p className="text-xs text-[#4A6B67] mt-1">
              Compulsory marks exclude internal OR/अथवा alternatives so chapter weightage is never inflated by optional question choices.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {chapterWeightageList.map((ch) => (
              <div
                key={ch.chapterId}
                className="p-4 rounded-2xl bg-white border border-[#1B4D48]/12 shadow-sm flex flex-col justify-between gap-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#75D9B4]/20 text-[#1B4D48]">
                      {ch.subjectName}
                    </span>
                    <h4 className="text-sm font-bold text-[#1B4D48] mt-1">{ch.chapterTitle}</h4>
                  </div>
                  <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-[#FBF7EF] border border-[#1B4D48]/15 text-[#1B4D48]">
                    Official: {ch.officialBlueprintMarks ?? 'N/A'}M
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="p-2.5 rounded-xl bg-[#FBF7EF] border border-[#1B4D48]/10">
                    <span className="text-[10px] text-[#4A6B67] block">Compulsory PYQ Marks</span>
                    <span className="font-mono font-bold text-[#1B4D48] text-sm">
                      {ch.compulsoryMarksSum}M
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-[#FBF7EF] border border-[#1B4D48]/10">
                    <span className="text-[10px] text-[#4A6B67] block">Optional OR Marks</span>
                    <span className="font-mono font-bold text-[#42BDAE] text-sm">
                      {ch.optionalMarksSum}M
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-[#FBF7EF] border border-[#1B4D48]/10">
                    <span className="text-[10px] text-[#4A6B67] block">Questions</span>
                    <span className="font-mono font-bold text-[#1B4D48] text-sm">
                      {ch.questionAppearances} Qs
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =====================================================================
          MODE 2: PYQ QUESTION BANK
          ===================================================================== */}
      {activeMode === 'questions' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-2.5 p-4 rounded-2xl bg-white border border-[#1B4D48]/12 shadow-sm">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[#4A6B67]" />
              <input
                type="text"
                placeholder="Search question text..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-2 rounded-xl bg-[#FBF7EF] border border-[#1B4D48]/15 text-xs text-[#1B4D48]"
              />
            </div>

            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="p-2 rounded-xl bg-[#FBF7EF] border border-[#1B4D48]/15 text-xs text-[#1B4D48] font-medium"
            >
              <option value="all">All Subjects</option>
              {activeSyllabus.subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>

            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="p-2 rounded-xl bg-[#FBF7EF] border border-[#1B4D48]/15 text-xs text-[#1B4D48] font-medium"
            >
              <option value="all">All Years</option>
              {availableYears.map((yr) => (
                <option key={yr} value={yr}>
                  {yr}
                </option>
              ))}
            </select>

            <select
              value={selectedOrigin}
              onChange={(e) => setSelectedOrigin(e.target.value)}
              className="p-2 rounded-xl bg-[#FBF7EF] border border-[#1B4D48]/15 text-xs text-[#1B4D48] font-medium"
            >
              <option value="all">All Question Sources</option>
              <option value="extracted">Extracted from Uploaded PDF</option>
              <option value="verified">Verified Board Paper</option>
              <option value="ai">AI-Generated Practice</option>
              <option value="unmatched">Unmatched (Needs Classification)</option>
            </select>

            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="p-2 rounded-xl bg-[#FBF7EF] border border-[#1B4D48]/15 text-xs text-[#1B4D48] font-medium"
            >
              <option value="all">All Attempt Statuses</option>
              <option value="unattempted">Unattempted</option>
              <option value="correct">Solved Correctly</option>
              <option value="incorrect">Incorrect</option>
              <option value="needs_practice">Needs Practice</option>
            </select>
          </div>

          {filteredPYQs.length === 0 ? (
            <div className="p-12 text-center rounded-2xl bg-white border border-[#1B4D48]/12 text-xs text-[#4A6B67]">
              No questions match your current filters.
            </div>
          ) : (
            <div className="space-y-3">
              {filteredPYQs.map((q) => {
                const isRevealed = revealedSolutions[q.id];
                const sub = activeSyllabus.subjects.find((s) => s.id === q.subjectId);
                const allChaps = sub?.units.flatMap((u) => u.chapters) || [];
                const chap = allChaps.find((c) => c.id === q.chapterId);
                const allTopics = chap?.topics || [];

                return (
                  <div
                    key={q.id}
                    className="p-5 rounded-2xl bg-white border border-[#1B4D48]/12 shadow-sm space-y-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1B4D48]/10 pb-2.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#69B7EC]/20 text-[#1B4D48]">
                          {q.subjectName}
                        </span>
                        <span className="text-xs font-bold text-[#1B4D48]">
                          {q.chapterTitle}
                        </span>
                        {q.topicTitle && (
                          <span className="text-xs text-[#42BDAE] font-bold">
                            → {q.topicTitle}
                          </span>
                        )}
                        {q.isOptionalAlternative && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#B8A4EF]/25 text-[#1B4D48] border border-[#B8A4EF]/40">
                            OR / अथवा Alternative Choice
                          </span>
                        )}
                        {q.isUnmatched && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-300">
                            Unmatched Topic — Classify Below
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        {q.verificationStatus === 'ai_practice' ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#B8A4EF]/20 text-[#1B4D48] border border-[#B8A4EF]/40">
                            AI-Generated Practice Question
                          </span>
                        ) : q.verificationStatus === 'uploaded_pending' ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#75D9B4]/25 text-[#1B4D48] border border-[#42BDAE]/40">
                            Extracted PYQ • {q.sourceFileName || q.source}
                            {q.pageNumber ? ` (p.${q.pageNumber})` : ''}
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#69B7EC]/20 text-[#1B4D48]">
                            Verified PYQ • {q.examYear}
                          </span>
                        )}

                        <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-[#FBF7EF] border border-[#1B4D48]/15 text-[#1B4D48]">
                          {q.marks} Marks
                        </span>
                        {q.questionType && (
                          <span className="text-[10px] px-2 py-0.5 rounded bg-[#FBF7EF] border border-[#1B4D48]/10 text-[#4A6B67] font-semibold">
                            {q.questionType}
                          </span>
                        )}
                        <button
                          onClick={() => deletePYQ(q.id)}
                          title="Delete Question"
                          className="p-1 text-[#4A6B67] hover:text-rose-600 transition cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <p className="text-sm text-[#1B4D48] leading-relaxed font-medium">
                      {q.questionText}
                    </p>

                    {/* Manual Topic Classification for Unmatched Questions */}
                    {q.isUnmatched && (
                      <div className="p-3 rounded-xl bg-[#FBF7EF] border border-amber-300 flex flex-wrap items-center gap-2 text-xs">
                        <span className="text-amber-800 font-bold">Classify into Syllabus:</span>
                        <select
                          value={q.subjectId}
                          onChange={(e) => {
                            const s = activeSyllabus.subjects.find((x) => x.id === e.target.value);
                            if (s) {
                              updatePYQ(q.id, { subjectId: s.id, subjectName: s.name });
                            }
                          }}
                          className="px-2 py-1 rounded bg-white border border-[#1B4D48]/20 text-[#1B4D48]"
                        >
                          {activeSyllabus.subjects.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </select>

                        <select
                          value={q.chapterId}
                          onChange={(e) => {
                            const c = allChaps.find((x) => x.id === e.target.value);
                            if (c) {
                              updatePYQ(q.id, { chapterId: c.id, chapterTitle: c.title });
                            }
                          }}
                          className="px-2 py-1 rounded bg-white border border-[#1B4D48]/20 text-[#1B4D48]"
                        >
                          <option value="unmatched">Select Chapter...</option>
                          {allChaps.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.title}
                            </option>
                          ))}
                        </select>

                        <select
                          value={q.topicId || ''}
                          onChange={(e) => {
                            const t = allTopics.find((x) => x.id === e.target.value);
                            if (t) {
                              updatePYQ(q.id, {
                                topicId: t.id,
                                topicTitle: t.title,
                                isUnmatched: false,
                              });
                            }
                          }}
                          className="px-2 py-1 rounded bg-white border border-[#1B4D48]/20 text-[#1B4D48]"
                        >
                          <option value="">Select Topic...</option>
                          {allTopics.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.title}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Solution & Attempt Controls */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => updatePYQAttempt(q.id, 'correct')}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition cursor-pointer ${
                            q.attemptStatus === 'correct'
                              ? 'bg-[#1B4D48] text-white'
                              : 'bg-[#FBF7EF] text-[#1B4D48] border border-[#1B4D48]/15 hover:bg-[#75D9B4]/20'
                          }`}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Solved
                        </button>
                        <button
                          onClick={() => updatePYQAttempt(q.id, 'incorrect')}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition cursor-pointer ${
                            q.attemptStatus === 'incorrect'
                              ? 'bg-rose-600 text-white'
                              : 'bg-[#FBF7EF] text-[#1B4D48] border border-[#1B4D48]/15 hover:bg-rose-50'
                          }`}
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          Incorrect
                        </button>
                        <button
                          onClick={() => updatePYQAttempt(q.id, 'needs_practice')}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition cursor-pointer ${
                            q.attemptStatus === 'needs_practice'
                              ? 'bg-amber-600 text-white'
                              : 'bg-[#FBF7EF] text-[#1B4D48] border border-[#1B4D48]/15 hover:bg-amber-50'
                          }`}
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          Revise Later
                        </button>
                      </div>

                      {q.solution && (
                        <button
                          onClick={() =>
                            setRevealedSolutions((prev) => ({ ...prev, [q.id]: !prev[q.id] }))
                          }
                          className="text-xs font-bold text-[#42BDAE] hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          {isRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          {isRevealed ? 'Hide Solution' : 'View Solution'}
                        </button>
                      )}
                    </div>

                    {isRevealed && q.solution && (
                      <div className="p-3 rounded-xl bg-[#FBF7EF] border border-[#1B4D48]/15 text-xs text-[#1B4D48] whitespace-pre-wrap">
                        <span className="font-bold text-[#42BDAE] block mb-1">Key / Solution:</span>
                        {q.solution}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          MODE 3: COMBINED PDF IMPORT & MARKS RECONCILIATION REVIEW
          ===================================================================== */}
      {activeMode === 'import' && (
        <div className="space-y-5">
          <div className="p-6 rounded-2xl bg-white border-2 border-dashed border-[#42BDAE]/50 hover:border-[#1B4D48] transition text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-[#75D9B4]/25 text-[#1B4D48] flex items-center justify-center mx-auto">
              <Upload className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#1B4D48]">
                Select One or Multiple PYQ PDF Papers
              </h3>
              <p className="text-xs text-[#4A6B67] mt-1 max-w-lg mx-auto">
                Upload RBSE Board Papers, Model Papers, or Question Banks. AZORA automatically separates compulsory questions from internal OR (अथवा) alternatives and reconciles total marks.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2.5 rounded-xl bg-[#1B4D48] hover:bg-[#153D39] text-white text-xs font-bold transition cursor-pointer"
              >
                Browse PDF Files
              </button>
              <button
                onClick={() => setShowManualPaste(!showManualPaste)}
                className="px-4 py-2.5 rounded-xl bg-[#FBF7EF] hover:bg-[#75D9B4]/20 text-[#1B4D48] border border-[#1B4D48]/20 text-xs font-bold transition cursor-pointer"
              >
                {showManualPaste ? 'Hide Manual Text Input' : 'Paste PYQ Text Manually'}
              </button>
            </div>

            {uploadedFileNames.length > 0 && (
              <div className="pt-2 flex flex-wrap items-center justify-center gap-2">
                <span className="text-[11px] text-[#4A6B67] font-semibold">Combined PDFs in session:</span>
                {uploadedFileNames.map((fn) => (
                  <span
                    key={fn}
                    className="text-[11px] font-mono px-2.5 py-1 rounded-lg bg-[#FBF7EF] border border-[#1B4D48]/20 text-[#1B4D48] font-bold"
                  >
                    {fn}
                  </span>
                ))}
              </div>
            )}
          </div>

          {showManualPaste && (
            <div className="p-5 rounded-2xl bg-white border border-[#1B4D48]/15 shadow-sm space-y-3">
              <h4 className="text-xs font-bold text-[#1B4D48]">
                Paste Raw Question Paper Text for Extraction & Marks Reconciliation
              </h4>
              <textarea
                rows={5}
                value={manualPasteText}
                onChange={(e) => setManualPasteText(e.target.value)}
                placeholder="Example: Maximum Marks: 56&#10;Q1. State Gauss's Law in electrostatics and derive electric field due to an infinite line charge. [4 Marks]&#10;OR&#10;Derive expression for electric potential due to an electric dipole. [4 Marks]"
                className="w-full p-3 rounded-xl bg-[#FBF7EF] border border-[#1B4D48]/20 text-xs text-[#1B4D48]"
              />
              <button
                onClick={handleParseManualText}
                className="px-4 py-2 rounded-xl bg-[#1B4D48] hover:bg-[#153D39] text-white text-xs font-bold cursor-pointer"
              >
                Extract, Reconcile Marks & Match Questions
              </button>
            </div>
          )}

          {/* TRANSPARENT MARKS RECONCILIATION REPORT */}
          {marksReconciliationReport && (
            <div className="p-5 rounded-2xl bg-white border-2 border-[#42BDAE]/40 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#1B4D48]/10 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-[#75D9B4]/25 text-[#1B4D48]">
                    <Scale className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-bold text-[#1B4D48]">
                        Paper Marks Reconciliation Report
                      </h3>
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-[#69B7EC]/20 text-[#1B4D48]">
                        Doc Type: {marksReconciliationReport.documentCategory.replace(/_/g, ' ')}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          marksReconciliationReport.reconciliationStatus === 'verified_match'
                            ? 'bg-[#75D9B4]/30 text-[#1B4D48]'
                            : marksReconciliationReport.reconciliationStatus === 'discrepancy_detected'
                            ? 'bg-amber-100 text-amber-900'
                            : 'bg-[#FBF7EF] text-[#4A6B67]'
                        }`}
                      >
                        {marksReconciliationReport.reconciliationStatus === 'verified_match'
                          ? '✓ Reconciled with Paper Total'
                          : marksReconciliationReport.reconciliationStatus === 'discrepancy_detected'
                          ? '⚠ Review Marks Discrepancy'
                          : 'No Header Total Detected'}
                      </span>
                    </div>
                    <p className="text-xs text-[#4A6B67] mt-0.5">
                      Internal OR / अथवा choices are separated from Compulsory Marks so 56-mark or 80-mark papers are never double-counted.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <label className="text-[#4A6B67] font-semibold">Expected Paper Max Marks:</label>
                  <input
                    type="number"
                    min={1}
                    max={300}
                    value={
                      declaredPaperTotalOverride ??
                      marksReconciliationReport.officialMaxMarks ??
                      ''
                    }
                    placeholder="e.g. 56"
                    onChange={(e) =>
                      setDeclaredPaperTotalOverride(
                        e.target.value ? Number(e.target.value) : null
                      )
                    }
                    className="w-20 px-2.5 py-1.5 rounded-lg bg-[#FBF7EF] border border-[#1B4D48]/20 text-xs font-mono font-bold text-[#1B4D48]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-[#75D9B4]/15 border border-[#42BDAE]/30">
                  <span className="text-[10px] uppercase font-bold text-[#1B4D48] block">
                    Compulsory Paper Marks
                  </span>
                  <span className="text-xl font-mono font-bold text-[#1B4D48]">
                    {marksReconciliationReport.compulsoryMarksSum} Marks
                  </span>
                  <span className="text-[10px] text-[#4A6B67] block mt-0.5">
                    Excludes OR alternatives
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-[#B8A4EF]/15 border border-[#B8A4EF]/30">
                  <span className="text-[10px] uppercase font-bold text-[#1B4D48] block">
                    Optional OR / अथवा Marks
                  </span>
                  <span className="text-xl font-mono font-bold text-[#1B4D48]">
                    {marksReconciliationReport.optionalAlternativeMarksSum} Marks
                  </span>
                  <span className="text-[10px] text-[#4A6B67] block mt-0.5">
                    Internal choice questions
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-[#FBF7EF] border border-[#1B4D48]/15">
                  <span className="text-[10px] uppercase font-bold text-[#4A6B67] block">
                    Declared Paper Total
                  </span>
                  <span className="text-xl font-mono font-bold text-[#1B4D48]">
                    {marksReconciliationReport.officialMaxMarks
                      ? `${marksReconciliationReport.officialMaxMarks} Marks`
                      : 'Not Set'}
                  </span>
                  <span className="text-[10px] text-[#4A6B67] block mt-0.5">
                    RBSE Physics/Chem: 56 • Math: 80
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-[#FBF7EF] border border-[#1B4D48]/15">
                  <span className="text-[10px] uppercase font-bold text-[#4A6B67] block">
                    Defaulted / Missing Marks
                  </span>
                  <span className="text-xl font-mono font-bold text-[#1B4D48]">
                    {marksReconciliationReport.questionsWithMissingMarks} Qs
                  </span>
                  <span className="text-[10px] text-[#4A6B67] block mt-0.5">
                    Editable in review list below
                  </span>
                </div>
              </div>

              {marksReconciliationReport.discrepancies.length > 0 && (
                <div className="p-3 rounded-xl bg-[#FBF7EF] border border-[#1B4D48]/15 space-y-1">
                  <div className="text-[11px] font-bold text-[#1B4D48]">
                    Reconciliation Diagnostics:
                  </div>
                  <ul className="list-disc pl-4 text-xs text-[#4A6B67] space-y-0.5">
                    {marksReconciliationReport.discrepancies.map((d, i) => (
                      <li key={i}>{d}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Review Extracted Questions Before Saving */}
          {extractedCandidates.length > 0 && (
            <div className="p-5 rounded-2xl bg-white border border-[#1B4D48]/15 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#1B4D48]/10 pb-4">
                <div>
                  <h3 className="text-base font-bold text-[#1B4D48]">
                    Review Extracted PYQs ({extractedCandidates.filter((c) => c.selected).length} of{' '}
                    {extractedCandidates.length} Selected)
                  </h3>
                  <p className="text-xs text-[#4A6B67] mt-0.5">
                    Verify syllabus topic matches, edit question marks, or toggle "OR Choice" if a question is an internal alternative.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setExtractedCandidates([]);
                      setDeclaredPaperTotalOverride(null);
                    }}
                    className="px-3 py-2 rounded-xl bg-[#FBF7EF] hover:bg-rose-50 text-[#1B4D48] border border-[#1B4D48]/15 text-xs font-bold cursor-pointer"
                  >
                    Clear Queue
                  </button>
                  <button
                    onClick={handleConfirmImportCandidates}
                    className="px-4 py-2 rounded-xl bg-[#1B4D48] hover:bg-[#153D39] text-white text-xs font-bold shadow-sm cursor-pointer"
                  >
                    Confirm & Save {extractedCandidates.filter((c) => c.selected).length} PYQs
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setCandidateFilter('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                    candidateFilter === 'all'
                      ? 'bg-[#1B4D48] text-white'
                      : 'bg-[#FBF7EF] text-[#4A6B67] border border-[#1B4D48]/15'
                  }`}
                >
                  All Extracted ({extractedCandidates.length})
                </button>
                <button
                  onClick={() => setCandidateFilter('optional_or')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                    candidateFilter === 'optional_or'
                      ? 'bg-[#B8A4EF] text-[#1B4D48]'
                      : 'bg-[#FBF7EF] text-[#4A6B67] border border-[#1B4D48]/15'
                  }`}
                >
                  OR / अथवा Alternatives (
                  {extractedCandidates.filter((c) => c.isOptionalAlternative).length})
                </button>
                <button
                  onClick={() => setCandidateFilter('unmatched')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                    candidateFilter === 'unmatched'
                      ? 'bg-amber-600 text-white'
                      : 'bg-[#FBF7EF] text-[#4A6B67] border border-[#1B4D48]/15'
                  }`}
                >
                  Unmatched Questions ({extractedCandidates.filter((c) => c.isUnmatched).length})
                </button>
                <button
                  onClick={() => setCandidateFilter('duplicates')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                    candidateFilter === 'duplicates'
                      ? 'bg-[#42BDAE] text-white'
                      : 'bg-[#FBF7EF] text-[#4A6B67] border border-[#1B4D48]/15'
                  }`}
                >
                  Probable Duplicates ({extractedCandidates.filter((c) => c.isDuplicate).length})
                </button>
              </div>

              <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                {filteredCandidates.map((cand) => {
                  const sub = activeSyllabus.subjects.find((s) => s.id === cand.subjectId);
                  const chaps = sub?.units.flatMap((u) => u.chapters) || [];
                  const chap = chaps.find((c) => c.id === cand.chapterId);
                  const topics = chap?.topics || [];

                  return (
                    <div
                      key={cand.id}
                      className={`p-4 rounded-xl border space-y-3 ${
                        cand.selected
                          ? 'bg-[#FBF7EF]/70 border-[#1B4D48]/20'
                          : 'bg-[#FBF7EF]/30 border-[#1B4D48]/10 opacity-60'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            onClick={() =>
                              handleUpdateCandidate(cand.id, { selected: !cand.selected })
                            }
                            className="text-[#1B4D48] cursor-pointer"
                          >
                            {cand.selected ? (
                              <CheckSquare className="w-4 h-4 text-[#42BDAE]" />
                            ) : (
                              <Square className="w-4 h-4 text-[#4A6B67]" />
                            )}
                          </button>
                          <span className="text-[11px] font-mono font-bold text-[#1B4D48]">
                            {cand.sourceFileName} • Page {cand.pageNumber}
                          </span>
                          {cand.sectionLabel && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#69B7EC]/20 text-[#1B4D48]">
                              {cand.sectionLabel}
                            </span>
                          )}
                          {cand.marksRawSnippet && (
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white border border-[#1B4D48]/15 text-[#4A6B67]">
                              Parsed: "{cand.marksRawSnippet}" ({cand.marksConfidence})
                            </span>
                          )}
                          {cand.isUnmatched && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                              Unmatched Topic
                            </span>
                          )}
                          {cand.isDuplicate && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#B8A4EF]/25 text-[#1B4D48]">
                              Probable Duplicate
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            type="button"
                            onClick={() =>
                              handleUpdateCandidate(cand.id, {
                                isOptionalAlternative: !cand.isOptionalAlternative,
                              })
                            }
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 border transition cursor-pointer ${
                              cand.isOptionalAlternative
                                ? 'bg-[#B8A4EF]/30 text-[#1B4D48] border-[#B8A4EF]'
                                : 'bg-white text-[#4A6B67] border-[#1B4D48]/15 hover:text-[#1B4D48]'
                            }`}
                            title="Mark as OR / अथवा Optional Choice (Excluded from Compulsory Paper Total)"
                          >
                            <GitBranch className="w-3 h-3" />
                            {cand.isOptionalAlternative ? 'OR Choice (Excluded from Total)' : 'Compulsory Q'}
                          </button>

                          <input
                            type="text"
                            value={cand.examYear}
                            onChange={(e) =>
                              handleUpdateCandidate(cand.id, { examYear: e.target.value })
                            }
                            className="w-16 px-2 py-1 rounded bg-white border border-[#1B4D48]/20 text-xs text-[#1B4D48] font-mono font-bold"
                            placeholder="Year"
                          />
                          <input
                            type="number"
                            min={0.5}
                            step={0.5}
                            max={15}
                            value={cand.marks}
                            onChange={(e) =>
                              handleUpdateCandidate(cand.id, {
                                marks: Number(e.target.value),
                                marksConfidence: 'high',
                              })
                            }
                            className="w-16 px-2 py-1 rounded bg-white border border-[#1B4D48]/20 text-xs text-[#1B4D48] font-mono font-bold"
                            title="Marks"
                          />
                          <select
                            value={cand.questionType}
                            onChange={(e) =>
                              handleUpdateCandidate(cand.id, {
                                questionType: e.target.value,
                              })
                            }
                            className="px-2 py-1 rounded bg-white border border-[#1B4D48]/20 text-xs text-[#1B4D48] font-semibold"
                          >
                            <option value="MCQ">MCQ</option>
                            <option value="Fill in the Blank">Fill in the Blank</option>
                            <option value="Very Short">Very Short</option>
                            <option value="Short Answer">Short Answer</option>
                            <option value="Long Answer">Long Answer</option>
                            <option value="Derivation">Derivation</option>
                            <option value="Numerical">Numerical</option>
                          </select>
                        </div>
                      </div>

                      <textarea
                        rows={2}
                        value={cand.questionText}
                        onChange={(e) =>
                          handleUpdateCandidate(cand.id, { questionText: e.target.value })
                        }
                        className="w-full p-2.5 rounded-lg bg-white border border-[#1B4D48]/20 text-xs text-[#1B4D48] font-medium"
                      />

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                        <select
                          value={cand.subjectId}
                          onChange={(e) => {
                            const s = activeSyllabus.subjects.find((x) => x.id === e.target.value);
                            if (s) {
                              handleUpdateCandidate(cand.id, {
                                subjectId: s.id,
                                subjectName: s.name,
                                chapterId: 'unmatched',
                                chapterTitle: 'Unclassified Chapter',
                                topicId: undefined,
                                topicTitle: undefined,
                                isUnmatched: true,
                              });
                            }
                          }}
                          className="p-1.5 rounded bg-white border border-[#1B4D48]/20 text-[#1B4D48] font-medium"
                        >
                          {activeSyllabus.subjects.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </select>

                        <select
                          value={cand.chapterId}
                          onChange={(e) => {
                            const c = chaps.find((x) => x.id === e.target.value);
                            handleUpdateCandidate(cand.id, {
                              chapterId: c ? c.id : 'unmatched',
                              chapterTitle: c ? c.title : 'Unclassified Chapter',
                              topicId: undefined,
                              topicTitle: undefined,
                              isUnmatched: true,
                            });
                          }}
                          className="p-1.5 rounded bg-white border border-[#1B4D48]/20 text-[#1B4D48] font-medium"
                        >
                          <option value="unmatched">-- Select Chapter --</option>
                          {chaps.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.title}
                            </option>
                          ))}
                        </select>

                        <select
                          value={cand.topicId || 'unmatched'}
                          onChange={(e) => {
                            const t = topics.find((x) => x.id === e.target.value);
                            handleUpdateCandidate(cand.id, {
                              topicId: t ? t.id : undefined,
                              topicTitle: t ? t.title : undefined,
                              isUnmatched: !t,
                            });
                          }}
                          className="p-1.5 rounded bg-white border border-[#1B4D48]/20 text-[#1B4D48] font-medium"
                        >
                          <option value="unmatched">-- Select Syllabus Topic --</option>
                          {topics.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.title}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add Manual Question Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1B4D48]/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl bg-[#FBF7EF] border border-[#1B4D48]/20 p-5 space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-[#1B4D48]">Add PYQ or Practice Question</h3>
            <form onSubmit={handleAddManualQuestion} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[#4A6B67] font-semibold block mb-1">Subject</label>
                  <select
                    value={newSubjectId}
                    onChange={(e) => {
                      setNewSubjectId(e.target.value);
                      setNewChapterId('');
                      setNewTopicId('');
                    }}
                    className="w-full p-2 rounded-xl bg-white border border-[#1B4D48]/20 text-[#1B4D48]"
                  >
                    {activeSyllabus.subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[#4A6B67] font-semibold block mb-1">Chapter</label>
                  <select
                    value={newChapterId}
                    onChange={(e) => {
                      setNewChapterId(e.target.value);
                      setNewTopicId('');
                    }}
                    className="w-full p-2 rounded-xl bg-white border border-[#1B4D48]/20 text-[#1B4D48]"
                  >
                    <option value="">Select Chapter</option>
                    {activeSyllabus.subjects
                      .find((s) => s.id === newSubjectId)
                      ?.units.flatMap((u) => u.chapters)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.title}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[#4A6B67] font-semibold block mb-1">Link to Syllabus Topic</label>
                <select
                  value={newTopicId}
                  onChange={(e) => setNewTopicId(e.target.value)}
                  className="w-full p-2 rounded-xl bg-white border border-[#1B4D48]/20 text-[#1B4D48]"
                >
                  <option value="">Unmatched / General Chapter Question</option>
                  {activeSyllabus.subjects
                    .find((s) => s.id === newSubjectId)
                    ?.units.flatMap((u) => u.chapters)
                    .find((c) => c.id === newChapterId)
                    ?.topics.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title}
                      </option>
                    ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="text-[#4A6B67] font-semibold block mb-1">Year</label>
                  <input
                    type="text"
                    value={newYear}
                    onChange={(e) => setNewYear(e.target.value)}
                    className="w-full p-2 rounded-xl bg-white border border-[#1B4D48]/20 text-[#1B4D48]"
                  />
                </div>
                <div>
                  <label className="text-[#4A6B67] font-semibold block mb-1">Marks</label>
                  <input
                    type="number"
                    value={newMarks}
                    onChange={(e) => setNewMarks(Number(e.target.value))}
                    className="w-full p-2 rounded-xl bg-white border border-[#1B4D48]/20 text-[#1B4D48]"
                  />
                </div>
                <div>
                  <label className="text-[#4A6B67] font-semibold block mb-1">Question Type</label>
                  <select
                    value={newQuestionType}
                    onChange={(e) => setNewQuestionType(e.target.value)}
                    className="w-full p-2 rounded-xl bg-white border border-[#1B4D48]/20 text-[#1B4D48]"
                  >
                    <option value="MCQ">MCQ</option>
                    <option value="Short Answer">Short Answer</option>
                    <option value="Long Answer">Long Answer</option>
                    <option value="Derivation">Derivation</option>
                    <option value="Numerical">Numerical</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[#4A6B67] font-semibold block mb-1">Question Text</label>
                <textarea
                  rows={3}
                  required
                  value={newQuestionText}
                  onChange={(e) => setNewQuestionText(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-white border border-[#1B4D48]/20 text-[#1B4D48]"
                />
              </div>

              <label className="flex items-center gap-2 text-[#1B4D48] font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={newIsAiGenerated}
                  onChange={(e) => setNewIsAiGenerated(e.target.checked)}
                />
                <span>Mark as AI-Generated Practice Question (Distinguished from actual PYQs)</span>
              </label>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl bg-white border border-[#1B4D48]/20 text-[#1B4D48] font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#1B4D48] text-white font-bold cursor-pointer"
                >
                  Save Question
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
