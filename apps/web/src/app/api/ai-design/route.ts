import { NextRequest, NextResponse } from 'next/server';

const SYSTEM_PROMPT = `You are an expert event invitation designer.
When given a description, return ONLY a valid JSON object with this exact structure:
{
  "background": "#hexcolor",
  "objects": [
    {
      "type": "rect|circle|text|itext",
      "left": number,
      "top": number,
      "width": number (for rect),
      "height": number (for rect),
      "radius": number (for circle),
      "fill": "#hexcolor",
      "text": "string" (for text/itext only),
      "fontSize": number (for text/itext),
      "fontFamily": "font name",
      "fontWeight": "normal|bold",
      "textAlign": "left|center|right",
      "rx": number (border radius for rect),
      "ry": number (border radius for rect),
      "opacity": 0-1
    }
  ]
}

Canvas is 600x850 pixels (portrait, like an invitation card).
Rules:
- Always start with a full background rect (left:0, top:0, width:600, height:850) as first object
- Center text horizontally: left should be 300 for centered text (use textAlign center + originX center)
- Use elegant, sophisticated color palettes — no neon colors
- Include 4-8 objects total: background, decorative shapes, title, subtitle, date/details
- Use tasteful fonts: "Georgia, serif" for elegant, "Inter, sans-serif" for modern
- Keep text within left:40 to left:560 range
- Return ONLY the JSON object, no explanation, no markdown, no backticks`;

export async function POST(req: NextRequest) {
  try {
    const { prompt, eventTitle } = await req.json();

    const userMessage = eventTitle
      ? `Event: "${eventTitle}". Design description: ${prompt}`
      : prompt;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method:  'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         process.env.ANTHROPIC_API_KEY ?? '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-sonnet-4-20250514',
        max_tokens: 2000,
        system:     SYSTEM_PROMPT,
        messages:   [{ role: 'user', content: userMessage }]
      })
    });

    if (!response.ok) {
      const err = await response.text();
      return NextResponse.json({ error: err }, { status: 500 });
    }

    const data = await response.json();
    const text = data.content?.[0]?.text ?? '';

    // Parse the JSON from the response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: 'No JSON in response' }, { status: 500 });
    }

    const layout = JSON.parse(jsonMatch[0]);
    return NextResponse.json({ layout });

  } catch (err) {
    console.error('AI design error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
