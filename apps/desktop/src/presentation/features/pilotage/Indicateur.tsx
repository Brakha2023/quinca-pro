import type { ReactNode } from 'react';
import { ArrowDownRightIcon, ArrowRightIcon, ArrowUpRightIcon } from '@heroicons/react/24/solid';

/**
 * Une tuile de chiffre.
 *
 * Un nombre n'a pas besoin d'un graphique : il lui faut un libellé, sa valeur,
 * et de quoi la situer — ce qu'elle était la période d'avant, et ce qu'elle
 * cache en dessous. Une barre unique ne dirait rien de plus.
 *
 * La couleur de l'évolution suit le **sens**, pas la direction : des créances
 * qui montent, c'est rouge ; un chiffre d'affaires qui monte, c'est vert.
 */

export type Sens = 'HAUT_BON' | 'BAS_BON' | 'NEUTRE';

interface Props {
  label: string;
  valeur: string;
  /** Variation en % par rapport à la période précédente ; `null` quand elle n'a pas de sens. */
  evolution?: number | null;
  /** À quoi l'évolution se compare, dit en clair. */
  reference?: string;
  sens?: Sens;
  sous?: ReactNode;
  /** Teinte de la valeur, pour un chiffre qui alerte de lui-même. */
  ton?: string;
  testId?: string;
}

function couleurEvolution(variation: number, sens: Sens): string {
  if (sens === 'NEUTRE' || variation === 0) return 'text-neutral-500';
  const bon = sens === 'HAUT_BON' ? variation > 0 : variation < 0;
  return bon ? 'text-green-700' : 'text-red-600';
}

export default function Indicateur({ label, valeur, evolution, reference, sens = 'NEUTRE', sous, ton = 'text-neutral-900', testId }: Props) {
  const Fleche = evolution == null || evolution === 0 ? ArrowRightIcon : evolution > 0 ? ArrowUpRightIcon : ArrowDownRightIcon;

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm" data-testid={testId}>
      <p className="text-sm font-medium text-neutral-500">{label}</p>
      <p className={`mt-1.5 font-mono text-xl font-bold leading-tight ${ton}`} data-testid={testId ? `${testId}-valeur` : undefined}>
        {valeur}
      </p>
      {evolution != null && (
        <p className={`mt-1 flex items-center gap-1 text-xs ${couleurEvolution(evolution, sens)}`}>
          <Fleche className="h-3 w-3 flex-shrink-0" />
          <span className="font-mono font-semibold">{evolution > 0 ? '+' : ''}{evolution.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %</span>
          {reference && <span className="truncate text-neutral-400">vs {reference}</span>}
        </p>
      )}
      {sous && <p className="mt-1 text-xs text-neutral-500">{sous}</p>}
    </div>
  );
}
