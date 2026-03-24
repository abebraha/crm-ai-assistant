import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { toFile } from 'openai';

export async function POST(req: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OPENAI_API_KEY is not configured' }, { status: 500 });
    }
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const form = await req.formData();
    const audio = form.get('audio') as File | null;
    if (!audio) return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });

    // Convert File to a format Whisper can accept
    const arrayBuffer = await audio.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const file = await toFile(buffer, 'voice.webm', { type: 'audio/webm' });

    const transcription = await openai.audio.transcriptions.create({
      file,
      model:    'whisper-1',
      language: 'en',
    });

    return NextResponse.json({ transcript: transcription.text });
  } catch (err: unknown) {
    console.error('[/api/voice]', err);
    const message = err instanceof Error ? err.message : 'Transcription failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// App Router handles body parsing automatically
