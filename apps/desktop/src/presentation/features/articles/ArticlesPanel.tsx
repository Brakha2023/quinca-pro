import { useRef, useState, type ChangeEvent } from 'react';
import { ArrowUpTrayIcon, MagnifyingGlassIcon, PencilSquareIcon, PlusIcon, PrinterIcon } from '@heroicons/react/24/outline';
import * as XLSX from 'xlsx';
import { margeArticle, type Article, type LigneImportArticle } from '../../../core/articles';
import { ArticlesRepository } from '../../../infrastructure/powersync/repositories/ArticlesRepository';
import { useRepository } from '../../hooks/useRepository';
import { formaterFcfa } from '../../hooks/useFormatage';
import { useNotifier } from '../../notifications/useNotifier';
import ArticleFormModal from './ArticleFormModal';
import { useArticles, useFamilles } from './hooks';

interface Props {
  filialeId: string;
}

/** Fichier Excel attendu : 4 lignes d'en-tête, puis code | désignation | P.achat | P.vente | famille. */
function lireFichierExcel(data: ArrayBuffer): LigneImportArticle[] {
  const workbook = XLSX.read(data, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 });
  const nombre = (v: unknown) => parseFloat(String(v ?? '').replace(/[\s,]/g, '')) || 0;

  return rows
    .slice(4)
    .filter((row) => row[0] || row[1])
    .map((row) => ({
      code: String(row[0] ?? '').trim(),
      designation: String(row[1] ?? '').trim(),
      prix_achat: nombre(row[2]),
      prix_vente: nombre(row[3]),
      famille_nom: String(row[4] ?? 'DIVERS'),
    }));
}

function BadgeMarge({ article }: { article: Article }) {
  const marge = margeArticle(article);
  const tone = marge < 0 ? 'bg-red-100 text-red-700' : marge < 20 ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700';
  return <span className={`px-2 py-1 rounded-full text-xs font-medium ${tone}`}>{marge}%</span>;
}

export default function ArticlesPanel({ filialeId }: Props) {
  const repository = useRepository(ArticlesRepository);
  const notifier = useNotifier();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [recherche, setRecherche] = useState('');
  const [familleId, setFamilleId] = useState('');
  const [inclureInactifs, setInclureInactifs] = useState(false);
  const [modal, setModal] = useState<{ mode: 'creer' } | { mode: 'modifier'; article: Article } | null>(null);

  const { articles, isLoading } = useArticles(filialeId, { recherche, familleId: familleId || null, inclureInactifs });
  const { familles, famillesParId } = useFamilles(filialeId, { actives: true });

  const handleImportExcel = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const lignes = lireFichierExcel(await file.arrayBuffer());
      const { importes, ignores } = await repository.importMany(filialeId, lignes);
      notifier('succes', `${importes} article(s) importé(s).`);
      if (ignores.length > 0) {
        const detail = ignores.slice(0, 5).map((i) => `ligne ${i.ligne} (${i.code || '—'}) : ${i.raison}`).join('\n');
        notifier('info', `${ignores.length} ligne(s) ignorée(s) :\n${detail}${ignores.length > 5 ? '\n…' : ''}`);
      }
    } catch (error) {
      notifier('erreur', error instanceof Error ? error.message : "Échec de l'import.");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const basculerActif = async (article: Article) => {
    const action = article.est_actif ? 'désactiver' : 'réactiver';
    if (!confirm(`Voulez-vous ${action} l'article ${article.code} — ${article.designation} ?`)) return;
    try {
      await repository.setActif(article.id, !article.est_actif);
      notifier('succes', `Article ${article.code} ${article.est_actif ? 'désactivé' : 'réactivé'}.`);
    } catch (error) {
      notifier('erreur', error instanceof Error ? error.message : 'Opération impossible.');
    }
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-3 print:hidden">
        <div className="flex gap-2 flex-1 min-w-0 flex-wrap">
          <div className="relative flex-1 min-w-[16rem] max-w-md">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
            <input
              type="search"
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder="Rechercher par code ou désignation…"
              className="w-full pl-10 pr-4 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <select
            value={familleId}
            onChange={(e) => setFamilleId(e.target.value)}
            className="px-3 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">Toutes les familles</option>
            {familles.map((f) => (
              <option key={f.id} value={f.id}>{f.nom}</option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm text-neutral-600 px-2">
            <input type="checkbox" checked={inclureInactifs} onChange={(e) => setInclureInactifs(e.target.checked)} className="rounded" />
            Inclure les inactifs
          </label>
        </div>
        <div className="flex gap-2">
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
            onClick={() => setModal({ mode: 'creer' })}
            className="flex items-center gap-2 px-3 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg text-sm"
          >
            <PlusIcon className="w-4 h-4" /> Nouvel article
          </button>
        </div>
      </div>

      <p className="text-sm text-neutral-600">
        <strong>{articles.length}</strong> article(s)
      </p>

      {/* Tableau */}
      <div className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-neutral-50 border-b border-neutral-200">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-neutral-600 uppercase">Code</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-neutral-600 uppercase">Désignation</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-neutral-600 uppercase">Famille</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-neutral-600 uppercase">P. Achat</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-neutral-600 uppercase">P. Vente</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-neutral-600 uppercase">P. VIP</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-neutral-600 uppercase">Marge</th>
                <th className="px-3 py-2 text-center text-xs font-medium text-neutral-600 uppercase">Unité</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-neutral-600 uppercase">Stock min</th>
                <th className="px-3 py-2 text-center text-xs font-medium text-neutral-600 uppercase print:hidden">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {articles.map((article) => (
                <tr key={article.id} className={`hover:bg-neutral-50 transition-colors ${!article.est_actif ? 'opacity-50' : ''}`}>
                  <td className="px-3 py-2 text-sm font-mono font-medium text-primary-700">{article.code}</td>
                  <td className="px-3 py-2 text-sm font-medium text-neutral-900">
                    {article.designation}
                    {!article.est_actif && <span className="ml-2 text-xs text-neutral-500">(inactif)</span>}
                  </td>
                  <td className="px-3 py-2 text-sm">
                    <span className="px-2 py-1 bg-neutral-100 rounded text-xs">
                      {(article.famille_id && famillesParId.get(article.famille_id)?.nom) || '—'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-sm text-right font-mono text-neutral-600">{formaterFcfa(article.prix_achat)}</td>
                  <td className="px-3 py-2 text-sm text-right font-mono font-medium text-neutral-900">{formaterFcfa(article.prix_vente)}</td>
                  <td className="px-3 py-2 text-sm text-right font-mono text-neutral-600">{article.prix_vip != null ? formaterFcfa(article.prix_vip) : '—'}</td>
                  <td className="px-3 py-2 text-sm text-right"><BadgeMarge article={article} /></td>
                  <td className="px-3 py-2 text-sm text-center text-neutral-600">{article.unite}</td>
                  <td className="px-3 py-2 text-sm text-right font-mono text-neutral-600">{article.stock_min}</td>
                  <td className="px-3 py-2 text-center print:hidden">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => setModal({ mode: 'modifier', article })}
                        className="p-1.5 hover:bg-blue-50 rounded text-blue-600"
                        title="Modifier"
                      >
                        <PencilSquareIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => basculerActif(article)}
                        className={`px-2 py-1 rounded text-xs font-medium ${article.est_actif ? 'text-red-600 hover:bg-red-50' : 'text-green-700 hover:bg-green-50'}`}
                      >
                        {article.est_actif ? 'Désactiver' : 'Réactiver'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {isLoading && <div className="text-center py-12 text-neutral-400">Chargement…</div>}
        {!isLoading && articles.length === 0 && (
          <div className="text-center py-12 text-neutral-400">
            <p className="text-lg">Aucun article</p>
            <p className="text-sm mt-1">
              {recherche || familleId ? 'Modifiez vos filtres.' : 'Créez un article ou importez un fichier Excel.'}
            </p>
          </div>
        )}
      </div>

      {modal && (
        <ArticleFormModal
          filialeId={filialeId}
          familles={familles}
          article={modal.mode === 'modifier' ? modal.article : undefined}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
