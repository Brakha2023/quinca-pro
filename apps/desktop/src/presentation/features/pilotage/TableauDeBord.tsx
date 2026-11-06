import { useMemo } from 'react';
import Carte from '../../components/ui/Carte';
import { ArrowTrendingUpIcon, BanknotesIcon, BuildingLibraryIcon, BuildingOffice2Icon, ChartBarIcon, ClipboardDocumentCheckIcon, ClockIcon, CubeIcon, ExclamationTriangleIcon, ScaleIcon, ShoppingCartIcon, Squares2X2Icon, StarIcon, TruckIcon, UserIcon } from '@heroicons/react/24/outline';
import { formaterFcfa, formaterPourcentage } from '../../../core/commun/prix';
import {
  classement, dormantsLesPlusLourds, evolution, fenetrePrecedente, pointsDeVigilance, type Fenetre,
} from '../../../core/pilotage';
import AncienneteCreances from './AncienneteCreances';
import BarresClassement from './BarresClassement';
import EtatStock from './EtatStock';
import HistogrammeCaMarge from './HistogrammeCaMarge';
import Indicateur from './Indicateur';
import { usePerimetre, type LecturePilotage } from './hooks';

/**
 * Le tableau de bord, une seule fois pour deux lecteurs.
 *
 * Un gérant le lit sur sa filiale, un directeur sur le groupe entier : même
 * disposition, mêmes calculs, seul le périmètre change. C'est voulu — deux
 * tableaux de bord qui se ressemblent finissent par ne plus dire la même
 * chose du même chiffre.
 *
 * L'ordre de lecture est celui des questions d'un patron de quincaillerie :
 * ce que j'ai vendu, ce que j'ai gagné, ce qu'on me doit et ce que je dois,
 * puis où dort mon argent.
 */

interface Props {
  fenetre: Fenetre;
  /** Nul : tout ce que ce poste reçoit (vue groupe). */
  filialeId: string | null;
  /** Lue une seule fois par la page, et partagée avec la feuille imprimée. */
  lecture: LecturePilotage;
  /** Vue groupe : la comparaison entre filiales a un sens. */
  comparerFiliales?: boolean;
}

export default function TableauDeBord({ fenetre, filialeId, lecture, comparerFiliales = false }: Props) {
  const { total, filiales, serie, repartition, lignesStock, anciennete, familles, clients, articles } = lecture;
  // La période d'avant ne sert qu'aux évolutions : elle reste ici.
  const precedente = useMemo(() => fenetrePrecedente(fenetre), [fenetre]);
  const { total: avant } = usePerimetre(precedente, filialeId);

  // En vue groupe, « en route » et « à recevoir » décrivent le même billet à deux
  // endroits : on ne l'annonce qu'une fois, du côté de la caisse qui s'est vidée.
  const vueGroupe = filialeId === null;
  const vigilance = pointsDeVigilance(total, repartition.ruptures, vueGroupe);
  const dormants = useMemo(() => dormantsLesPlusLourds(lignesStock, 5), [lignesStock]);

  const parFiliale = useMemo(
    () => classement(filiales.map((f) => ({
      cle: f.filiale_id,
      libelle: f.filiale_nom,
      valeur: f.ca_ttc,
      detail: `marge ${formaterPourcentage(f.taux_marge)}`,
    })), 8),
    [filiales],
  );

  const reference = precedente.libelle;
  const ecartCreances = Math.abs(total.creances - anciennete.total);

  /* Les fonds qui voyagent ne sont dans aucune caisse : sans cette ligne, ils
     ne figureraient sur aucun tableau. Montrés à part, jamais additionnés à la
     trésorerie — on ne paie pas un fournisseur avec des billets en voiture. */
  const horsCaisses = [
    total.fonds_en_transit > 0 && `${formaterFcfa(total.fonds_en_transit)} en route`,
    !vueGroupe && total.fonds_a_recevoir > 0 && `${formaterFcfa(total.fonds_a_recevoir)} à recevoir`,
  ].filter((part): part is string => typeof part === 'string');

  /* La marchandise entre deux filiales : sortie d'un dépôt, entrée dans aucun.
     La valeur du stock ne la compte pas — elle n'est plus en rayon —, et sans
     cette ligne un chargement de deux jours n'apparaîtrait nulle part. */
  const horsDepots = [
    total.stock_en_transit > 0 && `${formaterFcfa(total.stock_en_transit)} en route`,
    !vueGroupe && total.stock_a_recevoir > 0 && `${formaterFcfa(total.stock_a_recevoir)} à recevoir`,
  ].filter((part): part is string => typeof part === 'string');

  return (
    <div className="space-y-6">
      {/* Ce que j'ai vendu, ce que j'ai gagné. */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Indicateur
          label="Chiffre d'affaires TTC"
          valeur={formaterFcfa(total.ca_ttc)}
          evolution={evolution(total.ca_ttc, avant.ca_ttc)}
          reference={reference}
          sens="HAUT_BON"
          ton="text-primary-700"
          sous={`${total.ventes} vente(s) · panier moyen ${formaterFcfa(total.panier_moyen)}`}
          couleur="bleu" icone={BanknotesIcon}
          testId="kpi-ca"
        />
        <Indicateur
          label="Marge commerciale"
          valeur={formaterFcfa(total.marge)}
          evolution={evolution(total.marge, avant.marge)}
          reference={reference}
          sens="HAUT_BON"
          ton={total.marge < 0 ? 'text-red-600' : 'text-neutral-900'}
          sous={`${formaterPourcentage(total.taux_marge)} du CA HT · coût d'achat ${formaterFcfa(total.cout_ventes)}`}
          couleur="orange" icone={ArrowTrendingUpIcon}
          testId="kpi-marge"
        />
        <Indicateur
          label="Résultat estimé"
          valeur={formaterFcfa(total.resultat)}
          sens="HAUT_BON"
          ton={total.resultat < 0 ? 'text-red-600' : 'text-green-700'}
          sous={`marge moins ${formaterFcfa(total.charges)} de dépenses passées en caisse`}
          couleur="ambre" icone={ScaleIcon}
          testId="kpi-resultat"
        />
        <Indicateur
          label="Trésorerie"
          valeur={formaterFcfa(total.tresorerie)}
          ton={total.tresorerie < 0 ? 'text-red-600' : 'text-green-700'}
          sous={
            horsCaisses.length > 0
              ? `+ ${horsCaisses.join(' · ')}, pas encore en caisse`
              : `encaissé sur la période ${formaterFcfa(total.encaisse)}`
          }
          couleur="vert" icone={BuildingLibraryIcon}
          testId="kpi-tresorerie"
        />
      </div>

      {/* Ce qu'on me doit, ce que je dois, ce que je détiens. */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Indicateur
          label="Créances clients"
          valeur={formaterFcfa(total.creances)}
          sens="BAS_BON"
          ton={total.creances > 0 ? 'text-red-600' : 'text-neutral-900'}
          sous={anciennete.au_dela_de_90 > 0 ? `dont ${formaterFcfa(anciennete.au_dela_de_90)} à plus de 90 jours` : `${total.clients_servis} client(s) servi(s)`}
          couleur="rouge" icone={UserIcon}
          testId="kpi-creances"
        />
        <Indicateur
          label="Dettes fournisseurs"
          valeur={formaterFcfa(total.dettes)}
          sens="BAS_BON"
          ton={total.dettes > 0 ? 'text-orange-700' : 'text-neutral-900'}
          sous={`${total.commandes_ouvertes} commande(s) encore ouverte(s)`}
          couleur="orange" icone={TruckIcon}
          testId="kpi-dettes"
        />
        <Indicateur
          label="Valeur du stock"
          valeur={formaterFcfa(total.valeur_stock)}
          sous={
            horsDepots.length > 0
              ? `+ ${horsDepots.join(' · ')}, dans aucun dépôt`
              : repartition.valeur_dormante > 0
                ? `dont ${formaterFcfa(repartition.valeur_dormante)} dormant`
                : `${repartition.articles} article(s)`
          }
          couleur="bleu" icone={CubeIcon}
          testId="kpi-stock"
        />
        <Indicateur
          label="Bons de livraison en attente"
          valeur={`${total.livraisons_attente}`}
          ton={total.livraisons_retard > 0 ? 'text-red-600' : 'text-neutral-900'}
          sous={total.livraisons_retard > 0 ? `${total.livraisons_retard} en retard sur la date prévue` : 'aucun retard'}
          couleur="violet" icone={ClipboardDocumentCheckIcon}
          testId="kpi-livraisons"
        />
      </div>

      {vigilance.nombre > 0 && (
        <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900" data-testid="vigilance">
          <ExclamationTriangleIcon className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>
            {[
              vigilance.ruptures && `${repartition.ruptures} article(s) en rupture`,
              vigilance.livraisons_retard && `${total.livraisons_retard} livraison(s) en retard`,
              vigilance.livraisons_en_cours
                && `${total.livraisons_attente} bon(s) de livraison en cours`,
              vigilance.tresorerie_negative && 'trésorerie négative',
              vigilance.fonds_en_transit
                && `${formaterFcfa(total.fonds_en_transit)} en transit (${total.transferts_en_transit} bon(s)) — réception à confirmer`,
              vigilance.fonds_a_recevoir
                && `${formaterFcfa(total.fonds_a_recevoir)} à recevoir (${total.transferts_a_recevoir} bon(s)) — à encaisser à la réception`,
              vigilance.stock_en_transit
                && `${formaterFcfa(total.stock_en_transit)} de marchandise en route (${total.transferts_stock_en_transit} bon(s)) — réception à confirmer`,
              vigilance.stock_a_recevoir
                && `${formaterFcfa(total.stock_a_recevoir)} de marchandise à recevoir (${total.transferts_stock_a_recevoir} bon(s)) — à faire entrer en stock`,
              vigilance.marge_negative && 'marge négative sur la période',
              vigilance.resultat_negatif && !vigilance.marge_negative && 'les dépenses dépassent la marge',
              anciennete.au_dela_de_90 > 0 && `${formaterFcfa(anciennete.au_dela_de_90)} d'impayés de plus de 90 jours`,
            ].filter(Boolean).join(' · ')}
          </span>
        </p>
      )}

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-3">
        <Carte titre="Chiffre d'affaires et marge" icone={ChartBarIcon} sous={<>La hauteur donne l'activité, la part orange ce qu'elle a rapporté — {fenetre.libelle}.</>} className="xl:col-span-2">
          <HistogrammeCaMarge serie={serie} />
        </Carte>

        <Carte titre="Où dort l'argent du stock" icone={CubeIcon} sous={<>{formaterFcfa(repartition.valeur)} en magasin, {repartition.articles} article(s).</>}>
          <EtatStock repartition={repartition} />
          {dormants.length > 0 && (
            <div className="mt-4 border-t border-neutral-100 pt-3">
              <p className="mb-2 text-xs font-medium text-neutral-500">Les dormants les plus lourds</p>
              <ul className="space-y-1 text-xs">
                {dormants.map((d) => (
                  <li key={d.article_id} className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-neutral-700">{d.designation}</span>
                    <span className="flex-shrink-0 font-mono text-neutral-500">{formaterFcfa(d.valeur)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Carte>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-2 xl:grid-cols-4">
        <Carte titre="Chiffre d'affaires par famille" icone={Squares2X2Icon} sous={<>Hors taxes · {fenetre.libelle}</>}>
          <BarresClassement lignes={familles.lignes} maximum={familles.maximum} mesure="du CA HT" vide="Aucune vente sur la période." />
        </Carte>

        <Carte titre="Articles les plus vendus" icone={StarIcon} sous={<>Toutes taxes · {fenetre.libelle}</>}>
          {articles.length === 0 ? (
            <p className="py-8 text-center text-sm text-neutral-400">Aucune vente sur la période.</p>
          ) : (
            <ol className="space-y-2">
              {articles.map((a, n) => (
                <li key={a.code} className="flex items-center gap-3 text-sm" data-testid={`article-vendu-${a.code}`}>
                  <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-700">{n + 1}</span>
                  <span className="flex-1 truncate text-neutral-800" title={`${a.code} — ${a.designation}`}>{a.designation}</span>
                  <span className="flex-shrink-0 text-xs text-neutral-400">{a.quantite}</span>
                  <span className="flex-shrink-0 font-mono text-sm font-semibold text-neutral-900">{formaterFcfa(a.ca)}</span>
                </li>
              ))}
            </ol>
          )}
        </Carte>

        <Carte titre="Qui achète" icone={ShoppingCartIcon} sous={<>Les plus gros clients de la période, TTC</>}>
          <BarresClassement lignes={clients.lignes} maximum={clients.maximum} mesure="du CA TTC" vide="Aucune vente sur la période." />
        </Carte>

        <Carte titre="Ancienneté des impayés" icone={ClockIcon} sous={<>{formaterFcfa(anciennete.total)} sur {anciennete.factures} facture(s) non soldée(s)</>}>
          <AncienneteCreances repartition={anciennete} />
          {ecartCreances > 1 && (
            <p className="mt-3 text-xs text-neutral-400">
              Le total des comptes clients ({formaterFcfa(total.creances)}) comprend aussi les reports d'ouverture,
              qui ne portent pas de date de facture.
            </p>
          )}
        </Carte>
      </div>

      {comparerFiliales && filiales.length > 1 && (
        <Carte titre="Les filiales entre elles" icone={BuildingOffice2Icon} sous={<>Chiffre d'affaires TTC de la période, et taux de marge</>}>
          <BarresClassement lignes={parFiliale.lignes} maximum={parFiliale.maximum} mesure="du CA du groupe" />
        </Carte>
      )}
    </div>
  );
}
