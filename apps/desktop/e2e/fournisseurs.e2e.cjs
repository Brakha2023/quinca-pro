// Scénario Fournisseurs : achat réceptionné (stock + dette) et paiement (caisse) sur la base locale, puis UI.
const { ouvrirNavigateur, simulerSession, verifier, BASE_URL } = require('./browser.cjs');

(async () => {
  const { browser, page, erreurs } = await ouvrirNavigateur();
  const { filialeId, userId } = await simulerSession(page);

  console.log('Repository (base locale)');
  const r = await page.evaluate(async ({ F, U }) => {
    const { db } = await import('/src/infrastructure/powersync/database.ts');
    const { FournisseursRepository } = await import('/src/infrastructure/powersync/repositories/FournisseursRepository.ts');
    const { DepotsRepository } = await import('/src/infrastructure/powersync/repositories/DepotsRepository.ts');
    const { ArticlesRepository } = await import('/src/infrastructure/powersync/repositories/ArticlesRepository.ts');
    const { articleFormSchema } = await import('/src/core/articles/index.ts');
    const { fournisseurFormSchema, achatSchema, reglementFournisseurSchema } = await import('/src/core/fournisseurs/index.ts');
    await db.execute("INSERT OR REPLACE INTO caisses (id, code, nom, filiale_id, solde_actuel, est_active) VALUES ('caisse-1', 'C01', 'Caisse principale', ?, 100000, 1)", [F]);
    const depotId = await new DepotsRepository(db).create(F, { code: 'DEP-01', nom: 'Dépôt principal', adresse: '', responsable: '' });
    const a1 = await new ArticlesRepository(db).create(F, articleFormSchema.parse({ code: 'CIM-50', designation: 'Ciment 50kg', prix_achat: 4500, prix_vente: 5500 }));
    const repo = new FournisseursRepository(db);
    const ctx = { filialeId: F, utilisateurId: U };
    const fid = await repo.create(F, fournisseurFormSchema.parse({ raison_sociale: 'SODIPRO', telephone: '2721', solde_initial: 20000 }));
    const { numero } = await repo.enregistrerAchat(ctx, achatSchema.parse({ fournisseur_id: fid, depot_id: depotId, reference: 'FAC-2026-77', tva_percent: 0, lignes: [{ article_id: a1, quantite: 100, cout_unitaire: 4500 }] }));
    const f1 = await db.get('SELECT cumul_factures, solde_actuel FROM fournisseurs WHERE id = ?', [fid]);
    const stock = await db.get('SELECT quantite, cout_moyen FROM stocks WHERE article_id = ?', [a1]);
    const mvt = await db.get('SELECT type, reference FROM mouvements_stock WHERE article_id = ?', [a1]);
    const achat = await db.get('SELECT id, statut, total_ttc, reste_a_payer FROM commandes_fournisseurs WHERE numero = ?', [numero]);
    await repo.enregistrerReglement(ctx, fid, reglementFournisseurSchema.parse({ montant: 300000, type_reglement: 'ESPECES', caisse_id: 'caisse-1', commande_id: achat.id }));
    const f2 = await db.get('SELECT cumul_reglements, solde_actuel FROM fournisseurs WHERE id = ?', [fid]);
    const achat2 = await db.get('SELECT montant_paye, reste_a_payer FROM commandes_fournisseurs WHERE id = ?', [achat.id]);
    const caisse = await db.get('SELECT solde_actuel FROM caisses WHERE id = ?', ['caisse-1']);
    const treso = await db.getAll("SELECT type, categorie, montant FROM mouvements_tresorerie WHERE filiale_id = ?", [F]);
    return { numero, f1, stock, mvt, achat, f2, achat2, caisse: caisse.solde_actuel, treso, fid };
  }, { F: filialeId, U: userId });

  verifier(r.numero === 'FAC-2026-77' && r.f1.cumul_factures === 450000 && r.f1.solde_actuel === 470000, 'achat : dette = ouverture 20 000 + 450 000');
  verifier(r.stock.quantite === 100 && r.stock.cout_moyen === 4500 && r.mvt.type === 'ENTREE_ACHAT' && r.mvt.reference === 'FAC-2026-77', 'stock entré au coût d’achat, mouvement référencé');
  verifier(r.achat.statut === 'LIVREE' && r.achat.total_ttc === 450000 && r.achat.reste_a_payer === 450000, 'pièce d’achat LIVREE');
  verifier(r.f2.cumul_reglements === 300000 && r.f2.solde_actuel === 170000, 'règlement : dette réduite');
  verifier(r.achat2.montant_paye === 300000 && r.achat2.reste_a_payer === 150000, 'achat partiellement payé');
  verifier(r.caisse === -200000, 'caisse débitée (100 000 − 300 000 = −200 000 : alerte affichée dans l’UI)');
  verifier(r.treso.length === 1 && r.treso[0].type === 'DEPENSE' && r.treso[0].categorie === 'REGLEMENT_FOURNISSEUR', 'dépense de trésorerie journalisée');

  console.log('Interface');
  await page.goto(`${BASE_URL}/#/fournisseurs`);
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('tbody tr', { hasText: 'SODIPRO' }).waitFor();
  await page.locator('tbody tr', { hasText: 'SODIPRO' }).getByTitle('Fiche fournisseur').click();
  await page.getByRole('dialog').locator('td', { hasText: 'FAC-2026-77' }).waitFor();
  verifier(true, 'fiche fournisseur : achat listé');
  await page.getByRole('dialog').getByRole('button', { name: 'Réceptionner un achat' }).click();
  await page.locator('input[placeholder^="Ajouter un article"]').fill('cim');
  await page.locator('ul li button', { hasText: 'CIM-50' }).click();
  await page.locator('tbody input[type=number]').first().fill('20');
  await page.getByRole('button', { name: 'Réceptionner', exact: true }).click();
  await page.locator('[aria-live]', { hasText: 'réceptionné' }).waitFor();
  verifier(true, 'achat saisi via l’UI');
  await page.keyboard.press('Escape');
  await page.locator('tbody tr', { hasText: 'SODIPRO' }).locator('text=260 000 F').waitFor();
  verifier(true, 'dette mise à jour en temps réel (170 000 + 90 000)');

  verifier(erreurs.length === 0, `aucune erreur console${erreurs.length ? ' : ' + erreurs.join(' | ') : ''}`);
  await browser.close();
  console.log('OK');
})().catch((e) => { console.error(e.message); process.exit(1); });
