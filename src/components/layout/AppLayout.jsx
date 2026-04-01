import { db } from '@/lib/backend/client';

import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import { cn } from '@/lib/utils';

import { determineUserRole } from '@/lib/roleUtils';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [role, setRole] = useState('student');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    async function init() {
      try {
        const me = await db.auth.me();
        setUser(me);
        const r = await determineUserRole(me);
        setRole(r);
        // Redirect directors away from any non-director page
        if (r === 'director' && !location.pathname.startsWith('/director')) {
          navigate('/director', { replace: true });
          setLoading(false);
          return;
        }
      } catch (e) {
        // not logged in
      }
      setLoading(false);
    }
    init();
  }, []);

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile menu button */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-card border-b border-border flex items-center px-4 z-50">
        <Button variant="ghost" size="icon" onClick={() => setMobileOpen(!mobileOpen)}>
          <Menu className="w-5 h-5" />
        </Button>
        <span className="ml-3 font-bold">TechTrack</span>
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 bg-black/50 z-40" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar - desktop always visible, mobile as overlay */}
      <div className={cn(
        "lg:block",
        mobileOpen ? "block" : "hidden"
      )}>
        <Sidebar
          role={role}
          collapsed={collapsed}
          onToggle={() => setCollapsed(!collapsed)}
          user={user}
        />
      </div>

      {/* Main content */}
      <main className={cn(
        "transition-all duration-300 min-h-screen",
        "pt-14 lg:pt-0",
        collapsed ? "lg:ml-16" : "lg:ml-64"
      )}>
        <div className="p-4 md:p-6 lg:p-8">
          <Outlet context={{ user, role }} />
        </div>
      </main>
    </div>
  );
}