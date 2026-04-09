import { db } from '@/lib/backend/client';

import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard, ClipboardList, BookOpen, Package,
  UserCog, Wrench, GraduationCap, ChevronLeft, ChevronRight,
  LogOut, Clapperboard, FileUp, Mail, Clock, Zap
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const adminNavGroups = [
  {
    label: 'Home',
    items: [
      { label: 'Command Center', path: '/admin', icon: Zap },
    ],
  },
  {
    label: 'Operations',
    items: [
      { label: 'Hub', path: '/admin/hub', icon: Clapperboard },
      { label: 'Tech Assignments', path: '/admin/tech-assignments', icon: ClipboardList },
      { label: 'Inventory', path: '/admin/inventory', icon: Package },
    ],
  },
  {
    label: 'People',
    items: [
      { label: 'Directors', path: '/admin/directors', icon: UserCog },
      { label: 'Students', path: '/students', icon: GraduationCap },
    ],
  },
  {
    label: 'Tools',
    items: [
      { label: 'Email Outbox', path: '/admin/pending-emails', icon: Clock },
      { label: 'Email Templates', path: '/admin/email-templates', icon: Mail },
      { label: 'Import Shows', path: '/admin/import-shows', icon: FileUp },
      { label: 'Resource Library', path: '/resources', icon: BookOpen },
    ],
  },
];

const directorNav = [
  { label: 'My Dashboard', path: '/director/portal', icon: LayoutDashboard },
  { label: 'Director Tech Request', path: '/director/request-tech', icon: Wrench },
  { label: 'Student Directory', path: '/students', icon: GraduationCap },
  { label: 'Resource Library', path: '/resources', icon: BookOpen },
];

export default function Sidebar({ role, collapsed, onToggle, user }) {
  const location = useLocation();

  if (role !== 'admin') {
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
          {directorNav.map(item => {
            const Icon = item.icon;
            const active = location.pathname === item.path;
            return (
              <Link key={item.path} to={item.path} className={cn(
                "flex items-center gap-3 mx-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                active ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}>
                <Icon className="w-5 h-5 flex-shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}
        </nav>
        <SidebarFooter collapsed={collapsed} user={user} role={role} />
      </aside>
    );
  }

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
        {adminNavGroups.map((group, gi) => (
          <div key={group.label} className={cn(gi > 0 && "mt-4")}>
            {!collapsed && (
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 px-5 mb-1">
                {group.label}
              </p>
            )}
            {collapsed && gi > 0 && <div className="mx-4 my-3 border-t border-border opacity-50" />}
            {group.items.map(item => {
              const Icon = item.icon;
              const active = location.pathname === item.path;
              return (
                <Link key={item.path} to={item.path} className={cn(
                  "flex items-center gap-3 mx-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  active ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}>
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <SidebarFooter collapsed={collapsed} user={user} role={role} />
    </aside>
  );
}

function SidebarFooter({ collapsed, user, role }) {
  return (
    <div className="p-4 border-t border-border">
      {!collapsed && user && (
        <div className="mb-3 px-2">
          <p className="text-sm font-medium text-foreground truncate">{user.full_name || user.email}</p>
          <p className="text-xs text-muted-foreground capitalize">{role}</p>
        </div>
      )}
      <Button
        type="button"
        variant="ghost"
        size={collapsed ? "icon" : "default"}
        className={cn("w-full text-muted-foreground", !collapsed && "justify-start")}
        onClick={() => db.auth.logout()}
      >
        <LogOut className="w-4 h-4" />
        {!collapsed && <span className="ml-2">Logout</span>}
      </Button>
    </div>
  );
}