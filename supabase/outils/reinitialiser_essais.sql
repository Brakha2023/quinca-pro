-- ============================================================
-- Remise à zéro pour les essais fonctionnels, et les trois comptes d'essai.
-- ============================================================
--
--   ⚠  CE SCRIPT EFFACE DÉFINITIVEMENT TOUTES LES DONNÉES SAISIES.
--      Il n'y a pas de corbeille. Faites une sauvegarde avant
--      (Supabase → Database → Backups), et ne le lancez jamais sur une base
--      qui porte le travail réel de la maison.
--
-- Où le lancer : Supabase → SQL Editor, d'un seul bloc. Il est enveloppé dans
-- une transaction : ou bien tout passe, ou bien rien ne change.
--
-- ------------------------------------------------------------
-- CE QUI DISPARAÎT — tout ce qui a été saisi en utilisant l'application
-- ------------------------------------------------------------
--   ventes et leurs lignes, règlements clients, proformas, livraisons
--   commandes fournisseurs et leurs lignes, règlements fournisseurs
--   clients, fournisseurs
--   articles, stocks, mouvements de stock, productions, inventaires
--   transferts de stock et de fonds entre filiales
--   mouvements de trésorerie (les soldes des caisses retombent à zéro)
--   employés, pointages, avances, paies
--   le journal d'audit
--
-- ------------------------------------------------------------
-- CE QUI RESTE — la charpente, qu'il faudrait sinon refaire à la main
-- ------------------------------------------------------------
--   les filiales, leurs dépôts et leurs caisses (soldes remis à zéro)
--   les familles d'articles
--   les rôles et leurs permissions
--   la fiche d'entreprise de chaque filiale (identité, logo, mentions, TVA,
--     formats de documents, préfixes) — c'est une configuration, pas un essai
--   les comptes existants, superadministrateur compris
--
-- `truncate` est employé à dessein : il ne déclenche pas les triggers de
-- ligne, donc l'effacement ne se journalise pas lui-même dans l'audit qu'il
-- vient de vider.
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 1. Vider les données saisies
-- ------------------------------------------------------------
-- Toutes les tables liées par des clés étrangères sont nommées dans la même
-- instruction : c'est ce que `truncate` exige, et cela évite d'avoir à les
-- ordonner.
truncate table
  public.lignes_vente,
  public.ventes,
  public.reglements_clients,
  public.lignes_proforma,
  public.proformas,
  public.livraisons,
  public.lignes_commande_fournisseur,
  public.commandes_fournisseurs,
  public.reglements_fournisseurs,
  public.clients,
  public.fournisseurs,
  public.lignes_production,
  public.productions,
  public.lignes_transfert_stock,
  public.transferts_stock,
  public.transferts_filiales,
  public.mouvements_stock,
  public.stocks,
  public.articles,
  public.mouvements_tresorerie,
  public.paies,
  public.avances_salaire,
  public.pointages,
  public.employes,
  public.audit_log;

-- Les soldes vivent sur la caisse, pas seulement dans ses mouvements : sans
-- ces lignes, une caisse afficherait un solde dont plus rien ne répond —
-- `truncate` ne déclenche rien, le cumul resterait tel quel.
--
-- Le déclencheur de garde refuse les écritures venues d'un poste sur cette
-- colonne, et une remise à zéro en ferait partie : on l'endort, comme le fait
-- `reparer_cumuls.sql`, puis on le réveille.
alter table public.caisses disable trigger trg_caisses_ignorer_cumuls;
update public.caisses set solde_actuel = 0, updated_at = now() where solde_actuel is distinct from 0;
alter table public.caisses enable trigger trg_caisses_ignorer_cumuls;

-- ------------------------------------------------------------
-- 2. Les trois comptes d'essai
-- ------------------------------------------------------------
-- Mots de passe en clair ici : ce sont des comptes d'ESSAI. Changez-les, ou
-- supprimez les comptes, avant toute mise en service.
--
-- Le compte relancé n'est pas recréé : son mot de passe, son rôle et sa
-- filiale sont remis à ce que dit ce script. Le script est donc rejouable.
--
-- `role` et `filiale_id` passent par les métadonnées : le déclencheur
-- `trg_auth_user_created` les lit pour poser la fiche métier.
--
-- À savoir : un compte de profil DIRECTEUR n'est rattaché à aucune filiale —
-- la base l'impose (`utilisateurs_filiale_selon_profil`) —, et il les voit
-- toutes. Dans l'application, le rôle « Gérant de filiale » porte le code
-- `role_gestionnaire` : gérant et gestionnaire sont un seul et même rôle.
do $$
declare
  v_mdp    text := 'Essai@2026';
  v_compte record;
  v_id     uuid;
  v_role   uuid;
  v_fil    uuid;
begin
  -- pgcrypto vit dans `extensions` sur Supabase, dans `public` sur un Postgres
  -- nu : `crypt()` se trouve par le chemin, pas par un préfixe.
  perform set_config('search_path', 'public, extensions, pg_temp', true);

  for v_compte in
    select * from (values
      -- email,                            nom,        prénom,    profil,      rôle,                filiale (code, ou null)
      ('directeur@cisse-freres.ci',    'Directeur',    'Essai', 'DIRECTEUR', 'role_directeur',    null),
      ('gerant@cisse-freres.ci',       'Gérant',       'Essai', 'GERANT',    'role_gestionnaire', 'ABJ'),
      ('gestionnaire@cisse-freres.ci', 'Gestionnaire', 'Essai', 'GERANT',    'role_gestionnaire', 'BKE')
    ) as c(email, nom, prenom, profil, role_code, filiale_code)
  loop
    select id into v_role from public.roles where code = v_compte.role_code;
    if v_role is null then
      raise exception 'Rôle % introuvable : la migration des rôles n''est pas passée.', v_compte.role_code;
    end if;

    v_fil := null;
    if v_compte.filiale_code is not null then
      select id into v_fil from public.filiales where code = v_compte.filiale_code;
      if v_fil is null then
        raise exception 'Filiale % introuvable : créez-la avant, ou changez son code ici.', v_compte.filiale_code;
      end if;
    end if;

    select id into v_id from auth.users where lower(email) = v_compte.email;

    if v_id is null then
      v_id := gen_random_uuid();
      insert into auth.users (
        instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
        confirmation_token, recovery_token, email_change, email_change_token_new
      ) values (
        '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated',
        v_compte.email, crypt(v_mdp, gen_salt('bf')), now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('nom', v_compte.nom, 'prenom', v_compte.prenom,
                           'profil', v_compte.profil, 'role', v_compte.role_code,
                           'filiale_id', coalesce(v_fil::text, '')),
        now(), now(), '', '', '', ''
      );

      -- `auth.identities` n'existe pas sur les très anciennes versions de
      -- GoTrue, et sa colonne `provider_id` est plus récente que la table.
      if to_regclass('auth.identities') is not null then
        if exists (select 1 from information_schema.columns
                   where table_schema = 'auth' and table_name = 'identities' and column_name = 'provider_id') then
          insert into auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
          values (gen_random_uuid(), v_id::text, v_id,
                  jsonb_build_object('sub', v_id::text, 'email', v_compte.email, 'email_verified', true),
                  'email', now(), now(), now());
        else
          insert into auth.identities (id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
          values (gen_random_uuid(), v_id,
                  jsonb_build_object('sub', v_id::text, 'email', v_compte.email, 'email_verified', true),
                  'email', now(), now(), now());
        end if;
      end if;
    else
      -- Le compte existait : on remet le mot de passe de ce script, pour que
      -- relancer le script rende toujours une base où l'on peut se connecter.
      update auth.users
      set encrypted_password = crypt(v_mdp, gen_salt('bf')), email_confirmed_at = now(), updated_at = now()
      where id = v_id;
    end if;

    -- La fiche métier est posée par `trg_auth_user_created` ; au cas où le
    -- compte existait déjà sans fiche, on la pose, puis on la remet d'aplomb.
    insert into public.utilisateurs (id, email, nom, prenom, profil, filiale_id)
    values (v_id, v_compte.email, v_compte.nom, v_compte.prenom, v_compte.profil, v_fil)
    on conflict (id) do nothing;

    update public.utilisateurs
    set nom = v_compte.nom, prenom = v_compte.prenom, profil = v_compte.profil,
        filiale_id = v_fil, role_id = v_role, est_actif = true,
        doit_changer_mot_de_passe = false,
        -- L'empreinte hors ligne répond de l'ancien mot de passe : elle doit
        -- tomber avec lui. L'application en réécrit une à la connexion suivante.
        empreinte_hors_ligne = null
    where id = v_id;
  end loop;
end $$;

commit;

-- ------------------------------------------------------------
-- 3. Ce que la base contient maintenant
-- ------------------------------------------------------------
select 'filiales' as table_, count(*) from public.filiales
union all select 'dépôts',      count(*) from public.depots
union all select 'caisses',     count(*) from public.caisses
union all select 'familles',    count(*) from public.familles_articles
union all select 'rôles',       count(*) from public.roles
union all select 'fiches entreprise', count(*) from public.parametres_filiale
union all select 'articles',    count(*) from public.articles
union all select 'clients',     count(*) from public.clients
union all select 'ventes',      count(*) from public.ventes
union all select 'audit',       count(*) from public.audit_log
order by 1;

select u.email, u.nom, u.profil, r.nom as role, coalesce(f.nom, 'toutes les filiales') as perimetre
from public.utilisateurs u
left join public.roles r on r.id = u.role_id
left join public.filiales f on f.id = u.filiale_id
order by u.profil, u.email;
