// Scénario Catalogue : repositories sur la vraie base SQLite locale, puis parcours UI.
// Prérequis : `pnpm dev` lancé (http://localhost:1420). Aucun backend requis.
const { ouvrirNavigateur, simulerSession, verifier, BASE_URL } = require('./browser.cjs');

/** Texte d'un conteneur, espaces insécables de `formaterFcfa` normalisés. */
const texteDe = async (locator) => (await locator.textContent()).replace(/\s+/g, ' ');
const texteContient = async (locator, attendu) => (await texteDe(locator)).includes(attendu);

(async () => {
  const { browser, page, erreurs } = await ouvrirNavigateur();
  const { filialeId } = await simulerSession(page);

  console.log('Repositories (base locale)');
  const r = await page.evaluate(async (F) => {
    const { db } = await import('/src/infrastructure/powersync/database.ts');
    const { ArticlesRepository, articlesQuery } = await import('/src/infrastructure/powersync/repositories/ArticlesRepository.ts');
    const { FamillesRepository } = await import('/src/infrastructure/powersync/repositories/FamillesRepository.ts');
    const { articleFormSchema } = await import('/src/core/articles/index.ts');
    const familles = new FamillesRepository(db);
    const fid = await familles.create(F, { code: 'SAN', nom: 'SANITAIRE', description: '' });
    const articles = new ArticlesRepository(db);
    const form = articleFormSchema.parse({ code: 'rob-01', designation: 'Robinet', famille_id: fid, prix_achat: '8500', prix_vente: '12500' });
    const aid = await articles.create(F, form);
    await articles.update(aid, { ...form, prix_vip: 12000 });
    const imp = await articles.importMany(F, [
      { code: 'ROB-01', designation: 'Doublon', prix_achat: 1, prix_vente: 2, famille_nom: 'Sanitaire' },
      { code: 'CIM-50', designation: 'Ciment 50kg', prix_achat: 4500, prix_vente: 5500, famille_nom: 'Ciment' },
    ]);
    const q = articlesQuery(F, { recherche: 'cim' });

    // Stock et ventes du robinet, pour nourrir la fiche article.
    const { DepotsRepository } = await import('/src/infrastructure/powersync/repositories/DepotsRepository.ts');
    const { StockRepository } = await import('/src/infrastructure/powersync/repositories/StockRepository.ts');
    const depotId = await new DepotsRepository(db).create(F, { code: 'MAG', nom: 'Magasin central', adresse: '', responsable: '' });
    await new StockRepository(db).enregistrerEntree({ filialeId: F, utilisateurId: null }, {
      depot_id: depotId, type: 'ENTREE_ACHAT', reference: 'BL-7', motif: 'Appro',
      lignes: [{ article_id: aid, quantite: 10, cout_unitaire: 8500 }],
    });

    const jours = (n) => new Date(Date.now() - n * 86400000).toISOString();
    const vente = async (numero, date, statut, quantite, ht, ttc, prixTtc) => {
      const vid = crypto.randomUUID();
      await db.execute('INSERT INTO ventes (id, numero, date_vente, filiale_id, total_ttc, statut, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [vid, numero, date, F, ttc, statut, date, date]);
      await db.execute('INSERT INTO lignes_vente (id, vente_id, filiale_id, article_id, quantite, total_ht, total_ttc, prix_unitaire_ttc) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [crypto.randomUUID(), vid, F, aid, quantite, ht, ttc, prixTtc]);
    };
    await vente('V-1', jours(40), 'VALIDEE', 4, 42372, 50000, 12500);
    await vente('V-2', jours(2), 'VALIDEE', 2, 20339, 24000, 12000);
    await vente('V-3', jours(1), 'ANNULEE', 50, 500000, 590000, 11800);

    const {
      STOCK_ARTICLE_QUERY, VENTES_ARTICLE_QUERY, VENTES_MENSUELLES_ARTICLE_QUERY,
    } = await import('/src/infrastructure/powersync/repositories/ArticlesRepository.ts');
    const { indicateursArticle, totauxStock, statutStock } = await import('/src/core/articles/index.ts');
    const lignesStock = (await db.getAll(STOCK_ARTICLE_QUERY, [aid])).map((l) => ({ ...l, depot_nom: l.depot_nom ?? '' }));
    const ventes = await db.get(VENTES_ARTICLE_QUERY, [aid, jours(90)]);
    const mensuelles = await db.getAll(VENTES_MENSUELLES_ARTICLE_QUERY, [aid, jours(365)]);
    const totaux = totauxStock(lignesStock);

    return {
      prixVip: (await db.get('SELECT prix_vip FROM articles WHERE id = ?', [aid])).prix_vip,
      importes: imp.importes, ignores: imp.ignores.length,
      recherche: (await db.getAll(q.sql, q.params)).map((a) => a.code),
      enAttente: (await db.getCrudBatch(100))?.crud.length ?? 0,
      stockFiche: { depots: lignesStock.length, depot: lignesStock[0]?.depot_nom, ...totaux },
      ventes,
      mois: mensuelles.length,
      moisRecent: mensuelles[0],
      couverture: indicateursArticle(
        { prix_achat: 8500, prix_vente: 12500, prix_vip: 12000, stock_min: 0, stock_max: 0 },
        totaux, { ...ventes, derniere_date: ventes.derniere_date }, 90,
      ).couverture_jours,
      statutRupture: statutStock({ stock_min: 5, stock_max: 0 }, 0),
    };
  }, filialeId);
  verifier(r.prixVip === 12000, 'update partiel appliqué');
  verifier(r.importes === 1 && r.ignores === 1, 'import : doublon ignoré, nouveau code importé');
  verifier(r.recherche.join() === 'CIM-50', 'filtre SQL par recherche');
  verifier(r.enAttente > 0, `${r.enAttente} écritures en file d'upload`);
  verifier(r.stockFiche.depots === 1 && r.stockFiche.quantite === 10 && r.stockFiche.valeur === 85000, 'fiche : stock par dépôt valorisé au coût moyen');
  verifier(r.ventes.quantite === 6 && r.ventes.nombre_ventes === 2, 'fiche : ventes agrégées, vente annulée exclue');
  verifier(r.ventes.total_ht === 62711, 'fiche : chiffre d’affaires HT de la période');
  verifier(r.ventes.dernier_prix === 12000, 'fiche : dernier prix pratiqué pris sur la vente la plus récente');
  verifier(r.mois === 2 && r.moisRecent.quantite === 2, 'fiche : ventes mois par mois');
  verifier(r.couverture === 150, 'fiche : couverture du stock au rythme de la période');
  verifier(r.statutRupture === 'RUPTURE', 'fiche : rupture signalée à stock nul');

  console.log('Interface');
  await page.goto(`${BASE_URL}/#/articles`);
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('main h1', { hasText: 'Catalogue' }).waitFor();
  await page.locator('aside').locator('text=Awa Koné').waitFor();
  verifier(true, 'profil réel affiché dans la sidebar');
  verifier((await page.locator('tbody tr').count()) === 2, 'articles listés en temps réel');

  await page.getByRole('button', { name: 'Nouvel article' }).click();
  await page.locator('#article-form input[name=code]').fill('PEI-20L');
  await page.locator('#article-form input[name=designation]').fill('Peinture 20L');
  await page.locator('#article-form input[name=prix_achat]').fill('35000');
  await page.locator('#article-form input[name=prix_vente]').fill('42000');
  await page.locator('#article-form input[name=stock_min]').fill('5');
  await page.locator('#article-form input[name=stock_max]').fill('2');
  await page.getByRole('button', { name: 'Créer' }).click();
  verifier((await page.textContent('#article-form p.text-red-600')).includes('stock maximum'), 'validation stock max < min');
  await page.locator('#article-form input[name=stock_max]').fill('40');
  await page.getByRole('button', { name: 'Créer' }).click();
  await page.locator('[aria-live]', { hasText: 'PEI-20L créé' }).waitFor();
  await page.locator('tbody tr', { hasText: 'PEI-20L' }).waitFor();
  verifier((await page.locator('tbody tr').count()) === 3, 'création via formulaire');

  await page.getByRole('button', { name: 'Nouvel article' }).click();
  await page.locator('#article-form input[name=code]').fill('pei-20l');
  await page.locator('#article-form input[name=designation]').fill('X');
  await page.locator('#article-form input[name=prix_achat]').fill('1');
  await page.locator('#article-form input[name=prix_vente]').fill('2');
  await page.getByRole('button', { name: 'Créer' }).click();
  await page.locator('#article-form p.text-red-600', { hasText: 'existe déjà' }).waitFor();
  verifier(true, 'doublon de code refusé');
  await page.keyboard.press('Escape');

  await page.locator('input[type=search]').fill('pein');
  await page.locator('tbody tr', { hasText: 'Peinture' }).waitFor();
  await page.locator('tbody tr', { hasText: 'Robinet' }).waitFor({ state: 'detached' });
  verifier((await page.locator('tbody tr').count()) === 1, 'recherche temps réel');

  console.log('Import d’un export de catalogue');
  // Classeur .xls de la même forme que les exports ETAT_LISTEARTICLE :
  // un titre, la ligne d'entêtes, les articles, une ligne de totaux.
  const classeur = (() => {
    const XLSX = require('xlsx');
    const feuille = XLSX.utils.aoa_to_sheet([
      ['CATALOGUE ARTICLE [ Revente (Produits finis) ]'],
      ['CODE', 'DESIGNATION', 'P. ACHAT', 'P. VENTE', 'FAMILLE'],
      ['01408202625001', '250001 METRE CARREAU 25/40', 2166, 2500, 'CARREAU'],
      ['ABAT3', 'ABATANT WC INDUSTRAP', 1080, 1100, 'PLOMBERIE'],
      ['ROB-01', 'Doublon à ignorer', 1, 2, 'SANITAIRE'],
      [null, 'TOTAL GENERAL', 3247, 3602, null],
    ]);
    const livre = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(livre, feuille, 'A');
    return XLSX.write(livre, { type: 'buffer', bookType: 'xls' });
  })();
  await page.locator('input[type=search]').fill('');
  await page.setInputFiles('input[type=file]', { name: 'ETAT_LISTEARTICLE.xls', mimeType: 'application/vnd.ms-excel', buffer: classeur });
  await page.locator('[aria-live]', { hasText: '2 article(s) importé(s)' }).waitFor();
  verifier(true, 'import : 2 nouveaux articles, titre et totaux écartés');
  await page.locator('[aria-live]', { hasText: 'code déjà présent' }).waitFor();
  verifier(true, 'import : code déjà présent signalé ligne par ligne');
  await page.locator('tbody tr', { hasText: '01408202625001' }).waitFor();
  verifier(true, 'import : le premier article de la feuille n’est pas perdu');

  console.log('Fiche article');
  await page.locator('[data-testid="detail-ROB-01"]').click();
  const fiche = page.locator('[role=dialog][aria-label="Robinet"]');
  await fiche.waitFor();
  verifier((await fiche.textContent()).includes('Magasin central'), 'fiche : stock par dépôt affiché');
  verifier(await texteContient(fiche, '85 000 F'), 'fiche : valeur du stock');
  verifier(await texteContient(fiche, '4 000 F · 47 %'), 'fiche : marge unitaire et taux');
  verifier((await fiche.locator('[data-testid=statut-stock-article]').textContent()).trim() === 'Normal', 'fiche : état du stock');
  verifier((await fiche.locator('[data-testid=mouvements-article] tbody tr').count()) === 1, 'fiche : mouvement d’entrée listé');
  verifier(await texteContient(fiche, 'BL-7'), 'fiche : référence du bon reprise dans les mouvements');
  verifier(await texteContient(fiche, 'dernier prix pratiqué 12 000 F'), 'fiche : dernier prix pratiqué');

  await fiche.locator('[data-testid=periode-fiche-article]').selectOption('30');
  await fiche.getByText('2 PIECE', { exact: false }).first().waitFor();
  verifier(true, 'fiche : période 30 jours, seule la vente récente est comptée');

  await fiche.getByTestId('imprimer-fiche-article').click();
  const doc = page.locator('#zone-impression');
  await doc.waitFor();
  const rapport = await texteDe(doc);
  verifier(rapport.includes('Fiche article — ROB-01'), 'rapport : titre et code article');
  verifier(rapport.includes('Robinet') && rapport.includes('SANITAIRE'), 'rapport : identification');
  verifier(rapport.includes('Prix de vente : 12 500 F') && rapport.includes('Marge : 4 000 F (47 %)'), 'rapport : tarifs et marge');
  verifier(rapport.includes('Magasin central') && rapport.includes('85 000 F'), 'rapport : stock par dépôt valorisé');
  verifier(rapport.includes('Entrée achat') && rapport.includes('BL-7'), 'rapport : mouvements de stock');
  verifier((await doc.locator('svg.code-barres rect').count()) > 20, 'rapport : code-barres de l’article');
  await doc.getByRole('button', { name: "Fermer l'aperçu" }).click();
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: 'Familles' }).click();
  await page.locator('tbody tr', { hasText: 'SANITAIRE' }).waitFor();
  await page.locator('tbody tr', { hasText: 'CARREAU' }).waitFor();
  verifier((await page.locator('tbody tr').count()) === 4, 'onglet familles (dont familles créées par les imports)');

  verifier(erreurs.length === 0, `aucune erreur console${erreurs.length ? ' : ' + erreurs.join(' | ') : ''}`);
  await browser.close();
  console.log('OK');
})().catch((e) => { console.error(e.message); process.exit(1); });
