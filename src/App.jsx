import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, useOutletContext, Navigate } from 'react-router-dom';
import { useEffect, useRef } from 'react';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import AuthBootstrapError from '@/components/AuthBootstrapError';

import AppLayout from '@/components/layout/AppLayout';
import CommandCenter from '@/pages/CommandCenter';
import DirectorDashboard from '@/pages/DirectorDashboard';
import AdminDashboard from '@/pages/AdminDashboard';
import AdminHub from '@/pages/AdminHub';
import TechAssignments from '@/pages/TechAssignments';
import Inventory from '@/pages/Inventory';
import Directors from '@/pages/Directors';
import StudentDirectory from '@/pages/StudentDirectory';
import ResourceLibrary from '@/pages/ResourceLibrary';
import DirectorTechRequest from '@/pages/DirectorTechRequest';
import DirectorShowPortal from '@/pages/DirectorShowPortal';
import DirectorHub from '@/pages/DirectorHub';
import ImportShows from '@/pages/ImportShows';
import ApplyForAssignment from '@/pages/ApplyForAssignment';
import EmailTemplates from '@/pages/EmailTemplates';
import PendingEmails from '@/pages/PendingEmails';
import DirectorPortal from '@/pages/DirectorPortal';
import Login from '@/pages/Login';

const RoleBasedHome = () => {
  const ctx = useOutletContext();
  const role = ctx?.role;
  if (role === 'director') return <DirectorDashboard />;
  return <CommandCenter />;
};

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin, checkAppState } = useAuth();
  const authRedirectSentRef = useRef(false);

  useEffect(() => {
    if (isLoadingPublicSettings || isLoadingAuth) return;
    if (!authError || authError.type !== 'auth_required') return;
    if (window.location.pathname.startsWith('/apply')) return;
    if (authRedirectSentRef.current) return;
    authRedirectSentRef.current = true;
    navigateToLogin();
  }, [isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin]);

  useEffect(() => {
    if (!authError) authRedirectSentRef.current = false;
  }, [authError]);

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    }
    if (authError.type === 'unknown') {
      return (
        <AuthBootstrapError
          message={authError.message}
          onRetry={() => void checkAppState()}
        />
      );
    }
    if (authError.type === 'auth_required') {
      // Redirect runs once in useEffect (calling assign during render can freeze / crash the tab)
      return (
        <div className="fixed inset-0 flex flex-col items-center justify-center gap-3 bg-background p-6 text-center">
          <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Redirecting to sign in…</p>
        </div>
      );
    }
  }

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<RoleBasedHome />} />
        <Route path="/admin" element={<CommandCenter />} />
        <Route path="/admin/hub" element={<AdminHub />} />
        <Route path="/admin/tech-assignments" element={<TechAssignments />} />
        <Route path="/admin/inventory" element={<Inventory />} />
        <Route path="/admin/directors" element={<Directors />} />
        <Route path="/students" element={<StudentDirectory />} />
        <Route path="/resources" element={<ResourceLibrary />} />
        <Route path="/director/request-tech" element={<DirectorTechRequest />} />
        <Route path="/director" element={<Navigate to="/director/portal" replace />} />
        <Route path="/director/show-portal" element={<DirectorShowPortal />} />
        <Route path="/director/hub" element={<DirectorHub />} />
        <Route path="/admin/import-shows" element={<ImportShows />} />
        <Route path="/admin/email-templates" element={<EmailTemplates />} />
        <Route path="/admin/pending-emails" element={<PendingEmails />} />
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <QueryClientProvider client={queryClientInstance}>
      <Router>
        <AuthProvider>
          <Routes>
            <Route path="/apply" element={<ApplyForAssignment />} />
            <Route path="/login" element={<Login />} />
            <Route path="/director" element={<Navigate to="/director/portal" replace />} />
            <Route path="/director/portal" element={<DirectorPortal />} />
            <Route path="*" element={<AuthenticatedApp />} />
          </Routes>
        </AuthProvider>
      </Router>
      <Toaster />
    </QueryClientProvider>
  )
}

export default App