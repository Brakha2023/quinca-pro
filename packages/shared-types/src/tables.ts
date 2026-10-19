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
    /**
     * Portée des données : c'est elle que lisent les sync rules et la RLS.
     * Elle n'est plus choisie à la main — le rôle la porte, un déclencheur
     * serveur la recopie ici à chaque affectation.
     */
    profil: 'text',
    /** Rôle affecté : ce que l'utilisateur a le droit de faire (voir `roles`). */
    role_id: 'text',
    filiale_id: 'text',
    est_actif: 'integer',
    /** Mot de passe par défaut jamais changé : l'application l'exige à la connexion. */
    doit_changer_mot_de_passe: 'integer',
    /** Empreinte PBKDF2 du mot de passe pour le déverrouillage hors ligne (jamais le mot de passe). */
    empreinte_hors_ligne: 'text',
    ...COMMUNES_HORODATAGE,
  },
  /**
   * Rôles : un nom, une portée de données, un jeu de permissions.
   * Table courte et sans filiale — tout le monde la reçoit, c'est l'annuaire
   * des rôles de la maison.
   */
  roles: {
    code: 'text',
    nom: 'text',
    description: 'text',
    /** Portée des données du rôle, recopiée sur `utilisateurs.profil`. */
    profil: 'text',
    /** Livré avec l'application : son code et sa portée ne se modifient pas. */
    est_systeme: 'integer',
    /** Toutes les permissions, pour toujours : le compte qui administre l'app. */
    est_superadmin: 'integer',
    est_actif: 'integer',
    ...COMMUNES_HORODATAGE,
  },
  /**
   * Permissions accordées à un rôle, une ligne par permission.
   * Le catalogue des codes vit dans `core/parametres/permissions.ts` : un code
   * inconnu d'une version plus ancienne de l'app est simplement ignoré.
   */
  roles_permissions: {
    role_id: 'text',
    permission: 'text',
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
    /** Fournisseur ayant livré la marchandise (entrées d'achat). */
    fournisseur_id: 'text',
    /** Remise de ligne en % ; `cout_unitaire` est déjà net de cette remise. */
    remise_percent: 'real',
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
    groupe: 'text',
    civilite: 'text',
    numero_compte: 'text',
    telephone: 'text',
    pays: 'text',
    ville: 'text',
    numero_rc: 'text',
    numero_cc: 'text',
    date_effet_solde: 'text',
    remise_percent: 'real',
    prise_min_jour: 'real',
    prise_max_jour: 'real',
    periode_reglement: 'text',
    notes: 'text',
    solde_initial: 'real',
    cumul_factures: 'real',
    cumul_reglements: 'real',
    solde_actuel: 'real',
    plafond_credit: 'real',
    filiale_id: 'text',
    est_actif: 'integer',
    ...COMMUNES_HORODATAGE,
  },
  proformas: {
    numero: 'text',
    client_id: 'text',
    client_nom: 'text',
    date_proforma: 'text',
    date_validite: 'text',
    statut: 'text',
    remise_percent: 'real',
    total_ht: 'real',
    total_tva: 'real',
    total_ttc: 'real',
    vente_id: 'text',
    notes: 'text',
    utilisateur_id: 'text',
    filiale_id: 'text',
    ...COMMUNES_HORODATAGE,
  },
  lignes_proforma: {
    proforma_id: 'text',
    filiale_id: 'text',
    article_id: 'text',
    code_article: 'text',
    designation: 'text',
    unite: 'text',
    quantite: 'real',
    prix_unitaire_ttc: 'real',
    tva_percent: 'real',
    remise_percent: 'real',
    total_ttc: 'real',
    created_at: 'text',
  },
  fournisseurs: {
    code: 'text',
    numero_compte: 'text',
    mobile: 'text',
    numero_rc: 'text',
    numero_cc: 'text',
    interlocuteur: 'text',
    mobile_interlocuteur: 'text',
    date_effet_solde: 'text',
    periode_reglement: 'text',
    delai_echeance_jours: 'integer',
    avance_confirmation_percent: 'real',
    pourcentage_echeance: 'real',
    banque: 'text',
    numero_compte_bancaire: 'text',
    notes: 'text',
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
    /** Horodatage propre à la ligne : il borne son flux de synchronisation (voir sync-streams.yaml). */
    created_at: 'text',
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
    depot_id: 'text',
    remise_percent: 'real',
    tva_percent: 'real',
    total_recu_ttc: 'real',
    date_reception: 'text',
    utilisateur_id: 'text',
    ...COMMUNES_HORODATAGE,
  },
  lignes_commande_fournisseur: {
    commande_id: 'text',
    filiale_id: 'text',
    article_id: 'text',
    code_article: 'text',
    designation: 'text',
    unite: 'text',
    quantite: 'real',
    quantite_recue: 'real',
    prix_unitaire_ht: 'real',
    /** Remise de ligne en %, appliquée avant la remise globale du bon. */
    remise_percent: 'real',
    total_ht: 'real',
    created_at: 'text',
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
  transferts_filiales: {
    numero: 'text',
    filiale_source_id: 'text',
    filiale_destination_id: 'text',
    caisse_source_id: 'text',
    caisse_destination_id: 'text',
    montant: 'real',
    motif: 'text',
    statut: 'text',
    date_envoi: 'text',
    date_reception: 'text',
    utilisateur_envoi_id: 'text',
    utilisateur_reception_id: 'text',
    ...COMMUNES_HORODATAGE,
  },
  /**
   * Transfert de marchandise entre filiales : la pièce qui répond de la
   * marchandise pendant qu'elle est sur la route (voir `lignes_transfert_stock`).
   */
  transferts_stock: {
    numero: 'text',
    filiale_source_id: 'text',
    filiale_destination_id: 'text',
    depot_source_id: 'text',
    depot_destination_id: 'text',
    statut: 'text',
    motif: 'text',
    transporteur: 'text',
    nombre_lignes: 'integer',
    quantite_totale: 'real',
    valeur_totale: 'real',
    date_envoi: 'text',
    date_reception: 'text',
    utilisateur_envoi_id: 'text',
    utilisateur_reception_id: 'text',
    ...COMMUNES_HORODATAGE,
  },
  /** Ligne du bon de transfert : le code fait foi, les catalogues étant propres à chaque filiale. */
  lignes_transfert_stock: {
    transfert_id: 'text',
    filiale_source_id: 'text',
    filiale_destination_id: 'text',
    article_id: 'text',
    code: 'text',
    designation: 'text',
    unite: 'text',
    quantite: 'real',
    cout_unitaire: 'real',
    prix_vente: 'real',
    montant: 'real',
    created_at: 'text',
  },
  employes: {
    matricule: 'text',
    nom: 'text',
    prenom: 'text',
    sexe: 'text',
    telephone: 'text',
    fonction: 'text',
    date_debut: 'text',
    date_fin: 'text',
    type_contrat: 'text',
    salaire_base: 'real',
    est_actif: 'integer',
    photo: 'text',
    contrat_nom: 'text',
    contrat_fichier: 'text',
    notes: 'text',
    filiale_id: 'text',
    ...COMMUNES_HORODATAGE,
  },
  pointages: {
    employe_id: 'text',
    filiale_id: 'text',
    date_pointage: 'text',
    statut: 'text',
    commentaire: 'text',
    utilisateur_id: 'text',
    ...COMMUNES_HORODATAGE,
  },
  avances_salaire: {
    numero: 'text',
    employe_id: 'text',
    filiale_id: 'text',
    periode: 'text',
    date_avance: 'text',
    montant: 'real',
    caisse_id: 'text',
    utilisateur_id: 'text',
    notes: 'text',
    created_at: 'text',
  },
  paies: {
    employe_id: 'text',
    filiale_id: 'text',
    periode: 'text',
    salaire_base: 'real',
    jours_presents: 'integer',
    jours_absents: 'integer',
    jours_justifies: 'integer',
    retenue_absences: 'real',
    primes: 'real',
    retenues: 'real',
    avances: 'real',
    brut: 'real',
    net_a_payer: 'real',
    statut: 'text',
    date_paiement: 'text',
    caisse_id: 'text',
    mode_paiement: 'text',
    reference: 'text',
    notes: 'text',
    utilisateur_id: 'text',
    ...COMMUNES_HORODATAGE,
  },
} as const satisfies Record<string, Record<string, ColumnType>>;

/*
 * `audit_log` ne figure pas ci-dessus : le journal de surveillance n'est plus
 * synchronisé sur les postes (voir supabase/sync-streams.yaml). La page Audit
 * l'interroge sur le serveur, où les colonnes `jsonb` arrivent en objets.
 */

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
export type RoleRow = Row<'roles'>;
export type RolePermissionRow = Row<'roles_permissions'>;
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
export type ProductionRow = Row<'productions'>;
export type LigneProductionRow = Row<'lignes_production'>;
export type LigneCommandeFournisseurRow = Row<'lignes_commande_fournisseur'>;
export type ProformaRow = Row<'proformas'>;
export type LigneProformaRow = Row<'lignes_proforma'>;
export type TransfertFilialeRow = Row<'transferts_filiales'>;
export type TransfertStockRow = Row<'transferts_stock'>;
export type LigneTransfertStockRow = Row<'lignes_transfert_stock'>;
export type EmployeRow = Row<'employes'>;
export type PointageRow = Row<'pointages'>;
export type AvanceSalaireRow = Row<'avances_salaire'>;
export type PaieRow = Row<'paies'>;
