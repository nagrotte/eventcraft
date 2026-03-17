'use client';

import {
  signIn,
  signOut,
  signUp,
  confirmSignUp,
  getCurrentUser,
  fetchAuthSession,
  type SignInInput,
  type SignUpInput
} from 'aws-amplify/auth';
import { useState, useEffect } from 'react';

export interface AuthUser {
  userId:   string;
  email:    string;
  username: string;
}

export function useAuth() {
  const [user,    setUser]    = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUser();
  }, []);

  async function loadUser() {
    try {
      const current = await getCurrentUser();
      const session = await fetchAuthSession();
      const claims  = session.tokens?.idToken?.payload;
      setUser({
        userId:   current.userId,
        email:    claims?.email as string ?? '',
        username: current.username
      });
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  async function login(email: string, password: string) {
    const result = await signIn({ username: email, password } as SignInInput);
    if (result.isSignedIn) await loadUser();
    return result;
  }

  async function register(email: string, password: string) {
    return signUp({ username: email, password, options: { userAttributes: { email } } } as SignUpInput);
  }

  async function confirm(email: string, code: string) {
    return confirmSignUp({ username: email, confirmationCode: code });
  }

  async function logout() {
    await signOut();
    setUser(null);
  }

  return { user, loading, login, register, confirm, logout };
}
