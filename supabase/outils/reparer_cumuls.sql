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

alter table public.stocks enable trigger trg_stocks_ignorer_cumuls;
alter table public.caisses enable trigger trg_caisses_ignorer_cumuls;

commit;
