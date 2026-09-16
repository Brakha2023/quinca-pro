// Scénario Clients : règlement atomique sur la base locale, puis parcours UI.
const { ouvrirNavigateur, simulerSession, verifier, BASE_URL } = require('./browser.cjs');

(async () => {
  const { browser, page, erreurs } = await ouvrirNavigateur();
  const { filialeId, userId } = await simulerSession(page);

  console.log('Repository (base locale)');
  const r = await page.evaluate(async ({ F, U }) => {
    const { db } = await import('/src/infrastructure/powersync/database.ts');
    const { ClientsRepository } = await import('/src/infrastructure/powersync/repositories/ClientsRepository.ts');
    const { clientFormSchema, reglementFormSchema } = await import('/src/core/clients/index.ts');
    await db.execute("INSERT OR REPLACE INTO caisses (id, code, nom, filiale_id, solde_actuel, est_active) VALUES ('caisse-1', 'C01', 'Caisse principale', ?, 10000, 1)", [F]);
    const repo = new ClientsRepository(db);
    const ctx = { filialeId: F, utilisateurId: U };
    const id = await repo.create(F, clientFormSchema.parse({ raison_sociale: 'SARL KONÉ', mobile: '0707070707', solde_initial: 50000, plafond_credit: 200000 }));
    const c0 = await db.get('SELECT code, solde_actuel FROM clients WHERE id = ?', [id]);
    const numero = await repo.enregistrerReglement(ctx, id, reglementFormSchema.parse({ montant: 30000, type_reglement: 'ESPECES', caisse_id: 'caisse-1' }));
    const c1 = await db.get('SELECT cumul_reglements, solde_actuel FROM clients WHERE id = ?', [id]);
    await repo.enregistrerReglement(ctx, id, reglementFormSchema.parse({ montant: 25000, type_reglement: 'CHEQUE', caisse_id: 'caisse-1', reference: 'CHQ 123' }));
    const c2 = await db.get('SELECT solde_actuel FROM clients WHERE id = ?', [id]);
    const caisse = await db.get('SELECT solde_actuel FROM caisses WHERE id = ?', ['caisse-1']);
    const treso = await db.getAll("SELECT type, categorie, montant FROM mouvements_tresorerie WHERE filiale_id = ? ORDER BY created_at", [F]);
    return { code: c0.code, soldeInitial: c0.solde_actuel, numero, c1, c2: c2.solde_actuel, caisse: caisse.solde_actuel, treso, clientId: id };
  }, { F: filialeId, U: userId });

  verifier(/^CLI-[A-Z2-9]{5}$/.test(r.code) && r.soldeInitial === 50000, `code auto ${r.code}, solde d'ouverture repris en créance`);
  verifier(/^REG-\d{8}-[A-Z2-9]{4}$/.test(r.numero) && r.c1.cumul_reglements === 30000 && r.c1.solde_actuel === 20000, 'règlement : cumul et créance mis à jour');
  verifier(r.c2 === -5000, 'second règlement → avoir de 5 000 (acompte)');
  verifier(r.caisse === 40000, 'seules les espèces alimentent la caisse (10 000 + 30 000), le chèque non');
  verifier(r.treso.length === 2 && r.treso.every((t) => t.type === 'RECETTE' && t.categorie === 'REGLEMENT_CLIENT'), '2 recettes de trésorerie journalisées');

  console.log('Interface');
  await page.goto(`${BASE_URL}/#/clients`);
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('tbody tr', { hasText: 'SARL KONÉ' }).waitFor();
  verifier((await page.locator('tbody tr', { hasText: 'Avoir' }).count()) === 1, 'statut Avoir affiché');

  await page.getByRole('button', { name: 'Nouveau client' }).click();
  await page.locator('#client-form input[name=raison_sociale]').fill('Client Test UI');
  await page.locator('#client-form input[name=email]').fill('pas-un-email');
  await page.getByRole('button', { name: 'Créer' }).click();
  await page.locator('#client-form p.text-red-600', { hasText: 'Email invalide' }).waitFor();
  verifier(true, 'validation email');
  await page.locator('#client-form input[name=email]').fill('');
  await page.locator('#client-form input[name=plafond_credit]').fill('100000');
  await page.getByRole('button', { name: 'Créer' }).click();
  await page.locator('tbody tr', { hasText: 'Client Test UI' }).waitFor();
  verifier(true, 'client créé via formulaire');

  await page.locator('tbody tr', { hasText: 'Client Test UI' }).getByTitle('Encaisser un règlement').click();
  await page.locator('#reglement-form input[name=montant]').fill('15000');
  await page.locator('#reglement-form select[name=caisse_id]').selectOption({ label: 'Caisse principale' });
  await page.getByRole('button', { name: 'Encaisser', exact: true }).click();
  await page.locator('[aria-live]', { hasText: 'Règlement REG-' }).waitFor();
  await page.locator('tbody tr', { hasText: 'Client Test UI' }).locator('text=-15 000 F').waitFor();
  verifier(true, 'règlement encaissé via l’UI, créance mise à jour en temps réel');

  await page.locator('tbody tr', { hasText: 'SARL KONÉ' }).getByTitle('Fiche client').click();
  await page.getByRole('dialog').locator('td', { hasText: 'CHQ 123' }).waitFor();
  verifier((await page.getByRole('dialog').locator('tbody tr').count()) === 2, 'fiche client : 2 règlements listés');
  await page.keyboard.press('Escape');

  await page.goto(`${BASE_URL}/#/pos`);
  await page.locator('button', { hasText: 'Client Comptoir' }).click();
  await page.locator('input[placeholder^="Rechercher un client"]').fill('kon');
  await page.locator('button', { hasText: 'SARL KONÉ' }).click();
  await page.locator('text=SARL KONÉ').first().waitFor();
  verifier(true, 'POS : sélection d’un vrai client');

  verifier(erreurs.length === 0, `aucune erreur console${erreurs.length ? ' : ' + erreurs.join(' | ') : ''}`);
  await browser.close();
  console.log('OK');
})().catch((e) => { console.error(e.message); process.exit(1); });
