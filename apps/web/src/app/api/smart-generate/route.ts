import { NextRequest, NextResponse } from 'next/server';

const SYSTEM_PROMPT = `You are a world-class event invitation designer.

Return ONLY a valid JSON object — no markdown, no backticks:
{
  "dallePrompt": "detailed image generation prompt for DALL-E 3",
  "photoQuery": "2-3 simple Unsplash fallback search words",
  "background": "#hexcolor solid fallback",
  "objects": [ ... ]
}

CANVAS: 600x850 pixels portrait invitation card.

DALLE PROMPT RULES:
- Write a vivid, detailed image generation prompt
- Always end with: "portrait orientation, photorealistic, high quality, no text, no watermarks"
- Example: "Ancient Indian palace at golden sunset, grand marble arches, Sarayu river in background, warm saffron and gold tones, portrait orientation, photorealistic, high quality, no text, no watermarks"

PHOTO QUERY: 2-3 simple Unsplash words as fallback e.g. "indian palace gold"

CRITICAL LAYOUT RULES:
- First object: dark overlay rect (left:0, top:0, width:600, height:850, fill:#000000, opacity:0.5)
- TOP ZONE only (y:40-220): eyebrow text, title, divider
- BOTTOM ZONE only (y:620-820): date, location, CTA button+text
- CENTER (y:220-620): COMPLETELY EMPTY — let the background image show
- ALL text: white #FFFFFF or gold #D4AF37 — never dark colors
- Use ACTUAL event data provided — never placeholder text

EXACT OBJECT PLACEMENTS:
1. Overlay rect: left:0, top:0, width:600, height:850, fill:#000000, opacity:0.5
2. Top accent bar: left:0, top:0, width:600, height:4, fill:#D4AF37
3. Eyebrow: left:300, top:50, fontSize:11, fill:#D4AF37, textAlign:center, text:"YOU ARE INVITED"
4. Title: left:300, top:100, fontSize:46, fontWeight:bold, fill:#FFFFFF, textAlign:center, fontFamily:"Georgia, serif"
5. Subtitle: left:300, top:165, fontSize:18, fill:#D4AF37, textAlign:center
6. Divider: left:220, top:200, width:160, height:2, fill:#D4AF37, opacity:0.8
7. Bottom accent bar: left:0, top:820, width:600, height:4, fill:#D4AF37  
8. Date: left:300, top:640, fontSize:15, fill:#FFFFFF, textAlign:center
9. Location: left:300, top:668, fontSize:14, fill:#D4AF37, textAlign:center
10. CTA rect: left:200, top:710, width:200, height:42, fill:#D4AF37, rx:4
11. CTA text: left:300, top:731, fontSize:13, fill:#1a1a1a, fontWeight:bold, textAlign:center, text:"RSVP NOW"

USE THE ACTUAL EVENT DATA provided — replace title/date/location with real values.`;

async function generateWithDalle(imagePrompt: string): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model:   'dall-e-3',
        prompt:  imagePrompt,
        n:       1,
        size:    '1024x1792',
        quality: 'standard',
      })
    });

    if (!res.ok) {
      console.warn('DALL-E failed:', await res.text());
      return null;
    }

    const data = await res.json();
    return data.data?.[0]?.url ?? null;
  } catch (err) {
    console.warn('DALL-E error:', err);
    return null;
  }
}

async function getUnsplashPhoto(queries: string[]): Promise<string | null> {
  const key = process.env.NEXT_PUBLIC_UNSPLASH_ACCESS_KEY;
  if (!key) return null;

  for (const q of queries) {
    try {
      const res = await fetch(
        `https://api.unsplash.com/search/photos?query=${encodeURIComponent(q)}&per_page=5&orientation=portrait`,
        { headers: { Authorization: `Client-ID ${key}` } }
      );
      const data = await res.json();
      const photos = data.results ?? [];
      if (photos.length > 0) {
        const pick = photos[Math.floor(Math.random() * Math.min(photos.length, 3))];
        // Track download per Unsplash guidelines
        fetch(`https://api.unsplash.com/photos/${pick.id}/download`, {
          headers: { Authorization: `Client-ID ${key}` }
        }).catch(() => {});
        return pick.urls.regular;
      }
    } catch { continue; }
  }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const { prompt, eventTitle, eventDate, eventLocation } = await req.json();

    const formattedDate = eventDate
      ? new Date(eventDate).toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' })
      : '';

    const context = [
      eventTitle    ? `Event name: "${eventTitle}"` : '',
      formattedDate ? `Date: ${formattedDate}` : '',
      eventLocation ? `Location: ${eventLocation}` : '',
    ].filter(Boolean).join('. ');

    const userMessage = `${context ? context + '.\n\n' : ''}Design style: ${prompt}`;

    // Step 1: Claude generates layout + prompts
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         process.env.ANTHROPIC_API_KEY ?? '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-sonnet-4-20250514',
        max_tokens: 3000,
        system:     SYSTEM_PROMPT,
        messages:   [{ role: 'user', content: userMessage }]
      })
    });

    if (!anthropicRes.ok) {
      return NextResponse.json({ error: await anthropicRes.text() }, { status: 500 });
    }

    const anthropicData = await anthropicRes.json();
    const text = anthropicData.content?.[0]?.text ?? '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return NextResponse.json({ error: 'No JSON in AI response' }, { status: 500 });

    const layout = JSON.parse(jsonMatch[0]);

    // Step 2: Try DALL-E 3 first
    let photoUrl: string | null = null;
    let photoSource = 'none';

    if (layout.dallePrompt) {
      photoUrl = await generateWithDalle(layout.dallePrompt);
      if (photoUrl) photoSource = 'dalle';
    }

    // Step 3: Fall back to Unsplash
    if (!photoUrl) {
      const fallbackQueries = [
        layout.photoQuery,
        'indian palace golden',
        'ancient temple architecture',
        'dark luxury texture',
      ].filter(Boolean);

      photoUrl = await getUnsplashPhoto(fallbackQueries);
      if (photoUrl) photoSource = 'unsplash';
    }

    return NextResponse.json({ layout, photoUrl, photoSource });

  } catch (err) {
    console.error('Smart generate error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
