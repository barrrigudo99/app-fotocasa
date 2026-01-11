import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

const URL =
  'https://www.fotocasa.es/es/alquiler/viviendas/espana/todas-las-zonas/l';

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    slowMo: 20,
    args: ['--no-sandbox']
  });

  const page = await browser.newPage();

  await page.goto(URL, { waitUntil: 'networkidle2' });

  console.log('👇 Haz scroll MANUALMENTE en el navegador...');
  console.log('🔗 Se mostrarán SOLO los enlaces visibles cuando aparezcan nuevos\n');

  // ===== INYECTAMOS UN OBSERVADOR EN LA PÁGINA =====
  await page.exposeFunction('reportarEnlaces', (enlaces) => {
    console.log('🔗 Enlaces visibles actualmente:');
    enlaces.forEach(url => console.log(url));
    console.log('-----------------------------------\n');
  });

  await page.evaluate(() => {
    const contenedor = document.querySelector('#main-content');

    if (!contenedor) return;

    let lastSnapshot = [];

    const observer = new MutationObserver(() => {
      const enlaces = [...document.querySelectorAll('#main-content article h3 a')]
        .map(a => a.href);

      // solo si hay cambios reales
      if (
        enlaces.length !== lastSnapshot.length ||
        enlaces.some((u, i) => u !== lastSnapshot[i])
      ) {
        lastSnapshot = enlaces;
        window.reportarEnlaces(enlaces);
      }
    });

    observer.observe(contenedor, {
      childList: true,
      subtree: true
    });
  });
})();
