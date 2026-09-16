import { useState, useRef } from 'react';
import { usePowerSyncQuery, usePowerSyncMutation } from '../../../hooks/usePowerSync';
import { PlusIcon, MagnifyingGlassIcon, XMarkIcon, PrinterIcon, ArrowUpTrayIcon } from '@heroicons/react/24/outline';
import * as XLSX from 'xlsx';

interface Article {
  id: string;
  code: string;
  designation: string;
  famille_id: string;
  prix_achat: number;
  prix_vente: number;
  tva: number;
  stock_min: number;
  stock_max: number;
  unite: string;
  filiale_id: string;
}

interface Famille {
  id: string;
  code: string;
  nom: string;
}

export default function ArticlesPowerSyncTab() {
  const { execute } = usePowerSyncMutation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Requêtes PowerSync (temps réel)
  const articles = usePowerSyncQuery<Article>('SELECT * FROM articles ORDER BY designation');
  const familles = usePowerSyncQuery<Famille>('SELECT * FROM familles_articles WHERE est_active = true');
  
  const [recherche, setRecherche] = useState('');
  const [familleFiltre, setFamilleFiltre] = useState('Toutes');
  const [showForm, setShowForm] = useState(false);
  const [nouvelArticle, setNouvelArticle] = useState({
    code: '', designation: '', famille_id: '',
    prix_achat: 0, prix_vente: 0, tva: 18,
    stock_min: 10, stock_max: 100, unite: 'PIECE',
  });

  // Filtrage côté client
  const articlesFiltres = articles.filter(a => {
    const matchRecherche = a.designation.toLowerCase().includes(recherche.toLowerCase()) || 
                          a.code.toLowerCase().includes(recherche.toLowerCase());
    const matchFamille = familleFiltre === 'Toutes' || a.famille_id === familleFiltre;
    return matchRecherche && matchFamille;
  });

  const handleAjouter = async () => {
    if (!nouvelArticle.code || !nouvelArticle.designation) {
      alert('Le code et la désignation sont obligatoires');
      return;
    }

    try {
      // Récupérer la filiale de l'utilisateur (à adapter avec l'auth)
      const filialeId = '00000000-0000-0000-0000-000000000001'; // À remplacer dynamiquement
      
      await execute(
        `INSERT INTO articles (id, code, designation, famille_id, prix_achat, prix_vente, tva, stock_min, stock_max, unite, filiale_id)
         VALUES (uuid_generate_v4(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          nouvelArticle.code,
          nouvelArticle.designation,
          nouvelArticle.famille_id || null,
          nouvelArticle.prix_achat,
          nouvelArticle.prix_vente,
          nouvelArticle.tva,
          nouvelArticle.stock_min,
          nouvelArticle.stock_max,
          nouvelArticle.unite,
          filialeId,
        ]
      );

      alert('✅ Article créé et synchronisé !');
      setShowForm(false);
      setNouvelArticle({
        code: '', designation: '', famille_id: '',
        prix_achat: 0, prix_vente: 0, tva: 18,
        stock_min: 10, stock_max: 100, unite: 'PIECE',
      });
    } catch (err) {
      console.error('Erreur création article:', err);
      alert(' Erreur lors de la création');
    }
  };

  const handleImportExcel = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        // Sauter les 4 premières lignes (en-têtes)
        const articlesToImport = jsonData.slice(4).filter((row: any[]) => row[0] && row[1]);
        
        let count = 0;
        for (const row of articlesToImport) {
          const code = String(row[0]).trim();
          const designation = String(row[1]).trim();
          const prix_achat = parseFloat(String(row[2]).replace(/,/g, '')) || 0;
          const prix_vente = parseFloat(String(row[3]).replace(/,/g, '')) || 0;
          const familleNom = String(row[4] || 'DIVERS').trim();

          // Trouver ou créer la famille
          let familleId = null;
          const familleExistante = familles.find(f => f.nom.toUpperCase() === familleNom.toUpperCase());
          if (familleExistante) {
            familleId = familleExistante.id;
          } else {
            const result = await execute(
              `INSERT INTO familles_articles (id, code, nom, est_active)
               VALUES (uuid_generate_v4(), ?, ?, true)
               RETURNING id`,
              [familleNom.substring(0, 10).toUpperCase(), familleNom]
            );
            familleId = result.rows?._array?.[0]?.id;
          }

          // Insérer l'article
          await execute(
            `INSERT INTO articles (id, code, designation, famille_id, prix_achat, prix_vente, tva, stock_min, stock_max, unite, filiale_id)
             VALUES (uuid_generate_v4(), ?, ?, ?, ?, ?, 18, 10, 100, 'PIECE', '00000000-0000-0000-0000-000000000001')`,
            [code, designation, familleId, prix_achat, prix_vente]
          );
          count++;
        }

        alert(`✅ ${count} articles importés et synchronisés !`);
      } catch (error) {
        console.error('Erreur import:', error);
        alert('❌ Erreur lors de l\'import');
      }
    };
    reader.readAsBinaryString(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="space-y-4">
      {/* Header avec badge PowerSync */}
      <div className="bg-gradient-to-r from-green-500 to-green-600 text-white px-4 py-2 rounded-lg flex items-center gap-2">
        <span className="text-xs font-bold bg-white/20 px-2 py-1 rounded">POWER SYNC</span>
        <span className="text-sm">Mode synchronisé en temps réel</span>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-2 flex-1 min-w-0">
          <div className="relative flex-1 max-w-md">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
            <input
              type="text"
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder="Rechercher..."
              className="w-full pl-10 pr-4 py-2 border border-neutral-200 rounded-lg"
            />
          </div>
          <select
            value={familleFiltre}
            onChange={(e) => setFamilleFiltre(e.target.value)}
            className="px-3 py-2 border border-neutral-200 rounded-lg"
          >
            <option value="Toutes">Toutes les familles</option>
            {familles.map(f => (
              <option key={f.id} value={f.id}>{f.nom}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <button onClick={() => window.print()} className="flex items-center gap-2 px-3 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium rounded-lg text-sm">
            <PrinterIcon className="w-4 h-4" /> Imprimer
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

      {/* Compteur */}
      <div className="text-sm text-neutral-600">
        <strong>{articlesFiltres.length}</strong> article(s) affiché(s) sur <strong>{articles.length}</strong> total
      </div>

      {/* Tableau */}
      <div className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-neutral-50 border-b border-neutral-200">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-neutral-600 uppercase">Code</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-neutral-600 uppercase">Désignation</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-neutral-600 uppercase">Famille</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-neutral-600 uppercase">P. Achat</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-neutral-600 uppercase">P. Vente</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-neutral-600 uppercase">Marge</th>
              <th className="px-3 py-2 text-center text-xs font-medium text-neutral-600 uppercase">Unité</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {articlesFiltres.map((article) => {
              const famille = familles.find(f => f.id === article.famille_id);
              const marge = article.prix_achat > 0 
                ? ((article.prix_vente - article.prix_achat) / article.prix_achat * 100).toFixed(0)
                : '0';
              return (
                <tr key={article.id} className="hover:bg-neutral-50 transition-colors">
                  <td className="px-3 py-2 text-sm font-mono font-medium text-primary-700">{article.code}</td>
                  <td className="px-3 py-2 text-sm font-medium text-neutral-900">{article.designation}</td>
                  <td className="px-3 py-2 text-sm">
                    <span className="px-2 py-1 bg-neutral-100 rounded text-xs">{famille?.nom || '-'}</span>
                  </td>
                  <td className="px-3 py-2 text-sm text-right font-mono text-neutral-600">
                    {article.prix_achat.toLocaleString('fr-FR')}
                  </td>
                  <td className="px-3 py-2 text-sm text-right font-mono font-medium text-neutral-900">
                    {article.prix_vente.toLocaleString('fr-FR')}
                  </td>
                  <td className="px-3 py-2 text-sm text-right">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      Number(marge) >= 20 ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                    }`}>
                      {marge}%
                    </span>
                  </td>
                  <td className="px-3 py-2 text-sm text-center text-neutral-600">{article.unite}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {articlesFiltres.length === 0 && (
          <div className="text-center py-12 text-neutral-400">
            <p className="text-lg">Aucun article trouvé</p>
            <p className="text-sm mt-1">
              {articles.length === 0 
                ? '⏳ En attente de synchronisation avec le serveur...' 
                : 'Essayez de modifier vos filtres'}
            </p>
          </div>
        )}
      </div>

      {/* Modal Nouvel Article */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Nouvel Article (PowerSync)</h3>
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
                  <select value={nouvelArticle.famille_id} onChange={(e) => setNouvelArticle({...nouvelArticle, famille_id: e.target.value})}
                    className="w-full px-3 py-2 border border-neutral-200 rounded-lg">
                    <option value="">-- Sélectionner --</option>
                    {familles.map(f => <option key={f.id} value={f.id}>{f.nom}</option>)}
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
              <div className="flex gap-3 pt-4">
                <button onClick={() => setShowForm(false)} className="flex-1 py-3 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium rounded-lg">Annuler</button>
                <button onClick={handleAjouter} className="flex-1 py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg">
                  Créer et synchroniser
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}