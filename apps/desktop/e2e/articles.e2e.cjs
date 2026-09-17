// Scénario Catalogue : repositories sur la vraie base SQLite locale, puis parcours UI.
// Prérequis : `pnpm dev` lancé (http://localhost:1420). Aucun backend requis.
const { ouvrirNavigateur, simulerSession, verifier, BASE_URL } = require('./browser.cjs');

(async () => {
  const { browser, page, erreurs } = await ouvrirNavigateur();
  const { filialeId } = await simulerSession(page);

  console.log('Repositories (base locale)');
  const r = await page.evaluate(async (F) => {
    const { db } = await import('/src/infrastructure/powersync/database.ts');
    const { ArticlesRepository, articlesQuery } = await import('/src/infrastructure/powersync/repositories/ArticlesRepository.ts');
    const { FamillesRepository } = await import('/src/infrastructure/powersync/repositories/FamillesRepository.ts');
    const { articleFormSchema } = await import('/src/core/articles/index.ts');
    const familles = new FamillesRepository(db);
    const fid = await familles.create(F, { code: 'SAN', nom: 'SANITAIRE', description: '' });
    const articles = new ArticlesRepository(db);
    const form = articleFormSchema.parse({ code: 'rob-01', designation: 'Robinet', famille_id: fid, prix_achat: '8500', prix_vente: '12500' });
    const aid = await articles.create(F, form);
    await articles.update(aid, { ...form, prix_vip: 12000 });
    const imp = await articles.importMany(F, [
      { code: 'ROB-01', designation: 'Doublon', prix_achat: 1, prix_vente: 2, famille_nom: 'Sanitaire' },
      { code: 'CIM-50', designation: 'Ciment 50kg', prix_achat: 4500, prix_vente: 5500, famille_nom: 'Ciment' },
    ]);
    const q = articlesQuery(F, { recherche: 'cim' });
    return {
      prixVip: (await db.get('SELECT prix_vip FROM articles WHERE id = ?', [aid])).prix_vip,
      importes: imp.importes, ignores: imp.ignores.length,
      recherche: (await db.getAll(q.sql, q.params)).map((a) => a.code),
      enAttente: (await db.getCrudBatch(100))?.crud.length ?? 0,
    };
  }, filialeId);
  verifier(r.prixVip === 12000, 'update partiel appliqué');
  verifier(r.importes === 1 && r.ignores === 1, 'import : doublon ignoré, nouveau code importé');
  verifier(r.recherche.join() === 'CIM-50', 'filtre SQL par recherche');
  verifier(r.enAttente > 0, `${r.enAttente} écritures en file d'upload`);

  console.log('Interface');
  await page.goto(`${BASE_URL}/#/articles`);
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('main h1', { hasText: 'Catalogue' }).waitFor();
  await page.locator('aside').locator('text=Awa Koné').waitFor();
  verifier(true, 'profil réel affiché dans la sidebar');
  verifier((await page.locator('tbody tr').count()) === 2, 'articles listés en temps réel');

  await page.getByRole('button', { name: 'Nouvel article' }).click();
  await page.locator('#article-form input[name=code]').fill('PEI-20L');
  await page.locator('#article-form input[name=designation]').fill('Peinture 20L');
  await page.locator('#article-form input[name=prix_achat]').fill('35000');
  await page.locator('#article-form input[name=prix_vente]').fill('42000');
  await page.locator('#article-form input[name=stock_min]').fill('5');
  await page.locator('#article-form input[name=stock_max]').fill('2');
  await page.getByRole('button', { name: 'Créer' }).click();
  verifier((await page.textContent('#article-form p.text-red-600')).includes('stock maximum'), 'validation stock max < min');
  await page.locator('#article-form input[name=stock_max]').fill('40');
  await page.getByRole('button', { name: 'Créer' }).click();
  await page.locator('[aria-live]', { hasText: 'PEI-20L créé' }).waitFor();
  await page.locator('tbody tr', { hasText: 'PEI-20L' }).waitFor();
  verifier((await page.locator('tbody tr').count()) === 3, 'création via formulaire');

  await page.getByRole('button', { name: 'Nouvel article' }).click();
  await page.locator('#article-form input[name=code]').fill('pei-20l');
  await page.locator('#article-form input[name=designation]').fill('X');
  await page.locator('#article-form input[name=prix_achat]').fill('1');
  await page.locator('#article-form input[name=prix_vente]').fill('2');
  await page.getByRole('button', { name: 'Créer' }).click();
  await page.locator('#article-form p.text-red-600', { hasText: 'existe déjà' }).waitFor();
  verifier(true, 'doublon de code refusé');
  await page.keyboard.press('Escape');

  await page.locator('input[type=search]').fill('pein');
  await page.locator('tbody tr', { hasText: 'Peinture' }).waitFor();
  await page.locator('tbody tr', { hasText: 'Robinet' }).waitFor({ state: 'detached' });
  verifier((await page.locator('tbody tr').count()) === 1, 'recherche temps réel');

  await page.getByRole('button', { name: 'Familles' }).click();
  await page.locator('tbody tr', { hasText: 'SANITAIRE' }).waitFor();
  verifier((await page.locator('tbody tr').count()) === 2, 'onglet familles (dont famille créée par import)');

  verifier(erreurs.length === 0, `aucune erreur console${erreurs.length ? ' : ' + erreurs.join(' | ') : ''}`);
  await browser.close();
  console.log('OK');
})().catch((e) => { console.error(e.message); process.exit(1); });
