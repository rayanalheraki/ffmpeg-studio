import { Check, ChevronDown } from 'lucide-react';
import { useId, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import type { Choice } from '@shared/operations/types';
import { usePopover } from '../../hooks/usePopover';
import styles from './Select.module.css';

interface SelectProps {
  id?: string;
  value: string;
  choices: Choice[];
  onChange(value: string): void;
  placeholder?: string;
  'aria-label'?: string;
}

/** Fully custom listbox dropdown with keyboard navigation and type-to-select. */
export function Select({ id, value, choices, onChange, placeholder = 'Select…', ...rest }: SelectProps): React.JSX.Element {
  const listId = useId();
  const { open, setOpen, setTrigger, setPanel, focusTrigger, style } = usePopover<HTMLButtonElement, HTMLDivElement>({ matchWidth: true });
  const selectedIndex = choices.findIndex((choice) => choice.value === value);
  const [active, setActive] = useState(selectedIndex);
  const selected = choices[selectedIndex];

  const openAt = (index: number): void => {
    setActive(index < 0 ? 0 : index);
    setOpen(true);
  };

  const choose = (index: number): void => {
    const choice = choices[index];
    if (choice) onChange(choice.value);
    setOpen(false);
    focusTrigger();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>): void => {
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
        event.preventDefault();
        openAt(selectedIndex);
      }
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const delta = event.key === 'ArrowDown' ? 1 : -1;
      setActive((current) => (current + delta + choices.length) % choices.length);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      choose(active);
    } else if (event.key === 'Tab') {
      setOpen(false);
    } else if (event.key.length === 1) {
      const match = choices.findIndex((choice) => choice.label.toLowerCase().startsWith(event.key.toLowerCase()));
      if (match >= 0) setActive(match);
    }
  };

  return (
    <>
      <button
        id={id}
        ref={setTrigger}
        type="button"
        className={styles.trigger}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={rest['aria-label']}
        aria-activedescendant={open ? `${listId}-${active}` : undefined}
        onClick={() => (open ? setOpen(false) : openAt(selectedIndex))}
        onKeyDown={onKeyDown}
      >
        <span className={styles.value}>{selected?.label ?? placeholder}</span>
        <ChevronDown size={15} className={styles.chevron} aria-hidden="true" />
      </button>
      {open &&
        createPortal(
          <div ref={setPanel} id={listId} role="listbox" className={styles.panel} style={style}>
            {choices.map((choice, index) => (
              <div
                key={choice.value}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={choice.value === value}
                data-active={index === active}
                className={styles.option}
                onPointerEnter={() => setActive(index)}
                onPointerDown={(event) => event.preventDefault()}
                onClick={() => choose(index)}
              >
                {choice.value === value ? <Check size={14} className={styles.check} /> : <span className={styles.checkPlaceholder} />}
                <span className={styles.optionText}>
                  <span>{choice.label}</span>
                  {choice.hint && <span className={styles.optionHint}>{choice.hint}</span>}
                </span>
              </div>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}
