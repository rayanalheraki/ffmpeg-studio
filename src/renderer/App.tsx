import { useEffect } from 'react';
import { DEFAULT_OPERATION_ID, getOperation } from '@shared/operations/registry';
import { Sidebar } from './components/layout/Sidebar';
import { TitleBar } from './components/layout/TitleBar';
import { Toaster } from './components/layout/Toaster';
import { QueuePanel } from './components/queue/QueuePanel';
import { useHotkeys } from './hooks/useHotkeys';
import { useMediaQuery } from './hooks/useMediaQuery';
import { useTheme } from './hooks/useTheme';
import { InspectPage } from './pages/InspectPage';
import { OperationPage } from './pages/OperationPage';
import { useSettings } from './state/settings';
import styles from './App.module.css';

/** Stops Chromium from navigating to a file dropped outside any drop zone. */
function usePreventFileNavigation(): void {
  useEffect(() => {
    const prevent = (event: DragEvent): void => event.preventDefault();
    window.addEventListener('dragover', prevent);
    window.addEventListener('drop', prevent);
    return () => {
      window.removeEventListener('dragover', prevent);
      window.removeEventListener('drop', prevent);
    };
  }, []);
}

export function App(): React.JSX.Element {
  const { settings, update, loaded } = useSettings();
  useTheme(settings.theme);
  usePreventFileNavigation();
  const narrow = useMediaQuery('(max-width: 1040px)');

  useHotkeys({
    'mod+b': () => update({ sidebarCollapsed: !settings.sidebarCollapsed }),
    'mod+j': () => update({ queueOpen: !settings.queueOpen }),
  });

  const operation = getOperation(settings.lastOperationId) ?? getOperation(DEFAULT_OPERATION_ID);
  if (!operation) throw new Error('No operations are registered.');

  return (
    <div className={styles.app}>
      <TitleBar />
      <div className={styles.body}>
        <Sidebar
          activeId={operation.id}
          collapsed={settings.sidebarCollapsed || narrow}
          onSelect={(id) => update({ lastOperationId: id })}
        />
        <main className={styles.workspace}>
          {loaded &&
            (operation.mode === 'inspect' ? (
              <InspectPage key={operation.id} operation={operation} />
            ) : (
              <OperationPage key={operation.id} operation={operation} />
            ))}
        </main>
        {settings.queueOpen && <QueuePanel />}
      </div>
      <Toaster />
    </div>
  );
}
