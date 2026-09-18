-- Module Fournisseurs complet : fiche enrichie (identification, banque,
-- conditions de commande), bons de commande avec lignes et réceptions
-- partielles, données nécessaires au relevé de compte et aux relances.

alter table public.fournisseurs
  add column if not exists mobile                     text,
  add column if not exists numero_rc                  text,
  add column if not exists numero_cc                  text,
  add column if not exists interlocuteur              text,
  add column if not exists mobile_interlocuteur       text,
  add column if not exists date_effet_solde           date,
  add column if not exists periode_reglement          text check (periode_reglement in ('COMPTANT', 'J15', 'J30', 'J45', 'J60', 'FIN_DE_MOIS')),
  add column if not exists delai_echeance_jours       integer not null default 0,
  add column if not exists avance_confirmation_percent numeric(5,2) not null default 0,
  add column if not exists pourcentage_echeance       numeric(5,2) not null default 0,
  add column if not exists banque                     text,
  add column if not exists numero_compte_bancaire     text,
  add column if not exists notes                      text;

alter table public.commandes_fournisseurs
  add column if not exists depot_id       uuid references public.depots(id),
  add column if not exists remise_percent numeric(5,2) not null default 0,
  add column if not exists tva_percent    numeric(5,2) not null default 0,
  -- Valeur TTC effectivement réceptionnée (= dette générée) ; total_ttc reste la commande.
  add column if not exists total_recu_ttc numeric(14,2) not null default 0,
  add column if not exists date_reception timestamptz,
  add column if not exists utilisateur_id uuid references public.utilisateurs(id);

create table public.lignes_commande_fournisseur (
  id               uuid primary key default gen_random_uuid(),
  commande_id      uuid not null references public.commandes_fournisseurs(id) on delete cascade,
  filiale_id       uuid not null references public.filiales(id),
  article_id       uuid not null references public.articles(id),
  code_article     text not null,
  designation      text not null,
  unite            text,
  quantite         numeric(14,3) not null,
  quantite_recue   numeric(14,3) not null default 0,
  prix_unitaire_ht numeric(14,2) not null,
  total_ht         numeric(14,2) not null,
  created_at       timestamptz not null default now()
);
create index idx_lignes_commande_fournisseur_cmd on public.lignes_commande_fournisseur(commande_id);

alter table public.lignes_commande_fournisseur enable row level security;
create policy lignes_commande_fournisseur_par_filiale on public.lignes_commande_fournisseur for all to authenticated
  using (public.est_directeur() or filiale_id = public.current_filiale_id())
  with check (public.est_directeur() or filiale_id = public.current_filiale_id());

alter publication powersync add table public.lignes_commande_fournisseur;
