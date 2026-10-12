// Scénario Point de vente : vente atomique sur la base locale, puis parcours UI (F2, encaissement, ticket).
const { ouvrirNavigateur, simulerSession, verifier, BASE_URL } = require('./browser.cjs');

/** Texte d'un conteneur, espaces insécables des montants normalisés. */
const texteDe = async (locator) => (await locator.textContent()).replace(/\s+/g, ' ');

(async () => {
  const { browser, page, erreurs } = await ouvrirNavigateur();
  const { filialeId, userId } = await simulerSession(page);

  console.log('Repository (base locale)');
  const r = await page.evaluate(async ({ F, U }) => {
    const { db } = await import('/src/infrastructure/powersync/database.ts');
    const { VentesRepository } = await import('/src/infrastructure/powersync/repositories/VentesRepository.ts');
    const { StockRepository } = await import('/src/infrastructure/powersync/repositories/StockRepository.ts');
    const { DepotsRepository } = await import('/src/infrastructure/powersync/repositories/DepotsRepository.ts');
    const { ArticlesRepository } = await import('/src/infrastructure/powersync/repositories/ArticlesRepository.ts');
    const { ClientsRepository } = await import('/src/infrastructure/powersync/repositories/ClientsRepository.ts');
    const { articleFormSchema, articleFromRow } = await import('/src/core/articles/index.ts');
    const { clientFormSchema, clientFromRow } = await import('/src/core/clients/index.ts');

    await db.execute("INSERT OR REPLACE INTO caisses (id, code, nom, filiale_id, solde_actuel, est_active) VALUES ('caisse-1', 'C01', 'Caisse principale', ?, 0, 1)", [F]);
    const depotId = await new DepotsRepository(db).create(F, { code: 'DEP-01', nom: 'Dépôt principal', adresse: '', responsable: '' });
    const arts = new ArticlesRepository(db);
    const a1 = await arts.create(F, articleFormSchema.parse({ code: 'CIM-50', designation: 'Ciment 50kg', prix_achat: 4500, prix_vente: 5900, tva: 18, stock_min: 20 }));
    const a2 = await arts.create(F, articleFormSchema.parse({ code: 'ROB-01', designation: 'Robinet mitigeur', prix_achat: 8500, prix_vente: 11800, tva: 18, prix_vip: 10000 }));
    const stock = new StockRepository(db);
    await stock.enregistrerEntree({ filialeId: F, utilisateurId: U }, { depot_id: depotId, type: 'ENTREE_ACHAT', reference: 'BL-1', motif: '', lignes: [{ article_id: a1, quantite: 100, cout_unitaire: 4500 }, { article_id: a2, quantite: 3, cout_unitaire: 8500 }] });
    const clients = new ClientsRepository(db);
    const clientId = await clients.create(F, clientFormSchema.parse({ raison_sociale: 'SARL KONÉ', plafond_credit: 50000 }));
    const lireClient = async () => clientFromRow(await db.get('SELECT * FROM clients WHERE id = ?', [clientId]));
    const article = async (id) => articleFromRow(await db.get('SELECT * FROM articles WHERE id = ?', [id]));
    const ligne = (a, quantite, remise = 0) => ({ article_id: a.id, code: a.code, designation: a.designation, unite: a.unite, prix_unitaire_ttc: a.prix_vente, tva_percent: a.tva, quantite, remise_percent: remise });

    const ventes = new VentesRepository(db);
    const ctx = { filialeId: F, utilisateurId: U, caisseId: 'caisse-1', caisseCode: 'C01', depotId };
    const out = {};

    // 1. Comptoir, espèces avec monnaie
    const v1 = await ventes.enregistrer(ctx, { lignes: [ligne(await article(a1), 10)], remise_globale_percent: 0, client: null, paiement: { mode_paiement: 'ESPECES', montant_percu: 60000 }, livraison: null, notes: '' });
    out.v1 = { numero: v1.preparee.numero, ttc: v1.preparee.totaux.total_ttc, monnaie: v1.preparee.monnaie };
    out.stockApresV1 = (await db.get('SELECT quantite FROM stocks WHERE article_id = ?', [a1])).quantite;
    out.caisseApresV1 = (await db.get('SELECT solde_actuel FROM caisses WHERE id = ?', ['caisse-1'])).solde_actuel;

    // 2. Crédit dans le plafond, avec livraison
    const v2 = await ventes.enregistrer(ctx, { lignes: [ligne(await article(a2), 2)], remise_globale_percent: 0, client: await lireClient(), paiement: { mode_paiement: 'CREDIT', montant_percu: 0 }, livraison: { adresse_livraison: 'Cocody', date_livraison_prevue: '2026-09-20', chauffeur: '', vehicule: '' }, notes: '' });
    out.v2 = { ttc: v2.preparee.totaux.total_ttc, reste: v2.preparee.reste_a_payer };
    out.clientApresV2 = await lireClient();
    out.livraison = await db.get('SELECT statut, adresse_livraison FROM livraisons WHERE vente_id = ?', [v2.id]);

    // 3. Crédit hors plafond → refusé, rien n'est écrit
    try { await ventes.enregistrer(ctx, { lignes: [ligne(await article(a1), 10)], remise_globale_percent: 0, client: await lireClient(), paiement: { mode_paiement: 'CREDIT', montant_percu: 0 }, livraison: null, notes: '' }); out.refus = 'NON'; }
    catch (e) { out.refus = e.name; }
    out.nbVentes = (await db.get('SELECT count(*) AS n FROM ventes')).n;

    // 4. Stock insuffisant → refusé (3 robinets, 2 vendus → 1 dispo)
    try { await ventes.enregistrer(ctx, { lignes: [ligne(await article(a2), 2)], remise_globale_percent: 0, client: null, paiement: { mode_paiement: 'ESPECES', montant_percu: 30000 }, livraison: null, notes: '' }); out.refusStock = 'NON'; }
    catch (e) { out.refusStock = e.name; }
    // … sauf si forcé par un gérant
    const v4 = await ventes.enregistrer({ ...ctx, autoriserStockNegatif: true }, { lignes: [ligne(await article(a2), 2)], remise_globale_percent: 10, client: null, paiement: { mode_paiement: 'MOBILE_MONEY', montant_percu: 21240 }, livraison: null, notes: '' });
    out.stockRobinetForce = (await db.get('SELECT quantite FROM stocks WHERE article_id = ?', [a2])).quantite;
    out.v4ttc = v4.preparee.totaux.total_ttc;

    // 5. Annulation de la vente à crédit : stock, client, livraison contre-passés
    await ventes.annuler({ filialeId: F, utilisateurId: U }, v2.id, 'Erreur de saisie');
    out.apresAnnulation = { client: (await lireClient()).solde_actuel, statut: (await db.get('SELECT statut FROM ventes WHERE id = ?', [v2.id])).statut, livraison: (await db.get('SELECT statut FROM livraisons WHERE vente_id = ?', [v2.id])).statut, stockRobinet: (await db.get('SELECT quantite FROM stocks WHERE article_id = ?', [a2])).quantite };

    // 6. Validation de journée
    out.validees = await ventes.valider([v1.id, v2.id, v4.id]);
    out.treso = await db.getAll("SELECT type, categorie, montant FROM mouvements_tresorerie WHERE filiale_id = ? ORDER BY created_at", [F]);
    return out;
  }, { F: filialeId, U: userId });

  verifier(/^C01-\d{8}-[A-Z2-9]{4}$/.test(r.v1.numero) && r.v1.ttc === 59000 && r.v1.monnaie === 1000, `vente comptoir ${r.v1.numero} : 59 000 F, monnaie 1 000`);
  verifier(r.stockApresV1 === 90 && r.caisseApresV1 === 59000, 'stock −10 et caisse +59 000');
  verifier(r.v2.ttc === 23600 && r.v2.reste === 23600 && r.clientApresV2.solde_actuel === 23600 && r.clientApresV2.cumul_factures === 23600, 'vente à crédit : créance client 23 600');
  verifier(r.livraison?.statut === 'A_PREPARER' && r.livraison.adresse_livraison === 'Cocody', 'bon de livraison créé');
  verifier(r.refus === 'VenteInvalideError' && r.nbVentes === 2, 'crédit hors plafond refusé, rien écrit');
  verifier(r.refusStock === 'StockInsuffisantError' && r.stockRobinetForce === -1 && r.v4ttc === 21240, 'stock insuffisant refusé, vente forcée par gérant → stock −1, remise 10 % appliquée');
  verifier(r.apresAnnulation.client === 0 && r.apresAnnulation.statut === 'ANNULEE' && r.apresAnnulation.livraison === 'ANNULEE' && r.apresAnnulation.stockRobinet === 1, 'annulation : créance, livraison et stock contre-passés');
  verifier(r.validees === 2, 'validation de journée : 2 ventes en attente validées (l’annulée ignorée)');
  verifier(r.treso.length === 2 && r.treso.every((t) => t.type === 'RECETTE' && t.categorie === 'VENTE'), '2 recettes de trésorerie (ventes encaissées)');

  console.log('Interface');
  await page.goto(`${BASE_URL}/#/pos`);
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('dialog', { name: 'Réglages du poste de vente' }).waitFor();
  verifier((await page.getByTestId('format-impression').inputValue()) === 'TICKET', 'poste : impression par défaut en ticket');
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await page.locator('input[type=search]').waitFor();
  verifier(true, 'poste configuré (caisse + dépôt mémorisés)');

  await page.keyboard.press('F2');
  await page.keyboard.type('cim');
  await page.keyboard.press('Enter');
  const ticket = page.locator('[data-testid=ticket-lignes]');
  await ticket.locator('text=Ciment 50kg').waitFor();
  await page.locator('button:has-text("CIM-50")').click();
  await ticket.locator('input[type=number][value="2"]').waitFor();
  verifier(true, 'F2 + Entrée ajoute l’article, second clic cumule (qté 2)');

  await page.keyboard.press('F11');
  await page.getByRole('dialog', { name: 'Encaissement' }).waitFor();
  await page.locator('input[type=number]').last().fill('12000');
  await page.getByRole('button', { name: 'Valider la vente' }).click();
  await page.getByRole('dialog', { name: 'Vente enregistrée' }).waitFor();
  verifier((await page.textContent('[role=dialog]')).includes('Rendu'), 'encaissement espèces avec rendu monnaie');
  verifier((await page.locator('#zone-impression.ticket').count()) === 1, 'ticket imprimable rendu (format du poste)');

  // L'impression système est remplacée par un témoin : en test, aucune boîte d'impression ne doit s'ouvrir.
  await page.evaluate(() => { window.__impressions = []; window.print = () => window.__impressions.push(document.querySelector('#zone-impression')?.className ?? ''); });
  await page.getByTestId('imprimer-facture-a4').click();
  const facture = page.locator('#zone-impression.facture');
  await facture.waitFor({ state: 'attached' });
  const papier = await texteDe(facture);
  verifier(/^C01-\d{8}-[A-Z2-9]{4}$/.test(await facture.locator('[data-testid=facture-numero]').textContent()), 'facture A4 : numéro de la vente');
  verifier(papier.includes('CLIENT DIVERS'), 'facture A4 : cartouche client (vente au comptoir)');
  verifier(papier.includes('CIM-50') && papier.includes('Ciment 50kg') && papier.includes('Dépôt principal'), 'facture A4 : ligne, désignation et dépôt');
  verifier(papier.includes('5 000,00') && papier.includes('10 000,00') && papier.includes('1 800,00'), 'facture A4 : prix unitaire HT, total HT et TVA de la ligne');
  verifier((await facture.locator('[data-testid=facture-net]').textContent()).replace(/\s+/g, ' ') === '11 800', 'facture A4 : net à payer');
  verifier((await facture.locator('[data-testid=facture-paye]').textContent()).replace(/\s+/g, ' ') === '11 800', 'facture A4 : montant payé hors rendu de monnaie');
  verifier((await facture.locator('[data-testid=facture-lettres]').textContent()) === 'onze mille huit cents francs CFA', 'facture A4 : montant en toutes lettres');
  verifier(papier.includes('COMPTANT ✓') || papier.includes('COMPTANT✓'), 'facture A4 : règlement comptant coché');
  verifier((await facture.locator('svg.code-barres rect').count()) > 20, 'facture A4 : code-barres de la facture');
  verifier((await page.locator('#zone-impression.ticket').count()) === 0, 'un seul document à la fois dans la zone d’impression');

  await page.getByTestId('imprimer-ticket').click();
  await page.locator('#zone-impression.ticket').waitFor({ state: 'attached' });
  const impressions = await page.evaluate(() => window.__impressions);
  verifier(impressions.length === 2 && impressions[0].includes('facture') && impressions[1].includes('ticket'), 'les deux formats partent bien à l’impression');

  await page.keyboard.press('Escape');
  await page.locator('text=Panier vide').waitFor();
  verifier(true, 'panier vidé après la vente');

  await page.goto(`${BASE_URL}/#/ventes`);
  await page.locator('tbody tr').first().waitFor();
  verifier((await page.locator('tbody tr').count()) === 4, 'page Ventes : 4 tickets du jour');
  await page.locator('tbody tr').first().getByTitle('Détail').click();
  await page.getByRole('dialog').locator('td', { hasText: 'Ciment' }).waitFor();
  verifier(true, 'détail du ticket avec ses lignes');

  // Réédition de la facture d'une vente déjà enregistrée.
  await page.evaluate(() => { window.__impressions = []; window.print = () => window.__impressions.push('ok'); });
  await page.getByTestId('reimprimer-facture-a4').click();
  const reedition = page.locator('#zone-impression.facture');
  await reedition.waitFor({ state: 'attached' });
  const papierRee = await texteDe(reedition);
  verifier(papierRee.includes('Ciment 50kg') && papierRee.includes('Dépôt principal'), 'réédition : lignes et dépôt de la vente stockée');
  verifier((await reedition.locator('[data-testid=facture-net]').textContent()).replace(/\s+/g, ' ') === '11 800', 'réédition : mêmes montants que l’originale');
  verifier((await reedition.locator('[data-testid=facture-mention]').count()) === 0, 'réédition : aucune mention sur une vente valide');
  verifier((await page.evaluate(() => window.__impressions.length)) === 1, 'réédition : document envoyé à l’impression');

  // Annulation depuis l'interface : motif obligatoire, puis bouton rouge (sans confirm() natif, absent sous Tauri).
  const enAttenteAvant = await page.locator('tbody tr', { hasText: 'En attente' }).count();
  await page.getByRole('dialog').getByRole('button', { name: 'Annuler cette vente' }).click();
  await page.getByRole('dialog').getByPlaceholder(/motif/i).fill('Retour d’articles');
  await page.getByRole('dialog').getByRole('button', { name: "Confirmer l'annulation" }).click();
  await page.locator('tbody tr').first().locator('text=Annulée').waitFor();
  verifier((await page.locator('tbody tr', { hasText: 'En attente' }).count()) === enAttenteAvant - 1, 'annulation UI : le ticket passe en Annulée');

  await page.locator('tbody tr').first().getByTitle('Détail').click();
  await page.evaluate(() => { window.print = () => {}; });
  await page.getByTestId('reimprimer-facture-a4').click();
  await page.locator('#zone-impression.facture [data-testid=facture-mention]').waitFor({ state: 'attached' });
  verifier((await page.locator('[data-testid=facture-mention]').textContent()) === 'FACTURE ANNULÉE', 'réédition : une vente annulée ne ressort pas muette');
  await page.keyboard.press('Escape');

  // Seconde vente rapide, puis validation de journée via la boîte de confirmation applicative.
  await page.goto(`${BASE_URL}/#/pos`);
  await page.locator('input[type=search]').waitFor();
  await page.keyboard.press('F2');
  await page.keyboard.type('CIM-50');
  await page.keyboard.press('Enter');
  await ticket.locator('text=Ciment 50kg').waitFor();
  await page.keyboard.press('F11');
  await page.getByRole('dialog', { name: 'Encaissement' }).waitFor();
  await page.getByRole('button', { name: 'Valider la vente' }).click();
  await page.getByRole('dialog', { name: 'Vente enregistrée' }).waitFor();
  await page.keyboard.press('Escape');
  await page.goto(`${BASE_URL}/#/ventes`);
  await page.locator('tbody tr', { hasText: 'En attente' }).first().waitFor();
  await page.locator('thead input[type=checkbox]').check();
  await page.getByRole('button', { name: /^Valider \(/ }).click();
  await page.getByRole('dialog', { name: 'Validation de journée' }).waitFor();
  await page.getByRole('dialog', { name: 'Validation de journée' }).getByRole('button', { name: 'Valider' }).click();
  await page.locator('tbody tr', { hasText: 'En attente' }).first().waitFor({ state: 'detached' });
  verifier((await page.locator('tbody tr', { hasText: 'Validée' }).count()) >= 3, 'validation de journée via la boîte de confirmation');

  console.log('Pages alimentées par les ventes');
  await page.goto(`${BASE_URL}/#/`);
  await page.locator('main h1', { hasText: 'Filiale Abidjan' }).waitFor();
  await page.locator('text=CA du jour').waitFor();
  verifier((await page.textContent('main')).includes('Top articles'), 'dashboard : KPIs et top articles');
  await page.goto(`${BASE_URL}/#/tresorerie`);
  await page.locator('tbody tr', { hasText: 'Vente' }).first().waitFor();
  verifier((await page.locator('tbody tr').count()) >= 3, 'trésorerie : recettes de ventes journalisées');
  await page.goto(`${BASE_URL}/#/livraisons`);
  await page.locator('tbody tr', { hasText: 'Cocody' }).waitFor();
  verifier((await page.locator('tbody tr', { hasText: 'Annulée' }).count()) === 1, 'livraisons : bon annulé avec la vente');
  await page.goto(`${BASE_URL}/#/audit`);
  await page.locator('main h1', { hasText: 'audit' }).waitFor();
  verifier(true, 'audit : page rendue (journal serveur, vide hors ligne)');

  verifier(erreurs.length === 0, `aucune erreur console${erreurs.length ? ' : ' + erreurs.join(' | ') : ''}`);
  await browser.close();
  console.log('OK');
})().catch((e) => { console.error(e.message); process.exit(1); });
