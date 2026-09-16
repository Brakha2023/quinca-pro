import { useState } from 'react';
import { Outlet, useLocation, NavLink } from 'react-router-dom';
import { 
  HomeIcon, ShoppingCartIcon, CubeIcon, UserIcon, 
  TruckIcon, BanknotesIcon, ChartBarIcon, Bars3Icon, XMarkIcon, UserGroupIcon,
  CubeTransparentIcon, ClipboardDocumentListIcon, LockClosedIcon, CreditCardIcon
} from '@heroicons/react/24/outline';
import FilialeSelector from '../components/FilialeSelector';
import PowerSyncConnectButton from '../components/layout/PowerSyncConnectButton';

interface MenuItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface MenuSection {
  title: string;
  items: MenuItem[];
}

const menuSections: MenuSection[] = [
  {
    title: 'Pilotage',
    items: [
      { name: 'Consolidation', href: '/consolidation', icon: ChartBarIcon },
    ],
  },
  {
    title: 'Exploitation',
    items: [
      { name: 'Point de Vente', href: '/pos', icon: ShoppingCartIcon },
      { name: 'Vente day', href: '/vente-day', icon: CreditCardIcon },
      // { name: 'Articles', href: '/articles', icon: CubeTransparentIcon },
      { name: 'Articles (PowerSync)', href: '/articles-sync', icon: CubeTransparentIcon },
      { name: 'Stock', href: '/stock', icon: CubeIcon },
    ],
  },
  {
    title: 'Tiers & Finances',
    items: [
      { name: 'Clients', href: '/clients', icon: UserIcon },
      { name: 'Fournisseurs', href: '/fournisseurs', icon: UserGroupIcon },
      { name: 'Trésorerie', href: '/tresorerie', icon: BanknotesIcon },
      { name: 'Livraisons', href: '/livraisons', icon: TruckIcon },
    ],
  },
  {
    title: 'Rapports & Sécurité',
    items: [
     
      { name: 'Audit', href: '/audit', icon: LockClosedIcon },
    ],
  },
];

export default function MainLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const location = useLocation();

  const getCurrentPageName = () => {
    for (const section of menuSections) {
      const item = section.items.find(i => i.href === location.pathname);
      if (item) return item.name;
    }
    return 'QuincaPro';
  };

  return (
    <div className="flex h-screen bg-neutral-50">
      {/* Sidebar */}
      <aside 
        className={`bg-primary-900 text-white flex flex-col flex-shrink-0 transition-all duration-300 ease-in-out ${
          isSidebarOpen ? 'w-64' : 'w-20'
        }`}
      >
        {/* Logo */}
        <div className={`border-b border-primary-800 ${isSidebarOpen ? 'p-6' : 'p-4 flex justify-center'}`}>
          {isSidebarOpen ? (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center">
                <span className="text-primary-700 font-bold text-lg">QCF</span>
              </div>
              <div>
                <h1 className="text-lg font-bold tracking-tight">CISSÉ & FRÈRES</h1>
                <p className="text-xs text-primary-300">Quincaillerie - SASU</p>
              </div>
            </div>
          ) : (
            <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center">
              <span className="text-primary-700 font-bold text-lg">QCF</span>
            </div>
          )}
        </div>

        {/* Sélecteur de filiale */}
        {isSidebarOpen && <FilialeSelector />}
        
        {/* Menu */}
        <nav className="flex-1 px-2 py-4 space-y-4 overflow-y-auto">
          {menuSections.map((section) => (
            <div key={section.title}>
              {isSidebarOpen && (
                <p className="text-xs text-primary-400 uppercase tracking-wider px-3 mb-2 font-medium">
                  {section.title}
                </p>
              )}
              <div className="space-y-1">
                {section.items.map((item) => (
                  <NavLink
                    key={item.name}
                    to={item.href}
                    title={!isSidebarOpen ? item.name : ''}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                        isActive 
                          ? 'bg-primary-700 text-white border-l-4 border-orange-400' 
                          : 'text-primary-100 hover:bg-primary-800 hover:text-white'
                      } ${!isSidebarOpen ? 'justify-center' : ''}`
                    }
                  >
                    <item.icon className="w-5 h-5 flex-shrink-0" />
                    {isSidebarOpen && <span>{item.name}</span>}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Profil utilisateur */}
        {isSidebarOpen && (
          <div className="p-4 border-t border-primary-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-orange-500 flex items-center justify-center text-white font-bold text-sm">
                SC
              </div>
              <div>
                <p className="text-sm font-medium text-white">Souleymane Cissé</p>
                <p className="text-xs text-primary-300">Directeur général</p>
              </div>
            </div>
          </div>
        )}
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white border-b border-neutral-200 flex items-center justify-between px-6 flex-shrink-0">
          <div className="flex items-center gap-4">
            {/* Bouton Hamburger */}
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 rounded-lg hover:bg-neutral-100 transition-colors"
              title={isSidebarOpen ? 'Réduire le menu' : 'Agrandir le menu'}
            >
              {isSidebarOpen ? (
                <XMarkIcon className="w-6 h-6 text-neutral-600" />
              ) : (
                <Bars3Icon className="w-6 h-6 text-neutral-600" />
              )}
            </button>
            
            <h2 className="text-lg font-semibold text-neutral-800">
              {getCurrentPageName()}
            </h2>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Sync Status Indicator */}
            <PowerSyncConnectButton />
          </div>
        </header>

        {/* Page Content (Outlet) */}
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
