import { z } from 'zod';
import type { ParametresFilialeRow } from '@quinca/shared-types';

/**
 * Configuration d'une filiale : qui elle est, ce qu'elle doit au fisc, et à
 * quoi ressemblent ses papiers.
 *
 * Tout ce qui figure au bas d'une facture vit ici, et nulle part ailleurs : un
 * RCCM ou une mention légale ne se changent pas en recompilant l'application.
 * Chaque filiale a la sienne — ce sont des établissements distincts.
 */

// ------------------------------------------------------------
// Listes fermées
// ------------------------------------------------------------

/** Formes juridiques courantes en zone OHADA. */
export const FORMES_JURIDIQUES = [
  { code: 'SASU', libelle: 'SASU — société par actions simplifiée unipersonnelle' },
  { code: 'SAS', libelle: 'SAS — société par actions simplifiée' },
  { code: 'SARL', libelle: 'SARL — société à responsabilité limitée' },
  { code: 'SARLU', libelle: 'SARLU — SARL unipersonnelle' },
  { code: 'SA', libelle: 'SA — société anonyme' },
  { code: 'SNC', libelle: 'SNC — société en nom collectif' },
  { code: 'GIE', libelle: "GIE — groupement d'intérêt économique" },
  { code: 'EI', libelle: 'EI — entreprise individuelle' },
] as const;

/** Pays où la maison et ses fournisseurs travaillent (voir la page de connexion). */
export const PAYS = [
  "Côte d'Ivoire", 'Sénégal', 'Mali', 'Burkina Faso', 'Bénin', 'Togo', 'Niger',
  'Guinée', 'Cameroun', 'Gabon', 'France', 'Belgique', 'Suisse', 'Luxembourg',
] as const;

/** Devises de la zone, plus celles des fournisseurs européens. */
export const DEVISES = [
  { code: 'XOF', libelle: 'FCFA (XOF) — franc CFA UEMOA', symbole: 'F' },
  { code: 'XAF', libelle: 'FCFA (XAF) — franc CFA CEMAC', symbole: 'F' },
  { code: 'EUR', libelle: 'Euro (EUR)', symbole: '€' },
  { code: 'USD', libelle: 'Dollar (USD)', symbole: '$' },
] as const;

/** Comment les prix sont saisis dans cette filiale. */
export const MODES_PRIX = [
  { code: 'TTC', libelle: 'TTC (toutes taxes comprises)', detail: 'Le prix affiché est le prix payé ; la TVA est déduite du total.' },
  { code: 'HT', libelle: 'HT (hors taxes)', detail: 'La TVA est ajoutée au total.' },
] as const;

export type ModePrix = (typeof MODES_PRIX)[number]['code'];

// ------------------------------------------------------------
// Les pièces imprimées
// ------------------------------------------------------------

/** Formats de papier qu'une pièce peut prendre. */
export const FORMATS_PAPIER = ['A4', 'A5', 'TICKET'] as const;
export type FormatPapier = (typeof FORMATS_PAPIER)[number];

export interface NatureDocument {
  id: string;
  libelle: string;
  /** Ce que la pièce est, en une ligne — pour que le réglage se comprenne. */
  detail: string;
  /** Formats que cette pièce accepte : un journal ne sort pas en 80 mm. */
  formats: readonly FormatPapier[];
  format_defaut: FormatPapier;
  /** Préfixe de numérotation livré (voir `core/commun/numerotation.ts`). */
  prefixe_defaut: string;
}

/**
 * Les pièces que l'application imprime, et ce qu'on peut régler pour chacune.
 *
 * C'est **ici** que vit la liste, pas dans un CHECK Postgres : ajouter une
 * pièce ne doit pas demander une migration. Le serveur stocke un JSON et
 * ignore ce qu'il ne connaît pas — un poste resté en version ancienne ignore
 * de la même façon une pièce plus récente que lui.
 */
export const NATURES_DOCUMENTS: readonly NatureDocument[] = [
  { id: 'facture', libelle: 'Facture', detail: 'La facture de vente remise au client.', formats: ['A4', 'A5'], format_defaut: 'A4', prefixe_defaut: 'FAC' },
  { id: 'recu_vente', libelle: 'Reçu de vente', detail: 'Le ticket de caisse du comptoir.', formats: ['A4', 'A5', 'TICKET'], format_defaut: 'TICKET', prefixe_defaut: 'VNT' },
  { id: 'recu_versement', libelle: 'Reçu de versement', detail: "Le reçu d'un règlement client ou d'un mouvement de caisse.", formats: ['A4', 'A5', 'TICKET'], format_defaut: 'A5', prefixe_defaut: 'REG' },
  { id: 'bon_livraison', libelle: 'Bon de livraison', detail: 'Ce qui accompagne la marchandise qui sort.', formats: ['A4', 'A5'], format_defaut: 'A4', prefixe_defaut: 'BL' },
  { id: 'bon_commande', libelle: 'Bon de commande', detail: 'La commande passée à un fournisseur.', formats: ['A4', 'A5'], format_defaut: 'A4', prefixe_defaut: 'BC' },
  { id: 'proforma', libelle: 'Facture proforma', detail: "Le devis remis avant la vente.", formats: ['A4', 'A5'], format_defaut: 'A4', prefixe_defaut: 'PRO' },
  { id: 'bon_stock', libelle: 'Bon de stock', detail: 'Entrée, sortie, casse, transfert entre dépôts.', formats: ['A4', 'A5'], format_defaut: 'A4', prefixe_defaut: 'ENT' },
  { id: 'journal', libelle: 'Journal / Historique', detail: 'Les listes : ventes, stock, caisses, historiques.', formats: ['A4'], format_defaut: 'A4', prefixe_defaut: 'JRN' },
] as const;

export interface ReglageDocument {
  format: FormatPapier;
  /** Imprimer sans couleur : une thermique et bien des laser de comptoir. */
  noir_blanc: boolean;
  /** Logo en haut de la pièce. */
  logo_entete: boolean;
  /** Logo pâle en fond de page. */
  logo_filigrane: boolean;
}

export type ReglagesDocuments = Record<string, ReglageDocument>;

export function reglageParDefaut(nature: NatureDocument): ReglageDocument {
  return {
    format: nature.format_defaut,
    // Le ticket part sur une thermique : la couleur n'existe pas.
    noir_blanc: nature.format_defaut === 'TICKET',
    logo_entete: true,
    logo_filigrane: false,
  };
}

/** Réglages livrés, une entrée par nature de pièce. */
export function reglagesDocumentsParDefaut(): ReglagesDocuments {
  return Object.fromEntries(NATURES_DOCUMENTS.map((n) => [n.id, reglageParDefaut(n)]));
}

/** Préfixes de numérotation livrés. */
export function prefixesParDefaut(): Record<string, string> {
  return Object.fromEntries(NATURES_DOCUMENTS.map((n) => [n.id, n.prefixe_defaut]));
}

/**
 * Relit un JSON de réglages enregistré. Tolérant par construction : une nature
 * inconnue est ignorée, une nature absente retombe sur son défaut, un format
 * que la pièce n'accepte pas est corrigé. Un réglage illisible ne doit jamais
 * empêcher d'imprimer.
 */
export function lireReglagesDocuments(json: string | null | undefined): ReglagesDocuments {
  const enregistre = lireJson(json);
  return Object.fromEntries(NATURES_DOCUMENTS.map((nature) => {
    const brut = enregistre[nature.id];
    const defaut = reglageParDefaut(nature);
    if (!brut || typeof brut !== 'object') return [nature.id, defaut];
    const r = brut as Partial<ReglageDocument>;
    const format = nature.formats.includes(r.format as FormatPapier) ? (r.format as FormatPapier) : defaut.format;
    return [nature.id, {
      format,
      noir_blanc: typeof r.noir_blanc === 'boolean' ? r.noir_blanc : defaut.noir_blanc,
      logo_entete: typeof r.logo_entete === 'boolean' ? r.logo_entete : defaut.logo_entete,
      logo_filigrane: typeof r.logo_filigrane === 'boolean' ? r.logo_filigrane : defaut.logo_filigrane,
    }];
  }));
}

/** Même tolérance pour les préfixes : un préfixe vide retombe sur le livré. */
export function lirePrefixes(json: string | null | undefined): Record<string, string> {
  const enregistre = lireJson(json);
  return Object.fromEntries(NATURES_DOCUMENTS.map((nature) => {
    const valeur = enregistre[nature.id];
    const propre = typeof valeur === 'string' ? normaliserPrefixe(valeur) : '';
    return [nature.id, propre || nature.prefixe_defaut];
  }));
}

function lireJson(json: string | null | undefined): Record<string, unknown> {
  if (!json) return {};
  try {
    const valeur: unknown = JSON.parse(json);
    return valeur && typeof valeur === 'object' && !Array.isArray(valeur) ? (valeur as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/**
 * Un préfixe entre dans un numéro de pièce (`PREFIXE-POSTE-AAAAMMJJ-XXXXXX`) :
 * il ne peut porter ni tiret, ni espace, ni accent, sous peine de rendre le
 * numéro illisible ou ambigu au téléphone.
 */
export function normaliserPrefixe(valeur: string): string {
  return valeur
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toUpperCase().replace(/[^A-Z0-9]/g, '')
    .slice(0, 5);
}

// ------------------------------------------------------------
// La fiche elle-même
// ------------------------------------------------------------

export interface Entreprise {
  id: string;
  filiale_id: string;
  nom_commercial: string;
  raison_sociale: string;
  forme_juridique: string;
  rccm: string;
  numero_cc: string;
  compte_contribuable: string;
  telephone_principal: string;
  telephone_secondaire: string;
  email: string;
  adresse: string;
  ville: string;
  pays: string;
  localisation: string;
  logo_couleur: string | null;
  logo_noir_blanc: string | null;
  logo_entete: string | null;
  logo_filigrane: string | null;
  assujetti_tva: boolean;
  taux_tva: number;
  prix_saisis: ModePrix;
  devise: string;
  mentions_legales: string;
  documents: ReglagesDocuments;
  prefixes: Record<string, string>;
  /**
   * Empreinte du code d'annulation des ventes — jamais le code lui-même.
   * Nulle : la filiale n'en a pas encore, et aucune vente ne s'y annule.
   */
  code_annulation: string | null;
  updated_at: string | null;
}

const texte = (v: unknown): string => (typeof v === 'string' ? v : '');

export function entrepriseFromRow(row: ParametresFilialeRow): Entreprise {
  return {
    id: String(row.id),
    filiale_id: texte(row.filiale_id),
    nom_commercial: texte(row.nom_commercial),
    raison_sociale: texte(row.raison_sociale),
    forme_juridique: texte(row.forme_juridique),
    rccm: texte(row.rccm),
    numero_cc: texte(row.numero_cc),
    compte_contribuable: texte(row.compte_contribuable),
    telephone_principal: texte(row.telephone_principal),
    telephone_secondaire: texte(row.telephone_secondaire),
    email: texte(row.email),
    adresse: texte(row.adresse),
    ville: texte(row.ville),
    pays: texte(row.pays) || "Côte d'Ivoire",
    localisation: texte(row.localisation),
    logo_couleur: row.logo_couleur ? String(row.logo_couleur) : null,
    logo_noir_blanc: row.logo_noir_blanc ? String(row.logo_noir_blanc) : null,
    logo_entete: row.logo_entete ? String(row.logo_entete) : null,
    logo_filigrane: row.logo_filigrane ? String(row.logo_filigrane) : null,
    assujetti_tva: Number(row.assujetti_tva ?? 1) === 1,
    taux_tva: Number(row.taux_tva ?? 18),
    prix_saisis: texte(row.prix_saisis) === 'HT' ? 'HT' : 'TTC',
    devise: texte(row.devise) || 'XOF',
    mentions_legales: texte(row.mentions_legales),
    documents: lireReglagesDocuments(row.formats_documents as string | null),
    prefixes: lirePrefixes(row.prefixes_numerotation as string | null),
    code_annulation: row.code_annulation ? String(row.code_annulation) : null,
    updated_at: row.updated_at ? String(row.updated_at) : null,
  };
}

/**
 * Ce qu'un document a besoin de savoir de la maison pour s'imprimer.
 * Tiré de la fiche, ou de la filiale seule quand la fiche n'est pas encore
 * arrivée : un document s'imprime toujours, même incomplet.
 */
export interface EnteteDocument {
  nom: string;
  raison_sociale: string;
  adresse: string;
  ville: string;
  telephone: string;
  email: string;
  /** Ligne d'identifiants fiscaux, déjà composée (vide s'il n'y en a aucun). */
  identifiants: string;
  mentions_legales: string;
  logo: string | null;
  filigrane: string | null;
  /** Initiales, quand aucun logo n'a été chargé. */
  initiales: string;
}

/**
 * Mots de liaison : ils ne comptent pas dans des initiales.
 * « Quincaillerie Cissé **et** Frère » donne QCF, pas QCE.
 */
const LIAISONS = new Set(['et', 'de', 'du', 'des', 'la', 'le', 'les', 'au', 'aux', 'd', 'l', 'the', 'and']);

/** Initiales d'une raison sociale : « Quincaillerie Cissé et Frère » → « QCF ». */
export function initiales(nom: string): string {
  const mots = nom
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .split(/[\s'-]+/)
    .filter((m) => m.length > 0 && !LIAISONS.has(m.toLowerCase()));
  return mots.slice(0, 3).map((m) => m[0]?.toUpperCase() ?? '').join('') || '?';
}

export function enteteDocument(
  entreprise: Entreprise | null,
  filiale: { nom?: string | null; adresse?: string | null; ville?: string | null; telephone?: string | null } | null,
  reglage?: ReglageDocument,
): EnteteDocument {
  const nom = entreprise?.nom_commercial || filiale?.nom || '';
  const identifiants = entreprise
    ? [
        entreprise.rccm && `RCCM ${entreprise.rccm}`,
        entreprise.numero_cc && `CC ${entreprise.numero_cc}`,
        entreprise.compte_contribuable && `CPTE ${entreprise.compte_contribuable}`,
      ].filter(Boolean).join(' · ')
    : '';
  // Le réglage de la pièce décide du logo : en noir et blanc, celui qui le
  // supporte ; sans en-tête, aucun.
  const logo = !reglage || reglage.logo_entete
    ? (reglage?.noir_blanc
        ? entreprise?.logo_noir_blanc ?? entreprise?.logo_entete ?? entreprise?.logo_couleur ?? null
        : entreprise?.logo_entete ?? entreprise?.logo_couleur ?? null)
    : null;
  return {
    nom,
    raison_sociale: entreprise?.raison_sociale ?? '',
    adresse: entreprise?.adresse || filiale?.adresse || '',
    ville: entreprise?.ville || filiale?.ville || '',
    telephone: entreprise?.telephone_principal || filiale?.telephone || '',
    email: entreprise?.email ?? '',
    identifiants,
    mentions_legales: entreprise?.mentions_legales ?? '',
    logo,
    filigrane: reglage?.logo_filigrane ? entreprise?.logo_filigrane ?? null : null,
    initiales: initiales(nom),
  };
}

// ------------------------------------------------------------
// Validation de la saisie
// ------------------------------------------------------------

const facultatif = (max: number) => z.string().trim().max(max).optional().or(z.literal(''));

export const entrepriseFormSchema = z.object({
  nom_commercial: z.string().trim().min(2, 'Le nom commercial est obligatoire.').max(120),
  raison_sociale: facultatif(120),
  forme_juridique: facultatif(10),
  rccm: facultatif(40),
  numero_cc: facultatif(40),
  compte_contribuable: facultatif(40),
  telephone_principal: z.string().trim().min(4, 'Un téléphone est nécessaire sur les documents.').max(30),
  telephone_secondaire: facultatif(30),
  email: z.string().trim().email('Adresse e-mail invalide.').max(120).optional().or(z.literal('')),
  adresse: z.string().trim().min(2, "L'adresse figure sur chaque facture.").max(200),
  ville: z.string().trim().min(2, 'La ville est obligatoire.').max(80),
  pays: z.string().trim().min(2).max(80),
  localisation: facultatif(200),
  assujetti_tva: z.boolean(),
  taux_tva: z.coerce.number().min(0, 'Un taux ne peut être négatif.').max(100, 'Un taux dépasse rarement 100 %.'),
  prix_saisis: z.enum(['TTC', 'HT']),
  devise: z.string().trim().min(3).max(3),
  mentions_legales: facultatif(600),
});

export type EntrepriseForm = z.infer<typeof entrepriseFormSchema>;
/** Ce que le formulaire porte avant validation (le taux arrive en texte). */
export type EntrepriseFormInput = z.input<typeof entrepriseFormSchema>;

/** Taille maximale d'un logo une fois réduit, en octets. */
export const TAILLE_MAX_LOGO = 2 * 1024 * 1024;

/** Un récapitulatif pour l'écran : ce qui manque encore à cette fiche. */
export function champsManquants(e: Entreprise): string[] {
  const manquants: string[] = [];
  if (!e.raison_sociale) manquants.push('la raison sociale');
  if (!e.rccm) manquants.push('le RCCM');
  if (!e.compte_contribuable) manquants.push('le compte contribuable');
  if (!e.telephone_principal) manquants.push('le téléphone');
  if (!e.adresse) manquants.push("l'adresse");
  if (!e.logo_entete && !e.logo_couleur) manquants.push('un logo');
  return manquants;
}
