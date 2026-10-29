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
    const v1 = await ventes.enregistrer(ctx, { lignes: [ligne(await article(a1), 10)], remise: 0, client: null, paiement: { mode_paiement: 'ESPECES', montant_percu: 60000 }, livraison: null, notes: '' });
    out.v1 = { numero: v1.preparee.numero, ttc: v1.preparee.totaux.total_ttc, monnaie: v1.preparee.monnaie };
    out.stockApresV1 = (await db.get('SELECT quantite FROM stocks WHERE article_id = ?', [a1])).quantite;
    out.caisseApresV1 = (await db.get('SELECT solde_actuel FROM caisses WHERE id = ?', ['caisse-1'])).solde_actuel;

    // 2. Crédit dans le plafond, avec livraison
    const v2 = await ventes.enregistrer(ctx, { lignes: [ligne(await article(a2), 2)], remise: 0, client: await lireClient(), paiement: { mode_paiement: 'CREDIT', montant_percu: 0 }, livraison: { adresse_livraison: 'Cocody', date_livraison_prevue: '2026-09-20', chauffeur: '', vehicule: '' }, notes: '' });
    out.v2 = { ttc: v2.preparee.totaux.total_ttc, reste: v2.preparee.reste_a_payer };
    out.clientApresV2 = await lireClient();
    out.livraison = await db.get('SELECT statut, adresse_livraison FROM livraisons WHERE vente_id = ?', [v2.id]);

    // 3. Crédit hors plafond → refusé, rien n'est écrit
    try { await ventes.enregistrer(ctx, { lignes: [ligne(await article(a1), 10)], remise: 0, client: await lireClient(), paiement: { mode_paiement: 'CREDIT', montant_percu: 0 }, livraison: null, notes: '' }); out.refus = 'NON'; }
    catch (e) { out.refus = e.name; }
    out.nbVentes = (await db.get('SELECT count(*) AS n FROM ventes')).n;

    // 4. Stock insuffisant → refusé (3 robinets, 2 vendus → 1 dispo)
    try { await ventes.enregistrer(ctx, { lignes: [ligne(await article(a2), 2)], remise: 0, client: null, paiement: { mode_paiement: 'ESPECES', montant_percu: 30000 }, livraison: null, notes: '' }); out.refusStock = 'NON'; }
    catch (e) { out.refusStock = e.name; }
    // … sauf si forcé par un gérant
    const v4 = await ventes.enregistrer({ ...ctx, autoriserStockNegatif: true }, { lignes: [ligne(await article(a2), 2)], remise: 2360, client: null, paiement: { mode_paiement: 'MOBILE_MONEY', montant_percu: 21240 }, livraison: null, notes: '' });
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

  verifier(/^C01-[A-HJ-NP-Z2-9]{3}-\d{8}-[A-HJ-NP-Z2-9]{6}$/.test(r.v1.numero) && r.v1.ttc === 59000 && r.v1.monnaie === 1000, `vente comptoir ${r.v1.numero} : 59 000 F, monnaie 1 000`);
  verifier(r.stockApresV1 === 90 && r.caisseApresV1 === 59000, 'stock −10 et caisse +59 000');
  verifier(r.v2.ttc === 23600 && r.v2.reste === 23600 && r.clientApresV2.solde_actuel === 23600 && r.clientApresV2.cumul_factures === 23600, 'vente à crédit : créance client 23 600');
  verifier(r.livraison?.statut === 'A_PREPARER' && r.livraison.adresse_livraison === 'Cocody', 'bon de livraison créé');
  verifier(r.refus === 'VenteInvalideError' && r.nbVentes === 2, 'crédit hors plafond refusé, rien écrit');
  verifier(r.refusStock === 'StockInsuffisantError' && r.stockRobinetForce === -1 && r.v4ttc === 21240, 'stock insuffisant refusé, vente forcée par gérant → stock −1, remise de 2 360 F appliquée');
  verifier(r.apresAnnulation.client === 0 && r.apresAnnulation.statut === 'ANNULEE' && r.apresAnnulation.livraison === 'ANNULEE' && r.apresAnnulation.stockRobinet === 1, 'annulation : créance, livraison et stock contre-passés');
  verifier(r.validees === 2, 'validation de journée : 2 ventes en attente validées (l’annulée ignorée)');
  verifier(r.treso.length === 2 && r.treso.every((t) => t.type === 'RECETTE' && t.categorie === 'VENTE'), '2 recettes de trésorerie (ventes encaissées)');

  console.log('Interface');
  await page.goto(`${BASE_URL}/#/pos`);
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('dialog', { name: 'Réglages du poste de vente' }).waitFor();
  verifier((await page.getByTestId('format-impression').inputValue()) === 'TICKET', 'poste : impression par défaut en ticket');
  verifier(/^[A-HJ-NP-Z2-9]{3}$/.test((await page.getByTestId('code-poste').textContent()).trim()), 'poste : code de la machine affiché dans les réglages');
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

  // La remise se saisit en francs, sur la vente entière : plus de pourcentage,
  // et plus rien à ventiler article par article.
  const total = () => page.getByTestId('ticket-total').textContent();
  const attendreTotal = (attendu) => page.waitForFunction(
    (v) => document.querySelector('[data-testid=ticket-total]').textContent.replace(/[\s\u202f\u00a0]/g, '') === v, attendu);

  await page.getByTestId('remise-globale').fill('1000');
  await attendreTotal('10800F');
  verifier(true, 'remise de 1 000 F : le total tombe de 11 800 à 10 800');
  verifier((await page.getByTestId('remise-globale').inputValue()) === '1\u202f000', 'remise : les milliers se groupent pendant la frappe');
  verifier((await page.locator('[data-testid=ticket-lignes] input[max="100"]').count()) === 0,
    'la ligne du ticket n’a plus de champ de remise : elle se décide sur la vente');

  await page.getByTestId('remise-globale').fill('99000');
  await page.locator('[data-testid=remise-plafonnee]').waitFor();
  verifier((await total()).replace(/[\s\u202f\u00a0]/g, '') === '0F', 'une remise plus grande que le ticket est ramenée au ticket');

  // Mise de côté : rien n'est vendu, et le ticket se retrouve tel quel.
  await page.getByTestId('remise-globale').fill('1000');
  await attendreTotal('10800F');
  await page.getByTestId('mettre-en-brouillon').click();
  await page.locator('text=Panier vide').waitFor();
  verifier(true, 'mise en brouillon : le comptoir est libre pour le client suivant');

  await page.getByTestId('ouvrir-brouillons').click();
  const boite = page.getByRole('dialog', { name: 'Ventes en brouillon' });
  await boite.locator('[data-testid=liste-brouillons] li').first().waitFor();
  verifier((await texteDe(boite)).includes('toutes les caisses de la filiale'),
    'brouillons : l’écran dit qu’ils sont partagés entre les caisses');
  await boite.getByTestId('reprendre-brouillon').first().click();
  await attendreTotal('10800F');
  verifier((await page.getByTestId('remise-globale').inputValue()) === '1\u202f000', 'reprise du brouillon : lignes et remise retrouvées');

  // La suppression suit la reprise : la liste se vide dès que la requête vivante
  // repasse, et on l'attend plutôt que de la supposer.
  await page.getByTestId('ouvrir-brouillons').click();
  await page.locator('[data-testid=liste-brouillons]').waitFor({ state: 'detached' });
  verifier((await texteDe(page.getByRole('dialog', { name: 'Ventes en brouillon' }))).includes('Aucune vente mise de côté'),
    'le brouillon repris ne reste pas en double dans la liste');
  await page.keyboard.press('Escape');

  // Un brouillon venu d'une autre caisse arrive par la synchronisation : ici on
  // écrit la ligne directement, c'est exactement ce que PowerSync dépose.
  await page.evaluate(async (F) => {
    const { db } = await import('/src/infrastructure/powersync/database.ts');
    const article = await db.get('SELECT id, code, designation, unite, prix_vente, tva FROM articles WHERE code = ?', ['CIM-50']);
    await db.execute(`INSERT OR REPLACE INTO ventes_brouillons
      (id, libelle, filiale_id, client_id, lignes, remise, remise_auto, total_ttc, articles, utilisateur_id, poste, created_at, updated_at)
      VALUES ('br-autre', 'Ticket de la caisse 2', ?, NULL, ?, 0, 0, 5900, 1, NULL, 'ZZZ', datetime('now'), datetime('now'))`,
      [F, JSON.stringify([{ article_id: article.id, code: article.code, designation: article.designation,
        unite: article.unite, prix_unitaire_ttc: article.prix_vente, tva_percent: article.tva, quantite: 1, remise_percent: 0 }])]);
  }, filialeId);
  await page.waitForFunction(() => document.querySelector('[data-testid=ouvrir-brouillons]').textContent.includes('1'));
  verifier(true, 'un brouillon pris sur une autre caisse apparaît ici');
  await page.getByTestId('ouvrir-brouillons').click();
  const venuDAilleurs = await texteDe(page.getByRole('dialog', { name: 'Ventes en brouillon' }));
  verifier(venuDAilleurs.includes('Ticket de la caisse 2') && venuDAilleurs.includes('d’une autre caisse'),
    'la liste dit d’où vient le ticket, pour savoir à qui on le prend');
  await page.getByTestId('reprendre-brouillon').first().click();
  // Un ticket est déjà à l'écran : on prévient avant de l'écraser.
  await page.getByRole('dialog', { name: 'Reprendre ce brouillon' })
    .getByRole('button', { name: 'Remplacer le ticket' }).click();
  await attendreTotal('5900F');
  verifier(true, 'le ticket de l’autre caisse se reprend ici, après avoir prévenu');
  const reste = await page.evaluate(async () => {
    const { db } = await import('/src/infrastructure/powersync/database.ts');
    return (await db.getAll('SELECT id FROM ventes_brouillons')).length;
  });
  verifier(reste === 0, 'repris, il disparaît pour tout le monde : la table est vide');
  await page.keyboard.press('F10');
  await page.locator('text=Panier vide').waitFor();

  // On refait le ticket de la vente, que les assertions suivantes attendent.
  await page.keyboard.press('F2');
  await page.keyboard.type('cim');
  await page.keyboard.press('Enter');
  await page.locator('button:has-text("CIM-50")').click();
  await attendreTotal('11800F');

  await page.keyboard.press('F11');
  await page.getByRole('dialog', { name: 'Encaissement' }).waitFor();
  await page.getByTestId('montant-percu').fill('12000');
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
  verifier(/^C01-[A-HJ-NP-Z2-9]{3}-\d{8}-[A-HJ-NP-Z2-9]{6}$/.test(await facture.locator('[data-testid=facture-numero]').textContent()), 'facture A4 : numéro de la vente');
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

  // Le journal partait à l'imprimante avec le menu et les tuiles ; c'est
  // maintenant un document à part.
  await page.getByTestId('imprimer-journal-ventes').click();
  const journal = page.locator('#zone-impression');
  await journal.locator('[data-testid=ligne-journal-vente]').first().waitFor();
  const feuille = await texteDe(journal);
  verifier((await journal.locator('[data-testid=ligne-journal-vente]').count()) === 4, 'journal des ventes : les 4 tickets de la liste');
  verifier(feuille.includes('Journal des ventes') && feuille.includes('Filiale Abidjan'), 'journal des ventes : titre et en-tête de la maison');
  verifier(/journée du \d{2}\/\d{2}\/\d{4} · toutes caisses/.test(feuille), `journal des ventes : période imprimée sur le document`);
  verifier(feuille.includes('Encaissé') && feuille.includes('Vendu à crédit'), 'journal des ventes : récapitulatif de caisse');
  verifier(feuille.includes('annulée(s), hors totaux'), 'journal des ventes : la vente annulée est signalée et hors totaux');
  verifier(!feuille.includes('Point de Vente') && !feuille.includes('Consolidation'), 'journal des ventes : ni menu ni bandeau de l’application');
  verifier(feuille.includes('Visa du gérant'), 'journal des ventes : emplacement de visa');
  await journal.getByRole('button', { name: "Fermer l'aperçu" }).click();
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
  await page.locator('[data-testid=kpi-ca-valeur]').waitFor();
  verifier((await page.textContent('main')).includes('Articles les plus vendus'), 'tableau de bord : indicateurs et articles les plus vendus');
  await page.goto(`${BASE_URL}/#/tresorerie`);
  await page.locator('tbody tr', { hasText: 'Vente' }).first().waitFor();
  verifier((await page.locator('tbody tr').count()) >= 3, 'trésorerie : recettes de ventes journalisées');
  await page.goto(`${BASE_URL}/#/livraisons`);
  await page.locator('tbody tr', { hasText: 'Cocody' }).waitFor();
  verifier((await page.locator('tbody tr', { hasText: 'Annulée' }).count()) === 1, 'livraisons : bon annulé avec la vente');
  await page.goto(`${BASE_URL}/#/audit`);
  await page.locator('main h1', { hasText: 'audit' }).waitFor();
  verifier(true, 'audit : page rendue (journal serveur, vide hors ligne)');

  console.log('Numérotation : un espace de numéros par poste');
  const codeA = await page.evaluate(() => localStorage.getItem('quinca-code-poste'));
  verifier(/^[A-HJ-NP-Z2-9]{3}$/.test(codeA) && r.v1.numero.split('-')[1] === codeA,
    `code de ce poste ${codeA} mémorisé sur la machine et porté par le numéro de vente`);

  // Le code doit survivre au redémarrage : sinon deux « postes » successifs sur
  // la même machine retomberaient dans le même espace de numéros.
  await page.reload({ waitUntil: 'networkidle' });
  const tiragesA = await page.evaluate(async () => {
    const { codePoste, numeroPiece } = await import('/src/infrastructure/desktop/identitePoste.ts');
    return { code: codePoste(), numeros: Array.from({ length: 2000 }, () => numeroPiece('ENT', new Date('2026-09-22T09:00:00Z'))) };
  });
  verifier(tiragesA.code === codeA && tiragesA.numeros.every((n) => n.split('-')[1] === codeA), 'le code du poste survit au redémarrage');

  // Deuxième poste : contexte navigateur distinct, donc stockage local distinct.
  const pageB = await browser.newPage({ viewport: { width: 1024, height: 768 } });
  await pageB.goto(`${BASE_URL}/#/login`, { waitUntil: 'networkidle' });
  const tiragesB = await pageB.evaluate(async () => {
    const { codePoste, numeroPiece } = await import('/src/infrastructure/desktop/identitePoste.ts');
    return { code: codePoste(), numeros: Array.from({ length: 2000 }, () => numeroPiece('ENT', new Date('2026-09-22T09:00:00Z'))) };
  });
  verifier(tiragesB.code !== codeA, `deuxième poste, autre code (${codeA} ≠ ${tiragesB.code})`);
  const communs = tiragesA.numeros.filter((n) => tiragesB.numeros.includes(n));
  verifier(communs.length === 0, '2 000 pièces du même jour et du même type sur deux postes : aucun numéro en commun');
  verifier(new Set(tiragesA.numeros).size === 2000, '2 000 pièces sur le même poste : aucun doublon');
  await pageB.close();

  verifier(erreurs.length === 0, `aucune erreur console${erreurs.length ? ' : ' + erreurs.join(' | ') : ''}`);
  await browser.close();
  console.log('OK');
})().catch((e) => { console.error(e.message); process.exit(1); });
