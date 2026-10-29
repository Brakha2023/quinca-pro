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
  // La requête vivante revient après le premier rendu : compter tout de suite
  // photographie la liste vide d'avant, et le scénario échoue au hasard.
  await page.waitForFunction(() => document.querySelectorAll('tbody tr').length === 2);
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
  // Les lignes arrivent de PowerSync après l'ouverture : on attend la donnée, pas le rendu.
  await fiche.locator('[data-testid=stock-article] tbody tr').first().waitFor();
  await fiche.locator('[data-testid=mouvements-article] tbody tr').first().waitFor();
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

  console.log('Catalogue imprimé');
  // Un vrai catalogue, de la taille de celui de la maison : c'est ce volume
  // qui faisait apparaître le défaut (liste coupée à la hauteur de l'écran).
  const gros = (() => {
    const XLSX = require('xlsx');
    const lignes = [['CODE', 'DESIGNATION', 'P. ACHAT', 'P. VENTE', 'FAMILLE']];
    for (let i = 1; i <= 120; i += 1) {
      lignes.push([`CAT-${String(i).padStart(3, '0')}`, `Article de catalogue ${i}`, 1000 + i, 1500 + i, 'CARREAU']);
    }
    const livre = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(livre, XLSX.utils.aoa_to_sheet(lignes), 'A');
    return XLSX.write(livre, { type: 'buffer', bookType: 'xls' });
  })();
  await page.setInputFiles('input[type=file]', { name: 'CATALOGUE.xls', mimeType: 'application/vnd.ms-excel', buffer: gros });
  await page.locator('[aria-live]', { hasText: '120 article(s) importé(s)' }).waitFor();
  await page.locator('tbody tr', { hasText: 'CAT-120' }).waitFor();

  const compteur = page.getByTestId('compteur-articles');
  const nombreAffiche = async () => Number((await compteur.textContent()).match(/\d+/)[0]);
  const catalogue = page.locator('#zone-impression');

  // Tout le catalogue : c'est le cas qui échouait, la liste s'arrêtant à ce
  // qui tenait dans la fenêtre.
  const total = await nombreAffiche();
  await page.getByTestId('imprimer-catalogue').click();
  await catalogue.locator('[data-testid=ligne-catalogue]').first().waitFor();
  const lignes = await catalogue.locator('[data-testid=ligne-catalogue]').count();
  verifier(total > 100 && lignes === total, `catalogue imprimé : les ${total} articles, pas seulement ce qui tenait à l'écran`);

  const papier = await texteDe(catalogue);
  verifier(papier.includes('Catalogue des articles'), 'catalogue imprimé : titre du document');
  verifier(papier.includes('Filiale Abidjan'), 'catalogue imprimé : en-tête de la maison');
  verifier(papier.includes('toutes familles · articles actifs seulement'), 'catalogue imprimé : périmètre de la liste annoncé');
  verifier(papier.includes('Marge moyenne'), 'catalogue imprimé : récapitulatif');
  verifier(papier.includes('ROB-01') && papier.includes('12 500 F'), 'catalogue imprimé : code et prix de vente');
  // Le défaut d'origine : la page entière partait à l'impression, menu compris.
  verifier(!papier.includes('Point de Vente') && !papier.includes('Consolidation') && !papier.includes('Importer Excel'),
    'catalogue imprimé : ni menu, ni barre d’outils, ni bandeau de l’application');
  verifier((await catalogue.locator('.document-liste thead').count()) === 1, 'catalogue imprimé : entêtes de tableau répétées de page en page');
  // Le pied est répété au bas de chaque page par le moteur d'impression :
  // sans lui, les pages 2 et suivantes ne portent aucune identification.
  verifier(/Catalogue des articles · Filiale Abidjan · édité le \d{2}\/\d{2}\/\d{4} · \d+ article\(s\)/.test(papier),
    'catalogue imprimé : pied identifiant les pages suivantes');
  await catalogue.getByRole('button', { name: "Fermer l'aperçu" }).click();

  // Filtré : le document doit dire sur quoi il porte, sinon une liste partielle
  // se lit comme le catalogue entier.
  await page.locator('select').first().selectOption({ label: 'SANITAIRE' });
  await page.waitForFunction((avant) => {
    const p = document.querySelector('[data-testid=compteur-articles]');
    return p && Number(p.textContent.match(/\d+/)[0]) < avant;
  }, total);
  const filtres = await nombreAffiche();
  await page.getByTestId('imprimer-catalogue').click();
  await catalogue.locator('[data-testid=ligne-catalogue]').first().waitFor();
  const papierFiltre = await texteDe(catalogue);
  verifier((await catalogue.locator('[data-testid=ligne-catalogue]').count()) === filtres, `catalogue filtré : ${filtres} article(s) imprimé(s)`);
  verifier(papierFiltre.includes('famille « SANITAIRE »'), 'catalogue filtré : la famille retenue est écrite sur le document');
  await catalogue.getByRole('button', { name: "Fermer l'aperçu" }).click();
  await page.locator('select').first().selectOption('');
  await page.locator('tbody tr', { hasText: '01408202625001' }).waitFor();

  console.log('Suppression d’un article jamais utilisé');
  // La base du poste ne garde que douze mois d'activité : elle ne peut pas
  // prouver qu'un article n'a jamais servi. La suppression interroge donc le
  // serveur, simulé ici par interception REST — PostgREST rend un comptage
  // dans l'en-tête `Content-Range`, pas dans le corps de la réponse.
  let usagesServeur = 0;
  const comptages = [];
  await page.route(
    '**/rest/v1/{stocks,mouvements_stock,lignes_vente,lignes_proforma,lignes_commande_fournisseur,lignes_production,lignes_transfert_stock,ventes_brouillons}*',
    (route) => {
      comptages.push(route.request().url());
      // `Content-Range` porte le compte ; sans `Access-Control-Expose-Headers`,
      // le navigateur le cache au code (requête d'une autre origine).
      route.fulfill({
        status: 200,
        headers: {
          'content-range': `*/${usagesServeur}`,
          'access-control-allow-origin': '*',
          'access-control-expose-headers': 'content-range',
        },
      });
    },
  );
  const cliquerSupprimer = (code) => page.getByTestId(`supprimer-${code}`).click();
  /** Une notification précise : elles s'empilent et durent huit secondes. */
  const notification = (texte) => page.locator('[aria-live] > div', { hasText: texte });
  // Tant qu'une vérification court, aucune suppression n'est possible : après
  // un refus, l'écran doit revenir à la vie.
  const attendreBoutonsRendus = () => page.waitForFunction(
    () => [...document.querySelectorAll('[data-testid^="supprimer-"]')].every((b) => !b.disabled),
  );

  // ROB-01 a du stock et des ventes sur le poste : la réponse est locale.
  await cliquerSupprimer('ROB-01');
  const refus = notification('ROB-01 — Robinet');
  await refus.waitFor();
  await attendreBoutonsRendus();
  const texteRefus = await texteDe(refus);
  verifier(texteRefus.includes('ligne(s) de vente') && texteRefus.includes('mouvement(s) de stock'),
    `article utilisé : le refus dit ce qui le retient « ${texteRefus.slice(0, 70)}… »`);
  verifier(texteRefus.includes('Désactivez-le'), 'article utilisé : le refus dit quoi faire à la place');
  verifier(comptages.length === 0, 'article utilisé : le poste tranche seul, sans déranger le serveur');

  // ABAT3 vient d'un import et n'a jamais bougé : le serveur le confirme.
  await cliquerSupprimer('ABAT3');
  const confirmation = page.getByRole('dialog');
  await confirmation.waitFor();
  verifier((await texteDe(confirmation)).includes('ne se défait pas'), 'article neuf : confirmation demandée, une fois la vérification faite');
  verifier(comptages.length === 8, `${comptages.length} comptages demandés au serveur`);
  verifier(comptages.some((u) => /lignes_vente/.test(u)) && comptages.some((u) => /ventes_brouillons/.test(u)),
    'le serveur est interrogé sur toute l’activité, brouillons compris');
  await confirmation.getByRole('button', { name: 'Supprimer' }).click();
  await notification('ABAT3 supprimé').waitFor();
  await page.locator('tbody tr', { hasText: 'ABATANT WC' }).waitFor({ state: 'detached' });
  verifier((await nombreAffiche()) === total - 1, 'article supprimé : il quitte le catalogue');

  // Le serveur a le dernier mot : vendu il y a trois ans, l'article n'a plus
  // de trace sur le poste — il ne s'efface pas pour autant.
  usagesServeur = 3;
  await cliquerSupprimer('CAT-001');
  const refusServeur = notification('CAT-001 — Article de catalogue 1');
  await refusServeur.waitFor();
  await attendreBoutonsRendus();
  verifier((await texteDe(refusServeur)).includes('3 ligne(s) de vente') && (await page.getByRole('dialog').count()) === 0,
    'le serveur retient un article dont le poste n’a plus la trace, sans même demander confirmation');

  console.log('Hors ligne : on ne supprime pas, on le dit');
  const avantCoupure = comptages.length;
  await page.context().setOffline(true);
  await cliquerSupprimer('CAT-002');
  const horsLigne = notification('CAT-002');
  await horsLigne.waitFor();
  await attendreBoutonsRendus();
  verifier(comptages.length === avantCoupure, 'hors ligne : aucune requête tentée');
  verifier((await texteDe(horsLigne)).includes('désactivez-le'), 'hors ligne : le message renvoie à la désactivation, qui marche sans réseau');
  await page.context().setOffline(false);

  await page.getByRole('button', { name: 'Familles' }).click();
  await page.locator('tbody tr', { hasText: 'SANITAIRE' }).waitFor();
  await page.locator('tbody tr', { hasText: 'CARREAU' }).waitFor();
  verifier((await page.locator('tbody tr').count()) === 4, 'onglet familles (dont familles créées par les imports)');

  // Le scénario coupe lui-même le réseau (`setOffline`) : une tentative de
  // synchronisation qui tombe dans cette fenêtre se plaint en console. C'est la
  // coupure simulée qui parle, pas un défaut — et elle n'arrive pas à chaque
  // exécution, d'où la tolérance (même raisonnement que `audit.e2e.cjs`).
  const inattendues = erreurs.filter((e) => !/Failed to fetch|Failed to load resource|INTERNET_DISCONNECTED|NETWORK_IO_SUSPENDED/.test(e));
  verifier(inattendues.length === 0, `aucune erreur console hors coupure réseau simulée${inattendues.length ? ' : ' + inattendues.join(' | ') : ''}`);
  await browser.close();
  console.log('OK');
})().catch((e) => { console.error(e.message); process.exit(1); });
