-- ============================================================
-- Périmètre de synchronisation par utilisateur
-- ------------------------------------------------------------
-- `acces_filiales` liste, pour chaque utilisateur, les filiales dont il reçoit
-- les données (PowerSync Sync Streams filtrent sur `filiale_id IN (...)`).
--   * DIRECTEUR : une ligne par filiale active (vue consolidée) ;
--   * autres profils : la filiale de leur compte.
-- La table est entièrement maintenue par triggers : jamais écrite par le client.
-- ============================================================

create table public.acces_filiales (
  utilisateur_id uuid not null references public.utilisateurs(id) on delete cascade,
  filiale_id     uuid not null references public.filiales(id) on delete cascade,
  primary key (utilisateur_id, filiale_id)
);

create index idx_acces_filiales_filiale on public.acces_filiales(filiale_id);

-- Recalcule le périmètre d'un utilisateur.
create or replace function public.recalculer_acces_filiales(p_utilisateur_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_profil text;
  v_filiale uuid;
  v_actif boolean;
begin
  select profil, filiale_id, est_actif into v_profil, v_filiale, v_actif
  from public.utilisateurs where id = p_utilisateur_id;

  delete from public.acces_filiales where utilisateur_id = p_utilisateur_id;

  if v_profil is null or not v_actif then
    return;
  end if;

  if v_profil = 'DIRECTEUR' then
    insert into public.acces_filiales (utilisateur_id, filiale_id)
    select p_utilisateur_id, id from public.filiales where est_active;
  elsif v_filiale is not null then
    insert into public.acces_filiales (utilisateur_id, filiale_id) values (p_utilisateur_id, v_filiale);
  end if;
end $$;

-- Après création / modification d'un utilisateur.
create or replace function public.trg_utilisateur_acces_filiales()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.recalculer_acces_filiales(new.id);
  return new;
end $$;

create trigger trg_utilisateurs_acces_filiales
  after insert or update of profil, filiale_id, est_actif on public.utilisateurs
  for each row execute function public.trg_utilisateur_acces_filiales();

-- Après création / (dés)activation d'une filiale : les directeurs suivent.
create or replace function public.trg_filiale_acces_directeurs()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.recalculer_acces_filiales(id) from public.utilisateurs where profil = 'DIRECTEUR';
  return new;
end $$;

create trigger trg_filiales_acces_directeurs
  after insert or update of est_active on public.filiales
  for each row execute function public.trg_filiale_acces_directeurs();

-- Lecture seule pour l'utilisateur concerné (les triggers écrivent en security definer).
alter table public.acces_filiales enable row level security;
create policy acces_filiales_select on public.acces_filiales for select to authenticated
  using (utilisateur_id = auth.uid());

alter publication powersync add table public.acces_filiales;

-- Initialisation pour les comptes existants.
select public.recalculer_acces_filiales(id) from public.utilisateurs;
