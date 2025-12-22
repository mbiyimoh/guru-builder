/**
 * Guru Test Chat API
 *
 * POST /api/projects/[id]/guru/chat - Stream chat response from guru
 *
 * This is a testing endpoint that allows users to chat with their guru
 * before publishing. It uses the guru profile and corpus context to
 * generate educational responses. Limited to 20 messages per session.
 */

import { NextRequest, NextResponse } from 'next/server';
import { streamText, CoreMessage } from 'ai';
import { openai } from '@ai-sdk/openai';
import { prisma } from '@/lib/db';
import { withProjectAuth } from '@/lib/api/auth-helpers';
import { buildProfilePromptBlock } from '@/lib/guruProfile/promptFormatter';
import type { GuruProfileData } from '@/lib/guruProfile/types';
import { z } from 'zod';

const MAX_MESSAGES_PER_SESSION = 20;

type RouteContext = {
  params: Promise<{ id: string }>;
};

const chatRequestSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(['user', 'assistant']),
      parts: z.array(
        z.object({
          type: z.string(),
          text: z.string().optional(),
        })
      ),
    })
  ),
});


/**
 * Compose corpus context from context layers and knowledge files
 */
async function composeCorpusContext(projectId: string): Promise<string> {
  const [layers, files] = await Promise.all([
    prisma.contextLayer.findMany({
      where: { projectId, isActive: true },
      orderBy: { priority: 'asc' },
      select: { title: true, content: true },
    }),
    prisma.knowledgeFile.findMany({
      where: { projectId, isActive: true },
      orderBy: { title: 'asc' },
      select: { title: true, content: true },
    }),
  ]);

  if (layers.length === 0 && files.length === 0) {
    throw new Error('No active corpus content found. Cannot test guru without knowledge base.');
  }

  let contextText = '# GURU KNOWLEDGE BASE\n\n';

  if (layers.length > 0) {
    contextText += '## Context Layers (Core Knowledge)\n\n';
    layers.forEach((layer) => {
      contextText += `### ${layer.title}\n\n${layer.content}\n\n---\n\n`;
    });
  }

  if (files.length > 0) {
    contextText += '## Knowledge Files (Reference Material)\n\n';
    files.forEach((file) => {
      contextText += `### ${file.title}\n\n${file.content}\n\n---\n\n`;
    });
  }

  return contextText;
}

/**
 * POST /api/projects/[id]/guru/chat
 * Stream chat response from guru
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id: projectId } = await context.params;

    // Authenticate user
    const authError = await withProjectAuth(projectId);
    if (authError) return authError;

    // Parse and validate request body
    const body = await request.json();
    const parsed = chatRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { messages: uiMessages } = parsed.data;

    // Count user messages to enforce limit
    const userMessageCount = uiMessages.filter((m) => m.role === 'user').length;
    if (userMessageCount > MAX_MESSAGES_PER_SESSION) {
      return NextResponse.json(
        {
          error: 'Message limit exceeded',
          message: `You have reached the maximum of ${MAX_MESSAGES_PER_SESSION} messages per test session. Please reset to start a new conversation.`
        },
        { status: 429 }
      );
    }

    // Fetch project with guru profile
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        currentProfile: true,
      },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    if (!project.currentProfile) {
      return NextResponse.json(
        { error: 'No guru profile found. Please create a guru profile first.' },
        { status: 400 }
      );
    }

    // Build system prompt with guru profile and corpus context
    const profileData = project.currentProfile.profileData as GuruProfileData;
    const profileBlock = buildProfilePromptBlock(profileData);
    const corpusContext = await composeCorpusContext(projectId);

    const systemPrompt = `${profileBlock}

${corpusContext}

---

## TEST MODE INSTRUCTIONS

You are in TEST MODE. The user is testing your teaching capabilities before publishing you.

Your responses should:
1. Stay in character as the guru profile described above
2. Be educational and helpful
3. Draw from the knowledge base provided
4. Use the teaching style and tone specified in your profile
5. Be conversational and engaging
6. Ask clarifying questions when appropriate
7. Provide examples when helpful

Remember: This is a test conversation to help the creator verify your personality and teaching effectiveness.`;

    // Convert AI SDK v5 message format to CoreMessage format
    const coreMessages: CoreMessage[] = uiMessages.map((msg) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.parts
        .filter((p) => p.type === 'text' && p.text)
        .map((p) => p.text || '')
        .join(''),
    }));

    const messages: CoreMessage[] = [
      { role: 'system', content: systemPrompt },
      ...coreMessages,
    ];

    // Stream response with GPT-4o
    const model = openai('gpt-4o');
    const result = streamText({
      model,
      messages,
    });

    return result.toTextStreamResponse();
  } catch (error) {
    console.error('[Guru Chat API] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to process guru chat',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
