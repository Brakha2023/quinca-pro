// Scénario Stock : règles appliquées sur la vraie base SQLite locale, puis parcours UI.
// Prérequis : `pnpm dev` lancé. Aucun backend requis.
const { ouvrirNavigateur, simulerSession, verifier, BASE_URL } = require('./browser.cjs');

(async () => {
  const { browser, page, erreurs } = await ouvrirNavigateur();
  const { filialeId, userId } = await simulerSession(page);

  console.log('Repository (base locale)');
  const r = await page.evaluate(async ({ F, U }) => {
    const { db } = await import('/src/infrastructure/powersync/database.ts');
    const { StockRepository, stocksQuery } = await import('/src/infrastructure/powersync/repositories/StockRepository.ts');
    const { DepotsRepository } = await import('/src/infrastructure/powersync/repositories/DepotsRepository.ts');
    const { ArticlesRepository } = await import('/src/infrastructure/powersync/repositories/ArticlesRepository.ts');
    const { articleFormSchema } = await import('/src/core/articles/index.ts');
    const depots = new DepotsRepository(db);
    const d1 = await depots.create(F, { code: 'D1', nom: 'Principal', adresse: '', responsable: '' });
    const d2 = await depots.create(F, { code: 'D2', nom: 'Annexe', adresse: '', responsable: '' });
    const articles = new ArticlesRepository(db);
    const a1 = await articles.create(F, articleFormSchema.parse({ code: 'CIM-50', designation: 'Ciment 50kg', prix_achat: 4500, prix_vente: 5500, stock_min: 20 }));
    const a2 = await articles.create(F, articleFormSchema.parse({ code: 'VIS-50', designation: 'Vis 50mm', prix_achat: 2500, prix_vente: 3500, stock_min: 5 }));
    const stock = new StockRepository(db);
    const ctx = { filialeId: F, utilisateurId: U };
    const out = {};

    // Provenance : le fournisseur est porté par le mouvement, plus par le motif.
    const { FournisseursRepository } = await import('/src/infrastructure/powersync/repositories/FournisseursRepository.ts');
    const { fournisseurFormSchema } = await import('/src/core/fournisseurs/index.ts');
    const fId = await new FournisseursRepository(db).create(F, fournisseurFormSchema.parse({ raison_sociale: 'SOCIMAT CI' }));

    await stock.enregistrerEntree(ctx, { depot_id: d1, type: 'ENTREE_ACHAT', fournisseur_id: fId, reference: '', motif: 'BL 1', lignes: [{ article_id: a1, quantite: 100, cout_unitaire: 4000 }, { article_id: a2, quantite: 10, cout_unitaire: 2500 }] });
    await stock.enregistrerEntree(ctx, { depot_id: d1, type: 'ENTREE_ACHAT', reference: 'BL-2', motif: '', lignes: [{ article_id: a1, quantite: 100, cout_unitaire: 5000 }] });
    const s1 = await db.get('SELECT quantite, cout_moyen FROM stocks WHERE article_id = ? AND depot_id = ?', [a1, d1]);
    out.apresEntrees = s1; // 200 @ 4500

    try { await stock.enregistrerSortie(ctx, { depot_id: d1, type: 'CASSE', reference: '', motif: '', lignes: [{ article_id: a2, quantite: 11 }] }); out.sortieRefusee = false; }
    catch (e) { out.sortieRefusee = e.name === 'StockInsuffisantError'; }
    out.stockVisApresRefus = (await db.get('SELECT quantite FROM stocks WHERE article_id = ?', [a2])).quantite;

    out.referenceTransfert = await stock.transferer(ctx, { depot_source_id: d1, depot_destination_id: d2, reference: '', motif: '', lignes: [{ article_id: a1, quantite: 50 }] });
    out.apresTransfert = await db.getAll('SELECT d.code, s.quantite, s.cout_moyen FROM stocks s JOIN depots d ON d.id = s.depot_id WHERE s.article_id = ? ORDER BY d.code', [a1]);

    const { mouvementsQuery } = await import('/src/infrastructure/powersync/repositories/StockRepository.ts');
    const qf = mouvementsQuery(F, { fournisseurId: fId });
    out.mouvementsFournisseur = (await db.getAll(qf.sql, qf.params)).map((m) => `${m.type}:${m.fournisseur_nom}`);
    const inv = await stock.enregistrerInventaire(ctx, { depot_id: d1, reference: '', motif: '', lignes: [{ article_id: a1, quantite_comptee: 148 }, { article_id: a2, quantite_comptee: 10 }] });
    out.inventaire = inv.ecarts;
    out.apresInventaire = (await db.get('SELECT quantite FROM stocks WHERE article_id = ? AND depot_id = ?', [a1, d1])).quantite;
    // Production : 2 sacs de ciment (matière, coût moyen 4500) → 20 briques + 2 perdues, à partir d'un produit sans stock.
    const { ProductionsRepository } = await import('/src/infrastructure/powersync/repositories/ProductionsRepository.ts');
    const a3 = await articles.create(F, articleFormSchema.parse({ code: 'BRQ-15', designation: 'Brique 15', prix_achat: 0, prix_vente: 600 }));
    const productions = new ProductionsRepository(db);
    const prod = await productions.enregistrer(ctx, { depot_id: d1, numero: '', equipe: 'Matin', date_debut: '2026-09-18T07:00', date_fin: '2026-09-18T11:30', commentaire: 'Test',
      matieres: [{ article_id: a1, quantite: 2 }], produits: [{ article_id: a3, quantite_prevue: 22, quantite: 20, pertes: 2 }] });
    out.production = { coutMatieres: prod.coutMatieres, numero: prod.numero };
    out.brique = await db.get('SELECT quantite, cout_moyen FROM stocks WHERE article_id = ? AND depot_id = ?', [a3, d1]);
    out.cimentApresProduction = (await db.get('SELECT quantite FROM stocks WHERE article_id = ? AND depot_id = ?', [a1, d1])).quantite;
    out.lignesProduction = await db.getAll('SELECT sens, quantite, pertes, cout_unitaire FROM lignes_production WHERE production_id = ? ORDER BY sens', [prod.id]);
    try { await productions.enregistrer(ctx, { depot_id: d2, numero: '', equipe: '', date_debut: '2026-09-18T07:00', date_fin: '', commentaire: '', matieres: [{ article_id: a2, quantite: 1 }], produits: [{ article_id: a3, quantite_prevue: 0, quantite: 1, pertes: 0 }] }); out.productionRefusee = false; }
    catch (e) { out.productionRefusee = e.name === 'StockInsuffisantError'; }
    out.productionsApresRefus = (await db.get('SELECT COUNT(*) AS n FROM productions')).n;

    out.mouvements = await db.getAll('SELECT type, quantite, quantite_avant, quantite_apres FROM mouvements_stock WHERE filiale_id = ? ORDER BY created_at', [F]);
    const q = stocksQuery(F, { alertesSeulement: true });
    out.alertes = (await db.getAll(q.sql, q.params)).map((l) => `${l.article_code}@${l.depot_code}:${l.quantite}`);

    // Un retour client ne vient d'aucun fournisseur, même si l'écran en proposait un.
    const { entreeStockSchema } = await import('/src/core/stock/index.ts');
    await stock.enregistrerEntree(ctx, entreeStockSchema.parse({ depot_id: d1, type: 'RETOUR_CLIENT', fournisseur_id: fId, lignes: [{ article_id: a2, quantite: 1 }] }));
    out.retourSansFournisseur = (await db.get("SELECT fournisseur_id FROM mouvements_stock WHERE type = 'RETOUR_CLIENT'")).fournisseur_id;

    // La marchandise reçue d'un fournisseur est portée à son compte : la
    // première entrée vaut 100 × 4 000 + 10 × 2 500 = 425 000 F. Les deux
    // autres (sans fournisseur, puis retour client) ne lui doivent rien.
    out.compteFournisseur = await db.get('SELECT cumul_factures, solde_actuel FROM fournisseurs WHERE id = ?', [fId]);
    out.piecesFournisseur = await db.getAll('SELECT numero, type, statut, total_recu_ttc, reste_a_payer FROM commandes_fournisseurs ORDER BY created_at');
    return out;
  }, { F: filialeId, U: userId });

  verifier(r.apresEntrees.quantite === 200 && r.apresEntrees.cout_moyen === 4500, 'entrées cumulées, coût moyen pondéré 4500');
  verifier(r.mouvementsFournisseur.length === 2 && r.mouvementsFournisseur.every((m) => m === 'ENTREE_ACHAT:SOCIMAT CI'), 'entrée : fournisseur enregistré sur chaque ligne et journal filtrable par fournisseur');
  verifier(r.retourSansFournisseur === null, 'retour client : aucune provenance fournisseur retenue');
  verifier(r.compteFournisseur.solde_actuel === 425000 && r.compteFournisseur.cumul_factures === 425000,
    `entrée d’achat : le net est porté au compte du fournisseur (${r.compteFournisseur.solde_actuel})`);
  verifier(r.piecesFournisseur.length === 1 && r.piecesFournisseur[0].numero.startsWith('ENT-')
    && r.piecesFournisseur[0].statut === 'LIVREE' && r.piecesFournisseur[0].total_recu_ttc === 425000 && r.piecesFournisseur[0].reste_a_payer === 425000,
    `entrée d’achat : une pièce réceptionnée au numéro du bon, restant à payer (${r.piecesFournisseur.map((p) => `${p.numero}:${p.total_recu_ttc}`).join(', ') || 'aucune'})`);
  verifier(r.sortieRefusee && r.stockVisApresRefus === 10, 'sortie > disponible refusée, stock intact');
  verifier(JSON.stringify(r.apresTransfert) === JSON.stringify([{ code: 'D1', quantite: 150, cout_moyen: 4500 }, { code: 'D2', quantite: 50, cout_moyen: 4500 }]), 'transfert D1→D2 au coût moyen');
  verifier(r.inventaire === 1 && r.apresInventaire === 148, 'inventaire : 1 écart régularisé (150 → 148)');
  verifier(r.production.coutMatieres === 9000 && r.production.numero.startsWith('PRD-'), 'production : coût matières 2 × 4500 = 9000');
  verifier(r.brique.quantite === 20 && r.brique.cout_moyen === 450, 'produit entré en stock : 20 briques à 450 (les 2 perdues renchérissent les bonnes)');
  verifier(r.cimentApresProduction === 146, 'matière consommée : ciment 148 → 146');
  verifier(r.lignesProduction.length === 2 && r.lignesProduction[1].pertes === 2 && r.lignesProduction[1].cout_unitaire === 450, 'lignes de production (matière + produit) tracées');
  verifier(r.productionRefusee && r.productionsApresRefus === 1, 'production refusée si matière insuffisante, rien d’écrit');
  verifier(r.mouvements.length === 8, `8 mouvements journalisés (${r.mouvements.map((m) => m.type).join(', ')})`);
  verifier(r.alertes.length === 0, 'aucune alerte (stocks au-dessus des minimums)');

  console.log('Interface');
  // `#/stock` ouvre désormais les alertes : le suivi se demande par sa route.
  await page.goto(`${BASE_URL}/#/stock/suivi`);
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('main h1', { hasText: 'Gestion du stock' }).waitFor();
  await page.locator('tbody tr', { hasText: 'CIM-50' }).first().waitFor();
  verifier((await page.locator('tbody tr').count()) === 4, 'suivi : 4 lignes de stock (ciment × 2 dépôts, vis, brique produite)');

  // L'état du stock partait à l'imprimante avec le menu ; c'est maintenant un
  // document à part, valorisé et daté.
  await page.getByTestId('imprimer-etat-stock').click();
  const etat = page.locator('#zone-impression');
  await etat.locator('[data-testid=ligne-etat-stock]').first().waitFor();
  const papierStock = (await etat.textContent()).replace(/\s+/g, ' ');
  verifier((await etat.locator('[data-testid=ligne-etat-stock]').count()) === 4, 'état du stock : les 4 lignes de la liste');
  verifier(papierStock.includes('État du stock') && papierStock.includes('Filiale Abidjan'), 'état du stock : titre et en-tête de la maison');
  verifier(papierStock.includes('tous dépôts'), 'état du stock : périmètre de la liste annoncé');
  verifier(/\d+ ligne\(s\) ·/.test(papierStock) && papierStock.includes('Ruptures'), 'état du stock : valorisation et alertes récapitulées');
  verifier(papierStock.includes('CIM-50') && papierStock.includes('Ciment 50kg') && papierStock.includes('Principal') && papierStock.includes('Annexe'),
    'état du stock : chaque article avec son dépôt');
  verifier(papierStock.includes('918 500 F'), 'état du stock : valeur du stock au coût moyen');
  verifier(!papierStock.includes('Point de Vente') && !papierStock.includes('Consolidation') && !papierStock.includes('Alertes seulement'),
    'état du stock : ni menu, ni filtres, ni bandeau de l’application');
  await etat.getByRole('button', { name: "Fermer l'aperçu" }).click();

  await page.locator('main').getByRole('link', { name: 'Entrée', exact: true }).click();
  await page.locator('[data-testid=select-fournisseur]').selectOption({ index: 1 });
  await page.locator('input[placeholder^="Ajouter un article"]').fill('vis');
  await page.locator('ul li button', { hasText: 'VIS-50' }).click();
  await page.locator('tbody input[type=number]').first().fill('5');

  // La remise se négocie sur le bon entier et en francs : 2 500 F sur 12 500 F.
  await page.getByTestId('remise-globale').fill('2500');
  await page.getByTestId('date-livraison').fill('2026-10-12T18:30');
  await page.locator('[data-testid=brut-bon]', { hasText: '12 500 F' }).waitFor();
  await page.locator('[data-testid=remise-bon]', { hasText: '2 500 F' }).waitFor();
  await page.locator('[data-testid=total-bon]', { hasText: '10 000 F' }).waitFor();
  verifier(true, 'entrée : remise globale en francs, brut et net affichés (12 500 − 2 500)');

  // Export Excel : hors Tauri, le repli navigateur télécharge le classeur.
  const telechargement = page.waitForEvent('download');
  await page.getByTestId('exporter-excel').click();
  const fichier = await telechargement;
  const classeur = require('xlsx').readFile(await fichier.path());
  const feuille = require('xlsx').utils.sheet_to_json(classeur.Sheets[classeur.SheetNames[0]]);
  verifier(/\.xlsx$/.test(fichier.suggestedFilename()), `export Excel : fichier ${fichier.suggestedFilename()}`);
  verifier(feuille.length === 1 && feuille[0].Code === 'VIS-50' && feuille[0].Montant === 12500 && feuille[0]['Part de remise'] === 2500 && feuille[0]['Total net'] === 10000,
    'export Excel : lignes, part de remise et net relus depuis le classeur');

  await page.getByRole('button', { name: "Valider l'entrée" }).click();
  await page.locator('[aria-live]', { hasText: 'Entrée ENT-' }).waitFor();
  const avis = (await page.locator('[aria-live]', { hasText: 'Entrée ENT-' }).textContent()).replace(/\s+/g, ' ');
  verifier(avis.includes('10 000 F') && avis.includes('SOCIMAT CI'), `entrée saisie via l’UI : le net annoncé porté au compte du fournisseur (${avis.trim()})`);

  // Le champ fournisseur disparaît quand l'entrée n'est pas un achat.
  await page.locator('main select').nth(1).selectOption('RETOUR_CLIENT');
  await page.locator('[data-testid=select-fournisseur]').waitFor({ state: 'detached' });
  verifier(true, 'retour client : pas de fournisseur à saisir');

  // Le bon de la saisie qui vient d'être validée s'imprime depuis l'écran lui-même.
  await page.getByTestId('imprimer-bon').click();
  const bon = page.locator('#zone-impression.apercu-impression');
  await bon.waitFor();
  const papier = (await bon.textContent()).replace(/\s+/g, ' ');
  verifier(papier.includes("Bon d'entrée — achat"), 'bon d’entrée : titre du document');
  // L'écran d'entrée propose le premier dépôt actif par ordre alphabétique : « Annexe ».
  verifier(papier.includes('SOCIMAT CI') && papier.includes('Annexe'), 'bon d’entrée : fournisseur et dépôt');
  verifier(papier.includes('Total brut') && papier.includes('12 500 F'), 'bon d’entrée : le brut avant remise');
  verifier(papier.includes('Remise globale') && papier.includes('2 500 F'), 'bon d’entrée : la remise accordée, en francs');
  verifier(papier.includes('Net du bon') && papier.includes('10 000 F'), 'bon d’entrée : net à payer après remise');
  verifier(papier.includes('Livré le') && papier.includes('12/10/2026'), 'bon d’entrée : l’arrivée réelle de la marchandise');
  verifier(papier.includes('VIS-50') && papier.includes('+5'), 'bon d’entrée : ligne et quantité signée');
  verifier((await bon.locator('svg.code-barres rect').count()) > 20, 'bon d’entrée : code-barres de la référence');
  await bon.getByRole('button', { name: "Fermer l'aperçu" }).click();

  await page.locator('main').getByRole('link', { name: 'Mouvements', exact: true }).click();
  await page.locator('[data-testid=filtre-fournisseur]').selectOption({ label: 'SOCIMAT CI' });
  // Attendre « une ligne » ne prouve rien : la liste non filtrée en montre déjà.
  // On attend que la requête filtrée soit arrivée, sinon on lit l'état d'avant.
  await page.waitForFunction(() => document.querySelectorAll('tbody tr').length === 3);
  const provenances = await page.locator('[data-testid=mouvement-fournisseur]').allTextContents();
  const apresSaisie = await page.evaluate(async () => {
    const { db } = await import('/src/infrastructure/powersync/database.ts');
    const m = await db.get("SELECT cout_unitaire, remise_montant, date_livraison FROM mouvements_stock WHERE type = 'ENTREE_ACHAT' AND remise_montant > 0");
    const f = await db.get("SELECT solde_actuel FROM fournisseurs WHERE raison_sociale = 'SOCIMAT CI'");
    const pieces = await db.getAll('SELECT numero, total_recu_ttc, notes FROM commandes_fournisseurs ORDER BY created_at');
    const lignes = await db.getAll('SELECT code_article, quantite, prix_unitaire_ht, total_ht FROM lignes_commande_fournisseur ORDER BY created_at DESC LIMIT 1');
    return { m, f, pieces, lignes };
  });
  verifier(apresSaisie.m.cout_unitaire === 2000 && apresSaisie.m.remise_montant === 2500,
    'entrée : stock valorisé au coût net (12 500 − 2 500 sur 5 unités = 2 000), part de remise conservée');
  verifier(apresSaisie.m.date_livraison !== null && new Date(apresSaisie.m.date_livraison).getHours() === 18,
    `entrée : l’heure de livraison saisie est enregistrée (${apresSaisie.m.date_livraison})`);
  verifier(apresSaisie.f.solde_actuel === 435000, `compte fournisseur : 425 000 + 10 000 de la saisie UI (${apresSaisie.f.solde_actuel})`);
  verifier(apresSaisie.pieces.length === 2 && apresSaisie.pieces[1].total_recu_ttc === 10000
    && apresSaisie.pieces[1].notes.includes('Remise globale 2500 F') && apresSaisie.pieces[1].notes.includes('Entrée en stock'),
    `compte fournisseur : la pièce reprend le net, la remise et le bon d’entrée (${apresSaisie.pieces[1] && apresSaisie.pieces[1].notes})`);
  verifier(apresSaisie.lignes.length === 1 && apresSaisie.lignes[0].prix_unitaire_ht === 2000 && apresSaisie.lignes[0].total_ht === 10000,
    'compte fournisseur : la ligne de la pièce est due au coût net, pas au brut');

  verifier(provenances.length === 3 && provenances.every((t) => t === 'SOCIMAT CI'), `journal : filtre par fournisseur, provenance affichée (${provenances.join(', ') || 'aucune ligne'})`);

  // Réédition d'un bon depuis le journal, y compris un transfert (deux dépôts, une seule ligne par article).
  await page.locator('[data-testid=filtre-fournisseur]').selectOption('');
  await page.locator('input[placeholder^="Référence exacte"]').fill(r.referenceTransfert);
  await page.locator('tbody tr').first().waitFor();
  await page.locator(`[data-testid="bon-${r.referenceTransfert}"]`).first().click();
  const bonTransfert = page.locator('#zone-impression.apercu-impression');
  await bonTransfert.waitFor();
  const papierTransfert = (await bonTransfert.textContent()).replace(/\s+/g, ' ');
  verifier(papierTransfert.includes('Bon de transfert entre dépôts'), 'réédition : bon de transfert');
  verifier(papierTransfert.includes('Origine : Principal') && papierTransfert.includes('Destination : Annexe'), 'réédition : les deux dépôts du transfert');
  verifier((await bonTransfert.locator('tbody tr').count()) === 1, 'réédition : l’article transféré ne compte qu’une fois');
  await bonTransfert.getByRole('button', { name: "Fermer l'aperçu" }).click();

  console.log('Historique de chaque onglet de saisie');
  // Chaque onglet montre ses propres bons, et eux seuls : le magasinier qui
  // cherche son bon d'entrée ne doit pas lire la journée de la caisse.
  const lignesBons = (n) => page.waitForFunction((attendu) => document.querySelectorAll('[data-testid^="bon-"]').length === attendu, n);
  const ouvrirHistorique = async (onglet) => {
    await page.locator('main').getByRole('link', { name: onglet, exact: true }).click();
    await page.locator('main').getByTestId('vue-historique').click();
  };

  await ouvrirHistorique('Entrée');
  await lignesBons(4);
  const recapEntrees = (await page.getByTestId('bons-recap').textContent()).replace(/\s+/g, ' ');
  verifier(recapEntrees.includes('4 bon(s)'), `entrées : 4 bons regroupés par référence (${recapEntrees})`);
  verifier((await page.locator('tbody tr', { hasText: 'SOCIMAT CI' }).count()) === 2, 'entrées : la provenance suit le bon');
  verifier((await page.locator('tbody tr', { hasText: 'Retour client' }).count()) === 1, 'entrées : le retour client est une entrée, pas une nature à part');
  const livraisons = (await page.locator('[data-testid^="livraison-"]').allTextContents()).map((t) => t.trim());
  verifier(livraisons.filter((t) => t.includes('12/10/2026')).length === 1 && livraisons.filter((t) => t === '—').length === 3,
    `entrées : la livraison datée se lit dans sa colonne, les autres bons restent vierges (${livraisons.join(' | ')})`);
  await page.getByTestId('bons-recherche').fill('BL-2');
  await lignesBons(1);
  verifier(true, 'entrées : recherche par numéro de bon');
  await page.getByTestId('bons-recherche').fill('Vis 50mm');
  await lignesBons(3);
  verifier(true, 'entrées : recherche par article — les 3 bons qui en portent');
  await page.getByTestId('bons-recherche').fill('');
  await lignesBons(4);

  // Réimpression depuis l'historique : la même pièce que le jour de la saisie.
  await page.locator('[data-testid^="imprimer-bon-"]').first().click();
  const bonHistorique = page.locator('#zone-impression.apercu-impression');
  await bonHistorique.waitFor();
  verifier((await bonHistorique.textContent()).includes("Bon d'entrée"), 'entrées : le bon se réimprime depuis l’historique');
  await bonHistorique.getByRole('button', { name: "Fermer l'aperçu" }).click();

  await ouvrirHistorique('Sortie / Casse');
  await page.locator('text=Aucune sortie enregistrée sur cette période.').waitFor();
  verifier(true, 'sorties : la casse refusée n’a rien laissé — la liste le dit au lieu de rester vide');

  await ouvrirHistorique('Transfert entre dépôts');
  await lignesBons(1);
  const ligneTransfert = (await page.locator('tbody tr').first().textContent()).replace(/\s+/g, ' ');
  verifier(ligneTransfert.includes('Principal → Annexe'), `transferts : les deux dépôts sur une seule ligne (${ligneTransfert})`);
  // Colonne « Lignes » : le transfert écrit deux mouvements par article, il n'en compte qu'un.
  const lignesDuTransfert = (await page.locator('tbody tr td:nth-child(6)').first().textContent()).trim();
  verifier(lignesDuTransfert === '1' && ligneTransfert.includes('225 000 F'), `transferts : 1 ligne comptée et une seule valeur (et non 2), au coût de départ (${lignesDuTransfert} · ${ligneTransfert.includes('225 000 F')})`);

  await ouvrirHistorique('Inventaire');
  await lignesBons(1);
  const ligneInventaire = (await page.locator('tbody tr').first().textContent()).replace(/\s+/g, ' ');
  verifier(ligneInventaire.includes('-2'), `inventaires : l’écart net signé (${ligneInventaire})`);
  verifier(ligneInventaire.includes('9 000 F'), 'inventaires : l’écart chiffré au coût moyen (2 sacs à 4 500)');

  // Sous-menu Stock dans la barre latérale : les sections sont des routes.
  const sousMenu = page.locator('[data-testid=sous-menu-stock]');
  await sousMenu.waitFor();
  verifier((await sousMenu.locator('a').count()) === 9, 'sous-menu Stock : 9 sections dans la barre latérale');
  const sections = (await sousMenu.locator('a').allTextContents()).map((t) => t.trim());
  verifier(sections[0] === 'Alertes', `sous-menu Stock : les alertes en tête (${sections.slice(0, 3).join(' · ')})`);
  await sousMenu.getByRole('link', { name: 'Production' }).click();
  await page.waitForURL(/#\/stock\/production$/);
  await page.locator('main h2', { hasText: 'Production' }).waitFor();
  verifier(true, 'navigation par le sous-menu vers /stock/production');

  await page.locator('[data-testid=production-matieres] input[placeholder^="Ajouter"]').fill('cim');
  await page.locator('[data-testid=production-matieres] ul li button', { hasText: 'CIM-50' }).click();
  await page.locator('[data-testid=production-matieres] tbody input[type=number]').fill('4');
  await page.locator('[data-testid=production-produits] input[placeholder^="Ajouter"]').fill('brq');
  await page.locator('[data-testid=production-produits] ul li button', { hasText: 'BRQ-15' }).click();
  const champsProduit = page.locator('[data-testid=production-produits] tbody input[type=number]');
  await champsProduit.nth(0).fill('40');
  await champsProduit.nth(1).fill('36');
  await champsProduit.nth(2).fill('4');
  await page.locator('[data-testid=production-produits] tbody tr', { hasText: '-4' }).waitFor();
  await page.locator('[data-testid=production-produits] tbody tr', { hasText: '500 F / PIECE' }).waitFor();
  verifier(true, 'saisie : écart −4 et coût de revient 500 F (4 × 4500 / 36) calculés en direct');
  await page.getByRole('button', { name: 'Enregistrer la production' }).click();
  await page.locator('[aria-live]', { hasText: 'Production PRD-' }).waitFor();
  // Scopé à la page : la barre latérale porte aussi un « Historiques ».
  await page.locator('main').getByRole('button', { name: 'Historique', exact: true }).click();
  await page.locator('tbody tr', { hasText: 'Brique 15' }).first().waitFor();
  verifier((await page.locator('tbody tr').count()) === 2, 'historique : 2 productions');
  await page.locator('tbody tr').first().getByTitle('Détail').click();
  await page.getByRole('dialog').locator('td', { hasText: 'CIM-50' }).waitFor();
  verifier(true, 'détail : matières et produits de la production');
  await page.keyboard.press('Escape');

  await sousMenu.getByRole('link', { name: 'Mouvements' }).click();
  await page.locator('tbody tr', { hasText: 'Entrée achat' }).first().waitFor();
  await page.locator('tbody tr', { hasText: 'Produit' }).first().waitFor();
  verifier((await page.locator('tbody tr').count()) === 12, 'journal : 12 mouvements (dont 4 de production et 1 retour client)');

  console.log('Alertes');
  // Deux alertes fabriquées exprès : un article jamais entré en stock (rupture)
  // et un article au ras de son minimum (stock faible).
  await page.evaluate(async ({ F, U }) => {
    const { db } = await import('/src/infrastructure/powersync/database.ts');
    const { ArticlesRepository } = await import('/src/infrastructure/powersync/repositories/ArticlesRepository.ts');
    const { StockRepository } = await import('/src/infrastructure/powersync/repositories/StockRepository.ts');
    const { articleFormSchema } = await import('/src/core/articles/index.ts');
    const articles = new ArticlesRepository(db);
    await articles.create(F, articleFormSchema.parse({ code: 'ALR-RUP', designation: 'Article en rupture', prix_achat: 1000, prix_vente: 1500, stock_min: 10 }));
    const faible = await articles.create(F, articleFormSchema.parse({ code: 'ALR-FAI', designation: 'Article sous le minimum', prix_achat: 2000, prix_vente: 3000, stock_min: 10, stock_max: 40 }));
    const depot = await db.get("SELECT id FROM depots WHERE nom = 'Principal'");
    await new StockRepository(db).enregistrerEntree({ filialeId: F, utilisateurId: U },
      { depot_id: depot.id, type: 'ENTREE_ACHAT', reference: 'BL-ALERTE', motif: '', lignes: [{ article_id: faible, quantite: 10, cout_unitaire: 2000 }] });
  }, { F: filialeId, U: userId });

  await sousMenu.getByRole('link', { name: 'Alertes' }).click();
  await page.locator('text=Valeur du stock').waitFor();
  const compteurAlertes = page.getByTestId('compteur-alertes');
  await compteurAlertes.locator('text=2').first().waitFor();
  const resume = async () => (await compteurAlertes.textContent()).replace(/\s+/g, ' ');
  // À commander : ALR-RUP vise 2 × le mini (20 × 1 000) et ALR-FAI son maxi (30 × 2 000).
  verifier((await resume()).includes('2 en alerte') && (await resume()).includes('80 000 F'),
    `alertes : 2 en alerte, commande chiffrée (${await resume()})`);

  console.log('Alertes : impression par filtre');
  await page.getByTestId('filtre-nature-alerte').selectOption('RUPTURE');
  // Le tableau « Stocks faibles » disparaît ; l'option du filtre porte le même
  // mot, d'où la recherche sur l'en-tête de tableau seulement.
  await page.locator('div.font-semibold', { hasText: 'Stocks faibles' }).waitFor({ state: 'detached' });
  verifier((await resume()).includes('1 en alerte') && (await resume()).includes('20 000 F'), 'filtre « ruptures seulement » : la liste et la commande suivent');

  await page.getByTestId('imprimer-alertes').click();
  const alertes = page.locator('#zone-impression');
  await alertes.locator('[data-testid=ligne-alerte]').first().waitFor();
  const papierAlertes = (await alertes.textContent()).replace(/\s+/g, ' ');
  verifier((await alertes.locator('[data-testid=ligne-alerte]').count()) === 1, 'document : seules les ruptures sont imprimées');
  verifier(papierAlertes.includes('Alertes de stock') && papierAlertes.includes('Filiale Abidjan'), 'document : titre et en-tête de la maison');
  verifier(papierAlertes.includes('Ruptures seulement · tous dépôts · toutes familles'), 'document : le filtre retenu est écrit sur la feuille');
  verifier(papierAlertes.includes('ALR-RUP') && papierAlertes.includes('20 000 F'), 'document : article en rupture et coût estimé de la commande');
  verifier(!papierAlertes.includes('Suivi de stock') && !papierAlertes.includes('Consolidation'), 'document : ni menu ni onglets de l’application');
  await alertes.getByRole('button', { name: "Fermer l'aperçu" }).click();

  console.log('Alertes : export Excel');
  await page.getByTestId('filtre-nature-alerte').selectOption('TOUTES');
  await compteurAlertes.locator('text=2').first().waitFor();
  const telechargementAlertes = page.waitForEvent('download');
  await page.getByTestId('exporter-alertes').click();
  const fichierAlertes = await telechargementAlertes;
  const classeurAlertes = require('xlsx').readFile(await fichierAlertes.path());
  const feuilleAlertes = require('xlsx').utils.sheet_to_json(classeurAlertes.Sheets[classeurAlertes.SheetNames[0]]);
  verifier(/^alertes-stock-\d{4}-\d{2}-\d{2}\.xlsx$/.test(fichierAlertes.suggestedFilename()), `export Excel : fichier ${fichierAlertes.suggestedFilename()}`);
  verifier(feuilleAlertes.length === 2, 'export Excel : les deux alertes');
  const rup = feuilleAlertes.find((l) => l.Code === 'ALR-RUP');
  verifier(rup.État === 'Rupture' && rup['À commander'] === 20 && rup['Coût estimé'] === 20000, 'export Excel : état, quantité à commander et coût relus depuis le classeur');

  // Le dépôt se filtre dans la jointure : un article absent du dépôt doit
  // apparaître en rupture, pas disparaître de la liste.
  await page.getByTestId('filtre-depot-alerte').selectOption({ label: 'Annexe' });
  await compteurAlertes.locator('text=3').first().waitFor();
  verifier(true, 'filtre par dépôt : l’article absent du dépôt y est en rupture, il ne disparaît pas');
  verifier(true, 'alertes affichées');

  console.log('Transfert entre filiales');
  // La marchandise voyage : Abidjan sort du stock tout de suite, Bouaké fait
  // entrer à l'arrivée. Entre les deux, elle n'est dans aucun dépôt.
  const t = await page.evaluate(async ({ F, U }) => {
    const { db } = await import('/src/infrastructure/powersync/database.ts');
    const { TransfertsStockRepository } = await import('/src/infrastructure/powersync/repositories/TransfertsStockRepository.ts');
    const { DepotsRepository } = await import('/src/infrastructure/powersync/repositories/DepotsRepository.ts');
    const { transfertFilialeStockSchema } = await import('/src/core/stock/index.ts');
    const BKE = 'filiale-bouake';
    await db.execute("INSERT OR REPLACE INTO filiales (id, code, nom, type, est_active) VALUES (?, 'BKE', 'Filiale Bouaké', 'FILIALE', 1)", [BKE]);
    const dBke = await new DepotsRepository(db).create(BKE, { code: 'DB1', nom: 'Dépôt Bouaké', adresse: '', responsable: '' });

    const repo = new TransfertsStockRepository(db);
    const ctxAbj = { filialeId: F, utilisateurId: U };
    const ctxBke = { filialeId: BKE, utilisateurId: U };
    const principal = await db.get("SELECT id FROM depots WHERE nom = 'Principal'");
    const ciment = await db.get("SELECT id FROM articles WHERE code = 'CIM-50'");
    const brique = await db.get("SELECT id FROM articles WHERE code = 'BRQ-15'");
    const out = {};

    out.avantEnvoi = (await db.get('SELECT quantite FROM stocks WHERE article_id = ? AND depot_id = ?', [ciment.id, principal.id])).quantite;
    const numero = await repo.envoyer(ctxAbj, transfertFilialeStockSchema.parse({
      filiale_destination_id: BKE, depot_source_id: principal.id, transporteur: 'Kouassi — 1234 CI', motif: 'Appro. Bouaké',
      lignes: [{ article_id: ciment.id, quantite: 10 }, { article_id: brique.id, quantite: 20 }],
    }));
    out.numero = numero;
    out.bon = await db.get('SELECT * FROM transferts_stock WHERE numero = ?', [numero]);
    out.lignes = await db.getAll('SELECT code, quantite, cout_unitaire, montant FROM lignes_transfert_stock WHERE transfert_id = ? ORDER BY code', [out.bon.id]);
    out.apresEnvoi = (await db.get('SELECT quantite FROM stocks WHERE article_id = ? AND depot_id = ?', [ciment.id, principal.id])).quantite;
    // Pendant le trajet, la marchandise n'est entrée nulle part.
    out.stockBkePendant = (await db.get('SELECT COUNT(*) AS n FROM stocks WHERE filiale_id = ?', [BKE])).n;

    let refusReception = false;
    try { await repo.recevoir(ctxAbj, out.bon.id, principal.id); } catch (e) { refusReception = /destinataire/.test(e.message); }
    out.refusReception = refusReception;
    let refusAnnulation = false;
    try { await repo.annuler(ctxBke, out.bon.id, 'essai'); } catch (e) { refusAnnulation = /expéditrice/.test(e.message); }
    out.refusAnnulation = refusAnnulation;

    const recu = await repo.recevoir(ctxBke, out.bon.id, dBke);
    out.articlesCrees = recu.articlesCrees;
    out.bonRecu = await db.get('SELECT statut, depot_destination_id, date_reception FROM transferts_stock WHERE id = ?', [out.bon.id]);
    out.stockBke = await db.getAll('SELECT a.code, s.quantite, s.cout_moyen FROM stocks s JOIN articles a ON a.id = s.article_id WHERE s.filiale_id = ? ORDER BY a.code', [BKE]);
    out.catalogueBke = await db.getAll('SELECT code, designation, prix_achat, prix_vente FROM articles WHERE filiale_id = ? ORDER BY code', [BKE]);
    let refusDouble = false;
    try { await repo.recevoir(ctxBke, out.bon.id, dBke); } catch (e) { refusDouble = /déjà/.test(e.message); }
    out.refusDouble = refusDouble;

    // Annulation d'un bon resté en transit : la marchandise rentre au dépôt.
    const numeroAnnule = await repo.envoyer(ctxAbj, transfertFilialeStockSchema.parse({
      filiale_destination_id: BKE, depot_source_id: principal.id, motif: 'Erreur de saisie',
      lignes: [{ article_id: ciment.id, quantite: 5 }],
    }));
    const bon2 = await db.get('SELECT * FROM transferts_stock WHERE numero = ?', [numeroAnnule]);
    out.avantAnnulation = (await db.get('SELECT quantite FROM stocks WHERE article_id = ? AND depot_id = ?', [ciment.id, principal.id])).quantite;
    await repo.annuler(ctxAbj, bon2.id, 'Camion non parti');
    out.bonAnnule = await db.get('SELECT statut, motif FROM transferts_stock WHERE id = ?', [bon2.id]);
    out.apresAnnulation = (await db.get('SELECT quantite FROM stocks WHERE article_id = ? AND depot_id = ?', [ciment.id, principal.id])).quantite;
    return out;
  }, { F: filialeId, U: userId });

  verifier(/^TSF-[A-HJ-NP-Z2-9]{3}-\d{8}-[A-HJ-NP-Z2-9]{6}$/.test(t.numero), `bon de transfert numéroté hors ligne (${t.numero})`);
  verifier(t.bon.statut === 'EN_TRANSIT' && t.apresEnvoi === t.avantEnvoi - 10, 'envoi : la marchandise quitte le dépôt de départ tout de suite');
  verifier(t.stockBkePendant === 0, 'en transit : la marchandise n’est entrée dans aucun dépôt de la filiale destinataire');
  // Ciment : 10 × 4 500 (coût moyen du dépôt) ; briques : 20 × 450.
  verifier(t.bon.nombre_lignes === 2 && t.bon.quantite_totale === 30 && t.bon.valeur_totale === 54000, `en-tête : 2 lignes, 30 unités, 54 000 F (${t.bon.valeur_totale})`);
  verifier(t.lignes[0].code === 'BRQ-15' && t.lignes[0].cout_unitaire === 450 && t.lignes[1].cout_unitaire === 4500, 'lignes : le coût moyen du dépôt de départ voyage avec la marchandise');
  verifier(t.refusReception, 'seule la filiale destinataire peut réceptionner');
  verifier(t.refusAnnulation, 'seule la filiale expéditrice peut annuler');
  verifier(t.bonRecu.statut === 'RECU' && t.bonRecu.date_reception, 'réception : bon soldé, dépôt d’arrivée renseigné');
  verifier(t.stockBke.length === 2 && t.stockBke[0].quantite === 20 && t.stockBke[0].cout_moyen === 450, 'réception : la marchandise entre au coût qui a voyagé avec elle');
  verifier(t.articlesCrees.length === 2 && t.catalogueBke.length === 2, `catalogue : les articles inconnus de la filiale sont créés par la réception (${t.articlesCrees.join(', ')})`);
  verifier(t.catalogueBke[1].code === 'CIM-50' && t.catalogueBke[1].prix_vente === 5500 && t.catalogueBke[1].prix_achat === 4500,
    'catalogue : l’article créé reprend le prix de vente de l’expéditeur, jamais 0 F');
  verifier(t.refusDouble, 'un bon déjà reçu ne se réceptionne pas deux fois');
  verifier(t.bonAnnule.statut === 'ANNULE' && /Erreur de saisie — Annulé/.test(t.bonAnnule.motif), 'annulation : motif d’origine conservé');
  verifier(t.apresAnnulation === t.avantAnnulation + 5, 'annulation : la marchandise rentre au dépôt de départ');

  console.log('Transfert entre filiales : écran, bon imprimé, export');
  await sousMenu.getByRole('link', { name: 'Transfert entre filiales' }).click();
  await page.waitForURL(/#\/stock\/transfert-filiale$/);
  // L'onglet s'ouvre sur la saisie ; l'historique des bons est l'autre face.
  await page.locator('main').getByTestId('vue-historique').click();
  const compteurTransferts = page.getByTestId('compteur-transferts');
  await compteurTransferts.waitFor();
  // La requête vivante arrive après le premier rendu : lire le compteur tout de
  // suite, c'est photographier la liste vide d'avant. Et le tableau de saisie a
  // lui aussi un `tbody` : seules les lignes de l'historique se comptent.
  const lignesHistorique = (n) => page.waitForFunction((attendu) => document.querySelectorAll('[data-testid^="bon-transfert-"]').length === attendu, n);
  await lignesHistorique(2);
  const resumeTransferts = async () => (await compteurTransferts.textContent()).replace(/\s+/g, ' ');
  verifier((await resumeTransferts()).includes('2 bon(s)'), `historique : les deux bons de la filiale (${await resumeTransferts()})`);

  await page.getByTestId('filtre-statut-transfert').selectOption('RECU');
  await lignesHistorique(1);
  verifier((await resumeTransferts()).includes('1 bon(s)'), 'filtre par statut : seuls les bons reçus');

  await page.getByTestId(`imprimer-transfert-${t.numero}`).click();
  const bonTransfertFiliale = page.locator('#zone-impression');
  await bonTransfertFiliale.locator('[data-testid=ligne-transfert]').first().waitFor();
  const papierTsf = (await bonTransfertFiliale.textContent()).replace(/\s+/g, ' ');
  verifier(papierTsf.includes('Bon de transfert de stock inter-filiales'), 'bon : titre du document');
  verifier(papierTsf.includes(`Bon n° ${t.numero}`) && papierTsf.includes('Filiale Abidjan') && papierTsf.includes('Filiale Bouaké'), 'bon : numéro, expéditeur et destinataire');
  verifier(papierTsf.includes('Principal') && papierTsf.includes('Dépôt Bouaké'), 'bon : dépôt de départ et dépôt d’arrivée');
  verifier(papierTsf.includes('Kouassi — 1234 CI') && papierTsf.includes('Appro. Bouaké'), 'bon : transporteur et motif');
  verifier((await bonTransfertFiliale.locator('[data-testid=ligne-transfert]').count()) === 2, 'bon : les deux articles transférés');
  verifier((await bonTransfertFiliale.getByTestId('transfert-total').textContent()).replace(/\s/g, '') === '54000F', 'bon : total au coût de départ');
  verifier((await bonTransfertFiliale.locator('.document-cachet').count()) === 2, 'bon : un cachet pour chaque filiale, comme sur le papier');
  verifier((await bonTransfertFiliale.locator('svg.code-barres rect').count()) > 20, 'bon : code-barres du numéro de pièce');
  verifier(!papierTsf.includes('Suivi de stock') && !papierTsf.includes('Consolidation'), 'bon : ni menu ni onglets de l’application');
  await bonTransfertFiliale.getByRole('button', { name: "Fermer l'aperçu" }).click();

  await page.getByTestId('filtre-statut-transfert').selectOption('');
  await lignesHistorique(2);
  const telechargementTsf = page.waitForEvent('download');
  await page.getByTestId('exporter-transferts').click();
  const fichierTsf = await telechargementTsf;
  const classeurTsf = require('xlsx').readFile(await fichierTsf.path());
  const feuilleTsf = require('xlsx').utils.sheet_to_json(classeurTsf.Sheets[classeurTsf.SheetNames[0]]);
  verifier(/^transferts-filiales-\d{4}-\d{2}-\d{2}\.xlsx$/.test(fichierTsf.suggestedFilename()), `export Excel : fichier ${fichierTsf.suggestedFilename()}`);
  const envoi = feuilleTsf.find((l) => l['Bon n°'] === t.numero);
  verifier(feuilleTsf.length === 2 && envoi.Sens === 'Envoi' && envoi.Statut === 'Reçu' && envoi.Valeur === 54000 && envoi.Articles === 2,
    'export Excel : sens, statut et valeur relus depuis le classeur');

  verifier(erreurs.length === 0, `aucune erreur console${erreurs.length ? ' : ' + erreurs.join(' | ') : ''}`);
  await browser.close();
  console.log('OK');
})().catch((e) => { console.error(e.message); process.exit(1); });
