/**
 * Verrouillage du poste et déverrouillage hors ligne (local-first) :
 * « Se déconnecter » conserve la session et la file d'envoi ; le poste se
 * déverrouille avec le mot de passe même sans serveur, par n'importe quel
 * utilisateur de la filiale (empreinte synchronisée dans sa fiche), et les
 * écritures continuent de porter le nom de celui qui travaille.
 */
const { ouvrirNavigateur, simulerSession, verifier, BASE_URL } = require('./browser.cjs');

(async () => {
  const { browser, page, erreurs } = await ouvrirNavigateur();
  const { filialeId } = await simulerSession(page);
  const MOT_DE_PASSE = 'Secret-e2e-2026';

  // Empreintes synchronisées (comme après une connexion en ligne de chacun) + une écriture locale non envoyée.
  const enAttenteAvant = await page.evaluate(async ({ filialeId, mdp }) => {
    const { calculerEmpreinte } = await import('/src/infrastructure/auth/empreinteLocale.ts');
    const { db, countPendingUploads } = await import('/src/infrastructure/powersync/database.ts');
    await db.execute('UPDATE utilisateurs SET empreinte_hors_ligne = ? WHERE email = ?', [await calculerEmpreinte(mdp), 'e2e@test.ci']);
    await db.execute(
      "INSERT OR REPLACE INTO utilisateurs (id, email, nom, prenom, profil, filiale_id, est_actif, empreinte_hors_ligne) VALUES ('bbbbbbbb-0000-0000-0000-00000000e2e1', 'fatou@test.ci', 'Diabaté', 'Fatou', 'CAISSIER', ?, 1, ?)",
      [filialeId, await calculerEmpreinte('Fatou-2026')],
    );
    await db.execute(
      "INSERT OR REPLACE INTO utilisateurs (id, email, nom, prenom, profil, filiale_id, est_actif, empreinte_hors_ligne) VALUES ('cccccccc-0000-0000-0000-00000000e2e2', 'parti@test.ci', 'Parti', 'Ancien', 'CAISSIER', ?, 0, ?)",
      [filialeId, await calculerEmpreinte('Parti-2026')],
    );
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
  await page.locator('text=/Dernier utilisateur : Awa Koné/').waitFor();
  verifier((await page.textContent('body')).includes('Filiale Abidjan'), 'écran verrouillé : filiale et dernier utilisateur affichés');
  await page.locator(`text=/${enAttenteAvant} opération\\(s\\) en attente/`).waitFor();
  verifier(true, `file d’envoi affichée sur l’écran verrouillé (${enAttenteAvant} en attente)`);

  await page.reload();
  await page.locator('text=Poste verrouillé').waitFor();
  // La file d'envoi se compte une fois la base locale rouverte : elle arrive
  // après le titre et pousse le formulaire vers le bas. Sans cette attente, le
  // clic qui suit vise un bouton encore en train de descendre.
  await page.locator(`text=/${enAttenteAvant} opération\\(s\\) en attente/`).waitFor();
  verifier(true, 'le verrou survit à un redémarrage');

  console.log('Déverrouillage hors ligne');
  // Hors ligne = serveurs injoignables ; le serveur Vite (ressources de l'app, embarquées en prod) reste accessible.
  await page.route((url) => !url.href.startsWith(BASE_URL), (route) => route.abort('internetdisconnected'));
  await page.locator('input[type=email]').fill('e2e@test.ci');
  await page.locator('input[type=password]').fill('mauvais');
  await page.getByRole('button', { name: 'Déverrouiller' }).click();
  await page.locator('text=/Mot de passe incorrect/').waitFor();
  verifier(true, 'mauvais mot de passe hors ligne refusé');

  await page.locator('input[type=email]').fill('inconnu@test.ci');
  await page.locator('input[type=password]').fill(MOT_DE_PASSE);
  await page.getByRole('button', { name: 'Déverrouiller' }).click();
  await page.locator('text=/inconnu sur ce poste/').waitFor();
  verifier(true, 'utilisateur inconnu sur le poste refusé hors ligne');

  await page.locator('input[type=email]').fill('parti@test.ci');
  await page.locator('input[type=password]').fill('Parti-2026');
  await page.getByRole('button', { name: 'Déverrouiller' }).click();
  await page.locator('text=/Compte désactivé/').waitFor();
  verifier(true, 'compte désactivé refusé hors ligne');

  await page.locator('input[type=email]').fill('fatou@test.ci');
  await page.locator('input[type=password]').fill('Fatou-2026');
  await page.getByRole('button', { name: 'Déverrouiller' }).click();
  await page.locator('main h1', { hasText: 'Gestion du stock' }).waitFor();
  await page.locator('aside').locator('text=Fatou Diabaté').waitFor();
  verifier(true, 'une collègue de la filiale déverrouille le poste hors ligne et travaille sous son nom');
  await page.getByTitle('Verrouiller le poste').click();
  await page.getByRole('dialog', { name: 'Verrouiller le poste' }).getByRole('button', { name: 'Verrouiller' }).click();
  await page.locator('text=/Dernier utilisateur : Fatou Diabaté/').waitFor();
  verifier(true, 'écran verrouillé : dernier utilisateur = Fatou');

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

  // Chromium n'a pas un seul mot pour « le réseau est coupé » : selon le moment
  // où la requête part, il dit INTERNET_DISCONNECTED ou NETWORK_IO_SUSPENDED.
  // Les deux décrivent la coupure que ce scénario provoque lui-même.
  const inattendues = erreurs.filter((e) => !/INTERNET_DISCONNECTED|NETWORK_IO_SUSPENDED|Failed to fetch/.test(e));
  verifier(inattendues.length === 0, `aucune erreur console hors coupure réseau simulée${inattendues.length ? ' : ' + inattendues.join(' | ') : ''}`);
  await browser.close();
  console.log('OK');
})().catch((e) => { console.error(e.message); process.exit(1); });
