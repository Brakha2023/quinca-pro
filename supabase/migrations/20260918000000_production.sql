-- Production : transformation de matières premières (sorties de stock) en
-- articles produits (entrées de stock au coût de revient). Une production est
-- une pièce à part entière (`productions` + `lignes_production`) ; ses
-- mouvements de stock portent son numéro en référence.

alter table public.mouvements_stock drop constraint if exists mouvements_stock_type_check;
alter table public.mouvements_stock add constraint mouvements_stock_type_check check (type in (
  'ENTREE_ACHAT', 'SORTIE_VENTE', 'SORTIE_DESTOCKAGE',
  'TRANSFERT_ENTREE', 'TRANSFERT_SORTIE',
  'INVENTAIRE', 'AJUSTEMENT', 'RETOUR_CLIENT', 'CASSE',
  'SORTIE_PRODUCTION', 'ENTREE_PRODUCTION'
));

create table public.productions (
  id             uuid primary key default gen_random_uuid(),
  numero         text not null,
  depot_id       uuid not null references public.depots(id),
  filiale_id     uuid not null references public.filiales(id),
  equipe         text,
  date_debut     timestamptz not null,
  date_fin       timestamptz,
  cout_matieres  numeric(14,2) not null default 0,
  commentaire    text,
  utilisateur_id uuid references public.utilisateurs(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (filiale_id, numero)
);

create table public.lignes_production (
  id               uuid primary key default gen_random_uuid(),
  production_id    uuid not null references public.productions(id) on delete cascade,
  filiale_id       uuid not null references public.filiales(id),
  -- MATIERE : consommée (sortie de stock) ; PRODUIT : obtenu (entrée de stock).
  sens             text not null check (sens in ('MATIERE', 'PRODUIT')),
  article_id       uuid not null references public.articles(id),
  code_article     text not null,
  designation      text not null,
  unite            text,
  quantite_prevue  numeric(14,3),
  quantite         numeric(14,3) not null,
  pertes           numeric(14,3) not null default 0,
  cout_unitaire    numeric(14,2),
  created_at       timestamptz not null default now()
);

create index idx_productions_filiale_date on public.productions(filiale_id, date_debut desc);
create index idx_lignes_production_prod   on public.lignes_production(production_id);

create trigger trg_productions_updated_at before update on public.productions
  for each row execute function public.set_updated_at();
create trigger trg_productions_audit after insert or update or delete on public.productions
  for each row execute function public.audit_trigger();

alter table public.productions enable row level security;
alter table public.lignes_production enable row level security;
create policy productions_par_filiale on public.productions for all to authenticated
  using (public.est_directeur() or filiale_id = public.current_filiale_id())
  with check (public.est_directeur() or filiale_id = public.current_filiale_id());
create policy lignes_production_par_filiale on public.lignes_production for all to authenticated
  using (public.est_directeur() or filiale_id = public.current_filiale_id())
  with check (public.est_directeur() or filiale_id = public.current_filiale_id());

alter publication powersync add table public.productions, public.lignes_production;
