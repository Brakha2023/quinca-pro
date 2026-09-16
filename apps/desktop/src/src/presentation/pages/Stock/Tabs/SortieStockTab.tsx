import { useState } from 'react';
import { useStockStore } from '../../../stores/stocks.store';
import { PlusIcon, XMarkIcon, CheckIcon, TrashIcon } from '@heroicons/react/24/outline';

export default function SortieStockTab() {
  const store = useStockStore();
  const [depotId, setDepotId] = useState(store.depots[0]?.id || '');
  const [dateSortie, setDateSortie] = useState(new Date().toISOString().split('T')[0]);
  const [conditionnement, setConditionnement] = useState('Achat');
  const [numeroBS, setNumeroBS] = useState('');
  const [service, setService] = useState('');
  const [lignes, setLignes] = useState<any[]>([]);
  const [nouvelleLigne, setNouvelleLigne] = useState({ article_id: '', quantite: 0 });

  const total = lignes.reduce((sum, l) => sum + l.total, 0);
  const nombreArticles = lignes.length;
  const nombreColis = lignes.reduce((sum, l) => sum + l.quantite, 0);

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
      setNouvelleLigne({ article_id: '', quantite: 0 });
    }
  };

  const validerSortie = () => {
    if (lignes.length > 0 && depotId) {
      store.creerSortieStock({
        depot_id: depotId,
        date_sortie: dateSortie,
        conditionnement,
        numero_bs: numeroBS,
        service,
        lignes,
        nombre_articles: nombreArticles,
        nombre_colis: nombreColis,
        total,
        utilisateur: 'Magasinier',
      });
      alert('✅ Sortie de stock validée avec succès !');
      setLignes([]);
      setNumeroBS('');
      setService('');
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-primary-900 text-white p-4 rounded-lg flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 bg-red-400 rounded-full animate-pulse"></div>
          <h3 className="font-bold">SORTIE DE STOCK</h3>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="bg-white/20 px-3 py-1 rounded">Dépôt: {store.depots.find(d => d.id === depotId)?.nom}</span>
          <span className="bg-white/20 px-3 py-1 rounded">OUATTARA</span>
          <span className="bg-yellow-400 text-black px-3 py-1 rounded font-mono">
            {new Date().toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).toUpperCase()}
          </span>
        </div>
      </div>

      {/* Sélecteur de dépôt bien visible */}
      <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 flex items-center gap-4">
        <label className="font-semibold text-orange-900">Dépôt :</label>
        <select value={depotId} onChange={(e) => setDepotId(e.target.value)}
          className="flex-1 px-4 py-2 border border-orange-300 rounded-lg bg-white font-medium focus:ring-2 focus:ring-orange-500">
          {store.depots.map(d => (
            <option key={d.id} value={d.id}>{d.nom} - {d.responsable}</option>
          ))}
        </select>
        <div className="text-sm text-orange-700">
          Responsable : <strong>{store.depots.find(d => d.id === depotId)?.responsable}</strong>
        </div>
      </div>

      {/* Formulaire */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1">Date de Sortie</label>
              <input type="date" value={dateSortie} onChange={(e) => setDateSortie(e.target.value)}
                className="w-full px-3 py-2 border border-neutral-200 rounded-lg" />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1">Conditionnement</label>
              <select value={conditionnement} onChange={(e) => setConditionnement(e.target.value)}
                className="w-full px-3 py-2 border border-neutral-200 rounded-lg">
                <option>Achat</option>
                <option>Vente</option>
                <option>Casserie</option>
                <option>Perte</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-1">N° BS / Service</label>
            <input type="text" value={numeroBS} onChange={(e) => setNumeroBS(e.target.value)}
              className="w-full px-3 py-2 border border-neutral-200 rounded-lg" placeholder="BS-2026-001" />
          </div>
        </div>

        {/* Totaux */}
        <div className="bg-neutral-50 p-4 rounded-lg border border-neutral-200">
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1">Nbre d'article</label>
              <input type="text" value={nombreArticles} readOnly
                className="w-full px-3 py-2 border border-neutral-200 rounded-lg bg-white text-right font-mono" />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1">Nbre de Colis</label>
              <input type="text" value={nombreColis.toLocaleString('fr-FR')} readOnly
                className="w-full px-3 py-2 border border-neutral-200 rounded-lg bg-white text-right font-mono" />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1">TOTAL =</label>
              <input type="text" value={total.toLocaleString('fr-FR')} readOnly
                className="w-full px-3 py-2 border border-neutral-200 rounded-lg bg-white text-right font-mono font-bold" />
            </div>
          </div>
        </div>
      </div>

      {/* Ajout ligne */}
      <div className="bg-neutral-50 p-4 rounded-lg border border-neutral-200">
        <div className="grid grid-cols-4 gap-2">
          <select value={nouvelleLigne.article_id} onChange={(e) => setNouvelleLigne({...nouvelleLigne, article_id: e.target.value})}
            className="col-span-2 px-3 py-2 border border-neutral-200 rounded-lg">
            <option value="">-- Sélectionner article --</option>
            {store.articles.map(a => (
              <option key={a.id} value={a.id}>{a.code} - {a.designation} (Stock: {store.getStockTotalByArticle(a.id)})</option>
            ))}
          </select>
          <input type="number" placeholder="Quantité" value={nouvelleLigne.quantite || ''} onChange={(e) => setNouvelleLigne({...nouvelleLigne, quantite: Number(e.target.value)})}
            className="px-3 py-2 border border-neutral-200 rounded-lg" />
          <button onClick={ajouterLigne} className="bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center justify-center">
            <PlusIcon className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Tableau */}
      <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-neutral-700 text-white">
            <tr>
              <th className="px-3 py-2 text-left text-xs">CODE / REF</th>
              <th className="px-3 py-2 text-left text-xs">DÉSIGNATION</th>
              <th className="px-3 py-2 text-right text-xs">QTÉ</th>
              <th className="px-3 py-2 text-right text-xs">CMUP</th>
              <th className="px-3 py-2 text-right text-xs">TOTAL</th>
              <th className="px-3 py-2 text-center text-xs">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {lignes.map((ligne, idx) => (
              <tr key={idx} className="hover:bg-neutral-50">
                <td className="px-3 py-2 text-sm font-mono">{ligne.code_ref}</td>
                <td className="px-3 py-2 text-sm">{ligne.designation}</td>
                <td className="px-3 py-2 text-sm text-right font-mono">{ligne.quantite}</td>
                <td className="px-3 py-2 text-sm text-right font-mono">{ligne.cmup.toLocaleString('fr-FR')}</td>
                <td className="px-3 py-2 text-sm text-right font-mono font-bold">{ligne.total.toLocaleString('fr-FR')}</td>
                <td className="px-3 py-2 text-center">
                  <button onClick={() => setLignes(lignes.filter((_, i) => i !== idx))} className="text-red-600 hover:text-red-700">
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
            {lignes.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-neutral-400">
                  Aucune ligne. Sélectionnez un article pour ajouter.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot className="bg-neutral-100 font-bold">
            <tr>
              <td colSpan={4} className="px-3 py-2 text-sm">TOTAL</td>
              <td className="px-3 py-2 text-sm text-right font-mono">{total.toLocaleString('fr-FR')}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Bouton Valider */}
      <div className="flex justify-end">
        <button onClick={validerSortie} disabled={lignes.length === 0}
          className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-neutral-300 text-white font-bold rounded-lg">
          <CheckIcon className="w-5 h-5" />
          Valider la sortie de stock (F11)
        </button>
      </div>
    </div>
  );
}
