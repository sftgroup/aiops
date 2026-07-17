import { useState, useEffect } from 'react';

/**
 * useReducedMotion – detects the user's `prefers-reduced-motion` preference.
 *
 * Returns `true` when the user has requested reduced motion.
 * Use this to conditionally disable CSS animations, transitions, or pulse effects.
 *
 * @returns `boolean` – `true` if the user prefers reduced motion
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  return reduced;
}
