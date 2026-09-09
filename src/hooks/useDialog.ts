import { useEffect, useRef } from 'react';

/** Foco permanece na janela ativa; Escape fecha e devolve o foco ao acionador. */
export function useDialog(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = requestAnimationFrame(() => ref.current?.focus({ preventScroll: true }));
    const keydown = (event: KeyboardEvent) => {
      const dialog = ref.current;
      if (!dialog || !dialog.contains(document.activeElement)) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        close.current();
      } else if (event.key === 'Tab') {
        const controls = [...dialog.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])')]
          .filter(element => element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden');
        const first = controls[0], last = controls[controls.length - 1];
        if (!first) { event.preventDefault(); dialog.focus(); }
        else if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', keydown, true);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('keydown', keydown, true);
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, [open]);
  return ref;
}
