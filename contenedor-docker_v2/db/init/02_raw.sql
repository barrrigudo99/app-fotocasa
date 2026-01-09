-- =========================
-- RAW: enlaces
-- =========================
CREATE TABLE IF NOT EXISTS raw.enlaces (
  id          TEXT PRIMARY KEY,
  url         TEXT NOT NULL,
  portal      TEXT NOT NULL,
  estado      BOOLEAN,
  timestamp   TIMESTAMP,
  visitado    TIMESTAMP
);

-- =========================
-- RAW: detalles (JSON puro)
-- =========================
CREATE TABLE IF NOT EXISTS raw.detalles (
  id           TEXT PRIMARY KEY,
  url          TEXT NOT NULL,
  portal       TEXT NOT NULL,
  data         JSONB NOT NULL,
  timestamp    TIMESTAMP,
  inserted_at  TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS raw.duplicados (
  id          TEXT PRIMARY KEY,
  url         TEXT,
  count       INTEGER NOT NULL DEFAULT 1,
  first_seen  TIMESTAMP NOT NULL,
  last_seen   TIMESTAMP NOT NULL
);

CREATE OR REPLACE FUNCTION raw.marcar_enlace_procesado()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE raw.enlaces
  SET
    estado = true,
    visitado = NOW()
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_marcar_enlace_procesado
AFTER INSERT ON raw.detalles
FOR EACH ROW
EXECUTE FUNCTION raw.marcar_enlace_procesado();
