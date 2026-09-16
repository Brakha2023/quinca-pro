import { useState } from 'react';
import { PlusIcon, TruckIcon, CheckCircleIcon, ClockIcon, XCircleIcon, XMarkIcon } from '@heroicons/react/24/outline';

type StatutLivraison = 'A_PREPARER' | 'EN_COURS' | 'LIVREE' | 'ANNULEE';

interface Livraison {
  id: string;
  numero: string;
  date: string;
  client: string;
  adresse: string;
  chauffeur: string;
  montant: number;
  articles: number;
  statut: StatutLivraison;
}

const LIVRAISONS_MOCK: Livraison[] = [
  { id: '1', numero: 'LIV-2026-0089', date: '2026-08-27 09:00', client: 'SARL Bâtiment Plus', adresse: 'Zone industrielle, Abidjan', chauffeur: 'M. Koné', montant: 425000, articles: 8, statut: 'EN_COURS' },
  { id: '2', numero: 'LIV-2026-0088', date: '2026-08-27 08:30', client: 'M. Koné Construction', adresse: 'Cocody, Abidjan', chauffeur: 'M. Traoré', montant: 187500, articles: 5, statut: 'LIVREE' },
  { id: '3', numero: 'LIV-2026-0087', date: '2026-08-26 14:00', client: 'Entreprise Diabaté', adresse: 'Yopougon, Abidjan', chauffeur: 'M. Diabaté', montant: 680000, articles: 12, statut: 'LIVREE' },
  { id: '4', numero: 'LIV-2026-0086', date: '2026-08-26 10:00', client: 'Client Comptoir', adresse: 'Adjamé, Abidjan', chauffeur: 'M. Koné', montant: 95000, articles: 3, statut: 'ANNULEE' },
  { id: '5', numero: 'LIV-2026-0085', date: '2026-08-27 11:00', client: 'SARL Bâtiment Plus', adresse: 'Zone industrielle, Abidjan', chauffeur: 'M. Traoré', montant: 320000, articles: 6, statut: 'A_PREPARER' },
];

const CHAUFFEURS = ['M. Koné', 'M. Traoré', 'M. Diabaté'];

export default function LivraisonsPage() {
  const [livraisons, setLivraisons] = useState<Livraison[]>(LIVRAISONS_MOCK);
  const [filtreStatut, setFiltreStatut] = useState<string>('Tous');
  const [showForm, setShowForm] = useState(false);
  const [showStatutModal, setShowStatutModal] = useState(false);
  const [livraisonSelectionnee, setLivraisonSelectionnee] = useState<string | null>(null);
  const [nouvelleLivraison, setNouvelleLivraison] = useState({
    client: '', adresse: '', chauffeur: CHAUFFEURS[0],
    montant: 0, articles: 0, date: '',
  });

  const livraisonsFiltrees = filtreStatut === 'Tous' ? livraisons : livraisons.filter(l => l.statut === filtreStatut);

  const stats = {
    total: livraisons.length,
    aPreparer: livraisons.filter(l => l.statut === 'A_PREPARER').length,
    enCours: livraisons.filter(l => l.statut === 'EN_COURS').length,
    livrees: livraisons.filter(l => l.statut === 'LIVREE').length,
    valeurTransit: livraisons.filter(l => l.statut === 'EN_COURS').reduce((s, l) => s + l.montant, 0),
  };

  const getStatutConfig = (statut: StatutLivraison) => {
    const configs = {
      A_PREPARER: { label: 'À préparer', color: 'bg-gray-100 text-gray-700', icon: ClockIcon },
      EN_COURS: { label: 'En cours', color: 'bg-blue-100 text-blue-700', icon: TruckIcon },
      LIVREE: { label: 'Livrée', color: 'bg-green-100 text-green-700', icon: CheckCircleIcon },
      ANNULEE: { label: 'Annulée', color: 'bg-red-100 text-red-700', icon: XCircleIcon },
    };
    return configs[statut];
  };

  const handleNouvelleLivraison = () => {
    if (nouvelleLivraison.client && nouvelleLivraison.adresse) {
      const newLivraison: Livraison = {
        id: Date.now().toString(),
        numero: `LIV-2026-${String(livraisons.length + 1).padStart(4, '0')}`,
        date: `${nouvelleLivraison.date || new Date().toISOString().split('T')[0]} 09:00`,
        client: nouvelleLivraison.client,
        adresse: nouvelleLivraison.adresse,
        chauffeur: nouvelleLivraison.chauffeur,
        montant: nouvelleLivraison.montant,
        articles: nouvelleLivraison.articles,
        statut: 'A_PREPARER',
      };
      setLivraisons([newLivraison, ...livraisons]);
      setShowForm(false);
      setNouvelleLivraison({
        client: '', adresse: '', chauffeur: CHAUFFEURS[0],
        montant: 0, articles: 0, date: '',
      });
      alert('✅ Livraison créée avec succès !');
    }
  };

  const handleUpdateStatut = (statut: StatutLivraison) => {
    if (livraisonSelectionnee) {
      setLivraisons(livraisons.map(l => 
        l.id === livraisonSelectionnee ? { ...l, statut } : l
      ));
      setShowStatutModal(false);
      setLivraisonSelectionnee(null);
      alert(`✅ Statut mis à jour : ${getStatutConfig(statut).label}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Livraisons</h1>
          <p className="text-sm text-neutral-500 mt-1">Suivi des bons de livraison</p>
        </div>
        <button 
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg"
        >
          <PlusIcon className="w-5 h-5" />
          Nouvelle livraison
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-xl border border-neutral-200 shadow-sm">
          <p className="text-sm text-neutral-500">Total livraisons</p>
          <p className="text-2xl font-bold text-neutral-900 mt-2">{stats.total}</p>
        </div>
        <div className="bg-white p-6 rounded-xl border-l-4 border-l-blue-500 shadow-sm">
          <p className="text-sm text-neutral-500">En cours</p>
          <p className="text-2xl font-bold text-blue-600 mt-2">{stats.enCours}</p>
        </div>
        <div className="bg-white p-6 rounded-xl border-l-4 border-l-green-500 shadow-sm">
          <p className="text-sm text-neutral-500">Livrées</p>
          <p className="text-2xl font-bold text-green-600 mt-2">{stats.livrees}</p>
        </div>
        <div className="bg-white p-6 rounded-xl border-l-4 border-l-orange-500 shadow-sm">
          <p className="text-sm text-neutral-500">Valeur en transit</p>
          <p className="text-2xl font-bold text-orange-600 font-mono mt-2">{stats.valeurTransit.toLocaleString('fr-FR')} F</p>
        </div>
      </div>

      {/* Filtres */}
      <div className="flex gap-2">
        {['Tous', 'A_PREPARER', 'EN_COURS', 'LIVREE', 'ANNULEE'].map(s => (
          <button
            key={s}
            onClick={() => setFiltreStatut(s)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filtreStatut === s ? 'bg-primary-600 text-white' : 'bg-white text-neutral-700 border border-neutral-200 hover:bg-neutral-50'
            }`}
          >
            {s === 'Tous' ? 'Toutes' : getStatutConfig(s as StatutLivraison).label}
          </button>
        ))}
      </div>

      {/* Liste */}
      <div className="space-y-3">
        {livraisonsFiltrees.map((livraison) => {
          const config = getStatutConfig(livraison.statut);
          return (
            <div key={livraison.id} className="bg-white rounded-xl border border-neutral-200 shadow-sm p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="font-mono font-bold text-primary-700">{livraison.numero}</span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
                      {config.label}
                    </span>
                  </div>
                  <h3 className="font-semibold text-neutral-900">{livraison.client}</h3>
                  <p className="text-sm text-neutral-600 mt-1">📍 {livraison.adresse}</p>
                  <div className="flex items-center gap-4 mt-3 text-sm text-neutral-500">
                    <span> {livraison.chauffeur}</span>
                    <span>📦 {livraison.articles} articles</span>
                    <span>🕐 {livraison.date}</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-neutral-500">Montant</p>
                  <p className="text-xl font-bold font-mono text-neutral-900">
                    {livraison.montant.toLocaleString('fr-FR')} F
                  </p>
                  <button
                    onClick={() => {
                      setLivraisonSelectionnee(livraison.id);
                      setShowStatutModal(true);
                    }}
                    className="mt-2 text-xs text-primary-600 hover:text-primary-700 font-medium"
                  >
                    Changer statut →
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal Nouvelle Livraison */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Nouvelle livraison</h3>
              <button onClick={() => setShowForm(false)} className="p-2 hover:bg-neutral-100 rounded-lg">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">Client *</label>
                <input type="text" value={nouvelleLivraison.client}
                  onChange={(e) => setNouvelleLivraison({...nouvelleLivraison, client: e.target.value})}
                  placeholder="Nom du client"
                  className="w-full px-3 py-2 border border-neutral-200 rounded-lg" />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">Adresse de livraison *</label>
                <input type="text" value={nouvelleLivraison.adresse}
                  onChange={(e) => setNouvelleLivraison({...nouvelleLivraison, adresse: e.target.value})}
                  placeholder="Adresse complète"
                  className="w-full px-3 py-2 border border-neutral-200 rounded-lg" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">Chauffeur</label>
                  <select value={nouvelleLivraison.chauffeur}
                    onChange={(e) => setNouvelleLivraison({...nouvelleLivraison, chauffeur: e.target.value})}
                    className="w-full px-3 py-2 border border-neutral-200 rounded-lg">
                    {CHAUFFEURS.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">Date</label>
                  <input type="date" value={nouvelleLivraison.date}
                    onChange={(e) => setNouvelleLivraison({...nouvelleLivraison, date: e.target.value})}
                    className="w-full px-3 py-2 border border-neutral-200 rounded-lg" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">Nombre d'articles</label>
                  <input type="number" value={nouvelleLivraison.articles}
                    onChange={(e) => setNouvelleLivraison({...nouvelleLivraison, articles: Number(e.target.value)})}
                    className="w-full px-3 py-2 border border-neutral-200 rounded-lg" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">Montant (FCFA)</label>
                  <input type="number" value={nouvelleLivraison.montant}
                    onChange={(e) => setNouvelleLivraison({...nouvelleLivraison, montant: Number(e.target.value)})}
                    className="w-full px-3 py-2 border border-neutral-200 rounded-lg" />
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button onClick={() => setShowForm(false)}
                  className="flex-1 py-3 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium rounded-lg">
                  Annuler
                </button>
                <button onClick={handleNouvelleLivraison}
                  className="flex-1 py-3 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg">
                  Créer la livraison
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Changement Statut */}
      {showStatutModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold mb-4">Changer le statut</h3>
            <div className="space-y-2">
              {(['A_PREPARER', 'EN_COURS', 'LIVREE', 'ANNULEE'] as StatutLivraison[]).map(statut => {
                const config = getStatutConfig(statut);
                return (
                  <button
                    key={statut}
                    onClick={() => handleUpdateStatut(statut)}
                    className={`w-full p-4 rounded-lg border-2 flex items-center gap-3 transition-colors ${
                      config.color.replace('text-', 'border-').split(' ')[0]
                    } hover:bg-neutral-50`}
                  >
                    <config.icon className="w-6 h-6" />
                    <span className="font-medium">{config.label}</span>
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => { setShowStatutModal(false); setLivraisonSelectionnee(null); }}
              className="w-full mt-4 py-3 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium rounded-lg"
            >
              Annuler
            </button>
          </div>
        </div>
      )}
    </div>
  );
}