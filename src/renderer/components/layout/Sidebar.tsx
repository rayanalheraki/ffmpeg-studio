import { Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { operationsByCategory } from '@shared/operations/registry';
import { Icon } from '../../lib/Icon';
import { cx } from '../../lib/cx';
import { TextInput } from '../ui/TextInput';
import { useI18n } from '../../state/i18n';
import type { AnyOperation } from '@shared/operations/types';
import styles from './Sidebar.module.css';

interface SidebarProps {
  activeId: string;
  collapsed: boolean;
  onSelect(id: string): void;
}

const GROUPS = operationsByCategory();

export function Sidebar({ activeId, collapsed, onSelect }: SidebarProps): React.JSX.Element {
  const [query, setQuery] = useState('');
  const { t, locale } = useI18n();

  const groups = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase(locale);
    if (!needle || collapsed) return GROUPS;
    // English names still match, so tutorials and muscle memory keep working in every language.
    const text = (op: AnyOperation): string => `${t(op.label)} ${t(op.description)} ${op.label}`.toLocaleLowerCase(locale);
    return GROUPS.map((group) => ({
      ...group,
      operations: group.operations.filter((op) => text(op).includes(needle)),
    })).filter((group) => group.operations.length > 0);
  }, [query, collapsed, t, locale]);

  return (
    <nav className={cx(styles.sidebar, collapsed && styles.collapsed)} aria-label={t('Operations')}>
      <div className={styles.search}>
        <TextInput
          value={query}
          onChange={setQuery}
          placeholder={t('Find an operation')}
          aria-label={t('Find an operation')}
          leading={<Search size={14} />}
          onKeyDown={(event) => {
            if (event.key === 'Escape') setQuery('');
            if (event.key === 'Enter' && groups[0]?.operations[0]) onSelect(groups[0].operations[0].id);
          }}
        />
      </div>
      <div className={styles.nav}>
        {groups.map(({ category, operations }) => (
          <div key={category.id} className={styles.group} role="group" aria-label={t(category.label)}>
            <div className={styles.groupLabel}>
              <Icon name={category.icon} size={12} />
              {t(category.label)}
            </div>
            {operations.map((operation) => (
              <button
                key={operation.id}
                type="button"
                className={styles.item}
                aria-current={operation.id === activeId ? 'page' : undefined}
                title={collapsed ? t(operation.label) : t(operation.description)}
                onClick={() => onSelect(operation.id)}
              >
                <Icon name={operation.icon} size={16} className={styles.itemIcon} />
                <span className={styles.itemLabel}>{t(operation.label)}</span>
              </button>
            ))}
          </div>
        ))}
        {groups.length === 0 && <p className={styles.noResults}>{t('No operation matches “{query}”.', { query })}</p>}
      </div>
    </nav>
  );
}
