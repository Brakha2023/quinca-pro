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
    return out;
  }, { F: filialeId, U: userId });

  verifier(r.apresEntrees.quantite === 200 && r.apresEntrees.cout_moyen === 4500, 'entrées cumulées, coût moyen pondéré 4500');
  verifier(r.mouvementsFournisseur.length === 2 && r.mouvementsFournisseur.every((m) => m === 'ENTREE_ACHAT:SOCIMAT CI'), 'entrée : fournisseur enregistré sur chaque ligne et journal filtrable par fournisseur');
  verifier(r.retourSansFournisseur === null, 'retour client : aucune provenance fournisseur retenue');
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
  await page.goto(`${BASE_URL}/#/stock`);
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('main h1', { hasText: 'Gestion du stock' }).waitFor();
  await page.locator('tbody tr', { hasText: 'CIM-50' }).first().waitFor();
  verifier((await page.locator('tbody tr').count()) === 4, 'suivi : 4 lignes de stock (ciment × 2 dépôts, vis, brique produite)');

  await page.locator('main').getByRole('link', { name: 'Entrée', exact: true }).click();
  await page.locator('[data-testid=select-fournisseur]').selectOption({ index: 1 });
  await page.locator('input[placeholder^="Ajouter un article"]').fill('vis');
  await page.locator('ul li button', { hasText: 'VIS-50' }).click();
  await page.locator('tbody input[type=number]').first().fill('5');
  await page.getByRole('button', { name: "Valider l'entrée" }).click();
  await page.locator('[aria-live]', { hasText: 'Entrée ENT-' }).waitFor();
  verifier(true, 'entrée saisie via l’UI, fournisseur choisi');

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
  verifier(papier.includes('Total du bon') && papier.includes('12 500 F'), 'bon d’entrée : lignes valorisées et total');
  verifier(papier.includes('VIS-50') && papier.includes('+5'), 'bon d’entrée : ligne et quantité signée');
  verifier((await bon.locator('svg.code-barres rect').count()) > 20, 'bon d’entrée : code-barres de la référence');
  await bon.getByRole('button', { name: "Fermer l'aperçu" }).click();

  await page.locator('main').getByRole('link', { name: 'Mouvements', exact: true }).click();
  await page.locator('[data-testid=filtre-fournisseur]').selectOption({ label: 'SOCIMAT CI' });
  await page.locator('tbody tr').first().waitFor();
  const provenances = await page.locator('[data-testid=mouvement-fournisseur]').allTextContents();
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

  // Sous-menu Stock dans la barre latérale : les sections sont des routes.
  const sousMenu = page.locator('[data-testid=sous-menu-stock]');
  await sousMenu.waitFor();
  verifier((await sousMenu.locator('a').count()) === 8, 'sous-menu Stock : 8 sections dans la barre latérale');
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
  await page.getByRole('button', { name: 'Historique' }).click();
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

  await sousMenu.getByRole('link', { name: 'Alertes' }).click();
  await page.locator('text=Valeur du stock').waitFor();
  verifier(true, 'alertes affichées');

  verifier(erreurs.length === 0, `aucune erreur console${erreurs.length ? ' : ' + erreurs.join(' | ') : ''}`);
  await browser.close();
  console.log('OK');
})().catch((e) => { console.error(e.message); process.exit(1); });
