/**
 * Tableau de bord : les chiffres du gérant et ceux du directeur.
 *
 * Le scénario monte une quincaillerie aux chiffres ronds — on sait d'avance ce
 * que chaque tuile doit afficher —, puis vérifie que l'écran les retrouve, que
 * les graphiques les dessinent, que la feuille A4 les reprend et que la vue
 * groupe additionne les deux filiales. Aucun backend requis.
 *
 * Les articles portent une TVA nulle : hors taxes et toutes taxes se
 * confondent, et la marge se vérifie de tête.
 */
const { ouvrirNavigateur, simulerSession, verifier, BASE_URL } = require('./browser.cjs');

const texteDe = async (page, selecteur) => (await page.textContent(selecteur)).replace(/\s+/g, ' ').trim();
/** Les montants portent une espace insécable : on compare sur des chiffres nus. */
const montant = (t) => t.replace(/[\s  ]/g, '');

(async () => {
  const { browser, page, erreurs } = await ouvrirNavigateur();
  const { filialeId, userId } = await simulerSession(page, { profil: 'GERANT' });

  console.log('La quincaillerie de l’essai');
  const faits = await page.evaluate(async ({ F, U }) => {
    const { db } = await import('/src/infrastructure/powersync/database.ts');
    const { DepotsRepository } = await import('/src/infrastructure/powersync/repositories/DepotsRepository.ts');
    const { ArticlesRepository } = await import('/src/infrastructure/powersync/repositories/ArticlesRepository.ts');
    const { FamillesRepository } = await import('/src/infrastructure/powersync/repositories/FamillesRepository.ts');
    const { StockRepository } = await import('/src/infrastructure/powersync/repositories/StockRepository.ts');
    const { ClientsRepository } = await import('/src/infrastructure/powersync/repositories/ClientsRepository.ts');
    const { VentesRepository } = await import('/src/infrastructure/powersync/repositories/VentesRepository.ts');
    const { TresorerieRepository } = await import('/src/infrastructure/powersync/repositories/TresorerieRepository.ts');
    const { articleFormSchema, familleFormSchema } = await import('/src/core/articles/index.ts');
    const { clientFormSchema, clientFromRow } = await import('/src/core/clients/index.ts');

    const depots = new DepotsRepository(db);
    const articles = new ArticlesRepository(db);
    const familles = new FamillesRepository(db);
    const stock = new StockRepository(db);
    const ventes = new VentesRepository(db);
    const treso = new TresorerieRepository(db);

    const F2 = 'filiale-essai-2';
    await db.execute("INSERT OR REPLACE INTO filiales (id, code, nom, type, est_active) VALUES (?, 'BKE', 'Filiale Bouaké', 'FILIALE', 1)", [F2]);

    const monter = async (fil, suffixe) => {
      const depot = await depots.create(fil, { code: 'PRI', nom: 'Principal', adresse: '', responsable: '' });
      const famQ = await familles.create(fil, familleFormSchema.parse({ code: 'QUI', nom: 'Quincaillerie' }));
      const famP = await familles.create(fil, familleFormSchema.parse({ code: 'PEI', nom: 'Peinture' }));
      const art = async (code, des, fam, achat, vente, min) => articles.create(fil, articleFormSchema.parse({
        code: `${code}${suffixe}`, designation: des, famille_id: fam, prix_achat: achat, prix_vente: vente, tva: 0, stock_min: min,
      }));
      const a = await art('A', 'Ciment', famQ, 1000, 1500, 0);
      const b = await art('B', 'Fer à béton', famQ, 2000, 3000, 0);
      const c = await art('C', 'Peinture oubliée', famP, 5000, 7000, 0);
      const d = await art('D', 'Article épuisé', famQ, 1000, 1500, 5);
      const e = await art('E', 'Tube PVC', famQ, 3000, 4500, 20);

      const ctx = { filialeId: fil, utilisateurId: U };
      await stock.enregistrerEntree(ctx, {
        depot_id: depot, type: 'ENTREE_ACHAT', reference: `ENT-${suffixe || 'A'}`, motif: 'Stock de départ',
        lignes: [
          { article_id: a, quantite: 100, cout_unitaire: 1000, remise_percent: 0 },
          { article_id: b, quantite: 50, cout_unitaire: 2000, remise_percent: 0 },
          { article_id: c, quantite: 10, cout_unitaire: 5000, remise_percent: 0 },
          { article_id: d, quantite: 5, cout_unitaire: 1000, remise_percent: 0 },
          { article_id: e, quantite: 10, cout_unitaire: 3000, remise_percent: 0 },
        ],
      });
      // L'article D part entièrement : rupture franche.
      await stock.enregistrerSortie(ctx, { depot_id: depot, type: 'SORTIE_DESTOCKAGE', reference: '', motif: 'Fin de série', lignes: [{ article_id: d, quantite: 5 }] });
      return { depot, ctx, a, b, c, d, e };
    };

    const m = await monter(F, '');
    const m2 = await monter(F2, '-B');

    const client = await new ClientsRepository(db).create(F, clientFormSchema.parse({ raison_sociale: 'ETS KOUAME', plafond_credit: 10_000_000 }));
    const lireClient = async () => clientFromRow(await db.get('SELECT * FROM clients WHERE id = ?', [client]));

    const caisse = await treso.createCaisse(F, { code: 'C1', nom: 'Caisse', responsable: '' });
    const caisse2 = await treso.createCaisse(F2, { code: 'C1', nom: 'Caisse Bouaké', responsable: '' });

    const ligne = async (id, quantite) => {
      const a = await db.get('SELECT * FROM articles WHERE id = ?', [id]);
      return { article_id: a.id, code: a.code, designation: a.designation, unite: a.unite, prix_unitaire_ttc: a.prix_vente, tva_percent: a.tva, quantite, remise_percent: 0 };
    };
    const vendre = async (lieu, caisseId, lignes, credit, reculDeJours = 0) => {
      const r = await ventes.enregistrer(
        { ...lieu.ctx, caisseId, caisseCode: 'C1', depotId: lieu.depot },
        {
          lignes, remise_globale_percent: 0, client: credit ? await lireClient() : null,
          paiement: { mode_paiement: credit ? 'CREDIT' : 'ESPECES', montant_percu: credit ? 0 : 1_000_000 },
          livraison: null, notes: '',
        },
      );
      if (reculDeJours > 0) {
        const d = new Date(); d.setDate(d.getDate() - reculDeJours);
        const iso = d.toISOString();
        await db.execute('UPDATE ventes SET date_vente = ?, created_at = ? WHERE id = ?', [iso, iso, r.id]);
        await db.execute('UPDATE lignes_vente SET created_at = ? WHERE vente_id = ?', [iso, r.id]);
        await db.execute('UPDATE mouvements_stock SET created_at = ? WHERE reference = ?', [iso, r.preparee.numero]);
      }
      return r;
    };

    // Aujourd'hui : 10 ciments au comptant, 5 fers à crédit. 30 000 de chiffre,
    // 20 000 de coût d'achat, donc 10 000 de marge.
    await vendre(m, caisse, [await ligne(m.a, 10)], false);
    await vendre(m, caisse, [await ligne(m.b, 5)], true);
    // Une facture d'il y a quatre mois, jamais réglée (20 ciments, 30 000 F) :
    // elle fera la tranche « plus de 90 jours ».
    await vendre(m, caisse, [await ligne(m.a, 20)], true, 120);
    // La filiale de Bouaké vend pour 6 000, dont 4 000 de coût.
    await vendre(m2, caisse2, [await ligne(m2.b, 2)], false);

    // Une dépense d'exploitation : le résultat tombe à 6 000.
    await treso.enregistrerOperation({ filialeId: F, utilisateurId: U }, { caisse_id: caisse, type: 'DEPENSE', categorie: 'LOYER', montant: 4000, description: 'Loyer', reference: '', tiers: '' });

    // Deux bons de livraison en attente, dont un dont la date est passée.
    const vente = await db.get("SELECT id FROM ventes WHERE filiale_id = ? LIMIT 1", [F]);
    const now = new Date().toISOString();
    for (const [i, jours, statut] of [[0, -3, 'EN_COURS'], [1, 5, 'A_PREPARER']]) {
      const prevue = new Date(); prevue.setDate(prevue.getDate() + jours);
      await db.execute(
        "INSERT OR REPLACE INTO livraisons (id, numero, vente_id, client_id, adresse_livraison, statut, date_livraison_prevue, filiale_id, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
        [`liv-${i}`, `BL-0${i}`, vente.id, client, 'Yopougon', statut, prevue.toISOString(), F, now, now],
      );
    }
    // Une commande fournisseur encore ouverte.
    await db.execute("INSERT OR REPLACE INTO commandes_fournisseurs (id, numero, type, statut, filiale_id, total_ttc, created_at, updated_at) VALUES ('cmd-e2e','BC-01','BON_COMMANDE','ENVOYEE',?,500000,?,?)", [F, now, now]);

    // L'article C n'a plus bougé depuis deux cents jours : il dort.
    const vieux = new Date(Date.now() - 200 * 86_400_000).toISOString();
    await db.execute('UPDATE stocks SET date_dernier_mouvement = ? WHERE article_id IN (?, ?)', [vieux, m.c, m2.c]);

    return { filiale2: F2 };
  }, { F: filialeId, U: userId });

  const valeur = async (testId) => montant(await texteDe(page, `[data-testid=${testId}-valeur]`));
  const tuile = async (testId) => texteDe(page, `[data-testid=${testId}]`);

  console.log('Les chiffres du gérant');
  await page.goto(`${BASE_URL}/#/`);
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('[data-testid=kpi-ca-valeur]').waitFor();
  // Les requêtes sont vivantes : elles reviennent après le premier rendu.
  await page.waitForFunction(() => /30/.test(document.querySelector('[data-testid=kpi-ca-valeur]').textContent));

  verifier(await valeur('kpi-ca') === '30000F', "chiffre d'affaires : 30 000 F");
  verifier((await tuile('kpi-ca')).includes('2 vente(s)') && (await tuile('kpi-ca')).includes('15 000 F'), 'deux ventes, panier moyen 15 000 F');
  verifier(await valeur('kpi-marge') === '10000F', 'marge commerciale : 30 000 − 20 000 de coût d’achat');
  verifier((await tuile('kpi-marge')).includes('33,3 %'), 'taux de marge à la française : 33,3 %');
  verifier(await valeur('kpi-resultat') === '6000F', 'résultat estimé : la marge moins 4 000 F de loyer');
  verifier(await valeur('kpi-tresorerie') === '11000F', 'trésorerie : 15 000 encaissés moins le loyer');
  verifier(await valeur('kpi-creances') === '45000F', 'créances : la vente à crédit du jour (15 000) et la vieille facture (30 000)');
  verifier(await valeur('kpi-stock') === '240000F', 'valeur du stock');
  // La répartition du stock est une seconde requête vivante : elle revient
  // après la première peinture, et la tuile ne la porte qu'ensuite.
  await page.waitForFunction(() => /50/.test(document.querySelector('[data-testid=etat-stock-DORMANT]')?.textContent || ''));
  verifier((await tuile('kpi-stock')).includes('50 000 F dormant'), 'le dormant est chiffré sur la tuile');
  verifier(await valeur('kpi-livraisons') === '2', 'deux bons de livraison en attente');
  verifier((await tuile('kpi-livraisons')).includes('1 en retard'), 'dont un en retard');
  verifier((await tuile('kpi-dettes')).includes('1 commande(s)'), 'la commande fournisseur ouverte est comptée');

  const vigilance = await texteDe(page, '[data-testid=vigilance]');
  verifier(vigilance.includes('1 article(s) en rupture') && vigilance.includes('1 livraison(s) en retard'),
    'le bandeau de vigilance dit ce qui réclame une décision');

  console.log('L’état du stock');
  const etat = async (e) => texteDe(page, `[data-testid=etat-stock-${e}]`);
  verifier((await etat('RUPTURE')).includes('1 art.') && (await etat('RUPTURE')).includes('0 F'), 'rupture : 1 article, aucune valeur');
  verifier((await etat('DORMANT')).includes('1 art.') && (await etat('DORMANT')).includes('50 000 F'), 'dormant : la peinture oubliée');
  verifier((await etat('SOUS_MINIMUM')).includes('1 art.') && (await etat('SOUS_MINIMUM')).includes('30 000 F'), 'sous le minimum : le tube PVC');
  verifier((await etat('ACTIF')).includes('2 art.') && (await etat('ACTIF')).includes('160 000 F'), 'actif : le ciment et le fer');
  // C'est la raison d'être des deux barres : une rupture ne vaut rien, elle
  // n'apparaît pas sur la barre valorisée — mais elle existe sur celle des articles.
  verifier((await page.locator('[data-testid=part-stock-valeur-RUPTURE]').count()) === 0, 'la barre valorisée ne montre pas la rupture : elle ne vaut rien');
  verifier((await page.locator('[data-testid=part-stock-articles-RUPTURE]').count()) === 1, 'la barre des articles, elle, la montre');

  console.log('L’ancienneté des impayés');
  verifier(montant(await texteDe(page, '[data-testid=anciennete-0-30]')).includes('15k'), 'la vente du jour est dans la première tranche');
  verifier(montant(await texteDe(page, '[data-testid=anciennete-90-plus]')).includes('30k'), 'la facture de quatre mois est au-delà de 90 jours');

  console.log('L’histogramme');
  const donnees = await texteDe(page, '[data-testid=donnees-histogramme]');
  verifier(donnees.includes('30 000 F') && donnees.includes('20 000 F') && donnees.includes('10 000 F'),
    'le tableau des données reprend CA, coût et marge du jour');
  const barres = await page.locator('[data-testid^=barre-]').count();
  verifier(barres >= 1 && barres <= 31, `une barre par jour de la période (${barres})`);

  console.log('Le survol');
  await page.locator('[data-testid^=barre-]').last().hover();
  await page.locator('[data-testid=infobulle]').waitFor();
  const bulle = await texteDe(page, '[data-testid=infobulle]');
  verifier(bulle.includes('10 000 F') && bulle.includes('marge'), 'l’infobulle donne la marge de la barre survolée');

  console.log('Les classements');
  verifier((await texteDe(page, '[data-testid^=classement-]')).length > 0, 'le classement par famille est dessiné');
  // Les familles s'enregistrent en capitales : la comparaison l'ignore.
  const classements = montant((await page.locator('[data-testid^=classement-]').allTextContents()).join(' ')).toLowerCase();
  verifier(classements.includes('quincaillerie') && classements.includes('30000f'), 'la famille Quincaillerie porte tout le chiffre');
  verifier(classements.includes('etskouame') && classements.includes('ventescomptoir'), 'le client à crédit et le comptoir sont classés');

  console.log('Changer de période');
  await page.getByTestId('periode-ANNEE').click();
  await page.waitForFunction(() => /60/.test(document.querySelector('[data-testid=kpi-ca-valeur]').textContent));
  verifier(await valeur('kpi-ca') === '60000F', 'sur douze mois, la vieille facture entre dans le chiffre');
  await page.getByTestId('periode-JOUR').click();
  await page.waitForFunction(() => /30/.test(document.querySelector('[data-testid=kpi-ca-valeur]').textContent));
  verifier(await valeur('kpi-ca') === '30000F', 'sur la journée, elle en sort');
  await page.getByTestId('periode-MOIS').click();

  console.log('La feuille A4');
  await page.getByTestId('imprimer-tableau-de-bord').click();
  const doc = page.locator('#zone-impression');
  await doc.locator('[data-testid=ligne-pilotage]').first().waitFor();
  const papier = montant(await texteDe(page, '#zone-impression'));
  verifier(papier.includes('Tableaudebord'), 'document : le titre');
  verifier(papier.includes('30000F') && papier.includes('10000F') && papier.includes('6000F'), 'document : chiffre, marge et résultat');
  verifier(papier.includes('240000F'), 'document : la valeur du stock');
  verifier((await doc.locator('[data-testid=ligne-pilotage]').count()) === 4, 'document : les quatre états du stock');
  verifier(papier.includes('Visadugérant') && papier.includes('Visadeladirection'), 'document : les deux visas');
  verifier(!papier.includes('PointdeVente'), 'document : ni menu ni bandeau de l’application');
  await doc.getByRole('button', { name: "Fermer l'aperçu" }).click();

  console.log('La vue du directeur');
  await page.evaluate(async () => {
    const { db } = await import('/src/infrastructure/powersync/database.ts');
    await db.execute("UPDATE utilisateurs SET profil = 'DIRECTEUR', filiale_id = NULL WHERE id = 'aaaaaaaa-0000-0000-0000-00000000e2e0'");
  });
  await page.goto(`${BASE_URL}/#/consolidation`);
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('[data-testid=total-groupe]').waitFor();
  await page.waitForFunction(() => /36/.test(document.querySelector('[data-testid=kpi-ca-valeur]').textContent));

  verifier(await valeur('kpi-ca') === '36000F', 'le groupe additionne les deux filiales : 30 000 + 6 000');
  verifier(await valeur('kpi-marge') === '12000F', 'et leurs marges : 10 000 + 2 000');
  const totalGroupe = montant(await texteDe(page, '[data-testid=total-groupe]'));
  verifier(totalGroupe.includes('36000F') && totalGroupe.includes('12000F'), 'la ligne de total reprend les mêmes chiffres');
  verifier((await texteDe(page, '[data-testid=filiale-BKE]')).includes('Filiale Bouaké'), 'chaque filiale a sa ligne');
  verifier((await page.locator('[data-testid=classement-' + faits.filiale2 + ']').count()) === 1, 'les filiales sont comparées entre elles');

  const telechargement = page.waitForEvent('download');
  await page.getByTestId('exporter-tableau-de-bord').click();
  const fichier = await telechargement;
  const xlsx = require('xlsx');
  const feuille = xlsx.utils.sheet_to_json(xlsx.readFile(await fichier.path()).Sheets['Filiales']);
  verifier(/^tableau-de-bord-\d{4}-\d{2}-\d{2}\.xlsx$/.test(fichier.suggestedFilename()), `export Excel : fichier ${fichier.suggestedFilename()}`);
  const bouake = feuille.find((l) => l.Code === 'BKE');
  verifier(feuille.length === 2 && bouake['CA TTC'] === 6000 && bouake.Marge === 2000,
    'export Excel : chaque filiale relue depuis le classeur');

  console.log('Les fonds en route');
  // Un transfert parti d'Abidjan et pas encore encaissé à Bouaké : l'argent
  // n'est dans aucune caisse. Sans cette ligne, il ne figure nulle part.
  const tresorerieAvant = montant(await texteDe(page, '[data-testid=kpi-tresorerie-valeur]'));
  await page.evaluate(async ({ source, destination }) => {
    const { db } = await import('/src/infrastructure/powersync/database.ts');
    await db.execute(`INSERT OR REPLACE INTO transferts_filiales
      (id, numero, filiale_source_id, filiale_destination_id, caisse_source_id, montant, statut, date_envoi)
      VALUES ('tf-essai','TRF-ESSAI', ?, ?, 'c-1', 25000, 'EN_TRANSIT', datetime('now'))`,
      [source, destination]);
  }, { source: filialeId, destination: faits.filiale2 });
  await page.waitForFunction(
    () => document.querySelector('[data-testid=kpi-tresorerie]')?.textContent.replace(/[\s\u202f\u00a0]/g, '').includes('25000Fenroute'),
  );
  verifier(montant(await texteDe(page, '[data-testid=kpi-tresorerie-valeur]')) === tresorerieAvant,
    'les fonds en route ne gonflent pas la trésorerie : ils ne sont dans aucune caisse');
  verifier((await texteDe(page, '[data-testid=vigilance]')).includes('réception à confirmer'),
    'un transit en cours réclame une décision : la réception est à confirmer');

  console.log('Le périmètre commande l’écran');
  // Un sélecteur nommé « Périmètre » doit changer ce qu'on regarde : tant qu'il
  // ne le faisait pas, un directeur changeait de filiale sans rien voir bouger.
  const attendreCa = (valeur) => page.waitForFunction(
    (v) => document.querySelector('[data-testid=kpi-ca-valeur]')?.textContent.replace(/[\s\u202f\u00a0]/g, '').includes(v),
    String(valeur),
  );
  const piedGroupe = async () => montant(await texteDe(page, '[data-testid=total-groupe]'));

  await page.locator('[data-testid=filiale-BKE]').click();
  await attendreCa(6000);
  verifier((await texteDe(page, 'main h1')) === 'Filiale Bouaké', 'clic sur une ligne : l’écran se réduit à cette filiale');
  verifier(await valeur('kpi-ca') === '6000F', 'et ses chiffres remplacent ceux du groupe');
  verifier((await piedGroupe()).includes('36000F'), 'la ligne de pied reste celle du groupe : la filiale se situe dans l’ensemble');

  await page.locator('[data-testid=filiale-ABJ]').click();
  await attendreCa(30000);
  verifier(await valeur('kpi-ca') === '30000F', 'changer de filiale change les chiffres');

  await page.locator('[data-testid=total-groupe]').click();
  await attendreCa(36000);
  verifier((await texteDe(page, 'main h1')) === 'Vue consolidée — Groupe', 'la ligne de total ramène au groupe');
  verifier(await valeur('kpi-ca') === '36000F', 'et le groupe additionne de nouveau les deux filiales');

  console.log('Sans la permission');
  const { browser: b2, page: p2, erreurs: e2 } = await ouvrirNavigateur();
  await simulerSession(p2, { permissions: ['ventes.lire'] });
  await p2.goto(`${BASE_URL}/#/consolidation`);
  await p2.reload({ waitUntil: 'networkidle' });
  await p2.locator('main', { hasText: 'La consolidation ne vous est pas ouverte' }).waitFor();
  verifier(true, 'la consolidation se referme sur un rôle qui ne la porte pas');
  await b2.close();

  verifier(erreurs.length === 0 && e2.length === 0, `aucune erreur console (${erreurs.length + e2.length})`);
  await browser.close();
  console.log('\n✅ Tableau de bord : indicateurs, graphiques, feuille A4 et vue groupe');
})().catch((e) => { console.error(e); process.exit(1); });
