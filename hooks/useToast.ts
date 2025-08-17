
import { useContext } from 'react';
import { ToastContext } from '../contexts/ToastContext';

/**
 * A custom hook to provide easy access to the toast notification system.
 *
 * @example
 * const { addToast } = useToast();
 * addToast('This is a success message!', 'success');
 */
export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
