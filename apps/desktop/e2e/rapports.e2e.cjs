/**
 * Rapport des marges : où la maison gagne son argent.
 *
 * Le scénario monte une quincaillerie aux chiffres ronds — on sait d'avance ce
 * que chaque tuile, chaque barre et chaque ligne doivent afficher —, puis
 * vérifie que l'écran les retrouve, que les filtres resserrent, que la feuille
 * A4 les reprend et que le classeur Excel les rend. Aucun backend requis.
 *
 * Les articles portent une TVA nulle : hors taxes et toutes taxes se
 * confondent, et la marge se vérifie de tête.
 *
 * Le piège principal est la **remise** : elle se négocie en francs sur la
 * vente entière et n'est pas redescendue dans les lignes. Une vente remisée
 * est donc montée exprès, et le rapport doit compter son net, pas le brut de
 * ses lignes — sinon il annoncerait une marge que personne n'a gagnée.
 */
const { ouvrirNavigateur, simulerSession, verifier, BASE_URL } = require('./browser.cjs');

const texteDe = async (page, selecteur) => (await page.textContent(selecteur)).replace(/\s+/g, ' ').trim();
/** Les montants portent une espace insécable : on compare sur des chiffres nus. */
const montant = (t) => t.replace(/[\s  ]/g, '');

(async () => {
  const { browser, page, erreurs } = await ouvrirNavigateur();
  const { filialeId, userId, roleId } = await simulerSession(page, { profil: 'GERANT' });

  console.log('La quincaillerie de l’essai');
  const faits = await page.evaluate(async ({ F, U }) => {
    const { db } = await import('/src/infrastructure/powersync/database.ts');
    const { DepotsRepository } = await import('/src/infrastructure/powersync/repositories/DepotsRepository.ts');
    const { ArticlesRepository } = await import('/src/infrastructure/powersync/repositories/ArticlesRepository.ts');
    const { FamillesRepository } = await import('/src/infrastructure/powersync/repositories/FamillesRepository.ts');
    const { StockRepository } = await import('/src/infrastructure/powersync/repositories/StockRepository.ts');
    const { TresorerieRepository } = await import('/src/infrastructure/powersync/repositories/TresorerieRepository.ts');
    const { VentesRepository } = await import('/src/infrastructure/powersync/repositories/VentesRepository.ts');
    const { articleFormSchema, familleFormSchema } = await import('/src/core/articles/index.ts');

    const depots = new DepotsRepository(db);
    const articles = new ArticlesRepository(db);
    const familles = new FamillesRepository(db);
    const stock = new StockRepository(db);
    const ventes = new VentesRepository(db);

    const depot = await depots.create(F, { code: 'PRI', nom: 'Principal', adresse: '', responsable: '' });
    const famQ = await familles.create(F, familleFormSchema.parse({ code: 'QUI', nom: 'Quincaillerie' }));
    const famP = await familles.create(F, familleFormSchema.parse({ code: 'PEI', nom: 'Peinture' }));
    const art = (code, designation, famille_id, prix_achat, prix_vente) => articles.create(F, articleFormSchema.parse({
      code, designation, famille_id, prix_achat, prix_vente, tva: 0, stock_min: 0,
    }));
    const ciment = await art('CIM', 'Ciment 50 kg', famQ, 1000, 1500);
    const fer = await art('FER', 'Fer à béton 12', famQ, 2000, 3000);
    const peinture = await art('PEI20', 'Peinture 20 L', famP, 5000, 9000);
    // Soldé sous son prix de revient : c'est ce que le rapport doit crier.
    const solvant = await art('SOL', 'Solvant soldé', famP, 4000, 3000);

    const ctx = { filialeId: F, utilisateurId: U };
    await stock.enregistrerEntree(ctx, {
      depot_id: depot, type: 'ENTREE_ACHAT', reference: 'ENT-01', motif: 'Stock de départ',
      lignes: [
        { article_id: ciment, quantite: 100, cout_unitaire: 1000, remise_percent: 0 },
        { article_id: fer, quantite: 50, cout_unitaire: 2000, remise_percent: 0 },
        { article_id: peinture, quantite: 20, cout_unitaire: 5000, remise_percent: 0 },
        { article_id: solvant, quantite: 10, cout_unitaire: 4000, remise_percent: 0 },
      ],
    });

    const caisse = await new TresorerieRepository(db).createCaisse(F, { code: 'C1', nom: 'Caisse', responsable: '' });
    const ligne = async (id, quantite) => {
      const a = await db.get('SELECT * FROM articles WHERE id = ?', [id]);
      return { article_id: a.id, code: a.code, designation: a.designation, unite: a.unite, prix_unitaire_ttc: a.prix_vente, tva_percent: a.tva, quantite, remise_percent: 0 };
    };
    const vendre = (lignes, remise = 0) => ventes.enregistrer(
      { ...ctx, caisseId: caisse, caisseCode: 'C1', depotId: depot },
      { lignes, remise, client: null, paiement: { mode_paiement: 'ESPECES', montant_percu: 1_000_000 }, livraison: null, notes: '' },
    );

    // 10 ciments : 15 000 de chiffre, 10 000 de coût, 5 000 de marge.
    await vendre([await ligne(ciment, 10)]);
    // 5 fers : 15 000, 10 000 de coût, 5 000 de marge.
    await vendre([await ligne(fer, 5)]);
    // 2 pots de peinture : 18 000, 10 000 de coût, 8 000 de marge.
    await vendre([await ligne(peinture, 2)]);
    // 1 solvant soldé : 3 000 encaissés pour 4 000 de coût — 1 000 de perte.
    await vendre([await ligne(solvant, 1)]);
    // 10 ciments de plus, remisés de 5 000 F : 15 000 de lignes, 10 000 de net.
    // Le rapport doit compter 10 000, et la marge de cette vente est nulle.
    await vendre([await ligne(ciment, 10)], 5000);

    // Une vente annulée ne doit rien peser : son chiffre sort, et sa sortie de
    // stock est compensée par le retour.
    const annulee = await vendre([await ligne(fer, 3)]);
    const { calculerEmpreinte } = await import('/src/infrastructure/auth/empreinteLocale.ts');
    await db.execute(
      "INSERT OR REPLACE INTO parametres_filiale (id, filiale_id, nom_commercial, pays, assujetti_tva, taux_tva, prix_saisis, devise, code_annulation) VALUES (?, ?, 'Filiale Abidjan', 'Côte d''Ivoire', 0, 0, 'TTC', 'XOF', ?)",
      [crypto.randomUUID(), F, await calculerEmpreinte('A1B2C3')],
    );
    await ventes.annuler(ctx, annulee.id, 'Erreur de caisse', 'A1B2C3');

    // Et une vente du mois dernier, hors de la période par défaut.
    const vieille = await vendre([await ligne(ciment, 40)]);
    const recul = new Date(); recul.setDate(recul.getDate() - 45);
    const iso = recul.toISOString();
    await db.execute('UPDATE ventes SET date_vente = ?, created_at = ? WHERE id = ?', [iso, iso, vieille.id]);
    await db.execute('UPDATE lignes_vente SET created_at = ? WHERE vente_id = ?', [iso, vieille.id]);
    await db.execute('UPDATE mouvements_stock SET created_at = ? WHERE reference = ?', [iso, vieille.preparee.numero]);

    return { famQ, famP };
  }, { F: filialeId, U: userId });

  console.log('L’entrée de menu');
  await page.goto(`${BASE_URL}/#/`);
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('nav a[href="#/rapports"]').waitFor();
  verifier(await page.locator('nav a[href="#/rapports"]').count() === 1, 'la barre latérale porte l’entrée « Rapports »');

  console.log('Les chiffres du rapport');
  await page.locator('nav a[href="#/rapports"]').click();
  await page.locator('[data-testid=marges-ca-valeur]').waitFor();
  // Les requêtes sont vivantes : elles reviennent après le premier rendu.
  await page.waitForFunction(() => /61/.test(document.querySelector('[data-testid=marges-ca-valeur]').textContent));

  const valeur = async (testId) => montant(await texteDe(page, `[data-testid=${testId}-valeur]`));
  verifier(await valeur('marges-ca') === '61000F', 'chiffre d’affaires HT : 61 000 F, remise déduite');
  verifier(await valeur('marges-cout') === '44000F', 'coût d’achat de la marchandise vendue : 44 000 F');
  verifier(await valeur('marges-marge') === '17000F', 'marge commerciale : 61 000 − 44 000');
  verifier(await valeur('marges-taux') === '27,9%', 'taux de marge à la française : 27,9 %');
  verifier((await texteDe(page, '[data-testid=marges-compteur]')).includes('2 catégorie(s)'), 'deux catégories ont vendu');
  verifier((await texteDe(page, '[data-testid=marges-compteur]')).includes('4 article(s)'), 'quatre articles ont vendu');

  console.log('La remise de la vente, répartie sur ses lignes');
  const lignesArticles = async () => montant((await page.locator('[data-testid=ligne-article-marge]').allTextContents()).join(' | '));
  const ciment = (await page.locator('[data-testid=ligne-article-marge]', { hasText: 'Ciment' }).first().textContent()).replace(/\s+/g, ' ');
  // 15 000 + 10 000 de net, et non 15 000 + 15 000 : les 5 000 consentis au
  // comptoir ne sont pas du chiffre d'affaires.
  verifier(montant(ciment).includes('25000F'), 'le ciment compte 25 000 F de chiffre d’affaires, pas 30 000 F');
  verifier(montant(ciment).includes('20000F') && montant(ciment).includes('5000F'), 'et 20 000 F de coût pour 5 000 F de marge');

  console.log('La vente annulée et la vente du mois dernier');
  verifier(!(await lignesArticles()).includes('45000F'), 'la vente du mois dernier n’entre pas dans la période du mois en cours');
  const ferLigne = montant(await page.locator('[data-testid=ligne-article-marge]', { hasText: 'Fer' }).first().textContent());
  verifier(ferLigne.includes('15000F') && ferLigne.includes('10000F'), 'le fer annulé ne pèse ni au chiffre ni au coût : 15 000 / 10 000');

  console.log('Les catégories');
  // Les familles s'enregistrent en capitales : la comparaison l'ignore.
  const categories = await page.locator('[data-testid=ligne-categorie]').allTextContents();
  verifier(categories.length === 2, 'une ligne par catégorie');
  const categorie = (nom) => montant(categories.find((l) => new RegExp(nom, 'i').test(l)));
  const quincaillerie = categorie('quincaillerie');
  verifier(quincaillerie.includes('40000F') && quincaillerie.includes('30000F') && quincaillerie.includes('10000F'),
    'Quincaillerie : 40 000 de CA, 30 000 de coût, 10 000 de marge');
  verifier(quincaillerie.includes('25%'), 'et un taux de marge de 25 %');
  const peintureLigne = categorie('peinture');
  verifier(peintureLigne.includes('7000F') && peintureLigne.includes('33,3%'), 'Peinture : 7 000 de marge, 33,3 %');
  verifier(montant(await texteDe(page, '[data-testid=total-marge]')) === '17000F', 'le pied du tableau totalise 17 000 F de marge');

  console.log('Le graphique');
  verifier(await page.locator('[data-testid^=marge-]').count() === 2, 'une barre par catégorie');
  await page.locator(`[data-testid="marge-${faits.famP}"]`).hover();
  await page.locator('[data-testid=infobulle]').waitFor();
  const bulle = montant(await texteDe(page, '[data-testid=infobulle]'));
  verifier(bulle.includes('7000F') && bulle.includes('14000F'), 'l’infobulle donne la marge et le coût de la catégorie survolée');

  console.log('Ce qui s’est vendu à perte');
  const alerte = await texteDe(page, '[data-testid=marges-alerte-perte]');
  verifier(alerte.includes('1 article(s)') && alerte.includes('Solvant soldé'), 'le solvant soldé est signalé');
  verifier(montant(alerte).includes('-1000F'), 'et sa perte chiffrée à 1 000 F');

  console.log('Le classement');
  await page.getByTestId('marges-tri').selectOption('TAUX');
  await page.waitForFunction(() => /PEINTURE/i.test(document.querySelectorAll('[data-testid=ligne-categorie]')[0]?.textContent || ''));
  verifier(/PEINTURE/i.test(await page.locator('[data-testid=ligne-categorie]').first().textContent()),
    'classé par taux, la peinture passe devant malgré un chiffre d’affaires plus petit');
  await page.getByTestId('marges-tri').selectOption('CA');
  await page.waitForFunction(() => /QUINCAILLERIE/i.test(document.querySelectorAll('[data-testid=ligne-categorie]')[0]?.textContent || ''));
  verifier(true, 'classé par chiffre d’affaires, la quincaillerie reprend la tête');
  await page.getByTestId('marges-tri').selectOption('MARGE');

  console.log('Les filtres');
  await page.getByTestId('marges-filtre-categorie').selectOption(faits.famP);
  await page.waitForFunction(() => document.querySelector('[data-testid=marges-compteur]').textContent.includes('1 catégorie'));
  verifier((await texteDe(page, '[data-testid=marges-compteur]')).includes('2 article(s)'), 'la peinture seule : deux articles');
  verifier(montant(await texteDe(page, '[data-testid=total-marge]')) === '7000F', 'et 7 000 F de marge');
  verifier(await valeur('marges-ca') === '21000F', 'les tuiles suivent le filtre : 21 000 F de chiffre d’affaires');

  await page.getByTestId('marges-recherche').fill('solvant');
  await page.waitForFunction(() => document.querySelectorAll('[data-testid=ligne-article-marge]').length === 1);
  verifier(montant(await texteDe(page, '[data-testid=marges-marge-valeur]')) === '-1000F', 'la recherche isole le solvant et sa perte');

  await page.getByTestId('marges-recherche').fill('');
  await page.getByTestId('marges-filtre-categorie').selectOption('');
  await page.waitForFunction(() => document.querySelector('[data-testid=marges-compteur]').textContent.includes('2 catégorie'));

  console.log('La feuille imprimée');
  await page.getByTestId('imprimer-marges').click();
  await page.locator('#zone-impression [data-testid=article-imprime]').first().waitFor();
  verifier(await page.locator('#zone-impression [data-testid=categorie-imprimee]').count() === 2, 'deux catégories imprimées');
  verifier(await page.locator('#zone-impression [data-testid=article-imprime]').count() === 4, 'quatre articles détaillés');
  verifier(montant(await texteDe(page, '#zone-impression [data-testid=marge-totale-imprimee]')) === '17000F', 'la feuille totalise 17 000 F de marge');
  const feuille = montant(await texteDe(page, '#zone-impression'));
  verifier(feuille.includes('du') && feuille.includes('toutescatégories'), 'la feuille dit son périmètre');
  verifier(feuille.includes('venduàperte') || feuille.includes('Venduàperte'), 'et signale ce qui s’est vendu à perte');
  verifier(feuille.includes('Legérant') && feuille.includes('Ladirection'), 'deux cases à signer');
  await page.keyboard.press('Escape');

  console.log('L’export Excel');
  const telechargement = page.waitForEvent('download');
  await page.getByTestId('exporter-marges').click();
  const fichier = await telechargement;
  const classeur = require('xlsx').readFile(await fichier.path());
  const feuilleCategories = require('xlsx').utils.sheet_to_json(classeur.Sheets['Catégories']);
  const feuilleArticles = require('xlsx').utils.sheet_to_json(classeur.Sheets.Articles);
  verifier(/^rapport-marges-\d{4}-\d{2}-\d{2}\.xlsx$/.test(fichier.suggestedFilename()), `export Excel : fichier ${fichier.suggestedFilename()}`);
  verifier(feuilleCategories.length === 2 && feuilleCategories.reduce((t, l) => t + l.Marge, 0) === 17000,
    'première feuille : les catégories, 17 000 F de marge');
  verifier(feuilleArticles.length === 4 && feuilleArticles.some((l) => l.Code === 'SOL' && l.Marge === -1000),
    'seconde feuille : les articles, perte du solvant comprise');

  console.log('Sans le droit de lire les chiffres de gestion');
  await page.evaluate(async (role) => {
    const { db } = await import('/src/infrastructure/powersync/database.ts');
    // Rôle ordinaire sans aucune permission : le rapport donne les prix
    // d'achat, il ne s'ouvre pas à n'importe qui.
    await db.execute('UPDATE roles SET est_superadmin = 0 WHERE id = ?', [role]);
  }, roleId);
  await page.goto(`${BASE_URL}/#/rapports`);
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('text=ne vous sont pas ouverts').waitFor();
  verifier(await page.locator('nav a[href="#/rapports"]').count() === 0, 'l’entrée de menu disparaît');
  verifier((await texteDe(page, 'main')).includes('Les rapports de gestion ne vous sont pas ouverts'),
    'et l’URL tapée à la main se refuse');

  if (erreurs.length) throw new Error(`Erreurs console :\n${erreurs.join('\n')}`);
  console.log('\nRapport des marges : OK');
  await browser.close();
})().catch(async (e) => { console.error(e.message); process.exit(1); });
