import type { CSSProperties, ReactNode } from 'react';
import type { IconName } from '@shared/operations/types';
import { Icon } from '../../lib/Icon';
import { cx } from '../../lib/cx';
import styles from './Feedback.module.css';

interface ProgressBarProps {
  /** 0–100, or null for an indeterminate bar. */
  value: number | null;
  tone?: 'accent' | 'success' | 'danger' | 'muted';
  label?: string;
}

export function ProgressBar({ value, tone = 'accent', label }: ProgressBarProps): React.JSX.Element {
  return (
    <div
      className={cx(styles.progress, tone !== 'accent' && styles[tone], value == null && styles.indeterminate)}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value == null ? undefined : Math.round(value)}
    >
      <div className={styles.progressFill} style={{ width: `${value ?? 0}%` }} />
    </div>
  );
}

export function Skeleton({
  width,
  height,
  radius,
  className,
}: {
  width?: number | string;
  height?: number | string;
  radius?: number;
  className?: string;
}): React.JSX.Element {
  const style: CSSProperties = { width, height, borderRadius: radius };
  return <div className={cx(styles.skeleton, className)} style={style} aria-hidden="true" />;
}

interface BadgeProps {
  tone?: 'neutral' | 'accent' | 'success' | 'warning' | 'danger';
  icon?: IconName;
  children: ReactNode;
  title?: string;
}

export function Badge({ tone = 'neutral', icon, children, title }: BadgeProps): React.JSX.Element {
  return (
    <span className={cx(styles.badge, tone !== 'neutral' && styles[tone])} title={title}>
      {icon && <Icon name={icon} size={11} strokeWidth={2.25} />}
      {children}
    </span>
  );
}

interface EmptyStateProps {
  icon: IconName;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}

export function EmptyState({ icon, title, children, action }: EmptyStateProps): React.JSX.Element {
  return (
    <div className={styles.empty}>
      <div className={styles.emptyIcon}>
        <Icon name={icon} size={20} />
      </div>
      <p className={styles.emptyTitle}>{title}</p>
      {children && <p className={styles.emptyText}>{children}</p>}
      {action}
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }): React.JSX.Element {
  return <kbd className={styles.kbd}>{children}</kbd>;
}
