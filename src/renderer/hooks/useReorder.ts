import { useRef, useState, type PointerEvent } from 'react';

interface DragState {
  from: number;
  over: number;
  position: 'before' | 'after';
}

/** Pixels the pointer must travel before a press becomes a drag, so clicks still work. */
const DRAG_THRESHOLD = 5;
const INTERACTIVE = 'button, a, input, select, textarea';

/**
 * Pointer-driven drag-to-reorder for a vertical list. HTML5 drag & drop is not
 * used because the webview reserves it for files dragged in from the OS.
 */
export function useReorder(onMove: (from: number, to: number) => void) {
  const [state, setState] = useState<DragState | null>(null);
  const press = useRef<{ index: number; x: number; y: number } | null>(null);

  const reset = (): void => {
    press.current = null;
    setState(null);
  };

  const itemProps = (index: number) => ({
    index,
    dragging: state?.from === index,
    dropPosition: state && state.over === index && state.from !== index ? state.position : null,
    onPointerDown: (event: PointerEvent<HTMLElement>) => {
      if (event.button !== 0 || (event.target as HTMLElement).closest(INTERACTIVE)) return;
      press.current = { index, x: event.clientX, y: event.clientY };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    onPointerMove: (event: PointerEvent<HTMLElement>) => {
      const start = press.current;
      if (!start) return;
      if (state == null && Math.hypot(event.clientX - start.x, event.clientY - start.y) < DRAG_THRESHOLD) return;
      const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-reorder-index]');
      if (!target || target.parentElement !== event.currentTarget.parentElement) {
        if (state == null) setState({ from: start.index, over: start.index, position: 'before' });
        return;
      }
      const over = Number(target.dataset.reorderIndex);
      const rect = target.getBoundingClientRect();
      const position = event.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
      if (state?.over !== over || state.position !== position) setState({ from: start.index, over, position });
    },
    onPointerUp: () => {
      if (state) {
        const target = state.position === 'after' ? state.over + 1 : state.over;
        const to = state.from < target ? target - 1 : target;
        if (to !== state.from) onMove(state.from, to);
      }
      reset();
    },
    onPointerCancel: reset,
  });

  return { itemProps };
}
