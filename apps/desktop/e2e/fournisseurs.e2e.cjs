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
    const fid = await repo.create(F, fournisseurFormSchema.parse({ raison_sociale: 'SODIPRO', telephone: '2721', solde_initial: 20000, email: 'compta@sodipro.ci', interlocuteur: 'M. Koné', numero_rc: 'CI-ABJ-2020-B-1234', periode_reglement: 'J30' }));
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

    // Bon de commande : rien en stock ni en dette ; réception partielle puis solde.
    const { bonCommandeSchema, receptionSchema, construireReleve, commandeFromRow, reglementFournisseurFromRow } = await import('/src/core/fournisseurs/index.ts');
    const a2 = await new ArticlesRepository(db).create(F, articleFormSchema.parse({ code: 'PJAV', designation: 'Pied de lavabo', prix_achat: 5500, prix_vente: 8000 }));
    const bon = await repo.creerBonCommande(ctx, bonCommandeSchema.parse({ fournisseur_id: fid, depot_id: depotId, remise_percent: 10, tva_percent: 0, notes: 'Livraison le matin', lignes: [{ article_id: a2, quantite: 20, prix_unitaire_ht: 5500 }] }));
    const bon1 = await db.get('SELECT statut, total_ttc, total_recu_ttc, reste_a_payer FROM commandes_fournisseurs WHERE id = ?', [bon.id]);
    const stockPjavAvant = await db.getOptional('SELECT quantite FROM stocks WHERE article_id = ?', [a2]);
    const detteAvantReception = (await db.get('SELECT solde_actuel FROM fournisseurs WHERE id = ?', [fid])).solde_actuel;
    const ligne = await db.get('SELECT id FROM lignes_commande_fournisseur WHERE commande_id = ?', [bon.id]);
    const rec1 = await repo.receptionner(ctx, bon.id, receptionSchema.parse({ depot_id: depotId, reference: 'BL-2026-9', lignes: [{ ligne_id: ligne.id, quantite_recue: 8 }] }));
    const bon2 = await db.get('SELECT statut, total_recu_ttc, reste_a_payer FROM commandes_fournisseurs WHERE id = ?', [bon.id]);
    const stockPjav1 = await db.get('SELECT quantite, cout_moyen FROM stocks WHERE article_id = ?', [a2]);
    let tropRecu = false;
    try { await repo.receptionner(ctx, bon.id, receptionSchema.parse({ depot_id: depotId, reference: '', lignes: [{ ligne_id: ligne.id, quantite_recue: 13 }] })); } catch (e) { tropRecu = /au-delà/.test(e.message); }
    const rec2 = await repo.receptionner(ctx, bon.id, receptionSchema.parse({ depot_id: depotId, reference: '', lignes: [{ ligne_id: ligne.id, quantite_recue: 12 }] }));
    const bon3 = await db.get('SELECT statut, total_recu_ttc FROM commandes_fournisseurs WHERE id = ?', [bon.id]);
    const f3 = await db.get('SELECT * FROM fournisseurs WHERE id = ?', [fid]);
    const releve = construireReleve(
      { solde_initial: f3.solde_initial, date_effet_solde: f3.date_effet_solde },
      (await db.getAll('SELECT * FROM commandes_fournisseurs WHERE fournisseur_id = ?', [fid])).map(commandeFromRow),
      (await db.getAll('SELECT * FROM reglements_fournisseurs WHERE fournisseur_id = ?', [fid])).map(reglementFournisseurFromRow),
    );
    let annulationRefusee = false;
    try { await repo.annulerCommande(bon.id); } catch (e) { annulationRefusee = /non réceptionné/.test(e.message); }
    return { numero, f1, stock, mvt, achat, f2, achat2, caisse: caisse.solde_actuel, treso, fid,
      bon1, stockPjavAvant, detteAvantReception, rec1, bon2, stockPjav1, tropRecu, rec2, bon3, dette3: f3.solde_actuel, releve, annulationRefusee };
  }, { F: filialeId, U: userId });

  verifier(r.numero === 'FAC-2026-77' && r.f1.cumul_factures === 450000 && r.f1.solde_actuel === 470000, 'achat : dette = ouverture 20 000 + 450 000');
  verifier(r.stock.quantite === 100 && r.stock.cout_moyen === 4500 && r.mvt.type === 'ENTREE_ACHAT' && r.mvt.reference === 'FAC-2026-77', 'stock entré au coût d’achat, mouvement référencé');
  verifier(r.achat.statut === 'LIVREE' && r.achat.total_ttc === 450000 && r.achat.reste_a_payer === 450000, 'pièce d’achat LIVREE');
  verifier(r.f2.cumul_reglements === 300000 && r.f2.solde_actuel === 170000, 'règlement : dette réduite');
  verifier(r.achat2.montant_paye === 300000 && r.achat2.reste_a_payer === 150000, 'achat partiellement payé');
  verifier(r.caisse === -200000, 'caisse débitée (100 000 − 300 000 = −200 000 : alerte affichée dans l’UI)');
  verifier(r.treso.length === 1 && r.treso[0].type === 'DEPENSE' && r.treso[0].categorie === 'REGLEMENT_FOURNISSEUR', 'dépense de trésorerie journalisée');
  verifier(r.bon1.statut === 'ENVOYEE' && r.bon1.total_ttc === 99000 && r.bon1.total_recu_ttc === 0 && r.bon1.reste_a_payer === 0 && !r.stockPjavAvant && r.detteAvantReception === 170000, 'bon de commande : 20 × 5 500 − 10 % = 99 000, ni stock ni dette');
  verifier(r.rec1.total_ttc === 39600 && r.rec1.statut === 'PARTIELLE' && r.bon2.total_recu_ttc === 39600 && r.bon2.reste_a_payer === 39600, 'réception partielle 8/20 : 39 600 reçus et dus');
  verifier(r.stockPjav1.quantite === 8 && r.stockPjav1.cout_moyen === 4950, 'stock entré au prix de commande remisé (4 950)');
  verifier(r.tropRecu, 'réception au-delà du commandé refusée');
  verifier(r.rec2.statut === 'LIVREE' && r.bon3.total_recu_ttc === 99000 && r.dette3 === 269000, 'solde de la commande : LIVREE, dette 170 000 + 99 000');
  verifier(r.releve.length === 4 && r.releve[0].solde === 20000 && r.releve[r.releve.length - 1].solde === 269000, 'relevé de compte : solde initial → factures/règlement → solde actuel (269 000)');
  verifier(r.annulationRefusee, 'un bon réceptionné ne peut plus être annulé');

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
  await page.locator('tbody tr', { hasText: 'SODIPRO' }).locator('text=359 000 F').waitFor();
  verifier(true, 'dette mise à jour en temps réel (269 000 + 90 000)');

  const sousMenu = page.locator('[data-testid=sous-menu-fournisseurs]');
  await sousMenu.waitFor();
  verifier((await sousMenu.locator('a').count()) === 6, 'sous-menu Fournisseurs : 6 sections');

  await page.getByRole('button', { name: 'Balance générale' }).click();
  await page.locator('#zone-impression .document-titre', { hasText: 'Balance générale' }).waitFor();
  verifier((await page.locator('#zone-impression tbody tr').count()) === 1, 'balance générale fournisseurs : aperçu imprimable');
  await page.keyboard.press('Escape');

  await sousMenu.getByRole('link', { name: 'Nouveau fournisseur' }).click();
  await page.getByRole('dialog', { name: 'Nouveau fournisseur' }).waitFor();
  await page.locator('#fournisseur-form input[name=raison_sociale]').fill('CIM IVOIRE SA');
  await page.locator('#fournisseur-form input[name=email]').fill('ventes@cimivoire.ci');
  await page.getByRole('dialog').getByRole('button', { name: 'Banque' }).click();
  await page.locator('#fournisseur-form input[name=banque]').fill('SGBCI');
  await page.getByRole('dialog').getByRole('button', { name: 'Complément' }).click();
  await page.locator('#fournisseur-form textarea[name=notes]').fill('Livraison uniquement le matin');
  await page.getByRole('button', { name: 'Créer', exact: true }).click();
  await page.waitForURL(/#\/fournisseurs\/compte\?id=/);
  await page.locator('[data-testid=compte-indicateurs]').waitFor();
  verifier(true, 'fiche à onglets créée → ouverture du compte fournisseur');

  await sousMenu.getByRole('link', { name: 'Compte fournisseur' }).click();
  await page.locator('[data-testid=select-fournisseur]').selectOption(r.fid);
  await page.locator('tbody tr', { hasText: 'Solde initial' }).waitFor();
  await page.locator('tbody tr', { hasText: 'Règlement' }).waitFor();
  const lignesReleve = await page.locator('tbody tr').allTextContents();
  verifier(lignesReleve.length === 5, `compte fournisseur : solde initial + 3 factures + 1 règlement (${lignesReleve.length} lignes : ${lignesReleve.map((l) => l.slice(0, 40)).join(' | ')})`);
  await page.getByRole('button', { name: 'Imprimer le relevé' }).click();
  await page.locator('#zone-impression .document-titre', { hasText: 'Relevé de compte' }).waitFor();
  await page.keyboard.press('Escape');

  await sousMenu.getByRole('link', { name: 'Historique des règlements' }).click();
  await page.locator('tbody tr', { hasText: 'RGF-' }).waitFor();
  await page.locator('main', { hasText: 'Total réglé' }).locator('text=300 000 F').first().waitFor();
  verifier(true, 'historique des règlements : total 300 000');

  await sousMenu.getByRole('link', { name: 'Bons de commande' }).click();
  await page.locator('tbody tr', { hasText: 'BC-' }).waitFor();
  await page.getByRole('button', { name: 'Nouvelle commande' }).click();
  await page.getByRole('dialog', { name: 'Nouveau bon de commande' }).waitFor();
  await page.getByRole('dialog').locator('[data-testid=select-fournisseur]').selectOption(r.fid);
  await page.locator('input[placeholder^="Ajouter un article au bon"]').fill('pjav');
  await page.locator('ul li button', { hasText: 'PJAV' }).click();
  await page.locator('[data-testid=bon-lignes] input[type=number]').first().fill('10');

  // Remise négociée sur cet article seulement : 10 × 5 500 − 10 % = 49 500.
  await page.locator('[data-testid="remise-PJAV"]').fill('10');
  await page.locator('[data-testid=remise-totale]', { hasText: '5 500 F' }).waitFor();
  verifier(true, 'bon de commande : remise de ligne reportée dans le récapitulatif');

  const telechargement = page.waitForEvent('download');
  await page.getByTestId('exporter-excel').click();
  const fichier = await telechargement;
  const xlsx = require('xlsx');
  const classeur = xlsx.readFile(await fichier.path());
  const feuille = xlsx.utils.sheet_to_json(classeur.Sheets[classeur.SheetNames[0]]);
  verifier(feuille.length === 1 && feuille[0]['Remise %'] === 10 && feuille[0]['Total HT'] === 49500, `export Excel du bon : ${fichier.suggestedFilename()}`);

  await page.getByRole('button', { name: 'Créer le bon' }).click();
  await page.locator('[aria-live]', { hasText: 'Bon de commande BC-' }).waitFor();
  await page.locator('tbody tr', { hasText: 'Envoyée' }).waitFor();
  verifier(true, 'bon de commande créé via l’UI');
  await page.locator('tbody tr', { hasText: 'Envoyée' }).getByTitle('Imprimer le bon').click();
  await page.locator('#zone-impression .document-titre', { hasText: 'Bon de commande fournisseur' }).waitFor();
  await page.locator('#zone-impression', { hasText: 'CI-ABJ-2020-B-1234' }).locator('text=49 500 F').first().waitFor();
  verifier(true, 'bon imprimable : total de ligne net de la remise négociée');
  await page.keyboard.press('Escape');
  await page.locator('tbody tr', { hasText: 'Envoyée' }).getByTitle('Réceptionner').click();
  await page.getByRole('dialog').locator('input[type=number]').fill('4');
  await page.getByRole('button', { name: 'Valider la réception' }).click();
  await page.locator('[aria-live]', { hasText: 'Partielle' }).waitFor();
  await page.locator('tbody tr', { hasText: 'Partielle' }).waitFor();
  verifier(true, 'réception partielle via l’UI (4/10)');

  await sousMenu.getByRole('link', { name: 'Relance fournisseur' }).click();
  await page.locator('[data-testid=select-fournisseur]').selectOption(r.fid);
  await page.locator('input[type=checkbox]').first().waitFor();
  await page.locator('textarea', { hasText: /en attente de livraison/ }).waitFor();
  const corps = await page.locator('textarea').inputValue();
  verifier(corps.includes('Bonjour M. Koné') && corps.includes('restent en attente de livraison') && /BC-\d{8}-[A-Z2-9]{4}/.test(corps), 'relance : e-mail composé avec la commande en attente');
  await page.locator('input[type=checkbox]').first().uncheck();
  verifier(!(await page.locator('textarea').inputValue()).includes('en attente de livraison'), 'relance recomposée quand on décoche la commande');

  verifier(erreurs.length === 0, `aucune erreur console${erreurs.length ? ' : ' + erreurs.join(' | ') : ''}`);
  await browser.close();
  console.log('OK');
})().catch((e) => { console.error(e.message); process.exit(1); });
