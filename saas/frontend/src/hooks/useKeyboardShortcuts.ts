import { useEffect, useCallback } from 'react';

interface ShortcutHandlers {
  onSearch?: () => void;
  onUpload?: () => void;
  onSubmit?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onClose?: () => void;
  onSave?: () => void;
  onExport?: () => void;
}

export function useKeyboardShortcuts(handlers: ShortcutHandlers) {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const isInput = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;

    // Ctrl+K: Search
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      handlers.onSearch?.();
      return;
    }

    // Ctrl+U: Upload
    if ((e.ctrlKey || e.metaKey) && e.key === 'u') {
      e.preventDefault();
      handlers.onUpload?.();
      return;
    }

    // Ctrl+Enter: Submit
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handlers.onSubmit?.();
      return;
    }

    // Ctrl+Z: Undo
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'z') {
      e.preventDefault();
      handlers.onUndo?.();
      return;
    }

    // Ctrl+Shift+Z or Ctrl+Y: Redo
    if ((e.ctrlKey || e.metaKey) && (e.shiftKey && e.key === 'z' || e.key === 'y')) {
      e.preventDefault();
      handlers.onRedo?.();
      return;
    }

    // Ctrl+S: Save
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      handlers.onSave?.();
      return;
    }

    // Ctrl+E: Export
    if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
      e.preventDefault();
      handlers.onExport?.();
      return;
    }

    // Escape: Close
    if (e.key === 'Escape') {
      handlers.onClose?.();
      return;
    }

    // Number keys 1-6: Select mode (only when not in input)
    if (!isInput && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const modeMap: Record<string, number> = { '1': 0, '2': 1, '3': 2, '4': 3, '5': 4, '6': 5 };
      if (e.key in modeMap) {
        // Will be handled by the component
      }
    }
  }, [handlers]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

export const SHORTCUTS = [
  { keys: ['Ctrl', 'K'], action: 'Quick search' },
  { keys: ['Ctrl', 'U'], action: 'Upload file' },
  { keys: ['Ctrl', 'Enter'], action: 'Submit transformation' },
  { keys: ['Ctrl', 'Z'], action: 'Undo' },
  { keys: ['Ctrl', 'Shift', 'Z'], action: 'Redo' },
  { keys: ['Ctrl', 'S'], action: 'Save as template' },
  { keys: ['Ctrl', 'E'], action: 'Export result' },
  { keys: ['Esc'], action: 'Close modal' },
  { keys: ['1-6'], action: 'Switch mode' },
];
