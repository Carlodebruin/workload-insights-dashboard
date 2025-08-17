
import React, { useEffect, useState } from 'react';
import { X, CheckCircle, AlertTriangle, Info, AlertCircle as WarningIcon } from 'lucide-react';
import { ToastMessage, ToastVariant } from '../contexts/ToastContext';

interface ToastProps extends ToastMessage {
  onClose: () => void;
}

const ICONS: Record<ToastVariant, React.ReactNode> = {
  success: <CheckCircle className="h-6 w-6 text-green-500" />,
  error: <AlertTriangle className="h-6 w-6 text-red-500" />,
  info: <Info className="h-6 w-6 text-blue-500" />,
  warning: <WarningIcon className="h-6 w-6 text-yellow-500" />,
};

const BORDER_CLASSES: Record<ToastVariant, string> = {
  success: 'border-green-500',
  error: 'border-red-500',
  info: 'border-blue-500',
  warning: 'border-yellow-500',
};

const Toast: React.FC<ToastProps> = ({ title, description, variant, onClose }) => {
    const [isShowing, setIsShowing] = useState(false);

    useEffect(() => {
        // Mount animation
        const timer = setTimeout(() => setIsShowing(true), 10);
        return () => clearTimeout(timer);
    }, []);

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={`
        relative w-full rounded-lg border-l-4 bg-card text-card-foreground shadow-lg p-4 transition-all duration-300 ease-in-out
        ${BORDER_CLASSES[variant]}
        ${isShowing ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-full'}
      `}
    >
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0">{ICONS[variant]}</div>
        <div className="flex-1">
          <p className="text-sm font-semibold">{title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        <div className="flex-shrink-0">
          <button
            onClick={onClose}
            className="inline-flex rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-ring"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default Toast;
