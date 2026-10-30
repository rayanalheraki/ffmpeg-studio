import { forwardRef, type ButtonHTMLAttributes } from 'react';
import type { IconName } from '@shared/operations/types';
import { Icon } from '../../lib/Icon';
import { cx } from '../../lib/cx';
import styles from './Button.module.css';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  icon?: IconName;
  iconRight?: IconName;
  loading?: boolean;
  /** Keyboard shortcut hint shown inside the button. */
  kbd?: string;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', icon, iconRight, loading = false, kbd, className, children, disabled, type = 'button', ...rest },
  ref,
) {
  const iconSize = size === 'sm' ? 14 : 16;
  return (
    <button
      ref={ref}
      type={type}
      className={cx(styles.button, styles[variant], size !== 'md' && styles[size], loading && styles.loading, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      <span className={styles.label}>
        {icon && <Icon name={icon} size={iconSize} />}
        {children}
        {iconRight && <Icon name={iconRight} size={iconSize} />}
        {kbd && <kbd className={styles.kbd}>{kbd}</kbd>}
      </span>
      {loading && <span className={styles.spinner} aria-hidden="true" />}
    </button>
  );
});

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: IconName;
  /** Accessible label, also shown as a tooltip. */
  label: string;
  size?: 'sm' | 'md';
  active?: boolean;
  tone?: 'default' | 'danger';
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon, label, size = 'sm', active = false, tone = 'default', className, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={cx(
        styles.iconButton,
        size === 'md' && styles.md,
        active && styles.active,
        tone === 'danger' && styles.dangerIcon,
        className,
      )}
      {...rest}
    >
      <Icon name={icon} size={size === 'md' ? 18 : 16} />
    </button>
  );
});
