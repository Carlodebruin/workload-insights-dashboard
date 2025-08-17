import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X } from 'lucide-react';
import { User, NewUserData } from '../types';
import Spinner from './Spinner';
import { useFocusTrap } from '../hooks/useFocusTrap';

interface UserFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: NewUserData) => void;
  userToEdit: User | null;
}

const UserFormModal: React.FC<UserFormModalProps> = ({ isOpen, onClose, onSave, userToEdit }) => {
  const [formData, setFormData] = useState<NewUserData>({
    name: '',
    role: 'Teacher',
    phone_number: '',
  });
  const [isSaving, setIsSaving] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  useFocusTrap(modalRef, isOpen);

  useEffect(() => {
    if (userToEdit) {
      setFormData({
        name: userToEdit.name,
        role: userToEdit.role as any, // Cast because role could be any string from DB
        phone_number: userToEdit.phone_number,
      });
    } else {
      setFormData({ name: '', role: 'Teacher', phone_number: '' });
    }
  }, [userToEdit, isOpen]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value as any }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.phone_number.trim()) {
      alert('Please fill in all fields.');
      return;
    }
    setIsSaving(true);
    onSave(formData);
    // Let parent handle closing, which re-initializes state
    setIsSaving(false);
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
  const title = userToEdit ? 'Edit User' : 'Add New User';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="user-form-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        className="relative bg-card p-6 rounded-lg shadow-xl max-w-md w-full border border-border"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 id="user-form-title" className="text-xl font-semibold">{title}</h2>
          <button onClick={onClose} className="p-1 rounded-full text-muted-foreground hover:bg-secondary transition-colors" aria-label="Close dialog">
            <X size={20} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className={labelStyles}>Full Name</label>
            <input type="text" name="name" id="name" value={formData.name} onChange={handleInputChange} className={inputStyles} required />
          </div>
          <div>
            <label htmlFor="role" className={labelStyles}>Role</label>
            <select name="role" id="role" value={formData.role} onChange={handleInputChange} className={inputStyles}>
              <option value="Teacher">Teacher</option>
              <option value="Admin">Admin</option>
              <option value="Maintenance">Maintenance</option>
              <option value="Support Staff">Support Staff</option>
            </select>
          </div>
          <div>
            <label htmlFor="phone_number" className={labelStyles}>Phone Number</label>
            <input type="tel" name="phone_number" id="phone_number" value={formData.phone_number} onChange={handleInputChange} className={inputStyles} placeholder="+15551234" required />
          </div>
          
          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors">Cancel</button>
            <button type="submit" disabled={isSaving} className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:bg-muted disabled:cursor-wait flex items-center gap-2">
              {isSaving && <Spinner size="sm" />}
              {isSaving ? 'Saving...' : 'Save User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UserFormModal;
