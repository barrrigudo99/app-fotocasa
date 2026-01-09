-- ============================================================
-- EDA - Análisis Exploratorio de Datos
-- Proyecto SQL - Mercado Inmobiliario
-- Tabla de hechos: analytics.listing_snapshot
-- Dimensiones: calendar, municipio, operacion, portal, tipo_inmueble
-- ============================================================


-- ============================================================
-- 1. VOLUMEN DE DATOS
-- ¿Cuántos anuncios (snapshots) tenemos?
-- ============================================================

SELECT COUNT(*) AS total_snapshots
FROM analytics.listing_snapshot;

-- Insight:
-- Nos da una idea del tamaño del dataset y si es suficiente para análisis.


-- ============================================================
-- 2. SNAPSHOTS POR MUNICIPIO
-- JOIN + agregación
-- ============================================================

SELECT
  m.nombre AS municipio,
  COUNT(*) AS n_anuncios
FROM analytics.listing_snapshot s
JOIN analytics.municipio m ON m.id = s.municipio_id
GROUP BY m.nombre
ORDER BY n_anuncios DESC;

-- Insight:
-- Identifica municipios con mayor volumen de anuncios.
-- Útil para decidir dónde hay más actividad de mercado.


-- ============================================================
-- 3. PRECIO MEDIO Y €/m² POR MUNICIPIO
-- JOIN + AVG
-- ============================================================

SELECT
  m.nombre AS municipio,
  COUNT(*) AS n,
  AVG(s.precio)::numeric(12,2) AS precio_medio,
  AVG(s.precio_m2)::numeric(12,2) AS precio_m2_medio
FROM analytics.listing_snapshot s
JOIN analytics.municipio m ON m.id = s.municipio_id
WHERE s.precio_m2 IS NOT NULL
GROUP BY m.nombre
HAVING COUNT(*) >= 20
ORDER BY precio_m2_medio DESC;

-- Insight:
-- Permite comparar el nivel de precios entre municipios
-- evitando ruido (mínimo 20 anuncios).



-- Insight:
-- Permite analizar la evolución del mercado en el tiempo
-- (subidas o bajadas de precios).


-- ============================================================
-- 5. PRECIO MEDIO POR TIPO DE INMUEBLE
-- JOIN + agregación
-- ============================================================

SELECT
  t.nombre AS tipo_inmueble,
  COUNT(*) AS n,
  AVG(s.precio)::numeric(12,2) AS precio_medio
FROM analytics.listing_snapshot s
JOIN analytics.tipo_inmueble t ON t.id = s.tipo_inmueble_id
GROUP BY t.nombre
ORDER BY precio_medio DESC;

-- Insight:
-- Compara precios entre pisos, chalets, estudios, etc.


-- ============================================================
-- 6. CLASIFICACIÓN DE PISOS POR RANGO DE PRECIO (CASE)
-- ============================================================

SELECT
  CASE
    WHEN precio < 600 THEN 'Bajo'
    WHEN precio BETWEEN 600 AND 1000 THEN 'Medio'
    WHEN precio BETWEEN 1000 AND 1500 THEN 'Alto'
    ELSE 'Muy alto'
  END AS rango_precio,
  COUNT(*) AS n
FROM analytics.listing_snapshot
WHERE precio IS NOT NULL
GROUP BY rango_precio
ORDER BY n DESC;

-- Insight:
-- Permite segmentar el mercado por rangos de precio.


-- ============================================================
-- 7. TOP 5 MUNICIPIOS MÁS CAROS (WINDOW FUNCTION)
-- ============================================================

WITH kpi AS (
  SELECT
    m.nombre AS municipio,
    AVG(s.precio_m2) AS precio_m2_medio
  FROM analytics.listing_snapshot s
  JOIN analytics.municipio m ON m.id = s.municipio_id
  WHERE s.precio_m2 IS NOT NULL
  GROUP BY m.nombre
)
SELECT
  municipio,
  precio_m2_medio::numeric(12,2),
  RANK() OVER (ORDER BY precio_m2_medio DESC) AS ranking
FROM kpi
ORDER BY ranking
LIMIT 5;

-- Insight:
-- Ranking claro y fácil de explicar de municipios más caros.


-- ============================================================
-- 8. PISO MÁS CARO Y MÁS BARATO POR MUNICIPIO
-- WINDOW + PARTITION BY
-- ============================================================

SELECT *
FROM (
  SELECT
    m.nombre AS municipio,
    s.piso_id,
    s.precio,
    ROW_NUMBER() OVER (
      PARTITION BY m.nombre
      ORDER BY s.precio DESC
    ) AS rn_caro,
    ROW_NUMBER() OVER (
      PARTITION BY m.nombre
      ORDER BY s.precio ASC
    ) AS rn_barato
  FROM analytics.listing_snapshot s
  JOIN analytics.municipio m ON m.id = s.municipio_id
  WHERE s.precio IS NOT NULL
) t
WHERE rn_caro = 1 OR rn_barato = 1
ORDER BY municipio;

-- Insight:
-- Detecta extremos de mercado (outliers).
-- Útil para detectar posibles errores o pisos premium.


-- ============================================================
-- 9. VISTA: RESUMEN DE MERCADO POR MUNICIPIO
-- ============================================================

CREATE OR REPLACE VIEW analytics.vw_market_summary AS
SELECT
  m.nombre AS municipio,
  COUNT(*) AS n_anuncios,
  AVG(s.precio)::numeric(12,2) AS precio_medio,
  AVG(s.precio_m2)::numeric(12,2) AS precio_m2_medio
FROM analytics.listing_snapshot s
JOIN analytics.municipio m ON m.id = s.municipio_id
GROUP BY m.nombre;

-- Insight:
-- Vista reutilizable para dashboards y consultas rápidas.


-- ============================================================
-- 10. FUNCIÓN: KPIs POR MUNICIPIO Y RANGO TEMPORAL
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
    m.nombre AS municipio,
    COUNT(*) AS n,
    AVG(s.precio)::numeric(12,2),
    AVG(s.precio_m2)::numeric(12,2)
  FROM analytics.listing_snapshot s
  JOIN analytics.calendar c ON c.date = s.date_id
  JOIN analytics.municipio m ON m.id = s.municipio_id
  WHERE m.nombre = p_municipio
    AND c.date BETWEEN p_desde AND p_hasta
  GROUP BY m.nombre;
$$;

-- Ejemplo:
-- SELECT * FROM analytics.fn_kpis_municipio(
--   'Madrid',
--   '2025-01-01',
--   '2025-12-31'
-- );
