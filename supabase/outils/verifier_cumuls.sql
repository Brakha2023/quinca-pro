-- Écart entre les cumuls stockés et ce que disent les journaux.
-- LECTURE SEULE : à passer avant et après `reparer_cumuls.sql`.
--
--   psql "<connexion>" -f supabase/outils/verifier_cumuls.sql

\pset pager off

\echo '=== Stocks : quantité stockée vs somme des mouvements ==='
select d.nom as depot, a.code as article,
       s.quantite as stocke,
       coalesce(j.quantite, 0) as selon_journal,
       s.quantite - coalesce(j.quantite, 0) as ecart
  from public.stocks s
  join public.articles a on a.id = s.article_id
  join public.depots d on d.id = s.depot_id
  left join (
    select article_id, depot_id, sum(coalesce(quantite_apres, 0) - coalesce(quantite_avant, 0)) as quantite
      from public.mouvements_stock group by article_id, depot_id
  ) j on j.article_id = s.article_id and j.depot_id = s.depot_id
 where s.quantite is distinct from coalesce(j.quantite, 0)
 order by abs(s.quantite - coalesce(j.quantite, 0)) desc;

\echo '=== Caisses : solde stocké vs somme des mouvements ==='
select c.code, c.nom,
       c.solde_actuel as stocke,
       coalesce(j.solde, 0) as selon_journal,
       c.solde_actuel - coalesce(j.solde, 0) as ecart
  from public.caisses c
  left join (
    select caisse_id, sum(case when type = 'RECETTE' then montant else -montant end) as solde
      from public.mouvements_tresorerie where caisse_id is not null group by caisse_id
  ) j on j.caisse_id = c.id
 where c.solde_actuel is distinct from coalesce(j.solde, 0)
 order by abs(c.solde_actuel - coalesce(j.solde, 0)) desc;

\echo '=== Résumé ==='
select
  (select count(*) from public.stocks s
     left join (select article_id, depot_id, sum(coalesce(quantite_apres,0) - coalesce(quantite_avant,0)) q
                  from public.mouvements_stock group by article_id, depot_id) j
       on j.article_id = s.article_id and j.depot_id = s.depot_id
    where s.quantite is distinct from coalesce(j.q, 0)) as lignes_de_stock_en_ecart,
  (select count(*) from public.caisses c
     left join (select caisse_id, sum(case when type='RECETTE' then montant else -montant end) s
                  from public.mouvements_tresorerie where caisse_id is not null group by caisse_id) j
       on j.caisse_id = c.id
    where c.solde_actuel is distinct from coalesce(j.s, 0)) as caisses_en_ecart;
