import { useCallback, useRef, useState, type DragEvent } from 'react';
import { studio } from '../lib/api';

/** Internal drags (reordering cards) carry this type and are ignored by drop zones. */
export const REORDER_MIME = 'application/x-ffmpeg-studio-reorder';

export function isFileDrag(event: DragEvent): boolean {
  return event.dataTransfer.types.includes('Files') && !event.dataTransfer.types.includes(REORDER_MIME);
}

/** Absolute paths of dropped files, resolved through the preload bridge. */
export function droppedPaths(event: DragEvent): string[] {
  return Array.from(event.dataTransfer.files)
    .map((file) => studio.files.pathForFile(file))
    .filter((path) => path !== '');
}

interface DropHandlers {
  onDragEnter(event: DragEvent): void;
  onDragOver(event: DragEvent): void;
  onDragLeave(event: DragEvent): void;
  onDrop(event: DragEvent): void;
}

/**
 * Drag & drop state for a zone. A depth counter avoids flicker when the
 * pointer crosses child elements.
 */
export function useFileDrop(onFiles: (paths: string[]) => void): { active: boolean; handlers: DropHandlers } {
  const [active, setActive] = useState(false);
  const depth = useRef(0);

  const onDragEnter = useCallback((event: DragEvent) => {
    if (!isFileDrag(event)) return;
    event.preventDefault();
    event.stopPropagation();
    depth.current += 1;
    setActive(true);
  }, []);

  const onDragOver = useCallback((event: DragEvent) => {
    if (!isFileDrag(event)) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'copy';
  }, []);

  const onDragLeave = useCallback((event: DragEvent) => {
    if (!isFileDrag(event)) return;
    event.stopPropagation();
    depth.current = Math.max(0, depth.current - 1);
    if (depth.current === 0) setActive(false);
  }, []);

  const onDrop = useCallback(
    (event: DragEvent) => {
      if (!isFileDrag(event)) return;
      event.preventDefault();
      event.stopPropagation();
      depth.current = 0;
      setActive(false);
      const paths = droppedPaths(event);
      if (paths.length > 0) onFiles(paths);
    },
    [onFiles],
  );

  return { active, handlers: { onDragEnter, onDragOver, onDragLeave, onDrop } };
}
