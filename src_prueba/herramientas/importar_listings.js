import pkg from 'pg';
const { Pool } = pkg;

// ===============================
// CONEXIONES
// ===============================

// ORIGEN: inmobiliaria
const sourcePool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'inmobiliaria',
  user: 'admin',
  password: 'admin123'
});

// DESTINO: prueba2
const targetPool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'prueba2',
  user: 'admin',
  password: 'admin123'
});

// ===============================
// FUNCIÓN PRINCIPAL
// ===============================
async function copiarDatos() {
  try {
    // =====================================================
    // 1) COPIAR MUNICIPIOS (CON CONVERSIÓN DE confidence)
    // =====================================================
    console.log('📥 Copiando municipios...');

    const { rows: municipios } = await sourcePool.query(`
      SELECT id, nombre, lat, lon, confidence
      FROM pipeline.municipio
    `);

    const insertMunicipio = `
        INTO pipeline.municipio (id, nombre, lat, lon, confidence)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (id) DO NOTHING
    `;

    for (const m of municipios) {
      await targetPool.query(insertMunicipio, [
        m.id,
        m.nombre,
        m.lat !== null ? Number(m.lat) : null,
        m.lon !== null ? Number(m.lon) : null,
        m.confidence !== null ? Math.round(Number(m.confidence)) : null
      ]);
    }

    console.log(`✅ Municipios copiados: ${municipios.length}`);

    // =====================================================
    // 2) COPIAR DETALLE_PISO
    // =====================================================
    console.log('📥 Copiando detalle_piso...');

    const { rows: pisos } = await sourcePool.query(`
      SELECT
        id,
        operacion,
        url,
        precio,
        metros,
        habitaciones,
        banos,
        tipo_inmueble,
        estado,
        estado_score,
        orientacion,
        planta,
        titulo,
        descripcion,
        municipio_id,
        ubicacion,
        lat,
        lon,
        geo_confidence,
        timestamp_origen,
        inserted_at
      FROM pipeline.detalle_piso
    `);

    console.log(`📦 Pisos leídos: ${pisos.length}`);

    const insertDetalle = `
      INSERT INTO pipeline.detalle_piso (
        id,
        operacion,
        url,
        precio,
        metros,
        habitaciones,
        banos,
        tipo_inmueble,
        estado,
        estado_score,
        orientacion,
        planta,
        titulo,
        descripcion,
        municipio_id,
        ubicacion,
        lat,
        lon,
        geo_confidence,
        timestamp_origen,
        inserted_at
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
        $11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21
      )
      ON CONFLICT (id) DO NOTHING
    `;

    for (const r of pisos) {
      await targetPool.query(insertDetalle, [
        r.id,
        r.operacion,
        r.url,
        r.precio !== null ? Number(r.precio) : null,
        r.metros !== null ? Number(r.metros) : null,
        r.habitaciones !== null ? Number(r.habitaciones) : null,
        r.banos !== null ? Number(r.banos) : null,
        r.tipo_inmueble,
        r.estado,
        r.estado_score !== null ? Number(r.estado_score) : null,
        r.orientacion,
        r.planta,
        r.titulo,
        r.descripcion,
        r.municipio_id !== null ? Number(r.municipio_id) : null,
        r.ubicacion,
        r.lat !== null ? Number(r.lat) : null,
        r.lon !== null ? Number(r.lon) : null,
        r.geo_confidence !== null ? Math.round(Number(r.geo_confidence)) : null,
        r.timestamp_origen,
        r.inserted_at
      ]);
    }

    console.log('✅ detalle_piso copiado correctamente');

  } catch (err) {
    console.error('❌ Error copiando datos:', err);
  } finally {
    await sourcePool.end();
    await targetPool.end();
  }
}

// ===============================
// EJECUCIÓN
// ===============================
copiarDatos();
