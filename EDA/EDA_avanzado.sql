-- ============================================================
-- EDA.sql
-- Exploratory Data Analysis (EDA) en SQL
-- Proyecto: Mercado de alquiler (Fotocasa)
-- Esquema: analytics
--
-- Cumple rúbrica:
-- ✔ JOINs (INNER + LEFT)
-- ✔ Agregaciones (COUNT, AVG, MIN, MAX)
-- ✔ Funciones de fecha
-- ✔ CASE
-- ✔ Subqueries
-- ✔ CTEs encadenadas
-- ✔ Window functions (OVER PARTITION BY)
-- ✔ VIEW
-- ✔ FUNCIÓN SQL
-- ✔ INSERT / UPDATE / DELETE (sandbox)
-- ✔ Índice justificado
-- ============================================================

BEGIN;

-- ============================================================
-- 1. Análisis básico de volumen y cobertura temporal
-- ============================================================

SELECT COUNT(*) AS total_registros
FROM analytics.listing_snapshot;

-- ============================================================
-- 2. Precio medio y €/m² por mes (JOIN + DATE_TRUNC)
-- ============================================================

SELECT
  DATE_TRUNC('month', c.date)::date AS mes,
  COUNT(*) AS num_anuncios,
  AVG(s.precio)::numeric(12,2) AS precio_medio,
  AVG(s.precio_m2)::numeric(12,2) AS precio_m2_medio
FROM analytics.listing_snapshot s
JOIN analytics.calendar c
  ON c.date = s.date_id
GROUP BY 1
ORDER BY 1;

-- Insight:
-- Permite analizar la evolución temporal del mercado de alquiler.


-- ============================================================
-- 3. JOINs múltiples + CASE: segmentación por tamaño
-- ============================================================

SELECT
  ti.nombre AS tipo_inmueble,
  CASE
    WHEN s.metros IS NULL OR s.metros = 0 THEN 'desconocido'
    WHEN s.metros < 40 THEN '<40 m2'
    WHEN s.metros BETWEEN 40 AND 69 THEN '40-69 m2'
    WHEN s.metros BETWEEN 70 AND 99 THEN '70-99 m2'
    ELSE '>=100 m2'
  END AS tramo_metros,
  COUNT(*) AS n,
  AVG(s.precio)::numeric(12,2) AS precio_medio,
  AVG(s.precio_m2)::numeric(12,2) AS precio_m2_medio
FROM analytics.listing_snapshot s
JOIN analytics.tipo_inmueble ti
  ON ti.id = s.tipo_inmueble_id
GROUP BY 1,2
HAVING COUNT(*) >= 20
ORDER BY tipo_inmueble, tramo_metros;

-- Insight:
-- Analiza cómo varía el precio según tamaño y tipo de inmueble.


-- ============================================================
-- 4. LEFT JOIN: numero de anuncios por municipio 
-- ============================================================

SELECT
  m.nombre AS municipio,
  COUNT(s.id) AS num_anuncios
FROM analytics.municipio m
LEFT JOIN analytics.listing_snapshot s
  ON s.municipio_id = m.id
GROUP BY 1
ORDER BY num_anuncios DESC;

-- Insight:
-- Detecta municipios sin datos o con baja cobertura.


-- ============================================================
-- 5. CTEs encadenadas + detección de outliers (3-sigma)
		-- pisos con un precio por m² anormalmente alto o anormalmente bajo respecto a la media del municipio.

-- ============================================================
WITH base AS (
  SELECT
    s.id,
    c.date,
    m.nombre AS municipio,
    s.precio,
    s.metros,
    s.precio_m2
  FROM analytics.listing_snapshot s
  JOIN analytics.calendar c ON c.date = s.date_id
  JOIN analytics.municipio m ON m.id = s.municipio_id
),
filtrado AS (
  SELECT *
  FROM base
  WHERE precio > 0
    AND (metros IS NULL OR metros > 0)
    AND (precio_m2 IS NULL OR precio_m2 > 0)
),
stats AS (
  SELECT
    municipio,
    COUNT(*) AS n,
    AVG(precio_m2) AS avg_precio_m2,
    STDDEV_SAMP(precio_m2) AS sd_precio_m2
  FROM filtrado
  WHERE precio_m2 IS NOT NULL
  GROUP BY municipio
)
SELECT
  f.municipio,
  COUNT(*) AS total,
  COUNT(*) FILTER (
    WHERE ABS(
      (f.precio_m2 - s.avg_precio_m2) / s.sd_precio_m2
    ) >= 3
  ) AS outliers_3sigma
FROM filtrado f
JOIN stats s
  ON s.municipio = f.municipio
 AND s.sd_precio_m2 > 0          -- 👈 CLAVE
GROUP BY f.municipio
HAVING COUNT(*) >= 50
ORDER BY outliers_3sigma DESC;

-- Insight:
-- Identifica municipios con precios atípicos (outliers).


-- ============================================================
-- 6. Window function: ranking de municipios mas costosos por m²
-- ============================================================

WITH ultimo_mes AS (
  SELECT DATE_TRUNC('month', MAX(date))::date AS mes
  FROM analytics.calendar
),
kpi AS (
  SELECT
    m.nombre AS municipio,
    AVG(s.precio_m2) AS precio_m2_medio,
    COUNT(*) AS n
  FROM analytics.listing_snapshot s
  JOIN analytics.calendar c ON c.date = s.date_id
  JOIN analytics.municipio m ON m.id = s.municipio_id
  JOIN ultimo_mes u ON DATE_TRUNC('month', c.date) = u.mes
  WHERE s.precio_m2 IS NOT NULL
  GROUP BY m.nombre
  HAVING COUNT(*) >= 20
)
SELECT
  municipio,
  precio_m2_medio::numeric(12,2),
  n,
  RANK() OVER (ORDER BY precio_m2_medio DESC) AS ranking_precio
FROM kpi
ORDER BY ranking_precio;

-- Insight:
-- Ranking de municipios más caros en el último mes.


------*************************************--------------------


-- ============================================================
-- 7. VIEW resumen: KPIs por municipio y mes
-- ============================================================

CREATE OR REPLACE VIEW analytics.vw_kpis_municipio_mes AS
SELECT
  DATE_TRUNC('month', c.date)::date AS mes,
  m.nombre AS municipio,
  COUNT(*) AS num_anuncios,
  AVG(s.precio)::numeric(12,2) AS precio_medio,
  AVG(s.precio_m2)::numeric(12,2) AS precio_m2_medio
FROM analytics.listing_snapshot s
JOIN analytics.calendar c ON c.date = s.date_id
JOIN analytics.municipio m ON m.id = s.municipio_id
GROUP BY 1,2;

-- Uso:
SELECT *
FROM analytics.vw_kpis_municipio_mes
ORDER BY mes DESC, num_anuncios DESC;



-- ============================================================
-- 8. FUNCIÓN SQL: KPIs por municipio y rango temporal
-- ============================================================

CREATE OR REPLACE FUNCTION analytics.fn_kpis_municipio(
  p_municipio TEXT,
  p_desde DATE,
  p_hasta DATE
)
RETURNS TABLE (
  municipio TEXT,
  n BIGINT,
  precio_medio NUMERIC,
  precio_m2_medio NUMERIC
)
LANGUAGE sql
AS $$
  SELECT
    m.nombre,
    COUNT(*) AS n,
    AVG(s.precio)::numeric(12,2),
    AVG(s.precio_m2)::numeric(12,2)
  FROM analytics.listing_snapshot s
  JOIN analytics.calendar c ON c.date = s.date_id
  JOIN analytics.municipio m ON m.id = s.municipio_id
  WHERE m.nombre = p_municipio
    AND c.date BETWEEN p_desde AND p_hasta
$$;

-- Ejemplo:
-- SELECT * FROM analytics.fn_kpis_municipio('Madrid', '2025-01-01', '2025-12-31');



-- ============================================================
-- 9. INSERT / UPDATE / DELETE (sandbox seguro)
-- ============================================================

CREATE TEMP TABLE eda_sandbox AS
SELECT *
FROM analytics.listing_snapshot
LIMIT 100;

INSERT INTO eda_sandbox
SELECT *
FROM eda_sandbox
LIMIT 1;

UPDATE eda_sandbox
SET precio_m2 = 100
WHERE precio_m2 > 100;

DELETE FROM eda_sandbox
WHERE precio <= 0;

SELECT COUNT(*) AS filas_sandbox FROM eda_sandbox;



-- ============================================================
-- 10. Índice recomendado para EDA
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'analytics'
      AND indexname = 'idx_listing_snapshot_date_municipio'
  ) THEN
    EXECUTE '
      CREATE INDEX idx_listing_snapshot_date_municipio
      ON analytics.listing_snapshot (date_id, municipio_id)
    ';
  END IF;
END$$;

-- Justificación:
-- Acelera análisis por rango temporal y municipio (consultas EDA típicas).

COMMIT;

-- ========================= FIN ===============================