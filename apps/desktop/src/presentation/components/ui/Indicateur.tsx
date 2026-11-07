import type { ComponentType, ReactNode } from 'react';
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
 *
 * ### La teinte de la tuile
 *
 * Une rangée de huit tuiles blanches se lit mal : l'œil cherche la bonne et
 * les relit toutes. Chacune prend donc une **teinte et une pastille** qui lui
 * restent — l'argent qui entre en bleu, la marge en orange, la trésorerie en
 * vert, les créances en rouge —, de sorte qu'on retrouve un chiffre à sa
 * couleur avant même d'avoir lu son libellé. La teinte dit la nature du
 * chiffre, jamais s'il est bon : c'est à l'évolution de le dire.
 *
 * Sans `couleur`, la tuile reste blanche : les écrans qui ne les ont pas
 * encore habillées ne changent pas d'allure.
 */

/** Teintes disponibles : une par nature de chiffre, pas une par humeur. */
export type TeinteIndicateur = 'bleu' | 'orange' | 'vert' | 'rouge' | 'violet' | 'ambre' | 'nuit';

const TEINTES: Record<TeinteIndicateur, { carte: string; pastille: string; valeur: string }> = {
  bleu:   { carte: 'border-primary-100 bg-primary-50/70', pastille: 'bg-primary-100 text-primary-700', valeur: 'text-primary-800' },
  orange: { carte: 'border-accent-100 bg-accent-50/70', pastille: 'bg-accent-100 text-accent-700', valeur: 'text-accent-700' },
  vert:   { carte: 'border-green-100 bg-green-50/70', pastille: 'bg-green-100 text-green-700', valeur: 'text-green-700' },
  rouge:  { carte: 'border-red-100 bg-red-50/70', pastille: 'bg-red-100 text-red-700', valeur: 'text-red-700' },
  violet: { carte: 'border-violet-100 bg-violet-50/70', pastille: 'bg-violet-100 text-violet-700', valeur: 'text-violet-700' },
  ambre:  { carte: 'border-amber-100 bg-amber-50/70', pastille: 'bg-amber-100 text-amber-800', valeur: 'text-amber-800' },
  nuit:   { carte: 'border-primary-200 bg-white', pastille: 'bg-primary-900 text-white', valeur: 'text-primary-900' },
};

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
  /** Teinte de la valeur, pour un chiffre qui alerte de lui-même. Elle prime sur celle de `couleur`. */
  ton?: string;
  /** Teinte de la tuile et de sa pastille ; absente, la tuile reste blanche. */
  couleur?: TeinteIndicateur;
  /** Icône de la pastille. Sans elle, pas de pastille. */
  icone?: ComponentType<{ className?: string }>;
  testId?: string;
}

function couleurEvolution(variation: number, sens: Sens): string {
  if (sens === 'NEUTRE' || variation === 0) return 'text-neutral-500';
  const bon = sens === 'HAUT_BON' ? variation > 0 : variation < 0;
  return bon ? 'text-green-700' : 'text-red-600';
}

export default function Indicateur({ label, valeur, evolution, reference, sens = 'NEUTRE', sous, ton, couleur, icone: Icone, testId }: Props) {
  const Fleche = evolution == null || evolution === 0 ? ArrowRightIcon : evolution > 0 ? ArrowUpRightIcon : ArrowDownRightIcon;
  const teinte = couleur ? TEINTES[couleur] : null;

  return (
    <div
      className={`flex items-start gap-3 rounded-2xl border p-4 shadow-sm ${teinte ? teinte.carte : 'border-neutral-200 bg-white'}`}
      data-testid={testId}
    >
      {Icone && (
        <span className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${teinte ? teinte.pastille : 'bg-primary-50 text-primary-700'}`}>
          <Icone className="h-5 w-5" />
        </span>
      )}
      <div className="min-w-0 flex-1">
      <p className="text-sm font-medium text-neutral-600">{label}</p>
      <p
        className={`mt-1 font-mono text-xl font-bold leading-tight ${ton ?? teinte?.valeur ?? 'text-neutral-900'}`}
        data-testid={testId ? `${testId}-valeur` : undefined}
      >
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
    </div>
  );
}
