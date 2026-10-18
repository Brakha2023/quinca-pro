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
                                         # dont `revue` : toutes les requêtes SQL s'exécutent, tous les écrans se rendent
                                         # sur une base vide, et la vue consolidée est contrôlée en profil directeur
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
- **Phase 1 — métier local-first** : faite. Catalogue (articles, familles, dépôts, import d'un export Excel, fiche article imprimable), Stock (entrées,
  sorties, transferts, inventaire, journal, alertes), Clients (créances, règlements), Point de vente (vente atomique,
  crédit, livraison, ticket), Ventes (journée, validation, annulation), Fournisseurs (achats réceptionnés, dettes,
  paiements), Trésorerie (caisses, opérations, transferts), Livraisons, Audit, Dashboard et Consolidation.
  Chaque écriture métier est une transaction SQLite locale rejouée vers Supabase ; les lectures sont temps réel.
- **Phase 2 — desktop prod** : à faire (CSP Tauri, impression thermique, plugins Rust, auto-update, signature,
  build Windows testé).
- **Phase 3 — pilotage avancé** : exports Excel, rapports périodiques, recherche accentuée.

### Point de vente

Vente au comptoir ou à crédit (F2 recherche, F11 encaisse, F10 vide le panier), livraison optionnelle,
facturation d'une proforma. **Après chaque vente, la sortie papier se choisit** : *Ticket* 80 mm pour
l'imprimante thermique de caisse, ou *Facture A4* pour l'imprimante bureautique — cartouches facture
(n°, date, heure, opérateur de saisie) et client (RC, CC, adresse, contact), code-barres du numéro,
lignes en HT (code, désignation, quantité, prix unitaire, remise en montant, total, TVA, dépôt), cadre
cachet/signature, récapitulatif (payé, reste à payer, avoir / brut HT, remise, net HT, TVA, net à payer),
montant en toutes lettres et conditions de règlement cochées. Le format habituel du poste se règle dans
*Réglages du poste de vente* (il devient le bouton principal) ; l'autre reste à un clic.
La même facture se réédite depuis **Ventes → détail d'un ticket → Facture A4**, avec les montants
d'origine (jamais recalculés) ; une vente annulée ressort barrée d'un bandeau « FACTURE ANNULÉE ».

### Catalogue

Onglets **Articles**, **Familles**, **Dépôts**.

**Import d'un export de catalogue** (`.xls` ou `.xlsx`) : la ligne d'entêtes est repérée dans la feuille
— le nombre de lignes de titre varie d'un export à l'autre — puis chaque colonne est suivie par son nom
(`CODE`, `DESIGNATION`, `P. ACHAT`, `P. VENTE`, `FAMILLE`, et leurs synonymes courants), dans n'importe
quel ordre. Les entêtes répétés en tête de page et les lignes de totaux sont écartés, les familles
inconnues créées, les codes déjà présents **ignorés et non écrasés** (chaque rejet est motivé ligne par
ligne). Sans ligne d'entêtes, l'import est refusé plutôt que décalé.

**Fiche article** (bouton *Détail*, ou clic sur la désignation) : tarifs et marges (vente et VIP), stock
dépôt par dépôt avec coût moyen et valorisation, état du stock face aux seuils (rupture / sous le
minimum / surstock), activité commerciale sur 30 jours, 3 mois ou 12 mois (quantité vendue, chiffre
d'affaires, dernier prix pratiqué, écoulement moyen, couverture du stock) et derniers mouvements.
Le bouton *Imprimer la fiche* en sort un rapport A4 — identification, tarifs, stock par dépôt, ventes
mois par mois, mouvements, code-barres Code 39 de l'article.

### Bons de mouvement (module Stock)

Chaque mouvement enregistré produit une **pièce imprimable** : bon d'entrée (achat ou retour client),
bon de sortie (déstockage ou casse), bon de transfert entre dépôts, fiche d'inventaire, bon de
production. Le bouton *Imprimer le bon* apparaît dans l'écran de saisie juste après la validation, et
le journal des **Mouvements** permet de rééditer n'importe quelle pièce par sa référence. Le bon porte
l'entête (référence, date, opérateur, dépôt — les deux pour un transfert —, fournisseur, motif), les
lignes avec quantité signée, **stock avant et après**, coût unitaire et valeur, le total valorisé
quand les coûts sont renseignés, le code-barres de la référence et deux signatures. Un transfert
génère deux mouvements par article : le bon ne compte la ligne qu'une fois.

### Cumuls : qui calcule quoi

Le stock d'un dépôt et le solde d'une caisse sont **calculés par Postgres**, par application de deltas
tirés des journaux (`mouvements_stock`, `mouvements_tresorerie`), qui sont en ajout seul et donc
toujours exacts. Deux postes hors ligne qui vendent le même article arrivent dans n'importe quel ordre
et donnent le même résultat — alors qu'en envoyant chacun sa valeur absolue, le dernier arrivé écrasait
l'autre et sa vente disparaissait du stock.

Le poste continue de tenir ces valeurs dans sa base locale : l'écran réagit immédiatement et la vente
hors ligne contrôle le disponible. Mais il ne les **envoie** plus (`sansCumulsServeur`), et deux
déclencheurs de garde refusent toute valeur de cumul venue d'un poste — un poste resté sur une ancienne
version ne peut donc pas casser le calcul. La valeur du serveur redescend et remplace la projection locale.

**Les comptes des clients et des fournisseurs suivent la même règle**, avec une difficulté en plus :
ils ne dérivent pas d'un journal unique mais de pièces **dont le statut change** — une vente annulée
doit décrocher ce qu'elle avait accroché. Les déclencheurs réagissent donc à l'INSERT *et* à l'UPDATE,
et appliquent la différence entre l'ancienne et la nouvelle contribution de la pièce.

| Cumul | Ce qui l'alimente |
| --- | --- |
| `clients.cumul_factures` | `ventes.total_ttc`, hors ventes annulées |
| `clients.cumul_reglements` | `reglements_clients.montant`, moins ce qui avait été encaissé au comptoir sur une vente annulée |
| `fournisseurs.cumul_factures` | `commandes_fournisseurs.total_recu_ttc` — la valeur **reçue**, pas la commandée |
| `fournisseurs.cumul_reglements` | `reglements_fournisseurs.montant` |

`solde_initial` reste au poste : c'est une donnée de la fiche, pas un cumul. Le serveur le respecte et
recalcule `solde_actuel = solde_initial + factures − règlements` à chaque mouvement.

Deux outils accompagnent la bascule : `supabase/outils/verifier_cumuls.sql` compare les cumuls stockés
aux journaux et aux pièces (lecture seule), `supabase/outils/reparer_cumuls.sql` les remet d'accord.

### Numérotation des pièces hors ligne

Aucun compteur central n'est possible : un poste doit numéroter une vente sans réseau. Le numéro est
donc tiré au hasard, et sa seule protection est le nombre de tirages possibles — un doublon tombe sur
la contrainte `unique (filiale_id, numero)` du serveur et la pièce est refusée.

Le format est `PREFIXE-POSTE-AAAAMMJJ-XXXXXX`, par exemple `ENT-K7Q-20260922-M3Q2PT`, et porte deux
garde-fous qui se multiplient :

- **le code du poste**, tiré une fois par machine et mémorisé dans son stockage local (visible dans
  Point de vente → Changer) : deux postes ne tirent jamais dans le même espace de numéros ;
- **un suffixe de 6 caractères** au lieu de 4, soit 32⁶ ≈ 1,07 milliard de tirages par préfixe, par
  poste et par jour, contre 32⁴ ≈ 1 million auparavant.

À 100 pièces par jour et par caisse (300 jours ouvrés), le risque qu'un numéro soit tiré deux fois
passe ainsi d'environ **76 % par an** à **0,14 %** ; à 200 pièces par jour, de 99,7 % à 0,55 %. Et
deux postes qui tireraient par malchance le même code (3 caractères, moins de 0,02 % de risque à
quatre postes) retombent simplement sur le suffixe à 6 caractères, sans rien casser.

Les ventes prennent le code de leur caisse comme préfixe (`C01-K7Q-…`) ; toutes
les autres pièces prennent leur nature (`ENT`, `SOR`, `INV`, `BC`, `REG`, `VER`…). Les codes de tiers
(`CLI-`, `FOU-`, `EMP-`) passent de 5 à 6 caractères.

Les numéros déjà émis restent valides : rien ne relit leur format, et la colonne est en `text`.

### Quand le serveur refuse les écritures

Deux refus très différents, deux réponses :

**Refus réparable** — colonne absente parce qu'une migration n'a pas été appliquée, serveur
indisponible, réseau coupé. Rejouer finira par marcher, donc PowerSync rejoue. Rien n'est perdu, mais
rien ne remonte non plus, et la file se bloque **entièrement**, pas seulement l'opération fautive.

**Refus définitif** — numéro en doublon, ligne liée absente, champ obligatoire vide, règle de
sécurité (classes Postgres `22` et `23`, et `42501`). Rejouer ne corrigera jamais rien. L'écriture est
alors **mise de côté** dans une table locale `echecs_envoi`, avec son contenu, le message du serveur et
une explication en clair : la file repart, rien n'est perdu, et un gérant décide — *Réessayer* (après
correction côté serveur) ou *Abandonner*. Avant, elle était abandonnée en silence, avec une seule
trace dans la console du navigateur que personne ne lit.

Le bandeau de synchronisation couvre donc : *Hors ligne* (normal, le poste travaille et accumule),
*Synchronisé*, ***Envoi bloqué · N en attente*** (connecté, mais le serveur refuse tout) et
***N écriture(s) mise(s) de côté***, **cliquable** — elle ouvre la liste, le motif, les données et les
deux décisions. Changer de filiale sur ce poste reste refusé tant qu'une écriture attend une décision :
remplacer la base locale les effacerait.

Un détail à connaître pour qui touche à cet écran : PowerSync ne notifie pas les changements d'une
table **locale** (vérifié sur `@powersync/web` 2.3.1), donc un `useQuery` ne se rafraîchirait jamais.
Le dépôt prévient les écrans lui-même, et `useEchecsEnvoi` s'y abonne.

### Ce que le poste télécharge, et ce qu'il laisse au serveur

Chaque poste recevait toute l'activité depuis l'ouverture, pour toujours. Deux corrections, dans
`supabase/sync-streams.yaml` :

**`audit_log` n'est plus synchronisé.** C'est un journal de surveillance écrit par Postgres, qui
recopie la ligne entière à chaque écriture métier — il pesait donc à lui seul une bonne part de la
base locale, pour un écran consulté une fois par mois. La page Audit l'interroge maintenant
directement sur le serveur (`useJournalAudit`) : c'est le seul écran de l'application qui exige le
réseau, et il le dit clairement quand il ne l'a pas. Un journal de surveillance n'a de toute façon
rien à faire sur la machine qu'il surveille.

**L'activité est bornée à douze mois.** Une règle de synchronisation ne peut pas comparer une date à
« il y a douze mois » : elle doit être déterministe (pas de `now()`), et un paramètre envoyé par le
poste ne supporte que l'**égalité** — ni `>=`, ni fonction autour. Une ligne ne peut donc pas quitter
un flux en vieillissant toute seule.

C'est le serveur qui marque les lignes, et le flux se contente d'un `dans_fenetre = true`, qui est
une égalité ([méthode documentée par PowerSync](https://docs.powersync.com/sync/advanced/sync-data-by-time)).
`rafraichir_fenetre_historique()` (migration `20260924000000`) tourne une fois par jour via pg_cron
et n'écrit **que les lignes qui changent d'état** : une poignée par jour, pas une réécriture générale
qui ferait tout retélécharger aux postes.

Ce qui **n'est pas** borné : le référentiel (il ne grossit pas avec le temps) et tout ce qui n'est pas
soldé — vente non soldée, commande fournisseur ouverte, livraison à faire, transfert en transit
restent sur le poste quel que soit leur âge. Sans cela, la borne ferait disparaître la pièce en
laissant la créance au compte du client. Les écrans qui listent un historique le disent
(`NoteHistorique`).

La bascule de fenêtre n'est pas un événement métier : `audit_trigger()` ignore une mise à jour qui ne
touche que `dans_fenetre`, sinon le ménage quotidien remplirait le journal de surveillance.

Deux migrations sont nécessaires avant de déployer le YAML : `20260923000000_horodater_lignes_vente`
(c'était la seule table d'activité sans date, et la plus volumineuse — donc la seule impossible à
borner) et `20260924000000_fenetre_historique`. Tant qu'elles ne sont pas passées, le YAML référence
une colonne absente et le dashboard le refusera. L'application, elle, se déploie quand on veut : elle
ne demande rien au serveur sur ce point.

### Le poste et le serveur parlent-ils des mêmes données ?

Le poste écrit dans sa base locale selon le schéma qu'il connaît. Si le serveur n'a pas la même idée
— une migration pas encore appliquée, une colonne renommée — l'écriture part, se fait refuser, et la
file se bloque : l'application a l'air de fonctionner et plus rien ne remonte. C'est exactement ce
qui s'est produit avec `remise_percent`.

Au démarrage, une fois connecté, le poste vérifie les deux côtés :

**Les colonnes**, sondées sur Supabase. Le document OpenAPI de PostgREST aurait tout dit d'un coup,
mais Supabase le réserve à la clé `service_role`, que l'application n'a pas et ne doit pas avoir
(vérifié : `Only the service_role API key can be used for this endpoint`). On demande donc à chaque
table les colonnes qu'on attend d'elle, **sans résultat** (`head`, `limit=0`) : PostgREST valide la
liste avant d'exécuter quoi que ce soit et refuse en nommant ce qui manque — `42703` pour une colonne,
`PGRST205` pour une table. Vingt-neuf requêtes sans corps, une fois par session.

**Les flux**, lus dans l'état de synchronisation PowerSync, qui les porte déjà (`status.syncStreams`) :
si le YAML déployé ne sert pas `referentiel` ou `activite`, le poste travaille sur des données
incomplètes sans le savoir. La comparaison n'a lieu qu'après la première synchronisation, sinon la
liste est vide et tout paraîtrait manquant.

Un désaccord s'affiche en bandeau, nommément (« `mouvements_stock` n'a pas la colonne
`remise_percent` sur le serveur »), avec la cause probable et ce qu'il adviendra des écritures
concernées — refusées, puis mises de côté sur le poste. Rien n'est bloqué : le poste doit pouvoir
continuer à vendre. Hors ligne, aucune sonde n'est tentée et le dernier désaccord connu **reste
affiché** : ce n'est pas le réseau qui l'a créé.

### L'heure du poste

Toutes les dates de l'application viennent de `new Date()` sur la machine : le poste doit pouvoir
vendre sans réseau. Une machine à l'heure fausse produit donc des tickets, des mouvements de stock et
une journée de caisse horodatés faux — et rien ne les refuse, ils s'intercalent simplement au mauvais
endroit dans l'histoire.

L'écart est mesuré sur le **jeton** que Supabase signe : son champ `iat` porte l'heure du serveur, et
un jeton arrive à chaque connexion et à chaque renouvellement (environ toutes les heures). Aucun appel
supplémentaire. L'en-tête `Date` des réponses REST aurait été plus direct, mais il n'est **pas lisible
depuis un navigateur** : il n'est pas dans la liste blanche CORS et Supabase ne l'expose pas
(`access-control-expose-headers` ne le contient pas — vérifié sur le projet). Le jeton, lui, est dans
le corps de la réponse.

| Écart | Ce qui se passe |
| --- | --- |
| < 2 min | rien : l'écart ne change rien de lisible sur une pièce |
| ≥ 2 min | bandeau d'avertissement sur tous les écrans, avec le sens, l'ampleur et le geste à faire |
| ≥ 15 min | **la caisse ne s'ouvre pas** : le point de vente affiche le motif au lieu du ticket |

La mesure est conservée sur la machine : une horloge fausse le reste après extinction, et un poste
hors ligne doit continuer d'être averti. Le bouton « J'ai réglé l'horloge » efface la mesure et rouvre
la caisse — mais le prochain jeton tranche, et referme en quelques secondes si l'heure est toujours
fausse. Les autres écrans restent utilisables même au-delà du seuil : ils horodatent faux eux aussi,
le bandeau le dit, mais bloquer tout le poste ferait plus de dégâts que la dérive.

### Remises de ligne et export Excel

L'**entrée en stock** et le **bon de commande fournisseur** acceptent une remise article par article,
saisie au moment de choisir les produits. Sur une entrée, le stock est valorisé au **coût net** (c'est
lui qui alimente le coût moyen pondéré) et la remise accordée reste inscrite sur le mouvement pour
pouvoir être justifiée ; le bon imprimé l'affiche. Sur un bon de commande, les remises de ligne
s'appliquent **avant** la remise globale du bon — l'ordre inverse accorderait deux fois la même
réduction — et la réception entre en stock au coût net des deux remises, TVA comprise.

Les deux écrans exportent les lignes saisies en **classeur Excel** (`.xlsx`). Sous Tauri, la boîte
d'enregistrement du système choisit l'emplacement (plugins `dialog` et `fs`) : les téléchargements du
navigateur ne fonctionnent pas dans la WebView. Hors Tauri, l'export retombe sur un téléchargement
classique.

### Entrées en stock

Une entrée d'achat porte son **fournisseur** (colonne `mouvements_stock.fournisseur_id`) : le journal
des mouvements l'affiche et se filtre par fournisseur. Le champ est facultatif et disparaît sur un
retour client, qui ne vient d'aucun fournisseur. **Il n'engage aucune dette** : une dette fournisseur
naît d'un bon de commande réceptionné (module Fournisseurs), pas d'une entrée libre.

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

### Trésorerie

Sections (routes `/tresorerie/<section>`, sous-menu latéral) :

- **Liste des caisses** : cartes des caisses avec leur solde, création / modification / désactivation
  (une caisse non vide ne se désactive pas), puis **mouvement de caisse** filtré par caisse et par
  période — **solde d'ouverture** (déduit du solde actuel en remontant les mouvements de la période),
  recettes, dépenses, **solde de clôture** et **solde actuel**, journal chronologique avec solde courant
  après chaque opération, et **journal de caisse imprimable** (A4, période, soldes, totaux, double
  signature).
- **Versement** : encaissement au guichet. Si le remettant est un client en compte, le versement passe
  par son compte (créance et cumuls mis à jour, comme dans le module Clients) ; sinon c'est une recette
  de caisse `VERSEMENT`. Reçu imprimé aussitôt.
- **Retrait** : sortie d'espèces au profit d'un bénéficiaire nommé (`RETRAIT`). Au-delà du solde, une
  confirmation prévient que la caisse passera en négatif.
- **Entrée en caisse** : apport, remboursement ou autre recette, avec déposant et pièce justificative.
- **Transfert inter caisse** : entre deux caisses de la filiale, une sortie et une entrée portant la
  même référence.
- **Transfert inter filiale** : les fonds sortent de la caisse de départ dès l'envoi et le transfert
  reste **en transit** ; la filiale destinataire l'**encaisse** à l'arrivée dans la caisse de son choix.
  L'expéditeur peut l'**annuler** tant qu'il n'est pas arrivé (la caisse source est recréditée, le motif
  d'origine est conservé). La ligne est visible des deux côtés (`transferts_filiales`).
- **Dépense** : catégories de dépense, bénéficiaire, référence, pièce de dépense imprimable.

Le **reçu de caisse** (versement, retrait, entrée, dépense) reprend le modèle du reçu QCF : cartouche du
tiers, date, code reçu, montant encadré en FCFA, désignation, observation, double signature et opérateur.
Il ajoute le **montant en toutes lettres** (ce qui fait foi en cas de rature) et un **code-barres Code 39**
de la pièce, dessiné en SVG sans police ni bibliothèque.

## Backlog technique connu

- **Recherche accentuée** : `LIKE` SQLite n'est insensible à la casse que pour l'ASCII (« koné » ne trouve pas « KONÉ »).
  Prévu : colonne `cle_recherche` (minuscules sans accents) sur `articles`, `clients`, `fournisseurs`, calculée
  côté client à l'écriture et par trigger côté serveur, et utilisée par toutes les recherches.
- **Exports Excel** : les téléchargements navigateur (`<a download>`, blob) sont inertes dans la WebView de
  Tauri ; prévu en phase 2 via les plugins `dialog` + `fs` (enregistrer sous…).
