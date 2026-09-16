import { useState } from 'react';
import { useStockStore } from '../../../stores/stocks.store';
import { PlusIcon, CheckIcon, TrashIcon } from '@heroicons/react/24/outline';

export default function EntreeStockTab() {
  const store = useStockStore();
  const [depotId, setDepotId] = useState(store.depots[0]?.id || '');
  const [dateReception, setDateReception] = useState(new Date().toISOString().split('T')[0]);
  const [conditionnement, setConditionnement] = useState('Achat');
  const [destination, setDestination] = useState('');
  const [numeroBL, setNumeroBL] = useState('');
  const [fournisseurNom, setFournisseurNom] = useState('');
  const [fraisTransport, setFraisTransport] = useState(0);
  const [information, setInformation] = useState('');
  const [lignes, setLignes] = useState<any[]>([]);
  const [nouvelleLigne, setNouvelleLigne] = useState({
    article_id: '', code_ref: '', designation: '', quantite: 0, prix_achat_ttc: 0,
    ancien_prix_achat: 0, ancien_prix_vente: 0, nouveau_prix_vente: 0,
  });

  const total = lignes.reduce((sum, l) => sum + l.total, 0);
  const nombreArticles = lignes.length;
  const nombreColis = lignes.reduce((sum, l) => sum + l.quantite, 0);

  const ajouterLigne = () => {
    if (nouvelleLigne.article_id && nouvelleLigne.quantite > 0) {
      const article = store.articles.find(a => a.id === nouvelleLigne.article_id);
      setLignes([...lignes, {
        ...nouvelleLigne,
        designation: article?.designation || nouvelleLigne.designation,
        code_ref: article?.code || nouvelleLigne.code_ref,
        total: nouvelleLigne.quantite * nouvelleLigne.prix_achat_ttc,
        ancien_prix_achat: article?.prix_achat || 0,
        ancien_prix_vente: article?.prix_vente || 0,
        nouveau_prix_vente: nouvelleLigne.nouveau_prix_vente || article?.prix_vente || 0,
      }]);
      setNouvelleLigne({ article_id: '', code_ref: '', designation: '', quantite: 0, prix_achat_ttc: 0, ancien_prix_achat: 0, ancien_prix_vente: 0, nouveau_prix_vente: 0 });
    }
  };

  const validerEntree = () => {
    if (lignes.length > 0 && depotId) {
      store.creerEntreeStock({
        depot_id: depotId,
        date_reception: dateReception,
        conditionnement,
        destination,
        numero_bl: numeroBL,
        fournisseur_nom: fournisseurNom,
        frais_transport: fraisTransport,
        information,
        lignes,
        total,
        nombre_articles: nombreArticles,
        nombre_colis: nombreColis,
        utilisateur: 'Magasinier',
      });
      alert('✅ Entrée de stock validée avec succès !');
      setLignes([]);
      setFournisseurNom('');
      setNumeroBL('');
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-primary-900 text-white p-4 rounded-lg flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
          <h3 className="font-bold">ENTRÉE DE STOCK</h3>
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
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center gap-4">
        <label className="font-semibold text-blue-900">Dépôt :</label>
        <select value={depotId} onChange={(e) => setDepotId(e.target.value)}
          className="flex-1 px-4 py-2 border border-blue-300 rounded-lg bg-white font-medium focus:ring-2 focus:ring-blue-500">
          {store.depots.map(d => (
            <option key={d.id} value={d.id}>{d.nom} - {d.responsable}</option>
          ))}
        </select>
        <div className="text-sm text-blue-700">
          Responsable : <strong>{store.depots.find(d => d.id === depotId)?.responsable}</strong>
        </div>
      </div>

      {/* Formulaire */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1">Date de réception</label>
              <input type="date" value={dateReception} onChange={(e) => setDateReception(e.target.value)}
                className="w-full px-3 py-2 border border-neutral-200 rounded-lg" />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1">Conditionnement</label>
              <select value={conditionnement} onChange={(e) => setConditionnement(e.target.value)}
                className="w-full px-3 py-2 border border-neutral-200 rounded-lg">
                <option>Achat</option>
                <option>Production</option>
                <option>Retour client</option>
                <option>Don</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1">N° BL / Service</label>
              <input type="text" value={numeroBL} onChange={(e) => setNumeroBL(e.target.value)}
                className="w-full px-3 py-2 border border-neutral-200 rounded-lg" placeholder="BL-2026-001" />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1">Destination</label>
              <input type="text" value={destination} onChange={(e) => setDestination(e.target.value)}
                className="w-full px-3 py-2 border border-neutral-200 rounded-lg" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-1">Fournisseur</label>
            <input type="text" value={fournisseurNom} onChange={(e) => setFournisseurNom(e.target.value)}
              className="w-full px-3 py-2 border border-neutral-200 rounded-lg" placeholder="Nom du fournisseur" />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-1">Information</label>
            <textarea value={information} onChange={(e) => setInformation(e.target.value)} rows={2}
              className="w-full px-3 py-2 border border-neutral-200 rounded-lg" placeholder="Notes..." />
          </div>
        </div>

        {/* Totaux */}
        <div className="bg-neutral-50 p-4 rounded-lg border border-neutral-200">
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1">Nbre d'articles</label>
              <input type="text" value={nombreArticles} readOnly
                className="w-full px-3 py-2 border border-neutral-200 rounded-lg bg-white text-right font-mono" />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1">Nbre de Colis</label>
              <input type="text" value={nombreColis.toLocaleString('fr-FR')} readOnly
                className="w-full px-3 py-2 border border-neutral-200 rounded-lg bg-white text-right font-mono" />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1">Frais de transport</label>
              <input type="number" value={fraisTransport} onChange={(e) => setFraisTransport(Number(e.target.value))}
                className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-right font-mono" />
            </div>
            <div className="bg-black text-yellow-400 p-3 rounded-lg text-center">
              <p className="text-xs">TOTAL</p>
              <p className="text-2xl font-bold font-mono">{total.toLocaleString('fr-FR')}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Ajout ligne */}
      <div className="bg-neutral-50 p-4 rounded-lg border border-neutral-200">
        <div className="grid grid-cols-6 gap-2">
          <select value={nouvelleLigne.article_id} onChange={(e) => {
            const article = store.articles.find(a => a.id === e.target.value);
            setNouvelleLigne({
              ...nouvelleLigne,
              article_id: e.target.value,
              designation: article?.designation || '',
              code_ref: article?.code || '',
              prix_achat_ttc: article?.prix_achat || 0,
            });
          }} className="col-span-2 px-3 py-2 border border-neutral-200 rounded-lg">
            <option value="">-- Sélectionner article --</option>
            {store.articles.map(a => (
              <option key={a.id} value={a.id}>{a.code} - {a.designation}</option>
            ))}
          </select>
          <input type="number" placeholder="Qté" value={nouvelleLigne.quantite || ''} onChange={(e) => setNouvelleLigne({...nouvelleLigne, quantite: Number(e.target.value)})}
            className="px-3 py-2 border border-neutral-200 rounded-lg" />
          <input type="number" placeholder="P. Achat TTC" value={nouvelleLigne.prix_achat_ttc || ''} onChange={(e) => setNouvelleLigne({...nouvelleLigne, prix_achat_ttc: Number(e.target.value)})}
            className="px-3 py-2 border border-neutral-200 rounded-lg" />
          <input type="number" placeholder="Nouv. Prix Vente" value={nouvelleLigne.nouveau_prix_vente || ''} onChange={(e) => setNouvelleLigne({...nouvelleLigne, nouveau_prix_vente: Number(e.target.value)})}
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
              <th className="px-3 py-2 text-right text-xs">PRIX ACH. TTC</th>
              <th className="px-3 py-2 text-right text-xs bg-green-600">TOTAL</th>
              <th className="px-3 py-2 text-right text-xs bg-neutral-500">ANC. PRIX A.</th>
              <th className="px-3 py-2 text-right text-xs bg-neutral-500">ANC. PRIX V.</th>
              <th className="px-3 py-2 text-right text-xs bg-pink-400 text-black">NOUV. PRIX V.</th>
              <th className="px-3 py-2 text-center text-xs">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {lignes.map((ligne, idx) => (
              <tr key={idx} className="hover:bg-neutral-50">
                <td className="px-3 py-2 text-sm font-mono">{ligne.code_ref}</td>
                <td className="px-3 py-2 text-sm">{ligne.designation}</td>
                <td className="px-3 py-2 text-sm text-right font-mono">{ligne.quantite}</td>
                <td className="px-3 py-2 text-sm text-right font-mono">{ligne.prix_achat_ttc.toLocaleString('fr-FR')}</td>
                <td className="px-3 py-2 text-sm text-right font-mono font-bold bg-green-50">{ligne.total.toLocaleString('fr-FR')}</td>
                <td className="px-3 py-2 text-sm text-right font-mono bg-neutral-50">{ligne.ancien_prix_achat.toLocaleString('fr-FR')}</td>
                <td className="px-3 py-2 text-sm text-right font-mono bg-neutral-50">{ligne.ancien_prix_vente.toLocaleString('fr-FR')}</td>
                <td className="px-3 py-2 text-sm text-right font-mono font-bold bg-pink-50">{ligne.nouveau_prix_vente.toLocaleString('fr-FR')}</td>
                <td className="px-3 py-2 text-center">
                  <button onClick={() => setLignes(lignes.filter((_, i) => i !== idx))} className="text-red-600 hover:text-red-700">
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
            {lignes.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-neutral-400">
                  Aucune ligne. Sélectionnez un article pour ajouter.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot className="bg-neutral-100 font-bold">
            <tr>
              <td colSpan={4} className="px-3 py-2 text-sm">TOTAL</td>
              <td className="px-3 py-2 text-sm text-right font-mono bg-green-100">{total.toLocaleString('fr-FR')}</td>
              <td colSpan={4}></td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Bouton Valider */}
      <div className="flex justify-end">
        <button onClick={validerEntree} disabled={lignes.length === 0}
          className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-neutral-300 text-white font-bold rounded-lg">
          <CheckIcon className="w-5 h-5" />
          Valider l'entrée de stock (F11)
        </button>
      </div>
    </div>
  );
}
