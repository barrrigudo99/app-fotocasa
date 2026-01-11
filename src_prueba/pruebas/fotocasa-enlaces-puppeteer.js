// fotocasa-enlaces-a-archivo.js
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import fs from "fs";
import path from "path";

puppeteer.use(StealthPlugin());

const URL =
  "https://www.fotocasa.es/es/alquiler/viviendas/espana/todas-las-zonas/l";

// ===== util: URL → nombre de archivo seguro =====
function filenameFromUrl(url) {
  return url
    .replace(/^https?:\/\//, "")
    .replace(/[^a-zA-Z0-9-_]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .toLowerCase() + ".json";
}

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    args: ["--start-maximized"],
  });

  const page = await browser.newPage();
  await page.goto(URL, { waitUntil: "domcontentloaded" });

  await page.waitForSelector("#main-content article h3 a", {
    timeout: 15000,
  });

  // === extracción en la página ===
  const result = await page.evaluate(async () => {
    const LINK_SELECTOR = "#main-content article h3 a";
    const container =
      document.scrollingElement || document.documentElement;

    const seen = new Set();

    function collect() {
      document.querySelectorAll(LINK_SELECTOR).forEach(a => {
        if (a.href) seen.add(a.href);
      });
    }

    const STEP = window.innerHeight * 0.9;

    while (container.scrollTop + window.innerHeight < container.scrollHeight) {
      collect();
      container.scrollTop += STEP;
      await new Promise(r => setTimeout(r, 80));
    }

    collect();

    const enlaces = [...seen];

    return {
      url_origen: window.location.href,
      total: enlaces.length,
      enlaces,
      timestamp: new Date().toISOString(),
    };
  });

  // === guardado a archivo ===
  const dir = path.resolve("enlaces");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const filename = filenameFromUrl(URL);
  const filepath = path.join(dir, filename);

  fs.writeFileSync(filepath, JSON.stringify(result, null, 2), "utf-8");

  console.log(`✅ Guardado: ${filepath}`);
  console.log(`📦 Total enlaces: ${result.total}`);

  // ❌ no cierro navegador por defecto
  // await browser.close();
})();
