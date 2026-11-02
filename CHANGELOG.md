# Journal des modifications — QuincaPro

Ce que chaque livraison apporte, et ce qu'il faut faire sur le serveur avant de la mettre sur les
postes. Le plus récent en premier.

Le projet n'est pas encore versionné par étiquettes Git : les sections ci-dessous correspondent aux
**installeurs Windows réellement produits**. À chaque installeur, monter la version dans
`apps/desktop/package.json`, `src-tauri/tauri.conf.json` et `src-tauri/Cargo.toml` — la page de
connexion affiche ce numéro —, puis dater une section ici.

Conventions : **Ajouté** · **Modifié** · **Corrigé** · **Base de données** (à appliquer avant de
déployer les postes) · **Attention** (ce qui change pour les utilisateurs).

---

## 0.4.0 — 29 octobre 2026

Le comptoir, revu là où il coûtait du temps : la remise, la saisie des montants, et les clients
qu'on fait patienter. Puis le magasin, où l'on ne retrouvait pas ses bons.

### Modifié

- **La remise se donne en francs, sur la vente entière.** Plus de pourcentage, et plus de remise
  article par article : c'est ainsi qu'elle se négocie au comptoir — « je te fais 5 000 » — et le
  caissier n'a plus à ventiler à la main ce qu'il vient d'accorder d'un mot. Une remise plus grande
  que le ticket est ramenée au total : on ne rend pas d'argent sur une vente.
- **Le taux négocié d'un client reste**, mais converti : il propose un montant, recalculé à chaque
  article ajouté, jusqu'à ce que le caissier écrive le sien — qui tient alors.
- **La colonne `ventes.total_remise` porte désormais la remise toutes taxes**, celle que le client
  lit sur son ticket, au lieu de son équivalent hors taxes. Les deux se confondent quand la TVA est
  nulle ; les ventes déjà enregistrées ne sont pas retouchées.
- **Les proformas gardent leur taux** — un devis annonce une condition commerciale — et la
  conversion en francs se fait à la reprise au point de vente.

### Ajouté

- **Une entrée d'achat porte la marchandise au compte du fournisseur.** Quand un fournisseur est
  désigné dans *Stock → Entrée*, la validation crée la pièce d'achat correspondante (réceptionnée,
  restant à payer) et la dette apparaît aussitôt sur son compte, à son relevé et dans la liste des
  règlements à faire — la marchandise reçue est la marchandise due. Le bon d'entrée et la pièce
  fournisseur portent **le même numéro** ; si ce numéro est déjà pris, la pièce reçoit le sien et
  cite le bon d'entrée en note. Une entrée sans fournisseur, comme un retour client, n'engage
  toujours rien. Un achat à ventiler (TVA, acompte) se saisit comme avant dans
  *Fournisseurs → Achat*.
- **La remise d'une entrée se donne en francs, sur le bon entier.** « Je vous fais 15 000 sur le
  tout » : c'est ainsi qu'elle se négocie avec un fournisseur. Le rabais est redescendu sur les
  lignes **au prorata de leur valeur** — le coût moyen du dépôt se calcule article par article —
  et la somme des parts égale toujours la remise accordée, au franc près. Le pied de la saisie et
  le bon imprimé affichent le brut, la remise et le net ; une remise plus grosse que le bon est
  refusée, elle donnerait un coût d'achat négatif. La **remise de ligne en pourcentage disparaît**
  de l'écran d'entrée (elle restait sans effet dans *Fournisseurs → Achat*) ; les bons déjà
  enregistrés continuent de s'imprimer avec la leur.
- **La date et l'heure de livraison se saisissent.** La marchandise arrive souvent la veille au
  soir et n'est saisie que le lendemain : l'entrée accepte désormais l'arrivée réelle, qui s'écrit
  sur le bon (« Livré le »), se lit dans sa colonne de l'historique des entrées et date la pièce
  portée au compte du fournisseur. Laissée vide, c'est l'heure de la saisie qui fait foi, comme
  avant.
- **Chaque écran de stock montre ses propres bons.** *Entrée*, *Sortie / Casse*, *Transfert entre
  dépôts*, *Transfert entre filiales* et *Inventaire* gagnent la bascule **Saisie / Historique**
  que *Production* avait déjà. L'historique liste une ligne par **bon** — la pièce qui a été signée,
  pas le mouvement article par article — avec sa date, son dépôt, ses articles, sa valeur et qui
  l'a saisi ; l'icône d'imprimante le réédite tel quel. On filtre par période, par dépôt, ou en
  cherchant un numéro, un article ou un motif : un bon dont une seule ligne répond reste affiché
  entier, avec tous ses totaux. Un transfert n'est compté qu'une fois bien qu'il écrive deux
  mouvements par article, et un inventaire affiche l'**écart net** signé plutôt qu'une quantité.
  Le journal complet, toutes natures mêlées, reste l'onglet *Mouvements*. Aucune migration.
- **Ventes en brouillon, partagées entre les caisses.** La touche F9 met le ticket de côté et
  libère le comptoir pour le client suivant ; la liste des tickets en attente les rend avec leur
  remise. Commencé à la caisse 1, un ticket se reprend à la caisse 2 : la liste dit d'où il vient
  et qui l'a mis de côté. Rien n'est vendu, rien ne sort du stock, aucun numéro n'est tiré — un
  brouillon n'entre dans aucun chiffre.
- **Saisie des montants groupée par milliers.** Remise et montant reçu : « 1250000 » s'affiche
  **1 250 000** pendant la frappe. Un zéro de trop se voit tout de suite au lieu de se découvrir au
  comptage du soir.
- **Retrouver un ticket par son montant.** L'écran *Ventes* gagne un champ *Montant TTC* : un
  client ne retient pas un numéro de ticket, mais il retient ce qu'il a payé. Le montant retenu
  s'écrit sur le journal imprimé.
- **Corriger un ticket en attente** (Ventes → ouvrir le ticket → *Corriger*) : quantités, articles,
  remise, client, règlement. Le numéro, la date et la caisse ne changent pas — c'est le même ticket,
  pas une vente de plus. La marchandise revient en stock et en ressort, l'encaissement est repris
  puis refait, le compte du client suit : tout se lit dans les journaux, une correction ne s'efface
  pas. Une vente **validée** ne se corrige plus, elle s'annule.
- **Le code du gérant, pour annuler une vente.** L'annulation demande désormais un code de six
  caractères en plus du motif, dicté au comptoir par le gérant. Il appartient à la filiale, se règle
  dans **Paramètres → Sécurité**, n'est jamais enregistré en clair, et se vérifie sur le poste même
  sans réseau.
- **Le caissier choisit ce qu'il imprime, à la fin de la vente** : *facture ×2 + bon de livraison*,
  *facture ×2*, ou *ticket 80 mm*. Les deux exemplaires sont réellement envoyés à l'imprimante —
  rien à régler dans la fenêtre du système — et chacun dit à qui il revient, *Exemplaire client* et
  *Exemplaire maison*. Le choix proposé d'office suit le réglage du poste ; si une livraison a été
  demandée au comptoir, c'est la liasse avec le bon qui est proposée.
- **Le bon de livraison s'imprime enfin.** Il accompagne la marchandise et ne porte aucun prix :
  code, désignation, quantité, unité, dépôt, le numéro de la facture, et deux emplacements de
  signature — le magasinier et le client, qui reconnaît avoir reçu en bon état. Quand une livraison
  a été créée avec la vente, le bon porte son numéro, l'adresse, la date prévue, le chauffeur et le
  véhicule. Son logo et son filigrane se règlent comme les autres pièces, dans
  Paramètres → Documents & impressions.
- **Un article jamais utilisé se supprime** (Catalogue, la corbeille) : faute de frappe, doublon,
  ligne d'import malheureuse. Dès qu'une ligne de vente, un mouvement de stock, une commande, un
  devis, un brouillon ou du stock dans un dépôt le nomme, la suppression est refusée et le message
  dit ce qui le retient — « Désactiver » reste là pour ce cas, et n'efface rien de son histoire.
  La vérification passe par le serveur : le poste ne garde que douze mois d'activité, il ne peut
  pas prouver seul qu'un article n'a jamais servi. Hors ligne, l'application le dit au lieu
  d'effacer. Aucune migration.

### Modifié — menu Stock

- **Le menu Stock s'ouvre sur les alertes.** *Alertes* passe en tête du sous-menu et devient
  l'écran d'accueil de `Stock` : ce qui manque se voit avant qu'on saisisse quoi que ce soit. Les
  autres sous-écrans gardent leur ordre et leur adresse — `#/stock/suivi` reste `#/stock/suivi`.
- **La liste des transferts inter-filiales est passée derrière *Historique***, dans l'onglet
  *Transfert entre filiales*. C'est de là que se fait toujours une réception : un clic de plus
  qu'avant.

### Attention

- **Aucune vente ne peut être annulée tant que le gérant n'a pas posé le code d'annulation de sa
  filiale** (Paramètres → Sécurité). C'est le premier geste après la mise à jour : sans lui, une
  vente saisie par erreur ne se rattrape que par une correction, et pas du tout si elle est validée.

### Base de données

- Appliquer `supabase/migrations/20261102000000_entree_remise_globale_livraison.sql` (deux colonnes
  sur `mouvements_stock` : `remise_montant`, la part de la remise du bon portée par la ligne, et
  `date_livraison`, l'arrivée réelle de la marchandise). Les règles de synchronisation n'ont pas à
  être redéployées : le flux lit `SELECT * FROM mouvements_stock`.
- Appliquer `supabase/migrations/20261030000000_code_annulation.sql` (une colonne
  `parametres_filiale.code_annulation`, qui ne garde qu'une empreinte PBKDF2 du code — jamais le
  code lui-même). Les règles de synchronisation n'ont pas à être redéployées : le flux lit
  `SELECT * FROM parametres_filiale` et la publication PowerSync porte la nouvelle colonne d'office.
- Appliquer `supabase/migrations/20261029000000_ventes_brouillons.sql` (table `ventes_brouillons`,
  une ligne par ticket mis de côté, portée par la filiale).
- **Redéployer les règles de synchronisation** (PowerSync → Sync Streams → Deploy) : sans cela un
  brouillon restera sur la machine qui l'a pris, sans message d'erreur — c'est exactement ce qu'on
  cherchait à corriger.
- Les brouillons ont leur **table** et non un statut sur `ventes` : un statut serait entré dans
  toutes les requêtes qui disent `statut <> 'ANNULEE'` (chiffre d'affaires, marge, encaissé,
  impayés, cumuls du compte client calculés par trigger), et une seule oubliée gonflait le chiffre
  d'affaires en silence.

---

## 0.3.1 — 28 octobre 2026

Ce qui bouge entre les filiales se voit au tableau de bord, marchandise comprise.

### Ajouté

- **La marchandise en route au tableau de bord.** Un transfert de stock entre filiales sort la
  marchandise d'un dépôt sans la faire entrer dans un autre : la valeur du stock ne la compte plus.
  La tuile l'annonce sous le montant (« + 1 250 000 F en route, dans aucun dépôt »), le bandeau de
  vigilance réclame la confirmation de réception, et la filiale destinataire lit « à recevoir »
  avec « à faire entrer en stock ». Même règle que pour les espèces : au groupe, un bon n'est
  annoncé qu'une fois, du côté du départ.
- **Les bons de livraison en cours au bandeau de vigilance.** Ceux qui restent à préparer ou qui
  sont partis chez le client, à côté de ceux qui sont en retard : un engagement pris se suit, même
  quand il n'est pas encore en faute.
- La feuille A4 et l'export Excel du tableau de bord reprennent les quatre colonnes.

---

## 0.3.0 — 26 octobre 2026

L'identité de la maison se règle depuis l'application, et l'argent qui voyage entre filiales
cesse d'être invisible : il figure au tableau de bord des deux côtés, et il part avec une pièce
signée.

### Ajouté

- **Paramètres « Entreprise », filiale par filiale.** Sept sections : identité (raison sociale,
  forme juridique, RCCM, n° CC, compte contribuable), coordonnées, logos et filigrane, fiscalité
  (assujettissement à la TVA, taux, prix saisis TTC ou HT, devise, mentions légales), formats de
  documents par nature de pièce, préfixes de numérotation, rôles, utilisateurs et préférences du
  poste. Les **vingt-sept documents A4** de l'application prennent leur en-tête ici : l'identité de
  la maison se règle une fois.
- **Les fonds en route au tableau de bord.** Des espèces parties d'une caisse et pas encore
  encaissées ailleurs ne sont dans aucune caisse. La tuile Trésorerie les annonce sous le montant
  (« + 300 000 F en route, pas encore en caisse ») sans jamais les y ajouter, et le bandeau de
  vigilance réclame la confirmation de réception.
- **La filiale destinataire voit ce qui lui arrive.** Elle lit « 300 000 F à recevoir » et
  « à encaisser à la réception ». Les deux colonnes décrivent le même billet vu des deux bouts :
  elles ne s'additionnent jamais, et en vue groupe un bon n'est annoncé qu'une fois.
- **Bordereau de transfert de fonds.** La pièce qui voyage avec l'argent : montant en chiffres et en
  toutes lettres, porteur à nommer à la main, et **deux cachets signés du gérant ou du directeur**
  — l'un autorise la sortie des fonds, l'autre reconnaît avoir reçu la somme. Un transfert annulé
  s'imprime pour le classement, barré d'un « ne vaut pas remise de fonds » et sans case à signer.
- **Drapeaux sur la page de connexion**, dessinés en SVG : Windows n'a pas les glyphes d'émoji
  correspondants et afficherait « CI ».
- **Guide de l'utilisateur**, seize chapitres en A4, livré en PDF à côté de l'installeur.
- **`supabase/outils/reinitialiser_essais.sql`** : vide les données saisies et pose trois comptes
  d'essai, en gardant la charpente (filiales, dépôts, caisses, familles, rôles, fiches d'entreprise).

### Corrigé

- **Le directeur arrivait sur une page vide.** En vue consolidée, le tableau de bord n'avait aucune
  filiale à montrer ; il mène maintenant à la consolidation.
- **Le périmètre ne commandait pas l'écran.** Changer de filiale dans le sélecteur ne changeait ni
  la consolidation ni le tableau de bord.
- **La maison mère était introuvable dans le sélecteur.** Elle n'est pas une holding : c'est la
  filiale où siège la direction, et elle vend comme les autres.
- **Un formulaire perdait la saisie en cours** quand une mise à jour arrivait par la
  synchronisation.

### Base de données

- Appliquer `supabase/migrations/20261025000000_configuration_entreprise.sql` (table
  `parametres_filiale`, une fiche par filiale, permission `parametres.entreprise`).
- **Redéployer les règles de synchronisation** (PowerSync → Sync Streams → Deploy) : sans cela les
  postes n'auront pas la fiche, et l'écran Paramètres le dira.

### Attention

- Les documents imprimés prennent l'en-tête de la fiche d'entreprise. Tant qu'elle n'est pas
  remplie, ils sortent avec le nom de la filiale et ses initiales — complétez
  **Paramètres → Entreprise** avant de faire circuler des pièces.

---

## 0.2.0 — 20 octobre 2026

Six défauts d'architecture local-first relevés en audit, traités l'un après l'autre. Aucun n'était
visible à l'écran ; tous pouvaient faire perdre des données.

### Ajouté

- **Tableau de bord du gérant et du directeur.** Le même écran pour deux périmètres —
  une filiale, ou le groupe entier —, commandé par une période unique (aujourd'hui,
  7 jours, ce mois, 12 mois) avec l'évolution par rapport à la période précédente de
  même durée. Huit chiffres : chiffre d'affaires, **marge commerciale**, **résultat
  estimé**, trésorerie, créances, dettes fournisseurs, valeur du stock et bons de
  livraison en attente — plus un bandeau de ce qui réclame une décision. Quatre
  graphiques : chiffre d'affaires et marge barre par barre, état du stock (rupture,
  dormant, sous le minimum, actif), chiffre d'affaires par famille et par client,
  ancienneté des impayés. Le tout s'imprime en A4, et la vue groupe s'exporte en Excel.
- **Rôles et permissions (module Paramètres).** Les droits ne se déduisent plus du profil : on crée un
  rôle depuis l'application (« Chef de rayon », « Contrôleur de gestion »…), on coche ses permissions
  module par module, et on l'affecte à un compte. Le menu ne montre que ce que le rôle ouvre, et une
  URL tapée à la main est refusée avec son motif. Cinq rôles sont livrés (superadministrateur,
  directeur général, gérant de filiale, caissier, magasinier) ; les comptes existants reçoivent celui
  qui correspond à leur profil. Le tableau des droits et la liste des comptes s'impriment en A4 avec
  deux visas et s'exportent en Excel.
- **Compte superadministrateur livré.** `superadmin@cisse-freres.ci` / `SuperAdmin@2026` — mot de passe
  public, que l'application exige de changer à la première connexion avant de laisser faire quoi que ce
  soit d'autre.
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

### Ajouté

- **Alertes de stock : filtres, impression et export Excel.** Le sous-menu Stock → Alertes se filtre
  par nature (ruptures, stocks faibles, ou les deux), par dépôt, par famille et par recherche. Le
  bouton *Imprimer / PDF* sort un document A4 du périmètre retenu — la liste de commande, avec pour
  chaque article la quantité à commander et son coût estimé, le total à engager, et un visa du gérant.
  *Exporter Excel* produit le même périmètre en classeur.

  La quantité à commander vise le stock maximum quand il est renseigné, sinon deux fois le minimum ; un
  stock négatif creuse la commande d'autant au lieu d'être ignoré. Le document signale aussi les
  articles **sans seuil**, qui ne déclencheront jamais d'alerte.

  Filtrer par dépôt ne fait plus disparaître un article absent de ce dépôt : il y figure en rupture,
  ce qui est précisément l'information recherchée.

- **Menu Historiques.** Les pièces déjà passées sont réunies sous un même menu : ventes, commandes
  fournisseurs, entrées en stock (achat), transferts inter-dépôt, productions, déstockages et casses,
  inventaires. Chaque section donne la même chose — une liste de pièces filtrée par période, par dépôt
  et par recherche, le total en bas, *Imprimer / PDF* et *Exporter Excel* — et rouvre la pièce
  d'origine d'un clic pour la rééditer.

  Les écrans de saisie n'ont pas bougé : l'historique relit, il ne saisit pas.

- **Les sorties de stock gardent leur valeur.** Un transfert, un déstockage ou une casse n'enregistrait
  aucun coût : le bon ne disait pas ce qu'il avait coûté, et le coût moyen d'aujourd'hui ne le dirait
  plus jamais exactement. Chaque sortie retient désormais le coût moyen du dépôt au moment où elle
  part — une casse de trois sacs se chiffre enfin.

- **Facture d'achat fournisseur.** Un achat réceptionné produit désormais sa facture A4 : n° et
  code-barres, date et heure, opérateur, dépôt, nature de la pièce, cartouche fournisseur (RC, CC,
  adresse, contact), lignes valorisées, totaux (brut HT, remise, net HT, TVA, net à payer), **net à
  payer en toutes lettres** et conditions de règlement à cocher. Elle s'imprime aussitôt la saisie
  validée, et se réédite depuis la fiche du fournisseur ou depuis les bons de commande.

  Elle ne porte que la marchandise **reçue** : une commande livrée à moitié ne se facture pas en
  entier, et le document annonce la réception partielle.

- **Liste des caisses : tableau, filtres, impression et export Excel.** Les cartes ne tenaient plus
  dès qu'une maison a dix ou quinze caisses. Trésorerie → Liste des caisses est désormais un **état des
  caisses** : une ligne par caisse avec solde d'ouverture, entrées, sorties, solde de clôture et solde
  du jour, le total en bas, et des filtres (recherche, caisses actives / fermées / mouvementées /
  soldes négatifs, période). *Imprimer / PDF* sort l'état A4 du périmètre retenu, *Exporter Excel* le
  même périmètre ; le journal de caisse s'exporte aussi en classeur.

  Sur une période passée, le solde du jour et le solde de clôture ne disent pas la même chose : les
  deux colonnes sont là, et l'écart se lit.

- **Transfert de stock entre filiales.** Nouveau sous-menu Stock → *Transfert entre filiales* : la
  marchandise sort du dépôt de départ dès l'envoi et le bon reste **en transit** ; la filiale
  destinataire la fait entrer dans le dépôt de son choix à l'arrivée. L'expéditeur peut annuler tant
  que rien n'est arrivé (la marchandise rentre au dépôt de départ). Le bon est visible des deux côtés.

  Le **bon de transfert A4** s'imprime à tout moment depuis l'historique : numéro et code-barres,
  expéditeur et destinataire avec leurs dépôts, transporteur, lignes valorisées au coût du dépôt de
  départ, total, et **un cachet pour chaque filiale**. L'historique se filtre par période, par sens
  (envois / réceptions), par filiale et par statut, et s'exporte en Excel.

  Les catalogues étant propres à chaque filiale, c'est le **code article** qui fait le lien : à la
  réception, un article inconnu de la filiale destinataire est créé avec le prix de vente de
  l'expéditeur — la marchandise est déjà dans la cour, elle ne peut pas être refusée — et l'écran
  annonce nommément les créations à vérifier.

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
- La **marge** n'était calculée nulle part : elle l'est désormais à partir du coût
  d'achat que chaque sortie de vente garde depuis la livraison précédente. Les pièces
  enregistrées avant cette règle retombent sur le coût moyen actuel du dépôt, faute de
  mieux, et les écrans le disent.
- Les trois vérifications écrites en dur dans l'interface — valider une vente, vendre malgré un stock
  insuffisant, décider du sort d'une écriture refusée — deviennent des permissions (`ventes.valider`,
  `ventes.forcer_stock`, `sync.decider`) : elles se retirent ou s'accordent rôle par rôle.
- **Page de connexion.** La mention « Architecture PowerSync · Local-First » laisse la place aux
  drapeaux des pays où la maison et ses fournisseurs travaillent. Le numéro de version affiché vient
  désormais du manifeste : il ne peut plus mentir.

### Corrigé

- **Un poste dont les rôles n'étaient pas encore arrivés se retrouvait vide** — menu compris, pour le
  superadministrateur comme pour les autres. Les rôles se synchronisent comme le reste et peuvent
  arriver après le premier démarrage ; faute de mieux, le poste retombe désormais sur les permissions
  de son profil et un bandeau dit laquelle des deux situations c'est (rôles pas encore descendus, ou
  aucun rôle affecté). Un écran vide au comptoir n'est pas une option.

### Base de données

À appliquer **avant** de déployer les postes (les quatre premières l'ont été le 18/10/2026) :

| Migration | Ce qu'elle fait |
| --- | --- |
| `20260921000000_remise_ligne` | remise par ligne sur les entrées et les bons de commande |
| `20260922000000_cumuls_serveur` | stock et solde de caisse calculés par Postgres |
| `20260923000000_horodater_lignes_vente` | `created_at` sur `lignes_vente` (sans quoi son flux ne peut pas être borné) |
| `20260924000000_fenetre_historique` | colonne `dans_fenetre` + rafraîchissement quotidien (pg_cron) |
| `20260925000000_cumuls_tiers` | comptes clients et fournisseurs calculés par Postgres |
| `20260926000000_transfert_stock_filiales` | bons de transfert de stock entre filiales (`transferts_stock`, `lignes_transfert_stock`) |
| `20260927000000_roles_permissions` | rôles, permissions, compte superadministrateur livré (`roles`, `roles_permissions`, `utilisateurs.role_id`) |

⚠ `20260927000000` crée un compte dont le mot de passe est public : se connecter avec
`superadmin@cisse-freres.ci` / `SuperAdmin@2026` et en changer tout de suite (l'application l'exige).

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
