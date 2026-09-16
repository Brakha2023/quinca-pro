import { useState, useRef } from 'react';
import { useArticlesStore } from '../../stores/articles.store';
import { useAuditStore } from '../../stores/audits.store';
import { 
  PlusIcon, MagnifyingGlassIcon, XMarkIcon, PrinterIcon, 
  ArrowPathIcon, ArrowUpTrayIcon, BuildingLibraryIcon
} from '@heroicons/react/24/outline';
import * as XLSX from 'xlsx';

export default function ArticlesPage() {
  const articlesStore = useArticlesStore();
  const auditStore = useAuditStore();
  const articles = articlesStore.getArticlesFiltres();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [showForm, setShowForm] = useState(false);
  const [showStockModal, setShowStockModal] = useState(false);
  const [showEntrepotModal, setShowEntrepotModal] = useState(false);
  const [stockUpdate, setStockUpdate] = useState({ 
    articleId: '', quantite: 0, entrepotId: '', motif: '', type: 'AJOUT' as 'AJOUT' | 'RETRAIT' 
  });
  const [nouvelArticle, setNouvelArticle] = useState({
    code_auto: '', designation: '', famille: 'Sanitaire',
    prix_achat: 0, prix_vente_ttc: 0, tva: 18,
    stock: 0, stock_min: 10, depot: articlesStore.entrepotSelectionne,
  });

  const totalArticles = articles.length;
  const valeurStock = articles.reduce((sum, a) => sum + (a.stock * a.prix_achat), 0);
  const alertesStock = articles.filter(a => a.stock <= a.stock_min).length;

  const getStockColor = (article: typeof articles[0]) => {
    if (article.stock === 0) return 'bg-red-500';
    if (article.stock <= article.stock_min) return 'bg-orange-500';
    return 'bg-green-500';
  };

  const getStockPercent = (article: typeof articles[0]) => {
    const max = article.stock_min * 3;
    return Math.min((article.stock / max) * 100, 100);
  };

  const handleAjouter = () => {
    if (nouvelArticle.designation && nouvelArticle.code_auto) {
      articlesStore.addArticle(nouvelArticle);
      auditStore.addLog({
        user_id: '1', user_name: 'Souleymane Cissé',
        action: 'CREATE', module: 'Articles',
        description: `Création article: ${nouvelArticle.designation}`,
        entity_type: 'Article',
        new_value: { code: nouvelArticle.code_auto, designation: nouvelArticle.designation },
      });
      setShowForm(false);
      setNouvelArticle({
        code_auto: '', designation: '', famille: 'Sanitaire',
        prix_achat: 0, prix_vente_ttc: 0, tva: 18,
        stock: 0, stock_min: 10, depot: articlesStore.entrepotSelectionne,
      });
    }
  };

  const handleStockUpdate = () => {
    if (stockUpdate.articleId && stockUpdate.quantite > 0) {
      if (stockUpdate.type === 'AJOUT') {
        articlesStore.ajouterStock(
          stockUpdate.articleId, 
          stockUpdate.quantite, 
          stockUpdate.entrepotId,
          stockUpdate.motif
        );
        auditStore.addLog({
          user_id: '1', user_name: 'Souleymane Cissé',
          action: 'STOCK_IN', module: 'Stock',
          description: `Ajout stock: ${stockUpdate.quantite} unités - ${stockUpdate.motif}`,
          entity_type: 'Article', entity_id: stockUpdate.articleId,
          new_value: { quantite: stockUpdate.quantite, motif: stockUpdate.motif },
        });
      } else {
        articlesStore.retirerStock(
          stockUpdate.articleId, 
          stockUpdate.quantite, 
          stockUpdate.entrepotId,
          stockUpdate.motif
        );
        auditStore.addLog({
          user_id: '1', user_name: 'Souleymane Cissé',
          action: 'STOCK_OUT', module: 'Stock',
          description: `Retrait stock: ${stockUpdate.quantite} unités - ${stockUpdate.motif}`,
          entity_type: 'Article', entity_id: stockUpdate.articleId,
          new_value: { quantite: stockUpdate.quantite, motif: stockUpdate.motif },
        });
      }
      setShowStockModal(false);
      setStockUpdate({ articleId: '', quantite: 0, entrepotId: '', motif: '', type: 'AJOUT' });
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
          code: String(row[0] || ''),
          designation: String(row[1] || ''),
          prix_achat: parseFloat(String(row[2]).replace(/,/g, '')) || 0,
          prix_vente: parseFloat(String(row[3]).replace(/,/g, '')) || 0,
          famille: String(row[4] || 'DIVERS'),
        })).filter((row) => row.code && row.designation);

        articlesStore.importArticles(articlesToImport);
        
        auditStore.addLog({
          user_id: '1', user_name: 'Souleymane Cissé',
          action: 'IMPORT', module: 'Articles',
          description: `Importation de ${articlesToImport.length} articles depuis Excel`,
          entity_type: 'Import',
          new_value: { nombre_articles: articlesToImport.length, fichier: file.name },
        });

        alert(`✅ ${articlesToImport.length} articles importés avec succès !`);
      } catch (error) {
        console.error('Erreur import Excel:', error);
        alert('❌ Erreur lors de l\'import du fichier Excel');
      }
    };
    reader.readAsBinaryString(file);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handlePrint = () => {
    window.print();
    auditStore.addLog({
      user_id: '1', user_name: 'Souleymane Cissé',
      action: 'PRINT', module: 'Articles',
      description: 'Impression de la liste des articles',
      entity_type: 'Report',
    });
  };

  return (
    <div className="space-y-6 print:p-0">
      {/* Header */}
      <div className="flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Articles & Stock</h1>
          <p className="text-sm text-neutral-500 mt-1">
            {totalArticles} articles • Valeur stock: {valeurStock.toLocaleString('fr-FR')} F
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium rounded-lg">
            <PrinterIcon className="w-5 h-5" />
            Imprimer
          </button>
          <label className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg cursor-pointer">
            <ArrowUpTrayIcon className="w-5 h-5" />
            Import Excel
            <input ref={fileInputRef} type="file" accept=".xls,.xlsx" onChange={handleImportExcel} className="hidden" />
          </label>
          <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg">
            <PlusIcon className="w-5 h-5" />
            Nouvel Article
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 print:hidden">
        <div className="bg-white p-6 rounded-xl border border-neutral-200 shadow-sm">
          <p className="text-sm text-neutral-500">Total articles</p>
          <p className="text-2xl font-bold text-neutral-900 mt-2">{totalArticles}</p>
        </div>
        <div className="bg-white p-6 rounded-xl border border-neutral-200 shadow-sm">
          <p className="text-sm text-neutral-500">Valeur du stock</p>
          <p className="text-2xl font-bold text-primary-700 font-mono mt-2">{valeurStock.toLocaleString('fr-FR')} F</p>
        </div>
        <div className="bg-white p-6 rounded-xl border border-neutral-200 shadow-sm">
          <p className="text-sm text-neutral-500">Alertes stock</p>
          <p className={`text-2xl font-bold mt-2 ${alertesStock > 0 ? 'text-orange-600' : 'text-green-600'}`}>{alertesStock}</p>
        </div>
      </div>

      {/* Filtres */}
      <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-sm print:hidden">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
            <input
              type="text"
              value={articlesStore.recherche}
              onChange={(e) => articlesStore.setRecherche(e.target.value)}
              placeholder="Rechercher par code ou désignation..."
              className="w-full pl-10 pr-4 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <select
            value={articlesStore.familleFiltre}
            onChange={(e) => articlesStore.setFamilleFiltre(e.target.value)}
            className="px-4 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="Tous">Toutes les familles</option>
            <option value="Sanitaire">Sanitaire</option>
            <option value="Plomberie">Plomberie</option>
            <option value="Électricité">Électricité</option>
            <option value="Outillage">Outillage</option>
            <option value="Quincaillerie">Quincaillerie</option>
            <option value="Ciment">Ciment</option>
            <option value="Peinture">Peinture</option>
            <option value="Carreau">Carreau</option>
            <option value="DIVERS">DIVERS</option>
          </select>
          <select
            value={articlesStore.entrepotFiltre}
            onChange={(e) => articlesStore.setEntrepotFiltre(e.target.value)}
            className="px-4 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="Tous">Tous les entrepôts</option>
            {articlesStore.entrepots.map(e => (
              <option key={e.id} value={e.id}>{e.nom}</option>
            ))}
          </select>
          <select
            value={articlesStore.statutFiltre}
            onChange={(e) => articlesStore.setStatutFiltre(e.target.value)}
            className="px-4 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="Tous">Tous les statuts</option>
            <option value="En stock">En stock</option>
            <option value="Stock faible">Stock faible</option>
            <option value="Rupture">Rupture</option>
          </select>
        </div>
      </div>

      {/* Tableau des articles */}
      <div className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden">
        <div className="hidden print:block px-6 py-4 border-b border-neutral-200">
          <h2 className="text-xl font-bold text-neutral-900">Liste des Articles & Stock</h2>
          <p className="text-sm text-neutral-600 mt-1">
            {totalArticles} articles • Valeur: {valeurStock.toLocaleString('fr-FR')} FCFA
          </p>
        </div>
        <table className="w-full">
          <thead className="bg-neutral-50 border-b border-neutral-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-neutral-600 uppercase">Code</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-neutral-600 uppercase">Désignation</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-neutral-600 uppercase">Famille</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-neutral-600 uppercase">P. Achat</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-neutral-600 uppercase">P. Vente</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-neutral-600 uppercase">Marge %</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-neutral-600 uppercase w-48">Stock</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-neutral-600 uppercase">Dépôt</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-neutral-600 uppercase">Statut</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-neutral-600 uppercase print:hidden">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {articles.map((article) => {
              const marge = ((article.prix_vente_ttc - article.prix_achat) / article.prix_achat * 100).toFixed(0);
              return (
                <tr key={article.id} className="hover:bg-neutral-50 transition-colors">
                  <td className="px-4 py-3 text-sm font-mono font-medium text-primary-700">{article.code_auto}</td>
                  <td className="px-4 py-3 text-sm font-medium text-neutral-900">{article.designation}</td>
                  <td className="px-4 py-3 text-sm text-neutral-600">{article.famille}</td>
                  <td className="px-4 py-3 text-sm text-right font-mono text-neutral-600">{article.prix_achat.toLocaleString('fr-FR')}</td>
                  <td className="px-4 py-3 text-sm text-right font-mono font-medium text-neutral-900">{article.prix_vente_ttc.toLocaleString('fr-FR')}</td>
                  <td className="px-4 py-3 text-sm text-right">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${Number(marge) >= 20 ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                      {marge}%
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-neutral-200 rounded-full overflow-hidden">
                        <div className={`h-full ${getStockColor(article)} transition-all`} style={{ width: `${getStockPercent(article)}%` }} />
                      </div>
                      <span className="text-xs font-mono w-8 text-right">{article.stock}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-center text-neutral-600">{article.depot}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      article.stock === 0 ? 'bg-red-100 text-red-700' :
                      article.stock <= article.stock_min ? 'bg-orange-100 text-orange-700' :
                      'bg-green-100 text-green-700'
                    }`}>
                      {article.stock === 0 ? 'Rupture' : article.stock <= article.stock_min ? 'Faible' : 'OK'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center print:hidden">
                    <button
                      onClick={() => {
                        setStockUpdate({ articleId: article.id, quantite: article.stock, entrepotId: article.depot, motif: '', type: 'AJOUT' });
                        setShowStockModal(true);
                      }}
                      className="p-2 hover:bg-primary-50 rounded-lg text-primary-600 transition-colors"
                      title="Mettre à jour le stock"
                    >
                      <ArrowPathIcon className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Modal Mise à jour Stock */}
      {showStockModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold mb-4">Mouvement de stock</h3>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setStockUpdate({...stockUpdate, type: 'AJOUT'})}
                  className={`py-2 rounded-lg font-medium ${stockUpdate.type === 'AJOUT' ? 'bg-green-600 text-white' : 'bg-neutral-100 text-neutral-700'}`}>
                  ➕ Ajouter
                </button>
                <button onClick={() => setStockUpdate({...stockUpdate, type: 'RETRAIT'})}
                  className={`py-2 rounded-lg font-medium ${stockUpdate.type === 'RETRAIT' ? 'bg-red-600 text-white' : 'bg-neutral-100 text-neutral-700'}`}>
                  ➖ Retirer
                </button>
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">Quantité</label>
                <input type="number" value={stockUpdate.quantite} onChange={(e) => setStockUpdate({...stockUpdate, quantite: Number(e.target.value)})}
                  className="w-full px-3 py-2 border border-neutral-200 rounded-lg" />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">Motif</label>
                <input type="text" value={stockUpdate.motif} onChange={(e) => setStockUpdate({...stockUpdate, motif: e.target.value})}
                  placeholder="Réception achat, Inventaire, Perte..." className="w-full px-3 py-2 border border-neutral-200 rounded-lg" />
              </div>
              <div className="flex gap-3 pt-4">
                <button onClick={() => setShowStockModal(false)} className="flex-1 py-3 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium rounded-lg">Annuler</button>
                <button onClick={handleStockUpdate} className={`flex-1 py-3 text-white font-medium rounded-lg ${stockUpdate.type === 'AJOUT' ? 'bg-green-600' : 'bg-red-600'}`}>Valider</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Nouvel Article */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 print:hidden">
          <div className="bg-white rounded-xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Nouvel Article</h3>
              <button onClick={() => setShowForm(false)} className="p-2 hover:bg-neutral-100 rounded-lg"><XMarkIcon className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">Code auto *</label>
                  <input type="text" value={nouvelArticle.code_auto} onChange={(e) => setNouvelArticle({...nouvelArticle, code_auto: e.target.value})}
                    className="w-full px-3 py-2 border border-neutral-200 rounded-lg" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">Famille</label>
                  <select value={nouvelArticle.famille} onChange={(e) => setNouvelArticle({...nouvelArticle, famille: e.target.value})}
                    className="w-full px-3 py-2 border border-neutral-200 rounded-lg">
                    {['Sanitaire','Plomberie','Électricité','Outillage','Quincaillerie','Ciment','Peinture','Carreau','DIVERS'].map(f => (<option key={f}>{f}</option>))}
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
                  <label className="block text-xs font-medium text-neutral-700 mb-1">Prix vente TTC</label>
                  <input type="number" value={nouvelArticle.prix_vente_ttc} onChange={(e) => setNouvelArticle({...nouvelArticle, prix_vente_ttc: Number(e.target.value)})}
                    className="w-full px-3 py-2 border border-neutral-200 rounded-lg" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">TVA %</label>
                  <input type="number" value={nouvelArticle.tva} onChange={(e) => setNouvelArticle({...nouvelArticle, tva: Number(e.target.value)})}
                    className="w-full px-3 py-2 border border-neutral-200 rounded-lg" />
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
    </div>
  );
}
