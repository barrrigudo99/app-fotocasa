
------------------ CORE ---------------------------------

CREATE OR REPLACE FUNCTION pipeline.insert_core_from_raw()
RETURNS TRIGGER AS $$
DECLARE
  tipo_inmueble TEXT;
  estado TEXT;
  operacion TEXT;
BEGIN
  -- extraer Tipo de inmueble desde featuresBlock
  SELECT f->>'value'
  INTO tipo_inmueble
  FROM jsonb_array_elements(NEW.data->'featuresBlock'->'features') f
  WHERE f->>'label' = 'Tipo de inmueble'
  LIMIT 1;

  -- extraer Estado desde featuresBlock
  SELECT f->>'value'
  INTO estado
  FROM jsonb_array_elements(NEW.data->'featuresBlock'->'features') f
  WHERE f->>'label' = 'Estado'
  LIMIT 1;


  operacion := CASE
    WHEN split_part(NEW.url, '/', 5) IN ('alquiler', 'venta')
      THEN split_part(NEW.url, '/', 5)
    ELSE NULL
  END;


  INSERT INTO pipeline.core (
    id,
    portal,
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
    municipio,
    lat,
    lon,
    geo_confidence,
    timestamp_origen
  )
  VALUES (
    NEW.id,
    NEW.portal,
    operacion,
    NEW.url,
    (NEW.data->>'precio')::INT,
    (NEW.data->>'metros')::INT,
    (NEW.data->>'habitaciones')::INT,
    (NEW.data->>'banos')::INT,
    tipo_inmueble,
    estado,
    NULL,
    NULL,
    NEW.data->>'planta',
    NEW.data->>'municipio',
    NULL,
    NULL,
    NULL,
    NEW.timestamp
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;



CREATE TRIGGER trg_raw_detalles_to_pipeline_core
AFTER INSERT ON raw.detalles
FOR EACH ROW
EXECUTE FUNCTION pipeline.insert_core_from_raw();

------------------- EXTRAS ---------------------------------------------

CREATE OR REPLACE FUNCTION pipeline.insert_extras_from_raw()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO pipeline.extras (piso_id, extra)
  SELECT
    NEW.id,
    jsonb_array_elements_text(NEW.data->'extras');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


CREATE TRIGGER trg_raw_detalles_to_pipeline_extras
AFTER INSERT ON raw.detalles
FOR EACH ROW
EXECUTE FUNCTION pipeline.insert_extras_from_raw();


--------------- FEATURES --------------------------------------------------

CREATE OR REPLACE FUNCTION pipeline.insert_features_from_raw()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO pipeline.features (piso_id, feature, value)
  SELECT
    NEW.id,
    f->>'label',
    f->>'value'
  FROM jsonb_array_elements(NEW.data->'featuresBlock'->'features') f;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


CREATE TRIGGER trg_raw_detalles_to_pipeline_features
AFTER INSERT ON raw.detalles
FOR EACH ROW
EXECUTE FUNCTION pipeline.insert_features_from_raw();


------------- TEXTO --------------------------

CREATE OR REPLACE FUNCTION pipeline.insert_texto_from_raw()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO pipeline.texto (
    piso_id,
    titulo,
    descripcion,
    ubicacion
  )
  VALUES (
    NEW.id,
    NEW.data->>'titulo',
    NEW.data->>'descripcion',
    NEW.data->>'ubicacion'
  )
  ON CONFLICT (piso_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


CREATE TRIGGER trg_raw_detalles_to_pipeline_texto
AFTER INSERT ON raw.detalles
FOR EACH ROW
EXECUTE FUNCTION pipeline.insert_texto_from_raw();
