// Scénario de synchronisation réelle : login Supabase, réception du référentiel
// de la filiale, création d'un article et remontée vers Postgres.
// Prérequis : `pnpm dev` lancé, backend configuré (README), et les variables
// E2E_EMAIL / E2E_PASSWORD d'un compte GERANT. L'article créé reste en base.
if (!process.env.E2E_EMAIL || !process.env.E2E_PASSWORD) {
  console.error('E2E_EMAIL et E2E_PASSWORD sont requis');
  process.exit(2);
}
const { ouvrirNavigateur, BASE_URL, verifier } = require('./browser.cjs');
(async () => {
  const { browser, page, erreurs } = await ouvrirNavigateur({ reseauReel: true });
  await page.goto(`${BASE_URL}/#/login`, { waitUntil: 'networkidle' });
  await page.fill('input[type=email]', process.env.E2E_EMAIL);
  await page.fill('input[type=password]', process.env.E2E_PASSWORD);
  await page.click('button[type=submit]');
  await page.locator('aside').waitFor({ timeout: 15000 });
  await page.locator('header', { hasText: 'Synchronisé' }).waitFor({ timeout: 30000 });
  verifier(true, 'connecté et synchronisé');

  await page.goto(`${BASE_URL}/#/articles`);
  await page.locator('main h1', { hasText: 'Catalogue' }).waitFor();
  await page.getByRole('button', { name: 'Familles' }).click();
  await page.locator('tbody tr', { hasText: 'SANITAIRE' }).waitFor();
  verifier((await page.locator('tbody tr').count()) >= 1, 'familles de la filiale affichées');
  await page.getByRole('button', { name: 'Dépôts' }).click();
  await page.locator('tbody tr').first().waitFor();
  verifier(true, 'dépôts de la filiale affichés');

  const code = 'E2E-' + Date.now().toString().slice(-6);
  await page.getByRole('button', { name: 'Articles' }).click();
  await page.getByRole('button', { name: 'Nouvel article' }).click();
  await page.locator('#article-form input[name=code]').fill(code);
  await page.locator('#article-form input[name=designation]').fill('Article test bout en bout');
  await page.locator('#article-form select[name=famille_id]').selectOption({ label: 'SANITAIRE' });
  await page.locator('#article-form input[name=prix_achat]').fill('1000');
  await page.locator('#article-form input[name=prix_vente]').fill('1500');
  await page.getByRole('button', { name: 'Créer' }).click();
  await page.locator('tbody tr', { hasText: code }).waitFor();
  verifier(true, `article ${code} créé localement`);

  // Attendre que la file d'upload soit vide
  const vide = await page.evaluate(async () => {
    const { db } = await import('/src/infrastructure/powersync/database.ts');
    for (let i = 0; i < 40; i++) {
      const b = await db.getCrudBatch(1);
      if (!b) return true;
      await new Promise((r) => setTimeout(r, 500));
    }
    return false;
  });
  verifier(vide, "file d'upload vidée (envoyé à Supabase)");
  console.log('CODE=' + code);
  verifier(erreurs.length === 0, `aucune erreur console${erreurs.length ? ' : ' + erreurs.join(' | ') : ''}`);
  await browser.close();
})().catch((e) => { console.error(e.message); process.exit(1); });
