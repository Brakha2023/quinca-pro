import { useState } from 'react';
import { useStockStore } from '../../../stores/stocks.store';
import { PlusIcon, CheckIcon, TrashIcon, ArrowDownIcon } from '@heroicons/react/24/outline';

interface TransfertDepotTabProps {
  type: 'INTER_DEPOT' | 'INTER_FILIALE';
}

export default function TransfertDepotTab({ type }: TransfertDepotTabProps) {
  const store = useStockStore();
  const [depotSourceId, setDepotSourceId] = useState(store.depots[0]?.id || '');
  const [depotDestId, setDepotDestId] = useState(store.depots[1]?.id || '');
  const [dateTransfert, setDateTransfert] = useState(new Date().toISOString().split('T')[0]);
  const [numeroTransfert, setNumeroTransfert] = useState('');
  const [information, setInformation] = useState('');
  const [conditionnement, setConditionnement] = useState('Achat');
  const [lignes, setLignes] = useState<any[]>([]);
  const [nouvelleLigne, setNouvelleLigne] = useState({ article_id: '', quantite: 0 });

  const total = lignes.reduce((sum, l) => sum + l.total, 0);
  const nombreArticles = lignes.length;
  const nombreColis = lignes.reduce((sum, l) => sum + l.quantite, 0);

  const ajouterLigne = () => {
    if (nouvelleLigne.article_id && nouvelleLigne.quantite > 0) {
      const article = store.articles.find(a => a.id === nouvelleLigne.article_id);
      const stock = store.getStockByArticleDepot(article?.id || '', depotSourceId);
      const prixAchat = stock?.cout_moyen || article?.prix_achat || 0;
      
      setLignes([...lignes, {
        ...nouvelleLigne,
        reference: article?.code || '',
        designation: article?.designation || '',
        prix_achat_ttc: prixAchat,
        total: nouvelleLigne.quantite * prixAchat,
      }]);
      setNouvelleLigne({ article_id: '', quantite: 0 });
    }
  };

  const validerTransfert = () => {
    if (lignes.length > 0 && depotSourceId && depotDestId) {
      if (depotSourceId === depotDestId) {
        alert(' Le dépôt source et destination doivent être différents !');
        return;
      }
      store.creerTransfert({
        type,
        depot_source_id: depotSourceId,
        depot_destination_id: depotDestId,
        date_transfert: dateTransfert,
        information,
        conditionnement,
        lignes,
        nombre_articles: nombreArticles,
        nombre_colis: nombreColis,
        total,
        utilisateur: 'Magasinier',
      });
      alert(`✅ Transfert ${type === 'INTER_FILIALE' ? 'inter-filiale' : 'inter-dépôt'} validé !`);
      setLignes([]);
      setNumeroTransfert('');
    }
  };


  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-primary-900 text-white p-4 rounded-lg flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 bg-purple-400 rounded-full animate-pulse"></div>
          <h3 className="font-bold">
            TRANSFERT DE STOCK {type === 'INTER_FILIALE' ? 'INTER-FILIALE' : 'INTER-DÉPÔT'}
          </h3>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="bg-white/20 px-3 py-1 rounded">OUATTARA</span>
          <span className="bg-yellow-400 text-black px-3 py-1 rounded font-mono">
            {new Date().toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).toUpperCase()}
          </span>
        </div>
      </div>

      {/* Formulaire */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1">Conditionnement</label>
              <select value={conditionnement} onChange={(e) => setConditionnement(e.target.value)}
                className="w-full px-3 py-2 border border-neutral-200 rounded-lg">
                <option>Achat</option>
                <option>Vente</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1">Date du transfert</label>
              <input type="date" value={dateTransfert} onChange={(e) => setDateTransfert(e.target.value)}
                className="w-full px-3 py-2 border border-neutral-200 rounded-lg" />
            </div>
          </div>
          <div className="bg-neutral-100 p-4 rounded-lg">
            <div className="grid grid-cols-2 gap-4 items-center">
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">DÉPÔT SOURCE</label>
                <select value={depotSourceId} onChange={(e) => setDepotSourceId(e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-200 rounded-lg font-medium">
                  {store.depots.map(d => <option key={d.id} value={d.id}>{d.nom}</option>)}
                </select>
              </div>
              <div className="flex justify-center">
                <ArrowDownIcon className="w-8 h-8 text-primary-600" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-neutral-700 mb-1">DÉPÔT DESTINATION</label>
                <select value={depotDestId} onChange={(e) => setDepotDestId(e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-200 rounded-lg font-medium">
                  {store.depots.map(d => <option key={d.id} value={d.id}>{d.nom}</option>)}
                </select>
              </div>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-1">Numéro du transfert</label>
            <input type="text" value={numeroTransfert} onChange={(e) => setNumeroTransfert(e.target.value)}
              className="w-full px-3 py-2 border border-neutral-200 rounded-lg" placeholder="TRF-2026-001" />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-1">Information sur le transfert</label>
            <textarea value={information} onChange={(e) => setInformation(e.target.value)} rows={2}
              className="w-full px-3 py-2 border border-neutral-200 rounded-lg" placeholder="Motif du transfert..." />
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
              <option key={a.id} value={a.id}>{a.code} - {a.designation} (Stock: {store.getStockByArticleDepot(a.id, depotSourceId)?.quantite || 0})</option>
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
              <th className="px-3 py-2 text-left text-xs">RÉFÉRENCE</th>
              <th className="px-3 py-2 text-left text-xs">DÉSIGNATION</th>
              <th className="px-3 py-2 text-right text-xs">QTÉ</th>
              <th className="px-3 py-2 text-right text-xs">PRIX ACH. TTC</th>
              <th className="px-3 py-2 text-right text-xs">TOTAL</th>
              <th className="px-3 py-2 text-center text-xs">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {lignes.map((ligne, idx) => (
              <tr key={idx} className="hover:bg-neutral-50">
                <td className="px-3 py-2 text-sm font-mono">{ligne.reference}</td>
                <td className="px-3 py-2 text-sm">{ligne.designation}</td>
                <td className="px-3 py-2 text-sm text-right font-mono">{ligne.quantite}</td>
                <td className="px-3 py-2 text-sm text-right font-mono">{ligne.prix_achat_ttc.toLocaleString('fr-FR')}</td>
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
        <button onClick={validerTransfert} disabled={lignes.length === 0}
          className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-neutral-300 text-white font-bold rounded-lg">
          <CheckIcon className="w-5 h-5" />
          Valider le transfert de stock (F11)
        </button>
      </div>
    </div>
  );
}