-- Remise accordée ligne par ligne, à la saisie d'une entrée en stock et d'un
-- bon de commande fournisseur. Jusqu'ici la remise n'existait qu'au niveau du
-- bon de commande entier : impossible de négocier un article en particulier,
-- et rien ne gardait trace de la remise obtenue sur une entrée directe.
--
-- Sur un mouvement de stock, `cout_unitaire` reste le coût **net** retenu pour
-- la valorisation (c'est lui qui alimente le coût moyen pondéré) ; la colonne
-- ci-dessous conserve la remise consentie pour pouvoir la justifier.

alter table public.mouvements_stock
  add column if not exists remise_percent numeric(5,2) not null default 0;

comment on column public.mouvements_stock.remise_percent is
  'Remise accordée sur la ligne, en %. `cout_unitaire` est déjà net de cette remise.';

alter table public.lignes_commande_fournisseur
  add column if not exists remise_percent numeric(5,2) not null default 0;

comment on column public.lignes_commande_fournisseur.remise_percent is
  'Remise de ligne en %, appliquée avant la remise globale du bon. `total_ht` en tient compte.';
