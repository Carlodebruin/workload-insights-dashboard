import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X } from 'lucide-react';
import { Activity, User, ActivityStatus } from '../types';
import Spinner from './Spinner';
import { useFocusTrap } from '../hooks/useFocusTrap';

interface TaskActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (
    activityId: string, 
    payload: { userId?: string; status?: ActivityStatus; notes?: string; instructions?: string; progressNotes?: string; }
  ) => Promise<void>;
  activity: Activity;
  users: User[];
}

const TaskActionModal: React.FC<TaskActionModalProps> = ({ isOpen, onClose, onSave, activity, users }) => {
  const [assignedUserId, setAssignedUserId] = useState<string>(activity.assigned_to_user_id || '');
  const [status, setStatus] = useState<ActivityStatus>(activity.status as ActivityStatus);
  const [resolutionNotes, setResolutionNotes] = useState(activity.resolution_notes || '');
  const [instructions, setInstructions] = useState(activity.assignment_instructions || '');
  const [progressNotes, setProgressNotes] = useState('');
  const [currentView, setCurrentView] = useState<'main' | 'assign'>('main');
  const [isSaving, setIsSaving] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  useFocusTrap(modalRef, isOpen);

  useEffect(() => {
    if (isOpen) {
      setAssignedUserId(activity.assigned_to_user_id || '');
      setStatus(activity.status as ActivityStatus);
      setResolutionNotes(activity.resolution_notes || '');
      setInstructions(activity.assignment_instructions || '');
      setProgressNotes('');
      setCurrentView('main');
    }
  }, [isOpen, activity]);

  const handleSaveAssignment = async () => {
    if (!assignedUserId) {
      alert("Please select a user to assign the task to.");
      return;
    }
    setIsSaving(true);
    await onSave(activity.id, { 
        userId: assignedUserId,
        instructions: instructions,
    });
    setIsSaving(false);
  };

  const handleSaveStatus = async () => {
    setIsSaving(true);
    const payload: any = { status };
    if (resolutionNotes) payload.notes = resolutionNotes;
    if (progressNotes.trim()) payload.progressNotes = progressNotes.trim();
    await onSave(activity.id, payload);
    setIsSaving(false);
  };
  
  const handleEscKey = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleEscKey);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscKey);
      document.body.style.overflow = 'auto';
    };
  }, [isOpen, handleEscKey]);

  if (!isOpen) return null;

  const inputStyles = "bg-input border border-border rounded-md px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-primary";
  const labelStyles = "block text-sm font-medium text-muted-foreground mb-1";
  const title = "Task Actions";

  const renderMainView = () => (
    <>
      <div>
        <label htmlFor="status" className={labelStyles}>Update Status</label>
        <select id="status" value={status} onChange={(e) => setStatus(e.target.value as ActivityStatus)} className={inputStyles}>
          {activity.status !== 'Unassigned' && <option value="Open">Open</option>}
          {activity.status !== 'Unassigned' && <option value="In Progress">In Progress</option>}
          {activity.status !== 'Unassigned' && <option value="Resolved">Resolved</option>}
          <option value="Unassigned">Unassigned (remove assignment)</option>
        </select>
      </div>
      <div>
        <label htmlFor="progress_notes" className={labelStyles}>Progress Notes (Optional)</label>
        <textarea 
          id="progress_notes" 
          value={progressNotes} 
          onChange={(e) => setProgressNotes(e.target.value)} 
          rows={3} 
          className={inputStyles} 
          placeholder="Add any updates, observations, or context about this status change..."
        />
      </div>
      {status === 'Resolved' && (
        <div>
          <label htmlFor="resolution_notes" className={labelStyles}>Final Resolution Notes (Optional)</label>
          <textarea id="resolution_notes" value={resolutionNotes} onChange={(e) => setResolutionNotes(e.target.value)} rows={3} className={inputStyles} placeholder="Describe how this issue was resolved..." />
        </div>
      )}
      <div className="flex justify-end gap-3 pt-4">
        <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors">Cancel</button>
        <button type="button" onClick={() => setCurrentView('assign')} className="px-4 py-2 text-sm rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors">
            {activity.assigned_to_user_id ? 'Reassign' : 'Assign'}
        </button>
        <button type="button" onClick={handleSaveStatus} disabled={isSaving || (status === activity.status && !progressNotes.trim())} className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:bg-muted disabled:cursor-wait flex items-center gap-2">
            {isSaving && <Spinner size="sm" />}
            Save Status
        </button>
      </div>
    </>
  );

  const renderAssignView = () => (
    <>
        <div>
            <label htmlFor="assigned_to_user_id" className={labelStyles}>Assign To</label>
            <select id="assigned_to_user_id" value={assignedUserId} onChange={(e) => setAssignedUserId(e.target.value)} className={inputStyles}>
                <option value="" disabled>Select a staff member...</option>
                {users.map(user => <option key={user.id} value={user.id}>{user.name} ({user.role})</option>)}
            </select>
        </div>
        <div>
            <label htmlFor="instructions" className={labelStyles}>Instructions (Optional)</label>
            <textarea id="instructions" value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={3} className={inputStyles} placeholder="e.g., Please check the plumbing in the main hall." />
        </div>
        <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={() => setCurrentView('main')} className="px-4 py-2 text-sm rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors">Back</button>
            <button type="button" onClick={handleSaveAssignment} disabled={isSaving || !assignedUserId} className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:bg-muted disabled:cursor-wait flex items-center gap-2">
                {isSaving && <Spinner size="sm" />}
                Save Assignment
            </button>
        </div>
    </>
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="task-action-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        className="relative bg-card p-6 rounded-lg shadow-xl max-w-md w-full border border-border"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 id="task-action-title" className="text-xl font-semibold">{title}</h2>
          <button onClick={onClose} className="p-1 rounded-full text-muted-foreground hover:bg-secondary transition-colors" aria-label="Close dialog">
            <X size={20} />
          </button>
        </div>
        
        <div className="space-y-4">
            <div className="text-sm bg-secondary/50 p-3 rounded-md">
                <p><span className="font-semibold text-muted-foreground">Incident:</span> {activity.notes && activity.notes !== 'No additional details provided' && activity.notes.trim() ? activity.notes : activity.subcategory}</p>
                <p><span className="font-semibold text-muted-foreground">Location:</span> {activity.location}</p>
            </div>
            {currentView === 'main' ? renderMainView() : renderAssignView()}
        </div>
      </div>
    </div>
  );
};

export default TaskActionModal;
