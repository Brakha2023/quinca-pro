-- `lignes_vente` était la seule table d'activité sans horodatage : impossible
-- de borner son flux de synchronisation dans le temps, alors que c'est la plus
-- volumineuse (plusieurs lignes par vente, pour toujours, sur chaque poste).
--
-- La colonne est renseignée par défaut côté serveur, et par le poste à la
-- création, pour que la ligne locale porte la même date que sa vente.

alter table public.lignes_vente
  add column if not exists created_at timestamptz not null default now();

-- Reprise de l'existant : la date de la vente dont la ligne fait partie.
update public.lignes_vente l
   set created_at = v.date_vente
  from public.ventes v
 where v.id = l.vente_id
   and l.created_at <> v.date_vente;

create index if not exists idx_lignes_vente_created_at on public.lignes_vente (created_at);
