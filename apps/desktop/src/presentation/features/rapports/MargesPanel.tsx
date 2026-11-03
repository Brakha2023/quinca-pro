import { useMemo, useState } from 'react';
import { ArrowDownTrayIcon, ExclamationTriangleIcon, MagnifyingGlassIcon, PrinterIcon } from '@heroicons/react/24/outline';
import Bouton from '../../components/ui/Bouton';
import Pagination from '../../components/ui/Pagination';
import { usePagination } from '../../hooks/usePagination';
import { formaterPourcentage } from '../../../core/commun/prix';
import { debutDuJour, finDuJour } from '../../../core/pilotage';
import {
  alertesMarges, avecParts, filtrerMarges, margesCategories, perimetreMarges, recapMarges,
  trierMarges, TRIS_MARGES, type TriMarges,
} from '../../../core/rapports';
import { exporterExcel } from '../../../infrastructure/desktop/exporterExcel';
import NoteHistorique from '../../components/ui/NoteHistorique';
import { controleInlineClass, inputClass } from '../../components/ui/FormField';
import Indicateur from '../pilotage/Indicateur';
import { formaterFcfa } from '../../hooks/useFormatage';
import { useNotifier } from '../../notifications/useNotifier';
import BarresMarge from './BarresMarge';
import MargesDocument from './MargesDocument';
import { useCategoriesArticles, useMargesArticles } from './hooks';

const aujourdhui = () => new Date().toISOString().slice(0, 10);
const premierDuMois = () => `${new Date().toISOString().slice(0, 7)}-01`;
const premierDeLAnnee = () => `${new Date().toISOString().slice(0, 4)}-01-01`;
const enJour = (date: string) => new Date(`${date}T00:00:00`).toLocaleDateString('fr-FR');

/** Le mois civil précédent, bornes comprises : le mois dont on fait le point. */
function moisDernier(): { debut: string; fin: string } {
  const d = new Date();
  const debut = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1));
  const fin = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 0));
  return { debut: debut.toISOString().slice(0, 10), fin: fin.toISOString().slice(0, 10) };
}

interface Props {
  filialeId: string | null;
  filiale: { nom: string; adresse?: string | null; telephone?: string | null };
}

/**
 * Le rapport des marges : où la maison gagne son argent.
 *
 * Le tableau de bord donne la marge du mois en un chiffre. Ce chiffre ne dit
 * pas s'il vient du ciment, qui tourne vite en ne rapportant rien, ou de la
 * peinture, qui dort en rapportant beaucoup — et c'est pourtant cela qui
 * décide d'une commande, d'un prix ou d'une place en rayon. L'écran éclate
 * donc le même total par catégorie, puis par article.
 *
 * **Ce qui s'affiche est ce qui s'imprime et ce qui s'exporte** : une seule
 * lecture nourrit les tuiles, le graphique, les deux tableaux, la feuille A4
 * et le classeur Excel. Une seconde lecture finirait par dire autre chose.
 */
export default function MargesPanel({ filialeId, filiale }: Props) {
  const notifier = useNotifier();
  const categoriesCatalogue = useCategoriesArticles(filialeId);
  const [dateDebut, setDateDebut] = useState(premierDuMois);
  const [dateFin, setDateFin] = useState(aujourdhui);
  const [familleCle, setFamilleCle] = useState('');
  const [recherche, setRecherche] = useState('');
  const [tri, setTri] = useState<TriMarges>('MARGE');
  const [apercu, setApercu] = useState(false);

  const bornes = useMemo(() => ({ debut: debutDuJour(dateDebut), fin: finDuJour(dateFin) }), [dateDebut, dateFin]);
  const { articles, isLoading } = useMargesArticles(filialeId, bornes);

  // Le filtre s'applique aux articles ; les catégories en découlent, et les
  // parts se posent après — elles se lisent les unes contre les autres.
  const retenus = useMemo(() => filtrerMarges(articles, { familleCle, recherche }), [articles, familleCle, recherche]);
  const categories = useMemo(() => trierMarges(avecParts(margesCategories(retenus)), tri), [retenus, tri]);
  const detail = useMemo(() => trierMarges(avecParts(retenus), tri), [retenus, tri]);
  // Le détail suit la taille du catalogue : seule la page courante est rendue.
  // La feuille A4 et l'export reçoivent `detail` en entier.
  const pages = usePagination(detail.length, [dateDebut, dateFin, familleCle, recherche, tri]);
  const affichesDetail = pages.trancher(detail);
  const recap = recapMarges(retenus);
  const { aPerte, perte } = alertesMarges(retenus);

  const categorieLibelle = familleCle
    ? categoriesCatalogue.find((c) => c.id === familleCle)?.nom ?? (familleCle === 'sans-categorie' ? 'Sans catégorie' : familleCle)
    : null;
  const filtres = { debut: enJour(dateDebut), fin: enJour(dateFin), categorieLibelle, recherche };

  const exporter = async () => {
    try {
      const chemin = await exporterExcel('rapport-marges', [{
        nom: 'Catégories',
        lignes: categories.map((c) => ({
          Catégorie: c.libelle,
          Articles: c.articles,
          Quantité: c.quantite,
          'CA HT': c.ca_ht,
          "Coût d'achat": c.cout,
          Marge: c.marge,
          'Taux %': c.taux_marge,
          'Part marge %': c.part_marge,
        })),
      }, {
        nom: 'Articles',
        lignes: detail.map((l) => ({
          Code: l.code,
          Article: l.libelle,
          Catégorie: l.famille,
          Unité: l.unite,
          Quantité: l.quantite,
          'CA HT': l.ca_ht,
          "Coût d'achat": l.cout,
          Marge: l.marge,
          'Taux %': l.taux_marge,
          'Lignes de vente': l.lignes,
        })),
      }]);
      if (chemin) notifier('succes', `Export enregistré : ${chemin}`);
    } catch (error) {
      notifier('erreur', error instanceof Error ? error.message : 'Export impossible.');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-neutral-200 bg-white p-4 print:hidden">
        <label className="text-sm"><span className="mb-1 block text-xs font-medium text-neutral-700">Du</span><input type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} className={controleInlineClass} data-testid="marges-debut" /></label>
        <label className="text-sm"><span className="mb-1 block text-xs font-medium text-neutral-700">Au</span><input type="date" value={dateFin} onChange={(e) => setDateFin(e.target.value)} className={controleInlineClass} data-testid="marges-fin" /></label>
        <button type="button" onClick={() => { setDateDebut(premierDuMois()); setDateFin(aujourdhui()); }} className="rounded-lg px-3 py-2 text-sm text-primary-700 hover:bg-primary-50">Ce mois</button>
        <button type="button" onClick={() => { const m = moisDernier(); setDateDebut(m.debut); setDateFin(m.fin); }} className="rounded-lg px-3 py-2 text-sm text-primary-700 hover:bg-primary-50" data-testid="marges-mois-dernier">Mois dernier</button>
        <button type="button" onClick={() => { setDateDebut(premierDeLAnnee()); setDateFin(aujourdhui()); }} className="rounded-lg px-3 py-2 text-sm text-primary-700 hover:bg-primary-50">Cette année</button>
        <label className="text-sm">
          <span className="mb-1 block text-xs font-medium text-neutral-700">Catégorie</span>
          <select value={familleCle} onChange={(e) => setFamilleCle(e.target.value)} className={controleInlineClass} data-testid="marges-filtre-categorie">
            <option value="">Toutes les catégories</option>
            {categoriesCatalogue.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
            {/* Les articles sans famille forment une ligne du rapport : on doit pouvoir s'y rendre. */}
            <option value="sans-categorie">Sans catégorie</option>
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs font-medium text-neutral-700">Classer par</span>
          <select value={tri} onChange={(e) => setTri(e.target.value as TriMarges)} className={controleInlineClass} data-testid="marges-tri">
            {TRIS_MARGES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </label>
        <label className="min-w-[12rem] max-w-xs flex-1 text-sm">
          <span className="mb-1 block text-xs font-medium text-neutral-700">Rechercher</span>
          <span className="relative block">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-400" />
            <input type="search" value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Code, article, catégorie…" className={`${inputClass} pl-10`} data-testid="marges-recherche" />
          </span>
        </label>
        <div className="ml-auto flex items-end gap-2">
          <span className="whitespace-nowrap pb-2 text-sm text-neutral-600" data-testid="marges-compteur">
            <strong>{recap.categories}</strong> catégorie(s) · <strong>{recap.articles}</strong> article(s)
          </span>
          <Bouton onClick={() => setApercu(true)} icone={PrinterIcon} className="flex items-center gap-2 rounded-lg bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-200" data-testid="imprimer-marges">Imprimer / PDF</Bouton>
          <Bouton onClick={exporter} icone={ArrowDownTrayIcon} className="flex items-center gap-2 rounded-lg bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-200" data-testid="exporter-marges">Exporter Excel</Bouton>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Indicateur label="Chiffre d'affaires HT" valeur={formaterFcfa(recap.ca_ht)} sous={`${recap.lignes} ligne(s) de vente · remises déduites`} testId="marges-ca" />
        <Indicateur label="Coût d'achat" valeur={formaterFcfa(recap.cout)} sous="Ce que la marchandise vendue a coûté" testId="marges-cout" />
        <Indicateur
          label="Marge commerciale"
          valeur={formaterFcfa(recap.marge)}
          ton={recap.marge < 0 ? 'text-red-600' : 'text-neutral-900'}
          sous="Chiffre d'affaires HT − coût d'achat"
          testId="marges-marge"
        />
        <Indicateur
          label="Taux de marge"
          valeur={formaterPourcentage(recap.taux_marge)}
          ton={recap.taux_marge < 0 ? 'text-red-600' : 'text-neutral-900'}
          sous={`${recap.quantite.toLocaleString('fr-FR')} unité(s) vendue(s)`}
          testId="marges-taux"
        />
      </div>

      {aPerte.length > 0 && (
        <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900" data-testid="marges-alerte-perte">
          <ExclamationTriangleIcon className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>
            <strong>{aPerte.length} article(s) vendu(s) à perte</strong>, {formaterFcfa(perte)} de marge négative :{' '}
            {aPerte.slice(0, 3).map((l) => l.libelle).join(', ')}{aPerte.length > 3 ? '…' : ''}. À vérifier : le prix du
            catalogue, la remise accordée au comptoir, ou un prix d'achat qui a monté sans que le prix de vente suive.
          </span>
        </p>
      )}

      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
        <div className="border-b border-neutral-200 px-5 py-4">
          <h3 className="text-base font-semibold text-neutral-800">Où se fait la marge</h3>
          <p className="mt-0.5 text-sm text-neutral-500">{perimetreMarges(filtres)}</p>
        </div>
        <div className="p-5">
          <BarresMarge lignes={categories} />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
        <p className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 text-sm font-semibold text-neutral-700">
          Marge par catégorie <span className="font-normal text-neutral-500">· {recap.categories} catégorie(s)</span>
        </p>
        <div className="overflow-x-auto">
          <table className="tableau">
            <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase text-neutral-600"><tr>
              <th className="px-3 py-2 text-left">Catégorie</th>
              <th className="px-3 py-2 text-right">Articles</th>
              <th className="px-3 py-2 text-right">Quantité</th>
              <th className="px-3 py-2 text-right">CA HT</th>
              <th className="px-3 py-2 text-right">Coût d'achat</th>
              <th className="px-3 py-2 text-right">Marge</th>
              <th className="px-3 py-2 text-right">Taux</th>
              <th className="px-3 py-2 text-right">Part marge</th>
            </tr></thead>
            <tbody className="divide-y divide-neutral-100">
              {categories.map((c) => (
                <tr key={c.cle} className="cursor-pointer hover:bg-neutral-50" onClick={() => setFamilleCle(c.cle === familleCle ? '' : c.cle)} data-testid="ligne-categorie">
                  <td className="px-3 py-2 text-sm font-medium">{c.libelle}</td>
                  <td className="px-3 py-2 text-right text-sm text-neutral-600">{c.articles}</td>
                  <td className="px-3 py-2 text-right font-mono text-sm text-neutral-600">{c.quantite.toLocaleString('fr-FR')}</td>
                  <td className="px-3 py-2 text-right font-mono text-sm">{formaterFcfa(c.ca_ht)}</td>
                  <td className="px-3 py-2 text-right font-mono text-sm text-neutral-600">{formaterFcfa(c.cout)}</td>
                  <td className={`px-3 py-2 text-right font-mono text-sm font-semibold ${c.marge < 0 ? 'text-red-600' : ''}`}>{formaterFcfa(c.marge)}</td>
                  <td className={`px-3 py-2 text-right font-mono text-sm ${c.marge < 0 ? 'text-red-600' : 'text-neutral-600'}`}>{formaterPourcentage(c.taux_marge)}</td>
                  <td className="px-3 py-2 text-right font-mono text-sm text-neutral-600">{formaterPourcentage(c.part_marge)}</td>
                </tr>
              ))}
            </tbody>
            {categories.length > 0 && (
              <tfoot className="border-t-2 border-neutral-300 bg-amber-50 text-sm font-semibold"><tr>
                <td className="px-3 py-2">Total</td>
                <td className="px-3 py-2 text-right">{recap.articles}</td>
                <td className="px-3 py-2 text-right font-mono">{recap.quantite.toLocaleString('fr-FR')}</td>
                <td className="px-3 py-2 text-right font-mono">{formaterFcfa(recap.ca_ht)}</td>
                <td className="px-3 py-2 text-right font-mono">{formaterFcfa(recap.cout)}</td>
                <td className="px-3 py-2 text-right font-mono" data-testid="total-marge">{formaterFcfa(recap.marge)}</td>
                <td className="px-3 py-2 text-right font-mono">{formaterPourcentage(recap.taux_marge)}</td>
                <td className="px-3 py-2 text-right font-mono">100 %</td>
              </tr></tfoot>
            )}
          </table>
        </div>
        {isLoading && <div className="py-8 text-center text-sm text-neutral-400">Chargement…</div>}
        {!isLoading && categories.length === 0 && <div className="py-8 text-center text-sm text-neutral-400">Rien de vendu dans ce périmètre.</div>}
      </div>

      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
        <p className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 text-sm font-semibold text-neutral-700">
          Détail par article <span className="font-normal text-neutral-500">· classé par {TRIS_MARGES.find((t) => t.id === tri)!.label.toLowerCase()}</span>
        </p>
        <div className="overflow-x-auto">
          <table className="tableau">
            <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase text-neutral-600"><tr>
              <th className="px-3 py-2 text-left">Code</th>
              <th className="px-3 py-2 text-left">Article</th>
              <th className="px-3 py-2 text-left">Catégorie</th>
              <th className="px-3 py-2 text-right">Quantité</th>
              <th className="px-3 py-2 text-right">CA HT</th>
              <th className="px-3 py-2 text-right">Coût d'achat</th>
              <th className="px-3 py-2 text-right">Marge</th>
              <th className="px-3 py-2 text-right">Taux</th>
            </tr></thead>
            <tbody className="divide-y divide-neutral-100">
              {affichesDetail.map((l) => (
                <tr key={l.cle} className="hover:bg-neutral-50" data-testid="ligne-article-marge">
                  <td className="px-3 py-2 font-mono text-sm text-primary-700">{l.code}</td>
                  <td className="max-w-xs truncate px-3 py-2 text-sm" title={l.libelle}>{l.libelle}</td>
                  <td className="px-3 py-2 text-sm text-neutral-600">{l.famille}</td>
                  <td className="px-3 py-2 text-right font-mono text-sm text-neutral-600">{l.quantite.toLocaleString('fr-FR')} {l.unite}</td>
                  <td className="px-3 py-2 text-right font-mono text-sm">{formaterFcfa(l.ca_ht)}</td>
                  <td className="px-3 py-2 text-right font-mono text-sm text-neutral-600">{formaterFcfa(l.cout)}</td>
                  <td className={`px-3 py-2 text-right font-mono text-sm font-semibold ${l.marge < 0 ? 'text-red-600' : ''}`}>{formaterFcfa(l.marge)}</td>
                  <td className={`px-3 py-2 text-right font-mono text-sm ${l.marge < 0 ? 'text-red-600' : 'text-neutral-600'}`}>{formaterPourcentage(l.taux_marge)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!isLoading && detail.length === 0 && <div className="py-8 text-center text-sm text-neutral-400">Aucun article dans ce périmètre.</div>}
      </div>

      <Pagination etat={pages} nom="article" data-testid="pagination-marges" />

      <div className="space-y-1">
        <NoteHistorique quoi="ces ventes" />
        {recap.sorties_sans_cout > 0 && (
          <p className="text-xs text-neutral-500" data-testid="marges-note-cout">
            {recap.sorties_sans_cout} sortie(s) de stock sans coût au journal : valorisée(s) au coût moyen actuel du
            dépôt, faute de mieux. La marge de ces lignes est une estimation.
          </p>
        )}
      </div>

      {apercu && (
        <MargesDocument
          categories={categories}
          articles={detail}
          filiale={filiale}
          filtres={filtres}
          onClose={() => setApercu(false)}
        />
      )}
    </div>
  );
}
