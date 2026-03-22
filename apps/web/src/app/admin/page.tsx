'use client';

import { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { EcNav } from '@/components/ui/EcNav';
import { EcButton } from '@/components/ui/EcButton';
import apiClient from '@/lib/api-client';

interface CognitoUser {
  username:  string;
  email:     string;
  status:    string;
  enabled:   boolean;
  created:   string;
  modified:  string;
}

interface CuratedImage {
  imageId:   string;
  title:     string;
  category:  string;
  url:       string;
  active:    boolean;
  createdAt: string;
}

const CATEGORIES = ['Hindu/Puja', 'Birthday', 'Wedding', 'Cultural', 'Festive', 'General'];

export default function AdminPage() {
  const { user, loading: authLoading, logout, isAdmin } = useAuth();
  const router = useRouter();

  // Tab
  const [activeTab, setActiveTab] = useState<'users' | 'library'>('users');

  // Users state
  const [users,        setUsers]        = useState<CognitoUser[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState('');
  const [actionUserId, setActionUserId] = useState<string | null>(null);

  // Curated library state
  const [images,        setImages]        = useState<CuratedImage[]>([]);
  const [libLoading,    setLibLoading]    = useState(false);
  const [libError,      setLibError]      = useState('');
  const [uploading,     setUploading]     = useState(false);
  const [newTitle,      setNewTitle]      = useState('');
  const [newCategory,   setNewCategory]   = useState('General');
  const [deletingId,    setDeletingId]    = useState<string | null>(null);
  const [filterCat,     setFilterCat]     = useState('All');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!authLoading && !user) { router.push('/auth/login'); return; }
    if (!authLoading && user && !isAdmin) { router.push('/dashboard'); return; }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user || !isAdmin) return;
    loadUsers();
    loadImages();
  }, [user]);

  // ── Users ──────────────────────────────────────────────────────────────────

  async function loadUsers() {
    setLoading(true);
    try {
      const res = await apiClient.get('/admin/users');
      setUsers(res.data.data ?? []);
    } catch {
      setError('Failed to load users');
    } finally {
      setLoading(false);
    }
  }

  async function toggleUser(username: string, enabled: boolean) {
    setActionUserId(username);
    try {
      await apiClient.post(`/admin/users/${username}/${enabled ? 'disable' : 'enable'}`);
      setUsers(prev => prev.map(u => u.username === username ? { ...u, enabled: !enabled } : u));
    } catch {
      setError('Action failed');
    } finally {
      setActionUserId(null);
    }
  }

  async function deleteUser(username: string) {
    if (!confirm('Delete this user permanently?')) return;
    setActionUserId(username);
    try {
      await apiClient.delete(`/admin/users/${username}`);
      setUsers(prev => prev.filter(u => u.username !== username));
    } catch {
      setError('Delete failed');
    } finally {
      setActionUserId(null);
    }
  }

  // ── Curated library ────────────────────────────────────────────────────────

  async function loadImages() {
    setLibLoading(true);
    try {
      const res = await apiClient.get('/curated');
      setImages(res.data.data ?? []);
    } catch {
      setLibError('Failed to load images');
    } finally {
      setLibLoading(false);
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!newTitle.trim()) { setLibError('Please enter a title before uploading'); return; }
    setUploading(true); setLibError('');
    try {
      // Step 1 — create metadata + get presigned upload URL
      const res = await apiClient.post('/curated', {
        title:       newTitle.trim(),
        category:    newCategory,
        contentType: file.type,
      });
      const { uploadUrl, imageId } = res.data.data;

      // Step 2 — upload file directly to S3
      await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });

      setNewTitle('');
      if (fileRef.current) fileRef.current.value = '';
      await loadImages();
    } catch {
      setLibError('Upload failed — check your connection');
    } finally {
      setUploading(false);
    }
  }

  async function deleteImage(imageId: string) {
    if (!confirm('Remove this image from the library?')) return;
    setDeletingId(imageId);
    try {
      await apiClient.delete(`/curated/${imageId}`);
      setImages(prev => prev.filter(img => img.imageId !== imageId));
    } catch {
      setLibError('Delete failed');
    } finally {
      setDeletingId(null);
    }
  }

  const filteredImages = filterCat === 'All'
    ? images
    : images.filter(img => img.category === filterCat);

  if (authLoading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--ec-bg)' }}>
      <div className="ec-spinner" />
    </div>
  );

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '8px 20px', background: 'none', cursor: 'pointer',
    border: 'none', borderBottom: `2px solid ${active ? 'var(--ec-brand)' : 'transparent'}`,
    color: active ? 'var(--ec-brand)' : 'var(--ec-text-3)',
    fontSize: 13, fontWeight: active ? 600 : 400, fontFamily: 'inherit',
    transition: 'all 0.12s',
  });

  return (
    <div style={{ minHeight: '100vh', background: 'var(--ec-bg)' }}>
      <EcNav email={user?.email} isAdmin={isAdmin} onLogout={logout} breadcrumbs={[{ label: 'Admin', href: '/admin' }]} />
      <main className="ec-page">

        {/* Tab bar */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--ec-border)', marginBottom: 32 }}>
          <button style={tabStyle(activeTab === 'users')}   onClick={() => setActiveTab('users')}>Users</button>
          <button style={tabStyle(activeTab === 'library')} onClick={() => setActiveTab('library')}>
            Image Library {images.length > 0 && <span style={{ fontSize: 11, marginLeft: 6, padding: '1px 6px', borderRadius: 10, background: 'var(--ec-brand-subtle)', color: 'var(--ec-brand)' }}>{images.length}</span>}
          </button>
        </div>

        {/* ── Users tab ── */}
        {activeTab === 'users' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
              <div>
                <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--ec-text-1)', letterSpacing: '-0.02em' }}>Users</h1>
                <p style={{ fontSize: 13, color: 'var(--ec-text-3)', marginTop: 4 }}>{users.length} registered user{users.length !== 1 ? 's' : ''}</p>
              </div>
              <EcButton variant="ghost" size="sm" onClick={loadUsers}>Refresh</EcButton>
            </div>

            {error && <div className="ec-error" style={{ marginBottom: 16 }}>{error}</div>}

            {loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 64 }}><div className="ec-spinner" /></div>
            ) : users.length === 0 ? (
              <div className="ec-empty"><p style={{ fontSize: 14, color: 'var(--ec-text-2)' }}>No users yet</p></div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: 16, padding: '8px 16px', fontSize: 11, color: 'var(--ec-text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  <span>Email</span><span>Status</span><span>Enabled</span><span>Joined</span><span></span>
                </div>
                {users.map(u => (
                  <div key={u.username} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: 16, padding: '12px 16px', background: 'var(--ec-surface)', borderRadius: 'var(--ec-radius-lg)', border: '1px solid var(--ec-border)', alignItems: 'center' }}>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--ec-text-1)' }}>{u.email}</p>
                      <p style={{ fontSize: 11, color: 'var(--ec-text-3)', marginTop: 2, fontFamily: 'monospace' }}>{u.username.substring(0, 16)}...</p>
                    </div>
                    <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 10, background: u.status === 'CONFIRMED' ? 'var(--ec-success-bg)' : 'var(--ec-warning-bg)', color: u.status === 'CONFIRMED' ? 'var(--ec-success)' : 'var(--ec-warning)', border: `1px solid ${u.status === 'CONFIRMED' ? 'var(--ec-success-border)' : 'var(--ec-warning-border)'}`, width: 'fit-content' }}>
                      {u.status}
                    </span>
                    <span style={{ fontSize: 12, color: u.enabled ? 'var(--ec-success)' : 'var(--ec-danger)' }}>
                      {u.enabled ? 'Active' : 'Disabled'}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--ec-text-3)' }}>
                      {new Date(u.created).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {u.email !== user?.email ? (
                        <>
                          <EcButton size="sm" variant="ghost" loading={actionUserId === u.username} onClick={() => toggleUser(u.username, u.enabled)}>
                            {u.enabled ? 'Disable' : 'Enable'}
                          </EcButton>
                          <EcButton size="sm" variant="ghost" loading={actionUserId === u.username} onClick={() => deleteUser(u.username)} style={{ color: 'var(--ec-danger)' }}>
                            Delete
                          </EcButton>
                        </>
                      ) : (
                        <span style={{ fontSize: 11, color: 'var(--ec-brand)', padding: '3px 8px', borderRadius: 10, background: 'var(--ec-brand-subtle)', border: '1px solid var(--ec-brand-border)' }}>Owner</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── Image Library tab ── */}
        {activeTab === 'library' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
              <div>
                <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--ec-text-1)', letterSpacing: '-0.02em' }}>Image Library</h1>
                <p style={{ fontSize: 13, color: 'var(--ec-text-3)', marginTop: 4 }}>
                  Curated images available to all users in the canvas editor
                </p>
              </div>
            </div>

            {libError && <div className="ec-error" style={{ marginBottom: 16 }}>{libError}</div>}

            {/* Upload form */}
            <div style={{ background: 'var(--ec-surface)', border: '1px solid var(--ec-border)', borderRadius: 'var(--ec-radius-lg)', padding: 20, marginBottom: 32 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--ec-text-1)', marginBottom: 16 }}>Upload new image</p>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div style={{ flex: 2, minWidth: 180 }}>
                  <label style={{ fontSize: 11, color: 'var(--ec-text-3)', display: 'block', marginBottom: 4 }}>Title *</label>
                  <input
                    value={newTitle}
                    onChange={e => setNewTitle(e.target.value)}
                    placeholder="e.g. Gold Temple Frame"
                    className="ec-input"
                    style={{ width: '100%', height: 36, fontSize: 13 }}
                  />
                </div>
                <div style={{ flex: 1, minWidth: 140 }}>
                  <label style={{ fontSize: 11, color: 'var(--ec-text-3)', display: 'block', marginBottom: 4 }}>Category</label>
                  <select
                    value={newCategory}
                    onChange={e => setNewCategory(e.target.value)}
                    style={{ width: '100%', height: 36, fontSize: 13, background: 'var(--ec-surface-raised)', border: '1px solid var(--ec-border)', borderRadius: 'var(--ec-radius-md)', color: 'var(--ec-text-1)', padding: '0 8px', cursor: 'pointer' }}
                  >
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    style={{ display: 'none' }}
                    onChange={handleUpload}
                  />
                  <EcButton
                    onClick={() => {
                      if (!newTitle.trim()) { setLibError('Enter a title first'); return; }
                      setLibError('');
                      fileRef.current?.click();
                    }}
                    loading={uploading}
                  >
                    {uploading ? 'Uploading...' : 'Choose & Upload'}
                  </EcButton>
                </div>
              </div>
              <p style={{ fontSize: 11, color: 'var(--ec-text-3)', marginTop: 8 }}>
                JPG, PNG, WEBP · Recommended: 600×850px portrait · Max 10MB
              </p>
            </div>

            {/* Category filter */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
              {['All', ...CATEGORIES].map(cat => (
                <button key={cat} onClick={() => setFilterCat(cat)} style={{
                  padding: '4px 12px', borderRadius: 10, fontSize: 12,
                  background: filterCat === cat ? 'var(--ec-brand)' : 'var(--ec-surface)',
                  border: `1px solid ${filterCat === cat ? 'var(--ec-brand)' : 'var(--ec-border)'}`,
                  color: filterCat === cat ? '#fff' : 'var(--ec-text-2)',
                  cursor: 'pointer', fontFamily: 'inherit',
                }}>
                  {cat}
                </button>
              ))}
            </div>

            {/* Image grid */}
            {libLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 64 }}><div className="ec-spinner" /></div>
            ) : filteredImages.length === 0 ? (
              <div className="ec-empty">
                <p style={{ fontSize: 14, color: 'var(--ec-text-2)' }}>
                  {images.length === 0 ? 'No images yet — upload your first one above.' : 'No images in this category.'}
                </p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
                {filteredImages.map(img => (
                  <div key={img.imageId} style={{ background: 'var(--ec-surface)', border: '1px solid var(--ec-border)', borderRadius: 'var(--ec-radius-lg)', overflow: 'hidden' }}>
                    <div style={{ aspectRatio: '3/4', overflow: 'hidden' }}>
                      <img src={img.url} alt={img.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    </div>
                    <div style={{ padding: '10px 12px' }}>
                      <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--ec-text-1)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {img.title}
                      </p>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 10, color: 'var(--ec-text-3)', padding: '2px 6px', borderRadius: 6, background: 'var(--ec-surface-raised)', border: '1px solid var(--ec-border)' }}>
                          {img.category}
                        </span>
                        <button
                          onClick={() => deleteImage(img.imageId)}
                          disabled={deletingId === img.imageId}
                          style={{ background: 'none', border: 'none', color: 'var(--ec-danger)', cursor: 'pointer', fontSize: 11, opacity: deletingId === img.imageId ? 0.5 : 1 }}
                        >
                          {deletingId === img.imageId ? '...' : 'Remove'}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

      </main>
    </div>
  );
}
