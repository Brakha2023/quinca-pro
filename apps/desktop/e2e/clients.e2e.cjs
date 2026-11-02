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
    await db.execute("INSERT OR REPLACE INTO depots (id, code, nom, filiale_id, est_actif) VALUES ('depot-1', 'DEP-01', 'Dépôt principal', ?, 1)", [F]);
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

    // Proforma → facture au point de vente (la vente clôture la proforma dans la même transaction).
    const { ProformasRepository } = await import('/src/infrastructure/powersync/repositories/ProformasRepository.ts');
    const { VentesRepository } = await import('/src/infrastructure/powersync/repositories/VentesRepository.ts');
    const { StockRepository } = await import('/src/infrastructure/powersync/repositories/StockRepository.ts');
    const { ArticlesRepository } = await import('/src/infrastructure/powersync/repositories/ArticlesRepository.ts');
    const { articleFormSchema } = await import('/src/core/articles/index.ts');
    const { proformaSchema } = await import('/src/core/ventes/index.ts');
    const { lettrerVersements, clientFromRow } = await import('/src/core/clients/index.ts');
    const a1 = await new ArticlesRepository(db).create(F, articleFormSchema.parse({ code: 'CIM-50', designation: 'Ciment 50kg', prix_achat: 4500, prix_vente: 5500, tva: 0 }));
    await new StockRepository(db).enregistrerEntree(ctx, { depot_id: 'depot-1', type: 'ENTREE_ACHAT', reference: '', motif: '', lignes: [{ article_id: a1, quantite: 50, cout_unitaire: 4500 }] });
    const proformas = new ProformasRepository(db);
    const pro = await proformas.enregistrer(ctx, proformaSchema.parse({ client_id: id, remise_percent: 0, lignes: [{ article_id: a1, code: 'CIM-50', designation: 'Ciment 50kg', unite: 'SAC', prix_unitaire_ttc: 5500, tva_percent: 0, quantite: 10, remise_percent: 0 }] }));
    const pro1 = await db.get('SELECT statut, total_ttc FROM proformas WHERE id = ?', [pro.id]);
    const stockAvant = (await db.get('SELECT quantite FROM stocks WHERE article_id = ?', [a1])).quantite;
    const client = clientFromRow(await db.get('SELECT * FROM clients WHERE id = ?', [id]));
    const ventes = new VentesRepository(db);
    const vctx = { ...ctx, caisseId: 'caisse-1', caisseCode: 'C01', depotId: 'depot-1', proformaId: pro.id };
    const lignes = [{ article_id: a1, code: 'CIM-50', designation: 'Ciment 50kg', unite: 'SAC', prix_unitaire_ttc: 5500, tva_percent: 0, quantite: 10, remise_percent: 0 }];
    const vente = await ventes.enregistrer(vctx, { lignes, remise_globale_percent: 0, client, paiement: { mode_paiement: 'CREDIT', montant_percu: 0 }, livraison: null, notes: '' });
    const pro2 = await db.get('SELECT statut, vente_id FROM proformas WHERE id = ?', [pro.id]);
    const stockApres = (await db.get('SELECT quantite FROM stocks WHERE article_id = ?', [a1])).quantite;
    const c3 = await db.get('SELECT solde_actuel FROM clients WHERE id = ?', [id]);
    let refacturee = false;
    try { await ventes.enregistrer(vctx, { lignes, remise_globale_percent: 0, client: clientFromRow(await db.get('SELECT * FROM clients WHERE id = ?', [id])), paiement: { mode_paiement: 'CREDIT', montant_percu: 0 }, livraison: null, notes: '' }); }
    catch (e) { refacturee = /déjà été facturée/.test(e.message); }
    const nbVentes = (await db.get('SELECT COUNT(*) AS n FROM ventes')).n;
    // Lettrage : les deux avances (30 000 + 25 000) couvrent la vente à crédit de 55 000 − solde initial… ici la vente de 55 000.
    const lettrage = lettrerVersements(await db.getAll('SELECT id, date_reglement, montant, vente_id FROM reglements_clients WHERE client_id = ?', [id]), await db.getAll('SELECT id, date_vente, total_ttc, reste_a_payer, statut FROM ventes WHERE client_id = ?', [id]));
    return { code: c0.code, soldeInitial: c0.solde_actuel, numero, c1, c2: c2.solde_actuel, caisse: caisse.solde_actuel, treso, clientId: id,
      pro1, stockAvant, pro2, venteId: vente.id, stockApres, c3: c3.solde_actuel, refacturee, nbVentes, lettrage };
  }, { F: filialeId, U: userId });

  verifier(/^CLI-[A-HJ-NP-Z2-9]{6}$/.test(r.code) && r.soldeInitial === 50000, `code auto ${r.code}, solde d'ouverture repris en créance`);
  verifier(/^REG-[A-HJ-NP-Z2-9]{3}-\d{8}-[A-HJ-NP-Z2-9]{6}$/.test(r.numero) && r.c1.cumul_reglements === 30000 && r.c1.solde_actuel === 20000, 'règlement : cumul et créance mis à jour');
  verifier(r.c2 === -5000, 'second règlement → avoir de 5 000 (acompte)');
  verifier(r.caisse === 40000, 'seules les espèces alimentent la caisse (10 000 + 30 000), le chèque non');
  verifier(r.treso.length === 2 && r.treso.every((t) => t.type === 'RECETTE' && t.categorie === 'REGLEMENT_CLIENT'), '2 recettes de trésorerie journalisées');
  verifier(r.pro1.statut === 'EN_COURS' && r.pro1.total_ttc === 55000 && r.stockAvant === 50, 'proforma 10 × 5 500 = 55 000, sans effet sur le stock');
  verifier(r.pro2.statut === 'FACTUREE' && r.pro2.vente_id === r.venteId && r.stockApres === 40 && r.c3 === 50000, 'facturée à crédit : proforma FACTUREE, stock 50 → 40, créance −5 000 + 55 000 = 50 000');
  verifier(r.refacturee && r.nbVentes === 1, 'une proforma ne peut pas être facturée deux fois');
  verifier(r.lettrage.filter((v) => v.nature === 'AVANCE_PAYEE').every((v) => v.disponibilite === 0) && r.lettrage.reduce((s, v) => s + v.utilise, 0) === 55000, 'lettrage : les 2 avances (55 000) sont entièrement utilisées par la vente à crédit');

  console.log('Interface');
  await page.goto(`${BASE_URL}/#/clients`);
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('tbody tr', { hasText: 'SARL KONÉ' }).waitFor();
  await page.locator('tbody tr', { hasText: 'SARL KONÉ' }).locator('text=En cours').waitFor();
  verifier(true, 'statut de crédit affiché (créance 50 000 dans le plafond)');

  const sousMenu = page.locator('[data-testid=sous-menu-clients]');
  await sousMenu.waitFor();
  verifier((await sousMenu.locator('a').count()) === 6, 'sous-menu Clients : 6 sections');

  await sousMenu.getByRole('link', { name: 'Nouveau client' }).click();
  await page.getByRole('dialog', { name: 'Nouveau client' }).waitFor();
  await page.locator('#client-form input[name=raison_sociale]').fill('Client Test UI');
  await page.locator('#client-form input[name=email]').fill('pas-un-email');
  await page.getByRole('button', { name: 'Créer' }).click();
  await page.locator('#client-form p.text-red-600', { hasText: 'Email invalide' }).waitFor();
  verifier(true, 'validation email');
  await page.locator('#client-form input[name=email]').fill('client@test.ci');
  await page.locator('#client-form input[name=plafond_credit]').fill('100000');
  await page.locator('#client-form input[name=solde_initial]').fill('20000');
  await page.locator('[data-testid=sens-solde]').selectOption('AVANCE');
  await page.locator('#client-form input[name=remise_percent]').fill('5');
  await page.getByRole('button', { name: 'Créer' }).click();
  await page.waitForURL(/#\/clients\/compte\?id=/);
  await page.locator('[data-testid=compte-client-indicateurs]').waitFor();
  await page.locator('tbody tr', { hasText: 'Solde initial' }).locator('text=-20 000 F').waitFor();
  verifier(true, 'client créé (avance d’ouverture 20 000 → solde −20 000) puis compte client ouvert');

  await sousMenu.getByRole('link', { name: 'Répertoire' }).click();
  await page.locator('tbody tr', { hasText: 'Client Test UI' }).waitFor();
  await page.locator('tbody tr', { hasText: 'Client Test UI' }).getByTitle('Règlement / approvisionnement').click();
  await page.locator('#reglement-form input[name=montant]').fill('15000');
  await page.locator('#reglement-form select[name=caisse_id]').selectOption({ label: 'Caisse principale' });
  await page.getByRole('button', { name: 'Encaisser', exact: true }).click();
  await page.locator('[aria-live]', { hasText: 'Règlement REG-' }).waitFor();
  await page.locator('tbody tr', { hasText: 'Client Test UI' }).locator('text=-35 000 F').waitFor();
  verifier(true, 'règlement encaissé via l’UI, solde mis à jour en temps réel (−20 000 − 15 000)');

  await page.locator('tbody tr', { hasText: 'SARL KONÉ' }).getByTitle('Fiche client').click();
  await page.getByRole('dialog').locator('td', { hasText: 'CHQ 123' }).waitFor();
  await page.getByRole('dialog').locator('[data-testid=factures-client] tbody tr').first().waitFor();
  verifier(true, 'fiche client : factures et règlements listés');
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: 'Imprimer le tableau' }).click();
  await page.locator('#zone-impression .document-titre', { hasText: 'Situation des comptes clients' }).waitFor();
  verifier((await page.locator('#zone-impression tbody tr').count()) === 2, 'tableau des comptes clients : aperçu imprimable');
  await page.keyboard.press('Escape');

  await sousMenu.getByRole('link', { name: 'Historique des versements' }).click();
  await page.locator('tbody tr', { hasText: 'Avance payée' }).first().waitFor();
  await page.locator('[data-testid=select-client]').selectOption(r.clientId);
  await page.locator('tbody tr', { hasText: 'Client Test UI' }).first().waitFor({ state: 'detached' });
  await page.locator('tbody tr', { hasText: 'CHQ 123' }).waitFor();
  verifier((await page.locator('tbody tr', { hasText: 'Avance payée' }).count()) === 2, 'versements de SARL KONÉ : 2 avances lettrées');
  await page.locator('tbody tr', { hasText: 'CHQ 123' }).getByTitle('Reçu de versement').click();
  await page.locator('#zone-impression .document-titre', { hasText: 'Reçu de versement' }).waitFor();
  verifier(true, 'reçu de versement imprimable');
  await page.keyboard.press('Escape');

  await sousMenu.getByRole('link', { name: 'Proforma à facture' }).click();
  await page.locator('tbody tr', { hasText: 'Facturée' }).waitFor();
  await page.getByRole('button', { name: 'Nouvelle proforma' }).click();
  await page.getByRole('dialog', { name: 'Nouvelle proforma' }).waitFor();
  await page.getByRole('dialog').locator('[data-testid=select-client]').selectOption(r.clientId);
  await page.locator('input[placeholder^="Ajouter un article à la proforma"]').fill('cim');
  await page.locator('ul li button', { hasText: 'CIM-50' }).click();
  await page.locator('[data-testid=proforma-lignes] input[type=number]').first().fill('3');
  await page.getByRole('button', { name: 'Créer la proforma' }).click();
  await page.locator('[aria-live]', { hasText: 'Proforma PRO-' }).waitFor();
  await page.locator('tbody tr', { hasText: 'En cours' }).waitFor();
  verifier(true, 'proforma créée via l’UI (3 × 5 500)');
  await page.locator('tbody tr', { hasText: 'En cours' }).getByTitle('Imprimer').click();
  await page.locator('#zone-impression .document-titre', { hasText: 'Facture proforma' }).waitFor();
  await page.locator('#zone-impression', { hasText: 'SARL KONÉ' }).locator('text=16 500 F').first().waitFor();
  verifier(true, 'proforma imprimable : client et net à payer 16 500');
  await page.keyboard.press('Escape');
  await page.locator('tbody tr', { hasText: 'En cours' }).getByTitle('Facturer au point de vente').click();
  await page.waitForURL(/#\/pos$/);
  // Premier passage au point de vente sur ce poste : réglages caisse/dépôt.
  await page.getByRole('dialog', { name: 'Réglages du poste de vente' }).waitFor();
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await page.locator('[data-testid=bandeau-proforma]').waitFor();
  await page.locator('[data-testid=ticket-lignes]').locator('text=Ciment 50kg').waitFor();
  verifier(true, 'facturation : ticket chargé au point de vente avec le bandeau proforma');
  await page.keyboard.press('F11');
  await page.getByRole('dialog', { name: 'Encaissement' }).waitFor();
  await page.getByRole('button', { name: 'Valider la vente' }).click();
  await page.getByRole('dialog', { name: 'Vente enregistrée' }).waitFor();
  await page.keyboard.press('Escape');
  await page.goto(`${BASE_URL}/#/clients/proformas`);
  await page.locator('tbody tr', { hasText: 'Facturée' }).nth(1).waitFor();
  verifier((await page.locator('tbody tr', { hasText: 'En cours' }).count()) === 0, 'proforma passée « Facturée » après l’encaissement');

  await sousMenu.getByRole('link', { name: 'Relance clients' }).click();
  await page.locator('[data-testid=liste-debiteurs] button', { hasText: 'SARL KONÉ' }).click();
  await page.locator('textarea', { hasText: /restent impayées/ }).waitFor();
  const corps = await page.locator('textarea').inputValue();
  verifier(corps.includes('Bonjour SARL KONÉ') && /C01-[A-HJ-NP-Z2-9]{3}-\d{8}-[A-HJ-NP-Z2-9]{6} du/.test(corps) && corps.includes('solde de votre compte'), 'relance : e-mail composé avec la facture impayée et le solde');

  await page.goto(`${BASE_URL}/#/pos`);
  await page.locator('button', { hasText: 'Client comptoir' }).click();
  await page.locator('input[placeholder^="Rechercher un client"]').fill('test ui');
  await page.locator('button', { hasText: 'Client Test UI' }).click();
  await page.locator('text=Client Test UI').first().waitFor();
  await page.locator('[data-testid=remise-globale]').waitFor();
  // Le taux négocié reste au client ; le comptoir, lui, ne manipule que des
  // francs : 5 % d'un sac à 5 500 font 275 F, proposés d'office.
  verifier((await page.textContent('label[for=remise-vente]')).includes('5 % client'),
    'le taux négocié du client est rappelé au comptoir');
  await page.locator('button:has-text("CIM-50")').first().click();
  await page.waitForFunction(() => document.querySelector('[data-testid=remise-globale]').value === '275');
  verifier(true, 'remise client (5 %) convertie en francs sur le ticket');
  verifier(true, 'POS : sélection d’un client applique sa remise (5 %) d’office');

  console.log('Suppression d’une fiche client jamais utilisée');
  // Même règle que pour un article : la base du poste ne garde que douze mois
  // d'activité, c'est donc le serveur qui tranche. Son comptage est simulé ici
  // par interception REST — PostgREST le rend dans l'en-tête `Content-Range`.
  let usagesServeur = 0;
  const comptages = [];
  await page.route('**/rest/v1/{ventes,reglements_clients,proformas,livraisons,ventes_brouillons}*', (route) => {
    comptages.push(route.request().url());
    route.fulfill({ status: 200, headers: { 'content-range': `*/${usagesServeur}`, 'access-control-allow-origin': '*', 'access-control-expose-headers': 'content-range' } });
  });

  // Deux fiches neuves : un doublon pur, et une autre dont le compte porte une
  // avance d'ouverture — l'argent suffit à retenir une fiche sans pièce.
  await page.evaluate(async (F) => {
    const { db } = await import('/src/infrastructure/powersync/database.ts');
    const { ClientsRepository } = await import('/src/infrastructure/powersync/repositories/ClientsRepository.ts');
    const { clientFormSchema } = await import('/src/core/clients/index.ts');
    const repo = new ClientsRepository(db);
    await repo.create(F, clientFormSchema.parse({ raison_sociale: 'Doublon à effacer' }));
    await repo.create(F, clientFormSchema.parse({ raison_sociale: 'Compte ouvert', solde_initial: 75000 }));
  }, filialeId);

  // Le scénario s'était terminé au comptoir : on revient au répertoire.
  await page.goto(`${BASE_URL}/#/clients`);
  await page.locator('tbody tr', { hasText: 'Doublon à effacer' }).waitFor();
  const corbeille = (nom) => page.locator('tbody tr', { hasText: nom }).getByTitle('Supprimer définitivement (fiches jamais utilisées)').click();
  const avis = (texte) => page.locator('[aria-live] > div', { hasText: texte });
  const boutonsRendus = () => page.waitForFunction(() => [...document.querySelectorAll('[data-testid^="supprimer-client-"]')].every((b) => !b.disabled));

  // SARL KONÉ a vendu et réglé : le poste tranche seul, sans déranger le serveur.
  await corbeille('SARL KONÉ');
  const refus = avis('SARL KONÉ');
  await refus.waitFor();
  await boutonsRendus();
  const texteRefus = (await refus.textContent()).replace(/\s+/g, ' ');
  verifier(texteRefus.includes('vente(s)') && texteRefus.includes('Désactivez-le'),
    `client utilisé : le refus dit ce qui le retient et quoi faire (${texteRefus.slice(0, 80)}…)`);
  verifier(comptages.length === 0, 'client utilisé : aucune requête au serveur, la réponse est locale');

  // Un compte à 75 000 F d'avance : aucune pièce, mais de l'argent.
  await corbeille('Compte ouvert');
  const refusCompte = avis('Compte ouvert');
  await refusCompte.waitFor();
  await boutonsRendus();
  verifier((await refusCompte.textContent()).includes('compte mouvementé') && comptages.length === 0,
    'compte non soldé : la fiche est retenue sans même interroger le serveur');

  // Le doublon, lui, n'a jamais servi : le serveur le confirme.
  await corbeille('Doublon à effacer');
  const confirmation = page.getByRole('dialog');
  await confirmation.waitFor();
  verifier((await confirmation.textContent()).includes('ne se défait pas'), 'fiche neuve : confirmation demandée, une fois la vérification faite');
  verifier(comptages.length === 5 && comptages.some((u) => /reglements_clients/.test(u)) && comptages.some((u) => /ventes_brouillons/.test(u)),
    `le serveur est interrogé sur toute l’activité du client (${comptages.length} comptages)`);
  await confirmation.getByRole('button', { name: 'Supprimer' }).click();
  await avis('supprimé').waitFor();
  await page.locator('tbody tr', { hasText: 'Doublon à effacer' }).waitFor({ state: 'detached' });
  verifier(true, 'client supprimé : la fiche quitte le répertoire');

  console.log('Hors ligne : on ne supprime pas, on le dit');
  const avantCoupure = comptages.length;
  await page.context().setOffline(true);
  await corbeille('Client Test UI');
  const horsLigne = avis('Client Test UI');
  await horsLigne.waitFor();
  await boutonsRendus();
  verifier(comptages.length === avantCoupure, 'hors ligne : aucune requête tentée');
  verifier(/désactivez la fiche|Désactivez-le/.test(await horsLigne.textContent()), 'hors ligne : le message renvoie à la mise en sommeil, qui marche sans réseau');
  await page.context().setOffline(false);

  verifier(erreurs.length === 0, `aucune erreur console${erreurs.length ? ' : ' + erreurs.join(' | ') : ''}`);
  await browser.close();
  console.log('OK');
})().catch((e) => { console.error(e.message); process.exit(1); });
