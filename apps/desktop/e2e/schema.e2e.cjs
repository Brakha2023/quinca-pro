/**
 * Contrôle d'accord entre le poste et le serveur, au démarrage.
 *
 * Le serveur est simulé par interception REST : on lui fait accepter les
 * sondes, puis refuser une colonne (42703) comme Postgres le ferait après une
 * migration oubliée, et on vérifie ce que le poste en dit.
 */
const { ouvrirNavigateur, simulerSession, verifier, BASE_URL } = require('./browser.cjs');

const REFUS_COLONNE = {
  status: 400,
  contentType: 'application/json',
  body: JSON.stringify({
    code: '42703',
    message: 'column mouvements_stock.remise_percent does not exist',
    details: null,
    hint: null,
  }),
};
const TABLE_ABSENTE = {
  status: 404,
  contentType: 'application/json',
  body: JSON.stringify({ code: 'PGRST205', message: "Could not find the table 'public.productions' in the schema cache" }),
};
const ACCEPTE = { status: 200, contentType: 'application/json', body: '[]' };

(async () => {
  const { browser, page, erreurs } = await ouvrirNavigateur();
  await simulerSession(page);

  // Le serveur répond selon la table sondée.
  const refus = new Map();
  const sondes = [];
  await page.route('**/rest/v1/**', (route) => {
    const url = route.request().url();
    const table = (/\/rest\/v1\/(\w+)/.exec(url) || [])[1];
    sondes.push({ table, url, methode: route.request().method() });
    route.fulfill(refus.get(table) ?? ACCEPTE);
  });

  console.log('Serveur d’accord avec le poste');
  await page.goto(`${BASE_URL}/#/articles`);
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('main h1').first().waitFor();
  await page.waitForFunction(() => document.querySelectorAll('[data-testid=note-historique], main h1').length > 0);
  await page.waitForTimeout(1500);
  verifier((await page.locator('[data-testid=bandeau-schema]').count()) === 0, 'schéma conforme : aucun bandeau, rien ne vient déranger la caisse');
  verifier(sondes.length >= 20, `${sondes.length} tables sondées au démarrage`);
  const sondeVentes = sondes.find((s) => s.table === 'ventes');
  verifier(/select=/.test(sondeVentes.url) && /numero/.test(sondeVentes.url), 'la sonde demande nommément les colonnes attendues');
  verifier(/limit=0/.test(sondeVentes.url), 'la sonde ne ramène aucune ligne : elle ne coûte que l’aller-retour');
  /*
   * En `HEAD`, la réponse n'a pas de corps — et le refus de PostgREST *est* un
   * corps JSON. Le poste recevait alors un 400 nu, sans code ni message : ni
   * « colonne absente », ni nom de colonne, et un bandeau qui ne disait rien.
   * Le simulateur, lui, fournissait un corps même sur un `HEAD` : le défaut ne
   * se voyait qu'en vrai. D'où cette assertion, qui tient la porte fermée.
   */
  /*
   * En `HEAD`, la réponse n'a pas de corps — et le refus de PostgREST *est* un
   * corps JSON. Le poste recevait alors un 400 nu, sans code ni message : ni
   * « colonne absente », ni nom de colonne, et un bandeau qui ne disait rien.
   * Le simulateur, lui, fournissait un corps même sur un `HEAD` : le défaut ne
   * se voyait qu'en vrai. D'où cette assertion, qui tient la porte fermée.
   *
   * On ne retient que les sondes (`limit=0`) : la file d'envoi de PowerSync
   * passe par la même route, en POST.
   */
  const requetesSonde = sondes.filter((s) => /limit=0/.test(s.url));
  verifier(requetesSonde.length >= 20 && requetesSonde.every((s) => s.methode === 'GET'),
    'la sonde interroge en GET : un refus sans corps ne nommerait pas la colonne manquante');

  console.log('Migration oubliée : une colonne manque');
  refus.set('mouvements_stock', REFUS_COLONNE);
  await page.locator('[data-testid=reverifier-schema]').count(); // pas encore de bandeau : on recharge
  await page.reload({ waitUntil: 'networkidle' });
  const bandeau = page.locator('[data-testid=bandeau-schema]');
  await bandeau.waitFor({ timeout: 10000 });
  verifier((await bandeau.getAttribute('data-niveau')) === 'BLOQUANT', 'colonne absente : bandeau bloquant');
  const texte = (await bandeau.textContent()).replace(/\s+/g, ' ');
  verifier(texte.includes('mouvements_stock') && texte.includes('remise_percent'),
    `la table et la colonne sont nommées : « ${texte.slice(0, 90)}… »`);
  verifier(texte.includes('migration'), 'le bandeau dit la cause probable et à qui s’adresser');
  verifier(texte.includes('mises de côté'), 'et ce qu’il adviendra des écritures concernées');

  console.log('Table entière absente');
  refus.clear();
  refus.set('productions', TABLE_ABSENTE);
  await page.locator('[data-testid=reverifier-schema]').click();
  await page.waitForFunction(() => {
    const b = document.querySelector('[data-testid=bandeau-schema]');
    return b && b.textContent.includes('productions');
  }, { timeout: 10000 });
  verifier(true, 'table absente : signalée sans recharger l’application');

  console.log('Hors ligne : on ne conclut rien, et on n’oublie rien');
  // Le contrôle précédent sonde une trentaine de tables par paquets, et le
  // bandeau parle dès la première réponse qui l'intéresse : des sondes sont
  // encore en vol. Couper le réseau maintenant ferait compter une sonde
  // d'avant comme une sonde tentée hors ligne. On attend que le flot se taise.
  const flotTari = async () => {
    let compte = -1;
    while (compte !== sondes.length) {
      compte = sondes.length;
      await page.waitForTimeout(400);
    }
  };
  await flotTari();
  await page.context().setOffline(true);
  /*
   * On ne compte que les sondes (`limit=0`). La file d'envoi de PowerSync
   * passe par la même route et réessaie pendant la coupure : la compter ferait
   * échouer ce contrôle au hasard du calendrier, ce qui est arrivé.
   */
  const sondesTentees = () => sondes.filter((x) => /limit=0/.test(x.url)).length;
  const avant = sondesTentees();
  await page.locator('[data-testid=reverifier-schema]').click();
  await page.waitForTimeout(1200);
  verifier(sondesTentees() === avant, 'hors ligne : aucune sonde tentée');
  verifier((await bandeau.count()) === 1 && (await bandeau.textContent()).includes('productions'),
    'hors ligne : le désaccord connu reste affiché — ce n’est pas le réseau qui l’a créé');
  await page.context().setOffline(false);

  console.log('Après correction du serveur');
  refus.clear();
  await page.locator('[data-testid=reverifier-schema]').click();
  await bandeau.waitFor({ state: 'detached', timeout: 10000 });
  verifier(true, 'serveur corrigé : le bandeau disparaît à la revérification');

  // Comme le scénario d'audit : la coupure réseau est provoquée ici même, et la
  // tentative de synchronisation qui tombe dedans n'arrive pas à tous les
  // passages — ne pas la tolérer rendait ce scénario intermittent.
  const inattendues = erreurs.filter((e) => !/status of (400|404)/.test(e) && !/Failed to load resource/.test(e) && !/Failed to fetch/.test(e));
  verifier(inattendues.length === 0, `aucune erreur console hors serveur simulé et coupure réseau${inattendues.length ? ' : ' + inattendues.join(' | ') : ''}`);
  await browser.close();
  console.log('OK');
})().catch((e) => { console.error(e.message); process.exit(1); });
