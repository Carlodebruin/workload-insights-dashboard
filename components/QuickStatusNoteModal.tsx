import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X } from 'lucide-react';
import { Activity, ActivityStatus, User } from '../types';
import Spinner from './Spinner';
import { useFocusTrap } from '../hooks/useFocusTrap';

interface QuickStatusNoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (activityId: string, notes: string, status: ActivityStatus, updateType: string) => Promise<void>;
  activity: Activity;
  targetStatus: ActivityStatus;
  notePrompt: string;
  currentUser: User;
}

const QuickStatusNoteModal: React.FC<QuickStatusNoteModalProps> = ({ 
  isOpen, 
  onClose, 
  onSave, 
  activity, 
  targetStatus, 
  notePrompt, 
  currentUser 
}) => {
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  useFocusTrap(modalRef, isOpen);

  useEffect(() => {
    if (isOpen) {
      setNotes('');
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notes.trim()) {
      return; // Don't save empty notes
    }
    
    setIsSaving(true);
    try {
      // Determine update type based on status change
      const updateType = targetStatus !== activity.status ? 'status_change' : 'progress';
      await onSave(activity.id, notes.trim(), targetStatus, updateType);
      onClose();
    } catch (error) {
      console.error('Failed to save status note:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleEscKey = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Escape' && !isSaving) onClose();
  }, [onClose, isSaving]);

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
  const isStatusChanging = targetStatus !== activity.status;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="quick-note-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        className="relative bg-card p-6 rounded-lg shadow-xl max-w-md w-full border border-border"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 id="quick-note-title" className="text-lg font-semibold">
            {isStatusChanging ? `${targetStatus} - Add Note` : 'Progress Note'}
          </h2>
          <button 
            onClick={onClose} 
            disabled={isSaving}
            className="h-8 w-8 bg-transparent rounded-full flex items-center justify-center text-muted-foreground hover:bg-secondary disabled:opacity-50" 
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="text-sm bg-secondary/50 p-3 rounded-md">
            <p><span className="font-semibold text-muted-foreground">Task:</span> {activity.notes || activity.subcategory}</p>
            <p><span className="font-semibold text-muted-foreground">Location:</span> {activity.location}</p>
            {isStatusChanging && (
              <p><span className="font-semibold text-muted-foreground">Status Change:</span> {activity.status} → <span className="font-semibold text-primary">{targetStatus}</span></p>
            )}
          </div>
          
          <div>
            <label htmlFor="notes" className="block text-sm font-medium text-muted-foreground mb-2">
              {notePrompt}
            </label>
            <textarea 
              id="notes"
              value={notes} 
              onChange={(e) => setNotes(e.target.value)} 
              rows={3} 
              className={inputStyles}
              placeholder="Enter your note..."
              autoFocus
              required
              disabled={isSaving}
            />
          </div>
          
          <div className="flex justify-end gap-3 pt-4">
            <button 
              type="button" 
              onClick={onClose} 
              disabled={isSaving}
              className="px-4 py-2 text-sm rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80 disabled:opacity-50"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={isSaving || !notes.trim()} 
              className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:bg-muted disabled:cursor-wait flex items-center gap-2"
            >
              {isSaving && <Spinner size="sm" />}
              {isSaving ? 'Saving...' : (isStatusChanging ? `Save & Update Status` : 'Save Note')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default QuickStatusNoteModal;