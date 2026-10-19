import { Router, Request, Response } from 'express';
import OpenAI from 'openai';

const router = Router();

function isConfiguredKey(val: string | undefined): boolean {
  if (!val) return false;
  const trimmed = val.trim();
  return (
    trimmed.length > 8 &&
    !trimmed.startsWith('MY_') &&
    !trimmed.startsWith('YOUR_') &&
    trimmed !== 'MY_OPENAI_API_KEY'
  );
}

function getOpenAIClient(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!isConfiguredKey(apiKey)) {
    return null;
  }
  return new OpenAI({
    apiKey: apiKey!.trim(),
  });
}

/**
 * Express POST endpoint at '/api/ai/chat' (or mounted at '/api/ai/chat')
 * Uses official OpenAI SDK for streaming chat completions with multi-turn conversation context.
 */
router.post('/chat', async (req: Request, res: Response) => {
  try {
    const {
      messages,
      userPrompt,
      contextSummary,
      tutorMode = 'concept_teacher',
      model,
      temperature = 0.3,
      stream = false,
    } = req.body || {};

    const apiKey = process.env.OPENAI_API_KEY;
    if (!isConfiguredKey(apiKey)) {
      return res.status(401).json({
        error: 'OPENAI_API_KEY is missing or invalid in server environment.',
      });
    }

    const openai = getOpenAIClient();
    if (!openai) {
      return res.status(401).json({
        error: 'Failed to initialize OpenAI client.',
      });
    }

    const selectedModel = model || process.env.OPENAI_MODEL || 'gpt-4o-mini';

    // Build system instruction
    const systemInstruction = `You are the AZORA Personal AI Study Assistant & RBSE Class 12 Academic Tutor.
Active Tutor Mode: ${tutorMode}.
Target Curriculum: Rajasthan Board of Secondary Education (RBSE) Class 12 Physics, Chemistry, and Mathematics (PCM).
Instructions:
- Provide clear, step-by-step conceptual explanations with standard formulas, symbol definitions, and SI units.
- Include RBSE board examination marking tips and common student traps to avoid.
- Stay grounded strictly in Class 12 syllabus boundaries.`;

    const formattedMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemInstruction },
    ];

    // Process conversation history
    if (Array.isArray(messages) && messages.length > 0) {
      for (const m of messages) {
        if (m && typeof m.content === 'string' && m.content.trim()) {
          const role = m.role === 'assistant' ? 'assistant' : 'user';
          formattedMessages.push({
            role,
            content: m.content.slice(0, 8000),
          });
        }
      }
    }

    // Process current prompt if provided separately
    if (userPrompt && typeof userPrompt === 'string' && userPrompt.trim()) {
      const fullUserContent = `${userPrompt}\n\n[Academic Context: ${contextSummary || 'RBSE Class 12 PCM'}]`;
      const lastMsg = formattedMessages[formattedMessages.length - 1];
      if (!lastMsg || lastMsg.role !== 'user' || lastMsg.content !== fullUserContent) {
        formattedMessages.push({
          role: 'user',
          content: fullUserContent.slice(0, 10000),
        });
      }
    }

    // Ensure at least one user message exists
    if (formattedMessages.length <= 1) {
      formattedMessages.push({
        role: 'user',
        content: 'Explain the core concepts, formulas, and board tips for this topic.',
      });
    }

    // Handle Streaming Response mode
    if (stream !== false) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      try {
        const completionStream = await openai.chat.completions.create({
          model: selectedModel,
          messages: formattedMessages,
          temperature,
          stream: true,
        });

        for await (const chunk of completionStream) {
          const content = chunk.choices[0]?.delta?.content || '';
          if (content) {
            res.write(`data: ${JSON.stringify({ content, model: selectedModel })}\n\n`);
          }
        }
        res.write('data: [DONE]\n\n');
        return res.end();
      } catch (streamErr: any) {
        res.write(
          `data: ${JSON.stringify({
            error: streamErr.message || 'OpenAI streaming request failed.',
          })}\n\n`
        );
        res.write('data: [DONE]\n\n');
        return res.end();
      }
    }

    // Standard Non-Streaming JSON mode
    const completion = await openai.chat.completions.create({
      model: selectedModel,
      messages: formattedMessages,
      temperature,
    });

    const reply = completion.choices[0]?.message?.content || 'No response generated.';
    return res.json({
      reply,
      providerUsed: 'openai',
      modelUsed: selectedModel,
      liveApiConnected: true,
    });
  } catch (error: any) {
    console.error('OpenAI Chat API error:', error);
    return res.status(500).json({
      error: error.message || 'Internal server error while communicating with OpenAI.',
    });
  }
});

export default router;
