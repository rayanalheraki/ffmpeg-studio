import { useId } from 'react';
import type { Anchor, Dimensions, FieldSchema, OptionValue } from '@shared/operations/types';
import type { MediaFile } from '@shared/types/media';
import { AnchorPicker } from '../ui/AnchorPicker';
import { ColorInput } from '../ui/ColorInput';
import { Field } from '../ui/Field';
import { NumberInput } from '../ui/NumberInput';
import { SegmentedControl } from '../ui/SegmentedControl';
import { Select } from '../ui/Select';
import { Slider } from '../ui/Slider';
import { Switch } from '../ui/Switch';
import { TextInput } from '../ui/TextInput';
import { TimeInput } from '../ui/TimeInput';
import { useI18n, type I18n } from '../../state/i18n';
import { DimensionsControl } from './DimensionsControl';

interface FieldControlProps {
  field: FieldSchema;
  value: OptionValue;
  onChange(value: OptionValue): void;
  /** First primary file, used e.g. to derive the aspect ratio for dimensions. */
  reference: MediaFile | null;
}

function formatNumber(value: number, unit?: string, precision = 0): string {
  const text = precision > 0 ? value.toFixed(precision) : String(Math.round(value));
  if (!unit) return text;
  return unit === '%' || unit === 'x' ? `${text}${unit}` : `${text} ${unit}`;
}

/** Operation definitions are written in English; this returns the field with its texts in the current language. */
function translateField(field: FieldSchema, t: I18n['t']): FieldSchema {
  const translated = { ...field, label: t(field.label), description: field.description && t(field.description) };
  if ('placeholder' in translated && translated.placeholder) translated.placeholder = t(translated.placeholder);
  if ('unit' in translated && translated.unit) translated.unit = t(translated.unit);
  if ('choices' in translated) {
    translated.choices = translated.choices.map((choice) => ({ ...choice, label: t(choice.label), hint: choice.hint && t(choice.hint) }));
  }
  return translated;
}

/** Renders the right custom control for one field of an operation's options schema. */
export function FieldControl({ field: source, value, onChange, reference }: FieldControlProps): React.JSX.Element {
  const id = useId();
  const { t } = useI18n();
  const field = translateField(source, t);

  switch (field.type) {
    case 'toggle':
      return <Switch label={field.label} description={field.description} checked={value === true} onChange={onChange} />;
    case 'select':
      return (
        <Field label={field.label} htmlFor={id} description={field.description}>
          <Select id={id} value={String(value)} choices={field.choices} onChange={onChange} />
        </Field>
      );
    case 'segmented':
      return (
        <Field label={field.label} description={field.description}>
          <SegmentedControl aria-label={field.label} value={String(value)} choices={field.choices} onChange={onChange} />
        </Field>
      );
    case 'slider': {
      const format = (n: number): string => formatNumber(n, field.unit, field.precision);
      return (
        <Field label={field.label} description={field.description} aside={format(Number(value))}>
          <Slider
            aria-label={field.label}
            value={Number(value)}
            min={field.min}
            max={field.max}
            step={field.step}
            format={format}
            onChange={onChange}
          />
        </Field>
      );
    }
    case 'number':
      return (
        <Field label={field.label} htmlFor={id} description={field.description}>
          <NumberInput
            id={id}
            value={Number(value)}
            min={field.min}
            max={field.max}
            step={field.step}
            unit={field.unit}
            onChange={onChange}
          />
        </Field>
      );
    case 'text':
      return (
        <Field label={field.label} htmlFor={id} description={field.description}>
          <TextInput id={id} value={String(value)} placeholder={field.placeholder} maxLength={field.maxLength} onChange={onChange} />
        </Field>
      );
    case 'time':
      return (
        <Field label={field.label} htmlFor={id} description={field.description ?? t('HH:MM:SS, MM:SS or seconds')}>
          <TimeInput id={id} value={String(value)} placeholder={field.placeholder} onChange={onChange} />
        </Field>
      );
    case 'color':
      return (
        <Field label={field.label} htmlFor={id} description={field.description}>
          <ColorInput id={id} value={String(value)} onChange={onChange} />
        </Field>
      );
    case 'anchor':
      return (
        <Field label={field.label} description={field.description}>
          <AnchorPicker value={value as Anchor} onChange={onChange} />
        </Field>
      );
    case 'dimensions':
      return (
        <Field label={field.label} description={field.description}>
          <DimensionsControl value={value as Dimensions} min={field.min} max={field.max} reference={reference} onChange={onChange} />
        </Field>
      );
  }
}
