-- ============================================================
-- AgroCampo — Migración inicial del esquema completo
-- M.A.D.Y · Sprint 0 · Mayo 2026
-- ============================================================
-- INSTRUCCIONES: aplicar desde el dashboard de Supabase en
-- SQL Editor, o con: supabase db push
-- ============================================================


-- ============================================================
-- SECCIÓN 1: FUNCIÓN HELPER PARA updated_at AUTOMÁTICO
-- ============================================================

CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ============================================================
-- SECCIÓN 2: TABLA profiles
-- Extiende auth.users. Una fila por cada usuario del sistema.
-- ============================================================

CREATE TABLE profiles (
  id              uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre_completo text        NOT NULL,
  rol             text        NOT NULL
                    CHECK (rol IN ('super_admin', 'admin_hima', 'asesor_tecnico', 'operario')),
  activo          boolean     NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER set_updated_at_profiles
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- Crea el perfil automáticamente al registrar un usuario en auth.users
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, nombre_completo, rol)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nombre_completo', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'rol', 'operario')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();


-- ============================================================
-- SECCIÓN 3: TABLA productores
-- Un productor es un operario de campo (profile.rol = 'operario').
-- ============================================================

CREATE TABLE productores (
  id                        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id                uuid        NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  asesor_id                 uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  responsable_inocuidad_id  uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_productores_asesor_id ON productores(asesor_id);

CREATE TRIGGER set_updated_at_productores
  BEFORE UPDATE ON productores
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();


-- ============================================================
-- SECCIÓN 4: TABLA ranchos
-- Huertos/ranchos por productor. Un rancho = un cultivo principal.
-- ============================================================

CREATE TABLE ranchos (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  productor_id   uuid        NOT NULL REFERENCES productores(id) ON DELETE RESTRICT,
  nombre         text        NOT NULL,
  codigo         text        NOT NULL,
  cultivo        text        NOT NULL,
  superficie_ha  numeric(10, 2),
  activo         boolean     NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),

  UNIQUE (productor_id, codigo)
);

CREATE INDEX idx_ranchos_productor_id ON ranchos(productor_id);

CREATE TRIGGER set_updated_at_ranchos
  BEFORE UPDATE ON ranchos
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();


-- ============================================================
-- SECCIÓN 5: TABLA catalogo_productos
-- Catálogo global de agroquímicos/plaguicidas (M1 y M2).
-- ============================================================

CREATE TABLE catalogo_productos (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre_comercial    text        NOT NULL,
  ingrediente_activo  text        NOT NULL,
  rsco                text,
  categoria           text        NOT NULL
                        CHECK (categoria IN ('Fungicidas', 'Insecticidas', 'Adherentes', 'Herbicidas')),
  dias_cosecha        integer,
  reentrada_hrs       integer,
  dosis_ha            numeric(10, 4),
  dosis_200l          numeric(10, 4),
  unidad              text        NOT NULL CHECK (unidad IN ('kg', 'L')),
  activo              boolean     NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER set_updated_at_catalogo_productos
  BEFORE UPDATE ON catalogo_productos
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();


-- ============================================================
-- SECCIÓN 6: TABLA aplicaciones
-- M1 — Formulario de 4 pasos (foliar / drench).
-- Una fila por cada registro de aplicación.
-- ============================================================

CREATE TABLE aplicaciones (
  id                        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  productor_id              uuid        NOT NULL REFERENCES productores(id) ON DELETE RESTRICT,
  rancho_id                 uuid        NOT NULL REFERENCES ranchos(id)    ON DELETE RESTRICT,

  -- Paso 1: Parcela y cultivo
  variedad                  text,
  sector                    text,
  superficie_ha             numeric(10, 2),
  fenologia                 text
                              CHECK (fenologia IN (
                                'establecimiento', 'floracion', 'cuajado',
                                'engorde', 'produccion', 'cosecha'
                              )),
  fecha_recomendacion       date,
  fecha_aplicacion          date        NOT NULL,
  hora_inicio               time,
  hora_fin                  time,

  -- Paso 3: Aplicación y agua
  tipo_aplicacion           text        NOT NULL
                              CHECK (tipo_aplicacion IN ('Foliar', 'Drench')),
  equipo                    text
                              CHECK (equipo IN ('bomba-motor', 'bomba-manual', 'aspersora-mochila')),
  total_agua_l              numeric(10, 2),
  cloracion                 boolean     NOT NULL DEFAULT false,
  cloro_cantidad_l          numeric(10, 2),          -- solo si cloracion = true
  cloro_ph                  numeric(5,  2),           -- solo si cloracion = true
  condicion_meteorologica   text
                              CHECK (condicion_meteorologica IN (
                                'Nublado', 'Muy soleado', 'Parcialmente soleado',
                                'Lluvioso', 'Lluvioso y nublado', 'Viento', 'Humedad'
                              )),
  epp_traje                 boolean     NOT NULL DEFAULT false,
  epp_guantes               boolean     NOT NULL DEFAULT false,
  epp_googles               boolean     NOT NULL DEFAULT false,
  epp_botas                 boolean     NOT NULL DEFAULT false,
  epp_mascarillas           boolean     NOT NULL DEFAULT false,

  -- Paso 4: Cierre
  caldos_sobrantes          boolean     NOT NULL DEFAULT false,
  caldos_cantidad_l         numeric(10, 2),
  caldos_agua_lavado_l      numeric(10, 2),
  caldos_area_designada     boolean,
  aplicadores               text,                    -- texto libre; normalizar en sprint futuro
  asesor_id                 uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  responsable_inocuidad_id  uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  observaciones             text,

  -- Meta
  status                    text        NOT NULL DEFAULT 'borrador'
                              CHECK (status IN ('borrador', 'completado')),
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_aplicaciones_productor_fecha ON aplicaciones(productor_id, fecha_aplicacion DESC);
CREATE INDEX idx_aplicaciones_rancho_id       ON aplicaciones(rancho_id);

CREATE TRIGGER set_updated_at_aplicaciones
  BEFORE UPDATE ON aplicaciones
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();


-- ============================================================
-- SECCIÓN 7: TABLA aplicacion_productos
-- M-N entre aplicaciones y catalogo_productos.
-- Una fila por cada producto dentro de una aplicación.
-- ============================================================

CREATE TABLE aplicacion_productos (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  aplicacion_id     uuid        NOT NULL REFERENCES aplicaciones(id)       ON DELETE CASCADE,
  producto_id       uuid        NOT NULL REFERENCES catalogo_productos(id)  ON DELETE RESTRICT,
  plaga_objetivo    text,
  nivel_infestacion text        CHECK (nivel_infestacion IN ('Bajo', 'Medio', 'Alto')),
  dosis_ha          numeric(10, 4),
  dosis_200l        numeric(10, 4),
  total_producto    numeric(10, 4),     -- calculado: dosis_ha × superficie_ha
  dias_cosecha      integer,            -- copiado del catálogo al momento de aplicar
  reentrada_hrs     integer,            -- copiado del catálogo al momento de aplicar
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_aplic_prod_aplicacion_id ON aplicacion_productos(aplicacion_id);


-- ============================================================
-- SECCIÓN 8: TABLA inventario_movimientos
-- M2 — Historial auditable de entradas y salidas por rancho+producto.
-- ============================================================

CREATE TABLE inventario_movimientos (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  rancho_id       uuid        NOT NULL REFERENCES ranchos(id)           ON DELETE RESTRICT,
  producto_id     uuid        NOT NULL REFERENCES catalogo_productos(id) ON DELETE RESTRICT,
  tipo            text        NOT NULL CHECK (tipo IN ('entrada', 'salida', 'ajuste')),
  cantidad        numeric(10, 4) NOT NULL CHECK (cantidad > 0),
  balance         numeric(10, 4) NOT NULL,   -- saldo resultante (denormalizado)
  aplicacion_id   uuid        REFERENCES aplicaciones(id) ON DELETE SET NULL,  -- nullable
  referencia      text,                      -- ej: número de factura para entradas
  notas           text,
  fecha           date        NOT NULL,
  registrado_por  uuid        NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_inv_mov_rancho_producto ON inventario_movimientos(rancho_id, producto_id, fecha DESC);
CREATE INDEX idx_inv_mov_aplicacion_id   ON inventario_movimientos(aplicacion_id);

CREATE TRIGGER set_updated_at_inventario_movimientos
  BEFORE UPDATE ON inventario_movimientos
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();


-- ============================================================
-- SECCIÓN 9: TABLA m6_botiquin
-- Verificación semanal del botiquín de primeros auxilios.
-- Una fila por semana por rancho (UNIQUE).
-- ============================================================

CREATE TABLE m6_botiquin (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  rancho_id           uuid        NOT NULL REFERENCES ranchos(id) ON DELETE RESTRICT,
  fecha_verificacion  date        NOT NULL,
  paracetamol         boolean     NOT NULL DEFAULT false,
  guantes_s           boolean     NOT NULL DEFAULT false,
  guantes_m           boolean     NOT NULL DEFAULT false,
  guantes_l           boolean     NOT NULL DEFAULT false,
  vendas_tijeras      boolean     NOT NULL DEFAULT false,
  gasas_cinta         boolean     NOT NULL DEFAULT false,
  desinfectante       boolean     NOT NULL DEFAULT false,
  responsable_id      uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  firma_verificacion  boolean     NOT NULL DEFAULT false,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),

  UNIQUE (rancho_id, fecha_verificacion)
);

CREATE TRIGGER set_updated_at_m6_botiquin
  BEFORE UPDATE ON m6_botiquin
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();


-- ============================================================
-- SECCIÓN 10: TABLA m7_vidrio_plastico
-- Inspección quincenal de vidrio y plástico duro.
-- Una fila por hallazgo/evento.
-- ============================================================

CREATE TABLE m7_vidrio_plastico (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  rancho_id       uuid        NOT NULL REFERENCES ranchos(id) ON DELETE RESTRICT,
  fecha           date        NOT NULL,
  area            text        NOT NULL,
  material_equipo text        NOT NULL,
  protegido       boolean     NOT NULL,
  estado          text        NOT NULL CHECK (estado IN ('Bueno', 'Deteriorado', 'Reemplazo')),
  observaciones   text,
  registrado_por  uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_m7_rancho_fecha ON m7_vidrio_plastico(rancho_id, fecha DESC);

CREATE TRIGGER set_updated_at_m7_vidrio_plastico
  BEFORE UPDATE ON m7_vidrio_plastico
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();


-- ============================================================
-- SECCIÓN 11: TABLA m8_fertilizacion
-- Registro de fertilización y enmiendas al suelo.
-- Una fila por evento. superficie_ha es campo crítico (⚠️).
-- ============================================================

CREATE TABLE m8_fertilizacion (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  rancho_id             uuid        NOT NULL REFERENCES ranchos(id) ON DELETE RESTRICT,
  fecha                 date        NOT NULL,
  sector                text,
  nombre_comercial      text        NOT NULL,
  ingrediente_activo    text,
  concentracion         text,
  metodo                text        NOT NULL CHECK (metodo IN ('Fertirriego', 'Drench', 'Band')),
  superficie_ha         numeric(10, 2) NOT NULL,  -- campo crítico ⚠️
  dosis_kg_l_ha         numeric(10, 4) NOT NULL,
  cantidad_total        numeric(10, 4) NOT NULL,  -- calculada: dosis_kg_l_ha × superficie_ha
  operario_id           uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  verificacion_semanal  boolean     NOT NULL DEFAULT false,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_m8_rancho_fecha ON m8_fertilizacion(rancho_id, fecha DESC);

CREATE TRIGGER set_updated_at_m8_fertilizacion
  BEFORE UPDATE ON m8_fertilizacion
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();


-- ============================================================
-- SECCIÓN 12: TABLA m9_perimetral_config
-- Configuración mensual de la inspección perimetral.
-- Define si el rancho tiene almacén ese mes.
-- ============================================================

CREATE TABLE m9_perimetral_config (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  rancho_id       uuid        NOT NULL REFERENCES ranchos(id) ON DELETE RESTRICT,
  mes             date        NOT NULL,  -- primer día del mes: 2026-05-01
  tiene_almacen   boolean     NOT NULL DEFAULT false,
  responsable_id  uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),

  UNIQUE (rancho_id, mes)
);


-- ============================================================
-- SECCIÓN 13: TABLA m9_perimetral_registros
-- Grid mensual de inspección perimetral (M9).
-- Una fila por celda: (rancho × mes × día × ítem).
-- ============================================================

CREATE TABLE m9_perimetral_registros (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  rancho_id       uuid        NOT NULL REFERENCES ranchos(id) ON DELETE RESTRICT,
  mes             date        NOT NULL,
  dia             smallint    NOT NULL CHECK (dia BETWEEN 1 AND 31),
  item_clave      text        NOT NULL
                    CHECK (item_clave IN (
                      'periferia_huerto',
                      'fuente_canal',
                      'fuente_reservorio',
                      'fuente_pozo',
                      'almacen_instalaciones',
                      'intrusion_animal'
                    )),
  resultado       text        CHECK (resultado IN ('S', 'X')),  -- NULL = celda vacía
  registrado_por  uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  UNIQUE (rancho_id, mes, dia, item_clave)
);

CREATE INDEX idx_m9_rancho_mes ON m9_perimetral_registros(rancho_id, mes);

CREATE TRIGGER set_updated_at_m9_perimetral_registros
  BEFORE UPDATE ON m9_perimetral_registros
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();


-- ============================================================
-- SECCIÓN 14: TABLA m10_cosecha_liberacion
-- Registro de cosecha y liberación de lotes (M10).
-- hora_inicio_cosecha y hora_fin_cosecha son campos críticos (⚠️).
-- ============================================================

CREATE TABLE m10_cosecha_liberacion (
  id                        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  rancho_id                 uuid        NOT NULL REFERENCES ranchos(id) ON DELETE RESTRICT,
  fecha                     date        NOT NULL,
  sector                    text,
  cantidad_bandejas         integer,
  lote_liberado             boolean     NOT NULL DEFAULT false,
  numero_comprobante        text,
  codigo_trazabilidad       text,
  marca_embalaje            text,
  destino_final             text,
  fruta_proceso_kg          numeric(10, 2),
  encargado_liberacion_id   uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  hora_inicio_cosecha       time,       -- campo crítico ⚠️
  hora_fin_cosecha          time,       -- campo crítico ⚠️
  verificacion_semanal      boolean     NOT NULL DEFAULT false,
  observaciones             text,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_m10_rancho_fecha ON m10_cosecha_liberacion(rancho_id, fecha DESC);

CREATE TRIGGER set_updated_at_m10_cosecha_liberacion
  BEFORE UPDATE ON m10_cosecha_liberacion
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();


-- ============================================================
-- SECCIÓN 15: TABLA m11_preoperacional_registros
-- Grid diario de inspección pre-operacional (M11).
-- Una fila por celda: (rancho × mes × día × sección × ítem).
-- ============================================================

CREATE TABLE m11_preoperacional_registros (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  rancho_id         uuid        NOT NULL REFERENCES ranchos(id) ON DELETE RESTRICT,
  mes               date        NOT NULL,
  dia               smallint    NOT NULL CHECK (dia BETWEEN 1 AND 31),
  seccion           text        NOT NULL
                      CHECK (seccion IN (
                        'area_cosecha', 'banos', 'lavamanos', 'higiene_personal',
                        'material_empaque', 'area_consumo', 'salud_trabajador',
                        'area_empaque_carga', 'contenedores_reusables'
                      )),
  item_clave        text        NOT NULL,    -- clave del ítem dentro de la sección
  resultado         text        CHECK (resultado IN ('SI', 'NO', 'NA')),  -- NULL = vacío
  codigo_correctivo text,                   -- acción correctiva (nullable)
  registrado_por    uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),

  UNIQUE (rancho_id, mes, dia, seccion, item_clave)
);

CREATE INDEX idx_m11_rancho_mes ON m11_preoperacional_registros(rancho_id, mes);

CREATE TRIGGER set_updated_at_m11_preoperacional_registros
  BEFORE UPDATE ON m11_preoperacional_registros
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();


-- ============================================================
-- SECCIÓN 16: TABLA m12_limpieza_banos
-- Registro diario de limpieza y desinfección de baños (M12).
-- Una fila por baño por evento.
-- ============================================================

CREATE TABLE m12_limpieza_banos (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  rancho_id           uuid        NOT NULL REFERENCES ranchos(id) ON DELETE RESTRICT,
  fecha               date        NOT NULL,
  bano_numero         text        NOT NULL,
  limpieza            boolean     NOT NULL DEFAULT false,
  desinfeccion        boolean     NOT NULL DEFAULT false,
  concentracion_ppm   integer     NOT NULL DEFAULT 200,
  sustancias          text[]      NOT NULL DEFAULT '{}',
  abasto_papel        boolean     NOT NULL DEFAULT false,
  succion             boolean     NOT NULL DEFAULT false,
  realizado_por_id    uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  firma_semanal       boolean     NOT NULL DEFAULT false,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_m12_rancho_fecha ON m12_limpieza_banos(rancho_id, fecha DESC);

CREATE TRIGGER set_updated_at_m12_limpieza_banos
  BEFORE UPDATE ON m12_limpieza_banos
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();


-- ============================================================
-- SECCIÓN 17: HABILITAR RLS EN TODAS LAS TABLAS
-- ============================================================

ALTER TABLE profiles                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE productores                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE ranchos                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalogo_productos          ENABLE ROW LEVEL SECURITY;
ALTER TABLE aplicaciones                ENABLE ROW LEVEL SECURITY;
ALTER TABLE aplicacion_productos        ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventario_movimientos      ENABLE ROW LEVEL SECURITY;
ALTER TABLE m6_botiquin                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE m7_vidrio_plastico          ENABLE ROW LEVEL SECURITY;
ALTER TABLE m8_fertilizacion            ENABLE ROW LEVEL SECURITY;
ALTER TABLE m9_perimetral_config        ENABLE ROW LEVEL SECURITY;
ALTER TABLE m9_perimetral_registros     ENABLE ROW LEVEL SECURITY;
ALTER TABLE m10_cosecha_liberacion      ENABLE ROW LEVEL SECURITY;
ALTER TABLE m11_preoperacional_registros ENABLE ROW LEVEL SECURITY;
ALTER TABLE m12_limpieza_banos          ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- SECCIÓN 18: FUNCIONES HELPER PARA POLÍTICAS RLS
-- SECURITY DEFINER para evitar recursión y garantizar acceso
-- a profiles sin que RLS interfiera.
-- ============================================================

-- Retorna el rol del usuario autenticado actual
CREATE OR REPLACE FUNCTION get_my_rol()
RETURNS text AS $$
  SELECT rol FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Retorna el productor_id del usuario actual (para operarios)
CREATE OR REPLACE FUNCTION get_my_productor_id()
RETURNS uuid AS $$
  SELECT id FROM productores WHERE profile_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Verifica si un rancho_id pertenece al operario actual
CREATE OR REPLACE FUNCTION es_mi_rancho(p_rancho_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM ranchos r
    JOIN productores p ON p.id = r.productor_id
    WHERE r.id = p_rancho_id
      AND p.profile_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Verifica si un rancho_id pertenece a un productor asignado al asesor actual
CREATE OR REPLACE FUNCTION es_rancho_de_mi_productor(p_rancho_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM ranchos r
    JOIN productores p ON p.id = r.productor_id
    WHERE r.id = p_rancho_id
      AND p.asesor_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;


-- ============================================================
-- SECCIÓN 19: POLÍTICAS RLS
--
-- Convención de nombres: <tabla>_<operacion>_<rol>
-- Las políticas permisivas se combinan con OR por PostgreSQL.
-- Roles:
--   super_admin   → acceso total sin restricciones
--   admin_hima    → lee y escribe todos los registros
--   asesor_tecnico → solo lectura de sus productores asignados
--   operario      → CRUD de sus propios registros
-- ============================================================


-- ------------------------------------------------------------
-- profiles
-- ------------------------------------------------------------

ALTER TABLE profiles FORCE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select" ON profiles
  FOR SELECT TO authenticated
  USING (
    get_my_rol() IN ('super_admin', 'admin_hima')
    OR id = auth.uid()
    OR (
      get_my_rol() = 'asesor_tecnico'
      AND EXISTS (
        SELECT 1 FROM productores
        WHERE asesor_id = auth.uid()
          AND profile_id = profiles.id
      )
    )
  );

CREATE POLICY "profiles_insert" ON profiles
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_update" ON profiles
  FOR UPDATE TO authenticated
  USING (
    get_my_rol() = 'super_admin'
    OR id = auth.uid()
  )
  WITH CHECK (
    get_my_rol() = 'super_admin'
    OR id = auth.uid()
  );

CREATE POLICY "profiles_delete" ON profiles
  FOR DELETE TO authenticated
  USING (get_my_rol() = 'super_admin');


-- ------------------------------------------------------------
-- productores
-- ------------------------------------------------------------

CREATE POLICY "productores_select" ON productores
  FOR SELECT TO authenticated
  USING (
    get_my_rol() IN ('super_admin', 'admin_hima')
    OR profile_id = auth.uid()
    OR asesor_id  = auth.uid()
  );

CREATE POLICY "productores_insert" ON productores
  FOR INSERT TO authenticated
  WITH CHECK (get_my_rol() IN ('super_admin', 'admin_hima'));

CREATE POLICY "productores_update" ON productores
  FOR UPDATE TO authenticated
  USING (
    get_my_rol() IN ('super_admin', 'admin_hima')
    OR profile_id = auth.uid()
  );

CREATE POLICY "productores_delete" ON productores
  FOR DELETE TO authenticated
  USING (get_my_rol() = 'super_admin');


-- ------------------------------------------------------------
-- ranchos
-- ------------------------------------------------------------

CREATE POLICY "ranchos_select" ON ranchos
  FOR SELECT TO authenticated
  USING (
    get_my_rol() IN ('super_admin', 'admin_hima')
    OR productor_id = get_my_productor_id()
    OR (
      get_my_rol() = 'asesor_tecnico'
      AND EXISTS (
        SELECT 1 FROM productores p
        WHERE p.id = ranchos.productor_id
          AND p.asesor_id = auth.uid()
      )
    )
  );

CREATE POLICY "ranchos_insert" ON ranchos
  FOR INSERT TO authenticated
  WITH CHECK (
    get_my_rol() IN ('super_admin', 'admin_hima')
    OR productor_id = get_my_productor_id()
  );

CREATE POLICY "ranchos_update" ON ranchos
  FOR UPDATE TO authenticated
  USING (
    get_my_rol() IN ('super_admin', 'admin_hima')
    OR productor_id = get_my_productor_id()
  );

CREATE POLICY "ranchos_delete" ON ranchos
  FOR DELETE TO authenticated
  USING (get_my_rol() IN ('super_admin', 'admin_hima'));


-- ------------------------------------------------------------
-- catalogo_productos — catálogo global, lectura para todos
-- ------------------------------------------------------------

CREATE POLICY "catalogo_select" ON catalogo_productos
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "catalogo_insert" ON catalogo_productos
  FOR INSERT TO authenticated
  WITH CHECK (get_my_rol() IN ('super_admin', 'admin_hima'));

CREATE POLICY "catalogo_update" ON catalogo_productos
  FOR UPDATE TO authenticated
  USING (get_my_rol() IN ('super_admin', 'admin_hima'));

CREATE POLICY "catalogo_delete" ON catalogo_productos
  FOR DELETE TO authenticated
  USING (get_my_rol() = 'super_admin');


-- ------------------------------------------------------------
-- aplicaciones
-- ------------------------------------------------------------

CREATE POLICY "aplicaciones_select" ON aplicaciones
  FOR SELECT TO authenticated
  USING (
    get_my_rol() IN ('super_admin', 'admin_hima')
    OR productor_id = get_my_productor_id()
    OR (
      get_my_rol() = 'asesor_tecnico'
      AND EXISTS (
        SELECT 1 FROM productores p
        WHERE p.id = aplicaciones.productor_id
          AND p.asesor_id = auth.uid()
      )
    )
  );

CREATE POLICY "aplicaciones_insert" ON aplicaciones
  FOR INSERT TO authenticated
  WITH CHECK (
    get_my_rol() IN ('super_admin', 'admin_hima')
    OR productor_id = get_my_productor_id()
  );

CREATE POLICY "aplicaciones_update" ON aplicaciones
  FOR UPDATE TO authenticated
  USING (
    get_my_rol() IN ('super_admin', 'admin_hima')
    OR productor_id = get_my_productor_id()
  );

CREATE POLICY "aplicaciones_delete" ON aplicaciones
  FOR DELETE TO authenticated
  USING (
    get_my_rol() IN ('super_admin', 'admin_hima')
    OR productor_id = get_my_productor_id()
  );


-- ------------------------------------------------------------
-- aplicacion_productos — hereda acceso vía aplicaciones
-- ------------------------------------------------------------

CREATE POLICY "aplic_prod_select" ON aplicacion_productos
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM aplicaciones a
      WHERE a.id = aplicacion_productos.aplicacion_id
        AND (
          get_my_rol() IN ('super_admin', 'admin_hima')
          OR a.productor_id = get_my_productor_id()
          OR (
            get_my_rol() = 'asesor_tecnico'
            AND EXISTS (
              SELECT 1 FROM productores p
              WHERE p.id = a.productor_id AND p.asesor_id = auth.uid()
            )
          )
        )
    )
  );

CREATE POLICY "aplic_prod_insert" ON aplicacion_productos
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM aplicaciones a
      WHERE a.id = aplicacion_productos.aplicacion_id
        AND (
          get_my_rol() IN ('super_admin', 'admin_hima')
          OR a.productor_id = get_my_productor_id()
        )
    )
  );

CREATE POLICY "aplic_prod_update" ON aplicacion_productos
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM aplicaciones a
      WHERE a.id = aplicacion_productos.aplicacion_id
        AND (
          get_my_rol() IN ('super_admin', 'admin_hima')
          OR a.productor_id = get_my_productor_id()
        )
    )
  );

CREATE POLICY "aplic_prod_delete" ON aplicacion_productos
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM aplicaciones a
      WHERE a.id = aplicacion_productos.aplicacion_id
        AND (
          get_my_rol() IN ('super_admin', 'admin_hima')
          OR a.productor_id = get_my_productor_id()
        )
    )
  );


-- ------------------------------------------------------------
-- inventario_movimientos
-- ------------------------------------------------------------

CREATE POLICY "inv_mov_select" ON inventario_movimientos
  FOR SELECT TO authenticated
  USING (
    get_my_rol() IN ('super_admin', 'admin_hima')
    OR es_mi_rancho(rancho_id)
    OR (get_my_rol() = 'asesor_tecnico' AND es_rancho_de_mi_productor(rancho_id))
  );

CREATE POLICY "inv_mov_insert" ON inventario_movimientos
  FOR INSERT TO authenticated
  WITH CHECK (
    get_my_rol() IN ('super_admin', 'admin_hima')
    OR es_mi_rancho(rancho_id)
  );

CREATE POLICY "inv_mov_update" ON inventario_movimientos
  FOR UPDATE TO authenticated
  USING (
    get_my_rol() IN ('super_admin', 'admin_hima')
    OR es_mi_rancho(rancho_id)
  );

CREATE POLICY "inv_mov_delete" ON inventario_movimientos
  FOR DELETE TO authenticated
  USING (get_my_rol() IN ('super_admin', 'admin_hima'));


-- ------------------------------------------------------------
-- Macro para M6–M12: mismo patrón de acceso vía rancho_id
--   SELECT  → super_admin | admin_hima | operario-propio | asesor-sus-productores
--   INSERT/UPDATE → super_admin | admin_hima | operario-propio
--   DELETE  → super_admin | admin_hima
-- ------------------------------------------------------------

-- m6_botiquin
CREATE POLICY "m6_select" ON m6_botiquin FOR SELECT TO authenticated
  USING (get_my_rol() IN ('super_admin','admin_hima') OR es_mi_rancho(rancho_id)
         OR (get_my_rol()='asesor_tecnico' AND es_rancho_de_mi_productor(rancho_id)));
CREATE POLICY "m6_insert" ON m6_botiquin FOR INSERT TO authenticated
  WITH CHECK (get_my_rol() IN ('super_admin','admin_hima') OR es_mi_rancho(rancho_id));
CREATE POLICY "m6_update" ON m6_botiquin FOR UPDATE TO authenticated
  USING (get_my_rol() IN ('super_admin','admin_hima') OR es_mi_rancho(rancho_id));
CREATE POLICY "m6_delete" ON m6_botiquin FOR DELETE TO authenticated
  USING (get_my_rol() IN ('super_admin','admin_hima'));

-- m7_vidrio_plastico
CREATE POLICY "m7_select" ON m7_vidrio_plastico FOR SELECT TO authenticated
  USING (get_my_rol() IN ('super_admin','admin_hima') OR es_mi_rancho(rancho_id)
         OR (get_my_rol()='asesor_tecnico' AND es_rancho_de_mi_productor(rancho_id)));
CREATE POLICY "m7_insert" ON m7_vidrio_plastico FOR INSERT TO authenticated
  WITH CHECK (get_my_rol() IN ('super_admin','admin_hima') OR es_mi_rancho(rancho_id));
CREATE POLICY "m7_update" ON m7_vidrio_plastico FOR UPDATE TO authenticated
  USING (get_my_rol() IN ('super_admin','admin_hima') OR es_mi_rancho(rancho_id));
CREATE POLICY "m7_delete" ON m7_vidrio_plastico FOR DELETE TO authenticated
  USING (get_my_rol() IN ('super_admin','admin_hima'));

-- m8_fertilizacion
CREATE POLICY "m8_select" ON m8_fertilizacion FOR SELECT TO authenticated
  USING (get_my_rol() IN ('super_admin','admin_hima') OR es_mi_rancho(rancho_id)
         OR (get_my_rol()='asesor_tecnico' AND es_rancho_de_mi_productor(rancho_id)));
CREATE POLICY "m8_insert" ON m8_fertilizacion FOR INSERT TO authenticated
  WITH CHECK (get_my_rol() IN ('super_admin','admin_hima') OR es_mi_rancho(rancho_id));
CREATE POLICY "m8_update" ON m8_fertilizacion FOR UPDATE TO authenticated
  USING (get_my_rol() IN ('super_admin','admin_hima') OR es_mi_rancho(rancho_id));
CREATE POLICY "m8_delete" ON m8_fertilizacion FOR DELETE TO authenticated
  USING (get_my_rol() IN ('super_admin','admin_hima'));

-- m9_perimetral_config
CREATE POLICY "m9c_select" ON m9_perimetral_config FOR SELECT TO authenticated
  USING (get_my_rol() IN ('super_admin','admin_hima') OR es_mi_rancho(rancho_id)
         OR (get_my_rol()='asesor_tecnico' AND es_rancho_de_mi_productor(rancho_id)));
CREATE POLICY "m9c_insert" ON m9_perimetral_config FOR INSERT TO authenticated
  WITH CHECK (get_my_rol() IN ('super_admin','admin_hima') OR es_mi_rancho(rancho_id));
CREATE POLICY "m9c_update" ON m9_perimetral_config FOR UPDATE TO authenticated
  USING (get_my_rol() IN ('super_admin','admin_hima') OR es_mi_rancho(rancho_id));
CREATE POLICY "m9c_delete" ON m9_perimetral_config FOR DELETE TO authenticated
  USING (get_my_rol() IN ('super_admin','admin_hima'));

-- m9_perimetral_registros
CREATE POLICY "m9r_select" ON m9_perimetral_registros FOR SELECT TO authenticated
  USING (get_my_rol() IN ('super_admin','admin_hima') OR es_mi_rancho(rancho_id)
         OR (get_my_rol()='asesor_tecnico' AND es_rancho_de_mi_productor(rancho_id)));
CREATE POLICY "m9r_insert" ON m9_perimetral_registros FOR INSERT TO authenticated
  WITH CHECK (get_my_rol() IN ('super_admin','admin_hima') OR es_mi_rancho(rancho_id));
CREATE POLICY "m9r_update" ON m9_perimetral_registros FOR UPDATE TO authenticated
  USING (get_my_rol() IN ('super_admin','admin_hima') OR es_mi_rancho(rancho_id));
CREATE POLICY "m9r_delete" ON m9_perimetral_registros FOR DELETE TO authenticated
  USING (get_my_rol() IN ('super_admin','admin_hima'));

-- m10_cosecha_liberacion
CREATE POLICY "m10_select" ON m10_cosecha_liberacion FOR SELECT TO authenticated
  USING (get_my_rol() IN ('super_admin','admin_hima') OR es_mi_rancho(rancho_id)
         OR (get_my_rol()='asesor_tecnico' AND es_rancho_de_mi_productor(rancho_id)));
CREATE POLICY "m10_insert" ON m10_cosecha_liberacion FOR INSERT TO authenticated
  WITH CHECK (get_my_rol() IN ('super_admin','admin_hima') OR es_mi_rancho(rancho_id));
CREATE POLICY "m10_update" ON m10_cosecha_liberacion FOR UPDATE TO authenticated
  USING (get_my_rol() IN ('super_admin','admin_hima') OR es_mi_rancho(rancho_id));
CREATE POLICY "m10_delete" ON m10_cosecha_liberacion FOR DELETE TO authenticated
  USING (get_my_rol() IN ('super_admin','admin_hima'));

-- m11_preoperacional_registros
CREATE POLICY "m11_select" ON m11_preoperacional_registros FOR SELECT TO authenticated
  USING (get_my_rol() IN ('super_admin','admin_hima') OR es_mi_rancho(rancho_id)
         OR (get_my_rol()='asesor_tecnico' AND es_rancho_de_mi_productor(rancho_id)));
CREATE POLICY "m11_insert" ON m11_preoperacional_registros FOR INSERT TO authenticated
  WITH CHECK (get_my_rol() IN ('super_admin','admin_hima') OR es_mi_rancho(rancho_id));
CREATE POLICY "m11_update" ON m11_preoperacional_registros FOR UPDATE TO authenticated
  USING (get_my_rol() IN ('super_admin','admin_hima') OR es_mi_rancho(rancho_id));
CREATE POLICY "m11_delete" ON m11_preoperacional_registros FOR DELETE TO authenticated
  USING (get_my_rol() IN ('super_admin','admin_hima'));

-- m12_limpieza_banos
CREATE POLICY "m12_select" ON m12_limpieza_banos FOR SELECT TO authenticated
  USING (get_my_rol() IN ('super_admin','admin_hima') OR es_mi_rancho(rancho_id)
         OR (get_my_rol()='asesor_tecnico' AND es_rancho_de_mi_productor(rancho_id)));
CREATE POLICY "m12_insert" ON m12_limpieza_banos FOR INSERT TO authenticated
  WITH CHECK (get_my_rol() IN ('super_admin','admin_hima') OR es_mi_rancho(rancho_id));
CREATE POLICY "m12_update" ON m12_limpieza_banos FOR UPDATE TO authenticated
  USING (get_my_rol() IN ('super_admin','admin_hima') OR es_mi_rancho(rancho_id));
CREATE POLICY "m12_delete" ON m12_limpieza_banos FOR DELETE TO authenticated
  USING (get_my_rol() IN ('super_admin','admin_hima'));
