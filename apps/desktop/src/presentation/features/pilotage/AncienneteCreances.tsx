import { formaterCompact, formaterFcfa, formaterPourcentage } from '../../../core/commun/prix';
import type { RepartitionAnciennete } from '../../../core/pilotage';
import { ECHELLE_ANCIENNETE, GRILLE } from './graphismes';
import { CadreGraphique, LigneBulle, useSurvol } from './Infobulle';

/**
 * Les impayés par âge.
 *
 * Quatre colonnes, du plus frais au plus vieux, et un seul bleu qui fonce avec
 * l'âge : les tranches sont **ordonnées**, pas distinctes — quatre couleurs
 * différentes laisseraient croire à quatre catégories sans rapport. Plus c'est
 * sombre et à droite, plus c'est inquiétant.
 */

const HAUTEUR = 120;

export default function AncienneteCreances({ repartition }: { repartition: RepartitionAnciennete }) {
  const { survol, montrer, cacher } = useSurvol();
  const maximum = Math.max(...repartition.parts.map((p) => p.montant), 1);

  if (repartition.total === 0) {
    return <p className="py-8 text-center text-sm text-neutral-400">Aucune facture impayée. Tout est soldé.</p>;
  }

  return (
    <CadreGraphique survol={survol}>
      <div className="flex items-end gap-3" style={{ height: HAUTEUR }}>
        {repartition.parts.map((p, i) => (
          <div
            key={p.tranche}
            tabIndex={0}
            role="img"
            aria-label={`${p.label} : ${formaterFcfa(p.montant)} sur ${p.factures} facture(s)`}
            onMouseEnter={(e) => montrer(e, (
              <>
                <span className="mb-1 block font-semibold">{p.label}</span>
                <LigneBulle couleur={ECHELLE_ANCIENNETE[i]} libelle={`${formaterPourcentage(p.part)} des impayés`} valeur={formaterFcfa(p.montant)} />
                <LigneBulle libelle="facture(s)" valeur={String(p.factures)} />
              </>
            ))}
            onFocus={(e) => montrer(e, (
              <>
                <span className="mb-1 block font-semibold">{p.label}</span>
                <LigneBulle couleur={ECHELLE_ANCIENNETE[i]} libelle={`${p.factures} facture(s)`} valeur={formaterFcfa(p.montant)} />
              </>
            ))}
            onMouseLeave={cacher}
            onBlur={cacher}
            className="flex h-full flex-1 cursor-default flex-col justify-end rounded outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            data-testid={`anciennete-${p.tranche.replace('+', '-plus')}`}
          >
            <span className="mb-1 text-center font-mono text-[11px] font-semibold text-neutral-700">
              {p.montant > 0 ? formaterCompact(p.montant) : ''}
            </span>
            <span
              className="rounded-t transition-[filter] hover:brightness-110"
              style={{
                height: `${Math.max((p.montant / maximum) * (HAUTEUR - 24), p.montant > 0 ? 3 : 1)}px`,
                background: p.montant > 0 ? ECHELLE_ANCIENNETE[i] : GRILLE,
              }}
            />
            <span className="mt-1.5 text-center text-[11px] text-neutral-500">{p.label}</span>
          </div>
        ))}
      </div>
    </CadreGraphique>
  );
}
