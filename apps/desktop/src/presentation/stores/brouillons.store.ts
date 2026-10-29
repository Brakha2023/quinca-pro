import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Client } from '../../core/clients';
import type { LignePanier } from '../../core/ventes';

/**
 * Ventes mises de côté au comptoir.
 *
 * Un client part chercher sa carte, un autre attend derrière : on met le
 * ticket en brouillon et on encaisse le suivant. Rien n'est vendu, rien ne
 * sort du stock, aucun numéro n'est tiré — c'est une saisie en cours, pas une
 * pièce.
 *
 * Elle reste donc **sur cette machine** et ne se synchronise pas. Deux raisons,
 * et elles vont dans le même sens : un demi-ticket n'a rien à faire dans la
 * comptabilité du groupe, et le caissier qui l'a commencé est celui qui le
 * reprendra, sur son poste. L'écran le dit, pour que personne n'attende de le
 * retrouver ailleurs.
 */
export interface BrouillonVente {
  id: string;
  /** Nom donné par le caissier, ou le client, ou l'heure de la mise de côté. */
  libelle: string;
  /** Un brouillon appartient à la filiale où il a été saisi : les prix et le stock en dépendent. */
  filialeId: string;
  lignes: LignePanier[];
  client: Client | null;
  remise: number;
  remiseAuto: boolean;
  cree_le: string;
  /** Repris tels quels pour la liste, qui n'a pas à recalculer tout un panier. */
  total_ttc: number;
  articles: number;
}

interface BrouillonsState {
  brouillons: BrouillonVente[];
  enregistrer: (brouillon: BrouillonVente) => void;
  supprimer: (id: string) => void;
}

/** Au-delà, ce n'est plus une file d'attente au comptoir mais un oubli. */
export const MAX_BROUILLONS = 20;

export const useBrouillonsStore = create<BrouillonsState>()(
  persist(
    (set) => ({
      brouillons: [],
      enregistrer: (brouillon) =>
        set((s) => ({
          // Le plus récent en tête : c'est celui qu'on reprend le plus souvent.
          brouillons: [brouillon, ...s.brouillons.filter((b) => b.id !== brouillon.id)].slice(0, MAX_BROUILLONS),
        })),
      supprimer: (id) => set((s) => ({ brouillons: s.brouillons.filter((b) => b.id !== id) })),
    }),
    { name: 'quinca-brouillons' },
  ),
);

/** Les brouillons de la filiale regardée, du plus récent au plus ancien. */
export function brouillonsDeLaFiliale(brouillons: BrouillonVente[], filialeId: string | null): BrouillonVente[] {
  if (!filialeId) return [];
  return brouillons.filter((b) => b.filialeId === filialeId);
}
