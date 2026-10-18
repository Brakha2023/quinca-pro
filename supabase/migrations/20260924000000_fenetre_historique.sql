-- ============================================================
-- FENÊTRE D'HISTORIQUE SYNCHRONISÉE
-- ============================================================
-- Les règles de synchronisation ne savent pas comparer une date à « il y a
-- douze mois » : elles doivent être déterministes (pas de `now()`), et un
-- paramètre envoyé par le poste ne supporte que l'**égalité** — ni `>=`, ni
-- fonction autour (`unixepoch(connection.parameter(…))` est refusé par le
-- validateur). Une ligne ne peut donc pas quitter un flux en vieillissant.
--
-- La méthode recommandée par PowerSync est de faire porter le temps par une
-- colonne : le serveur marque les lignes dans la fenêtre, et le flux se
-- contente d'un `= true`, qui est une égalité.
--
--   https://docs.powersync.com/sync/advanced/sync-data-by-time
--
-- Le rafraîchissement n'écrit que les lignes qui **changent** d'état (voir le
-- `where` de la fonction) : une poignée par jour, pas une réécriture générale
-- qui ferait tout retélécharger aux postes.
-- ============================================================

-- ------------------------------------------------------------
-- 1. La colonne, sur chaque table d'activité, avec sa date de référence.
-- ------------------------------------------------------------
do $$
declare
  t  text;
  c  text;
  noms     text[] := array['ventes','lignes_vente','reglements_clients','proformas','lignes_proforma','livraisons',
                           'mouvements_stock','productions','lignes_production','commandes_fournisseurs',
                           'lignes_commande_fournisseur','reglements_fournisseurs','mouvements_tresorerie',
                           'transferts_filiales','pointages','avances_salaire','paies'];
  colonnes text[] := array['date_vente','created_at','date_reglement','date_proforma','created_at','created_at',
                           'created_at','created_at','created_at','date_commande',
                           'created_at','date_reglement','date_operation',
                           'created_at','date_pointage','date_avance','created_at'];
begin
  for i in 1..array_length(noms, 1) loop
    t := noms[i];
    c := colonnes[i];
    -- `default true` : une ligne qui naît aujourd'hui est dans la fenêtre.
    execute format('alter table public.%I add column if not exists dans_fenetre boolean not null default true', t);
    execute format('comment on column public.%I.dans_fenetre is %L', t,
                   format('Ligne dans la fenêtre d''historique synchronisée (calculée sur %s par rafraichir_fenetre_historique).', c));
    execute format('create index if not exists idx_%s_dans_fenetre on public.%I (dans_fenetre) where dans_fenetre', t, t);
  end loop;
end $$;

-- ------------------------------------------------------------
-- 2. La bascule de fenêtre n'est pas un événement métier.
-- ------------------------------------------------------------
-- Sans cette garde, le rafraîchissement quotidien écrirait une ligne d'audit
-- par pièce sortie de la fenêtre — un journal de surveillance rempli par une
-- tâche de ménage.
create or replace function public.audit_trigger()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_row  jsonb := to_jsonb(coalesce(new, old));
begin
  if tg_op = 'UPDATE'
     and (to_jsonb(old) - 'dans_fenetre' - 'updated_at') = (to_jsonb(new) - 'dans_fenetre' - 'updated_at') then
    return new;
  end if;

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
-- 3. Le rafraîchissement.
-- ------------------------------------------------------------
-- `mois` doit rester d'accord avec `MOIS_HISTORIQUE_LOCAL`
-- (apps/desktop/src/core/sync/historique.ts), qui l'affiche aux utilisateurs.
--
-- Ce qui n'est pas soldé ne sort jamais de la fenêtre : une créance se relance
-- et une commande ouverte se réceptionne, même deux ans après. Sans cela, la
-- pièce disparaîtrait du poste en laissant le solde au compte du client.
create or replace function public.rafraichir_fenetre_historique(mois integer default 12)
returns integer language plpgsql security definer set search_path = public as $$
declare
  t         text;
  c         text;
  garder    text;
  modifiees integer;
  total     integer := 0;
  noms     text[] := array['ventes','lignes_vente','reglements_clients','proformas','lignes_proforma','livraisons',
                           'mouvements_stock','productions','lignes_production','commandes_fournisseurs',
                           'lignes_commande_fournisseur','reglements_fournisseurs','mouvements_tresorerie',
                           'transferts_filiales','pointages','avances_salaire','paies'];
  colonnes text[] := array['date_vente','created_at','date_reglement','date_proforma','created_at','created_at',
                           'created_at','created_at','created_at','date_commande',
                           'created_at','date_reglement','date_operation',
                           'created_at','date_pointage','date_avance','created_at'];
begin
  for i in 1..array_length(noms, 1) loop
    t := noms[i];
    c := colonnes[i];
    garder := case t
      when 'ventes' then ' or (reste_a_payer > 0 and statut <> ''ANNULEE'')'
      when 'commandes_fournisseurs' then ' or statut in (''BROUILLON'', ''ENVOYEE'', ''PARTIELLE'') or (reste_a_payer > 0 and statut <> ''ANNULEE'')'
      when 'livraisons' then ' or statut in (''A_PREPARER'', ''EN_COURS'')'
      when 'transferts_filiales' then ' or statut = ''EN_TRANSIT'''
      else ''
    end;

    execute format(
      'update public.%I set dans_fenetre = (%I > now() - make_interval(months => $1)%s)
        where dans_fenetre is distinct from (%I > now() - make_interval(months => $1)%s)',
      t, c, garder, c, garder)
      using mois;
    get diagnostics modifiees = row_count;
    total := total + modifiees;
  end loop;

  return total;
end $$;

comment on function public.rafraichir_fenetre_historique(integer) is
  'Marque les lignes à synchroniser sur les postes. À exécuter une fois par jour (pg_cron).';

-- Premier calcul : met l'existant d'accord avec la fenêtre.
select public.rafraichir_fenetre_historique();

-- ------------------------------------------------------------
-- 4. Une fois par jour, à 2 h du matin (heure du serveur, UTC).
-- ------------------------------------------------------------
-- Si pg_cron n'est pas disponible sur le projet, la migration passe quand même
-- et le rappel ci-dessous dit quoi faire : la fenêtre ne bougera pas tant que
-- personne n'appellera la fonction.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.unschedule('fenetre_historique') where exists (select 1 from cron.job where jobname = 'fenetre_historique');
    perform cron.schedule('fenetre_historique', '0 2 * * *', 'select public.rafraichir_fenetre_historique()');
    raise notice 'Fenêtre d''historique : rafraîchissement programmé chaque jour à 02:00 UTC.';
  else
    raise notice 'pg_cron indisponible : programmez « select public.rafraichir_fenetre_historique(); » une fois par jour (Supabase → Integrations → Cron), sinon la fenêtre restera figée.';
  end if;
end $$;
