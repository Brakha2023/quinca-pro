import { arrondirFcfa } from '../commun/prix';

/**
 * Les chiffres du tableau de bord.
 *
 * Le SQL ne sait que sommer : il rend des **bruts**. Tout ce qui se déduit —
 * marge, taux, résultat, panier moyen, évolution — se calcule ici, une fois,
 * pour la filiale comme pour le groupe. Un gérant et un directeur lisent ainsi
 * exactement le même chiffre, calculé par le même code.
 *
 * ### Ce que « bénéfice » veut dire ici
 *
 * Deux niveaux, et il ne faut pas les confondre :
 *
 *   * la **marge commerciale** — ce que la marchandise rapporte : chiffre
 *     d'affaires hors taxes moins ce que cette marchandise a coûté à l'achat.
 *     Le coût est celui que portait le dépôt **au moment de la sortie**, lu
 *     dans le journal des mouvements, pas le coût moyen d'aujourd'hui ;
 *   * le **résultat d'exploitation**, estimé : la marge moins les dépenses
 *     passées en caisse sur la période (transport, loyer, salaires, etc.).
 *     Estimé, parce qu'il ne voit que ce qui est passé par une caisse — une
 *     charge réglée autrement, ou un amortissement, lui échappe.
 */

/** Ce que le SQL rend, filiale par filiale. Rien n'y est déduit. */
export interface IndicateursBruts {
  filiale_id: string;
  filiale_code: string;
  filiale_nom: string;
  /** Chiffre d'affaires hors taxes, remises déduites, ventes annulées exclues. */
  ca_ht: number;
  ca_ttc: number;
  ventes: number;
  /** Encaissé sur la période (hors monnaie rendue). */
  encaisse: number;
  /** Coût d'achat de la marchandise sortie, retours clients déduits. */
  cout_ventes: number;
  /** Dépenses d'exploitation passées en caisse (ni règlements fournisseurs, ni transferts). */
  charges: number;
  creances: number;
  dettes: number;
  valeur_stock: number;
  tresorerie: number;
  /**
   * Espèces parties de cette filiale vers une autre, pas encore encaissées.
   * Elles ont quitté la caisse de départ et ne sont entrées nulle part : sans
   * cette ligne, l'argent dans la voiture ne figure sur aucun tableau.
   *
   * Compté **au départ seulement** : au niveau du groupe, la somme des
   * filiales donne donc le total en route, sans compter deux fois.
   */
  fonds_en_transit: number;
  /** Nombre de bons concernés : un transit qui dure est un oubli de réception. */
  transferts_en_transit: number;
  /**
   * Espèces qu'une autre filiale a envoyées ici, pas encore encaissées.
   *
   * C'est le **même argent** que `fonds_en_transit`, vu de l'autre bout : au
   * niveau du groupe les deux colonnes donnent le même total, et les ajouter
   * compterait chaque bon deux fois. Comptée chez le destinataire, cette ligne
   * répond à la seule question qui se pose là-bas : qu'est-ce qui m'arrive, et
   * que je n'ai pas encore mis en caisse ?
   */
  fonds_a_recevoir: number;
  /** Nombre de bons à encaisser à la réception. */
  transferts_a_recevoir: number;
  /**
   * Valeur de la marchandise partie d'ici vers une autre filiale et pas
   * encore entrée dans un dépôt. Même histoire que les espèces : elle a
   * quitté un dépôt sans entrer dans aucun autre, et sans cette ligne elle
   * ne figurerait sur aucun tableau — ni dans la valeur du stock, qui ne
   * compte que ce qui est en rayon.
   *
   * Comptée **au départ seulement** : au groupe, la somme des filiales donne
   * le total sur la route, sans doublon.
   */
  stock_en_transit: number;
  /** Nombre de bons de transfert en route. */
  transferts_stock_en_transit: number;
  /**
   * Le même chargement vu de l'arrivée : ce qu'une autre filiale a expédié
   * ici et que personne n'a encore fait entrer en stock. Comme pour les
   * fonds, les deux colonnes décrivent le même camion — elles ne
   * s'additionnent jamais.
   */
  stock_a_recevoir: number;
  transferts_stock_a_recevoir: number;
  /** Bons de livraison ni livrés ni annulés. */
  livraisons_attente: number;
  /** Parmi eux, ceux dont la date prévue est passée. */
  livraisons_retard: number;
  /** Commandes fournisseurs encore ouvertes (brouillon, envoyée, partielle). */
  commandes_ouvertes: number;
  /** Clients ayant acheté sur la période. */
  clients_servis: number;
}

export interface Indicateurs extends IndicateursBruts {
  /** CA HT − coût d'achat de la marchandise vendue. */
  marge: number;
  /** Marge rapportée au CA HT, en %. Nul si rien n'a été vendu. */
  taux_marge: number;
  /** Marge − charges d'exploitation. */
  resultat: number;
  /** CA TTC par vente. */
  panier_moyen: number;
  /** Ce qui reste à encaisser sur les ventes de la période. */
  reste_a_encaisser: number;
}

const BRUTS_VIDES: Omit<IndicateursBruts, 'filiale_id' | 'filiale_code' | 'filiale_nom'> = {
  ca_ht: 0, ca_ttc: 0, ventes: 0, encaisse: 0, cout_ventes: 0, charges: 0,
  creances: 0, dettes: 0, valeur_stock: 0, tresorerie: 0,
  fonds_en_transit: 0, transferts_en_transit: 0,
  fonds_a_recevoir: 0, transferts_a_recevoir: 0,
  stock_en_transit: 0, transferts_stock_en_transit: 0,
  stock_a_recevoir: 0, transferts_stock_a_recevoir: 0,
  livraisons_attente: 0, livraisons_retard: 0, commandes_ouvertes: 0, clients_servis: 0,
};

const nombre = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/** Lit une ligne SQL — où tout peut être nul — et en déduit le reste. */
export function indicateurs(bruts: Partial<IndicateursBruts>): Indicateurs {
  const b: IndicateursBruts = {
    filiale_id: bruts.filiale_id ?? '',
    filiale_code: bruts.filiale_code ?? '',
    filiale_nom: bruts.filiale_nom ?? '',
    ...BRUTS_VIDES,
    ...Object.fromEntries(Object.keys(BRUTS_VIDES).map((k) => [k, nombre(bruts[k as keyof IndicateursBruts])])),
  } as IndicateursBruts;

  const marge = arrondirFcfa(b.ca_ht - b.cout_ventes);
  return {
    ...b,
    marge,
    taux_marge: b.ca_ht > 0 ? Math.round((marge / b.ca_ht) * 1000) / 10 : 0,
    resultat: arrondirFcfa(marge - b.charges),
    panier_moyen: b.ventes > 0 ? arrondirFcfa(b.ca_ttc / b.ventes) : 0,
    reste_a_encaisser: arrondirFcfa(Math.max(b.ca_ttc - b.encaisse, 0)),
  };
}

/**
 * Le groupe, c'est la somme des filiales — sauf les taux, qui se recalculent.
 * Faire la moyenne de deux pourcentages donnerait un chiffre que personne ne
 * peut retrouver à la main.
 */
export function consolider(liste: Indicateurs[], nom = 'Groupe'): Indicateurs {
  const somme = (champ: keyof IndicateursBruts) => liste.reduce((t, i) => t + nombre(i[champ]), 0);
  return indicateurs({
    filiale_id: '',
    filiale_code: 'GROUPE',
    filiale_nom: nom,
    ...(Object.fromEntries(Object.keys(BRUTS_VIDES).map((k) => [k, somme(k as keyof IndicateursBruts)])) as Omit<
      IndicateursBruts, 'filiale_id' | 'filiale_code' | 'filiale_nom'
    >),
  });
}

/**
 * Variation d'une période à l'autre, en %. `null` quand la période précédente
 * est à zéro : on ne compare pas à rien, et « +∞ % » n'apprend rien.
 */
export function evolution(actuel: number, precedent: number): number | null {
  if (precedent === 0) return null;
  return Math.round(((actuel - precedent) / Math.abs(precedent)) * 1000) / 10;
}

/** Ce qui réclame une décision aujourd'hui, compté une fois pour toutes. */
export interface PointsDeVigilance {
  creances: boolean;
  dettes: boolean;
  tresorerie_negative: boolean;
  livraisons_retard: boolean;
  /** Des espèces sont en route et personne n'a confirmé leur arrivée. */
  fonds_en_transit: boolean;
  /** Des espèces arrivent ici et ne sont pas encore entrées en caisse. */
  fonds_a_recevoir: boolean;
  /** De la marchandise est partie d'ici et personne n'a confirmé son arrivée. */
  stock_en_transit: boolean;
  /** De la marchandise arrive ici et n'est pas encore entrée en stock. */
  stock_a_recevoir: boolean;
  /** Des bons de livraison restent à préparer ou sont en route chez le client. */
  livraisons_en_cours: boolean;
  marge_negative: boolean;
  resultat_negatif: boolean;
  ruptures: boolean;
  /** Nombre d'alertes levées. */
  nombre: number;
}

/**
 * `vueGroupe` éteint l'alerte « à recevoir » : au niveau du groupe, l'argent qui
 * arrive quelque part est celui qui est parti d'ailleurs — un seul bon, une
 * seule alerte, levée du côté de la caisse qui s'est vidée.
 */
export function pointsDeVigilance(i: Indicateurs, rupturesStock = 0, vueGroupe = false): PointsDeVigilance {
  const leves = {
    creances: i.creances > 0,
    dettes: i.dettes > 0,
    tresorerie_negative: i.tresorerie < 0,
    livraisons_retard: i.livraisons_retard > 0,
    fonds_en_transit: i.transferts_en_transit > 0,
    fonds_a_recevoir: !vueGroupe && i.transferts_a_recevoir > 0,
    stock_en_transit: i.transferts_stock_en_transit > 0,
    stock_a_recevoir: !vueGroupe && i.transferts_stock_a_recevoir > 0,
    // Un bon de livraison en cours n'est pas une faute : c'est un engagement
    // pris envers un client, et il se voit à côté de ceux qui sont en retard.
    livraisons_en_cours: i.livraisons_attente > 0,
    // Une marge négative n'a de sens que si l'on a vendu : sinon elle vaut zéro.
    marge_negative: i.ca_ht > 0 && i.marge < 0,
    resultat_negatif: i.ca_ht > 0 && i.resultat < 0,
    ruptures: rupturesStock > 0,
  };
  return { ...leves, nombre: Object.values(leves).filter(Boolean).length };
}
