/**
 * Verrouillage du poste et déverrouillage hors ligne (local-first) :
 * « Se déconnecter » conserve la session et la file d'envoi ; le poste se
 * déverrouille avec le mot de passe même sans serveur ; un autre utilisateur
 * ne peut prendre le poste tant que la file n'est pas vide.
 */
const { ouvrirNavigateur, simulerSession, verifier, BASE_URL } = require('./browser.cjs');

(async () => {
  const { browser, page, erreurs } = await ouvrirNavigateur();
  const { filialeId } = await simulerSession(page);
  const MOT_DE_PASSE = 'Secret-e2e-2026';

  // Empreinte locale (comme après une connexion réussie) + une écriture locale non envoyée.
  const enAttenteAvant = await page.evaluate(async ({ filialeId, mdp }) => {
    const { memoriserEmpreinte } = await import('/src/infrastructure/auth/empreinteLocale.ts');
    const { db, countPendingUploads } = await import('/src/infrastructure/powersync/database.ts');
    await memoriserEmpreinte('e2e@test.ci', mdp);
    await db.execute("INSERT INTO articles (id, code, designation, prix_achat, prix_vente, tva, unite, filiale_id, est_actif) VALUES ('art-verrou', 'VRR-1', 'Article hors ligne', 100, 150, 18, 'PIECE', ?, 1)", [filialeId]);
    return countPendingUploads();
  }, { filialeId, mdp: MOT_DE_PASSE });
  verifier(enAttenteAvant >= 1, `${enAttenteAvant} écriture(s) locale(s) en attente d’envoi avant verrouillage`);

  console.log('Verrouillage');
  await page.goto(`${BASE_URL}/#/stock`);
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('main h1', { hasText: 'Gestion du stock' }).waitFor();
  await page.getByTitle('Verrouiller le poste').click();
  await page.getByRole('dialog', { name: 'Verrouiller le poste' }).getByRole('button', { name: 'Verrouiller' }).click();
  await page.locator('text=Poste verrouillé').waitFor();
  verifier((await page.textContent('body')).includes('e2e@test.ci'), 'écran verrouillé : session conservée, utilisateur affiché');
  await page.locator(`text=/${enAttenteAvant} opération\\(s\\) en attente/`).waitFor();
  verifier(true, `file d’envoi affichée sur l’écran verrouillé (${enAttenteAvant} en attente)`);

  await page.reload();
  await page.locator('text=Poste verrouillé').waitFor();
  verifier(true, 'le verrou survit à un redémarrage');

  console.log('Déverrouillage hors ligne');
  // Hors ligne = serveurs injoignables ; le serveur Vite (ressources de l'app, embarquées en prod) reste accessible.
  await page.route((url) => !url.href.startsWith(BASE_URL), (route) => route.abort('internetdisconnected'));
  await page.locator('input[type=password]').fill('mauvais');
  await page.getByRole('button', { name: 'Déverrouiller' }).click();
  await page.locator('text=/Serveur injoignable/').waitFor();
  verifier(true, 'mauvais mot de passe hors ligne refusé');

  await page.locator('input[type=email]').fill('autre@test.ci');
  await page.locator('input[type=password]').fill(MOT_DE_PASSE);
  await page.getByRole('button', { name: 'Déverrouiller' }).click();
  await page.locator('text=/attendent d’être envoyées/').waitFor();
  verifier(true, 'changement d’utilisateur refusé tant que la file n’est pas vide');

  await page.locator('input[type=email]').fill('e2e@test.ci');
  await page.locator('input[type=password]').fill(MOT_DE_PASSE);
  await page.getByRole('button', { name: 'Déverrouiller' }).click();
  await page.locator('main h1', { hasText: 'Gestion du stock' }).waitFor();
  verifier(true, 'déverrouillé hors ligne avec le bon mot de passe (empreinte locale), retour à la page en cours');
  const enAttente = await page.evaluate(async () => {
    const { countPendingUploads } = await import('/src/infrastructure/powersync/database.ts');
    return countPendingUploads();
  });
  verifier(enAttente === enAttenteAvant, 'la file d’envoi est intacte après verrouillage/déverrouillage (rien n’est perdu)');
  await page.unroute(() => true);

  const inattendues = erreurs.filter((e) => !/INTERNET_DISCONNECTED|Failed to fetch/.test(e));
  verifier(inattendues.length === 0, `aucune erreur console hors coupure réseau simulée${inattendues.length ? ' : ' + inattendues.join(' | ') : ''}`);
  await browser.close();
  console.log('OK');
})().catch((e) => { console.error(e.message); process.exit(1); });
