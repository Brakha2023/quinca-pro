-- Connexion hors ligne sur les postes partagés d'une filiale.
--
-- 1. `utilisateurs.empreinte_hors_ligne` : empreinte PBKDF2 du mot de passe
--    (jamais le mot de passe), écrite par l'application à chaque connexion en
--    ligne et synchronisée vers tous les postes de la filiale. Elle permet à
--    n'importe quel utilisateur de la filiale de déverrouiller un poste sans
--    réseau, même s'il ne s'y est jamais connecté.
-- 2. L'audit est attribué à l'utilisateur porté par la ligne (`utilisateur_id`)
--    quand il existe : hors ligne, les écritures d'un utilisateur partent avec
--    le jeton de la session du poste, qui peut être celle d'un collègue.

alter table public.utilisateurs add column if not exists empreinte_hors_ligne text;

-- Chaque utilisateur ne peut modifier que son empreinte (les autres colonnes restent au directeur).
create or replace function public.utilisateurs_proteger_colonnes()
returns trigger language plpgsql as $$
begin
  if not public.est_directeur() and (
    new.email is distinct from old.email or new.nom is distinct from old.nom or new.prenom is distinct from old.prenom
    or new.profil is distinct from old.profil or new.filiale_id is distinct from old.filiale_id
    or new.est_actif is distinct from old.est_actif
  ) then
    raise exception 'Seul un directeur peut modifier la fiche d''un utilisateur';
  end if;
  return new;
end $$;

drop trigger if exists trg_utilisateurs_proteger_colonnes on public.utilisateurs;
create trigger trg_utilisateurs_proteger_colonnes before update on public.utilisateurs
  for each row execute function public.utilisateurs_proteger_colonnes();

drop policy if exists utilisateurs_update on public.utilisateurs;
create policy utilisateurs_update on public.utilisateurs for update to authenticated
  using (public.est_directeur() or id = auth.uid())
  with check (public.est_directeur() or id = auth.uid());

-- Audit : l'auteur est celui de la ligne quand elle en porte un, sinon la session.
-- L'empreinte hors ligne n'est jamais journalisée (ni un simple renouvellement d'empreinte).
create or replace function public.audit_trigger()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_old    jsonb := to_jsonb(old) - 'empreinte_hors_ligne';
  v_new    jsonb := to_jsonb(new) - 'empreinte_hors_ligne';
  v_row    jsonb := coalesce(v_new, v_old);
  v_auteur uuid  := coalesce(nullif(v_row ->> 'utilisateur_id', '')::uuid, auth.uid());
begin
  if tg_op = 'UPDATE' and (v_new - 'updated_at') = (v_old - 'updated_at') then
    return new;
  end if;
  insert into public.audit_log (utilisateur_id, action, table_cible, enregistrement_id, anciennes_valeurs, nouvelles_valeurs, filiale_id)
  values (
    v_auteur,
    tg_op,
    tg_table_name,
    (v_row ->> 'id')::uuid,
    case when tg_op in ('UPDATE', 'DELETE') then v_old end,
    case when tg_op in ('INSERT', 'UPDATE') then v_new end,
    (v_row ->> 'filiale_id')::uuid
  );
  return coalesce(new, old);
end $$;
