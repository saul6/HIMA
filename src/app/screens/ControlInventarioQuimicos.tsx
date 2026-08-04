import { useState, useEffect, useMemo } from 'react'
import {
  ChevronLeft, Plus, Settings, FileDown, X, Loader2, AlertTriangle,
} from 'lucide-react'
import { useNavigate } from 'react-router'
import { BottomSheet } from '@/app/components/BottomSheet'
import { toast } from 'sonner'
import { useAuthContext } from '@/context/AuthContext'
import { useModulosContext } from '@/context/ModulosContext'
import { useRanchos } from '@/hooks/useRanchos'
import { supabase } from '@/lib/supabase'
import {
  useM24Saldos,
  useM24Movimientos,
  useM24QuimicosRancho,
  type M24SaldoQuimico,
} from '@/hooks/useM24QuimicosInventario'
import { generarInventarioQuimicosPDF } from '@/lib/pdf/m24/generarInventarioQuimicosPDF'
import { generarInventarioQuimicosConsolidadoPDF } from '@/lib/pdf/m24/generarInventarioQuimicosConsolidadoPDF'

const hoy = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' })

function formatFecha(iso: string): string {
  try {
    return new Date(iso + 'T12:00:00').toLocaleDateString('es-MX', {
      day: 'numeric', month: 'short', year: 'numeric',
    })
  } catch { return iso }
}

type MovForm = {
  tipo: 'entrada' | 'salida'
  cantidad: string
  persona_solicita: string
  area: string
  fecha: string
}

type QuimicoForm = {
  nombre: string
  unidad: string
  stock_minimo: string
}

const MOV_INICIAL: MovForm = {
  tipo: 'entrada',
  cantidad: '',
  persona_solicita: '',
  area: '',
  fecha: hoy(),
}

const QUIMICO_INICIAL: QuimicoForm = {
  nombre: '',
  unidad: '',
  stock_minimo: '',
}

// ── Vista detalle de un químico ───────────────────────────────────────────────

interface DetalleProps {
  quimico: M24SaldoQuimico
  ranchoNombre: string
  orgId: string
  esSuperAdmin: boolean
  perfilNombre: string
  onBack: () => void
}

function DetalleQuimico({ quimico, ranchoNombre, orgId, esSuperAdmin, perfilNombre, onBack }: DetalleProps) {
  const { movimientos, loading, refetch: refetchMovs } = useM24Movimientos(quimico.quimico_id, orgId)
  const { saldos: _, refetch: refetchSaldos } = useM24Saldos(orgId)

  const [sheetOpen, setSheetOpen] = useState(false)
  const [movForm, setMovForm] = useState<MovForm>({ ...MOV_INICIAL, persona_solicita: perfilNombre })
  const [guardando, setGuardando] = useState(false)
  const [pdfLoading, setPdfLoading] = useState(false)

  const movsConSaldo = useMemo(() => {
    let saldo = 0
    return movimientos.map(m => {
      saldo = m.tipo === 'entrada' ? saldo + m.cantidad : saldo - m.cantidad
      return { ...m, saldo }
    })
  }, [movimientos])

  const movsParaMostrar = useMemo(() => [...movsConSaldo].reverse(), [movsConSaldo])

  const saldoActual = movsConSaldo.length > 0 ? movsConSaldo[movsConSaldo.length - 1].saldo : quimico.saldo
  const stockBajo = quimico.stock_minimo !== null && saldoActual <= quimico.stock_minimo
  const stockNegativo = saldoActual < 0

  async function guardarMovimiento() {
    if (!movForm.cantidad || isNaN(Number(movForm.cantidad)) || Number(movForm.cantidad) <= 0) {
      toast.error('Ingresa una cantidad válida mayor a 0')
      return
    }
    if (!movForm.persona_solicita.trim()) { toast.error('Ingresa el nombre de la persona'); return }
    if (!movForm.area.trim()) { toast.error('Ingresa el área'); return }

    setGuardando(true)
    try {
      const { error } = await (supabase as any)
        .from('m24_movimientos')
        .insert({
          org_id: orgId,
          rancho_id: quimico.rancho_id,
          quimico_id: quimico.quimico_id,
          fecha: movForm.fecha,
          persona_solicita: movForm.persona_solicita.trim(),
          area: movForm.area.trim(),
          tipo: movForm.tipo,
          cantidad: Number(movForm.cantidad),
        })
      if (error) throw error
      toast.success(`${movForm.tipo === 'entrada' ? 'Entrada' : 'Salida'} registrada`)
      setSheetOpen(false)
      await Promise.all([refetchMovs(), refetchSaldos()])
      try {
        await generarInventarioQuimicosPDF(quimico.quimico_id, orgId)
      } catch { /* PDF no crítico */ }
    } catch (e: any) {
      const msg = e?.message ?? ''
      if (msg.includes('FECHA_SOLO_HOY')) {
        toast.warning('Solo puedes registrar con la fecha de hoy')
      } else {
        toast.error('Error al guardar el movimiento')
      }
    } finally {
      setGuardando(false)
    }
  }

  async function exportarPDF() {
    setPdfLoading(true)
    try {
      await generarInventarioQuimicosPDF(quimico.quimico_id, orgId)
    } catch { toast.error('Error al generar PDF') }
    finally { setPdfLoading(false) }
  }

  function abrirForm() {
    setMovForm({ ...MOV_INICIAL, persona_solicita: perfilNombre, fecha: hoy() })
    setSheetOpen(true)
  }

  return (
    <div className="min-h-full pb-[calc(72px+34px+80px)]">
      <header className="bg-card border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={onBack} className="p-1 -ml-1 rounded-lg hover:bg-muted transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-semibold truncate">{quimico.nombre}</h1>
          <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{quimico.unidad} · {ranchoNombre}</p>
        </div>
        <button
          onClick={exportarPDF}
          disabled={pdfLoading}
          className="p-2 rounded-lg hover:bg-muted transition-colors"
          aria-label="Exportar PDF"
        >
          {pdfLoading
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <FileDown className="w-4 h-4" />}
        </button>
      </header>

      <div className="p-4 space-y-4">
        {/* Saldo card */}
        <div
          className="rounded-xl p-4 border"
          style={
            stockNegativo
              ? { backgroundColor: 'var(--agro-danger-fill)', borderColor: 'var(--agro-red)' }
              : stockBajo
                ? { backgroundColor: 'var(--agro-warning-fill)', borderColor: 'var(--agro-amber)' }
                : { backgroundColor: 'var(--agro-success-fill)', borderColor: 'var(--border)' }
          }
        >
          <p className="text-xs mb-1" style={{ color: 'var(--muted-foreground)' }}>Saldo actual</p>
          <p
            className="text-3xl font-semibold leading-none"
            style={{
              color: stockNegativo ? 'var(--agro-danger-text)'
                : stockBajo ? 'var(--agro-warning-text)'
                  : 'var(--agro-success-text)',
            }}
          >
            {saldoActual} <span className="text-lg">{quimico.unidad}</span>
          </p>
          {quimico.stock_minimo !== null && (
            <p className="text-xs mt-1.5" style={{ color: 'var(--muted-foreground)' }}>
              Stock mínimo: {quimico.stock_minimo} {quimico.unidad}
            </p>
          )}
          {(stockBajo || stockNegativo) && (
            <div className="flex items-center gap-1.5 mt-2"
              style={{ color: stockNegativo ? 'var(--agro-danger-text)' : 'var(--agro-warning-text)' }}>
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="text-xs font-medium">
                {stockNegativo ? 'Saldo negativo — revisar entradas' : 'Stock bajo'}
              </span>
            </div>
          )}
        </div>

        {/* Historial */}
        <h2 className="text-sm font-semibold">Historial de movimientos</h2>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
          </div>
        ) : movsParaMostrar.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-6 text-center">
            <p className="text-sm font-semibold" style={{ color: 'var(--muted-foreground)' }}>
              Sin movimientos
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>
              Registra la primera entrada con el botón +
            </p>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="grid grid-cols-[80px_1fr_52px_44px] px-3 py-2 border-b border-border"
              style={{ backgroundColor: 'var(--muted)' }}>
              <span className="text-xs font-semibold" style={{ color: 'var(--muted-foreground)' }}>Fecha</span>
              <span className="text-xs font-semibold" style={{ color: 'var(--muted-foreground)' }}>Persona / Área</span>
              <span className="text-xs font-semibold text-right" style={{ color: 'var(--muted-foreground)' }}>Mov.</span>
              <span className="text-xs font-semibold text-right" style={{ color: 'var(--muted-foreground)' }}>Total</span>
            </div>
            {movsParaMostrar.map((m) => (
              <div key={m.id} className="grid grid-cols-[80px_1fr_52px_44px] px-3 py-2.5 border-b border-border last:border-b-0">
                <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                  {formatFecha(m.fecha)}
                </span>
                <div className="min-w-0 pr-2">
                  <p className="text-xs font-medium truncate">{m.persona_solicita}</p>
                  <p className="text-xs truncate" style={{ color: 'var(--muted-foreground)' }}>{m.area}</p>
                </div>
                <span
                  className="text-xs font-semibold text-right"
                  style={{ color: m.tipo === 'entrada' ? 'var(--agro-success-text)' : 'var(--agro-danger-text)' }}
                >
                  {m.tipo === 'entrada' ? '+' : '-'}{m.cantidad}
                </span>
                <span
                  className="text-xs font-semibold text-right"
                  style={{ color: m.saldo < 0 ? 'var(--agro-danger-text)' : undefined }}
                >
                  {m.saldo}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* FAB */}
      <button
        onClick={abrirForm}
        className="fixed bottom-[calc(72px+34px+16px)] right-4 w-14 h-14 bg-primary rounded-full flex items-center justify-center z-10 hover:bg-agro-blue transition-colors"
        aria-label="Nuevo movimiento"
      >
        <Plus className="w-6 h-6 text-white" />
      </button>

      {/* Form sheet */}
      <BottomSheet open={sheetOpen} onClose={() => { if (!guardando) setSheetOpen(false) }}>
            <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-border flex-shrink-0">
              <h2 className="text-base font-semibold">Nuevo movimiento</h2>
              <button onClick={() => { if (!guardando) setSheetOpen(false) }} className="p-1 rounded hover:bg-muted">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-4 py-4 space-y-4">
              {/* Tipo */}
              <div>
                <label className="block text-sm font-medium mb-1.5">Tipo</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['entrada', 'salida'] as const).map(t => (
                    <button
                      key={t}
                      onClick={() => setMovForm(f => ({ ...f, tipo: t }))}
                      className="py-2.5 rounded-xl text-sm font-medium border transition-colors"
                      style={
                        movForm.tipo === t
                          ? { backgroundColor: 'var(--primary)', color: '#fff', borderColor: 'var(--primary)' }
                          : { backgroundColor: 'var(--input-background)', borderColor: 'var(--border)' }
                      }
                    >
                      {t === 'entrada' ? 'Entrada' : 'Salida'}
                    </button>
                  ))}
                </div>
              </div>
              {/* Cantidad */}
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Cantidad ({quimico.unidad})
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={movForm.cantidad}
                  onChange={e => setMovForm(f => ({ ...f, cantidad: e.target.value }))}
                  className="w-full rounded-xl px-3 py-2.5 text-sm border border-border"
                  style={{ backgroundColor: 'var(--input-background)' }}
                  placeholder="0"
                />
              </div>
              {/* Fecha */}
              <div>
                <label className="block text-sm font-medium mb-1.5">Fecha</label>
                <input
                  type="date"
                  value={movForm.fecha}
                  min={esSuperAdmin ? undefined : hoy()}
                  max={esSuperAdmin ? undefined : hoy()}
                  onChange={e => { if (esSuperAdmin) setMovForm(f => ({ ...f, fecha: e.target.value })) }}
                  className="w-full rounded-xl px-3 py-2.5 text-sm border border-border"
                  style={{ backgroundColor: 'var(--input-background)' }}
                />
              </div>
              {/* Persona */}
              <div>
                <label className="block text-sm font-medium mb-1.5">Persona que solicita</label>
                <input
                  type="text"
                  value={movForm.persona_solicita}
                  onChange={e => setMovForm(f => ({ ...f, persona_solicita: e.target.value }))}
                  className="w-full rounded-xl px-3 py-2.5 text-sm border border-border"
                  style={{ backgroundColor: 'var(--input-background)' }}
                  placeholder="Nombre completo"
                />
              </div>
              {/* Área */}
              <div>
                <label className="block text-sm font-medium mb-1.5">Área</label>
                <input
                  type="text"
                  value={movForm.area}
                  onChange={e => setMovForm(f => ({ ...f, area: e.target.value }))}
                  className="w-full rounded-xl px-3 py-2.5 text-sm border border-border"
                  style={{ backgroundColor: 'var(--input-background)' }}
                  placeholder="Ej: Producción, Limpieza..."
                />
              </div>
              <button
                onClick={guardarMovimiento}
                disabled={guardando}
                className="w-full py-3 rounded-xl text-sm font-semibold text-white bg-primary hover:bg-agro-blue transition-colors disabled:opacity-50"
              >
                {guardando ? 'Guardando...' : 'Guardar movimiento'}
              </button>
            </div>
      </BottomSheet>
    </div>
  )
}

// ── Pantalla principal ────────────────────────────────────────────────────────

export function ControlInventarioQuimicos() {
  const navigate = useNavigate()
  const { profile } = useAuthContext()
  const esSuperAdmin = profile?.rol === 'super_admin'
  const { terminosSitio } = useModulosContext()
  const orgId = profile?.org_id ?? null
  const { ranchos } = useRanchos(orgId)

  const [ranchoId, setRanchoId] = useState('')
  const [selectedQuimico, setSelectedQuimico] = useState<M24SaldoQuimico | null>(null)

  const { saldos, loading: saldosLoading, refetch: refetchSaldos } = useM24Saldos(orgId)
  const { quimicos: catalogoQuimicos, loading: catalogoLoading, refetch: refetchCatalogo } =
    useM24QuimicosRancho(ranchoId || null, orgId)

  // Sheets
  const [configurarOpen, setConfigurarOpen] = useState(false)
  const [nuevoQuimicoOpen, setNuevoQuimicoOpen] = useState(false)
  const [consolidadoOpen, setConsolidadoOpen] = useState(false)

  const [quimicoForm, setQuimicoForm] = useState<QuimicoForm>(QUIMICO_INICIAL)
  const [consolidadoForm, setConsolidadoForm] = useState({ rancho_id: '', desde: hoy(), hasta: hoy() })

  const [guardandoQuimico, setGuardandoQuimico] = useState(false)
  const [exportando, setExportando] = useState(false)

  // Auto-seleccionar si hay un solo rancho
  useEffect(() => {
    if (ranchos.length === 1 && !ranchoId) setRanchoId(ranchos[0].id)
  }, [ranchos, ranchoId])

  const ranchoNombreById = useMemo(
    () => Object.fromEntries(ranchos.map(r => [r.id, r.nombre])),
    [ranchos],
  )

  const saldosFiltrados = useMemo(
    () => ranchoId ? saldos.filter(s => s.rancho_id === ranchoId) : saldos,
    [saldos, ranchoId],
  )

  async function guardarQuimico() {
    if (!orgId || !ranchoId) {
      toast.error(`Selecciona una ${terminosSitio.singular}`)
      return
    }
    if (!quimicoForm.nombre.trim()) { toast.error('Ingresa el nombre del químico'); return }
    if (!quimicoForm.unidad.trim()) { toast.error('Ingresa la unidad (L, kg, pz...)'); return }

    setGuardandoQuimico(true)
    try {
      const stockMin = quimicoForm.stock_minimo !== '' ? Number(quimicoForm.stock_minimo) : null
      const { error } = await (supabase as any)
        .from('m24_quimicos')
        .insert({
          org_id: orgId,
          rancho_id: ranchoId,
          nombre: quimicoForm.nombre.trim(),
          unidad: quimicoForm.unidad.trim(),
          stock_minimo: stockMin,
        })
      if (error) throw error
      toast.success('Químico agregado')
      setQuimicoForm(QUIMICO_INICIAL)
      setNuevoQuimicoOpen(false)
      await Promise.all([refetchCatalogo(), refetchSaldos()])
    } catch (e: any) {
      const msg = e?.message ?? ''
      if (msg.includes('unique') || msg.includes('duplicate') || msg.includes('23505')) {
        toast.error('Ya existe un químico con ese nombre en esta instalación')
      } else {
        toast.error('Error al agregar el químico')
      }
    } finally {
      setGuardandoQuimico(false)
    }
  }

  async function toggleActivo(id: string, activo: boolean) {
    const { error } = await (supabase as any)
      .from('m24_quimicos')
      .update({ activo: !activo })
      .eq('id', id)
      .eq('org_id', orgId)
    if (error) { toast.error('Error al actualizar'); return }
    refetchCatalogo()
    refetchSaldos()
  }

  async function exportarConsolidado() {
    if (!consolidadoForm.rancho_id) {
      toast.error(`Selecciona una ${terminosSitio.singular}`)
      return
    }
    if (!orgId) return
    setExportando(true)
    try {
      await generarInventarioQuimicosConsolidadoPDF(
        consolidadoForm.rancho_id, orgId, consolidadoForm.desde, consolidadoForm.hasta,
      )
      setConsolidadoOpen(false)
    } catch {
      toast.error('Error al generar PDF consolidado')
    } finally {
      setExportando(false)
    }
  }

  if (selectedQuimico) {
    return (
      <DetalleQuimico
        quimico={selectedQuimico}
        ranchoNombre={ranchoNombreById[selectedQuimico.rancho_id] ?? '—'}
        orgId={orgId!}
        esSuperAdmin={esSuperAdmin}
        perfilNombre={profile?.nombre_completo ?? ''}
        onBack={() => { setSelectedQuimico(null); refetchSaldos() }}
      />
    )
  }

  return (
    <div className="min-h-full pb-[calc(72px+34px)]">
      <header className="bg-card border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-1 -ml-1 rounded-lg hover:bg-muted transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h1 className="flex-1 text-base font-semibold">Control de Inventario de Químicos</h1>
        <button
          onClick={() => {
            setConsolidadoForm(f => ({ ...f, rancho_id: ranchoId }))
            setConsolidadoOpen(true)
          }}
          className="p-2 rounded-lg hover:bg-muted transition-colors"
          aria-label="Exportar consolidado"
        >
          <FileDown className="w-4 h-4" />
        </button>
        <button
          onClick={() => setConfigurarOpen(true)}
          className="p-2 rounded-lg hover:bg-muted transition-colors"
          aria-label="Configurar químicos"
        >
          <Settings className="w-4 h-4" />
        </button>
      </header>

      <div className="p-4 space-y-4">
        {/* Selector de instalación */}
        {ranchos.length > 1 && (
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5"
              style={{ color: 'var(--muted-foreground)' }}>
              {terminosSitio.singular}
            </label>
            <select
              value={ranchoId}
              onChange={e => setRanchoId(e.target.value)}
              className="w-full rounded-xl px-3 py-2.5 text-sm border border-border"
              style={{ backgroundColor: 'var(--input-background)' }}
            >
              <option value="">{terminosSitio.plural}</option>
              {ranchos.map(r => (
                <option key={r.id} value={r.id}>{r.nombre}</option>
              ))}
            </select>
          </div>
        )}

        {/* Lista de químicos */}
        {saldosLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : saldosFiltrados.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-6 text-center">
            <p className="text-sm font-semibold" style={{ color: 'var(--muted-foreground)' }}>
              Sin químicos registrados
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>
              Usa el ícono de configuración para agregar químicos.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {saldosFiltrados.map(s => {
              const stockBajo = s.stock_minimo !== null && s.saldo <= s.stock_minimo
              const stockNeg = s.saldo < 0
              return (
                <button
                  key={s.quimico_id}
                  onClick={() => setSelectedQuimico(s)}
                  className="w-full text-left bg-card border rounded-xl p-4 transition-colors hover:border-primary"
                  style={{
                    borderColor: stockNeg ? 'var(--agro-red)'
                      : stockBajo ? 'var(--agro-amber)' : 'var(--border)',
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{s.nombre}</p>
                      {ranchos.length > 1 && (
                        <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                          {ranchoNombreById[s.rancho_id] ?? '—'}
                        </p>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p
                        className="text-2xl font-semibold leading-none"
                        style={{
                          color: stockNeg ? 'var(--agro-danger-text)'
                            : stockBajo ? 'var(--agro-warning-text)' : undefined,
                        }}
                      >
                        {s.saldo}
                      </p>
                      <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{s.unidad}</p>
                    </div>
                  </div>
                  {(stockBajo || stockNeg) && (
                    <div
                      className="flex items-center gap-1.5 mt-2"
                      style={{ color: stockNeg ? 'var(--agro-danger-text)' : 'var(--agro-warning-text)' }}
                    >
                      <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                      <span className="text-xs">
                        {stockNeg ? 'Saldo negativo'
                          : `Stock bajo (mín. ${s.stock_minimo} ${s.unidad})`}
                      </span>
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Configurar sheet */}
      <BottomSheet open={configurarOpen} onClose={() => setConfigurarOpen(false)}>
            <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-border flex-shrink-0">
              <h2 className="text-base font-semibold">Configurar químicos</h2>
              <button onClick={() => setConfigurarOpen(false)} className="p-1 rounded hover:bg-muted">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-4 py-3 border-b border-border flex-shrink-0">
              <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5"
                style={{ color: 'var(--muted-foreground)' }}>
                {terminosSitio.singular}
              </label>
              <select
                value={ranchoId}
                onChange={e => setRanchoId(e.target.value)}
                className="w-full rounded-xl px-3 py-2.5 text-sm border border-border"
                style={{ backgroundColor: 'var(--input-background)' }}
              >
                <option value="">Seleccionar...</option>
                {ranchos.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
              </select>
            </div>
            <div className="flex-1 overflow-y-auto">
              {ranchoId ? (
                <div className="px-4 py-3 space-y-2">
                  {catalogoLoading ? (
                    <div className="flex justify-center py-4">
                      <Loader2 className="w-5 h-5 animate-spin text-primary" />
                    </div>
                  ) : catalogoQuimicos.length === 0 ? (
                    <p className="text-sm text-center py-4" style={{ color: 'var(--muted-foreground)' }}>
                      Sin químicos. Agrega el primero abajo.
                    </p>
                  ) : (
                    catalogoQuimicos.map(q => (
                      <div key={q.id} className="flex items-center gap-3 bg-card border border-border rounded-xl px-3 py-2.5">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{q.nombre}</p>
                          <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                            {q.unidad}
                            {q.stock_minimo != null ? ` · mín. ${q.stock_minimo}` : ''}
                          </p>
                        </div>
                        <button
                          onClick={() => toggleActivo(q.id, q.activo)}
                          className="w-11 h-6 rounded-full flex items-center transition-colors flex-shrink-0"
                          style={{ backgroundColor: q.activo ? 'var(--primary)' : 'var(--switch-background)' }}
                          aria-label={q.activo ? 'Desactivar' : 'Activar'}
                        >
                          <span
                            className="w-5 h-5 rounded-full bg-white transition-transform mx-0.5"
                            style={{ transform: q.activo ? 'translateX(100%)' : 'translateX(0)' }}
                          />
                        </button>
                      </div>
                    ))
                  )}
                  <button
                    onClick={() => { setQuimicoForm(QUIMICO_INICIAL); setNuevoQuimicoOpen(true) }}
                    className="w-full py-2.5 rounded-xl text-sm font-semibold border border-dashed transition-colors"
                    style={{ borderColor: 'var(--primary)', color: 'var(--primary)' }}
                  >
                    + Agregar químico
                  </button>
                </div>
              ) : (
                <p className="text-sm text-center py-6" style={{ color: 'var(--muted-foreground)' }}>
                  Selecciona una {terminosSitio.singular.toLowerCase()} para ver sus químicos.
                </p>
              )}
            </div>
      </BottomSheet>

      {/* Nuevo químico sheet */}
      <BottomSheet open={nuevoQuimicoOpen} onClose={() => { if (!guardandoQuimico) setNuevoQuimicoOpen(false) }}>
            <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-border flex-shrink-0">
              <h2 className="text-base font-semibold">Nuevo químico / insumo</h2>
              <button
                onClick={() => { if (!guardandoQuimico) setNuevoQuimicoOpen(false) }}
                className="p-1 rounded hover:bg-muted"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-4 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">Nombre</label>
                <input
                  type="text"
                  value={quimicoForm.nombre}
                  onChange={e => setQuimicoForm(f => ({ ...f, nombre: e.target.value }))}
                  className="w-full rounded-xl px-3 py-2.5 text-sm border border-border"
                  style={{ backgroundColor: 'var(--input-background)' }}
                  placeholder="Ej: Cloro, Jabón desengrasante..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Unidad</label>
                <input
                  type="text"
                  value={quimicoForm.unidad}
                  onChange={e => setQuimicoForm(f => ({ ...f, unidad: e.target.value }))}
                  className="w-full rounded-xl px-3 py-2.5 text-sm border border-border"
                  style={{ backgroundColor: 'var(--input-background)' }}
                  placeholder="L, kg, pz, gal..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Stock mínimo (opcional)</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={quimicoForm.stock_minimo}
                  onChange={e => setQuimicoForm(f => ({ ...f, stock_minimo: e.target.value }))}
                  className="w-full rounded-xl px-3 py-2.5 text-sm border border-border"
                  style={{ backgroundColor: 'var(--input-background)' }}
                  placeholder="Sin mínimo"
                />
              </div>
              <button
                onClick={guardarQuimico}
                disabled={guardandoQuimico}
                className="w-full py-3 rounded-xl text-sm font-semibold text-white bg-primary hover:bg-agro-blue transition-colors disabled:opacity-50"
              >
                {guardandoQuimico ? 'Guardando...' : 'Agregar químico'}
              </button>
            </div>
      </BottomSheet>

      {/* Consolidado sheet */}
      <BottomSheet open={consolidadoOpen} onClose={() => { if (!exportando) setConsolidadoOpen(false) }}>
            <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-border flex-shrink-0">
              <h2 className="text-base font-semibold">Exportar consolidado</h2>
              <button
                onClick={() => { if (!exportando) setConsolidadoOpen(false) }}
                className="p-1 rounded hover:bg-muted"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-4 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">{terminosSitio.singular}</label>
                <select
                  value={consolidadoForm.rancho_id}
                  onChange={e => setConsolidadoForm(f => ({ ...f, rancho_id: e.target.value }))}
                  className="w-full rounded-xl px-3 py-2.5 text-sm border border-border"
                  style={{ backgroundColor: 'var(--input-background)' }}
                >
                  <option value="">Seleccionar...</option>
                  {ranchos.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Desde</label>
                <input
                  type="date"
                  value={consolidadoForm.desde}
                  onChange={e => setConsolidadoForm(f => ({ ...f, desde: e.target.value }))}
                  className="w-full rounded-xl px-3 py-2.5 text-sm border border-border"
                  style={{ backgroundColor: 'var(--input-background)' }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Hasta</label>
                <input
                  type="date"
                  value={consolidadoForm.hasta}
                  onChange={e => setConsolidadoForm(f => ({ ...f, hasta: e.target.value }))}
                  className="w-full rounded-xl px-3 py-2.5 text-sm border border-border"
                  style={{ backgroundColor: 'var(--input-background)' }}
                />
              </div>
              <button
                onClick={exportarConsolidado}
                disabled={exportando}
                className="w-full py-3 rounded-xl text-sm font-semibold text-white bg-primary hover:bg-agro-blue transition-colors disabled:opacity-50"
              >
                {exportando
                  ? <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />Generando...
                  </span>
                  : 'Exportar PDF'}
              </button>
            </div>
      </BottomSheet>
    </div>
  )
}
