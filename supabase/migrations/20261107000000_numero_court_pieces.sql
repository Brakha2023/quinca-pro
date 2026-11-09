-- ============================================================
-- NUMÉRO COURT DES PIÈCES
-- ============================================================
-- Le numéro d'une pièce est aujourd'hui `C01-6WR-20261020-RMTPJS` : vingt-six
-- caractères, tirés au hasard. C'est ce qu'il fallait pour qu'un poste puisse
-- numéroter sans réseau — mais personne ne le dicte au téléphone, personne ne
-- le recopie sur un cahier, et un client qui revient avec son reçu ne le
-- retrouve pas dans un classeur.
--
-- On ajoute donc un **second** numéro, court et lisible :
--
--     VNT-AN8-000075
--     │   │   └─ rang de la pièce sur ce poste, pour cette nature
--     │   └───── code du poste (déjà présent dans le numéro long)
--     └───────── nature de la pièce
--
-- Il ne remplace rien. `numero` reste l'identité de la pièce : c'est lui que
-- porte le code-barres, lui que l'unicité `(filiale_id, numero)` protège, lui
-- que les rapprochements utilisent. Le court est ce qu'on lit.
--
-- Pourquoi pas `VNT-000075`, continu à l'échelle de la filiale ? Parce qu'un
-- compteur de filiale ne peut pas être attribué hors ligne : deux caisses qui
-- vendent au même moment, sans réseau, tireraient toutes les deux le 76. Le
-- code du poste est le seul cloisonnement qui tienne sans serveur — et il est
-- déjà là. Le compteur, lui, vit dans le stockage local du poste, rangé avec
-- son code pour que les deux se perdent ensemble (voir `identitePoste.ts`).
--
-- Aucune contrainte d'unicité : si le stockage local d'un poste était effacé
-- sans que son code le soit, deux pièces pourraient porter le même numéro
-- court. C'est une gêne de lecture, jamais une perte — et une contrainte qui
-- ferait **refuser** la pièce à la synchronisation transformerait cette gêne
-- en écriture perdue. L'unicité reste l'affaire du numéro long.
--
-- Les pièces déjà enregistrées gardent une colonne vide : elles s'impriment
-- avec leur numéro long, comme avant.

alter table public.ventes
  add column if not exists numero_court text;

alter table public.livraisons
  add column if not exists numero_court text;

-- Sur un mouvement de stock, c'est le **bon** qui est numéroté : toutes les
-- lignes d'un même bon portent la même valeur, exactement comme `reference`.
alter table public.mouvements_stock
  add column if not exists reference_courte text;

comment on column public.ventes.numero_court is
  'Numéro court lisible (VNT-AN8-000075), séquentiel par poste. Imprimé en tête ; `numero` reste l''identité de la vente.';
comment on column public.livraisons.numero_court is
  'Numéro court lisible du bon de livraison, séquentiel par poste. `numero` reste l''identité du bon.';
comment on column public.mouvements_stock.reference_courte is
  'Numéro court lisible du bon auquel la ligne appartient, séquentiel par poste. `reference` reste l''identité du bon.';

-- Retrouver une pièce par le numéro que le client présente : c'est le seul
-- usage de ces colonnes, et il se fait toujours dans une filiale.
create index if not exists idx_ventes_numero_court on public.ventes (filiale_id, numero_court);
create index if not exists idx_mouvements_reference_courte on public.mouvements_stock (filiale_id, reference_courte);
