import { X } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useI18n } from '../../state/i18n';
import styles from './Dialog.module.css';

interface DialogProps {
  open: boolean;
  title: string;
  description?: string;
  onClose(): void;
  children: ReactNode;
  footer?: ReactNode;
}

/** Modal dialog: Escape and the backdrop close it, focus returns to the opener. */
export function Dialog({ open, title, description, onClose, children, footer }: DialogProps): React.JSX.Element | null {
  const { t } = useI18n();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);

  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        closeRef.current();
      }
    };
    document.addEventListener('keydown', onKey, true);
    const focusable = panelRef.current?.querySelector<HTMLElement>('input, button, [tabindex]:not([tabindex="-1"])');
    focusable?.focus();
    return () => {
      document.removeEventListener('keydown', onKey, true);
      opener?.focus();
    };
  }, [open]);

  if (!open) return null;
  return createPortal(
    <div className={styles.backdrop} onPointerDown={(event) => event.target === event.currentTarget && onClose()}>
      <div ref={panelRef} className={styles.panel} role="dialog" aria-modal="true" aria-labelledby="dialog-title">
        <header className={styles.header}>
          <div>
            <h2 id="dialog-title" className={styles.title}>
              {title}
            </h2>
            {description && <p className={styles.description}>{description}</p>}
          </div>
          <button type="button" className={styles.close} aria-label={t('Close dialog')} onClick={onClose}>
            <X size={16} />
          </button>
        </header>
        <div className={styles.body}>{children}</div>
        {footer && <footer className={styles.footer}>{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
}
