// scraper-fotocasa.js
// CONSUMIDOR: extrae detalles desde enlaces en raw.enlaces
// Modelo productor–consumidor con PostgreSQL (operación atómica)

import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import UserAgent from 'user-agents';
import pkg from 'pg';

const { Pool } = pkg;

puppeteer.use(StealthPlugin());

// ===================== DB =====================

const pool = new Pool({
  host: 'localhost',
  port: 5433,
  user: 'admin',
  password: 'admin123',
  database: 'inmuebles',
});

// ===================== UTILIDADES =====================

const esperar = (min, max) =>
  new Promise(r =>
    setTimeout(
      r,
      Math.floor(Math.random() * (max - min + 1)) + min
    )
  );

// ===================== COLA ATÓMICA =====================

async function getNextLink() {
  const { rows } = await pool.query(`
    WITH job AS (
      SELECT id, url
      FROM raw.enlaces
      WHERE estado IS NULL
      ORDER BY timestamp
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    UPDATE raw.enlaces
    SET estado = FALSE,
        visitado = now()
    FROM job
    WHERE raw.enlaces.id = job.id
    RETURNING job.id, job.url;
  `);

  return rows[0] || null;
}

// ===================== PERSISTENCIA =====================

async function volcarDetalleRaw(detalle) {
  await pool.query(
    `
    INSERT INTO raw.detalles (
      id,
      url,
      portal,
      data,
      timestamp
    )
    VALUES ($1, $2, $3, $4::jsonb, $5)
    ON CONFLICT (id) DO NOTHING
    `,
    [
      detalle.id,
      detalle.url,
      'fotocasa',
      JSON.stringify(detalle),
      detalle.timestamp
    ]
  );
}

// ===================== SCRAPING =====================

async function scrollHumano(page) {
  const veces = Math.floor(Math.random() * 2) + 2;
  for (let i = 0; i < veces; i++) {
    await page.mouse.wheel({ deltaY: 300 + Math.random() * 300 });
    await esperar(400, 900);
  }
}

async function extraerDetalle(browser, url) {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();

  await page.setUserAgent(new UserAgent().random().toString());
  await page.setViewport({
    width: 1200 + Math.floor(Math.random() * 200),
    height: 800 + Math.floor(Math.random() * 200)
  });

  await page.setExtraHTTPHeaders({
    'accept-language': 'es-ES,es;q=0.9'
  });

  let ok = false;
  for (let intento = 0; intento < 4; intento++) {
    try {
      const resp = await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });
      if (resp?.status() === 429) throw new Error('429');
      ok = true;
      break;
    } catch {
      const backoff = Math.pow(2, intento) * 1500;
      console.log(`⏳ Backoff ${backoff} ms`);
      await esperar(backoff, backoff + 1000);
    }
  }

  if (!ok) {
    await page.close();
    await context.close();
    throw new Error('No se pudo cargar la página');
  }

  await scrollHumano(page);
  await esperar(1200, 2500);

  try {
    await page.waitForSelector('#didomi-notice-disagree-button', { timeout: 4000 });
    await page.click('#didomi-notice-disagree-button');
    await esperar(600, 1200);
  } catch {}

  await scrollHumano(page);
  await esperar(1200, 2500);

  // ===================== EXTRACCIÓN COMPLETA =====================

  const detalle = await page.evaluate(() => {
    const textoNumero = t =>
      t ? parseInt(t.replace(/\D/g, ''), 10) : null;

    const getText = sel =>
      document.querySelector(sel)?.innerText.trim() ?? null;

    const url = location.href;
    const id = url.split('/').slice(-2).join('/');

    const section = document.querySelector(
      '#main-content > section:nth-child(2) > div'
    );

    let featuresBlock = null;

    if (section) {
      const title = section.querySelector('h2')?.innerText.trim() ?? null;
      const list = section.querySelector('[data-testid="featuresList"]');

      const features = list
        ? [...list.querySelectorAll('.re-DetailFeaturesList-feature')]
            .map(item => {
              const label =
                item.querySelector('.re-DetailFeaturesList-featureLabel')
                  ?.innerText.trim() ?? null;
              const value =
                item.querySelector('.re-DetailFeaturesList-featureValue')
                  ?.innerText.trim() ?? null;
              if (!label || !value) return null;
              return { label, value };
            })
            .filter(Boolean)
        : [];

      featuresBlock = { title, features };
    }

    const extras = (() => {
      const ul = document.querySelector(
        '#main-content > section:nth-child(2) > div > div > div.re-DetailExtras > ul'
      );
      if (!ul) return [];
      return [...ul.querySelectorAll('li')]
        .map(li => li.innerText.trim())
        .filter(Boolean);
    })();

    const ubicacion = (() => {
      const h2s = [...document.querySelectorAll('#main-content h2')];
      for (const h2 of h2s) {
        const text = h2.innerText.trim();
        if (
          text.length > 5 &&
          !/características|descripción|precio|extras/i.test(text)
        ) {
          return text;
        }
      }
      return null;
    })();

    return {
      id,
      url,
      precio: textoNumero(getText('.re-DetailHeader-price')),
      titulo: getText('.re-DetailHeader-propertyTitle'),
      municipio: getText('.re-DetailHeader-municipalityTitle'),
      descripcion: getText('.re-DetailDescription'),
      habitaciones: textoNumero(
        getText('.re-DetailHeader-rooms span:nth-child(2)')
      ),
      banos: textoNumero(
        getText('.re-DetailHeader-bathrooms span:nth-child(2)')
      ),
      metros: textoNumero(
        getText('.re-DetailHeader-surface span:nth-child(2)')
      ),
      planta: getText(
        '.re-DetailHeader-featuresItem.floor span:nth-child(2)'
      ),
      featuresBlock,
      extras,
      ubicacion,
      timestamp: new Date().toISOString()
    };
  });

  await page.close();
  await context.close();

  return detalle;
}

// ===================== MAIN WORKER =====================

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled'
    ]
  });

  console.log('🚀 Extractor de detalles iniciado');

  while (true) {
    const job = await getNextLink();

    if (!job) {
      await esperar(2000, 3000);
      continue;
    }

    console.log(`➡️ Procesando ${job.url}`);

    try {
      const detalle = await extraerDetalle(browser, job.url);
      await volcarDetalleRaw(detalle);
      console.log(`🗄️ Detalle guardado: ${job.id}`);
      // el trigger marca estado = TRUE
    } catch (e) {
      console.error(`❌ Error en ${job.id}:`, e.message);
      await pool.query(
        `UPDATE raw.enlaces SET estado = NULL, visitado = NULL WHERE id = $1`,
        [job.id]
      );
    }

    await esperar(4000, 8000);
  }
})();
