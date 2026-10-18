import React from 'react';
import ReactDOM from 'react-dom/client';
import { PowerSyncContext } from '@powersync/react';
import App from './App';
import { db } from './infrastructure/powersync/database';
import { surveillerHorlogeServeur } from './infrastructure/supabase/horlogeServeur';
import { AuthProvider } from './presentation/auth/AuthProvider';
import { ConfirmationProvider } from './presentation/confirmation/ConfirmationProvider';
import { NotificationsProvider } from './presentation/notifications/NotificationsProvider';
import './index.css';

// Chaque jeton signé par Supabase dit l'heure du serveur : on en profite pour
// vérifier celle du poste, dont toutes les pièces tirent leur date.
surveillerHorlogeServeur();

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
