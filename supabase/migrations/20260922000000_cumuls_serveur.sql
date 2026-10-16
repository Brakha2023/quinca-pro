-- Les cumuls (stock d'un dépôt, solde d'une caisse) étaient calculés par chaque
-- poste et envoyés en valeur absolue. Deux postes hors ligne partaient chacun de
-- leur copie : à la reconnexion, la dernière écriture arrivée écrasait l'autre,
-- et la vente ou l'encaissement de l'autre poste disparaissait du cumul.
--
-- Ils sont désormais calculés ici, par application de **deltas** tirés des
-- journaux (qui, eux, sont en ajout seul et donc toujours exacts). Deux postes
-- qui arrivent dans n'importe quel ordre donnent le même résultat.
--
-- Le delta d'un mouvement de stock est `quantite_apres - quantite_avant` : il
-- vaut pour tous les types, y compris l'inventaire, sans avoir à les énumérer.
--
-- Les déclencheurs ne réagissent qu'à l'INSERT. PowerSync réémet une opération
-- par `upsert` : un renvoi tombe sur ON CONFLICT DO UPDATE, donc n'est pas
-- compté deux fois.

-- ------------------------------------------------------------
-- Stock d'un article dans un dépôt
-- ------------------------------------------------------------
create or replace function public.cumuler_mouvement_stock()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_delta     numeric(14,3) := coalesce(new.quantite_apres, 0) - coalesce(new.quantite_avant, 0);
  v_quantite  numeric(14,3);
  v_cout      numeric(14,2);
  v_base      numeric(14,3);
begin
  select quantite, cout_moyen into v_quantite, v_cout
    from public.stocks where article_id = new.article_id and depot_id = new.depot_id
    for update;

  if not found then
    insert into public.stocks (article_id, depot_id, filiale_id, quantite, quantite_reservee, quantite_disponible, cout_moyen, date_dernier_mouvement)
    values (new.article_id, new.depot_id, new.filiale_id, v_delta, 0, v_delta,
            case when v_delta > 0 then coalesce(new.cout_unitaire, 0) else 0 end, new.created_at);
    return new;
  end if;

  -- Coût moyen pondéré : seules les entrées valorisées le déplacent, et il se
  -- calcule sur la quantité **du serveur**, pas sur celle qu'avait le poste.
  if v_delta > 0 and new.cout_unitaire is not null then
    v_base := greatest(coalesce(v_quantite, 0), 0);
    if v_base + v_delta > 0 then
      v_cout := round(((v_base * coalesce(v_cout, 0)) + (v_delta * new.cout_unitaire)) / (v_base + v_delta), 2);
    else
      v_cout := new.cout_unitaire;
    end if;
  end if;

  update public.stocks
     set quantite = coalesce(quantite, 0) + v_delta,
         quantite_disponible = coalesce(quantite, 0) + v_delta - coalesce(quantite_reservee, 0),
         cout_moyen = v_cout,
         date_dernier_mouvement = greatest(coalesce(date_dernier_mouvement, new.created_at), new.created_at),
         updated_at = now()
   where article_id = new.article_id and depot_id = new.depot_id;

  return new;
end $$;

drop trigger if exists trg_mouvements_stock_cumul on public.mouvements_stock;
create trigger trg_mouvements_stock_cumul
  after insert on public.mouvements_stock
  for each row execute function public.cumuler_mouvement_stock();

-- ------------------------------------------------------------
-- Solde d'une caisse
-- ------------------------------------------------------------
create or replace function public.cumuler_mouvement_tresorerie()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.caisse_id is null then
    return new;
  end if;

  update public.caisses
     set solde_actuel = coalesce(solde_actuel, 0)
                      + case when new.type = 'RECETTE' then coalesce(new.montant, 0) else -coalesce(new.montant, 0) end,
         updated_at = now()
   where id = new.caisse_id;

  return new;
end $$;

drop trigger if exists trg_mouvements_tresorerie_cumul on public.mouvements_tresorerie;
create trigger trg_mouvements_tresorerie_cumul
  after insert on public.mouvements_tresorerie
  for each row execute function public.cumuler_mouvement_tresorerie();

-- ------------------------------------------------------------
-- Les postes n'écrivent plus ces colonnes : le client les retire de ce qu'il
-- envoie (voir SupabaseConnector). Ce garde-fou empêche qu'un poste resté sur
-- une ancienne version écrase le cumul calculé ici.
-- ------------------------------------------------------------
create or replace function public.ignorer_cumuls_envoyes()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_table_name = 'stocks' then
    -- À la création, les cumuls partent de zéro : c'est le mouvement qui les
    -- remplira. Sans cela, un poste resté sur l'ancienne version créerait la
    -- ligne avec sa quantité, puis le déclencheur ajouterait le même delta.
    new.quantite := case when tg_op = 'INSERT' then 0 else old.quantite end;
    new.quantite_disponible := case when tg_op = 'INSERT' then 0 else old.quantite_disponible end;
    new.cout_moyen := case when tg_op = 'INSERT' then 0 else old.cout_moyen end;
    new.date_dernier_mouvement := case when tg_op = 'INSERT' then null else old.date_dernier_mouvement end;
  elsif tg_table_name = 'caisses' then
    new.solde_actuel := case when tg_op = 'INSERT' then 0 else old.solde_actuel end;
  end if;
  return new;
end $$;

-- `pg_trigger_depth() = 0` : seules les écritures venues d'un poste sont
-- filtrées ; les déclencheurs de cumul ci-dessus écrivent librement.
drop trigger if exists trg_stocks_ignorer_cumuls on public.stocks;
create trigger trg_stocks_ignorer_cumuls
  before insert or update on public.stocks
  for each row when (pg_trigger_depth() = 0) execute function public.ignorer_cumuls_envoyes();

drop trigger if exists trg_caisses_ignorer_cumuls on public.caisses;
create trigger trg_caisses_ignorer_cumuls
  before insert or update on public.caisses
  for each row when (pg_trigger_depth() = 0) execute function public.ignorer_cumuls_envoyes();
