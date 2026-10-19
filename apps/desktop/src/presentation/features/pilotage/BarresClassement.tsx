import { formaterFcfa, formaterPourcentage } from '../../../core/commun/prix';
import type { LigneClassement } from '../../../core/pilotage';
import { SERIE_UNIQUE } from './graphismes';
import { CadreGraphique, LigneBulle, useSurvol } from './Infobulle';

/**
 * Un classement : familles, clients, filiales.
 *
 * Des barres horizontales, parce que les libellés sont longs et se lisent à
 * l'horizontale. **Une seule couleur** pour toutes : la longueur dit déjà la
 * grandeur, teinter chaque barre d'un bleu différent n'ajouterait rien et
 * ferait croire à une catégorie. La valeur est au bout de la barre — pas
 * besoin de survoler pour lire.
 */

interface Props {
  lignes: LigneClassement[];
  maximum: number;
  /** Ce que mesure la barre, dit à l'infobulle (« du chiffre d'affaires »). */
  mesure?: string;
  vide?: string;
}

export default function BarresClassement({ lignes, maximum, mesure = 'du total', vide = 'Rien sur cette période.' }: Props) {
  const { survol, montrer, cacher } = useSurvol();

  if (lignes.length === 0) return <p className="py-8 text-center text-sm text-neutral-400">{vide}</p>;

  return (
    <CadreGraphique survol={survol}>
      <ul className="space-y-2.5">
        {lignes.map((l) => (
          <li
            key={l.cle}
            tabIndex={0}
            role="img"
            aria-label={`${l.libelle} : ${formaterFcfa(l.valeur)}, ${formaterPourcentage(l.part)} ${mesure}`}
            onMouseEnter={(e) => montrer(e, (
              <>
                <span className="mb-1 block font-semibold">{l.libelle}</span>
                <LigneBulle couleur={SERIE_UNIQUE} libelle={`${formaterPourcentage(l.part)} ${mesure}`} valeur={formaterFcfa(l.valeur)} />
                {l.detail && <span className="mt-0.5 block text-neutral-300">{l.detail}</span>}
              </>
            ))}
            onFocus={(e) => montrer(e, (
              <>
                <span className="mb-1 block font-semibold">{l.libelle}</span>
                <LigneBulle couleur={SERIE_UNIQUE} libelle={`${formaterPourcentage(l.part)} ${mesure}`} valeur={formaterFcfa(l.valeur)} />
              </>
            ))}
            onMouseLeave={cacher}
            onBlur={cacher}
            className="cursor-default rounded outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            data-testid={`classement-${l.cle}`}
          >
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="truncate text-neutral-800" title={l.libelle}>
                {l.libelle}
                {l.detail && <span className="ml-2 text-xs text-neutral-400">{l.detail}</span>}
              </span>
              <span className="flex-shrink-0 font-mono text-sm font-semibold text-neutral-900">{formaterFcfa(l.valeur)}</span>
            </div>
            <div className="mt-1 h-2 rounded-sm bg-neutral-100">
              <div
                className="h-2 rounded-sm transition-[width]"
                style={{ width: `${Math.max((l.valeur / maximum) * 100, l.valeur > 0 ? 2 : 0)}%`, background: SERIE_UNIQUE }}
              />
            </div>
          </li>
        ))}
      </ul>
    </CadreGraphique>
  );
}
