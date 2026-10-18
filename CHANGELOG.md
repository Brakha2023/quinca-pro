# Journal des modifications — QuincaPro

Ce que chaque livraison apporte, et ce qu'il faut faire sur le serveur avant de la mettre sur les
postes. Le plus récent en premier.

Le projet n'est pas encore versionné par étiquettes Git : les sections ci-dessous correspondent aux
**installeurs Windows réellement produits**. Au prochain installeur, pensez à passer
`apps/desktop/package.json` en `0.2.0` et à dater une section ici.

Conventions : **Ajouté** · **Modifié** · **Corrigé** · **Base de données** (à appliquer avant de
déployer les postes) · **Attention** (ce qui change pour les utilisateurs).

---

## À venir — pas encore dans un installeur

Six défauts d'architecture local-first relevés en audit, traités l'un après l'autre. Aucun n'était
visible à l'écran ; tous pouvaient faire perdre des données.

### Ajouté

- **Cumuls calculés par Postgres.** Le stock d'un dépôt, le solde d'une caisse, puis les comptes des
  clients et des fournisseurs sont désormais calculés par le serveur, par deltas tirés des journaux et
  des pièces. Deux postes hors ligne qui vendent le même article, ou au même client, s'additionnent au
  lieu de s'écraser. Le poste continue de tenir ses valeurs en local pour l'affichage immédiat, mais
  ne les envoie plus.
- **Un espace de numéros par poste.** Les numéros de pièces deviennent
  `PREFIXE-POSTE-AAAAMMJJ-XXXXXX` : un code tiré une fois par machine, et un suffixe de 6 caractères
  au lieu de 4. Risque qu'un numéro soit tiré deux fois : de ~76 % par an et par caisse à 0,14 %.
- **Écritures refusées mises de côté.** Un refus définitif du serveur (doublon, champ obligatoire,
  règle de sécurité) ne fait plus disparaître l'écriture en silence : elle est conservée sur le poste
  avec son motif en clair, le bandeau de synchronisation la signale, et un gérant décide — réessayer
  ou abandonner.
- **Contrôle de l'horloge du poste.** L'écart avec le serveur est mesuré sur le jeton signé par
  Supabase, à chaque connexion. Au-delà de 2 minutes, bandeau d'avertissement ; au-delà de 15 minutes,
  **la caisse ne s'ouvre pas** — un ticket mal daté ne se rattrape pas.
- **Contrôle d'accord avec le serveur au démarrage.** Les colonnes attendues sont sondées sur
  Supabase, les flux attendus lus dans l'état de synchronisation. Une migration oubliée est annoncée
  nommément (« `mouvements_stock` n'a pas la colonne `remise_percent` ») au lieu de bloquer la file
  d'envoi en silence.
- **Code du poste** visible dans Point de vente → Changer, à coller sur la machine.

### Corrigé

- **Impressions de listes : catalogue, journal des ventes, état du stock.** « Imprimer » envoyait la
  page entière à l'imprimante — menu latéral et barre d'outils compris — et la liste s'arrêtait à ce
  qui tenait dans la fenêtre : un catalogue de 104 articles sortait sur une seule feuille tronquée.
  Les trois écrans produisent désormais un document A4 à part, avec l'en-tête de la maison, le
  périmètre de la liste (filtres en vigueur), un récapitulatif, et un tableau qui se poursuit de page
  en page — entêtes de colonnes répétées en haut, identification répétée en bas.
  « Imprimer → Enregistrer au format PDF » donne un PDF propre, sans bibliothèque supplémentaire.

  Le **journal des ventes** porte le récapitulatif de caisse (chiffre d'affaires, encaissé ventilé par
  mode de paiement, vendu à crédit, en attente de validation, ventes annulées hors totaux) et un
  emplacement de visa. L'**état du stock** porte la valorisation au coût moyen, le compte des ruptures
  et des stocks faibles, et signale les quantités négatives à régulariser.

### Modifié

- **Le journal d'audit n'est plus synchronisé** sur les postes : il se consulte sur le serveur, en
  ligne. Seul écran de l'application à exiger le réseau, et il le dit quand il ne l'a pas.
- **L'activité ne descend plus que sur douze mois glissants**, sauf ce qui n'est pas soldé — vente non
  réglée, commande ouverte, livraison à faire, transfert en transit restent sur le poste quel que soit
  leur âge. Les écrans d'historique l'indiquent.
- Les codes de tiers (`CLI-`, `FOU-`, `EMP-`) passent de 5 à 6 caractères.

### Base de données

À appliquer **avant** de déployer les postes (les quatre premières l'ont été le 18/10/2026) :

| Migration | Ce qu'elle fait |
| --- | --- |
| `20260921000000_remise_ligne` | remise par ligne sur les entrées et les bons de commande |
| `20260922000000_cumuls_serveur` | stock et solde de caisse calculés par Postgres |
| `20260923000000_horodater_lignes_vente` | `created_at` sur `lignes_vente` (sans quoi son flux ne peut pas être borné) |
| `20260924000000_fenetre_historique` | colonne `dans_fenetre` + rafraîchissement quotidien (pg_cron) |
| `20260925000000_cumuls_tiers` | comptes clients et fournisseurs calculés par Postgres |

Puis, dans le dashboard PowerSync : coller `supabase/sync-streams.yaml` → **Validate** → **Deploy**.
Et vérifier que le rendez-vous quotidien `rafraichir_fenetre_historique()` existe (pg_cron), sans quoi
la fenêtre d'historique reste figée.

Outils : `supabase/outils/verifier_cumuls.sql` (lecture seule) compare les cumuls stockés aux journaux
et aux pièces ; `supabase/outils/reparer_cumuls.sql` les remet d'accord, hors heures d'ouverture.

### Attention

- Un poste dont l'horloge est fausse de plus d'un quart d'heure **ne peut plus vendre** tant qu'elle
  n'est pas réglée.
- Changer de filiale sur un poste est refusé tant qu'une écriture mise de côté attend une décision.

---

## 2026-10-12 — installeur Windows

### Ajouté

- **Catalogue** : import fidèle des exports Excel (`ETAT_LISTEARTICLE`), détection des en-têtes au
  lieu d'un décalage fixe, et fiche article imprimable (mouvements, indicateurs, code-barres).
- **Point de vente** : choix du format à l'impression — ticket 80 mm ou facture A4 — mémorisé par
  machine ; réédition de la facture depuis le module Ventes, mention « annulée » comprise.
- **Stock** : fournisseur renseignable sur une entrée ; bons de mouvement imprimables (entrée, sortie,
  transfert, inventaire) avec stock avant/après, code-barres et signatures.
- **Remise de ligne** à la saisie d'une entrée et d'un bon de commande, et **export Excel** des bons.

### Corrigé

- Une remise absente ou illisible produisait `NaN`, qui aurait empoisonné le coût moyen pondéré sans
  retour possible. Trois protections : champ borné à la frappe, schéma de validation, règle métier.
- Le champ de remise acceptait 150 % et préfixait les chiffres tapés d'un `0`.
- Le filtre par fournisseur du journal de stock ne faisait rien (dépendance oubliée dans un mémo).
- Fiche article : une boucle de requêtes sans fin sur la période affichée.
- La couverture en jours était calculée sur une vente quotidienne déjà arrondie.
- **Une file d'envoi bloquée par le serveur s'affichait « Synchronisé » en vert** pendant qu'elle
  grossissait. Le bandeau distingue maintenant hors ligne, synchronisé et envoi bloqué.

---

## 2026-10-09 — module Trésorerie

Sous-menu complet : versement, retrait, entrée, transferts entre caisses et entre filiales, dépense,
et journal de caisse avec reçus imprimables.

---

## 2026-09-18 — premier installeur Windows

- Compilation croisée NSIS via Docker (`apps/desktop/scripts/windows/build.sh`) et checklist de
  recette (`CHECKLIST-WINDOWS.md`).
- **Fournisseurs** : fiche à onglets, compte, historique, bons de commande, relance.
- **Clients** : fiche enrichie, proforma transformée en facture, compte, versements lettrés, relance.
- **Employés** : fiches (photo, contrat), pointage, paie, paiement.
- **Stock** : production (matières → produits, coût de revient).

---

## 2026-09-17 — le poste partagé

- **Verrouillage du poste** au lieu d'une déconnexion qui effaçait la base locale.
- **Déverrouillage hors ligne** par n'importe quel utilisateur de la filiale, grâce à une empreinte
  PBKDF2 synchronisée dans sa fiche (jamais le mot de passe).
- Confirmations applicatives : `window.confirm` est inerte dans la WebView Tauri.
- Totaux TTC arrondis au franc ; une livraison ne se réactive plus si la vente est annulée.

---

## 2026-09-16 — socle local-first (phases 0 et 1)

- Schéma Postgres, règles de synchronisation PowerSync (Sync Streams edition 3), types partagés.
- Périmètre par utilisateur (`acces_filiales`) : un gérant voit sa filiale, le directeur voit tout.
- Domaines portés sur PowerSync : Catalogue, Stock, Clients, Ventes, Fournisseurs, Trésorerie,
  Livraisons, Audit, Dashboard, Consolidation.
- Structure en couches (`core/` sans React → `infrastructure/` → `presentation/`), typage strict.
- Scénario e2e de synchronisation réelle Supabase/PowerSync.
