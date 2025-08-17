import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X } from 'lucide-react';
import Spinner from './Spinner';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { Geofence } from '../types';

interface GeofenceFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string) => void;
  geofenceToEdit: Geofence | null;
}

const GeofenceFormModal: React.FC<GeofenceFormModalProps> = ({ isOpen, onClose, onSave, geofenceToEdit }) => {
  const [name, setName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  useFocusTrap(modalRef, isOpen);

  useEffect(() => {
    if (geofenceToEdit) {
      setName(geofenceToEdit.name);
    } else {
      setName('');
    }
  }, [geofenceToEdit, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('Please provide a name for the zone.');
      return;
    }
    setIsSaving(true);
    await onSave(name);
    setIsSaving(false);
    onClose();
  };

  const handleEscKey = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleEscKey);
      document.body.style.overflow = 'hidden';
    } else {
      document.removeEventListener('keydown', handleEscKey);
      document.body.style.overflow = 'auto';
    }
    return () => {
      document.removeEventListener('keydown', handleEscKey);
      document.body.style.overflow = 'auto';
    };
  }, [isOpen, handleEscKey]);

  if (!isOpen) return null;

  const inputStyles = "bg-input border border-border rounded-md px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-primary";
  const labelStyles = "block text-sm font-medium text-muted-foreground mb-1";
  const title = geofenceToEdit ? 'Edit Zone Name' : 'Name New Zone';
  const buttonText = geofenceToEdit ? 'Save Changes' : 'Save Zone';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="geofence-form-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        className="relative bg-card p-6 rounded-lg shadow-xl max-w-md w-full border border-border"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 id="geofence-form-title" className="text-xl font-semibold">{title}</h2>
          <button onClick={onClose} className="p-1 rounded-full text-muted-foreground hover:bg-secondary transition-colors" aria-label="Close dialog">
            <X size={20} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className={labelStyles}>Zone Name</label>
            <input type="text" name="name" id="name" value={name} onChange={(e) => setName(e.target.value)} className={inputStyles} required autoFocus />
          </div>
          
          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors">Cancel</button>
            <button type="submit" disabled={isSaving} className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:bg-muted disabled:cursor-wait flex items-center gap-2">
              {isSaving && <Spinner size="sm" />}
              {isSaving ? 'Saving...' : buttonText}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default GeofenceFormModal;
