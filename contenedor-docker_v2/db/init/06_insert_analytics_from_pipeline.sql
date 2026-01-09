-- =====================================================
-- PIPELINE → ANALYTICS (AUTO)
-- Trigger: pipeline.core → analytics.*
--
-- ✔ Modelo con DOS IDs (id técnico + piso_id)
-- ✔ Inserta dimensiones solo si hay valor
-- ✔ Evita duplicados con (piso_id, date_id)
-- ✔ No rompe el pipeline ni analytics
-- =====================================================

-- =====================================================
-- FUNCIÓN
-- =====================================================

CREATE OR REPLACE FUNCTION analytics.insert_from_pipeline_core()
RETURNS TRIGGER AS $$
DECLARE
  municipio_id     INTEGER;
  operacion_id     INTEGER;
  portal_id        INTEGER;
  tipo_inmueble_id INTEGER;
BEGIN
  -- =========================
  -- 1) CALENDAR
  -- =========================
  INSERT INTO analytics.calendar (date, year, month, day, week)
  VALUES (
    DATE(NEW.timestamp_origen),
    EXTRACT(YEAR  FROM NEW.timestamp_origen),
    EXTRACT(MONTH FROM NEW.timestamp_origen),
    EXTRACT(DAY   FROM NEW.timestamp_origen),
    EXTRACT(WEEK  FROM NEW.timestamp_origen)
  )
  ON CONFLICT (date) DO NOTHING;

  -- =========================
  -- 2) PORTAL
  -- =========================
  IF NEW.portal IS NOT NULL THEN
    INSERT INTO analytics.portal (nombre)
    VALUES (NEW.portal)
    ON CONFLICT (nombre) DO NOTHING;

    SELECT id INTO portal_id
    FROM analytics.portal
    WHERE nombre = NEW.portal;
  END IF;

  -- =========================
  -- 3) OPERACION
  -- =========================
  IF NEW.operacion IS NOT NULL THEN
    INSERT INTO analytics.operacion (nombre)
    VALUES (NEW.operacion)
    ON CONFLICT (nombre) DO NOTHING;

    SELECT id INTO operacion_id
    FROM analytics.operacion
    WHERE nombre = NEW.operacion;
  END IF;

  -- =========================
  -- 4) TIPO INMUEBLE
  -- =========================
  IF NEW.tipo_inmueble IS NOT NULL THEN
    INSERT INTO analytics.tipo_inmueble (nombre)
    VALUES (NEW.tipo_inmueble)
    ON CONFLICT (nombre) DO NOTHING;

    SELECT id INTO tipo_inmueble_id
    FROM analytics.tipo_inmueble
    WHERE nombre = NEW.tipo_inmueble;
  END IF;

  -- =========================
  -- 5) MUNICIPIO
  -- =========================
  IF NEW.municipio IS NOT NULL THEN
    INSERT INTO analytics.municipio (nombre, lat, lon)
    VALUES (NEW.municipio, NEW.lat, NEW.lon)
    ON CONFLICT (nombre) DO NOTHING;

    SELECT id INTO municipio_id
    FROM analytics.municipio
    WHERE nombre = NEW.municipio;
  END IF;

  -- =========================
  -- 6) FACT TABLE (SNAPSHOT)
  -- =========================
  INSERT INTO analytics.listing_snapshot (
    piso_id,
    date_id,
    municipio_id,
    operacion_id,
    portal_id,
    tipo_inmueble_id,
    precio,
    metros,
    habitaciones,
    banos,
    precio_m2
  )
  VALUES (
    NEW.id,                              -- piso_id (ID real)
    DATE(NEW.timestamp_origen),          -- snapshot date
    municipio_id,
    operacion_id,
    portal_id,
    tipo_inmueble_id,
    NEW.precio,
    NEW.metros,
    NEW.habitaciones,
    NEW.banos,
    CASE
      WHEN NEW.precio IS NOT NULL AND NEW.metros > 0
        THEN NEW.precio::NUMERIC / NEW.metros
      ELSE NULL
    END
  )
  ON CONFLICT (piso_id, date_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- TRIGGER
-- =====================================================

DROP TRIGGER IF EXISTS trg_pipeline_core_to_analytics
ON pipeline.core;

CREATE TRIGGER trg_pipeline_core_to_analytics
AFTER INSERT ON pipeline.core
FOR EACH ROW
EXECUTE FUNCTION analytics.insert_from_pipeline_core();
