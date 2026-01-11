// observar-endpoint-fotocasa.js
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";

puppeteer.use(StealthPlugin());

const URL =
  "https://www.fotocasa.es/es/alquiler/viviendas/espana/todas-las-zonas/l";

const WINDOW_MS = 2000;

// Filtro temprano de basura (tracking/ads/ruido)
function isNoise(url) {
  const u = url.toLowerCase();
  return (
    u.includes("braze") ||
    u.includes("doubleclick") ||
    u.includes("googletagmanager") ||
    u.includes("google-analytics") ||
    u.includes("analytics") ||
    u.includes("collect") ||
    u.includes("ads") ||
    u.includes("adservice") ||
    u.includes("facebook") ||
    u.includes("segment") ||
    u.includes("optimizely") ||
    u.includes("hotjar") ||
    u.includes("sentry") ||
    u.includes("datadog") ||
    u.includes("newrelic") ||
    u.includes("amazon-adsystem") ||
    u.includes("criteo") ||
    u.includes("taboola") ||
    u.includes("outbrain")
  );
}

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    args: ["--start-maximized"],
  });

  const page = await browser.newPage();

  // Buffer de requests recientes (solo xhr/fetch)
  const recentRequests = [];

  function prune() {
    const cutoff = Date.now() - WINDOW_MS;
    while (recentRequests.length && recentRequests[0].ts < cutoff) {
      recentRequests.shift();
    }
  }

  page.on("requestfinished", async (req) => {
    const type = req.resourceType();
    if (type !== "xhr" && type !== "fetch") return;

    const url = req.url();
    if (isNoise(url)) return;

    recentRequests.push({
      ts: Date.now(),
      method: req.method(),
      url,
    });
    prune();
  });

  page.on("request", (req) => {
    const type = req.resourceType();
    if (type !== "xhr" && type !== "fetch") return;

    const url = req.url().toLowerCase();
    if (
      url.includes("analytics") ||
      url.includes("braze") ||
      url.includes("ads") ||
      url.includes("collect")
    ) return;

    console.log(req.method(), req.url());
  });

    

  // Captura también fallos de xhr/fetch (por si el endpoint falla)
  page.on("requestfailed", (req) => {
    const type = req.resourceType();
    if (type !== "xhr" && type !== "fetch") return;

    const url = req.url();
    if (isNoise(url)) return;

    recentRequests.push({
      ts: Date.now(),
      method: req.method(),
      url: url + "  [FAILED]",
    });
    prune();
  });

  // Función expuesta: cuando hay nuevos anuncios, imprime URLs visibles + requests recientes
  await page.exposeFunction("onNewListings", async (visibleUrls) => {
    // 1) URLs visibles (solo enlaces)
    for (const u of visibleUrls) console.log(u);

    // 2) Requests recientes correlacionadas
    prune();
    if (recentRequests.length) {
      console.log("---- requests recientes (xhr/fetch) ----");
      for (const r of recentRequests) console.log(`${r.method} ${r.url}`);
      console.log("----------------------------------------\n");
    } else {
      console.log("---- requests recientes (xhr/fetch) ----");
      console.log("(ninguna en la ventana)");
      console.log("----------------------------------------\n");
    }
  });

  await page.goto(URL, { waitUntil: "domcontentloaded" });

  // Inyecta MutationObserver para detectar nuevos <article> y extraer URLs visibles
  await page.evaluate(() => {
    // Selector de negocio (tu fuente de verdad)
    const LINK_SEL = "#main-content article h3 a";

    // Para evitar disparos repetidos por la misma tanda
    let lastSig = "";

    function getVisibleListingUrls() {
      const anchors = Array.from(document.querySelectorAll(LINK_SEL));
      const visible = anchors
        .filter((a) => {
          const r = a.getBoundingClientRect();
          return (
            r.width > 0 &&
            r.height > 0 &&
            r.bottom > 0 &&
            r.top < (window.innerHeight || document.documentElement.clientHeight)
          );
        })
        .map((a) => a.href)
        .filter(Boolean);

      // Dedup manteniendo orden
      return Array.from(new Set(visible));
    }

    function signature(urls) {
      // firma simple para no repetir mismo batch
      return urls.slice(0, 15).join("|");
    }

    const target = document.querySelector("#main-content") || document.body;

    const obs = new MutationObserver(() => {
      const urls = getVisibleListingUrls();
      const sig = signature(urls);

      if (!urls.length) return;
      if (sig === lastSig) return;

      lastSig = sig;

      // Llama a Node con SOLO las URLs visibles
      // @ts-ignore
      window.onNewListings(urls);
    });

    obs.observe(target, { childList: true, subtree: true });
  });

  // No imprime contadores, solo instrucción mínima
  console.log("👇 Haz scroll MANUALMENTE. Cuando aparezcan nuevos anuncios, se imprimirán URLs visibles y los xhr/fetch recientes.\n");
})();
