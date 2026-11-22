import { nombreImport, type Cellule } from '../articles';
import {
  dateImport, parcourirTiers, preparerImportTiers, texteCellule, trouverEnteteTiers,
  type EnteteTiersTrouve, type ExistantsTiers, type LigneIgnoree,
} from '../commun/importTiers';

/**
 * Reprise d'un fichier de clients, soldes d'ouverture compris.
 *
 * Ce module ne porte que ce qui est propre aux clients : les noms de colonnes
 * admis et la forme de la fiche. Le mécanisme — repérer les entêtes, écarter
 * titres et totaux, refuser d'écraser une fiche existante — est commun aux
 * deux répertoires et vit dans `core/commun/importTiers`.
 */

export type ColonneImportClient =
  | 'code' | 'raison_sociale' | 'solde_initial' | 'date_effet_solde'
  | 'mobile' | 'telephone' | 'adresse' | 'ville' | 'contact' | 'email'
  | 'numero_rc' | 'numero_cc' | 'plafond_credit' | 'groupe';

/**
 * Entêtes reconnus, normalisés (majuscules, sans accent, ponctuation réduite à
 * l'espace). Plusieurs façons de nommer la même colonne sont admises : un
 * fichier tenu à la main dit « NOM », un export d'ancien logiciel dit
 * « RAISON SOCIALE », et le cahier du gérant dit « CLIENT ».
 */
export const ENTETES_IMPORT_CLIENT: Record<ColonneImportClient, string[]> = {
  code: ['CODE', 'CODE CLIENT', 'REFERENCE', 'REF', 'N COMPTE', 'NUMERO COMPTE'],
  raison_sociale: ['RAISON SOCIALE', 'NOM', 'CLIENT', 'DESIGNATION', 'LIBELLE'],
  solde_initial: ['SOLDE INITIAL', 'SOLDE', 'SOLDE D OUVERTURE', 'SOLDE OUVERTURE', 'CREANCE', 'DU', 'RESTE A PAYER', 'ANCIEN SOLDE'],
  date_effet_solde: ['DATE SOLDE', 'DATE EFFET', 'DATE D EFFET', 'ARRETE AU', 'AU'],
  mobile: ['MOBILE', 'PORTABLE', 'CELLULAIRE', 'GSM'],
  telephone: ['TELEPHONE', 'TEL', 'FIXE'],
  adresse: ['ADRESSE', 'LOCALISATION', 'SITUATION'],
  ville: ['VILLE', 'COMMUNE', 'QUARTIER'],
  contact: ['CONTACT', 'INTERLOCUTEUR', 'RESPONSABLE'],
  email: ['EMAIL', 'E MAIL', 'MAIL', 'COURRIEL'],
  numero_rc: ['RC', 'N RC', 'NUMERO RC', 'REGISTRE COMMERCE'],
  numero_cc: ['CC', 'N CC', 'NUMERO CC', 'COMPTE CONTRIBUABLE'],
  plafond_credit: ['PLAFOND', 'PLAFOND CREDIT', 'LIMITE CREDIT', 'ENCOURS MAX'],
  groupe: ['GROUPE', 'CATEGORIE', 'SECTEUR'],
};

export class EntetesClientIntrouvablesError extends Error {
  constructor() {
    super(
      "Entêtes introuvables : la feuille doit comporter une ligne d'entêtes avec au moins « NOM » (ou « RAISON SOCIALE ») au-dessus des clients.",
    );
    this.name = 'EntetesClientIntrouvablesError';
  }
}

/** Un client lu dans la feuille, avant tout contrôle. */
export interface LigneImportClient {
  code: string;
  raison_sociale: string;
  /** Positif : le client doit. Négatif : il a une avance à son crédit. */
  solde_initial: number;
  date_effet_solde: string;
  mobile: string;
  telephone: string;
  adresse: string;
  ville: string;
  contact: string;
  email: string;
  numero_rc: string;
  numero_cc: string;
  plafond_credit: number;
  groupe: string;
}

export const trouverEnteteClient = (grille: Cellule[][]): EnteteTiersTrouve<ColonneImportClient> | null =>
  trouverEnteteTiers(grille, ENTETES_IMPORT_CLIENT, 'raison_sociale');

/** Lignes d'import d'une feuille : titres, entêtes répétés et totaux écartés. */
export function clientsDepuisGrille(grille: Cellule[][]): LigneImportClient[] {
  const entete = trouverEnteteClient(grille);
  if (!entete) throw new EntetesClientIntrouvablesError();
  return parcourirTiers(grille, ENTETES_IMPORT_CLIENT, { nom: 'raison_sociale', code: 'code' }, entete).map((lire) => ({
    code: texteCellule(lire('code')),
    raison_sociale: texteCellule(lire('raison_sociale')),
    solde_initial: nombreImport(lire('solde_initial')),
    date_effet_solde: dateImport(lire('date_effet_solde')),
    mobile: texteCellule(lire('mobile')),
    telephone: texteCellule(lire('telephone')),
    adresse: texteCellule(lire('adresse')),
    ville: texteCellule(lire('ville')),
    contact: texteCellule(lire('contact')),
    email: texteCellule(lire('email')),
    numero_rc: texteCellule(lire('numero_rc')),
    numero_cc: texteCellule(lire('numero_cc')),
    plafond_credit: nombreImport(lire('plafond_credit')),
    groupe: texteCellule(lire('groupe')),
  }));
}

export interface ResultatImportClients {
  importes: number;
  ignores: LigneIgnoree[];
  /** Somme des soldes d'ouverture repris : à rapprocher du total du fichier. */
  soldeRepris: number;
}

/** Trie ce qui peut entrer de ce qui doit être écarté (voir `preparerImportTiers`). */
export const preparerImportClients = (lignes: readonly LigneImportClient[], existants: ExistantsTiers) =>
  preparerImportTiers(lignes, existants, 'au répertoire');
