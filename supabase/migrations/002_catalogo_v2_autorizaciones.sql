-- ============================================================
-- AgroCampo — Migración 002: catálogo v2 + producto_autorizaciones
-- M.A.D.Y · Sprint 2 · Junio 2026
-- ============================================================


-- ------------------------------------------------------------
-- SECCIÓN 1: Ampliar catalogo_productos
-- ------------------------------------------------------------

-- Columnas del catálogo ANEBERRIES ausentes en la v1
ALTER TABLE catalogo_productos
  ADD COLUMN IF NOT EXISTS concentracion text,
  ADD COLUMN IF NOT EXISTS empresa       text;

-- Algunos catálogos externos omiten la unidad; permitir NULL
ALTER TABLE catalogo_productos
  ALTER COLUMN unidad DROP NOT NULL;

-- Ampliar categorías para cubrir todos los grupos de ANEBERRIES
-- (PostgreSQL nombra constraints inline como <tabla>_<columna>_check)
ALTER TABLE catalogo_productos
  DROP CONSTRAINT IF EXISTS catalogo_productos_categoria_check;

ALTER TABLE catalogo_productos
  ADD CONSTRAINT catalogo_productos_categoria_check
  CHECK (categoria IN (
    'Fungicidas', 'Insecticidas', 'Adherentes', 'Herbicidas',
    'Reguladores', 'Biorracionales', 'Nematicidas'
  ));

-- Índice único que el seed usa para ON CONFLICT (upsert)
CREATE UNIQUE INDEX IF NOT EXISTS catalogo_productos_nombre_ingrediente_key
  ON catalogo_productos(nombre_comercial, ingrediente_activo);


-- ------------------------------------------------------------
-- SECCIÓN 2: Tabla producto_autorizaciones
-- Registros de autorización por producto × cultivo × mercado
-- extraídos de la lista ANEBERRIES/Hortifrut.
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS producto_autorizaciones (
  id                       uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_id              uuid        NOT NULL
                             REFERENCES catalogo_productos(id) ON DELETE CASCADE,
  cultivo                  text        NOT NULL
                             CHECK (cultivo IN ('Zarzamora', 'Frambuesa', 'Fresa', 'Mora azul')),
  mercado                  text        NOT NULL
                             CHECK (mercado IN ('EUA', 'UE')),
  intervalo_seguridad_dias integer,
  reentrada_hrs            integer,
  lmr_ppm                  text,
  dosis_texto              text        NOT NULL,
  dosis_min                numeric(10, 4),
  dosis_max                numeric(10, 4),
  intervalo_aplicacion     text,
  grupo_quimico            text,
  plaga_comun              text,
  plaga_cientifica         text,
  observaciones            text,
  revision_lista           text        NOT NULL,
  fecha_lista              date        NOT NULL,
  created_at               timestamptz NOT NULL DEFAULT now(),

  UNIQUE (producto_id, cultivo, mercado, revision_lista)
);

CREATE INDEX IF NOT EXISTS idx_prod_aut_cultivo_mercado
  ON producto_autorizaciones(cultivo, mercado);


-- ------------------------------------------------------------
-- SECCIÓN 3: RLS en producto_autorizaciones
-- Mismo patrón que catalogo_productos: lectura global,
-- escritura restringida a admins.
-- ------------------------------------------------------------

ALTER TABLE producto_autorizaciones ENABLE ROW LEVEL SECURITY;

-- SELECT: catálogo global — todos los usuarios autenticados
CREATE POLICY "prod_aut_select" ON producto_autorizaciones
  FOR SELECT TO authenticated
  USING (true);

-- INSERT/UPDATE: solo super_admin y admin_hima
CREATE POLICY "prod_aut_insert" ON producto_autorizaciones
  FOR INSERT TO authenticated
  WITH CHECK (get_my_rol() IN ('super_admin', 'admin_hima'));

CREATE POLICY "prod_aut_update" ON producto_autorizaciones
  FOR UPDATE TO authenticated
  USING  (get_my_rol() IN ('super_admin', 'admin_hima'))
  WITH CHECK (get_my_rol() IN ('super_admin', 'admin_hima'));

-- DELETE: solo super_admin
CREATE POLICY "prod_aut_delete" ON producto_autorizaciones
  FOR DELETE TO authenticated
  USING (get_my_rol() = 'super_admin');
