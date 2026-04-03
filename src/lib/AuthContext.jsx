import { db } from '@/lib/backend/client';

import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';

import { supabase } from '@/lib/backend/supabaseClient';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [appPublicSettings, setAppPublicSettings] = useState(null);

  const hydrateFromSession = useCallback(async () => {
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
      const {
        data: { session },
      } = await supabase.auth.getSession();

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

      const currentUser = await db.auth.me();
      setUser(currentUser);
      setIsAuthenticated(true);
      setAuthError(null);
      setAppPublicSettings({ id: 'supabase', public_settings: {} });
    } catch (error) {
      console.error('Auth hydrate failed:', error);
      setUser(null);
      setIsAuthenticated(false);
      if (error?.status === 401 || error?.status === 403) {
        setAuthError({
          type: 'auth_required',
          message: 'Authentication required',
        });
      } else {
        setAuthError({
          type: 'unknown',
          message: error?.message || 'Failed to load session',
        });
      }
    }
  }, []);

  const checkAppState = useCallback(async () => {
    setIsLoadingPublicSettings(true);
    setIsLoadingAuth(true);
    setAuthError(null);
    await hydrateFromSession();
    setIsLoadingPublicSettings(false);
    setIsLoadingAuth(false);
  }, [hydrateFromSession]);

  useEffect(() => {
    checkAppState();
  }, [checkAppState]);

  useEffect(() => {
    if (!supabase) return undefined;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      hydrateFromSession();
    });
    return () => subscription.unsubscribe();
  }, [hydrateFromSession]);

  // Re-load profile (e.g. role) after edits in Supabase while another tab was open
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible') {
        void hydrateFromSession();
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [hydrateFromSession]);

  const logout = (shouldRedirect = true) => {
    setUser(null);
    setIsAuthenticated(false);
    if (shouldRedirect) {
      db.auth.logout('/login');
    } else {
      db.auth.logout(false);
    }
  };

  const navigateToLogin = () => {
    db.auth.redirectToLogin(window.location.href);
  };

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
