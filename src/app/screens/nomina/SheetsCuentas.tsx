import { useState } from 'react'
import { toast } from 'sonner'
import { BottomSheet } from '@/app/components/BottomSheet'
import { nomina } from '@/hooks/useNomina'
import { hoyMX } from '@/lib/fecha'
import { avisarErrorNomina } from '@/lib/nomina/errores'
import { METODOS_PAGO, formatoMoneda, leerMonto, r2 } from '@/lib/nomina/formato'
import { CampoMonto, CampoSeleccion, CampoTexto, CampoTextoLargo, CuerpoSheet, useLlave } from './ui'

interface Base { trabajadorId: string; moneda: string; onClose: () => void; onGuardado: () => Promise<void> | void }

/** Préstamo manual: sale dinero hoy; cada semana se decide cuánto se descuenta. */
export function PrestarSheet({ trabajadorId, moneda, onClose, onGuardado }: Base) {
  const { llave, renovar } = useLlave()
  const [monto, setMonto] = useState('')
  const [metodo, setMetodo] = useState('efectivo')
  const [fecha, setFecha] = useState(hoyMX())
  const [referencia, setReferencia] = useState('')
  const [nota, setNota] = useState('')
  const [guardando, setGuardando] = useState(false)
  const m = leerMonto(monto)

  async function guardar() {
    setGuardando(true)
    try {
      const r = await nomina.otorgarPrestamo({
        trabajador: trabajadorId, monto: r2(m), metodo, fecha, llave: llave(),
        referencia: referencia.trim() || null, nota: nota.trim() || null,
      })
      renovar()
      toast.success(r.repetida ? 'El préstamo ya estaba registrado' : 'Préstamo registrado')
      await onGuardado()
      onClose()
    } catch (e) {
      avisarErrorNomina(e, 'No se pudo registrar el préstamo')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <BottomSheet open onClose={onClose} height="85%" title="Prestar">
      <CuerpoSheet textoGuardar="Registrar préstamo" onGuardar={guardar} cargando={guardando} deshabilitado={!(m > 0) || !fecha}>
        <p className="text-sm text-muted-foreground">Sin interés. Cada semana decides cuánto se descuenta.</p>
        <CampoMonto etiqueta="Monto" valor={monto} onChange={setMonto} moneda={moneda} requerido />
        <CampoSeleccion etiqueta="Método" valor={metodo} onChange={setMetodo} opciones={METODOS_PAGO} requerido />
        <CampoTexto etiqueta="Fecha" tipo="date" valor={fecha} onChange={setFecha} max={hoyMX()} requerido />
        <CampoTexto etiqueta="Referencia" valor={referencia} onChange={setReferencia} maxLength={80} />
        <CampoTextoLargo etiqueta="Nota" valor={nota} onChange={setNota} maxLength={500} />
      </CuerpoSheet>
    </BottomSheet>
  )
}

/** Abono en efectivo (u otro método) del trabajador a un préstamo. */
export function AbonarSheet({ prestamoId, saldo, moneda, onClose, onGuardado }: {
  prestamoId: string; saldo: number; moneda: string; onClose: () => void; onGuardado: () => Promise<void> | void
}) {
  const { llave, renovar } = useLlave()
  const [monto, setMonto] = useState('')
  const [metodo, setMetodo] = useState('efectivo')
  const [fecha, setFecha] = useState(hoyMX())
  const [referencia, setReferencia] = useState('')
  const [guardando, setGuardando] = useState(false)
  const m = leerMonto(monto)
  const excede = m > saldo + 0.001

  async function guardar() {
    setGuardando(true)
    try {
      const r = await nomina.abonarPrestamo({
        prestamo: prestamoId, monto: r2(m), metodo, fecha, llave: llave(), referencia: referencia.trim() || null,
      })
      renovar()
      toast.success(r.repetida ? 'El abono ya estaba registrado' : 'Abono registrado')
      await onGuardado()
      onClose()
    } catch (e) {
      avisarErrorNomina(e, 'No se pudo registrar el abono')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <BottomSheet open onClose={onClose} height="85%" title="Abonar al préstamo">
      <CuerpoSheet textoGuardar="Registrar abono" onGuardar={guardar} cargando={guardando} deshabilitado={!(m > 0) || excede || !fecha}>
        <p className="text-sm text-muted-foreground">Saldo: {formatoMoneda(saldo, moneda)}</p>
        <CampoMonto
          etiqueta="Monto" valor={monto} onChange={setMonto} moneda={moneda} requerido
          error={excede ? 'No puede ser mayor al saldo' : undefined}
        />
        <CampoSeleccion etiqueta="Método" valor={metodo} onChange={setMetodo} opciones={METODOS_PAGO} requerido />
        <CampoTexto etiqueta="Fecha" tipo="date" valor={fecha} onChange={setFecha} max={hoyMX()} requerido />
        <CampoTexto etiqueta="Referencia" valor={referencia} onChange={setReferencia} maxLength={80} />
      </CuerpoSheet>
    </BottomSheet>
  )
}

/** Monto semanal de ahorro (vacío = quitar desde esa fecha). */
export function AhorroSheet({ trabajadorId, vigente, moneda, onClose, onGuardado }: Base & { vigente: number | null }) {
  const [monto, setMonto] = useState(vigente != null ? String(vigente) : '')
  const [desde, setDesde] = useState(hoyMX())
  const [motivo, setMotivo] = useState('')
  const [guardando, setGuardando] = useState(false)
  const quitar = monto.trim() === ''
  const m = quitar ? null : leerMonto(monto)

  async function guardar() {
    setGuardando(true)
    try {
      await nomina.fijarAhorro({
        trabajador: trabajadorId, monto: m == null ? null : r2(m), desde, motivo: motivo.trim() || null,
      })
      toast.success(quitar ? 'Ahorro quitado' : 'Ahorro actualizado')
      await onGuardado()
      onClose()
    } catch (e) {
      avisarErrorNomina(e, 'No se pudo guardar el ahorro')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <BottomSheet open onClose={onClose} height="85%" title="Ahorro semanal">
      <CuerpoSheet
        textoGuardar={quitar ? 'Quitar ahorro' : 'Guardar'}
        onGuardar={guardar}
        cargando={guardando}
        deshabilitado={(m != null && !(m >= 0)) || !desde}
      >
        <p className="text-sm text-muted-foreground">Se descuenta cada semana al hacer el corte, sin dejar el neto negativo.</p>
        <CampoMonto etiqueta="Monto semanal" valor={monto} onChange={setMonto} moneda={moneda} opcional placeholder="Vacío = quitar" />
        <CampoTexto etiqueta="Desde" tipo="date" valor={desde} onChange={setDesde} requerido />
        <CampoTextoLargo etiqueta="Motivo" valor={motivo} onChange={setMotivo} />
      </CuerpoSheet>
    </BottomSheet>
  )
}

/** Devolución del ahorro acumulado al trabajador. */
export function DevolverAhorroSheet({ trabajadorId, saldo, moneda, onClose, onGuardado }: Base & { saldo: number }) {
  const { llave, renovar } = useLlave()
  const [monto, setMonto] = useState(String(saldo))
  const [metodo, setMetodo] = useState('efectivo')
  const [fecha, setFecha] = useState(hoyMX())
  const [referencia, setReferencia] = useState('')
  const [motivo, setMotivo] = useState('')
  const [guardando, setGuardando] = useState(false)
  const m = leerMonto(monto)
  const excede = m > saldo + 0.001

  async function guardar() {
    setGuardando(true)
    try {
      await nomina.devolverAhorro({
        trabajador: trabajadorId, monto: r2(m), metodo, fecha, llave: llave(),
        referencia: referencia.trim() || null, motivo: motivo.trim() || null,
      })
      renovar()
      toast.success('Devolución registrada')
      await onGuardado()
      onClose()
    } catch (e) {
      avisarErrorNomina(e, 'No se pudo devolver el ahorro')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <BottomSheet open onClose={onClose} height="85%" title="Devolver ahorro">
      <CuerpoSheet textoGuardar="Devolver" onGuardar={guardar} cargando={guardando} deshabilitado={!(m > 0) || excede || !fecha}>
        <p className="text-sm text-muted-foreground">Ahorro acumulado: {formatoMoneda(saldo, moneda)}</p>
        <CampoMonto
          etiqueta="Monto" valor={monto} onChange={setMonto} moneda={moneda} requerido
          error={excede ? 'No puede ser mayor al ahorro acumulado' : undefined}
        />
        <CampoSeleccion etiqueta="Método" valor={metodo} onChange={setMetodo} opciones={METODOS_PAGO} requerido />
        <CampoTexto etiqueta="Fecha" tipo="date" valor={fecha} onChange={setFecha} max={hoyMX()} requerido />
        <CampoTexto etiqueta="Referencia" valor={referencia} onChange={setReferencia} maxLength={80} />
        <CampoTextoLargo etiqueta="Motivo" valor={motivo} onChange={setMotivo} />
      </CuerpoSheet>
    </BottomSheet>
  )
}

/** Libera comisión acumulada en una semana (entra al neto de esa semana). */
export function LiberarComisionSheet({ trabajadorId, disponible, moneda, fechaSemana, onClose, onGuardado }: Base & {
  disponible: number
  /** Si viene, la semana ya está fija (se llama desde la semana del trabajador). */
  fechaSemana?: string
}) {
  const { llave, renovar } = useLlave()
  const [semana, setSemana] = useState(fechaSemana ?? hoyMX())
  const [monto, setMonto] = useState(String(disponible))
  const [motivo, setMotivo] = useState('')
  const [guardando, setGuardando] = useState(false)
  const m = leerMonto(monto)
  const excede = m > disponible + 0.001

  async function guardar() {
    setGuardando(true)
    try {
      await nomina.liberarComision({
        trabajador: trabajadorId, fechaSemana: semana, monto: r2(m), motivo: motivo.trim() || null, llave: llave(),
      })
      renovar()
      toast.success('Comisión liberada')
      await onGuardado()
      onClose()
    } catch (e) {
      avisarErrorNomina(e, 'No se pudo liberar la comisión')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <BottomSheet open onClose={onClose} height="85%" title="Liberar comisión">
      <CuerpoSheet textoGuardar="Liberar" onGuardar={guardar} cargando={guardando} deshabilitado={!(m > 0) || excede || !semana}>
        <p className="text-sm text-muted-foreground">Disponible por liberar: {formatoMoneda(disponible, moneda)}</p>
        <CampoMonto
          etiqueta="Monto" valor={monto} onChange={setMonto} moneda={moneda} requerido
          error={excede ? 'No puede ser mayor a lo disponible' : undefined}
        />
        <CampoTexto
          etiqueta="Semana en que se paga" tipo="date" valor={semana} onChange={setSemana} disabled={!!fechaSemana}
          ayuda="Cualquier día de la semana en que entrará al neto." requerido
        />
        <CampoTextoLargo etiqueta="Motivo" valor={motivo} onChange={setMotivo} />
      </CuerpoSheet>
    </BottomSheet>
  )
}
