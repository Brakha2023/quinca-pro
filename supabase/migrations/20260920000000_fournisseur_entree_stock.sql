-- Provenance d'une entrée en stock : le fournisseur qui a livré la marchandise.
-- Jusqu'ici il n'était qu'une mention libre dans « motif », donc inexploitable
-- (pas de regroupement par fournisseur, pas de rapprochement avec son compte).
--
-- La colonne reste facultative : un retour client, un transfert, un inventaire
-- ou une production n'ont pas de fournisseur, et les mouvements déjà
-- enregistrés gardent la valeur nulle.

alter table public.mouvements_stock
  add column if not exists fournisseur_id uuid references public.fournisseurs(id) on delete set null;

comment on column public.mouvements_stock.fournisseur_id is
  'Fournisseur ayant livré la marchandise (entrées d''achat) ; nul pour les autres mouvements.';

create index if not exists idx_mouvements_stock_fournisseur
  on public.mouvements_stock(fournisseur_id)
  where fournisseur_id is not null;
