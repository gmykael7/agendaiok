import type { HTMLAttributes } from 'react';
import { createPortal } from 'react-dom';
import { useDialog } from '../../hooks/useDialog';

type Props = Omit<HTMLAttributes<HTMLDivElement>, 'onClose'> & { label: string; onClose: () => void };

/** Renderização fora da área rolável evita recortes e deslocamentos do modal. */
export function Modal({ label, onClose, className = '', onClick, ...props }: Props) {
  const ref = useDialog(true, onClose);
  return createPortal(<div {...props} ref={ref} role="dialog" aria-modal="true" aria-label={label} tabIndex={-1}
    className={`app-view ${className}`}
    onClick={event => {
      if (event.target === event.currentTarget) onClose();
      onClick?.(event);
    }} />, document.body);
}
