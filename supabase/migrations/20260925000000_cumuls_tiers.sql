-- ============================================================
-- CUMULS DES CLIENTS ET DES FOURNISSEURS, CALCULÉS PAR POSTGRES
-- ============================================================
-- Dernier morceau du chantier commencé avec `cumuls_serveur` : le stock et le
-- solde de caisse sont déjà calculés ici, par deltas tirés des journaux. Les
-- comptes de tiers restaient calculés par le poste, en valeur absolue — deux
-- postes hors ligne qui vendent au même client écrasaient donc mutuellement
-- leur créance, et la dernière écriture arrivée gagnait.
--
-- Ils sont plus délicats que le stock : ils ne dérivent pas d'un journal
-- unique, mais de pièces **dont le statut change**. Une vente annulée doit
-- décrémenter ce qu'elle avait incrémenté. D'où des déclencheurs qui réagissent
-- à l'INSERT *et* à l'UPDATE, et appliquent la différence entre l'ancienne et
-- la nouvelle contribution de la pièce.
--
-- Qui alimente quoi :
--
--   clients.cumul_factures    ← ventes.total_ttc (hors ventes annulées)
--   clients.cumul_reglements  ← reglements_clients.montant
--                               moins, à l'annulation d'une vente, ce qui
--                               avait été encaissé au comptoir
--   fournisseurs.cumul_factures   ← commandes_fournisseurs.total_recu_ttc
--                                   (la valeur **reçue**, pas la commandée)
--   fournisseurs.cumul_reglements ← reglements_fournisseurs.montant
--
-- `solde_actuel` est recalculé à chaque fois : solde_initial + factures − règlements.
-- ============================================================

-- ------------------------------------------------------------
-- Application d'un delta sur un compte
-- ------------------------------------------------------------
create or replace function public.appliquer_cumul_client(p_client uuid, p_factures numeric, p_reglements numeric)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_client is null or (coalesce(p_factures, 0) = 0 and coalesce(p_reglements, 0) = 0) then
    return;
  end if;
  update public.clients
     set cumul_factures   = round(coalesce(cumul_factures, 0) + p_factures, 2),
         cumul_reglements = round(coalesce(cumul_reglements, 0) + p_reglements, 2),
         solde_actuel     = round(coalesce(solde_initial, 0)
                                  + coalesce(cumul_factures, 0) + p_factures
                                  - coalesce(cumul_reglements, 0) - p_reglements, 2),
         updated_at = now()
   where id = p_client;
end $$;

create or replace function public.appliquer_cumul_fournisseur(p_fournisseur uuid, p_factures numeric, p_reglements numeric)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_fournisseur is null or (coalesce(p_factures, 0) = 0 and coalesce(p_reglements, 0) = 0) then
    return;
  end if;
  update public.fournisseurs
     set cumul_factures   = round(coalesce(cumul_factures, 0) + p_factures, 2),
         cumul_reglements = round(coalesce(cumul_reglements, 0) + p_reglements, 2),
         solde_actuel     = round(coalesce(solde_initial, 0)
                                  + coalesce(cumul_factures, 0) + p_factures
                                  - coalesce(cumul_reglements, 0) - p_reglements, 2),
         updated_at = now()
   where id = p_fournisseur;
end $$;

-- ------------------------------------------------------------
-- Ventes → créance du client
-- ------------------------------------------------------------
create or replace function public.cumuler_vente_client()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_facture_avant numeric(14,2) := 0;
  v_facture_apres numeric(14,2) := 0;
  v_regle_avant   numeric(14,2) := 0;
  v_regle_apres   numeric(14,2) := 0;
begin
  -- Contribution de la pièce, avant et après : son total tant qu'elle vit,
  -- rien une fois annulée. À l'annulation s'ajoute la reprise de ce qui avait
  -- été encaissé au comptoir — le règlement correspondant, lui, reste au
  -- journal, c'est donc ici qu'il faut le défaire.
  if tg_op = 'UPDATE' then
    v_facture_avant := case when old.statut <> 'ANNULEE' then coalesce(old.total_ttc, 0) else 0 end;
    v_regle_avant   := case when old.statut =  'ANNULEE' then -(coalesce(old.montant_percu, 0) - coalesce(old.monnaie, 0)) else 0 end;
  end if;
  v_facture_apres := case when new.statut <> 'ANNULEE' then coalesce(new.total_ttc, 0) else 0 end;
  if tg_op = 'UPDATE' then
    v_regle_apres := case when new.statut = 'ANNULEE' then -(coalesce(new.montant_percu, 0) - coalesce(new.monnaie, 0)) else 0 end;
  end if;

  if tg_op = 'UPDATE' and old.client_id is distinct from new.client_id then
    perform public.appliquer_cumul_client(old.client_id, -v_facture_avant, -v_regle_avant);
    perform public.appliquer_cumul_client(new.client_id, v_facture_apres, v_regle_apres);
  else
    perform public.appliquer_cumul_client(new.client_id, v_facture_apres - v_facture_avant, v_regle_apres - v_regle_avant);
  end if;

  return new;
end $$;

drop trigger if exists trg_ventes_cumul_client on public.ventes;
create trigger trg_ventes_cumul_client
  after insert or update on public.ventes
  for each row execute function public.cumuler_vente_client();

-- ------------------------------------------------------------
-- Règlements clients
-- ------------------------------------------------------------
create or replace function public.cumuler_reglement_client()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform public.appliquer_cumul_client(new.client_id, 0, coalesce(new.montant, 0));
    return new;
  end if;
  -- Un règlement ne se modifie pas dans l'application ; la suppression est
  -- traitée pour que la base reste juste si quelqu'un en retire un à la main.
  perform public.appliquer_cumul_client(old.client_id, 0, -coalesce(old.montant, 0));
  return old;
end $$;

drop trigger if exists trg_reglements_clients_cumul on public.reglements_clients;
create trigger trg_reglements_clients_cumul
  after insert or delete on public.reglements_clients
  for each row execute function public.cumuler_reglement_client();

-- ------------------------------------------------------------
-- Commandes et achats → dette fournisseur
-- ------------------------------------------------------------
-- C'est la valeur **reçue** qui fait la dette : un bon de commande envoyé ne
-- doit rien, une réception partielle ne doit que ce qui est entré en stock.
create or replace function public.cumuler_commande_fournisseur()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_avant numeric(14,2) := 0;
  v_apres numeric(14,2) := 0;
begin
  if tg_op = 'UPDATE' then
    v_avant := case when old.statut <> 'ANNULEE' then coalesce(old.total_recu_ttc, 0) else 0 end;
  end if;
  v_apres := case when new.statut <> 'ANNULEE' then coalesce(new.total_recu_ttc, 0) else 0 end;

  if tg_op = 'UPDATE' and old.fournisseur_id is distinct from new.fournisseur_id then
    perform public.appliquer_cumul_fournisseur(old.fournisseur_id, -v_avant, 0);
    perform public.appliquer_cumul_fournisseur(new.fournisseur_id, v_apres, 0);
  else
    perform public.appliquer_cumul_fournisseur(new.fournisseur_id, v_apres - v_avant, 0);
  end if;

  return new;
end $$;

drop trigger if exists trg_commandes_fournisseurs_cumul on public.commandes_fournisseurs;
create trigger trg_commandes_fournisseurs_cumul
  after insert or update on public.commandes_fournisseurs
  for each row execute function public.cumuler_commande_fournisseur();

-- ------------------------------------------------------------
-- Règlements fournisseurs
-- ------------------------------------------------------------
create or replace function public.cumuler_reglement_fournisseur()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform public.appliquer_cumul_fournisseur(new.fournisseur_id, 0, coalesce(new.montant, 0));
    return new;
  end if;
  perform public.appliquer_cumul_fournisseur(old.fournisseur_id, 0, -coalesce(old.montant, 0));
  return old;
end $$;

drop trigger if exists trg_reglements_fournisseurs_cumul on public.reglements_fournisseurs;
create trigger trg_reglements_fournisseurs_cumul
  after insert or delete on public.reglements_fournisseurs
  for each row execute function public.cumuler_reglement_fournisseur();

-- ------------------------------------------------------------
-- Les postes n'écrivent plus ces colonnes
-- ------------------------------------------------------------
-- Même garde que pour les stocks et les caisses : le client les retire de ce
-- qu'il envoie (voir `cumulsServeur.ts`), et ceci protège des postes restés
-- sur une version antérieure. `solde_initial`, lui, appartient bien à la
-- fiche : il reste modifiable, et le solde est recalculé avec.
create or replace function public.ignorer_cumuls_tiers()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.cumul_factures := 0;
    new.cumul_reglements := 0;
    new.solde_actuel := round(coalesce(new.solde_initial, 0), 2);
  else
    new.cumul_factures := old.cumul_factures;
    new.cumul_reglements := old.cumul_reglements;
    new.solde_actuel := round(coalesce(new.solde_initial, 0)
                              + coalesce(old.cumul_factures, 0)
                              - coalesce(old.cumul_reglements, 0), 2);
  end if;
  return new;
end $$;

drop trigger if exists trg_clients_ignorer_cumuls on public.clients;
create trigger trg_clients_ignorer_cumuls
  before insert or update on public.clients
  for each row when (pg_trigger_depth() = 0) execute function public.ignorer_cumuls_tiers();

drop trigger if exists trg_fournisseurs_ignorer_cumuls on public.fournisseurs;
create trigger trg_fournisseurs_ignorer_cumuls
  before insert or update on public.fournisseurs
  for each row when (pg_trigger_depth() = 0) execute function public.ignorer_cumuls_tiers();
