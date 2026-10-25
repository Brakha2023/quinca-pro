/**
 * Paramètres → Entreprise : l'identité de la maison, et ce qu'elle change
 * réellement sur le papier.
 *
 * Le scénario règle la fiche depuis l'écran, puis va ouvrir un document A4
 * d'un tout autre module pour vérifier qu'il a repris l'en-tête. C'est le seul
 * point qui compte : un écran de réglages qui ne change rien n'est qu'un
 * formulaire. Aucun backend requis.
 */
const { ouvrirNavigateur, simulerSession, verifier, BASE_URL } = require('./browser.cjs');

const texteDe = async (page, selecteur) => (await page.textContent(selecteur)).replace(/\s+/g, ' ').trim();

(async () => {
  const { browser, page, erreurs } = await ouvrirNavigateur();
  const { filialeId } = await simulerSession(page, { profil: 'DIRECTEUR', filialeId: 'filiale-test' });

  console.log('La fiche que le serveur a posée');
  await page.evaluate(async ({ F }) => {
    const { db } = await import('/src/infrastructure/powersync/database.ts');
    await db.execute("UPDATE utilisateurs SET profil='DIRECTEUR', filiale_id=NULL");
    // Ce que la migration 20261025000000 pose : une fiche par filiale, reprise
    // de ce que la filiale portait déjà, le reste à compléter.
    await db.execute(
      `INSERT OR REPLACE INTO parametres_filiale
       (id, filiale_id, nom_commercial, raison_sociale, telephone_principal, adresse, ville, pays,
        assujetti_tva, taux_tva, prix_saisis, devise)
       VALUES ('pf-1', ?, 'Filiale Abidjan', 'Filiale Abidjan', '27 32 79 50 90', 'Adjamé', 'Abidjan',
               'Côte d''Ivoire', 1, 18, 'TTC', 'XOF')`, [F],
    );
  }, { F: filialeId });

  await page.goto(`${BASE_URL}/#/parametres/entreprise`);
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('[data-testid=champ-nom-commercial]').waitFor();
  verifier((await texteDe(page, 'main h1')) === 'Paramètres · Entreprise & filiales', 'la section s’ouvre sur l’identité');
  verifier((await texteDe(page, '[data-testid=entreprise-incomplete]')).includes('le RCCM'),
    'la fiche incomplète dit ce qui lui manque, au lieu de laisser deviner');

  console.log('Renseigner l’identité');
  await page.fill('[data-testid=champ-nom-commercial]', 'QUINCAILLERIE CISSE ET FRERE');
  await page.fill('input[name=raison_sociale]', 'QCF SASU');
  await page.fill('input[name=rccm]', 'CI-ABJ-03-2023-B-12345');
  await page.fill('input[name=numero_cc]', '2301234 F');
  await page.fill('input[name=compte_contribuable]', '0123456K');
  await page.fill('[data-testid=champ-telephone]', '27 32 79 50 90');
  await page.fill('input[name=adresse]', 'Sis à Adjamé Liberté en face de MTN');
  await page.click('[data-testid=enregistrer-entreprise]');
  await page.locator('[aria-live]', { hasText: 'Identité enregistrée' }).waitFor();
  verifier(true, 'identité enregistrée depuis l’écran');

  const enBase = await page.evaluate(async () => {
    const { db } = await import('/src/infrastructure/powersync/database.ts');
    return db.get('SELECT nom_commercial, rccm, compte_contribuable FROM parametres_filiale WHERE id = ?', ['pf-1']);
  });
  verifier(enBase.nom_commercial === 'QUINCAILLERIE CISSE ET FRERE' && enBase.rccm === 'CI-ABJ-03-2023-B-12345',
    'la fiche est écrite dans la base locale : le poste la garde hors ligne');

  console.log('Fiscalité et mentions légales');
  await page.goto(`${BASE_URL}/#/parametres/fiscalite`);
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('[data-testid=taux-tva]').waitFor();
  await page.fill('[data-testid=taux-tva]', '9');
  await page.fill('[data-testid=mentions-legales]', 'Merci pour votre confiance. Conservez cette facture.');
  await page.click('[data-testid=enregistrer-fiscalite]');
  await page.locator('[aria-live]', { hasText: 'Réglages fiscaux enregistrés' }).waitFor();
  const fisc = await page.evaluate(async () => {
    const { db } = await import('/src/infrastructure/powersync/database.ts');
    return db.get('SELECT taux_tva, mentions_legales FROM parametres_filiale WHERE id = ?', ['pf-1']);
  });
  verifier(Number(fisc.taux_tva) === 9, 'le taux de TVA par défaut est enregistré');
  verifier(String(fisc.mentions_legales).startsWith('Merci'), 'les mentions légales sont enregistrées');

  // Décocher l'assujettissement doit faire disparaître les réglages de TVA :
  // une maison non assujettie n'a pas de taux à régler.
  // `click` et non `check` : Playwright vérifie l'état aussitôt après le clic,
  // avant que React ait repeint, et conclut à tort que rien n'a changé.
  await page.click('[data-testid=assujetti-tva]');
  await page.locator('[data-testid=taux-tva]').waitFor({ state: 'detached' });
  verifier(true, 'non assujettie : plus de taux ni de mode de prix à régler');
  await page.click('[data-testid=assujetti-tva]');
  await page.locator('[data-testid=taux-tva]').waitFor();
  verifier(true, 'de nouveau assujettie : les réglages reviennent');

  console.log('Réglages d’impression');
  await page.goto(`${BASE_URL}/#/parametres/documents`);
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('[data-testid=document-facture]').waitFor();
  verifier((await page.locator('[data-testid=apercu-document]').count()) === 1, 'un aperçu accompagne les réglages');
  verifier((await texteDe(page, '[data-testid=apercu-document]')).includes('QUINCAILLERIE CISSE ET FRERE'),
    'l’aperçu reprend l’identité saisie');
  verifier((await page.locator('[data-testid=format-journal-TICKET]').count()) === 0,
    'un journal ne se propose pas en 80 mm : le format impossible n’est pas offert');

  await page.click('[data-testid=format-facture-A5]');
  await page.click('[data-testid=nb-facture]');
  await page.click('[data-testid=enregistrer-documents]');
  await page.locator('[aria-live]', { hasText: 'Réglages d’impression enregistrés' }).waitFor();
  const docs = await page.evaluate(async () => {
    const { db } = await import('/src/infrastructure/powersync/database.ts');
    const l = await db.get('SELECT formats_documents FROM parametres_filiale WHERE id = ?', ['pf-1']);
    return JSON.parse(l.formats_documents);
  });
  verifier(docs.facture.format === 'A5' && docs.facture.noir_blanc === true,
    'le réglage de la facture est enregistré, format et couleur compris');

  console.log('Numérotation');
  await page.goto(`${BASE_URL}/#/parametres/numerotation`);
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('[data-testid=prefixe-facture]').waitFor();
  await page.fill('[data-testid=prefixe-facture]', 'fa-ct');
  verifier((await page.inputValue('[data-testid=prefixe-facture]')) === 'FACT',
    'un préfixe se nettoie à la frappe : ni minuscule, ni tiret dans un numéro');
  await page.click('[data-testid=enregistrer-numerotation]');
  await page.locator('[aria-live]', { hasText: 'Préfixes enregistrés' }).waitFor();
  verifier(true, 'préfixes enregistrés');

  console.log('Ce que le papier en fait');
  // Un document d'un tout autre module : s'il a repris l'en-tête, les vingt-sept
  // l'ont repris, puisqu'ils passent tous par le même composant.
  await page.goto(`${BASE_URL}/#/parametres/utilisateurs`);
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('[data-testid=imprimer-utilisateurs]').waitFor();
  await page.click('[data-testid=imprimer-utilisateurs]');
  await page.locator('#zone-impression .document').waitFor();
  // L'en-tête vient d'une requête vivante : elle revient **après** la première
  // peinture, et le document s'affiche d'abord avec ce que porte la filiale.
  await page.waitForFunction(
    () => document.querySelector('#zone-impression .document')?.textContent.includes('QUINCAILLERIE CISSE ET FRERE'),
  );
  const papier = await texteDe(page, '#zone-impression .document');
  verifier(papier.includes('QUINCAILLERIE CISSE ET FRERE'), 'le document imprimé porte le nom commercial réglé');
  verifier((await texteDe(page, '[data-testid=document-identifiants]')).includes('RCCM CI-ABJ-03-2023-B-12345'),
    'et les identifiants fiscaux, composés en une ligne');
  verifier((await texteDe(page, '[data-testid=document-mentions]')).startsWith('Merci'),
    'et les mentions légales, au pied de la pièce');
  verifier((await texteDe(page, '.document-logo')) === 'QCF',
    'faute de logo chargé, les initiales de la raison sociale — « et » ne compte pas');

  console.log('Sans la permission');
  const { browser: b2, page: p2, erreurs: e2 } = await ouvrirNavigateur();
  await simulerSession(p2, { permissions: ['parametres.lire'] });
  await p2.evaluate(async () => {
    const { db } = await import('/src/infrastructure/powersync/database.ts');
    await db.execute(
      `INSERT OR REPLACE INTO parametres_filiale (id, filiale_id, nom_commercial, telephone_principal, adresse, ville, pays, assujetti_tva, taux_tva, prix_saisis, devise)
       VALUES ('pf-1','filiale-test','Filiale Abidjan','27 32','Adjamé','Abidjan','Côte d''Ivoire',1,18,'TTC','XOF')`);
  });
  await p2.goto(`${BASE_URL}/#/parametres/entreprise`);
  await p2.reload({ waitUntil: 'networkidle' });
  await p2.locator('[data-testid=champ-nom-commercial]').waitFor();
  verifier(await p2.locator('[data-testid=champ-nom-commercial]').isDisabled(),
    'sans la permission : la fiche se consulte, elle ne se modifie pas');
  verifier((await p2.locator('[data-testid=enregistrer-entreprise]').count()) === 0,
    'et aucun bouton d’enregistrement n’est offert');
  await b2.close();

  verifier(erreurs.length === 0 && e2.length === 0, `aucune erreur console (${erreurs.length + e2.length})`);
  await browser.close();
  console.log('\n✅ Paramètres : identité, fiscalité, impressions, numérotation');
})();
