import React from 'react';
import { cn } from '@/lib/utils';

export default function EmptyState({ icon: Icon, title, description, action, className }) {
  return (
    <div className={cn("text-center py-12 px-4", className)}>
      {Icon && (
        <div className="mx-auto w-12 h-12 rounded-xl bg-muted flex items-center justify-center mb-4">
          <Icon className="w-6 h-6 text-muted-foreground" />
        </div>
      )}
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {description && <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}