import { icons, type LucideProps } from 'lucide-react';
import type { IconName } from '@shared/operations/types';

interface IconProps extends Omit<LucideProps, 'ref'> {
  name: IconName;
}

/**
 * Renders a lucide icon by name, so operation definitions in `src/shared`
 * can reference icons without importing React.
 */
export function Icon({ name, size = 16, strokeWidth = 1.75, ...rest }: IconProps): React.JSX.Element {
  const Component = icons[name];
  return <Component size={size} strokeWidth={strokeWidth} aria-hidden="true" {...rest} />;
}
