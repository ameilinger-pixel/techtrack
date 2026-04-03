import { db } from '@/lib/backend/client';

import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import PageHeader from '@/components/shared/PageHeader';
import AssignmentCard from '@/components/admin/AssignmentCard';
import TechRequestModal from '@/components/admin/TechRequestModal';
import ApplicantModal from '@/components/admin/ApplicantModal';
import EditAssignmentModal from '@/components/admin/EditAssignmentModal';
import EmptyState from '@/components/shared/EmptyState';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, ClipboardList } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import ConfirmDialog from '@/components/shared/ConfirmDialog';

export default function TechAssignments() {
  const { user } = useOutletContext();
  const [requestModal, setRequestModal] = useState(false);
  const [applicantModal, setApplicantModal] = useState(null);
  const [editModal, setEditModal] = useState(null);
  const [confirmDeleteAssignment, setConfirmDeleteAssignment] = useState(null);
  const [confirmDeleteApp, setConfirmDeleteApp] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [approving, setApproving] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: assignments = [], isLoading } = useQuery({
    queryKey: ['tech-assignments'],
    queryFn: () => db.entities.TechAssignment.list('-updated_date', 500),
  });
  const { data: students = [] } = useQuery({
    queryKey: ['all-students'],
    queryFn: () => db.entities.Student.list(),
  });
  const { data: applications = [] } = useQuery({
    queryKey: ['all-applications'],
    queryFn: () => db.entities.TechApplication.list(),
  });

  // Handle URL params for deep linking
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const showTitle = params.get('showTitle');
    const openApplicants = params.get('openApplicants');
    if (showTitle && openApplicants === '1') {
      const match = assignments.find(a => a.show_title === showTitle);
      if (match) setApplicantModal(match);
    }
  }, [assignments]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['tech-assignments'] });

  const handleSubmitRequest = async (data) => {
    setSubmitting(true);
    await db.entities.TechAssignment.create({
      ...data,
      status: 'pending_admin_approval',
    });
    // Email admin
    await db.integrations.Core.SendEmail({
      to: user?.email || '',
      subject: `New Tech Request: ${data.show_title}`,
      body: `<p>A new tech request has been submitted for <b>${data.show_title}</b> at ${data.theater}.</p><p>Tech Week: ${data.tech_week_start}</p>`,
    });
    toast({ title: 'Tech request submitted' });
    refresh();
    setRequestModal(false);
    setSubmitting(false);
  };

  const handleApprove = async (assignment) => {
    await db.entities.TechAssignment.update(assignment.id, { status: 'requested' });
    // Email director that their request is approved and posted
    if (assignment.director_email) {
      const directorFirst = (assignment.director_name || '').split(' ')[0] || 'there';
      let dueDate = '';
      if (assignment.tech_week_start) {
        const d = new Date(assignment.tech_week_start);
        d.setDate(d.getDate() - 35);
        dueDate = d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
      }
      await db.integrations.Core.SendEmail({
        to: assignment.director_email,
        subject: `Your Tech Request for "${assignment.show_title}" is Now Posted!`,
        body: `Hi ${directorFirst},<br><br>Great news! Your tech request for <strong>${assignment.show_title}</strong> has been reviewed and approved by our admin team. It is now posted and open for student applications.<br><br>${dueDate ? `<strong>Application Deadline:</strong> ${dueDate}<br><br>` : ''}Students will apply and we will notify you once a technician has been assigned. You can track the status of your request in your Director Dashboard.<br><br>Best regards,<br>The NTPA TechTrack Admin Team`,
      });
    }
    toast({ title: 'Assignment approved and posted' });
    refresh();
  };

  const handleMarkComplete = async (assignment) => {
    await db.entities.TechAssignment.update(assignment.id, { status: 'completed' });
    toast({ title: 'Assignment marked complete' });
    refresh();
  };

  const handleToggleVerification = async (assignment, field) => {
    await db.entities.TechAssignment.update(assignment.id, { [field]: !assignment[field] });
    refresh();
  };

  const handleDeleteAssignment = async () => {
    await db.entities.TechAssignment.delete(confirmDeleteAssignment.id);
    toast({ title: 'Assignment deleted' });
    refresh();
    setConfirmDeleteAssignment(null);
  };

  const handleDeleteApplication = async () => {
    await db.entities.TechApplication.delete(confirmDeleteApp.id);
    toast({ title: 'Application deleted' });
    queryClient.invalidateQueries({ queryKey: ['all-applications'] });
    setConfirmDeleteApp(null);
  };

  const handleSaveEdit = async (data) => {
    await db.entities.TechAssignment.update(data.id, data);
    toast({ title: 'Assignment updated' });
    refresh();
    setEditModal(null);
  };

  const handleApproveApplicant = async (app, assignment) => {
    setApproving(true);
    // Approve this application
    await db.entities.TechApplication.update(app.id, { status: 'approved' });
    // Assign student to assignment
    await db.entities.TechAssignment.update(assignment.id, {
      status: 'assigned',
      assigned_student_id: app.student_id,
      assigned_student_name: app.student_name,
      assigned_student_email: app.student_email,
    });
    // Reject other pending applications
    const others = applications.filter(a => a.assignment_id === assignment.id && a.id !== app.id && a.status === 'pending');
    for (const other of others) {
      await db.entities.TechApplication.update(other.id, { status: 'rejected' });
    }
    // Email approved student
    const studentFirst = (app.student_name || '').split(' ')[0] || 'there';
    const assignedRole = (assignment.assigned_role || '').replace(/_/g, ' ');
    const directorFirst = (assignment.director_name || '').split(' ')[0] || 'there';
    await db.integrations.Core.SendEmail({
      to: app.student_email,
      subject: `You've been assigned to ${assignment.show_title}!`,
      body: `Congratulations ${studentFirst},<br><br>You have been assigned the role of <strong>${assignedRole}</strong> for the production of <strong>${assignment.show_title}</strong>.<br><br>The director, ${assignment.director_name}, will be in touch with more details soon.<br><br>Best,<br>The Tech Team`,
    });
    // Email director
    if (assignment.director_email) {
      await db.integrations.Core.SendEmail({
        to: assignment.director_email,
        subject: `Technician Assigned for ${assignment.show_title}`,
        body: `Hi ${directorFirst},<br><br><strong>${app.student_name}</strong> has been assigned as the <strong>${assignedRole}</strong> for your production of <strong>${assignment.show_title}</strong>.<br><br>You can reach them at: ${app.student_email}<br><br>Please get in touch with them to coordinate rehearsal schedules and other details.<br><br>Best regards,<br>The NTPA TechTrack Admin Team`,
      });
    }
    // Email rejected applicants
    for (const other of others) {
      const otherFirst = (other.student_name || '').split(' ')[0] || 'there';
      await db.integrations.Core.SendEmail({
        to: other.student_email,
        subject: `Update on your application for ${assignment.show_title}`,
        body: `Hi ${otherFirst},<br><br>Thank you for your interest in the ${assignedRole} role for ${assignment.show_title}. The position has now been filled.<br><br>We encourage you to apply for other opportunities in the future!<br><br>Best,<br>The Tech Team`,
      });
    }
    toast({ title: 'Applicant approved and assigned' });
    queryClient.invalidateQueries({ queryKey: ['all-applications'] });
    refresh();
    setApplicantModal(null);
    setApproving(false);
  };

  const tabs = {
    pending: assignments.filter(a => a.status === 'pending_admin_approval'),
    all: assignments,
    open: assignments.filter(a => a.status === 'requested'),
    assigned: assignments.filter(a => ['assigned', 'confirmed'].includes(a.status)),
    completed: assignments.filter(a => a.status === 'completed'),
    payment_due: assignments.filter(a => a.status === 'completed' && a.payment_status === 'pending'),
  };

  return (
    <div>
      <PageHeader title="Tech Assignments" subtitle="Manage tech gig postings and applications">
        <Button onClick={() => setRequestModal(true)}>
          <Plus className="w-4 h-4 mr-2" />New Request
        </Button>
      </PageHeader>

      <Tabs defaultValue="pending">
        <TabsList className="flex-wrap">
          {Object.entries(tabs).map(([key, arr]) => (
            <TabsTrigger key={key} value={key} className="capitalize">
              {key.replace(/_/g, ' ')}
              <Badge variant="secondary" className="ml-1 text-xs">{arr.length}</Badge>
            </TabsTrigger>
          ))}
        </TabsList>
        {Object.entries(tabs).map(([key, arr]) => (
          <TabsContent key={key} value={key} className="mt-4">
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{[1,2,3].map(i => <Skeleton key={i} className="h-40 w-full rounded-xl" />)}</div>
            ) : arr.length === 0 ? (
              <EmptyState icon={ClipboardList} title={`No ${key.replace(/_/g, ' ')} assignments`} />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {arr.map(a => (
                  <AssignmentCard
                    key={a.id}
                    assignment={a}
                    onApprove={handleApprove}
                    onViewApplicants={setApplicantModal}
                    onMarkComplete={handleMarkComplete}
                    onToggleVerification={handleToggleVerification}
                    onEdit={setEditModal}
                    onDelete={setConfirmDeleteAssignment}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      <TechRequestModal open={requestModal} onClose={() => setRequestModal(false)} onSubmit={handleSubmitRequest} isSubmitting={submitting} />
      <ApplicantModal
        open={!!applicantModal}
        onClose={() => setApplicantModal(null)}
        assignment={applicantModal}
        applications={applications}
        students={students}
        onApprove={handleApproveApplicant}
        approving={approving}
        onDeleteApplication={setConfirmDeleteApp}
      />
      <EditAssignmentModal
        open={!!editModal}
        onClose={() => setEditModal(null)}
        assignment={editModal}
        onSave={handleSaveEdit}
      />
      <ConfirmDialog
        open={!!confirmDeleteAssignment}
        onClose={() => setConfirmDeleteAssignment(null)}
        onConfirm={handleDeleteAssignment}
        title="Delete Assignment?"
        description={`Delete "${confirmDeleteAssignment?.show_title}"? This cannot be undone.`}
        confirmLabel="Delete"
        destructive
      />
      <ConfirmDialog
        open={!!confirmDeleteApp}
        onClose={() => setConfirmDeleteApp(null)}
        onConfirm={handleDeleteApplication}
        title="Delete Application?"
        description={`Delete application from ${confirmDeleteApp?.student_name}? This cannot be undone.`}
        confirmLabel="Delete"
        destructive
      />
    </div>
  );
}