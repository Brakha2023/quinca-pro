import { useState } from 'react';
import { usePOSStore } from '../../stores/pos.store';
import { useClientsStore } from '../../stores/clients.store';
import { PlusIcon, MinusIcon, TrashIcon, UserIcon, TruckIcon } from '@heroicons/react/24/outline';
import ClientSelector from './ClientSelector';
import LivraisonModal, { LivraisonData } from './LivraisonModal';

export default function TicketPanel() {
  const {
    lignes,
    remiseGlobale,
    dateVente,
    setRemiseGlobale,
    calculerSousTotal,
    calculerTVA,
    calculerTotal,
    calculerNombreArticles,
    modifierQuantite,
    supprimerLigne,
    viderPanier,
  } = usePOSStore();

  const { selectedClient, isComptoir } = useClientsStore();

  const [showClientSelector, setShowClientSelector] = useState(false);
  const [showLivraison, setShowLivraison] = useState(false);
  const [showPaiement, setShowPaiement] = useState(false);
  const [livraisonData, setLivraisonData] = useState<LivraisonData | null>(null);

  const sousTotal = calculerSousTotal();
  const tva = calculerTVA();
  const total = calculerTotal();
  const nombreArticles = calculerNombreArticles();
  const dateFormatee = new Date(dateVente).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const numeroTicket = 'VTE-2026-00147';

  const handleValider = () => {
    if (lignes.length === 0) return;
    setShowLivraison(true);
  };

  const handleLivraisonComplete = (data: LivraisonData) => {
    setLivraisonData(data);
    setShowLivraison(false);
    setShowPaiement(true);
  };

  const handlePaiement = (mode: string) => {
    // TODO: Sauvegarder la vente avec les données de livraison
    const message = `✅ Vente validée !
Client: ${isComptoir ? 'Comptoir' : selectedClient?.raison_sociale}
Mode: ${mode}
Total: ${total.toLocaleString('fr-FR')} FCFA
Ticket: ${numeroTicket}
${livraisonData?.necessaire ? `Livraison: ${livraisonData.date_livraison} à ${livraisonData.heure_livraison}\nLieu: ${livraisonData.lieu}` : 'Retrait sur place'}`;
    
    alert(message);
    viderPanier();
    setShowPaiement(false);
    setLivraisonData(null);
    
    // Imprimer automatiquement après validation
    setTimeout(() => window.print(), 500);
  };

  const handleImprimer = () => {
    window.print();
  };

  return (
    <>
      <div className="bg-white rounded-xl border border-neutral-200 shadow-sm flex flex-col h-full">
        {/* Header Ticket */}
        <div className="bg-primary-700 text-white px-5 py-4 rounded-t-xl">
          <p className="text-xs text-primary-200 uppercase tracking-wide">Ticket en cours</p>
          <p className="text-lg font-bold font-mono">#{numeroTicket}</p>
          <p className="text-xs text-primary-200 mt-1">{dateFormatee}</p>
        </div>

        {/* Client */}
        <button
          onClick={() => setShowClientSelector(true)}
          className="px-5 py-3 border-b border-neutral-100 flex items-center gap-3 hover:bg-neutral-50 transition-colors w-full text-left"
        >
          <UserIcon className="w-5 h-5 text-primary-600" />
          <div className="flex-1">
            <p className="text-xs text-neutral-500 uppercase font-medium">Client</p>
            <p className="text-sm font-medium text-neutral-900">
              {isComptoir ? 'Client Comptoir' : selectedClient?.raison_sociale}
            </p>
          </div>
        </button>

        {/* Info vente */}
        <div className="px-5 py-3 border-b border-neutral-100 bg-neutral-50">
          <div className="flex justify-between text-sm">
            <span className="text-neutral-600">Articles:</span>
            <span className="font-bold">{nombreArticles}</span>
          </div>
        </div>

        {/* Liste des articles */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2 max-h-64">
          {lignes.length === 0 ? (
            <div className="text-center py-12 text-neutral-400">
              <p className="text-4xl mb-2">🛒</p>
              <p className="text-sm">Panier vide</p>
              <p className="text-xs mt-1">Cliquez sur un article pour l'ajouter</p>
            </div>
          ) : (
            lignes.map((ligne) => (
              <div key={ligne.id} className="bg-neutral-50 rounded-lg p-3">
                <div className="flex items-start justify-between mb-2">
                  <p className="text-sm font-medium text-neutral-900 flex-1 pr-2">
                    {ligne.designation}
                  </p>
                  <button
                    onClick={() => supprimerLigne(ligne.id)}
                    className="text-red-500 hover:bg-red-50 p-1 rounded"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => modifierQuantite(ligne.id, ligne.quantite - 1)}
                      className="w-7 h-7 rounded bg-white border border-neutral-200 flex items-center justify-center hover:bg-neutral-100"
                    >
                      <MinusIcon className="w-3 h-3" />
                    </button>
                    <span className="text-sm font-bold w-8 text-center">{ligne.quantite}</span>
                    <button
                      onClick={() => modifierQuantite(ligne.id, ligne.quantite + 1)}
                      className="w-7 h-7 rounded bg-white border border-neutral-200 flex items-center justify-center hover:bg-neutral-100"
                    >
                      <PlusIcon className="w-3 h-3" />
                    </button>
                  </div>
                  <p className="text-sm font-bold font-mono text-primary-700">
                    {ligne.total_ttc.toLocaleString('fr-FR')} F
                  </p>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Remise */}
        <div className="px-5 py-3 border-t border-neutral-200">
          <label className="text-xs text-neutral-600 font-medium">Remise globale (%)</label>
          <input
            type="number"
            min="0"
            max="100"
            value={remiseGlobale}
            onChange={(e) => setRemiseGlobale(Number(e.target.value))}
            className="w-full mt-1 px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        {/* Totaux */}
        <div className="border-t border-neutral-200 px-5 py-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-neutral-600">Sous-total HT</span>
            <span className="font-mono">{sousTotal.toLocaleString('fr-FR')} F</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-neutral-600">TVA (18%)</span>
            <span className="font-mono">{tva.toLocaleString('fr-FR')} F</span>
          </div>
          {remiseGlobale > 0 && (
            <div className="flex justify-between text-sm text-orange-600">
              <span>Remise ({remiseGlobale}%)</span>
              <span className="font-mono">-{(sousTotal * remiseGlobale / 100).toLocaleString('fr-FR')} F</span>
            </div>
          )}
          <div className="flex justify-between text-lg font-bold pt-2 border-t border-neutral-100">
            <span className="text-neutral-900">TOTAL TTC</span>
            <span className="font-mono text-primary-700 text-xl">
              {total.toLocaleString('fr-FR')} F
            </span>
          </div>
        </div>

        {/* Boutons d'action */}
        <div className="p-4 border-t border-neutral-200 space-y-2">
          <button
            onClick={handleValider}
            disabled={lignes.length === 0}
            className="w-full py-3 bg-green-600 hover:bg-green-700 disabled:bg-neutral-300 text-white font-semibold rounded-lg transition-colors"
          >
            VALIDER (F11)
          </button>
          <button
            onClick={handleImprimer}
            disabled={lignes.length === 0}
            className="w-full py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white font-medium rounded-lg transition-colors text-sm"
          >
            IMPRIMER TICKET A4
          </button>
          <button
            onClick={viderPanier}
            disabled={lignes.length === 0}
            className="w-full py-2 bg-neutral-100 hover:bg-neutral-200 disabled:opacity-50 text-neutral-700 font-medium rounded-lg transition-colors text-sm"
          >
            NOUVELLE VENTE (F10)
          </button>
        </div>
      </div>

      {/* Modal Sélection Client */}
      {showClientSelector && (
        <ClientSelector onClose={() => setShowClientSelector(false)} />
      )}

      {/* Modal Livraison */}
      {showLivraison && (
        <LivraisonModal
          onClose={() => setShowLivraison(false)}
          onNext={handleLivraisonComplete}
          total={total}
        />
      )}

      {/* Modal Paiement */}
      {showPaiement && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-96">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Mode de paiement</h3>
              <span className="text-xs text-neutral-500">Étape 2 sur 3</span>
            </div>
            
            {/* Résumé livraison */}
            {livraisonData?.necessaire && (
              <div className="mb-4 p-3 bg-primary-50 rounded-lg border border-primary-200">
                <div className="flex items-center gap-2 mb-2">
                  <TruckIcon className="w-4 h-4 text-primary-600" />
                  <p className="text-xs font-medium text-primary-700">Livraison prévue</p>
                </div>
                <p className="text-xs text-neutral-700">
                  {livraisonData.date_livraison} à {livraisonData.heure_livraison}
                </p>
                <p className="text-xs text-neutral-600 mt-1">{livraisonData.lieu}</p>
              </div>
            )}

            <p className="text-2xl font-bold text-primary-700 font-mono mb-6 text-center">
              {total.toLocaleString('fr-FR')} FCFA
            </p>
            <div className="grid grid-cols-2 gap-3">
              {['ESPECES', 'MOBILE_MONEY', 'CHEQUE', 'CREDIT_CLIENT'].map((mode) => (
                <button
                  key={mode}
                  onClick={() => handlePaiement(mode)}
                  className="py-3 px-4 bg-primary-50 hover:bg-primary-100 text-primary-700 font-medium rounded-lg transition-colors text-sm"
                >
                  {mode.replace('_', ' ')}
                </button>
              ))}
            </div>
            <button
              onClick={() => { setShowPaiement(false); setLivraisonData(null); }}
              className="w-full mt-4 py-2 text-neutral-600 hover:bg-neutral-100 rounded-lg text-sm"
            >
              Annuler
            </button>
          </div>
        </div>
      )}
    </>
  );
}
