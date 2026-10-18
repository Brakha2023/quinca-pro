-- Remet les cumuls en accord avec les journaux, qui font foi.
-- À ne passer qu'après avoir regardé `verifier_cumuls.sql`, et de préférence
-- hors heures d'ouverture : les postes connectés recevront les valeurs corrigées.
--
--   psql "<connexion>" -f supabase/outils/reparer_cumuls.sql

\set ON_ERROR_STOP on
begin;

-- Les déclencheurs de garde refusent les écritures venues d'un poste ; ici
-- c'est une correction délibérée, on les met en sommeil le temps de la transaction.
alter table public.stocks disable trigger trg_stocks_ignorer_cumuls;
alter table public.caisses disable trigger trg_caisses_ignorer_cumuls;
alter table public.clients disable trigger trg_clients_ignorer_cumuls;
alter table public.fournisseurs disable trigger trg_fournisseurs_ignorer_cumuls;

update public.stocks s
   set quantite = coalesce(j.quantite, 0),
       quantite_disponible = coalesce(j.quantite, 0) - coalesce(s.quantite_reservee, 0),
       updated_at = now()
  from (select article_id, depot_id, sum(coalesce(quantite_apres, 0) - coalesce(quantite_avant, 0)) as quantite
          from public.mouvements_stock group by article_id, depot_id) j
 where j.article_id = s.article_id and j.depot_id = s.depot_id
   and s.quantite is distinct from coalesce(j.quantite, 0);

update public.caisses c
   set solde_actuel = coalesce(j.solde, 0), updated_at = now()
  from (select caisse_id, sum(case when type = 'RECETTE' then montant else -montant end) as solde
          from public.mouvements_tresorerie where caisse_id is not null group by caisse_id) j
 where j.caisse_id = c.id
   and c.solde_actuel is distinct from coalesce(j.solde, 0);

-- Comptes clients : factures des ventes vivantes, règlements du journal moins
-- ce qui avait été encaissé au comptoir sur les ventes annulées.
update public.clients c
   set cumul_factures = coalesce(v.factures, 0),
       cumul_reglements = round(coalesce(r.reglements, 0) - coalesce(v.repris, 0), 2),
       solde_actuel = round(coalesce(c.solde_initial, 0) + coalesce(v.factures, 0) - coalesce(r.reglements, 0) + coalesce(v.repris, 0), 2),
       updated_at = now()
  from (select id from public.clients) tous
  left join (select client_id,
                    sum(case when statut <> 'ANNULEE' then coalesce(total_ttc, 0) else 0 end) as factures,
                    sum(case when statut =  'ANNULEE' then coalesce(montant_percu, 0) - coalesce(monnaie, 0) else 0 end) as repris
               from public.ventes where client_id is not null group by client_id) v on v.client_id = tous.id
  left join (select client_id, sum(coalesce(montant, 0)) as reglements
               from public.reglements_clients group by client_id) r on r.client_id = tous.id
 where c.id = tous.id
   and (c.cumul_factures is distinct from coalesce(v.factures, 0)
        or c.cumul_reglements is distinct from round(coalesce(r.reglements, 0) - coalesce(v.repris, 0), 2));

-- Comptes fournisseurs : la dette suit la valeur reçue.
update public.fournisseurs f
   set cumul_factures = coalesce(a.recu, 0),
       cumul_reglements = coalesce(r.reglements, 0),
       solde_actuel = round(coalesce(f.solde_initial, 0) + coalesce(a.recu, 0) - coalesce(r.reglements, 0), 2),
       updated_at = now()
  from (select id from public.fournisseurs) tous
  left join (select fournisseur_id, sum(case when statut <> 'ANNULEE' then coalesce(total_recu_ttc, 0) else 0 end) as recu
               from public.commandes_fournisseurs where fournisseur_id is not null group by fournisseur_id) a on a.fournisseur_id = tous.id
  left join (select fournisseur_id, sum(coalesce(montant, 0)) as reglements
               from public.reglements_fournisseurs group by fournisseur_id) r on r.fournisseur_id = tous.id
 where f.id = tous.id
   and (f.cumul_factures is distinct from coalesce(a.recu, 0)
        or f.cumul_reglements is distinct from coalesce(r.reglements, 0));

alter table public.stocks enable trigger trg_stocks_ignorer_cumuls;
alter table public.caisses enable trigger trg_caisses_ignorer_cumuls;
alter table public.clients enable trigger trg_clients_ignorer_cumuls;
alter table public.fournisseurs enable trigger trg_fournisseurs_ignorer_cumuls;

commit;
