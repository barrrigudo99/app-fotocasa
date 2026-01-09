-- =========================
-- PIPELINE: core
-- =========================
CREATE TABLE IF NOT EXISTS pipeline.core (
  id                TEXT PRIMARY KEY,
  portal            TEXT,
  operacion         TEXT,
  url               TEXT,
  precio            INTEGER,
  metros            INTEGER,
  habitaciones      INTEGER,
  banos             INTEGER,
  tipo_inmueble     TEXT,
  estado            TEXT,
  estado_score      INTEGER,
  orientacion       TEXT,
  planta            TEXT,
  municipio         TEXT,
  lat               DOUBLE PRECISION,
  lon               DOUBLE PRECISION,
  geo_confidence    NUMERIC,
  timestamp_origen  TIMESTAMP,
  inserted_at       TIMESTAMP DEFAULT now()
);

-- =========================
-- PIPELINE: extras
-- =========================
CREATE TABLE IF NOT EXISTS pipeline.extras (
  id        SERIAL PRIMARY KEY,
  piso_id   TEXT REFERENCES pipeline.core(id),
  extra     TEXT
);

-- =========================
-- PIPELINE: features
-- =========================
CREATE TABLE IF NOT EXISTS pipeline.features (
  id        SERIAL PRIMARY KEY,
  piso_id   TEXT REFERENCES pipeline.core(id),
  feature   TEXT,
  value     TEXT
);

-- =========================
-- PIPELINE: texto
-- =========================
CREATE TABLE IF NOT EXISTS pipeline.texto (
  piso_id          TEXT PRIMARY KEY REFERENCES pipeline.core(id),
  titulo           TEXT,
  descripcion      TEXT,
  ubicacion        TEXT,
  ubicacion_clean  TEXT,
  inserted_at      TIMESTAMP DEFAULT now()
);
