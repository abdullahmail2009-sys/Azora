import type {
  Subject,
  PYQRecord,
  TopicMasteryState,
  TopicStatus,
  MarksReconciliationReport,
  PDFDocumentCategory,
} from '../types/index.ts';
import { isTopicCompleted } from './progressCalc.ts';
import { classifyAcademicDocument } from './pdfSyllabusParser.ts';

export type EvidencePriorityLevel =
  | 'High Priority'
  | 'Moderate Priority'
  | 'Standard Priority'
  | 'Insufficient PYQ evidence';

export interface TopicIntelligenceItem {
  topicId: string;
  topicTitle: string;
  subtopics: string[];
  chapterId: string;
  chapterTitle: string;
  unitTitle: string;
  subjectId: string;
  subjectName: string;
  subjectColor: string;
  pyqCount: number;
  paperCount: number;
  yearsAppeared: string[];
  totalPyqMarks: number;
  compulsoryPyqMarks: number;
  optionalPyqMarks: number;
  questionPatterns: string[];
  completionStatus: TopicStatus;
  isCompleted: boolean;
  confidence: number | null; // null if unrated
  accuracyPercentage: number | null;
  estimatedHours: number;
  actualMinutes: number;
  personalPriority?: 'high' | 'medium' | 'low';
  priorityLevel: EvidencePriorityLevel;
  evidenceScore: number;
  priorityReason: string;
  mappingConfidenceAvg: number;
  prerequisites: string[];
  sources: {
    pyqId: string;
    year: string;
    examName: string;
    marks: number;
    isOptionalAlternative?: boolean;
    sourceFileName?: string;
    pageNumber?: number;
  }[];
}

export interface ChapterWeightageSummary {
  chapterId: string;
  chapterTitle: string;
  subjectId: string;
  subjectName: string;
  officialBlueprintMarks: number | null;
  questionAppearances: number;
  distinctPapersCount: number;
  compulsoryMarksSum: number;
  optionalMarksSum: number;
  totalMarksAllQuestions: number;
  yearsCovered: string[];
  averageMappingConfidence: number;
}

export interface ExtractedPYQCandidate {
  id: string;
  selected: boolean;
  questionNumber?: string;
  parentQuestionNumber?: string;
  sectionName?: string;
  sectionLabel?: string;
  marksRawSnippet?: string;
  optionalGroupKey?: string;
  examName: string;
  examYear: string;
  subjectId: string;
  subjectName: string;
  chapterId: string;
  chapterTitle: string;
  topicId?: string;
  topicTitle?: string;
  questionText: string;
  marks: number;
  marksConfidence: 'high' | 'medium' | 'low';
  isOptionalAlternative: boolean;
  alternativeToQuestionNumber?: string;
  questionType: string;
  sourceFileName: string;
  pageNumber: number;
  isUnmatched: boolean;
  mappingConfidence: number;
  mappingEvidence: string[];
  isDuplicate: boolean;
  duplicateOfId?: string;
  duplicateReason?: string;
  correctionHistory?: {
    timestamp: string;
    field: string;
    oldValue: string;
    newValue: string;
  }[];
}

/**
 * Normalizes text for token comparison and duplicate detection, preserving both Latin and Devanagari characters.
 */
export function normalizeTextForMatch(text: string): string {
  return (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\u0900-\u097F\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'that', 'this', 'what', 'when', 'where',
  'which', 'who', 'whom', 'whose', 'why', 'how', 'explain', 'define', 'derive',
  'state', 'write', 'find', 'calculate', 'prove', 'show', 'obtain', 'expression',
  'between', 'following', 'given', 'into', 'using', 'mark', 'marks', 'question',
  'unit', 'chapter', 'section', 'part', 'class', 'board', 'exam', 'examination',
  'any', 'two', 'three', 'one', 'short', 'note', 'example', 'suitable', 'diagram',
]);

export function getSignificantTokens(text: string): string[] {
  return normalizeTextForMatch(text)
    .split(' ')
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w));
}

/**
 * Computes Jaccard similarity between two strings based on significant tokens.
 */
export function computeTokenSimilarity(a: string, b: string): number {
  const tokensA = new Set(getSignificantTokens(a));
  const tokensB = new Set(getSignificantTokens(b));
  if (tokensA.size === 0 || tokensB.size === 0) return 0;
  let intersection = 0;
  for (const t of tokensA) {
    if (tokensB.has(t)) intersection++;
  }
  const union = tokensA.size + tokensB.size - intersection;
  return union > 0 ? intersection / union : 0;
}

/**
 * Classifies question type based on wording and marks.
 */
export function inferQuestionType(questionText: string, marks: number): string {
  const lower = questionText.toLowerCase();
  if (
    /\b(derive|derivation|prove that|obtain an expression|deduce|establish the relation)\b/.test(lower) ||
    /व्यंजक\s*प्राप्त|सिद्ध\s*कीजिए|निगमन/.test(lower)
  ) {
    return 'Derivation';
  }
  if (
    /\b(calculate|find the value|numerical|determine the magnitude|if a|a charge of|a current of|compute|evaluate)\b/.test(lower) ||
    /\d+\s*(cm|mm|m\/s|kg|volt|ampere|ohm|uf|pf|hz|joule|mol|liter|kelvin)/i.test(lower) ||
    /गणना\s*कीजिए|मान\s*ज्ञात/.test(lower)
  ) {
    return 'Numerical';
  }
  if (
    /\b(choose the correct|mcq|multiple choice|\(a\)\s+.+\(b\))\b/i.test(lower) ||
    /सही\s*विकल्प/.test(lower)
  ) {
    return 'MCQ';
  }
  if (/\b(fill in the blank|रिक्त\s*स्थान)\b/i.test(lower) || /_{3,}/.test(lower)) {
    return 'Fill in the Blank';
  }
  if (marks >= 4) return 'Long Answer';
  if (marks >= 2) return 'Short Answer';
  if (marks === 1) return 'Very Short';
  return 'Conceptual';
}

/**
 * Concept & bilingual keyword dictionary mapping common exam terms/formulas to syllabus topic keywords.
 */
const CONCEPT_SYNONYM_GROUPS: { triggers: string[]; targetKeywords: string[]; subjectId?: string }[] = [
  {
    subjectId: 'physics',
    triggers: ['coulomb', 'कूलॉम', 'superposition', 'permittivity', 'quantization of charge'],
    targetKeywords: ['coulomb', 'charge', 'superposition'],
  },
  {
    subjectId: 'physics',
    triggers: ['dipole', 'द्विध्रुव', 'axial line', 'equatorial line', 'torque on dipole'],
    targetKeywords: ['dipole', 'electric field lines'],
  },
  {
    subjectId: 'physics',
    triggers: ['gauss', 'गॉस', 'electric flux', 'infinite line charge', 'plane sheet', 'spherical shell'],
    targetKeywords: ['gauss', 'flux'],
  },
  {
    subjectId: 'physics',
    triggers: ['equipotential', 'समविभव', 'potential energy', 'electrostatic potential'],
    targetKeywords: ['potential', 'equipotential'],
  },
  {
    subjectId: 'physics',
    triggers: ['capacitor', 'capacitance', 'संधारित्र', 'धारिता', 'parallel plate', 'dielectric'],
    targetKeywords: ['capacitance', 'capacitor', 'dielectric'],
  },
  {
    subjectId: 'physics',
    triggers: ['drift velocity', 'अपवाह वेग', 'mobility', 'ohm law', 'ओम का नियम', 'resistivity', 'relaxation time'],
    targetKeywords: ['drift', 'ohm', 'resistivity', 'current'],
  },
  {
    subjectId: 'physics',
    triggers: ['kirchhoff', 'किरचॉफ', 'wheatstone', 'व्हीटस्टोन', 'meter bridge', 'potentiometer', 'internal resistance', 'emf'],
    targetKeywords: ['kirchhoff', 'wheatstone', 'cell', 'emf'],
  },
  {
    subjectId: 'physics',
    triggers: ['biot savart', 'बायो सावर्ट', 'ampere circuital', 'ऐम्पियर', 'solenoid', 'toroid', 'lorentz force', 'cyclotron', 'galvanometer'],
    targetKeywords: ['biot', 'ampere', 'magnetic', 'moving charges', 'galvanometer'],
  },
  {
    subjectId: 'physics',
    triggers: ['faraday', 'lenz', 'फैराडे', 'लेंज', 'motional emf', 'self inductance', 'mutual inductance', 'eddy current'],
    targetKeywords: ['electromagnetic induction', 'faraday', 'inductance'],
  },
  {
    subjectId: 'physics',
    triggers: ['alternating current', 'प्रत्यावर्ती धारा', 'lcr', 'resonance', 'transformer', 'ट्रांसफॉर्मर', 'power factor', 'rms'],
    targetKeywords: ['alternating', 'lcr', 'transformer', 'resonance'],
  },
  {
    subjectId: 'physics',
    triggers: ['total internal reflection', 'पूर्ण आंतरिक परावर्तन', 'lens maker', 'लेंस निर्माता', 'prism', 'microscope', 'telescope', 'mirror formula'],
    targetKeywords: ['ray optics', 'refraction', 'lens', 'optical instruments', 'prism'],
  },
  {
    subjectId: 'physics',
    triggers: ['huygens', 'हाइगेंस', 'young double slit', 'ydse', 'व्यतिकरण', 'interference', 'diffraction', 'विवर्तन', 'polarization', 'malus', 'brewster'],
    targetKeywords: ['wave optics', 'huygens', 'interference', 'diffraction', 'polarization'],
  },
  {
    subjectId: 'physics',
    triggers: ['photoelectric', 'प्रकाश विद्युत', 'einstein photoelectric', 'de broglie', 'डी ब्रोग्ली', 'work function', 'threshold frequency'],
    targetKeywords: ['dual nature', 'photoelectric', 'matter waves', 'de broglie'],
  },
  {
    subjectId: 'physics',
    triggers: ['bohr', 'बोर', 'rutherford', 'hydrogen spectrum', 'lyman', 'balmer', 'binding energy', 'नाभिकीय', 'mass defect', 'fission', 'fusion'],
    targetKeywords: ['atoms', 'nuclei', 'bohr', 'binding energy'],
  },
  {
    subjectId: 'physics',
    triggers: ['p-n junction', 'diode', 'rectifier', 'दिष्टकारी', 'semiconductor', 'अर्धचालक', 'energy band', 'intrinsic', 'extrinsic'],
    targetKeywords: ['semiconductor', 'junction diode', 'rectifier'],
  },
  {
    subjectId: 'chemistry',
    triggers: ['raoult', 'राउल्ट', 'henry', 'हेनरी', 'colligative', 'अणुसंख्य', 'osmotic pressure', 'परासरण दाब', 'van t hoff', 'elevation in boiling', 'depression in freezing', 'molarity', 'molality'],
    targetKeywords: ['solutions', 'raoult', 'henry', 'colligative', 'van'],
  },
  {
    subjectId: 'chemistry',
    triggers: ['nernst', 'नर्नस्ट', 'kohlrausch', 'कोलराउश', 'faraday law', 'molar conductivity', 'galvanic cell', 'fuel cell', 'corrosion', 'electrolysis'],
    targetKeywords: ['electrochemistry', 'nernst', 'kohlrausch', 'conductance', 'cell'],
  },
  {
    subjectId: 'chemistry',
    triggers: ['rate law', 'order of reaction', 'molecularity', 'अभिक्रिया की कोटि', 'half life', 'अर्ध आयु', 'arrhenius', 'आरहेनियस', 'activation energy', 'zero order', 'first order'],
    targetKeywords: ['chemical kinetics', 'order', 'half-life', 'arrhenius', 'rate'],
  },
  {
    subjectId: 'chemistry',
    triggers: ['lanthanoid', 'लैन्थेनॉइड', 'actinoid', 'transition elements', 'संक्रमण तत्व', 'kmno4', 'k2cr2o7', 'interstitial'],
    targetKeywords: ['d and f block', 'transition', 'lanthanoid'],
  },
  {
    subjectId: 'chemistry',
    triggers: ['werner', 'वर्नर', 'coordination', 'उपसहसंयोजन', 'iupac nomenclature of coordination', 'valence bond theory', 'vbt', 'crystal field', 'cft', 'isomerism in coordination', 'chelate'],
    targetKeywords: ['coordination compounds', 'werner', 'crystal field', 'isomerism'],
  },
  {
    subjectId: 'chemistry',
    triggers: ['sn1', 'sn2', 'wurtz', 'finkelstein', 'swarts', 'sandmeyer', 'haloalkane', 'haloarene', 'grignard', 'chiral', 'optical activity'],
    targetKeywords: ['haloalkanes', 'nucleophilic substitution', 'sn1', 'sn2'],
  },
  {
    subjectId: 'chemistry',
    triggers: ['reimer tiemann', 'kolbe', 'williamson', 'lucas test', 'phenol', 'ether', 'esterification'],
    targetKeywords: ['alcohols', 'phenols', 'ethers', 'williamson'],
  },
  {
    subjectId: 'chemistry',
    triggers: ['aldol', 'एल्डोल', 'cannizzaro', 'कैनिजारो', 'tollen', 'fehling', 'clemmensen', 'wolff kishner', 'rosenmund', 'hell volhard', 'carboxylic'],
    targetKeywords: ['aldehydes', 'ketones', 'carboxylic', 'aldol', 'cannizzaro'],
  },
  {
    subjectId: 'chemistry',
    triggers: ['hoffmann bromamide', 'gabriel phthalimide', 'carbylamine', 'कार्बिलऐमीन', 'diazonium', 'hinsberg', 'basicity of amines'],
    targetKeywords: ['amines', 'diazonium', 'hoffmann'],
  },
  {
    subjectId: 'chemistry',
    triggers: ['glucose', 'fructose', 'denaturation of protein', 'peptide bond', 'dna', 'rna', 'vitamins', 'nucleic acid', 'carbohydrate'],
    targetKeywords: ['biomolecules', 'carbohydrates', 'proteins', 'nucleic'],
  },
  {
    subjectId: 'mathematics',
    triggers: ['reflexive', 'symmetric', 'transitive', 'equivalence relation', 'तुल्यता संबंध', 'injective', 'surjective', 'bijective', 'एकैकी', 'आच्छादक'],
    targetKeywords: ['relations', 'functions', 'equivalence', 'injective', 'onto'],
  },
  {
    subjectId: 'mathematics',
    triggers: ['sin^-1', 'cos^-1', 'tan^-1', 'principal value', 'मुख्य मान', 'inverse trigonometric', 'प्रतिलोम त्रिकोणमितीय'],
    targetKeywords: ['inverse trigonometric', 'principal value'],
  },
  {
    subjectId: 'mathematics',
    triggers: ['matrix', 'matrices', 'आव्यूह', 'symmetric matrix', 'skew symmetric', 'invertible matrices'],
    targetKeywords: ['matrices', 'matrix', 'symmetric'],
  },
  {
    subjectId: 'mathematics',
    triggers: ['determinant', 'सारणिक', 'cofactor', 'adjoint', 'cramer', 'system of linear equations', 'area of triangle'],
    targetKeywords: ['determinants', 'adjoint', 'inverse', 'linear equations'],
  },
  {
    subjectId: 'mathematics',
    triggers: ['continuity', 'सातत्य', 'differentiability', 'अवकलनीयता', 'chain rule', 'parametric differentiation', 'logarithmic differentiation', 'second order derivative'],
    targetKeywords: ['continuity', 'differentiability', 'derivatives'],
  },
  {
    subjectId: 'mathematics',
    triggers: ['rate of change', 'increasing and decreasing', 'वर्धमान', 'ह्रासमान', 'maxima and minima', 'उच्चिष्ठ', 'निम्निष्ठ'],
    targetKeywords: ['application of derivatives', 'maxima', 'minima', 'increasing'],
  },
  {
    subjectId: 'mathematics',
    triggers: ['integration by parts', 'partial fractions', 'आंशिक भिन्न', 'definite integral', 'निश्चित समाकलन', '∫'],
    targetKeywords: ['integrals', 'integration', 'definite'],
  },
  {
    subjectId: 'mathematics',
    triggers: ['area under simple curves', 'area bounded by curve', 'समाकलनों के अनुप्रयोग', 'parabola', 'ellipse'],
    targetKeywords: ['application of integrals', 'area under'],
  },
  {
    subjectId: 'mathematics',
    triggers: ['order and degree', 'अवकल समीकरण', 'differential equation', 'variable separable', 'homogeneous differential', 'integrating factor', 'linear differential equation'],
    targetKeywords: ['differential equations', 'order', 'linear differential'],
  },
  {
    subjectId: 'mathematics',
    triggers: ['dot product', 'scalar product', 'cross product', 'vector product', 'सदिश', 'direction cosines', 'projection of a vector'],
    targetKeywords: ['vector', 'scalar', 'cross product'],
  },
  {
    subjectId: 'mathematics',
    triggers: ['skew lines', 'shortest distance between two lines', 'न्यूनतम दूरी', 'cartesian equation of a line', 'three dimensional'],
    targetKeywords: ['three dimensional', 'shortest distance', 'skew lines', 'line in space'],
  },
  {
    subjectId: 'mathematics',
    triggers: ['linear programming', 'रैखिक प्रोग्रामन', 'feasible region', 'corner point', 'maximize', 'minimize', 'constraints'],
    targetKeywords: ['linear programming', 'feasible', 'optimal'],
  },
  {
    subjectId: 'mathematics',
    triggers: ['conditional probability', 'सप्रतिबंध प्रायिकता', 'bayes theorem', 'बेज प्रमेय', 'total probability', 'independent events'],
    targetKeywords: ['probability', 'conditional', 'bayes'],
  },
];

/**
 * Matches a question text against the user's active syllabus subjects, chapters, and topics.
 * Returns mapping confidence (0-100) and supporting evidence keywords.
 */
export function matchQuestionToSyllabus(
  questionText: string,
  subjects: Subject[],
  preferredSubjectId?: string
): {
  subjectId: string;
  subjectName: string;
  chapterId: string;
  chapterTitle: string;
  topicId?: string;
  topicTitle?: string;
  isUnmatched: boolean;
  matchScore: number;
  mappingConfidence: number;
  mappingEvidence: string[];
} {
  const qTokens = getSignificantTokens(questionText);
  const qNorm = normalizeTextForMatch(questionText);
  const qLower = questionText.toLowerCase();

  // Identify synonym expansions triggered by question text
  const expandedKeywords = new Set<string>();
  const matchedTriggers: string[] = [];
  for (const group of CONCEPT_SYNONYM_GROUPS) {
    if (preferredSubjectId && group.subjectId && group.subjectId !== preferredSubjectId) continue;
    for (const trig of group.triggers) {
      if (qLower.includes(trig.toLowerCase())) {
        matchedTriggers.push(trig);
        group.targetKeywords.forEach((kw) => expandedKeywords.add(kw.toLowerCase()));
      }
    }
  }

  let bestMatch: {
    subjectId: string;
    subjectName: string;
    chapterId: string;
    chapterTitle: string;
    topicId?: string;
    topicTitle?: string;
    score: number;
    evidence: string[];
  } | null = null;

  const candidateSubjects = preferredSubjectId
    ? subjects.filter((s) => s.id === preferredSubjectId)
    : subjects;

  const searchPool = candidateSubjects.length > 0 ? candidateSubjects : subjects;

  for (const sub of searchPool) {
    for (const unit of sub.units) {
      if (unit.isArchived) continue;
      for (const chap of unit.chapters) {
        if (chap.isArchived || chap.isExcluded) continue;
        const chapTokens = getSignificantTokens(chap.title);
        const chapNorm = normalizeTextForMatch(chap.title);

        for (const topic of chap.topics) {
          if (topic.isArchived || topic.isExcluded) continue;

          const topicTitleNorm = normalizeTextForMatch(topic.title);
          const fullTopicText = `${topic.title} ${topic.subtopics.map((st) => st.title).join(' ')}`;
          const topicTokens = getSignificantTokens(fullTopicText);
          const fullTopicLower = fullTopicText.toLowerCase();

          let score = 0;
          const evidence: string[] = [];

          // 1. Exact phrase inclusion bonus
          if (topicTitleNorm.length >= 5 && qNorm.includes(topicTitleNorm)) {
            score += 5;
            evidence.push(`Exact topic match: "${topic.title}"`);
          }

          // 2. Direct token overlap with topic & subtopics
          for (const qt of qTokens) {
            if (topicTokens.includes(qt)) {
              score += 1.6;
              if (evidence.length < 4) evidence.push(`Keyword: "${qt}"`);
            } else if (chapTokens.includes(qt)) {
              score += 0.7;
            }
          }

          // 3. Domain concept & bilingual synonym expansion bonus
          for (const expKw of expandedKeywords) {
            if (fullTopicLower.includes(expKw) || chapNorm.includes(expKw)) {
              score += 2.2;
              if (evidence.length < 4) evidence.push(`Concept: "${expKw}"`);
            }
          }

          if (!bestMatch || score > bestMatch.score) {
            bestMatch = {
              subjectId: sub.id,
              subjectName: sub.name,
              chapterId: chap.id,
              chapterTitle: chap.title,
              topicId: topic.id,
              topicTitle: topic.title,
              score,
              evidence,
            };
          }
        }
      }
    }
  }

  if (bestMatch && bestMatch.score >= 1.5) {
    const confidence = Math.min(98, Math.round(45 + bestMatch.score * 9));
    return {
      subjectId: bestMatch.subjectId,
      subjectName: bestMatch.subjectName,
      chapterId: bestMatch.chapterId,
      chapterTitle: bestMatch.chapterTitle,
      topicId: bestMatch.topicId,
      topicTitle: bestMatch.topicTitle,
      isUnmatched: false,
      matchScore: bestMatch.score,
      mappingConfidence: confidence,
      mappingEvidence:
        bestMatch.evidence.length > 0
          ? bestMatch.evidence
          : matchedTriggers.length > 0
          ? [`Matched concept: ${matchedTriggers[0]}`]
          : ['Matched syllabus keywords'],
    };
  }

  const fallbackSub = searchPool[0];
  const fallbackChap = fallbackSub?.units?.[0]?.chapters?.[0];

  return {
    subjectId: fallbackSub?.id || 'unassigned',
    subjectName: fallbackSub?.name || 'Unclassified Subject',
    chapterId: fallbackChap?.id || 'unassigned',
    chapterTitle: fallbackChap?.title || 'Unclassified Chapter',
    topicId: undefined,
    topicTitle: undefined,
    isUnmatched: true,
    matchScore: 0,
    mappingConfidence: 0,
    mappingEvidence: ['Insufficient keyword overlap — flagged for review'],
  };
}

/**
 * Parses marks from a question line supporting diverse notations:
 * [2], (3 marks), [1½], (1/2), [1+2=3], (2 + 1 + 1 = 4), 2×1=2, [3 अंक], 4M, trailing (2)
 */
export function extractMarksFromText(
  text: string,
  sectionDefaultMarks = 0
): {
  marks: number;
  cleanedText: string;
  confidence: 'high' | 'medium' | 'low';
} {
  let working = text.trim();

  // 1. Check sum/equation marks e.g. [1+2=3], (1 + 1 + 2 = 4), [2+2], (1½ + 1½ = 3)
  const equationRegex = /[\[\(]\s*(\d+(?:\.\d+)?(?:\s*\+\s*\d+(?:\.\d+)?)+)(?:\s*=\s*(\d+(?:\.\d+)?))?\s*(?:marks?|m|अंक)?\s*[\]\)]/i;
  const eqMatch = working.match(equationRegex);
  if (eqMatch) {
    let total = 0;
    if (eqMatch[2]) {
      total = parseFloat(eqMatch[2]);
    } else {
      total = eqMatch[1]
        .split('+')
        .reduce((acc, n) => acc + (parseFloat(n.trim()) || 0), 0);
    }
    return {
      marks: Math.round(total * 2) / 2,
      cleanedText: working.replace(equationRegex, '').trim(),
      confidence: 'high',
    };
  }

  // 2. Check multiplication marks e.g. [4 × 1 = 4] or (2 x 2 = 4)
  const multRegex = /[\[\(]\s*(\d+)\s*[×x\*]\s*(\d+(?:\.\d+)?)\s*=\s*(\d+(?:\.\d+)?)\s*(?:marks?|m|अंक)?\s*[\]\)]/i;
  const multMatch = working.match(multRegex);
  if (multMatch) {
    const total = parseFloat(multMatch[3]);
    return {
      marks: Math.round(total * 2) / 2,
      cleanedText: working.replace(multRegex, '').trim(),
      confidence: 'high',
    };
  }

  // 3. Check fractional / half marks e.g. [1½], (½ mark), [1/2], (1 1/2 marks)
  const halfRegex = /[\[\(]\s*(?:(\d+)\s*)?(?:½|1\/2)\s*(?:marks?|m|अंक)?\s*[\]\)]/i;
  const halfMatch = working.match(halfRegex);
  if (halfMatch) {
    const whole = halfMatch[1] ? parseInt(halfMatch[1], 10) : 0;
    return {
      marks: whole + 0.5,
      cleanedText: working.replace(halfRegex, '').trim(),
      confidence: 'high',
    };
  }

  // 4. Explicit marks with unit in brackets/parens or at end: [2 Marks], (3M), [4 अंक], 3 Marks
  const explicitRegex = /(?:[\[\(]\s*(\d+(?:\.\d+)?)\s*(?:marks?|m|अंक)\s*[\]\)]|[\[\(]\s*(\d+(?:\.\d+)?)\s*[\]\)]\s*$|(?:\s+|[-–—]\s*)(\d+(?:\.\d+)?)\s*(?:marks?|अंक)\s*$)/i;
  const expMatch = working.match(explicitRegex);
  if (expMatch) {
    const val = parseFloat(expMatch[1] || expMatch[2] || expMatch[3] || '0');
    if (val > 0 && val <= 15) {
      return {
        marks: Math.round(val * 2) / 2,
        cleanedText: working.replace(explicitRegex, '').trim(),
        confidence: 'high',
      };
    }
  }

  // 5. Fallback to section-level default marks if active
  if (sectionDefaultMarks > 0) {
    return {
      marks: sectionDefaultMarks,
      cleanedText: working,
      confidence: 'medium',
    };
  }

  return {
    marks: 0,
    cleanedText: working,
    confidence: 'low',
  };
}

/**
 * Detects official maximum marks from a paper header if present.
 */
export function detectPaperOfficialMaxMarks(rawText: string): number | null {
  const headerSlice = (rawText || '').slice(0, 3500);
  const maxMarksRegex = /(?:maximum\s*marks|max\.?\s*marks|पूर्णांक|total\s*marks)\s*[:\-–=]?\s*(\d{2,3})\b/i;
  const m = headerSlice.match(maxMarksRegex);
  if (m) {
    const val = parseInt(m[1], 10);
    if (val >= 10 && val <= 300) return val;
  }
  return null;
}

/**
 * Extracts structured PYQ candidates from raw PDF text (with optional --- PAGE N --- markers),
 * handling section headers, subquestions, and internal choices (OR / अथवा) without double-counting,
 * and matching them to syllabus topics.
 */
export function parsePYQPdfText(
  rawText: string,
  sourceFileName: string,
  subjects: Subject[],
  existingPyqs: PYQRecord[],
  defaultSubjectId?: string,
  defaultExamYear?: string,
  defaultExamName?: string
): ExtractedPYQCandidate[] {
  const candidates: ExtractedPYQCandidate[] = [];
  if (!rawText || !rawText.trim()) return candidates;

  // Detect header year or exam name from document if not overridden
  const yearMatch = rawText.match(/\b(201[5-9]|202[0-9])\b/);
  const detectedYear = defaultExamYear || (yearMatch ? yearMatch[1] : 'Unspecified');

  let detectedExam = defaultExamName || 'Board / Entrance Examination';
  if (/rbse|rajasthan board|माध्यमिक\s*शिक्षा\s*बोर्ड|senior secondary/i.test(rawText)) {
    detectedExam = 'RBSE Senior Secondary Exam';
  } else if (/jee\s*main/i.test(rawText)) {
    detectedExam = 'JEE Main';
  } else if (/jee\s*advanced/i.test(rawText)) {
    detectedExam = 'JEE Advanced';
  } else if (/half[\s-]*yearly|अर्द्धवार्षिक/i.test(rawText)) {
    detectedExam = 'Half-Yearly Examination';
  } else if (/model\s*paper|sample\s*paper|मॉडल\s*पेपर/i.test(rawText)) {
    detectedExam = 'RBSE Model Paper';
  }

  // Split by page markers if present
  const pageBlocks = rawText.split(/---\s*PAGE\s+(\d+)\s*---/i);
  const pages: { pageNumber: number; content: string }[] = [];

  if (pageBlocks.length > 1) {
    for (let i = 1; i < pageBlocks.length; i += 2) {
      const pNum = parseInt(pageBlocks[i], 10) || 1;
      const pText = pageBlocks[i + 1] || '';
      if (pText.trim()) pages.push({ pageNumber: pNum, content: pText });
    }
  } else {
    pages.push({ pageNumber: 1, content: rawText });
  }

  let qIndex = 0;
  let activeSectionName = 'General Section';
  let activeSectionDefaultMarks = 0;
  let lastQuestionNumStr = '';
  let lastQuestionMarks = 0;
  let nextIsOptionalAlternative = false;

  const pushCandidateRecord = (
    rawQuestionBody: string,
    pageNumber: number,
    questionNumStr: string,
    isOptionalAlt: boolean,
    altToQNum?: string
  ) => {
    const fullLine = rawQuestionBody.replace(/\s+/g, ' ').trim();
    if (fullLine.length < 10) return;
    if (
      /^(?:general instructions|सामान्य निर्देश|time\s*:|समय\s*:|maximum marks|पूर्णांक|roll no|परीक्षार्थी)/i.test(
        fullLine
      )
    ) {
      return;
    }

    const { marks: parsedMarks, cleanedText, confidence: marksConf } = extractMarksFromText(
      fullLine,
      activeSectionDefaultMarks
    );

    // If this is an OR alternative and didn't repeat the marks, inherit the main question's marks
    const finalMarks =
      parsedMarks > 0 ? parsedMarks : isOptionalAlt && lastQuestionMarks > 0 ? lastQuestionMarks : 0;
    const finalMarksConf =
      parsedMarks > 0 ? marksConf : isOptionalAlt && lastQuestionMarks > 0 ? 'medium' : 'low';

    // Extract inline year if stated e.g. [RBSE 2023] or (2022)
    const inlineYearMatch = cleanedText.match(/\b(201[5-9]|202[0-9])\b/);
    const qYear = inlineYearMatch ? inlineYearMatch[1] : detectedYear;

    // Clean leading Q1. / 1. / प्रश्न 1.
    const cleanedQuestion = cleanedText
      .replace(/^(?:Q(?:uestion)?\.?\s*\d+(?:\s*\([a-zA-Zivx]+\))?[\.\)\:]?|प्रश्न\s*\d+[\.\)\:]?|\d{1,2}[\.\)]\s*)/i, '')
      .replace(/^(?:OR|अथवा)\b[\s\:\-\.]*/i, '')
      .trim();

    if (cleanedQuestion.length < 8) return;

    qIndex++;
    const matched = matchQuestionToSyllabus(cleanedQuestion, subjects, defaultSubjectId);
    const qType = inferQuestionType(cleanedQuestion, finalMarks);

    // Check duplicates against existing PYQs and already-extracted candidates
    let isDuplicate = false;
    let duplicateOfId: string | undefined;
    let duplicateReason: string | undefined;

    for (const existing of existingPyqs) {
      const sim = computeTokenSimilarity(cleanedQuestion, existing.questionText);
      if (sim >= 0.75) {
        isDuplicate = true;
        duplicateOfId = existing.id;
        duplicateReason = `Similar to saved PYQ (${existing.examYear}: "${existing.questionText.slice(0, 55)}...")`;
        break;
      }
    }

    if (!isDuplicate) {
      for (const prev of candidates) {
        const sim = computeTokenSimilarity(cleanedQuestion, prev.questionText);
        if (sim >= 0.78) {
          isDuplicate = true;
          duplicateOfId = prev.id;
          duplicateReason = `Probable duplicate of Question #${candidates.indexOf(prev) + 1} in this upload`;
          break;
        }
      }
    }

    const qNumLabel = questionNumStr || `Q${qIndex}`;
    if (!isOptionalAlt) {
      lastQuestionNumStr = qNumLabel;
      if (finalMarks > 0) lastQuestionMarks = finalMarks;
    }

    candidates.push({
      id: `pyq-cand-${Date.now()}-${qIndex}`,
      selected: !isDuplicate,
      questionNumber: isOptionalAlt ? `${qNumLabel} (OR)` : qNumLabel,
      sectionName: activeSectionName,
      examName: detectedExam,
      examYear: qYear,
      subjectId: matched.subjectId,
      subjectName: matched.subjectName,
      chapterId: matched.chapterId,
      chapterTitle: matched.chapterTitle,
      topicId: matched.topicId,
      topicTitle: matched.topicTitle,
      questionText: cleanedQuestion,
      marks: finalMarks,
      marksConfidence: finalMarksConf,
      isOptionalAlternative: isOptionalAlt,
      alternativeToQuestionNumber: isOptionalAlt ? altToQNum || lastQuestionNumStr : undefined,
      questionType: qType,
      sourceFileName,
      pageNumber,
      isUnmatched: matched.isUnmatched,
      mappingConfidence: matched.mappingConfidence,
      mappingEvidence: matched.mappingEvidence,
      isDuplicate,
      duplicateOfId,
      duplicateReason,
    });
  };

  for (const page of pages) {
    const lines = page.content
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    let currentQuestionLines: string[] = [];
    let currentQNum = '';
    let currentIsAlt = false;

    const flushQuestion = () => {
      if (currentQuestionLines.length === 0) return;
      const joined = currentQuestionLines.join(' ');
      currentQuestionLines = [];

      // Check if inline " OR " / " अथवा " splits two complete questions inside the same block
      const inlineOrSplit = joined.split(/\s+(?:OR|अथवा)\s+(?=(?:Q\.?\s*\d+|\d+[\.\)]|(?:State|Define|Derive|Explain|Calculate|Obtain|Prove|Write|Find|Show|Distinguish|सिद्ध|समझाइए|लिखिए|ज्ञात)\b))/i);

      if (inlineOrSplit.length > 1) {
        pushCandidateRecord(
          inlineOrSplit[0],
          page.pageNumber,
          currentQNum,
          currentIsAlt,
          currentIsAlt ? lastQuestionNumStr : undefined
        );
        for (let idx = 1; idx < inlineOrSplit.length; idx++) {
          pushCandidateRecord(
            inlineOrSplit[idx],
            page.pageNumber,
            currentQNum || lastQuestionNumStr,
            true,
            currentQNum || lastQuestionNumStr
          );
        }
      } else {
        pushCandidateRecord(
          joined,
          page.pageNumber,
          currentQNum,
          currentIsAlt,
          currentIsAlt ? lastQuestionNumStr : undefined
        );
      }

      currentQNum = '';
      currentIsAlt = false;
    };

    for (const line of lines) {
      // 1. Detect Section Headers e.g. "SECTION - A", "Section B (2 Marks each)", "खण्ड - ब"
      const sectionMatch = line.match(
        /^(?:section|खण्ड|part)\s*[-–:]?\s*([A-D1-4अ-द])\b(.*)$/i
      );
      if (sectionMatch && line.length < 95) {
        flushQuestion();
        const secCode = sectionMatch[1].toUpperCase();
        activeSectionName = `Section ${secCode}`;
        const rest = sectionMatch[2] || '';
        const secMarksMatch = rest.match(/(\d+(?:\.\d+)?)\s*(?:marks?|m|अंक)/i);
        if (secMarksMatch) {
          activeSectionDefaultMarks = parseFloat(secMarksMatch[1]);
        } else if (secCode === 'A' || secCode === 'अ') {
          activeSectionDefaultMarks = 1;
        } else if (secCode === 'B' || secCode === 'ब') {
          activeSectionDefaultMarks = 1.5;
        } else if (secCode === 'C' || secCode === 'स') {
          activeSectionDefaultMarks = 3;
        } else if (secCode === 'D' || secCode === 'द') {
          activeSectionDefaultMarks = 4;
        }
        continue;
      }

      // Detect standalone section instruction line e.g. "Each question carries 2 marks"
      const secInstructionMatch = line.match(
        /(?:each\s+question\s+carries|प्रत्येक\s+प्रश्न)\s+(\d+(?:\.\d+)?)\s*(?:marks?|अंक)/i
      );
      if (secInstructionMatch && line.length < 90) {
        activeSectionDefaultMarks = parseFloat(secInstructionMatch[1]);
        continue;
      }

      // 2. Detect standalone "OR" / "अथवा" line indicating an optional internal choice
      if (/^(?:OR|अथवा)\s*$/i.test(line)) {
        flushQuestion();
        nextIsOptionalAlternative = true;
        continue;
      }

      // 3. Detect line starting with "OR " / "अथवा " followed by the alternative question text
      const leadingOrMatch = line.match(/^(?:OR|अथवा)[\s:\-\.]+(.+)$/i);
      if (leadingOrMatch && leadingOrMatch[1].length >= 10) {
        flushQuestion();
        currentIsAlt = true;
        currentQNum = lastQuestionNumStr;
        currentQuestionLines.push(leadingOrMatch[1]);
        nextIsOptionalAlternative = false;
        continue;
      }

      // 4. Detect numbered question start e.g. "Q1.", "Q1", "Q. 14", "12.", "12)", "प्रश्न 5."
      const qNumMatch = line.match(
        /^(?:(Q(?:uestion)?\.?\s*\d+[\.\)]?)|(प्रश्न\s*\d+[\.\)]?)|(\d{1,2})[\.\)])\s*(.+)$/i
      );
      const isBulletQuestion = /^•\s+[A-Z\u0900-\u097F]/.test(line);

      // Only treat unnumbered verb lines as a new question if the previous line ended with explicit marks like [2] or (3 Marks)
      const prevLineEndedWithMarks =
        currentQuestionLines.length > 0 &&
        /(?:\[\d+(?:\.\d+)?\s*(?:marks?|m|अंक)?\]|\(\d+(?:\.\d+)?\s*(?:marks?|m|अंक)\))\s*$/i.test(
          currentQuestionLines[currentQuestionLines.length - 1]
        );
      const isUnnumberedVerbAfterMarkedQuestion =
        prevLineEndedWithMarks &&
        /^(?:State|Define|Derive|Explain|Calculate|Obtain|Prove|Write|Distinguish|Why|What|Find|Show)\b/i.test(
          line
        );

      if (qNumMatch || isBulletQuestion || isUnnumberedVerbAfterMarkedQuestion) {
        flushQuestion();
        if (qNumMatch) {
          const rawNum = (qNumMatch[1] || qNumMatch[2] || `Q${qNumMatch[3]}`).replace(/\s+/g, '');
          currentQNum = rawNum;
        }
        if (nextIsOptionalAlternative) {
          currentIsAlt = true;
          nextIsOptionalAlternative = false;
        }
        currentQuestionLines.push(line);
      } else {
        if (currentQuestionLines.length === 0 && nextIsOptionalAlternative) {
          currentIsAlt = true;
          currentQNum = lastQuestionNumStr;
          nextIsOptionalAlternative = false;
        }
        currentQuestionLines.push(line);
      }
    }
    flushQuestion();
  }

  return candidates;
}

/**
 * Computes a transparent Marks Reconciliation Report for an uploaded paper's extracted candidates.
 * Distinguishes compulsory marks from optional (OR/अथवा) alternatives and flags any discrepancies.
 */
export function reconcilePaperMarks(
  candidates: ExtractedPYQCandidate[],
  rawText: string,
  fileName: string,
  manualOfficialMaxMarks?: number | null
): MarksReconciliationReport {
  const docClass = classifyAcademicDocument(rawText, fileName);
  const detectedMax =
    manualOfficialMaxMarks !== undefined && manualOfficialMaxMarks !== null
      ? manualOfficialMaxMarks
      : detectPaperOfficialMaxMarks(rawText);

  const fileCandidates = candidates.filter(
    (c) => !fileName || c.sourceFileName === fileName
  );

  let compulsoryMarksSum = 0;
  let optionalAlternativeMarksSum = 0;
  let unclassifiedMarksSum = 0;
  let questionsWithMissingMarks = 0;
  let compulsoryQuestionsCount = 0;
  let optionalQuestionsCount = 0;

  for (const c of fileCandidates) {
    if (c.isOptionalAlternative) {
      optionalQuestionsCount++;
      optionalAlternativeMarksSum += c.marks || 0;
    } else {
      compulsoryQuestionsCount++;
      compulsoryMarksSum += c.marks || 0;
      if (!c.marks || c.marks <= 0) {
        questionsWithMissingMarks++;
      }
    }
    if (c.isUnmatched && !c.isOptionalAlternative) {
      unclassifiedMarksSum += c.marks || 0;
    }
  }

  const discrepancies: string[] = [];
  let reconciliationStatus: MarksReconciliationReport['reconciliationStatus'] =
    'unverified_max_marks';

  if (optionalQuestionsCount > 0) {
    discrepancies.push(
      `Excluded ${optionalQuestionsCount} internal-choice (OR / अथवा) alternative question(s) totaling ${optionalAlternativeMarksSum} marks from compulsory paper total to prevent double-counting.`
    );
  }

  if (questionsWithMissingMarks > 0) {
    discrepancies.push(
      `${questionsWithMissingMarks} compulsory question(s) have missing or ambiguous marks (0M). Please review and enter their marks.`
    );
  }

  if (unclassifiedMarksSum > 0) {
    discrepancies.push(
      `${unclassifiedMarksSum} compulsory marks belong to questions not yet mapped to a specific syllabus topic.`
    );
  }

  if (detectedMax !== null && detectedMax > 0) {
    const diff = compulsoryMarksSum - detectedMax;
    if (Math.abs(diff) < 0.01 && questionsWithMissingMarks === 0) {
      reconciliationStatus = 'verified_match';
    } else if (compulsoryMarksSum < detectedMax) {
      reconciliationStatus = 'partial_extraction';
      discrepancies.push(
        `Extracted compulsory marks (${compulsoryMarksSum}M) are ${
          detectedMax - compulsoryMarksSum
        }M below the paper's official maximum (${detectedMax}M). Check if any page was scanned or if section marks need manual adjustment.`
      );
    } else {
      reconciliationStatus = 'discrepancy_detected';
      discrepancies.push(
        `Extracted compulsory marks (${compulsoryMarksSum}M) exceed the paper's official maximum (${detectedMax}M) by ${diff}M. Verify whether any optional question was not marked as an 'OR' alternative.`
      );
    }
  } else {
    reconciliationStatus = 'unverified_max_marks';
    discrepancies.push(
      `No explicit 'Maximum Marks' header was found in "${fileName}". Compulsory questions sum to ${compulsoryMarksSum}M (plus ${optionalAlternativeMarksSum}M in optional alternatives). You can set the official paper maximum to verify reconciliation.`
    );
  }

  return {
    fileName,
    detectedExamName: fileCandidates[0]?.examName || 'RBSE Examination Paper',
    detectedExamYear:
      fileCandidates[0]?.examYear || docClass.detectedYear || 'Unspecified',
    documentCategory: docClass.category,
    officialMaxMarks: detectedMax,
    compulsoryMarksSum,
    optionalAlternativeMarksSum,
    unclassifiedMarksSum,
    questionsWithMissingMarks,
    totalQuestionsExtracted: fileCandidates.length,
    compulsoryQuestionsCount,
    optionalQuestionsCount,
    reconciliationStatus,
    discrepancies,
  };
}

export const computeMarksReconciliation = reconcilePaperMarks;

/**
 * Convenience wrapper that parses PDF text into candidates and computes the reconciliation report in one call.
 */
export function parsePYQPdfWithReconciliation(
  rawText: string,
  fileName: string,
  subjects: Subject[],
  existingPyqs: PYQRecord[],
  defaultSubjectId?: string,
  defaultExamYear?: string,
  defaultExamName?: string
): {
  candidates: ExtractedPYQCandidate[];
  reconciliation: MarksReconciliationReport;
} {
  const candidates = parsePYQPdfText(
    rawText,
    fileName,
    subjects,
    existingPyqs,
    defaultSubjectId,
    defaultExamYear,
    defaultExamName
  );
  const reconciliation = reconcilePaperMarks(candidates, rawText, fileName);
  return { candidates, reconciliation };
}

export const calculateChapterWeightageDistribution = calculateChapterWeightageAnalytics;

/**
 * Computes chapter-wise weightage statistics strictly from verified/uploaded PYQ records,
 * separating compulsory marks, optional marks, question appearances, and distinct exam papers.
 */
export function calculateChapterWeightageAnalytics(
  subjects: Subject[],
  pyqs: PYQRecord[]
): ChapterWeightageSummary[] {
  const summaries: ChapterWeightageSummary[] = [];
  const evidencePyqs = pyqs.filter((p) => p.verificationStatus !== 'ai_practice');

  for (const sub of subjects) {
    for (const unit of sub.units) {
      if (unit.isArchived) continue;
      for (const chap of unit.chapters) {
        if (chap.isArchived || chap.isExcluded) continue;

        const chapPyqs = evidencePyqs.filter((p) => p.chapterId === chap.id);
        const paperSet = new Set<string>();
        const yearSet = new Set<string>();
        let compulsoryMarksSum = 0;
        let optionalMarksSum = 0;
        let confSum = 0;

        for (const p of chapPyqs) {
          const paperKey = `${p.sourceFileName || p.examName || 'paper'}-${p.examYear || 'yr'}`;
          paperSet.add(paperKey);
          if (p.examYear && p.examYear !== 'Unspecified') {
            yearSet.add(p.examYear);
          }
          if (p.isOptionalAlternative) {
            optionalMarksSum += p.marks || 0;
          } else {
            compulsoryMarksSum += p.marks || 0;
          }
          confSum += p.mappingConfidence ?? (p.isUnmatched ? 35 : 85);
        }

        summaries.push({
          chapterId: chap.id,
          chapterTitle: chap.title,
          subjectId: sub.id,
          subjectName: sub.name,
          officialBlueprintMarks: chap.officialWeightageMarks ?? null,
          questionAppearances: chapPyqs.length,
          distinctPapersCount: paperSet.size,
          compulsoryMarksSum,
          optionalMarksSum,
          totalMarksAllQuestions: compulsoryMarksSum + optionalMarksSum,
          yearsCovered: Array.from(yearSet).sort((a, b) => b.localeCompare(a)),
          averageMappingConfidence:
            chapPyqs.length > 0 ? Math.round(confSum / chapPyqs.length) : 100,
        });
      }
    }
  }

  return summaries;
}

/**
 * Topic Intelligence Engine:
 * Ranks and evaluates every syllabus topic using actual PYQ evidence, completion status,
 * confidence, accuracy, and prerequisites without inventing frequencies or marks.
 */
export function calculateTopicIntelligence(
  subjects: Subject[],
  pyqs: PYQRecord[],
  masteryMap: Record<string, TopicMasteryState>,
  allowAutoCompleteFromStages = false
): TopicIntelligenceItem[] {
  const items: TopicIntelligenceItem[] = [];

  // Only count genuine PYQs (exclude ai_practice from evidence counts)
  const evidencePyqs = pyqs.filter((p) => p.verificationStatus !== 'ai_practice');

  for (const sub of subjects) {
    for (const unit of sub.units) {
      if (unit.isArchived) continue;
      for (const chap of unit.chapters) {
        if (chap.isArchived || chap.isExcluded) continue;
        for (const topic of chap.topics) {
          if (topic.isArchived || topic.isExcluded) continue;

          // Match PYQs explicitly linked by topicId OR matching by high token overlap inside the same chapter
          const matchingPyqs = evidencePyqs.filter((p) => {
            if (p.topicId && p.topicId === topic.id) return true;
            if (!p.topicId && p.chapterId === chap.id) {
              const sim = computeTokenSimilarity(p.questionText, topic.title);
              return sim >= 0.35;
            }
            return false;
          });

          const pyqCount = matchingPyqs.length;
          const yearsSet = new Set<string>();
          const papersSet = new Set<string>();
          let totalPyqMarks = 0;
          let compulsoryPyqMarks = 0;
          let optionalPyqMarks = 0;
          let confTotal = 0;
          const patternsSet = new Set<string>();
          const sources: TopicIntelligenceItem['sources'] = [];

          for (const p of matchingPyqs) {
            if (p.examYear && p.examYear !== 'Unspecified') {
              yearsSet.add(p.examYear);
            }
            papersSet.add(`${p.sourceFileName || p.examName || 'paper'}-${p.examYear || 'yr'}`);
            const qMarks = p.marks || 0;
            totalPyqMarks += qMarks;
            if (p.isOptionalAlternative) {
              optionalPyqMarks += qMarks;
            } else {
              compulsoryPyqMarks += qMarks;
            }
            confTotal += p.mappingConfidence ?? 85;
            const qType = p.questionType || inferQuestionType(p.questionText, qMarks);
            patternsSet.add(qMarks > 0 ? `${qType} (${qMarks}M)` : qType);
            sources.push({
              pyqId: p.id,
              year: p.examYear || 'Unspecified',
              examName: p.examName || p.source || 'Uploaded PYQ',
              marks: qMarks,
              isOptionalAlternative: p.isOptionalAlternative,
              sourceFileName: p.sourceFileName,
              pageNumber: p.pageNumber,
            });
          }

          const yearsAppeared = Array.from(yearsSet).sort((a, b) => b.localeCompare(a));
          const questionPatterns = Array.from(patternsSet);

          const m = masteryMap[topic.id];
          const isComp = isTopicCompleted(m, allowAutoCompleteFromStages);
          const completionStatus: TopicStatus = isComp
            ? 'Completed'
            : m?.status || 'Not Started';

          const confidence = m && m.isConfidenceRated !== false ? m.confidence : null;
          const accuracyPercentage =
            m && m.questionsSolved > 0
              ? Math.round((m.questionsCorrect / m.questionsSolved) * 100)
              : null;

          // Evidence-based priority calculation
          let priorityLevel: EvidencePriorityLevel = 'Insufficient PYQ evidence';
          let evidenceScore = 0;
          const reasons: string[] = [];

          if (pyqCount === 0) {
            priorityLevel = 'Insufficient PYQ evidence';
            reasons.push('No matching questions in uploaded PYQs yet (Insufficient PYQ evidence)');
            if (topic.personalPriority === 'high' || sub.priority === 'high') {
              evidenceScore += 10;
              reasons.push('Marked as high personal/subject priority');
            }
          } else {
            evidenceScore +=
              pyqCount * 25 + compulsoryPyqMarks * 6 + optionalPyqMarks * 3 + yearsAppeared.length * 10;
            reasons.push(
              `Appeared ${pyqCount} time${pyqCount > 1 ? 's' : ''} across ${papersSet.size} paper${
                papersSet.size > 1 ? 's' : ''
              }${yearsAppeared.length > 0 ? ` (${yearsAppeared.join(', ')})` : ''} · ${compulsoryPyqMarks}M compulsory${
                optionalPyqMarks > 0 ? ` + ${optionalPyqMarks}M optional` : ''
              }`
            );

            if (!isComp) {
              evidenceScore += 20;
              reasons.push(`Status: ${completionStatus}`);
            }
            if (confidence !== null && confidence <= 2) {
              evidenceScore += 15;
              reasons.push(`Low confidence (${confidence}/5)`);
            }

            if (
              pyqCount >= 2 ||
              compulsoryPyqMarks >= 4 ||
              (pyqCount >= 1 && !isComp && (confidence === null || confidence <= 2))
            ) {
              priorityLevel = 'High Priority';
            } else if (pyqCount >= 1 && !isComp) {
              priorityLevel = 'Moderate Priority';
            } else {
              priorityLevel = 'Standard Priority';
            }
          }

          items.push({
            topicId: topic.id,
            topicTitle: topic.title,
            subtopics: topic.subtopics.map((st) => st.title),
            chapterId: chap.id,
            chapterTitle: chap.title,
            unitTitle: unit.title,
            subjectId: sub.id,
            subjectName: sub.name,
            subjectColor: sub.color,
            pyqCount,
            paperCount: papersSet.size,
            yearsAppeared,
            totalPyqMarks,
            compulsoryPyqMarks,
            optionalPyqMarks,
            questionPatterns,
            completionStatus,
            isCompleted: isComp,
            confidence,
            accuracyPercentage,
            estimatedHours: topic.estimatedHours || 2,
            actualMinutes: m?.totalStudyMinutes || 0,
            personalPriority: m?.personalPriority || topic.personalPriority,
            priorityLevel,
            evidenceScore,
            priorityReason: reasons.join(' · '),
            mappingConfidenceAvg: pyqCount > 0 ? Math.round(confTotal / pyqCount) : 0,
            prerequisites: topic.prerequisites || [],
            sources,
          });
        }
      }
    }
  }

  const rankOrder: Record<EvidencePriorityLevel, number> = {
    'High Priority': 4,
    'Moderate Priority': 3,
    'Standard Priority': 2,
    'Insufficient PYQ evidence': 1,
  };

  return items.sort((a, b) => {
    const rDiff = rankOrder[b.priorityLevel] - rankOrder[a.priorityLevel];
    if (rDiff !== 0) return rDiff;
    if (b.evidenceScore !== a.evidenceScore) return b.evidenceScore - a.evidenceScore;
    return a.topicTitle.localeCompare(b.topicTitle);
  });
}
