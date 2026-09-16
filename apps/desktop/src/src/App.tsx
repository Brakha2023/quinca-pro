import { HashRouter, Routes, Route } from 'react-router-dom';
import MainLayout from './presentation/layout/MainLayout';
import DashboardPage from './presentation/pages/Dashboard/DashboardPage';
import POSPage from './presentation/pages/POS/POSPage';
import HistoriquePage from './presentation/pages/Historique/HistoriquePage';
import ClientsPage from './presentation/pages/Clients/ClientsPage';
import FournisseursPage from './presentation/pages/Fournisseurs/FournisseursPage';
import ConsolidationPage from './presentation/pages/Consolidation/ConsolidationPage';
import ArticlesPage from './presentation/pages/Articles/ArticlesPage';
import ArticlesPowerSyncPage from './presentation/pages/Articles/ArticlesPowerSyncPage';
import StockPage from './presentation/pages/Stock/StockPage';
import TresoreriePage from './presentation/pages/Tresorerie/TresoreriePage';
import LivraisonsPage from './presentation/pages/Livraisons/LivraisonsPage';
import AuditPage from './presentation/pages/Audit/AuditPage';
import VenteDayPage from './presentation/pages/VenteDay/VenteDayPage';
import LoginPage from './presentation/pages/Auth/LoginPage';

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<MainLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="pos" element={<POSPage />} />
          <Route path="articles" element={<ArticlesPage />} />
          <Route path="articles-sync" element={<ArticlesPowerSyncPage />} />
          <Route path="stock" element={<StockPage />} />
          <Route path="clients" element={<ClientsPage />} />
          <Route path="fournisseurs" element={<FournisseursPage />} />
          <Route path="tresorerie" element={<TresoreriePage />} />
          <Route path="livraisons" element={<LivraisonsPage />} />
          <Route path="historique" element={<HistoriquePage />} />
          <Route path="vente-day" element={<VenteDayPage />} />
          <Route path="consolidation" element={<ConsolidationPage />} />
          <Route path="audit" element={<AuditPage />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}

export default App;