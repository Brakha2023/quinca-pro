import { formaterFcfa, formaterPourcentage } from '../../../core/commun/prix';
import { CONSEILS_ETAT_STOCK, ETATS_STOCK, type PartStock, type RepartitionStock } from '../../../core/pilotage';
import { COULEURS_ETAT_STOCK, FOND } from './graphismes';
import { CadreGraphique, LigneBulle, useSurvol } from './Infobulle';

/**
 * L'état du stock, en deux barres.
 *
 * Deux barres et non une, parce qu'une seule mentirait : une rupture ne vaut
 * rien, elle n'apparaîtrait jamais sur une barre valorisée — et c'est
 * justement l'état le plus urgent. La première barre dit **où dort l'argent**,
 * la seconde **combien d'articles** sont dans chaque état. Même légende, deux
 * questions.
 *
 * Les quatre couleurs sont des couleurs d'**état**, pas de série : elles ne
 * portent jamais le sens seules — chaque part est nommée et chiffrée dessous,
 * dans l'ordre de l'urgence.
 */

/** Ordre de lecture : l'urgence, jamais le volume. */
const ORDRE = ['RUPTURE', 'DORMANT', 'SOUS_MINIMUM', 'ACTIF'] as const;

export default function EtatStock({ repartition }: { repartition: RepartitionStock }) {
  const { survol, montrer, cacher } = useSurvol();

  if (repartition.articles === 0) {
    return <p className="py-8 text-center text-sm text-neutral-400">Aucun article en stock.</p>;
  }

  const rangees = ORDRE.map((e) => repartition.parts.find((p) => p.etat === e)!);

  const bulle = (p: PartStock) => (
    <>
      <span className="mb-1 block font-semibold">{p.libelle}</span>
      <LigneBulle couleur={COULEURS_ETAT_STOCK[p.etat]} libelle={`${formaterPourcentage(p.part)} de la valeur`} valeur={formaterFcfa(p.valeur)} />
      <LigneBulle libelle={CONSEILS_ETAT_STOCK[p.etat]} valeur={`${p.articles} article(s)`} />
    </>
  );

  const barre = (mesure: 'valeur' | 'articles', titre: string) => (
    <div>
      <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-neutral-400">{titre}</p>
      <div className="flex h-6 w-full overflow-hidden rounded-md bg-neutral-100">
        {ETATS_STOCK.map((etat) => repartition.parts.find((p) => p.etat === etat)!)
          .filter((p) => (mesure === 'valeur' ? p.valeur : p.articles) > 0)
          .map((p, i, visibles) => (
            <div
              key={p.etat}
              tabIndex={0}
              role="img"
              aria-label={`${titre} — ${p.libelle} : ${p.articles} article(s), ${formaterFcfa(p.valeur)}`}
              onMouseEnter={(e) => montrer(e, bulle(p))}
              onFocus={(e) => montrer(e, bulle(p))}
              onMouseLeave={cacher}
              onBlur={cacher}
              className="cursor-default outline-none transition-[filter] hover:brightness-110 focus-visible:brightness-110"
              // 2 px de fond entre deux parts : c'est le blanc qui sépare, jamais un contour.
              style={{
                width: `${mesure === 'valeur' ? p.part : p.part_articles}%`,
                background: COULEURS_ETAT_STOCK[p.etat],
                marginRight: i < visibles.length - 1 ? 2 : 0,
              }}
              data-testid={`part-stock-${mesure}-${p.etat}`}
            />
          ))}
      </div>
    </div>
  );

  return (
    <div>
      <CadreGraphique survol={survol}>
        <div className="space-y-3">
          {barre('valeur', 'Par valeur')}
          {barre('articles', "Par nombre d'articles")}
        </div>
      </CadreGraphique>

      <ul className="mt-4 space-y-2.5">
        {rangees.map((p) => (
          <li key={p.etat} data-testid={`etat-stock-${p.etat}`}>
            <div className="flex items-baseline gap-2 text-sm">
              <span className="h-2.5 w-2.5 flex-shrink-0 translate-y-px rounded-sm" style={{ background: COULEURS_ETAT_STOCK[p.etat], outline: `2px solid ${FOND}` }} />
              <span className="text-neutral-800">{p.libelle}</span>
              <span className="ml-auto flex-shrink-0 font-mono text-xs text-neutral-500">{p.articles} art.</span>
              <span className="w-24 flex-shrink-0 text-right font-mono text-sm font-semibold text-neutral-900">{formaterFcfa(p.valeur)}</span>
            </div>
            <p className="ml-4.5 pl-0.5 text-xs text-neutral-400">{CONSEILS_ETAT_STOCK[p.etat]}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
