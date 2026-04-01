import React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const statusStyles = {
  upcoming: 'bg-blue-50 text-blue-700 border-blue-200',
  in_progress: 'bg-amber-50 text-amber-700 border-amber-200',
  completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  archived: 'bg-gray-100 text-gray-600 border-gray-200',
  pending_admin_approval: 'bg-orange-50 text-orange-700 border-orange-200',
  requested: 'bg-blue-50 text-blue-700 border-blue-200',
  assigned: 'bg-purple-50 text-purple-700 border-purple-200',
  confirmed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  cancelled: 'bg-red-50 text-red-600 border-red-200',
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  rejected: 'bg-red-50 text-red-600 border-red-200',
  needs_director_contact: 'bg-orange-50 text-orange-700 border-orange-200',
  awaiting_form: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  needs_director_notify: 'bg-amber-50 text-amber-700 border-amber-200',
  posting_open: 'bg-blue-50 text-blue-700 border-blue-200',
  posting_created: 'bg-indigo-50 text-indigo-700 border-indigo-200',
};

export default function StatusBadge({ status, className }) {
  const label = (status || 'unknown').replace(/_/g, ' ');
  return (
    <Badge
      variant="outline"
      className={cn(
        "capitalize text-xs font-medium px-2 py-0.5",
        statusStyles[status] || 'bg-muted text-muted-foreground',
        className
      )}
    >
      {label}
    </Badge>
  );
}