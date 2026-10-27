import { useState } from 'react'
import { toast } from 'sonner'
import { BottomSheet } from '@/app/components/BottomSheet'
import {
  nomina, useNomEmpleadosM77, useNomTrabajadores, useNomUsuariosOrg,
} from '@/hooks/useNomina'
import { hoyMX } from '@/lib/fecha'
import { avisarErrorNomina } from '@/lib/nomina/errores'
import { leerMonto, r2, sumarDias } from '@/lib/nomina/formato'
import { CampoMonto, CampoSeleccion, CampoTexto, CampoTextoLargo, CuerpoSheet } from './ui'
import type {
  ModalidadPago, NomActividadCatalogo, NomPerfilPago, NomTrabajador,
} from '@/types/nomina.types'

export const ETIQUETA_MODALIDAD: Record<ModalidadPago, string> = {
  fijo: 'Sueldo fijo semanal',
  jornada: 'Por jornada',
  hora: 'Por hora',
  ninguna: 'Solo actividades',
}

/** Alta / edición de un trabajador. */
export function TrabajadorSheet({ trabajador, onClose, onGuardado }: {
  trabajador?: NomTrabajador
  onClose: () => void
  onGuardado: (id: string) => void | Promise<void>
}) {
  const { datos: usuarios } = useNomUsuariosOrg()
  const { datos: todos } = useNomTrabajadores()
  const { datos: empleados } = useNomEmpleadosM77()
  const [codigo, setCodigo] = useState(trabajador?.codigo ?? '')
  const [nombre, setNombre] = useState(trabajador?.nombre ?? '')
  const [puesto, setPuesto] = useState(trabajador?.puesto ?? '')
  const [profileId, setProfileId] = useState(trabajador?.profile_id ?? '')
  const [empleadoId, setEmpleadoId] = useState(trabajador?.m77_empleado_id ?? '')
  const [activo, setActivo] = useState(trabajador?.activo ?? true)
  const [alta, setAlta] = useState(trabajador?.fecha_alta ?? hoyMX())
  const [baja, setBaja] = useState(trabajador?.fecha_baja ?? '')
  const [notas, setNotas] = useState(trabajador?.notas ?? '')
  const [guardando, setGuardando] = useState(false)

  // Usuarios que no están ligados a otro trabajador.
  const ocupados = new Set(todos.filter(t => t.profile_id && t.id !== trabajador?.id).map(t => t.profile_id))
  const usuariosLibres = usuarios.filter(u => !ocupados.has(u.id))

  async function guardar() {
    setGuardando(true)
    try {
      const id = await nomina.guardarTrabajador({
        id: trabajador?.id ?? null,
        codigo: codigo.trim(),
        nombre: nombre.trim(),
        puesto: puesto.trim() || null,
        profileId: profileId || null,
        m77EmpleadoId: empleadoId || null,
        activo,
        fechaAlta: alta || null,
        fechaBaja: baja || null,
        notas: notas.trim() || null,
      })
      toast.success(trabajador ? 'Trabajador actualizado' : 'Trabajador creado')
      await onGuardado(id)
      onClose()
    } catch (e) {
      avisarErrorNomina(e, 'No se pudo guardar el trabajador')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <BottomSheet open onClose={onClose} height="85%" title={trabajador ? 'Editar trabajador' : 'Nuevo trabajador'}>
      <CuerpoSheet textoGuardar="Guardar" onGuardar={guardar} cargando={guardando} deshabilitado={!codigo.trim() || !nombre.trim() || !alta}>
        <CampoTexto etiqueta="Código" valor={codigo} onChange={setCodigo} requerido maxLength={20} />
        <CampoTexto etiqueta="Nombre" valor={nombre} onChange={setNombre} requerido maxLength={120} />
        <CampoTexto etiqueta="Puesto" valor={puesto} onChange={setPuesto} maxLength={80} />
        <CampoSeleccion
          etiqueta="Usuario de M.A.D.Y. (para ver sus vouchers)"
          valor={profileId}
          onChange={setProfileId}
          vacio="Sin usuario"
          opciones={usuariosLibres.map(u => ({ valor: u.id, etiqueta: u.nombre_completo ?? 'Sin nombre' }))}
        />
        {empleados.length > 0 && (
          <CampoSeleccion
            etiqueta="Empleado de M77"
            valor={empleadoId}
            onChange={setEmpleadoId}
            vacio="Sin empleado ligado"
            opciones={empleados.map(e => ({ valor: e.id, etiqueta: e.nombre }))}
          />
        )}
        <CampoTexto etiqueta="Fecha de alta" tipo="date" valor={alta} onChange={setAlta} requerido />
        <CampoTexto etiqueta="Fecha de baja" tipo="date" valor={baja} onChange={setBaja} />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={activo} onChange={e => setActivo(e.target.checked)} className="size-4" />
          Activo
        </label>
        <CampoTextoLargo etiqueta="Notas" valor={notas} onChange={setNotas} />
      </CuerpoSheet>
    </BottomSheet>
  )
}

/** Cambio de modalidad base desde una fecha (cierra la versión vigente). */
export function PerfilPagoSheet({ trabajadorId, ultima, onClose, onGuardado }: {
  trabajadorId: string
  ultima?: NomPerfilPago
  onClose: () => void
  onGuardado: () => void | Promise<void>
}) {
  const [modalidad, setModalidad] = useState<ModalidadPago>(ultima?.modalidad ?? 'fijo')
  const [monto, setMonto] = useState(() => {
    const v = ultima?.modalidad === 'fijo' ? ultima.sueldo_semanal
      : ultima?.modalidad === 'jornada' ? ultima.tarifa_jornada
      : ultima?.modalidad === 'hora' ? ultima.tarifa_hora : null
    return v != null ? String(v) : ''
  })
  const minimo = ultima ? sumarDias(ultima.vigente_desde, 1) : undefined
  const hoy = hoyMX()
  const [desde, setDesde] = useState(minimo && minimo > hoy ? minimo : hoy)
  const [motivo, setMotivo] = useState('')
  const [guardando, setGuardando] = useState(false)
  const m = leerMonto(monto)
  const pideMonto = modalidad !== 'ninguna'

  async function guardar() {
    setGuardando(true)
    try {
      await nomina.fijarPerfilPago({
        trabajador: trabajadorId,
        modalidad,
        sueldoSemanal: modalidad === 'fijo' ? r2(m) : null,
        tarifaJornada: modalidad === 'jornada' ? r2(m) : null,
        tarifaHora: modalidad === 'hora' ? r2(m) : null,
        desde,
        motivo: motivo.trim() || null,
      })
      toast.success('Modalidad actualizada')
      await onGuardado()
      onClose()
    } catch (e) {
      avisarErrorNomina(e, 'No se pudo cambiar la modalidad')
    } finally {
      setGuardando(false)
    }
  }

  const etiquetaMonto = modalidad === 'fijo' ? 'Sueldo semanal' : modalidad === 'jornada' ? 'Tarifa por jornada' : 'Tarifa por hora'
  return (
    <BottomSheet open onClose={onClose} height="85%" title="Cambiar modalidad">
      <CuerpoSheet textoGuardar="Guardar" onGuardar={guardar} cargando={guardando} deshabilitado={!desde || (pideMonto && !(m > 0))}>
        <CampoSeleccion
          etiqueta="Modalidad"
          valor={modalidad}
          onChange={v => setModalidad(v as ModalidadPago)}
          requerido
          opciones={(Object.keys(ETIQUETA_MODALIDAD) as ModalidadPago[]).map(k => ({ valor: k, etiqueta: ETIQUETA_MODALIDAD[k] }))}
        />
        {pideMonto && <CampoMonto etiqueta={etiquetaMonto} valor={monto} onChange={setMonto} requerido />}
        <CampoTexto etiqueta="Desde" tipo="date" valor={desde} onChange={setDesde} min={minimo} requerido />
        <CampoTextoLargo etiqueta="Motivo" valor={motivo} onChange={setMotivo} />
      </CuerpoSheet>
    </BottomSheet>
  )
}

/**
 * Tarifa de una actividad desde una fecha. Con `trabajadorId` es tarifa personal; sin él, la general.
 * `quitar` deja la actividad sin tarifa desde esa fecha (monto vacío).
 */
export function TarifaSheet({ trabajadorId, actividades, actividadId, quitar = false, onClose, onGuardado }: {
  trabajadorId: string | null
  actividades: NomActividadCatalogo[]
  actividadId?: string
  quitar?: boolean
  onClose: () => void
  onGuardado: () => void | Promise<void>
}) {
  const [actividad, setActividad] = useState(actividadId ?? '')
  const [monto, setMonto] = useState('')
  const [desde, setDesde] = useState(hoyMX())
  const [motivo, setMotivo] = useState('')
  const [guardando, setGuardando] = useState(false)
  const m = leerMonto(monto)
  const personal = trabajadorId !== null

  async function guardar() {
    setGuardando(true)
    try {
      await nomina.fijarTarifa({
        actividad, monto: quitar ? null : r2(m), trabajador: trabajadorId, desde, motivo: motivo.trim() || null,
      })
      toast.success(quitar ? 'Tarifa quitada' : 'Tarifa guardada')
      await onGuardado()
      onClose()
    } catch (e) {
      avisarErrorNomina(e, 'No se pudo guardar la tarifa')
    } finally {
      setGuardando(false)
    }
  }

  const titulo = quitar ? (personal ? 'Quitar tarifa personal' : 'Quitar tarifa') : personal ? 'Fijar tarifa personal' : 'Nueva tarifa'
  return (
    <BottomSheet open onClose={onClose} height="85%" title={titulo}>
      <CuerpoSheet
        textoGuardar={quitar ? 'Quitar tarifa' : 'Guardar tarifa'}
        onGuardar={guardar}
        cargando={guardando}
        deshabilitado={!actividad || !desde || (!quitar && !(m > 0))}
      >
        <CampoSeleccion
          etiqueta="Actividad"
          valor={actividad}
          onChange={setActividad}
          vacio="Selecciona una actividad"
          disabled={!!actividadId}
          requerido
          opciones={actividades.filter(a => a.modo === 'cantidad' && (!a.archivada || a.id === actividadId))
            .map(a => ({ valor: a.id, etiqueta: a.nombre }))}
        />
        {!quitar && <CampoMonto etiqueta="Monto por unidad" valor={monto} onChange={setMonto} requerido />}
        <CampoTexto etiqueta={quitar ? 'Sin tarifa desde' : 'Vigente desde'} tipo="date" valor={desde} onChange={setDesde} requerido />
        <CampoTextoLargo etiqueta="Motivo" valor={motivo} onChange={setMotivo} />
        {personal && !quitar && (
          <p className="text-xs text-muted-foreground">La tarifa personal gana sobre la tarifa general. Los cortes aprobados no cambian.</p>
        )}
      </CuerpoSheet>
    </BottomSheet>
  )
}
