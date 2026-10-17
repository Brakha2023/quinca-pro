/**
 * Écritures refusées définitivement par le serveur : mises de côté sur le poste
 * au lieu d'être abandonnées en silence.
 *
 * Le serveur est simulé par interception des appels REST (aucun réseau réel) :
 * on peut donc provoquer à volonté un refus définitif (23505), une panne
 * passagère (503) puis une acceptation, et vérifier ce que devient la file.
 */
const { ouvrirNavigateur, simulerSession, verifier, BASE_URL } = require('./browser.cjs');

const REFUS_DOUBLON = {
  status: 409,
  contentType: 'application/json',
  body: JSON.stringify({
    code: '23505',
    message: 'duplicate key value violates unique constraint "articles_filiale_id_code_key"',
    details: 'Key (filiale_id, code)=(filiale-test, ECH-1) already exists.',
    hint: null,
  }),
};
const PANNE_PASSAGERE = { status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'service temporarily unavailable' }) };
const ACCEPTE = { status: 201, contentType: 'application/json', body: '' };

(async () => {
  const { browser, page, erreurs } = await ouvrirNavigateur();
  const { filialeId, userId } = await simulerSession(page);

  // Un seul aiguillage : le scénario change la réponse du « serveur » en cours de route.
  let reponse = REFUS_DOUBLON;
  await page.route('**/rest/v1/**', (route) => route.fulfill(reponse));

  console.log('Refus définitif : la file repart, rien ne disparaît');
  const refus = await page.evaluate(async ({ F }) => {
    const { db, countPendingUploads } = await import('/src/infrastructure/powersync/database.ts');
    const { SupabaseConnector } = await import('/src/infrastructure/powersync/SupabaseConnector.ts');
    await db.execute("INSERT INTO articles (id, code, designation, prix_achat, prix_vente, tva, unite, filiale_id, est_actif) VALUES ('art-echec', 'ECH-1', 'Article en doublon', 1000, 1500, 18, 'PIECE', ?, 1)", [F]);
    await db.execute("INSERT INTO depots (id, code, nom, filiale_id, est_actif) VALUES ('dep-echec', 'DEP-E', 'Dépôt essai', ?, 1)", [F]);
    const avant = await countPendingUploads();

    const connecteur = new SupabaseConnector();
    for (let i = 0; i < 20 && (await countPendingUploads()) > 0; i += 1) await connecteur.uploadData(db);

    return {
      avant,
      restantEnFile: await countPendingUploads(),
      echecs: await db.getAll('SELECT table_cible, operation, code, explication, motif, donnees, tentatives, utilisateur_id, lot FROM echecs_envoi ORDER BY table_cible'),
      articleTouJoursLa: (await db.getOptional("SELECT code FROM articles WHERE id = 'art-echec'"))?.code ?? null,
    };
  }, { F: filialeId });

  verifier(refus.avant >= 2 && refus.restantEnFile === 0, `file d'envoi soldée (${refus.avant} opération(s) → 0 restante) : elle n'est plus bloquée`);
  verifier(refus.echecs.length === refus.avant, `${refus.echecs.length} écriture(s) mise(s) de côté, soit tout ce qui n'est pas passé`);
  const article = refus.echecs.find((e) => e.table_cible === 'articles');
  verifier(article.code === '23505' && article.operation === 'PUT' && article.tentatives === 1, 'motif conservé : code serveur 23505, création, première tentative');
  verifier(article.explication.startsWith('Doublon'), `code traduit en clair : « ${article.explication} »`);
  verifier(article.motif.includes('articles_filiale_id_code_key'), 'message brut du serveur conservé pour l’administrateur');
  verifier(JSON.parse(article.donnees).code === 'ECH-1', 'données de l’écriture conservées, telles qu’elles partaient');
  verifier(article.utilisateur_id === userId, 'écriture attribuée à celui qui travaillait sur le poste');
  verifier(refus.articleTouJoursLa === 'ECH-1', 'la ligne reste dans la base locale : le poste continue de travailler avec');

  console.log('Panne passagère : surtout ne rien mettre de côté');
  reponse = PANNE_PASSAGERE;
  const passagere = await page.evaluate(async ({ F }) => {
    const { db, countPendingUploads } = await import('/src/infrastructure/powersync/database.ts');
    const { SupabaseConnector } = await import('/src/infrastructure/powersync/SupabaseConnector.ts');
    await db.execute("INSERT INTO articles (id, code, designation, prix_achat, prix_vente, tva, unite, filiale_id, est_actif) VALUES ('art-panne', 'PAN-1', 'Article en panne', 100, 150, 18, 'PIECE', ?, 1)", [F]);
    let releve = null;
    try {
      await new SupabaseConnector().uploadData(db);
    } catch (e) {
      releve = e?.message ?? 'erreur';
    }
    return {
      releve,
      restantEnFile: await countPendingUploads(),
      misDeCote: (await db.get('SELECT COUNT(*) AS n FROM echecs_envoi')).n,
    };
  }, { F: filialeId });

  verifier(passagere.releve !== null, 'erreur relancée au lieu d’être absorbée : PowerSync réessaiera');
  verifier(passagere.restantEnFile === 1, 'l’écriture reste dans la file d’envoi, intacte');
  verifier(passagere.misDeCote === refus.avant, 'rien de nouveau mis de côté : une panne n’est pas un refus');

  console.log('Bandeau et décision');
  await page.goto(`${BASE_URL}/#/stock`);
  await page.reload({ waitUntil: 'networkidle' });
  const badge = page.locator('[data-testid=etat-sync]');
  await badge.waitFor();
  verifier((await badge.getAttribute('data-nature')) === 'MIS_DE_COTE', `bandeau en alerte : « ${(await badge.textContent()).trim()} »`);
  verifier((await badge.textContent()).includes(`${refus.avant} écriture(s) mise(s) de côté`), 'bandeau : nombre d’écritures en attente de décision');

  await badge.click();
  const boite = page.getByRole('dialog', { name: 'Écritures mises de côté' });
  await boite.locator('[data-testid=echec-envoi]').first().waitFor();
  verifier((await boite.locator('[data-testid=echec-envoi]').count()) === refus.avant, 'la liste montre chaque écriture refusée');
  verifier((await boite.locator('[data-testid=echec-explication]').first().textContent()).startsWith('Doublon'), 'liste : motif en clair');
  await boite.getByRole('button', { name: /Voir le message du serveur/ }).first().click();
  verifier((await boite.locator('[data-testid=echec-motif]').textContent()).includes('duplicate key'), 'détail : message brut du serveur');

  // Réessayer alors que le serveur accepte enfin (cause corrigée) : la ligne part.
  reponse = ACCEPTE;
  const avantReessai = await boite.locator('[data-testid=echec-envoi]').count();
  await boite.locator('[data-testid=reessayer-echec]').first().click();
  await page.locator('[aria-live]', { hasText: 'acceptée par le serveur' }).waitFor();
  await boite.locator('[data-testid=echec-envoi]').nth(avantReessai - 1).waitFor({ state: 'detached' });
  verifier((await boite.locator('[data-testid=echec-envoi]').count()) === avantReessai - 1, 'écriture acceptée au réessai : elle quitte la liste');

  // Réessayer alors que le serveur refuse toujours : on la garde, avec une tentative de plus.
  reponse = REFUS_DOUBLON;
  await boite.locator('[data-testid=reessayer-echec]').first().click();
  await page.locator('[aria-live]', { hasText: 'Toujours refusée' }).waitFor();
  verifier((await boite.locator('[data-testid=echec-envoi]').count()) === avantReessai - 1, 'refus au réessai : l’écriture reste dans la liste');
  const tentatives = await page.evaluate(async () => {
    const { db } = await import('/src/infrastructure/powersync/database.ts');
    return (await db.get('SELECT MAX(tentatives) AS t, COUNT(*) AS n FROM echecs_envoi'));
  });
  verifier(tentatives.t === 2 && tentatives.n === avantReessai - 1, 'refusée de nouveau : conservée, deuxième tentative notée');

  // Abandon : décision explicite, après confirmation.
  await boite.locator('[data-testid=abandonner-echec]').first().click();
  await page.getByRole('dialog', { name: 'Abandonner cette écriture ?' }).getByRole('button', { name: 'Abandonner' }).click();
  await page.locator('[aria-live]', { hasText: 'abandonnée' }).waitFor();
  await boite.locator('[data-testid=echec-envoi]').nth(avantReessai - 2).waitFor({ state: 'detached' });
  verifier((await boite.locator('[data-testid=echec-envoi]').count()) === avantReessai - 2, 'écriture abandonnée : retirée de la liste sur décision');
  await page.keyboard.press('Escape');

  // Un refus qui survient pendant qu'on travaille doit se voir tout de suite,
  // sans recharger l'écran : le bandeau est prévenu par le connecteur.
  const compteAvant = Number((await badge.textContent()).match(/\d+/)[0]);
  await page.evaluate(async ({ F }) => {
    const { db } = await import('/src/infrastructure/powersync/database.ts');
    const { SupabaseConnector } = await import('/src/infrastructure/powersync/SupabaseConnector.ts');
    await db.execute("INSERT INTO articles (id, code, designation, prix_achat, prix_vente, tva, unite, filiale_id, est_actif) VALUES ('art-vivant', 'VIV-1', 'Article refusé en direct', 100, 150, 18, 'PIECE', ?, 1)", [F]);
    const connecteur = new SupabaseConnector();
    for (let i = 0; i < 20 && (await db.getOptional('SELECT 1 AS x FROM ps_crud LIMIT 1')); i += 1) await connecteur.uploadData(db);
  }, { F: filialeId });
  // +2 : l'article refusé à l'instant, et celui resté en file depuis la panne —
  // le serveur le refuse maintenant définitivement, il rejoint donc le lot.
  const attendu = compteAvant + 2;
  await badge.locator(`text=${attendu} écriture`).waitFor({ timeout: 5000 });
  verifier(true, `bandeau mis à jour sans rechargement (${compteAvant} → ${attendu}) : un refus survenu pendant le travail se voit aussitôt`);
  const resteEnFile = await page.evaluate(async () => {
    const { countPendingUploads } = await import('/src/infrastructure/powersync/database.ts');
    return countPendingUploads();
  });
  verifier(resteEnFile === 0, 'file d’envoi de nouveau vide : la synchronisation n’est jamais restée coincée');

  console.log('Changement de filiale refusé tant qu’une décision est en attente');
  const garde = await page.evaluate(async () => {
    const { countEcrituresMisesDeCote } = await import('/src/infrastructure/powersync/database.ts');
    return countEcrituresMisesDeCote();
  });
  verifier(garde > 0, `${garde} écriture(s) encore en attente de décision : la base locale ne peut pas être remplacée`);

  // Attendues ici : les refus simulés (409 / 503, que le navigateur journalise)
  // et la trace du connecteur quand il met une écriture de côté.
  const inattendues = erreurs.filter((e) => !e.includes('mise de côté') && !/status of (409|503)/.test(e));
  verifier(inattendues.length === 0, `aucune erreur console inattendue${inattendues.length ? ' : ' + inattendues.join(' | ') : ''}`);
  await browser.close();
  console.log('OK');
})().catch((e) => { console.error(e.message); process.exit(1); });
