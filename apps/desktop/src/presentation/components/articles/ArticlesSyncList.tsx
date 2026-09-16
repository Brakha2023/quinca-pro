import { useMemo, useRef, useState, type ChangeEvent } from 'react';
import { usePowerSync, useQuery } from '@powersync/react';
import { ArrowUpTrayIcon, MagnifyingGlassIcon, PlusIcon, PrinterIcon, XMarkIcon } from '@heroicons/react/24/outline';
import * as XLSX from 'xlsx';
import {
  ARTICLES_QUERY,
  ArticlesRepository,
  FAMILLES_QUERY,
  type ArticleRow,
  type FamilleRow,
  type LigneImportArticle,
  type NouvelArticle,
} from '../../../infrastructure/powersync/repositories/ArticlesRepository';
import { useFilialeCourante } from '../../auth/useFilialeCourante';

const ARTICLE_VIDE: NouvelArticle = {
  code: '',
  designation: '',
  famille_id: null,
  prix_achat: 0,
  prix_vente: 0,
  tva: 18,
  stock_min: 10,
  stock_max: 100,
  unite: 'PIECE',
};

/** Lignes du fichier Excel : 4 lignes d'en-tête, puis code | désignation | P.achat | P.vente | famille. */
function lireFichierExcel(data: ArrayBuffer): LigneImportArticle[] {
  const workbook = XLSX.read(data, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 });
  const nombre = (v: unknown) => parseFloat(String(v ?? '').replace(/[\s,]/g, '')) || 0;

  return rows
    .slice(4)
    .filter((row) => row[0] && row[1])
    .map((row) => ({
      code: String(row[0]).trim(),
      designation: String(row[1]).trim(),
      prix_achat: nombre(row[2]),
      prix_vente: nombre(row[3]),
      famille_nom: String(row[4] ?? 'DIVERS'),
    }));
}

function calculerMarge(article: ArticleRow): number {
  const achat = article.prix_achat ?? 0;
  const vente = article.prix_vente ?? 0;
  if (achat <= 0) return 0;
  return Math.round(((vente - achat) / achat) * 100);
}

const fcfa = (n: number | null) => (n ?? 0).toLocaleString('fr-FR');

/**
 * Liste des articles de la filiale courante, lue en temps réel depuis la base locale.
 * Création unitaire et import Excel, fonctionnels hors ligne.
 */
export default function ArticlesSyncList() {
  const db = usePowerSync();
  const repository = useMemo(() => new ArticlesRepository(db), [db]);
  const { filialeId, estVueConsolidee } = useFilialeCourante();

  const { data: articles, isLoading } = useQuery<ArticleRow>(ARTICLES_QUERY, [filialeId]);
  const { data: familles } = useQuery<FamilleRow>(FAMILLES_QUERY, [filialeId]);

  const [recherche, setRecherche] = useState('');
  const [familleFiltre, setFamilleFiltre] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [nouvelArticle, setNouvelArticle] = useState<NouvelArticle>(ARTICLE_VIDE);
  const [message, setMessage] = useState<{ type: 'ok' | 'erreur'; texte: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const famillesParId = useMemo(() => new Map(familles.map((f) => [f.id, f])), [familles]);

  const articlesFiltres = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return articles.filter((a) => {
      const matchRecherche = !q || (a.designation ?? '').toLowerCase().includes(q) || (a.code ?? '').toLowerCase().includes(q);
      const matchFamille = !familleFiltre || a.famille_id === familleFiltre;
      return matchRecherche && matchFamille;
    });
  }, [articles, recherche, familleFiltre]);

  const handleAjouter = async () => {
    if (!filialeId) return;
    if (!nouvelArticle.code.trim() || !nouvelArticle.designation.trim()) {
      setMessage({ type: 'erreur', texte: 'Le code et la désignation sont obligatoires.' });
      return;
    }
    try {
      await repository.create(filialeId, nouvelArticle);
      setMessage({ type: 'ok', texte: `Article ${nouvelArticle.code} créé.` });
      setShowForm(false);
      setNouvelArticle(ARTICLE_VIDE);
    } catch (error) {
      setMessage({ type: 'erreur', texte: error instanceof Error ? error.message : 'Création impossible.' });
    }
  };

  const handleImportExcel = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !filialeId) return;
    try {
      const lignes = lireFichierExcel(await file.arrayBuffer());
      const count = await repository.importMany(filialeId, lignes);
      setMessage({ type: 'ok', texte: `${count} article(s) importé(s).` });
    } catch (error) {
      setMessage({ type: 'erreur', texte: error instanceof Error ? error.message : "Échec de l'import." });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  if (!filialeId) {
    return (
      <div className="text-center py-12 text-neutral-400">
        {estVueConsolidee ? (
          <>
            <p>Sélectionnez une filiale dans le menu latéral.</p>
            <p className="text-sm mt-1">Le catalogue est géré filiale par filiale.</p>
          </>
        ) : (
          <>
            <p>Profil utilisateur en cours de synchronisation…</p>
            <p className="text-sm mt-1">La filiale doit être connue pour afficher les articles.</p>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-2 flex-1 min-w-0">
          <div className="relative flex-1 max-w-md">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
            <input
              type="text"
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder="Rechercher par code ou désignation…"
              className="w-full pl-10 pr-4 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <select
            value={familleFiltre}
            onChange={(e) => setFamilleFiltre(e.target.value)}
            className="px-3 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">Toutes les familles</option>
            {familles.map((f) => (
              <option key={f.id} value={f.id}>{f.nom}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-2 print:hidden">
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleImportExcel} className="hidden" />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-3 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium rounded-lg text-sm"
          >
            <ArrowUpTrayIcon className="w-4 h-4" /> Importer Excel
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-3 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium rounded-lg text-sm"
          >
            <PrinterIcon className="w-4 h-4" /> Imprimer
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-3 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg text-sm"
          >
            <PlusIcon className="w-4 h-4" /> Nouvel article
          </button>
        </div>
      </div>

      {message && (
        <div
          className={`px-4 py-2 rounded-lg text-sm flex items-center justify-between ${
            message.type === 'ok' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          <span>{message.texte}</span>
          <button onClick={() => setMessage(null)} className="p-1 hover:bg-black/5 rounded">
            <XMarkIcon className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="text-sm text-neutral-600">
        <strong>{articlesFiltres.length}</strong> article(s) affiché(s) sur <strong>{articles.length}</strong>
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
              const marge = calculerMarge(article);
              return (
                <tr key={article.id} className="hover:bg-neutral-50 transition-colors">
                  <td className="px-3 py-2 text-sm font-mono font-medium text-primary-700">{article.code}</td>
                  <td className="px-3 py-2 text-sm font-medium text-neutral-900">{article.designation}</td>
                  <td className="px-3 py-2 text-sm">
                    <span className="px-2 py-1 bg-neutral-100 rounded text-xs">
                      {(article.famille_id && famillesParId.get(article.famille_id)?.nom) || '-'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-sm text-right font-mono text-neutral-600">{fcfa(article.prix_achat)}</td>
                  <td className="px-3 py-2 text-sm text-right font-mono font-medium text-neutral-900">{fcfa(article.prix_vente)}</td>
                  <td className="px-3 py-2 text-sm text-right">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${marge >= 20 ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                      {marge}%
                    </span>
                  </td>
                  <td className="px-3 py-2 text-sm text-center text-neutral-600">{article.unite}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {isLoading && <div className="text-center py-12 text-neutral-400">Chargement…</div>}
        {!isLoading && articlesFiltres.length === 0 && (
          <div className="text-center py-12 text-neutral-400">
            <p className="text-lg">Aucun article</p>
            <p className="text-sm mt-1">
              {articles.length === 0 ? 'Créez un article ou importez un fichier Excel.' : 'Modifiez vos filtres.'}
            </p>
          </div>
        )}
      </div>

      {/* Modal Nouvel Article */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 print:hidden">
          <div className="bg-white rounded-xl w-full max-w-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Nouvel article</h3>
              <button onClick={() => setShowForm(false)} className="p-2 hover:bg-neutral-100 rounded-lg">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">Code *</label>
                  <input
                    type="text"
                    value={nouvelArticle.code}
                    onChange={(e) => setNouvelArticle({ ...nouvelArticle, code: e.target.value })}
                    className="w-full px-3 py-2 border border-neutral-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">Famille</label>
                  <select
                    value={nouvelArticle.famille_id ?? ''}
                    onChange={(e) => setNouvelArticle({ ...nouvelArticle, famille_id: e.target.value || null })}
                    className="w-full px-3 py-2 border border-neutral-200 rounded-lg"
                  >
                    <option value="">-- Sélectionner --</option>
                    {familles.map((f) => (
                      <option key={f.id} value={f.id}>{f.nom}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">Désignation *</label>
                <input
                  type="text"
                  value={nouvelArticle.designation}
                  onChange={(e) => setNouvelArticle({ ...nouvelArticle, designation: e.target.value })}
                  className="w-full px-3 py-2 border border-neutral-200 rounded-lg"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">Prix achat</label>
                  <input
                    type="number"
                    value={nouvelArticle.prix_achat}
                    onChange={(e) => setNouvelArticle({ ...nouvelArticle, prix_achat: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-neutral-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">Prix vente</label>
                  <input
                    type="number"
                    value={nouvelArticle.prix_vente}
                    onChange={(e) => setNouvelArticle({ ...nouvelArticle, prix_vente: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-neutral-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">TVA %</label>
                  <input
                    type="number"
                    value={nouvelArticle.tva}
                    onChange={(e) => setNouvelArticle({ ...nouvelArticle, tva: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-neutral-200 rounded-lg"
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button onClick={() => setShowForm(false)} className="flex-1 py-3 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium rounded-lg">
                  Annuler
                </button>
                <button onClick={handleAjouter} className="flex-1 py-3 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg">
                  Créer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
