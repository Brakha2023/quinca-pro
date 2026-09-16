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

    await stock.enregistrerEntree(ctx, { depot_id: d1, type: 'ENTREE_ACHAT', reference: '', motif: 'BL 1', lignes: [{ article_id: a1, quantite: 100, cout_unitaire: 4000 }, { article_id: a2, quantite: 10, cout_unitaire: 2500 }] });
    await stock.enregistrerEntree(ctx, { depot_id: d1, type: 'ENTREE_ACHAT', reference: 'BL-2', motif: '', lignes: [{ article_id: a1, quantite: 100, cout_unitaire: 5000 }] });
    const s1 = await db.get('SELECT quantite, cout_moyen FROM stocks WHERE article_id = ? AND depot_id = ?', [a1, d1]);
    out.apresEntrees = s1; // 200 @ 4500

    try { await stock.enregistrerSortie(ctx, { depot_id: d1, type: 'CASSE', reference: '', motif: '', lignes: [{ article_id: a2, quantite: 11 }] }); out.sortieRefusee = false; }
    catch (e) { out.sortieRefusee = e.name === 'StockInsuffisantError'; }
    out.stockVisApresRefus = (await db.get('SELECT quantite FROM stocks WHERE article_id = ?', [a2])).quantite;

    await stock.transferer(ctx, { depot_source_id: d1, depot_destination_id: d2, reference: '', motif: '', lignes: [{ article_id: a1, quantite: 50 }] });
    out.apresTransfert = await db.getAll('SELECT d.code, s.quantite, s.cout_moyen FROM stocks s JOIN depots d ON d.id = s.depot_id WHERE s.article_id = ? ORDER BY d.code', [a1]);

    const inv = await stock.enregistrerInventaire(ctx, { depot_id: d1, reference: '', motif: '', lignes: [{ article_id: a1, quantite_comptee: 148 }, { article_id: a2, quantite_comptee: 10 }] });
    out.inventaire = inv.ecarts;
    out.apresInventaire = (await db.get('SELECT quantite FROM stocks WHERE article_id = ? AND depot_id = ?', [a1, d1])).quantite;
    out.mouvements = await db.getAll('SELECT type, quantite, quantite_avant, quantite_apres FROM mouvements_stock WHERE filiale_id = ? ORDER BY created_at', [F]);
    const q = stocksQuery(F, { alertesSeulement: true });
    out.alertes = (await db.getAll(q.sql, q.params)).map((l) => `${l.article_code}@${l.depot_code}:${l.quantite}`);
    return out;
  }, { F: filialeId, U: userId });

  verifier(r.apresEntrees.quantite === 200 && r.apresEntrees.cout_moyen === 4500, 'entrées cumulées, coût moyen pondéré 4500');
  verifier(r.sortieRefusee && r.stockVisApresRefus === 10, 'sortie > disponible refusée, stock intact');
  verifier(JSON.stringify(r.apresTransfert) === JSON.stringify([{ code: 'D1', quantite: 150, cout_moyen: 4500 }, { code: 'D2', quantite: 50, cout_moyen: 4500 }]), 'transfert D1→D2 au coût moyen');
  verifier(r.inventaire === 1 && r.apresInventaire === 148, 'inventaire : 1 écart régularisé (150 → 148)');
  verifier(r.mouvements.length === 6, `6 mouvements journalisés (${r.mouvements.map((m) => m.type).join(', ')})`);
  verifier(r.alertes.length === 0, 'aucune alerte (stocks au-dessus des minimums)');

  console.log('Interface');
  await page.goto(`${BASE_URL}/#/stock`);
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('main h1', { hasText: 'Gestion du stock' }).waitFor();
  await page.locator('tbody tr', { hasText: 'CIM-50' }).first().waitFor();
  verifier((await page.locator('tbody tr').count()) === 3, 'suivi : 3 lignes de stock (2 dépôts + vis)');

  await page.getByRole('button', { name: 'Entrée' }).click();
  await page.locator('input[placeholder^="Ajouter un article"]').fill('vis');
  await page.locator('ul li button', { hasText: 'VIS-50' }).click();
  await page.locator('tbody input[type=number]').first().fill('5');
  await page.getByRole('button', { name: "Valider l'entrée" }).click();
  await page.locator('[aria-live]', { hasText: 'Entrée ENT-' }).waitFor();
  verifier(true, 'entrée saisie via l’UI');

  await page.getByRole('button', { name: 'Mouvements' }).click();
  await page.locator('tbody tr', { hasText: 'Entrée achat' }).first().waitFor();
  verifier((await page.locator('tbody tr').count()) === 7, 'journal : 7 mouvements');

  await page.getByRole('button', { name: 'Alertes' }).click();
  await page.locator('text=Valeur du stock').waitFor();
  verifier(true, 'alertes affichées');

  verifier(erreurs.length === 0, `aucune erreur console${erreurs.length ? ' : ' + erreurs.join(' | ') : ''}`);
  await browser.close();
  console.log('OK');
})().catch((e) => { console.error(e.message); process.exit(1); });
