
"use client";

import React, { createContext, useState, useCallback } from 'react';

export type ToastVariant = 'success' | 'error' | 'info' | 'warning';

export interface ToastMessage {
  id: number;
  title: string;
  description: string;
  variant: ToastVariant;
}

interface ToastContextType {
  toasts: ToastMessage[];
  addToast: (title: string, description: string, variant: ToastVariant) => void;
  removeToast: (id: number) => void;
}

export const ToastContext = createContext<ToastContextType | undefined>(undefined);

interface ToastProviderProps {
    children: React.ReactNode;
}

export const ToastProvider: React.FC<ToastProviderProps> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback((title: string, description: string, variant: ToastVariant) => {
    const id = Date.now();
    setToasts(currentToasts => [...currentToasts, { id, title, description, variant }]);
    
    setTimeout(() => {
      removeToast(id);
    }, 5000); // Auto-remove after 5 seconds
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts(currentToasts => currentToasts.filter(toast => toast.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
    </ToastContext.Provider>
  );
};
