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

interface UploadProgress {
  name:   string;
  status: 'pending' | 'uploading' | 'done' | 'error';
}

const CATEGORIES = ['Hindu/Puja', 'Birthday', 'Wedding', 'Cultural', 'Festive', 'General'];

export default function AdminPage() {
  const { user, loading: authLoading, logout, isAdmin } = useAuth();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<'users' | 'library'>('users');

  // Users state
  const [users,        setUsers]        = useState<CognitoUser[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState('');
  const [actionUserId, setActionUserId] = useState<string | null>(null);

  // Curated library state
  const [images,      setImages]      = useState<CuratedImage[]>([]);
  const [libLoading,  setLibLoading]  = useState(false);
  const [libError,    setLibError]    = useState('');
  const [newCategory, setNewCategory] = useState('General');
  const [deletingId,  setDeletingId]  = useState<string | null>(null);
  const [filterCat,   setFilterCat]   = useState('All');
  const [progress,    setProgress]    = useState<UploadProgress[]>([]);
  const [uploading,   setUploading]   = useState(false);
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

  function titleFromFilename(filename: string): string {
    return filename
      .replace(/\.[^.]+$/, '')
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
  }

  async function uploadSingleFile(file: File, category: string): Promise<'done' | 'error'> {
    try {
      const res = await apiClient.post('/curated', {
        title:       titleFromFilename(file.name),
        category,
        contentType: file.type,
      });
      const { uploadUrl } = res.data.data;
      await fetch(uploadUrl, {
        method:  'PUT',
        headers: { 'Content-Type': file.type },
        body:    file,
      });
      return 'done';
    } catch {
      return 'error';
    }
  }

  async function handleBulkUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;

    setUploading(true);
    setLibError('');
    setProgress(files.map(f => ({ name: f.name, status: 'pending' })));

    for (let i = 0; i < files.length; i++) {
      setProgress(prev => prev.map((p, idx) => idx === i ? { ...p, status: 'uploading' } : p));
      const result = await uploadSingleFile(files[i], newCategory);
      setProgress(prev => prev.map((p, idx) => idx === i ? { ...p, status: result } : p));
    }

    if (fileRef.current) fileRef.current.value = '';
    await loadImages();
    setUploading(false);
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

  const filteredImages = filterCat === 'All' ? images : images.filter(img => img.category === filterCat);
  const doneCount  = progress.filter(p => p.status === 'done').length;
  const errorCount = progress.filter(p => p.status === 'error').length;

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

  const statusIcon  = (s: UploadProgress['status']) => s === 'pending' ? '○' : s === 'uploading' ? '↑' : s === 'done' ? '✓' : '✕';
  const statusColor = (s: UploadProgress['status']) => s === 'done' ? 'var(--ec-success)' : s === 'error' ? 'var(--ec-danger)' : s === 'uploading' ? 'var(--ec-brand)' : 'var(--ec-text-3)';

  return (
    <div style={{ minHeight: '100vh', background: 'var(--ec-bg)' }}>
      <EcNav email={user?.email} isAdmin={isAdmin} onLogout={logout} breadcrumbs={[{ label: 'Admin', href: '/admin' }]} />
      <main className="ec-page">

        <div style={{ display: 'flex', borderBottom: '1px solid var(--ec-border)', marginBottom: 32 }}>
          <button style={tabStyle(activeTab === 'users')}   onClick={() => setActiveTab('users')}>Users</button>
          <button style={tabStyle(activeTab === 'library')} onClick={() => setActiveTab('library')}>
            Image Library {images.length > 0 && <span style={{ fontSize: 11, marginLeft: 6, padding: '1px 6px', borderRadius: 10, background: 'var(--ec-brand-subtle)', color: 'var(--ec-brand)' }}>{images.length}</span>}
          </button>
        </div>

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
                    <span style={{ fontSize: 12, color: u.enabled ? 'var(--ec-success)' : 'var(--ec-danger)' }}>{u.enabled ? 'Active' : 'Disabled'}</span>
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

        {activeTab === 'library' && (
          <>
            <div style={{ marginBottom: 24 }}>
              <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--ec-text-1)', letterSpacing: '-0.02em' }}>Image Library</h1>
              <p style={{ fontSize: 13, color: 'var(--ec-text-3)', marginTop: 4 }}>Curated images available to all users in the canvas editor</p>
            </div>

            {libError && <div className="ec-error" style={{ marginBottom: 16 }}>{libError}</div>}

            {/* Bulk upload */}
            <div style={{ background: 'var(--ec-surface)', border: '1px solid var(--ec-border)', borderRadius: 'var(--ec-radius-lg)', padding: 20, marginBottom: 32 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--ec-text-1)', marginBottom: 4 }}>Bulk upload images</p>
              <p style={{ fontSize: 12, color: 'var(--ec-text-3)', marginBottom: 16 }}>
                Select multiple files at once — titles are auto-generated from filenames. Name files descriptively e.g. <em>gold-temple-frame.png</em>
              </p>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div style={{ flex: 1, minWidth: 140 }}>
                  <label style={{ fontSize: 11, color: 'var(--ec-text-3)', display: 'block', marginBottom: 4 }}>Category for all files</label>
                  <select
                    value={newCategory}
                    onChange={e => setNewCategory(e.target.value)}
                    disabled={uploading}
                    style={{ width: '100%', height: 36, fontSize: 13, background: 'var(--ec-surface-raised)', border: '1px solid var(--ec-border)', borderRadius: 'var(--ec-radius-md)', color: 'var(--ec-text-1)', padding: '0 8px', cursor: 'pointer' }}
                  >
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple style={{ display: 'none' }} onChange={handleBulkUpload} />
                  <EcButton onClick={() => { setProgress([]); setLibError(''); fileRef.current?.click(); }} loading={uploading} disabled={uploading}>
                    {uploading ? `Uploading ${doneCount + errorCount}/${progress.length}...` : 'Choose Files & Upload'}
                  </EcButton>
                </div>
              </div>
              <p style={{ fontSize: 11, color: 'var(--ec-text-3)', marginTop: 8 }}>JPG, PNG, WEBP · Recommended: 600×850px portrait</p>

              {progress.length > 0 && (
                <div style={{ marginTop: 16, borderTop: '1px solid var(--ec-border)', paddingTop: 12 }}>
                  {!uploading && (
                    <p style={{ fontSize: 12, color: errorCount > 0 ? 'var(--ec-danger)' : 'var(--ec-success)', marginBottom: 8 }}>
                      {errorCount > 0 ? `${doneCount} uploaded, ${errorCount} failed` : `All ${doneCount} images uploaded successfully`}
                    </p>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 200, overflowY: 'auto' }}>
                    {progress.map((p, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                        <span style={{ color: statusColor(p.status), width: 14, textAlign: 'center', flexShrink: 0 }}>{statusIcon(p.status)}</span>
                        <span style={{ color: 'var(--ec-text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{titleFromFilename(p.name)}</span>
                        {p.status === 'uploading' && <div className="ec-spinner" style={{ width: 10, height: 10, flexShrink: 0 }} />}
                      </div>
                    ))}
                  </div>
                </div>
              )}
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

            {libLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 64 }}><div className="ec-spinner" /></div>
            ) : filteredImages.length === 0 ? (
              <div className="ec-empty">
                <p style={{ fontSize: 14, color: 'var(--ec-text-2)' }}>
                  {images.length === 0 ? 'No images yet — upload your first batch above.' : 'No images in this category.'}
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
                      <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--ec-text-1)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{img.title}</p>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 10, color: 'var(--ec-text-3)', padding: '2px 6px', borderRadius: 6, background: 'var(--ec-surface-raised)', border: '1px solid var(--ec-border)' }}>{img.category}</span>
                        <button onClick={() => deleteImage(img.imageId)} disabled={deletingId === img.imageId} style={{ background: 'none', border: 'none', color: 'var(--ec-danger)', cursor: 'pointer', fontSize: 11, opacity: deletingId === img.imageId ? 0.5 : 1 }}>
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
