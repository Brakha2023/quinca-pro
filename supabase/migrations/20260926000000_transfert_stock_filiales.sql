-- ============================================================
-- TRANSFERT DE STOCK ENTRE FILIALES
-- ============================================================
-- La marchandise voyage physiquement, comme les espèces du module Trésorerie :
-- la filiale expéditrice sort la marchandise de son dépôt dès l'envoi (le bon
-- part « EN_TRANSIT »), la filiale destinataire la fait entrer dans le dépôt de
-- son choix à l'arrivée. Entre les deux, les quantités ne sont dans aucun dépôt
-- mais elles sont dans une pièce : c'est le bon de transfert qui en répond.
--
-- Pourquoi une pièce, et pas deux mouvements comme le transfert inter-dépôts :
--   * chaque poste ne synchronise que les dépôts et le stock de SES filiales ;
--     l'expéditeur ne peut donc pas écrire dans le stock de la destinataire ;
--   * la RLS le lui refuserait de toute façon (`filiale_id = current_filiale_id()`) ;
--   * et le camion met un jour ou trois : l'entrée ne doit pas être écrite
--     avant que quelqu'un ait ouvert les caisses à l'arrivée.
--
-- Le catalogue est propre à chaque filiale (`articles` porte `filiale_id`, clé
-- unique `(filiale_id, code)`). La ligne de transfert emporte donc le **code**,
-- la désignation, l'unité et les prix : à la réception, la filiale retrouve
-- l'article par son code, et crée celui qu'elle ne connaissait pas encore
-- plutôt que de refuser une marchandise déjà posée dans la cour.
-- ============================================================

create table public.transferts_stock (
  id                        uuid primary key default gen_random_uuid(),
  numero                    text not null,
  filiale_source_id         uuid not null references public.filiales(id),
  filiale_destination_id    uuid not null references public.filiales(id),
  -- Dépôt qui a sorti la marchandise ; le dépôt d'arrivée n'est connu qu'à la réception.
  depot_source_id           uuid not null references public.depots(id),
  depot_destination_id      uuid references public.depots(id),
  statut                    text not null default 'EN_TRANSIT' check (statut in ('EN_TRANSIT', 'RECU', 'ANNULE')),
  motif                     text,
  -- Qui transporte : le chauffeur ou le véhicule, tel qu'il est écrit sur le bon.
  transporteur              text,
  -- Totaux repris du bon : la liste des transferts se lit sans relire les lignes.
  nombre_lignes             integer not null default 0,
  quantite_totale           numeric(14,3) not null default 0,
  valeur_totale             numeric(14,2) not null default 0,
  date_envoi                timestamptz not null default now(),
  date_reception            timestamptz,
  utilisateur_envoi_id      uuid references public.utilisateurs(id),
  utilisateur_reception_id  uuid references public.utilisateurs(id),
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  -- `audit_trigger()` lit `filiale_id` sur la ligne : c'est la filiale qui a expédié.
  filiale_id                uuid generated always as (filiale_source_id) stored,
  dans_fenetre              boolean not null default true,
  unique (filiale_source_id, numero),
  constraint transfert_stock_filiales_distinctes check (filiale_source_id <> filiale_destination_id)
);

create table public.lignes_transfert_stock (
  id                      uuid primary key default gen_random_uuid(),
  transfert_id            uuid not null references public.transferts_stock(id) on delete cascade,
  -- Les deux filiales sont portées par la ligne : les flux de synchronisation
  -- filtrent dessus sans jointure, comme `lignes_vente` porte sa filiale.
  filiale_source_id       uuid not null references public.filiales(id),
  filiale_destination_id  uuid not null references public.filiales(id),
  -- Article du catalogue de l'expéditeur ; la destinataire se repère au `code`.
  article_id              uuid references public.articles(id),
  code                    text not null,
  designation             text not null,
  unite                   text not null default 'PIECE',
  quantite                numeric(14,3) not null check (quantite > 0),
  -- Coût moyen du dépôt source : c'est à ce coût que la marchandise entrera.
  cout_unitaire           numeric(14,2) not null default 0,
  -- Prix de vente pratiqué par l'expéditeur : sert de base si la destinataire
  -- doit créer l'article, pour qu'il n'arrive jamais au catalogue à 0 F.
  prix_vente              numeric(14,2) not null default 0,
  montant                 numeric(14,2) not null default 0,
  created_at              timestamptz not null default now(),
  filiale_id              uuid generated always as (filiale_source_id) stored,
  dans_fenetre            boolean not null default true
);

create index idx_transferts_stock_source      on public.transferts_stock(filiale_source_id, date_envoi desc);
create index idx_transferts_stock_destination on public.transferts_stock(filiale_destination_id, statut, date_envoi desc);
create index idx_lignes_transfert_stock_bon   on public.lignes_transfert_stock(transfert_id);
create index idx_transferts_stock_dans_fenetre        on public.transferts_stock (dans_fenetre) where dans_fenetre;
create index idx_lignes_transfert_stock_dans_fenetre  on public.lignes_transfert_stock (dans_fenetre) where dans_fenetre;

create trigger trg_transferts_stock_updated_at before update on public.transferts_stock for each row execute function public.set_updated_at();

-- Marchandise qui quitte une filiale pour une autre : toujours journalisée.
create trigger trg_transferts_stock_audit       after insert or update or delete on public.transferts_stock       for each row execute function public.audit_trigger();
create trigger trg_lignes_transfert_stock_audit after insert or update or delete on public.lignes_transfert_stock for each row execute function public.audit_trigger();

alter table public.transferts_stock enable row level security;
alter table public.lignes_transfert_stock enable row level security;

-- Les deux filiales concernées voient et écrivent la pièce : l'expéditeur la
-- crée, le destinataire la passe à « RECU ».
create policy transferts_stock_par_filiale on public.transferts_stock for all to authenticated
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

create policy lignes_transfert_stock_par_filiale on public.lignes_transfert_stock for all to authenticated
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

alter publication powersync add table public.transferts_stock;
alter publication powersync add table public.lignes_transfert_stock;

-- ------------------------------------------------------------
-- Fenêtre d'historique : les deux tables entrent dans le rafraîchissement.
-- ------------------------------------------------------------
-- Même fonction qu'en 20260924000000, deux tables de plus. Un transfert resté
-- en transit ne sort jamais de la fenêtre — il attend quelqu'un à l'arrivée —
-- et ses lignes le suivent, sans quoi le bon arriverait vide au destinataire.
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
                           'transferts_filiales','transferts_stock','lignes_transfert_stock',
                           'pointages','avances_salaire','paies'];
  colonnes text[] := array['date_vente','created_at','date_reglement','date_proforma','created_at','created_at',
                           'created_at','created_at','created_at','date_commande',
                           'created_at','date_reglement','date_operation',
                           'created_at','date_envoi','created_at',
                           'date_pointage','date_avance','created_at'];
begin
  for i in 1..array_length(noms, 1) loop
    t := noms[i];
    c := colonnes[i];
    garder := case t
      when 'ventes' then ' or (reste_a_payer > 0 and statut <> ''ANNULEE'')'
      when 'commandes_fournisseurs' then ' or statut in (''BROUILLON'', ''ENVOYEE'', ''PARTIELLE'') or (reste_a_payer > 0 and statut <> ''ANNULEE'')'
      when 'livraisons' then ' or statut in (''A_PREPARER'', ''EN_COURS'')'
      when 'transferts_filiales' then ' or statut = ''EN_TRANSIT'''
      when 'transferts_stock' then ' or statut = ''EN_TRANSIT'''
      when 'lignes_transfert_stock' then ' or exists (select 1 from public.transferts_stock b where b.id = transfert_id and b.statut = ''EN_TRANSIT'')'
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
