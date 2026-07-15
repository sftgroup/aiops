import { useEffect, useRef, useCallback } from 'react';

/**
 * useFocusTrap – traps keyboard focus inside a container element.
 *
 * Features:
 * - Focuses the first focusable element on mount
 * - Cycles Tab / Shift+Tab within the trap
 * - Restores focus to the element that held focus before the trap was activated
 * - Cleans up on unmount or when `active` becomes false
 *
 * @param active  – whether the trap is active (e.g. modal is open)
 * @returns       – a ref to attach to the container element
 */
export function useFocusTrap(active: boolean) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // ── Focusable selector ──────────────────────────────
  const FOCUSABLE_SELECTOR = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'textarea:not([disabled])',
    'select:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
    'video[controls]',
  ].join(', ');

  const getFocusableElements = useCallback(() => {
    if (!containerRef.current) return [];
    return Array.from(
      containerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
    );
  }, []);

  // ── Activate / deactivate trap ────────────────────────
  useEffect(() => {
    if (!active) {
      // Restore focus to the trigger element
      if (previousActiveElement.current) {
        previousActiveElement.current.focus();
        previousActiveElement.current = null;
      }
      return;
    }

    // Save the previously focused element
    previousActiveElement.current = document.activeElement as HTMLElement;

    // Focus the first focusable element inside the trap
    const raf = requestAnimationFrame(() => {
      const elements = getFocusableElements();
      if (elements.length > 0) {
        elements[0].focus();
      } else {
        // If no focusable elements exist, focus the container itself so keyboard events work
        containerRef.current?.focus();
      }
    });

    return () => {
      cancelAnimationFrame(raf);
    };
  }, [active, getFocusableElements]);

  // ── Keyboard handler: trap Tab cycling ────────────────
  useEffect(() => {
    if (!active) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      const elements = getFocusableElements();
      if (elements.length === 0) {
        e.preventDefault();
        return;
      }

      const first = elements[0];
      const last = elements[elements.length - 1];

      if (e.shiftKey) {
        // Shift+Tab: if focus is on first element, wrap to last
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        // Tab: if focus is on last element, wrap to first
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [active, getFocusableElements]);

  return containerRef;
}
