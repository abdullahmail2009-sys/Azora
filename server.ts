import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const app = express();
app.use(express.json({ limit: '20mb' }));

// Allow Capacitor Android/iOS WebView origins (https://localhost, capacitor://localhost) to call /api/*
app.use('/api', (req, res, next) => {
  const origin = req.headers.origin;
  if (
    origin &&
    (origin === 'https://localhost' ||
      origin === 'http://localhost' ||
      origin === 'capacitor://localhost' ||
      origin.endsWith('.run.app'))
  ) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

// Helper to check if a secret env var is genuinely configured
function isConfiguredKey(val: string | undefined, placeholder: string): boolean {
  if (!val) return false;
  const trimmed = val.trim();
  return (
    trimmed.length > 8 &&
    trimmed !== placeholder &&
    !trimmed.startsWith('MY_') &&
    !trimmed.startsWith('YOUR_')
  );
}

function getGenAIClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!isConfiguredKey(apiKey, 'MY_GEMINI_API_KEY')) {
    return null;
  }
  return new GoogleGenAI({
    apiKey: apiKey!.trim(),
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function getOpenAIConfig(): { apiKey: string; defaultModel: string } | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!isConfiguredKey(apiKey, 'MY_OPENAI_API_KEY')) {
    return null;
  }
  return {
    apiKey: apiKey!.trim(),
    defaultModel: (process.env.OPENAI_MODEL || 'gpt-4o-mini').trim(),
  };
}

/**
 * Calls the official OpenAI API (Responses API with Chat Completions fallback)
 * using server-side credentials and timeout protection.
 */
async function callOpenAI(options: {
  prompt: string;
  systemInstruction?: string;
  model?: string;
  jsonMode?: boolean;
  temperature?: number;
  timeoutMs?: number;
}): Promise<{ text: string; modelUsed: string }> {
  const cfg = getOpenAIConfig();
  if (!cfg) {
    throw new Error('OPENAI_API_KEY is not configured on the server.');
  }

  const model = options.model || cfg.defaultModel || 'gpt-4o-mini';
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs || 25000);

  try {
    // 1. Attempt official OpenAI Responses API (/v1/responses)
    const responsesPayload: Record<string, any> = {
      model,
      input: options.prompt,
      temperature: options.temperature ?? 0.3,
    };
    if (options.systemInstruction) {
      responsesPayload.instructions = options.systemInstruction;
    }
    if (options.jsonMode) {
      responsesPayload.text = { format: { type: 'json_object' } };
    }

    const res = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify(responsesPayload),
      signal: controller.signal,
    });

    if (res.ok) {
      const data: any = await res.json();
      const outputText =
        typeof data.output_text === 'string' && data.output_text.trim()
          ? data.output_text
          : data.output?.[0]?.content?.[0]?.text || '';
      if (outputText) {
        return { text: outputText, modelUsed: model };
      }
    } else if (res.status === 429) {
      throw new Error('OpenAI rate limit reached (HTTP 429). Please wait a moment and retry.');
    } else if (res.status === 401) {
      throw new Error('OpenAI API key is invalid or unauthorized (HTTP 401).');
    }

    // 2. Fallback to standard OpenAI Chat Completions API (/v1/chat/completions)
    const messages: { role: string; content: string }[] = [];
    if (options.systemInstruction) {
      messages.push({ role: 'system', content: options.systemInstruction });
    }
    messages.push({
      role: 'user',
      content: options.jsonMode
        ? `${options.prompt}\n\nRespond strictly with valid JSON.`
        : options.prompt,
    });

    const chatPayload: Record<string, any> = {
      model,
      messages,
      temperature: options.temperature ?? 0.3,
    };
    if (options.jsonMode) {
      chatPayload.response_format = { type: 'json_object' };
    }

    const chatRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify(chatPayload),
      signal: controller.signal,
    });

    if (!chatRes.ok) {
      const errBody = await chatRes.text().catch(() => '');
      throw new Error(`OpenAI API error (HTTP ${chatRes.status}): ${errBody.slice(0, 180)}`);
    }

    const chatData: any = await chatRes.json();
    const text = chatData.choices?.[0]?.message?.content || '';
    return { text, modelUsed: model };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Server-Sent Events (SSE) streaming handler for OpenAI Chat Completions API.
 */
async function streamOpenAI(
  res: express.Response,
  options: {
    messages: { role: string; content: string }[];
    systemInstruction?: string;
    model?: string;
    temperature?: number;
  }
) {
  const cfg = getOpenAIConfig();
  if (!cfg) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.write(`data: ${JSON.stringify({ error: 'OPENAI_API_KEY is not configured on the server.' })}\n\n`);
    res.write('data: [DONE]\n\n');
    return res.end();
  }

  const model = options.model || cfg.defaultModel || 'gpt-4o-mini';
  const formattedMessages: { role: string; content: string }[] = [];
  if (options.systemInstruction) {
    formattedMessages.push({ role: 'system', content: options.systemInstruction });
  }
  formattedMessages.push(...options.messages);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const apiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: formattedMessages,
        temperature: options.temperature ?? 0.3,
        stream: true,
      }),
    });

    if (!apiRes.ok || !apiRes.body) {
      const errText = await apiRes.text().catch(() => '');
      res.write(`data: ${JSON.stringify({ error: `OpenAI API Error (${apiRes.status}): ${errText.slice(0, 150)}` })}\n\n`);
      res.write('data: [DONE]\n\n');
      return res.end();
    }

    const reader = apiRes.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      res.write(chunk);
    }
    res.end();
  } catch (err: any) {
    res.write(`data: ${JSON.stringify({ error: err.message || 'Streaming request failed' })}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
  }
}

/**
 * Normalizes Gemini model identifiers so deprecated or legacy stored IDs
 * resolve to supported @google/genai models.
 */
function normalizeGeminiModel(rawModel?: string): string {
  const m = (rawModel || '').trim();
  if (!m) return 'gemini-3.8-flash';
  const deprecated = [
    'gemini-1.5-flash',
    'gemini-1.5-pro',
    'gemini-pro',
    'gemini-2.0-flash',
    'gemini-2.0-pro',
    'gemini-2.0-flash-thinking',
    'gemini-2.5-flash',
    'gemini-2.5-pro',
  ];
  if (deprecated.includes(m)) {
    return 'gemini-3.8-flash';
  }
  return m;
}

/**
 * Calls the official Google Gemini API (@google/genai) on the server.
 */
async function callGemini(options: {
  prompt: string;
  systemInstruction?: string;
  model?: string;
  jsonMode?: boolean;
  temperature?: number;
  enableSearchGrounding?: boolean;
}): Promise<{ text: string; modelUsed: string }> {
  const ai = getGenAIClient();
  if (!ai) {
    throw new Error('GEMINI_API_KEY is not configured on the server.');
  }

  const model = normalizeGeminiModel(options.model);
  const config: Record<string, any> = {
    temperature: options.temperature ?? 0.3,
  };
  if (options.systemInstruction) {
    config.systemInstruction = options.systemInstruction;
  }
  if (options.jsonMode && !options.enableSearchGrounding) {
    config.responseMimeType = 'application/json';
  }
  if (options.enableSearchGrounding) {
    config.tools = [{ googleSearch: {} }];
  }

  const response = await ai.models.generateContent({
    model,
    contents: options.prompt,
    config,
  });

  return {
    text: response.text || '',
    modelUsed: model,
  };
}

/**
 * Unified AI Provider Router:
 * Routes requests to OpenAI or Gemini according to preferredProvider ('auto' | 'openai' | 'gemini'),
 * with transparent fallback and diagnostics.
 */
async function generateWithUnifiedProvider(options: {
  prompt: string;
  systemInstruction?: string;
  preferredProvider?: 'auto' | 'openai' | 'gemini' | 'local';
  openaiModel?: string;
  geminiModel?: string;
  jsonMode?: boolean;
  temperature?: number;
  enableSearchGrounding?: boolean;
}): Promise<{
  text: string | null;
  providerUsed: 'openai' | 'gemini' | 'local_rbse_engine';
  modelUsed: string;
  liveApiConnected: boolean;
  diagnostics?: string;
}> {
  const pref = options.preferredProvider || 'auto';
  if (pref === 'local') {
    return {
      text: null,
      providerUsed: 'local_rbse_engine',
      modelUsed: 'azora-rbse-local-v2',
      liveApiConnected: false,
      diagnostics: 'Local RBSE academic engine selected by user preference.',
    };
  }

  const hasOpenAI = Boolean(getOpenAIConfig());
  const hasGemini = Boolean(getGenAIClient());

  const providerOrder: ('openai' | 'gemini')[] =
    pref === 'openai'
      ? ['openai', 'gemini']
      : pref === 'gemini'
      ? ['gemini', 'openai']
      : hasOpenAI
      ? ['openai', 'gemini']
      : ['gemini', 'openai'];

  const errors: string[] = [];

  for (const prov of providerOrder) {
    if (prov === 'openai' && hasOpenAI) {
      try {
        const res = await callOpenAI({
          prompt: options.prompt,
          systemInstruction: options.systemInstruction,
          model: options.openaiModel,
          jsonMode: options.jsonMode,
          temperature: options.temperature,
        });
        if (res.text && res.text.trim()) {
          return {
            text: res.text,
            providerUsed: 'openai',
            modelUsed: res.modelUsed,
            liveApiConnected: true,
          };
        }
      } catch (err: any) {
        errors.push(`OpenAI: ${err.message}`);
      }
    }

    if (prov === 'gemini' && hasGemini) {
      try {
        const res = await callGemini({
          prompt: options.prompt,
          systemInstruction: options.systemInstruction,
          model: options.geminiModel,
          jsonMode: options.jsonMode,
          temperature: options.temperature,
          enableSearchGrounding: options.enableSearchGrounding,
        });
        if (res.text && res.text.trim()) {
          return {
            text: res.text,
            providerUsed: 'gemini',
            modelUsed: res.modelUsed,
            liveApiConnected: true,
          };
        }
      } catch (err: any) {
        errors.push(`Gemini: ${err.message}`);
      }
    }
  }

  return {
    text: null,
    providerUsed: 'local_rbse_engine',
    modelUsed: 'azora-rbse-curriculum-v2',
    liveApiConnected: false,
    diagnostics:
      errors.length > 0
        ? errors.join(' | ')
        : 'Neither OPENAI_API_KEY nor GEMINI_API_KEY is configured in server environment; using built-in RBSE Class 12 curriculum engine.',
  };
}

/**
 * Built-in RBSE Class 12 Academic Explanation Generator when cloud keys are unconfigured or offline.
 */
function buildFallbackAcademicExplanation(params: {
  topicTitle: string;
  chapterTitle?: string;
  subjectName?: string;
  tutorMode?: string;
  userQuery?: string;
}): string {
  const { topicTitle, chapterTitle, subjectName = 'Physics', tutorMode = 'concept_teacher', userQuery } = params;
  const tLower = `${topicTitle} ${userQuery || ''}`.toLowerCase();

  let coreLaw = `In RBSE Class 12 ${subjectName}${chapterTitle ? ` (${chapterTitle})` : ''}, **${topicTitle}** is a high-yield board examination concept.`;
  let formulaBlock = `• Write the standard governing equation with SI units.\n• Define each physical/chemical/mathematical symbol clearly.`;
  let derivationSteps = `1. **Statement & Principle:** State the fundamental law or definition of ${topicTitle}.\n2. **Diagram / Setup:** Draw a clean, labeled diagram or write the balanced chemical/mathematical condition (carries 0.5–1 mark in RBSE board scheme).\n3. **Mathematical / Analytical Progression:** Substitute standard relations step-by-step and box the final result.`;
  let commonMistake = `Forgetting SI units, omitting vector signs/arrows, or skipping the intermediate substitution step in 2-mark and 4-mark board questions.`;

  if (/gauss/i.test(tLower)) {
    coreLaw = `**Gauss's Law in Electrostatics:** The total electric flux ($\\Phi_E$) through any closed hypothetical surface (Gaussian surface) in free space is equal to $\\frac{1}{\\varepsilon_0}$ times the net electric charge ($q_{\\text{enclosed}}$) enclosed within that surface.`;
    formulaBlock = `$$\\Phi_E = \\oint \\vec{E} \\cdot d\\vec{A} = \\frac{q_{\\text{enclosed}}}{\\varepsilon_0}$$\n• $\\Phi_E$: Electric flux ($\\text{N}\\cdot\\text{m}^2\\cdot\\text{C}^{-1}$ or $\\text{V}\\cdot\\text{m}$)\n• $\\vec{E}$: Electric field intensity ($\\text{N/C}$ or $\\text{V/m}$)\n• $\\varepsilon_0$: Permittivity of free space ($8.854 \\times 10^{-12}\\,\\text{C}^2\\text{N}^{-1}\\text{m}^{-2}$)`;
    derivationSteps = `1. **Choose Symmetry-Matched Gaussian Surface:** Use a coaxial cylinder of radius $r$ and length $l$ for an infinite line charge ($\\lambda$), or a pillbox cylinder for an infinite plane sheet ($\\sigma$).\n2. **Evaluate Surface Integral:** Split $\\oint \\vec{E}\\cdot d\\vec{A}$ into curved and flat end caps where $\\theta = 0^\\circ$ or $90^\\circ$.\n3. **Equate to $q/\\varepsilon_0$:** Substitute $q = \\lambda l$ to obtain $E = \\frac{\\lambda}{2\\pi\\varepsilon_0 r}$ (or $E = \\frac{\\sigma}{2\\varepsilon_0}$ for a thin sheet).`;
    commonMistake = `Using charges outside the Gaussian surface when computing $q_{\\text{enclosed}}$, or forgetting that $\\vec{E}$ on the left-hand side is due to all charges (inside and outside).`;
  } else if (/dipole/i.test(tLower)) {
    coreLaw = `**Electric Dipole & Dipole Moment:** An electric dipole consists of two equal and opposite point charges ($+q$ and $-q$) separated by a small distance $2a$. Its dipole moment $\\vec{p}$ points from $-q$ to $+q$.`;
    formulaBlock = `• Dipole Moment: $\\vec{p} = q(2\\vec{a})$ (SI Unit: $\\text{C}\\cdot\\text{m}$)\n• Axial Field: $E_{\\text{axial}} = \\frac{1}{4\\pi\\varepsilon_0} \\frac{2p}{r^3}$ (for $r \\gg a$)\n• Equatorial Field: $E_{\\text{eq}} = \\frac{1}{4\\pi\\varepsilon_0} \\frac{p}{r^3}$\n• Torque in Uniform Field: $\\vec{\\tau} = \\vec{p} \\times \\vec{E} \\implies \\tau = pE\\sin\\theta$`;
    derivationSteps = `1. **Setup:** Place charges $-q$ at $A$ and $+q$ at $B$ separated by $2a$ with midpoint $O$, and point $P$ at distance $r$ from $O$.\n2. **Superposition:** Write $E_{+q} = \\frac{kq}{(r-a)^2}$ and $E_{-q} = \\frac{kq}{(r+a)^2}$.\n3. **Simplify for Short Dipole ($r \\gg a$):** Combine fractions to get $E_{\\text{axial}} = 2 E_{\\text{eq}}$.`;
    commonMistake = `Drawing $\\vec{p}$ from $+q$ to $-q$ (in Physics, $\\vec{p}$ is strictly directed from $-q$ to $+q$).`;
  } else if (/nernst/i.test(tLower)) {
    coreLaw = `**Nernst Equation (Electrochemistry):** Relates the electrode potential or EMF ($E_{\\text{cell}}$) of an electrochemical cell to its standard EMF ($E^\\circ_{\\text{cell}}$), temperature $T$, and the concentrations of reacting species.`;
    formulaBlock = `$$E_{\\text{cell}} = E^\\circ_{\\text{cell}} - \\frac{2.303 RT}{nF} \\log_{10} Q = E^\\circ_{\\text{cell}} - \\frac{0.0591}{n} \\log_{10} \\frac{[\\text{Products (Anode Ion)}]}{[\\text{Reactants (Cathode Ion)}]}$$\n(at $T = 298\\,\\text{K}$, where $n$ = moles of electrons transferred, $F = 96500\\,\\text{C}\\cdot\\text{mol}^{-1}$)`;
    derivationSteps = `1. **Write Balanced Half-Cell Reactions:** Identify cathode (reduction) and anode (oxidation) and determine $n$ (LCM of electrons).\n2. **Calculate $E^\\circ_{\\text{cell}}$:** Use $E^\\circ_{\\text{cell}} = E^\\circ_{\\text{cathode}} - E^\\circ_{\\text{anode}}$.\n3. **Substitute Reaction Quotient $Q$:** Include stoichiometric powers in $Q = \\frac{[\\text{Anode}^{x+}]^a}{[\\text{Cathode}^{y+}]^b}$ and set pure solids/liquids to activity $1$.`;
    commonMistake = `Forgetting stoichiometric exponents on ion concentrations inside $\\log_{10} Q$ or misidentifying $n$.`;
  } else if (/lens|mirror|optics/i.test(tLower)) {
    coreLaw = `**Lens Maker's Formula & Refraction at Spherical Surfaces:** Relates the focal length $f$ of a thin lens to the refractive index $\\mu_{21}$ of its material and the radii of curvature $R_1$ and $R_2$ of its two surfaces.`;
    formulaBlock = `$$\\frac{1}{f} = (\\mu_{21} - 1)\\left(\\frac{1}{R_1} - \\frac{1}{R_2}\\right)$$\n• Power of Lens: $P = \\frac{1}{f(\\text{in m})}$ (SI Unit: Dioptre, $\\text{D}$)`;
    derivationSteps = `1. **Refraction at First Surface:** Apply $\\frac{\\mu_2}{v_1} - \\frac{\\mu_1}{u} = \\frac{\\mu_2 - \\mu_1}{R_1}$ where image $I_1$ acts as virtual object for second surface.\n2. **Refraction at Second Surface:** Apply $\\frac{\\mu_1}{v} - \\frac{\\mu_2}{v_1} = \\frac{\\mu_1 - \\mu_2}{R_2}$.\n3. **Add Equations:** Eliminate $v_1$ and set $u = \\infty \\implies v = f$ to obtain Lens Maker's Formula.`;
    commonMistake = `Not applying Cartesian sign convention ($R_1 > 0, R_2 < 0$ for a biconvex lens) during numerical problems.`;
  }

  return [
    `### RBSE Class 12 Tutor (${tutorMode.replace(/_/g, ' ').toUpperCase()}): ${topicTitle}`,
    userQuery ? `*Addressing your query:* "${userQuery}"\n` : '',
    `#### 1. Conceptual Foundation\n${coreLaw}`,
    `#### 2. Key Formulas, Symbols & SI Units\n${formulaBlock}`,
    `#### 3. Step-by-Step Board Exam Presentation\n${derivationSteps}`,
    `#### 4. High-Yield Examiner Tip & Common Trap\n• **Avoid this mistake:** ${commonMistake}\n• **Board Marking Allocation:** Definition/Law (1M) + Diagram/Formula (1M) + Stepwise Derivation/Calculation with SI Unit (2M).`,
  ]
    .filter(Boolean)
    .join('\n\n');
}

// Health check & AI Provider Status endpoint
app.get(['/api/health', '/api/ai/status'], (req, res) => {
  const geminiConfigured = Boolean(getGenAIClient());
  const openaiCfg = getOpenAIConfig();
  const openaiConfigured = Boolean(openaiCfg);

  res.json({
    status: 'ok',
    appName: 'AZORA',
    session: '2026-27',
    geminiConfigured,
    openaiConfigured,
    defaultGeminiModel: 'gemini-3.8-flash',
    defaultOpenaiModel: openaiCfg?.defaultModel || 'gpt-4o-mini',
    activeProvider: openaiConfigured ? 'openai' : geminiConfigured ? 'gemini' : 'local_rbse_engine',
    timestamp: new Date().toISOString(),
  });
});

// Explain a topic according to RBSE Class 12 guidelines (supports OpenAI, Gemini, and Local RBSE Fallback)
app.post(['/api/gemini/explain', '/api/ai/explain'], async (req, res) => {
  try {
    const {
      topicTitle,
      chapterTitle,
      subjectName,
      userQuery,
      tutorMode = 'concept_teacher',
      provider = 'auto',
      openaiModel,
      geminiModel,
    } = req.body || {};

    if (!topicTitle || !String(topicTitle).trim()) {
      return res.status(400).json({ error: 'Please provide a topicTitle to explain.' });
    }

    const systemPrompt = `You are an expert academic tutor for Rajasthan Board of Secondary Education (RBSE) Class 12 students (Session: 2026–27).
Tutor Mode: ${tutorMode}.
Stay strictly within official RBSE Class 12 syllabus boundaries for ${subjectName || 'the subject'}.
Do not invent page numbers or assume outside curricula.
Provide:
1. Crystal-clear conceptual explanation at Class 12 level
2. Standard formulas with full symbol definitions and SI units
3. Step-by-step derivation, chemical mechanism, or numerical method where applicable
4. Step-wise RBSE board marking scheme tips and common student mistakes to avoid.`;

    const prompt = `Topic: "${topicTitle}" in Chapter: "${chapterTitle || 'General'}" (${subjectName || 'Class 12'}).
Tutor Mode: ${tutorMode}.
Student Question: ${
      userQuery ||
      'Explain this topic clearly with key concepts, definitions, formulas with SI units, derivations/reactions (if any), and frequent questions asked in RBSE board exams.'
    }`;

    const aiRes = await generateWithUnifiedProvider({
      prompt,
      systemInstruction: systemPrompt,
      preferredProvider: provider,
      openaiModel,
      geminiModel,
      temperature: 0.35,
    });

    const explanation =
      aiRes.text ||
      buildFallbackAcademicExplanation({
        topicTitle,
        chapterTitle,
        subjectName,
        tutorMode,
        userQuery,
      });

    res.json({
      explanation,
      providerUsed: aiRes.providerUsed,
      modelUsed: aiRes.modelUsed,
      liveApiConnected: aiRes.liveApiConnected,
      diagnostics: aiRes.diagnostics,
      source:
        aiRes.providerUsed === 'openai'
          ? `OpenAI (${aiRes.modelUsed}) — Grounded in RBSE Class 12 Syllabus`
          : aiRes.providerUsed === 'gemini'
          ? `Google Gemini (${aiRes.modelUsed}) — Grounded in RBSE Class 12 Syllabus`
          : 'AZORA Built-in RBSE Class 12 Academic Engine (Offline / Local Ready)',
    });
  } catch (error: any) {
    console.error('AI explain error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate explanation' });
  }
});

// Generate chapter practice quiz tailored to RBSE board patterns
app.post(['/api/gemini/quiz', '/api/ai/quiz'], async (req, res) => {
  try {
    const {
      chapterTitle,
      subjectName = 'Physics',
      topicTitle,
      provider = 'auto',
      openaiModel,
      geminiModel,
    } = req.body || {};

    if (!chapterTitle && !topicTitle) {
      return res.status(400).json({ error: 'Please provide a chapterTitle or topicTitle.' });
    }

    const focusLabel = topicTitle ? `${topicTitle} (${chapterTitle || subjectName})` : chapterTitle;

    const prompt = `Generate 3 practice questions for RBSE Class 12 ${subjectName}, Chapter: "${
      chapterTitle || 'Core Chapter'
    }", Topic: "${topicTitle || 'Overall Chapter'}".
Follow official RBSE board examination pattern:
- Question 1: 1 Mark Short/Conceptual question
- Question 2: 2 Marks Reasoning / Numerical / Reaction question
- Question 3: 4 Marks Derivation / Comprehensive problem
Format the response strictly as valid JSON with keys:
{
  "questions": [
    {
      "marks": number,
      "type": "1_mark" | "2_marks" | "4_marks",
      "question": "string",
      "modelAnswer": "string step-by-step answer",
      "boardTip": "string"
    }
  ]
}`;

    const aiRes = await generateWithUnifiedProvider({
      prompt,
      preferredProvider: provider,
      openaiModel,
      geminiModel,
      jsonMode: true,
      temperature: 0.3,
    });

    if (aiRes.text) {
      try {
        const cleaned = aiRes.text.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
        const parsed = JSON.parse(cleaned);
        if (Array.isArray(parsed.questions) && parsed.questions.length > 0) {
          return res.json({
            questions: parsed.questions,
            providerUsed: aiRes.providerUsed,
            modelUsed: aiRes.modelUsed,
            liveApiConnected: aiRes.liveApiConnected,
          });
        }
      } catch {
        // Fall through to deterministic RBSE board quiz generator
      }
    }

    // Deterministic RBSE Class 12 Board Practice Questions Fallback
    const fallbackQuestions = [
      {
        marks: 1,
        type: '1_mark',
        question: `Define the fundamental principle or SI unit associated with ${focusLabel} in RBSE Class 12 ${subjectName}.`,
        modelAnswer: `Step 1 (0.5M): State the exact textbook definition of ${focusLabel}.\nStep 2 (0.5M): Write its governing mathematical symbol and standard SI unit.`,
        boardTip: 'In 1-mark RBSE questions, always include the SI unit even if not explicitly asked.',
      },
      {
        marks: 2,
        type: '2_marks',
        question: `Explain the physical/chemical significance of ${focusLabel} and solve a standard application or write its governing equation with conditions.`,
        modelAnswer: `Step 1 (1M): Write the governing formula/reaction for ${focusLabel} and define all terms.\nStep 2 (1M): State two key properties, boundary conditions, or a worked numerical substitution with proper units.`,
        boardTip: 'Box the formula and underline key technical terms for full 2/2 marks.',
      },
      {
        marks: 4,
        type: '4_marks',
        question: `Derive the complete mathematical expression or explain the comprehensive mechanism of ${focusLabel} with a neat labeled diagram.`,
        modelAnswer: `Step 1 (1M): Statement of law/principle and clear labeled diagram.\nStep 2 (2M): Step-by-step mathematical derivation or mechanism from first principles.\nStep 3 (1M): Final boxed expression and discussion of special cases.`,
        boardTip: 'In 4-mark long answers, 1 mark is strictly reserved for a neat labeled diagram or schematic.',
      },
    ];

    res.json({
      questions: fallbackQuestions,
      providerUsed: aiRes.providerUsed,
      modelUsed: aiRes.modelUsed,
      liveApiConnected: aiRes.liveApiConnected,
      diagnostics: aiRes.diagnostics,
    });
  } catch (error: any) {
    console.error('AI quiz error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate quiz' });
  }
});

// Analyze mistake from mock test or practice
app.post(['/api/gemini/analyze-mistake', '/api/ai/analyze-mistake'], async (req, res) => {
  try {
    const {
      subject = 'Physics',
      chapter = 'General',
      mistakeDescription,
      studentAttempt,
      provider = 'auto',
      openaiModel,
      geminiModel,
    } = req.body || {};

    if (!mistakeDescription || !String(mistakeDescription).trim()) {
      return res.status(400).json({ error: 'Please provide a mistakeDescription to analyze.' });
    }

    const prompt = `A Class 12 student made this error in ${subject}, Chapter: ${chapter}.
Problem / Error: "${mistakeDescription}"
Student's Attempt: "${studentAttempt || 'Not specified'}"

Diagnose:
1. Root concept misunderstanding
2. Precise step-by-step correction with formula/units
3. A memorable rule-of-thumb to never repeat this in RBSE board exams.
Keep concise (under 180 words).`;

    const aiRes = await generateWithUnifiedProvider({
      prompt,
      preferredProvider: provider,
      openaiModel,
      geminiModel,
      temperature: 0.3,
    });

    const diagnosis =
      aiRes.text ||
      `1. **Root Concept Misunderstanding:** In ${subject} (${chapter}), the error in *"${mistakeDescription}"*${
        studentAttempt ? ` (Attempt: *"${studentAttempt}"*)` : ''
      } stems from applying the formula or sign convention without verifying boundary conditions and standard SI units.\n\n2. **Precise Correction:** Always write the base equation first, convert all given quantities into standard SI units (meters, kilograms, seconds, Coulombs, moles) before substitution, and verify the sign/direction using standard convention.\n\n3. **RBSE Board Rule of Thumb:** Never substitute numbers directly—write (i) Given Data with SI units, (ii) Formula Used, and (iii) Sign/Vector check on the right margin.`;

    res.json({
      diagnosis,
      providerUsed: aiRes.providerUsed,
      modelUsed: aiRes.modelUsed,
      liveApiConnected: aiRes.liveApiConnected,
    });
  } catch (error: any) {
    console.error('Mistake analysis error:', error);
    res.status(500).json({ error: error.message || 'Failed to analyze mistake' });
  }
});

// AI Assistant conversational endpoint with live app context & multi-provider support
app.post(['/api/gemini/assistant', '/api/ai/chat'], async (req, res) => {
  try {
    const {
      userPrompt,
      contextSummary,
      localAnalysisReply,
      tutorMode = 'concept_teacher',
      provider = 'auto',
      openaiModel,
      geminiModel,
      enableSearchGrounding = false,
      messages,
      stream = false,
    } = req.body || {};

    const systemPrompt = `You are the AZORA Personal AI Study Assistant & RBSE Class 12 Academic Tutor.
Active Tutor Mode: ${tutorMode}.
Stay strictly within official RBSE Class 12 syllabus boundaries (Physics, Chemistry, Mathematics).
Provide step-by-step conceptual explanations, standard formulas with full symbol definitions and SI units, and board marking tips.`;

    const chatHistory: { role: string; content: string }[] = [];
    if (Array.isArray(messages) && messages.length > 0) {
      for (const m of messages) {
        if (m && typeof m.content === 'string' && m.content.trim()) {
          chatHistory.push({
            role: m.role === 'assistant' ? 'assistant' : 'user',
            content: String(m.content).slice(0, 8000),
          });
        }
      }
    }

    if (userPrompt && typeof userPrompt === 'string' && userPrompt.trim()) {
      const formattedPrompt = `${userPrompt}\n\n[Academic Context: ${contextSummary || 'RBSE Class 12 PCM'}]`;
      if (chatHistory.length === 0 || chatHistory[chatHistory.length - 1].content !== formattedPrompt) {
        chatHistory.push({ role: 'user', content: formattedPrompt.slice(0, 10000) });
      }
    }

    if (stream === true) {
      return streamOpenAI(res, {
        messages: chatHistory,
        systemInstruction: systemPrompt,
        model: openaiModel,
        temperature: 0.3,
      });
    }

    const lastMsg = chatHistory[chatHistory.length - 1]?.content || userPrompt || 'Explain the concept step by step';
    const aiRes = await generateWithUnifiedProvider({
      prompt: lastMsg,
      systemInstruction: systemPrompt,
      preferredProvider: provider,
      openaiModel,
      geminiModel,
      temperature: 0.3,
      enableSearchGrounding: Boolean(enableSearchGrounding),
    });

    res.json({
      reply: aiRes.text || localAnalysisReply || 'Completed action on your local study data.',
      usedGemini: aiRes.providerUsed === 'gemini',
      usedOpenAI: aiRes.providerUsed === 'openai',
      providerUsed: aiRes.providerUsed,
      modelUsed: aiRes.modelUsed,
      liveApiConnected: aiRes.liveApiConnected,
      diagnostics: aiRes.diagnostics,
    });
  } catch (error: any) {
    res.json({
      reply: req.body?.localAnalysisReply || 'Completed action on your local study data.',
      usedGemini: false,
      usedOpenAI: false,
      providerUsed: 'local_rbse_engine',
      modelUsed: 'azora-rbse-curriculum-v2',
      liveApiConnected: false,
      diagnostics: error?.message || 'Fallback to local RBSE curriculum engine.',
    });
  }
});

// Scan & extract syllabus document / text or scanned PDF via Gemini or OpenAI
app.post(['/api/gemini/scan-syllabus', '/api/ai/scan-syllabus'], async (req, res) => {
  try {
    const { rawText, pdfBase64, filename, academicSession, provider = 'auto' } = req.body || {};
    const sessionLabel = academicSession || '2027–28';

    const ai = getGenAIClient();
    if (pdfBase64 && ai) {
      const contents: any[] = [
        {
          inlineData: {
            data: pdfBase64,
            mimeType: 'application/pdf',
          },
        },
        `Extract all readable text and structured syllabus/question items from this PDF document (${
          filename || 'Document.pdf'
        }) for academic session ${sessionLabel}.
Return JSON strictly matching this schema:
{
  "rawText": "full extracted readable text from the document",
  "detectedSubject": "string",
  "academicSession": "${sessionLabel}",
  "verificationStatus": "ai_extracted",
  "chapters": [
    {
      "number": number,
      "title": "string",
      "marksWeightage": number or null,
      "topics": [
        {
          "title": "string",
          "estimatedHours": number,
          "difficulty": "Easy" | "Moderate" | "Hard"
        }
      ]
    }
  ]
}
Do not fabricate information.`,
      ];

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents,
        config: {
          responseMimeType: 'application/json',
          temperature: 0.1,
        },
      });

      const parsed = JSON.parse(response.text || '{}');
      return res.json(parsed);
    }

    if (rawText) {
      const prompt = `You are an AI syllabus analyzer. Parse the following text into structured syllabus items for RBSE Class 12:
Input:
${String(rawText).slice(0, 14000)}

Return JSON strictly matching this schema:
{
  "rawText": "string",
  "detectedSubject": "string",
  "academicSession": "${sessionLabel}",
  "verificationStatus": "ai_extracted",
  "chapters": [
    {
      "number": number,
      "title": "string",
      "marksWeightage": number or null,
      "topics": [
        {
          "title": "string",
          "estimatedHours": number,
          "difficulty": "Easy" | "Moderate" | "Hard"
        }
      ]
    }
  ]
}
Do not fabricate information. If marks or details are missing, set to null.`;

      const aiRes = await generateWithUnifiedProvider({
        prompt,
        preferredProvider: provider,
        jsonMode: true,
        temperature: 0.1,
      });

      if (aiRes.text) {
        const parsed = JSON.parse(aiRes.text);
        return res.json({
          rawText: parsed.rawText || rawText || '',
          ...parsed,
        });
      }
    }

    return res.status(503).json({
      error:
        'Scanned PDF OCR requires GEMINI_API_KEY or OPENAI_API_KEY configured on the server, or you can paste the text manually.',
    });
  } catch (error: any) {
    console.error('Scan syllabus error:', error);
    res.status(500).json({ error: error.message || 'Failed to parse syllabus document' });
  }
});

// Extract PYQs from PDF text or OCR text
app.post(['/api/gemini/extract-pyqs', '/api/ai/extract-pyqs'], async (req, res) => {
  try {
    const { rawText, fileName, provider = 'auto' } = req.body || {};

    const prompt = `Extract previous year examination questions (PYQs) from the following document text (File: ${
      fileName || 'Uploaded PDF'
    }).
Do not invent questions or marks. Only extract questions actually present in the text.
Input:
${String(rawText || '').slice(0, 12000)}

Return JSON strictly matching:
{
  "questions": [
    {
      "questionText": "string",
      "marks": number,
      "examYear": "string",
      "examName": "string",
      "questionType": "Derivation" | "Numerical" | "MCQ" | "Short Answer" | "Long Answer",
      "pageNumber": number,
      "isOptionalAlternative": boolean
    }
  ]
}`;

    const aiRes = await generateWithUnifiedProvider({
      prompt,
      preferredProvider: provider,
      jsonMode: true,
      temperature: 0.1,
    });

    if (aiRes.text) {
      const parsed = JSON.parse(aiRes.text);
      return res.json(parsed);
    }

    return res.json({ questions: [] });
  } catch (error: any) {
    console.error('Extract PYQs error:', error);
    res.status(500).json({ error: error.message || 'Failed to extract PYQs' });
  }
});

// Vite middleware or static serving
const PORT = 3000;

async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static('dist'));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve('dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`AZORA server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
