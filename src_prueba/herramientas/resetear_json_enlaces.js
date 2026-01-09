import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 🔧 Ruta a tu JSON
const ruta = path.join(__dirname, '../data/enlaces/anuncios-fotocasa.json');

// 🧪 Comprobación básica
if (!fs.existsSync(ruta)) {
  console.error('❌ No existe el archivo anuncios-fotocasa.json');
  process.exit(1);
}

// 📥 Leer JSON
const anuncios = JSON.parse(fs.readFileSync(ruta, 'utf-8'));

// 🔄 Resetear flags
for (const a of anuncios) {
  a.estado = false;
  a.importado = false;

  // opcional: limpiar timestamps relacionados
  delete a.importado_at;
  delete a.visitado;
}

// 💾 Guardar cambios
fs.writeFileSync(ruta, JSON.stringify(anuncios, null, 2), 'utf-8');

console.log(`✅ Reset completado: ${anuncios.length} anuncios actualizados`);
