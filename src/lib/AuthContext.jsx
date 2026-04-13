import { db } from '@/lib/backend/client';

import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';

import { supabase } from '@/lib/backend/supabaseClient';

const AuthContext = createContext();

const SESSION_TIMEOUT_MS = 12000;
const PROFILE_TIMEOUT_MS = 12000;
/** Failsafe so UI never spins forever if Supabase promises never settle */
const BOOTSTRAP_FAILSAFE_MS = 25000;

function raceTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} (${ms}ms)`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [appPublicSettings, setAppPublicSettings] = useState(null);

  /**
   * @param {import('@supabase/supabase-js').Session | null | undefined} sessionFromEvent
   *   Pass the session from `onAuthStateChange(_, session)` when hydrating inside that callback.
   *   Passing `undefined` means "fetch via getSession()" (only safe *outside* the auth callback).
   *   Calling `getSession()` from inside `onAuthStateChange` can deadlock the Supabase JS client.
   */
  const hydrateFromSession = useCallback(async (sessionFromEvent) => {
    if (!supabase) {
      setUser(null);
      setIsAuthenticated(false);
      setAuthError({
        type: 'unknown',
        message:
          'Supabase URL/key missing. Add them to .env.local and restart, or set NEXT_PUBLIC_SUPABASE_* / VITE_SUPABASE_* on Vercel and redeploy.',
      });
      return;
    }

    try {
      let session;
      if (sessionFromEvent !== undefined) {
        session = sessionFromEvent;
      } else {
        const { data, error } = await raceTimeout(
          supabase.auth.getSession(),
          SESSION_TIMEOUT_MS,
          'getSession'
        );
        if (error) throw error;
        session = data?.session ?? null;
      }

      if (!session) {
        setUser(null);
        setIsAuthenticated(false);
        setAuthError({
          type: 'auth_required',
          message: 'Authentication required',
        });
        setAppPublicSettings(null);
        return;
      }

      // Defer profile fetch out of the auth mutex window (avoids rare deadlocks with getUser)
      await Promise.resolve();

      const currentUser = await raceTimeout(
        db.auth.me(),
        PROFILE_TIMEOUT_MS,
        'loadProfile'
      );
      setUser(currentUser);
      setIsAuthenticated(true);
      setAuthError(null);
      setAppPublicSettings({ id: 'supabase', public_settings: {} });
    } catch (error) {
      console.error('Auth hydrate failed:', error);
      setUser(null);
      setIsAuthenticated(false);
      const msg = error?.message || 'Failed to load session';
      const timedOut = /getSession|loadProfile|\(\d+ms\)/.test(msg);
      if (timedOut && supabase) {
        try {
          await supabase.auth.signOut();
        } catch (_) {
          /* ignore */
        }
      }
      if (error?.status === 401 || error?.status === 403) {
        setAuthError({
          type: 'auth_required',
          message: 'Authentication required',
        });
      } else {
        setAuthError({
          type: 'unknown',
          message: timedOut
            ? 'Sign-in is taking too long or your session is stuck. Try again, or sign in from a fresh tab. If this keeps happening, check Vercel env vars (Supabase URL/key) and your network.'
            : msg,
        });
      }
    }
  }, []);

  const checkAppState = useCallback(async () => {
    setIsLoadingPublicSettings(true);
    setIsLoadingAuth(true);
    setAuthError(null);
    try {
      await Promise.race([
        hydrateFromSession(),
        new Promise((_, reject) => {
          setTimeout(
            () =>
              reject(
                Object.assign(new Error('App bootstrap timed out'), {
                  code: 'BOOTSTRAP_TIMEOUT',
                })
              ),
            BOOTSTRAP_FAILSAFE_MS
          );
        }),
      ]);
    } catch (err) {
      if (err?.code === 'BOOTSTRAP_TIMEOUT') {
        console.error('[Auth] Bootstrap failsafe — hydrate did not finish', err);
        setUser(null);
        setIsAuthenticated(false);
        setAuthError({
          type: 'unknown',
          message:
            'The app could not finish loading (internal timeout). Try refreshing. If you use an ad blocker or privacy extension, allow this site to reach your Supabase project.',
        });
        if (supabase) {
          try {
            await supabase.auth.signOut();
          } catch (_) {
            /* ignore */
          }
        }
      }
    } finally {
      setIsLoadingPublicSettings(false);
      setIsLoadingAuth(false);
    }
  }, [hydrateFromSession]);

  useEffect(() => {
    checkAppState();
  }, [checkAppState]);

  useEffect(() => {
    if (!supabase) return undefined;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      // Never call getSession() synchronously inside this callback — it can deadlock.
      queueMicrotask(() => {
        void hydrateFromSession(session);
      });
    });
    return () => subscription.unsubscribe();
  }, [hydrateFromSession]);

  const logout = useCallback((shouldRedirect = true) => {
    setUser(null);
    setIsAuthenticated(false);
    if (shouldRedirect) {
      db.auth.logout('/login');
    } else {
      db.auth.logout(false);
    }
  }, []);

  const navigateToLogin = useCallback(() => {
    db.auth.redirectToLogin(window.location.href);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoadingAuth,
        isLoadingPublicSettings,
        authError,
        appPublicSettings,
        logout,
        navigateToLogin,
        checkAppState,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
