import { arrondirMontant } from '../commun/prix';
import { statutStock, type StatutStock } from './mouvement';

/**
 * Alertes de stock : ce qui manque, et combien il faut en commander.
 *
 * La liste sert à passer commande — elle s'imprime et se transmet. D'où un
 * calcul posé ici, et non dans l'affichage : la quantité à commander est un
 * engagement d'argent, pas une décoration d'écran.
 */

/** Nature d'alerte retenue pour une liste. */
export type NatureAlerte = 'TOUTES' | 'RUPTURE' | 'FAIBLE';

export const NATURES_ALERTE: Array<{ id: NatureAlerte; label: string }> = [
  { id: 'TOUTES', label: 'Ruptures et stocks faibles' },
  { id: 'RUPTURE', label: 'Ruptures seulement' },
  { id: 'FAIBLE', label: 'Stocks faibles seulement' },
];

export interface LigneAlerteStock {
  article_id: string;
  code: string;
  designation: string;
  unite: string;
  famille_nom?: string | null;
  quantite: number;
  stock_min: number;
  stock_max: number;
  prix_achat: number;
  valeur: number;
}

/**
 * Quantité à commander pour repasser au-dessus des seuils.
 *
 * On vise le stock **maximum** quand il est renseigné ; sinon deux fois le
 * minimum, qui laisse de quoi vendre jusqu'à la prochaine livraison. Un stock
 * négatif (vente forcée) creuse d'autant la commande, au lieu d'être ignoré.
 */
export function quantiteACommander(ligne: Pick<LigneAlerteStock, 'quantite' | 'stock_min' | 'stock_max'>): number {
  const cible = ligne.stock_max > 0 ? ligne.stock_max : ligne.stock_min * 2;
  if (cible <= 0) return 0;
  return arrondirMontant(Math.max(cible - ligne.quantite, 0));
}

/** Coût estimé de la commande, au dernier prix d'achat connu. */
export function montantACommander(ligne: LigneAlerteStock): number {
  return arrondirMontant(quantiteACommander(ligne) * (ligne.prix_achat ?? 0));
}

export function etatAlerte(ligne: LigneAlerteStock): StatutStock {
  return statutStock(ligne.quantite, ligne.stock_min, ligne.stock_max);
}

/** Lignes en alerte, de la plus urgente à la moins urgente puis par désignation. */
export function alertesStock(lignes: readonly LigneAlerteStock[], nature: NatureAlerte = 'TOUTES'): LigneAlerteStock[] {
  const retenues = lignes.filter((l) => {
    const etat = etatAlerte(l);
    if (nature === 'TOUTES') return etat === 'RUPTURE' || etat === 'FAIBLE';
    return etat === nature;
  });
  return [...retenues].sort((a, b) => {
    const rang = (l: LigneAlerteStock) => (etatAlerte(l) === 'RUPTURE' ? 0 : 1);
    return rang(a) - rang(b) || a.designation.localeCompare(b.designation, 'fr');
  });
}

export interface RecapAlertes {
  ruptures: number;
  faibles: number;
  /** Articles sans seuil renseigné : ils ne déclencheront jamais d'alerte. */
  sans_seuil: number;
  quantite_a_commander: number;
  montant_a_commander: number;
}

export function recapAlertes(lignes: readonly LigneAlerteStock[], toutes: readonly LigneAlerteStock[] = lignes): RecapAlertes {
  return {
    ruptures: lignes.filter((l) => etatAlerte(l) === 'RUPTURE').length,
    faibles: lignes.filter((l) => etatAlerte(l) === 'FAIBLE').length,
    sans_seuil: toutes.filter((l) => l.stock_min <= 0 && l.stock_max <= 0).length,
    quantite_a_commander: arrondirMontant(lignes.reduce((t, l) => t + quantiteACommander(l), 0)),
    montant_a_commander: arrondirMontant(lignes.reduce((t, l) => t + montantACommander(l), 0)),
  };
}

/** Filtres en vigueur, en une phrase. */
export function perimetreAlertes(filtres: {
  nature: NatureAlerte;
  depotNom?: string | null;
  familleNom?: string | null;
  recherche?: string;
}): string {
  return [
    NATURES_ALERTE.find((n) => n.id === filtres.nature)?.label ?? '',
    filtres.depotNom ? `dépôt « ${filtres.depotNom} »` : 'tous dépôts',
    filtres.familleNom ? `famille « ${filtres.familleNom} »` : 'toutes familles',
    filtres.recherche?.trim() ? `recherche « ${filtres.recherche.trim()} »` : null,
  ].filter(Boolean).join(' · ');
}
