import { column, Schema, Table } from '@powersync/web';

// Définition des tables côté client (API PowerSync actuelle)
const filiales = new Table({
  code: column.text,
  nom: column.text,
  adresse: column.text,
  telephone: column.text,
  responsable: column.text,
  est_active: column.integer,
});

const utilisateurs = new Table({
  email: column.text,
  nom: column.text,
  prenom: column.text,
  mot_de_passe_hash: column.text,
  profil: column.text,
  filiale_id: column.text,
  est_actif: column.integer,
});

const caisses = new Table({
  code: column.text,
  nom: column.text,
  filiale_id: column.text,
  responsable: column.text,
  solde_actuel: column.real,
  est_active: column.integer,
});

const familles_articles = new Table({
  code: column.text,
  nom: column.text,
  description: column.text,
  filiale_id: column.text,
  est_active: column.integer,
});

const articles = new Table({
  code: column.text,
  designation: column.text,
  famille_id: column.text,
  sous_famille: column.text,
  prix_achat: column.real,
  prix_vente: column.real,
  prix_vip: column.real,
  tva: column.real,
  stock_min: column.real,
  stock_max: column.real,
  unite: column.text,
  image_url: column.text,
  filiale_id: column.text,
});

const stocks = new Table({
  article_id: column.text,
  depot_id: column.text,
  quantite: column.real,
  quantite_reservee: column.real,
  quantite_disponible: column.real,
  cout_moyen: column.real,
  date_dernier_mouvement: column.text,
});

const depots = new Table({
  code: column.text,
  nom: column.text,
  adresse: column.text,
  responsable: column.text,
  filiale_id: column.text,
  est_actif: column.integer,
});

const mouvements_stock = new Table({
  article_id: column.text,
  depot_id: column.text,
  type: column.text,
  quantite: column.real,
  quantite_avant: column.real,
  quantite_apres: column.real,
  cout_unitaire: column.real,
  reference: column.text,
  motif: column.text,
  utilisateur_id: column.text,
  filiale_id: column.text,
});

const clients = new Table({
  code: column.text,
  raison_sociale: column.text,
  mobile: column.text,
  email: column.text,
  adresse: column.text,
  contact: column.text,
  solde_initial: column.real,
  cumul_factures: column.real,
  cumul_reglements: column.real,
  solde_actuel: column.real,
  disponibilite: column.real,
  plafond_credit: column.real,
  filiale_id: column.text,
  est_actif: column.integer,
});

const fournisseurs = new Table({
  code: column.text,
  numero_compte: column.text,
  raison_sociale: column.text,
  famille: column.text,
  type_article: column.text,
  telephone: column.text,
  email: column.text,
  adresse: column.text,
  solde_initial: column.real,
  cumul_factures: column.real,
  cumul_reglements: column.real,
  solde_actuel: column.real,
  plafond_credit: column.real,
  filiale_id: column.text,
  est_actif: column.integer,
});

const ventes = new Table({
  numero: column.text,
  date_vente: column.text,
  heure_vente: column.text,
  client_id: column.text,
  utilisateur_id: column.text,
  caisse_id: column.text,
  filiale_id: column.text,
  total_brut_ht: column.real,
  total_remise: column.real,
  total_net_ht: column.real,
  total_tva: column.real,
  total_ttc: column.real,
  montant_percu: column.real,
  reste_a_payer: column.real,
  monnaie: column.real,
  mode_paiement: column.text,
  statut: column.text,
  session_id: column.text,
  notes: column.text,
  synced_at: column.text,
});

const lignes_vente = new Table({
  vente_id: column.text,
  article_id: column.text,
  code_article: column.text,
  designation: column.text,
  quantite: column.real,
  prix_unitaire_ht: column.real,
  prix_unitaire_ttc: column.real,
  remise_percent: column.real,
  tva_percent: column.real,
  total_ht: column.real,
  total_ttc: column.real,
  depot_id: column.text,
});

const reglements_clients = new Table({
  numero: column.text,
  client_id: column.text,
  vente_id: column.text,
  date_reglement: column.text,
  montant: column.real,
  type_reglement: column.text,
  reference: column.text,
  caisse_id: column.text,
  utilisateur_id: column.text,
  filiale_id: column.text,
});

const commandes_fournisseurs = new Table({
  numero: column.text,
  fournisseur_id: column.text,
  date_commande: column.text,
  type: column.text,
  statut: column.text,
  total_ht: column.real,
  total_tva: column.real,
  total_ttc: column.real,
  reste_a_payer: column.real,
  montant_paye: column.real,
  date_livraison_prevue: column.text,
  notes: column.text,
  filiale_id: column.text,
});

const reglements_fournisseurs = new Table({
  numero: column.text,
  fournisseur_id: column.text,
  commande_id: column.text,
  date_reglement: column.text,
  montant: column.real,
  type_reglement: column.text,
  reference: column.text,
  caisse_id: column.text,
  filiale_id: column.text,
});

const mouvements_tresorerie = new Table({
  type: column.text,
  categorie: column.text,
  montant: column.real,
  description: column.text,
  reference: column.text,
  caisse_id: column.text,
  utilisateur_id: column.text,
  filiale_id: column.text,
  date_operation: column.text,
});

const livraisons = new Table({
  numero: column.text,
  vente_id: column.text,
  client_id: column.text,
  adresse_livraison: column.text,
  chauffeur: column.text,
  vehicule: column.text,
  statut: column.text,
  date_livraison_prevue: column.text,
  date_livraison_reelle: column.text,
  filiale_id: column.text,
});

const audit_log = new Table({
  utilisateur_id: column.text,
  action: column.text,
  table_cible: column.text,
  enregistrement_id: column.text,
  anciennes_valeurs: column.text,
  nouvelles_valeurs: column.text,
  filiale_id: column.text,
  ip_address: column.text,
});

// Schéma complet
export const AppSchema = new Schema({
  filiales,
  utilisateurs,
  caisses,
  familles_articles,
  articles,
  stocks,
  depots,
  mouvements_stock,
  clients,
  fournisseurs,
  ventes,
  lignes_vente,
  reglements_clients,
  commandes_fournisseurs,
  reglements_fournisseurs,
  mouvements_tresorerie,
  livraisons,
  audit_log,
});

export type Database = (typeof AppSchema)["types"];