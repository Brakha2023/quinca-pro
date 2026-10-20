// Rend `docs/guide-utilisateur.html` en PDF A4 paginé, avec le pied de page et
// les numéros. Chromium est déjà là pour les tests de bout en bout : aucune
// bibliothèque PDF à ajouter.
//
//   node docs/generer-pdf.cjs [chemin/de/sortie.pdf]
//
// Par défaut : apps/desktop/dist-windows/Guide-QuincaPro-<version>.pdf, à côté
// de l'installeur, pour que les deux se remettent ensemble.
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const RACINE = path.join(__dirname, '..');
const { version } = JSON.parse(fs.readFileSync(path.join(RACINE, 'apps/desktop/package.json'), 'utf8'));
const SOURCE = path.join(__dirname, 'guide-utilisateur.html');
const SORTIE = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(RACINE, 'apps/desktop/dist-windows', `Guide-QuincaPro-${version}.pdf`);

/** Playwright ne télécharge pas toujours le binaire attendu : on prend celui du cache. */
function trouverChromium() {
  const attendu = chromium.executablePath();
  if (fs.existsSync(attendu)) return attendu;
  const cache = path.join(process.env.HOME || '', 'Library/Caches/ms-playwright');
  const dossiers = fs.existsSync(cache)
    ? fs.readdirSync(cache).filter((d) => d.startsWith('chromium-')).sort().reverse()
    : [];
  for (const d of dossiers) {
    const exe = path.join(cache, d, 'chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');
    if (fs.existsSync(exe)) return exe;
  }
  throw new Error('Chromium introuvable : exécutez `npx playwright install chromium`');
}

const pied = `
  <div style="width:100%;font-family:Helvetica,Arial,sans-serif;font-size:7.5pt;color:#737373;
              padding:0 17mm;display:flex;justify-content:space-between;">
    <span>QuincaPro — Guide de l'utilisateur · Cissé &amp; Frères</span>
    <span>v${version} · page <span class="pageNumber"></span>/<span class="totalPages"></span></span>
  </div>`;

(async () => {
  const navigateur = await chromium.launch({ executablePath: trouverChromium(), headless: true });
  const page = await navigateur.newPage();
  await page.goto(`file://${SOURCE}`, { waitUntil: 'networkidle' });
  fs.mkdirSync(path.dirname(SORTIE), { recursive: true });
  await page.pdf({
    path: SORTIE,
    format: 'A4',
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: '<span></span>',
    footerTemplate: pied,
    margin: { top: '19mm', right: '17mm', bottom: '20mm', left: '17mm' },
  });
  await navigateur.close();
  const ko = Math.round(fs.statSync(SORTIE).size / 1024);
  console.log(`Guide PDF : ${SORTIE} (${ko} Ko)`);
})();
