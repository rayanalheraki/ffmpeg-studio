import type { ReactElement, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { usePopover } from '../../hooks/usePopover';
import styles from './Popover.module.css';

interface PopoverProps {
  /** Renders the trigger; attach `ref` (a callback ref) and call `toggle` on click. */
  trigger(props: { ref(element: HTMLButtonElement | null): void; toggle(): void; open: boolean }): ReactElement;
  children: ReactNode | ((close: () => void) => ReactNode);
  align?: 'start' | 'end';
  width?: number;
  label: string;
}

/** A floating panel anchored to a trigger, used for menus and quick settings. */
export function Popover({ trigger, children, align = 'end', width = 280, label }: PopoverProps): React.JSX.Element {
  const { open, setOpen, toggle, setTrigger, setPanel, style } = usePopover<HTMLButtonElement, HTMLDivElement>({ align, maxHeight: 520 });
  const close = (): void => setOpen(false);
  return (
    <>
      {trigger({ ref: setTrigger, toggle, open })}
      {open &&
        createPortal(
          <div ref={setPanel} role="dialog" aria-label={label} className={styles.panel} style={{ ...style, width }}>
            {typeof children === 'function' ? children(close) : children}
          </div>,
          document.body,
        )}
    </>
  );
}
