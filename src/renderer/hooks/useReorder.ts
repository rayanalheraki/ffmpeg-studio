import { useState, type DragEvent } from 'react';
import { REORDER_MIME } from './useFileDrop';

interface DragState {
  from: number;
  over: number;
  position: 'before' | 'after';
}

/**
 * HTML5 drag-to-reorder for a vertical list. Internal drags use a private
 * MIME type so file drop zones ignore them.
 */
export function useReorder(onMove: (from: number, to: number) => void) {
  const [state, setState] = useState<DragState | null>(null);

  const itemProps = (index: number) => ({
    draggable: true,
    dragging: state?.from === index,
    dropPosition: state && state.over === index && state.from !== index ? state.position : null,
    onDragStart: (event: DragEvent) => {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData(REORDER_MIME, String(index));
      setState({ from: index, over: index, position: 'before' });
    },
    onDragOver: (event: DragEvent) => {
      if (!event.dataTransfer.types.includes(REORDER_MIME) || state == null) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
      const position = event.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
      if (state.over !== index || state.position !== position) setState({ ...state, over: index, position });
    },
    onDrop: (event: DragEvent) => {
      if (!event.dataTransfer.types.includes(REORDER_MIME) || state == null) return;
      event.preventDefault();
      const target = state.position === 'after' ? index + 1 : index;
      const to = state.from < target ? target - 1 : target;
      if (to !== state.from) onMove(state.from, to);
      setState(null);
    },
    onDragEnd: () => setState(null),
  });

  return { itemProps };
}
