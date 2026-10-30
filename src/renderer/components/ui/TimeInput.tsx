import { Clock } from 'lucide-react';
import { parseTime } from '@shared/utils/time';
import { useDraft } from '../../hooks/useDraft';
import { TextInput } from './TextInput';

interface TimeInputProps {
  id?: string;
  value: string;
  onChange(value: string): void;
  placeholder?: string;
}

/** Timestamp field accepting `HH:MM:SS.mmm`, `MM:SS` or seconds; invalid input is highlighted. */
export function TimeInput({ id, value, onChange, placeholder }: TimeInputProps): React.JSX.Element {
  const [draft, setDraft] = useDraft(value, (v) => v);
  const invalid = draft.trim() !== '' && parseTime(draft) == null;

  return (
    <TextInput
      id={id}
      mono
      value={draft}
      placeholder={placeholder ?? '00:00:00'}
      invalid={invalid}
      leading={<Clock size={14} strokeWidth={1.75} />}
      onChange={(next) => {
        setDraft(next);
        if (next.trim() === '' || parseTime(next) != null) onChange(next.trim());
      }}
      onBlur={() => {
        if (invalid) setDraft(value);
      }}
    />
  );
}
