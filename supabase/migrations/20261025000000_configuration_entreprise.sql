-- ============================================================
-- Configuration de l'entreprise, filiale par filiale
-- ============================================================
-- Jusqu'ici l'identité de la maison était écrite en dur : « QCF » dans
-- l'en-tête des documents, et le reste nulle part. Un RCCM, un numéro de
-- compte contribuable ou une mention légale ne se changent pas en recompilant
-- l'application.
--
-- Une ligne par filiale. Chaque filiale a sa propre raison sociale, ses
-- propres identifiants fiscaux et ses propres papiers : ce sont des
-- établissements distincts, pas des copies d'un modèle commun.
--
-- Les logos sont stockés en data URL, comme les photos d'employés (voir
-- `infrastructure/fichiers/piecesJointes.ts`) : ils descendent sur le poste
-- avec la fiche, et un document s'imprime donc hors ligne avec son logo.
-- Le poste les réduit avant l'envoi — une image de 2 Mo synchronisée sur
-- chaque machine coûterait plus cher qu'elle ne rapporte.
-- ============================================================

create table if not exists public.parametres_filiale (
  id                     uuid primary key default gen_random_uuid(),
  filiale_id             uuid not null unique references public.filiales(id) on delete cascade,

  -- Identité
  nom_commercial         text not null,
  raison_sociale         text,
  forme_juridique        text,
  rccm                   text,
  numero_cc              text,
  compte_contribuable    text,

  -- Coordonnées
  telephone_principal    text,
  telephone_secondaire   text,
  email                  text,
  adresse                text,
  ville                  text,
  pays                   text not null default 'Côte d''Ivoire',
  localisation           text,

  -- Identité visuelle (data URL)
  logo_couleur           text,
  logo_noir_blanc        text,
  logo_entete            text,
  logo_filigrane         text,

  -- Fiscalité et facturation
  assujetti_tva          integer not null default 1 check (assujetti_tva in (0, 1)),
  taux_tva               real    not null default 18 check (taux_tva >= 0 and taux_tva <= 100),
  prix_saisis            text    not null default 'TTC' check (prix_saisis in ('TTC', 'HT')),
  devise                 text    not null default 'XOF',
  mentions_legales       text,

  -- Réglages des pièces imprimées et de leur numérotation, en JSON : une
  -- nature de pièce est une notion de l'application, pas du schéma. Ajouter un
  -- document ne doit pas demander une migration.
  formats_documents      text,
  prefixes_numerotation  text,

  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

comment on table public.parametres_filiale is
  'Identité, fiscalité et papiers d''une filiale. Une ligne par filiale.';
comment on column public.parametres_filiale.formats_documents is
  'JSON : { "<nature>": { "format": "A4|A5|TICKET", "noir_blanc": bool, "logo_entete": bool, "logo_filigrane": bool } }';
comment on column public.parametres_filiale.prefixes_numerotation is
  'JSON : { "<nature>": "PREFIXE" }. Voir core/commun/numerotation.ts.';

create index if not exists idx_parametres_filiale_filiale on public.parametres_filiale (filiale_id);

-- ------------------------------------------------------------
-- Horodatage, audit, RLS, publication
-- ------------------------------------------------------------
drop trigger if exists trg_parametres_filiale_updated_at on public.parametres_filiale;
create trigger trg_parametres_filiale_updated_at before update on public.parametres_filiale
  for each row execute function public.set_updated_at();

-- Changer la raison sociale ou un numéro fiscal engage la maison : c'est journalisé.
drop trigger if exists trg_parametres_filiale_audit on public.parametres_filiale;
create trigger trg_parametres_filiale_audit after insert or update or delete on public.parametres_filiale
  for each row execute function public.audit_trigger();

-- Lecture : tout poste qui reçoit la filiale en a besoin pour imprimer ses
-- pièces, y compris hors ligne. Rien de confidentiel : ce sont les mentions
-- qui figurent déjà au bas de chaque facture.
-- Écriture : la permission `parametres.entreprise`, et elle seule.
alter table public.parametres_filiale enable row level security;
drop policy if exists parametres_filiale_select on public.parametres_filiale;
create policy parametres_filiale_select on public.parametres_filiale for select to authenticated using (true);
drop policy if exists parametres_filiale_write on public.parametres_filiale;
create policy parametres_filiale_write on public.parametres_filiale for all to authenticated
  using (public.a_permission('parametres.entreprise'))
  with check (public.a_permission('parametres.entreprise'));

do $$ begin
  alter publication powersync add table public.parametres_filiale;
exception when duplicate_object then null; end $$;

-- ------------------------------------------------------------
-- Les filiales qui existent déjà reçoivent leur fiche
-- ------------------------------------------------------------
-- Reprise de ce que la filiale porte déjà : son nom, son adresse, son
-- téléphone, sa ville. Le reste est à compléter dans l'écran Paramètres, et
-- les documents continuent d'imprimer ce qu'ils imprimaient jusqu'ici.
insert into public.parametres_filiale (filiale_id, nom_commercial, raison_sociale, adresse, ville, telephone_principal)
select f.id, f.nom, f.nom, f.adresse, f.ville, f.telephone
from public.filiales f
where not exists (select 1 from public.parametres_filiale p where p.filiale_id = f.id);

-- Une filiale créée plus tard reçoit la sienne de la même façon.
create or replace function public.filiale_creer_parametres()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.parametres_filiale (filiale_id, nom_commercial, raison_sociale, adresse, ville, telephone_principal)
  values (new.id, new.nom, new.nom, new.adresse, new.ville, new.telephone)
  on conflict (filiale_id) do nothing;
  return new;
end;
$$;

comment on function public.filiale_creer_parametres() is
  'Une filiale sans fiche de configuration n''a pas d''en-tête de document : on la crée avec elle.';

drop trigger if exists trg_filiales_creer_parametres on public.filiales;
create trigger trg_filiales_creer_parametres after insert on public.filiales
  for each row execute function public.filiale_creer_parametres();

-- ------------------------------------------------------------
-- La permission qui ouvre cet écran
-- ------------------------------------------------------------
-- Le catalogue des permissions vit dans l'application (core/parametres) : le
-- serveur n'en connaît que la forme. On accorde donc simplement le nouveau
-- droit au rôle qui administre déjà la maison.
--
-- Au directeur général seul : changer une raison sociale, un RCCM ou une
-- mention légale engage la société, pas l'établissement. Le gérant de filiale
-- n'a aucune permission `parametres.*` — c'est déjà le cas aujourd'hui, et
-- `ROLES_SYSTEME` (core/parametres/roles.ts) en est le miroir.
--
-- Le superadministrateur en est exclu : il détient `*`, et `roles_permissions_proteger()`
-- refuse — à juste titre — qu'on lui accorde une permission de plus.
insert into public.roles_permissions (role_id, permission)
select r.id, 'parametres.entreprise'
from public.roles r
where r.est_systeme
  and not r.est_superadmin
  and r.code = 'role_directeur'
  and not exists (
    select 1 from public.roles_permissions rp
    where rp.role_id = r.id and rp.permission = 'parametres.entreprise'
  );
