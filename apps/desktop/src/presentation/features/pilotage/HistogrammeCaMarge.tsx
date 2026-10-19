import { formaterCompact, formaterFcfa } from '../../../core/commun/prix';
import type { SerieCaMarge } from '../../../core/pilotage';
import { BARRE_MAX, FOND, GRILLE, SERIE_COUT, SERIE_MARGE, graduations } from './graphismes';
import { CadreGraphique, LigneBulle, useSurvol } from './Infobulle';

/**
 * Chiffre d'affaires et marge, barre par barre.
 *
 * Chaque barre est le chiffre d'affaires hors taxes d'un jour (ou d'un mois),
 * coupé en deux : en bas ce que la marchandise a coûté, en haut ce qu'elle a
 * rapporté. La hauteur donne l'activité, la part haute donne le gain — les
 * deux questions d'un gérant dans un seul dessin, sur un seul axe.
 *
 * Une marge négative — on a vendu à perte — se dessine sous la ligne de base :
 * elle doit se voir, pas se fondre dans la barre.
 */

const HAUTEUR = 200;
const PIED = 22;

export default function HistogrammeCaMarge({ serie }: { serie: SerieCaMarge }) {
  const { survol, montrer, cacher } = useSurvol();
  const { points } = serie;

  // L'axe donne l'échelle : le plafond est la dernière graduation, pas la plus
  // haute barre — sans quoi une barre dépasserait la ligne qui la mesure.
  const marches = graduations(Math.max(...points.map((p) => Math.max(p.ca_ht, p.cout)), 1));
  const plafond = marches.at(-1)!;
  const plancher = Math.min(...points.map((p) => Math.min(p.marge, 0)), 0);
  const amplitude = plafond - plancher;
  const hauteurDe = (valeur: number) => (Math.abs(valeur) / amplitude) * HAUTEUR;
  const zero = (plafond / amplitude) * HAUTEUR;

  // Une seule étiquette directe : la plus haute barre. Un nombre sur chaque
  // barre ne se lit plus, et la graduation porte déjà le reste.
  const sommet = points.reduce((max, p) => (p.ca_ht > max.ca_ht ? p : max), points[0]!);
  /** Reste-t-il de quoi poser l'étiquette au-dessus de la barre la plus haute ? */
  const placeAuDessus = zero - hauteurDe(sommet.ca_ht) > 14;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-4 text-xs text-neutral-600">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: SERIE_MARGE }} /> Marge commerciale
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: SERIE_COUT }} /> Coût d'achat
        </span>
        <span className="ml-auto font-mono text-neutral-500">
          {formaterFcfa(serie.total_ca)} HT · marge {formaterFcfa(serie.total_marge)}
        </span>
      </div>

      <CadreGraphique survol={survol}>
        <div className="flex gap-2">
          {/* Graduation : elle porte les valeurs qu'on n'étiquette pas. */}
          <div className="relative w-12 flex-shrink-0 text-right" style={{ height: HAUTEUR }}>
            {marches.map((g) => (
              <span
                key={g}
                className="absolute right-0 -translate-y-1/2 font-mono text-[10px] text-neutral-400"
                style={{ top: zero - hauteurDe(g) }}
              >
                {formaterCompact(g)}
              </span>
            ))}
          </div>

          <div className="min-w-0 flex-1">
            <div className="relative" style={{ height: HAUTEUR }}>
              {marches.map((g) => (
                <span key={g} className="absolute inset-x-0 border-t" style={{ top: zero - hauteurDe(g), borderColor: GRILLE }} />
              ))}

              <div className="absolute inset-0 flex items-stretch justify-between gap-px">
                {points.map((p) => {
                  const hautCout = hauteurDe(Math.min(p.cout, p.ca_ht > 0 ? p.ca_ht : p.cout));
                  const hautMarge = hauteurDe(Math.max(p.marge, 0));
                  const hautPerte = hauteurDe(Math.min(p.marge, 0));
                  const vide = p.ca_ht === 0 && p.cout === 0;
                  return (
                    <div
                      key={p.cle}
                      tabIndex={0}
                      role="img"
                      aria-label={`${p.libelle} : chiffre d'affaires ${formaterFcfa(p.ca_ht)}, marge ${formaterFcfa(p.marge)}`}
                      onMouseEnter={(e) => montrer(e, (
                        <>
                          <span className="mb-1 block font-semibold">{p.libelle}</span>
                          <LigneBulle couleur={SERIE_MARGE} libelle="marge" valeur={formaterFcfa(p.marge)} />
                          <LigneBulle couleur={SERIE_COUT} libelle="coût d'achat" valeur={formaterFcfa(p.cout)} />
                          <LigneBulle libelle={`CA HT · ${p.ventes} vente(s)`} valeur={formaterFcfa(p.ca_ht)} />
                        </>
                      ))}
                      onFocus={(e) => montrer(e, (
                        <>
                          <span className="mb-1 block font-semibold">{p.libelle}</span>
                          <LigneBulle couleur={SERIE_MARGE} libelle="marge" valeur={formaterFcfa(p.marge)} />
                          <LigneBulle couleur={SERIE_COUT} libelle="coût d'achat" valeur={formaterFcfa(p.cout)} />
                        </>
                      ))}
                      onMouseLeave={cacher}
                      onBlur={cacher}
                      className="group relative flex-1 cursor-default rounded outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                      data-testid={`barre-${p.cle}`}
                    >
                      {/* La pile, posée sur la ligne de zéro. */}
                      <span
                        className="absolute left-1/2 -translate-x-1/2 rounded-t group-hover:brightness-110"
                        style={{ bottom: HAUTEUR - zero + hauteurDe(p.cout), height: hautMarge, width: `min(100%, ${BARRE_MAX}px)`, background: SERIE_MARGE }}
                      />
                      <span
                        className="absolute left-1/2 -translate-x-1/2 group-hover:brightness-110"
                        // 2 px de fond séparent les deux parts : c'est le blanc qui sépare, jamais un trait.
                        style={{ bottom: HAUTEUR - zero, height: Math.max(hautCout - (hautMarge > 0 ? 2 : 0), 0), width: `min(100%, ${BARRE_MAX}px)`, background: SERIE_COUT, borderTop: hautMarge > 0 ? `2px solid ${FOND}` : undefined }}
                      />
                      {hautPerte > 0 && (
                        <span
                          className="absolute left-1/2 -translate-x-1/2 rounded-b"
                          style={{ top: zero, height: hautPerte, width: `min(100%, ${BARRE_MAX}px)`, background: SERIE_MARGE, opacity: 0.55 }}
                        />
                      )}
                      {p.cle === sommet.cle && p.ca_ht > 0 && (
                        // Au-dessus de la barre s'il y a la place ; dedans sinon,
                        // en blanc sur l'orange. Une étiquette ne déborde jamais.
                        <span
                          className={`absolute left-1/2 -translate-x-1/2 whitespace-nowrap font-mono text-[10px] font-semibold ${
                            placeAuDessus ? 'text-neutral-700' : 'text-white'
                          }`}
                          style={{ bottom: HAUTEUR - zero + hauteurDe(p.ca_ht) + (placeAuDessus ? 3 : -13) }}
                        >
                          {formaterCompact(p.ca_ht)}
                        </span>
                      )}
                      {vide && <span className="absolute inset-x-0" style={{ bottom: HAUTEUR - zero, height: 1, background: GRILLE }} />}
                    </div>
                  );
                })}
              </div>

              <span className="absolute inset-x-0 border-t border-neutral-300" style={{ top: zero }} />
            </div>

            <div className="flex justify-between gap-px" style={{ height: PIED }}>
              {points.map((p, i) => (
                <span key={p.cle} className="flex-1 overflow-hidden pt-1 text-center text-[10px] text-neutral-500">
                  {/* Au-delà de douze barres, une étiquette sur deux : elles se chevaucheraient. */}
                  {points.length <= 12 || i % 2 === 0 ? p.libelle : ''}
                </span>
              ))}
            </div>
          </div>
        </div>
      </CadreGraphique>

      <details className="mt-2 text-xs text-neutral-500">
        <summary className="cursor-pointer select-none hover:text-neutral-700">Voir les données</summary>
        <table className="mt-2 w-full" data-testid="donnees-histogramme">
          <thead className="text-neutral-400">
            <tr><th className="py-1 text-left font-medium">Période</th><th className="py-1 text-right font-medium">CA HT</th><th className="py-1 text-right font-medium">Coût</th><th className="py-1 text-right font-medium">Marge</th><th className="py-1 text-right font-medium">Ventes</th></tr>
          </thead>
          <tbody className="font-mono">
            {points.map((p) => (
              <tr key={p.cle} className="border-t border-neutral-100">
                <td className="py-1 font-sans">{p.libelle}</td>
                <td className="py-1 text-right">{formaterFcfa(p.ca_ht)}</td>
                <td className="py-1 text-right">{formaterFcfa(p.cout)}</td>
                <td className={`py-1 text-right ${p.marge < 0 ? 'text-red-600' : ''}`}>{formaterFcfa(p.marge)}</td>
                <td className="py-1 text-right">{p.ventes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
