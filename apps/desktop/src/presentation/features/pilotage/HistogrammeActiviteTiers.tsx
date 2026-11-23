import { formaterCompact, formaterFcfa } from '../../../core/commun/prix';
import { moisSansReglement, type SerieActiviteTiers } from '../../../core/pilotage';
import { BARRE_MAX, GRILLE, SERIE_COUT, SERIE_MARGE, graduations } from './graphismes';
import { CadreGraphique, LigneBulle, useSurvol } from './Infobulle';

/**
 * L'activité d'un compte, mois par mois : ce qu'on lui a facturé, ce qui a
 * été réglé.
 *
 * **Deux barres côte à côte, et non empilées.** L'histogramme du chiffre
 * d'affaires empile le coût et la marge parce que leur somme est le chiffre
 * d'affaires ; ici, additionner le facturé et le réglé ne donnerait rien de
 * réel. C'est l'**écart** entre les deux barres qui se lit : il creuse le
 * compte quand la première dépasse, il le résorbe quand c'est la seconde.
 *
 * Le libellé change de bouche selon le compte — on facture un client, un
 * fournisseur nous facture — mais le dessin est le même : c'est le même geste
 * de lecture des deux côtés du grand livre.
 */

const HAUTEUR = 160;

interface Props {
  serie: SerieActiviteTiers;
  /** « Facturé » pour un client, « Reçu » pour un fournisseur. */
  libelleFacture: string;
  /** « Encaissé » pour un client, « Payé » pour un fournisseur. */
  libelleRegle: string;
}

export default function HistogrammeActiviteTiers({ serie, libelleFacture, libelleRegle }: Props) {
  const { survol, montrer, cacher } = useSurvol();
  const { points } = serie;

  if (serie.vide) {
    return (
      <p className="py-8 text-center text-sm text-neutral-400" data-testid="activite-vide">
        Aucun mouvement sur les douze derniers mois — ce solde est un report, ou il dort.
      </p>
    );
  }

  // L'axe donne l'échelle : le plafond est la dernière graduation, pas la plus
  // haute barre, sans quoi une barre dépasserait la ligne qui la mesure.
  const marches = graduations(serie.maximum, 3);
  const plafond = marches.at(-1)!;
  const hauteurDe = (valeur: number) => (valeur / plafond) * HAUTEUR;
  const silence = moisSansReglement(serie);

  return (
    <div data-testid="activite-tiers">
      <div className="mb-3 flex flex-wrap items-center gap-4 text-xs text-neutral-600">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: SERIE_COUT }} /> {libelleFacture}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: SERIE_MARGE }} /> {libelleRegle}
        </span>
        <span className="ml-auto font-mono text-neutral-500" data-testid="activite-totaux">
          {formaterFcfa(serie.total_facture)} · {formaterFcfa(serie.total_regle)}
        </span>
      </div>

      <CadreGraphique survol={survol}>
        <div className="flex gap-2">
          <div className="relative w-12 flex-shrink-0 text-right" style={{ height: HAUTEUR }}>
            {marches.map((g) => (
              <span key={g} className="absolute right-0 -translate-y-1/2 font-mono text-[10px] text-neutral-400" style={{ top: HAUTEUR - hauteurDe(g) }}>
                {formaterCompact(g)}
              </span>
            ))}
          </div>

          <div className="min-w-0 flex-1">
            <div className="relative" style={{ height: HAUTEUR }}>
              {marches.map((g) => (
                <span key={g} className="absolute inset-x-0 border-t" style={{ top: HAUTEUR - hauteurDe(g), borderColor: GRILLE }} />
              ))}

              <div className="absolute inset-0 flex items-end justify-between gap-px">
                {points.map((p) => {
                  const bulle = (
                    <>
                      <span className="mb-1 block font-semibold">{p.libelle}</span>
                      <LigneBulle couleur={SERIE_COUT} libelle={libelleFacture.toLowerCase()} valeur={formaterFcfa(p.facture)} />
                      <LigneBulle couleur={SERIE_MARGE} libelle={libelleRegle.toLowerCase()} valeur={formaterFcfa(p.regle)} />
                      {p.ecart !== 0 && (
                        <span className="mt-0.5 block text-neutral-300">
                          {p.ecart > 0 ? `le compte s’est creusé de ${formaterFcfa(p.ecart)}` : `le compte s’est allégé de ${formaterFcfa(-p.ecart)}`}
                        </span>
                      )}
                    </>
                  );
                  return (
                    <div
                      key={p.cle}
                      tabIndex={0}
                      role="img"
                      aria-label={`${p.libelle} : ${libelleFacture.toLowerCase()} ${formaterFcfa(p.facture)}, ${libelleRegle.toLowerCase()} ${formaterFcfa(p.regle)}`}
                      onMouseEnter={(e) => montrer(e, bulle)}
                      onFocus={(e) => montrer(e, bulle)}
                      onMouseLeave={cacher}
                      onBlur={cacher}
                      className="group flex h-full flex-1 items-end justify-center gap-px rounded outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                      data-testid={`activite-${p.cle}`}
                    >
                      {/* Les deux barres se touchent : c'est le couple qui se
                          lit, et l'espace sépare les mois, pas les séries. */}
                      <span
                        className="rounded-t group-hover:brightness-110"
                        style={{ height: Math.max(hauteurDe(p.facture), p.facture > 0 ? 2 : 0), width: `min(45%, ${BARRE_MAX / 2}px)`, background: SERIE_COUT }}
                      />
                      <span
                        className="rounded-t group-hover:brightness-110"
                        style={{ height: Math.max(hauteurDe(p.regle), p.regle > 0 ? 2 : 0), width: `min(45%, ${BARRE_MAX / 2}px)`, background: SERIE_MARGE }}
                      />
                    </div>
                  );
                })}
              </div>
              <span className="absolute inset-x-0 bottom-0 border-t border-neutral-300" />
            </div>

            <div className="flex justify-between gap-px pt-1">
              {points.map((p, i) => (
                <span key={p.cle} className="flex-1 overflow-hidden text-center text-[10px] text-neutral-500">
                  {points.length <= 12 || i % 2 === 0 ? p.libelle : ''}
                </span>
              ))}
            </div>
          </div>
        </div>
      </CadreGraphique>

      {/* Ce que le dessin ne dit pas d'un coup d'œil, et qui décide d'un appel
          téléphonique : depuis combien de temps il n'a rien versé. */}
      <p className="mt-2 text-xs text-neutral-500" data-testid="activite-resume">
        {silence !== null
          ? `Rien de réglé depuis ${silence} mois. `
          : serie.total_regle > 0 ? 'Réglé ce mois-ci. ' : ''}
        {serie.variation > 0
          ? `Le compte s’est creusé de ${formaterFcfa(serie.variation)} sur la période.`
          : serie.variation < 0
            ? `Le compte s’est allégé de ${formaterFcfa(-serie.variation)} sur la période.`
            : 'Le compte revient à son point de départ sur la période.'}
      </p>
    </div>
  );
}
