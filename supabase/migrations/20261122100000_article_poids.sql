-- ============================================================
-- ARTICLE : POIDS UNITAIRE, EN TONNES
-- ============================================================
-- Une quincaillerie achète du lourd : le ciment, le fer à béton, les tôles
-- arrivent par camion, et ce qui décide du chargement n'est pas le nombre de
-- sacs mais le tonnage. Un bon de commande de 400 sacs de ciment, c'est
-- 20 tonnes : il faut un camion, et le transporteur veut ce chiffre-là.
--
-- D'où un poids **unitaire** porté par la fiche article, et non par la ligne
-- de bon : un sac de ciment pèse toujours 50 kg, ce n'est pas une donnée de
-- saisie. Le tonnage d'un bon se déduit (quantité × poids), il ne se stocke
-- pas — rien à tenir à jour, rien à faire divorcer.
--
-- **L'unité est la tonne**, et non le kilo. C'est l'unité du camion et du
-- devis de transport, celle dans laquelle le patron raisonne (« ça fait
-- combien de tonnes ? »). Quatre décimales suffisent largement : un sac de
-- 50 kg s'écrit 0,05 ; une vis, 0,0001 — en deçà, le poids ne pèse plus sur
-- la décision de chargement, qui est la seule que ce champ sert.
--
-- `null`, et non zéro : la plupart des articles n'ont pas de poids renseigné,
-- et ce n'est pas la même chose que peser zéro. C'est cette distinction qui
-- fait apparaître la colonne « Poids » sur un bon — elle ne s'affiche que si
-- au moins un article sélectionné en porte un, et reste invisible le reste du
-- temps (voir `bonPorteUnPoids`).

alter table public.articles
  add column if not exists poids_tonnes numeric(12,4);

comment on column public.articles.poids_tonnes is
  'Poids unitaire de l''article en tonnes (0,05 pour un sac de 50 kg). Facultatif : null = non renseigné, ce qui n''est pas « pèse zéro ». Le tonnage d''un bon se calcule (quantité × poids) et ne se stocke jamais.';
