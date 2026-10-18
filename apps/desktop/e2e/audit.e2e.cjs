/**
 * Journal d'audit : lu sur le serveur, plus synchronisé sur le poste.
 *
 * Le serveur est simulé par interception REST : on vérifie que la page
 * l'interroge vraiment, qu'elle le dit quand il est injoignable, qu'elle
 * n'appelle rien hors ligne — et que la table a bien quitté la base locale.
 */
const { ouvrirNavigateur, simulerSession, verifier, BASE_URL } = require('./browser.cjs');

const LIGNES = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    utilisateur_id: 'aaaaaaaa-0000-0000-0000-00000000e2e0',
    action: 'UPDATE',
    table_cible: 'articles',
    enregistrement_id: '22222222-2222-4222-8222-222222222222',
    // jsonb : PostgREST les rend en **objets**, là où SQLite les rendait en texte.
    anciennes_valeurs: { code: 'CIM-50', prix_vente: 5900, updated_at: '2026-10-01T08:00:00Z' },
    nouvelles_valeurs: { code: 'CIM-50', prix_vente: 6200, updated_at: '2026-10-02T08:00:00Z' },
    filiale_id: 'filiale-test',
    created_at: '2026-10-17T09:30:00.000Z',
  },
  {
    id: '33333333-3333-4333-8333-333333333333',
    utilisateur_id: null,
    action: 'INSERT',
    table_cible: 'ventes',
    enregistrement_id: '44444444-4444-4444-8444-444444444444',
    anciennes_valeurs: null,
    nouvelles_valeurs: { numero: 'C01-K7Q-20261017-M3Q2PT', total_ttc: 59000 },
    filiale_id: 'filiale-test',
    created_at: '2026-10-17T09:00:00.000Z',
  },
];

(async () => {
  const { browser, page, erreurs } = await ouvrirNavigateur();
  await simulerSession(page);

  let reponse = { status: 200, contentType: 'application/json', body: JSON.stringify(LIGNES) };
  const appels = [];
  await page.route('**/rest/v1/audit_log*', (route) => {
    appels.push(route.request().url());
    route.fulfill(reponse);
  });

  console.log('La table a quitté le poste');
  const local = await page.evaluate(async () => {
    const { db } = await import('/src/infrastructure/powersync/database.ts');
    await db.waitForReady();
    try {
      await db.getAll('SELECT * FROM audit_log LIMIT 1');
      return 'ENCORE_LA';
    } catch (e) {
      return e?.message ?? 'erreur';
    }
  });
  verifier(local !== 'ENCORE_LA' && /audit_log/.test(local), `la base locale n'a plus de table audit_log (${local.slice(0, 60)}…)`);

  console.log('Lecture sur le serveur');
  await page.goto(`${BASE_URL}/#/audit`);
  await page.reload({ waitUntil: 'networkidle' });
  const lignes = page.locator('[data-testid=ligne-audit]');
  await lignes.first().waitFor();
  verifier((await lignes.count()) === 2, 'les événements viennent du serveur, pas de la base locale');
  verifier(appels.length >= 1 && /audit_log/.test(appels[0]), 'un appel REST a bien été fait pour les chercher');
  verifier(/created_at/.test(appels[0]) || /order=/.test(appels[0]), 'tri et filtres passés au serveur, pas appliqués après coup');
  const premiere = (await lignes.first().textContent()).replace(/\s+/g, ' ');
  verifier(premiere.includes('Modification') && premiere.includes('articles') && premiere.includes('prix_vente'),
    `champ modifié repéré dans des valeurs JSON reçues en objets : « ${premiere.slice(0, 70)}… »`);
  await lignes.first().locator('text=Koné').waitFor({ timeout: 5000 });
  verifier(true, 'nom de l’utilisateur résolu depuis la base locale (les utilisateurs, eux, restent synchronisés)');

  await lignes.first().click();
  const detail = page.getByRole('dialog');
  await detail.waitFor();
  const avantApres = (await detail.textContent()).replace(/\s+/g, ' ');
  verifier(avantApres.includes('5900') && avantApres.includes('6200'), 'détail : avant / après du champ modifié');
  await page.keyboard.press('Escape');

  console.log('Serveur injoignable');
  reponse = { status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'canal serveur rompu' }) };
  await page.locator('[data-testid=recharger-audit]').click();
  await page.locator('[data-testid=audit-erreur]').waitFor();
  verifier((await page.locator('[data-testid=audit-erreur]').textContent()).includes('canal serveur rompu'), 'le motif du serveur est affiché, pas une liste vide trompeuse');

  console.log('Hors ligne : aucun appel, et on le dit');
  const avant = appels.length;
  await page.context().setOffline(true);
  await page.locator('[data-testid=recharger-audit]').click();
  await page.locator('[data-testid=audit-hors-ligne]').waitFor();
  verifier(appels.length === avant, 'hors ligne : aucune requête tentée');
  verifier((await page.locator('[data-testid=audit-hors-ligne]').textContent()).includes('en ligne seulement'), 'hors ligne : la page explique au lieu d’afficher « aucun événement »');
  await page.context().setOffline(false);

  console.log('Historique local borné : les écrans le disent');
  await page.goto(`${BASE_URL}/#/ventes`);
  await page.locator('[data-testid=note-historique]').first().waitFor();
  const note = (await page.locator('[data-testid=note-historique]').first().textContent()).replace(/\s+/g, ' ');
  verifier(/Ce poste garde les ventes depuis \w+ \d{4}/.test(note), `note sur la page Ventes : « ${note.slice(0, 80)}… »`);
  verifier(note.includes('non soldées'), 'la note dit aussi ce qui reste malgré la borne');

  const inattendues = erreurs.filter((e) => !/status of 500/.test(e) && !/Failed to load resource/.test(e));
  verifier(inattendues.length === 0, `aucune erreur console inattendue${inattendues.length ? ' : ' + inattendues.join(' | ') : ''}`);
  await browser.close();
  console.log('OK');
})().catch((e) => { console.error(e.message); process.exit(1); });
