-- ============================================================
-- DÉPENSES À APPROUVER — saisie, puis validation
-- ============================================================
-- Le menu « Dépense » fonctionne comme le menu « Vente » : la dépense est
-- d'abord **engagée** par qui la constate, puis **validée** par qui en a le
-- droit — et c'est la validation qui fait sortir l'argent de la caisse
-- (`DepensesRepository.valider`, une ligne de journal par pièce). Entre les
-- deux, la dépense existe, se lit, se corrige, et ne coûte rien.
--
-- ### Pourquoi une table, et pas un statut sur `mouvements_tresorerie`
--
-- Parce qu'un mouvement de trésorerie **est** un mouvement d'argent : le
-- déclencheur `cumuler_mouvement_tresorerie` (migration `cumuls_serveur`)
-- débite la caisse à l'`INSERT` de toute ligne portant un `caisse_id`. Une
-- dépense « en attente » rangée là aurait donc déjà vidé la caisse, ce qui est
-- exactement ce qu'on veut éviter. Et le journal de caisse doit rester ce
-- qu'il est : la liste de ce qui est entré et sorti, sans conditionnel.
--
-- C'est le même raisonnement que pour `ventes_brouillons` : une pièce qui
-- n'engage encore rien ne se range pas parmi celles qui engagent.
--
-- ### Ce qu'il y a, et pourquoi
--
-- `valide_par` et `date_validation` : une approbation sans nom n'en est pas
-- une. Le journal d'audit le dirait, mais il se consulte en ligne, et la
-- question « qui a autorisé cette sortie ? » se pose devant la pièce.
--
-- `REFUSEE` plutôt qu'`ANNULEE` : le troisième état d'une dépense engagée
-- n'est pas l'annulation d'un fait, c'est le refus d'une demande. Le motif est
-- obligatoire de fait — un refus sans raison se représente le lendemain.
--
-- Pas de série courte (`numero_court`) : la pièce ne circule pas hors de la
-- maison et ne se dicte pas au téléphone. Elle porte le numéro long, comme les
-- opérations de caisse saisies à la main, dont elle prend la suite.
-- ============================================================

create table if not exists public.depenses (
  id              uuid primary key default gen_random_uuid(),
  -- Numéro long, tiré sur le poste : unique hors ligne (voir `numeroPiece`).
  numero          text not null,
  filiale_id      uuid not null references public.filiales(id) on delete cascade,
  -- La caisse qui paiera. Choisie à la saisie : on engage une dépense sur une
  -- caisse précise, et c'est celle-là qui sera débitée à la validation.
  caisse_id       uuid not null references public.caisses(id),
  -- Même nomenclature que le journal de caisse : catégories intégrées du code
  -- et catégories ajoutées par la filiale (`categories_tresorerie`).
  categorie       text not null,
  montant         numeric(14,2) not null check (montant > 0),
  -- À qui l'argent va : le taxi, le bailleur, la quincaillerie d'à côté.
  beneficiaire    text,
  description     text,
  -- Pièce justificative du dehors : numéro de facture, de reçu, de bordereau.
  reference       text,
  date_depense    timestamptz not null default now(),
  statut          text not null default 'EN_ATTENTE'
                    check (statut in ('EN_ATTENTE', 'VALIDEE', 'REFUSEE')),
  motif_refus     text,
  -- Qui engage, qui approuve : deux personnes, et c'est tout l'intérêt.
  utilisateur_id  uuid references public.utilisateurs(id) on delete set null,
  valide_par      uuid references public.utilisateurs(id) on delete set null,
  date_validation timestamptz,
  notes           text,
  -- Fenêtre d'historique synchronisée (voir migration `fenetre_historique`).
  dans_fenetre    boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Le numéro identifie la pièce dans la filiale : deux postes hors ligne ne
-- doivent pas pouvoir en créer deux identiques sans que le serveur le refuse.
create unique index if not exists idx_depenses_numero on public.depenses(filiale_id, numero);
create index if not exists idx_depenses_filiale on public.depenses(filiale_id, date_depense desc);
-- Ce qui attend est ce qu'on vient chercher : le gérant ouvre l'écran pour ça.
create index if not exists idx_depenses_attente on public.depenses(filiale_id, statut) where statut = 'EN_ATTENTE';
create index if not exists idx_depenses_dans_fenetre on public.depenses(dans_fenetre) where dans_fenetre;

drop trigger if exists trg_depenses_updated_at on public.depenses;
create trigger trg_depenses_updated_at before update on public.depenses
  for each row execute function public.set_updated_at();

-- Une sortie d'argent se retrace : qui l'a engagée, qui l'a approuvée, et ce
-- qui a changé entre les deux.
drop trigger if exists trg_depenses_audit on public.depenses;
create trigger trg_depenses_audit after insert or update or delete on public.depenses
  for each row execute function public.audit_trigger();

alter table public.depenses enable row level security;

-- La dépense appartient à la filiale qui la paie ; un directeur voit les
-- siennes. Le droit de **valider** se joue sur le poste (`depenses.valider`) :
-- ici, la règle est celle du périmètre, comme pour toutes les pièces.
drop policy if exists depenses_par_filiale on public.depenses;
create policy depenses_par_filiale on public.depenses for all to authenticated
  using (public.est_directeur() or filiale_id = public.current_filiale_id())
  with check (public.est_directeur() or filiale_id = public.current_filiale_id());

-- `add table` échoue si la table est déjà publiée : une migration doit pouvoir
-- se rejouer après un échec partiel (la console SQL valide instruction par
-- instruction, sans transaction d'ensemble).
do $$
begin
  alter publication powersync add table public.depenses;
exception
  when duplicate_object then null;
end $$;

-- ------------------------------------------------------------
-- La fenêtre d'historique, étendue aux dépenses
-- ------------------------------------------------------------
-- Même fonction qu'en migration `fenetre_historique`, `depenses` en plus. Une
-- dépense **en attente** n'en sort jamais, quelle que soit son âge : comme une
-- créance non soldée, elle attend une décision, et elle doit rester sous les
-- yeux de qui doit la prendre.
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
                           'transferts_filiales','pointages','avances_salaire','paies','depenses'];
  colonnes text[] := array['date_vente','created_at','date_reglement','date_proforma','created_at','created_at',
                           'created_at','created_at','created_at','date_commande',
                           'created_at','date_reglement','date_operation',
                           'created_at','date_pointage','date_avance','created_at','date_depense'];
begin
  for i in 1..array_length(noms, 1) loop
    t := noms[i];
    c := colonnes[i];
    garder := case t
      when 'ventes' then ' or (reste_a_payer > 0 and statut <> ''ANNULEE'')'
      when 'commandes_fournisseurs' then ' or statut in (''BROUILLON'', ''ENVOYEE'', ''PARTIELLE'') or (reste_a_payer > 0 and statut <> ''ANNULEE'')'
      when 'livraisons' then ' or statut in (''A_PREPARER'', ''EN_COURS'')'
      when 'transferts_filiales' then ' or statut = ''EN_TRANSIT'''
      when 'depenses' then ' or statut = ''EN_ATTENTE'''
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
