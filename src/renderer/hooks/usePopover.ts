import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';

/** Marks every floating panel so nested popovers can recognize each other. */
const FLOATING_ATTR = 'data-floating';

interface PopoverOptions {
  /** Match the trigger width (dropdowns) or size to content (menus). */
  matchWidth?: boolean;
  align?: 'start' | 'end';
  offset?: number;
  maxHeight?: number;
}

interface PopoverState<T extends HTMLElement, P extends HTMLElement> {
  open: boolean;
  setOpen(open: boolean): void;
  toggle(): void;
  /** Callback refs for the trigger and the floating panel. */
  setTrigger(element: T | null): void;
  setPanel(element: P | null): void;
  focusTrigger(): void;
  style: CSSProperties;
}

/**
 * Positions a floating panel (rendered in a portal) next to its trigger,
 * flipping above when there is not enough room below. Closes on outside
 * click, Escape, and window blur.
 */
export function usePopover<T extends HTMLElement, P extends HTMLElement>(options: PopoverOptions = {}): PopoverState<T, P> {
  const { matchWidth = false, align = 'start', offset = 6, maxHeight = 320 } = options;
  const [open, setOpen] = useState(false);
  const [style, setStyle] = useState<CSSProperties>({ position: 'fixed', visibility: 'hidden' });
  const triggerRef = useRef<T | null>(null);
  const panelRef = useRef<P | null>(null);

  const place = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const below = window.innerHeight - rect.bottom - offset - 8;
    const above = rect.top - offset - 8;
    const flip = below < Math.min(maxHeight, 200) && above > below;
    const height = Math.min(maxHeight, flip ? above : below);
    const next: CSSProperties = {
      position: 'fixed',
      maxHeight: height,
      minWidth: matchWidth ? rect.width : undefined,
      width: matchWidth ? rect.width : undefined,
    };
    if (flip) next.bottom = window.innerHeight - rect.top + offset;
    else next.top = rect.bottom + offset;
    // `start`/`end` are logical: in right-to-left layouts `start` is the trigger's right edge.
    const alignRight = (align === 'end') !== (document.documentElement.dir === 'rtl');
    if (alignRight) next.right = Math.max(8, window.innerWidth - rect.right);
    else next.left = Math.min(rect.left, window.innerWidth - (matchWidth ? rect.width : 220) - 8);
    setStyle(next);
  }, [align, matchWidth, maxHeight, offset]);

  useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent): void => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      // Panels render in portals, so a dropdown opened from inside this panel (e.g. the
      // language Select in Preferences) is outside it in the DOM. Closing here would
      // unmount that dropdown before its option receives the click.
      if (target instanceof Element && target.closest(`[${FLOATING_ATTR}]`)) return;
      setOpen(false);
    };
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    const close = (): void => setOpen(false);
    document.addEventListener('pointerdown', onPointer, true);
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    window.addEventListener('blur', close);
    return () => {
      document.removeEventListener('pointerdown', onPointer, true);
      document.removeEventListener('keydown', onKey, true);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('blur', close);
    };
  }, [open, place]);

  const setTrigger = useCallback((element: T | null) => {
    triggerRef.current = element;
  }, []);
  const setPanel = useCallback((element: P | null) => {
    element?.setAttribute(FLOATING_ATTR, '');
    panelRef.current = element;
  }, []);
  const focusTrigger = useCallback(() => triggerRef.current?.focus(), []);
  const toggle = useCallback(() => setOpen((value) => !value), []);

  return { open, setOpen, toggle, setTrigger, setPanel, focusTrigger, style };
}
