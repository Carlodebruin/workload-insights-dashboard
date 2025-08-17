
import { useEffect } from 'react';

const FOCUSABLE_SELECTORS = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

/**
 * A custom hook to trap focus within a designated container element (e.g., a modal).
 * @param modalRef A React ref to the container element.
 * @param isOpen A boolean indicating if the container is currently open/active.
 */
export const useFocusTrap = (modalRef: React.RefObject<HTMLElement>, isOpen: boolean) => {
  useEffect(() => {
    if (isOpen && modalRef.current) {
      const focusableElements = Array.from(
        modalRef.current.querySelectorAll(FOCUSABLE_SELECTORS)
      ) as HTMLElement[];
      
      const firstFocusableElement = focusableElements[0];
      const lastFocusableElement = focusableElements[focusableElements.length - 1];

      // Focus the first element when the modal opens
      firstFocusableElement?.focus();

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key !== 'Tab') return;

        // If the modal has no focusable elements, we don't need to do anything.
        if (!firstFocusableElement) {
            e.preventDefault();
            return;
        }

        if (e.shiftKey) { // Shift+Tab
          if (document.activeElement === firstFocusableElement) {
            lastFocusableElement?.focus();
            e.preventDefault();
          }
        } else { // Tab
          if (document.activeElement === lastFocusableElement) {
            firstFocusableElement?.focus();
            e.preventDefault();
          }
        }
      };

      document.addEventListener('keydown', handleKeyDown);
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isOpen, modalRef]);
};
