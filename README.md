# QuincaPro

Gestion commerciale multi-filiales pour quincaillerie (POS, stock, tiers, trésorerie), **local-first** :
chaque poste travaille sur une base SQLite locale et se synchronise avec le serveur quand le réseau est là.

## Architecture

```
apps/desktop            Application Tauri 2 + React 19 (Vite, Tailwind)
  src/core              Domaine pur par module (articles, stock, clients, ventes, fournisseurs, tresorerie) :
                        entités, schémas zod, règles métier — aucune dépendance React/PowerSync, tests vitest
  src/infrastructure    Adaptateurs : env, Supabase, PowerSync (schéma, connector, repositories transactionnels)
  src/presentation      React : auth, layout, pages, features/<module> (hooks useQuery + composants), stores d'UI
  e2e/                  Scénarios Playwright headless (base locale réelle + UI), `pnpm e2e` / `pnpm e2e:sync`
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

pnpm --filter @quinca/desktop e2e        # scénarios locaux (Chromium headless, sans backend) — nécessite un Vite lancé ;
                                         # E2E_BASE_URL=http://localhost:1421 pour ne pas gêner `pnpm desktop` sur 1420
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
- Jamais `alert()` / `confirm()` / `prompt()` : la WebView de Tauri ne les affiche pas (`confirm` renvoie
  `false`). Utiliser `useNotifier()` et `useConfirmation()`.
- Les montants TTC encaissés sont arrondis au franc (`arrondirFcfa`) ; seuls les HT/TVA gardent 2 décimales.

### Fonctionnement hors ligne

- **Première connexion sur un poste : Internet obligatoire** (vérification du mot de passe par Supabase,
  puis synchronisation initiale des données de la filiale).
- Ensuite, l'app fonctionne sans réseau : lectures et écritures en SQLite local, file d'envoi rejouée
  automatiquement au retour de la connexion. La session est persistée (`quinca.auth`) et réutilisée
  même si le jeton d'accès est expiré ; il est renouvelé dès que le serveur redevient joignable.
- **« Se déconnecter » verrouille le poste** : la session et la base locale sont conservées, la
  synchronisation continue en arrière-plan (l'écran verrouillé affiche la file d'envoi). Rien n'est
  jamais perdu. Le déverrouillage se fait par mot de passe — vérifié par Supabase en ligne, ou hors
  ligne par une empreinte locale (PBKDF2, `quinca.empreinte`) mémorisée à la dernière connexion réussie.
- **Changer d'utilisateur** sur un poste exige le réseau et une file d'envoi vide : la base locale est
  alors effacée avant la synchronisation du nouvel utilisateur (les écritures du précédent ne partent
  jamais sous un autre nom).

## État d'avancement

- **Phase 0 — fondations** : faite (structure, typage strict, connector PowerSync, auth, schéma Postgres, Sync Streams).
- **Phase 1 — métier local-first** : faite. Catalogue (articles, familles, dépôts, import Excel), Stock (entrées,
  sorties, transferts, inventaire, journal, alertes), Clients (créances, règlements), Point de vente (vente atomique,
  crédit, livraison, ticket), Ventes (journée, validation, annulation), Fournisseurs (achats réceptionnés, dettes,
  paiements), Trésorerie (caisses, opérations, transferts), Livraisons, Audit, Dashboard et Consolidation.
  Chaque écriture métier est une transaction SQLite locale rejouée vers Supabase ; les lectures sont temps réel.
- **Phase 2 — desktop prod** : à faire (CSP Tauri, impression thermique, plugins Rust, auto-update, signature,
  build Windows testé).
- **Phase 3 — pilotage avancé** : exports Excel, rapports périodiques, bons de commande fournisseurs, recherche accentuée.

## Backlog technique connu

- **Recherche accentuée** : `LIKE` SQLite n'est insensible à la casse que pour l'ASCII (« koné » ne trouve pas « KONÉ »).
  Prévu : colonne `cle_recherche` (minuscules sans accents) sur `articles`, `clients`, `fournisseurs`, calculée
  côté client à l'écriture et par trigger côté serveur, et utilisée par toutes les recherches.
- **Bons de commande fournisseurs** (avant réception) : le schéma n'a pas de table de lignes de commande ;
  aujourd'hui un achat est saisi à la réception (BL/facture). Prévu : table `lignes_commandes_fournisseurs`,
  statuts BROUILLON → ENVOYEE → PARTIELLE/LIVREE avec réception partielle.
