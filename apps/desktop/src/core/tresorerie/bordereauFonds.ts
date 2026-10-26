import type { StatutTransfertFiliale } from '@quinca/shared-types';
import { montantEnLettresFcfa } from '../commun/montantEnLettres';

/**
 * Le bordereau qui voyage avec l'argent.
 *
 * La marchandise avait son bon de transfert, signé au départ et à l'arrivée ;
 * les espèces ne portaient rien. Or c'est d'elles qu'une pièce est le plus
 * nécessaire : un billet n'a pas de code article, et entre la caisse de départ
 * et celle d'arrivée il ne reste que la parole du porteur.
 *
 * ### Qui signe
 *
 * Le gérant ou le directeur, aux deux bouts — jamais le seul caissier : celui
 * qui compte les billets n'est pas celui qui répond de leur sortie. La pièce
 * porte donc deux cachets, et le nom de l'opérateur qui a saisi n'y tient que
 * la place d'une mention, pas celle d'une signature.
 *
 * ### Le montant en lettres
 *
 * C'est lui qui fait foi. Un chiffre se rature d'un trait de stylo sur la
 * route ; « soixante mille francs CFA » ne se rallonge pas.
 */

/** L'en-tête relu par l'écran, noms joints — tout peut être nul côté SQL. */
export interface EnteteTransfertFonds {
  numero: string | null;
  statut: string | null;
  date_envoi: string | null;
  date_reception: string | null;
  montant: number | null;
  motif: string | null;
  filiale_source_nom: string | null;
  filiale_destination_nom: string | null;
  caisse_source_nom: string | null;
  caisse_destination_nom: string | null;
  utilisateur_envoi: string | null;
  utilisateur_reception: string | null;
}

export interface BordereauFonds {
  numero: string;
  statut: StatutTransfertFiliale;
  date_envoi: string;
  date_reception: string | null;
  filiale_source: string;
  filiale_destination: string;
  caisse_source: string;
  /** Nulle tant que le destinataire n'a pas choisi la sienne. */
  caisse_destination: string | null;
  montant: number;
  /** Ce qui fait foi si les chiffres sont raturés. */
  montant_en_lettres: string;
  motif: string | null;
  /** Qui a saisi la pièce — une mention, pas une signature. */
  operateur: string;
  receptionnaire: string | null;
  /** Phrase d'état, imprimée au-dessus des cachets. */
  mention: string;
  /**
   * Un transfert annulé ne vaut pas remise de fonds. Le bordereau reste
   * imprimable — il a pu circuler, et on doit pouvoir le classer —, mais il
   * le dit assez fort pour que personne ne remette d'argent contre lui.
   */
  sans_valeur: boolean;
}

const JOUR_HEURE: Intl.DateTimeFormatOptions = {
  day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
};

const dateHeure = (iso: string | null): string => (iso ? new Date(iso).toLocaleString('fr-FR', JOUR_HEURE) : '—');

function mentionEtat(statut: StatutTransfertFiliale, e: EnteteTransfertFonds): string {
  if (statut === 'ANNULE') return 'ANNULÉ — ce bordereau ne vaut pas remise de fonds.';
  if (statut === 'RECU') {
    const ou = e.caisse_destination_nom ? ` dans ${e.caisse_destination_nom}` : '';
    return `Fonds reçus le ${dateHeure(e.date_reception)} et encaissés${ou}.`;
  }
  return 'Fonds en route — la filiale destinataire confirmera la réception à l’arrivée.';
}

export function construireBordereauFonds(e: EnteteTransfertFonds): BordereauFonds {
  const statut = (e.statut ?? 'EN_TRANSIT') as StatutTransfertFiliale;
  const montant = e.montant ?? 0;
  return {
    numero: e.numero ?? '—',
    statut,
    date_envoi: e.date_envoi ?? '',
    date_reception: e.date_reception,
    filiale_source: e.filiale_source_nom ?? '—',
    filiale_destination: e.filiale_destination_nom ?? '—',
    caisse_source: e.caisse_source_nom ?? '—',
    // Le poste de l'expéditeur ne synchronise pas les caisses d'en face : le
    // nom manque tant que le bordereau est lu du côté du départ, et c'est
    // normal — la caisse d'arrivée se désigne à la réception.
    caisse_destination: e.caisse_destination_nom,
    montant,
    montant_en_lettres: montantEnLettresFcfa(montant),
    motif: e.motif,
    operateur: e.utilisateur_envoi ?? '—',
    receptionnaire: e.utilisateur_reception,
    mention: mentionEtat(statut, e),
    sans_valeur: statut === 'ANNULE',
  };
}
