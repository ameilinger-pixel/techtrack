import { db } from '@/lib/backend/client';

import React, { useState } from 'react';

import { useQuery } from '@tanstack/react-query';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, GraduationCap, Mail, Award } from 'lucide-react';

export default function StudentDirectory() {
  const [search, setSearch] = useState('');
  const [skillFilter, setSkillFilter] = useState('all');

  const { data: students = [], isLoading } = useQuery({
    queryKey: ['students'],
    queryFn: () => db.entities.Student.list(),
  });
  const { data: badges = [] } = useQuery({
    queryKey: ['badges'],
    queryFn: () => db.entities.BadgeEnrollment.list(),
  });
  const { data: assignments = [] } = useQuery({
    queryKey: ['student-assignments'],
    queryFn: () => db.entities.TechAssignment.list(),
  });

  const filtered = students.filter(s => {
    const q = search.toLowerCase();
    const matchSearch = !q || s.full_name?.toLowerCase().includes(q) || s.email?.toLowerCase().includes(q);
    const matchSkill = skillFilter === 'all' || s.skill_level === skillFilter;
    return matchSearch && matchSkill;
  });

  return (
    <div>
      <PageHeader title="Student Directory" subtitle={`${students.length} students`} />

      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search students..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={skillFilter} onValueChange={setSkillFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Skill level" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Levels</SelectItem>
            <SelectItem value="beginner">Beginner</SelectItem>
            <SelectItem value="intermediate">Intermediate</SelectItem>
            <SelectItem value="advanced">Advanced</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-40 w-full rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={GraduationCap} title="No students found" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(s => {
            const studentBadges = badges.filter(b => b.student_id === s.id && b.status === 'completed');
            const studentAssignments = assignments.filter(a => a.assigned_student_id === s.id);
            return (
              <Card key={s.id} className="p-4 hover:shadow-md transition-all">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-primary">{(s.full_name || '?')[0].toUpperCase()}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-sm truncate">{s.full_name}</h3>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                      <Mail className="w-3 h-3" />{s.email}
                    </p>
                    {s.skill_level && (
                      <Badge variant="outline" className="mt-1 capitalize text-xs">{s.skill_level}</Badge>
                    )}
                  </div>
                </div>
                {s.skills?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-3">
                    {s.skills.slice(0, 4).map(sk => (
                      <span key={sk} className="text-xs px-2 py-0.5 bg-muted rounded-full">{sk}</span>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Award className="w-3 h-3" />{studentBadges.length} badge{studentBadges.length !== 1 ? 's' : ''}</span>
                  <span>{studentAssignments.length} assignment{studentAssignments.length !== 1 ? 's' : ''}</span>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}