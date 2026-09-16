# QuincaPro

Gestion commerciale multi-filiales pour quincaillerie (POS, stock, tiers, trésorerie), **local-first** :
chaque poste travaille sur une base SQLite locale et se synchronise avec le serveur quand le réseau est là.

## Architecture

```
apps/desktop            Application Tauri 2 + React 19 (Vite, Tailwind)
  src/core              Domaine pur : entités, règles métier — aucune dépendance React/PowerSync
  src/infrastructure    Adaptateurs : env, Supabase, PowerSync (schéma, connector, repositories)
  src/presentation      React : auth, layout, pages, composants, stores d'UI
packages/shared-types   Description unique des tables (types de lignes + schéma SQLite) et énumérations
supabase/               Migrations Postgres, seed, Sync Streams PowerSync
```

Flux de données :

```
UI (useQuery) ──lit──▶ SQLite locale (PowerSync) ◀──télécharge── PowerSync Service ◀── Postgres (Supabase)
UI (repository) ─écrit─▶ SQLite locale ─file CRUD─▶ SupabaseConnector.uploadData ─▶ Postgres (RLS + JWT)
```

- Les lectures ne touchent **jamais** le réseau.
- Les écritures sont appliquées localement puis rejouées vers Supabase par
  [`SupabaseConnector`](apps/desktop/src/infrastructure/powersync/SupabaseConnector.ts).
- Le périmètre synchronisé par utilisateur est défini par [`supabase/sync-streams.yaml`](supabase/sync-streams.yaml) :
  sa filiale pour un gérant/caissier/magasinier, toutes les filiales pour le directeur.
- La sécurité côté serveur repose sur les politiques RLS de la migration (le client n'utilise que la clé `anon` + JWT).

## Prérequis

- Node ≥ 24, pnpm 11 (`corepack enable`)
- Rust stable + prérequis Tauri 2 : https://tauri.app/start/prerequisites/
- Un projet Supabase et une instance PowerSync

## Mise en place du backend

1. **Supabase** : exécuter `supabase/migrations/*.sql` puis `supabase/seed.sql` (SQL Editor ou `psql`).
   En `psql`, l'hôte direct `db.<ref>.supabase.co` n'a qu'une adresse IPv6 : passer par le pooler en mode
   session, `aws-1-<region>.pooler.supabase.com:5432`, utilisateur `postgres.<ref>`.
2. **PowerSync** (dashboard de l'instance) :
   - *Connection* : connecter la base Supabase (le dashboard fournit le SQL du rôle de réplication ;
     la publication `powersync` est créée par la migration) ;
   - *Client Auth* : les JWT Supabase sont signés en ES256 → renseigner **JWKS URI** =
     `https://<ref>.supabase.co/auth/v1/.well-known/jwks.json` puis « Save and Deploy »
     (la case « Use Supabase Auth » ne couvre que l'ancien secret HS256) ;
     sans cela le client reçoit `PSYNC_S2101 … no key matched the token KID` ;
   - *Sync Streams* : coller `supabase/sync-streams.yaml` et déployer. Le périmètre par utilisateur
     vient de la table `acces_filiales` (migration `20260916100000`), maintenue par trigger.
   ⚠ Vérifier que `VITE_POWERSYNC_URL` pointe sur l'instance configurée (dashboard → *Client SDK Setup*).
3. **Utilisateurs** : créer les comptes dans Supabase Auth avec les métadonnées
   `{ "nom": "…", "prenom": "…", "profil": "DIRECTEUR|GERANT|CAISSIER|MAGASINIER", "filiale_id": "<uuid ou vide pour DIRECTEUR>" }`.
   Le profil `utilisateurs` est créé automatiquement par trigger.
4. Copier `apps/desktop/.env.example` en `apps/desktop/.env` et renseigner les URLs/clés.

## Développement

```sh
pnpm install
pnpm desktop           # lance Tauri + Vite (fenêtre native)
pnpm --filter @quinca/desktop dev   # Vite seul, dans le navigateur (http://localhost:1420)

pnpm --filter @quinca/desktop e2e        # scénario Catalogue en local (Chromium headless, sans backend)
E2E_EMAIL=… E2E_PASSWORD=… pnpm --filter @quinca/desktop e2e:sync   # aller-retour réel Supabase/PowerSync
pnpm check-types       # tsc sur tout le monorepo
pnpm lint              # eslint
pnpm build             # build web (dist/) ; `pnpm --filter @quinca/desktop tauri build` pour l'installeur
```

## Conventions

- Toute nouvelle fonctionnalité lit/écrit via PowerSync (`useQuery`, repositories) — jamais via des mocks.
- Les identifiants sont des UUID générés côté client ; les numéros de pièces (tickets, règlements)
  embarquent le code caisse pour rester uniques hors ligne.
- Les types de lignes viennent de `@quinca/shared-types` (`Row<'articles'>`) ; les énumérations aussi.
  Toute évolution de schéma = migration SQL **et** mise à jour de `packages/shared-types/src/tables.ts`.
- Pas de logique métier dans les pages : elle vit dans `core/` (testable sans React).

## Feuille de route

Voir l'historique des commits « phase 0 » pour l'état des fondations. Prochaines phases :
domaine par domaine sur PowerSync (articles → stock → clients → POS → fournisseurs → trésorerie → livraisons),
puis packaging desktop (impression, mises à jour, signature), puis pilotage/consolidation.
