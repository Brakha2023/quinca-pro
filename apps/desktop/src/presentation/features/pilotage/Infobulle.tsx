import { useCallback, useState, type ReactNode } from 'react';

/**
 * Le survol des graphiques.
 *
 * Une infobulle **complète** ce qui est déjà lisible, elle ne le remplace
 * jamais : toute valeur qu'elle montre se retrouve ailleurs — étiquette sur la
 * marque, légende, ou tableau des données sous le graphique. Un poste sans
 * souris doit pouvoir tout lire ; le clavier ouvre donc la même bulle que le
 * pointeur.
 */

export interface Survol {
  x: number;
  y: number;
  contenu: ReactNode;
}

export function useSurvol() {
  const [survol, setSurvol] = useState<Survol | null>(null);

  const montrer = useCallback((e: { currentTarget: Element }, contenu: ReactNode) => {
    const marque = e.currentTarget.getBoundingClientRect();
    const cadre = e.currentTarget.closest('[data-cadre-graphique]')?.getBoundingClientRect();
    if (!cadre) return;
    setSurvol({
      x: marque.left - cadre.left + marque.width / 2,
      y: marque.top - cadre.top,
      contenu,
    });
  }, []);

  const cacher = useCallback(() => setSurvol(null), []);

  return { survol, montrer, cacher };
}

/**
 * Le cadre d'un graphique : il porte l'infobulle, et c'est par rapport à lui
 * qu'elle se place. Tout graphique survolable s'enveloppe ici.
 */
export function CadreGraphique({ survol, children }: { survol: Survol | null; children: ReactNode }) {
  return (
    <div className="relative" data-cadre-graphique>
      {children}
      {survol && (
        <div
          role="status"
          className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-full rounded-lg bg-neutral-900 px-3 py-2 text-xs text-white shadow-lg"
          style={{ left: survol.x, top: survol.y - 8, maxWidth: 220 }}
          data-testid="infobulle"
        >
          {survol.contenu}
        </div>
      )}
    </div>
  );
}

/**
 * Une ligne d'infobulle : la valeur d'abord, en gras — le lecteur a déjà la
 * série sous les yeux, c'est le nombre qu'il vient chercher.
 */
export function LigneBulle({ couleur, libelle, valeur }: { couleur?: string; libelle: string; valeur: string }) {
  return (
    <span className="flex items-baseline gap-2 whitespace-nowrap">
      {couleur && <span className="h-0.5 w-3 flex-shrink-0 rounded-full" style={{ background: couleur }} />}
      <span className="font-mono font-semibold">{valeur}</span>
      <span className="text-neutral-300">{libelle}</span>
    </span>
  );
}
