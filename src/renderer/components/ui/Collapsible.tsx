import { ChevronRight } from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';
import type { IconName } from '@shared/operations/types';
import { Icon } from '../../lib/Icon';
import styles from './Collapsible.module.css';

interface CollapsibleProps {
  title: string;
  icon?: IconName;
  /** Short summary shown on the right while collapsed. */
  summary?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}

/** A disclosure section with an animated height transition. */
export function Collapsible({ title, icon, summary, defaultOpen = false, children }: CollapsibleProps): React.JSX.Element {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <section className={styles.section} data-open={open}>
      <button type="button" className={styles.header} aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>
        <ChevronRight size={14} className={styles.chevron} aria-hidden="true" />
        {icon && <Icon name={icon} size={15} className={styles.icon} />}
        <span className={styles.title}>{title}</span>
        {summary != null && <span className={styles.summary}>{summary}</span>}
      </button>
      <div id={id} className={styles.body} role="region" aria-hidden={!open}>
        <div className={styles.inner}>
          <div className={styles.content}>{children}</div>
        </div>
      </div>
    </section>
  );
}
