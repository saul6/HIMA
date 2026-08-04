// ╔══════════════════════════════════════════════════════════════════════╗
// ║  PATRÓN INOCUIDAD M6 — copia esta estructura para M7–M12           ║
// ║                                                                      ║
// ║  Flujo estándar de cada módulo de inocuidad:                        ║
// ║  1. Hook src/hooks/use<Modulo>.ts → lista de registros de la org    ║
// ║  2. PDF  src/lib/pdf/m<N>/        → componente + generador          ║
// ║  3. Esta pantalla: lista (cards) + FAB + bottom-sheet (form)        ║
// ║  4. org_id y IDs sensibles SIEMPRE del contexto de auth             ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { useState, useEffect } from 'react'
import { ChevronLeft, Plus, FileDown, X, Loader2, Shield, Files, AlertTriangle } from 'lucide-react'
import { useNavigate } from 'react-router'
import { BottomSheet } from '@/app/components/BottomSheet'
import { toast } from 'sonner'
import { useAuthContext } from '@/context/AuthContext'
import { useModulosContext } from '@/context/ModulosContext'
import { useRanchos } from '@/hooks/useRanchos'
import { useBotiquin, type M6BotiquinConRancho } from '@/hooks/useBotiquin'
import { useOrganizacion } from '@/hooks/useOrganizacion'
import { supabase } from '@/lib/supabase'
import { generarBotiquinPDF } from '@/lib/pdf/m6/generarBotiquinPDF'
import { generarBotiquinConsolidadoPDF } from '@/lib/pdf/m6/generarBotiquinConsolidadoPDF'
import type { BotiquinPDFProps } from '@/lib/pdf/m6/BotiquinPDF'

// ── Constantes ───────────────────────────────────────────────────────────────

const TITULO_MODULO = 'Botiquín de Primeros Auxilios'
const CLAVE_MODULO = 'MXA-F-SC-SIG · Semanal'

interface ArticuloConfig {
  key: 'parches_curitas' | 'guantes_curacion' | 'vendas_tijeras' | 'gasas_cinta' | 'desinfectante'
  label: string
}

const ARTICULOS: ArticuloConfig[] = [
  { key: 'parches_curitas', label: 'Parches / Curitas' },
  { key: 'guantes_curacion', label: 'Guantes de curación' },
  { key: 'vendas_tijeras', label: 'Vendas y tijeras' },
  { key: 'gasas_cinta', label: 'Gasas / Cintas' },
  { key: 'desinfectante', label: 'Desinfectante' },
]

type FormState = {
  rancho_id: string
  fecha_verificacion: string
  parches_curitas: boolean
  guantes_curacion: boolean
  vendas_tijeras: boolean
  gasas_cinta: boolean
  desinfectante: boolean
}

const hoy = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' })

const FORM_INICIAL: FormState = {
  rancho_id: '',
  fecha_verificacion: hoy(),
  parches_curitas: true,
  guantes_curacion: true,
  vendas_tijeras: true,
  gasas_cinta: true,
  desinfectante: true,
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function contarPresentes(r: Pick<FormState, 'parches_curitas' | 'guantes_curacion' | 'vendas_tijeras' | 'gasas_cinta' | 'desinfectante'>): number {
  return [r.parches_curitas, r.guantes_curacion, r.vendas_tijeras, r.gasas_cinta, r.desinfectante].filter(Boolean).length
}

function formatFecha(iso: string): string {
  try {
    return new Date(iso + 'T12:00:00').toLocaleDateString('es-MX', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return iso
  }
}

// Extrae la fecha del mensaje del trigger BOTIQUIN_LIMITE_SEMANAL y arma texto amigable.
// El trigger incluye dos fechas DD/MM/YYYY: la del último registro y la del próximo permitido.
function parsearErrorLimite(mensaje: string, singular = 'rancho'): string {
  const fechas = mensaje.match(/\d{2}\/\d{2}\/\d{4}/g)
  const proxima = fechas ? fechas[fechas.length - 1] : null
  return proxima
    ? `Ya registraste el botiquín de este ${singular} esta semana. Podrás registrar el siguiente a partir del ${proxima}.`
    : `Solo se permite un registro de botiquín por semana por ${singular}.`
}

// ── Sub-componentes ───────────────────────────────────────────────────────────

function ArticuloToggle({
  label,
  activo,
  onToggle,
}: {
  label: string
  activo: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="w-full flex items-center justify-between px-4 py-3 bg-card border border-border rounded-xl transition-colors hover:bg-muted"
    >
      <span className="text-sm text-foreground">{label}</span>
      <span
        className={`text-xs px-3 py-1 rounded-full transition-colors ${
          activo
            ? 'bg-agro-success-fill text-agro-success-text'
            : 'bg-agro-danger-fill text-agro-danger-text'
        }`}
        style={{ fontWeight: 600 }}
      >
        {activo ? 'Sí' : 'No'}
      </span>
    </button>
  )
}

// ── Pantalla principal ────────────────────────────────────────────────────────

export function BotiquinPrimerosAuxilios() {
  const navigate = useNavigate()
  const { profile } = useAuthContext()
  const { terminosSitio } = useModulosContext()
  const { ranchos } = useRanchos()
  const { registros, loading, refetch } = useBotiquin()
  const orgNombre = useOrganizacion(profile?.org_id)

  const [sheetAbierto, setSheetAbierto] = useState(false)
  const [form, setForm] = useState<FormState>({ ...FORM_INICIAL, fecha_verificacion: hoy() })
  const [guardando, setGuardando] = useState(false)
  const [errRancho, setErrRancho] = useState(false)
  const [generandoPDF, setGenerandoPDF] = useState<string | null>(null)
  const [limiteInfo, setLimiteInfo] = useState<{ proxima: string } | null>(null)

  // Verifica si el rancho ya tiene un registro en los 7 días anteriores a la fecha elegida.
  useEffect(() => {
    if (!sheetAbierto || !form.rancho_id || !form.fecha_verificacion || !profile?.org_id) {
      setLimiteInfo(null)
      return
    }
    let cancelado = false
    const fechaDate = new Date(form.fecha_verificacion + 'T12:00:00')
    const inicio = new Date(fechaDate)
    inicio.setDate(inicio.getDate() - 6)
    const inicioStr = inicio.toISOString().split('T')[0]

    supabase
      .from('m6_botiquin')
      .select('fecha_verificacion')
      .eq('org_id', profile.org_id)
      .eq('rancho_id', form.rancho_id)
      .gte('fecha_verificacion', inicioStr)
      .lte('fecha_verificacion', form.fecha_verificacion)
      .order('fecha_verificacion', { ascending: false })
      .limit(1)
      .then(({ data }) => {
        if (cancelado) return
        if (data && data.length > 0) {
          const ultimoDate = new Date(data[0].fecha_verificacion + 'T12:00:00')
          const proximaDate = new Date(ultimoDate)
          proximaDate.setDate(proximaDate.getDate() + 7)
          setLimiteInfo({ proxima: formatFecha(proximaDate.toISOString().split('T')[0]) })
        } else {
          setLimiteInfo(null)
        }
      })
    return () => { cancelado = true }
  }, [sheetAbierto, form.rancho_id, form.fecha_verificacion, profile?.org_id])

  // Consolidado
  const [sheetConsolidadoAbierto, setSheetConsolidadoAbierto] = useState(false)
  const [consRanchoId, setConsRanchoId] = useState('')
  const [consDesde, setConsDesde] = useState('')
  const [consHasta, setConsHasta] = useState(hoy())
  const [generandoConsolidado, setGenerandoConsolidado] = useState(false)
  const [errConsRancho, setErrConsRancho] = useState(false)
  const [errConsFechas, setErrConsFechas] = useState(false)

  const ranchoOptions = ranchos.map((r) => ({ value: r.id, label: r.nombre }))

  function abrirSheet() {
    setForm({ ...FORM_INICIAL, fecha_verificacion: hoy() })
    setErrRancho(false)
    setLimiteInfo(null)
    setSheetAbierto(true)
  }

  function toggleArticulo(key: ArticuloConfig['key']) {
    setForm((f) => ({ ...f, [key]: !f[key] }))
  }

  async function handleGuardar() {
    if (!form.rancho_id) { setErrRancho(true); return }
    if (!profile?.org_id) { toast.error('Sin organización activa'); return }

    setGuardando(true)
    try {
      const { data, error } = await supabase
        .from('m6_botiquin')
        .insert({
          rancho_id: form.rancho_id,
          fecha_verificacion: form.fecha_verificacion,
          parches_curitas: form.parches_curitas,
          guantes_curacion: form.guantes_curacion,
          vendas_tijeras: form.vendas_tijeras,
          gasas_cinta: form.gasas_cinta,
          desinfectante: form.desinfectante,
          responsable_id: profile.id,
          firma_verificacion: true,
          org_id: profile.org_id,
        })
        .select('id')
        .single()

      if (error) throw error

      toast.success('Registro guardado')
      setSheetAbierto(false)
      await refetch()

      // Generar PDF automáticamente tras guardar
      const rancho = ranchos.find((r) => r.id === form.rancho_id)
      if (rancho) {
        const pdfProps: BotiquinPDFProps = {
          folio: (data.id as string).slice(0, 8).toUpperCase(),
          rancho: rancho.nombre,
          ranchoCodigo: rancho.codigo,
          fechaVerificacion: form.fecha_verificacion,
          parches_curitas: form.parches_curitas,
          guantes_curacion: form.guantes_curacion,
          vendas_tijeras: form.vendas_tijeras,
          gasas_cinta: form.gasas_cinta,
          desinfectante: form.desinfectante,
          responsableNombre: profile.nombre_completo,
        }
        try {
          await generarBotiquinPDF(pdfProps, rancho.nombre, form.fecha_verificacion)
        } catch {
          toast.warning('Registro guardado — el PDF no se pudo generar. Descárgalo desde el historial.')
        }
      }
    } catch (err: unknown) {
      const mensaje = (err instanceof Error ? err.message : (err as any)?.message) ?? ''
      if (mensaje.includes('BOTIQUIN_LIMITE_SEMANAL')) {
        toast.warning(parsearErrorLimite(mensaje, terminosSitio.singular.toLowerCase()), { duration: 7000 })
      } else {
        toast.error(mensaje || 'No se pudo guardar el registro')
      }
    } finally {
      setGuardando(false)
    }
  }

  async function handleDescargarPDF(registro: M6BotiquinConRancho) {
    setGenerandoPDF(registro.id)
    try {
      const pdfProps: BotiquinPDFProps = {
        folio: registro.id.slice(0, 8).toUpperCase(),
        rancho: registro.rancho_nombre,
        ranchoCodigo: registro.rancho_codigo,
        fechaVerificacion: registro.fecha_verificacion,
        parches_curitas: registro.parches_curitas,
        guantes_curacion: registro.guantes_curacion,
        vendas_tijeras: registro.vendas_tijeras,
        gasas_cinta: registro.gasas_cinta,
        desinfectante: registro.desinfectante,
        responsableNombre:
          profile?.nombre_completo ?? 'Responsable',
      }
      await generarBotiquinPDF(pdfProps, registro.rancho_nombre, registro.fecha_verificacion)
    } catch {
      toast.error('No se pudo generar el PDF')
    } finally {
      setGenerandoPDF(null)
    }
  }

  async function handleGenerarConsolidado() {
    let valido = true
    if (!consRanchoId) { setErrConsRancho(true); valido = false }
    if (!consDesde || !consHasta) { setErrConsFechas(true); valido = false }
    if (!valido) return
    if (!profile?.org_id) { toast.error('Sin organización activa'); return }

    setGenerandoConsolidado(true)
    try {
      const { data, error } = await supabase
        .from('m6_botiquin')
        .select('*, ranchos(nombre, codigo), profiles!responsable_id(nombre_completo)')
        .eq('org_id', profile.org_id)
        .eq('rancho_id', consRanchoId)
        .gte('fecha_verificacion', consDesde)
        .lte('fecha_verificacion', consHasta)
        .order('fecha_verificacion', { ascending: true })

      if (error) throw error
      if (!data || data.length === 0) {
        toast.warning(`No hay registros en ese rango de fechas para ${terminosSitio.genero === 'f' ? 'la' : 'el'} ${terminosSitio.singular.toLowerCase()} seleccionado`)
        return
      }

      const rancho = ranchos.find((r) => r.id === consRanchoId)
      const ranchoNombre = rancho?.nombre ?? 'Rancho'

      const propsList: BotiquinPDFProps[] = (data as any[]).map((r) => ({
        folio: (r.id as string).slice(0, 8).toUpperCase(),
        rancho: r.ranchos?.nombre ?? ranchoNombre,
        ranchoCodigo: r.ranchos?.codigo ?? '—',
        fechaVerificacion: r.fecha_verificacion,
        parches_curitas: r.parches_curitas,
        guantes_curacion: r.guantes_curacion,
        vendas_tijeras: r.vendas_tijeras,
        gasas_cinta: r.gasas_cinta,
        desinfectante: r.desinfectante,
        responsableNombre: r.profiles?.nombre_completo ?? profile.nombre_completo,
      }))

      await generarBotiquinConsolidadoPDF(propsList, ranchoNombre, consDesde, consHasta)
      setSheetConsolidadoAbierto(false)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'No se pudo generar el PDF consolidado')
    } finally {
      setGenerandoConsolidado(false)
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-full pb-[calc(72px+34px)]">

      {/* Header */}
      <header className="bg-card border-b border-border px-4 py-4 sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="p-1 text-muted-foreground flex-shrink-0"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-foreground truncate" style={{ fontWeight: 600 }}>
              {TITULO_MODULO}
            </h1>
            <p className="text-xs text-muted-foreground">{CLAVE_MODULO}</p>
          </div>
          <div className="w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
            <Shield className="w-5 h-5 text-primary" />
          </div>
        </div>
      </header>

      {/* Acción consolidado */}
      <div className="px-4 pt-3">
        <button
          onClick={() => {
            setConsRanchoId('')
            setConsDesde('')
            setConsHasta(hoy())
            setErrConsRancho(false)
            setErrConsFechas(false)
            setSheetConsolidadoAbierto(true)
          }}
          className="w-full h-10 flex items-center justify-center gap-2 rounded-xl border border-primary text-primary text-sm hover:bg-primary/5 transition-colors"
          style={{ fontWeight: 600 }}
        >
          <Files className="w-4 h-4" />
          Exportar consolidado
        </button>
      </div>

      {/* Historial */}
      <div className="p-4 space-y-3">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        ) : registros.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-6 text-center">
            <Shield className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Sin registros aún</p>
            <p className="text-xs text-muted-foreground mt-1">
              Toca + para registrar la primera verificación
            </p>
          </div>
        ) : (
          registros.map((r) => {
            const presentes = contarPresentes(r)
            const completo = presentes === ARTICULOS.length
            return (
              <div
                key={r.id}
                className="bg-card rounded-xl p-4 border"
                style={{
                  borderColor: r.requiere_correccion ? 'var(--agro-amber)' : 'var(--border)',
                  backgroundColor: r.requiere_correccion ? 'var(--agro-warning-fill)' : undefined,
                }}
              >
                {r.requiere_correccion && r.comentario_correccion && (
                  <div
                    className="flex items-start gap-2 mb-3 text-xs rounded-lg px-3 py-2"
                    style={{ backgroundColor: 'rgba(0,0,0,0.05)', color: 'var(--agro-warning-text)' }}
                  >
                    <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                    {r.comentario_correccion}
                  </div>
                )}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      {orgNombre && (
                        <span className="text-xs text-muted-foreground font-medium">{orgNombre} ·</span>
                      )}
                      <span
                        className="text-sm text-foreground truncate"
                        style={{ fontWeight: 600 }}
                      >
                        {r.rancho_nombre}
                      </span>
                      <span
                        className={`text-[11px] px-2 py-0.5 rounded flex-shrink-0 ${
                          completo
                            ? 'bg-agro-success-fill text-agro-success-text'
                            : 'bg-agro-warning-fill text-agro-warning-text'
                        }`}
                        style={{ fontWeight: 600 }}
                      >
                        {presentes}/{ARTICULOS.length} artículos
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formatFecha(r.fecha_verificacion)}
                    </p>
                    {r.creado_por_nombre !== '—' && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Por: {r.creado_por_nombre}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => handleDescargarPDF(r)}
                    disabled={generandoPDF === r.id}
                    className="p-2 text-muted-foreground hover:text-primary transition-colors flex-shrink-0 disabled:opacity-50"
                    title="Descargar PDF"
                  >
                    {generandoPDF === r.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <FileDown className="w-4 h-4" />
                    )}
                  </button>
                </div>

                {/* Chips de artículos */}
                <div className="flex flex-wrap gap-1 mt-2">
                  {ARTICULOS.map((a) => {
                    const tiene = r[a.key]
                    return (
                      <span
                        key={a.key}
                        className={`text-[10px] px-2 py-0.5 rounded ${
                          tiene
                            ? 'bg-agro-success-fill text-agro-success-text'
                            : 'bg-agro-danger-fill text-agro-danger-text'
                        }`}
                      >
                        {a.label}
                      </span>
                    )
                  })}
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* FAB */}
      <div className="fixed bottom-[calc(72px+34px+16px)] left-1/2 -translate-x-1/2 w-full max-w-[390px] flex justify-end px-4 pointer-events-none z-10">
        <button
          onClick={abrirSheet}
          className="w-14 h-14 rounded-full bg-primary text-white flex items-center justify-center shadow-lg pointer-events-auto hover:bg-agro-blue transition-colors"
          aria-label="Nueva verificación"
        >
          <Plus className="w-6 h-6" />
        </button>
      </div>

      {/* Bottom Sheet — exportar consolidado */}
      <BottomSheet open={sheetConsolidadoAbierto} onClose={() => setSheetConsolidadoAbierto(false)}>
            <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
              <div className="w-10 h-1 rounded-full bg-border" />
            </div>
            <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
              <h2 className="text-base text-foreground" style={{ fontWeight: 600 }}>
                Exportar consolidado
              </h2>
              <button onClick={() => setSheetConsolidadoAbierto(false)} className="p-1">
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            <div className="overflow-y-auto p-4 space-y-4">
              {/* Sitio */}
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5" style={{ fontWeight: 600 }}>
                  {terminosSitio.singular.toUpperCase()} *
                </label>
                <select
                  value={consRanchoId}
                  onChange={(e) => { setConsRanchoId(e.target.value); setErrConsRancho(false) }}
                  className={`w-full h-11 px-3 rounded-lg bg-input-background border text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary ${
                    errConsRancho ? 'border-agro-red' : 'border-border'
                  } ${!consRanchoId ? 'text-muted-foreground' : 'text-foreground'}`}
                >
                  <option value="" disabled>Seleccionar {terminosSitio.singular.toLowerCase()}</option>
                  {ranchoOptions.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                {errConsRancho && <p className="text-xs text-agro-red mt-1">Selecciona {terminosSitio.genero === 'f' ? 'una' : 'un'} {terminosSitio.singular.toLowerCase()}</p>}
              </div>

              {/* Desde */}
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5" style={{ fontWeight: 600 }}>
                  DESDE *
                </label>
                <input
                  type="date"
                  value={consDesde}
                  onChange={(e) => { setConsDesde(e.target.value); setErrConsFechas(false) }}
                  className={`w-full h-11 px-3 rounded-lg bg-input-background border text-sm text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary ${
                    errConsFechas && !consDesde ? 'border-agro-red' : 'border-border'
                  }`}
                />
              </div>

              {/* Hasta */}
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5" style={{ fontWeight: 600 }}>
                  HASTA *
                </label>
                <input
                  type="date"
                  value={consHasta}
                  onChange={(e) => { setConsHasta(e.target.value); setErrConsFechas(false) }}
                  className={`w-full h-11 px-3 rounded-lg bg-input-background border text-sm text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary ${
                    errConsFechas && !consHasta ? 'border-agro-red' : 'border-border'
                  }`}
                />
                {errConsFechas && <p className="text-xs text-agro-red mt-1">Indica el rango de fechas</p>}
              </div>
            </div>

            <div className="p-4 border-t border-border flex-shrink-0">
              <button
                onClick={handleGenerarConsolidado}
                disabled={generandoConsolidado}
                className="w-full h-14 bg-primary text-white rounded-3xl flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-agro-blue transition-colors"
                style={{ fontWeight: 600 }}
              >
                {generandoConsolidado && <Loader2 className="w-4 h-4 animate-spin" />}
                Generar PDF consolidado
              </button>
            </div>
      </BottomSheet>

      {/* Bottom Sheet — formulario */}
      <BottomSheet open={sheetAbierto} onClose={() => setSheetAbierto(false)} height="85%">
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
              <div className="w-10 h-1 rounded-full bg-border" />
            </div>

            {/* Header sheet */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
              <h2 className="text-base text-foreground" style={{ fontWeight: 600 }}>
                Nueva verificación
              </h2>
              <button
                onClick={() => setSheetAbierto(false)}
                className="p-1"
              >
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            {/* Campos */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">

              {/* Sitio */}
              <div>
                <label
                  className="block text-xs text-muted-foreground mb-1.5"
                  style={{ fontWeight: 600 }}
                >
                  {terminosSitio.singular.toUpperCase()} *
                </label>
                <select
                  value={form.rancho_id}
                  onChange={(e) => {
                    setForm((f) => ({ ...f, rancho_id: e.target.value }))
                    setErrRancho(false)
                  }}
                  className={`w-full h-11 px-3 rounded-lg bg-input-background border text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary ${
                    errRancho ? 'border-agro-red' : 'border-border'
                  } ${!form.rancho_id ? 'text-muted-foreground' : 'text-foreground'}`}
                >
                  <option value="" disabled>
                    Seleccionar {terminosSitio.singular.toLowerCase()}
                  </option>
                  {ranchoOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                {errRancho && (
                  <p className="text-xs text-agro-red mt-1">Selecciona {terminosSitio.genero === 'f' ? 'una' : 'un'} {terminosSitio.singular.toLowerCase()}</p>
                )}
              </div>

              {/* Fecha */}
              <div>
                <label
                  className="block text-xs text-muted-foreground mb-1.5"
                  style={{ fontWeight: 600 }}
                >
                  FECHA DE VERIFICACIÓN *
                </label>
                <input
                  type="date"
                  value={form.fecha_verificacion}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, fecha_verificacion: e.target.value }))
                  }
                  className="w-full h-11 px-3 rounded-lg bg-input-background border border-border text-sm text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>

              {/* Aviso límite semanal */}
              {limiteInfo && (
                <div className="flex items-start gap-2 rounded-xl p-3" style={{ backgroundColor: 'var(--agro-warning-fill)', border: '1px solid #F5A623' }}>
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--agro-warning-text)' }} />
                  <p className="text-xs" style={{ color: 'var(--agro-warning-text)' }}>
                    Ya existe un registro para este {terminosSitio.singular.toLowerCase()} en los últimos 7 días.{' '}
                    Próximo registro disponible:{' '}
                    <span style={{ fontWeight: 600 }}>{limiteInfo.proxima}</span>
                  </p>
                </div>
              )}

              {/* Artículos */}
              <div>
                <label
                  className="block text-xs text-muted-foreground mb-2"
                  style={{ fontWeight: 600 }}
                >
                  ARTÍCULOS EN BOTIQUÍN
                </label>
                <p className="text-xs text-muted-foreground mb-3">
                  Todos activados por defecto. Desactiva lo que NO haya.
                </p>
                <div className="space-y-2">
                  {ARTICULOS.map((a) => (
                    <ArticuloToggle
                      key={a.key}
                      label={a.label}
                      activo={form[a.key]}
                      onToggle={() => toggleArticulo(a.key)}
                    />
                  ))}
                </div>
              </div>

              {/* Responsable (read-only) */}
              <div>
                <label
                  className="block text-xs text-muted-foreground mb-1.5"
                  style={{ fontWeight: 600 }}
                >
                  RESPONSABLE
                </label>
                <div className="h-11 px-3 rounded-lg bg-muted border border-border flex items-center">
                  <span className="text-sm text-muted-foreground">
                    {profile?.nombre_completo ?? '—'}
                  </span>
                </div>
              </div>

            </div>

            {/* Guardar */}
            <div className="p-4 border-t border-border flex-shrink-0">
              <button
                onClick={handleGuardar}
                disabled={guardando || !!limiteInfo}
                className="w-full h-14 bg-primary text-white rounded-3xl flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-agro-blue transition-colors"
                style={{ fontWeight: 600 }}
              >
                {guardando && <Loader2 className="w-4 h-4 animate-spin" />}
                Guardar y generar PDF
              </button>
            </div>
      </BottomSheet>
    </div>
  )
}
