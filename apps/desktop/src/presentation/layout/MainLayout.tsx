import { useState } from 'react';
import { Outlet, useLocation, NavLink } from 'react-router-dom';
import {
  ShoppingCartIcon, CubeIcon, UserIcon,
  TruckIcon, BanknotesIcon, ChartBarIcon, Bars3Icon, XMarkIcon, UserGroupIcon,
  CubeTransparentIcon, LockClosedIcon, CreditCardIcon, ArrowRightStartOnRectangleIcon, ChevronDownIcon, UsersIcon
} from '@heroicons/react/24/outline';
import { ONGLETS_STOCK, ONGLET_STOCK_DEFAUT, cheminOngletStock } from '../pages/Stock/onglets';
import { SECTIONS_FOURNISSEURS, SECTION_FOURNISSEURS_DEFAUT, cheminFournisseurs } from '../pages/Fournisseurs/onglets';
import { SECTIONS_CLIENTS, SECTION_CLIENTS_DEFAUT, cheminClients } from '../pages/Clients/onglets';
import { SECTIONS_EMPLOYES, SECTION_EMPLOYES_DEFAUT, cheminEmployes } from '../pages/Employes/onglets';
import { SECTIONS_TRESORERIE, SECTION_TRESORERIE_DEFAUT, cheminTresorerie } from '../pages/Tresorerie/onglets';
import FilialeSelector from '../components/FilialeSelector';
import BandeauHorloge from '../components/layout/BandeauHorloge';
import BandeauSchema from '../components/layout/BandeauSchema';
import SyncStatusBadge from '../components/layout/SyncStatusBadge';
import { useAuth } from '../auth/useAuth';
import { useCurrentUtilisateur } from '../auth/useCurrentUtilisateur';
import { useConfirmation } from '../confirmation/useConfirmation';

const PROFIL_LABELS: Record<string, string> = {
  DIRECTEUR: 'Directeur général',
  GERANT: 'Gérant de filiale',
  CAISSIER: 'Caissier',
  MAGASINIER: 'Magasinier',
};

function initiales(nom: string, prenom: string | null): string {
  return `${prenom?.[0] ?? ''}${nom[0] ?? ''}`.toUpperCase() || '?';
}

interface MenuItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Sous-menu : `href` du parent est la première section ; le parent est actif sur tout son préfixe. */
  children?: Array<{ name: string; href: string; icon: React.ComponentType<{ className?: string }> }>;
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
      { name: 'Ventes', href: '/ventes', icon: CreditCardIcon },
      { name: 'Catalogue', href: '/articles', icon: CubeTransparentIcon },
      {
        name: 'Stock',
        href: cheminOngletStock(ONGLET_STOCK_DEFAUT),
        icon: CubeIcon,
        children: ONGLETS_STOCK.map((o) => ({ name: o.label, href: cheminOngletStock(o.id), icon: o.icon })),
      },
    ],
  },
  {
    title: 'Tiers & Finances',
    items: [
      {
        name: 'Clients',
        href: cheminClients(SECTION_CLIENTS_DEFAUT),
        icon: UserIcon,
        children: SECTIONS_CLIENTS.map((s) => ({ name: s.label, href: cheminClients(s.id), icon: s.icon })),
      },
      {
        name: 'Fournisseurs',
        href: cheminFournisseurs(SECTION_FOURNISSEURS_DEFAUT),
        icon: UserGroupIcon,
        children: SECTIONS_FOURNISSEURS.map((s) => ({ name: s.label, href: cheminFournisseurs(s.id), icon: s.icon })),
      },
      {
        name: 'Trésorerie',
        href: cheminTresorerie(SECTION_TRESORERIE_DEFAUT),
        icon: BanknotesIcon,
        children: SECTIONS_TRESORERIE.map((s) => ({ name: s.label, href: cheminTresorerie(s.id), icon: s.icon })),
      },
      { name: 'Livraisons', href: '/livraisons', icon: TruckIcon },
    ],
  },
  {
    title: 'Ressources humaines',
    items: [
      {
        name: 'Employés',
        href: cheminEmployes(SECTION_EMPLOYES_DEFAUT),
        icon: UsersIcon,
        children: SECTIONS_EMPLOYES.map((s) => ({ name: s.label, href: cheminEmployes(s.id), icon: s.icon })),
      },
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
  const [deplies, setDeplies] = useState<Set<string>>(new Set());
  const location = useLocation();
  const { session, logout } = useAuth();
  const confirmer = useConfirmation();
  const { utilisateur } = useCurrentUtilisateur();

  const handleLogout = async () => {
    const ok = await confirmer({
      titre: 'Verrouiller le poste',
      message: 'La session sera verrouillée : le mot de passe sera demandé pour reprendre. Les opérations non encore envoyées restent sur le poste et partiront automatiquement dès que le réseau sera disponible.',
      libelleConfirmer: 'Verrouiller',
    });
    if (ok) await logout();
  };

  const getCurrentPageName = () => {
    for (const section of menuSections) {
      for (const item of section.items) {
        const enfant = item.children?.find((c) => c.href === location.pathname);
        if (enfant) return `${item.name} · ${enfant.name}`;
        if (item.href === location.pathname) return item.name;
      }
    }
    return 'QuincaPro';
  };

  /** Un parent à sous-menu est actif sur tout le préfixe de ses enfants (ex. `/stock/…`). */
  const estParentActif = (item: MenuItem) => Boolean(item.children && location.pathname.startsWith(item.href.split('/').slice(0, 2).join('/')));

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
                {section.items.map((item) => {
                  const parentActif = estParentActif(item);
                  const actif = parentActif || location.pathname === item.href;
                  const deplie = Boolean(item.children) && isSidebarOpen && (parentActif || deplies.has(item.name));
                  const basculer = () => setDeplies((d) => { const n = new Set(d); if (deplie) n.delete(item.name); else n.add(item.name); return n; });
                  return (
                    <div key={item.name}>
                      <div
                        className={`flex items-center rounded-lg transition-colors ${
                          actif ? 'bg-primary-700 text-white border-l-4 border-orange-400' : 'text-primary-100 hover:bg-primary-800 hover:text-white'
                        }`}
                      >
                        <NavLink
                          to={item.href}
                          title={!isSidebarOpen ? item.name : ''}
                          onClick={() => item.children && setDeplies((d) => new Set(d).add(item.name))}
                          className={`flex-1 flex items-center gap-3 px-3 py-2.5 text-sm font-medium ${!isSidebarOpen ? 'justify-center' : ''}`}
                        >
                          <item.icon className="w-5 h-5 flex-shrink-0" />
                          {isSidebarOpen && <span>{item.name}</span>}
                        </NavLink>
                        {isSidebarOpen && item.children && (
                          <button type="button" aria-label={deplie ? `Replier ${item.name}` : `Déplier ${item.name}`} onClick={basculer} className="p-1.5 mr-1.5 rounded hover:bg-primary-600">
                            <ChevronDownIcon className={`w-4 h-4 transition-transform ${deplie ? 'rotate-180' : ''}`} />
                          </button>
                        )}
                      </div>
                      {deplie && (
                        <div className="mt-1 ml-4 pl-3 border-l border-primary-700 space-y-0.5" data-testid={`sous-menu-${item.name.toLowerCase()}`}>
                          {item.children!.map((c) => (
                            <NavLink
                              key={c.href}
                              to={c.href}
                              className={({ isActive }) =>
                                `flex items-center gap-2 px-2 py-1.5 text-sm rounded-md transition-colors ${
                                  isActive ? 'text-white font-medium bg-primary-800' : 'text-primary-200 hover:bg-primary-800 hover:text-white'
                                }`
                              }
                            >
                              <c.icon className="w-4 h-4 flex-shrink-0" />
                              <span>{c.name}</span>
                            </NavLink>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Profil utilisateur */}
        <div className={`border-t border-primary-800 ${isSidebarOpen ? 'p-4' : 'p-2'}`}>
          <div className={`flex items-center gap-3 ${!isSidebarOpen ? 'justify-center' : ''}`}>
            <div className="w-10 h-10 rounded-lg bg-orange-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
              {utilisateur ? initiales(utilisateur.nom, utilisateur.prenom) : '…'}
            </div>
            {isSidebarOpen && (
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-white truncate">
                  {utilisateur ? `${utilisateur.prenom ?? ''} ${utilisateur.nom}`.trim() : session?.user.email}
                </p>
                <p className="text-xs text-primary-300">
                  {utilisateur ? PROFIL_LABELS[utilisateur.profil] ?? utilisateur.profil : 'Profil en cours de synchronisation'}
                </p>
              </div>
            )}
            <button
              onClick={handleLogout}
              title="Verrouiller le poste"
              className="p-2 rounded-lg text-primary-300 hover:bg-primary-800 hover:text-white transition-colors"
            >
              <ArrowRightStartOnRectangleIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
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
            <SyncStatusBadge />
          </div>
        </header>

        <BandeauSchema />
        <BandeauHorloge />

        {/* Page Content (Outlet) */}
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
