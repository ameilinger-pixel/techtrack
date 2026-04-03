import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, useOutletContext } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';

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
  const { role } = useOutletContext?.() || {};
  if (role === 'director') return <DirectorDashboard />;
  return <CommandCenter />;
};

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

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
    } else if (authError.type === 'auth_required') {
      // Only redirect to login for non-public routes
      const isPublicRoute = window.location.pathname.startsWith('/apply');
      if (!isPublicRoute) {
        navigateToLogin();
      }
      return null;
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
        <Routes>
          <Route path="/apply" element={<ApplyForAssignment />} />
          <Route path="/login" element={<Login />} />
          <Route path="/director/portal" element={<DirectorPortal />} />
          <Route path="*" element={
            <AuthProvider>
              <AuthenticatedApp />
            </AuthProvider>
          } />
        </Routes>
      </Router>
      <Toaster />
    </QueryClientProvider>
  )
}

export default App