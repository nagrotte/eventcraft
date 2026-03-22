'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type { Canvas } from 'fabric';
import apiClient from '@/lib/api-client';

interface UnsplashPhoto {
  id:              string;
  urls:            { small: string; regular: string };
  alt_description: string | null;
  user:            { name: string };
}

export interface CuratedImage {
  imageId:   string;
  title:     string;
  category:  string;
  url:       string;
  thumbUrl?: string;
  active:    boolean;
}

interface ImagePanelProps {
  fabricRef: React.MutableRefObject<Canvas | null>;
  eventId:   string;
  onClose:   () => void;
}

const SUGGESTED = [
  'indian palace', 'ancient temple', 'golden mandala', 'floral dark',
  'night sky stars', 'luxury texture', 'marble background', 'forest misty',
  'ocean sunset', 'mountain golden', 'candles bokeh', 'rose petals',
];

const CATEGORIES = ['All', 'Hindu/Puja', 'Birthday', 'Wedding', 'Cultural', 'Festive', 'General'];

export function ImagePanel({ fabricRef, eventId, onClose }: ImagePanelProps) {
  const [tab,     setTab]     = useState<'search' | 'upload' | 'library'>('library');
  const [query,   setQuery]   = useState('');
  const [photos,  setPhotos]  = useState<UnsplashPhoto[]>([]);
  const [loading, setLoading] = useState(false);
  const [placing, setPlacing] = useState<string | null>(null);
  const [error,   setError]   = useState('');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Library state
  const [curated,      setCurated]      = useState<CuratedImage[]>([]);
  const [libLoading,   setLibLoading]   = useState(false);
  const [libCategory,  setLibCategory]  = useState('All');

  useEffect(() => {
    if (tab === 'library') loadCurated();
  }, [tab]);

  async function loadCurated() {
    setLibLoading(true);
    try {
      const res = await apiClient.get('/curated');
      setCurated(res.data.data ?? []);
    } catch {
      // silently fail — library may be empty
    } finally {
      setLibLoading(false);
    }
  }

  const filteredCurated = libCategory === 'All'
    ? curated
    : curated.filter(img => img.category === libCategory);

  const search = useCallback(async (q?: string) => {
    const sq = q ?? query;
    if (!sq.trim()) return;
    setLoading(true); setError('');
    try {
      const key = process.env.NEXT_PUBLIC_UNSPLASH_ACCESS_KEY;
      const res = await fetch(
        `https://api.unsplash.com/search/photos?query=${encodeURIComponent(sq)}&per_page=30&order_by=relevant`,
        { headers: { Authorization: `Client-ID ${key}` } }
      );
      const data = await res.json();
      if (data.errors) { setError('Rate limit — try again shortly'); setPhotos([]); }
      else { setPhotos(data.results ?? []); if (!data.results?.length) setError('No results — try different keywords'); }
    } catch { setError('Search failed'); }
    finally { setLoading(false); }
  }, [query]);

  async function placeFromUrl(url: string, asBackground: boolean) {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const { FabricImage } = await import('fabric');
    const img = await FabricImage.fromURL(url, { crossOrigin: 'anonymous' });
    if (asBackground) {
      const scale = Math.max(canvas.width! / img.width!, canvas.height! / img.height!);
      img.set({ left: 0, top: 0, scaleX: scale, scaleY: scale });
      canvas.add(img); canvas.sendObjectToBack(img);
    } else {
      const scale = (canvas.width! * 0.5) / img.width!;
      img.set({
        left: canvas.width! / 2 - (img.width! * scale) / 2,
        top:  canvas.height! / 2 - (img.height! * scale) / 2,
        scaleX: scale, scaleY: scale,
      });
      canvas.add(img);
    }
    canvas.setActiveObject(img); canvas.renderAll();
  }

  async function placeUnsplash(photo: UnsplashPhoto, asBackground: boolean) {
    setPlacing(photo.id);
    try {
      await placeFromUrl(photo.urls.regular, asBackground);
      const key = process.env.NEXT_PUBLIC_UNSPLASH_ACCESS_KEY;
      fetch(`https://api.unsplash.com/photos/${photo.id}/download`, { headers: { Authorization: `Client-ID ${key}` } }).catch(() => {});
    } finally { setPlacing(null); }
  }

  async function placeCurated(img: CuratedImage, asBackground: boolean) {
    setPlacing(img.imageId);
    try { await placeFromUrl(img.url, asBackground); }
    finally { setPlacing(null); }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true); setError('');
    try {
      const res = await apiClient.post(`/events/${eventId}/upload-url`, {
        fileName:    file.name,
        contentType: file.type,
      });
      const { uploadUrl, publicUrl } = res.data.data;
      await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
      await placeFromUrl(publicUrl, false);
    } catch {
      setError('Upload failed — check your connection');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  const tabStyle = (active: boolean): React.CSSProperties => ({
    flex: 1, padding: '8px 0', background: 'none',
    border: 'none', borderBottom: `2px solid ${active ? 'var(--ec-brand)' : 'transparent'}`,
    color: active ? 'var(--ec-brand)' : 'var(--ec-text-3)',
    cursor: 'pointer', fontSize: 11, fontWeight: active ? 600 : 400, fontFamily: 'inherit',
    transition: 'all 0.12s',
  });

  return (
    <div style={{ position: 'absolute', left: 48, top: 0, bottom: 0, width: 260, background: 'var(--ec-surface)', borderRight: '1px solid var(--ec-border)', display: 'flex', flexDirection: 'column', zIndex: 10, boxShadow: '4px 0 16px rgba(0,0,0,0.3)' }}>

      {/* Header */}
      <div style={{ padding: '12px 12px 0', borderBottom: '1px solid var(--ec-border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--ec-text-2)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Images</p>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ec-text-3)', fontSize: 18 }}>×</button>
        </div>
        <div style={{ display: 'flex' }}>
          <button style={tabStyle(tab === 'library')} onClick={() => setTab('library')}>Library</button>
          <button style={tabStyle(tab === 'search')}  onClick={() => setTab('search')}>Stock</button>
          <button style={tabStyle(tab === 'upload')}  onClick={() => setTab('upload')}>Upload</button>
        </div>
      </div>

      {/* Library tab */}
      {tab === 'library' && (
        <>
          {/* Category filter */}
          <div style={{ padding: '8px 8px 4px', flexShrink: 0, borderBottom: '1px solid var(--ec-border)' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {CATEGORIES.map(cat => (
                <button key={cat} onClick={() => setLibCategory(cat)} style={{
                  padding: '3px 8px', borderRadius: 10, fontSize: 10,
                  background: libCategory === cat ? 'var(--ec-brand)' : 'var(--ec-surface-raised)',
                  border: `1px solid ${libCategory === cat ? 'var(--ec-brand)' : 'var(--ec-border)'}`,
                  color: libCategory === cat ? '#fff' : 'var(--ec-text-2)',
                  cursor: 'pointer', fontFamily: 'inherit',
                }}>
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
            {libLoading ? (
              <div style={{ textAlign: 'center', padding: 24 }}>
                <div className="ec-spinner" style={{ margin: '0 auto' }} />
              </div>
            ) : filteredCurated.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 32 }}>
                <p style={{ fontSize: 12, color: 'var(--ec-text-3)', marginBottom: 8 }}>
                  {curated.length === 0 ? 'No curated images yet.' : 'No images in this category.'}
                </p>
                <p style={{ fontSize: 11, color: 'var(--ec-text-3)' }}>
                  Admins can add images from the Admin panel.
                </p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {filteredCurated.map(img => (
                  <div key={img.imageId} style={{ position: 'relative' }}>
                    <div
                      onClick={() => placeCurated(img, false)}
                      style={{
                        aspectRatio: '3/4', borderRadius: 'var(--ec-radius-sm)',
                        overflow: 'hidden', cursor: placing === img.imageId ? 'wait' : 'pointer',
                        border: '1px solid var(--ec-border)',
                        opacity: placing === img.imageId ? 0.6 : 1,
                      }}
                    >
                      <img
                        src={img.thumbUrl || img.url}
                        alt={img.title}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                      />
                    </div>
                    <button
                      onClick={() => placeCurated(img, true)}
                      style={{
                        position: 'absolute', bottom: 4, right: 4,
                        background: 'rgba(0,0,0,0.7)', border: 'none',
                        borderRadius: 4, color: '#fff', fontSize: 9,
                        padding: '2px 5px', cursor: 'pointer',
                      }}
                    >BG</button>
                    <div style={{
                      position: 'absolute', bottom: 0, left: 0, right: 0,
                      background: 'linear-gradient(to top, rgba(0,0,0,0.6), transparent)',
                      padding: '12px 4px 4px', borderRadius: '0 0 var(--ec-radius-sm) var(--ec-radius-sm)',
                    }}>
                      <p style={{ fontSize: 9, color: '#fff', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {img.title}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Upload tab */}
      {tab === 'upload' && (
        <div style={{ padding: 16, flex: 1 }}>
          <div
            onClick={() => fileRef.current?.click()}
            style={{
              border: '2px dashed var(--ec-border)', borderRadius: 'var(--ec-radius-lg)',
              padding: '32px 16px', textAlign: 'center', cursor: 'pointer',
              background: 'var(--ec-surface-raised)', marginBottom: 12,
            }}
          >
            <div style={{ fontSize: 32, marginBottom: 8 }}>📁</div>
            <p style={{ fontSize: 13, color: 'var(--ec-text-1)', fontWeight: 500, marginBottom: 4 }}>
              {uploading ? 'Uploading...' : 'Click to upload'}
            </p>
            <p style={{ fontSize: 11, color: 'var(--ec-text-3)' }}>PNG, JPG, WEBP up to 10MB</p>
          </div>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileUpload} />
          {error && <p style={{ fontSize: 11, color: 'var(--ec-danger)' }}>{error}</p>}
        </div>
      )}

      {/* Search tab */}
      {tab === 'search' && (
        <>
          <div style={{ padding: '10px 10px 6px', flexShrink: 0 }}>
            <div style={{ display: 'flex', gap: 6 }}>
              <input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && search()}
                placeholder="Search photos..." className="ec-input" style={{ flex: 1, height: 30, fontSize: 11 }} />
              <button onClick={() => search()} disabled={loading} style={{ padding: '0 10px', height: 30, borderRadius: 'var(--ec-radius-md)', background: 'var(--ec-brand)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 500, opacity: loading ? 0.6 : 1 }}>
                {loading ? '...' : 'Go'}
              </button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
              {SUGGESTED.map(tag => (
                <button key={tag} onClick={() => { setQuery(tag); search(tag); }} style={{ padding: '2px 8px', borderRadius: 10, fontSize: 10, background: 'var(--ec-surface-raised)', border: '1px solid var(--ec-border)', color: 'var(--ec-text-2)', cursor: 'pointer', fontFamily: 'inherit' }}>
                  {tag}
                </button>
              ))}
            </div>
            {error && <p style={{ fontSize: 10, color: 'var(--ec-danger)', marginTop: 6 }}>{error}</p>}
            {photos.length > 0 && <p style={{ fontSize: 10, color: 'var(--ec-text-3)', marginTop: 6 }}>Click = place · BG = set as background</p>}
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px 8px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {photos.map(photo => (
                <div key={photo.id} style={{ position: 'relative' }}>
                  <div onClick={() => placeUnsplash(photo, false)} style={{ aspectRatio: '3/4', borderRadius: 'var(--ec-radius-sm)', overflow: 'hidden', cursor: placing === photo.id ? 'wait' : 'pointer', border: '1px solid var(--ec-border)', opacity: placing === photo.id ? 0.6 : 1 }}>
                    <img src={photo.urls.small} alt={photo.alt_description ?? ''} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  </div>
                  <button onClick={() => placeUnsplash(photo, true)} style={{ position: 'absolute', bottom: 4, right: 4, background: 'rgba(0,0,0,0.7)', border: 'none', borderRadius: 4, color: '#fff', fontSize: 9, padding: '2px 5px', cursor: 'pointer' }}>BG</button>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
