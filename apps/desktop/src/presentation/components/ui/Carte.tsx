import type { ComponentType, ReactNode } from 'react';

/**
 * Une carte de contenu, coiffée d'un bandeau bleu nuit.
 *
 * Un écran de gestion empile six ou sept blocs — un graphique, deux
 * classements, un tableau, une note. Tous blancs sur fond gris, ils se
 * fondent les uns dans les autres et il faut lire chaque titre pour savoir où
 * l'on est. Le bandeau sombre leur rend une tête : on repère un bloc à son
 * entête, et l'icône dit ce qu'il contient avant le titre.
 *
 * Le bandeau est **sombre et non coloré**. La couleur, ici, c'est l'orange, et
 * l'orange ne sert qu'à ce sur quoi on agit ; un entête de carte ne se clique
 * pas. Les sept bandeaux d'un écran resteraient d'ailleurs indiscernables si
 * chacun prenait sa teinte — ce sont les tuiles de chiffres qui portent les
 * couleurs, parce qu'elles sont une rangée qu'on parcourt du regard.
 */

interface Props {
  titre: string;
  /** Icône du bandeau : ce que la carte contient, dit avant son titre. */
  icone?: ComponentType<{ className?: string }>;
  /** Ce qui s'aligne à droite du titre : un filtre, un compte, un bouton. */
  action?: ReactNode;
  /** Une ligne sous le titre, dans le bandeau, en plus clair. */
  sous?: ReactNode;
  /**
   * Laisse `sous` passer à la ligne au lieu d'être coupé.
   *
   * Par défaut la ligne est tronquée, et il faut qu'elle le reste : dans une
   * grille, les cartes d'une même rangée s'étirent à la plus haute, et un
   * bandeau de deux lignes à côté d'un bandeau d'une seule décale le repère
   * sur lequel l'œil s'aligne.
   *
   * Mais le périmètre d'une liste filtrée — « du 1er au 6 novembre · caisse
   * « Coffre » · recherche « carburant » » — est exactement ce qui part sur le
   * papier et dans l'export : coupé, il ne dit plus ce qu'on imprime. Les
   * cartes qui le portent sont pleine largeur et seules sur leur rangée, donc
   * rien ne s'y désaligne.
   */
  sousEntier?: boolean;
  className?: string;
  /** Sans rembourrage : pour un tableau qui doit toucher les bords de la carte. */
  nu?: boolean;
  children: ReactNode;
  'data-testid'?: string;
}

export default function Carte({
  titre, icone: Icone, action, sous, sousEntier, className = '', nu, children, 'data-testid': testid,
}: Props) {
  return (
    <div
      className={`flex flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm ${className}`}
      data-testid={testid}
    >
      <div className="flex items-center gap-3 bg-primary-900 px-4 py-3 text-white">
        {Icone && <Icone className="h-5 w-5 flex-shrink-0 text-primary-200" />}
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-bold tracking-tight">{titre}</h2>
          {sous && <p className={`text-xs text-primary-200 ${sousEntier ? '' : 'truncate'}`}>{sous}</p>}
        </div>
        {action && <div className="flex flex-shrink-0 items-center gap-2">{action}</div>}
      </div>
      <div className={nu ? 'flex-1' : 'flex-1 p-4'}>{children}</div>
    </div>
  );
}
