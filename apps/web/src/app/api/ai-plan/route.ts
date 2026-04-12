import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':         'application/json',
        'x-api-key':            process.env.ANTHROPIC_API_KEY ?? '',
        'anthropic-version':    '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-sonnet-4-20250514',
        max_tokens: 2000,
        system: `You are an expert event planner. When given an event description, respond ONLY with a valid JSON object (no markdown, no backticks, no preamble) with this exact structure:
{
  "title": "string",
  "description": "string (2-3 sentences, warm and inviting)",
  "suggestedDate": "ISO date string or empty string if unclear",
  "location": "string",
  "schedule": [{"time": "string", "description": "string"}],
  "checklist": [{"category": "string", "item": "string"}],
  "budget": [{"category": "string", "estimate": "string"}],
  "invitationDraft": "string",
  "reminderCopy": "string"
}`,
        messages: [{ role: 'user', content: `Plan this event: ${body.description}` }]
      })
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: err }, { status: res.status });
    }

    const data = await res.json();
    const text = data.content?.[0]?.text ?? '';

    try {
      const parsed = JSON.parse(text);
      return NextResponse.json({ success: true, data: parsed });
    } catch {
      return NextResponse.json({ error: 'Failed to parse AI response', raw: text }, { status: 500 });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
