// fotocasa-render-sin-scroll.js
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";

puppeteer.use(StealthPlugin());

const URL =
  "https://www.fotocasa.es/es/alquiler/viviendas/espana/todas-las-zonas/l";

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    args: ["--start-maximized"],
  });

  const page = await browser.newPage();

  // 1️⃣ Viewport artificialmente alto
  await page.setViewport({
    width: 1920,
    height: 9000, // clave: fuerza render sin scroll
  });

  await page.goto(URL, { waitUntil: "domcontentloaded" });

  // 2️⃣ Función para imprimir URLs (sin números)
  await page.exposeFunction("onListingsRendered", (urls) => {
    urls.forEach((u) => console.log(u));
    console.log(""); // separación visual
  });

  // 3️⃣ MutationObserver dentro de la página
  await page.evaluate(() => {
    const LINK_SELECTOR = "#main-content article h3 a";

    let lastSignature = "";

    function getVisibleUrls() {
      const viewportH =
        window.innerHeight || document.documentElement.clientHeight;

      return Array.from(document.querySelectorAll(LINK_SELECTOR))
        .filter((a) => {
          const r = a.getBoundingClientRect();
          return r.height > 0 && r.top < viewportH && r.bottom > 0;
        })
        .map((a) => a.href)
        .filter(Boolean);
    }

    function signature(urls) {
      return urls.slice(0, 20).join("|");
    }

    const target =
      document.querySelector("#main-content") || document.body;

    const observer = new MutationObserver(() => {
      const urls = getVisibleUrls();
      if (!urls.length) return;

      const sig = signature(urls);
      if (sig === lastSignature) return;

      lastSignature = sig;

      // @ts-ignore
      window.onListingsRendered(urls);
    });

    observer.observe(target, {
      childList: true,
      subtree: true,
    });
  });

  console.log(
    "✅ Página cargada.\n" +
    "📐 Viewport alto activo.\n" +
    "🧠 React renderizará anuncios sin necesidad de scroll.\n"
  );
})();
