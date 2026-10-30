import { useState } from 'react';

/**
 * Local text state for inputs that commit later (on blur or when valid),
 * reset whenever the committed value changes from outside.
 */
export function useDraft<T>(value: T, toDraft: (value: T) => string): [string, (draft: string) => void] {
  const [draft, setDraft] = useState(() => toDraft(value));
  const [source, setSource] = useState(value);
  if (!Object.is(source, value)) {
    setSource(value);
    setDraft(toDraft(value));
  }
  return [draft, setDraft];
}
