import { useState } from 'react';
import { useStockStore } from '../../../stores/stocks.store';
import { PlusIcon, CheckIcon, TrashIcon, ClipboardDocumentCheckIcon } from '@heroicons/react/24/outline';

export default function InventaireTab() {
  const store = useStockStore();
  const [depotId, setDepotId] = useState(store.depots[0]?.id || '');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [lignes, setLignes] = useState<any[]>([]);
  const [nouvelleLigne, setNouvelleLigne] = useState({ article_id: '', quantite_reelle: 0, motif_ecart: '' });

  const ajouterLigne = () => {
    if (nouvelleLigne.article_id) {
      const article = store.articles.find(a => a.id === nouvelleLigne.article_id);
      const stockTheorique = store.getStockByArticleDepot(article?.id || '', depotId)?.quantite || 0;
      
      setLignes([...lignes, {
        ...nouvelleLigne,
        code_ref: article?.code || '',
        designation: article?.designation || '',
        quantite_theorique: stockTheorique,
        ecart: nouvelleLigne.quantite_reelle - stockTheorique,
      }]);
      setNouvelleLigne({ article_id: '', quantite_reelle: 0, motif_ecart: '' });
    }
  };

  const validerInventaire = () => {
    if (lignes.length > 0) {
      store.creerInventaire({
        depot_id: depotId,
        date,
        statut: 'EN_COURS',
        lignes,
        utilisateur: 'Magasinier',
        notes,
      });
      alert('✅ Inventaire créé ! Vous pouvez le valider pour ajuster les stocks.');
    }
  };

  const totalEcarts = lignes.filter(l => l.ecart !== 0).length;

  return (
    <div className="space-y-4">
      <div className="bg-pink-600 text-white p-4 rounded-lg flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ClipboardDocumentCheckIcon className="w-6 h-6" />
          <h3 className="font-bold">INVENTAIRE PHYSIQUE</h3>
        </div>
        <span className="bg-white/20 px-3 py-1 rounded text-sm">Dépôt: {store.depots.find(d => d.id === depotId)?.nom}</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-medium text-neutral-700 mb-1">Date d'inventaire</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
            className="w-full px-3 py-2 border border-neutral-200 rounded-lg" />
        </div>
        <div>
          <label className="block text-xs font-medium text-neutral-700 mb-1">Dépôt</label>
          <select value={depotId} onChange={(e) => setDepotId(e.target.value)}
            className="w-full px-3 py-2 border border-neutral-200 rounded-lg">
            {store.depots.map(d => <option key={d.id} value={d.id}>{d.nom}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-neutral-700 mb-1">Notes</label>
          <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)}
            className="w-full px-3 py-2 border border-neutral-200 rounded-lg" placeholder="Observations..." />
        </div>
      </div>

      {/* Ajout ligne */}
      <div className="bg-neutral-50 p-4 rounded-lg border border-neutral-200">
        <div className="grid grid-cols-5 gap-2">
          <select value={nouvelleLigne.article_id} onChange={(e) => setNouvelleLigne({...nouvelleLigne, article_id: e.target.value})}
            className="col-span-2 px-3 py-2 border border-neutral-200 rounded-lg">
            <option value="">-- Sélectionner article --</option>
            {store.articles.map(a => (
              <option key={a.id} value={a.id}>{a.code} - {a.designation} (Théorique: {store.getStockByArticleDepot(a.id, depotId)?.quantite || 0})</option>
            ))}
          </select>
          <input type="number" placeholder="Qté réelle" value={nouvelleLigne.quantite_reelle || ''} onChange={(e) => setNouvelleLigne({...nouvelleLigne, quantite_reelle: Number(e.target.value)})}
            className="px-3 py-2 border border-neutral-200 rounded-lg" />
          <input type="text" placeholder="Motif écart" value={nouvelleLigne.motif_ecart} onChange={(e) => setNouvelleLigne({...nouvelleLigne, motif_ecart: e.target.value})}
            className="px-3 py-2 border border-neutral-200 rounded-lg" />
          <button onClick={ajouterLigne} className="bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center justify-center">
            <PlusIcon className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Stats */}
      {lignes.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-green-50 p-4 rounded-lg border border-green-200">
            <p className="text-sm text-green-700">Articles comptés</p>
            <p className="text-2xl font-bold text-green-700">{lignes.length}</p>
          </div>
          <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
            <p className="text-sm text-orange-700">Avec écarts</p>
            <p className="text-2xl font-bold text-orange-700">{totalEcarts}</p>
          </div>
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <p className="text-sm text-blue-700">Sans écart</p>
            <p className="text-2xl font-bold text-blue-700">{lignes.length - totalEcarts}</p>
          </div>
        </div>
      )}

      {/* Tableau */}
      <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-neutral-700 text-white">
            <tr>
              <th className="px-3 py-2 text-left text-xs">CODE</th>
              <th className="px-3 py-2 text-left text-xs">DÉSIGNATION</th>
              <th className="px-3 py-2 text-right text-xs">QTÉ THÉORIQUE</th>
              <th className="px-3 py-2 text-right text-xs bg-yellow-400 text-black">QTÉ RÉELLE</th>
              <th className="px-3 py-2 text-right text-xs">ÉCART</th>
              <th className="px-3 py-2 text-left text-xs">MOTIF</th>
              <th className="px-3 py-2 text-center text-xs">Actions</th>
            </tr>
          </thead>
          <tbody>
            {lignes.map((ligne, idx) => (
              <tr key={idx} className={`border-t border-neutral-100 ${ligne.ecart !== 0 ? 'bg-orange-50' : ''}`}>
                <td className="px-3 py-2 text-sm font-mono">{ligne.code_ref}</td>
                <td className="px-3 py-2 text-sm">{ligne.designation}</td>
                <td className="px-3 py-2 text-sm text-right font-mono">{ligne.quantite_theorique}</td>
                <td className="px-3 py-2 text-sm text-right font-mono font-bold bg-yellow-50">{ligne.quantite_reelle}</td>
                <td className={`px-3 py-2 text-sm text-right font-mono font-bold ${ligne.ecart > 0 ? 'text-green-600' : ligne.ecart < 0 ? 'text-red-600' : 'text-neutral-600'}`}>
                  {ligne.ecart > 0 ? '+' : ''}{ligne.ecart}
                </td>
                <td className="px-3 py-2 text-sm">{ligne.motif_ecart}</td>
                <td className="px-3 py-2 text-center">
                  <button onClick={() => setLignes(lignes.filter((_, i) => i !== idx))} className="text-red-600">
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
            {lignes.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-8 text-center text-neutral-400">Aucune ligne</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end">
        <button onClick={validerInventaire} disabled={lignes.length === 0}
          className="flex items-center gap-2 px-6 py-3 bg-pink-600 hover:bg-pink-700 disabled:bg-neutral-300 text-white font-bold rounded-lg">
          <CheckIcon className="w-5 h-5" />
          Créer l'inventaire
        </button>
      </div>
    </div>
  );
}