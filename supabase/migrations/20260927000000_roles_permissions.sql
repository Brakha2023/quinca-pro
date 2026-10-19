-- ============================================================
-- RÔLES ET PERMISSIONS (RBAC)
-- ------------------------------------------------------------
-- Jusqu'ici, ce qu'un utilisateur avait le droit de faire se déduisait de son
-- `profil` : quatre valeurs figées dans un CHECK, et trois vérifications
-- écrites en dur dans l'interface. Impossible de dire « ce gérant-là ne valide
-- pas les ventes » sans recompiler l'application.
--
-- Deux notions, désormais, et il faut les garder distinctes :
--
--   * `utilisateurs.profil` — la **portée des données**. C'est elle que lisent
--     les sync rules (`acces_filiales`) et la RLS : elle décide ce qui descend
--     sur le poste et ce que le serveur laisse écrire. Elle n'est plus choisie
--     à la main : le rôle la porte, et un déclencheur la recopie ici.
--
--   * le **rôle** — ce que l'utilisateur a le droit de faire, par permissions
--     fines (`ventes.valider`, `stock.transferer_filiale`, …). Un rôle se crée,
--     se nomme et s'ajuste depuis l'application, sans migration.
--
-- La RLS reste la seule barrière côté serveur : une permission refusée dans
-- l'interface mais accordée au rôle resterait écrivable par un poste trafiqué.
-- Les permissions qui gardent une écriture serveur (`parametres.roles`,
-- `parametres.utilisateurs`) sont donc aussi vérifiées en RLS, par
-- `a_permission()`.
--
-- Le catalogue des codes de permission vit dans l'application
-- (`apps/desktop/src/core/parametres/permissions.ts`), pas dans un CHECK :
-- ajouter une permission ne doit pas demander une migration. Le serveur ne
-- vérifie que la forme (`module.action`), et un code qu'une version plus
-- ancienne de l'app ne connaît pas est simplement ignoré par elle.
-- ============================================================

-- ------------------------------------------------------------
-- Les rôles
-- ------------------------------------------------------------
create table public.roles (
  id             uuid primary key default gen_random_uuid(),
  code           text not null unique check (code ~ '^role_[a-z0-9_]+$'),
  nom            text not null,
  description    text,
  -- Portée des données du rôle : recopiée sur `utilisateurs.profil`.
  profil         text not null check (profil in ('DIRECTEUR', 'GERANT', 'CAISSIER', 'MAGASINIER')),
  -- Livré avec l'application : son code, sa portée et sa nature sont figés.
  est_systeme    boolean not null default false,
  -- Toutes les permissions, pour toujours. Un seul rôle le porte.
  est_superadmin boolean not null default false,
  est_actif      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table public.roles_permissions (
  id          uuid primary key default gen_random_uuid(),
  role_id     uuid not null references public.roles(id) on delete cascade,
  -- Forme seule : le catalogue est dans l'application (voir l'en-tête).
  permission  text not null check (permission ~ '^[a-z_]+\.[a-z_]+$'),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (role_id, permission)
);

create index idx_roles_permissions_role on public.roles_permissions(role_id);

alter table public.utilisateurs
  add column if not exists role_id uuid references public.roles(id),
  -- Mot de passe par défaut jamais changé : l'application l'exige à la connexion.
  add column if not exists doit_changer_mot_de_passe boolean not null default false;

create index idx_utilisateurs_role on public.utilisateurs(role_id);

-- ------------------------------------------------------------
-- La question que pose la RLS
-- ------------------------------------------------------------
-- Vrai si l'utilisateur de la session détient la permission : par son rôle,
-- ou parce que son rôle est le superadministrateur (qui a tout, toujours).
create or replace function public.a_permission(p_permission text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.utilisateurs u
    join public.roles r on r.id = u.role_id
    where u.id = auth.uid()
      and u.est_actif
      and r.est_actif
      and (
        r.est_superadmin
        or exists (
          select 1 from public.roles_permissions rp
          where rp.role_id = r.id and rp.permission = p_permission
        )
      )
  )
$$;

create or replace function public.est_superadmin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.utilisateurs u join public.roles r on r.id = u.role_id
    where u.id = auth.uid() and u.est_actif and r.est_actif and r.est_superadmin
  )
$$;

-- ------------------------------------------------------------
-- Les rôles livrés avec l'application
-- ------------------------------------------------------------
-- Ces jeux de permissions sont le miroir de `ROLES_SYSTEME`
-- (apps/desktop/src/core/parametres/roles.ts) : toute évolution se fait aux
-- deux endroits, comme pour les énumérations et leurs CHECK.
insert into public.roles (code, nom, description, profil, est_systeme, est_superadmin) values
  ('role_superadmin',    'Superadministrateur', 'Toutes les permissions, et la gestion des rôles. Le compte qui administre l''application.', 'DIRECTEUR',  true, true),
  ('role_directeur',     'Directeur général',   'Voit et conduit toutes les filiales. Gère les utilisateurs, pas la définition des rôles.',  'DIRECTEUR',  true, false),
  ('role_gestionnaire',  'Gérant de filiale',   'Conduit sa filiale de bout en bout : ventes, stock, tiers, caisses, personnel.',           'GERANT',     true, false),
  ('role_caissier',      'Caissier',            'Encaisse, suit ses clients, lit les prix et l''historique.',                                'CAISSIER',   true, false),
  ('role_magasinier',    'Magasinier',          'Tient le stock : entrées, sorties, inventaires, transferts, productions.',                  'MAGASINIER', true, false);

-- Catalogue des permissions, tel que la migration le connaît. Il sert à poser
-- les jeux par défaut ; l'application en est la source. Il tient dans un
-- tableau et non dans une table temporaire : une migration ne doit rien
-- supposer de la transaction qui l'exécute.
--
-- Le superadministrateur ne reçoit aucune ligne : il a tout par nature, et
-- l'énumérer laisserait croire qu'on peut lui en retirer une.
do $$
declare
  v_catalogue text[] := array[
    'consolidation.lire',
    'pos.encaisser',
    'ventes.lire', 'ventes.valider', 'ventes.annuler', 'ventes.forcer_stock', 'ventes.remise',
    'articles.lire', 'articles.ecrire', 'articles.prix',
    'stock.lire', 'stock.entree', 'stock.sortie', 'stock.inventaire',
    'stock.transferer', 'stock.transferer_filiale', 'stock.production', 'stock.depots',
    'clients.lire', 'clients.ecrire', 'clients.reglement', 'clients.proforma',
    'fournisseurs.lire', 'fournisseurs.ecrire', 'fournisseurs.commande', 'fournisseurs.reglement',
    'tresorerie.lire', 'tresorerie.mouvement', 'tresorerie.caisses', 'tresorerie.transfert',
    'livraisons.lire', 'livraisons.ecrire',
    'employes.lire', 'employes.ecrire', 'employes.pointage', 'employes.paie',
    'historiques.lire',
    'audit.lire', 'sync.decider',
    'parametres.lire', 'parametres.roles', 'parametres.utilisateurs'
  ];
begin
  -- Directeur général : tout, sauf la définition des rôles — décider qui a le
  -- droit de quoi reste au compte qui administre l'application.
  insert into public.roles_permissions (role_id, permission)
  select r.id, p from public.roles r, unnest(v_catalogue) p
  where r.code = 'role_directeur' and p <> 'parametres.roles';

  -- Gérant : toute l'exploitation de sa filiale (sa portée l'y enferme déjà),
  -- rien des paramètres.
  insert into public.roles_permissions (role_id, permission)
  select r.id, p from public.roles r, unnest(v_catalogue) p
  where r.code = 'role_gestionnaire' and p not like 'parametres.%';

  insert into public.roles_permissions (role_id, permission)
  select r.id, p from public.roles r, unnest(v_catalogue) p
  where r.code = 'role_caissier' and p in (
    'pos.encaisser', 'ventes.lire', 'articles.lire', 'stock.lire',
    'clients.lire', 'clients.ecrire', 'clients.reglement', 'clients.proforma',
    'tresorerie.lire', 'tresorerie.mouvement', 'historiques.lire'
  );

  insert into public.roles_permissions (role_id, permission)
  select r.id, p from public.roles r, unnest(v_catalogue) p
  where r.code = 'role_magasinier' and p in (
    'articles.lire', 'articles.ecrire',
    'stock.lire', 'stock.entree', 'stock.sortie', 'stock.inventaire',
    'stock.transferer', 'stock.transferer_filiale', 'stock.production', 'stock.depots',
    'fournisseurs.lire', 'livraisons.lire', 'livraisons.ecrire', 'historiques.lire'
  );
end $$;

-- ------------------------------------------------------------
-- Le rôle porte la portée des données
-- ------------------------------------------------------------
create or replace function public.utilisateurs_aligner_role()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_nom    text;
  v_profil text;
  v_actif  boolean;
begin
  if new.role_id is null then return new; end if;

  select nom, profil, est_actif into v_nom, v_profil, v_actif from public.roles where id = new.role_id;
  if v_profil is null then
    raise exception 'Rôle inconnu.';
  end if;
  if not v_actif then
    raise exception 'Le rôle « % » est désactivé : il ne peut pas être affecté.', v_nom;
  end if;

  new.profil := v_profil;
  if v_profil = 'DIRECTEUR' then
    -- Un directeur n'est rattaché à aucune filiale : il les voit toutes.
    new.filiale_id := null;
  elsif new.filiale_id is null then
    raise exception 'Le rôle « % » travaille dans une filiale : choisissez-la sur la fiche de l''utilisateur.', v_nom;
  end if;
  return new;
end $$;

-- Nommé pour passer **avant** `trg_utilisateurs_proteger_colonnes`
-- (les déclencheurs d'un même événement se déclenchent par ordre de nom) :
-- la protection doit voir le profil déjà aligné sur le rôle.
drop trigger if exists trg_utilisateurs_aligner_role on public.utilisateurs;
create trigger trg_utilisateurs_aligner_role
  before insert or update of role_id, profil, filiale_id on public.utilisateurs
  for each row execute function public.utilisateurs_aligner_role();

-- ------------------------------------------------------------
-- Qui peut modifier la fiche d'un utilisateur
-- ------------------------------------------------------------
-- Reprend la protection posée par 20260917000000 et y ajoute `role_id` :
-- affecter un rôle, c'est donner des droits. Désormais la permission
-- `parametres.utilisateurs` suffit — le profil DIRECTEUR n'est plus le seul
-- sésame, mais il le reste pour les comptes qu'aucun rôle ne couvre encore.
create or replace function public.utilisateurs_proteger_colonnes()
returns trigger language plpgsql as $$
declare
  v_administre boolean;
begin
  -- Sans session (migration, console SQL, tâche serveur), c'est l'administrateur
  -- de la base qui écrit : la protection ne s'applique pas à lui.
  if auth.uid() is null then return new; end if;

  v_administre := public.est_directeur() or public.a_permission('parametres.utilisateurs');

  if not v_administre and (
    new.email is distinct from old.email or new.nom is distinct from old.nom or new.prenom is distinct from old.prenom
    or new.profil is distinct from old.profil or new.filiale_id is distinct from old.filiale_id
    or new.est_actif is distinct from old.est_actif or new.role_id is distinct from old.role_id
  ) then
    raise exception 'Seul un administrateur peut modifier la fiche d''un utilisateur';
  end if;

  -- Chacun baisse son propre drapeau en changeant son mot de passe ; le lever
  -- pour autrui (« qu'il le change à sa prochaine connexion ») s'administre.
  if new.doit_changer_mot_de_passe is distinct from old.doit_changer_mot_de_passe
     and new.id is distinct from auth.uid() and not v_administre then
    raise exception 'Seul un administrateur peut exiger d''un autre qu''il change son mot de passe';
  end if;

  return new;
end $$;

-- ------------------------------------------------------------
-- Ce qu'on ne fait pas à un rôle
-- ------------------------------------------------------------
create or replace function public.roles_proteger()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_porteurs integer;
begin
  if tg_op = 'DELETE' then
    if old.est_systeme then
      raise exception 'Le rôle « % » est livré avec l''application : il ne se supprime pas (désactivez-le).', old.nom;
    end if;
    select count(*) into v_porteurs from public.utilisateurs where role_id = old.id;
    if v_porteurs > 0 then
      raise exception 'Le rôle « % » est encore affecté à % utilisateur(s) : donnez-leur un autre rôle d''abord.', old.nom, v_porteurs;
    end if;
    return old;
  end if;

  if tg_op = 'UPDATE' and old.est_systeme then
    if new.code is distinct from old.code or new.profil is distinct from old.profil
       or new.est_systeme is distinct from old.est_systeme or new.est_superadmin is distinct from old.est_superadmin then
      raise exception 'Le rôle « % » est livré avec l''application : son code, sa portée et sa nature sont figés (le nom, la description et les permissions, non).', old.nom;
    end if;
    if old.est_superadmin and not new.est_actif then
      raise exception 'Le rôle superadministrateur ne se désactive pas.';
    end if;
  end if;
  return new;
end $$;

create trigger trg_roles_proteger before update or delete on public.roles
  for each row execute function public.roles_proteger();

-- Le superadministrateur a tout par nature : lui lister des permissions
-- laisserait croire qu'on peut lui en retirer une.
create or replace function public.roles_permissions_proteger()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.roles where id = new.role_id and est_superadmin) then
    raise exception 'Le superadministrateur détient toutes les permissions : il n''y a rien à lui accorder ni à lui retirer.';
  end if;
  return new;
end $$;

create trigger trg_roles_permissions_proteger before insert or update on public.roles_permissions
  for each row execute function public.roles_permissions_proteger();

-- ------------------------------------------------------------
-- Horodatage, audit, RLS, publication
-- ------------------------------------------------------------
create trigger trg_roles_updated_at before update on public.roles
  for each row execute function public.set_updated_at();
create trigger trg_roles_permissions_updated_at before update on public.roles_permissions
  for each row execute function public.set_updated_at();

-- Donner ou retirer un droit est un acte de sécurité : il est journalisé.
create trigger trg_roles_audit after insert or update or delete on public.roles
  for each row execute function public.audit_trigger();
create trigger trg_roles_permissions_audit after insert or update or delete on public.roles_permissions
  for each row execute function public.audit_trigger();

-- Lecture ouverte : l'annuaire des rôles n'est pas confidentiel, et chaque
-- poste a besoin des permissions de son porteur pour fonctionner hors ligne.
-- Écriture : la permission `parametres.roles`, et elle seule.
alter table public.roles enable row level security;
create policy roles_select on public.roles for select to authenticated using (true);
create policy roles_write on public.roles for all to authenticated
  using (public.a_permission('parametres.roles')) with check (public.a_permission('parametres.roles'));

alter table public.roles_permissions enable row level security;
create policy roles_permissions_select on public.roles_permissions for select to authenticated using (true);
create policy roles_permissions_write on public.roles_permissions for all to authenticated
  using (public.a_permission('parametres.roles')) with check (public.a_permission('parametres.roles'));

-- La fiche utilisateur s'administre aussi par permission, plus seulement par profil.
drop policy if exists utilisateurs_update on public.utilisateurs;
create policy utilisateurs_update on public.utilisateurs for update to authenticated
  using (public.est_directeur() or public.a_permission('parametres.utilisateurs') or id = auth.uid())
  with check (public.est_directeur() or public.a_permission('parametres.utilisateurs') or id = auth.uid());

alter publication powersync add table public.roles, public.roles_permissions;

-- ------------------------------------------------------------
-- Les comptes qui existent déjà reçoivent le rôle de leur profil
-- ------------------------------------------------------------
update public.utilisateurs u
set role_id = r.id
from public.roles r
where u.role_id is null
  and r.est_systeme
  and not r.est_superadmin
  and r.profil = u.profil;

-- ------------------------------------------------------------
-- Le compte superadministrateur livré avec l'application
-- ------------------------------------------------------------
-- Il faut un compte pour ouvrir l'application la première fois et distribuer
-- les rôles. Son mot de passe est public (il est écrit ici, et dans le
-- README) : l'application exige d'en changer à la première connexion, et le
-- drapeau `doit_changer_mot_de_passe` le lui rappelle jusqu'à ce qu'il le fasse.
--
-- Colonnes supposées sur `auth.users` : celles de GoTrue v2. `auth.identities`
-- est renseignée quand elle existe (elle n'existe pas sur les très anciennes
-- versions, et sa colonne `provider_id` est plus récente que la table).
do $$
declare
  v_email    text := 'superadmin@cisse-freres.ci';
  v_mdp      text := 'SuperAdmin@2026';
  v_id       uuid;
  v_role     uuid;
begin
  -- pgcrypto vit dans `extensions` sur Supabase, dans `public` sur un Postgres
  -- nu : `crypt()` et `gen_salt()` se trouvent par le chemin, pas par un préfixe.
  perform set_config('search_path', 'public, extensions, pg_temp', true);

  select id into v_role from public.roles where code = 'role_superadmin';
  select id into v_id   from auth.users where lower(email) = v_email;

  if v_id is null then
    v_id := gen_random_uuid();
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change, email_change_token_new
    ) values (
      '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated',
      v_email, crypt(v_mdp, gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('nom', 'Administrateur', 'prenom', 'Super', 'profil', 'DIRECTEUR'),
      now(), now(), '', '', '', ''
    );

    if to_regclass('auth.identities') is not null then
      if exists (select 1 from information_schema.columns
                 where table_schema = 'auth' and table_name = 'identities' and column_name = 'provider_id') then
        insert into auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
        values (gen_random_uuid(), v_id::text, v_id,
                jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true),
                'email', now(), now(), now());
      else
        insert into auth.identities (id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
        values (gen_random_uuid(), v_id,
                jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true),
                'email', now(), now(), now());
      end if;
    end if;
  end if;

  -- La fiche métier est créée par `trg_auth_user_created` ; au cas où le compte
  -- existait déjà sans fiche, on la pose.
  insert into public.utilisateurs (id, email, nom, prenom, profil, filiale_id)
  values (v_id, v_email, 'Administrateur', 'Super', 'DIRECTEUR', null)
  on conflict (id) do nothing;

  update public.utilisateurs
  set role_id = v_role, est_actif = true, doit_changer_mot_de_passe = true
  where id = v_id;
end $$;

-- ------------------------------------------------------------
-- Il doit rester quelqu'un pour administrer l'application
-- ------------------------------------------------------------
-- Posé ici, et pas plus haut : tant que le compte livré n'existe pas, ce garde
-- refuserait la migration elle-même — une console SQL valide chaque
-- instruction séparément, et la reprise des comptes ci-dessus passerait avant
-- la création du superadministrateur.
-- Déclencheur de contrainte différé : la vérification porte sur l'état final
-- de la transaction, ce qui laisse passer un échange de rôles entre deux comptes.
create or replace function public.garder_un_superadmin()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from public.utilisateurs u join public.roles r on r.id = u.role_id
    where u.est_actif and r.est_superadmin
  ) then
    raise exception 'Il doit rester au moins un superadministrateur actif : l''application ne s''administrerait plus.';
  end if;
  return null;
end $$;

create constraint trigger trg_utilisateurs_garder_un_superadmin
  after update or delete on public.utilisateurs
  deferrable initially deferred
  for each row execute function public.garder_un_superadmin();

-- ------------------------------------------------------------
-- Le rôle suit la création d'un compte Auth
-- ------------------------------------------------------------
-- Un compte créé depuis le dashboard Supabase reçoit le rôle nommé dans ses
-- métadonnées (`role` = code du rôle), ou à défaut celui qui correspond au
-- profil demandé. Un compte sans rôle n'aurait aucune permission : il
-- ouvrirait l'application sur un écran vide.
create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_profil  text := coalesce(new.raw_user_meta_data ->> 'profil', 'CAISSIER');
  v_filiale uuid := nullif(new.raw_user_meta_data ->> 'filiale_id', '')::uuid;
  v_role    uuid;
begin
  select id into v_role from public.roles
  where code = coalesce(nullif(new.raw_user_meta_data ->> 'role', ''), '')
  limit 1;

  if v_role is null then
    select id into v_role from public.roles
    where est_systeme and not est_superadmin and profil = v_profil
    limit 1;
  end if;

  insert into public.utilisateurs (id, email, nom, prenom, profil, role_id, filiale_id)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'nom', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'prenom',
    v_profil,
    v_role,
    v_filiale
  );
  return new;
end $$;
