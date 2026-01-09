-- ============================================================
-- ANALYTICS SCHEMA
-- Modelo estrella para análisis (EDA)
-- ============================================================

CREATE SCHEMA IF NOT EXISTS analytics;

-- =========================
-- DIMENSION: CALENDAR
-- =========================
CREATE TABLE IF NOT EXISTS analytics.calendar (
  date    DATE PRIMARY KEY,
  year    INTEGER,
  month   INTEGER,
  day     INTEGER,
  week    INTEGER
);

-- =========================
-- DIMENSION: MUNICIPIO
-- =========================
CREATE TABLE IF NOT EXISTS analytics.municipio (
  id        SERIAL PRIMARY KEY,
  nombre    TEXT UNIQUE NOT NULL,
  provincia TEXT,
  ccaa      TEXT,
  lat       DOUBLE PRECISION,
  lon       DOUBLE PRECISION
);

-- =========================
-- DIMENSION: OPERACION
-- =========================
CREATE TABLE IF NOT EXISTS analytics.operacion (
  id      SERIAL PRIMARY KEY,
  nombre  TEXT UNIQUE NOT NULL
);

-- =========================
-- DIMENSION: PORTAL
-- =========================
CREATE TABLE IF NOT EXISTS analytics.portal (
  id      SERIAL PRIMARY KEY,
  nombre  TEXT UNIQUE NOT NULL
);

-- =========================
-- DIMENSION: TIPO INMUEBLE
-- =========================
CREATE TABLE IF NOT EXISTS analytics.tipo_inmueble (
  id      SERIAL PRIMARY KEY,
  nombre  TEXT UNIQUE NOT NULL
);

-- =========================
-- FACT TABLE: LISTING SNAPSHOT
-- =========================
-- ✔ id         → ID técnico del snapshot (histórico)
-- ✔ piso_id   → ID real del anuncio (pipeline.core.id)
-- ✔ Permite múltiples snapshots por piso y fecha
-- =========================
CREATE TABLE IF NOT EXISTS analytics.listing_snapshot (
  id               BIGSERIAL PRIMARY KEY,      -- ID técnico del snapshot
  piso_id          TEXT,                       -- ID real del anuncio

  date_id          DATE REFERENCES analytics.calendar(date),
  municipio_id     INTEGER REFERENCES analytics.municipio(id),
  operacion_id     INTEGER REFERENCES analytics.operacion(id),
  portal_id        INTEGER REFERENCES analytics.portal(id),
  tipo_inmueble_id INTEGER REFERENCES analytics.tipo_inmueble(id),

  precio           INTEGER,
  metros           INTEGER,
  habitaciones     INTEGER,
  banos            INTEGER,
  precio_m2        NUMERIC
);


CREATE VIEW analytics.listing_enriched AS
SELECT
  f.piso_id AS id,
  s.precio,
  s.metros,
  COALESCE(
    jsonb_object_agg(f.feature, f.value)
      FILTER (WHERE f.feature IS NOT NULL),
    '{}'::jsonb
  ) AS features,
  COALESCE(
    jsonb_agg(e.extra)
      FILTER (WHERE e.extra IS NOT NULL),
    '[]'::jsonb
  ) AS extras
FROM analytics.listing_snapshot s
LEFT JOIN pipeline.features f ON f.piso_id = s.piso_id
LEFT JOIN pipeline.extras   e ON e.piso_id = s.piso_id
GROUP BY f.piso_id, s.precio, s.metros;


-- =========================
-- CONSTRAINTS LÓGICOS
-- =========================
-- Evita duplicar snapshots del mismo piso en el mismo día
CREATE UNIQUE INDEX IF NOT EXISTS uq_listing_snapshot_piso_fecha
ON analytics.listing_snapshot (piso_id, date_id);

-- =========================
-- INDEXES
-- =========================

-- Mejora JOINs con pipeline.core
CREATE INDEX IF NOT EXISTS idx_listing_snapshot_piso_id
ON analytics.listing_snapshot(piso_id);

-- Mejora análisis por municipio
CREATE INDEX IF NOT EXISTS idx_listing_snapshot_municipio
ON analytics.listing_snapshot(municipio_id);

-- Mejora análisis temporal
CREATE INDEX IF NOT EXISTS idx_listing_snapshot_date
ON analytics.listing_snapshot(date_id);
