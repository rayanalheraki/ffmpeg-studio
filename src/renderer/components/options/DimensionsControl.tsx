import { Link2, Link2Off } from 'lucide-react';
import type { Dimensions } from '@shared/operations/types';
import type { MediaFile } from '@shared/types/media';
import { NumberInput } from '../ui/NumberInput';
import styles from './Options.module.css';

interface DimensionsControlProps {
  value: Dimensions;
  min: number;
  max: number;
  reference: MediaFile | null;
  onChange(value: Dimensions): void;
}

/**
 * Width × height with an aspect-ratio lock. When locked, the height follows
 * the first file's proportions (or the current ratio when no file is loaded).
 */
export function DimensionsControl({ value, min, max, reference, onChange }: DimensionsControlProps): React.JSX.Element {
  const ratio = reference?.width && reference.height ? reference.width / reference.height : value.width / Math.max(1, value.height);
  const even = (n: number): number => Math.max(min, Math.min(max, Math.round(n / 2) * 2));

  const setWidth = (width: number): void => onChange({ ...value, width, height: value.lockAspect ? even(width / ratio) : value.height });
  const setHeight = (height: number): void => onChange({ ...value, height, width: value.lockAspect ? even(height * ratio) : value.width });

  return (
    <div className={styles.dimensions}>
      <NumberInput aria-label="Width" value={value.width} min={min} max={max} step={2} unit="W" onChange={setWidth} />
      <button
        type="button"
        className={styles.lock}
        aria-pressed={value.lockAspect}
        title={value.lockAspect ? 'Aspect ratio locked' : 'Aspect ratio unlocked'}
        aria-label="Lock aspect ratio"
        onClick={() =>
          onChange({ ...value, lockAspect: !value.lockAspect, height: !value.lockAspect ? even(value.width / ratio) : value.height })
        }
      >
        {value.lockAspect ? <Link2 size={15} /> : <Link2Off size={15} />}
      </button>
      <NumberInput aria-label="Height" value={value.height} min={min} max={max} step={2} unit="H" onChange={setHeight} />
    </div>
  );
}
