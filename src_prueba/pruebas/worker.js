// worker.js
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import fs from "fs";
import path from "path";

puppeteer.use(StealthPlugin());

// ===== util =====
function filenameFromUrl(url) {
  return url
    .replace(/^https?:\/\//, "")
    .replace(/[^a-zA-Z0-9-_]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .toLowerCase() + ".json";
}

function buildEnlace(url) {
  const id = url.split("/").slice(-2).join("/");

  return {
    id,
    url,
    estado: false,
    importado: false,
    timestamp: new Date().toISOString(),
    importado_at: null,
    visitado: null
  };
}

async function scrapeUrl(url) {
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    args: ["--start-maximized"],
  });

  const page = await browser.newPage();
  await page.goto(url, { waitUntil: "domcontentloaded" });

  await page.waitForSelector("#main-content article h3 a", {
    timeout: 15000,
  });

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

    return [...seen];
  });

  const enlaces = result.map(buildEnlace);

  const payload = {
    url_origen: url,
    total: enlaces.length,
    enlaces,
    timestamp: new Date().toISOString()
  };

  const dir = path.resolve("enlaces");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const filename = filenameFromUrl(url);
  const filepath = path.join(dir, filename);

  fs.writeFileSync(filepath, JSON.stringify(payload, null, 2), "utf-8");

  console.log(`✅ ${url} → ${enlaces.length} enlaces guardados`);

  await browser.close();
}

// ==== ejecución directa ====
const url = process.argv[2];
if (!url) {
  console.error("❌ Falta URL");
  process.exit(1);
}

scrapeUrl(url).catch(err => {
  console.error("❌ Error:", err.message);
  process.exit(1);
});
