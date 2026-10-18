// Lance Chromium headless (Playwright). Utilise le binaire attendu par Playwright,
// ou à défaut n'importe quel Chromium déjà présent dans le cache ms-playwright.
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

function trouverChromium() {
  const attendu = chromium.executablePath();
  if (fs.existsSync(attendu)) return attendu;
  const cache = path.join(process.env.HOME || '', 'Library/Caches/ms-playwright');
  const candidats = fs.existsSync(cache) ? fs.readdirSync(cache).filter((d) => d.startsWith('chromium-')).sort().reverse() : [];
  for (const dir of candidats) {
    const exe = path.join(cache, dir, 'chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');
    if (fs.existsSync(exe)) return exe;
  }
  throw new Error('Chromium introuvable : exécutez `npx playwright install chromium`');
}

/**
 * @param {{ reseauReel?: boolean }} [options] `reseauReel` laisse passer les
 * appels vers Supabase (scénario de synchronisation réelle uniquement).
 */
async function ouvrirNavigateur(options = {}) {
  const browser = await chromium.launch({ executablePath: trouverChromium(), headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  if (!options.reseauReel) {
    /*
     * L'app sonde le schéma du serveur au démarrage et lit le journal d'audit
     * en ligne : sans ce filet, chaque scénario interrogerait la vraie base.
     * Un scénario qui veut piloter ces réponses pose sa propre route ensuite,
     * elle a la priorité.
     *
     * Les lectures passent (schéma conforme, journal vide), mais les écritures
     * sont refusées comme le ferait le vrai serveur devant un jeton d'essai :
     * les accepter viderait la file d'envoi, que des scénarios vérifient.
     */
    await page.route('**/rest/v1/**', (route) => {
      const lecture = ['GET', 'HEAD'].includes(route.request().method());
      return route.fulfill(lecture
        ? { status: 200, contentType: 'application/json', body: '[]' }
        : { status: 401, contentType: 'application/json', body: JSON.stringify({ message: 'Invalid JWT' }) });
    });
  }
  const erreurs = [];
  page.on('console', (m) => {
    if (m.type() === 'error' && !m.text().includes('401')) erreurs.push(m.text().slice(0, 300));
  });
  page.on('pageerror', (e) => erreurs.push(`pageerror: ${e.message}`));
  return { browser, page, erreurs };
}

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:1420';

/** Injecte une session Supabase factice + un profil local : permet de tester l'UI sans backend. */
async function simulerSession(page, { profil = 'GERANT', filialeId = 'filiale-test' } = {}) {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const userId = 'aaaaaaaa-0000-0000-0000-00000000e2e0';
  const exp = Math.floor(Date.now() / 1000) + 3600 * 24;
  const jwt = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: userId, role: 'authenticated', aud: 'authenticated', exp })}.e2e`;
  const session = {
    access_token: jwt, refresh_token: 'e2e', token_type: 'bearer', expires_in: 3600 * 24, expires_at: exp,
    user: { id: userId, email: 'e2e@test.ci', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() },
  };
  await page.goto(`${BASE_URL}/#/login`, { waitUntil: 'networkidle' });
  await page.evaluate(async ({ userId, session, profil, filialeId }) => {
    const { supabase } = await import('/src/infrastructure/supabase/client.ts');
    const { db } = await import('/src/infrastructure/powersync/database.ts');
    const { definirUtilisateurCourantId } = await import('/src/infrastructure/auth/utilisateurCourant.ts');
    await db.waitForReady();
    definirUtilisateurCourantId(userId);
    await db.execute("INSERT OR REPLACE INTO filiales (id, code, nom, type, est_active) VALUES (?, 'ABJ', 'Filiale Abidjan', 'FILIALE', 1)", [filialeId]);
    await db.execute(
      "INSERT OR REPLACE INTO utilisateurs (id, email, nom, prenom, profil, filiale_id, est_actif) VALUES (?, 'e2e@test.ci', 'Koné', 'Awa', ?, ?, 1)",
      [userId, profil, profil === 'DIRECTEUR' ? null : filialeId],
    );
    localStorage.setItem(supabase.auth.storageKey, JSON.stringify(session));
  }, { userId, session, profil, filialeId });
  return { userId, filialeId };
}

function verifier(condition, message) {
  if (!condition) throw new Error(`ÉCHEC : ${message}`);
  console.log(`  ✓ ${message}`);
}

module.exports = { ouvrirNavigateur, simulerSession, verifier, BASE_URL };
