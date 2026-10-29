-- ============================================================
-- CODE D'ANNULATION DES VENTES, PAR FILIALE
-- ============================================================
-- Annuler une vente remet la marchandise en stock, défait la créance du client
-- et sort l'argent de la caisse. C'est le geste le plus lourd du comptoir, et
-- il ne doit pas se faire seul : le gérant donne un code de six caractères,
-- qu'on tape devant lui. Sans ce code, pas d'annulation.
--
-- ### Ce qui est stocké
--
-- Pas le code, son **empreinte** PBKDF2 (même format que
-- `utilisateurs.empreinte_hors_ligne` : `pbkdf2$<itérations>$<sel>$<hash>`,
-- voir `infrastructure/auth/empreinteLocale.ts`). La ligne descend sur tous
-- les postes de la filiale — il faut que l'annulation marche hors ligne, un
-- jour de coupure — et un code en clair se lirait alors sur n'importe quelle
-- machine. Avec trois cent mille itérations, un code à six caractères ne se
-- retrouve pas par essais successifs.
--
-- ### Pourquoi sur la filiale et non sur l'utilisateur
--
-- Le code est celui de la **maison**, pas d'une personne : le gérant d'Abidjan
-- le donne à qui se trouve devant la caisse, et le change quand il le veut,
-- sans toucher aux comptes. Chaque filiale a le sien.
-- ============================================================

alter table public.parametres_filiale
  add column if not exists code_annulation text;

comment on column public.parametres_filiale.code_annulation is
  'Empreinte PBKDF2 du code d''annulation des ventes (jamais le code en clair). Nul = aucune annulation possible.';
