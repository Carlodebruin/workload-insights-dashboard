import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X, FileImage } from 'lucide-react';
import { ActivityUpdate, User, Activity } from '../types';
import Spinner from './Spinner';
import { useFocusTrap } from '../hooks/useFocusTrap';

interface AddUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (activityId: string, updateData: Omit<ActivityUpdate, 'id' | 'timestamp'>) => Promise<any>;
  activity: Activity;
  users: User[];
}

const AddUpdateModal: React.FC<AddUpdateModalProps> = ({ isOpen, onClose, onSave, activity, users }) => {
  const [notes, setNotes] = useState('');
  const [authorId, setAuthorId] = useState(users[0]?.id || '1');
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | undefined>(undefined);
  const [isSaving, setIsSaving] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  useFocusTrap(modalRef, isOpen);

  useEffect(() => {
    if (isOpen) {
      setNotes('');
      setPhotoPreview(null);
      setPhotoUrl(undefined);
      setAuthorId(users[0]?.id || '1');
    }
  }, [isOpen, users]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setPhotoPreview(result);
        setPhotoUrl(result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notes.trim()) {
      alert('Please fill in the update notes.');
      return;
    }
    setIsSaving(true);
    await onSave(activity.id, {
        notes,
        author_id: authorId,
        photo_url: photoUrl
    });
    setIsSaving(false);
    // onClose is called by parent
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

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-update-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        className="relative bg-card p-6 rounded-lg shadow-xl max-w-lg w-full border border-border"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 id="add-update-title" className="text-xl font-semibold">Add Update to Incident</h2>
          <button onClick={onClose} className="h-8 w-8 bg-transparent rounded-full flex items-center justify-center text-muted-foreground hover:bg-secondary" aria-label="Close">
            <X size={20} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="text-sm bg-secondary/50 p-3 rounded-md">
                <p><span className="font-semibold text-muted-foreground">Incident:</span> {activity.notes && activity.notes !== 'No additional details provided' && activity.notes.trim() ? activity.notes : activity.subcategory}</p>
                <p><span className="font-semibold text-muted-foreground">Location:</span> {activity.location}</p>
            </div>
             <div>
                <label htmlFor="author_id" className={labelStyles}>Update By</label>
                <select name="author_id" id="author_id" value={authorId} onChange={(e) => setAuthorId(e.target.value)} className={inputStyles} required>
                    {users.map(user => <option key={user.id} value={user.id}>{user.name}</option>)}
                </select>
            </div>
            <div>
                <label htmlFor="notes" className={labelStyles}>Update Notes</label>
                <textarea name="notes" id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} className={inputStyles} required />
            </div>
            <div>
                <label className={labelStyles}>Attach Photo (Optional)</label>
                <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-border border-dashed rounded-md">
                    <div className="space-y-1 text-center">
                        {photoPreview ? (
                            <img src={photoPreview} alt="Preview" className="mx-auto h-24 w-auto rounded-md object-cover" />
                        ) : (
                            <FileImage className="mx-auto h-12 w-12 text-muted-foreground" />
                        )}
                        <div className="flex text-sm text-muted-foreground justify-center">
                            <label htmlFor="photo_url" className="relative cursor-pointer bg-card rounded-md font-medium text-primary hover:text-primary/80">
                                <span>Upload a file</span>
                                <input id="photo_url" name="photo_url" type="file" className="sr-only" accept="image/*" onChange={handleFileChange} />
                            </label>
                            <p className="pl-1">or drag and drop</p>
                        </div>
                    </div>
                </div>
            </div>
            <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80">Cancel</button>
                <button type="submit" disabled={isSaving} className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:bg-muted disabled:cursor-wait flex items-center gap-2">
                    {isSaving && <Spinner size="sm" />}
                    {isSaving ? 'Saving...' : 'Save Update'}
                </button>
            </div>
        </form>
      </div>
    </div>
  );
};

export default AddUpdateModal;
