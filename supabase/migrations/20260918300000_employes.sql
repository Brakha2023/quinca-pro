-- Module Employés : fiches (photo et contrat joints, stockés en base pour
-- rester disponibles hors ligne), pointage quotidien, avances sur salaire,
-- paies mensuelles et leur paiement en caisse.

create table public.employes (
  id              uuid primary key default gen_random_uuid(),
  matricule       text not null,
  nom             text not null,
  prenom          text,
  sexe            text check (sexe in ('M', 'F')),
  telephone       text,
  fonction        text,
  date_debut      date,
  date_fin        date,
  type_contrat    text not null default 'CDI' check (type_contrat in ('CDI', 'CDD', 'STAGE', 'JOURNALIER', 'PRESTATAIRE')),
  salaire_base    numeric(14,2) not null default 0,
  est_actif       boolean not null default true,
  -- Vignette JPEG (data URL, ≤ 300 Ko) et contrat (PDF/image, data URL, ≤ 1 Mo).
  photo           text,
  contrat_nom     text,
  contrat_fichier text,
  notes           text,
  filiale_id      uuid not null references public.filiales(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (filiale_id, matricule)
);

create table public.pointages (
  id             uuid primary key default gen_random_uuid(),
  employe_id     uuid not null references public.employes(id) on delete cascade,
  filiale_id     uuid not null references public.filiales(id),
  date_pointage  date not null,
  statut         text not null check (statut in ('PRESENT', 'ABSENT', 'JUSTIFIE')),
  commentaire    text,
  utilisateur_id uuid references public.utilisateurs(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (employe_id, date_pointage)
);

create table public.avances_salaire (
  id             uuid primary key default gen_random_uuid(),
  numero         text not null,
  employe_id     uuid not null references public.employes(id),
  filiale_id     uuid not null references public.filiales(id),
  -- Mois de paie sur lequel l'avance est retenue (AAAA-MM).
  periode        text not null,
  date_avance    timestamptz not null default now(),
  montant        numeric(14,2) not null check (montant > 0),
  caisse_id      uuid references public.caisses(id),
  utilisateur_id uuid references public.utilisateurs(id),
  notes          text,
  created_at     timestamptz not null default now(),
  unique (filiale_id, numero)
);

create table public.paies (
  id               uuid primary key default gen_random_uuid(),
  employe_id       uuid not null references public.employes(id),
  filiale_id       uuid not null references public.filiales(id),
  periode          text not null,
  salaire_base     numeric(14,2) not null default 0,
  jours_presents   integer not null default 0,
  jours_absents    integer not null default 0,
  jours_justifies  integer not null default 0,
  retenue_absences numeric(14,2) not null default 0,
  primes           numeric(14,2) not null default 0,
  retenues         numeric(14,2) not null default 0,
  avances          numeric(14,2) not null default 0,
  brut             numeric(14,2) not null default 0,
  net_a_payer      numeric(14,2) not null default 0,
  statut           text not null default 'CALCULEE' check (statut in ('CALCULEE', 'PAYEE')),
  date_paiement    timestamptz,
  caisse_id        uuid references public.caisses(id),
  mode_paiement    text check (mode_paiement in ('ESPECES', 'CHEQUE', 'VIREMENT', 'MOBILE_MONEY')),
  reference        text,
  notes            text,
  utilisateur_id   uuid references public.utilisateurs(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (employe_id, periode)
);

create index idx_employes_filiale   on public.employes(filiale_id, est_actif);
create index idx_pointages_filiale  on public.pointages(filiale_id, date_pointage desc);
create index idx_paies_filiale      on public.paies(filiale_id, periode desc);
create index idx_avances_employe    on public.avances_salaire(employe_id, periode);

create trigger trg_employes_updated_at  before update on public.employes  for each row execute function public.set_updated_at();
create trigger trg_pointages_updated_at before update on public.pointages for each row execute function public.set_updated_at();
create trigger trg_paies_updated_at     before update on public.paies     for each row execute function public.set_updated_at();
-- Paies et avances sont sensibles : journalisées (les fiches employés ne le sont pas : pièces jointes volumineuses).
create trigger trg_paies_audit           after insert or update or delete on public.paies           for each row execute function public.audit_trigger();
create trigger trg_avances_salaire_audit after insert or update or delete on public.avances_salaire for each row execute function public.audit_trigger();

do $$
declare t text;
begin
  foreach t in array array['employes', 'pointages', 'avances_salaire', 'paies'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy %I_par_filiale on public.%I for all to authenticated
         using (public.est_directeur() or filiale_id = public.current_filiale_id())
         with check (public.est_directeur() or filiale_id = public.current_filiale_id())',
      t, t);
  end loop;
end $$;

alter publication powersync add table public.employes, public.pointages, public.avances_salaire, public.paies;
