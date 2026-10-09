-- Module Trésorerie : transferts d'espèces entre filiales.
--
-- L'argent voyage physiquement : la filiale source sort les fonds de sa caisse
-- (le transfert part « EN_TRANSIT »), la filiale destinataire les encaisse à
-- l'arrivée en choisissant sa propre caisse. Les deux filiales voient la ligne,
-- d'où une politique RLS sur les deux côtés et deux requêtes de sync stream.
--
-- Les autres opérations du module (versement, retrait, entrée en caisse,
-- transfert inter-caisse, dépense) n'ont besoin d'aucune table nouvelle :
-- elles s'écrivent dans `mouvements_tresorerie` avec une catégorie dédiée.

create table public.transferts_filiales (
  id                        uuid primary key default gen_random_uuid(),
  numero                    text not null,
  filiale_source_id         uuid not null references public.filiales(id),
  filiale_destination_id    uuid not null references public.filiales(id),
  -- Caisse qui a sorti les fonds ; la caisse d'arrivée n'est connue qu'à la réception.
  caisse_source_id          uuid not null references public.caisses(id),
  caisse_destination_id     uuid references public.caisses(id),
  montant                   numeric(14,2) not null check (montant > 0),
  motif                     text,
  statut                    text not null default 'EN_TRANSIT' check (statut in ('EN_TRANSIT', 'RECU', 'ANNULE')),
  date_envoi                timestamptz not null default now(),
  date_reception            timestamptz,
  utilisateur_envoi_id      uuid references public.utilisateurs(id),
  utilisateur_reception_id  uuid references public.utilisateurs(id),
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  -- `audit_trigger()` lit `filiale_id` sur la ligne, et le flux de synchro du
  -- journal filtre dessus : c'est la filiale qui a sorti les fonds.
  filiale_id                uuid generated always as (filiale_source_id) stored,
  unique (filiale_source_id, numero),
  constraint filiales_distinctes check (filiale_source_id <> filiale_destination_id)
);

create index idx_transferts_filiales_source      on public.transferts_filiales(filiale_source_id, date_envoi desc);
create index idx_transferts_filiales_destination on public.transferts_filiales(filiale_destination_id, statut, date_envoi desc);

create trigger trg_transferts_filiales_updated_at before update on public.transferts_filiales for each row execute function public.set_updated_at();
-- Mouvement d'espèces entre filiales : toujours journalisé.
create trigger trg_transferts_filiales_audit after insert or update or delete on public.transferts_filiales for each row execute function public.audit_trigger();

alter table public.transferts_filiales enable row level security;

-- Les deux filiales concernées voient et écrivent la ligne : l'expéditeur la
-- crée, le destinataire la passe à « RECU ».
create policy transferts_filiales_par_filiale on public.transferts_filiales for all to authenticated
  using (
    public.est_directeur()
    or filiale_source_id = public.current_filiale_id()
    or filiale_destination_id = public.current_filiale_id()
  )
  with check (
    public.est_directeur()
    or filiale_source_id = public.current_filiale_id()
    or filiale_destination_id = public.current_filiale_id()
  );

alter publication powersync add table public.transferts_filiales;
