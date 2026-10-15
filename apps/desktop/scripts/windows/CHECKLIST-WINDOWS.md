# Recette Windows — QuincaPro

Installeur : `apps/desktop/dist-windows/QuincaPro_<version>_x64-setup.exe` (NSIS, x64, non signé :
SmartScreen affiche « Windows a protégé votre ordinateur » → *Informations complémentaires* → *Exécuter quand même*).

## Installation

- [ ] L'installeur propose le mode utilisateur courant ; l'app démarre depuis le menu Démarrer.
- [ ] Sur un PC **sans WebView2** (Windows 10 ancien) : l'installeur télécharge et installe le runtime WebView2 (connexion requise une fois). Sur Windows 10 récent / 11 il est déjà présent.
- [ ] Données locales créées dans `%APPDATA%\com.ciadev.quinca-pro` (base SQLite PowerSync).

## Première connexion (en ligne)

- [ ] Connexion avec le compte gérante → synchronisation initiale (badge « Synchronisé »), articles, clients, fournisseurs visibles.
- [ ] Deuxième compte (directeur) : sélection de filiale, consolidation.

## Différences WebView2 à vérifier (ce qui marche différemment de macOS)

- [ ] **Impression** (`window.print`) : ticket 80 mm (POS), documents A4 (bon de commande, balance, relevés, émargements, bulletins) → la boîte d'impression Windows s'ouvre, aperçu correct, marges.
- [ ] **Les deux formats du point de vente** : après une vente, *Ticket* sort en 80 mm sur la thermique et *Facture A4* en pleine page sur la bureautique. Vérifier que le format par défaut du poste (Réglages du poste de vente) est bien le bouton principal, et que passer de l'un à l'autre n'imprime pas le mauvais document.
- [ ] **Facture A4** : cartouches facture et client lisibles, lignes non coupées, montant en toutes lettres, cases de règlement cochées, rien qui déborde de la page.
- [ ] **Réimpression** : Ventes → détail d'un ticket → *Facture A4* ; une vente annulée doit sortir avec le bandeau « FACTURE ANNULÉE ».
- [ ] **Code-barres** : passer une douchette sur le code-barres d'une facture, d'un reçu de caisse et d'une fiche article — le code lu doit être exactement celui imprimé en clair dessous.
- [ ] **Relance par e-mail** (clients / fournisseurs) : « Envoyer par e-mail » ouvre le client de messagerie par défaut (Outlook, Mail…) avec objet et corps pré-remplis. Si aucun client mail n'est configuré : le bouton « Copier » doit fonctionner.
- [ ] **Copier** dans le presse-papiers (relances) puis coller dans Bloc-notes.
- [ ] **Pièces jointes employés** : sélection d'une photo et d'un contrat PDF via la boîte de dialogue Windows ; contrat consultable dans l'app (PDF affiché dans la fiche).
- [ ] **Import du catalogue** : Catalogue → *Importer Excel* ouvre la boîte de dialogue Windows ; charger un export `ETAT_LISTEARTICLE.xls` → le nombre d'articles importés correspond au fichier (le **premier** article de la feuille compris) et les lignes rejetées sont expliquées.
- [ ] **Recherche** : accents (« koné ») — même limite qu'ailleurs (ASCII seulement), à noter, pas un bug Windows.
- [ ] **Raccourcis POS** : F2 (recherche), F10 (nouvelle vente), F11 (encaisser) — vérifier qu'ils ne sont pas interceptés par Windows.
- [ ] **Boîtes de confirmation** (annulation de vente, validation de journée, désactivations) : modales de l'app, jamais de dialogue système.

## Modules récents (à passer une fois sur Windows)

- [ ] **Trésorerie → Liste des caisses** : filtre par caisse et par période, solde d'ouverture / clôture / actuel cohérents, *Imprimer* sort le journal de caisse A4.
- [ ] **Versement / Retrait / Entrée / Dépense** : le reçu s'imprime, le montant en toutes lettres correspond aux chiffres.
- [ ] **Transfert inter filiale** : envoi depuis une filiale, réception depuis l'autre poste (demande deux postes ou deux comptes) ; l'annulation en transit recrédite bien la caisse.
- [ ] **Fiche article** : bouton *Détail* → stock par dépôt, activité commerciale, *Imprimer la fiche*.
- [ ] **Export Excel** (Stock → Entrée, et Fournisseurs → Bons de commande) : le bouton *Exporter en Excel* ouvre la **boîte d'enregistrement Windows** (et non un téléchargement silencieux) ; le fichier s'ouvre dans Excel avec les colonnes, la remise et les totaux. C'est le point le plus incertain de cette version : il repose sur deux plugins Tauri ajoutés récemment, jamais exécutés hors du navigateur.
- [ ] **Remise de ligne** : saisir une remise sur une entrée, vérifier que le coût moyen de l'article tient compte du net et que le bon imprimé affiche la remise.
- [ ] **Entrée de stock avec fournisseur** : choisir un fournisseur, valider, puis le retrouver dans Stock → Mouvements (colonne et filtre *Fournisseur*). Vérifier que la ligne remonte bien dans Supabase (c'est la colonne ajoutée le plus récemment).

## Hors ligne (le point clé)

- [ ] Couper le Wi-Fi/Ethernet → badge « Hors ligne », l'app reste utilisable.
- [ ] Faire une vente, une entrée de stock, un pointage hors ligne.
- [ ] Verrouiller le poste, déverrouiller avec le **même** compte hors ligne.
- [ ] Déverrouiller avec **un autre compte de la filiale** hors ligne (il doit s'être connecté une fois en ligne depuis la mise à jour).
- [ ] Reconnecter → file d'envoi vidée, opérations visibles dans Supabase / sur un autre poste.
- [ ] Pendant la coupure, le bandeau dit **« Hors ligne »** (et non « Envoi bloqué ») : accumuler des écritures hors ligne est le fonctionnement normal.
- [ ] Fermer et rouvrir l'app hors ligne : reprise directe sans écran de connexion.

## Robustesse

- [ ] Redémarrage du PC pendant une session : au relancement, rien n'est perdu.
- [ ] Deux fenêtres : l'app ne s'ouvre qu'une fois (sinon noter : verrou d'instance unique à ajouter).
- [ ] Écran 1366 × 768 (portable de caisse) : la fenêtre minimale 1180 × 720 tient, le POS reste utilisable.
- [ ] Lenteurs : ouverture du catalogue avec ~100 articles, journal des mouvements, consolidation.

Noter chaque écart avec : écran, action, résultat attendu / obtenu, capture.
