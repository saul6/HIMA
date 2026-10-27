import { useState } from 'react'
import { toast } from 'sonner'
import { BottomSheet } from '@/app/components/BottomSheet'
import { nomina } from '@/hooks/useNomina'
import { hoyMX } from '@/lib/fecha'
import { avisarErrorNomina } from '@/lib/nomina/errores'
import { METODOS_PAGO, formatoMoneda, leerMonto, r2 } from '@/lib/nomina/formato'
import { CampoMonto, CampoSeleccion, CampoTexto, CampoTextoLargo, CuerpoSheet, useLlave } from './ui'
import type { CtxSemana } from './contexto'
import type { NomConcepto } from '@/types/nomina.types'

/** Alta de un concepto (bono, descuento por ausencia, reembolso, otros) de la semana. */
export function MovimientoSheet({ ctx, conceptos, onClose }: {
  ctx: CtxSemana
  conceptos: NomConcepto[]
  onClose: () => void
}) {
  const { llave, renovar } = useLlave()
  const disponibles = conceptos.filter(c => !c.archivado)
  const [concepto, setConcepto] = useState('')
  const [monto, setMonto] = useState('')
  const [motivo, setMotivo] = useState('')
  const [fecha, setFecha] = useState(ctx.max >= ctx.min ? ctx.max : ctx.min)
  const [guardando, setGuardando] = useState(false)
  const m = leerMonto(monto)

  async function guardar() {
    setGuardando(true)
    try {
      await nomina.agregarMovimiento({
        trabajador: ctx.trabajadorId, fecha, concepto, monto: r2(m), motivo: motivo.trim(), clientOperationId: llave(),
      })
      renovar()
      toast.success('Concepto agregado')
      await ctx.recargar()
      onClose()
    } catch (e) {
      avisarErrorNomina(e, 'No se pudo guardar el concepto')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <BottomSheet open onClose={onClose} height="85%" title="Nuevo concepto">
      <CuerpoSheet
        textoGuardar="Guardar"
        onGuardar={guardar}
        cargando={guardando}
        deshabilitado={!concepto || !(m > 0) || motivo.trim().length < 3 || !fecha}
      >
        <CampoSeleccion
          etiqueta="Concepto"
          valor={concepto}
          onChange={setConcepto}
          vacio="Selecciona un concepto"
          requerido
          opciones={disponibles.map(c => ({ valor: c.id, etiqueta: c.nombre }))}
        />
        <CampoMonto etiqueta="Monto" valor={monto} onChange={setMonto} requerido />
        <CampoTexto etiqueta="Fecha" tipo="date" valor={fecha} onChange={setFecha} min={ctx.min} max={ctx.max} requerido />
        <CampoTextoLargo etiqueta="Motivo" valor={motivo} onChange={setMotivo} requerido />
      </CuerpoSheet>
    </BottomSheet>
  )
}

/** Anticipo de la semana (antes de aprobar). */
export function AnticipoSheet({ ctx, onClose }: { ctx: CtxSemana; onClose: () => void }) {
  const { llave, renovar } = useLlave()
  const [monto, setMonto] = useState('')
  const [metodo, setMetodo] = useState('efectivo')
  const [fechaPago, setFechaPago] = useState(hoyMX())
  const [referencia, setReferencia] = useState('')
  const [guardando, setGuardando] = useState(false)
  const m = leerMonto(monto)

  async function guardar() {
    setGuardando(true)
    try {
      const r = await nomina.registrarAnticipo({
        trabajador: ctx.trabajadorId, fechaSemana: ctx.lunes, monto: r2(m), metodo, fechaPago, llave: llave(),
        referencia: referencia.trim() || null,
      })
      renovar()
      toast.success(r.repetida ? 'El anticipo ya estaba registrado' : 'Anticipo registrado')
      await ctx.recargar()
      onClose()
    } catch (e) {
      avisarErrorNomina(e, 'No se pudo registrar el anticipo')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <BottomSheet open onClose={onClose} height="85%" title="Registrar anticipo">
      <CuerpoSheet textoGuardar="Registrar anticipo" onGuardar={guardar} cargando={guardando} deshabilitado={!(m > 0) || !fechaPago}>
        <CampoMonto etiqueta="Monto" valor={monto} onChange={setMonto} requerido />
        <CampoSeleccion etiqueta="Método" valor={metodo} onChange={setMetodo} opciones={METODOS_PAGO} requerido />
        <CampoTexto etiqueta="Fecha de pago" tipo="date" valor={fechaPago} onChange={setFechaPago} max={hoyMX()} requerido />
        <CampoTexto etiqueta="Referencia" valor={referencia} onChange={setReferencia} maxLength={80} />
      </CuerpoSheet>
    </BottomSheet>
  )
}

/** Pago de un corte aprobado. El monto no puede pasar del pendiente. */
export function PagoSheet({ ctx, corteId, pendiente, onClose }: {
  ctx: CtxSemana
  corteId: string
  pendiente: number
  onClose: () => void
}) {
  const { llave, renovar } = useLlave()
  const [monto, setMonto] = useState(String(pendiente))
  const [metodo, setMetodo] = useState('efectivo')
  const [fechaPago, setFechaPago] = useState(hoyMX())
  const [referencia, setReferencia] = useState('')
  const [guardando, setGuardando] = useState(false)
  const m = leerMonto(monto)
  const excede = m > pendiente + 0.001

  async function guardar() {
    setGuardando(true)
    try {
      const r = await nomina.registrarPago({
        corte: corteId, monto: r2(m), metodo, fechaPago, llave: llave(), referencia: referencia.trim() || null,
      })
      renovar()
      toast.success(r.repetida ? 'El pago ya estaba registrado' : 'Pago registrado')
      await ctx.recargar()
      onClose()
    } catch (e) {
      avisarErrorNomina(e, 'No se pudo registrar el pago')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <BottomSheet open onClose={onClose} height="85%" title="Registrar pago">
      <CuerpoSheet textoGuardar="Registrar pago" onGuardar={guardar} cargando={guardando} deshabilitado={!(m > 0) || excede || !fechaPago}>
        <p className="text-sm text-muted-foreground">Pendiente: {formatoMoneda(pendiente, ctx.moneda)}</p>
        <CampoMonto
          etiqueta="Monto"
          valor={monto}
          onChange={setMonto}
          requerido
          error={excede ? 'No puede ser mayor al pendiente' : undefined}
        />
        <CampoSeleccion etiqueta="Método" valor={metodo} onChange={setMetodo} opciones={METODOS_PAGO} requerido />
        <CampoTexto etiqueta="Fecha de pago" tipo="date" valor={fechaPago} onChange={setFechaPago} max={hoyMX()} requerido />
        <CampoTexto etiqueta="Referencia" valor={referencia} onChange={setReferencia} maxLength={80} />
      </CuerpoSheet>
    </BottomSheet>
  )
}

/** Reversión de un pago o anticipo (monto ≤ lo no revertido). */
export function ReversionSheet({ ctx, pagoId, maximo, onClose }: {
  ctx: CtxSemana
  pagoId: string
  maximo: number
  onClose: () => void
}) {
  const { llave, renovar } = useLlave()
  const [monto, setMonto] = useState(String(maximo))
  const [motivo, setMotivo] = useState('')
  const [guardando, setGuardando] = useState(false)
  const m = leerMonto(monto)
  const excede = m > maximo + 0.001

  async function guardar() {
    setGuardando(true)
    try {
      const r = await nomina.revertirPago({ pago: pagoId, monto: r2(m), motivo: motivo.trim(), llave: llave() })
      renovar()
      toast.success(r.repetida ? 'La reversión ya estaba registrada' : 'Reversión registrada')
      await ctx.recargar()
      onClose()
    } catch (e) {
      avisarErrorNomina(e, 'No se pudo revertir el pago')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <BottomSheet open onClose={onClose} height="85%" title="Revertir pago">
      <CuerpoSheet textoGuardar="Revertir" onGuardar={guardar} cargando={guardando} deshabilitado={!(m > 0) || excede || motivo.trim().length < 3}>
        <p className="text-sm text-muted-foreground">Máximo a revertir: {formatoMoneda(maximo, ctx.moneda)}</p>
        <CampoMonto
          etiqueta="Monto"
          valor={monto}
          onChange={setMonto}
          requerido
          error={excede ? 'No puede ser mayor a lo no revertido' : undefined}
        />
        <CampoTextoLargo etiqueta="Motivo" valor={motivo} onChange={setMotivo} requerido />
      </CuerpoSheet>
    </BottomSheet>
  )
}

/** Ajuste a favor / en contra sobre un corte aprobado; se aplica en una semana posterior. */
export function AjusteSheet({ ctx, corteId, onClose }: { ctx: CtxSemana; corteId: string; onClose: () => void }) {
  const { llave, renovar } = useLlave()
  const [tipo, setTipo] = useState<'a_favor' | 'en_contra'>('a_favor')
  const [monto, setMonto] = useState('')
  const [motivo, setMotivo] = useState('')
  const [guardando, setGuardando] = useState(false)
  const m = leerMonto(monto)

  async function guardar() {
    setGuardando(true)
    try {
      await nomina.crearAjuste({ corteOrigen: corteId, tipo, monto: r2(m), motivo: motivo.trim(), llave: llave() })
      renovar()
      toast.success('Ajuste creado')
      await ctx.recargar()
      onClose()
    } catch (e) {
      avisarErrorNomina(e, 'No se pudo crear el ajuste')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <BottomSheet open onClose={onClose} height="85%" title="Ajuste al corte">
      <CuerpoSheet textoGuardar="Crear ajuste" onGuardar={guardar} cargando={guardando} deshabilitado={!(m > 0) || motivo.trim().length < 5}>
        <p className="text-sm text-muted-foreground">Se aplicará en la siguiente semana que se apruebe.</p>
        <CampoSeleccion
          etiqueta="Tipo"
          valor={tipo}
          onChange={v => setTipo(v as 'a_favor' | 'en_contra')}
          opciones={[
            { valor: 'a_favor', etiqueta: 'A favor del trabajador' },
            { valor: 'en_contra', etiqueta: 'En contra del trabajador' },
          ]}
          requerido
        />
        <CampoMonto etiqueta="Monto" valor={monto} onChange={setMonto} requerido />
        <CampoTextoLargo etiqueta="Motivo (mínimo 5 caracteres)" valor={motivo} onChange={setMotivo} requerido />
      </CuerpoSheet>
    </BottomSheet>
  )
}
