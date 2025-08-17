import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X, UploadCloud, FileImage } from 'lucide-react';
import { Category, NewActivityData, User, Activity } from '../types';
import Spinner from './Spinner';
import { useFocusTrap } from '../hooks/useFocusTrap';

interface AddIncidentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: NewActivityData) => Promise<any>;
  categories: Category[];
  users: User[];
  activityToEdit: Activity | null;
  prefilledData: Partial<NewActivityData> | null;
}

const AddIncidentModal: React.FC<AddIncidentModalProps> = ({ isOpen, onClose, onSave, categories, users, activityToEdit, prefilledData }) => {
  const getInitialFormData = useCallback((): NewActivityData => {
    const defaults: NewActivityData = {
      user_id: users[0]?.id || '1',
      category_id: categories[0]?.id || '',
      subcategory: '',
      location: '',
      notes: '',
      photo_url: undefined,
    };
    
    // Start with defaults, then layer on prefilled data, then the activity to edit.
    // The activity to edit is the most specific, so it wins.
    const combinedData = { ...defaults, ...prefilledData };
    
    if (activityToEdit) {
      return {
        user_id: activityToEdit.user_id,
        category_id: activityToEdit.category_id,
        subcategory: activityToEdit.subcategory,
        location: activityToEdit.location,
        notes: activityToEdit.notes || '',
        photo_url: activityToEdit.photo_url,
      };
    }

    return combinedData;

  }, [activityToEdit, users, categories, prefilledData]);

  const [formData, setFormData] = useState<NewActivityData>(getInitialFormData());
  const [isSaving, setIsSaving] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  useFocusTrap(modalRef, isOpen);

  useEffect(() => {
    if (isOpen) {
        const initialData = getInitialFormData();
        setFormData(initialData);
        setPhotoPreview(initialData.photo_url || null);
    }
  }, [isOpen, getInitialFormData]);


  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ 
        ...prev, 
        [name]: value
    }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setPhotoPreview(result);
        setFormData(prev => ({ ...prev, photo_url: result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.subcategory.trim() || !formData.location.trim()) {
      alert('Please fill in Subcategory and Location.');
      return;
    }
    setIsSaving(true);
    await onSave(formData);
    setIsSaving(false);
    // onClose is called by the parent component after save
  };

  const handleEscKey = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      onClose();
    }
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

  const isEditing = !!activityToEdit;
  const inputStyles = "bg-input border border-border rounded-md px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-primary";
  const labelStyles = "block text-sm font-medium text-muted-foreground mb-1";
  const modalTitle = isEditing ? 'Edit Incident' : 'Log New Incident';
  const saveButtonText = isEditing ? 'Save Changes' : 'Save Incident';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-incident-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        className="relative bg-card p-6 rounded-lg shadow-xl max-w-lg w-full border border-border"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 id="add-incident-title" className="text-xl font-semibold">{modalTitle}</h2>
          <button
            onClick={onClose}
            className="h-8 w-8 bg-transparent rounded-full flex items-center justify-center text-muted-foreground hover:bg-secondary transition-colors"
            aria-label="Close dialog"
          >
            <X size={20} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="user_id" className={labelStyles}>Staff Member</label>
            <select name="user_id" id="user_id" value={formData.user_id} onChange={handleInputChange} className={inputStyles} required>
                {users.map(user => <option key={user.id} value={user.id}>{user.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="category_id" className={labelStyles}>Category</label>
            <select name="category_id" id="category_id" value={formData.category_id} onChange={handleInputChange} className={inputStyles}>
              {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="subcategory" className={labelStyles}>Subcategory / Title</label>
            <input type="text" name="subcategory" id="subcategory" value={formData.subcategory} onChange={handleInputChange} className={inputStyles} required />
          </div>
          <div>
            <label htmlFor="location" className={labelStyles}>Location</label>
            <input type="text" name="location" id="location" value={formData.location} onChange={handleInputChange} className={inputStyles} required />
          </div>
          <div>
            <label htmlFor="notes" className={labelStyles}>Notes</label>
            <textarea name="notes" id="notes" value={formData.notes} onChange={handleInputChange} rows={4} className={inputStyles} />
          </div>
          <div>
             <label className={labelStyles}>Photo (Optional)</label>
             <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-border border-dashed rounded-md">
                <div className="space-y-1 text-center">
                    {photoPreview ? (
                        <img src={photoPreview} alt="Preview" className="mx-auto h-24 w-auto rounded-md object-cover" />
                    ) : (
                        <FileImage className="mx-auto h-12 w-12 text-muted-foreground" />
                    )}
                    <div className="flex text-sm text-muted-foreground justify-center">
                        <label htmlFor="photo_url" className="relative cursor-pointer bg-card rounded-md font-medium text-primary hover:text-primary/80 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-offset-card focus-within:ring-primary">
                            <span>Upload a file</span>
                            <input id="photo_url" name="photo_url" type="file" className="sr-only" accept="image/*" onChange={handleFileChange} />
                        </label>
                        <p className="pl-1">or drag and drop</p>
                    </div>
                    <p className="text-xs text-muted-foreground">PNG, JPG, GIF up to 10MB</p>
                </div>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={isSaving} className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:bg-muted disabled:cursor-wait flex items-center gap-2">
              {isSaving && <Spinner size="sm" />}
              {isSaving ? 'Saving...' : saveButtonText}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddIncidentModal;
