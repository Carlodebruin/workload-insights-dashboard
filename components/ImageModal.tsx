
import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { useFocusTrap } from '../hooks/useFocusTrap';

interface ImageModalProps {
  imageUrl: string;
  altText: string;
  onClose: () => void;
  triggerRef: React.RefObject<HTMLButtonElement>;
}

const ImageModal: React.FC<ImageModalProps> = ({ imageUrl, altText, onClose, triggerRef }) => {
  const modalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(modalRef, true); // Modal is always open when rendered

  const handleClose = () => {
    onClose();
    triggerRef.current?.focus();
  };
  
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'auto';
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Image viewer"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
      onClick={handleClose}
    >
      <div
        ref={modalRef}
        className="relative bg-card p-2 rounded-lg shadow-xl max-w-4xl max-h-[90vh] w-auto"
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking on the image container
      >
        <button
          onClick={handleClose}
          className="absolute -top-3 -right-3 h-8 w-8 bg-primary rounded-full flex items-center justify-center text-primary-foreground hover:bg-primary/80 transition-colors z-10"
          aria-label="Close image viewer"
        >
          <X size={20} />
        </button>
        <img
          src={imageUrl}
          alt={altText}
          className="rounded-md max-w-full max-h-[calc(90vh-1rem)] object-contain"
        />
      </div>
    </div>
  );
};

export default ImageModal;
