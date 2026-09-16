import { useState, useRef } from 'react';
import { useStockStore } from '../../../stores/stocks.store';
import { PlusIcon, MagnifyingGlassIcon, XMarkIcon, PrinterIcon, ArrowUpTrayIcon, ArrowPathIcon, EyeIcon, TagIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline';
import * as XLSX from 'xlsx';

export default function ArticlesTab() {
  const store = useStockStore();
  const articles = store.getArticlesFiltres();
  const familles = store.getFamillesActives();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showForm, setShowForm] = useState(false);
  const [showFiche, setShowFiche] = useState(false);
  const [showFamilles, setShowFamilles] = useState(false);
  const [nouvelArticle, setNouvelArticle] = useState({
    code: '', designation: '', famille: 'CARREAU', sous_famille: '',
    prix_achat: 0, prix_vente: 0, prix_vip: 0, tva: 18,
    stock_min: 10, stock_max: 100, unite: 'PIECE',
  });

  const getStockColor = (articleId: string) => {
    const stock = store.getStockTotalByArticle(articleId);
    const article = store.articles.find(a => a.id === articleId);
    if (!article) return 'bg-gray-300';
    if (stock === 0) return 'bg-red-500';
    if (stock <= article.stock_min) return 'bg-orange-500';
    return 'bg-green-500';
  };

  const getStockPercent = (articleId: string) => {
    const stock = store.getStockTotalByArticle(articleId);
    const article = store.articles.find(a => a.id === articleId);
    if (!article) return 0;
    return Math.min((stock / article.stock_max) * 100, 100);
  };

  const handleAjouter = () => {
    if (nouvelArticle.code && nouvelArticle.designation) {
      store.addArticle(nouvelArticle);
      setShowForm(false);
      setNouvelArticle({
        code: '', designation: '', famille: 'CARREAU', sous_famille: '',
        prix_achat: 0, prix_vente: 0, prix_vip: 0, tva: 18,
        stock_min: 10, stock_max: 100, unite: 'PIECE',
      });
      alert('✅ Article créé avec succès !');
    }
  };

  const handleImportExcel = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        const articlesToImport = jsonData.slice(4).map((row: any[]) => ({
          code: String(row[0] || '').trim(),
          designation: String(row[1] || '').trim(),
          prix_achat: parseFloat(String(row[2]).replace(/,/g, '')) || 0,
          prix_vente: parseFloat(String(row[3]).replace(/,/g, '')) || 0,
          famille: String(row[4] || 'DIVERS').trim(),
        })).filter((row) => row.code && row.designation);

        store.importArticles(articlesToImport);
        alert(`✅ ${articlesToImport.length} articles importés avec succès !`);
      } catch (error) {
        console.error('Erreur import Excel:', error);
        alert('❌ Erreur lors de l\'import du fichier Excel');
      }
    };
    reader.readAsBinaryString(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handlePrint = () => window.print();

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-2 flex-1 min-w-0">
          <div className="relative flex-1 max-w-md">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
            <input
              type="text"
              value={store.recherche}
              onChange={(e) => store.setRecherche(e.target.value)}
              placeholder="Rechercher par code ou désignation..."
              className="w-full pl-10 pr-4 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <select
            value={store.familleFiltre}
            onChange={(e) => store.setFamilleFiltre(e.target.value)}
            className="px-3 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="Toutes">Toutes les familles</option>
            {familles.map(f => <option key={f.id}>{f.nom}</option>)}
          </select>
          <select
            value={store.depotFiltre}
            onChange={(e) => store.setDepotFiltre(e.target.value)}
            className="px-3 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="Tous">Tous les dépôts</option>
            {store.depots.map(d => <option key={d.id} value={d.id}>{d.nom}</option>)}
          </select>
          <select
            value={store.statutFiltre}
            onChange={(e) => store.setStatutFiltre(e.target.value)}
            className="px-3 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="Tous">Tous les statuts</option>
            <option value="En stock">En stock</option>
            <option value="Stock faible">Stock faible</option>
            <option value="Rupture">Rupture</option>
          </select>
        </div>
        <div className="flex gap-2">
          <button onClick={handlePrint} className="flex items-center gap-2 px-3 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium rounded-lg text-sm">
            <PrinterIcon className="w-4 h-4" /> Imprimer
          </button>
          <button onClick={() => setShowFamilles(true)} className="flex items-center gap-2 px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg text-sm">
            <TagIcon className="w-4 h-4" /> Familles
          </button>
          <label className="flex items-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg text-sm cursor-pointer">
            <ArrowUpTrayIcon className="w-4 h-4" /> Import Excel
            <input ref={fileInputRef} type="file" accept=".xls,.xlsx" onChange={handleImportExcel} className="hidden" />
          </label>
          <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-3 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg text-sm">
            <PlusIcon className="w-4 h-4" /> Nouvel Article
          </button>
        </div>
      </div>

      {/* Compteur de familles */}
      <div className="flex gap-2 flex-wrap">
        {familles.map(f => {
          const count = store.articles.filter(a => a.famille === f.nom).length;
          return (
            <button
              key={f.id}
              onClick={() => store.setFamilleFiltre(f.nom)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                store.familleFiltre === f.nom
                  ? 'bg-primary-600 text-white'
                  : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
              }`}
            >
              {f.nom} <span className="opacity-70">({count})</span>
            </button>
          );
        })}
      </div>

      {/* Tableau */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-neutral-50 border-b border-neutral-200">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-neutral-600 uppercase">Code</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-neutral-600 uppercase">Désignation</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-neutral-600 uppercase">Famille</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-neutral-600 uppercase">P. Achat</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-neutral-600 uppercase">P. Vente</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-neutral-600 uppercase">Marge</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-neutral-600 uppercase w-48">Stock</th>
              <th className="px-3 py-2 text-center text-xs font-medium text-neutral-600 uppercase">Statut</th>
              <th className="px-3 py-2 text-center text-xs font-medium text-neutral-600 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {articles.map((article) => {
              const stock = store.getStockTotalByArticle(article.id);
              const marge = ((article.prix_vente - article.prix_achat) / article.prix_achat * 100).toFixed(0);
              return (
                <tr key={article.id} className="hover:bg-neutral-50 transition-colors">
                  <td className="px-3 py-2 text-sm font-mono font-medium text-primary-700">{article.code}</td>
                  <td className="px-3 py-2 text-sm font-medium text-neutral-900">{article.designation}</td>
                  <td className="px-3 py-2 text-sm text-neutral-600">
                    <span className="px-2 py-1 bg-neutral-100 rounded text-xs">{article.famille}</span>
                  </td>
                  <td className="px-3 py-2 text-sm text-right font-mono text-neutral-600">{article.prix_achat.toLocaleString('fr-FR')}</td>
                  <td className="px-3 py-2 text-sm text-right font-mono font-medium text-neutral-900">{article.prix_vente.toLocaleString('fr-FR')}</td>
                  <td className="px-3 py-2 text-sm text-right">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${Number(marge) >= 20 ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                      {marge}%
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-neutral-200 rounded-full overflow-hidden">
                        <div className={`h-full ${getStockColor(article.id)} transition-all`} style={{ width: `${getStockPercent(article.id)}%` }} />
                      </div>
                      <span className="text-xs font-mono w-10 text-right">{stock}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      stock === 0 ? 'bg-red-100 text-red-700' :
                      stock <= article.stock_min ? 'bg-orange-100 text-orange-700' :
                      'bg-green-100 text-green-700'
                    }`}>
                      {stock === 0 ? 'Rupture' : stock <= article.stock_min ? 'Faible' : 'OK'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => { store.setArticleSelectionne(article); setShowFiche(true); }}
                        className="p-1.5 hover:bg-blue-50 rounded text-blue-600" title="Fiche article">
                        <EyeIcon className="w-4 h-4" />
                      </button>
                      <button onClick={() => { store.setArticleSelectionne(article); }}
                        className="p-1.5 hover:bg-primary-50 rounded text-primary-600" title="Mouvements">
                        <ArrowPathIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Modal Familles */}
      {showFamilles && (
        <ModalFamilles onClose={() => setShowFamilles(false)} store={store} />
      )}

      {/* Modal Nouvel Article */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Nouvel Article</h3>
              <button onClick={() => setShowForm(false)} className="p-2 hover:bg-neutral-100 rounded-lg">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">Code *</label>
                  <input type="text" value={nouvelArticle.code} onChange={(e) => setNouvelArticle({...nouvelArticle, code: e.target.value})}
                    className="w-full px-3 py-2 border border-neutral-200 rounded-lg" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">Famille</label>
                  <select value={nouvelArticle.famille} onChange={(e) => setNouvelArticle({...nouvelArticle, famille: e.target.value})}
                    className="w-full px-3 py-2 border border-neutral-200 rounded-lg">
                    {store.getFamillesActives().map(f => (
                      <option key={f.id} value={f.nom}>{f.nom}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">Désignation *</label>
                <input type="text" value={nouvelArticle.designation} onChange={(e) => setNouvelArticle({...nouvelArticle, designation: e.target.value})}
                  className="w-full px-3 py-2 border border-neutral-200 rounded-lg" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">Prix achat</label>
                  <input type="number" value={nouvelArticle.prix_achat} onChange={(e) => setNouvelArticle({...nouvelArticle, prix_achat: Number(e.target.value)})}
                    className="w-full px-3 py-2 border border-neutral-200 rounded-lg" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">Prix vente</label>
                  <input type="number" value={nouvelArticle.prix_vente} onChange={(e) => setNouvelArticle({...nouvelArticle, prix_vente: Number(e.target.value)})}
                    className="w-full px-3 py-2 border border-neutral-200 rounded-lg" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">TVA %</label>
                  <input type="number" value={nouvelArticle.tva} onChange={(e) => setNouvelArticle({...nouvelArticle, tva: Number(e.target.value)})}
                    className="w-full px-3 py-2 border border-neutral-200 rounded-lg" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">Stock min</label>
                  <input type="number" value={nouvelArticle.stock_min} onChange={(e) => setNouvelArticle({...nouvelArticle, stock_min: Number(e.target.value)})}
                    className="w-full px-3 py-2 border border-neutral-200 rounded-lg" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">Stock max</label>
                  <input type="number" value={nouvelArticle.stock_max} onChange={(e) => setNouvelArticle({...nouvelArticle, stock_max: Number(e.target.value)})}
                    className="w-full px-3 py-2 border border-neutral-200 rounded-lg" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">Unité</label>
                  <select value={nouvelArticle.unite} onChange={(e) => setNouvelArticle({...nouvelArticle, unite: e.target.value})}
                    className="w-full px-3 py-2 border border-neutral-200 rounded-lg">
                    {['PIECE','M²','M','KG','L','BIDON','ROULEAU','BOITE','CARTON'].map(u => (
                      <option key={u}>{u}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button onClick={() => setShowForm(false)} className="flex-1 py-3 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium rounded-lg">Annuler</button>
                <button onClick={handleAjouter} className="flex-1 py-3 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg">Enregistrer</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Fiche Article */}
      {showFiche && store.articleSelectionne && (
        <FicheArticleModal article={store.articleSelectionne} onClose={() => setShowFiche(false)} store={store} />
      )}
    </div>
  );
}

// ============ MODAL GESTION DES FAMILLES ============
function ModalFamilles({ onClose, store }: { onClose: () => void; store: any }) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [famille, setFamille] = useState({ code: '', nom: '', description: '', est_active: true });

  const handleSave = () => {
    if (!famille.code || !famille.nom) {
      alert('Le code et le nom sont obligatoires');
      return;
    }

    if (editingId) {
      store.updateFamille(editingId, famille);
      alert('✅ Famille modifiée');
    } else {
      store.addFamille(famille);
      alert('✅ Famille créée');
    }

    setShowForm(false);
    setEditingId(null);
    setFamille({ code: '', nom: '', description: '', est_active: true });
  };

  const handleEdit = (f: any) => {
    setFamille({ code: f.code, nom: f.nom, description: f.description || '', est_active: f.est_active });
    setEditingId(f.id);
    setShowForm(true);
  };

  const handleDelete = (f: any) => {
    store.deleteFamille(f.id);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-bold flex items-center gap-2">
              <TagIcon className="w-6 h-6 text-purple-600" />
              Gestion des Familles d'articles
            </h3>
            <p className="text-sm text-neutral-500 mt-1">{store.familles.length} familles enregistrées</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-neutral-100 rounded-lg">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Bouton Nouvelle famille */}
        <div className="mb-4">
          <button onClick={() => { setShowForm(true); setEditingId(null); setFamille({ code: '', nom: '', description: '', est_active: true }); }}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg">
            <PlusIcon className="w-4 h-4" /> Nouvelle famille
          </button>
        </div>

        {/* Formulaire */}
        {showForm && (
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-4">
            <h4 className="font-semibold text-purple-900 mb-3">{editingId ? 'Modifier la famille' : 'Nouvelle famille'}</h4>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">Code *</label>
                <input type="text" value={famille.code} onChange={(e) => setFamille({...famille, code: e.target.value})}
                  className="w-full px-3 py-2 border border-neutral-200 rounded-lg" placeholder="CAR" />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">Nom *</label>
                <input type="text" value={famille.nom} onChange={(e) => setFamille({...famille, nom: e.target.value})}
                  className="w-full px-3 py-2 border border-neutral-200 rounded-lg" placeholder="CARREAU" />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">Description</label>
                <input type="text" value={famille.description} onChange={(e) => setFamille({...famille, description: e.target.value})}
                  className="w-full px-3 py-2 border border-neutral-200 rounded-lg" placeholder="Description..." />
              </div>
            </div>
            <div className="flex items-center gap-2 mt-3">
              <input type="checkbox" id="active" checked={famille.est_active} onChange={(e) => setFamille({...famille, est_active: e.target.checked})}
                className="w-4 h-4" />
              <label htmlFor="active" className="text-sm text-neutral-700">Famille active</label>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={handleSave} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg">
                {editingId ? 'Mettre à jour' : 'Créer'}
              </button>
              <button onClick={() => { setShowForm(false); setEditingId(null); }}
                className="px-4 py-2 bg-neutral-200 hover:bg-neutral-300 text-neutral-700 font-medium rounded-lg">
                Annuler
              </button>
            </div>
          </div>
        )}

        {/* Liste des familles */}
        <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-neutral-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-neutral-600">Code</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-neutral-600">Nom</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-neutral-600">Description</th>
                <th className="px-4 py-2 text-center text-xs font-medium text-neutral-600">Articles</th>
                <th className="px-4 py-2 text-center text-xs font-medium text-neutral-600">Statut</th>
                <th className="px-4 py-2 text-center text-xs font-medium text-neutral-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {store.familles.map((f: any) => {
                const count = store.articles.filter((a: any) => a.famille === f.nom).length;
                return (
                  <tr key={f.id} className="hover:bg-neutral-50">
                    <td className="px-4 py-2 text-sm font-mono font-medium text-purple-700">{f.code}</td>
                    <td className="px-4 py-2 text-sm font-medium">{f.nom}</td>
                    <td className="px-4 py-2 text-sm text-neutral-600">{f.description || '-'}</td>
                    <td className="px-4 py-2 text-sm text-center">
                      <span className="px-2 py-1 bg-neutral-100 rounded-full text-xs font-medium">{count}</span>
                    </td>
                    <td className="px-4 py-2 text-center">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        f.est_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {f.est_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => handleEdit(f)} className="p-1.5 hover:bg-blue-50 rounded text-blue-600" title="Modifier">
                          <PencilIcon className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(f)} className="p-1.5 hover:bg-red-50 rounded text-red-600" title="Supprimer">
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ============ MODAL FICHE ARTICLE ============
function FicheArticleModal({ article, onClose, store }: any) {
  const stock = store.getStockTotalByArticle(article.id);
  const mouvements = store.getMouvementsByArticle(article.id);
  const marge = ((article.prix_vente - article.prix_achat) / article.prix_achat * 100).toFixed(1);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-bold">Fiche Article</h3>
            <p className="text-sm text-neutral-500 mt-1">{article.code}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-neutral-100 rounded-lg">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-neutral-50 p-4 rounded-lg">
            <p className="text-xs text-neutral-500">Désignation</p>
            <p className="font-medium text-sm">{article.designation}</p>
          </div>
          <div className="bg-neutral-50 p-4 rounded-lg">
            <p className="text-xs text-neutral-500">Famille</p>
            <p className="font-medium">{article.famille}</p>
          </div>
          <div className="bg-neutral-50 p-4 rounded-lg">
            <p className="text-xs text-neutral-500">Prix d'achat</p>
            <p className="font-bold font-mono">{article.prix_achat.toLocaleString('fr-FR')} F</p>
          </div>
          <div className="bg-neutral-50 p-4 rounded-lg">
            <p className="text-xs text-neutral-500">Prix de vente</p>
            <p className="font-bold font-mono text-primary-700">{article.prix_vente.toLocaleString('fr-FR')} F</p>
          </div>
          <div className="bg-neutral-50 p-4 rounded-lg">
            <p className="text-xs text-neutral-500">Marge</p>
            <p className="font-bold text-green-600">{marge}%</p>
          </div>
          <div className="bg-neutral-50 p-4 rounded-lg">
            <p className="text-xs text-neutral-500">Stock actuel</p>
            <p className={`font-bold ${stock === 0 ? 'text-red-600' : stock <= article.stock_min ? 'text-orange-600' : 'text-green-600'}`}>
              {stock} {article.unite}
            </p>
          </div>
          <div className="bg-neutral-50 p-4 rounded-lg">
            <p className="text-xs text-neutral-500">Stock min / max</p>
            <p className="font-medium">{article.stock_min} / {article.stock_max}</p>
          </div>
          <div className="bg-neutral-50 p-4 rounded-lg">
            <p className="text-xs text-neutral-500">TVA</p>
            <p className="font-medium">{article.tva}%</p>
          </div>
        </div>

        {/* Stock par dépôt */}
        <div className="mb-6">
          <h4 className="font-semibold mb-3">Stock par dépôt</h4>
          <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-neutral-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-neutral-600">Dépôt</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-neutral-600">Quantité</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-neutral-600">Disponible</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-neutral-600">CMUP</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-neutral-600">Dernier mouvement</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {store.stocks.filter((s: any) => s.article_id === article.id).map((s: any) => {
                  const depot = store.depots.find((d: any) => d.id === s.depot_id);
                  return (
                    <tr key={s.id}>
                      <td className="px-4 py-2 text-sm font-medium">{depot?.nom || 'N/A'}</td>
                      <td className="px-4 py-2 text-sm text-right font-mono">{s.quantite}</td>
                      <td className="px-4 py-2 text-sm text-right font-mono text-green-600">{s.quantite_disponible}</td>
                      <td className="px-4 py-2 text-sm text-right font-mono">{s.cout_moyen.toLocaleString('fr-FR')} F</td>
                      <td className="px-4 py-2 text-sm text-neutral-600">{s.date_dernier_mouvement}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Historique des mouvements */}
        <div>
          <h4 className="font-semibold mb-3">Historique des mouvements ({mouvements.length})</h4>
          <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden max-h-64 overflow-y-auto">
            <table className="w-full">
              <thead className="bg-neutral-50 sticky top-0">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-neutral-600">Date</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-neutral-600">Type</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-neutral-600">Qté</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-neutral-600">Avant</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-neutral-600">Après</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-neutral-600">Référence</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-neutral-600">Motif</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {mouvements.map((m: any) => (
                  <tr key={m.id} className="hover:bg-neutral-50">
                    <td className="px-4 py-2 text-sm">{m.date} {m.heure}</td>
                    <td className="px-4 py-2 text-sm">
                      <span className={`px-2 py-1 rounded text-xs ${
                        m.type.includes('ENTREE') ? 'bg-green-100 text-green-700' :
                        m.type.includes('SORTIE') ? 'bg-red-100 text-red-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>{m.type}</span>
                    </td>
                    <td className="px-4 py-2 text-sm text-right font-mono">{m.quantite}</td>
                    <td className="px-4 py-2 text-sm text-right font-mono text-neutral-600">{m.quantite_avant}</td>
                    <td className="px-4 py-2 text-sm text-right font-mono font-medium">{m.quantite_apres}</td>
                    <td className="px-4 py-2 text-sm font-mono text-primary-700">{m.reference}</td>
                    <td className="px-4 py-2 text-sm text-neutral-600">{m.motif}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}