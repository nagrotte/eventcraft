'use client';

import { useState, useEffect } from 'react';
import { signIn, signOut, signUp, confirmSignUp, fetchAuthSession, getCurrentUser } from 'aws-amplify/auth';

interface AuthUser {
  email: string;
  sub:   string;
}

export function useAuth() {
  const [user,    setUser]    = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    checkUser();
  }, []);

  async function checkUser() {
    try {
      const current = await getCurrentUser();
      const session = await fetchAuthSession();
      const claims  = session.tokens?.idToken?.payload;
      const email   = claims?.email as string ?? '';
      const sub     = claims?.sub   as string ?? current.userId;
      const groups  = (claims?.['cognito:groups'] as string[]) ?? [];
      setUser({ email, sub });
      setIsAdmin(groups.includes('admin'));
    } catch {
      setUser(null);
      setIsAdmin(false);
    } finally {
      setLoading(false);
    }
  }

  async function login(email: string, password: string) {
    await signIn({ username: email, password });
    await checkUser();
  }

  async function logout() {
    await signOut();
    setUser(null);
    setIsAdmin(false);
  }

  async function register(email: string, password: string) {
    await signUp({
      username: email,
      password,
      options: { userAttributes: { email } }
    });
  }

  async function confirm(email: string, code: string) {
    await confirmSignUp({ username: email, confirmationCode: code });
  }

  return { user, loading, isAdmin, login, logout, register, confirm };
}
