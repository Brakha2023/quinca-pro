import { useMemo, useState } from 'react';
import Pagination from '../../components/ui/Pagination';
import { usePagination } from '../../hooks/usePagination';
import { TYPES_BON_INVENTAIRE, inventaireSchema } from '../../../core/stock';
import type { Article } from '../../../core/articles';
import { StockRepository } from '../../../infrastructure/powersync/repositories/StockRepository';
import { inputClass } from '../../components/ui/FormField';
import { useRepository } from '../../hooks/useRepository';
import { useNotifier } from '../../notifications/useNotifier';
import { useDepots } from '../articles/hooks';
import ArticlePicker from './ArticlePicker';
import { BasculeVue, BonImprimable, BoutonImprimerBon, CarteBon, ChampsReferenceMotif, SelectDepot, boutonPrimaire, boutonSecondaire, type InfosFiliale, type VueOnglet } from './EnteteBon';
import HistoriqueBons from './HistoriqueBons';
import { useStocks } from './hooks';
import { useContexteMouvement } from './useContexteMouvement';
import { useConfirmation } from '../../confirmation/useConfirmation';

interface LigneComptage {
  article_id: string;
  code: string;
  designation: string;
  unite: string;
  theorique: number;
  comptee: number | '';
}

/**
 * Inventaire physique d'un dépôt : toutes les lignes de stock du dépôt sont
 * proposées avec leur quantité théorique ; on saisit le compté, l'écart est
 * calculé. Les articles absents du dépôt peuvent être ajoutés (compté > 0).
 */
export default function InventairePanel({ filialeId, filiale }: { filialeId: string; filiale: InfosFiliale }) {
  const repository = useRepository(StockRepository);
  const notifier = useNotifier();
  const confirmer = useConfirmation();
  const ctx = useContexteMouvement(filialeId);
  const { depots } = useDepots(filialeId, { actifs: true });
  const [vue, setVue] = useState<VueOnglet>('saisie');
  const [depotId, setDepotId] = useState('');
  const depotEffectif = depotId || depots[0]?.id || '';
  const { stocks } = useStocks(filialeId, { depotId: depotEffectif || null });

  const [reference, setReference] = useState('');
  const [motif, setMotif] = useState('');
  /** Quantités comptées saisies, par article. */
  const [saisies, setSaisies] = useState<Map<string, number | ''>>(new Map());
  /** Articles absents du dépôt ajoutés à la feuille. */
  const [ajouts, setAjouts] = useState<Article[]>([]);
  const [enCours, setEnCours] = useState(false);
  const [dernierBon, setDernierBon] = useState<string | null>(null);
  const [apercu, setApercu] = useState<string | null>(null);

  // La feuille de comptage est dérivée du stock courant (temps réel) et des saisies : pas d'effet de synchronisation.
  const lignes = useMemo<LigneComptage[]>(() => {
    const depuisStock: LigneComptage[] = stocks.map((s) => ({
      article_id: s.article_id ?? '',
      code: s.article_code ?? '',
      designation: s.article_designation ?? '',
      unite: s.article_unite ?? '',
      theorique: s.quantite ?? 0,
      comptee: saisies.get(s.article_id ?? '') ?? '',
    }));
    const ajoutees: LigneComptage[] = ajouts
      .filter((a) => !depuisStock.some((d) => d.article_id === a.id))
      .map((a) => ({ article_id: a.id, code: a.code, designation: a.designation, unite: a.unite, theorique: 0, comptee: saisies.get(a.id) ?? '' }));
    return [...depuisStock, ...ajoutees];
  }, [stocks, saisies, ajouts]);

  // Un dépôt peut porter des milliers de références : seule la page courante
  // est rendue. Les quantités déjà comptées sont rangées par article et non
  // par rang — changer de page n'en perd aucune.
  const pages = usePagination(lignes.length, [depotEffectif]);

  const ajouterArticle = (article: Article) => {
    if (lignes.some((l) => l.article_id === article.id)) return;
    setAjouts([...ajouts, article]);
  };

  const saisir = (articleId: string, valeur: string) =>
    setSaisies((m) => new Map(m).set(articleId, valeur === '' ? '' : Number(valeur)));
  const effacerSaisie = () => setSaisies(new Map());

  const lignesSaisies = useMemo(() => lignes.filter((l) => l.comptee !== ''), [lignes]);
  const ecarts = lignesSaisies.filter((l) => l.comptee !== l.theorique).length;

  const valider = async () => {
    const parsed = inventaireSchema.safeParse({
      depot_id: depotEffectif, reference, motif,
      lignes: lignesSaisies.map((l) => ({ article_id: l.article_id, quantite_comptee: l.comptee })),
    });
    if (!parsed.success) { notifier('erreur', parsed.error.issues[0].message); return; }
    if (!(await confirmer({ titre: 'Valider l’inventaire', message: `${lignesSaisies.length} article(s) comptés, ${ecarts} écart(s) à régulariser. Les quantités comptées remplaceront le stock actuel.`, libelleConfirmer: 'Valider' }))) return;
    setEnCours(true);
    try {
      const r = await repository.enregistrerInventaire(ctx, parsed.data);
      setDernierBon(r.ecarts > 0 ? r.reference : null);
      notifier('succes', `Inventaire ${r.reference} validé : ${r.ecarts} écart(s) régularisé(s).`);
      effacerSaisie();
      setAjouts([]);
      setReference(''); setMotif('');
    } catch (error) {
      notifier('erreur', error instanceof Error ? error.message : 'Enregistrement impossible.');
    } finally {
      setEnCours(false);
    }
  };

  if (vue === 'historique') {
    return (
      <CarteBon
        titre="Inventaire physique"
        description="Les inventaires déjà validés. Seuls les écarts y figurent : un article compté juste n'a produit aucun mouvement. L'écart net donne le solde du comptage, et la valeur ce que ces écarts représentent."
        bascule={<BasculeVue vue={vue} onChange={setVue} />}
      >
        <HistoriqueBons
          filialeId={filialeId}
          filiale={filiale}
          types={TYPES_BON_INVENTAIRE}
          libelleQuantite="Écart net"
          quantiteSignee
          videMessage="Aucun inventaire validé sur cette période."
        />
      </CarteBon>
    );
  }

  return (
    <CarteBon
      titre="Inventaire physique"
      description="Saisissez la quantité comptée ; seules les lignes renseignées sont prises en compte et seuls les écarts génèrent un mouvement."
      bascule={<BasculeVue vue={vue} onChange={setVue} />}
      actions={
        <>
          {dernierBon && <BoutonImprimerBon reference={dernierBon} onClick={() => setApercu(dernierBon)} />}
          <button type="button" onClick={effacerSaisie} className={boutonSecondaire} disabled={lignesSaisies.length === 0}>Effacer la saisie</button>
          <button type="button" onClick={valider} className={boutonPrimaire} disabled={enCours || lignesSaisies.length === 0}>
            Valider ({lignesSaisies.length} compté(s), {ecarts} écart(s))
          </button>
        </>
      }
    >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SelectDepot label="Dépôt" depots={depots} value={depotEffectif} onChange={setDepotId} />
        <div className="md:col-span-1">
          <label className="block text-xs font-medium text-neutral-700 mb-1">Ajouter un article absent du dépôt</label>
          <ArticlePicker filialeId={filialeId} onSelect={ajouterArticle} />
        </div>
        <ChampsReferenceMotif reference={reference} motif={motif} onReference={setReference} onMotif={setMotif} placeholderMotif="Équipe, observations…" />
      </div>

      <div className="border border-neutral-200 rounded-lg overflow-hidden">
        <table className="tableau">
          <thead className="bg-neutral-50 text-xs uppercase text-neutral-600">
            <tr>
              <th className="px-3 py-2 text-left">Article</th>
              <th className="px-3 py-2 text-right">Théorique</th>
              <th className="px-3 py-2 text-right w-36">Compté</th>
              <th className="px-3 py-2 text-right">Écart</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {pages.trancher(lignes).map((l) => {
              const ecart = l.comptee === '' ? null : l.comptee - l.theorique;
              return (
                <tr key={l.article_id} className={ecart ? 'bg-orange-50/50' : ''}>
                  <td className="px-3 py-2 text-sm"><span className="font-mono text-primary-700 mr-2">{l.code}</span>{l.designation}<span className="text-neutral-400 text-xs ml-2">{l.unite}</span></td>
                  <td className="px-3 py-2 text-right font-mono text-sm">{l.theorique}</td>
                  <td className="px-3 py-2"><input type="number" min="0" step="any" value={l.comptee} onChange={(e) => saisir(l.article_id, e.target.value)} className={`${inputClass} text-right font-mono`} placeholder="—" /></td>
                  <td className={`px-3 py-2 text-right font-mono text-sm font-semibold ${ecart == null ? 'text-neutral-300' : ecart < 0 ? 'text-red-600' : ecart > 0 ? 'text-green-700' : 'text-neutral-400'}`}>
                    {ecart == null ? '—' : ecart > 0 ? `+${ecart}` : ecart}
                  </td>
                </tr>
              );
            })}
            {lignes.length === 0 && <tr><td colSpan={4} className="px-3 py-6 text-center text-sm text-neutral-400">Aucun stock dans ce dépôt — ajoutez des articles pour les compter.</td></tr>}
          </tbody>
        </table>
      </div>

      <Pagination etat={pages} nom="article à compter" data-testid="pagination-inventaire" />
      {apercu && <BonImprimable filialeId={filialeId} filiale={filiale} reference={apercu} onClose={() => setApercu(null)} />}
    </CarteBon>
  );
}
