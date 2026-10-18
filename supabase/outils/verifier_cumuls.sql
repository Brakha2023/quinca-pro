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

\echo '=== Clients : compte stocké vs pièces ==='
select c.code, c.raison_sociale,
       c.solde_actuel as stocke,
       round(coalesce(c.solde_initial, 0) + coalesce(v.factures, 0) - coalesce(r.reglements, 0) + coalesce(v.repris, 0), 2) as selon_pieces,
       c.cumul_factures as factures_stockees, coalesce(v.factures, 0) as factures_pieces,
       c.cumul_reglements as reglements_stockes, round(coalesce(r.reglements, 0) - coalesce(v.repris, 0), 2) as reglements_pieces
  from public.clients c
  left join (
    -- Factures des ventes vivantes, et reprise de ce qui avait été encaissé
    -- au comptoir sur les ventes annulées (le règlement reste au journal).
    select client_id,
           sum(case when statut <> 'ANNULEE' then coalesce(total_ttc, 0) else 0 end) as factures,
           sum(case when statut =  'ANNULEE' then coalesce(montant_percu, 0) - coalesce(monnaie, 0) else 0 end) as repris
      from public.ventes where client_id is not null group by client_id
  ) v on v.client_id = c.id
  left join (
    select client_id, sum(coalesce(montant, 0)) as reglements
      from public.reglements_clients group by client_id
  ) r on r.client_id = c.id
 where c.solde_actuel is distinct from round(coalesce(c.solde_initial, 0) + coalesce(v.factures, 0) - coalesce(r.reglements, 0) + coalesce(v.repris, 0), 2)
 order by abs(c.solde_actuel - round(coalesce(c.solde_initial, 0) + coalesce(v.factures, 0) - coalesce(r.reglements, 0) + coalesce(v.repris, 0), 2)) desc;

\echo '=== Fournisseurs : compte stocké vs pièces ==='
select f.code, f.raison_sociale,
       f.solde_actuel as stocke,
       round(coalesce(f.solde_initial, 0) + coalesce(a.recu, 0) - coalesce(r.reglements, 0), 2) as selon_pieces,
       f.cumul_factures as factures_stockees, coalesce(a.recu, 0) as recu_selon_pieces,
       f.cumul_reglements as reglements_stockes, coalesce(r.reglements, 0) as reglements_pieces
  from public.fournisseurs f
  left join (
    -- La dette suit la valeur **reçue**, pas la valeur commandée.
    select fournisseur_id, sum(case when statut <> 'ANNULEE' then coalesce(total_recu_ttc, 0) else 0 end) as recu
      from public.commandes_fournisseurs where fournisseur_id is not null group by fournisseur_id
  ) a on a.fournisseur_id = f.id
  left join (
    select fournisseur_id, sum(coalesce(montant, 0)) as reglements
      from public.reglements_fournisseurs group by fournisseur_id
  ) r on r.fournisseur_id = f.id
 where f.solde_actuel is distinct from round(coalesce(f.solde_initial, 0) + coalesce(a.recu, 0) - coalesce(r.reglements, 0), 2)
 order by abs(f.solde_actuel - round(coalesce(f.solde_initial, 0) + coalesce(a.recu, 0) - coalesce(r.reglements, 0), 2)) desc;

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
    where c.solde_actuel is distinct from coalesce(j.s, 0)) as caisses_en_ecart,
  (select count(*) from public.clients c
     left join (select client_id,
                       sum(case when statut <> 'ANNULEE' then coalesce(total_ttc,0) else 0 end) f,
                       sum(case when statut =  'ANNULEE' then coalesce(montant_percu,0) - coalesce(monnaie,0) else 0 end) p
                  from public.ventes where client_id is not null group by client_id) v on v.client_id = c.id
     left join (select client_id, sum(coalesce(montant,0)) r from public.reglements_clients group by client_id) g on g.client_id = c.id
    where c.solde_actuel is distinct from round(coalesce(c.solde_initial,0) + coalesce(v.f,0) - coalesce(g.r,0) + coalesce(v.p,0), 2)) as clients_en_ecart,
  (select count(*) from public.fournisseurs f
     left join (select fournisseur_id, sum(case when statut <> 'ANNULEE' then coalesce(total_recu_ttc,0) else 0 end) a
                  from public.commandes_fournisseurs where fournisseur_id is not null group by fournisseur_id) c on c.fournisseur_id = f.id
     left join (select fournisseur_id, sum(coalesce(montant,0)) r from public.reglements_fournisseurs group by fournisseur_id) g on g.fournisseur_id = f.id
    where f.solde_actuel is distinct from round(coalesce(f.solde_initial,0) + coalesce(c.a,0) - coalesce(g.r,0), 2)) as fournisseurs_en_ecart;
