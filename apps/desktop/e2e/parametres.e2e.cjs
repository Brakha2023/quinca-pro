/**
 * Paramètres : rôles, permissions, comptes.
 *
 * Le scénario crée un rôle depuis l'écran, lui donne des permissions, l'affecte
 * à un compte, puis vérifie la seule chose qui compte vraiment : l'application
 * ne montre que ce que le rôle ouvre. Aucun backend requis — les rôles livrés
 * sont posés dans la base locale à l'image de ce que fait la migration.
 */
const { ouvrirNavigateur, simulerSession, verifier, BASE_URL } = require('./browser.cjs');

const texteDe = async (page, selecteur) => (await page.textContent(selecteur)).replace(/\s+/g, ' ');

/** Pose les cinq rôles livrés, tels que la migration 20260927000000 les pose. */
async function poserRolesLivres(page) {
  return page.evaluate(async () => {
    const { db } = await import('/src/infrastructure/powersync/database.ts');
    const { ROLES_SYSTEME } = await import('/src/core/parametres/index.ts');
    for (const r of ROLES_SYSTEME) {
      const id = `role-${r.code}`;
      await db.execute(
        'INSERT OR REPLACE INTO roles (id, code, nom, description, profil, est_systeme, est_superadmin, est_actif) VALUES (?,?,?,?,?,1,?,1)',
        [id, r.code, r.nom, `Rôle livré : ${r.nom}`, r.profil, r.est_superadmin ? 1 : 0],
      );
      if (r.permissions === '*') continue;
      for (const p of r.permissions) {
        await db.execute('INSERT OR REPLACE INTO roles_permissions (id, role_id, permission) VALUES (?,?,?)', [crypto.randomUUID(), id, p]);
      }
    }
    await db.execute(
      "INSERT OR REPLACE INTO utilisateurs (id, email, nom, prenom, profil, role_id, filiale_id, est_actif, doit_changer_mot_de_passe) VALUES ('u-neuf','nouveau@cisse-freres.ci','Ouattara','Fatou','CAISSIER',NULL,'filiale-test',1,0)",
    );
    await db.execute(
      "INSERT OR REPLACE INTO utilisateurs (id, email, nom, prenom, profil, role_id, filiale_id, est_actif, doit_changer_mot_de_passe) VALUES ('u-mag','bakayoko@cisse-freres.ci','Bakayoko','Issa','MAGASINIER','role-role_magasinier','filiale-test',1,0)",
    );
  });
}

(async () => {
  const { browser, page, erreurs } = await ouvrirNavigateur();
  await simulerSession(page, { profil: 'DIRECTEUR' });
  await poserRolesLivres(page);

  console.log('Les rôles livrés');
  await page.goto(`${BASE_URL}/#/parametres`);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForURL(/#\/parametres\/roles$/);
  verifier(true, 'sans section, le menu ouvre les rôles');
  // La requête est vivante : elle revient après le premier rendu.
  await page.waitForFunction(() => document.querySelectorAll('[data-testid^="role-role_"]').length >= 6);

  verifier((await texteDe(page, '[data-testid=compteur-roles]')).includes('6 rôle(s)'), 'six rôles : les cinq livrés et celui du poste d’essai');
  verifier((await texteDe(page, '[data-testid=permissions-role_caissier]')) === '11', 'le caissier a onze permissions');
  verifier((await texteDe(page, '[data-testid=permissions-role_directeur]')) === '41', 'le directeur a tout sauf la définition des rôles');
  verifier((await texteDe(page, '[data-testid=permissions-role_superadmin]')) === 'toutes', 'le superadministrateur : « toutes », pas un compte');
  verifier((await page.locator('[data-testid=supprimer-role_caissier]').count()) === 0, 'un rôle livré n’a pas de bouton supprimer');

  console.log('Créer un rôle');
  await page.getByTestId('nouveau-role').click();
  await page.getByTestId('role-nom').fill('Chef de rayon');
  verifier((await texteDe(page, 'form#role-form')).includes('role_chef_de_rayon'), 'le code technique se déduit du nom, sous les yeux');
  await page.getByTestId('role-description').fill('Tient le rayon quincaillerie');
  await page.getByTestId('role-portee').selectOption('MAGASINIER');
  await page.getByRole('button', { name: 'Créer' }).click();
  await page.locator('[data-testid=role-role_chef_de_rayon]').waitFor();
  verifier((await texteDe(page, '[data-testid=permissions-role_chef_de_rayon]')) === '0', 'un rôle neuf n’ouvre rien du tout');

  console.log('Lui donner des permissions');
  await page.getByTestId('role-role_chef_de_rayon').click();
  await page.locator('[data-testid=editeur-permissions]').waitFor();
  await page.getByTestId('permission-articles.lire').check();
  await page.getByTestId('permission-stock.lire').check();
  await page.getByTestId('permission-stock.entree').check();
  verifier((await texteDe(page, '[data-testid=editeur-permissions]')).includes('3 permission(s) sur 42'), 'le compteur suit les cases cochées');
  await page.getByTestId('enregistrer-permissions').click();
  await page.waitForFunction(() => document.querySelector('[data-testid=permissions-role_chef_de_rayon]')?.textContent.trim() === '3');
  verifier(true, 'les permissions sont enregistrées');

  const relu = await page.evaluate(async () => {
    const { db } = await import('/src/infrastructure/powersync/database.ts');
    const r = await db.get('SELECT id, code, profil, est_systeme FROM roles WHERE code = ?', ['role_chef_de_rayon']);
    const p = await db.getAll('SELECT permission FROM roles_permissions WHERE role_id = ? ORDER BY permission', [r.id]);
    return { role: r, permissions: p.map((x) => x.permission) };
  });
  verifier(relu.role.profil === 'MAGASINIER' && relu.role.est_systeme === 0, 'en base : portée magasin, rôle sur mesure');
  verifier(relu.permissions.join(',') === 'articles.lire,stock.entree,stock.lire', 'en base : exactement les trois permissions cochées');

  console.log('Retirer une permission n’en réécrit pas quarante');
  await page.getByTestId('permission-stock.entree').uncheck();
  await page.getByTestId('enregistrer-permissions').click();
  await page.waitForFunction(() => document.querySelector('[data-testid=permissions-role_chef_de_rayon]')?.textContent.trim() === '2');
  const apres = await page.evaluate(async () => {
    const { db } = await import('/src/infrastructure/powersync/database.ts');
    const r = await db.get('SELECT id FROM roles WHERE code = ?', ['role_chef_de_rayon']);
    return (await db.getAll('SELECT permission FROM roles_permissions WHERE role_id = ? ORDER BY permission', [r.id])).map((x) => x.permission);
  });
  verifier(apres.join(',') === 'articles.lire,stock.lire', 'seule la différence est écrite');

  console.log('Le superadministrateur ne se déshabille pas');
  await page.getByTestId('role-role_superadmin').click();
  await page.locator('[data-testid=editeur-permissions]').waitFor();
  verifier((await texteDe(page, '[data-testid=editeur-permissions]')).includes('par nature'), 'l’écran dit pourquoi rien ne s’y coche');
  verifier(await page.getByTestId('permission-ventes.valider').isChecked(), 'tout est coché pour lui');
  verifier(await page.getByTestId('permission-ventes.valider').isDisabled(), 'et rien ne se décoche');

  console.log('Le tableau des droits, imprimé');
  await page.getByTestId('imprimer-roles').click();
  const doc = page.locator('#zone-impression');
  await doc.locator('[data-testid=ligne-permission]').first().waitFor();
  const papier = await texteDe(page, '#zone-impression');
  verifier((await doc.locator('[data-testid=ligne-permission]').count()) === 42, 'document : une ligne par permission du catalogue');
  verifier(papier.includes('Rôles et permissions') && papier.includes('Chef de rayon'), 'document : titre et colonne du nouveau rôle');
  verifier(papier.includes('7 rôle(s) · 42 permission(s)'), 'document : le compte des rôles et des permissions');
  verifier(papier.includes('Visa du directeur') && papier.includes('Visa du contrôle'), 'document : les deux visas');
  verifier(!papier.includes('Point de Vente'), 'document : ni menu ni bandeau de l’application');
  await doc.getByRole('button', { name: "Fermer l'aperçu" }).click();

  const telechargement = page.waitForEvent('download');
  await page.getByTestId('exporter-roles').click();
  const fichier = await telechargement;
  const xlsx = require('xlsx');
  const classeur = xlsx.readFile(await fichier.path());
  const feuilleRoles = xlsx.utils.sheet_to_json(classeur.Sheets['Rôles']);
  const feuillePerms = xlsx.utils.sheet_to_json(classeur.Sheets['Permissions']);
  verifier(/^roles-et-permissions-\d{4}-\d{2}-\d{2}\.xlsx$/.test(fichier.suggestedFilename()), `export Excel : fichier ${fichier.suggestedFilename()}`);
  const chef = feuilleRoles.find((l) => l.Rôle === 'Chef de rayon');
  verifier(chef.Code === 'role_chef_de_rayon' && chef.Permissions === 2 && chef.Nature === 'Sur mesure', 'export Excel : le rôle relu depuis le classeur');
  const valider = feuillePerms.find((l) => l.Code === 'ventes.valider');
  verifier(feuillePerms.length === 42 && valider['Gérant de filiale'] === 'Oui' && valider.Caissier === '',
    'export Excel : la matrice, rôle par rôle');

  console.log('Les comptes');
  await page.getByRole('main').getByRole('link', { name: 'Utilisateurs' }).click();
  await page.locator('[data-testid=compteur-utilisateurs]').waitFor();
  await page.waitForFunction(() => document.querySelectorAll('[data-testid^="compte-"]').length >= 3);
  verifier((await texteDe(page, '[data-testid=compteur-utilisateurs]')).includes('1 sans rôle'), 'un compte sans rôle est signalé');
  await page.getByTestId('utilisateurs-etat').selectOption('SANS_ROLE');
  await page.waitForFunction(() => document.querySelectorAll('[data-testid^="compte-"]').length === 1);
  verifier((await page.locator('[data-testid="compte-nouveau@cisse-freres.ci"]').count()) === 1, 'le filtre « sans rôle » isole le compte à doter');

  console.log('Affecter un rôle');
  await page.getByTestId('affecter-nouveau@cisse-freres.ci').click();
  await page.getByTestId('affectation-role').selectOption({ label: 'Chef de rayon' });
  verifier(!(await page.getByTestId('affectation-filiale').isDisabled()), 'un rôle de filiale demande sa filiale');
  await page.getByTestId('affectation-filiale').selectOption({ label: 'Filiale Abidjan' });
  await page.getByTestId('affectation-enregistrer').click();
  await page.waitForFunction(() => document.querySelectorAll('[data-testid^="compte-"]').length === 0);
  verifier(true, 'le compte quitte la liste des comptes sans rôle');
  const fiche = await page.evaluate(async () => {
    const { db } = await import('/src/infrastructure/powersync/database.ts');
    return db.get('SELECT profil, filiale_id, role_id FROM utilisateurs WHERE id = ?', ['u-neuf']);
  });
  verifier(fiche.profil === 'MAGASINIER' && fiche.filiale_id === 'filiale-test', 'la portée du rôle est recopiée sur la fiche');

  console.log('Un rôle de direction n’a pas de filiale');
  await page.getByTestId('utilisateurs-etat').selectOption('TOUS');
  await page.waitForFunction(() => document.querySelectorAll('[data-testid^="compte-"]').length >= 3);
  await page.getByTestId('affecter-nouveau@cisse-freres.ci').click();
  await page.getByTestId('affectation-role').selectOption({ label: 'Directeur général' });
  verifier(await page.getByTestId('affectation-filiale').isDisabled(), 'la filiale se ferme pour un rôle qui les voit toutes');
  await page.getByTestId('affectation-enregistrer').click();
  await page.waitForFunction(async () => {
    const { db } = await import('/src/infrastructure/powersync/database.ts');
    const u = await db.get('SELECT filiale_id FROM utilisateurs WHERE id = ?', ['u-neuf']);
    return u.filiale_id === null;
  });
  verifier(true, 'la filiale est effacée de la fiche');

  console.log('La liste des comptes, imprimée');
  await page.getByTestId('imprimer-utilisateurs').click();
  await doc.locator('[data-testid=ligne-compte]').first().waitFor();
  const papierComptes = await texteDe(page, '#zone-impression');
  verifier(papierComptes.includes('Comptes et rôles') && papierComptes.includes('nouveau@cisse-freres.ci'), 'document : titre et comptes');
  verifier(papierComptes.includes('Tous les comptes'), 'document : périmètre écrit en clair');
  await doc.getByRole('button', { name: "Fermer l'aperçu" }).click();

  console.log('Le rôle décide du menu');
  const { browser: b2, page: p2, erreurs: e2 } = await ouvrirNavigateur();
  await simulerSession(p2, { permissions: ['pos.encaisser', 'ventes.lire', 'historiques.lire'] });
  await p2.goto(`${BASE_URL}/#/`);
  await p2.reload({ waitUntil: 'networkidle' });
  await p2.locator('nav a', { hasText: 'Point de Vente' }).waitFor();
  const menu = await texteDe(p2, 'nav');
  verifier(menu.includes('Point de Vente') && menu.includes('Ventes') && menu.includes('Historiques'), 'le menu montre ce que le rôle ouvre');
  verifier(!menu.includes('Trésorerie') && !menu.includes('Employés') && !menu.includes('Paramètres'), 'et rien de ce qu’il n’ouvre pas');
  verifier(!menu.includes('Catalogue') && !menu.includes('Stock'), 'un caissier sans « consulter le catalogue » ne le voit pas');

  await p2.goto(`${BASE_URL}/#/parametres/roles`);
  await p2.locator('main', { hasText: 'Les paramètres ne vous sont pas ouverts' }).waitFor();
  verifier(true, 'l’URL tapée à la main est refusée, avec le motif');

  console.log('Un compte sans rôle');
  await p2.evaluate(async () => {
    const { db } = await import('/src/infrastructure/powersync/database.ts');
    await db.execute('UPDATE utilisateurs SET role_id = NULL WHERE id = ?', ['aaaaaaaa-0000-0000-0000-00000000e2e0']);
  });
  await p2.goto(`${BASE_URL}/#/`);
  await p2.locator('[data-testid=bandeau-secours]').waitFor();
  const secours = await texteDe(p2, '[data-testid=bandeau-secours]');
  verifier(secours.includes('Aucun rôle ne vous a été affecté'), 'le bandeau dit qu’aucun rôle n’est affecté');
  verifier(secours.includes('droits de votre profil'), 'et qu’on travaille en attendant avec les droits du profil');
  // Un écran vide au comptoir un samedi matin n'est pas une option : le poste
  // retombe sur ce que son profil ouvrait avant les rôles.
  const menuSecours = await texteDe(p2, 'nav');
  verifier(menuSecours.includes('Point de Vente') && menuSecours.includes('Trésorerie'), 'le menu du profil reste accessible');
  verifier(!menuSecours.includes('Paramètres'), 'mais pas les paramètres : le secours fait travailler, pas administrer');

  console.log('Quand les rôles ne sont pas arrivés sur le poste');
  await p2.evaluate(async () => {
    const { db } = await import('/src/infrastructure/powersync/database.ts');
    await db.execute('DELETE FROM roles_permissions');
    await db.execute('DELETE FROM roles');
  });
  await p2.goto(`${BASE_URL}/#/`);
  await p2.locator('[data-testid=bandeau-secours]').waitFor();
  await p2.waitForFunction(() => /pas encore arriv/.test(document.querySelector('[data-testid=bandeau-secours]').textContent));
  const absents = await texteDe(p2, '[data-testid=bandeau-secours]');
  verifier(absents.includes('Sync Streams'), 'le bandeau dit où regarder quand les rôles n’arrivent pas');

  console.log('Le mot de passe livré ne reste pas en place');
  await p2.evaluate(async () => {
    const { db } = await import('/src/infrastructure/powersync/database.ts');
    await db.execute('UPDATE utilisateurs SET role_id = ?, doit_changer_mot_de_passe = 1 WHERE id = ?', [
      'bbbbbbbb-0000-0000-0000-00000000e2e0', 'aaaaaaaa-0000-0000-0000-00000000e2e0',
    ]);
  });
  await p2.goto(`${BASE_URL}/#/`);
  await p2.locator('[data-testid=mot-de-passe-nouveau]').waitFor();
  const boite = p2.locator('div[role=dialog]');
  verifier((await texteDe(p2, 'div[role=dialog]')).includes('mot de passe livré avec l’application'), 'la boîte dit pourquoi elle s’ouvre');
  verifier((await boite.getByRole('button', { name: 'Annuler' }).count()) === 0, 'et elle n’a pas de sortie');
  await p2.keyboard.press('Escape');
  verifier(await p2.locator('[data-testid=mot-de-passe-nouveau]').isVisible(), 'Échap ne la ferme pas non plus');
  await b2.close();

  console.log('Supprimer un rôle');
  await page.getByRole('main').getByRole('link', { name: 'Rôles & permissions' }).click();
  await page.locator('[data-testid=role-role_chef_de_rayon]').waitFor();
  await page.getByTestId('supprimer-role_chef_de_rayon').click();
  // Le libellé « Supprimer » vit aussi sur les boutons de la liste : c'est
  // celui de la boîte de confirmation qu'on vise.
  await page.getByRole('dialog').getByRole('button', { name: 'Supprimer' }).click();
  await page.waitForFunction(() => document.querySelectorAll('[data-testid=role-role_chef_de_rayon]').length === 0);
  const orphelines = await page.evaluate(async () => {
    const { db } = await import('/src/infrastructure/powersync/database.ts');
    const r = await db.getAll('SELECT id FROM roles WHERE code = ?', ['role_chef_de_rayon']);
    const p = await db.getAll('SELECT id FROM roles_permissions WHERE role_id NOT IN (SELECT id FROM roles)');
    return { roles: r.length, permissions: p.length };
  });
  verifier(orphelines.roles === 0 && orphelines.permissions === 0, 'le rôle part avec ses permissions, sans rien laisser derrière');

  verifier(erreurs.length === 0 && e2.length === 0, `aucune erreur console (${erreurs.length + e2.length})`);
  await browser.close();
  console.log('\n✅ Paramètres : rôles, permissions et comptes');
})().catch((e) => { console.error(e); process.exit(1); });
