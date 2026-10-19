import { montantEnLettres } from '../commun/montantEnLettres';
import type { CommandeFournisseur, Fournisseur, LigneCommandeFournisseur, TotauxCommande } from './fournisseur';
import { totalLigneCommande, totauxCommande } from './fournisseur';

/**
 * Facture d'achat fournisseur : la pièce qui constate la dette.
 *
 * Elle ne facture que ce qui est **reçu**, jamais ce qui est commandé — c'est
 * la marchandise entrée en stock qui fait naître la dette, et une commande
 * reçue à moitié ne se paie pas en entier. Un achat direct est reçu d'un bloc :
 * les deux quantités se confondent, et la facture reprend tout.
 */

/** Nature de la pièce, telle qu'elle s'imprime au cartouche. */
export type NatureFacture = 'ACHAT' | 'RECEPTION';

export const LIBELLES_NATURE_FACTURE: Record<NatureFacture, string> = {
  ACHAT: 'Achat',
  RECEPTION: 'Réception sur bon de commande',
};

export interface LigneFactureAchat {
  id: string;
  code: string;
  designation: string;
  unite: string;
  /** Quantité facturée : la quantité reçue. */
  quantite: number;
  prix_unitaire_ht: number;
  remise_percent: number;
  /** Montant HT de la ligne, net de sa propre remise. */
  total_ht: number;
}

export interface FactureAchat {
  numero: string;
  date: string;
  operateur: string;
  depot: string;
  nature: NatureFacture;
  fournisseur: {
    raison_sociale: string;
    numero_rc: string | null;
    numero_cc: string | null;
    adresse: string | null;
    contact: string | null;
  };
  lignes: LigneFactureAchat[];
  totaux: TotauxCommande;
  remise_percent: number;
  tva_percent: number;
  /** Net à payer en toutes lettres : c'est lui qui fait foi en cas de rature. */
  montant_en_lettres: string;
  reglement: 'COMPTANT' | 'CREDIT';
  montant_paye: number;
  reste_a_payer: number;
  /** Toutes les quantités commandées n'ont pas été reçues : la facture ne porte que le reçu. */
  partielle: boolean;
  notes: string | null;
}

/** Une pièce ne se facture qu'une fois quelque chose est arrivé. */
export const estFacturable = (c: Pick<CommandeFournisseur, 'total_recu_ttc' | 'statut'>): boolean =>
  c.statut !== 'ANNULEE' && c.total_recu_ttc > 0;

/**
 * Documents qu'une pièce fournisseur sait produire : un bon de commande
 * s'imprime dès sa création, la facture seulement à partir de la réception.
 */
export function documentsCommande(c: Pick<CommandeFournisseur, 'type' | 'total_recu_ttc' | 'statut'>): Array<'BON' | 'FACTURE'> {
  if (c.type !== 'BON_COMMANDE') return ['FACTURE'];
  return estFacturable(c) ? ['BON', 'FACTURE'] : ['BON'];
}

export interface EnteteFacture {
  commande: Pick<CommandeFournisseur, 'numero' | 'date_commande' | 'date_reception' | 'type' | 'remise_percent' | 'tva_percent' | 'montant_paye' | 'reste_a_payer' | 'notes'>;
  depot: string | null;
  operateur: string | null;
  /**
   * Raison sociale portée par la pièce elle-même. La fiche du fournisseur
   * apporte le reste (RC, CC, adresse, contact) et peut arriver un instant
   * après : le nom, lui, ne doit jamais manquer sur une facture.
   */
  fournisseur_nom?: string | null;
}

/**
 * Construit la facture à partir de la pièce et de ses lignes.
 *
 * Les totaux sont recalculés sur les quantités reçues avec la remise et la TVA
 * de la pièce : ils retombent sur la dette portée au compte du fournisseur.
 */
export function construireFactureAchat(
  entete: EnteteFacture,
  lignes: readonly LigneCommandeFournisseur[],
  fournisseur: Pick<Fournisseur, 'raison_sociale' | 'numero_rc' | 'numero_cc' | 'adresse' | 'interlocuteur' | 'mobile_interlocuteur' | 'telephone'> | null,
): FactureAchat {
  const { commande } = entete;
  const facturees = lignes
    .filter((l) => l.quantite_recue > 0)
    .map<LigneFactureAchat>((l) => ({
      id: l.id,
      code: l.code_article,
      designation: l.designation,
      unite: l.unite,
      quantite: l.quantite_recue,
      prix_unitaire_ht: l.prix_unitaire_ht,
      remise_percent: l.remise_percent,
      // Le même calcul que les totaux ci-dessous : une ligne et son total ne
      // peuvent pas être obtenus de deux façons différentes.
      total_ht: totalLigneCommande({ quantite: l.quantite_recue, prix_unitaire_ht: l.prix_unitaire_ht, remise_percent: l.remise_percent }),
    }));

  const totaux = totauxCommande({
    remise_percent: commande.remise_percent,
    tva_percent: commande.tva_percent,
    lignes: facturees.map((l) => ({ quantite: l.quantite, prix_unitaire_ht: l.prix_unitaire_ht, remise_percent: l.remise_percent })),
  });

  return {
    numero: commande.numero,
    // La facture porte la date de la marchandise reçue, pas celle de la commande.
    date: commande.date_reception || commande.date_commande,
    operateur: entete.operateur ?? '—',
    depot: entete.depot ?? '—',
    nature: commande.type === 'BON_COMMANDE' ? 'RECEPTION' : 'ACHAT',
    fournisseur: {
      raison_sociale: fournisseur?.raison_sociale ?? entete.fournisseur_nom ?? '—',
      numero_rc: fournisseur?.numero_rc ?? null,
      numero_cc: fournisseur?.numero_cc ?? null,
      adresse: fournisseur?.adresse ?? null,
      contact: [fournisseur?.interlocuteur, fournisseur?.mobile_interlocuteur ?? fournisseur?.telephone].filter(Boolean).join(' · ') || null,
    },
    lignes: facturees,
    totaux,
    remise_percent: commande.remise_percent,
    tva_percent: commande.tva_percent,
    montant_en_lettres: `${montantEnLettres(totaux.net_a_payer)} francs CFA`,
    reglement: commande.reste_a_payer > 0 ? 'CREDIT' : 'COMPTANT',
    montant_paye: commande.montant_paye,
    reste_a_payer: commande.reste_a_payer,
    partielle: lignes.some((l) => l.quantite_recue < l.quantite),
    notes: commande.notes,
  };
}

