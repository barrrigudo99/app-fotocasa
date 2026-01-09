-- ELIMINAR TODAS LAS FILAS DEL DATABASE

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT schemaname, tablename
        FROM pg_tables
        WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
    ) LOOP
        EXECUTE format(
            'TRUNCATE TABLE %I.%I CASCADE',
            r.schemaname,
            r.tablename
        );
    END LOOP;
END $$;
