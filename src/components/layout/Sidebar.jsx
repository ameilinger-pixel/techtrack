import { db } from '@/lib/backend/client';

import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard, Users, ClipboardList, BookOpen, Package,
  UserCog, Wrench, GraduationCap, ChevronLeft, ChevronRight,
  LogOut, Shield, Clapperboard, FileUp, Mail, Clock
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const adminNav = [
  { label: 'Admin Dashboard', path: '/admin', icon: Shield },
  { label: 'Admin Hub', path: '/admin/hub', icon: Clapperboard },
  { label: 'Tech Assignments', path: '/admin/tech-assignments', icon: ClipboardList },
  { label: 'Inventory', path: '/admin/inventory', icon: Package },
  { label: 'Directors', path: '/admin/directors', icon: UserCog },
  { label: 'Student Directory', path: '/students', icon: GraduationCap },
  { label: 'Resource Library', path: '/resources', icon: BookOpen },
  { label: 'Import Shows', path: '/admin/import-shows', icon: FileUp },
  { label: 'Email Templates', path: '/admin/email-templates', icon: Mail },
  { label: 'Pending Emails', path: '/admin/pending-emails', icon: Clock },
  { label: 'Request Tech Help', path: '/director/request-tech', icon: Wrench },
  { label: 'Show Portal', path: '/director/show-portal', icon: LayoutDashboard },
  { label: 'Director Hub', path: '/director/hub', icon: Users },
];

const directorNav = [
  { label: 'My Dashboard', path: '/director', icon: LayoutDashboard },
  { label: 'Request Tech Help', path: '/director/request-tech', icon: Wrench },
  { label: 'Student Directory', path: '/students', icon: GraduationCap },
  { label: 'Resource Library', path: '/resources', icon: BookOpen },
];

export default function Sidebar({ role, collapsed, onToggle, user }) {
  const location = useLocation();
  const navItems = role === 'admin' ? [...adminNav, ...directorNav.filter(d => !adminNav.some(a => a.path === d.path))] : directorNav;

  return (
    <aside className={cn(
      "fixed left-0 top-0 h-screen bg-card border-r border-border flex flex-col z-40 transition-all duration-300",
      collapsed ? "w-16" : "w-64"
    )}>
      <div className="h-16 flex items-center px-4 border-b border-border gap-3">
        {!collapsed && (
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
              <Clapperboard className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-bold text-foreground truncate">TechTrack</span>
          </div>
        )}
        <Button variant="ghost" size="icon" onClick={onToggle} className="flex-shrink-0">
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </Button>
      </div>

      <nav className="flex-1 py-4 overflow-y-auto">
        {navItems.map(item => {
          const Icon = item.icon;
          const active = location.pathname === item.path;
          return (
            <Link key={item.path} to={item.path} className={cn(
              "flex items-center gap-3 mx-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
              active
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}>
              <Icon className="w-5 h-5 flex-shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-border">
        {!collapsed && user && (
          <div className="mb-3 px-2">
            <p className="text-sm font-medium text-foreground truncate">{user.full_name || user.email}</p>
            <p className="text-xs text-muted-foreground capitalize">{role}</p>
          </div>
        )}
        <Button
          variant="ghost"
          size={collapsed ? "icon" : "default"}
          className={cn("w-full text-muted-foreground", !collapsed && "justify-start")}
          onClick={() => db.auth.logout()}
        >
          <LogOut className="w-4 h-4" />
          {!collapsed && <span className="ml-2">Logout</span>}
        </Button>
      </div>
    </aside>
  );
}