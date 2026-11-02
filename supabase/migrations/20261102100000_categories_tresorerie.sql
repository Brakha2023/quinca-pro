-- ============================================================
-- CATÉGORIES DE TRÉSORERIE AJOUTÉES PAR LA MAISON
-- ============================================================
-- Les catégories d'une recette ou d'une dépense étaient écrites en dur dans
-- l'application (`core/tresorerie/tresorerie.ts`). Une quincaillerie qui paie
-- un gardiennage, une patente ou un dédouanement n'allait pas attendre une
-- version de l'application pour nommer sa dépense : elle rangeait tout dans
-- « Autre dépense », et l'état des dépenses par catégorie ne disait plus rien.
--
-- ### Ce que la table contient, et ce qu'elle ne contient pas
--
-- Elle contient les catégories **ajoutées** par la filiale, et elles seules.
-- Les catégories intégrées (TRANSPORT, LOYER, APPORT…) restent dans le code :
-- des mouvements les portent déjà, l'application les connaît par leur nom, et
-- les semer ici dans chaque filiale les rendrait effaçables — un journal de
-- caisse afficherait alors un code nu à la place d'un libellé.
--
-- Les catégories que les modules métier produisent eux-mêmes (VENTE,
-- REGLEMENT_CLIENT, TRANSFERT_CAISSE, VERSEMENT, RETRAIT…) ne sont pas
-- saisissables non plus : elles naissent d'une pièce, jamais d'un choix. Le
-- poste refuse de créer une catégorie qui porterait un de ces codes.
--
-- ### Le code, et pourquoi il ne bouge plus
--
-- `code` est ce qui s'écrit dans `mouvements_tresorerie.categorie` ; il est
-- dérivé du libellé à la création (« Frais de dédouanement » →
-- FRAIS_DE_DEDOUANEMENT) puis figé. Renommer une catégorie change le libellé,
-- jamais le code : sinon les mouvements déjà enregistrés perdraient leur
-- rattachement, et il n'y a pas de mise à jour en masse qui rattrape un
-- historique parti sur vingt postes.
--
-- Une catégorie ne se supprime pas, elle se désactive : elle disparaît de la
-- liste de saisie et continue de nommer les mouvements du passé.
-- ============================================================

create table if not exists public.categories_tresorerie (
  id          uuid primary key default gen_random_uuid(),
  filiale_id  uuid not null references public.filiales(id) on delete cascade,
  -- Ce qui est écrit dans `mouvements_tresorerie.categorie`. Figé.
  code        text not null,
  libelle     text not null,
  type        text not null check (type in ('RECETTE', 'DEPENSE')),
  est_active  boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  -- Deux catégories de même code dans une filiale rendraient le journal
  -- ambigu ; deux filiales peuvent en revanche nommer la leur pareil.
  unique (filiale_id, code)
);

comment on table public.categories_tresorerie is
  'Catégories de recette ou de dépense ajoutées par une filiale. Les catégories intégrées restent dans le code de l''application.';
comment on column public.categories_tresorerie.code is
  'Valeur écrite dans mouvements_tresorerie.categorie. Dérivée du libellé à la création, puis figée.';

create index if not exists idx_categories_tresorerie_filiale
  on public.categories_tresorerie (filiale_id, type);

-- ------------------------------------------------------------
-- Horodatage, audit, RLS, publication
-- ------------------------------------------------------------
drop trigger if exists trg_categories_tresorerie_updated_at on public.categories_tresorerie;
create trigger trg_categories_tresorerie_updated_at before update on public.categories_tresorerie
  for each row execute function public.set_updated_at();

-- Journalisé : renommer une catégorie change ce que disent les états de
-- dépenses déjà imprimés, et c'est un acte de gestion.
drop trigger if exists trg_categories_tresorerie_audit on public.categories_tresorerie;
create trigger trg_categories_tresorerie_audit after insert or update or delete on public.categories_tresorerie
  for each row execute function public.audit_trigger();

alter table public.categories_tresorerie enable row level security;

-- Lecture : tout poste de la filiale, sans quoi il afficherait un code nu
-- dans son journal de caisse. Un directeur lit les siennes.
drop policy if exists categories_tresorerie_select on public.categories_tresorerie;
create policy categories_tresorerie_select on public.categories_tresorerie for select to authenticated
  using (public.est_directeur() or filiale_id = public.current_filiale_id());

-- Écriture : qui saisit une dépense peut nommer sa catégorie. C'est le sens de
-- la chose — la catégorie manquante se découvre la pièce en main, au guichet,
-- et non trois jours plus tard dans un écran de paramètres.
drop policy if exists categories_tresorerie_write on public.categories_tresorerie;
create policy categories_tresorerie_write on public.categories_tresorerie for all to authenticated
  using (public.a_permission('tresorerie.mouvement')
         and (public.est_directeur() or filiale_id = public.current_filiale_id()))
  with check (public.a_permission('tresorerie.mouvement')
              and (public.est_directeur() or filiale_id = public.current_filiale_id()));

-- `add table` échoue si la table est déjà publiée : une migration doit pouvoir
-- se rejouer après un échec partiel.
do $$
begin
  alter publication powersync add table public.categories_tresorerie;
exception
  when duplicate_object then null;
end $$;
