import { NextResponse } from 'next/server';
import {
  generateProfilePrompt,
  generateResearchPrompt,
  type ProfilePromptContext,
  type ResearchPromptContext,
} from '@/lib/promptGeneration/generateSmartPrompt';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { type, context } = body;

    if (!type || !context) {
      return NextResponse.json(
        { error: 'Missing type or context' },
        { status: 400 }
      );
    }

    let prompt: string;

    if (type === 'profile') {
      prompt = await generateProfilePrompt(context as ProfilePromptContext);
    } else if (type === 'research') {
      prompt = await generateResearchPrompt(context as ResearchPromptContext);
    } else {
      return NextResponse.json(
        { error: 'Invalid type. Must be "profile" or "research"' },
        { status: 400 }
      );
    }

    return NextResponse.json({ prompt });
  } catch (error) {
    console.error('Failed to generate prompt:', error);
    return NextResponse.json(
      { error: 'Failed to generate prompt' },
      { status: 500 }
    );
  }
}
