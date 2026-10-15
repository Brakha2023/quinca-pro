import { z } from 'zod';
import { TYPES_REGLEMENT, type CommandeFournisseurRow, type FournisseurRow, type LigneCommandeFournisseurRow, type ReglementFournisseurRow, type StatutCommandeFournisseur, type TypeReglement } from '@quinca/shared-types';
import { arrondirMontant, montantApresRemise } from '../commun/prix';
import { LIBELLES_TYPE_REGLEMENT } from '../clients';
import { ligneBonSchema } from '../stock';

export const PERIODES_REGLEMENT = ['COMPTANT', 'J15', 'J30', 'J45', 'J60', 'FIN_DE_MOIS'] as const;
export type PeriodeReglement = (typeof PERIODES_REGLEMENT)[number];
export const LIBELLES_PERIODE_REGLEMENT: Record<PeriodeReglement, string> = {
  COMPTANT: 'Comptant', J15: '15 jours', J30: '30 jours', J45: '45 jours', J60: '60 jours', FIN_DE_MOIS: 'Fin de mois',
};

export interface Fournisseur {
  id: string;
  code: string;
  numero_compte: string | null;
  raison_sociale: string;
  famille: string | null;
  type_article: string | null;
  telephone: string | null;
  email: string | null;
  adresse: string | null;
  solde_initial: number;
  cumul_factures: number;
  cumul_reglements: number;
  /** Dette actuelle : positif = nous devons, négatif = avoir chez le fournisseur. */
  solde_actuel: number;
  plafond_credit: number;
  filiale_id: string;
  est_actif: boolean;
  mobile: string | null;
  numero_rc: string | null;
  numero_cc: string | null;
  interlocuteur: string | null;
  mobile_interlocuteur: string | null;
  date_effet_solde: string | null;
  periode_reglement: PeriodeReglement | null;
  delai_echeance_jours: number;
  avance_confirmation_percent: number;
  pourcentage_echeance: number;
  banque: string | null;
  numero_compte_bancaire: string | null;
  notes: string | null;
}

export const fournisseurFormSchema = z.object({
  code: z.string().trim().max(20).transform((s) => s.toUpperCase()).optional().default(''),
  raison_sociale: z.string().trim().min(1, 'Raison sociale obligatoire').max(120),
  numero_compte: z.string().trim().max(30).optional().default(''),
  famille: z.string().trim().max(60).optional().default(''),
  type_article: z.string().trim().max(60).optional().default(''),
  telephone: z.string().trim().max(30).optional().default(''),
  email: z.union([z.literal(''), z.string().trim().email('Email invalide')]).optional().default(''),
  adresse: z.string().trim().max(200).optional().default(''),
  solde_initial: z.coerce.number().default(0),
  plafond_credit: z.coerce.number().min(0).default(0),
  mobile: z.string().trim().max(30).optional().default(''),
  numero_rc: z.string().trim().max(40).optional().default(''),
  numero_cc: z.string().trim().max(40).optional().default(''),
  interlocuteur: z.string().trim().max(80).optional().default(''),
  mobile_interlocuteur: z.string().trim().max(30).optional().default(''),
  date_effet_solde: z.string().optional().default(''),
  periode_reglement: z.union([z.literal(''), z.enum(PERIODES_REGLEMENT)]).optional().default(''),
  delai_echeance_jours: z.coerce.number().int('Nombre de jours entier').min(0, 'Délai ≥ 0').default(0),
  avance_confirmation_percent: z.coerce.number().min(0, '0 à 100 %').max(100, '0 à 100 %').default(0),
  pourcentage_echeance: z.coerce.number().min(0, '0 à 100 %').max(100, '0 à 100 %').default(0),
  banque: z.string().trim().max(80).optional().default(''),
  numero_compte_bancaire: z.string().trim().max(40).optional().default(''),
  notes: z.string().trim().max(500).optional().default(''),
});
export type FournisseurForm = z.infer<typeof fournisseurFormSchema>;
export type FournisseurFormInput = z.input<typeof fournisseurFormSchema>;

export function fournisseurFromRow(row: FournisseurRow): Fournisseur {
  return {
    id: row.id,
    code: row.code ?? '',
    numero_compte: row.numero_compte,
    raison_sociale: row.raison_sociale ?? '',
    famille: row.famille,
    type_article: row.type_article,
    telephone: row.telephone,
    email: row.email,
    adresse: row.adresse,
    solde_initial: row.solde_initial ?? 0,
    cumul_factures: row.cumul_factures ?? 0,
    cumul_reglements: row.cumul_reglements ?? 0,
    solde_actuel: row.solde_actuel ?? 0,
    plafond_credit: row.plafond_credit ?? 0,
    filiale_id: row.filiale_id ?? '',
    est_actif: row.est_actif !== 0,
    mobile: row.mobile, numero_rc: row.numero_rc, numero_cc: row.numero_cc, interlocuteur: row.interlocuteur, mobile_interlocuteur: row.mobile_interlocuteur,
    date_effet_solde: row.date_effet_solde, periode_reglement: (row.periode_reglement as PeriodeReglement | null) ?? null,
    delai_echeance_jours: row.delai_echeance_jours ?? 0, avance_confirmation_percent: row.avance_confirmation_percent ?? 0, pourcentage_echeance: row.pourcentage_echeance ?? 0,
    banque: row.banque, numero_compte_bancaire: row.numero_compte_bancaire, notes: row.notes,
  };
}

export function fournisseurToFormInput(f: Fournisseur): FournisseurFormInput {
  return {
    code: f.code, raison_sociale: f.raison_sociale, numero_compte: f.numero_compte ?? '', famille: f.famille ?? '', type_article: f.type_article ?? '',
    telephone: f.telephone ?? '', email: f.email ?? '', adresse: f.adresse ?? '', solde_initial: f.solde_initial, plafond_credit: f.plafond_credit,
    mobile: f.mobile ?? '', numero_rc: f.numero_rc ?? '', numero_cc: f.numero_cc ?? '', interlocuteur: f.interlocuteur ?? '', mobile_interlocuteur: f.mobile_interlocuteur ?? '',
    date_effet_solde: f.date_effet_solde ?? '', periode_reglement: f.periode_reglement ?? '', delai_echeance_jours: f.delai_echeance_jours,
    avance_confirmation_percent: f.avance_confirmation_percent, pourcentage_echeance: f.pourcentage_echeance,
    banque: f.banque ?? '', numero_compte_bancaire: f.numero_compte_bancaire ?? '', notes: f.notes ?? '',
  };
}

export function calculerDette(f: Pick<Fournisseur, 'solde_initial' | 'cumul_factures' | 'cumul_reglements'>): number {
  return Math.round((f.solde_initial + f.cumul_factures - f.cumul_reglements) * 100) / 100;
}

/**
 * Achat saisi à la réception (BL / facture fournisseur) : les lignes entrent
 * en stock au coût saisi, le total devient une dette fournisseur, et un
 * acompte peut être payé immédiatement.
 */
export const achatSchema = z.object({
  fournisseur_id: z.string().min(1, 'Fournisseur obligatoire'),
  depot_id: z.string().min(1, 'Dépôt obligatoire'),
  reference: z.string().trim().max(40).optional().default(''),
  notes: z.string().trim().max(200).optional().default(''),
  tva_percent: z.coerce.number().min(0).max(100).default(0),
  lignes: z
    .array(
      ligneBonSchema.extend({
        cout_unitaire: z.preprocess((v) => (v === '' || v == null ? undefined : v), z.coerce.number({ message: 'Coût unitaire obligatoire' }).min(0, 'Coût ≥ 0')),
      }),
    )
    .min(1, 'Au moins une ligne'),
});
export type Achat = z.infer<typeof achatSchema>;

export function totauxAchat(achat: Pick<Achat, 'lignes' | 'tva_percent'>) {
  const total_ht = Math.round(achat.lignes.reduce((s, l) => s + l.quantite * l.cout_unitaire, 0) * 100) / 100;
  const total_tva = Math.round(total_ht * (achat.tva_percent / 100) * 100) / 100;
  return { total_ht, total_tva, total_ttc: Math.round((total_ht + total_tva) * 100) / 100 };
}

export const reglementFournisseurSchema = z.object({
  montant: z.coerce.number().positive('Montant > 0'),
  type_reglement: z.enum(TYPES_REGLEMENT).default('ESPECES'),
  caisse_id: z.string().min(1, 'Caisse obligatoire'),
  reference: z.string().trim().max(60).optional().default(''),
  commande_id: z.string().optional().default(''),
});
export type ReglementFournisseurForm = z.infer<typeof reglementFournisseurSchema>;
export type ReglementFournisseurFormInput = z.input<typeof reglementFournisseurSchema>;

export const LIBELLES_STATUT_COMMANDE: Record<StatutCommandeFournisseur, string> = {
  BROUILLON: 'Brouillon', ENVOYEE: 'Envoyée', PARTIELLE: 'Partielle', LIVREE: 'Livrée', ANNULEE: 'Annulée',
};

export interface CommandeFournisseur {
  id: string;
  numero: string;
  fournisseur_id: string;
  date_commande: string;
  type: 'COMMANDE' | 'BON_COMMANDE';
  statut: StatutCommandeFournisseur;
  total_ht: number;
  total_tva: number;
  total_ttc: number;
  /** Valeur TTC réceptionnée : c'est elle qui fait la dette. */
  total_recu_ttc: number;
  montant_paye: number;
  reste_a_payer: number;
  remise_percent: number;
  tva_percent: number;
  depot_id: string | null;
  date_livraison_prevue: string | null;
  date_reception: string | null;
  notes: string | null;
}

export function commandeFromRow(row: CommandeFournisseurRow): CommandeFournisseur {
  return {
    id: row.id, numero: row.numero ?? '', fournisseur_id: row.fournisseur_id ?? '', date_commande: row.date_commande ?? '',
    type: (row.type ?? 'COMMANDE') as 'COMMANDE' | 'BON_COMMANDE',
    statut: (row.statut ?? 'LIVREE') as StatutCommandeFournisseur, total_ht: row.total_ht ?? 0, total_tva: row.total_tva ?? 0,
    total_ttc: row.total_ttc ?? 0, total_recu_ttc: row.total_recu_ttc ?? 0, montant_paye: row.montant_paye ?? 0, reste_a_payer: row.reste_a_payer ?? 0,
    remise_percent: row.remise_percent ?? 0, tva_percent: row.tva_percent ?? 0, depot_id: row.depot_id, date_livraison_prevue: row.date_livraison_prevue,
    date_reception: row.date_reception, notes: row.notes,
  };
}

export interface LigneCommandeFournisseur {
  id: string;
  commande_id: string;
  article_id: string;
  code_article: string;
  designation: string;
  unite: string;
  quantite: number;
  quantite_recue: number;
  prix_unitaire_ht: number;
  /** Remise de ligne en %, négociée article par article. */
  remise_percent: number;
  /** Montant HT de la ligne, net de sa remise. */
  total_ht: number;
}

export function ligneCommandeFromRow(row: LigneCommandeFournisseurRow): LigneCommandeFournisseur {
  return {
    id: row.id, commande_id: row.commande_id ?? '', article_id: row.article_id ?? '', code_article: row.code_article ?? '', designation: row.designation ?? '',
    unite: row.unite ?? '', quantite: row.quantite ?? 0, quantite_recue: row.quantite_recue ?? 0, prix_unitaire_ht: row.prix_unitaire_ht ?? 0,
    remise_percent: row.remise_percent ?? 0, total_ht: row.total_ht ?? 0,
  };
}

/** Bon de commande envoyé au fournisseur : rien n'entre en stock, aucune dette avant réception. */
export const bonCommandeSchema = z.object({
  fournisseur_id: z.string().min(1, 'Fournisseur obligatoire'),
  depot_id: z.string().min(1, 'Dépôt de livraison obligatoire'),
  numero: z.string().trim().max(40).optional().default(''),
  date_livraison_prevue: z.string().optional().default(''),
  remise_percent: z.coerce.number().min(0).max(100).default(0),
  tva_percent: z.coerce.number().min(0).max(100).default(0),
  notes: z.string().trim().max(500).optional().default(''),
  lignes: z
    .array(z.object({
      article_id: z.string().min(1, 'Article obligatoire'),
      quantite: z.coerce.number().positive('Quantité > 0'),
      prix_unitaire_ht: z.coerce.number().min(0, 'Prix ≥ 0'),
      /** Remise de ligne en %, négociée article par article. */
      remise_percent: z.coerce.number().min(0, 'Remise ≥ 0').max(100, 'Remise ≤ 100').default(0),
    }))
    .min(1, 'Au moins une ligne'),
});
export type BonCommande = z.infer<typeof bonCommandeSchema>;

export interface TotauxCommande {
  brut_ht: number;
  /** Remises de ligne cumulées. */
  remise_lignes: number;
  /** Remise globale du bon, calculée après les remises de ligne. */
  remise_globale: number;
  /** Total des remises accordées (lignes + globale). */
  remise: number;
  net_ht: number;
  tva: number;
  net_a_payer: number;
}

/** Montant HT d'une ligne, net de sa propre remise. */
export const totalLigneCommande = (l: { quantite: number; prix_unitaire_ht: number; remise_percent?: number }): number =>
  montantApresRemise(l.quantite * l.prix_unitaire_ht, l.remise_percent ?? 0);

/**
 * Totaux d'un bon : les remises de ligne s'appliquent d'abord, la remise
 * globale ensuite sur ce qu'il reste — l'ordre inverse ferait payer deux fois
 * la même réduction au fournisseur.
 */
export function totauxCommande(c: {
  remise_percent: number;
  tva_percent: number;
  lignes: Array<{ quantite: number; prix_unitaire_ht: number; remise_percent?: number }>;
}): TotauxCommande {
  const brut_ht = arrondirMontant(c.lignes.reduce((s, l) => s + l.quantite * l.prix_unitaire_ht, 0));
  const apres_lignes = arrondirMontant(c.lignes.reduce((s, l) => s + totalLigneCommande(l), 0));
  const remise_lignes = arrondirMontant(brut_ht - apres_lignes);
  const net_ht = montantApresRemise(apres_lignes, c.remise_percent);
  const remise_globale = arrondirMontant(apres_lignes - net_ht);
  const tva = arrondirMontant(net_ht * (c.tva_percent / 100));
  return {
    brut_ht,
    remise_lignes,
    remise_globale,
    remise: arrondirMontant(remise_lignes + remise_globale),
    net_ht,
    tva,
    net_a_payer: arrondirMontant(net_ht + tva),
  };
}

/** Réception (totale ou partielle) d'un bon de commande : quantités reçues par ligne. */
export const receptionSchema = z.object({
  depot_id: z.string().min(1, 'Dépôt obligatoire'),
  reference: z.string().trim().max(40).optional().default(''),
  lignes: z.array(z.object({ ligne_id: z.string().min(1), quantite_recue: z.coerce.number().min(0, 'Quantité ≥ 0') })),
}).refine((r) => r.lignes.some((l) => l.quantite_recue > 0), { message: 'Aucune quantité reçue', path: ['lignes'] });
export type Reception = z.infer<typeof receptionSchema>;

/**
 * Valeur TTC d'une réception : les quantités reçues au prix de commande,
 * avec la remise et la TVA du bon. Refuse de recevoir plus que commandé.
 */
export function valoriserReception(commande: Pick<CommandeFournisseur, 'remise_percent' | 'tva_percent'>, lignes: LigneCommandeFournisseur[], reception: Reception): { total_ttc: number; lignes: Array<{ ligne: LigneCommandeFournisseur; quantite_recue: number; cout_unitaire: number }> } {
  const detail = reception.lignes
    .filter((r) => r.quantite_recue > 0)
    .map((r) => {
      const ligne = lignes.find((l) => l.id === r.ligne_id);
      if (!ligne) throw new Error('Ligne de commande introuvable');
      if (ligne.quantite_recue + r.quantite_recue > ligne.quantite) throw new Error(`${ligne.designation} : reçu au-delà de la quantité commandée`);
      // Le coût qui entre en stock est net des deux remises (ligne puis bon), TVA comprise.
      const net = montantApresRemise(montantApresRemise(ligne.prix_unitaire_ht, ligne.remise_percent), commande.remise_percent);
      return { ligne, quantite_recue: r.quantite_recue, cout_unitaire: arrondirMontant(net * (1 + commande.tva_percent / 100)) };
    });
  const total_ttc = arrondirMontant(detail.reduce((s, d) => s + d.cout_unitaire * d.quantite_recue, 0));
  return { total_ttc, lignes: detail };
}

export function statutApresReception(lignes: Array<{ quantite: number; quantite_recue: number }>): StatutCommandeFournisseur {
  return lignes.every((l) => l.quantite_recue >= l.quantite) ? 'LIVREE' : 'PARTIELLE';
}

/** Ligne du relevé de compte fournisseur : débit = facture (réception), crédit = règlement. */
export interface LigneReleve {
  date: string;
  piece: string;
  libelle: string;
  debit: number;
  credit: number;
  solde: number;
}

/**
 * Relevé chronologique : solde d'ouverture puis chaque réception (débit) et
 * règlement (crédit), avec solde cumulé. Le solde final est celui du compte.
 */
export function construireReleve(
  fournisseur: Pick<Fournisseur, 'solde_initial' | 'date_effet_solde'>,
  commandes: Array<Pick<CommandeFournisseur, 'numero' | 'date_reception' | 'date_commande' | 'total_recu_ttc'>>,
  reglements: Array<Pick<ReglementFournisseur, 'numero' | 'date_reglement' | 'montant' | 'type_reglement'>>,
): LigneReleve[] {
  const evenements: Array<Omit<LigneReleve, 'solde'>> = [
    ...commandes.filter((c) => c.total_recu_ttc > 0).map((c) => ({ date: c.date_reception ?? c.date_commande, piece: c.numero, libelle: 'Facture / réception', debit: c.total_recu_ttc, credit: 0 })),
    ...reglements.map((r) => ({ date: r.date_reglement, piece: r.numero, libelle: `Règlement (${LIBELLES_TYPE_REGLEMENT[r.type_reglement]})`, debit: 0, credit: r.montant })),
  ].sort((a, b) => a.date.localeCompare(b.date));
  let solde = fournisseur.solde_initial;
  const releve: LigneReleve[] = [{ date: fournisseur.date_effet_solde ?? '', piece: '', libelle: 'Solde initial', debit: 0, credit: 0, solde }];
  for (const e of evenements) {
    solde = arrondirMontant(solde + e.debit - e.credit);
    releve.push({ ...e, solde });
  }
  return releve;
}

export interface ContexteRelance {
  filiale: { nom: string; telephone?: string | null };
  fournisseur: Pick<Fournisseur, 'raison_sociale' | 'interlocuteur' | 'solde_actuel'>;
  commandesEnAttente: Array<Pick<CommandeFournisseur, 'numero' | 'date_commande' | 'date_livraison_prevue' | 'total_ttc'>>;
  signataire: string;
}

/** Objet et corps d'un e-mail de relance : commandes non livrées et/ou avoir à récupérer. */
export function composerRelance(ctx: ContexteRelance, formaterMontant: (n: number) => string, formaterDate: (iso: string | null) => string): { objet: string; corps: string } {
  const lignes: string[] = [`Bonjour ${ctx.fournisseur.interlocuteur ?? ctx.fournisseur.raison_sociale},`, ''];
  if (ctx.commandesEnAttente.length > 0) {
    lignes.push('Sauf erreur de notre part, les commandes suivantes restent en attente de livraison :');
    for (const c of ctx.commandesEnAttente) {
      lignes.push(`  - ${c.numero} du ${formaterDate(c.date_commande)}${c.date_livraison_prevue ? ` (livraison prévue le ${formaterDate(c.date_livraison_prevue)})` : ''} — ${formaterMontant(c.total_ttc)}`);
    }
    lignes.push('', 'Merci de nous confirmer la date de livraison.');
  }
  if (ctx.fournisseur.solde_actuel < 0) {
    if (ctx.commandesEnAttente.length > 0) lignes.push('');
    lignes.push(`Par ailleurs, notre compte chez vous présente un avoir de ${formaterMontant(-ctx.fournisseur.solde_actuel)} en notre faveur : merci de nous indiquer ses modalités de règlement.`);
  }
  if (ctx.commandesEnAttente.length === 0 && ctx.fournisseur.solde_actuel >= 0) {
    lignes.push('Nous revenons vers vous au sujet de notre compte.');
  }
  lignes.push('', 'Cordialement,', ctx.signataire, ctx.filiale.nom + (ctx.filiale.telephone ? ` · ${ctx.filiale.telephone}` : ''));
  const objet = ctx.commandesEnAttente.length > 0
    ? `Relance — commande${ctx.commandesEnAttente.length > 1 ? 's' : ''} ${ctx.commandesEnAttente.map((c) => c.numero).join(', ')}`
    : `Relance — compte ${ctx.filiale.nom}`;
  return { objet, corps: lignes.join('\n') };
}

export interface ReglementFournisseur {
  id: string;
  numero: string;
  fournisseur_id: string;
  commande_id: string | null;
  date_reglement: string;
  montant: number;
  type_reglement: TypeReglement;
  reference: string | null;
  caisse_id: string | null;
}

export function reglementFournisseurFromRow(row: ReglementFournisseurRow): ReglementFournisseur {
  return {
    id: row.id, numero: row.numero ?? '', fournisseur_id: row.fournisseur_id ?? '', commande_id: row.commande_id, date_reglement: row.date_reglement ?? '',
    montant: row.montant ?? 0, type_reglement: (row.type_reglement ?? 'ESPECES') as TypeReglement, reference: row.reference, caisse_id: row.caisse_id,
  };
}
