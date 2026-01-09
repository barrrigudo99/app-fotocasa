import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

// ===================== UTILIDADES =====================
const esperar = (min, max) => {
  const ms = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise(resolve => setTimeout(resolve, ms));
};

const scrollAbajoYArribaRapido = async (
  page,
  {
    step = 1000,        // píxeles por scroll
    delayMin = 20,      // ms mínimos
    delayMax = 40,      // ms máximos
    maxIter = 10        // ciclos abajo+arriba
  } = {}
) => {
  let alturaAnterior = 0;

  for (let i = 0; i < maxIter; i++) {
    // 🔽 BAJAR
    const alturaActual = await page.evaluate(() => document.body.scrollHeight);

    if (alturaActual === alturaAnterior) {
      break; // no hay más carga
    }

    alturaAnterior = alturaActual;

    await page.evaluate((step) => {
      window.scrollBy(0, step);
    }, step);

    await esperar(delayMin, delayMax);

    // 🔼 SUBIR
    await page.evaluate((step) => {
      window.scrollBy(0, -step / 2);
    }, step);

    await esperar(delayMin, delayMax);
  }
};



// ===================== BROWSER =====================
async function acceder_URL(url) {
  const browser = await puppeteer.launch({
    headless: false,
    slowMo: 20,
    args: [
        '--incognito',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled'
    ]
  });

  const page = await browser.newPage();

  await page.goto(url, {
    waitUntil: 'networkidle2',
    timeout: 60000
  });

  return { browser, page };
}

// ===================== COOKIES =====================
const aceptarCookies = async (page) => {
  try {
    // 1️⃣ Botón Didomi (clásico)
    await page.waitForSelector('#didomi-notice-disagree-button', {
      timeout: 5000
    });
    await page.click('#didomi-notice-disagree-button');
    await esperar(800, 1500);
  } catch {}

  try {
    // 2️⃣ Botón del modal React (el que has pasado)
    const selectorModal =
      '#modal-react-portal button';

    await page.waitForSelector(selectorModal, { timeout: 5000 });

    await page.evaluate(() => {
      const botones = Array.from(
        document.querySelectorAll('#modal-react-portal button')
      );

      const boton = botones.find(b =>
        b.textContent.toLowerCase().includes('no') ||
        b.textContent.toLowerCase().includes('si')
      );

      if (boton) boton.click();
    });

    await esperar(800, 1500);
  } catch {}

};


// ===================== PAGINACIÓN =====================
async function extraerTextoPaginacion(url) {
  const { browser, page } = await acceder_URL(url);

  await aceptarCookies(page);

  //await scrollRapidoAbajoYArriba(page);
  await scrollAbajoYArribaRapido(page, { maxIter: 15 });
  await page.waitForSelector('[id^="pagination"][id*="item"]', {
    timeout: 15000
  });

  const textos = await page.evaluate(() => {
    return Array.from(
      document.querySelectorAll('[id^="pagination"][id*="item"]')
    ).map(el => el.textContent.trim());
  });

  console.log('📄 Textos de paginación:', textos);

  await browser.close();
}

// ===================== EJECUCIÓN =====================
const url = 'https://www.fotocasa.es/es/alquiler/viviendas/espana/todas-las-zonas/l/1';
extraerTextoPaginacion(url);
