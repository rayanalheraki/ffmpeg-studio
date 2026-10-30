import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from 'lucide-react';
import { useToasts, type ToastTone } from '../../state/toasts';
import styles from './Toaster.module.css';

const ICONS: Record<ToastTone, React.JSX.Element> = {
  success: <CircleCheck size={16} />,
  error: <CircleAlert size={16} />,
  warning: <TriangleAlert size={16} />,
  info: <Info size={16} />,
};

export function Toaster(): React.JSX.Element {
  const { toasts, dismiss } = useToasts();
  return (
    <div className={styles.region} role="region" aria-label="Notifications" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className={styles.toast} data-tone={toast.tone} role={toast.tone === 'error' ? 'alert' : 'status'}>
          <span className={styles.icon}>{ICONS[toast.tone]}</span>
          <div className={styles.text}>
            <p className={styles.title}>{toast.title}</p>
            {toast.description && <p className={styles.description}>{toast.description}</p>}
          </div>
          <button type="button" className={styles.close} aria-label="Dismiss notification" onClick={() => dismiss(toast.id)}>
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
