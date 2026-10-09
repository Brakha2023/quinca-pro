import { HashRouter, Routes, Route } from 'react-router-dom';
import RequireAuth from './presentation/auth/RequireAuth';
import MainLayout from './presentation/layout/MainLayout';
import DashboardPage from './presentation/pages/Dashboard/DashboardPage';
import POSPage from './presentation/pages/POS/POSPage';
import ClientsPage from './presentation/pages/Clients/ClientsPage';
import FournisseursPage from './presentation/pages/Fournisseurs/FournisseursPage';
import ConsolidationPage from './presentation/pages/Consolidation/ConsolidationPage';
import ArticlesPage from './presentation/pages/Articles/ArticlesPage';
import StockPage from './presentation/pages/Stock/StockPage';
import TresoreriePage from './presentation/pages/Tresorerie/TresoreriePage';
import LivraisonsPage from './presentation/pages/Livraisons/LivraisonsPage';
import AuditPage from './presentation/pages/Audit/AuditPage';
import VentesPage from './presentation/pages/Ventes/VentesPage';
import EmployesPage from './presentation/pages/Employes/EmployesPage';
import LoginPage from './presentation/pages/Auth/LoginPage';

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<RequireAuth />}>
          <Route path="/" element={<MainLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="pos" element={<POSPage />} />
            <Route path="articles" element={<ArticlesPage />} />
            <Route path="stock" element={<StockPage />} />
            <Route path="stock/:onglet" element={<StockPage />} />
            <Route path="clients" element={<ClientsPage />} />
            <Route path="clients/:section" element={<ClientsPage />} />
            <Route path="fournisseurs" element={<FournisseursPage />} />
            <Route path="fournisseurs/:section" element={<FournisseursPage />} />
            <Route path="tresorerie" element={<TresoreriePage />} />
            <Route path="tresorerie/:section" element={<TresoreriePage />} />
            <Route path="livraisons" element={<LivraisonsPage />} />
            <Route path="ventes" element={<VentesPage />} />
            <Route path="employes" element={<EmployesPage />} />
            <Route path="employes/:section" element={<EmployesPage />} />
            <Route path="consolidation" element={<ConsolidationPage />} />
            <Route path="audit" element={<AuditPage />} />
          </Route>
        </Route>
      </Routes>
    </HashRouter>
  );
}

export default App;
