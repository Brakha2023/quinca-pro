import { formaterFcfa, formaterPourcentage } from '../../../core/commun/prix';
import type { LigneMarge } from '../../../core/rapports';
import { SERIE_COUT, SERIE_MARGE } from '../pilotage/graphismes';
import { CadreGraphique, LigneBulle, useSurvol } from '../pilotage/Infobulle';

/**
 * La marge par catégorie, barre par barre.
 *
 * Des barres **horizontales**, parce que les catégories portent des noms
 * longs — « Plomberie et sanitaire » ne tient pas sous une barre verticale.
 * Chaque barre est coupée en deux : en bleu ce que la marchandise a coûté, en
 * orange ce qu'elle a rapporté. Les deux réunies font le chiffre d'affaires,
 * et la part orange se lit comme la marge, d'un coup d'œil, catégorie contre
 * catégorie.
 *
 * ### Une catégorie vendue à perte
 *
 * Le coût dépasse alors le chiffre d'affaires. La barre devient le **coût** :
 * en bleu la part que la vente a couverte, en orange pâle celle qu'elle n'a
 * pas couverte. La barre dit ainsi ce qui s'est passé sans changer d'échelle,
 * et une perte ne se fond jamais dans une barre bleue.
 *
 * Les deux teintes sont celles de l'histogramme du tableau de bord : même
 * question, même couleur — leur écart sous daltonisme a été contrôlé une fois
 * pour toutes (voir `pilotage/graphismes`).
 */

interface Props {
  lignes: LigneMarge[];
  /** Ce que mesure une barre, pour l'infobulle et le lecteur d'écran. */
  mesure?: string;
  vide?: string;
}

export default function BarresMarge({ lignes, mesure = 'de la marge', vide = 'Rien de vendu sur cette période.' }: Props) {
  const { survol, montrer, cacher } = useSurvol();

  if (lignes.length === 0) return <p className="py-8 text-center text-sm text-neutral-400">{vide}</p>;

  // L'échelle est la plus longue barre, chiffre d'affaires ou coût : sur une
  // vente à perte, c'est le coût qui donne la longueur.
  const maximum = Math.max(...lignes.map((l) => Math.max(l.ca_ht, l.cout)), 1);
  const largeur = (valeur: number) => `${Math.max((valeur / maximum) * 100, valeur > 0 ? 1 : 0)}%`;

  const bulle = (l: LigneMarge) => (
    <>
      <span className="mb-1 block font-semibold">{l.libelle}</span>
      <LigneBulle couleur={SERIE_MARGE} libelle={`marge · ${formaterPourcentage(l.taux_marge)} du CA`} valeur={formaterFcfa(l.marge)} />
      <LigneBulle couleur={SERIE_COUT} libelle="coût d'achat" valeur={formaterFcfa(l.cout)} />
      <LigneBulle libelle="chiffre d'affaires HT" valeur={formaterFcfa(l.ca_ht)} />
      <span className="mt-0.5 block text-neutral-300">
        {formaterPourcentage(l.part_marge)} {mesure} · {l.articles} article(s) · {l.lignes} ligne(s)
      </span>
    </>
  );

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-4 text-xs text-neutral-600">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: SERIE_MARGE }} /> Marge commerciale
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: SERIE_COUT }} /> Coût d'achat
        </span>
        {/* Pas de légende pour une teinte qu'aucune barre ne porte. */}
        {lignes.some((l) => l.marge < 0) && (
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: SERIE_MARGE, opacity: 0.55 }} /> Vendu à perte
          </span>
        )}
      </div>

      <CadreGraphique survol={survol}>
        <ul className="space-y-3">
          {lignes.map((l) => {
            const perte = l.marge < 0;
            // Bleu : la part du coût que la vente a couverte. Orange : ce
            // qu'elle a rapporté, ou ce qu'elle n'a pas couvert.
            const couvert = Math.min(l.cout, Math.max(l.ca_ht, 0));
            return (
              <li
                key={l.cle}
                tabIndex={0}
                role="img"
                aria-label={`${l.libelle} : marge ${formaterFcfa(l.marge)}, soit ${formaterPourcentage(l.taux_marge)} d'un chiffre d'affaires de ${formaterFcfa(l.ca_ht)} pour un coût de ${formaterFcfa(l.cout)}`}
                onMouseEnter={(e) => montrer(e, bulle(l))}
                onFocus={(e) => montrer(e, bulle(l))}
                onMouseLeave={cacher}
                onBlur={cacher}
                className="cursor-default rounded outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                data-testid={`marge-${l.cle}`}
              >
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="truncate text-neutral-800" title={l.libelle}>{l.libelle}</span>
                  <span className={`flex-shrink-0 font-mono text-sm font-semibold ${perte ? 'text-red-600' : 'text-neutral-900'}`}>
                    {formaterFcfa(l.marge)}
                  </span>
                </div>
                <div className="mt-1 flex h-2.5 overflow-hidden rounded-sm bg-neutral-100">
                  <span style={{ width: largeur(couvert), background: SERIE_COUT }} />
                  {/* 2 px de fond séparent les deux parts : c'est le blanc qui sépare, jamais un trait. */}
                  <span
                    style={{
                      width: largeur(Math.abs(l.marge)),
                      background: SERIE_MARGE,
                      opacity: perte ? 0.55 : 1,
                      marginLeft: couvert > 0 && l.marge !== 0 ? 2 : 0,
                    }}
                  />
                </div>
                <p className="mt-1 text-xs text-neutral-400">
                  {formaterPourcentage(l.taux_marge)} de marge · {formaterFcfa(l.ca_ht)} de CA · {formaterPourcentage(l.part_marge)} {mesure}
                  {perte && <span className="ml-1 font-medium text-red-600">— vendu à perte</span>}
                </p>
              </li>
            );
          })}
        </ul>
      </CadreGraphique>
    </div>
  );
}
