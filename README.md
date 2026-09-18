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
apps/desktop/scripts/windows/build.sh   # installeur Windows (NSIS x64) depuis macOS/Linux, via Docker → apps/desktop/dist-windows/
```

L'installeur Windows est produit par compilation croisée (`cargo-xwin` + NSIS dans un conteneur Debian,
caches dans des volumes Docker) ; il n'est pas signé (avertissement SmartScreen). Recette à dérouler sur
un PC Windows : `apps/desktop/scripts/windows/CHECKLIST-WINDOWS.md`.

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

### Fonctionnement hors ligne (postes partagés)

- **Mise en service d'un poste : Internet obligatoire une fois** (connexion d'un utilisateur de la
  filiale, synchronisation initiale). Ensuite le poste porte la base de **sa filiale** — commune à
  tous ses utilisateurs — et fonctionne sans réseau : lectures et écritures en SQLite local, file
  d'envoi rejouée automatiquement au retour de la connexion.
- **« Se déconnecter » verrouille le poste** : session et base locale conservées, synchronisation en
  arrière-plan (l'écran verrouillé affiche la filiale, le dernier utilisateur et la file d'envoi).
  Rien n'est jamais perdu.
- **N'importe quel utilisateur de la filiale déverrouille le poste, même hors ligne**, avec son mot de
  passe : vérifié par Supabase en ligne ; hors ligne, par l'empreinte PBKDF2 (300 000 itérations,
  jamais le mot de passe) que l'app publie dans `utilisateurs.empreinte_hors_ligne` à chaque
  connexion en ligne et que PowerSync diffuse aux postes de la filiale. Condition : l'utilisateur
  s'est connecté **en ligne au moins une fois** (sur n'importe quel poste) depuis cette version.
  Un compte désactivé (`est_actif`) est refusé même hors ligne.
- **Attribution** : chaque écriture porte l'`utilisateur_id` de celui qui travaille ; l'envoi au
  serveur est signé par la session du poste (dernier utilisateur connecté en ligne), et l'audit
  serveur attribue l'action à l'`utilisateur_id` de la ligne (repli sur la session).
- **Changer de périmètre** (utilisateur d'une autre filiale ; le directeur voit tout et est toujours
  accepté) exige le réseau et une file d'envoi vide : la base locale est alors remplacée.
- Sécurité : les empreintes de la filiale sont présentes sur chaque poste → mots de passe robustes
  et chiffrement disque des postes recommandés.

## État d'avancement

- **Phase 0 — fondations** : faite (structure, typage strict, connector PowerSync, auth, schéma Postgres, Sync Streams).
- **Phase 1 — métier local-first** : faite. Catalogue (articles, familles, dépôts, import Excel), Stock (entrées,
  sorties, transferts, inventaire, journal, alertes), Clients (créances, règlements), Point de vente (vente atomique,
  crédit, livraison, ticket), Ventes (journée, validation, annulation), Fournisseurs (achats réceptionnés, dettes,
  paiements), Trésorerie (caisses, opérations, transferts), Livraisons, Audit, Dashboard et Consolidation.
  Chaque écriture métier est une transaction SQLite locale rejouée vers Supabase ; les lectures sont temps réel.
- **Phase 2 — desktop prod** : à faire (CSP Tauri, impression thermique, plugins Rust, auto-update, signature,
  build Windows testé).
- **Phase 3 — pilotage avancé** : exports Excel, rapports périodiques, recherche accentuée.

### Production (module Stock)

Une production consomme des matières premières (sortie `SORTIE_PRODUCTION` au coût moyen du dépôt) et
fait entrer les articles produits (`ENTREE_PRODUCTION`) au **coût de revient** : coût total des matières
réparti au prorata de la valeur (prix d'achat de référence) ou des quantités, les pertes étant
supportées par les unités bonnes. Pièce `productions` + `lignes_production` (MATIERE / PRODUIT :
prévu, produit, pertes, coût), tout ou rien. Sections du module Stock = routes `/stock/<section>`
(sous-menu de la barre latérale).

### Fournisseurs

Sections (routes `/fournisseurs/<section>`, sous-menu latéral) : **Répertoire** (situation des comptes,
balance générale imprimable), **Nouveau fournisseur** (fiche à onglets : identification et contact,
conditions de règlement et de commande, banque, notes), **Compte fournisseur** (relevé : solde initial,
débits = factures/réceptions, crédits = règlements, solde cumulé ; imprimable), **Historique des
règlements** (filtres, totaux par mode, imprimable), **Bons de commande** (création avec remise/TVA,
bon imprimable, réception partielle ou totale au prix de commande → stock + dette, annulation tant que
rien n'est reçu) et **Relance fournisseur** (e-mail composé à partir des commandes en attente et de
l'avoir éventuel, ouvert dans la messagerie du poste via le plugin Tauri `opener`).
Les documents A4 passent par `DocumentImprimable` (aperçu plein écran, seule la zone d'impression sort).

### Clients

Sections (routes `/clients/<section>`, sous-menu latéral) : **Répertoire** (situation des comptes : solde
initial, facture, règlement, solde, disponibilité, plafond ; totaux ; tableau imprimable), **Nouveau
client** (fiche : groupe, civilité, n° compte, RC/CC, solde d'ouverture *dû* ou *avance* avec date d'effet,
remise appliquée d'office aux tickets, plafond, période de règlement, prises min/max), **Proforma à
facture** (devis sans stock ni caisse, imprimable, **facturé au point de vente** : le ticket est chargé
avec client et remise, la vente passe la proforma FACTUREE dans la même transaction), **Compte client**
(relevé : facture / règlement / disponibilité / solde cumulé, imprimable), **Historique des versements**
(*bon payé* = règlement d'une vente, *avance payée* = acompte ; lettrage FIFO apport / utilisé /
disponibilité par client ; reçu et historique imprimables) et **Relance clients** (débiteurs, e-mail
composé à partir des factures impayées et du retard selon la période de règlement).

### Employés

Sections (routes `/employes/<section>`, sous-menu latéral) : **Effectif** (liste, fiche, liste imprimable),
**Nouveau employé** (matricule auto `EMP-XXXXX`, identité, sexe, téléphone, fonction, dates, type de
contrat, salaire de base ou taux journalier, statut, **photo** réduite à 320 px et **contrat joint**
PDF/image ≤ 1 Mo — stockés en base sous forme de data URL pour rester disponibles hors ligne),
**Pointage** (présent / absent / justifié par jour, un seul pointage par employé et par jour, « tous
présents », feuille de présence du mois), **Paie / salaire** (génération du mois depuis les pointages :
1/26 du salaire retenu par absence non justifiée, journaliers payés aux jours présents ; primes et
retenues ; **avances sur salaire** sorties de caisse et retenues sur la paie ; paiement individuel ou
groupé en caisse, catégorie SALAIRE ; une paie payée n'est plus recalculée) et **Paiement de salaire**
(fiche d'émargement sans / avec montants, bulletins de paie).

## Backlog technique connu

- **Recherche accentuée** : `LIKE` SQLite n'est insensible à la casse que pour l'ASCII (« koné » ne trouve pas « KONÉ »).
  Prévu : colonne `cle_recherche` (minuscules sans accents) sur `articles`, `clients`, `fournisseurs`, calculée
  côté client à l'écriture et par trigger côté serveur, et utilisée par toutes les recherches.
- **Exports Excel** : les téléchargements navigateur (`<a download>`, blob) sont inertes dans la WebView de
  Tauri ; prévu en phase 2 via les plugins `dialog` + `fs` (enregistrer sous…).
