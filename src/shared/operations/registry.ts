import type { AnyOperation, IconName, OperationCategory } from './types';

/**
 * Every file in `./definitions` is discovered automatically, so adding an
 * operation only requires adding one definition file with a default export.
 */
const modules = import.meta.glob<{ default: AnyOperation }>('./definitions/*.ts', { eager: true });

export interface CategoryInfo {
  id: OperationCategory;
  label: string;
  icon: IconName;
}

export const CATEGORIES: readonly CategoryInfo[] = [
  { id: 'convert', label: 'Convert', icon: 'RefreshCw' },
  { id: 'edit', label: 'Edit', icon: 'Scissors' },
  { id: 'audio', label: 'Audio', icon: 'Headphones' },
  { id: 'effects', label: 'Effects', icon: 'Sparkles' },
  { id: 'tools', label: 'Tools', icon: 'Wrench' },
];

const categoryOrder = new Map(CATEGORIES.map((category, index) => [category.id, index]));

export const OPERATIONS: readonly AnyOperation[] = Object.values(modules)
  .map((module) => module.default)
  .sort(
    (a, b) =>
      (categoryOrder.get(a.category) ?? 99) - (categoryOrder.get(b.category) ?? 99) || a.order - b.order || a.label.localeCompare(b.label),
  );

const byId = new Map(OPERATIONS.map((operation) => [operation.id, operation]));

if (byId.size !== OPERATIONS.length) {
  throw new Error('Two operation definitions share the same id. Every operation id must be unique.');
}

export const DEFAULT_OPERATION_ID = 'convert-format';

export function getOperation(id: string): AnyOperation | undefined {
  return byId.get(id);
}

export function operationsByCategory(): { category: CategoryInfo; operations: AnyOperation[] }[] {
  return CATEGORIES.map((category) => ({
    category,
    operations: OPERATIONS.filter((operation) => operation.category === category.id),
  })).filter((group) => group.operations.length > 0);
}
