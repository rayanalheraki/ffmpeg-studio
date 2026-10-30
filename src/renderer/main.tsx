import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { ErrorBoundary } from './components/layout/ErrorBoundary';
import { FilesProvider } from './state/files';
import { I18nProvider } from './state/i18n';
import { JobsProvider } from './state/jobs';
import { SettingsProvider } from './state/settings';
import { ToastProvider } from './state/toasts';
import './styles/global.css';

const container = document.getElementById('root');
if (!container) throw new Error('The #root element is missing from index.html.');

createRoot(container).render(
  <StrictMode>
    <ErrorBoundary>
      <ToastProvider>
        <SettingsProvider>
          <I18nProvider>
            <JobsProvider>
              <FilesProvider>
                <App />
              </FilesProvider>
            </JobsProvider>
          </I18nProvider>
        </SettingsProvider>
      </ToastProvider>
    </ErrorBoundary>
  </StrictMode>,
);
