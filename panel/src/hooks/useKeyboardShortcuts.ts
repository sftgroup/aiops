import { useEffect, useRef } from 'react';

/**
 * A stable ref-backed keyboard shortcut hook.
 *
 * Unlike a raw `useEffect` with an inline deps array, this uses refs so the
 * effect does not need to re-attach on every render.  Callers pass a plain
 * object where each key is a lower-cased `KeyboardEvent.key` value.
 *
 * Input fields (`INPUT`, `TEXTAREA`, `SELECT`, `[contenteditable]`) are
 * automatically skipped so shortcuts do not fire while the user is typing.
 */
export function useKeyboardShortcuts(
  shortcuts: Record<string, (e: KeyboardEvent) => void>,
  enabled = true,
) {
  const shortcutsRef = useRef(shortcuts);
  shortcutsRef.current = shortcuts;

  useEffect(() => {
    if (!enabled) return;

    const handler = (e: KeyboardEvent) => {
      // Ignore events inside input-like elements
      const target = e.target as HTMLElement;
      const tag = target.tagName.toLowerCase();
      if (
        tag === 'input' ||
        tag === 'textarea' ||
        tag === 'select' ||
        target.isContentEditable
      ) {
        return;
      }

      const map = shortcutsRef.current;

      // Try exact key match first (e.g. "space", "f", "m")
      const key = e.key.toLowerCase();
      if (map[key]) {
        e.preventDefault();
        e.stopPropagation();
        map[key](e);
        return;
      }

      // Try modifier combos (e.g. "ctrl+k", "cmd+k")
      const modKey = [
        e.ctrlKey ? 'ctrl' : null,
        e.metaKey ? 'cmd' : null,
        key,
      ]
        .filter(Boolean)
        .join('+');
      if (modKey !== key && map[modKey]) {
        e.preventDefault();
        e.stopPropagation();
        map[modKey](e);
        return;
      }

      // Map physical key for Shift+/ => "?" on US keyboards
      // When Shift is held, e.key is "?" not "/"
      if (key === '?' && map['shift+/']) {
        e.preventDefault();
        e.stopPropagation();
        map['shift+/'](e);
      }
    };

    window.addEventListener('keydown', handler, { capture: false });
    return () => window.removeEventListener('keydown', handler, { capture: false });
  }, [enabled]);
}
