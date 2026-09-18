-- Module Clients complet : fiche enrichie (identification, conditions
-- commerciales), proformas convertibles en facture (vente).

alter table public.clients
  add column if not exists groupe            text,
  add column if not exists civilite          text,
  add column if not exists numero_compte     text,
  add column if not exists telephone         text,
  add column if not exists pays              text,
  add column if not exists ville             text,
  add column if not exists numero_rc         text,
  add column if not exists numero_cc         text,
  add column if not exists date_effet_solde  date,
  add column if not exists remise_percent    numeric(5,2) not null default 0,
  add column if not exists prise_min_jour    numeric(14,2) not null default 0,
  add column if not exists prise_max_jour    numeric(14,2) not null default 0,
  add column if not exists periode_reglement text check (periode_reglement in ('COMPTANT', 'J15', 'J30', 'J45', 'J60', 'FIN_DE_MOIS')),
  add column if not exists notes             text;

create table public.proformas (
  id               uuid primary key default gen_random_uuid(),
  numero           text not null,
  client_id        uuid references public.clients(id),
  -- Client de passage : nom libre quand aucun client en compte n'est rattaché.
  client_nom       text,
  date_proforma    timestamptz not null default now(),
  date_validite    date,
  statut           text not null default 'EN_COURS' check (statut in ('EN_COURS', 'FACTUREE', 'ANNULEE')),
  remise_percent   numeric(5,2) not null default 0,
  total_ht         numeric(14,2) not null default 0,
  total_tva        numeric(14,2) not null default 0,
  total_ttc        numeric(14,2) not null default 0,
  vente_id         uuid references public.ventes(id),
  notes            text,
  utilisateur_id   uuid references public.utilisateurs(id),
  filiale_id       uuid not null references public.filiales(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (filiale_id, numero)
);

create table public.lignes_proforma (
  id                uuid primary key default gen_random_uuid(),
  proforma_id       uuid not null references public.proformas(id) on delete cascade,
  filiale_id        uuid not null references public.filiales(id),
  article_id        uuid references public.articles(id),
  code_article      text not null,
  designation       text not null,
  unite             text,
  quantite          numeric(14,3) not null,
  prix_unitaire_ttc numeric(14,2) not null,
  tva_percent       numeric(5,2) not null default 0,
  remise_percent    numeric(5,2) not null default 0,
  total_ttc         numeric(14,2) not null,
  created_at        timestamptz not null default now()
);

create index idx_proformas_filiale_date on public.proformas(filiale_id, date_proforma desc);
create index idx_lignes_proforma_prof   on public.lignes_proforma(proforma_id);

create trigger trg_proformas_updated_at before update on public.proformas
  for each row execute function public.set_updated_at();

alter table public.proformas enable row level security;
alter table public.lignes_proforma enable row level security;
create policy proformas_par_filiale on public.proformas for all to authenticated
  using (public.est_directeur() or filiale_id = public.current_filiale_id())
  with check (public.est_directeur() or filiale_id = public.current_filiale_id());
create policy lignes_proforma_par_filiale on public.lignes_proforma for all to authenticated
  using (public.est_directeur() or filiale_id = public.current_filiale_id())
  with check (public.est_directeur() or filiale_id = public.current_filiale_id());

alter publication powersync add table public.proformas, public.lignes_proforma;
