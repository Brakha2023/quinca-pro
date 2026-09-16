-- ============================================================
-- QUINCA PRO — Schéma Postgres (Supabase), source de vérité
-- Multi-filiales, local-first via PowerSync
-- ============================================================
-- Conventions
--   * Clés primaires uuid : générées côté client (hors ligne) ou par défaut ici.
--   * created_at / updated_at en timestamptz ; updated_at maintenu par trigger.
--   * Chaque table métier porte filiale_id : c'est la clé de partition des
--     sync rules PowerSync et des politiques RLS.
--   * Les énumérations sont des CHECK sur text : PowerSync les synchronise
--     telles quelles en SQLite.
-- ============================================================

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- Fonctions utilitaires
-- ------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ------------------------------------------------------------
-- Référentiel
-- ------------------------------------------------------------
create table public.filiales (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  nom         text not null,
  type        text not null default 'FILIALE' check (type in ('MAISON_MERE', 'FILIALE')),
  ville       text,
  adresse     text,
  telephone   text,
  responsable text,
  est_active  boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Profil métier lié 1:1 au compte Supabase Auth (même id).
create table public.utilisateurs (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null unique,
  nom         text not null,
  prenom      text,
  profil      text not null check (profil in ('DIRECTEUR', 'GERANT', 'CAISSIER', 'MAGASINIER')),
  filiale_id  uuid references public.filiales(id),
  est_actif   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  -- Un directeur n'est rattaché à aucune filiale ; tout autre profil l'est obligatoirement.
  constraint utilisateurs_filiale_selon_profil
    check ((profil = 'DIRECTEUR') = (filiale_id is null))
);

create table public.depots (
  id          uuid primary key default gen_random_uuid(),
  code        text not null,
  nom         text not null,
  adresse     text,
  responsable text,
  filiale_id  uuid not null references public.filiales(id),
  est_actif   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (filiale_id, code)
);

create table public.caisses (
  id           uuid primary key default gen_random_uuid(),
  code         text not null,
  nom          text not null,
  filiale_id   uuid not null references public.filiales(id),
  responsable  text,
  solde_actuel numeric(14,2) not null default 0,
  est_active   boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (filiale_id, code)
);

create table public.familles_articles (
  id          uuid primary key default gen_random_uuid(),
  code        text not null,
  nom         text not null,
  description text,
  filiale_id  uuid not null references public.filiales(id),
  est_active  boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (filiale_id, code)
);

create table public.articles (
  id           uuid primary key default gen_random_uuid(),
  code         text not null,
  designation  text not null,
  famille_id   uuid references public.familles_articles(id),
  sous_famille text,
  prix_achat   numeric(14,2) not null default 0,
  prix_vente   numeric(14,2) not null default 0,
  prix_vip     numeric(14,2),
  tva          numeric(5,2)  not null default 18,
  stock_min    numeric(14,3) not null default 0,
  stock_max    numeric(14,3) not null default 0,
  unite        text not null default 'PIECE',
  image_url    text,
  filiale_id   uuid not null references public.filiales(id),
  est_actif    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (filiale_id, code)
);

-- ------------------------------------------------------------
-- Stock
-- ------------------------------------------------------------
create table public.stocks (
  id                     uuid primary key default gen_random_uuid(),
  article_id             uuid not null references public.articles(id),
  depot_id               uuid not null references public.depots(id),
  filiale_id             uuid not null references public.filiales(id),
  quantite               numeric(14,3) not null default 0,
  quantite_reservee      numeric(14,3) not null default 0,
  quantite_disponible    numeric(14,3) not null default 0,
  cout_moyen             numeric(14,2) not null default 0,
  date_dernier_mouvement timestamptz,
  updated_at             timestamptz not null default now(),
  unique (article_id, depot_id)
);

create table public.mouvements_stock (
  id             uuid primary key default gen_random_uuid(),
  article_id     uuid not null references public.articles(id),
  depot_id       uuid not null references public.depots(id),
  filiale_id     uuid not null references public.filiales(id),
  type           text not null check (type in (
                   'ENTREE_ACHAT', 'SORTIE_VENTE', 'SORTIE_DESTOCKAGE',
                   'TRANSFERT_ENTREE', 'TRANSFERT_SORTIE',
                   'INVENTAIRE', 'AJUSTEMENT', 'RETOUR_CLIENT', 'CASSE'
                 )),
  quantite       numeric(14,3) not null,
  quantite_avant numeric(14,3),
  quantite_apres numeric(14,3),
  cout_unitaire  numeric(14,2),
  reference      text,
  motif          text,
  utilisateur_id uuid references public.utilisateurs(id),
  created_at     timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Tiers
-- ------------------------------------------------------------
create table public.clients (
  id               uuid primary key default gen_random_uuid(),
  code             text not null,
  raison_sociale   text not null,
  mobile           text,
  email            text,
  adresse          text,
  contact          text,
  solde_initial    numeric(14,2) not null default 0,
  cumul_factures   numeric(14,2) not null default 0,
  cumul_reglements numeric(14,2) not null default 0,
  solde_actuel     numeric(14,2) not null default 0,
  plafond_credit   numeric(14,2) not null default 0,
  filiale_id       uuid not null references public.filiales(id),
  est_actif        boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (filiale_id, code)
);

create table public.fournisseurs (
  id               uuid primary key default gen_random_uuid(),
  code             text not null,
  numero_compte    text,
  raison_sociale   text not null,
  famille          text,
  type_article     text,
  telephone        text,
  email            text,
  adresse          text,
  solde_initial    numeric(14,2) not null default 0,
  cumul_factures   numeric(14,2) not null default 0,
  cumul_reglements numeric(14,2) not null default 0,
  solde_actuel     numeric(14,2) not null default 0,
  plafond_credit   numeric(14,2) not null default 0,
  filiale_id       uuid not null references public.filiales(id),
  est_actif        boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (filiale_id, code)
);

-- ------------------------------------------------------------
-- Ventes
-- ------------------------------------------------------------
create table public.ventes (
  id             uuid primary key default gen_random_uuid(),
  -- Numéro généré côté client : {CODE_CAISSE}-{AAAAMMJJ}-{séquence}. Unique par filiale,
  -- sans collision entre caisses hors ligne puisque le code caisse est dans le numéro.
  numero         text not null,
  date_vente     timestamptz not null default now(),
  client_id      uuid references public.clients(id),
  utilisateur_id uuid references public.utilisateurs(id),
  caisse_id      uuid references public.caisses(id),
  filiale_id     uuid not null references public.filiales(id),
  total_brut_ht  numeric(14,2) not null default 0,
  total_remise   numeric(14,2) not null default 0,
  total_net_ht   numeric(14,2) not null default 0,
  total_tva      numeric(14,2) not null default 0,
  total_ttc      numeric(14,2) not null default 0,
  montant_percu  numeric(14,2) not null default 0,
  reste_a_payer  numeric(14,2) not null default 0,
  monnaie        numeric(14,2) not null default 0,
  mode_paiement  text check (mode_paiement in ('ESPECES', 'CHEQUE', 'MOBILE_MONEY', 'CREDIT')),
  statut         text not null default 'VALIDEE' check (statut in ('EN_ATTENTE', 'VALIDEE', 'ANNULEE')),
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (filiale_id, numero)
);

create table public.lignes_vente (
  id                uuid primary key default gen_random_uuid(),
  vente_id          uuid not null references public.ventes(id) on delete cascade,
  filiale_id        uuid not null references public.filiales(id),
  article_id        uuid references public.articles(id),
  code_article      text,
  designation       text not null,
  quantite          numeric(14,3) not null,
  prix_unitaire_ht  numeric(14,2) not null default 0,
  prix_unitaire_ttc numeric(14,2) not null default 0,
  remise_percent    numeric(5,2)  not null default 0,
  tva_percent       numeric(5,2)  not null default 18,
  total_ht          numeric(14,2) not null default 0,
  total_ttc         numeric(14,2) not null default 0,
  depot_id          uuid references public.depots(id)
);

create table public.reglements_clients (
  id             uuid primary key default gen_random_uuid(),
  numero         text not null,
  client_id      uuid not null references public.clients(id),
  vente_id       uuid references public.ventes(id),
  date_reglement timestamptz not null default now(),
  montant        numeric(14,2) not null check (montant > 0),
  type_reglement text not null check (type_reglement in ('ESPECES', 'CHEQUE', 'VIREMENT', 'MOBILE_MONEY')),
  reference      text,
  caisse_id      uuid references public.caisses(id),
  utilisateur_id uuid references public.utilisateurs(id),
  filiale_id     uuid not null references public.filiales(id),
  created_at     timestamptz not null default now(),
  unique (filiale_id, numero)
);

create table public.livraisons (
  id                    uuid primary key default gen_random_uuid(),
  numero                text not null,
  vente_id              uuid references public.ventes(id),
  client_id             uuid references public.clients(id),
  adresse_livraison     text,
  chauffeur             text,
  vehicule              text,
  statut                text not null default 'A_PREPARER' check (statut in ('A_PREPARER', 'EN_COURS', 'LIVREE', 'ANNULEE')),
  date_livraison_prevue timestamptz,
  date_livraison_reelle timestamptz,
  filiale_id            uuid not null references public.filiales(id),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (filiale_id, numero)
);

-- ------------------------------------------------------------
-- Achats
-- ------------------------------------------------------------
create table public.commandes_fournisseurs (
  id                    uuid primary key default gen_random_uuid(),
  numero                text not null,
  fournisseur_id        uuid not null references public.fournisseurs(id),
  date_commande         timestamptz not null default now(),
  type                  text not null default 'COMMANDE' check (type in ('COMMANDE', 'BON_COMMANDE')),
  statut                text not null default 'BROUILLON' check (statut in ('BROUILLON', 'ENVOYEE', 'PARTIELLE', 'LIVREE', 'ANNULEE')),
  total_ht              numeric(14,2) not null default 0,
  total_tva             numeric(14,2) not null default 0,
  total_ttc             numeric(14,2) not null default 0,
  montant_paye          numeric(14,2) not null default 0,
  reste_a_payer         numeric(14,2) not null default 0,
  date_livraison_prevue timestamptz,
  notes                 text,
  filiale_id            uuid not null references public.filiales(id),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (filiale_id, numero)
);

create table public.reglements_fournisseurs (
  id             uuid primary key default gen_random_uuid(),
  numero         text not null,
  fournisseur_id uuid not null references public.fournisseurs(id),
  commande_id    uuid references public.commandes_fournisseurs(id),
  date_reglement timestamptz not null default now(),
  montant        numeric(14,2) not null check (montant > 0),
  type_reglement text not null check (type_reglement in ('ESPECES', 'CHEQUE', 'VIREMENT', 'MOBILE_MONEY')),
  reference      text,
  caisse_id      uuid references public.caisses(id),
  utilisateur_id uuid references public.utilisateurs(id),
  filiale_id     uuid not null references public.filiales(id),
  created_at     timestamptz not null default now(),
  unique (filiale_id, numero)
);

-- ------------------------------------------------------------
-- Trésorerie
-- ------------------------------------------------------------
create table public.mouvements_tresorerie (
  id             uuid primary key default gen_random_uuid(),
  type           text not null check (type in ('RECETTE', 'DEPENSE')),
  categorie      text not null,
  montant        numeric(14,2) not null check (montant > 0),
  description    text,
  reference      text,
  caisse_id      uuid not null references public.caisses(id),
  utilisateur_id uuid references public.utilisateurs(id),
  filiale_id     uuid not null references public.filiales(id),
  date_operation timestamptz not null default now(),
  created_at     timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Audit (alimenté uniquement par trigger, jamais par le client)
-- ------------------------------------------------------------
create table public.audit_log (
  id                 uuid primary key default gen_random_uuid(),
  utilisateur_id     uuid,
  action             text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  table_cible        text not null,
  enregistrement_id  uuid,
  anciennes_valeurs  jsonb,
  nouvelles_valeurs  jsonb,
  filiale_id         uuid,
  created_at         timestamptz not null default now()
);

create or replace function public.audit_trigger()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_row  jsonb := to_jsonb(coalesce(new, old));
begin
  insert into public.audit_log (utilisateur_id, action, table_cible, enregistrement_id, anciennes_valeurs, nouvelles_valeurs, filiale_id)
  values (
    auth.uid(),
    tg_op,
    tg_table_name,
    (v_row ->> 'id')::uuid,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end,
    (v_row ->> 'filiale_id')::uuid
  );
  return coalesce(new, old);
end $$;

-- ------------------------------------------------------------
-- Triggers updated_at + audit
-- ------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'filiales', 'utilisateurs', 'depots', 'caisses', 'familles_articles', 'articles', 'stocks',
    'clients', 'fournisseurs', 'ventes', 'livraisons', 'commandes_fournisseurs'
  ] loop
    execute format('create trigger trg_%I_updated_at before update on public.%I for each row execute function public.set_updated_at()', t, t);
  end loop;

  -- Tables sensibles : toute modification est journalisée côté serveur.
  foreach t in array array[
    'articles', 'ventes', 'reglements_clients', 'reglements_fournisseurs',
    'mouvements_stock', 'mouvements_tresorerie', 'utilisateurs'
  ] loop
    execute format('create trigger trg_%I_audit after insert or update or delete on public.%I for each row execute function public.audit_trigger()', t, t);
  end loop;
end $$;

-- ------------------------------------------------------------
-- Création automatique du profil à l'inscription d'un compte Auth.
-- Les métadonnées (nom, prenom, profil, filiale_id) sont fournies à la
-- création du compte (dashboard Supabase ou API admin).
-- ------------------------------------------------------------
create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.utilisateurs (id, email, nom, prenom, profil, filiale_id)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'nom', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'prenom',
    coalesce(new.raw_user_meta_data ->> 'profil', 'CAISSIER'),
    nullif(new.raw_user_meta_data ->> 'filiale_id', '')::uuid
  );
  return new;
end $$;

create trigger trg_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- ------------------------------------------------------------
-- Index
-- ------------------------------------------------------------
create index idx_articles_filiale        on public.articles(filiale_id);
create index idx_articles_famille        on public.articles(famille_id);
create index idx_stocks_filiale          on public.stocks(filiale_id);
create index idx_mouv_stock_filiale      on public.mouvements_stock(filiale_id, created_at desc);
create index idx_mouv_stock_article      on public.mouvements_stock(article_id);
create index idx_clients_filiale         on public.clients(filiale_id);
create index idx_fournisseurs_filiale    on public.fournisseurs(filiale_id);
create index idx_ventes_filiale_date     on public.ventes(filiale_id, date_vente desc);
create index idx_ventes_client           on public.ventes(client_id);
create index idx_lignes_vente_vente      on public.lignes_vente(vente_id);
create index idx_lignes_vente_filiale    on public.lignes_vente(filiale_id);
create index idx_regl_clients_client     on public.reglements_clients(client_id);
create index idx_regl_clients_filiale    on public.reglements_clients(filiale_id);
create index idx_cmd_fourn_filiale       on public.commandes_fournisseurs(filiale_id);
create index idx_regl_fourn_filiale      on public.reglements_fournisseurs(filiale_id);
create index idx_mouv_treso_filiale      on public.mouvements_tresorerie(filiale_id, date_operation desc);
create index idx_livraisons_filiale      on public.livraisons(filiale_id);
create index idx_audit_filiale           on public.audit_log(filiale_id, created_at desc);
create index idx_audit_utilisateur       on public.audit_log(utilisateur_id);

-- ------------------------------------------------------------
-- Row Level Security
-- Les écritures PowerSync arrivent avec le JWT de l'utilisateur (clé anon) :
-- ces politiques sont la seule barrière côté serveur.
-- ------------------------------------------------------------
create or replace function public.current_profil()
returns text language sql stable security definer set search_path = public as $$
  select profil from public.utilisateurs where id = auth.uid()
$$;

create or replace function public.current_filiale_id()
returns uuid language sql stable security definer set search_path = public as $$
  select filiale_id from public.utilisateurs where id = auth.uid()
$$;

create or replace function public.est_directeur()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.current_profil() = 'DIRECTEUR', false)
$$;

-- filiales : lecture pour tous les utilisateurs authentifiés, écriture directeur.
alter table public.filiales enable row level security;
create policy filiales_select on public.filiales for select to authenticated using (true);
create policy filiales_write  on public.filiales for all    to authenticated using (public.est_directeur()) with check (public.est_directeur());

-- utilisateurs : chacun voit sa filiale, le directeur voit tout ; création via trigger Auth uniquement.
alter table public.utilisateurs enable row level security;
create policy utilisateurs_select on public.utilisateurs for select to authenticated
  using (id = auth.uid() or public.est_directeur() or filiale_id = public.current_filiale_id());
create policy utilisateurs_update on public.utilisateurs for update to authenticated
  using (public.est_directeur()) with check (public.est_directeur());

-- Tables partitionnées par filiale : accès complet à sa filiale, tout pour le directeur.
do $$
declare
  t text;
begin
  foreach t in array array[
    'depots', 'caisses', 'familles_articles', 'articles', 'stocks', 'mouvements_stock',
    'clients', 'fournisseurs', 'ventes', 'lignes_vente', 'reglements_clients', 'livraisons',
    'commandes_fournisseurs', 'reglements_fournisseurs', 'mouvements_tresorerie'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy %I_par_filiale on public.%I for all to authenticated
         using (public.est_directeur() or filiale_id = public.current_filiale_id())
         with check (public.est_directeur() or filiale_id = public.current_filiale_id())',
      t, t);
  end loop;
end $$;

-- audit_log : lecture seule (sa filiale / tout pour le directeur), écriture par trigger uniquement.
alter table public.audit_log enable row level security;
create policy audit_select on public.audit_log for select to authenticated
  using (public.est_directeur() or filiale_id = public.current_filiale_id());

-- ------------------------------------------------------------
-- Publication logique pour PowerSync
-- (le rôle de réplication est créé depuis le dashboard PowerSync, voir README)
-- ------------------------------------------------------------
create publication powersync for table
  public.filiales, public.utilisateurs, public.depots, public.caisses,
  public.familles_articles, public.articles, public.stocks, public.mouvements_stock,
  public.clients, public.fournisseurs, public.ventes, public.lignes_vente,
  public.reglements_clients, public.livraisons, public.commandes_fournisseurs,
  public.reglements_fournisseurs, public.mouvements_tresorerie, public.audit_log;
