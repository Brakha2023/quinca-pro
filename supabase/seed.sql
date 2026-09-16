-- ============================================================
-- Données de référence minimales pour démarrer (dev / première mise en prod).
-- Les comptes utilisateurs se créent dans Supabase Auth (dashboard ou API admin)
-- avec les métadonnées : { "nom", "prenom", "profil", "filiale_id" }.
-- ============================================================

insert into public.filiales (id, code, nom, type, ville) values
  ('11111111-1111-1111-1111-111111111111', 'MM',  'Maison mère',        'MAISON_MERE', 'Abidjan'),
  ('22222222-2222-2222-2222-222222222222', 'ABJ', 'Filiale Abidjan',    'FILIALE',     'Abidjan'),
  ('33333333-3333-3333-3333-333333333333', 'BKE', 'Filiale Bouaké',     'FILIALE',     'Bouaké'),
  ('44444444-4444-4444-4444-444444444444', 'SPY', 'Filiale San-Pedro',  'FILIALE',     'San-Pedro')
on conflict (code) do nothing;

-- Un dépôt principal et une caisse principale par filiale.
insert into public.depots (code, nom, filiale_id)
select 'DEP-01', 'Dépôt principal', id from public.filiales
on conflict (filiale_id, code) do nothing;

insert into public.caisses (code, nom, filiale_id)
select 'C01', 'Caisse principale', id from public.filiales
on conflict (filiale_id, code) do nothing;

-- Familles d'articles standard d'une quincaillerie, par filiale.
insert into public.familles_articles (code, nom, filiale_id)
select f.code, f.nom, fi.id
from (values
  ('SAN', 'SANITAIRE'),
  ('PLO', 'PLOMBERIE'),
  ('ELE', 'ELECTRICITE'),
  ('OUT', 'OUTILLAGE'),
  ('QUI', 'QUINCAILLERIE'),
  ('CIM', 'CIMENT'),
  ('PEI', 'PEINTURE'),
  ('CAR', 'CARREAU'),
  ('DIV', 'DIVERS')
) as f(code, nom)
cross join public.filiales fi
on conflict (filiale_id, code) do nothing;
