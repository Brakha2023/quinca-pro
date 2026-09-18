// Scénario Employés : fiches (photo, contrat), pointage, avances, paie mensuelle et paiement en caisse, puis UI.
const path = require('node:path');
const fs = require('node:fs');
const { ouvrirNavigateur, simulerSession, verifier, BASE_URL } = require('./browser.cjs');

(async () => {
  const { browser, page, erreurs } = await ouvrirNavigateur();
  const { filialeId, userId } = await simulerSession(page);

  console.log('Repository (base locale)');
  const r = await page.evaluate(async ({ F, U }) => {
    const { db } = await import('/src/infrastructure/powersync/database.ts');
    const { EmployesRepository } = await import('/src/infrastructure/powersync/repositories/EmployesRepository.ts');
    const { employeFormSchema, avanceSalaireSchema, paiementPaieSchema } = await import('/src/core/employes/index.ts');
    await db.execute("INSERT OR REPLACE INTO caisses (id, code, nom, filiale_id, solde_actuel, est_active) VALUES ('caisse-1', 'C01', 'Caisse principale', ?, 1000000, 1)", [F]);
    const repo = new EmployesRepository(db);
    const ctx = { filialeId: F, utilisateurId: U };
    const e1 = await repo.create(F, employeFormSchema.parse({ nom: 'Koné', prenom: 'Awa', sexe: 'F', fonction: 'Gérante', type_contrat: 'CDI', salaire_base: 260000, date_debut: '2024-01-15' }));
    const e2 = await repo.create(F, employeFormSchema.parse({ matricule: 'emp-002', nom: 'Traoré', prenom: 'Moussa', sexe: 'M', fonction: 'Manutentionnaire', type_contrat: 'JOURNALIER', salaire_base: 5000 }));
    const fiche = await db.get('SELECT matricule FROM employes WHERE id = ?', [e1]);
    const fiche2 = await db.get('SELECT matricule FROM employes WHERE id = ?', [e2]);
    // L'unicité du matricule est vérifiée par l'application avant création (contrainte serveur en secours).
    const doublon = (await repo.matriculeExiste(F, 'EMP-002')) && !(await repo.matriculeExiste(F, 'EMP-002', e2));

    // Pointages de septembre 2026 : Awa 2 absences + 1 justifiée, Moussa 18 présences.
    const jours = Array.from({ length: 22 }, (_, i) => `2026-09-${String(i + 1).padStart(2, '0')}`);
    for (const [i, jour] of jours.entries()) {
      await repo.pointer(ctx, { employe_id: e1, date_pointage: jour, statut: i < 2 ? 'ABSENT' : i === 2 ? 'JUSTIFIE' : 'PRESENT', commentaire: '' });
      if (i < 18) await repo.pointer(ctx, { employe_id: e2, date_pointage: jour, statut: 'PRESENT', commentaire: '' });
    }
    await repo.pointer(ctx, { employe_id: e1, date_pointage: '2026-09-01', statut: 'PRESENT', commentaire: 'corrigé' }); // remplace l'absence du 1er
    const nbPointagesAwa = (await db.get("SELECT COUNT(*) AS n FROM pointages WHERE employe_id = ?", [e1])).n;

    await repo.enregistrerAvance(ctx, avanceSalaireSchema.parse({ employe_id: e1, periode: '2026-09', montant: 50000, caisse_id: 'caisse-1' }));
    const caisseApresAvance = (await db.get("SELECT solde_actuel FROM caisses WHERE id = 'caisse-1'")).solde_actuel;

    const gen = await repo.genererPaies(ctx, '2026-09');
    const paieAwa = await db.get('SELECT * FROM paies WHERE employe_id = ? AND periode = ?', [e1, '2026-09']);
    const paieMoussa = await db.get('SELECT * FROM paies WHERE employe_id = ? AND periode = ?', [e2, '2026-09']);
    await repo.ajusterPaie(paieAwa.id, { primes: 15000, retenues: 0, notes: 'Prime de septembre' });
    const paieAwa2 = await db.get('SELECT net_a_payer FROM paies WHERE id = ?', [paieAwa.id]);
    await repo.payer(ctx, paieAwa.id, paiementPaieSchema.parse({ caisse_id: 'caisse-1', mode_paiement: 'ESPECES' }));
    const paieAwa3 = await db.get('SELECT statut, date_paiement FROM paies WHERE id = ?', [paieAwa.id]);
    let repaye = false;
    try { await repo.payer(ctx, paieAwa.id, paiementPaieSchema.parse({ caisse_id: 'caisse-1' })); } catch (e) { repaye = /déjà payée/.test(e.message); }
    const gen2 = await repo.genererPaies(ctx, '2026-09'); // la paie payée n'est pas touchée, celle de Moussa est recalculée
    const caisseFin = (await db.get("SELECT solde_actuel FROM caisses WHERE id = 'caisse-1'")).solde_actuel;
    const treso = await db.getAll("SELECT categorie, montant FROM mouvements_tresorerie WHERE filiale_id = ? ORDER BY created_at", [F]);
    return { matricule: fiche.matricule, matricule2: fiche2.matricule, doublon, nbPointagesAwa, caisseApresAvance, gen, paieAwa, paieMoussa, netAwa2: paieAwa2.net_a_payer, paieAwa3, repaye, gen2, caisseFin, treso, e1 };
  }, { F: filialeId, U: userId });

  verifier(/^EMP-[A-Z2-9]{5}$/.test(r.matricule) && r.matricule2 === 'EMP-002' && r.doublon, 'matricule auto, matricule saisi en majuscules, doublon détecté');
  verifier(r.nbPointagesAwa === 22, 'un seul pointage par jour (le second remplace le premier)');
  verifier(r.caisseApresAvance === 950000, 'avance de 50 000 sortie de caisse');
  verifier(r.gen.creees === 2 && r.paieAwa.jours_presents === 20 && r.paieAwa.jours_absents === 1 && r.paieAwa.jours_justifies === 1, 'paies générées depuis les pointages (Awa : 20 P / 1 A / 1 J)');
  verifier(r.paieAwa.retenue_absences === 10000 && r.paieAwa.brut === 250000 && r.paieAwa.avances === 50000 && r.paieAwa.net_a_payer === 200000, 'Awa : 260 000 − 1/26 = 250 000 brut, − 50 000 d’avance = 200 000 net');
  verifier(r.paieMoussa.brut === 90000 && r.paieMoussa.net_a_payer === 90000, 'Moussa (journalier) : 18 × 5 000 = 90 000');
  verifier(r.netAwa2 === 215000, 'prime de 15 000 → net 215 000');
  verifier(r.paieAwa3.statut === 'PAYEE' && r.paieAwa3.date_paiement && r.repaye, 'paie payée, non repayable');
  verifier(r.gen2.creees === 0 && r.gen2.misesAJour === 1 && r.caisseFin === 735000, 'recalcul : la paie payée est conservée ; caisse 1 000 000 − 50 000 − 215 000');
  verifier(r.treso.map((t) => `${t.categorie}:${t.montant}`).join() === 'AVANCE_SALAIRE:50000,SALAIRE:215000', 'trésorerie : avance et salaire journalisés');

  console.log('Interface');
  await page.goto(`${BASE_URL}/#/employes`);
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('tbody tr', { hasText: 'Awa Koné' }).waitFor();
  const sousMenu = page.locator('[data-testid=sous-menu-employés]');
  await sousMenu.waitFor();
  verifier((await sousMenu.locator('a').count()) === 5, 'sous-menu Employés : 5 sections');

  // Fiche avec photo et contrat joints (fichiers générés à la volée).
  const tmp = path.join(__dirname, '.tmp'); fs.mkdirSync(tmp, { recursive: true });
  const png1x1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
  fs.writeFileSync(path.join(tmp, 'photo.png'), png1x1);
  fs.writeFileSync(path.join(tmp, 'contrat.pdf'), Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF'));
  await sousMenu.getByRole('link', { name: 'Nouveau employé' }).click();
  await page.getByRole('dialog', { name: 'Nouvel employé' }).waitFor();
  await page.locator('#employe-form input[name=nom]').fill('Diabaté');
  await page.locator('#employe-form input[name=prenom]').fill('Fatou');
  await page.locator('#employe-form select[name=sexe]').selectOption('F');
  await page.locator('#employe-form input[name=fonction]').fill('Caissière');
  await page.locator('#employe-form select[name=type_contrat]').selectOption('CDD');
  await page.locator('#employe-form input[name=salaire_base]').fill('150000');
  await page.locator('[data-testid=photo-input]').setInputFiles(path.join(tmp, 'photo.png'));
  await page.locator('#employe-form img[alt=Photo]').waitFor();
  await page.locator('[data-testid=contrat-input]').setInputFiles(path.join(tmp, 'contrat.pdf'));
  await page.locator('#employe-form', { hasText: 'contrat.pdf' }).waitFor();
  await page.getByRole('button', { name: 'Créer', exact: true }).click();
  await page.locator('tbody tr', { hasText: 'Fatou Diabaté' }).waitFor();
  verifier(true, 'employée créée avec photo et contrat joint');
  await page.locator('tbody tr', { hasText: 'Fatou Diabaté' }).getByTitle('Fiche employé').click();
  await page.getByRole('dialog').locator('[data-testid=photo-employe]').waitFor();
  await page.getByRole('dialog').getByRole('button', { name: 'Voir le contrat' }).click();
  await page.locator('iframe[title=Contrat]').waitFor();
  verifier(true, 'fiche : photo affichée, contrat consultable');
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');

  await sousMenu.getByRole('link', { name: 'Pointage' }).click();
  await page.locator('input[type=date]').fill('2026-09-23');
  await page.locator('[data-testid=pointage-EMP-002]').getByRole('button', { name: 'Absent', exact: true }).click();
  await page.locator('[data-testid=pointage-EMP-002] button.bg-red-600').waitFor();
  await page.getByRole('button', { name: 'Tous présents' }).click();
  await page.locator('[aria-live]', { hasText: 'marqués présents' }).waitFor();
  await page.locator('[data-testid=pointage-EMP-002] td', { hasText: /^1$/ }).first().waitFor();
  await page.locator('tbody button.bg-green-600').nth(1).waitFor();
  verifier((await page.locator('tbody button.bg-green-600').count()) === 2 && (await page.locator('tbody button.bg-red-600').count()) === 1, 'pointage du jour : 1 absent, 2 présents (« Tous présents » ne touche pas les pointés)');

  await sousMenu.getByRole('link', { name: 'Paie / salaire' }).click();
  await page.locator('[data-testid=periode-paie]').fill('2026-09');
  await page.locator('[data-testid=paie-EMP-002]').waitFor();
  await page.getByRole('button', { name: 'Recalculer depuis les pointages' }).click();
  await page.locator('[aria-live]', { hasText: '1 créée(s), 1 recalculée(s)' }).waitFor();
  await page.locator('tbody tr', { hasText: 'Fatou Diabaté' }).locator('text=150 000 F').first().waitFor();
  verifier(true, 'recalcul : paie de Fatou créée (150 000), celle de Moussa recalculée (absent le 23 → toujours 90 000), Awa payée conservée');
  await page.getByRole('button', { name: /^Payer tout/ }).click();
  await page.getByRole('dialog', { name: 'Payer toutes les paies' }).locator('select[name=caisse_id]').selectOption({ label: 'Caisse principale' });
  await page.getByRole('dialog', { name: 'Payer toutes les paies' }).getByRole('button', { name: 'Payer', exact: true }).click();
  await page.getByRole('dialog', { name: 'Confirmation' }).getByRole('button', { name: 'Payer tout' }).click();
  await page.locator('[aria-live]', { hasText: 'salaire(s) payé(s)' }).waitFor();
  await page.locator('[data-testid=paie-EMP-002]', { hasText: 'Payée' }).waitFor();
  verifier(true, 'paiement groupé des paies restantes');

  await sousMenu.getByRole('link', { name: 'Paiement de salaire' }).click();
  await page.locator('[data-testid=periode-paie]').fill('2026-09');
  await page.locator('tbody tr', { hasText: 'Payée' }).first().waitFor();
  await page.getByRole('button', { name: 'Émargement sans salaire' }).click();
  await page.locator('#zone-impression .document-titre', { hasText: "Fiche d'émargement" }).waitFor();
  verifier(!(await page.textContent('#zone-impression')).includes('215'), 'émargement sans salaire : aucun montant');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Émargement avec salaire' }).click();
  await page.locator('#zone-impression', { hasText: 'Net payé' }).locator('text=215 000 F').first().waitFor();
  verifier(true, 'émargement avec salaire : montants affichés');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Bulletins de paie' }).click();
  await page.locator('#zone-impression', { hasText: 'Bulletin de paie' }).locator('text=Avances sur salaire déjà versées').waitFor();
  verifier(true, 'bulletins de paie du mois');

  verifier(erreurs.length === 0, `aucune erreur console${erreurs.length ? ' : ' + erreurs.join(' | ') : ''}`);
  await browser.close();
  console.log('OK');
})().catch((e) => { console.error(e.message); process.exit(1); });
