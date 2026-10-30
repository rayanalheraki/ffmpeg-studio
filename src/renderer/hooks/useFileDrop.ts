import { useEffect, useRef, useState } from 'react';
import type { FileDragEvent } from '@shared/ipc';
import { studio } from '../lib/api';

interface Zone {
  onFiles(paths: string[]): void;
  setActive(active: boolean): void;
}

/**
 * Files dragged in from the OS arrive as window-level events with a position,
 * not as DOM events, so drop zones register here and are hit-tested.
 */
const zones = new Map<Element, Zone>();
let hovered: Zone | null = null;
let listening = false;

/** The innermost registered zone under the pointer. */
function zoneAt(x: number, y: number): Zone | null {
  for (let node = document.elementFromPoint(x, y); node; node = node.parentElement) {
    const zone = zones.get(node);
    if (zone) return zone;
  }
  return null;
}

function onDragEvent(event: FileDragEvent): void {
  const zone = event.type === 'leave' ? null : zoneAt(event.x, event.y);
  if (zone !== hovered) {
    hovered?.setActive(false);
    zone?.setActive(true);
    hovered = zone;
  }
  if (event.type === 'drop') {
    zone?.setActive(false);
    hovered = null;
    if (zone && event.paths.length > 0) zone.onFiles(event.paths);
  }
}

function register(element: Element, zone: Zone): () => void {
  if (!listening) {
    listening = true;
    studio.files.onDragDrop(onDragEvent);
  }
  zones.set(element, zone);
  return () => {
    zones.delete(element);
    if (hovered === zone) hovered = null;
  };
}

/**
 * Makes an element a drop target for files from the OS. Pass `setZone` as the
 * element's `ref`; nested zones take precedence over their parents.
 */
export function useFileDrop(onFiles: (paths: string[]) => void): { active: boolean; setZone: (element: HTMLElement | null) => void } {
  const [active, setActive] = useState(false);
  const [element, setElement] = useState<HTMLElement | null>(null);
  const callback = useRef(onFiles);

  useEffect(() => {
    callback.current = onFiles;
  });

  useEffect(() => {
    if (!element) return undefined;
    return register(element, { onFiles: (paths) => callback.current(paths), setActive });
  }, [element]);

  return { active, setZone: setElement };
}
