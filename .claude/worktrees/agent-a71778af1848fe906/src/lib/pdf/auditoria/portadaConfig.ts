// Human-readable labels for portada jsonb fields (M15 and M16).
// Values come from the DB as-is. Arrays are joined with ", ".
// Empty/missing fields are omitted (caller skips entries with empty valor).

export interface PortadaLinea {
  label: string
  valor: string
}

function arr(v: unknown): string {
  if (!v) return ''
  if (Array.isArray(v)) return (v as string[]).join(', ')
  return String(v)
}

function temporadaStr(t: { desde_mes?: string; al_mes?: string; todo_el_ano?: boolean } | undefined): string {
  if (!t) return ''
  if (t.todo_el_ano) return 'Todo el año'
  const desde = t.desde_mes ?? ''
  const al = t.al_mes ?? ''
  if (!desde && !al) return ''
  return `${desde || '?'} a ${al || '?'}`
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function formatPortadaM15(portada: Record<string, unknown>): PortadaLinea[] {
  const lineas: PortadaLinea[] = []
  const p = portada

  if (p.tamano_operacion) {
    const t = p.tamano_operacion as { valor?: number; unidad?: string }
    if (t.valor) lineas.push({ label: 'Tamaño de operación', valor: `${t.valor} ${t.unidad ?? ''}`.trim() })
  }

  const tempStr = temporadaStr(p.temporada as any)
  if (tempStr) lineas.push({ label: 'Temporada', valor: tempStr })

  if (p.pais_destino) lineas.push({ label: 'País de destino', valor: String(p.pais_destino) })

  const insumos = arr(p.insumos_agronomicos)
  if (insumos) lineas.push({ label: 'Insumos agronómicos', valor: insumos })

  const usoAgua = arr(p.uso_agua)
  if (usoAgua) lineas.push({ label: 'Fuentes de agua', valor: usoAgua })

  const usoFuente = arr(p.uso_fuente_agua)
  if (usoFuente) lineas.push({ label: 'Uso de fuente de agua', valor: usoFuente })

  const tipoRiego = arr(p.tipo_riego)
  if (tipoRiego) lineas.push({ label: 'Tipo de riego', valor: tipoRiego })

  if (p.agua_contacto_comestible)
    lineas.push({ label: 'Agua contacto comestible', valor: String(p.agua_contacto_comestible) })

  if (p.agrupacion_productos_agua)
    lineas.push({ label: 'Agrupación productos / agua', valor: String(p.agrupacion_productos_agua) })

  const inodoros = arr(p.tipo_inodoros)
  if (inodoros) lineas.push({ label: 'Tipo de inodoros', valor: inodoros })

  if (p.num_trabajadores !== undefined && p.num_trabajadores !== null)
    lineas.push({ label: 'Núm. trabajadores', valor: String(p.num_trabajadores) })

  if (p.trabajo_en_curso)
    lineas.push({ label: 'Trabajo en curso', valor: String(p.trabajo_en_curso) })

  const tipoTrabajo = arr(p.tipo_trabajo)
  if (tipoTrabajo) lineas.push({ label: 'Tipo de trabajo', valor: tipoTrabajo })

  if (p.tierra_adyacente)
    lineas.push({ label: 'Tierra adyacente', valor: String(p.tierra_adyacente) })

  if (p.metodo_cultural)
    lineas.push({ label: 'Método cultural', valor: String(p.metodo_cultural) })

  return lineas
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function formatPortadaM17(portada: Record<string, unknown>): PortadaLinea[] {
  const lineas: PortadaLinea[] = []
  const p = portada

  const tempStr = temporadaStr(p.temporada as any)
  if (tempStr) lineas.push({ label: 'Temporada', valor: tempStr })

  if (p.pais_destino) lineas.push({ label: 'País de destino', valor: String(p.pais_destino) })

  if (p.num_trabajadores !== undefined && p.num_trabajadores !== null)
    lineas.push({ label: 'Núm. trabajadores', valor: String(p.num_trabajadores) })

  if (p.max_trabajadores_temporada_alta !== undefined && p.max_trabajadores_temporada_alta !== null)
    lineas.push({ label: 'Máx. trabajadores (temp. alta)', valor: String(p.max_trabajadores_temporada_alta) })

  if (p.num_lineas !== undefined && p.num_lineas !== null)
    lineas.push({ label: 'Núm. líneas de operación', valor: String(p.num_lineas) })

  if (p.num_lineas_auditoria !== undefined && p.num_lineas_auditoria !== null)
    lineas.push({ label: 'Núm. líneas en auditoría', valor: String(p.num_lineas_auditoria) })

  if (p.tamano_instalacion) {
    const t = p.tamano_instalacion as { valor?: number; unidad?: string }
    if (t.valor) lineas.push({ label: 'Tamaño de instalación', valor: `${t.valor} ${t.unidad ?? ''}`.trim() })
  }

  const condiciones = arr(p.condiciones_ambientales)
  if (condiciones) lineas.push({ label: 'Condiciones ambientales', valor: condiciones })

  if (p.antimicrobiano_agua_hielo) {
    const am = p.antimicrobiano_agua_hielo as { uso?: string; tipos?: string[] }
    if (am.uso) {
      lineas.push({ label: 'Antimicrobiano agua/hielo', valor: String(am.uso) })
      const tipos = arr(am.tipos)
      if (tipos) lineas.push({ label: 'Tipos de antimicrobiano', valor: tipos })
    }
  }

  const productos = arr(p.productos)
  if (productos) lineas.push({ label: 'Productos manejados', valor: productos })

  return lineas
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function formatPortadaM16(portada: Record<string, unknown>): PortadaLinea[] {
  const lineas: PortadaLinea[] = []
  const p = portada

  if (p.nombre_campo)
    lineas.push({ label: 'Nombre del campo', valor: String(p.nombre_campo) })

  const tempStr = temporadaStr(p.temporada as any)
  if (tempStr) lineas.push({ label: 'Temporada', valor: tempStr })

  if (p.num_trabajadores !== undefined && p.num_trabajadores !== null)
    lineas.push({ label: 'Núm. trabajadores', valor: String(p.num_trabajadores) })

  if (p.proceso_cosecha)
    lineas.push({ label: 'Proceso de cosecha', valor: String(p.proceso_cosecha) })

  if (p.procesamiento_en_campo)
    lineas.push({ label: 'Procesamiento en campo', valor: String(p.procesamiento_en_campo) })

  const tipoProcesamiento = arr(p.tipo_procesamiento)
  if (tipoProcesamiento) lineas.push({ label: 'Tipo de procesamiento', valor: tipoProcesamiento })

  if (p.agua_poscosecha) {
    const aw = p.agua_poscosecha as { usada?: string; tipos?: string[] }
    if (aw.usada) {
      lineas.push({ label: 'Agua poscosecha', valor: String(aw.usada) })
      const tiposAgua = arr(aw.tipos)
      if (tiposAgua) lineas.push({ label: 'Usos del agua poscosecha', valor: tiposAgua })
    }
  }

  const antimicrobiano = arr(p.antimicrobiano)
  if (antimicrobiano) lineas.push({ label: 'Antimicrobiano', valor: antimicrobiano })

  const equipo = arr(p.equipo_usado)
  if (equipo) lineas.push({ label: 'Equipo usado', valor: equipo })

  return lineas
}
