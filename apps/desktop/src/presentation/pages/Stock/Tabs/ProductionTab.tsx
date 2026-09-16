import { useState } from 'react';
import { useStockStore } from '../../../stores/stocks.store';
import { PlusIcon, CheckIcon, TrashIcon } from '@heroicons/react/24/outline';

export default function ProductionTab() {
  const store = useStockStore();
  const [depotId] = useState(store.depots[0]?.id || '');
  const [dateSaisie] = useState(new Date().toISOString().split('T')[0]);
  const [numero, setNumero] = useState('');
  const [equipe, setEquipe] = useState('');
  const [dateDebut, setDateDebut] = useState('');
  const [heureDebut, setHeureDebut] = useState('');
  const [dateFin, setDateFin] = useState('');
  const [heureFin, setHeureFin] = useState('');
  const [nombreBoules, setNombreBoules] = useState(0);
  const [nombrePattesCalculee, setNombrePattesCalculee] = useState(0);
  const [nombrePattesComptee, setNombrePattesComptee] = useState(0);
  const [nombrePattesRetour, setNombrePattesRetour] = useState(0);
  const [matieres, setMatieres] = useState<any[]>([]);
  const [articlesProduits, setArticlesProduits] = useState<any[]>([]);
  const [commentaire, setCommentaire] = useState('');
  const [nouvelleMatiere, setNouvelleMatiere] = useState({ article_id: '', quantite: 0 });
  const [nouveauProduit, setNouveauProduit] = useState({ article_id: '', prevue: 0, qte_produite: 0, pertes: 0, autres: 0 });

  const ajouterMatiere = () => {
    if (nouvelleMatiere.article_id && nouvelleMatiere.quantite > 0) {
      const article = store.articles.find(a => a.id === nouvelleMatiere.article_id);
      setMatieres([...matieres, { ...nouvelleMatiere, code_ref: article?.code, designation: article?.designation }]);
      setNouvelleMatiere({ article_id: '', quantite: 0 });
    }
  };

  const ajouterProduit = () => {
    if (nouveauProduit.article_id) {
      const article = store.articles.find(a => a.id === nouveauProduit.article_id);
      setArticlesProduits([...articlesProduits, {
        ...nouveauProduit,
        article_id: nouveauProduit.article_id,
        designation: article?.designation || '',
        ecart: nouveauProduit.qte_produite - nouveauProduit.prevue,
        consommable: nouveauProduit.qte_produite + nouveauProduit.pertes + nouveauProduit.autres,
      }]);
      setNouveauProduit({ article_id: '', prevue: 0, qte_produite: 0, pertes: 0, autres: 0 });
    }
  };

  const validerProduction = () => {
    if (articlesProduits.length > 0) {
      store.creerProduction({
        depot_id: depotId,
        date_saisie: dateSaisie,
        equipe,
        date_debut: dateDebut,
        heure_debut: heureDebut,
        date_fin: dateFin,
        heure_fin: heureFin,
        petrissage_debut: '', petrissage_fin: '',
        faconnage_debut: '', faconnage_fin: '',
        enfournement_debut: '', enfournement_fin: '',
        nombre_boules: nombreBoules,
        nombre_pattes_calculee: nombrePattesCalculee,
        nombre_pattes_comptee: nombrePattesComptee,
        nombre_pattes_retour: nombrePattesRetour,
        matieres_premieres: matieres,
        articles_produits: articlesProduits,
        commentaire,
        utilisateur: 'Production',
      });
      alert('✅ Production enregistrée avec succès !');
      setMatieres([]);
      setArticlesProduits([]);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-primary-900 text-white p-4 rounded-lg flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 bg-cyan-400 rounded-full animate-pulse"></div>
          <h3 className="font-bold">SAISIE DE PRODUCTION</h3>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="bg-white/20 px-3 py-1 rounded">Dépôt: {store.depots.find(d => d.id === depotId)?.nom}</span>
          <span className="bg-yellow-400 text-black px-3 py-1 rounded font-mono">
            {new Date().toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).toUpperCase()}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Colonne gauche - Infos production */}
        <div className="space-y-3">
          <div className="bg-neutral-50 p-4 rounded-lg border border-neutral-200">
            <h4 className="font-semibold mb-3 text-sm">Informations générales</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">N° Production</label>
                <input type="text" value={numero} onChange={(e) => setNumero(e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-200 rounded-lg" />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">Équipe</label>
                <select value={equipe} onChange={(e) => setEquipe(e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-200 rounded-lg">
                  <option value="">-- Sélectionner --</option>
                  <option>Équipe A</option>
                  <option>Équipe B</option>
                  <option>Équipe C</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">Date début</label>
                <input type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-200 rounded-lg" />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">Heure début</label>
                <input type="time" value={heureDebut} onChange={(e) => setHeureDebut(e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-200 rounded-lg" />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">Date fin</label>
                <input type="date" value={dateFin} onChange={(e) => setDateFin(e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-200 rounded-lg" />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">Heure fin</label>
                <input type="time" value={heureFin} onChange={(e) => setHeureFin(e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-200 rounded-lg" />
              </div>
            </div>
          </div>

          <div className="bg-neutral-50 p-4 rounded-lg border border-neutral-200">
            <h4 className="font-semibold mb-3 text-sm">Production</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">Nombre de boules</label>
                <input type="number" value={nombreBoules} onChange={(e) => setNombreBoules(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-neutral-200 rounded-lg" />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">Nbre pattes calculée</label>
                <input type="number" value={nombrePattesCalculee} onChange={(e) => setNombrePattesCalculee(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-neutral-200 rounded-lg" />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">Nbre pattes comptée</label>
                <input type="number" value={nombrePattesComptee} onChange={(e) => setNombrePattesComptee(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-neutral-200 rounded-lg" />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">Retour</label>
                <input type="number" value={nombrePattesRetour} onChange={(e) => setNombrePattesRetour(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-neutral-200 rounded-lg" />
              </div>
            </div>
          </div>
        </div>

        {/* Colonne droite - Matières premières */}
        <div className="space-y-3">
          <div className="bg-neutral-50 p-4 rounded-lg border border-neutral-200">
            <h4 className="font-semibold mb-3 text-sm">Matières premières utilisées</h4>
            <div className="grid grid-cols-3 gap-2 mb-3">
              <select value={nouvelleMatiere.article_id} onChange={(e) => setNouvelleMatiere({...nouvelleMatiere, article_id: e.target.value})}
                className="col-span-2 px-3 py-2 border border-neutral-200 rounded-lg">
                <option value="">-- Sélectionner --</option>
                {store.articles.map(a => <option key={a.id} value={a.id}>{a.code} - {a.designation}</option>)}
              </select>
              <div className="flex gap-2">
                <input type="number" placeholder="Qté" value={nouvelleMatiere.quantite || ''} onChange={(e) => setNouvelleMatiere({...nouvelleMatiere, quantite: Number(e.target.value)})}
                  className="flex-1 px-3 py-2 border border-neutral-200 rounded-lg" />
                <button onClick={ajouterMatiere} className="bg-green-600 text-white rounded-lg px-3">
                  <PlusIcon className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-neutral-700 text-white">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs">CODE</th>
                    <th className="px-3 py-2 text-left text-xs">DÉSIGNATION</th>
                    <th className="px-3 py-2 text-right text-xs">QTÉ</th>
                    <th className="px-3 py-2 text-center text-xs"></th>
                  </tr>
                </thead>
                <tbody>
                  {matieres.map((m, idx) => (
                    <tr key={idx} className="border-t border-neutral-100">
                      <td className="px-3 py-2 text-sm font-mono">{m.code_ref}</td>
                      <td className="px-3 py-2 text-sm">{m.designation}</td>
                      <td className="px-3 py-2 text-sm text-right font-mono">{m.quantite}</td>
                      <td className="px-3 py-2 text-center">
                        <button onClick={() => setMatieres(matieres.filter((_, i) => i !== idx))} className="text-red-600">
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Articles produits */}
      <div className="bg-neutral-50 p-4 rounded-lg border border-neutral-200">
        <h4 className="font-semibold mb-3 text-sm">Articles produits</h4>
        <div className="grid grid-cols-6 gap-2 mb-3">
          <select value={nouveauProduit.article_id} onChange={(e) => setNouveauProduit({...nouveauProduit, article_id: e.target.value})}
            className="col-span-2 px-3 py-2 border border-neutral-200 rounded-lg">
            <option value="">-- Sélectionner --</option>
            {store.articles.map(a => <option key={a.id} value={a.id}>{a.code} - {a.designation}</option>)}
          </select>
          <input type="number" placeholder="Prévue" value={nouveauProduit.prevue || ''} onChange={(e) => setNouveauProduit({...nouveauProduit, prevue: Number(e.target.value)})}
            className="px-3 py-2 border border-neutral-200 rounded-lg" />
          <input type="number" placeholder="Qté P." value={nouveauProduit.qte_produite || ''} onChange={(e) => setNouveauProduit({...nouveauProduit, qte_produite: Number(e.target.value)})}
            className="px-3 py-2 border border-neutral-200 rounded-lg" />
          <input type="number" placeholder="Pertes" value={nouveauProduit.pertes || ''} onChange={(e) => setNouveauProduit({...nouveauProduit, pertes: Number(e.target.value)})}
            className="px-3 py-2 border border-neutral-200 rounded-lg" />
          <button onClick={ajouterProduit} className="bg-green-600 text-white rounded-lg flex items-center justify-center">
            <PlusIcon className="w-5 h-5" />
          </button>
        </div>
        <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-neutral-700 text-white">
              <tr>
                <th className="px-3 py-2 text-left text-xs">DÉSIGNATION</th>
                <th className="px-3 py-2 text-right text-xs">PRÉVUE</th>
                <th className="px-3 py-2 text-right text-xs bg-yellow-400 text-black">QTÉ P.</th>
                <th className="px-3 py-2 text-right text-xs">ÉCART</th>
                <th className="px-3 py-2 text-right text-xs">PERTES</th>
                <th className="px-3 py-2 text-right text-xs">AUTRES</th>
                <th className="px-3 py-2 text-right text-xs">CONSOMMABLE</th>
                <th className="px-3 py-2 text-center text-xs"></th>
              </tr>
            </thead>
            <tbody>
              {articlesProduits.map((p, idx) => (
                <tr key={idx} className="border-t border-neutral-100">
                  <td className="px-3 py-2 text-sm">{p.designation}</td>
                  <td className="px-3 py-2 text-sm text-right font-mono">{p.prevue}</td>
                  <td className="px-3 py-2 text-sm text-right font-mono font-bold bg-yellow-50">{p.qte_produite}</td>
                  <td className="px-3 py-2 text-sm text-right font-mono">{p.ecart}</td>
                  <td className="px-3 py-2 text-sm text-right font-mono">{p.pertes}</td>
                  <td className="px-3 py-2 text-sm text-right font-mono">{p.autres}</td>
                  <td className="px-3 py-2 text-sm text-right font-mono">{p.consommable}</td>
                  <td className="px-3 py-2 text-center">
                    <button onClick={() => setArticlesProduits(articlesProduits.filter((_, i) => i !== idx))} className="text-red-600">
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Commentaire */}
      <div>
        <label className="block text-xs font-medium text-neutral-700 mb-1">Commentaire</label>
        <textarea value={commentaire} onChange={(e) => setCommentaire(e.target.value)} rows={3}
          className="w-full px-3 py-2 border border-neutral-200 rounded-lg" placeholder="Observations..." />
      </div>

      {/* Boutons */}
      <div className="flex justify-between">
        <button className="flex items-center gap-2 px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium rounded-lg">
          <PlusIcon className="w-5 h-5" /> Nouvelle production
        </button>
        <button onClick={validerProduction} disabled={articlesProduits.length === 0}
          className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-neutral-300 text-white font-bold rounded-lg">
          <CheckIcon className="w-5 h-5" />
          Enregistrer la production
        </button>
      </div>
    </div>
  );
}
