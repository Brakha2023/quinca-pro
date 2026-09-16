import { useState } from 'react';
import { useTresorerieStore } from '../../stores/tresorerie.store';
import { PlusIcon, ArrowTrendingUpIcon, ArrowTrendingDownIcon, ArrowsRightLeftIcon, XMarkIcon, PrinterIcon } from '@heroicons/react/24/outline';

export default function TresoreriePage() {
  const store = useTresorerieStore();
  const [showCaisseForm, setShowCaisseForm] = useState(false);
  const [showOperationForm, setShowOperationForm] = useState(false);
  const [showTransfertForm, setShowTransfertForm] = useState(false);
  const [typeOperation, setTypeOperation] = useState<'RECETTE' | 'DEPENSE'>('RECETTE');
  const [nouvelleCaisse, setNouvelleCaisse] = useState({
    nom: '', responsable: '', solde_initial: 0,
  });
  const [nouvelleOperation, setNouvelleOperation] = useState({
    categorie: '', description: '', montant: 0, reference: '',
  });
  const [transfert, setTransfert] = useState({
    caisseOrigine: '', caisseDestination: '', montant: 0, motif: '',
  });

  const CATEGORIES_RECETTES = ['Vente', 'Apport caisse', 'Remboursement', 'Autre'];
  const CATEGORIES_DEPENSES = ['Transport', 'Fournitures', 'Repas', 'Loyer', 'Salaire', 'Électricité', 'Autre'];

  const totalSolde = store.caisses.reduce((sum, c) => sum + c.solde, 0);
  const operationsAujourdhui = store.operations.filter(op => op.date === '2026-08-27');
  const recettesJour = operationsAujourdhui.filter(op => op.type === 'RECETTE').reduce((s, op) => s + op.montant, 0);
  const depensesJour = operationsAujourdhui.filter(op => op.type === 'DEPENSE').reduce((s, op) => s + op.montant, 0);

  const handleAddCaisse = () => {
    if (nouvelleCaisse.nom && nouvelleCaisse.responsable) {
      store.addCaisse(nouvelleCaisse);
      setShowCaisseForm(false);
      setNouvelleCaisse({ nom: '', responsable: '', solde_initial: 0 });
      alert('✅ Caisse créée avec succès !');
    }
  };

  const handleAddOperation = () => {
    if (nouvelleOperation.description && nouvelleOperation.montant > 0 && store.caisseSelectionnee) {
      store.addOperation({
        caisse_id: store.caisseSelectionnee.id,
        type: typeOperation,
        categorie: nouvelleOperation.categorie,
        description: nouvelleOperation.description,
        montant: nouvelleOperation.montant,
        reference: nouvelleOperation.reference,
      });
      setShowOperationForm(false);
      setNouvelleOperation({ categorie: '', description: '', montant: 0, reference: '' });
      alert(`✅ ${typeOperation === 'RECETTE' ? 'Recette' : 'Dépense'} enregistrée !`);
    }
  };

  const handleTransfert = () => {
    if (transfert.caisseOrigine && transfert.caisseDestination && transfert.montant > 0) {
      if (transfert.caisseOrigine === transfert.caisseDestination) {
        alert('❌ La caisse origine et destination doivent être différentes !');
        return;
      }
      store.transfererFonds(transfert.caisseOrigine, transfert.caisseDestination, transfert.montant, transfert.motif);
      setShowTransfertForm(false);
      setTransfert({ caisseOrigine: '', caisseDestination: '', montant: 0, motif: '' });
      alert('✅ Transfert effectué avec succès !');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 print:p-0">
      {/* Header - Masqué à l'impression */}
      <div className="flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Trésorerie</h1>
          <p className="text-sm text-neutral-500 mt-1">Gestion des caisses et opérations</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium rounded-lg"
          >
            <PrinterIcon className="w-5 h-5" />
            Imprimer
          </button>
          <button
            onClick={() => setShowCaisseForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg"
          >
            <PlusIcon className="w-5 h-5" />
            Nouvelle caisse
          </button>
        </div>
      </div>

      {/* KPIs Globaux - Masqué à l'impression */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 print:hidden">
        <div className="bg-gradient-to-br from-primary-600 to-primary-700 p-6 rounded-xl text-white shadow-lg">
          <p className="text-sm opacity-90 mb-2">Solde total toutes caisses</p>
          <p className="text-2xl font-bold font-mono">{totalSolde.toLocaleString('fr-FR')} F</p>
        </div>
        <div className="bg-gradient-to-br from-green-500 to-green-600 p-6 rounded-xl text-white shadow-lg">
          <div className="flex items-center gap-2 mb-2">
            <ArrowTrendingUpIcon className="w-5 h-5" />
            <p className="text-sm opacity-90">Recettes du jour</p>
          </div>
          <p className="text-2xl font-bold font-mono">{recettesJour.toLocaleString('fr-FR')} F</p>
        </div>
        <div className="bg-gradient-to-br from-red-500 to-red-600 p-6 rounded-xl text-white shadow-lg">
          <div className="flex items-center gap-2 mb-2">
            <ArrowTrendingDownIcon className="w-5 h-5" />
            <p className="text-sm opacity-90">Dépenses du jour</p>
          </div>
          <p className="text-2xl font-bold font-mono">{depensesJour.toLocaleString('fr-FR')} F</p>
        </div>
        <div className="bg-white p-6 rounded-xl border border-neutral-200 shadow-sm">
          <p className="text-sm text-neutral-500">Nombre de caisses</p>
          <p className="text-2xl font-bold text-neutral-900 mt-2">{store.caisses.length}</p>
        </div>
      </div>

      {/* Liste des caisses */}
      <div className="print:hidden">
        <h2 className="text-lg font-semibold text-neutral-900 mb-4">Mes caisses</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {store.caisses.map((caisse) => (
            <button
              key={caisse.id}
              onClick={() => store.setCaisseSelectionnee(caisse)}
              className={`bg-white p-6 rounded-xl border-2 text-left transition-all hover:shadow-md ${
                store.caisseSelectionnee?.id === caisse.id
                  ? 'border-primary-500 shadow-md'
                  : 'border-neutral-200'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-mono text-xs text-neutral-500">{caisse.code}</p>
                  <h3 className="font-semibold text-neutral-900">{caisse.nom}</h3>
                </div>
                <div className={`w-3 h-3 rounded-full ${caisse.est_active ? 'bg-green-500' : 'bg-red-500'}`}></div>
              </div>
              <p className="text-sm text-neutral-600 mb-3">Responsable: {caisse.responsable}</p>
              <div className="border-t border-neutral-100 pt-3">
                <p className="text-xs text-neutral-500">Solde actuel</p>
                <p className={`text-xl font-bold font-mono ${caisse.solde >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {caisse.solde.toLocaleString('fr-FR')} F
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Caisse sélectionnée */}
      {store.caisseSelectionnee && (
        <div className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden">
          {/* Header Caisse */}
          <div className="px-6 py-4 border-b border-neutral-200 bg-neutral-50 flex items-center justify-between print:hidden">
            <div>
              <h3 className="font-semibold text-neutral-900">
                {store.caisseSelectionnee.nom} ({store.caisseSelectionnee.code})
              </h3>
              <p className="text-sm text-neutral-600">Responsable: {store.caisseSelectionnee.responsable}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => { setTypeOperation('RECETTE'); setShowOperationForm(true); }}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg text-sm"
              >
                <ArrowTrendingUpIcon className="w-4 h-4" />
                Recette
              </button>
              <button
                onClick={() => { setTypeOperation('DEPENSE'); setShowOperationForm(true); }}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg text-sm"
              >
                <ArrowTrendingDownIcon className="w-4 h-4" />
                Dépense
              </button>
              <button
                onClick={() => setShowTransfertForm(true)}
                className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg text-sm"
              >
                <ArrowsRightLeftIcon className="w-4 h-4" />
                Transfert
              </button>
            </div>
          </div>

          {/* En-tête pour impression */}
          <div className="hidden print:block px-6 py-4 border-b border-neutral-200">
            <h2 className="text-xl font-bold text-neutral-900">Historique de caisse: {store.caisseSelectionnee.nom}</h2>
            <p className="text-sm text-neutral-600">Code: {store.caisseSelectionnee.code} • Responsable: {store.caisseSelectionnee.responsable}</p>
            <p className="text-sm text-neutral-600">Solde actuel: {store.caisseSelectionnee.solde.toLocaleString('fr-FR')} FCFA</p>
          </div>

          {/* Tableau des opérations */}
          <table className="w-full">
            <thead className="bg-neutral-50 border-b border-neutral-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-600 uppercase">Date/Heure</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-600 uppercase">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-600 uppercase">Catégorie</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-600 uppercase">Description</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-neutral-600 uppercase">Montant</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {store.getOperationsByCaisse(store.caisseSelectionnee.id).map((op) => (
                <tr key={op.id} className="hover:bg-neutral-50">
                  <td className="px-6 py-4 text-sm text-neutral-600">
                    <div>{op.date}</div>
                    <div className="text-xs text-neutral-400">{op.heure}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      op.type === 'RECETTE' ? 'bg-green-100 text-green-700' :
                      op.type === 'DEPENSE' ? 'bg-red-100 text-red-700' :
                      op.type === 'TRANSFERT_ENTREE' ? 'bg-blue-100 text-blue-700' :
                      'bg-orange-100 text-orange-700'
                    }`}>
                      {op.type === 'RECETTE' ? '↑ Recette' :
                       op.type === 'DEPENSE' ? '↓ Dépense' :
                       op.type === 'TRANSFERT_ENTREE' ? '↙ Transfert reçu' : '↗ Transfert envoyé'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-neutral-700">{op.categorie}</td>
                  <td className="px-6 py-4 text-sm text-neutral-900">{op.description}</td>
                  <td className={`px-6 py-4 text-sm text-right font-bold font-mono ${
                    op.type === 'RECETTE' || op.type === 'TRANSFERT_ENTREE' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {op.type === 'RECETTE' || op.type === 'TRANSFERT_ENTREE' ? '+' : '-'}{op.montant.toLocaleString('fr-FR')} F
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Nouvelle Caisse */}
      {showCaisseForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 print:hidden">
          <div className="bg-white rounded-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Nouvelle caisse</h3>
              <button onClick={() => setShowCaisseForm(false)} className="p-2 hover:bg-neutral-100 rounded-lg">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">Nom de la caisse *</label>
                <input type="text" value={nouvelleCaisse.nom}
                  onChange={(e) => setNouvelleCaisse({...nouvelleCaisse, nom: e.target.value})}
                  placeholder="Ex: Caisse Principale"
                  className="w-full px-3 py-2 border border-neutral-200 rounded-lg" />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">Responsable *</label>
                <input type="text" value={nouvelleCaisse.responsable}
                  onChange={(e) => setNouvelleCaisse({...nouvelleCaisse, responsable: e.target.value})}
                  placeholder="Nom du responsable"
                  className="w-full px-3 py-2 border border-neutral-200 rounded-lg" />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">Solde initial (FCFA)</label>
                <input type="number" value={nouvelleCaisse.solde_initial}
                  onChange={(e) => setNouvelleCaisse({...nouvelleCaisse, solde_initial: Number(e.target.value)})}
                  className="w-full px-3 py-2 border border-neutral-200 rounded-lg" />
              </div>
              <div className="flex gap-3 pt-4">
                <button onClick={() => setShowCaisseForm(false)}
                  className="flex-1 py-3 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium rounded-lg">
                  Annuler
                </button>
                <button onClick={handleAddCaisse}
                  className="flex-1 py-3 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg">
                  Créer la caisse
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Opération (Recette/Dépense) */}
      {showOperationForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 print:hidden">
          <div className="bg-white rounded-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">
                {typeOperation === 'RECETTE' ? 'Nouvelle recette' : 'Nouvelle dépense'}
              </h3>
              <button onClick={() => setShowOperationForm(false)} className="p-2 hover:bg-neutral-100 rounded-lg">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">Catégorie</label>
                <select
                  value={nouvelleOperation.categorie}
                  onChange={(e) => setNouvelleOperation({...nouvelleOperation, categorie: e.target.value})}
                  className="w-full px-3 py-2 border border-neutral-200 rounded-lg"
                >
                  <option value="">-- Choisir --</option>
                  {(typeOperation === 'RECETTE' ? CATEGORIES_RECETTES : CATEGORIES_DEPENSES).map(c => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">Description *</label>
                <input type="text" value={nouvelleOperation.description}
                  onChange={(e) => setNouvelleOperation({...nouvelleOperation, description: e.target.value})}
                  className="w-full px-3 py-2 border border-neutral-200 rounded-lg" />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">Montant (FCFA) *</label>
                <input type="number" value={nouvelleOperation.montant}
                  onChange={(e) => setNouvelleOperation({...nouvelleOperation, montant: Number(e.target.value)})}
                  className="w-full px-3 py-2 border border-neutral-200 rounded-lg" />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">Référence (optionnel)</label>
                <input type="text" value={nouvelleOperation.reference}
                  onChange={(e) => setNouvelleOperation({...nouvelleOperation, reference: e.target.value})}
                  className="w-full px-3 py-2 border border-neutral-200 rounded-lg" />
              </div>
              <div className="flex gap-3 pt-4">
                <button onClick={() => setShowOperationForm(false)}
                  className="flex-1 py-3 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium rounded-lg">
                  Annuler
                </button>
                <button onClick={handleAddOperation}
                  className={`flex-1 py-3 text-white font-medium rounded-lg ${
                    typeOperation === 'RECETTE' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
                  }`}>
                  Enregistrer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Transfert */}
      {showTransfertForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 print:hidden">
          <div className="bg-white rounded-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Transfert entre caisses</h3>
              <button onClick={() => setShowTransfertForm(false)} className="p-2 hover:bg-neutral-100 rounded-lg">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">Caisse origine *</label>
                <select
                  value={transfert.caisseOrigine}
                  onChange={(e) => setTransfert({...transfert, caisseOrigine: e.target.value})}
                  className="w-full px-3 py-2 border border-neutral-200 rounded-lg"
                >
                  <option value="">-- Choisir --</option>
                  {store.caisses.map(c => (
                    <option key={c.id} value={c.id}>{c.nom} ({c.solde.toLocaleString('fr-FR')} F)</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">Caisse destination *</label>
                <select
                  value={transfert.caisseDestination}
                  onChange={(e) => setTransfert({...transfert, caisseDestination: e.target.value})}
                  className="w-full px-3 py-2 border border-neutral-200 rounded-lg"
                >
                  <option value="">-- Choisir --</option>
                  {store.caisses.map(c => (
                    <option key={c.id} value={c.id}>{c.nom}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">Montant (FCFA) *</label>
                <input type="number" value={transfert.montant}
                  onChange={(e) => setTransfert({...transfert, montant: Number(e.target.value)})}
                  className="w-full px-3 py-2 border border-neutral-200 rounded-lg" />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">Motif (optionnel)</label>
                <input type="text" value={transfert.motif}
                  onChange={(e) => setTransfert({...transfert, motif: e.target.value})}
                  placeholder="Raison du transfert"
                  className="w-full px-3 py-2 border border-neutral-200 rounded-lg" />
              </div>
              <div className="flex gap-3 pt-4">
                <button onClick={() => setShowTransfertForm(false)}
                  className="flex-1 py-3 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium rounded-lg">
                  Annuler
                </button>
                <button onClick={handleTransfert}
                  className="flex-1 py-3 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg">
                  Effectuer le transfert
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Styles d'impression */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print\\:p-0, .print\\:p-0 * {
            visibility: visible;
          }
          .print\\:p-0 {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 20px;
          }
        }
      `}</style>
    </div>
  );
}