-- ============================================================
-- ENTRÉE EN STOCK : REMISE GLOBALE ET DATE DE LIVRAISON
-- ============================================================
-- Deux manques constatés au comptoir d'un magasin de quincaillerie :
--
--  1. La remise d'un fournisseur se négocie sur **le bon entier et en
--     francs** (« je vous fais 15 000 sur le tout »), pas article par article
--     et pas en pourcentage. La remise de ligne en % introduite par
--     `remise_ligne` obligeait à répartir ce rabais à la main, de tête, en
--     pourcentages faux.
--  2. La marchandise arrive souvent la veille au soir, et n'est saisie que le
--     lendemain. `created_at` dit quand on a saisi, jamais quand on a reçu :
--     impossible de rapprocher un BL de son arrivée réelle.
--
-- `remise_montant` est la **part de la remise du bon portée par cette ligne**,
-- répartie au prorata de la valeur de chaque ligne. `cout_unitaire` reste le
-- coût net retenu pour la valorisation (c'est lui qui alimente le coût moyen
-- pondéré) : la somme des `remise_montant` d'une référence redonne la remise
-- accordée, et le brut du bon s'en déduit sans rien reconstituer.
--
-- `remise_percent` est conservée telle quelle : les bons déjà enregistrés
-- continuent de s'imprimer avec la remise de ligne qu'ils portaient.

alter table public.mouvements_stock
  add column if not exists remise_montant numeric(14,2) not null default 0,
  add column if not exists date_livraison timestamptz;

comment on column public.mouvements_stock.remise_montant is
  'Part de la remise globale du bon portée par cette ligne, en francs. `cout_unitaire` en est déjà net ; la somme par référence redonne la remise du bon.';

comment on column public.mouvements_stock.date_livraison is
  'Date et heure auxquelles la marchandise est réellement arrivée (bon de livraison). Nulle quand elle n''a pas été saisie ; `created_at` reste l''heure de la saisie.';
