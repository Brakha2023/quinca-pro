/**
 * La pagination d'une liste : quelle tranche montrer, et comment le dire.
 *
 * Un catalogue de quincaillerie compte des milliers de références. Tout
 * afficher d'un coup rendait la page lourde à ouvrir et impossible à parcourir
 * — on descendait pendant dix secondes sans savoir où l'on en était. Les
 * autres listes, elles, étaient plafonnées dans leur requête : au-delà de 300
 * ou 500 lignes, le reste n'existait tout simplement plus à l'écran, et rien
 * ne le disait.
 *
 * Le découpage se fait **sur les lignes déjà lues**, pas en interrogeant la
 * base page par page. La base est locale, les listes tiennent dans la mémoire
 * du poste, et c'est l'affichage de milliers de lignes qui coûte, pas leur
 * lecture. Surtout, le total reste connu : « 51 à 100 sur 312 » n'est pas
 * calculable quand on ne lit qu'une page à la fois.
 *
 * Tout est ici, sans React : la page courante est une donnée, pas un état
 * d'écran, et une page hors bornes se ramène dans les bornes plutôt que de
 * rendre un tableau vide.
 */

/** Ce que l'utilisateur peut choisir d'afficher par page. */
export const TAILLES_PAGE = [25, 50, 100, 200] as const;

/**
 * Cinquante lignes : de quoi remplir un écran sans le noyer, et assez pour
 * qu'une recherche un peu précise tienne sur une seule page.
 */
export const TAILLE_PAGE_DEFAUT = 50;

export interface EtatPagination {
  /** Page affichée, à partir de 1, **déjà ramenée dans les bornes**. */
  page: number;
  taille: number;
  total: number;
  /** Nombre de pages ; au moins 1, même pour une liste vide. */
  pages: number;
  /** Index de la première ligne de la tranche (à partir de 0). */
  debut: number;
  /** Index suivant la dernière ligne de la tranche. */
  fin: number;
  /** Numéro de la première ligne affichée, à partir de 1 ; 0 si la liste est vide. */
  premier: number;
  /** Numéro de la dernière ligne affichée ; 0 si la liste est vide. */
  dernier: number;
  /** Vrai quand tout tient sur une page : la barre n'a alors rien à dire. */
  pageUnique: boolean;
}

const entier = (v: number, mini: number): number => {
  const n = Math.trunc(Number.isFinite(v) ? v : mini);
  return n < mini ? mini : n;
};

/**
 * L'état d'une pagination, bornes comprises.
 *
 * Une page au-delà de la dernière se ramène à la dernière : c'est le cas
 * courant quand un filtre vient de réduire la liste alors qu'on était en page
 * sept. Mieux vaut la dernière page que rien du tout.
 */
export function paginer(total: number, page: number, taille: number): EtatPagination {
  const t = entier(taille, 1);
  const n = entier(total, 0);
  const pages = Math.max(1, Math.ceil(n / t));
  const courante = Math.min(entier(page, 1), pages);
  const debut = (courante - 1) * t;
  const fin = Math.min(debut + t, n);
  return {
    page: courante,
    taille: t,
    total: n,
    pages,
    debut,
    fin,
    premier: n === 0 ? 0 : debut + 1,
    dernier: fin,
    pageUnique: pages === 1,
  };
}

/** La tranche de la page courante. */
export function trancher<T>(lignes: readonly T[], etat: EtatPagination): T[] {
  return lignes.slice(etat.debut, etat.fin);
}

/**
 * Ce que la barre annonce. Le total vient en premier parce que c'est ce qu'on
 * cherche d'abord — combien y en a-t-il ? —, la tranche ensuite.
 *
 * `nom` est le nom de la chose comptée, au singulier : « article », « client ».
 */
export function libellePagination(etat: EtatPagination, nom: string): string {
  const compte = etat.total.toLocaleString('fr-FR');
  const pluriel = etat.total > 1 ? 's' : '';
  if (etat.total === 0) return `Aucun ${nom}`;
  if (etat.pageUnique) return `${compte} ${nom}${pluriel}`;
  return `${etat.premier.toLocaleString('fr-FR')} à ${etat.dernier.toLocaleString('fr-FR')} sur ${compte} ${nom}${pluriel}`;
}

/**
 * Les numéros de page à proposer, première et dernière toujours comprises,
 * avec les voisines de la page courante. Les trous sont marqués par `null` :
 * c'est à l'affichage d'en faire des points de suspension.
 *
 * Pour un catalogue de soixante pages, la barre reste de largeur constante —
 * sans cela elle déborderait de l'écran et se mettrait à danser d'une page à
 * l'autre.
 */
export function numerosDePage(etat: EtatPagination, voisines = 1): Array<number | null> {
  const retenus = new Set<number>([1, etat.pages]);
  for (let p = etat.page - voisines; p <= etat.page + voisines; p++) {
    if (p >= 1 && p <= etat.pages) retenus.add(p);
  }
  const tries = [...retenus].sort((a, b) => a - b);

  const sortie: Array<number | null> = [];
  let precedent = 0;
  for (const p of tries) {
    // Un trou d'une seule page ne vaut pas des points de suspension : on la met.
    if (p - precedent === 2) sortie.push(precedent + 1);
    else if (p - precedent > 2) sortie.push(null);
    sortie.push(p);
    precedent = p;
  }
  return sortie;
}

/**
 * La liste a-t-elle été tronquée par le plafond de sa requête ?
 *
 * Les journaux ne lisent que les dernières centaines de lignes — c'est voulu,
 * un poste ne garde pas tout. Mais une liste qui s'arrête pile au plafond est
 * probablement incomplète, et l'écran doit le dire plutôt que de laisser
 * croire que le compte est bon.
 */
export const listePlafonnee = (total: number, plafond: number | null | undefined): boolean =>
  typeof plafond === 'number' && plafond > 0 && total >= plafond;
