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
- [ ] **Relance par e-mail** (clients / fournisseurs) : « Envoyer par e-mail » ouvre le client de messagerie par défaut (Outlook, Mail…) avec objet et corps pré-remplis. Si aucun client mail n'est configuré : le bouton « Copier » doit fonctionner.
- [ ] **Copier** dans le presse-papiers (relances) puis coller dans Bloc-notes.
- [ ] **Pièces jointes employés** : sélection d'une photo et d'un contrat PDF via la boîte de dialogue Windows ; contrat consultable dans l'app (PDF affiché dans la fiche).
- [ ] **Recherche** : accents (« koné ») — même limite qu'ailleurs (ASCII seulement), à noter, pas un bug Windows.
- [ ] **Raccourcis POS** : F2 (recherche), F10 (nouvelle vente), F11 (encaisser) — vérifier qu'ils ne sont pas interceptés par Windows.
- [ ] **Boîtes de confirmation** (annulation de vente, validation de journée, désactivations) : modales de l'app, jamais de dialogue système.

## Hors ligne (le point clé)

- [ ] Couper le Wi-Fi/Ethernet → badge « Hors ligne », l'app reste utilisable.
- [ ] Faire une vente, une entrée de stock, un pointage hors ligne.
- [ ] Verrouiller le poste, déverrouiller avec le **même** compte hors ligne.
- [ ] Déverrouiller avec **un autre compte de la filiale** hors ligne (il doit s'être connecté une fois en ligne depuis la mise à jour).
- [ ] Reconnecter → file d'envoi vidée, opérations visibles dans Supabase / sur un autre poste.
- [ ] Fermer et rouvrir l'app hors ligne : reprise directe sans écran de connexion.

## Robustesse

- [ ] Redémarrage du PC pendant une session : au relancement, rien n'est perdu.
- [ ] Deux fenêtres : l'app ne s'ouvre qu'une fois (sinon noter : verrou d'instance unique à ajouter).
- [ ] Écran 1366 × 768 (portable de caisse) : la fenêtre minimale 1180 × 720 tient, le POS reste utilisable.
- [ ] Lenteurs : ouverture du catalogue avec ~100 articles, journal des mouvements, consolidation.

Noter chaque écart avec : écran, action, résultat attendu / obtenu, capture.
