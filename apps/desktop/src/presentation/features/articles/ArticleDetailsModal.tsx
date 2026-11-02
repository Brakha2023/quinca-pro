import { useMemo, useState } from 'react';
import { DocumentTextIcon, PencilSquareIcon } from '@heroicons/react/24/outline';
import type { TypeMouvementStock } from '@quinca/shared-types';
import {
  LIBELLES_STATUT_STOCK,
  PERIODES_FICHE,
  debutPeriode,
  indicateursArticle,
  type PeriodeFiche,
  type StatutStock,
} from '../../../core/articles';
import { LIBELLES_MOUVEMENT, SENS_MOUVEMENT } from '../../../core/stock';
import Modal from '../../components/ui/Modal';
import { formaterDate, formaterFcfa } from '../../hooks/useFormatage';
import ArticleFormModal from './ArticleFormModal';
import FicheArticleDocument from './FicheArticleDocument';
import { useArticle, useFamilles, useMouvementsArticle, useStockArticle, useVentesArticle, useVentesMensuellesArticle } from './hooks';

const STATUT_STOCK_STYLE: Record<StatutStock, string> = {
  RUPTURE: 'bg-red-100 text-red-700',
  ALERTE: 'bg-orange-100 text-orange-700',
  SURSTOCK: 'bg-blue-100 text-blue-700',
  NORMAL: 'bg-green-100 text-green-700',
};

function Kpi({ label, value, tone = 'text-neutral-900' }: { label: string; value: string; tone?: string }) {
  return (
    <div className="bg-neutral-50 rounded-lg p-3 border border-neutral-200">
      <p className="text-xs text-neutral-500">{label}</p>
      <p className={`text-lg font-bold font-mono ${tone}`}>{value}</p>
    </div>
  );
}

interface Props {
  filialeId: string;
  articleId: string;
  filiale: { nom: string; adresse?: string | null; telephone?: string | null };
  onClose: () => void;
}

/** Fiche article : tarifs, marges, stock par dépôt, activité commerciale, mouvements, et rapport imprimable. */
export default function ArticleDetailsModal({ filialeId, articleId, filiale, onClose }: Props) {
  const [periode, setPeriode] = useState<PeriodeFiche>('90');
  const [vue, setVue] = useState<'modifier' | 'imprimer' | null>(null);

  const article = useArticle(articleId);
  const { famillesParId } = useFamilles(filialeId);
  const { lignes: stock, totaux } = useStockArticle(articleId);
  const jours = PERIODES_FICHE.find((p) => p.id === periode)?.jours ?? 90;
  // Bornes figées : recalculées à chaque rendu, elles relanceraient la requête en boucle.
  const debut = useMemo(() => debutPeriode(jours), [jours]);
  const debutAnnee = useMemo(() => debutPeriode(365), []);
  const { ventes } = useVentesArticle(articleId, debut);
  const ventesMensuelles = useVentesMensuellesArticle(articleId, debutAnnee);
  const { mouvements } = useMouvementsArticle(filialeId, articleId);

  if (!article) return null;
  const familleNom = (article.famille_id && famillesParId.get(article.famille_id)?.nom) || '—';
  const indicateurs = indicateursArticle(article, totaux, ventes, jours);
  const libellePeriode = PERIODES_FICHE.find((p) => p.id === periode)?.label ?? '';

  return (
    <>
      <Modal
        titre={article.designation}
        sousTitre={`${article.code} · ${familleNom} · ${article.unite} · TVA ${article.tva} %${article.est_actif ? '' : ' · inactif'}`}
        largeur="max-w-5xl"
        onClose={onClose}
        pied={
          <>
            <button type="button" onClick={() => setVue('modifier')} className="flex items-center gap-2 px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium rounded-lg"><PencilSquareIcon className="w-4 h-4" /> Modifier</button>
            <button type="button" onClick={() => setVue('imprimer')} className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg" data-testid="imprimer-fiche-article"><DocumentTextIcon className="w-4 h-4" /> Imprimer la fiche</button>
          </>
        }
      >
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Kpi label="Prix d'achat" value={formaterFcfa(article.prix_achat)} />
            <Kpi label="Prix de vente" value={formaterFcfa(article.prix_vente)} />
            <Kpi label="Marge" value={`${formaterFcfa(indicateurs.marge_valeur)} · ${indicateurs.marge_percent} %`} tone={indicateurs.marge_valeur < 0 ? 'text-red-600' : 'text-green-700'} />
            <Kpi label="Stock total" value={`${totaux.quantite} ${article.unite}`} tone={totaux.quantite <= 0 ? 'text-red-600' : 'text-neutral-900'} />
            <Kpi label="Valeur du stock" value={formaterFcfa(totaux.valeur)} tone="text-blue-700" />
          </div>

          <div className="flex items-center gap-3 text-sm flex-wrap">
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUT_STOCK_STYLE[indicateurs.statut_stock]}`} data-testid="statut-stock-article">
              {LIBELLES_STATUT_STOCK[indicateurs.statut_stock]}
            </span>
            <span className="text-neutral-500">Seuils : min <span className="font-mono">{article.stock_min}</span> · max <span className="font-mono">{article.stock_max || '—'}</span></span>
            <span className="text-neutral-500">Disponible : <span className="font-mono">{totaux.disponible}</span> · réservé : <span className="font-mono">{totaux.reservee}</span></span>
            {article.prix_vip != null && <span className="text-neutral-500">Tarif VIP : <span className="font-mono">{formaterFcfa(article.prix_vip)}</span> ({indicateurs.marge_vip_percent} %)</span>}
          </div>

          <section>
            <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
              <h4 className="text-sm font-semibold text-neutral-800">Activité commerciale</h4>
              <select value={periode} onChange={(e) => setPeriode(e.target.value as PeriodeFiche)} className="px-3 py-1.5 border border-neutral-200 rounded-lg text-sm" data-testid="periode-fiche-article">
                {PERIODES_FICHE.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Kpi label="Quantité vendue" value={`${ventes.quantite} ${article.unite}`} />
              <Kpi label="CA HT" value={formaterFcfa(ventes.total_ht)} tone="text-green-700" />
              <Kpi label="Ventes" value={String(ventes.nombre_ventes)} />
              <Kpi label="Couverture du stock" value={indicateurs.couverture_jours != null ? `${indicateurs.couverture_jours} j` : '—'} />
            </div>
            <p className="text-xs text-neutral-500 mt-2">
              Dernière vente : {ventes.derniere_date ? formaterDate(ventes.derniere_date) : 'aucune'}
              {ventes.dernier_prix != null ? ` · dernier prix pratiqué ${formaterFcfa(ventes.dernier_prix)}` : ''}
              {ventes.quantite > 0 ? ` · ${indicateurs.vente_par_jour} ${article.unite} par jour en moyenne` : ''}
            </p>
          </section>

          <section>
            <h4 className="text-sm font-semibold text-neutral-800 mb-2">Stock par dépôt</h4>
            {stock.length === 0 ? (
              <p className="text-sm text-neutral-400">Aucun mouvement de stock : cet article n'est entré dans aucun dépôt.</p>
            ) : (
              <table className="tableau text-sm" data-testid="stock-article">
                <thead className="bg-neutral-50 text-xs uppercase text-neutral-600">
                  <tr><th className="px-3 py-2 text-left">Dépôt</th><th className="px-3 py-2 text-right">Quantité</th><th className="px-3 py-2 text-right">Réservée</th><th className="px-3 py-2 text-right">Disponible</th><th className="px-3 py-2 text-right">Coût moyen</th><th className="px-3 py-2 text-right">Valeur</th></tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {stock.map((l) => (
                    <tr key={l.depot_id}>
                      <td className="px-3 py-2">{l.depot_nom}</td>
                      <td className="px-3 py-2 text-right font-mono">{l.quantite}</td>
                      <td className="px-3 py-2 text-right font-mono text-neutral-500">{l.quantite_reservee}</td>
                      <td className="px-3 py-2 text-right font-mono font-medium">{l.quantite_disponible}</td>
                      <td className="px-3 py-2 text-right font-mono">{formaterFcfa(l.cout_moyen)}</td>
                      <td className="px-3 py-2 text-right font-mono">{formaterFcfa(l.quantite * l.cout_moyen)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section>
            <h4 className="text-sm font-semibold text-neutral-800 mb-2">Derniers mouvements ({mouvements.length})</h4>
            {mouvements.length === 0 ? (
              <p className="text-sm text-neutral-400">Aucun mouvement enregistré.</p>
            ) : (
              <table className="tableau text-sm" data-testid="mouvements-article">
                <thead className="bg-neutral-50 text-xs uppercase text-neutral-600">
                  <tr><th className="px-3 py-2 text-left">Date</th><th className="px-3 py-2 text-left">Nature</th><th className="px-3 py-2 text-left">Dépôt</th><th className="px-3 py-2 text-right">Qté</th><th className="px-3 py-2 text-right">Après</th><th className="px-3 py-2 text-left">Référence</th></tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {mouvements.map((m) => {
                    const type = (m.type ?? 'AJUSTEMENT') as TypeMouvementStock;
                    const entree = SENS_MOUVEMENT[type] >= 0;
                    return (
                      <tr key={m.id}>
                        <td className="px-3 py-2">{formaterDate(m.created_at)}</td>
                        <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${entree ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>{LIBELLES_MOUVEMENT[type]}</span></td>
                        <td className="px-3 py-2 text-neutral-600">{m.depot_nom ?? '—'}</td>
                        <td className="px-3 py-2 text-right font-mono">{entree ? '' : '−'}{m.quantite}</td>
                        <td className="px-3 py-2 text-right font-mono text-neutral-600">{m.quantite_apres}</td>
                        <td className="px-3 py-2 font-mono text-xs text-neutral-500">{m.reference ?? '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </section>
        </div>
      </Modal>

      {vue === 'modifier' && (
        <ArticleFormModal filialeId={filialeId} familles={[...famillesParId.values()]} article={article} onClose={() => setVue(null)} />
      )}
      {vue === 'imprimer' && (
        <FicheArticleDocument
          article={article}
          familleNom={familleNom}
          filiale={filiale}
          stock={stock}
          totaux={totaux}
          indicateurs={indicateurs}
          ventes={ventes}
          ventesMensuelles={ventesMensuelles}
          mouvements={mouvements}
          periode={libellePeriode}
          onClose={() => setVue(null)}
        />
      )}
    </>
  );
}
