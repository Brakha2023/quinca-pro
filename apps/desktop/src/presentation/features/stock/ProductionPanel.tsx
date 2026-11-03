import { useMemo, useState } from 'react';
import { useQuery } from '@powersync/react';
import { EyeIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import type { LigneProductionRow, ProductionRow } from '@quinca/shared-types';
import Bouton from '../../components/ui/Bouton';
import type { Article } from '../../../core/articles';
import { StockInsuffisantError, ecartProduction, ligneProductionFromRow, productionSchema, repartirCoutProduction } from '../../../core/stock';
import {
  LIGNES_PRODUCTION_QUERY,
  ProductionsRepository,
  productionsQuery,
} from '../../../infrastructure/powersync/repositories/ProductionsRepository';
import FormField, { inputClass } from '../../components/ui/FormField';
import Modal from '../../components/ui/Modal';
import { formaterFcfa } from '../../hooks/useFormatage';
import { useRepository } from '../../hooks/useRepository';
import { useNotifier } from '../../notifications/useNotifier';
import { useDepots } from '../articles/hooks';
import { formaterDateHeure } from '../ventes/VenteDetailsModal';
import ArticlePicker from './ArticlePicker';
import { BasculeVue, SelectDepot, boutonPrimaire, boutonSecondaire, type VueOnglet } from './EnteteBon';
import { useStocks } from './hooks';
import { useContexteMouvement } from './useContexteMouvement';

interface LigneMatiereUI { article: Article; quantite: number }
interface LigneProduitUI { article: Article; quantite_prevue: number; quantite: number; pertes: number }

export interface ProductionVueRow extends ProductionRow {
  depot_nom: string | null;
  utilisateur_nom: string | null;
  utilisateur_prenom: string | null;
  quantite_produite: number;
  nombre_lignes: number;
  pertes: number;
  produits: string | null;
}

/** `AAAA-MM-JJTHH:MM` local, pour un `<input type="datetime-local">`. */
function maintenantLocal(): string {
  const d = new Date();
  d.setSeconds(0, 0);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

const cellule = 'px-3 py-2';
const enteteTable = 'bg-neutral-50 text-xs uppercase text-neutral-600';
const champNombre = `${inputClass} text-right font-mono`;

/** Saisie d'une production : matières premières consommées → articles produits, coût de revient calculé. */
function SaisieProduction({ filialeId }: { filialeId: string }) {
  const repository = useRepository(ProductionsRepository);
  const notifier = useNotifier();
  const ctx = useContexteMouvement(filialeId);
  const { depots } = useDepots(filialeId, { actifs: true });

  const [depotId, setDepotId] = useState('');
  const [numero, setNumero] = useState('');
  const [equipe, setEquipe] = useState('');
  const [dateDebut, setDateDebut] = useState(maintenantLocal);
  const [dateFin, setDateFin] = useState('');
  const [commentaire, setCommentaire] = useState('');
  const [matieres, setMatieres] = useState<LigneMatiereUI[]>([]);
  const [produits, setProduits] = useState<LigneProduitUI[]>([]);
  const [enCours, setEnCours] = useState(false);
  const depotEffectif = depotId || depots[0]?.id || '';

  // Stock du dépôt (disponible + coût moyen) pour valoriser les matières à l'écran.
  const { stocks } = useStocks(filialeId, { depotId: depotEffectif || null });
  const etatStock = useMemo(() => new Map(stocks.map((s) => [s.article_id, { disponible: s.quantite_disponible ?? 0, cout_moyen: s.cout_moyen ?? 0 }])), [stocks]);
  const coutMatiere = (l: LigneMatiereUI) => (etatStock.get(l.article.id)?.cout_moyen ?? l.article.prix_achat) * l.quantite;
  const coutMatieres = matieres.reduce((s, l) => s + coutMatiere(l), 0);
  const coutsRevient = useMemo(
    () => repartirCoutProduction(coutMatieres, produits.map((p) => ({ article_id: p.article.id, quantite: p.quantite, prix_achat: p.article.prix_achat }))),
    [coutMatieres, produits],
  );

  const ajouterMatiere = (article: Article) => { if (!matieres.some((l) => l.article.id === article.id)) setMatieres([...matieres, { article, quantite: 1 }]); };
  const ajouterProduit = (article: Article) => { if (!produits.some((l) => l.article.id === article.id)) setProduits([...produits, { article, quantite_prevue: 0, quantite: 0, pertes: 0 }]); };
  const modifierProduit = (i: number, patch: Partial<LigneProduitUI>) => setProduits(produits.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  const nouvelle = () => {
    setNumero(''); setEquipe(''); setDateDebut(maintenantLocal()); setDateFin(''); setCommentaire('');
    setMatieres([]); setProduits([]);
  };

  const enregistrer = async () => {
    const parsed = productionSchema.safeParse({
      depot_id: depotEffectif, numero, equipe, date_debut: dateDebut, date_fin: dateFin, commentaire,
      matieres: matieres.map((l) => ({ article_id: l.article.id, quantite: l.quantite })),
      produits: produits.map((l) => ({ article_id: l.article.id, quantite_prevue: l.quantite_prevue, quantite: l.quantite, pertes: l.pertes })),
    });
    if (!parsed.success) { notifier('erreur', parsed.error.issues[0].message); return; }
    setEnCours(true);
    try {
      const r = await repository.enregistrer(ctx, parsed.data);
      notifier('succes', `Production ${r.numero} enregistrée — matières ${formaterFcfa(r.coutMatieres)}.`);
      nouvelle();
    } catch (error) {
      if (error instanceof StockInsuffisantError) {
        const l = matieres.find((m) => m.article.id === error.articleId);
        notifier('erreur', `Stock insuffisant pour ${l?.article.designation ?? 'une matière'} : ${error.disponible} disponible(s), ${error.demande} demandé(s).`);
      } else {
        notifier('erreur', error instanceof Error ? error.message : 'Enregistrement impossible.');
      }
    } finally {
      setEnCours(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <SelectDepot label="Dépôt" depots={depots} value={depotEffectif} onChange={setDepotId} />
        <FormField label="N° production">
          <input value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="Auto si vide" className={`${inputClass} font-mono`} maxLength={40} />
        </FormField>
        <FormField label="Équipe">
          <input value={equipe} onChange={(e) => setEquipe(e.target.value)} placeholder="Équipe du matin…" className={inputClass} maxLength={60} />
        </FormField>
        <FormField label="Début de production" obligatoire>
          <input type="datetime-local" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} className={inputClass} />
        </FormField>
        <FormField label="Fin de production">
          <input type="datetime-local" value={dateFin} min={dateDebut} onChange={(e) => setDateFin(e.target.value)} className={inputClass} />
        </FormField>
        <FormField label="Coût des matières">
          <p className="px-3 py-2 text-sm font-mono font-semibold text-neutral-800 bg-neutral-50 border border-neutral-200 rounded-lg text-right">{formaterFcfa(coutMatieres)}</p>
        </FormField>
      </div>

      <section className="space-y-2" data-testid="production-matieres">
        <h3 className="text-sm font-semibold text-neutral-800">Matières premières utilisées</h3>
        <ArticlePicker filialeId={filialeId} onSelect={ajouterMatiere} placeholder="Ajouter une matière première (code ou désignation)…" />
        <div className="border border-neutral-200 rounded-lg overflow-hidden">
          <table className="tableau">
            <thead className={enteteTable}>
              <tr>
                <th className={`${cellule} text-left`}>Code / Désignation</th>
                <th className={`${cellule} text-right`}>Stock dispo</th>
                <th className={`${cellule} text-right w-32`}>Quantité</th>
                <th className={`${cellule} text-right`}>Coût moyen</th>
                <th className={`${cellule} text-right`}>Total</th>
                <th className={`${cellule} w-10`} />
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {matieres.map((l, i) => {
                const etat = etatStock.get(l.article.id);
                const insuffisant = l.quantite > (etat?.disponible ?? 0);
                return (
                  <tr key={l.article.id}>
                    <td className={`${cellule} text-sm`}><span className="font-mono text-primary-700 mr-2">{l.article.code}</span>{l.article.designation}<span className="text-neutral-400 text-xs ml-2">{l.article.unite}</span></td>
                    <td className={`${cellule} text-right font-mono text-sm ${insuffisant ? 'text-red-600 font-semibold' : 'text-neutral-600'}`}>{etat?.disponible ?? 0}</td>
                    <td className={cellule}><input type="number" min="0" step="any" value={l.quantite} onChange={(e) => setMatieres(matieres.map((m, j) => (j === i ? { ...m, quantite: Number(e.target.value) } : m)))} className={champNombre} /></td>
                    <td className={`${cellule} text-right font-mono text-sm text-neutral-600`}>{formaterFcfa(etat?.cout_moyen ?? l.article.prix_achat)}</td>
                    <td className={`${cellule} text-right font-mono text-sm`}>{formaterFcfa(coutMatiere(l))}</td>
                    <td className={`${cellule} text-center`}><button type="button" onClick={() => setMatieres(matieres.filter((_, j) => j !== i))} className="p-1 text-red-500 hover:bg-red-50 rounded" title="Retirer"><TrashIcon className="w-4 h-4" /></button></td>
                  </tr>
                );
              })}
              {matieres.length === 0 && <tr><td colSpan={6} className={`${cellule} py-5 text-center text-sm text-neutral-400`}>Aucune matière — recherchez un article ci-dessus.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-2" data-testid="production-produits">
        <h3 className="text-sm font-semibold text-neutral-800">Articles produits</h3>
        <ArticlePicker filialeId={filialeId} onSelect={ajouterProduit} placeholder="Ajouter un article produit…" />
        <div className="border border-neutral-200 rounded-lg overflow-hidden">
          <table className="tableau">
            <thead className={enteteTable}>
              <tr>
                <th className={`${cellule} text-left`}>Désignation</th>
                <th className={`${cellule} text-right w-28`}>Prévue</th>
                <th className={`${cellule} text-right w-28`}>Qté produite</th>
                <th className={`${cellule} text-right`}>Écart</th>
                <th className={`${cellule} text-right w-28`}>Pertes</th>
                <th className={`${cellule} text-right`}>Coût de revient</th>
                <th className={`${cellule} w-10`} />
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {produits.map((l, i) => {
                const ecart = ecartProduction(l.quantite_prevue, l.quantite);
                const cout = coutsRevient.get(l.article.id);
                return (
                  <tr key={l.article.id}>
                    <td className={`${cellule} text-sm`}><span className="font-mono text-primary-700 mr-2">{l.article.code}</span>{l.article.designation}<span className="text-neutral-400 text-xs ml-2">{l.article.unite}</span></td>
                    <td className={cellule}><input type="number" min="0" step="any" value={l.quantite_prevue} onChange={(e) => modifierProduit(i, { quantite_prevue: Number(e.target.value) })} className={champNombre} /></td>
                    <td className={cellule}><input type="number" min="0" step="any" value={l.quantite} onChange={(e) => modifierProduit(i, { quantite: Number(e.target.value) })} className={`${champNombre} font-semibold`} /></td>
                    <td className={`${cellule} text-right font-mono text-sm ${ecart < 0 ? 'text-red-600' : ecart > 0 ? 'text-green-700' : 'text-neutral-500'}`}>{l.quantite_prevue > 0 ? (ecart > 0 ? `+${ecart}` : ecart) : '—'}</td>
                    <td className={cellule}><input type="number" min="0" step="any" value={l.pertes} onChange={(e) => modifierProduit(i, { pertes: Number(e.target.value) })} className={champNombre} /></td>
                    <td className={`${cellule} text-right font-mono text-sm text-neutral-600`}>{cout != null ? `${formaterFcfa(cout)} / ${l.article.unite}` : '—'}</td>
                    <td className={`${cellule} text-center`}><button type="button" onClick={() => setProduits(produits.filter((_, j) => j !== i))} className="p-1 text-red-500 hover:bg-red-50 rounded" title="Retirer"><TrashIcon className="w-4 h-4" /></button></td>
                  </tr>
                );
              })}
              {produits.length === 0 && <tr><td colSpan={7} className={`${cellule} py-5 text-center text-sm text-neutral-400`}>Aucun article produit.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <FormField label="Commentaire">
        <textarea value={commentaire} onChange={(e) => setCommentaire(e.target.value)} rows={2} className={inputClass} maxLength={500} />
      </FormField>

      <div className="flex justify-between gap-3 pt-2 border-t border-neutral-200">
        <button type="button" onClick={nouvelle} className={`${boutonSecondaire} flex items-center gap-2`}><PlusIcon className="w-4 h-4" /> Nouvelle production</button>
        <Bouton type="button" onClick={enregistrer} enCours={enCours} className={boutonPrimaire} disabled={enCours || matieres.length === 0 || produits.length === 0}>Enregistrer la production</Bouton>
      </div>
    </div>
  );
}

/** Détail d'une production : matières consommées et articles produits. */
export function DetailProduction({ production, onClose }: { production: ProductionVueRow; onClose: () => void }) {
  const { data } = useQuery<LigneProductionRow>(LIGNES_PRODUCTION_QUERY, [production.id]);
  const lignes = data.map(ligneProductionFromRow);
  const matieres = lignes.filter((l) => l.sens === 'MATIERE');
  const produits = lignes.filter((l) => l.sens === 'PRODUIT');
  return (
    <Modal
      titre={`Production ${production.numero}`}
      sousTitre={`${formaterDateHeure(production.date_debut)}${production.date_fin ? ` → ${formaterDateHeure(production.date_fin)}` : ''} · ${production.depot_nom ?? ''}${production.equipe ? ` · ${production.equipe}` : ''} · ${[production.utilisateur_prenom, production.utilisateur_nom].filter(Boolean).join(' ')}`}
      largeur="max-w-3xl"
      onClose={onClose}
      pied={<button type="button" onClick={onClose} className={boutonSecondaire}>Fermer</button>}
    >
      <div className="space-y-5">
        <section>
          <h4 className="text-sm font-semibold text-neutral-800 mb-2">Matières premières · {formaterFcfa(production.cout_matieres)}</h4>
          <table className="tableau border border-neutral-200 rounded-lg overflow-hidden">
            <thead className={enteteTable}><tr><th className={`${cellule} text-left`}>Article</th><th className={`${cellule} text-right`}>Qté</th><th className={`${cellule} text-right`}>Coût moyen</th><th className={`${cellule} text-right`}>Total</th></tr></thead>
            <tbody className="divide-y divide-neutral-100">
              {matieres.map((l) => (
                <tr key={l.id}><td className={`${cellule} text-sm`}><span className="font-mono text-primary-700 mr-2">{l.code_article}</span>{l.designation}</td><td className={`${cellule} text-right font-mono text-sm`}>{l.quantite} {l.unite}</td><td className={`${cellule} text-right font-mono text-sm text-neutral-600`}>{formaterFcfa(l.cout_unitaire)}</td><td className={`${cellule} text-right font-mono text-sm`}>{formaterFcfa((l.cout_unitaire ?? 0) * l.quantite)}</td></tr>
              ))}
            </tbody>
          </table>
        </section>
        <section>
          <h4 className="text-sm font-semibold text-neutral-800 mb-2">Articles produits</h4>
          <table className="tableau border border-neutral-200 rounded-lg overflow-hidden">
            <thead className={enteteTable}><tr><th className={`${cellule} text-left`}>Article</th><th className={`${cellule} text-right`}>Prévue</th><th className={`${cellule} text-right`}>Produite</th><th className={`${cellule} text-right`}>Écart</th><th className={`${cellule} text-right`}>Pertes</th><th className={`${cellule} text-right`}>Coût de revient</th></tr></thead>
            <tbody className="divide-y divide-neutral-100">
              {produits.map((l) => {
                const ecart = ecartProduction(l.quantite_prevue, l.quantite);
                return (
                  <tr key={l.id}><td className={`${cellule} text-sm`}><span className="font-mono text-primary-700 mr-2">{l.code_article}</span>{l.designation}</td><td className={`${cellule} text-right font-mono text-sm text-neutral-600`}>{l.quantite_prevue || '—'}</td><td className={`${cellule} text-right font-mono text-sm font-semibold`}>{l.quantite} {l.unite}</td><td className={`${cellule} text-right font-mono text-sm ${ecart < 0 ? 'text-red-600' : 'text-neutral-500'}`}>{l.quantite_prevue > 0 ? ecart : '—'}</td><td className={`${cellule} text-right font-mono text-sm text-orange-700`}>{l.pertes || '—'}</td><td className={`${cellule} text-right font-mono text-sm`}>{l.cout_unitaire != null ? formaterFcfa(l.cout_unitaire) : '—'}</td></tr>
                );
              })}
            </tbody>
          </table>
        </section>
        {production.commentaire && <p className="text-sm text-neutral-600 bg-neutral-50 border border-neutral-200 rounded-lg p-3">{production.commentaire}</p>}
      </div>
    </Modal>
  );
}

function HistoriqueProductions({ filialeId }: { filialeId: string }) {
  const [recherche, setRecherche] = useState('');
  const [detail, setDetail] = useState<ProductionVueRow | null>(null);
  const { sql, params } = useMemo(() => productionsQuery(filialeId, { recherche }), [filialeId, recherche]);
  const { data: productions, isLoading } = useQuery<ProductionVueRow>(sql, params);

  return (
    <div className="space-y-4">
      <input type="search" value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="N°, équipe, article produit…" className={`${inputClass} max-w-md`} />
      <div className="border border-neutral-200 rounded-lg overflow-x-auto">
        <table className="tableau">
          <thead className={enteteTable}>
            <tr>
              <th className={`${cellule} text-left`}>Date</th>
              <th className={`${cellule} text-left`}>N°</th>
              <th className={`${cellule} text-left`}>Dépôt</th>
              <th className={`${cellule} text-left`}>Équipe</th>
              <th className={`${cellule} text-left`}>Produits</th>
              <th className={`${cellule} text-right`}>Qté produite</th>
              <th className={`${cellule} text-right`}>Pertes</th>
              <th className={`${cellule} text-right`}>Coût matières</th>
              <th className={`${cellule} w-10`} />
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {productions.map((p) => (
              <tr key={p.id} className="hover:bg-neutral-50">
                <td className={`${cellule} text-sm text-neutral-600 whitespace-nowrap`}>{formaterDateHeure(p.date_debut)}</td>
                <td className={`${cellule} text-sm font-mono`}>{p.numero}</td>
                <td className={`${cellule} text-sm text-neutral-600`}>{p.depot_nom}</td>
                <td className={`${cellule} text-sm text-neutral-600`}>{p.equipe ?? '—'}</td>
                <td className={`${cellule} text-sm max-w-xs truncate`} title={p.produits ?? ''}>{p.produits}</td>
                <td className={`${cellule} text-sm text-right font-mono font-semibold`}>{p.quantite_produite}</td>
                <td className={`${cellule} text-sm text-right font-mono text-orange-700`}>{p.pertes || '—'}</td>
                <td className={`${cellule} text-sm text-right font-mono`}>{formaterFcfa(p.cout_matieres)}</td>
                <td className={`${cellule} text-center`}><button type="button" onClick={() => setDetail(p)} className="p-1 text-primary-600 hover:bg-primary-50 rounded" title="Détail"><EyeIcon className="w-4 h-4" /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
        {isLoading && <div className="text-center py-12 text-neutral-400">Chargement…</div>}
        {!isLoading && productions.length === 0 && <div className="text-center py-12 text-neutral-400">Aucune production.</div>}
      </div>
      {detail && <DetailProduction production={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}

/** Production : saisie (matières → produits, impact stock, coût de revient) et historique. */
export default function ProductionPanel({ filialeId }: { filialeId: string }) {
  const [vue, setVue] = useState<VueOnglet>('saisie');
  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-neutral-900">Production</h2>
          <p className="text-sm text-neutral-500">Les matières premières sortent du stock au coût moyen ; les articles produits y entrent au coût de revient (pertes comprises).</p>
        </div>
        <BasculeVue vue={vue} onChange={setVue} />
      </div>
      {vue === 'saisie' ? <SaisieProduction filialeId={filialeId} /> : <HistoriqueProductions filialeId={filialeId} />}
    </div>
  );
}
