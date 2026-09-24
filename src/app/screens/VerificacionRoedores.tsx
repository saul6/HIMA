import { useState } from 'react'
import { ChevronLeft, Plus, X, Loader2, Bug, Files } from 'lucide-react'
import { useNavigate } from 'react-router'
import { BottomSheet } from '@/app/components/BottomSheet'
import { toast } from 'sonner'
import { useAuthContext } from '@/context/AuthContext'
import { puedeEditarFechaLibre } from '@/lib/permisos'
import { useModulosContext } from '@/context/ModulosContext'
import { useRanchos } from '@/hooks/useRanchos'
import { useM70VerificacionRoedores } from '@/hooks/useM70VerificacionRoedores'
import { supabase } from '@/lib/supabase'
import { Fab } from '@/app/components/Fab'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tbl = (name: string) => (supabase as any).from(name)
const hoyMX = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' })

function formatFecha(iso: string): string {
  try {
    return new Date(iso + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch { return iso }
}

type FilaTrampa = {
  id: string
  num_trampa: string
  roedor: boolean
  insectos: boolean
  otros: boolean
  cambio: boolean
  verifico: string
  observaciones: string
}

function filaVacia(): FilaTrampa {
  return {
    id: crypto.randomUUID(),
    num_trampa: '',
    roedor: false,
    insectos: false,
    otros: false,
    cambio: false,
    verifico: '',
    observaciones: '',
  }
}

type FormState = {
  rancho_id: string
  fecha: string
}

const FORM_VACIO: FormState = {
  rancho_id: '',
  fecha: hoyMX(),
}

function ChipCheck({ valor, label }: { valor: boolean; label: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded font-medium"
      style={{
        backgroundColor: valor ? 'var(--agro-success-fill)' : 'var(--muted)',
        color: valor ? 'var(--agro-success-text)' : 'var(--muted-foreground)',
      }}
    >
      <span style={{ color: valor ? 'var(--primary)' : 'var(--agro-danger-text)' }}>
        {valor ? '✓' : '×'}
      </span>
      {label}
    </span>
  )
}

export function VerificacionRoedores() {
  const navigate = useNavigate()
  const { profile, user } = useAuthContext()
  const esSuperAdmin = profile?.rol === 'super_admin'
  const puedeEditarFecha = esSuperAdmin || puedeEditarFechaLibre(user?.email)
  const { terminosSitio } = useModulosContext()
  const orgId = profile?.org_id ?? null
  const { ranchos } = useRanchos(orgId)
  const { registros, loading, refetch } = useM70VerificacionRoedores(orgId)

  const [sheetOpen, setSheetOpen] = useState(false)
  const [consolidadoOpen, setConsolidadoOpen] = useState(false)
  const [form, setForm] = useState<FormState>(FORM_VACIO)
  const [filas, setFilas] = useState<FilaTrampa[]>([filaVacia()])
  const [guardando, setGuardando] = useState(false)

  function abrirNuevo() {
    setForm({ ...FORM_VACIO, fecha: hoyMX() })
    setFilas([filaVacia()])
    setSheetOpen(true)
  }

  function agregarFila() {
    setFilas(f => [...f, filaVacia()])
  }

  function eliminarFila(id: string) {
    setFilas(f => f.length > 1 ? f.filter(x => x.id !== id) : f)
  }

  function actualizarFila(id: string, campo: keyof FilaTrampa, valor: string | boolean) {
    setFilas(f => f.map(x => x.id === id ? { ...x, [campo]: valor } : x))
  }

  async function guardar() {
    if (!orgId) return
    if (!form.rancho_id) {
      toast.error(`Selecciona ${terminosSitio.genero === 'f' ? 'una' : 'un'} ${terminosSitio.singular}`)
      return
    }
    const filasValidas = filas.filter(f => f.num_trampa.trim())
    if (filasValidas.length === 0) {
      toast.error('Agrega al menos una trampa con número')
      return
    }

    setGuardando(true)
    try {
      const batch = filasValidas.map(f => ({
        org_id: orgId,
        rancho_id: form.rancho_id,
        fecha: form.fecha,
        num_trampa: f.num_trampa.trim(),
        roedor: f.roedor,
        insectos: f.insectos,
        otros: f.otros,
        cambio: f.cambio,
        verifico: f.verifico.trim() || null,
        observaciones: f.observaciones.trim() || null,
        creado_por: user?.id,
      }))

      const { error: err } = await tbl('m70_verificacion_roedores').insert(batch)
      if (err) throw err

      setSheetOpen(false)
      await refetch()
      toast.success(`${filasValidas.length} trampa${filasValidas.length > 1 ? 's' : ''} registrada${filasValidas.length > 1 ? 's' : ''}`)
    } catch (e: unknown) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const msg: string = (e as any)?.message ?? 'Error al guardar'
      if (msg.includes('FECHA_SOLO_HOY')) {
        toast.warning('Solo puedes registrar con la fecha de hoy')
      } else {
        toast.error(msg)
        console.error(e)
      }
    } finally {
      setGuardando(false)
    }
  }

  // Agrupar registros por fecha + rancho_id
  const grupos = (() => {
    const map = new Map<string, typeof registros>()
    for (const r of registros) {
      const key = `${r.fecha}__${r.rancho_id}`
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(r)
    }
    return Array.from(map.entries()).map(([key, items]) => ({
      key,
      fecha: items[0].fecha,
      rancho_nombre: items[0].rancho_nombre,
      trampas: items,
    }))
  })()

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: 'var(--background)' }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-12 pb-4">
        <button onClick={() => navigate('/')} className="p-1 -ml-1">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-semibold leading-tight">Verificación de Trampas para Roedores</h1>
          <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>M70 · REG-24 · Por evento</p>
        </div>
        <Bug className="w-5 h-5" style={{ color: 'var(--muted-foreground)' }} />
      </div>

      {/* Botón consolidado */}
      <div className="px-4 mb-4">
        <button
          onClick={() => setConsolidadoOpen(true)}
          className="flex items-center gap-2 text-sm font-medium"
          style={{ color: 'var(--primary)' }}
        >
          <Files className="w-4 h-4" />
          Exportar consolidado
        </button>
      </div>

      {/* Lista */}
      <div className="flex-1 px-4 pb-32 space-y-3 overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--muted-foreground)' }} />
          </div>
        )}
        {!loading && grupos.length === 0 && (
          <div className="text-center py-12 text-sm" style={{ color: 'var(--muted-foreground)' }}>
            Sin registros. Usa el botón + para agregar.
          </div>
        )}
        {grupos.map(g => (
          <div
            key={g.key}
            className="rounded-[0.625rem] border overflow-hidden"
            style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
          >
            {/* Cabecera del grupo */}
            <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--muted)' }}>
              <p className="text-sm font-semibold">{g.rancho_nombre}</p>
              <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{formatFecha(g.fecha)}</p>
            </div>
            {/* Trampas */}
            <div className="px-4 py-3 space-y-3">
              {g.trampas.map(t => (
                <div key={t.id} className="space-y-1.5">
                  <p className="text-sm font-medium">T: {t.num_trampa}</p>
                  <div className="flex flex-wrap gap-1.5">
                    <ChipCheck valor={t.roedor} label="Roedor" />
                    <ChipCheck valor={t.insectos} label="Insectos" />
                    <ChipCheck valor={t.otros} label="Otros" />
                    <ChipCheck valor={t.cambio} label="Cebo repuesto" />
                  </div>
                  {t.verifico && (
                    <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Verificó: {t.verifico}</p>
                  )}
                  {t.observaciones && (
                    <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{t.observaciones}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* FAB */}
            <Fab onClick={abrirNuevo} aria-label="Nueva verificación" />

      {/* Sheet — nuevo registro */}
      <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)} height="85%">
        <div
          className="flex items-center justify-between px-4 pt-4 pb-3 border-b"
          style={{ borderColor: 'var(--border)' }}
        >
          <h2 className="text-base font-semibold">Nueva verificación</h2>
          <button onClick={() => setSheetOpen(false)}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-4 pt-4 pb-8 space-y-4">
          {/* Rancho */}
          <div>
            <label className="block text-xs font-medium mb-1">{terminosSitio.singular}</label>
            <select
              className="w-full h-10 rounded-[0.625rem] border px-3 text-sm"
              style={{ borderColor: 'var(--border)', backgroundColor: 'var(--input-background)' }}
              value={form.rancho_id}
              onChange={e => setForm(f => ({ ...f, rancho_id: e.target.value }))}
            >
              <option value="">Selecciona...</option>
              {ranchos.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
            </select>
          </div>

          {/* Fecha */}
          <div>
            <label className="block text-xs font-medium mb-1">Fecha</label>
            <input
              type="date"
              className="w-full h-10 rounded-[0.625rem] border px-3 text-sm"
              style={{ borderColor: 'var(--border)', backgroundColor: 'var(--input-background)' }}
              value={form.fecha}
              min={puedeEditarFecha ? undefined : hoyMX()}
              max={puedeEditarFecha ? undefined : hoyMX()}
              onChange={e => { if (puedeEditarFecha) setForm(f => ({ ...f, fecha: e.target.value })) }}
            />
          </div>

          {/* Tabla de trampas */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-medium">Trampas verificadas</p>
              <button
                type="button"
                onClick={agregarFila}
                className="flex items-center gap-1 text-xs font-medium"
                style={{ color: 'var(--primary)' }}
              >
                <Plus className="w-3.5 h-3.5" />
                Agregar trampa
              </button>
            </div>

            <div className="space-y-4">
              {filas.map((fila, idx) => (
                <div
                  key={fila.id}
                  className="rounded-[0.625rem] border p-3 space-y-3"
                  style={{ borderColor: 'var(--border)', backgroundColor: 'var(--muted)' }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold" style={{ color: 'var(--primary)' }}>
                      Trampa {idx + 1}
                    </span>
                    {filas.length > 1 && (
                      <button
                        type="button"
                        onClick={() => eliminarFila(fila.id)}
                        className="p-0.5 rounded"
                        style={{ color: 'var(--agro-danger-text)' }}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Número de trampa */}
                  <div>
                    <label className="block text-xs font-medium mb-1">N° de trampa</label>
                    <input
                      type="text"
                      className="w-full h-9 rounded-[0.625rem] border px-3 text-sm"
                      style={{ borderColor: 'var(--border)', backgroundColor: 'var(--card)' }}
                      placeholder="Ej. T-01, T-Norte..."
                      value={fila.num_trampa}
                      onChange={e => actualizarFila(fila.id, 'num_trampa', e.target.value)}
                    />
                  </div>

                  {/* Checks */}
                  <div className="grid grid-cols-2 gap-2">
                    {(
                      [
                        { campo: 'roedor', label: 'Roedor' },
                        { campo: 'insectos', label: 'Insectos' },
                        { campo: 'otros', label: 'Otros' },
                        { campo: 'cambio', label: '¿Se repuso cebo?' },
                      ] as { campo: keyof FilaTrampa; label: string }[]
                    ).map(({ campo, label }) => (
                      <label key={campo} className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          className="w-4 h-4 rounded accent-primary"
                          checked={fila[campo] as boolean}
                          onChange={e => actualizarFila(fila.id, campo, e.target.checked)}
                        />
                        <span className="text-xs">{label}</span>
                      </label>
                    ))}
                  </div>

                  {/* Verificó */}
                  <div>
                    <label className="block text-xs font-medium mb-1">
                      Verificó <span style={{ color: 'var(--muted-foreground)' }}>(opcional)</span>
                    </label>
                    <input
                      type="text"
                      className="w-full h-9 rounded-[0.625rem] border px-3 text-sm"
                      style={{ borderColor: 'var(--border)', backgroundColor: 'var(--card)' }}
                      placeholder="Nombre"
                      value={fila.verifico}
                      onChange={e => actualizarFila(fila.id, 'verifico', e.target.value)}
                    />
                  </div>

                  {/* Observaciones */}
                  <div>
                    <label className="block text-xs font-medium mb-1">
                      Observaciones <span style={{ color: 'var(--muted-foreground)' }}>(opcional)</span>
                    </label>
                    <input
                      type="text"
                      className="w-full h-9 rounded-[0.625rem] border px-3 text-sm"
                      style={{ borderColor: 'var(--border)', backgroundColor: 'var(--card)' }}
                      value={fila.observaciones}
                      onChange={e => actualizarFila(fila.id, 'observaciones', e.target.value)}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="px-4 pb-6 pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
          <button
            onClick={guardar}
            disabled={guardando}
            className="w-full h-11 rounded-[0.625rem] text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
            style={{ backgroundColor: 'var(--primary)' }}
          >
            {guardando && <Loader2 className="w-4 h-4 animate-spin" />}
            Guardar
          </button>
        </div>
      </BottomSheet>

      {/* Sheet — consolidado */}
      <BottomSheet open={consolidadoOpen} onClose={() => setConsolidadoOpen(false)}>
        <div
          className="flex items-center justify-between px-4 pt-4 pb-3 border-b"
          style={{ borderColor: 'var(--border)' }}
        >
          <h2 className="text-base font-semibold">Exportar consolidado</h2>
          <button onClick={() => setConsolidadoOpen(false)}>
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-4 pt-6 pb-8 flex flex-col items-center gap-4 text-center">
          <Files className="w-10 h-10" style={{ color: 'var(--muted-foreground)' }} />
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
            La exportación consolidada estará disponible próximamente.
          </p>
          <button
            onClick={() => { setConsolidadoOpen(false); toast.info('Consolidado próximamente') }}
            className="h-11 px-6 rounded-[0.625rem] text-white font-semibold text-sm"
            style={{ backgroundColor: 'var(--primary)' }}
          >
            Entendido
          </button>
        </div>
      </BottomSheet>
    </div>
  )
}
