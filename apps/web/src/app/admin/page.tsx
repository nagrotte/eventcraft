'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { EcNav } from '@/components/ui/EcNav';
import { EcButton } from '@/components/ui/EcButton';
import apiClient from '@/lib/api-client';

const ADMIN_EMAIL = 'nag.rotte@gmail.com';

interface CognitoUser {
  username:  string;
  email:     string;
  status:    string;
  enabled:   boolean;
  created:   string;
  modified:  string;
}

export default function AdminPage() {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();
  const [users,        setUsers]        = useState<CognitoUser[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState('');
  const [actionUserId, setActionUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) { router.push('/auth/login'); return; }
    if (!authLoading && user && user.email !== ADMIN_EMAIL) { router.push('/dashboard'); return; }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user || user.email !== ADMIN_EMAIL) return;
    loadUsers();
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

  if (authLoading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--ec-bg)' }}>
      <div className="ec-spinner" />
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: 'var(--ec-bg)' }}>
      <EcNav email={user?.email} onLogout={logout} breadcrumbs={[{ label: 'Admin' }]} />
      <main className="ec-page">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
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
            {/* Header */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: 16, padding: '8px 16px', fontSize: 11, color: 'var(--ec-text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              <span>Email</span>
              <span>Status</span>
              <span>Enabled</span>
              <span>Joined</span>
              <span></span>
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
                  {u.email !== ADMIN_EMAIL && (
                    <>
                      <EcButton size="sm" variant="ghost" loading={actionUserId === u.username} onClick={() => toggleUser(u.username, u.enabled)}>
                        {u.enabled ? 'Disable' : 'Enable'}
                      </EcButton>
                      <EcButton size="sm" variant="ghost" loading={actionUserId === u.username} onClick={() => deleteUser(u.username)} style={{ color: 'var(--ec-danger)' }}>
                        Delete
                      </EcButton>
                    </>
                  )}
                  {u.email === ADMIN_EMAIL && (
                    <span style={{ fontSize: 11, color: 'var(--ec-brand)', padding: '3px 8px', borderRadius: 10, background: 'var(--ec-brand-subtle)', border: '1px solid var(--ec-brand-border)' }}>Owner</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
