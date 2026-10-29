-- ============================================================
-- VENTES EN BROUILLON — partagées entre les postes d'une filiale
-- ============================================================
-- Un client part chercher sa carte, un autre attend derrière : le caissier met
-- le ticket de côté et encaisse le suivant. Jusqu'ici le brouillon restait sur
-- la machine ; il se reprend maintenant depuis n'importe quel poste de la
-- filiale — c'est utile quand on change de caisse en cours de journée.
--
-- ### Pourquoi une table, et pas un statut sur `ventes`
--
-- Un brouillon n'est pas une vente : rien n'est vendu, rien ne sort du stock,
-- aucun numéro n'est tiré, aucune caisse ne bouge. Lui donner un statut dans
-- `ventes` l'aurait fait entrer dans **toutes** les requêtes qui disent
-- `statut <> 'ANNULEE'` — chiffre d'affaires, marge, encaissé, clients servis,
-- impayés, journal de caisse, cumuls du compte client calculés par trigger.
-- Il aurait fallu reprendre chacune sans en oublier une, et une seule oubliée
-- gonfle le chiffre d'affaires en silence. La table séparée coûte une
-- migration ; le statut aurait coûté une confiance.
--
-- ### Pourquoi les lignes en JSON
--
-- Rien n'interroge jamais la ligne d'un brouillon : on ne fait pas de
-- statistiques sur des paniers abandonnés. Le panier voyage donc d'un bloc,
-- comme `parametres_filiale.formats_documents`. Une table de lignes aurait
-- ajouté un flux de synchronisation et une jointure pour rien.
--
-- ### Ce qu'il n'y a pas
--
-- Pas de déclencheur d'audit : le journal retrace les actes de gestion, et
-- mettre un ticket de côté n'en est pas un. Pas de `dans_fenetre` non plus —
-- un brouillon vit quelques heures, pas douze mois.
-- ============================================================

create table if not exists public.ventes_brouillons (
  id              uuid primary key default gen_random_uuid(),
  -- Ce qui s'affiche dans la liste : le client, ou ce que contient le panier.
  libelle         text not null,
  filiale_id      uuid not null references public.filiales(id) on delete cascade,
  client_id       uuid references public.clients(id) on delete set null,
  -- Le panier tel que l'écran le tient (tableau JSON de lignes).
  lignes          text not null,
  -- Remise accordée sur la vente, en francs.
  remise          numeric(14,2) not null default 0,
  -- La remise suit encore le taux commercial du client (voir `pos.store.ts`).
  remise_auto     boolean not null default true,
  -- Repris tels quels pour la liste, qui n'a pas à recalculer un panier.
  total_ttc       numeric(14,2) not null default 0,
  articles        numeric(14,3) not null default 0,
  -- Qui l'a mis de côté, et depuis quelle machine : sur l'autre poste, on veut
  -- savoir à qui l'on prend le ticket avant de le reprendre.
  utilisateur_id  uuid references public.utilisateurs(id) on delete set null,
  poste           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_ventes_brouillons_filiale
  on public.ventes_brouillons(filiale_id, created_at desc);

drop trigger if exists trg_ventes_brouillons_updated_at on public.ventes_brouillons;
create trigger trg_ventes_brouillons_updated_at before update on public.ventes_brouillons
  for each row execute function public.set_updated_at();

alter table public.ventes_brouillons enable row level security;

-- Un brouillon appartient à la filiale, pas au caissier : c'est ce qui permet
-- de le reprendre depuis une autre caisse. Les prix et le stock dépendent de
-- la filiale, et un directeur voit les siennes.
drop policy if exists ventes_brouillons_par_filiale on public.ventes_brouillons;
create policy ventes_brouillons_par_filiale on public.ventes_brouillons for all to authenticated
  using (public.est_directeur() or filiale_id = public.current_filiale_id())
  with check (public.est_directeur() or filiale_id = public.current_filiale_id());

-- `add table` échoue si la table est déjà publiée : une migration doit pouvoir
-- se rejouer après un échec partiel (la console SQL valide instruction par
-- instruction, sans transaction d'ensemble).
do $$
begin
  alter publication powersync add table public.ventes_brouillons;
exception
  when duplicate_object then null;
end $$;
