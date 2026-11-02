/**
 * Historiques : les pièces déjà passées, réunies sous un même menu.
 *
 * Le scénario fabrique une pièce de chaque sorte, puis vérifie que chaque
 * section la retrouve, la totalise, l'imprime, l'exporte, et sait rouvrir la
 * pièce d'origine. Aucun backend requis.
 */
const { ouvrirNavigateur, simulerSession, verifier, BASE_URL } = require('./browser.cjs');

const texteDe = async (page, selecteur) => (await page.textContent(selecteur)).replace(/\s+/g, ' ');

(async () => {
  const { browser, page, erreurs } = await ouvrirNavigateur();
  const { filialeId, userId } = await simulerSession(page);

  console.log('Pièces de départ');
  const r = await page.evaluate(async ({ F, U }) => {
    const { db } = await import('/src/infrastructure/powersync/database.ts');
    const { DepotsRepository } = await import('/src/infrastructure/powersync/repositories/DepotsRepository.ts');
    const { ArticlesRepository } = await import('/src/infrastructure/powersync/repositories/ArticlesRepository.ts');
    const { StockRepository } = await import('/src/infrastructure/powersync/repositories/StockRepository.ts');
    const { ProductionsRepository } = await import('/src/infrastructure/powersync/repositories/ProductionsRepository.ts');
    const { FournisseursRepository } = await import('/src/infrastructure/powersync/repositories/FournisseursRepository.ts');
    const { articleFormSchema } = await import('/src/core/articles/index.ts');
    const { fournisseurFormSchema, bonCommandeSchema } = await import('/src/core/fournisseurs/index.ts');

    const depots = new DepotsRepository(db);
    const d1 = await depots.create(F, { code: 'D1', nom: 'Principal', adresse: '', responsable: '' });
    const d2 = await depots.create(F, { code: 'D2', nom: 'Annexe', adresse: '', responsable: '' });
    const articles = new ArticlesRepository(db);
    const a1 = await articles.create(F, articleFormSchema.parse({ code: 'CIM-50', designation: 'Ciment 50kg', prix_achat: 4500, prix_vente: 5500 }));
    const a2 = await articles.create(F, articleFormSchema.parse({ code: 'BRQ-15', designation: 'Brique 15', prix_achat: 0, prix_vente: 600 }));
    const fid = await new FournisseursRepository(db).create(F, fournisseurFormSchema.parse({ raison_sociale: 'SOCIMAT CI' }));

    const stock = new StockRepository(db);
    const ctx = { filialeId: F, utilisateurId: U };
    const out = {};

    // Deux bons d'entrée, dont un à deux lignes : la liste compte des pièces, pas des lignes.
    await stock.enregistrerEntree(ctx, { depot_id: d1, type: 'ENTREE_ACHAT', fournisseur_id: fid, reference: 'BL-1001', motif: 'Livraison du matin', lignes: [{ article_id: a1, quantite: 200, cout_unitaire: 4500 }, { article_id: a2, quantite: 100, cout_unitaire: 400 }] });
    await stock.enregistrerEntree(ctx, { depot_id: d1, type: 'ENTREE_ACHAT', fournisseur_id: fid, reference: 'BL-1002', motif: '', lignes: [{ article_id: a1, quantite: 50, cout_unitaire: 4600 }] });
    out.transfert = await stock.transferer(ctx, { depot_source_id: d1, depot_destination_id: d2, reference: '', motif: 'Appro. Annexe', lignes: [{ article_id: a1, quantite: 40 }] });
    out.casse = await stock.enregistrerSortie(ctx, { depot_id: d1, type: 'CASSE', reference: '', motif: 'Sacs éventrés', lignes: [{ article_id: a1, quantite: 3 }] });
    const inv = await stock.enregistrerInventaire(ctx, { depot_id: d1, reference: '', motif: 'Inventaire mensuel', lignes: [{ article_id: a1, quantite_comptee: 200 }] });
    out.inventaire = inv.reference;

    const prod = await new ProductionsRepository(db).enregistrer(ctx, {
      depot_id: d1, numero: '', equipe: 'Matin', date_debut: new Date().toISOString().slice(0, 16), date_fin: '', commentaire: '',
      matieres: [{ article_id: a1, quantite: 2 }], produits: [{ article_id: a2, quantite_prevue: 20, quantite: 20, pertes: 0 }],
    });
    out.production = prod.numero;

    const bon = await new FournisseursRepository(db).creerBonCommande(ctx, bonCommandeSchema.parse({
      fournisseur_id: fid, depot_id: d1, numero: 'BC-HISTO', remise_percent: 0, tva_percent: 0,
      lignes: [{ article_id: a1, quantite: 10, prix_unitaire_ht: 4500, remise_percent: 0 }],
    }));
    out.bonCommande = bon.numero;
    return out;
  }, { F: filialeId, U: userId });

  verifier(/^TRF-/.test(r.transfert) && /^CAS-/.test(r.casse) && /^INV-/.test(r.inventaire), 'pièces de stock numérotées (transfert, casse, inventaire)');

  console.log('Menu et sections');
  await page.goto(`${BASE_URL}/#/historiques`);
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('main h1', { hasText: 'Historiques' }).waitFor();
  await page.waitForURL(/#\/historiques\/ventes$/);
  verifier(true, 'sans section, le menu ouvre les ventes');

  const sousMenu = page.locator('[data-testid=sous-menu-historiques]');
  await sousMenu.waitFor();
  verifier((await sousMenu.locator('a').count()) === 7, 'sous-menu Historiques : 7 sections dans la barre latérale');

  const lignes = (n) => page.waitForFunction((attendu) => document.querySelectorAll('[data-testid^="piece-"]').length === attendu, n);
  const compteur = page.getByTestId('compteur-historique');
  const resume = async () => (await compteur.textContent()).replace(/\s+/g, ' ');

  console.log('Entrées en stock');
  await sousMenu.getByRole('link', { name: 'Entrées en stock (achat)' }).click();
  await page.waitForURL(/#\/historiques\/entrees$/);
  await lignes(2);
  // 200 × 4 500 + 100 × 400 = 940 000, puis 50 × 4 600 = 230 000.
  verifier((await resume()).includes("2 bon d’entrée(s)") && (await resume()).includes('3 ligne(s)') && (await resume()).includes('1 170 000 F'),
    `entrées : deux bons, trois lignes, valeur totalisée (${await resume()})`);
  verifier((await texteDe(page, '[data-testid="piece-BL-1001"]')).includes('SOCIMAT CI'), 'entrées : le fournisseur du bon est repris');

  await page.getByTestId('historique-recherche').fill('BL-1002');
  await lignes(1);
  verifier((await resume()).includes('230 000 F'), 'recherche : la liste et le total suivent la pièce retenue');
  await page.getByTestId('historique-recherche').fill('');
  await lignes(2);

  console.log('Document et export');
  await page.getByTestId('imprimer-historique').click();
  const doc = page.locator('#zone-impression');
  await doc.locator('[data-testid=ligne-historique]').first().waitFor();
  const papier = await texteDe(page, '#zone-impression');
  verifier((await doc.locator('[data-testid=ligne-historique]').count()) === 2, 'document : une ligne par pièce');
  verifier(papier.includes('Historique — Entrées en stock (achat)') && papier.includes('Filiale Abidjan'), 'document : titre et en-tête de la maison');
  verifier(papier.includes('du 01/') || papier.includes('du 19/'), 'document : période écrite sur la feuille');
  verifier((await doc.getByTestId('total-historique').textContent()).replace(/\s/g, '') === '1170000F', 'document : total du périmètre');
  verifier(!papier.includes('Point de Vente') && !papier.includes('Consolidation'), 'document : ni menu ni bandeau de l’application');
  await doc.getByRole('button', { name: "Fermer l'aperçu" }).click();

  const telechargement = page.waitForEvent('download');
  await page.getByTestId('exporter-historique').click();
  const fichier = await telechargement;
  const feuille = require('xlsx').utils.sheet_to_json(require('xlsx').readFile(await fichier.path()).Sheets['Entrées en stock (achat)']);
  verifier(/^historique-entrees-\d{4}-\d{2}-\d{2}\.xlsx$/.test(fichier.suggestedFilename()), `export Excel : fichier ${fichier.suggestedFilename()}`);
  const bl1001 = feuille.find((l) => l['N° de pièce'] === 'BL-1001');
  verifier(feuille.length === 2 && bl1001.Fournisseur === 'SOCIMAT CI' && bl1001.Lignes === 2 && bl1001['Valeur entrée'] === 940000,
    'export Excel : pièce, fournisseur, lignes et valeur relus depuis le classeur');

  console.log('Réédition de la pièce');
  await page.getByTestId('ouvrir-BL-1001').click();
  const bon = page.locator('#zone-impression.apercu-impression');
  await bon.waitFor();
  const papierBon = await texteDe(page, '#zone-impression');
  verifier(papierBon.includes("Bon d'entrée — achat") && papierBon.includes('BL-1001'), 'la pièce d’origine se rouvre depuis l’historique');
  verifier(papierBon.includes('CIM-50') && papierBon.includes('BRQ-15'), 'réédition : les deux lignes du bon');
  await bon.getByRole('button', { name: "Fermer l'aperçu" }).click();

  console.log('Les autres sections');
  await sousMenu.getByRole('link', { name: 'Transferts inter-dépôt' }).click();
  await lignes(1);
  // Un transfert écrit deux mouvements par article : le bon ne compte qu'une ligne.
  verifier((await resume()).includes('1 bon de transfert(s)') && (await resume()).includes('1 ligne(s)'),
    `transferts : la sortie seule fait la pièce (${await resume()})`);
  // 40 sacs au coût moyen du dépôt (200 à 4 500 puis 50 à 4 600 = 4 520).
  verifier((await resume()).includes('180 800 F'), 'transferts : la valeur partie est celle du coût moyen du dépôt');

  await sousMenu.getByRole('link', { name: 'Déstockages et casses' }).click();
  await lignes(1);
  verifier((await texteDe(page, `[data-testid="piece-${r.casse}"]`)).includes('Sacs éventrés'), 'déstockages : le motif tient lieu de tiers');
  // 3 sacs cassés au coût moyen : une casse coûte de l'argent, le bon le dit.
  verifier((await resume()).includes('13 560 F'), `casse : la perte est chiffrée (${await resume()})`);

  await sousMenu.getByRole('link', { name: 'Inventaires' }).click();
  await lignes(1);
  verifier((await texteDe(page, `[data-testid="piece-${r.inventaire}"]`)).includes('Inventaire mensuel'), 'inventaires : la fiche est retrouvée');

  await sousMenu.getByRole('link', { name: 'Productions' }).click();
  await lignes(1);
  verifier((await resume()).includes('2 ligne(s)') && (await resume()).includes('9 040 F'),
    `productions : deux lignes (matière + produit), coût des matières au coût moyen 2 × 4 520 (${await resume()})`);
  await page.getByTestId(`ouvrir-${r.production}`).click();
  await page.getByRole('dialog').locator('td', { hasText: 'CIM-50' }).waitFor();
  verifier(true, 'productions : le détail de la pièce se rouvre');
  await page.keyboard.press('Escape');

  await sousMenu.getByRole('link', { name: 'Commandes fournisseurs' }).click();
  // Trois pièces : le bon de commande envoyé, et les deux entrées en stock
  // reçues d'un fournisseur — elles sont portées à son compte, donc listées ici.
  await lignes(3);
  verifier((await texteDe(page, '[data-testid="piece-BC-HISTO"]')).includes('SOCIMAT CI'), 'commandes : le bon de commande est listé');
  verifier((await texteDe(page, '[data-testid="piece-BL-1001"]')).includes('940 000 F'),
    'commandes : l’entrée en stock d’un fournisseur figure à son compte, au net reçu');
  await page.getByTestId('ouvrir-BC-HISTO').click();
  await page.locator('#zone-impression .document-titre', { hasText: 'Bon de commande fournisseur' }).waitFor();
  verifier(true, 'commandes : un bon sans réception rouvre son bon, pas une facture');
  await page.locator('#zone-impression').getByRole('button', { name: "Fermer l'aperçu" }).click();

  console.log('Filtre par période');
  await sousMenu.getByRole('link', { name: 'Entrées en stock (achat)' }).click();
  await lignes(2);
  // Une période close avant aujourd'hui ne doit rien contenir : les pièces datent de ce jour.
  await page.getByTestId('historique-debut').fill('2026-01-01');
  await page.getByTestId('historique-fin').fill('2026-01-31');
  await page.locator('text=Aucune pièce dans ce périmètre').waitFor();
  verifier((await resume()).includes('0 bon'), 'période close sans pièce : liste et total à zéro, et la page le dit');

  verifier(erreurs.length === 0, `aucune erreur console${erreurs.length ? ' : ' + erreurs.join(' | ') : ''}`);
  await browser.close();
  console.log('OK');
})().catch((e) => { console.error(e.message); process.exit(1); });
