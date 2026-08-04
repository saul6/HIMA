// Tipos TypeScript generados manualmente — actualizar si se agregan columnas o tablas.

export type Rol = 'super_admin' | 'admin_org' | 'asesor_tecnico' | 'operario'
export type TipoOrganizacion = 'empresa' | 'individuo'
export type PlanOrganizacion = 'pendiente' | 'free' | 'basico' | 'personalizado'
export type EstadoOrganizacion = 'activa' | 'suspendida' | 'cancelada'
export type CategoriaProducto = 'Fungicidas' | 'Insecticidas' | 'Adherentes' | 'Herbicidas' | 'Reguladores' | 'Biorracionales' | 'Nematicidas'
export type UnidadProducto = 'kg' | 'L'
export type Fenologia = 'establecimiento' | 'floracion' | 'cuajado' | 'engorde' | 'produccion' | 'cosecha'
export type TipoAplicacion = 'Foliar' | 'Drench'
export type TipoEquipo = 'bomba-motor' | 'bomba-manual' | 'aspersora-mochila'
export type CondicionMeteorologica = 'Nublado' | 'Muy soleado' | 'Parcialmente soleado' | 'Lluvioso' | 'Lluvioso y nublado' | 'Viento' | 'Humedad'
export type StatusAplicacion = 'borrador' | 'completado'
export type TipoMovimiento = 'entrada' | 'salida' | 'ajuste'
export type NivelInfestacion = 'Bajo' | 'Medio' | 'Alto'
export type EstadoVidrio = 'Bueno' | 'Deteriorado' | 'Reemplazo'
export type MetodoFertilizacion = 'Fertirriego' | 'Drench' | 'Band'
export type ItemPerimetral = 'periferia_huerto' | 'fuente_canal' | 'fuente_reservorio' | 'fuente_pozo' | 'almacen_instalaciones' | 'intrusion_animal'
export type ResultadoPerimetral = 'S' | 'X'
export type SeccionPreoperacional = 'area_cosecha' | 'banos' | 'lavamanos' | 'higiene_personal' | 'material_empaque' | 'area_consumo' | 'salud_trabajador' | 'area_empaque_carga' | 'contenedores_reusables'
export type ResultadoPreoperacional = 'SI' | 'NO' | 'NA'

export type Database = {
  public: {
    Tables: {
      organizaciones: {
        Row: {
          id: string
          nombre: string
          tipo: TipoOrganizacion
          plan: PlanOrganizacion
          estado: EstadoOrganizacion
          admin_edita_ajenos: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          nombre: string
          tipo?: TipoOrganizacion
          plan?: PlanOrganizacion
          estado?: EstadoOrganizacion
          admin_edita_ajenos?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          nombre?: string
          tipo?: TipoOrganizacion
          plan?: PlanOrganizacion
          estado?: EstadoOrganizacion
          admin_edita_ajenos?: boolean
          created_at?: string
          updated_at?: string
        }
      }

      profiles: {
        Row: {
          id: string
          nombre_completo: string
          rol: Rol
          activo: boolean
          org_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          nombre_completo: string
          rol: Rol
          activo?: boolean
          org_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          nombre_completo?: string
          rol?: Rol
          activo?: boolean
          org_id?: string | null
          created_at?: string
          updated_at?: string
        }
      }

      productores: {
        Row: {
          id: string
          profile_id: string
          asesor_id: string | null
          responsable_inocuidad_id: string | null
          org_id: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          profile_id: string
          asesor_id?: string | null
          responsable_inocuidad_id?: string | null
          org_id: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          profile_id?: string
          asesor_id?: string | null
          responsable_inocuidad_id?: string | null
          org_id?: string
          created_at?: string
          updated_at?: string
        }
      }

      ranchos: {
        Row: {
          id: string
          productor_id: string
          nombre: string
          codigo: string
          cultivo: string
          superficie_ha: number | null
          activo: boolean
          org_id: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          productor_id: string
          nombre: string
          codigo: string
          cultivo: string
          superficie_ha?: number | null
          activo?: boolean
          org_id: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          productor_id?: string
          nombre?: string
          codigo?: string
          cultivo?: string
          superficie_ha?: number | null
          activo?: boolean
          org_id?: string
          created_at?: string
          updated_at?: string
        }
      }

      catalogo_productos: {
        Row: {
          id: string
          nombre_comercial: string
          ingrediente_activo: string
          concentracion: string | null
          empresa: string | null
          rsco: string | null
          categoria: CategoriaProducto
          dias_cosecha: number | null
          reentrada_hrs: number | null
          dosis_ha: number | null
          dosis_200l: number | null
          unidad: UnidadProducto | null
          activo: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          nombre_comercial: string
          ingrediente_activo: string
          concentracion?: string | null
          empresa?: string | null
          rsco?: string | null
          categoria: CategoriaProducto
          dias_cosecha?: number | null
          reentrada_hrs?: number | null
          dosis_ha?: number | null
          dosis_200l?: number | null
          unidad?: UnidadProducto | null
          activo?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          nombre_comercial?: string
          ingrediente_activo?: string
          concentracion?: string | null
          empresa?: string | null
          rsco?: string | null
          categoria?: CategoriaProducto
          dias_cosecha?: number | null
          reentrada_hrs?: number | null
          dosis_ha?: number | null
          dosis_200l?: number | null
          unidad?: UnidadProducto | null
          activo?: boolean
          created_at?: string
          updated_at?: string
        }
      }

      aplicaciones: {
        Row: {
          id: string
          productor_id: string
          rancho_id: string
          variedad: string | null
          sector: string | null
          superficie_ha: number | null
          fenologia: Fenologia | null
          fecha_recomendacion: string | null
          fecha_aplicacion: string
          hora_inicio: string | null
          hora_fin: string | null
          tipo_aplicacion: TipoAplicacion
          equipo: TipoEquipo | null
          total_agua_l: number | null
          cloracion: boolean
          cloro_cantidad_l: number | null
          cloro_ph: number | null
          condicion_meteorologica: CondicionMeteorologica | null
          epp_traje: boolean
          epp_guantes: boolean
          epp_googles: boolean
          epp_botas: boolean
          epp_mascarillas: boolean
          caldos_sobrantes: boolean
          caldos_cantidad_l: number | null
          caldos_agua_lavado_l: number | null
          caldos_area_designada: boolean | null
          aplicadores: string | null
          asesor_id: string | null
          responsable_inocuidad_id: string | null
          observaciones: string | null
          status: StatusAplicacion
          org_id: string
          created_at: string
          updated_at: string
          creado_por: string | null
          requiere_correccion: boolean
          comentario_correccion: string | null
          marcado_por: string | null
          marcado_en: string | null
        }
        Insert: {
          id?: string
          productor_id: string
          rancho_id: string
          variedad?: string | null
          sector?: string | null
          superficie_ha?: number | null
          fenologia?: Fenologia | null
          fecha_recomendacion?: string | null
          fecha_aplicacion: string
          hora_inicio?: string | null
          hora_fin?: string | null
          tipo_aplicacion: TipoAplicacion
          equipo?: TipoEquipo | null
          total_agua_l?: number | null
          cloracion?: boolean
          cloro_cantidad_l?: number | null
          cloro_ph?: number | null
          condicion_meteorologica?: CondicionMeteorologica | null
          epp_traje?: boolean
          epp_guantes?: boolean
          epp_googles?: boolean
          epp_botas?: boolean
          epp_mascarillas?: boolean
          caldos_sobrantes?: boolean
          caldos_cantidad_l?: number | null
          caldos_agua_lavado_l?: number | null
          caldos_area_designada?: boolean | null
          aplicadores?: string | null
          asesor_id?: string | null
          responsable_inocuidad_id?: string | null
          observaciones?: string | null
          status?: StatusAplicacion
          org_id: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          productor_id?: string
          rancho_id?: string
          variedad?: string | null
          sector?: string | null
          superficie_ha?: number | null
          fenologia?: Fenologia | null
          fecha_recomendacion?: string | null
          fecha_aplicacion?: string
          hora_inicio?: string | null
          hora_fin?: string | null
          tipo_aplicacion?: TipoAplicacion
          equipo?: TipoEquipo | null
          total_agua_l?: number | null
          cloracion?: boolean
          cloro_cantidad_l?: number | null
          cloro_ph?: number | null
          condicion_meteorologica?: CondicionMeteorologica | null
          epp_traje?: boolean
          epp_guantes?: boolean
          epp_googles?: boolean
          epp_botas?: boolean
          epp_mascarillas?: boolean
          caldos_sobrantes?: boolean
          caldos_cantidad_l?: number | null
          caldos_agua_lavado_l?: number | null
          caldos_area_designada?: boolean | null
          aplicadores?: string | null
          asesor_id?: string | null
          responsable_inocuidad_id?: string | null
          observaciones?: string | null
          status?: StatusAplicacion
          org_id?: string
          created_at?: string
          updated_at?: string
          requiere_correccion?: boolean
          comentario_correccion?: string | null
        }
      }

      aplicacion_productos: {
        Row: {
          id: string
          aplicacion_id: string
          producto_id: string
          plaga_objetivo: string | null
          nivel_infestacion: NivelInfestacion | null
          dosis_ha: number | null
          dosis_200l: number | null
          total_producto: number | null
          dias_cosecha: number | null
          reentrada_hrs: number | null
          org_id: string
          created_at: string
        }
        Insert: {
          id?: string
          aplicacion_id: string
          producto_id: string
          plaga_objetivo?: string | null
          nivel_infestacion?: NivelInfestacion | null
          dosis_ha?: number | null
          dosis_200l?: number | null
          total_producto?: number | null
          dias_cosecha?: number | null
          reentrada_hrs?: number | null
          org_id: string
          created_at?: string
        }
        Update: {
          id?: string
          aplicacion_id?: string
          producto_id?: string
          plaga_objetivo?: string | null
          nivel_infestacion?: NivelInfestacion | null
          dosis_ha?: number | null
          dosis_200l?: number | null
          total_producto?: number | null
          dias_cosecha?: number | null
          reentrada_hrs?: number | null
          org_id?: string
          created_at?: string
        }
      }

      inventario_movimientos: {
        Row: {
          id: string
          rancho_id: string
          producto_id: string
          tipo: TipoMovimiento
          cantidad: number
          balance: number
          aplicacion_id: string | null
          referencia: string | null
          notas: string | null
          fecha: string
          registrado_por: string
          org_id: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          rancho_id: string
          producto_id: string
          tipo: TipoMovimiento
          cantidad: number
          balance: number
          aplicacion_id?: string | null
          referencia?: string | null
          notas?: string | null
          fecha: string
          registrado_por: string
          org_id: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          rancho_id?: string
          producto_id?: string
          tipo?: TipoMovimiento
          cantidad?: number
          balance?: number
          aplicacion_id?: string | null
          referencia?: string | null
          notas?: string | null
          fecha?: string
          registrado_por?: string
          org_id?: string
          created_at?: string
          updated_at?: string
        }
      }

      m6_botiquin: {
        Row: {
          id: string
          rancho_id: string
          fecha_verificacion: string
          parches_curitas: boolean
          guantes_curacion: boolean
          vendas_tijeras: boolean
          gasas_cinta: boolean
          desinfectante: boolean
          responsable_id: string | null
          firma_verificacion: boolean
          org_id: string
          created_at: string
          updated_at: string
          creado_por: string | null
          requiere_correccion: boolean
          comentario_correccion: string | null
          marcado_por: string | null
          marcado_en: string | null
        }
        Insert: {
          id?: string
          rancho_id: string
          fecha_verificacion: string
          parches_curitas?: boolean
          guantes_curacion?: boolean
          vendas_tijeras?: boolean
          gasas_cinta?: boolean
          desinfectante?: boolean
          responsable_id?: string | null
          firma_verificacion?: boolean
          org_id: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          rancho_id?: string
          fecha_verificacion?: string
          parches_curitas?: boolean
          guantes_curacion?: boolean
          vendas_tijeras?: boolean
          gasas_cinta?: boolean
          desinfectante?: boolean
          responsable_id?: string | null
          firma_verificacion?: boolean
          org_id?: string
          created_at?: string
          updated_at?: string
          requiere_correccion?: boolean
          comentario_correccion?: string | null
        }
      }

      m7_materiales_rancho: {
        Row: {
          id: string
          rancho_id: string
          org_id: string
          area: string
          material: string
          activo: boolean
          created_at: string
        }
        Insert: {
          id?: string
          rancho_id: string
          org_id: string
          area: string
          material: string
          activo?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          rancho_id?: string
          org_id?: string
          area?: string
          material?: string
          activo?: boolean
          created_at?: string
        }
      }

      m7_vidrio_plastico: {
        Row: {
          id: string
          rancho_id: string
          fecha: string
          area: string
          material_equipo: string
          protegido: boolean
          estado: EstadoVidrio
          observaciones: string | null
          registrado_por: string | null
          org_id: string
          created_at: string
          updated_at: string
          creado_por: string | null
          requiere_correccion: boolean
          comentario_correccion: string | null
          marcado_por: string | null
          marcado_en: string | null
        }
        Insert: {
          id?: string
          rancho_id: string
          fecha: string
          area: string
          material_equipo: string
          protegido: boolean
          estado: EstadoVidrio
          observaciones?: string | null
          registrado_por?: string | null
          org_id: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          rancho_id?: string
          fecha?: string
          area?: string
          material_equipo?: string
          protegido?: boolean
          estado?: EstadoVidrio
          observaciones?: string | null
          registrado_por?: string | null
          org_id?: string
          created_at?: string
          updated_at?: string
          requiere_correccion?: boolean
          comentario_correccion?: string | null
        }
      }

      m8_fertilizacion: {
        Row: {
          id: string
          rancho_id: string
          fecha: string
          sector: string | null
          nombre_comercial: string
          ingrediente_activo: string | null
          concentracion: string | null
          metodo: MetodoFertilizacion
          superficie_ha: number
          dosis_kg_l_ha: number
          cantidad_total: number
          operario_id: string | null
          verificacion_semanal: boolean
          org_id: string
          created_at: string
          updated_at: string
          creado_por: string | null
          requiere_correccion: boolean
          comentario_correccion: string | null
          marcado_por: string | null
          marcado_en: string | null
        }
        Insert: {
          id?: string
          rancho_id: string
          fecha: string
          sector?: string | null
          nombre_comercial: string
          ingrediente_activo?: string | null
          concentracion?: string | null
          metodo: MetodoFertilizacion
          superficie_ha: number
          dosis_kg_l_ha: number
          cantidad_total: number
          operario_id?: string | null
          verificacion_semanal?: boolean
          org_id: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          rancho_id?: string
          fecha?: string
          sector?: string | null
          nombre_comercial?: string
          ingrediente_activo?: string | null
          concentracion?: string | null
          metodo?: MetodoFertilizacion
          superficie_ha?: number
          dosis_kg_l_ha?: number
          cantidad_total?: number
          operario_id?: string | null
          verificacion_semanal?: boolean
          org_id?: string
          created_at?: string
          updated_at?: string
          requiere_correccion?: boolean
          comentario_correccion?: string | null
        }
      }

      fertilizantes_org: {
        Row: {
          id: string
          org_id: string
          nombre_comercial: string
          ingrediente_activo: string | null
          concentracion: string | null
          unidad: 'kg' | 'L' | null
          activo: boolean
          created_at: string
        }
        Insert: {
          id?: string
          org_id: string
          nombre_comercial: string
          ingrediente_activo?: string | null
          concentracion?: string | null
          unidad?: 'kg' | 'L' | null
          activo?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          nombre_comercial?: string
          ingrediente_activo?: string | null
          concentracion?: string | null
          unidad?: 'kg' | 'L' | null
          activo?: boolean
          created_at?: string
        }
      }

      inventario_fertilizantes: {
        Row: {
          id: string
          rancho_id: string
          fertilizante_id: string
          org_id: string
          tipo: 'entrada' | 'salida' | 'ajuste'
          cantidad: number
          m8_id: string | null
          referencia: string | null
          notas: string | null
          fecha: string
          registrado_por: string
          created_at: string
        }
        Insert: {
          id?: string
          rancho_id: string
          fertilizante_id: string
          org_id: string
          tipo: 'entrada' | 'salida' | 'ajuste'
          cantidad: number
          m8_id?: string | null
          referencia?: string | null
          notas?: string | null
          fecha: string
          registrado_por: string
          created_at?: string
        }
        Update: {
          id?: string
          rancho_id?: string
          fertilizante_id?: string
          org_id?: string
          tipo?: 'entrada' | 'salida' | 'ajuste'
          cantidad?: number
          m8_id?: string | null
          referencia?: string | null
          notas?: string | null
          fecha?: string
          registrado_por?: string
          created_at?: string
        }
      }

      m9_perimetral_config: {
        Row: {
          id: string
          rancho_id: string
          mes: string
          tiene_almacen: boolean
          responsable_id: string | null
          org_id: string
          created_at: string
        }
        Insert: {
          id?: string
          rancho_id: string
          mes: string
          tiene_almacen?: boolean
          responsable_id?: string | null
          org_id: string
          created_at?: string
        }
        Update: {
          id?: string
          rancho_id?: string
          mes?: string
          tiene_almacen?: boolean
          responsable_id?: string | null
          org_id?: string
          created_at?: string
        }
      }

      m9_perimetral_registros: {
        Row: {
          id: string
          rancho_id: string
          mes: string
          dia: number
          item_clave: ItemPerimetral
          resultado: ResultadoPerimetral | null
          registrado_por: string | null
          org_id: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          rancho_id: string
          mes: string
          dia: number
          item_clave: ItemPerimetral
          resultado?: ResultadoPerimetral | null
          registrado_por?: string | null
          org_id: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          rancho_id?: string
          mes?: string
          dia?: number
          item_clave?: ItemPerimetral
          resultado?: ResultadoPerimetral | null
          registrado_por?: string | null
          org_id?: string
          created_at?: string
          updated_at?: string
        }
      }

      m9_items_catalogo: {
        Row: {
          id: string
          seccion: string
          seccion_label: string
          item: string
          default_valor: boolean
          es_almacen: boolean
          orden: number
        }
        Insert: {
          id?: string
          seccion: string
          seccion_label: string
          item: string
          default_valor?: boolean
          es_almacen?: boolean
          orden?: number
        }
        Update: {
          id?: string
          seccion?: string
          seccion_label?: string
          item?: string
          default_valor?: boolean
          es_almacen?: boolean
          orden?: number
        }
      }

      m9_registro_mensual: {
        Row: {
          id: string
          rancho_id: string
          org_id: string
          mes: string
          tiene_almacen: boolean
          responsable_id: string | null
          observaciones: string | null
          otro: string | null
          created_at: string
        }
        Insert: {
          id?: string
          rancho_id: string
          org_id: string
          mes: string
          tiene_almacen?: boolean
          responsable_id?: string | null
          observaciones?: string | null
          otro?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          rancho_id?: string
          org_id?: string
          mes?: string
          tiene_almacen?: boolean
          responsable_id?: string | null
          observaciones?: string | null
          otro?: string | null
          created_at?: string
        }
      }

      m9_dias_inspeccion: {
        Row: {
          id: string
          registro_id: string
          org_id: string
          fecha: string
          created_at: string
        }
        Insert: {
          id?: string
          registro_id: string
          org_id: string
          fecha: string
          created_at?: string
        }
        Update: {
          id?: string
          registro_id?: string
          org_id?: string
          fecha?: string
          created_at?: string
        }
      }

      m9_resultados: {
        Row: {
          id: string
          dia_id: string
          item_id: string
          org_id: string
          valor: boolean
          created_at: string
        }
        Insert: {
          id?: string
          dia_id: string
          item_id: string
          org_id: string
          valor: boolean
          created_at?: string
        }
        Update: {
          id?: string
          dia_id?: string
          item_id?: string
          org_id?: string
          valor?: boolean
          created_at?: string
        }
      }

      m10_cosecha_liberacion: {
        Row: {
          id: string
          rancho_id: string
          fecha: string
          sector: string | null
          cantidad_bandejas: number | null
          lote_liberado: boolean
          numero_comprobante: string | null
          codigo_trazabilidad: string | null
          marca_embalaje: string | null
          destino_final: string | null
          fruta_proceso_kg: number | null
          encargado_liberacion_id: string | null
          hora_inicio_cosecha: string | null
          hora_fin_cosecha: string | null
          verificacion_semanal: boolean
          observaciones: string | null
          org_id: string
          created_at: string
          updated_at: string
          creado_por: string | null
          requiere_correccion: boolean
          comentario_correccion: string | null
          marcado_por: string | null
          marcado_en: string | null
        }
        Insert: {
          id?: string
          rancho_id: string
          fecha: string
          sector?: string | null
          cantidad_bandejas?: number | null
          lote_liberado?: boolean
          numero_comprobante?: string | null
          codigo_trazabilidad?: string | null
          marca_embalaje?: string | null
          destino_final?: string | null
          fruta_proceso_kg?: number | null
          encargado_liberacion_id?: string | null
          hora_inicio_cosecha?: string | null
          hora_fin_cosecha?: string | null
          verificacion_semanal?: boolean
          observaciones?: string | null
          org_id: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          rancho_id?: string
          fecha?: string
          sector?: string | null
          cantidad_bandejas?: number | null
          lote_liberado?: boolean
          numero_comprobante?: string | null
          codigo_trazabilidad?: string | null
          marca_embalaje?: string | null
          destino_final?: string | null
          fruta_proceso_kg?: number | null
          encargado_liberacion_id?: string | null
          hora_inicio_cosecha?: string | null
          hora_fin_cosecha?: string | null
          verificacion_semanal?: boolean
          observaciones?: string | null
          org_id?: string
          created_at?: string
          updated_at?: string
          requiere_correccion?: boolean
          comentario_correccion?: string | null
        }
      }

      m11_preoperacional_registros: {
        Row: {
          id: string
          rancho_id: string
          mes: string
          dia: number
          seccion: SeccionPreoperacional
          item_clave: string
          resultado: ResultadoPreoperacional | null
          codigo_correctivo: string | null
          registrado_por: string | null
          org_id: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          rancho_id: string
          mes: string
          dia: number
          seccion: SeccionPreoperacional
          item_clave: string
          resultado?: ResultadoPreoperacional | null
          codigo_correctivo?: string | null
          registrado_por?: string | null
          org_id: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          rancho_id?: string
          mes?: string
          dia?: number
          seccion?: SeccionPreoperacional
          item_clave?: string
          resultado?: ResultadoPreoperacional | null
          codigo_correctivo?: string | null
          registrado_por?: string | null
          org_id?: string
          created_at?: string
          updated_at?: string
        }
      }

      m11_registro_mensual: {
        Row: {
          id: string
          rancho_id: string
          org_id: string
          mes: string
          realizado_por_nombre: string | null
          responsable_id: string | null
          observaciones: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          rancho_id: string
          org_id: string
          mes: string
          realizado_por_nombre?: string | null
          responsable_id?: string | null
          observaciones?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          rancho_id?: string
          org_id?: string
          mes?: string
          realizado_por_nombre?: string | null
          responsable_id?: string | null
          observaciones?: string | null
          created_at?: string
          updated_at?: string
        }
      }

      m11_dias_inspeccion: {
        Row: {
          id: string
          registro_id: string
          org_id: string
          fecha: string
          created_at: string
        }
        Insert: {
          id?: string
          registro_id: string
          org_id: string
          fecha: string
          created_at?: string
        }
        Update: {
          id?: string
          registro_id?: string
          org_id?: string
          fecha?: string
          created_at?: string
        }
      }

      m11_items_catalogo: {
        Row: {
          id: string
          seccion: string
          seccion_label: string
          item: string
          default_valor: string
          orden: number
        }
        Insert: {
          id?: string
          seccion: string
          seccion_label: string
          item: string
          default_valor: string
          orden: number
        }
        Update: {
          id?: string
          seccion?: string
          seccion_label?: string
          item?: string
          default_valor?: string
          orden?: number
        }
      }

      m11_resultados: {
        Row: {
          id: string
          dia_id: string
          item_id: string
          org_id: string
          valor: string
          codigo_correctivo: string | null
          created_at: string
        }
        Insert: {
          id?: string
          dia_id: string
          item_id: string
          org_id: string
          valor: string
          codigo_correctivo?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          dia_id?: string
          item_id?: string
          org_id?: string
          valor?: string
          codigo_correctivo?: string | null
          created_at?: string
        }
      }

      m12_limpieza_banos: {
        Row: {
          id: string
          rancho_id: string
          fecha: string
          bano_numero: string
          limpieza: boolean
          desinfeccion: boolean
          concentracion_ppm: number
          sustancias: string[]
          abasto_papel: boolean
          succion: boolean
          realizado_por_id: string | null
          firma_semanal: boolean
          org_id: string
          created_at: string
          updated_at: string
          creado_por: string | null
          requiere_correccion: boolean
          comentario_correccion: string | null
          marcado_por: string | null
          marcado_en: string | null
        }
        Insert: {
          id?: string
          rancho_id: string
          fecha: string
          bano_numero: string
          limpieza?: boolean
          desinfeccion?: boolean
          concentracion_ppm?: number
          sustancias?: string[]
          abasto_papel?: boolean
          succion?: boolean
          realizado_por_id?: string | null
          firma_semanal?: boolean
          org_id: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          rancho_id?: string
          fecha?: string
          bano_numero?: string
          limpieza?: boolean
          desinfeccion?: boolean
          concentracion_ppm?: number
          sustancias?: string[]
          abasto_papel?: boolean
          succion?: boolean
          realizado_por_id?: string | null
          firma_semanal?: boolean
          org_id?: string
          created_at?: string
          updated_at?: string
          requiere_correccion?: boolean
          comentario_correccion?: string | null
        }
      }

      m13_reportes: {
        Row: {
          id: string
          org_id: string
          rancho_id: string
          fecha: string
          auditor_nombre: string | null
          realizado_por_id: string | null
          created_at: string
          updated_at: string
          creado_por: string | null
          requiere_correccion: boolean
          comentario_correccion: string | null
          marcado_por: string | null
          marcado_en: string | null
        }
        Insert: {
          id?: string
          org_id: string
          rancho_id: string
          fecha: string
          auditor_nombre?: string | null
          realizado_por_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          rancho_id?: string
          fecha?: string
          auditor_nombre?: string | null
          realizado_por_id?: string | null
          requiere_correccion?: boolean
          comentario_correccion?: string | null
        }
      }

      m13_incidencias: {
        Row: {
          id: string
          reporte_id: string
          org_id: string
          orden: number
          descripcion: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          reporte_id: string
          org_id: string
          orden: number
          descripcion: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          reporte_id?: string
          org_id?: string
          orden?: number
          descripcion?: string
        }
      }

      m13_incidencia_fotos: {
        Row: {
          id: string
          incidencia_id: string
          org_id: string
          storage_path: string
          orden: number
          created_at: string
        }
        Insert: {
          id?: string
          incidencia_id: string
          org_id: string
          storage_path: string
          orden: number
          created_at?: string
        }
        Update: {
          id?: string
          incidencia_id?: string
          org_id?: string
          storage_path?: string
          orden?: number
        }
      }

      m21_estaciones: {
        Row: {
          id: string
          org_id: string
          rancho_id: string
          tipo_trampa: 'cebo' | 'interior' | 'mecanica' | 'luz'
          numero: string
          activo: boolean
          orden: number
          created_at: string
        }
        Insert: {
          id?: string
          org_id: string
          rancho_id: string
          tipo_trampa: 'cebo' | 'interior' | 'mecanica' | 'luz'
          numero: string
          activo?: boolean
          orden?: number
          created_at?: string
        }
        Update: {
          id?: string
          activo?: boolean
          orden?: number
        }
      }

      m21_estado_trampa: {
        Row: { codigo: string; label: string }
        Insert: { codigo: string; label: string }
        Update: { codigo?: string; label?: string }
      }

      m21_condiciones: {
        Row: { codigo: string; label: string }
        Insert: { codigo: string; label: string }
        Update: { codigo?: string; label?: string }
      }

      m21_plagas: {
        Row: { codigo: string; label: string }
        Insert: { codigo: string; label: string }
        Update: { codigo?: string; label?: string }
      }

      m21_revision: {
        Row: {
          id: string
          org_id: string
          rancho_id: string
          fecha: string
          inspector_nombre: string | null
          observaciones: string | null
          created_at: string
        }
        Insert: {
          id?: string
          org_id: string
          rancho_id: string
          fecha: string
          inspector_nombre?: string | null
          observaciones?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          observaciones?: string | null
        }
      }

      m21_resultado: {
        Row: {
          id: string
          revision_id: string
          estacion_id: string
          org_id: string
          tipo_consumo: string | null
          estado_trampa: string | null
          condiciones: string | null
          senalizacion: string | null
          estado_equipo: string | null
          estado_lampara: string | null
          plaga_detectada: string[]
          incidencia_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          revision_id: string
          estacion_id: string
          org_id: string
          tipo_consumo?: string | null
          estado_trampa?: string | null
          condiciones?: string | null
          senalizacion?: string | null
          estado_equipo?: string | null
          estado_lampara?: string | null
          plaga_detectada?: string[]
          incidencia_id?: string | null
          created_at?: string
        }
        Update: {
          tipo_consumo?: string | null
          estado_trampa?: string | null
          condiciones?: string | null
          senalizacion?: string | null
          estado_equipo?: string | null
          estado_lampara?: string | null
          plaga_detectada?: string[]
          incidencia_id?: string | null
        }
      }
      m22_microorganismos: {
        Row: {
          codigo: string
          label: string
          tipo: 'indicador' | 'patogeno'
          orden: number
        }
        Insert: {
          codigo: string
          label: string
          tipo: 'indicador' | 'patogeno'
          orden?: number
        }
        Update: {
          codigo?: string
          label?: string
          tipo?: 'indicador' | 'patogeno'
          orden?: number
        }
      }
      m22_muestras: {
        Row: {
          id: string
          org_id: string
          rancho_id: string
          fecha_muestreo: string
          hora_muestreo: string | null
          descripcion_muestra: string
          microorganismos: string[]
          laboratorio: string
          solicitante_nombre: string
          created_at: string
          creado_por: string | null
        }
        Insert: {
          id?: string
          org_id: string
          rancho_id: string
          fecha_muestreo: string
          hora_muestreo?: string | null
          descripcion_muestra: string
          microorganismos?: string[]
          laboratorio: string
          solicitante_nombre: string
          created_at?: string
        }
        Update: {
          id?: string
          fecha_muestreo?: string
          hora_muestreo?: string | null
          descripcion_muestra?: string
          microorganismos?: string[]
          laboratorio?: string
          solicitante_nombre?: string
        }
      }
      m23_insumos: {
        Row: {
          id: string
          org_id: string
          rancho_id: string
          area: string
          insumo: string
          activo: boolean
          orden: number
          created_at: string
        }
        Insert: {
          id?: string
          org_id: string
          rancho_id: string
          area: string
          insumo: string
          activo?: boolean
          orden?: number
          created_at?: string
        }
        Update: {
          area?: string
          insumo?: string
          activo?: boolean
          orden?: number
        }
      }
      m23_registro_mensual: {
        Row: {
          id: string
          org_id: string
          rancho_id: string
          mes: string
          verifico_nombre: string | null
          autorizo_nombre: string | null
          observaciones: string | null
          created_at: string
          creado_por: string | null
        }
        Insert: {
          id?: string
          org_id: string
          rancho_id: string
          mes: string
          verifico_nombre?: string | null
          autorizo_nombre?: string | null
          observaciones?: string | null
          created_at?: string
        }
        Update: {
          verifico_nombre?: string | null
          autorizo_nombre?: string | null
          observaciones?: string | null
        }
      }
      m23_dias_inspeccion: {
        Row: {
          id: string
          registro_id: string
          org_id: string
          fecha: string
          created_at: string
        }
        Insert: {
          id?: string
          registro_id: string
          org_id: string
          fecha: string
          created_at?: string
        }
        Update: Record<string, never>
      }
      m23_resultados: {
        Row: {
          id: string
          dia_id: string
          insumo_id: string
          org_id: string
          valor: string
          codigo_correctivo: string | null
          incidencia_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          dia_id: string
          insumo_id: string
          org_id: string
          valor: string
          codigo_correctivo?: string | null
          incidencia_id?: string | null
          created_at?: string
        }
        Update: {
          valor?: string
          codigo_correctivo?: string | null
          incidencia_id?: string | null
        }
      }
    }
    Views: {
      v_inventario_saldo_rancho: {
        Row: {
          rancho_id: string
          rancho_nombre: string
          productor_id: string
          producto_id: string
          nombre_comercial: string
          ingrediente_activo: string
          categoria: string
          unidad: string | null
          saldo: number
          ultimo_movimiento: string | null
          num_movimientos: number
        }
      }
      v_inventario_saldo_productor: {
        Row: {
          productor_id: string
          producto_id: string
          nombre_comercial: string
          ingrediente_activo: string
          categoria: string
          unidad: string | null
          saldo: number
          ultimo_movimiento: string | null
        }
      }
      v_inventario_fertilizantes_saldo: {
        Row: {
          rancho_id: string
          rancho_nombre: string | null
          fertilizante_id: string
          org_id: string
          nombre_comercial: string
          ingrediente_activo: string | null
          concentracion: string | null
          unidad: string | null
          saldo: number
          ultimo_movimiento: string | null
          num_movimientos: number
        }
      }
    }
    Functions: {
      saldo_inventario: {
        Args: { p_rancho_id: string; p_producto_id: string }
        Returns: number
      }
      completar_registro_organizacion: {
        Args: { p_nombre_org: string }
        Returns: string
      }
      marcar_correccion: {
        Args: { p_tabla: string; p_registro_id: string; p_requiere: boolean; p_comentario: string }
        Returns: void
      }
      get_mis_modulos: {
        Args: Record<never, never>
        Returns: {
          codigo: string
          clave: string
          nombre: string
          ruta: string
          icono: string
          orden: number
          es_transversal: boolean
          mostrar_en_menu: boolean
          sector_clave: string | null
          sector_nombre: string | null
          sector_orden: number | null
        }[]
      }
    }
    Enums: Record<string, never>
  }
}

// Aliases de conveniencia por tabla
export type Organizacion = Database['public']['Tables']['organizaciones']['Row']
export type OrganizacionInsert = Database['public']['Tables']['organizaciones']['Insert']

export type Profile = Database['public']['Tables']['profiles']['Row']
export type ProfileInsert = Database['public']['Tables']['profiles']['Insert']
export type ProfileUpdate = Database['public']['Tables']['profiles']['Update']

export type Productor = Database['public']['Tables']['productores']['Row']
export type ProductorInsert = Database['public']['Tables']['productores']['Insert']
export type ProductorUpdate = Database['public']['Tables']['productores']['Update']

export type Rancho = Database['public']['Tables']['ranchos']['Row']
export type RanchoInsert = Database['public']['Tables']['ranchos']['Insert']
export type RanchoUpdate = Database['public']['Tables']['ranchos']['Update']

export type CatalogoProducto = Database['public']['Tables']['catalogo_productos']['Row']
export type CatalogoProductoInsert = Database['public']['Tables']['catalogo_productos']['Insert']
export type CatalogoProductoUpdate = Database['public']['Tables']['catalogo_productos']['Update']

export type Aplicacion = Database['public']['Tables']['aplicaciones']['Row']
export type AplicacionInsert = Database['public']['Tables']['aplicaciones']['Insert']
export type AplicacionUpdate = Database['public']['Tables']['aplicaciones']['Update']

export type AplicacionProducto = Database['public']['Tables']['aplicacion_productos']['Row']
export type AplicacionProductoInsert = Database['public']['Tables']['aplicacion_productos']['Insert']
export type AplicacionProductoUpdate = Database['public']['Tables']['aplicacion_productos']['Update']

export type InventarioMovimiento = Database['public']['Tables']['inventario_movimientos']['Row']
export type InventarioMovimientoInsert = Database['public']['Tables']['inventario_movimientos']['Insert']
export type InventarioMovimientoUpdate = Database['public']['Tables']['inventario_movimientos']['Update']

export type InventarioSaldoRancho = Database['public']['Views']['v_inventario_saldo_rancho']['Row']
export type InventarioSaldoProductor = Database['public']['Views']['v_inventario_saldo_productor']['Row']

export type M6Botiquin = Database['public']['Tables']['m6_botiquin']['Row']
export type M6BotiquinInsert = Database['public']['Tables']['m6_botiquin']['Insert']
export type M6BotiquinUpdate = Database['public']['Tables']['m6_botiquin']['Update']

export type FertilizanteOrg = Database['public']['Tables']['fertilizantes_org']['Row']
export type FertilizanteOrgInsert = Database['public']['Tables']['fertilizantes_org']['Insert']
export type InventarioFertilizante = Database['public']['Tables']['inventario_fertilizantes']['Row']
export type InventarioFertilizanteInsert = Database['public']['Tables']['inventario_fertilizantes']['Insert']
export type InventarioFertilizantesSaldo = Database['public']['Views']['v_inventario_fertilizantes_saldo']['Row']

export type M9ItemCatalogo = Database['public']['Tables']['m9_items_catalogo']['Row']
export type M9RegistroMensual = Database['public']['Tables']['m9_registro_mensual']['Row']
export type M9RegistroMensualInsert = Database['public']['Tables']['m9_registro_mensual']['Insert']
export type M9DiaInspeccion = Database['public']['Tables']['m9_dias_inspeccion']['Row']
export type M9DiaInspeccionInsert = Database['public']['Tables']['m9_dias_inspeccion']['Insert']
export type M9Resultado = Database['public']['Tables']['m9_resultados']['Row']
export type M9ResultadoInsert = Database['public']['Tables']['m9_resultados']['Insert']

export type M10CosechaLiberacion = Database['public']['Tables']['m10_cosecha_liberacion']['Row']
export type M10CosechaLiberacionInsert = Database['public']['Tables']['m10_cosecha_liberacion']['Insert']

export type M12LimpiezaBano = Database['public']['Tables']['m12_limpieza_banos']['Row']
export type M12LimpiezaBanoInsert = Database['public']['Tables']['m12_limpieza_banos']['Insert']

export type M11ItemCatalogo = Database['public']['Tables']['m11_items_catalogo']['Row']
export type M11RegistroMensual = Database['public']['Tables']['m11_registro_mensual']['Row']
export type M11RegistroMensualInsert = Database['public']['Tables']['m11_registro_mensual']['Insert']
export type M11DiaInspeccion = Database['public']['Tables']['m11_dias_inspeccion']['Row']
export type M11DiaInspeccionInsert = Database['public']['Tables']['m11_dias_inspeccion']['Insert']
export type M11Resultado = Database['public']['Tables']['m11_resultados']['Row']
export type M11ResultadoInsert = Database['public']['Tables']['m11_resultados']['Insert']

// Tipo compuesto: aplicación con productos (para vistas de detalle)
export type AplicacionConProductos = Aplicacion & {
  aplicacion_productos: (AplicacionProducto & {
    catalogo_productos: CatalogoProducto
  })[]
}

// ── M14 / M15 / M16 — Auditorías internas PrimusGFS ─────────────────────────

export type RespuestaAuditoria = 'cumple' | 'no_cumple' | 'na'
export type EstadoAuditoria = 'borrador' | 'completada'

export interface AuditoriaSeccion {
  id: string
  codigo: string
  nombre: string
  orden: number
}

export interface AuditoriaPregunta {
  id: string
  seccion_id: string
  codigo: string
  texto: string
  puntos: number
  orden: number
  orden_seccion: number
  activo: boolean
}

export interface AuditoriaBase {
  id: string
  org_id: string
  rancho_id: string
  fecha: string
  auditor_nombre: string | null
  puntos_obtenidos: number
  puntos_posibles: number
  porcentaje: number
  estado: EstadoAuditoria
  realizado_por_id: string | null
  created_at: string
  updated_at: string
  creado_por: string | null
  requiere_correccion: boolean
  comentario_correccion: string | null
}

export interface AuditoriaRespuesta {
  id: string
  auditoria_id: string
  org_id: string
  pregunta_id: string
  respuesta: RespuestaAuditoria
  comentario: string | null
  puntos_otorgados: number
}

export interface PortadaGranja {
  tamano_operacion?: { valor: number; unidad: 'Hectáreas' | 'Acres' }
  temporada?: { desde_mes?: string; al_mes?: string; todo_el_ano?: boolean }
  pais_destino?: string
  insumos_agronomicos?: string[]
  uso_agua?: string[]
  uso_fuente_agua?: string[]
  tipo_riego?: string[]
  agua_contacto_comestible?: 'Sí' | 'No'
  agrupacion_productos_agua?: string
  tipo_inodoros?: string[]
  num_trabajadores?: number
  trabajo_en_curso?: 'Sí' | 'No'
  tipo_trabajo?: string[]
  tierra_adyacente?: string
  metodo_cultural?: string
}

export interface PortadaCosecha {
  nombre_campo?: string
  temporada?: { desde_mes?: string; al_mes?: string; todo_el_ano?: boolean }
  num_trabajadores?: number
  proceso_cosecha?: 'Cosecha a mano' | 'Cosecha mecánica'
  procesamiento_en_campo?: 'Sí' | 'No'
  tipo_procesamiento?: string[]
  agua_poscosecha?: { usada?: 'Sí' | 'No'; tipos?: string[] }
  antimicrobiano?: string[]
  equipo_usado?: string[]
}

export interface PortadaBPM {
  temporada?: { desde_mes?: string; al_mes?: string; todo_el_ano?: boolean }
  pais_destino?: string
  num_trabajadores?: number
  max_trabajadores_temporada_alta?: number
  num_lineas?: number
  num_lineas_auditoria?: number
  tamano_instalacion?: { valor: number; unidad: 'Pies Cuadrados' | 'Metros Cuadrados' }
  condiciones_ambientales?: string[]
  antimicrobiano_agua_hielo?: {
    uso?: 'Sí' | 'No' | 'N/A'
    tipos?: string[]
  }
  productos?: string[]
}

// Tipo rico: aplicación con todos los joins necesarios para PDF y Excel
export type AplicacionRica = Aplicacion & {
  ranchos: Rancho
  productores: {
    id: string
    profile_id: string
    profiles: { nombre_completo: string }
  }
  asesor: { nombre_completo: string } | null
  responsable: { nombre_completo: string } | null
  aplicacion_productos: (AplicacionProducto & {
    catalogo_productos: CatalogoProducto
  })[]
}

// ── M25 — Resumen de No-Conformidades ─────────────────────────────────────────

export interface AuditoriaVisita {
  id: string
  org_id: string
  rancho_id: string
  fecha: string
  auditor_nombre: string
  cliente_nombre: string
  pa_pgfs: string | null
  observaciones: string | null
  created_at: string
  updated_at: string
}

export interface NoConformidad {
  ncr: number
  modulo: string
  codigo_pregunta: string
  seccion: string
  texto_pregunta: string
  comentario: string
}

export interface AccionCorrectiva {
  id: string
  org_id: string
  modulo: string
  respuesta_id: string
  visita_id: string | null
  codigo_pregunta: string
  no_conformidad: string | null
  fecha_deteccion: string | null
  causa: string | null
  accion_correctiva: string | null
  accion_preventiva: string | null
  fecha_cumplimiento: string | null
  realizo: string | null
  verifico: string | null
  ishikawa: Record<string, string> | null
  estado: 'abierta' | 'cerrada'
  created_at: string
  updated_at: string
  creado_por: string | null
}

export interface AccionCorrectivaFoto {
  id: string
  org_id: string
  accion_id: string
  tipo: 'no_conformidad' | 'evidencia_correccion'
  storage_path: string
  leyenda: string | null
  created_at: string
}
