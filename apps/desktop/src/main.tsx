import React from 'react';
import ReactDOM from 'react-dom/client';
import { PowerSyncContext } from '@powersync/react';
import App from './App';
import { db } from './infrastructure/powersync/database';
import { AuthProvider } from './presentation/auth/AuthProvider';
import { ConfirmationProvider } from './presentation/confirmation/ConfirmationProvider';
import { NotificationsProvider } from './presentation/notifications/NotificationsProvider';
import './index.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <PowerSyncContext.Provider value={db}>
      <NotificationsProvider>
        <ConfirmationProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </ConfirmationProvider>
      </NotificationsProvider>
    </PowerSyncContext.Provider>
  </React.StrictMode>,
);
