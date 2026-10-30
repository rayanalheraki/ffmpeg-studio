import type { CSSProperties } from 'react';
import styles from './Slider.module.css';

interface SliderProps {
  id?: string;
  value: number;
  onChange(value: number): void;
  min: number;
  max: number;
  step: number;
  disabled?: boolean;
  /** Shows the min and max labels under the track. */
  showScale?: boolean;
  format?: (value: number) => string;
  'aria-label'?: string;
}

/** Range input restyled from scratch: accent-filled track and a soft floating thumb. */
export function Slider({
  id,
  value,
  onChange,
  min,
  max,
  step,
  disabled,
  showScale = true,
  format = String,
  ...rest
}: SliderProps): React.JSX.Element {
  const fill = max === min ? 0 : ((value - min) / (max - min)) * 100;
  return (
    <div>
      <input
        id={id}
        type="range"
        className={styles.slider}
        style={{ '--fill': `${fill}%` } as CSSProperties}
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        aria-label={rest['aria-label']}
        aria-valuetext={format(value)}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      {showScale && (
        <div className={styles.scale} aria-hidden="true">
          <span>{format(min)}</span>
          <span>{format(max)}</span>
        </div>
      )}
    </div>
  );
}
