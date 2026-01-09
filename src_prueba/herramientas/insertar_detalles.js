import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pkg from 'pg';

const { Pool } = pkg;

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

// ⬅️ ajusta esta ruta si el archivo está en otro sitio
const RUTA_JSON = path.join(
  __dirname,
  '../data/pisos/detalles-fotocasa.json'
);

// ===================== MAIN =====================

async function importarDetalles() {
  if (!fs.existsSync(RUTA_JSON)) {
    throw new Error(`❌ No existe el archivo: ${RUTA_JSON}`);
  }

  const detalles = JSON.parse(fs.readFileSync(RUTA_JSON, 'utf-8'));

  if (!Array.isArray(detalles)) {
    throw new Error('❌ El JSON no es un array');
  }

  const pool = new Pool(DB_CONFIG);

  let procesados = 0;

  for (const d of detalles) {
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
        d.id,
        d.url,
        PORTAL,
        JSON.stringify(d),                // 🔥 JSON COMPLETO
        d.timestamp ?? new Date().toISOString()
      ]
    );

    procesados++;
  }

  await pool.end();

  console.log(`✅ Detalles procesados: ${procesados}`);
}

// ===================== RUN =====================

importarDetalles()
  .then(() => console.log('🚀 Importación de detalles finalizada'))
  .catch(err => console.error(err.message));
