/**
 * Horloge du poste fausse.
 *
 * Toutes les dates de l'application viennent de `new Date()` sur la machine.
 * L'heure du serveur est lue sur le jeton qu'il signe (son `iat`) : on forge
 * ici des jetons décalés pour éprouver l'avertissement, le refus d'ouvrir la
 * caisse, et le retour à la normale après réglage.
 */
const { ouvrirNavigateur, simulerSession, verifier, BASE_URL } = require('./browser.cjs');

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
/**
 * Jeton tel que le poste se retrouve **en avance** de `avanceMs` sur le serveur
 * (valeur négative : le poste est en retard).
 */
const jetonDecale = (avanceMs) =>
  `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: 'aaaaaaaa-0000-0000-0000-00000000e2e0', iat: Math.floor((Date.now() - avanceMs) / 1000) })}.e2e`;

const mesurer = (page, jeton) =>
  page.evaluate(async (jeton) => {
    const { mesurerAvecJeton } = await import('/src/infrastructure/supabase/horlogeServeur.ts');
    return mesurerAvecJeton(jeton);
  }, jeton);

(async () => {
  const { browser, page, erreurs } = await ouvrirNavigateur();
  await simulerSession(page);
  await page.goto(`${BASE_URL}/#/articles`);
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('main h1').first().waitFor();

  console.log('Poste à l’heure');
  await mesurer(page, jetonDecale(20_000));
  verifier((await page.locator('[data-testid=bandeau-horloge]').count()) === 0, 'écart de 20 s : rien ne s’affiche, rien ne change sur une pièce');

  console.log('Poste décalé de quelques minutes');
  const mesure = await mesurer(page, jetonDecale(6 * 60_000));
  const bandeau = page.locator('[data-testid=bandeau-horloge]');
  await bandeau.waitFor({ timeout: 5000 });
  verifier(Math.abs(mesure.ecart_ms - 6 * 60_000) < 2000, `écart mesuré sur le jeton : ${Math.round(mesure.ecart_ms / 1000)} s d’avance`);
  verifier((await bandeau.getAttribute('data-niveau')) === 'AVERTISSEMENT', 'bandeau d’avertissement, sans bloquer le travail');
  const texte = (await bandeau.textContent()).replace(/\s+/g, ' ');
  verifier(texte.includes('en avance de 6 min'), `le bandeau dit le sens et l’ampleur : « ${texte.slice(0, 60)}… »`);
  verifier(texte.includes('Heure et langue'), 'le bandeau dit quoi faire, pas seulement ce qui ne va pas');

  await page.goto(`${BASE_URL}/#/pos`);
  await page.locator('main').waitFor();
  verifier((await page.locator('[data-testid=caisse-fermee]').count()) === 0, 'quelques minutes d’écart : la caisse reste ouverte');

  console.log('Poste franchement à côté');
  await mesurer(page, jetonDecale(-3 * 3_600_000));
  await page.locator('[data-testid=caisse-fermee]').waitFor({ timeout: 5000 });
  const refus = (await page.locator('[data-testid=caisse-fermee]').textContent()).replace(/\s+/g, ' ');
  verifier(refus.includes('en retard de 3 h'), `caisse fermée, motif affiché : « ${refus.slice(0, 70)}… »`);
  verifier((await page.locator('[data-testid=bandeau-horloge]').getAttribute('data-niveau')) === 'BLOCAGE', 'bandeau en alerte rouge sur tous les écrans');
  verifier((await page.locator('[data-testid=ticket-lignes]').count()) === 0 && (await page.locator('input[type=search]').count()) === 0, 'ni ticket ni catalogue : rien ne peut être vendu tant que l’heure est fausse');

  console.log('Le poste redémarre : une horloge fausse ne se corrige pas toute seule');
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('[data-testid=caisse-fermee]').waitFor({ timeout: 5000 });
  verifier(true, 'après redémarrage, la caisse est toujours fermée : la mesure est gardée sur la machine');

  console.log('Après réglage de l’horloge');
  await page.locator('[data-testid=horloge-reglee]').click();
  await page.locator('[data-testid=bandeau-horloge]').waitFor({ state: 'detached', timeout: 5000 });
  verifier((await page.locator('[data-testid=caisse-fermee]').count()) === 0, 'la caisse rouvre dès que le poste déclare l’heure réglée');

  // … mais le serveur tranche à la connexion suivante : si l'heure est toujours
  // fausse, le prochain jeton rétablit le blocage en quelques secondes.
  await mesurer(page, jetonDecale(-3 * 3_600_000));
  await page.locator('[data-testid=caisse-fermee]').waitFor({ timeout: 5000 });
  verifier(true, 'déclaration non tenue : le jeton suivant referme la caisse');

  verifier(erreurs.length === 0, `aucune erreur console${erreurs.length ? ' : ' + erreurs.join(' | ') : ''}`);
  await browser.close();
  console.log('OK');
})().catch((e) => { console.error(e.message); process.exit(1); });
