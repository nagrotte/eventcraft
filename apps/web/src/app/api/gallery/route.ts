// src/app/api/gallery/route.ts
// Server-side proxy for akriti.net gallery API.
// Keeps AKRITI_API_KEY out of the browser.

import { NextRequest, NextResponse } from 'next/server';

const AKRITI_API_URL = process.env.AKRITI_API_URL ?? 'https://609epq36ie.execute-api.us-east-1.amazonaws.com';
const AKRITI_API_KEY = process.env.AKRITI_API_KEY ?? '';

function akritiFetch(path: string, body: object) {
  return fetch(`${AKRITI_API_URL}${path}`, {
    method:  'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key':    AKRITI_API_KEY,
    },
    body: JSON.stringify(body),
  });
}

// POST /api/gallery
// action: "create" | "upload-url"
export async function POST(req: NextRequest) {
  try {
    if (!AKRITI_API_KEY) {
      return NextResponse.json({ error: 'Gallery integration not configured' }, { status: 503 });
    }

    const body = await req.json();
    const { action } = body;

    // ── Create gallery ──────────────────────────────────────────────────────
    if (action === 'create') {
      const { title, eventId } = body;
      const res  = await akritiFetch('/external/galleries', { title, eventId, source: 'eventcraft' });
      const data = await res.json();
      if (!res.ok) return NextResponse.json({ error: data.message ?? 'Failed to create gallery' }, { status: res.status });
      return NextResponse.json(data);
    }

    // ── Get presigned upload URL ────────────────────────────────────────────
    if (action === 'upload-url') {
      const { galleryId, filename, contentType } = body;
      if (!galleryId) return NextResponse.json({ error: 'galleryId required' }, { status: 400 });
      const res  = await akritiFetch(`/external/galleries/${galleryId}/upload-url`, {
        filename,
        contentType: contentType ?? 'image/jpeg',
      });
      const data = await res.json();
      if (!res.ok) return NextResponse.json({ error: data.error ?? 'Failed to get upload URL' }, { status: res.status });
      return NextResponse.json(data);
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });

  } catch (err) {
    console.error('Gallery API proxy error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
