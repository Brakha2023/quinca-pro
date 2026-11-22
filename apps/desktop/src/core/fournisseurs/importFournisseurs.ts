import { nombreImport, type Cellule } from '../articles';
import {
  dateImport, parcourirTiers, preparerImportTiers, texteCellule, trouverEnteteTiers,
  type EnteteTiersTrouve, type ExistantsTiers, type LigneIgnoree,
} from '../commun/importTiers';

/**
 * Reprise d'un fichier de fournisseurs, soldes d'ouverture compris.
 *
 * Même geste que pour les clients, dans l'autre sens du compte : le solde
 * d'ouverture d'un fournisseur est ce que **la maison lui doit**. Le mécanisme
 * est commun aux deux répertoires (`core/commun/importTiers`) ; ne restent ici
 * que les noms de colonnes admis et la forme de la fiche.
 */

export type ColonneImportFournisseur =
  | 'code' | 'raison_sociale' | 'solde_initial' | 'date_effet_solde'
  | 'mobile' | 'telephone' | 'adresse' | 'email' | 'interlocuteur' | 'mobile_interlocuteur'
  | 'numero_rc' | 'numero_cc' | 'famille' | 'banque' | 'numero_compte_bancaire';

/**
 * Entêtes reconnus, normalisés. Un relevé de fournisseur dit « DETTE » ou
 * « À PAYER » là où un fichier de clients disait « CRÉANCE » : les deux
 * désignent le solde d'ouverture, chacun de son côté du compte.
 */
export const ENTETES_IMPORT_FOURNISSEUR: Record<ColonneImportFournisseur, string[]> = {
  code: ['CODE', 'CODE FOURNISSEUR', 'REFERENCE', 'REF', 'N COMPTE', 'NUMERO COMPTE'],
  raison_sociale: ['RAISON SOCIALE', 'NOM', 'FOURNISSEUR', 'DESIGNATION', 'LIBELLE'],
  solde_initial: ['SOLDE INITIAL', 'SOLDE', 'SOLDE D OUVERTURE', 'SOLDE OUVERTURE', 'DETTE', 'DU', 'A PAYER', 'RESTE A PAYER', 'ANCIEN SOLDE'],
  date_effet_solde: ['DATE SOLDE', 'DATE EFFET', 'DATE D EFFET', 'ARRETE AU', 'AU'],
  mobile: ['MOBILE', 'PORTABLE', 'CELLULAIRE', 'GSM'],
  telephone: ['TELEPHONE', 'TEL', 'FIXE'],
  adresse: ['ADRESSE', 'LOCALISATION', 'SITUATION', 'VILLE'],
  email: ['EMAIL', 'E MAIL', 'MAIL', 'COURRIEL'],
  interlocuteur: ['INTERLOCUTEUR', 'CONTACT', 'RESPONSABLE', 'REPRESENTANT'],
  mobile_interlocuteur: ['MOBILE INTERLOCUTEUR', 'TEL CONTACT', 'MOBILE CONTACT'],
  numero_rc: ['RC', 'N RC', 'NUMERO RC', 'REGISTRE COMMERCE'],
  numero_cc: ['CC', 'N CC', 'NUMERO CC', 'COMPTE CONTRIBUABLE'],
  famille: ['FAMILLE', 'CATEGORIE', 'SECTEUR', 'ACTIVITE'],
  banque: ['BANQUE'],
  numero_compte_bancaire: ['COMPTE BANCAIRE', 'N COMPTE BANCAIRE', 'RIB', 'IBAN'],
};

export class EntetesFournisseurIntrouvablesError extends Error {
  constructor() {
    super(
      "Entêtes introuvables : la feuille doit comporter une ligne d'entêtes avec au moins « NOM » (ou « RAISON SOCIALE ») au-dessus des fournisseurs.",
    );
    this.name = 'EntetesFournisseurIntrouvablesError';
  }
}

/** Un fournisseur lu dans la feuille, avant tout contrôle. */
export interface LigneImportFournisseur {
  code: string;
  raison_sociale: string;
  /** Positif : la maison lui doit. Négatif : elle a une avance à son crédit. */
  solde_initial: number;
  date_effet_solde: string;
  mobile: string;
  telephone: string;
  adresse: string;
  email: string;
  interlocuteur: string;
  mobile_interlocuteur: string;
  numero_rc: string;
  numero_cc: string;
  famille: string;
  banque: string;
  numero_compte_bancaire: string;
}

export const trouverEnteteFournisseur = (grille: Cellule[][]): EnteteTiersTrouve<ColonneImportFournisseur> | null =>
  trouverEnteteTiers(grille, ENTETES_IMPORT_FOURNISSEUR, 'raison_sociale');

/** Lignes d'import d'une feuille : titres, entêtes répétés et totaux écartés. */
export function fournisseursDepuisGrille(grille: Cellule[][]): LigneImportFournisseur[] {
  const entete = trouverEnteteFournisseur(grille);
  if (!entete) throw new EntetesFournisseurIntrouvablesError();
  return parcourirTiers(grille, ENTETES_IMPORT_FOURNISSEUR, { nom: 'raison_sociale', code: 'code' }, entete).map((lire) => ({
    code: texteCellule(lire('code')),
    raison_sociale: texteCellule(lire('raison_sociale')),
    solde_initial: nombreImport(lire('solde_initial')),
    date_effet_solde: dateImport(lire('date_effet_solde')),
    mobile: texteCellule(lire('mobile')),
    telephone: texteCellule(lire('telephone')),
    adresse: texteCellule(lire('adresse')),
    email: texteCellule(lire('email')),
    interlocuteur: texteCellule(lire('interlocuteur')),
    mobile_interlocuteur: texteCellule(lire('mobile_interlocuteur')),
    numero_rc: texteCellule(lire('numero_rc')),
    numero_cc: texteCellule(lire('numero_cc')),
    famille: texteCellule(lire('famille')),
    banque: texteCellule(lire('banque')),
    numero_compte_bancaire: texteCellule(lire('numero_compte_bancaire')),
  }));
}

export interface ResultatImportFournisseurs {
  importes: number;
  ignores: LigneIgnoree[];
  /** Somme des soldes d'ouverture repris : à rapprocher du total du fichier. */
  soldeRepris: number;
}

/** Trie ce qui peut entrer de ce qui doit être écarté (voir `preparerImportTiers`). */
export const preparerImportFournisseurs = (lignes: readonly LigneImportFournisseur[], existants: ExistantsTiers) =>
  preparerImportTiers(lignes, existants, 'au répertoire');
