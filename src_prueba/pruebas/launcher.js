// launcher.js
import { spawn } from "child_process";

const BASE_URL =
  "https://www.fotocasa.es/es/alquiler/viviendas/espana/todas-las-zonas/l";

const MAX_PAGE = Number(process.argv[2]) || 1670;
const MAX_CONCURRENCY = Number(process.argv[3]) || 5;

const URLS = [];

URLS.push(BASE_URL);
for (let page = 2; page <= MAX_PAGE; page++) {
  URLS.push(`${BASE_URL}/${page}`);
}

let running = 0;
let index = 0;

function launchNext() {
  if (index >= URLS.length) return;
  if (running >= MAX_CONCURRENCY) return;

  const url = URLS[index++];
  running++;

  console.log(`🚀 Worker (${running}/${MAX_CONCURRENCY}) → ${url}`);

  const child = spawn("node", ["worker.js", url], {
    stdio: "inherit",
  });

  child.on("exit", code => {
    running--;
    if (code !== 0) {
      console.error(`⚠️ Worker falló (${code}) → ${url}`);
    }
    launchNext();

    if (running === 0 && index >= URLS.length) {
      console.log("✅ Todas las URLs procesadas");
    }
  });

  child.on("error", err => {
    console.error(`❌ Error lanzando worker → ${url}`, err);
  });

  launchNext();
}

launchNext();
