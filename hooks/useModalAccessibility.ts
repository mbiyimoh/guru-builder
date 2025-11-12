import { useEffect, useRef } from 'react';

/**
 * Modal Accessibility Hook
 *
 * Provides comprehensive accessibility features for modal dialogs:
 * - Focus management (trap and restore)
 * - Escape key handling
 * - ARIA attributes guidance
 *
 * Follows WCAG 2.1 Level AA guidelines for modal accessibility.
 *
 * @param options - Configuration options
 * @param options.onClose - Function to call when modal should close
 * @param options.isOpen - Whether the modal is currently open
 *
 * @returns Object containing:
 * - modalRef: Ref to attach to modal container
 * - handleKeyDown: KeyDown handler for focus trapping
 *
 * @example
 * ```tsx
 * function MyModal({ onClose }: { onClose: () => void }) {
 *   const { modalRef, handleKeyDown } = useModalAccessibility({
 *     onClose,
 *     isOpen: true
 *   });
 *
 *   return (
 *     <div
 *       className="fixed inset-0 bg-gray-500 bg-opacity-75"
 *       onClick={onClose}
 *       role="dialog"
 *       aria-modal="true"
 *       aria-labelledby="modal-title"
 *     >
 *       <div
 *         ref={modalRef}
 *         onKeyDown={handleKeyDown}
 *         tabIndex={-1}
 *       >
 *         <h2 id="modal-title">Modal Title</h2>
 *         // ... modal content
 *       </div>
 *     </div>
 *   );
 * }
 * ```
 */
export interface UseModalAccessibilityOptions {
  onClose: () => void;
  isOpen: boolean;
}

export function useModalAccessibility({ onClose, isOpen }: UseModalAccessibilityOptions) {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // Store previous focus and set initial focus
  useEffect(() => {
    if (!isOpen) return;

    previousActiveElement.current = document.activeElement as HTMLElement;
    modalRef.current?.focus();

    return () => {
      // Restore focus when closed
      previousActiveElement.current?.focus();
    };
  }, [isOpen]);

  // Handle Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose, isOpen]);

  // Trap focus within modal
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'Tab') return;

    const focusableElements = modalRef.current?.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    if (!focusableElements || focusableElements.length === 0) return;

    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

    if (e.shiftKey) {
      // Shift+Tab - if on first element, go to last
      if (document.activeElement === firstElement) {
        lastElement.focus();
        e.preventDefault();
      }
    } else {
      // Tab - if on last element, go to first
      if (document.activeElement === lastElement) {
        firstElement.focus();
        e.preventDefault();
      }
    }
  };

  return { modalRef, handleKeyDown };
}
