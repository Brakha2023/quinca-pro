// Scénario Dépenses : une dépense s'engage, attend une décision, et ne sort de
// la caisse qu'à son approbation — comme une vente n'y entre qu'à sa validation.
// Couvre le dépôt (caisse, journal, statuts, réouverture, refus) puis l'écran.
const { ouvrirNavigateur, simulerSession, verifier, BASE_URL } = require('./browser.cjs');

/** Texte d'une zone, espaces normalisés : `formaterFcfa` sépare les milliers par une espace insécable. */
const texteDe = async (cible) => (await cible.textContent()).replace(/\s+/g, ' ');

(async () => {
  const { browser, page, erreurs } = await ouvrirNavigateur();
  const { filialeId, userId } = await simulerSession(page);

  console.log('Repository (base locale)');
  const r = await page.evaluate(async ({ F, U }) => {
    const { db } = await import('/src/infrastructure/powersync/database.ts');
    const { DepensesRepository } = await import('/src/infrastructure/powersync/repositories/DepensesRepository.ts');
    const { depenseSchema } = await import('/src/core/depenses/index.ts');
    await db.execute("INSERT OR REPLACE INTO caisses (id, code, nom, filiale_id, solde_actuel, est_active) VALUES ('c1', 'C01', 'Caisse principale', ?, 500000, 1)", [F]);

    const repo = new DepensesRepository(db);
    const ctx = { filialeId: F, utilisateurId: U };
    const out = {};
    const solde = async () => (await db.get("SELECT solde_actuel FROM caisses WHERE id = 'c1'")).solde_actuel;
    const lire = async (id) => db.get('SELECT * FROM depenses WHERE id = ?', [id]);
    const saisie = (over = {}) => depenseSchema.parse({
      caisse_id: 'c1', categorie: 'LOYER', montant: 120000, beneficiaire: 'Bailleur',
      description: 'Loyer de novembre', reference: 'FACT-88', date_depense: new Date().toISOString().slice(0, 10), ...over,
    });

    // 1. Engagée : la pièce existe, la caisse n'a pas bougé d'un franc.
    const d1 = await repo.enregistrer(ctx, saisie());
    out.apresEngagement = { solde: await solde(), statut: (await lire(d1)).statut, mouvements: (await db.getAll('SELECT id FROM mouvements_tresorerie')).length };

    // 2. Corrigée tant qu'elle attend : toujours rien à contre-passer.
    await repo.modifier(d1, saisie({ montant: 100000, description: 'Loyer de novembre, remisé' }));
    out.apresCorrection = { solde: await solde(), montant: (await lire(d1)).montant, mouvements: (await db.getAll('SELECT id FROM mouvements_tresorerie')).length };

    // 3. Approuvée : c'est maintenant que l'argent sort.
    const d2 = await repo.enregistrer(ctx, saisie({ montant: 15000, categorie: 'TRANSPORT', beneficiaire: 'Transporteur', reference: '' }));
    out.approuvees = await repo.valider(ctx, [d1, d2]);
    const apresD1 = await lire(d1);
    out.apresApprobation = {
      solde: await solde(),
      statut: apresD1.statut,
      approbateur: apresD1.valide_par,
      dateValidation: Boolean(apresD1.date_validation),
    };
    out.journal = (await db.getAll("SELECT type, categorie, montant, reference FROM mouvements_tresorerie ORDER BY created_at, montant DESC"))
      .map((m) => `${m.type}/${m.categorie} ${m.montant}`);

    // 4. Une dépense déjà payée ne se corrige pas, et ne se refuse pas.
    try { await repo.modifier(d1, saisie()); out.refusCorrection = 'NON'; }
    catch (e) { out.refusCorrection = e.message; }
    try { await repo.refuser(ctx, d1, 'Trop cher'); out.refusRefus = 'NON'; }
    catch (e) { out.refusRefus = e.message; }

    // 5. Remise en attente : l'argent rentre, et la reprise se lit au journal.
    await repo.remettreEnAttente(ctx, d1);
    const rouverte = await lire(d1);
    out.apresReouverture = {
      solde: await solde(), statut: rouverte.statut,
      approbateur: rouverte.valide_par, dateValidation: rouverte.date_validation,
      reprise: (await db.get("SELECT type, categorie, montant FROM mouvements_tresorerie ORDER BY created_at DESC LIMIT 1")),
    };

    // 6. Refusée : la caisse ne bouge pas, le motif reste au dossier.
    await repo.refuser(ctx, d1, 'Hors budget du mois');
    const refusee = await lire(d1);
    out.apresRefus = { solde: await solde(), statut: refusee.statut, motif: refusee.motif_refus };
    // Une dépense refusée n'a rien sorti : il n'y a rien à reprendre.
    try { await repo.remettreEnAttente(ctx, d1); out.refusReouverture = 'NON'; }
    catch (e) { out.refusReouverture = e.message; }
    // Et l'approbation en lot l'ignore, comme la validation ignore une vente annulée.
    out.approuveesApresRefus = await repo.valider(ctx, [d1]);

    return out;
  }, { F: filialeId, U: userId });

  verifier(r.apresEngagement.solde === 500000 && r.apresEngagement.statut === 'EN_ATTENTE' && r.apresEngagement.mouvements === 0,
    'engagée : la pièce attend, la caisse ne bouge pas et le journal reste vide');
  verifier(r.apresCorrection.solde === 500000 && r.apresCorrection.montant === 100000 && r.apresCorrection.mouvements === 0,
    'corrigée en attente : le montant change, rien à contre-passer');
  verifier(r.approuvees === 2, 'approbation en lot : 2 dépenses approuvées');
  // 500 000 − 100 000 (loyer) − 15 000 (transport).
  verifier(r.apresApprobation.solde === 385000, `approuvée : c'est là que l'argent sort (${r.apresApprobation.solde} F)`);
  verifier(r.apresApprobation.statut === 'VALIDEE' && r.apresApprobation.approbateur === userId && r.apresApprobation.dateValidation,
    'approuvée : la pièce porte qui a autorisé la sortie, et quand');
  verifier(r.journal.join(' | ') === 'DEPENSE/LOYER 100000 | DEPENSE/TRANSPORT 15000',
    `journal de caisse : une ligne par pièce, sous sa catégorie (${r.journal.join(' | ')})`);
  verifier(/en attente se modifie/.test(r.refusCorrection), `une dépense payée ne se corrige pas : « ${String(r.refusCorrection).slice(0, 45)}… »`);
  verifier(/déjà payée/.test(r.refusRefus), `ni ne se refuse : « ${String(r.refusRefus).slice(0, 45)}… »`);

  verifier(r.apresReouverture.solde === 485000 && r.apresReouverture.statut === 'EN_ATTENTE',
    `remise en attente : les 100 000 rentrent en caisse (${r.apresReouverture.solde} F)`);
  verifier(r.apresReouverture.approbateur === null && r.apresReouverture.dateValidation === null,
    'remise en attente : l’approbation précédente ne reste pas au dossier — la pièce attend de nouveau');
  verifier(r.apresReouverture.reprise.type === 'RECETTE' && r.apresReouverture.reprise.categorie === 'REOUVERTURE_DEPENSE' && r.apresReouverture.reprise.montant === 100000,
    'remise en attente : la reprise se lit au journal, une sortie ne s’efface pas');

  verifier(r.apresRefus.solde === 485000 && r.apresRefus.statut === 'REFUSEE' && r.apresRefus.motif === 'Hors budget du mois',
    'refusée : la caisse ne bouge pas, le motif reste au dossier');
  verifier(/rien à reprendre/.test(r.refusReouverture), `une dépense refusée ne se rouvre pas : « ${String(r.refusReouverture).slice(0, 45)}… »`);
  verifier(r.approuveesApresRefus === 0, 'et l’approbation en lot l’ignore');

  console.log('Interface');
  await page.goto(`${BASE_URL}/#/depenses`);
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('main h1', { hasText: 'Dépenses' }).waitFor();

  // La saisie : rien n'est payé en l'enregistrant, et l'écran le dit.
  await page.getByTestId('engager-depense').click();
  const boite = page.getByRole('dialog', { name: 'Engager une dépense' });
  // Les caisses et les catégories viennent de requêtes vivantes : le
  // formulaire n'est monté qu'une fois qu'elles sont là (voir
  // `DepenseFormModal`). On attend le champ, pas la boîte.
  await boite.getByTestId('depense-montant').waitFor();
  verifier((await texteDe(boite)).includes('la caisse ne bouge qu’à la validation'),
    'la saisie annonce que rien n’est payé tant que la dépense n’est pas approuvée');
  await boite.getByTestId('depense-montant').fill('25000');
  await boite.getByTestId('depense-beneficiaire').fill('Électricien');
  await boite.getByTestId('depense-description').fill('Réparation du tableau');
  await boite.getByTestId('depense-categorie').selectOption('ENTRETIEN');
  verifier((await texteDe(boite)).includes('après approbation'),
    'la saisie montre le solde de la caisse avant et après, pour décider en connaissance');
  await boite.getByTestId('enregistrer-depense').click();
  /*
   * La liste porte déjà les pièces du dépôt : attendre « une ligne » ne dit
   * rien, elle est là depuis le début. C'est **celle-ci** qu'on attend, et la
   * requête vivante la fait paraître après le premier rendu.
   */
  const ligneNeuve = page.locator('[data-testid=ligne-depense]', { hasText: 'Électricien' });
  await ligneNeuve.waitFor();

  const avecAttente = await texteDe(page.locator('main'));
  verifier((await texteDe(ligneNeuve)).includes('En attente'),
    'la dépense engagée apparaît dans la liste, en attente');
  verifier(avecAttente.includes('engagés, pas encore payés'),
    'l’indicateur dit ce qui est engagé sans être payé : encore en caisse, mais déjà promis');
  verifier(avecAttente.includes('Trésorerie → Dépense'),
    'l’écran dit où se saisit une dépense payée sur-le-champ : les deux portes ne font pas la même chose');

  // L'approbation : le montant est annoncé avant d'être autorisé.
  await page.locator('thead input[type=checkbox]').check();
  await page.getByTestId('approuver-depenses').click();
  const confirmation = page.getByRole('dialog', { name: 'Approuver les dépenses' });
  verifier((await texteDe(confirmation)).includes('sortiront des caisses'),
    'la boîte annonce la sortie d’argent avant de l’autoriser');
  await confirmation.getByRole('button', { name: 'Approuver' }).click();
  // Une autre pièce est déjà validée : c'est le passage de celle-ci qu'on vise.
  await page.waitForFunction(
    () => [...document.querySelectorAll('[data-testid=ligne-depense]')]
      .some((l) => l.textContent.includes('Électricien') && l.textContent.includes('Validée')),
  );
  verifier(true, 'approbation depuis l’écran : la pièce passe en Validée');

  // Le détail : une dépense payée n'offre que la remise en attente.
  await ligneNeuve.getByTitle('Détail').click();
  const detail = page.getByRole('dialog', { name: /^Dépense DEP-/ });
  await detail.getByTestId('remettre-depense-en-attente').waitFor();
  verifier((await detail.getByTestId('corriger-depense').count()) === 0 && (await detail.getByTestId('refuser-depense').count()) === 0,
    'une dépense payée ne se corrige ni ne se refuse : la seule porte est « Remettre en attente »');
  verifier((await texteDe(detail.getByTestId('decision-depense'))).includes('Approuvée'),
    'le détail dit qui a approuvé la sortie, et quand');
  await detail.getByTestId('remettre-depense-en-attente').click();
  await page.getByRole('dialog', { name: /^Remettre la dépense/ }).getByRole('button', { name: 'Remettre en attente' }).click();
  await page.waitForFunction(
    () => [...document.querySelectorAll('[data-testid=ligne-depense]')]
      .some((l) => l.textContent.includes('Électricien') && l.textContent.includes('En attente')),
  );
  verifier(true, 'remise en attente depuis l’écran : la pièce redevient corrigible');

  // Le refus, avec son motif.
  await ligneNeuve.getByTitle('Détail').click();
  await page.getByRole('dialog', { name: /^Dépense DEP-/ }).getByTestId('refuser-depense').click();
  await page.getByTestId('motif-refus').fill('Devis à revoir');
  await page.getByTestId('confirmer-refus').click();
  await page.waitForFunction(
    () => [...document.querySelectorAll('[data-testid=ligne-depense]')]
      .some((l) => l.textContent.includes('Électricien') && l.textContent.includes('Refusée')),
  );
  verifier(true, 'refus depuis l’écran, avec son motif');

  console.log('Sans le droit d’approuver');
  await simulerSession(page, { permissions: ['tresorerie.lire', 'tresorerie.mouvement'] });
  await page.goto(`${BASE_URL}/#/depenses`);
  await page.reload({ waitUntil: 'networkidle' });
  // Les droits arrivent après le premier rendu : tant qu'ils se lisent, l'écran
  // n'ouvre rien. C'est le bouton de saisie qu'on attend, pas le titre.
  await page.getByTestId('engager-depense').waitFor();
  verifier((await page.getByTestId('approuver-depenses').count()) === 0,
    'qui saisit une dépense ne l’approuve pas : sans quoi l’attente ne protégerait rien');

  verifier(erreurs.length === 0, `aucune erreur console${erreurs.length ? ' : ' + erreurs.join(' | ') : ''}`);
  await browser.close();
  console.log('\n✅ Dépenses : engagement, approbation, réouverture, refus');
})().catch((e) => { console.error(e.message); process.exit(1); });
