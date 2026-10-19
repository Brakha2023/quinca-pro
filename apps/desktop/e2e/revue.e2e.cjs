// Revue générale : toutes les requêtes SQL de l'application s'exécutent sur la
// vraie base locale, et tous les écrans se rendent sur une base vide (c'est là
// que se cachent les plantages : premier élément d'une liste absente, division
// par zéro, totaux sans ligne).
const { ouvrirNavigateur, simulerSession, verifier, BASE_URL } = require('./browser.cjs');

const SECTIONS = {
  stock: ['suivi', 'entree', 'sortie', 'transfert', 'inventaire', 'production', 'mouvements', 'alertes'],
  clients: ['repertoire', 'nouveau', 'proformas', 'compte', 'versements', 'relance'],
  fournisseurs: ['repertoire', 'nouveau', 'compte', 'reglements', 'commandes', 'relance'],
  tresorerie: ['caisses', 'versement', 'retrait', 'entree', 'transfert-caisse', 'transfert-filiale', 'depense'],
  employes: ['effectif', 'nouveau', 'pointage', 'paie', 'paiement'],
};
const PAGES_SIMPLES = ['', 'articles', 'ventes', 'livraisons', 'consolidation', 'audit'];

(async () => {
  const { browser, page, erreurs } = await ouvrirNavigateur();
  const { filialeId } = await simulerSession(page);

  console.log('Requêtes SQL (base locale réelle)');
  const sql = await page.evaluate(async (F) => {
    const { db } = await import('/src/infrastructure/powersync/database.ts');
    const A = await import('/src/infrastructure/powersync/repositories/ArticlesRepository.ts');
    const C = await import('/src/infrastructure/powersync/repositories/ClientsRepository.ts');
    const D = await import('/src/infrastructure/powersync/repositories/DepotsRepository.ts');
    const E = await import('/src/infrastructure/powersync/repositories/EmployesRepository.ts');
    const FA = await import('/src/infrastructure/powersync/repositories/FamillesRepository.ts');
    const FO = await import('/src/infrastructure/powersync/repositories/FournisseursRepository.ts');
    const L = await import('/src/infrastructure/powersync/repositories/LivraisonsRepository.ts');
    const P = await import('/src/infrastructure/powersync/repositories/ProductionsRepository.ts');
    const PR = await import('/src/infrastructure/powersync/repositories/ProformasRepository.ts');
    const S = await import('/src/infrastructure/powersync/repositories/StockRepository.ts');
    const T = await import('/src/infrastructure/powersync/repositories/TresorerieRepository.ts');
    const V = await import('/src/infrastructure/powersync/repositories/VentesRepository.ts');

    const id = '00000000-0000-0000-0000-000000000000';
    const jour = new Date().toISOString().slice(0, 10);
    const iso = new Date().toISOString();
    // Chaque filtre optionnel est renseigné : les conditions SQL qu'il ajoute sont ainsi toutes compilées.
    const requetes = {
      articlesQuery: A.articlesQuery(F, { recherche: 'a', familleId: id, inclureInactifs: true }),
      catalogueQuery: A.catalogueQuery(F, id, { recherche: 'a', familleId: id }),
      ARTICLE_QUERY: { sql: A.ARTICLE_QUERY, params: [id] },
      STOCK_ARTICLE_QUERY: { sql: A.STOCK_ARTICLE_QUERY, params: [id] },
      VENTES_ARTICLE_QUERY: { sql: A.VENTES_ARTICLE_QUERY, params: [id, iso] },
      VENTES_MENSUELLES_ARTICLE_QUERY: { sql: A.VENTES_MENSUELLES_ARTICLE_QUERY, params: [id, iso] },
      clientsQuery: C.clientsQuery(F, { recherche: 'a', inclureInactifs: true, avecCreance: true, groupe: 'G', avecEmail: true }),
      GROUPES_CLIENTS_QUERY: { sql: C.GROUPES_CLIENTS_QUERY, params: [F] },
      FACTURES_CLIENT_QUERY: { sql: C.FACTURES_CLIENT_QUERY, params: [id] },
      versementsQuery: C.versementsQuery(F, { clientId: id, dateDebut: jour, dateFin: jour, limite: 10 }),
      REGLEMENTS_CLIENT_QUERY: { sql: C.REGLEMENTS_CLIENT_QUERY, params: [id] },
      CAISSES_ACTIVES_QUERY: { sql: C.CAISSES_ACTIVES_QUERY, params: [F] },
      DEPOTS_QUERY: { sql: D.DEPOTS_QUERY, params: [F] },
      DEPOTS_ACTIFS_QUERY: { sql: D.DEPOTS_ACTIFS_QUERY, params: [F] },
      employesQuery: E.employesQuery(F, { recherche: 'a', inclureInactifs: true }),
      EMPLOYE_QUERY: { sql: E.EMPLOYE_QUERY, params: [id] },
      POINTAGES_JOUR_QUERY: { sql: E.POINTAGES_JOUR_QUERY, params: [F, jour] },
      POINTAGES_MOIS_QUERY: { sql: E.POINTAGES_MOIS_QUERY, params: [F, '2026-10'] },
      PAIES_PERIODE_QUERY: { sql: E.PAIES_PERIODE_QUERY, params: [F, '2026-10'] },
      AVANCES_PERIODE_QUERY: { sql: E.AVANCES_PERIODE_QUERY, params: [F, '2026-10'] },
      PERIODES_PAIE_QUERY: { sql: E.PERIODES_PAIE_QUERY, params: [F] },
      FAMILLES_QUERY: { sql: FA.FAMILLES_QUERY, params: [F] },
      FAMILLES_ACTIVES_QUERY: { sql: FA.FAMILLES_ACTIVES_QUERY, params: [F] },
      fournisseursQuery: FO.fournisseursQuery(F, { recherche: 'a', inclureInactifs: true, avecDette: true }),
      ACHATS_FOURNISSEUR_QUERY: { sql: FO.ACHATS_FOURNISSEUR_QUERY, params: [id] },
      REGLEMENTS_FOURNISSEUR_QUERY: { sql: FO.REGLEMENTS_FOURNISSEUR_QUERY, params: [id] },
      LIGNES_COMMANDE_QUERY: { sql: FO.LIGNES_COMMANDE_QUERY, params: [id] },
      commandesQuery: FO.commandesQuery(F, { fournisseurId: id, ouvertesSeulement: true, recherche: 'a', limite: 10 }),
      reglementsFournisseursQuery: FO.reglementsFournisseursQuery(F, { fournisseurId: id, dateDebut: jour, dateFin: jour, limite: 10 }),
      livraisonsQuery: L.livraisonsQuery(F, 'A_PREPARER', 'rue'),
      productionsQuery: P.productionsQuery(F, { depotId: id, recherche: 'a', limite: 10 }),
      LIGNES_PRODUCTION_QUERY: { sql: P.LIGNES_PRODUCTION_QUERY, params: [id] },
      proformasQuery: PR.proformasQuery(F, { clientId: id, enCoursSeulement: true, recherche: 'a', limite: 10 }),
      LIGNES_PROFORMA_QUERY: { sql: PR.LIGNES_PROFORMA_QUERY, params: [id] },
      stocksQuery: S.stocksQuery(F, { depotId: id, recherche: 'a', alertesSeulement: true }),
      stocksParArticleQuery: S.stocksParArticleQuery(F),
      mouvementsQuery: S.mouvementsQuery(F, { depotId: id, articleId: id, fournisseurId: id, type: 'ENTREE_ACHAT', reference: 'BL', limite: 10 }),
      CAISSES_QUERY: { sql: T.CAISSES_QUERY, params: [F] },
      mouvementsTresorerieQuery: T.mouvementsTresorerieQuery(F, { caisseId: id, dateDebut: jour, dateFin: jour, type: 'RECETTE', limite: 10 }),
      mouvementsDepuisQuery: T.mouvementsDepuisQuery(F, id, jour),
      TRANSFERTS_FILIALES_QUERY: { sql: T.TRANSFERTS_FILIALES_QUERY, params: [F, F] },
      ventesQuery: V.ventesQuery(F, { jour, caisseId: id, statut: 'VALIDEE', recherche: 'a', limite: 10 }),
      ventesQueryPeriode: V.ventesQuery(F, { dateDebut: jour, dateFin: jour }),
      LIGNES_VENTE_QUERY: { sql: V.LIGNES_VENTE_QUERY, params: [id] },
    };

    const echecs = [];
    for (const [nom, q] of Object.entries(requetes)) {
      try { await db.getAll(q.sql, q.params); }
      catch (e) { echecs.push(`${nom} : ${e.message}`); }
    }
    return { total: Object.keys(requetes).length, echecs };
  }, filialeId);

  verifier(sql.echecs.length === 0, `${sql.total} requêtes exécutées sans erreur${sql.echecs.length ? ' — ' + sql.echecs.join(' | ') : ''}`);

  console.log('Écrans sur une base vide');
  await page.goto(`${BASE_URL}/#/`);
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('main').waitFor();
  const vus = [];
  /** Attend que l'écran soit posé : le profil résolu et le contenu rendu. */
  const ouvrir = async (chemin) => {
    await page.goto(`${BASE_URL}/#/${chemin}`);
    await page.locator('main').waitFor();
    await page.waitForFunction(() => {
      const t = document.querySelector('main')?.textContent ?? '';
      return t.trim().length > 20 && !t.includes('en cours de synchronisation');
    }, null, { timeout: 10000 });
    vus.push(`/${chemin}`);
    return (await page.locator('main').textContent()).replace(/\s+/g, ' ').trim();
  };

  for (const chemin of PAGES_SIMPLES) {
    const texte = await ouvrir(chemin);
    verifier(true, `/${chemin} se rend (${texte.slice(0, 44)}…)`);
  }
  for (const [module, sections] of Object.entries(SECTIONS)) {
    for (const section of sections) await ouvrir(`${module}/${section}`);
  }
  verifier(true, `${vus.length} écrans parcourus sur une base vide`);

  // Le bandeau de synchronisation doit nommer l'état, pas rester muet : sans
  // backend en test, il annonce « Hors ligne ».
  const bandeau = page.locator('[data-testid=etat-sync]');
  await bandeau.waitFor();
  // Sans backend, l'état oscille entre connexion et hors-ligne : on vérifie
  // qu'il est nommé et jamais « bloqué » (ce qui affolerait pour un simple hors-ligne).
  const nature = await bandeau.getAttribute('data-nature');
  const libelle = (await bandeau.textContent()).trim();
  verifier(['HORS_LIGNE', 'CONNEXION'].includes(nature) && libelle.length > 0, `bandeau de synchronisation : état nommé « ${libelle} » (${nature})`);

  verifier(erreurs.length === 0, `aucune erreur console${erreurs.length ? ' : ' + erreurs.join(' | ') : ''}`);
  await browser.close();

  // --- Vue groupe : seul le directeur y a accès, et les totaux cumulent les filiales. ---
  console.log('Consolidation (directeur, deux filiales)');
  const { browser: b2, page: p2, erreurs: e2 } = await ouvrirNavigateur();
  await simulerSession(p2, { profil: 'DIRECTEUR' });
  await p2.evaluate(async () => {
    const { db } = await import('/src/infrastructure/powersync/database.ts');
    const vente = async (filiale, numero, ttc, percu) => {
      const id = crypto.randomUUID();
      await db.execute(
        'INSERT INTO ventes (id, numero, date_vente, filiale_id, total_ttc, montant_percu, monnaie, statut, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?)',
        [id, numero, new Date().toISOString(), filiale, ttc, percu, 'VALIDEE', new Date().toISOString(), new Date().toISOString()],
      );
      await db.execute(
        'INSERT INTO lignes_vente (id, vente_id, filiale_id, code_article, designation, quantite, total_ttc, total_ht) VALUES (?, ?, ?, ?, ?, 1, ?, ?)',
        [crypto.randomUUID(), id, filiale, 'CIM-50', 'Ciment 50kg', ttc, ttc],
      );
    };
    await db.execute("INSERT OR REPLACE INTO filiales (id, code, nom, type, est_active) VALUES ('filiale-2', 'BKE', 'Filiale Bouaké', 'FILIALE', 1)");
    await db.execute("INSERT OR REPLACE INTO caisses (id, code, nom, filiale_id, solde_actuel, est_active) VALUES ('c-1', 'C1', 'Caisse ABJ', 'filiale-test', 100000, 1)");
    await db.execute("INSERT OR REPLACE INTO caisses (id, code, nom, filiale_id, solde_actuel, est_active) VALUES ('c-2', 'C2', 'Caisse BKE', 'filiale-2', 50000, 1)");
    await db.execute("INSERT OR REPLACE INTO clients (id, code, raison_sociale, filiale_id, solde_actuel, est_actif) VALUES ('cl-1', 'C001', 'Débiteur ABJ', 'filiale-test', 30000, 1)");
    await db.execute("INSERT OR REPLACE INTO fournisseurs (id, code, raison_sociale, filiale_id, solde_actuel, est_actif) VALUES ('fo-1', 'F001', 'Créancier BKE', 'filiale-2', 20000, 1)");
    await vente('filiale-test', 'V-ABJ', 59000, 59000);
    await vente('filiale-2', 'V-BKE', 41000, 41000);
  });
  await p2.goto(`${BASE_URL}/#/consolidation`);
  await p2.reload({ waitUntil: 'networkidle' });
  await p2.locator('main h1', { hasText: 'Vue consolidée' }).waitFor();
  await p2.locator('tbody tr', { hasText: 'Filiale Bouaké' }).waitFor();
  // Les cartes du bas viennent d'autres requêtes vivantes que le tableau :
  // on attend la dernière avant de photographier le texte de la page.
  await p2.locator('[data-testid=article-vendu-CIM-50]').waitFor();
  const groupe = (await p2.textContent('main')).replace(/\s+/g, ' ');
  // Le tableau des filiales a ses propres repères : d'autres tableaux vivent
  // sur la page (le relevé des données de l'histogramme, replié).
  verifier((await p2.locator('[data-testid^=filiale-]').count()) === 2, 'consolidation : une ligne par filiale');
  verifier(groupe.includes('100 000 F'), 'consolidation : chiffre d’affaires cumulé sur les deux filiales');
  verifier(groupe.includes('30 000 F') && groupe.includes('20 000 F'), 'consolidation : créances et dettes du groupe');
  verifier(groupe.includes('150 000 F'), 'consolidation : trésorerie des caisses cumulée');
  verifier(groupe.includes('Ciment 50kg'), 'consolidation : top articles du groupe');
  verifier(e2.length === 0, `consolidation : aucune erreur console${e2.length ? ' : ' + e2.join(' | ') : ''}`);
  await b2.close();

  console.log('OK');
})().catch((e) => { console.error(e.message); process.exit(1); });
