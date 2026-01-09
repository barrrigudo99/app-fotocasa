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

// ruta al archivo JSON
const RUTA_JSON = path.join(
  __dirname,
  '../data/enlaces/anuncios-fotocasa.json'
);

// ===================== MAIN =====================

async function importarEnlaces() {
  if (!fs.existsSync(RUTA_JSON)) {
    throw new Error(`❌ No existe el archivo: ${RUTA_JSON}`);
  }

  const enlaces = JSON.parse(fs.readFileSync(RUTA_JSON, 'utf-8'));

  if (!Array.isArray(enlaces)) {
    throw new Error('❌ El JSON no es un array');
  }

  const pool = new Pool(DB_CONFIG);

  let insertados = 0;

  for (const e of enlaces) {
    await pool.query(
      `
      INSERT INTO raw.enlaces (
        id,
        url,
        portal,
        estado,
        timestamp,
        visitado
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (id) DO NOTHING
      `,
      [
        e.id,
        e.url,
        PORTAL,
        e.estado ?? null,
        e.timestamp ?? new Date().toISOString(),
        e.visitado ?? null
      ]
    );

    insertados++;
  }

  await pool.end();

  console.log(`✅ Enlaces procesados: ${insertados}`);
}

// ===================== RUN =====================

importarEnlaces()
  .then(() => console.log('🚀 Importación finalizada'))
  .catch(err => console.error(err.message));
