import { useMemo, useState } from 'react';
import {
  paginer, trancher, TAILLE_PAGE_DEFAUT, type EtatPagination,
} from '../../core/commun/pagination';

/**
 * La page courante d'une liste, et sa remise à un quand les filtres changent.
 *
 * Le calcul vit dans `core/commun/pagination` ; il ne reste ici que ce qui est
 * un état d'écran. La barre qui l'affiche est `components/ui/Pagination`.
 */

export interface EtatPage extends EtatPagination {
  /** La tranche à afficher, déjà découpée. */
  trancher: <T>(lignes: readonly T[]) => T[];
  allerA: (page: number) => void;
  changerTaille: (taille: number) => void;
}

/**
 * `dependances` : ce qui, en changeant, doit ramener en première page — les
 * filtres de l'écran, le tri, la recherche. Des valeurs simples (texte,
 * nombre, booléen), qu'on compare par leur écriture.
 *
 * Le total n'en fait **pas** partie : il bouge tout seul quand une vente
 * entre, et personne ne veut être ramené en tête de liste parce qu'un collègue
 * a encaissé à l'autre caisse.
 *
 * La remise à un se fait pendant le rendu et non dans un effet : c'est de
 * l'état qu'on ajuste quand une entrée change, pas une synchronisation avec le
 * monde extérieur. React reprend le rendu aussitôt, sans passer par l'écran.
 */
export function usePagination(total: number, dependances: readonly unknown[] = []): EtatPage {
  const signature = JSON.stringify(dependances);
  const [page, setPage] = useState(1);
  const [taille, setTaille] = useState<number>(TAILLE_PAGE_DEFAUT);
  const [filtres, setFiltres] = useState(signature);

  if (filtres !== signature) {
    setFiltres(signature);
    setPage(1);
  }

  const etat = useMemo(() => paginer(total, page, taille), [total, page, taille]);

  return useMemo(() => ({
    ...etat,
    trancher: <T,>(lignes: readonly T[]) => trancher(lignes, etat),
    allerA: (p: number) => setPage(Math.max(1, p)),
    changerTaille: (t: number) => { setTaille(t); setPage(1); },
  }), [etat]);
}
