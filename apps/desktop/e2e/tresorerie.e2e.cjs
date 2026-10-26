// Scénario Trésorerie : versement, retrait, entrée, transferts (caisse et filiale), dépense,
// puis journal de caisse (solde d'ouverture, clôture) et sous-menu.
const { ouvrirNavigateur, simulerSession, verifier, BASE_URL } = require('./browser.cjs');

/** Texte d'une zone, espaces normalisés : `formaterFcfa` sépare les milliers par une espace insécable. */
const texteDe = async (page, selecteur) => (await page.textContent(selecteur)).replace(/\s+/g, ' ');

(async () => {
  const { browser, page, erreurs } = await ouvrirNavigateur();
  const { filialeId, userId } = await simulerSession(page);

  console.log('Repository (base locale)');
  const r = await page.evaluate(async ({ F, U }) => {
    const { db } = await import('/src/infrastructure/powersync/database.ts');
    const { TresorerieRepository } = await import('/src/infrastructure/powersync/repositories/TresorerieRepository.ts');
    const { versementSchema, retraitSchema, transfertFilialeSchema, transfertCaisseSchema, operationSchema, soldeOuverture, construireJournalCaisse } = await import('/src/core/tresorerie/index.ts');
    const AUTRE = 'filiale-bouake';
    await db.execute("INSERT OR REPLACE INTO filiales (id, code, nom, type, est_active) VALUES (?, 'BKE', 'Filiale Bouaké', 'FILIALE', 1)", [AUTRE]);
    await db.execute("INSERT OR REPLACE INTO caisses (id, code, nom, filiale_id, solde_actuel, est_active) VALUES ('c1', 'C01', 'Caisse principale', ?, 500000, 1)", [F]);
    await db.execute("INSERT OR REPLACE INTO caisses (id, code, nom, filiale_id, solde_actuel, est_active) VALUES ('c2', 'C02', 'Coffre', ?, 0, 1)", [F]);
    await db.execute("INSERT OR REPLACE INTO caisses (id, code, nom, filiale_id, solde_actuel, est_active) VALUES ('c3', 'C03', 'Caisse Bouaké', ?, 0, 1)", [AUTRE]);

    const repo = new TresorerieRepository(db);
    const ctx = { filialeId: F, utilisateurId: U };

    const versement = await repo.enregistrerVersement(ctx, versementSchema.parse({ caisse_id: 'c1', remettant: 'QCF SASU NIAKARA', montant: 375500, designation: 'Bon payé' }));
    const retrait = await repo.enregistrerRetrait(ctx, retraitSchema.parse({ caisse_id: 'c1', beneficiaire: 'Cissé Ibrahim', montant: 100000, motif: 'Dépôt en banque' }));
    await repo.enregistrerOperation(ctx, operationSchema.parse({ caisse_id: 'c1', type: 'RECETTE', categorie: 'APPORT', montant: 50000, tiers: 'Gérante', description: 'Fonds de caisse' }));
    await repo.enregistrerOperation(ctx, operationSchema.parse({ caisse_id: 'c1', type: 'DEPENSE', categorie: 'TRANSPORT', montant: 15000, tiers: 'Transporteur', description: 'Livraison ciment' }));
    await repo.transferer(ctx, transfertCaisseSchema.parse({ caisse_source_id: 'c1', caisse_destination_id: 'c2', montant: 200000, motif: 'Sécurisation' }));
    const apresLocal = await db.getAll("SELECT id, solde_actuel FROM caisses WHERE filiale_id = ? ORDER BY code", [F]);

    // Transfert inter-filiale : les fonds sortent tout de suite, la destination encaisse ensuite.
    const numeroTrf = await repo.envoyerVersFiliale(ctx, transfertFilialeSchema.parse({ caisse_source_id: 'c1', filiale_destination_id: AUTRE, montant: 60000, motif: 'Appro. Bouaké' }));
    const trf = await db.get('SELECT * FROM transferts_filiales WHERE numero = ?', [numeroTrf]);
    const soldeApresEnvoi = (await db.get("SELECT solde_actuel FROM caisses WHERE id = 'c1'")).solde_actuel;

    // La filiale expéditrice ne peut pas encaisser à la place de la destinataire.
    let refusEncaissement = false;
    try { await repo.recevoirTransfert(ctx, trf.id, 'c2'); } catch (e) { refusEncaissement = /destinataire/.test(e.message); }

    const ctxBouake = { filialeId: AUTRE, utilisateurId: U };
    await repo.recevoirTransfert(ctxBouake, trf.id, 'c3');
    const trfRecu = await db.get('SELECT statut, caisse_destination_id, date_reception FROM transferts_filiales WHERE id = ?', [trf.id]);
    const soldeBouake = (await db.get("SELECT solde_actuel FROM caisses WHERE id = 'c3'")).solde_actuel;
    let refusDouble = false;
    try { await repo.recevoirTransfert(ctxBouake, trf.id, 'c3'); } catch (e) { refusDouble = /déjà/.test(e.message); }

    // Annulation d'un envoi resté en transit : la caisse source est recréditée.
    const numeroAnnule = await repo.envoyerVersFiliale(ctx, transfertFilialeSchema.parse({ caisse_source_id: 'c1', filiale_destination_id: AUTRE, montant: 25000, motif: 'Erreur de saisie' }));
    const trf2 = await db.get('SELECT * FROM transferts_filiales WHERE numero = ?', [numeroAnnule]);
    const soldeAvantAnnulation = (await db.get("SELECT solde_actuel FROM caisses WHERE id = 'c1'")).solde_actuel;
    await repo.annulerTransfert(ctx, trf2.id, 'Fonds non partis');
    const trf2Annule = await db.get('SELECT statut, motif FROM transferts_filiales WHERE id = ?', [trf2.id]);
    const soldeApresAnnulation = (await db.get("SELECT solde_actuel FROM caisses WHERE id = 'c1'")).solde_actuel;

    // Journal de caisse de c1 sur la journée : l'ouverture se déduit du solde actuel.
    const mouvements = await db.getAll("SELECT id, type, montant, categorie, description, reference, date_operation FROM mouvements_tresorerie WHERE caisse_id = 'c1'");
    const soldeC1 = (await db.get("SELECT solde_actuel FROM caisses WHERE id = 'c1'")).solde_actuel;
    const ouverture = soldeOuverture(soldeC1, mouvements);
    const journal = construireJournalCaisse(ouverture, mouvements);

    return {
      versement, retrait, apresLocal, trf, soldeApresEnvoi, refusEncaissement, trfRecu, soldeBouake, refusDouble,
      trf2Annule, soldeAvantAnnulation, soldeApresAnnulation, ouverture, journal, soldeC1,
    };
  }, { F: filialeId, U: userId });

  const solde = (id) => r.apresLocal.find((c) => c.id === id).solde_actuel;
  verifier(/^VER-[A-HJ-NP-Z2-9]{3}-\d{8}-[A-HJ-NP-Z2-9]{6}$/.test(r.versement) && /^RET-[A-HJ-NP-Z2-9]{3}-\d{8}-[A-HJ-NP-Z2-9]{6}$/.test(r.retrait), 'numéros de pièce VER / RET générés hors ligne');
  verifier(solde('c1') === 610500 && solde('c2') === 200000, 'caisse : 500 000 + 375 500 − 100 000 + 50 000 − 15 000 − 200 000 = 610 500, coffre 200 000');
  verifier(r.trf.statut === 'EN_TRANSIT' && r.soldeApresEnvoi === 550500, 'envoi inter-filiale : fonds sortis tout de suite, transfert en transit');
  verifier(r.refusEncaissement, 'seule la filiale destinataire peut encaisser');
  verifier(r.trfRecu.statut === 'RECU' && r.trfRecu.caisse_destination_id === 'c3' && r.soldeBouake === 60000, 'réception : caisse d’arrivée créditée, transfert reçu');
  verifier(r.refusDouble, 'un transfert déjà reçu ne peut pas être encaissé deux fois');
  verifier(r.trf2Annule.statut === 'ANNULE' && /Erreur de saisie — Annulé/.test(r.trf2Annule.motif), 'annulation : motif d’origine conservé');
  verifier(r.soldeApresAnnulation === r.soldeAvantAnnulation + 25000, 'annulation : caisse source recréditée');
  verifier(r.journal.cloture === r.soldeC1, 'journal : la clôture retombe sur le solde réel de la caisse');
  // Recettes : 375 500 versement + 50 000 apport + 25 000 recrédit d'annulation.
  // Dépenses : 100 000 retrait + 15 000 transport + 200 000 coffre + 60 000 et 25 000 inter-filiale.
  verifier(r.journal.totalRecettes === 450500 && r.journal.totalDepenses === 400000, 'journal : totaux recettes / dépenses de la caisse principale');
  verifier(r.journal.lignes.every((l, i, a) => i === 0 || a[i - 1].date <= l.date), 'journal : mouvements du plus ancien au plus récent');

  console.log('Interface');
  await page.goto(`${BASE_URL}/#/tresorerie`);
  await page.reload({ waitUntil: 'networkidle' });
  const sousMenu = page.locator('[data-testid=sous-menu-trésorerie]');
  await sousMenu.waitFor();
  verifier((await sousMenu.locator('a').count()) === 7, 'sous-menu Trésorerie : 7 sections');

  // Liste des caisses : filtre, soldes, journal.
  await page.locator('[data-testid=caisse-C01]').waitFor();
  await page.locator('[data-testid=filtre-caisse]').selectOption({ label: 'Caisse principale' });
  await page.locator('[data-testid=filtre-debut]').fill(new Date().toISOString().slice(0, 10));
  await page.locator('[data-testid=ligne-journal]').first().waitFor();
  // Les requêtes vivantes se rejouent quand le filtre change : on attend la valeur
  // stable plutôt que de photographier un état intermédiaire.
  await page.locator('[data-testid=solde-ouverture]', { hasText: '500 000 F' }).waitFor();
  verifier(true, 'solde d’ouverture du jour : 500 000 (avant les opérations du scénario)');
  const montant = async (testId) => (await page.locator(`[data-testid=${testId}]`).textContent()).replace(/[^\d-]/g, '');
  verifier((await montant('solde-cloture')) === (await montant('solde-actuel')), 'solde de clôture = solde actuel sur une période qui va jusqu’à aujourd’hui');

  // Liste des caisses : tableau dense, totaux en bas, filtres, impression, export.
  console.log('État des caisses');
  const lignesCaisses = (n) => page.waitForFunction((attendu) => document.querySelectorAll('[data-testid^="caisse-"]').length === attendu, n);
  await lignesCaisses(2);
  const compteurCaisses = page.getByTestId('compteur-caisses');
  const resumeCaisses = async () => (await compteurCaisses.textContent()).replace(/\s+/g, ' ');
  // Ouvertures du jour : 500 000 + 0 ; clôtures : 550 500 + 200 000.
  verifier((await resumeCaisses()).includes('2 caisse(s)') && (await resumeCaisses()).includes('750 500 F'), `liste : 2 caisses et la clôture totalisée (${await resumeCaisses()})`);
  verifier((await texteDe(page, '[data-testid=total-caisses]')) === '750 500 F', 'liste : ligne de total des soldes du jour');
  const ligneCoffre = await texteDe(page, '[data-testid=caisse-C02]');
  verifier(ligneCoffre.includes('Coffre') && ligneCoffre.includes('200 000 F'), `liste : une ligne par caisse, ouverture → clôture (${ligneCoffre.trim()})`);

  await page.getByTestId('recherche-caisse').fill('coffre');
  await lignesCaisses(1);
  verifier((await resumeCaisses()).includes('1 caisse(s)'), 'recherche : le total suit les caisses retenues');

  await page.getByTestId('recherche-caisse').fill('');
  await lignesCaisses(2);
  await page.getByTestId('filtre-etat-caisse').selectOption('NEGATIVES');
  await page.locator('text=Aucune caisse dans ce périmètre').waitFor();
  verifier(true, 'filtre « soldes négatifs » : aucune caisse à découvert ici');
  await page.getByTestId('filtre-etat-caisse').selectOption('ACTIVES');
  await lignesCaisses(2);

  await page.getByTestId('imprimer-caisses').click();
  const etatCaisses = page.locator('#zone-impression');
  await etatCaisses.locator('[data-testid=ligne-etat-caisse]').first().waitFor();
  const papierCaisses = await texteDe(page, '#zone-impression');
  verifier((await etatCaisses.locator('[data-testid=ligne-etat-caisse]').count()) === 2, 'document : une ligne par caisse retenue');
  verifier(papierCaisses.includes('ÉTAT DES CAISSES') || papierCaisses.includes('État des caisses'), 'document : titre');
  verifier(papierCaisses.includes('Caisses actives ·') && papierCaisses.includes('Filiale Abidjan'), 'document : périmètre retenu et en-tête de la maison');
  verifier((await texteDe(page, '[data-testid=total-cloture]')) === '750 500 F', 'document : total des clôtures');
  verifier(papierCaisses.includes('Caisse principale') && papierCaisses.includes('500 000 F'), 'document : solde d’ouverture de chaque caisse');
  verifier(!papierCaisses.includes('Point de Vente') && !papierCaisses.includes('Consolidation'), 'document : ni menu ni bandeau de l’application');
  await etatCaisses.getByRole('button', { name: "Fermer l'aperçu" }).click();

  const telechargementCaisses = page.waitForEvent('download');
  await page.getByTestId('exporter-caisses').click();
  const fichierCaisses = await telechargementCaisses;
  const classeurCaisses = require('xlsx').readFile(await fichierCaisses.path());
  const feuilleCaisses = require('xlsx').utils.sheet_to_json(classeurCaisses.Sheets[classeurCaisses.SheetNames[0]]);
  verifier(/^etat-des-caisses-\d{4}-\d{2}-\d{2}\.xlsx$/.test(fichierCaisses.suggestedFilename()), `export Excel : fichier ${fichierCaisses.suggestedFilename()}`);
  const principale = feuilleCaisses.find((l) => l.Code === 'C01');
  verifier(feuilleCaisses.length === 2 && principale["Solde d'ouverture"] === 500000 && principale['Total entrées'] === 450500
    && principale['Total sorties'] === 400000 && principale['Solde de clôture'] === 550500,
    'export Excel : ouverture, entrées, sorties et clôture relues depuis le classeur');

  await page.getByRole('button', { name: 'Imprimer le journal' }).click();
  await page.locator('#zone-impression .document-titre', { hasText: 'Journal de caisse' }).waitFor();
  const journalImprime = await texteDe(page, '#zone-impression');
  verifier(journalImprime.includes("Solde d'ouverture") && journalImprime.includes('Totaux') && journalImprime.includes('Caisse principale'), 'journal imprimable : ouverture, totaux, caisse');
  await page.keyboard.press('Escape');

  // Le journal part aussi en classeur, avec la caisse et la période retenues.
  const telechargementJournal = page.waitForEvent('download');
  await page.getByTestId('exporter-journal').click();
  const fichierJournal = await telechargementJournal;
  const feuilleJournal = require('xlsx').utils.sheet_to_json(require('xlsx').readFile(await fichierJournal.path()).Sheets.Journal);
  verifier(/^journal-de-caisse-C01-\d{4}-\d{2}-\d{2}\.xlsx$/.test(fichierJournal.suggestedFilename()), `export Excel du journal : fichier ${fichierJournal.suggestedFilename()}`);
  verifier(feuilleJournal.length === r.journal.lignes.length && feuilleJournal.every((l) => l.Caisse === 'Caisse principale'),
    'export Excel du journal : les mouvements de la caisse retenue, avec leur solde courant');

  // Versement : encaissement d'un remettant hors compte, puis reçu.
  await sousMenu.getByRole('link', { name: 'Versement' }).click();
  await page.locator('[data-testid=versement-montant]').waitFor();
  await page.locator('[data-testid=versement-remettant]').fill('Koffi Yao');
  await page.locator('[data-testid=versement-montant]').fill('120000');
  await page.getByRole('button', { name: /Encaisser/ }).click();
  await page.locator('[aria-live]', { hasText: 'encaissé' }).waitFor();
  await page.locator('#zone-impression .document-titre', { hasText: 'Reçu de versement' }).waitFor();
  const recu = await texteDe(page, '#zone-impression');
  verifier(recu.includes('Koffi Yao') && recu.includes('120 000'), 'reçu de versement : remettant et montant');
  verifier(recu.includes('cent vingt mille francs CFA'), 'reçu : montant en toutes lettres');
  verifier((await page.locator('#zone-impression .code-barres rect').count()) > 20, 'reçu : code-barres de la pièce');
  await page.keyboard.press('Escape');

  // Retrait au-delà du solde : la confirmation de l'app (jamais confirm() natif) doit s'ouvrir.
  await sousMenu.getByRole('link', { name: 'Retrait', exact: true }).click();
  await page.locator('[data-testid=retrait-beneficiaire]').fill('Cissé Ibrahim');
  await page.locator('[data-testid=retrait-montant]').fill('99000000');
  await page.getByRole('button', { name: /Retirer/ }).click();
  await page.getByRole('dialog', { name: 'Retrait supérieur au solde' }).getByRole('button', { name: 'Retirer quand même' }).click();
  await page.locator('[aria-live]', { hasText: 'Retrait' }).waitFor();
  await page.locator('#zone-impression .document-titre', { hasText: 'Reçu de retrait' }).waitFor();
  verifier((await texteDe(page, '#zone-impression')).includes('Cissé Ibrahim'), 'retrait au-delà du solde : confirmé puis reçu émis');
  await page.keyboard.press('Escape');

  // Transfert inter-filiale depuis l'UI : envoi puis réception côté destinataire.
  await sousMenu.getByRole('link', { name: 'Transfert inter filiale' }).click();
  await page.locator('[data-testid=transfert-filiale-montant]').waitFor();
  await page.locator('[data-testid=transfert-filiale-destination]').selectOption({ label: 'Filiale Bouaké' });
  await page.locator('[data-testid=transfert-filiale-montant]').fill('30000');
  await page.getByRole('button', { name: 'Envoyer les fonds' }).click();
  await page.getByRole('dialog', { name: 'Envoyer les fonds' }).getByRole('button', { name: 'Envoyer', exact: true }).click();
  await page.locator('[aria-live]', { hasText: 'envoyé' }).waitFor();
  await page.locator('tbody tr', { hasText: 'En transit' }).first().waitFor();
  verifier(true, 'transfert inter-filiale envoyé depuis l’interface');

  // Le bordereau : la pièce qui voyage avec l'argent. Sans elle, entre les deux
  // caisses il ne reste que la parole du porteur.
  await page.locator('[data-testid^=imprimer-bordereau-]').first().click();
  await page.locator('#zone-impression .document-titre', { hasText: 'Bordereau de transfert de fonds' }).waitFor();
  const bordereau = await texteDe(page, '#zone-impression');
  verifier(bordereau.includes('trente mille francs CFA'), 'bordereau : le montant en toutes lettres, qui fait foi');
  verifier((bordereau.match(/Le gérant ou le directeur/g) || []).length === 2,
    'bordereau : deux cachets, signés du gérant ou du directeur de chaque filiale');
  verifier(bordereau.includes('Porteur des fonds'), 'bordereau : le porteur se nomme à la main sur la pièce');
  verifier(bordereau.includes('Filiale Bouaké') && bordereau.includes('désignée à la réception'),
    'bordereau : destinataire nommé, caisse d’arrivée encore inconnue');
  verifier((await page.locator('#zone-impression .code-barres rect').count()) > 20, 'bordereau : code-barres de la pièce');
  await page.keyboard.press('Escape');

  // Dépense : sens et catégories propres à la section.
  await sousMenu.getByRole('link', { name: 'Dépense' }).click();
  await page.locator('[data-testid=depense-montant]').waitFor();
  await page.locator('[data-testid=depense-categorie]').selectOption('LOYER');
  await page.locator('[data-testid=depense-tiers]').fill('Bailleur');
  await page.locator('[data-testid=depense-montant]').fill('80000');
  await page.getByRole('button', { name: 'Enregistrer la dépense' }).click();
  await page.locator('[aria-live]', { hasText: 'Dépense' }).waitFor();
  await page.locator('#zone-impression .document-titre', { hasText: 'Pièce de dépense' }).waitFor();
  verifier((await texteDe(page, '#zone-impression')).includes('Loyer'), 'dépense enregistrée, pièce justificative imprimable');
  await page.keyboard.press('Escape');
  await page.locator('[data-testid=mouvement-recent]', { hasText: 'Bailleur' }).first().waitFor();
  verifier(true, 'la dépense apparaît dans l’historique de la section');

  if (erreurs.length) throw new Error(`Erreurs console :\n${erreurs.join('\n')}`);
  console.log('\nTrésorerie : OK');
  await browser.close();
})().catch(async (e) => { console.error(e.message); process.exit(1); });
