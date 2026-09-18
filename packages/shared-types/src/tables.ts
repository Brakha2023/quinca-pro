/**
 * Description des tables synchronisées, telle qu'elles existent dans la base
 * SQLite locale (PowerSync). C'est la source unique pour :
 *   - les types de lignes (`Row<'articles'>`) utilisés par toutes les apps ;
 *   - le schéma PowerSync construit côté client.
 *
 * Correspondance avec Postgres (supabase/migrations) :
 *   uuid / text / timestamptz  → 'text'   (dates en ISO 8601)
 *   boolean                    → 'integer' (0 / 1)
 *   numeric                    → 'real'
 * La colonne `id` est implicite sur chaque table.
 */

export type ColumnType = 'text' | 'integer' | 'real';

const COMMUNES_HORODATAGE = { created_at: 'text', updated_at: 'text' } as const;

export const TABLES = {
  filiales: {
    code: 'text',
    nom: 'text',
    type: 'text',
    ville: 'text',
    adresse: 'text',
    telephone: 'text',
    responsable: 'text',
    est_active: 'integer',
    ...COMMUNES_HORODATAGE,
  },
  utilisateurs: {
    email: 'text',
    nom: 'text',
    prenom: 'text',
    profil: 'text',
    filiale_id: 'text',
    est_actif: 'integer',
    /** Empreinte PBKDF2 du mot de passe pour le déverrouillage hors ligne (jamais le mot de passe). */
    empreinte_hors_ligne: 'text',
    ...COMMUNES_HORODATAGE,
  },
  depots: {
    code: 'text',
    nom: 'text',
    adresse: 'text',
    responsable: 'text',
    filiale_id: 'text',
    est_actif: 'integer',
    ...COMMUNES_HORODATAGE,
  },
  caisses: {
    code: 'text',
    nom: 'text',
    filiale_id: 'text',
    responsable: 'text',
    solde_actuel: 'real',
    est_active: 'integer',
    ...COMMUNES_HORODATAGE,
  },
  familles_articles: {
    code: 'text',
    nom: 'text',
    description: 'text',
    filiale_id: 'text',
    est_active: 'integer',
    ...COMMUNES_HORODATAGE,
  },
  articles: {
    code: 'text',
    designation: 'text',
    famille_id: 'text',
    sous_famille: 'text',
    prix_achat: 'real',
    prix_vente: 'real',
    prix_vip: 'real',
    tva: 'real',
    stock_min: 'real',
    stock_max: 'real',
    unite: 'text',
    image_url: 'text',
    filiale_id: 'text',
    est_actif: 'integer',
    ...COMMUNES_HORODATAGE,
  },
  stocks: {
    article_id: 'text',
    depot_id: 'text',
    filiale_id: 'text',
    quantite: 'real',
    quantite_reservee: 'real',
    quantite_disponible: 'real',
    cout_moyen: 'real',
    date_dernier_mouvement: 'text',
    updated_at: 'text',
  },
  mouvements_stock: {
    article_id: 'text',
    depot_id: 'text',
    filiale_id: 'text',
    type: 'text',
    quantite: 'real',
    quantite_avant: 'real',
    quantite_apres: 'real',
    cout_unitaire: 'real',
    reference: 'text',
    motif: 'text',
    utilisateur_id: 'text',
    created_at: 'text',
  },
  productions: {
    numero: 'text',
    depot_id: 'text',
    filiale_id: 'text',
    equipe: 'text',
    date_debut: 'text',
    date_fin: 'text',
    cout_matieres: 'real',
    commentaire: 'text',
    utilisateur_id: 'text',
    ...COMMUNES_HORODATAGE,
  },
  lignes_production: {
    production_id: 'text',
    filiale_id: 'text',
    sens: 'text',
    article_id: 'text',
    code_article: 'text',
    designation: 'text',
    unite: 'text',
    quantite_prevue: 'real',
    quantite: 'real',
    pertes: 'real',
    cout_unitaire: 'real',
    created_at: 'text',
  },
  clients: {
    code: 'text',
    raison_sociale: 'text',
    mobile: 'text',
    email: 'text',
    adresse: 'text',
    contact: 'text',
    solde_initial: 'real',
    cumul_factures: 'real',
    cumul_reglements: 'real',
    solde_actuel: 'real',
    plafond_credit: 'real',
    filiale_id: 'text',
    est_actif: 'integer',
    ...COMMUNES_HORODATAGE,
  },
  fournisseurs: {
    code: 'text',
    numero_compte: 'text',
    raison_sociale: 'text',
    famille: 'text',
    type_article: 'text',
    telephone: 'text',
    email: 'text',
    adresse: 'text',
    solde_initial: 'real',
    cumul_factures: 'real',
    cumul_reglements: 'real',
    solde_actuel: 'real',
    plafond_credit: 'real',
    filiale_id: 'text',
    est_actif: 'integer',
    ...COMMUNES_HORODATAGE,
  },
  ventes: {
    numero: 'text',
    date_vente: 'text',
    client_id: 'text',
    utilisateur_id: 'text',
    caisse_id: 'text',
    filiale_id: 'text',
    total_brut_ht: 'real',
    total_remise: 'real',
    total_net_ht: 'real',
    total_tva: 'real',
    total_ttc: 'real',
    montant_percu: 'real',
    reste_a_payer: 'real',
    monnaie: 'real',
    mode_paiement: 'text',
    statut: 'text',
    notes: 'text',
    ...COMMUNES_HORODATAGE,
  },
  lignes_vente: {
    vente_id: 'text',
    filiale_id: 'text',
    article_id: 'text',
    code_article: 'text',
    designation: 'text',
    quantite: 'real',
    prix_unitaire_ht: 'real',
    prix_unitaire_ttc: 'real',
    remise_percent: 'real',
    tva_percent: 'real',
    total_ht: 'real',
    total_ttc: 'real',
    depot_id: 'text',
  },
  reglements_clients: {
    numero: 'text',
    client_id: 'text',
    vente_id: 'text',
    date_reglement: 'text',
    montant: 'real',
    type_reglement: 'text',
    reference: 'text',
    caisse_id: 'text',
    utilisateur_id: 'text',
    filiale_id: 'text',
    created_at: 'text',
  },
  livraisons: {
    numero: 'text',
    vente_id: 'text',
    client_id: 'text',
    adresse_livraison: 'text',
    chauffeur: 'text',
    vehicule: 'text',
    statut: 'text',
    date_livraison_prevue: 'text',
    date_livraison_reelle: 'text',
    filiale_id: 'text',
    ...COMMUNES_HORODATAGE,
  },
  commandes_fournisseurs: {
    numero: 'text',
    fournisseur_id: 'text',
    date_commande: 'text',
    type: 'text',
    statut: 'text',
    total_ht: 'real',
    total_tva: 'real',
    total_ttc: 'real',
    montant_paye: 'real',
    reste_a_payer: 'real',
    date_livraison_prevue: 'text',
    notes: 'text',
    filiale_id: 'text',
    ...COMMUNES_HORODATAGE,
  },
  reglements_fournisseurs: {
    numero: 'text',
    fournisseur_id: 'text',
    commande_id: 'text',
    date_reglement: 'text',
    montant: 'real',
    type_reglement: 'text',
    reference: 'text',
    caisse_id: 'text',
    utilisateur_id: 'text',
    filiale_id: 'text',
    created_at: 'text',
  },
  mouvements_tresorerie: {
    type: 'text',
    categorie: 'text',
    montant: 'real',
    description: 'text',
    reference: 'text',
    caisse_id: 'text',
    utilisateur_id: 'text',
    filiale_id: 'text',
    date_operation: 'text',
    created_at: 'text',
  },
  audit_log: {
    utilisateur_id: 'text',
    action: 'text',
    table_cible: 'text',
    enregistrement_id: 'text',
    anciennes_valeurs: 'text',
    nouvelles_valeurs: 'text',
    filiale_id: 'text',
    created_at: 'text',
  },
} as const satisfies Record<string, Record<string, ColumnType>>;

export type Tables = typeof TABLES;
export type TableName = keyof Tables;

type TsType<C> = C extends 'text' ? string : C extends 'integer' | 'real' ? number : never;

/**
 * Ligne brute d'une table telle que lue dans SQLite : toutes les colonnes
 * (sauf `id`) sont nullables — les entités du domaine (core/) appliquent
 * ensuite les invariants métier.
 */
export type Row<T extends TableName> = { id: string } & {
  [C in keyof Tables[T]]: TsType<Tables[T][C]> | null;
};

export type FilialeRow = Row<'filiales'>;
export type UtilisateurRow = Row<'utilisateurs'>;
export type DepotRow = Row<'depots'>;
export type CaisseRow = Row<'caisses'>;
export type FamilleArticleRow = Row<'familles_articles'>;
export type ArticleRow = Row<'articles'>;
export type StockRow = Row<'stocks'>;
export type MouvementStockRow = Row<'mouvements_stock'>;
export type ClientRow = Row<'clients'>;
export type FournisseurRow = Row<'fournisseurs'>;
export type VenteRow = Row<'ventes'>;
export type LigneVenteRow = Row<'lignes_vente'>;
export type ReglementClientRow = Row<'reglements_clients'>;
export type LivraisonRow = Row<'livraisons'>;
export type CommandeFournisseurRow = Row<'commandes_fournisseurs'>;
export type ReglementFournisseurRow = Row<'reglements_fournisseurs'>;
export type MouvementTresorerieRow = Row<'mouvements_tresorerie'>;
export type AuditLogRow = Row<'audit_log'>;
export type ProductionRow = Row<'productions'>;
export type LigneProductionRow = Row<'lignes_production'>;
