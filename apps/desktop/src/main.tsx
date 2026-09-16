import React from 'react';
import ReactDOM from 'react-dom/client';
import { PowerSyncContext } from '@powersync/react';
import App from './App';
import { db } from './infrastructure/powersync/database';
import { AuthProvider } from './presentation/auth/AuthProvider';
import './index.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <PowerSyncContext.Provider value={db}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </PowerSyncContext.Provider>
  </React.StrictMode>,
);
