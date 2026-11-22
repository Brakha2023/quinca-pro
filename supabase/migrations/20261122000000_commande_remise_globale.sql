-- ============================================================
-- BON DE COMMANDE : REMISE GLOBALE EN FRANCS
-- ============================================================
-- Même constat que pour l'entrée en stock (migration
-- `entree_remise_globale_livraison`), et la même réponse : la remise d'un
-- fournisseur se négocie **sur le bon entier et en francs** (« je vous fais
-- 15 000 sur le tout »), pas article par article et pas en pourcentage. Le
-- bon de commande était resté au modèle d'avant — un pourcentage sur la pièce
-- *et* un pourcentage par ligne —, qui obligeait à retrouver de tête le taux
-- correspondant au rabais convenu, et à le ventiler à la main.
--
-- `commandes_fournisseurs.remise_montant` porte la remise accordée sur le
-- bon. `lignes_commande_fournisseur.remise_montant` porte la **part** de cette
-- remise revenant à la ligne, répartie au prorata de sa valeur
-- (`repartirRemiseGlobale`, la même règle que pour une entrée et pour une
-- vente) : la somme des parts redonne la remise du bon, et `total_ht` de
-- chaque ligne en est déjà net — le net du bon est donc la somme de ses
-- lignes, sans rien reconstituer.
--
-- C'est aussi ce qui permet de **réceptionner partiellement** sans fausser le
-- coût : la part de remise d'une ligne se proratise à la quantité reçue, là où
-- un pourcentage de pièce devait être rappliqué à chaque réception.
--
-- `remise_percent` est conservée telle quelle, sur la pièce comme sur la
-- ligne : les bons déjà enregistrés continuent de se calculer et de
-- s'imprimer avec les pourcentages qu'ils portaient. Le code lit les deux et
-- n'écrit plus que les francs (voir `totauxCommande`).

alter table public.commandes_fournisseurs
  add column if not exists remise_montant numeric(14,2) not null default 0;

alter table public.lignes_commande_fournisseur
  add column if not exists remise_montant numeric(14,2) not null default 0;

comment on column public.commandes_fournisseurs.remise_montant is
  'Remise accordée sur le bon entier, en francs. Répartie au prorata sur les lignes (`lignes_commande_fournisseur.remise_montant`) ; `remise_percent` ne sert plus qu''aux pièces d''avant.';

comment on column public.lignes_commande_fournisseur.remise_montant is
  'Part de la remise globale du bon portée par cette ligne, en francs. `total_ht` en est déjà net ; la somme des parts redonne la remise du bon.';
