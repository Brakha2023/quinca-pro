-- ============================================
-- SCHÉMA POWER SYNC POUR QUINCA PRO
-- Multi-filiales, local-first
-- ============================================

-- Table des filiales
CREATE TABLE filiales (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  nom TEXT NOT NULL,
  adresse TEXT,
  telephone TEXT,
  responsable TEXT,
  est_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Table des utilisateurs (caissiers, gérants, directeur)
CREATE TABLE utilisateurs (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  nom TEXT NOT NULL,
  prenom TEXT,
  mot_de_passe_hash TEXT NOT NULL,
  profil TEXT CHECK(profil IN ('DIRECTEUR', 'GERANT', 'CAISSIER', 'MAGASINIER')),
  filiale_id TEXT REFERENCES filiales(id),
  est_actif INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Table des caisses
CREATE TABLE caisses (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  nom TEXT NOT NULL,
  filiale_id TEXT REFERENCES filiales(id),
  responsable TEXT,
  solde_actuel REAL DEFAULT 0,
  est_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Table des familles d'articles
CREATE TABLE familles_articles (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  nom TEXT NOT NULL,
  description TEXT,
  filiale_id TEXT REFERENCES filiales(id),
  est_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Table des articles (catalogue partagé)
CREATE TABLE articles (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  designation TEXT NOT NULL,
  famille_id TEXT REFERENCES familles_articles(id),
  sous_famille TEXT,
  prix_achat REAL DEFAULT 0,
  prix_vente REAL DEFAULT 0,
  prix_vip REAL,
  tva REAL DEFAULT 18,
  stock_min REAL DEFAULT 0,
  stock_max REAL DEFAULT 0,
  unite TEXT DEFAULT 'PIECE',
  image_url TEXT,
  filiale_id TEXT REFERENCES filiales(id),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Table des stocks par dépôt
CREATE TABLE stocks (
  id TEXT PRIMARY KEY,
  article_id TEXT REFERENCES articles(id),
  depot_id TEXT,
  quantite REAL DEFAULT 0,
  quantite_reservee REAL DEFAULT 0,
  quantite_disponible REAL DEFAULT 0,
  cout_moyen REAL DEFAULT 0,
  date_dernier_mouvement TEXT,
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Table des dépôts
CREATE TABLE depots (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  nom TEXT NOT NULL,
  adresse TEXT,
  responsable TEXT,
  filiale_id TEXT REFERENCES filiales(id),
  est_actif INTEGER DEFAULT 1
);

-- Table des mouvements de stock
CREATE TABLE mouvements_stock (
  id TEXT PRIMARY KEY,
  article_id TEXT REFERENCES articles(id),
  depot_id TEXT REFERENCES depots(id),
  type TEXT CHECK(type IN (
    'ENTREE_ACHAT', 'SORTIE_VENTE', 'SORTIE_DESTOCKAGE',
    'TRANSFERT_ENTREE', 'TRANSFERT_SORTIE',
    'INVENTAIRE', 'AJUSTEMENT', 'RETOUR_CLIENT',
    'CASSERIE', 'PRODUCTION_ENTREE', 'PRODUCTION_SORTIE'
  )),
  quantite REAL NOT NULL,
  quantite_avant REAL,
  quantite_apres REAL,
  cout_unitaire REAL,
  reference TEXT,
  motif TEXT,
  utilisateur_id TEXT REFERENCES utilisateurs(id),
  filiale_id TEXT REFERENCES filiales(id),
  created_at TEXT DEFAULT (datetime('now'))
);

-- Table des clients
CREATE TABLE clients (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  raison_sociale TEXT NOT NULL,
  mobile TEXT,
  email TEXT,
  adresse TEXT,
  contact TEXT,
  solde_initial REAL DEFAULT 0,
  cumul_factures REAL DEFAULT 0,
  cumul_reglements REAL DEFAULT 0,
  solde_actuel REAL DEFAULT 0,
  disponibilite REAL DEFAULT 0,
  plafond_credit REAL DEFAULT 0,
  filiale_id TEXT REFERENCES filiales(id),
  est_actif INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Table des fournisseurs
CREATE TABLE fournisseurs (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  numero_compte TEXT,
  raison_sociale TEXT NOT NULL,
  famille TEXT,
  type_article TEXT,
  telephone TEXT,
  email TEXT,
  adresse TEXT,
  solde_initial REAL DEFAULT 0,
  cumul_factures REAL DEFAULT 0,
  cumul_reglements REAL DEFAULT 0,
  solde_actuel REAL DEFAULT 0,
  plafond_credit REAL DEFAULT 0,
  filiale_id TEXT REFERENCES filiales(id),
  est_actif INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Table des ventes (tickets de caisse)
CREATE TABLE ventes (
  id TEXT PRIMARY KEY,
  numero TEXT NOT NULL UNIQUE,
  date_vente TEXT NOT NULL,
  heure_vente TEXT NOT NULL,
  client_id TEXT REFERENCES clients(id),
  utilisateur_id TEXT REFERENCES utilisateurs(id),
  caisse_id TEXT REFERENCES caisses(id),
  filiale_id TEXT REFERENCES filiales(id),
  total_brut_ht REAL DEFAULT 0,
  total_remise REAL DEFAULT 0,
  total_net_ht REAL DEFAULT 0,
  total_tva REAL DEFAULT 0,
  total_ttc REAL DEFAULT 0,
  montant_percu REAL DEFAULT 0,
  reste_a_payer REAL DEFAULT 0,
  monnaie REAL DEFAULT 0,
  mode_paiement TEXT CHECK(mode_paiement IN ('ESPECES', 'CHEQUE', 'MOBILE_MONEY', 'CREDIT')),
  statut TEXT CHECK(statut IN ('EN_ATTENTE', 'CONSOLIDEE', 'VALIDEE', 'ANNULEE')) DEFAULT 'EN_ATTENTE',
  session_id TEXT,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  synced_at TEXT
);

-- Table des lignes de vente
CREATE TABLE lignes_vente (
  id TEXT PRIMARY KEY,
  vente_id TEXT REFERENCES ventes(id) ON DELETE CASCADE,
  article_id TEXT REFERENCES articles(id),
  code_article TEXT,
  designation TEXT,
  quantite REAL NOT NULL,
  prix_unitaire_ht REAL,
  prix_unitaire_ttc REAL,
  remise_percent REAL DEFAULT 0,
  tva_percent REAL DEFAULT 18,
  total_ht REAL,
  total_ttc REAL,
  depot_id TEXT REFERENCES depots(id)
);

-- Table des règlements clients
CREATE TABLE reglements_clients (
  id TEXT PRIMARY KEY,
  numero TEXT NOT NULL,
  client_id TEXT REFERENCES clients(id),
  vente_id TEXT REFERENCES ventes(id),
  date_reglement TEXT NOT NULL,
  montant REAL NOT NULL,
  type_reglement TEXT CHECK(type_reglement IN ('ESPECES', 'CHEQUE', 'VIREMENT', 'MOBILE_MONEY')),
  reference TEXT,
  caisse_id TEXT REFERENCES caisses(id),
  utilisateur_id TEXT REFERENCES utilisateurs(id),
  filiale_id TEXT REFERENCES filiales(id),
  created_at TEXT DEFAULT (datetime('now'))
);

-- Table des commandes fournisseurs
CREATE TABLE commandes_fournisseurs (
  id TEXT PRIMARY KEY,
  numero TEXT NOT NULL,
  fournisseur_id TEXT REFERENCES fournisseurs(id),
  date_commande TEXT NOT NULL,
  type TEXT CHECK(type IN ('COMMANDE', 'BON_COMMANDE')),
  statut TEXT CHECK(statut IN ('BROUILLON', 'ENVOYEE', 'PARTIELLE', 'LIVREE', 'ANNULEE')),
  total_ht REAL DEFAULT 0,
  total_tva REAL DEFAULT 0,
  total_ttc REAL DEFAULT 0,
  reste_a_payer REAL DEFAULT 0,
  montant_paye REAL DEFAULT 0,
  date_livraison_prevue TEXT,
  notes TEXT,
  filiale_id TEXT REFERENCES filiales(id),
  created_at TEXT DEFAULT (datetime('now'))
);

-- Table des règlements fournisseurs
CREATE TABLE reglements_fournisseurs (
  id TEXT PRIMARY KEY,
  numero TEXT NOT NULL,
  fournisseur_id TEXT REFERENCES fournisseurs(id),
  commande_id TEXT REFERENCES commandes_fournisseurs(id),
  date_reglement TEXT NOT NULL,
  montant REAL NOT NULL,
  type_reglement TEXT,
  reference TEXT,
  caisse_id TEXT REFERENCES caisses(id),
  filiale_id TEXT REFERENCES filiales(id),
  created_at TEXT DEFAULT (datetime('now'))
);

-- Table des mouvements de trésorerie
CREATE TABLE mouvements_tresorerie (
  id TEXT PRIMARY KEY,
  type TEXT CHECK(type IN ('RECETTE', 'DEPENSE')),
  categorie TEXT NOT NULL,
  montant REAL NOT NULL,
  description TEXT,
  reference TEXT,
  caisse_id TEXT REFERENCES caisses(id),
  utilisateur_id TEXT REFERENCES utilisateurs(id),
  filiale_id TEXT REFERENCES filiales(id),
  date_operation TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Table des livraisons
CREATE TABLE livraisons (
  id TEXT PRIMARY KEY,
  numero TEXT NOT NULL,
  vente_id TEXT REFERENCES ventes(id),
  client_id TEXT REFERENCES clients(id),
  adresse_livraison TEXT,
  chauffeur TEXT,
  vehicule TEXT,
  statut TEXT CHECK(statut IN ('A_PREPARER', 'EN_COURS', 'LIVREE', 'ANNULEE')) DEFAULT 'A_PREPARER',
  date_livraison_prevue TEXT,
  date_livraison_reelle TEXT,
  filiale_id TEXT REFERENCES filiales(id),
  created_at TEXT DEFAULT (datetime('now'))
);

-- Table d'audit (journal des opérations sensibles)
CREATE TABLE audit_log (
  id TEXT PRIMARY KEY,
  utilisateur_id TEXT REFERENCES utilisateurs(id),
  action TEXT NOT NULL,
  table_cible TEXT,
  enregistrement_id TEXT,
  anciennes_valeurs TEXT,
  nouvelles_valeurs TEXT,
  filiale_id TEXT REFERENCES filiales(id),
  ip_address TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- ============================================
-- INDEX POUR PERFORMANCE
-- ============================================
CREATE INDEX idx_articles_code ON articles(code);
CREATE INDEX idx_articles_famille ON articles(famille_id);
CREATE INDEX idx_ventes_date ON ventes(date_vente);
CREATE INDEX idx_ventes_filiale ON ventes(filiale_id);
CREATE INDEX idx_ventes_caisse ON ventes(caisse_id);
CREATE INDEX idx_mouvements_stock_article ON mouvements_stock(article_id);
CREATE INDEX idx_mouvements_stock_date ON mouvements_stock(created_at);
CREATE INDEX idx_clients_code ON clients(code);
CREATE INDEX idx_fournisseurs_code ON fournisseurs(code);
CREATE INDEX idx_reglements_client ON reglements_clients(client_id);
CREATE INDEX idx_audit_user ON audit_log(utilisateur_id);

-- ============================================
-- VUES CONSOLIDÉES (pour la maison mère)
-- ============================================

-- Vue : Chiffre d'affaires par filiale
CREATE VIEW vue_ca_filiale AS
SELECT 
  f.id AS filiale_id,
  f.nom AS filiale_nom,
  DATE(v.date_vente) AS date_vente,
  COUNT(v.id) AS nombre_ventes,
  SUM(v.total_ttc) AS ca_ttc,
  SUM(v.total_net_ht) AS ca_ht,
  SUM(v.total_tva) AS tva_collectee
FROM ventes v
JOIN filiales f ON v.filiale_id = f.id
WHERE v.statut = 'VALIDEE'
GROUP BY f.id, f.nom, DATE(v.date_vente);

-- Vue : Top articles vendus
CREATE VIEW vue_top_articles AS
SELECT 
  a.id AS article_id,
  a.code,
  a.designation,
  a.famille_id,
  SUM(lv.quantite) AS total_vendu,
  SUM(lv.total_ttc) AS ca_genere
FROM lignes_vente lv
JOIN articles a ON lv.article_id = a.id
JOIN ventes v ON lv.vente_id = v.id
WHERE v.statut = 'VALIDEE'
GROUP BY a.id, a.code, a.designation, a.famille_id
ORDER BY total_vendu DESC;

-- Vue : Alertes stock
CREATE VIEW vue_alertes_stock AS
SELECT 
  a.id AS article_id,
  a.code,
  a.designation,
  s.depot_id,
  d.nom AS depot_nom,
  s.quantite_disponible,
  a.stock_min,
  a.stock_max,
  CASE 
    WHEN s.quantite_disponible = 0 THEN 'RUPTURE'
    WHEN s.quantite_disponible <= a.stock_min THEN 'FAIBLE'
    ELSE 'OK'
  END AS statut_stock
FROM stocks s
JOIN articles a ON s.article_id = a.id
JOIN depots d ON s.depot_id = d.id
WHERE s.quantite_disponible <= a.stock_min;

-- Vue : Dettes clients
CREATE VIEW vue_dettes_clients AS
SELECT 
  c.id AS client_id,
  c.code,
  c.raison_sociale,
  c.filiale_id,
  f.nom AS filiale_nom,
  c.solde_actuel AS dette_actuelle,
  c.plafond_credit,
  CASE 
    WHEN c.solde_actuel > c.plafond_credit THEN 'DEPASSE'
    WHEN c.solde_actuel > 0 THEN 'EN_COURS'
    ELSE 'A_JOUR'
  END AS statut_credit
FROM clients c
LEFT JOIN filiales f ON c.filiale_id = f.id
WHERE c.solde_actuel > 0;

-- Vue : Dettes fournisseurs
CREATE VIEW vue_dettes_fournisseurs AS
SELECT 
  f.id AS fournisseur_id,
  f.code,
  f.raison_sociale,
  f.filiale_id,
  fi.nom AS filiale_nom,
  f.solde_actuel AS dette_actuelle,
  f.plafond_credit
FROM fournisseurs f
LEFT JOIN filiales fi ON f.filiale_id = fi.id
WHERE f.solde_actuel > 0;

-- Vue : Trésorerie par caisse
CREATE VIEW vue_tresorerie_caisse AS
SELECT 
  c.id AS caisse_id,
  c.nom AS caisse_nom,
  c.filiale_id,
  f.nom AS filiale_nom,
  c.solde_actuel,
  COALESCE(SUM(CASE WHEN mt.type = 'RECETTE' THEN mt.montant ELSE 0 END), 0) AS total_recettes,
  COALESCE(SUM(CASE WHEN mt.type = 'DEPENSE' THEN mt.montant ELSE 0 END), 0) AS total_depenses
FROM caisses c
LEFT JOIN filiales f ON c.filiale_id = f.id
LEFT JOIN mouvements_tresorerie mt ON mt.caisse_id = c.id
GROUP BY c.id, c.nom, c.filiale_id, f.nom, c.solde_actuel;
