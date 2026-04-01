import React from 'react';
import { Card } from '@/components/ui/card';
import StatusBadge from '@/components/shared/StatusBadge';
import { formatDateDisplay, crewCount, showNeedsAction } from '@/lib/showUtils';
import { Users, Calendar, MapPin, AlertTriangle, ChevronRight } from 'lucide-react';

const ACTION_HINTS = {
  contact_director: '→ Contact director',
  post_application: '→ Post application',
  notify_director: '→ Notify director',
  print_crew_form: '→ Print crew form',
  return_equipment: '→ Return equipment',
};

export default function ShowCard({ show, onClick }) {
  const crew = crewCount(show);
  const action = showNeedsAction(show);
  const hint = action ? ACTION_HINTS[action] : null;

  return (
    <Card
      className={`p-4 cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 ${action ? 'border-amber-300' : ''}`}
      onClick={() => onClick(show)}
    >
      <div className="flex items-start justify-between mb-2">
        <h3 className="font-semibold text-sm text-foreground truncate flex-1 mr-2">{show.title}</h3>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {action && <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />}
          <StatusBadge status={show.workflow_status || show.status} />
        </div>
      </div>
      <div className="space-y-1 text-xs text-muted-foreground">
        {show.director_name && (
          <p className="truncate">Director: {show.director_name}</p>
        )}
        <div className="flex items-center gap-3">
          {show.theater && (
            <span className="flex items-center gap-1">
              <MapPin className="w-3 h-3" />{show.theater}
            </span>
          )}
          {show.tech_week_start && (
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />{formatDateDisplay(show.tech_week_start)}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <Users className="w-3 h-3" />
            {crew > 0 ? `${crew} crew assigned` : 'No crew assigned'}
          </div>
          {hint && (
            <span className="text-amber-600 font-medium flex items-center gap-0.5">
              {hint}<ChevronRight className="w-3 h-3" />
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}