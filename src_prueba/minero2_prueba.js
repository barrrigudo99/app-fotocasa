import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { fileURLToPath } from 'url';
import readline from 'node:readline';
import pkg from 'pg';
const { Client } = pkg;

// ===================== CONFIG =====================

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DB_CONFIG = {
  host: 'localhost',
  port: 5433,
  user: 'admin',
  password: 'admin123',
  database: 'inmuebles'
};

const PORTAL = 'fotocasa';

// ===================== UTIL =====================

const extraerId = (url) => url.split('/').slice(-2).join('/');

const esperar = (min, max) =>
  new Promise((resolve) => {
    const tiempo = Math.floor(Math.random() * (max - min + 1)) + min;
    setTimeout(resolve, tiempo);
  });

function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// ===================== DUPLICADOS =====================

function registrarDuplicado(anuncio) {
  const rutaArchivo = path.join(
    __dirname,
    'data/enlaces/duplicados/duplicados-fotocasa.json'
  );

  ensureDir(rutaArchivo);

  let duplicados = {};
  if (fs.existsSync(rutaArchivo)) {
    duplicados = JSON.parse(fs.readFileSync(rutaArchivo, 'utf-8'));
  }

  if (!duplicados[anuncio.id]) {
    duplicados[anuncio.id] = {
      url: anuncio.url,
      count: 1,
      first_seen: new Date().toISOString(),
      last_seen: new Date().toISOString()
    };
  } else {
    duplicados[anuncio.id].count += 1;
    duplicados[anuncio.id].last_seen = new Date().toISOString();
  }

  fs.writeFileSync(rutaArchivo, JSON.stringify(duplicados, null, 2), 'utf-8');
}

async function volcarDuplicado(anuncio) {
  const client = new Client(DB_CONFIG);
  await client.connect();

  await client.query(
    `
    INSERT INTO raw.duplicados (id, url, count, first_seen, last_seen)
    VALUES ($1, $2, 1, NOW(), NOW())
    ON CONFLICT (id)
    DO UPDATE SET
      count = raw.duplicados.count + 1,
      last_seen = NOW()
    `,
    [anuncio.id, anuncio.url]
  );

  await client.end();
}

// ===================== MERGE JSON =====================

async function mergeAnuncios(nuevosAnuncios) {
  const rutaArchivo = path.join(__dirname, 'data/enlaces/anuncios-fotocasa.json');
  ensureDir(rutaArchivo);

  let existentes = [];
  if (fs.existsSync(rutaArchivo)) {
    existentes = JSON.parse(fs.readFileSync(rutaArchivo, 'utf-8'));
  }

  const map = new Map(existentes.map((x) => [x.id, x]));

  for (const a of nuevosAnuncios) {
    if (map.has(a.id)) {
      registrarDuplicado(a);
      await volcarDuplicado(a);
    } else {
      map.set(a.id, a);
    }
  }

  fs.writeFileSync(rutaArchivo, JSON.stringify([...map.values()], null, 2), 'utf-8');
  console.log(`🔗 Total anuncios únicos: ${map.size}`);
}

// ===================== POSTGRES RAW =====================

async function volcarEnPostgres(anuncios) {
  const client = new Client(DB_CONFIG);
  await client.connect();

  for (const a of anuncios) {
    await client.query(`
  INSERT INTO raw.enlaces (id, url, portal, timestamp)
  VALUES ($1, $2, $3, now())
  ON CONFLICT (id) DO NOTHING
`, [a.id, a.url, PORTAL]);
  }

  await client.end();
}

function marcarImportados(ids) {
  const ruta = path.join(__dirname, 'data/enlaces/anuncios-fotocasa.json');
  ensureDir(ruta);

  const anuncios = fs.existsSync(ruta)
    ? JSON.parse(fs.readFileSync(ruta, 'utf-8'))
    : [];

  anuncios.forEach((a) => {
    if (ids.includes(a.id)) {
      a.importado = true;
      a.importado_at = new Date().toISOString();
    }
  });

  fs.writeFileSync(ruta, JSON.stringify(anuncios, null, 2), 'utf-8');
}

// ===================== SCRAPING =====================

async function obtenerAnuncios(page) {
  await page.waitForSelector('article.\\@container.w-full', { timeout: 10000 });

  return await page.evaluate(() => {
    return [...document.querySelectorAll('article.\\@container.w-full')]
      .map((article) => {
        const a = article.querySelector('h3 a');
        if (!a) return null;

        const url = a.href;
        const id = url.split('/').slice(-2).join('/');

        return {
          id,
          url,
          estado: false,
          importado: false,
          timestamp: new Date().toISOString()
        };
      })
      .filter(Boolean);
  });
}

// ===================== SCROLL & COOKIES =====================

const scrollHumano = async (page) => {
  const acciones = Math.floor(Math.random() * 3) + 2;
  for (let i = 0; i < acciones; i++) {
    await page.mouse.wheel({ deltaY: Math.floor(Math.random() * 400) + 200 });
    await esperar(400, 1200);
  }
};

const scrollRapidoAbajoYArriba = async (page) => {
  try {
    while (true) {
      const bajado = await page.evaluate(() => {
        const antes = window.scrollY;
        window.scrollBy(0, 800);
        return window.scrollY > antes;
      });
      if (!bajado) break;
      await esperar(80, 160);
    }

    await esperar(300, 600);

    while (true) {
      const subido = await page.evaluate(() => {
        const antes = window.scrollY;
        window.scrollBy(0, -800);
        return window.scrollY < antes;
      });
      if (!subido) break;
      await esperar(80, 160);
    }
  } catch {}
};

const aceptarCookies = async (page) => {
  try {
    await page.waitForSelector('#didomi-notice-disagree-button', { timeout: 8000 });
    await page.click('#didomi-notice-disagree-button');
    await esperar(1000, 2000);
  } catch {}
};

const siguientePagina = async (page) => {
  const exito = await page.evaluate(() => {
    const li = [...document.querySelectorAll('nav ul li')]
      .find(li => li.querySelector('a[aria-label="Ir a la siguiente página"]'));
    const a = li?.querySelector('a');
    if (!a) return false;
    a.scrollIntoView({ behavior: 'smooth', block: 'center' });
    a.click();
    return true;
  });

  if (exito) await esperar(2000, 3000);
  return exito;
};

// ===================== MAIN =====================

puppeteer.use(StealthPlugin());

const BASE_URL =
  'https://www.fotocasa.es/es/alquiler/viviendas/espana/todas-las-zonas/l/1';

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

const [page] = await browser.pages();

await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 60000 });
await aceptarCookies(page);

while (true) {
  await scrollRapidoAbajoYArriba(page);
  await scrollHumano(page);
  await esperar(2000, 4000);

  const anuncios = await obtenerAnuncios(page);
  console.log(`📦 Total acumulados: ${anuncios.length}`);

  await mergeAnuncios(anuncios);

  const pendientes = anuncios.filter(a => a.importado !== true);
  if (pendientes.length > 0) {
    await volcarEnPostgres(pendientes);
    marcarImportados(pendientes.map(a => a.id));
  }

  const ok = await siguientePagina(page);
  if (!ok) break;
}

await browser.close();
