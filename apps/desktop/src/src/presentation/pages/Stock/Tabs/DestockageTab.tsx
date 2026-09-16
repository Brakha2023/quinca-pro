import { useState } from 'react';
import { useStockStore } from '../../../stores/stocks.store';
import { PlusIcon, CheckIcon, TrashIcon } from '@heroicons/react/24/outline';

export default function DestockageTab() {
  const store = useStockStore();
  const [depotId, setDepotId] = useState(store.depots[0]?.id || '');
  const [dateDestockage, setDateDestockage] = useState(new Date().toISOString().split('T')[0]);
  const [motif, setMotif] = useState('Casserie');
  const [lignes, setLignes] = useState<any[]>([]);
  const [nouvelleLigne, setNouvelleLigne] = useState({ article_id: '', quantite: 0, motif_detail: '' });

  const ajouterLigne = () => {
    if (nouvelleLigne.article_id && nouvelleLigne.quantite > 0) {
      const article = store.articles.find(a => a.id === nouvelleLigne.article_id);
      const stock = store.getStockByArticleDepot(article?.id || '', depotId);
      const cmup = stock?.cout_moyen || article?.prix_achat || 0;
      
      setLignes([...lignes, {
        ...nouvelleLigne,
        code_ref: article?.code || '',
        designation: article?.designation || '',
        cmup,
        total: nouvelleLigne.quantite * cmup,
      }]);
      setNouvelleLigne({ article_id: '', quantite: 0, motif_detail: '' });
    }
  };

  const validerDestockage = () => {
    if (lignes.length > 0) {
      lignes.forEach(ligne => {
        store.ajouterMouvement({
          article_id: ligne.article_id,
          depot_id: depotId,
          type: 'SORTIE_DESTOCKAGE',
          quantite: ligne.quantite,
          cout_unitaire: ligne.cmup,
          reference: `DEST-${Date.now()}`,
          motif: `${motif} - ${ligne.motif_detail}`,
          utilisateur: 'Magasinier',
        });
      });
      alert('✅ Déstockage validé avec succès !');
      setLignes([]);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-red-600 text-white p-4 rounded-lg flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 bg-white rounded-full animate-pulse"></div>
          <h3 className="font-bold">DÉSTOCKAGE</h3>
        </div>
        <span className="bg-white/20 px-3 py-1 rounded text-sm">Dépôt: {store.depots.find(d => d.id === depotId)?.nom}</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-medium text-neutral-700 mb-1">Date de déstockage</label>
          <input type="date" value={dateDestockage} onChange={(e) => setDateDestockage(e.target.value)}
            className="w-full px-3 py-2 border border-neutral-200 rounded-lg" />
        </div>
        <div>
          <label className="block text-xs font-medium text-neutral-700 mb-1">Motif principal</label>
          <select value={motif} onChange={(e) => setMotif(e.target.value)}
            className="w-full px-3 py-2 border border-neutral-200 rounded-lg">
            <option>Casserie</option>
            <option>Périmé</option>
            <option>Perte</option>
            <option>Vol</option>
            <option>Rebut</option>
            <option>Destruction</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-neutral-700 mb-1">Dépôt</label>
          <select value={depotId} onChange={(e) => setDepotId(e.target.value)}
            className="w-full px-3 py-2 border border-neutral-200 rounded-lg">
            {store.depots.map(d => <option key={d.id} value={d.id}>{d.nom}</option>)}
          </select>
        </div>
      </div>

      {/* Ajout ligne */}
      <div className="bg-neutral-50 p-4 rounded-lg border border-neutral-200">
        <div className="grid grid-cols-5 gap-2">
          <select value={nouvelleLigne.article_id} onChange={(e) => setNouvelleLigne({...nouvelleLigne, article_id: e.target.value})}
            className="col-span-2 px-3 py-2 border border-neutral-200 rounded-lg">
            <option value="">-- Sélectionner article --</option>
            {store.articles.map(a => (
              <option key={a.id} value={a.id}>{a.code} - {a.designation} (Stock: {store.getStockTotalByArticle(a.id)})</option>
            ))}
          </select>
          <input type="number" placeholder="Quantité" value={nouvelleLigne.quantite || ''} onChange={(e) => setNouvelleLigne({...nouvelleLigne, quantite: Number(e.target.value)})}
            className="px-3 py-2 border border-neutral-200 rounded-lg" />
          <input type="text" placeholder="Motif détaillé" value={nouvelleLigne.motif_detail} onChange={(e) => setNouvelleLigne({...nouvelleLigne, motif_detail: e.target.value})}
            className="px-3 py-2 border border-neutral-200 rounded-lg" />
          <button onClick={ajouterLigne} className="bg-red-600 hover:bg-red-700 text-white rounded-lg flex items-center justify-center">
            <PlusIcon className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Tableau */}
      <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-neutral-700 text-white">
            <tr>
              <th className="px-3 py-2 text-left text-xs">CODE</th>
              <th className="px-3 py-2 text-left text-xs">DÉSIGNATION</th>
              <th className="px-3 py-2 text-right text-xs">QTÉ</th>
              <th className="px-3 py-2 text-right text-xs">CMUP</th>
              <th className="px-3 py-2 text-right text-xs">TOTAL</th>
              <th className="px-3 py-2 text-left text-xs">MOTIF</th>
              <th className="px-3 py-2 text-center text-xs">Actions</th>
            </tr>
          </thead>
          <tbody>
            {lignes.map((ligne, idx) => (
              <tr key={idx} className="border-t border-neutral-100 hover:bg-neutral-50">
                <td className="px-3 py-2 text-sm font-mono">{ligne.code_ref}</td>
                <td className="px-3 py-2 text-sm">{ligne.designation}</td>
                <td className="px-3 py-2 text-sm text-right font-mono">{ligne.quantite}</td>
                <td className="px-3 py-2 text-sm text-right font-mono">{ligne.cmup.toLocaleString('fr-FR')}</td>
                <td className="px-3 py-2 text-sm text-right font-mono font-bold text-red-600">{ligne.total.toLocaleString('fr-FR')}</td>
                <td className="px-3 py-2 text-sm">{ligne.motif_detail}</td>
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
        <button onClick={validerDestockage} disabled={lignes.length === 0}
          className="flex items-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-700 disabled:bg-neutral-300 text-white font-bold rounded-lg">
          <CheckIcon className="w-5 h-5" />
          Valider le déstockage
        </button>
      </div>
    </div>
  );
}